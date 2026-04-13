import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

const bulkQueueSchema = z.object({
  action: z.literal("auto_approve_selected"),
  companyIds: z.array(z.string().uuid()).min(1, "Select at least one lead."),
});

export async function POST(request: Request) {
  try {
    const body = bulkQueueSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const companyIds = [...new Set(body.companyIds)];

    const { error: companiesError } = await supabase
      .from("companies")
      .update({ lead_status: "draft_ready" })
      .in("id", companyIds);

    if (companiesError) {
      console.error("[API /leads/queue] Failed to update company statuses:", companiesError);
      return Response.json(
        { error: "Failed to update selected lead statuses" },
        { status: 500 },
      );
    }

    const latestEmailsResult = await supabase
      .from("emails")
      .select("id, company_id, status, created_at")
      .eq("direction", "outbound")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false });

    if (latestEmailsResult.error) {
      console.error("[API /leads/queue] Failed to fetch latest emails:", latestEmailsResult.error);
      return Response.json(
        { error: "Failed to fetch latest outbound emails for selected leads" },
        { status: 500 },
      );
    }

    const latestByCompany = new Map<
      string,
      { id: string; status: string | null }
    >();

    for (const row of latestEmailsResult.data ?? []) {
      const companyId =
        typeof row.company_id === "string" ? row.company_id : null;
      const emailId = typeof row.id === "string" ? row.id : null;
      if (!companyId || !emailId || latestByCompany.has(companyId)) {
        continue;
      }

      latestByCompany.set(companyId, {
        id: emailId,
        status: typeof row.status === "string" ? row.status : null,
      });
    }

    const emailIdsToApprove = [...latestByCompany.values()]
      .filter((email) => email.status === "draft")
      .map((email) => email.id);

    if (emailIdsToApprove.length > 0) {
      const { error: approveError } = await supabase
        .from("emails")
        .update({ status: "approved" })
        .in("id", emailIdsToApprove);

      if (approveError) {
        console.error("[API /leads/queue] Failed to approve latest drafts:", approveError);
        return Response.json(
          { error: "Failed to auto-approve selected drafts" },
          { status: 500 },
        );
      }
    }

    const approvedCompanyIds = companyIds.filter((companyId) => {
      const latest = latestByCompany.get(companyId);
      return latest?.status === "draft";
    });

    if (approvedCompanyIds.length > 0) {
      await supabase.from("activity_logs").insert(
        approvedCompanyIds.map((companyId) => ({
          company_id: companyId,
          actor: "operator",
          event_type: "proposal_auto_approved_for_send",
          event_summary: "Draft auto-approved from bulk action",
          payload: {
            action: body.action,
            bulk: true,
          },
        })),
      );
    }

    return Response.json({
      ok: true,
      selectedCount: companyIds.length,
      approvedCount: approvedCompanyIds.length,
      skippedCount: companyIds.length - approvedCompanyIds.length,
      message: `Auto-approved ${approvedCompanyIds.length} of ${companyIds.length} selected leads.`,
    });
  } catch (error) {
    console.error("[API /leads/queue] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to auto-approve selected leads";
    return Response.json({ error: message }, { status: 500 });
  }
}
