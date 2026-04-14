import { z } from "zod";

import { sanitizeFooterForOutbound } from "@/lib/compliance";
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

const sendFollowUpSchema = z.object({
  action: z.literal("follow_up"),
  companyId: z.string().min(1),
  body: z.string().trim().optional(),
});

const sendSchema = z.discriminatedUnion("action", [
  sendDraftSchema,
  sendReplySchema,
  sendFollowUpSchema,
]);

function getLeadEmailSubject(lead: NonNullable<Awaited<ReturnType<typeof getLeadRecord>>>) {
  return (
    lead.latestEmail.subject ||
    lead.latestEmail.subjectVariants[0] ||
    `${lead.company.name} outreach`
  );
}

function canSendInitialDraft(lead: NonNullable<Awaited<ReturnType<typeof getLeadRecord>>>) {
  return lead.latestEmail.status === "draft" || lead.latestEmail.status === "approved";
}

function buildAutoFollowUpBody(
  lead: NonNullable<Awaited<ReturnType<typeof getLeadRecord>>>,
) {
  const firstName = lead.contact.fullName.split(" ")[0] || "there";
  const serviceLabel = lead.company.vertical.toLowerCase().includes("interior")
    ? "project consultations"
    : lead.company.vertical.toLowerCase().includes("hair") ||
        lead.company.vertical.toLowerCase().includes("spa")
      ? "appointments"
      : "qualified consultations";

  const footer = sanitizeFooterForOutbound(lead.latestEmail.complianceFooter);

  return [
    `Hi ${firstName},`,
    "",
    `Quick follow-up on my note about ${lead.company.name}.`,
    "",
    `I put together a tailored plan focused on turning more local traffic into ${serviceLabel}, with specific fixes for messaging, conversion flow, and trust signals.`,
    "",
    "If helpful, I can send the one-page action plan and walk through it on a short 15-minute call.",
    "Would Tuesday or Wednesday afternoon work better on your side?",
    "",
    ...footer,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = sendSchema.parse(await request.json());
    const lead = await getLeadRecord(body.companyId);

    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    if (body.action === "send_draft") {
      if (!canSendInitialDraft(lead)) {
        return Response.json(
          {
            error:
              "Latest proposal is not in draft state. Use follow-up send for active threads.",
          },
          { status: 400 },
        );
      }
      if (!lead.contact.email) {
        return Response.json(
          { error: "Cannot send draft because no contact email is available." },
          { status: 400 },
        );
      }

      const subject = getLeadEmailSubject(lead);
      const footer = sanitizeFooterForOutbound(lead.latestEmail.complianceFooter);
      const composedBody = [
        lead.latestEmail.plainText,
        "",
        ...footer,
      ].join("\n");

      const sent = await sendGmailMessage({
        to: lead.contact.email,
        subject,
        body: composedBody,
        threadId: lead.latestEmail.gmailThreadId,
      });
      if (!sent.messageId) {
        return Response.json(
          { error: "Gmail did not confirm delivery. Email was not marked as sent." },
          { status: 502 },
        );
      }

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
        sentFrom: sent.mailboxEmail,
      });
    }

    if (body.action === "follow_up") {
      const headers = await getReplyHeaders({
        threadId: lead.latestEmail.gmailThreadId,
        contactEmail: lead.contact.email,
      });

      if (!headers.threadId) {
        return Response.json(
          { error: "Cannot send follow-up because no Gmail thread exists yet." },
          { status: 400 },
        );
      }

      const baseSubject = headers.subject || getLeadEmailSubject(lead);
      const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;
      const generatedFollowUpBody = buildAutoFollowUpBody(lead);

      const composedBody = body.body?.trim() || generatedFollowUpBody;

      if (!composedBody) {
        return Response.json(
          { error: "Follow-up body is empty. Add a message before sending." },
          { status: 400 },
        );
      }

      const sent = await sendGmailMessage({
        to: lead.contact.email,
        subject,
        body: composedBody,
        threadId: headers.threadId,
        inReplyTo: headers.inReplyTo,
        references: headers.references,
      });
      if (!sent.messageId) {
        return Response.json(
          { error: "Gmail did not confirm delivery. Reply was not marked as sent." },
          { status: 502 },
        );
      }

      await createReplyRecord({
        lead,
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
        sentFrom: sent.mailboxEmail,
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
    if (!sent.messageId) {
      return Response.json(
        { error: "Gmail did not confirm delivery. Reply was not marked as sent." },
        { status: 502 },
      );
    }

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
      sentFrom: sent.mailboxEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send Gmail message.";

    return Response.json({ error: message }, { status: 500 });
  }
}
