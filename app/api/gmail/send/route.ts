import { z } from "zod";

import {
  createReplyRecord,
  getLeadRecord,
  markEmailAsSent,
} from "@/lib/services/dashboard-repository";
import { getReplyHeaders, sendGmailMessage } from "@/lib/services/gmail";

const sendDraftSchema = z.object({
  action: z.literal("send_draft"),
  companyId: z.string().min(1),
});

const sendReplySchema = z.object({
  action: z.literal("reply"),
  companyId: z.string().min(1),
  body: z.string().trim().min(1, "Reply body is required."),
});

const sendSchema = z.discriminatedUnion("action", [
  sendDraftSchema,
  sendReplySchema,
]);

function getLeadEmailSubject(lead: NonNullable<Awaited<ReturnType<typeof getLeadRecord>>>) {
  return (
    lead.latestEmail.subject ||
    lead.latestEmail.subjectVariants[0] ||
    `${lead.company.name} outreach`
  );
}

export async function POST(request: Request) {
  try {
    const body = sendSchema.parse(await request.json());
    const lead = await getLeadRecord(body.companyId);

    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    if (body.action === "send_draft") {
      const subject = getLeadEmailSubject(lead);
      const composedBody = [
        lead.latestEmail.plainText,
        "",
        ...lead.latestEmail.complianceFooter,
      ].join("\n");

      const sent = await sendGmailMessage({
        to: lead.contact.email,
        subject,
        body: composedBody,
        threadId: lead.latestEmail.gmailThreadId,
      });

      await markEmailAsSent({
        emailId: lead.latestEmail.id,
        subject,
        bodyText: composedBody,
        threadId: sent.threadId,
        messageId: sent.messageId,
      });

      return Response.json({
        ok: true,
        action: body.action,
        companyId: body.companyId,
        sent,
      });
    }

    const headers = await getReplyHeaders({
      threadId: lead.latestEmail.gmailThreadId,
      contactEmail: lead.contact.email,
    });

    if (!headers.threadId) {
      return Response.json(
        { error: "No existing Gmail thread was found for this lead." },
        { status: 400 },
      );
    }

    const baseSubject = headers.subject || getLeadEmailSubject(lead);
    const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

    const sent = await sendGmailMessage({
      to: lead.contact.email,
      subject,
      body: body.body,
      threadId: headers.threadId,
      inReplyTo: headers.inReplyTo,
      references: headers.references,
    });

    await createReplyRecord({
      lead,
      subject,
      bodyText: body.body,
      threadId: sent.threadId,
      messageId: sent.messageId,
    });

    return Response.json({
      ok: true,
      action: body.action,
      companyId: body.companyId,
      sent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send Gmail message.";

    return Response.json({ error: message }, { status: 500 });
  }
}
