import { z } from "zod";

import { env } from "@/lib/env";
import { createGmailDraft } from "@/lib/services/gmail";
import {
  getDashboardData,
  getLeadRecord,
  persistGmailDraftMetadata,
} from "@/lib/services/dashboard-repository";

const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("summary"),
  }),
  z.object({
    action: z.literal("lead"),
    companyId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create_gmail_draft"),
    companyId: z.string().min(1),
  }),
]);

function isAuthorized(request: Request) {
  const provided =
    request.headers.get("x-openclaw-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(env.OPENCLAW_WEBHOOK_SECRET && provided === env.OPENCLAW_WEBHOOK_SECRET);
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = commandSchema.parse(await request.json());

    if (body.action === "summary") {
      const data = await getDashboardData();
      return Response.json({
        integrations: data.integrations,
        summary: data.summary,
        topLeads: data.leads.slice(0, 5).map((lead) => ({
          companyId: lead.company.id,
          companyName: lead.company.name,
          outreachScore: lead.audit.scores.outreachScore,
          status: lead.company.status,
        })),
      });
    }

    const lead = await getLeadRecord(body.companyId);

    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    if (body.action === "lead") {
      return Response.json({ lead });
    }

    const draft = await createGmailDraft({
      to: lead.contact.email,
      subject:
        lead.latestEmail.subjectVariants[0] ?? `${lead.company.name} outreach idea`,
      body: [lead.latestEmail.plainText, "", ...lead.latestEmail.complianceFooter].join(
        "\n",
      ),
    });

    await persistGmailDraftMetadata({
      emailId: lead.latestEmail.id,
      draftId: draft.draftId,
      messageId: draft.messageId,
      threadId: draft.threadId,
    });

    return Response.json({
      companyId: lead.company.id,
      draft,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenClaw command failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}
