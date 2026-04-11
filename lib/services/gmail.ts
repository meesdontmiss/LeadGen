import "server-only";

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import { env, hasRuntimeGmailEnv } from "@/lib/env";

// Cache OAuth client and tokens to avoid unnecessary refreshes
let cachedOAuth2Client: OAuth2Client | null = null;
let lastRefreshTime: number = 0;
const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // Refresh every 45 minutes

function encodeMessage(raw: string) {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getOAuth2Client() {
  if (!hasRuntimeGmailEnv()) {
    return null;
  }

  // Reuse cached client if it's fresh enough
  const now = Date.now();
  if (cachedOAuth2Client && (now - lastRefreshTime) < REFRESH_INTERVAL_MS) {
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

  // Set up automatic token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      console.log("[Gmail] OAuth tokens refreshed. Update your GMAIL_REFRESH_TOKEN env var.");
      // In production, you'd want to persist this automatically
      // For now, log a warning so operators know to update
    }
  });

  try {
    // Force token refresh to ensure we have a valid access token
    await oauth2Client.getAccessToken();
    cachedOAuth2Client = oauth2Client;
    lastRefreshTime = now;
  } catch (error) {
    console.error("[Gmail] Failed to refresh OAuth token:", error);
    throw new Error(
      "Gmail OAuth token refresh failed. Check your refresh token and credentials."
    );
  }

  return oauth2Client;
}

export function getGmailClient() {
  if (!hasRuntimeGmailEnv()) {
    return null;
  }

  // Note: We're not calling getOAuth2Client() here to maintain sync interface
  // The async refresh happens in createGmailDraft
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
  // Get OAuth2 client with automatic token refresh
  const oauth2Client = await getOAuth2Client();
  
  if (!oauth2Client) {
    throw new Error("Runtime Gmail OAuth env is not configured.");
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");

  try {
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
  } catch (error) {
    console.error("[Gmail] Draft creation failed:", error);
    
    if (error instanceof Error) {
      // Handle specific Gmail API errors
      if ('code' in error && typeof (error as any).code === 'number') {
        const statusCode = (error as any).code;
        if (statusCode === 401) {
          throw new Error("Gmail authentication failed. Token may be expired or revoked. Please re-authenticate.");
        }
        if (statusCode === 403) {
          throw new Error("Gmail permission denied. Check OAuth scopes and API access.");
        }
        if (statusCode === 429) {
          throw new Error("Gmail rate limit exceeded. Wait a few minutes and try again.");
        }
      }
      throw new Error(`Gmail draft creation failed: ${error.message}`);
    }
    
    throw new Error("Gmail draft creation failed with unknown error.");
  }
}
