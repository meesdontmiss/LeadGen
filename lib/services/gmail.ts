import "server-only";

import { google } from "googleapis";

import { env, hasRuntimeGmailEnv } from "@/lib/env";

function encodeMessage(raw: string) {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getGmailClient() {
  if (!hasRuntimeGmailEnv()) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    refresh_token: env.GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
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
  const gmail = getGmailClient();

  if (!gmail) {
    throw new Error("Runtime Gmail OAuth env is not configured.");
  }

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encodeMessage(raw),
      },
    },
  });

  return {
    draftId: response.data.id ?? null,
    messageId: response.data.message?.id ?? null,
    threadId: response.data.message?.threadId ?? null,
  };
}
