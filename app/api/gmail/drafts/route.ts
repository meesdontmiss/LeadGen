import { z } from "zod";

import { sanitizeFooterForOutbound } from "@/lib/compliance";
import { createGmailDraft } from "@/lib/services/gmail";
import {
  getLeadRecord,
  persistGmailDraftMetadata,
} from "@/lib/services/dashboard-repository";

const createDraftSchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = createDraftSchema.parse(await request.json());
    const lead = await getLeadRecord(body.companyId);

    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    const subject =
      lead.latestEmail.subjectVariants[0] ?? `${lead.company.name} outreach idea`;

    const draft = await createGmailDraft({
      to: lead.contact.email,
      subject,
      // Always sanitize persisted footer content before external send.
      body: [
        lead.latestEmail.plainText,
        "",
        ...sanitizeFooterForOutbound(lead.latestEmail.complianceFooter),
      ].join("\n"),
    });

    await persistGmailDraftMetadata({
      emailId: lead.latestEmail.id,
      draftId: draft.draftId,
      messageId: draft.messageId,
      threadId: draft.threadId,
    });

    return Response.json({
      ok: true,
      companyId: body.companyId,
      draft,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Gmail draft.";

    return Response.json({ error: message }, { status: 500 });
  }
}
