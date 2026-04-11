import { z } from "zod";

import { getLeadRecord } from "@/lib/services/dashboard-repository";
import { getGmailThread } from "@/lib/services/gmail";

const threadQuerySchema = z.object({
  companyId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = threadQuerySchema.parse({
      companyId: searchParams.get("companyId"),
    });

    const lead = await getLeadRecord(query.companyId);

    if (!lead) {
      return Response.json({ error: "Lead not found." }, { status: 404 });
    }

    const thread = await getGmailThread({
      threadId: lead.latestEmail.gmailThreadId,
      contactEmail: lead.contact.email,
    });

    return Response.json({
      ok: true,
      companyId: query.companyId,
      thread,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Gmail thread.";

    return Response.json({ error: message }, { status: 500 });
  }
}
