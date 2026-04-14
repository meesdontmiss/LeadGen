import "server-only";

import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import { env, hasRuntimeGmailEnv } from "@/lib/env";
import type { GmailThreadMessage } from "@/lib/types";

let cachedOAuth2Client: OAuth2Client | null = null;
let lastRefreshTime = 0;
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

function encodeMessage(raw: string) {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatFromHeader({
  email,
  displayName,
}: {
  email: string;
  displayName?: string | null;
}) {
  const safeEmail = sanitizeHeaderValue(email);
  const safeDisplayName = displayName ? sanitizeHeaderValue(displayName) : "";

  if (!safeDisplayName) {
    return safeEmail;
  }

  return `"${safeDisplayName.replace(/"/g, '\\"')}" <${safeEmail}>`;
}

function decodeBase64Url(value: string) {
  return Buffer.from(
    value.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function extractPlainText(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) {
    return "";
  }

  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data).trim();
  }

  for (const child of part.parts ?? []) {
    const text = extractPlainText(child);
    if (text) {
      return text;
    }
  }

  if (part.body?.data) {
    return decodeBase64Url(part.body.data).trim();
  }

  return "";
}

async function getOAuth2Client() {
  if (!hasRuntimeGmailEnv()) {
    return null;
  }

  const now = Date.now();
  if (cachedOAuth2Client && now - lastRefreshTime < REFRESH_INTERVAL_MS) {
    return cachedOAuth2Client;
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    refresh_token: env.GMAIL_REFRESH_TOKEN,
  });

  oauth2Client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      console.log("[Gmail] OAuth tokens refreshed. Update your GMAIL_REFRESH_TOKEN env var.");
    }
  });

  try {
    await oauth2Client.getAccessToken();
    cachedOAuth2Client = oauth2Client;
    lastRefreshTime = now;
  } catch (error) {
    console.error("[Gmail] Failed to refresh OAuth token:", error);
    throw new Error(
      "Gmail OAuth token refresh failed. Check your refresh token and credentials.",
    );
  }

  return oauth2Client;
}

async function getAuthorizedGmail() {
  const oauth2Client = await getOAuth2Client();

  if (!oauth2Client) {
    throw new Error("Runtime Gmail OAuth env is not configured.");
  }

  return google.gmail({ version: "v1", auth: oauth2Client });
}

async function getMailboxEmail(gmail: gmail_v1.Gmail) {
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress?.toLowerCase() ?? "";
}

function buildRawMessage({
  to,
  subject,
  body,
  from,
  inReplyTo,
  references,
}: {
  to: string;
  subject: string;
  body: string;
  from?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  return [
    `To: ${to}`,
    ...(from ? [`From: ${from}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    "",
    body,
  ].join("\r\n");
}

function normalizeGmailError(error: unknown, context: string) {
  if (
    error instanceof Error &&
    /insufficient authentication scopes/i.test(error.message)
  ) {
    return new Error(
      "Gmail OAuth scopes are insufficient. Reconnect with Gmail read/send scopes.",
    );
  }

  if (error instanceof Error && "code" in error) {
    const statusCode = typeof (error as { code?: unknown }).code === "number"
      ? ((error as { code: number }).code)
      : null;

    if (statusCode === 401) {
      return new Error("Gmail authentication failed. Token may be expired or revoked.");
    }

    if (statusCode === 403) {
      return new Error("Gmail permission denied. Check OAuth scopes and API access.");
    }

    if (statusCode === 429) {
      return new Error("Gmail rate limit exceeded. Wait a few minutes and try again.");
    }
  }

  if (error instanceof Error) {
    return new Error(`${context}: ${error.message}`);
  }

  return new Error(`${context} with unknown error.`);
}

export async function createGmailDraft({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const gmail = await getAuthorizedGmail();
  const mailboxEmail = await getMailboxEmail(gmail);
  const from = formatFromHeader({
    email: mailboxEmail,
    displayName: env.GMAIL_SENDER_NAME,
  });

  try {
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodeMessage(
            buildRawMessage({
              to,
              subject,
              body,
              from,
            }),
          ),
        },
      },
    });

    return {
      draftId: response.data.id ?? null,
      messageId: response.data.message?.id ?? null,
      threadId: response.data.message?.threadId ?? null,
    };
  } catch (error) {
    console.error("[Gmail] Draft creation failed:", error);
    throw normalizeGmailError(error, "Gmail draft creation failed");
  }
}

export async function sendGmailMessage({
  to,
  subject,
  body,
  threadId,
  inReplyTo,
  references,
}: {
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const gmail = await getAuthorizedGmail();
  const mailboxEmail = await getMailboxEmail(gmail);
  const from = formatFromHeader({
    email: mailboxEmail,
    displayName: env.GMAIL_SENDER_NAME,
  });

  try {
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeMessage(
          buildRawMessage({
            to,
            subject,
            body,
            from,
            inReplyTo,
            references,
          }),
        ),
        threadId: threadId ?? undefined,
      },
    });

    const messageId = response.data.id ?? null;
    if (!messageId) {
      throw new Error("Gmail did not return a message id for this send request.");
    }

    const sentMessage = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "minimal",
    });
    const labelIds = sentMessage.data.labelIds ?? [];

    if (!labelIds.includes("SENT")) {
      throw new Error("Gmail send could not be verified in the Sent mailbox.");
    }

    return {
      messageId,
      threadId: response.data.threadId ?? threadId ?? null,
      mailboxEmail,
    };
  } catch (error) {
    console.error("[Gmail] Send failed:", error);
    throw normalizeGmailError(error, "Gmail send failed");
  }
}

async function findThreadIdByContactEmail(
  gmail: gmail_v1.Gmail,
  contactEmail: string,
) {
  const result = await gmail.users.threads.list({
    userId: "me",
    q: `from:${contactEmail} OR to:${contactEmail}`,
    maxResults: 1,
  });

  return result.data.threads?.[0]?.id ?? null;
}

export async function getGmailThread({
  threadId,
  contactEmail,
}: {
  threadId?: string | null;
  contactEmail: string;
}) {
  const gmail = await getAuthorizedGmail();
  const mailboxEmail = (await getMailboxEmail(gmail)).toLowerCase();
  const resolvedThreadId =
    threadId || (await findThreadIdByContactEmail(gmail, contactEmail));

  if (!resolvedThreadId) {
    return {
      mailboxEmail,
      threadId: null,
      messages: [] as GmailThreadMessage[],
    };
  }

  try {
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: resolvedThreadId,
      format: "full",
    });

    const messages = (thread.data.messages ?? [])
      .map((message) => {
        const from = getHeader(message.payload?.headers, "From");
        const to = getHeader(message.payload?.headers, "To");
        const subject = getHeader(message.payload?.headers, "Subject");
        const body = extractPlainText(message.payload);
        const fromValue = from.toLowerCase();
        const direction =
          mailboxEmail && fromValue.includes(mailboxEmail) ? "outbound" : "inbound";

        return {
          id: message.id ?? "",
          threadId: message.threadId ?? resolvedThreadId,
          from,
          to,
          subject,
          snippet: message.snippet ?? body.slice(0, 180),
          body: body || message.snippet || "",
          sentAt: message.internalDate
            ? new Date(Number(message.internalDate)).toISOString()
            : new Date().toISOString(),
          direction,
        } satisfies GmailThreadMessage;
      })
      .sort((left, right) => left.sentAt.localeCompare(right.sentAt));

    return {
      mailboxEmail,
      threadId: resolvedThreadId,
      messages,
    };
  } catch (error) {
    console.error("[Gmail] Thread fetch failed:", error);
    throw normalizeGmailError(error, "Failed to fetch Gmail thread");
  }
}

export async function getReplyHeaders({
  threadId,
  contactEmail,
}: {
  threadId?: string | null;
  contactEmail: string;
}) {
  const gmail = await getAuthorizedGmail();
  const resolvedThreadId =
    threadId || (await findThreadIdByContactEmail(gmail, contactEmail));

  if (!resolvedThreadId) {
    return {
      threadId: null,
      inReplyTo: null,
      references: null,
      subject: null,
    };
  }

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: resolvedThreadId,
    format: "metadata",
    metadataHeaders: ["Message-ID", "References", "Subject"],
  });

  const lastMessage = (thread.data.messages ?? []).at(-1);
  const headers = lastMessage?.payload?.headers;
  const subject = getHeader(headers, "Subject");

  return {
    threadId: resolvedThreadId,
    inReplyTo: getHeader(headers, "Message-ID") || null,
    references: getHeader(headers, "References") || getHeader(headers, "Message-ID") || null,
    subject: subject || null,
  };
}
