import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

const queueSchema = z.object({
  action: z.enum(["queue_for_approval"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = queueSchema.parse(await request.json());

    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Update lead status to draft_ready
    const { error } = await supabase
      .from("companies")
      .update({ lead_status: "draft_ready" })
      .eq("id", companyId);

    if (error) {
      console.error("[API /leads/[id]/queue] Failed to update lead status:", error);
      return Response.json(
        { error: "Failed to update lead status" },
        { status: 500 }
      );
    }

    // Approve the latest proposal draft so it can be sent manually by operator.
    const latestEmailResult = await supabase
      .from("emails")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestEmailResult.error) {
      console.error("[API /leads/[id]/queue] Failed to fetch latest email:", latestEmailResult.error);
      return Response.json(
        { error: "Failed to fetch latest email draft for approval" },
        { status: 500 }
      );
    }

    let emailApproved = false;
    if (latestEmailResult.data?.id && latestEmailResult.data.status === "draft") {
      const { error: emailError } = await supabase
        .from("emails")
        .update({ status: "approved" })
        .eq("id", latestEmailResult.data.id);

      if (emailError) {
        console.error("[API /leads/[id]/queue] Failed to approve email:", emailError);
        return Response.json(
          { error: "Failed to approve latest email draft" },
          { status: 500 }
        );
      }

      emailApproved = true;
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      actor: "operator",
      event_type: "proposal_approved_for_send",
      event_summary: "Lead approved for manual send",
      payload: { action: body.action, emailApproved },
    });

    return Response.json({
      ok: true,
      emailApproved,
      message: emailApproved
        ? "Lead approved and latest proposal is ready to send."
        : "Lead approved for send. No new draft needed approval.",
    });
  } catch (error) {
    console.error("[API /leads/[id]/queue] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to queue lead";
    return Response.json({ error: message }, { status: 500 });
  }
}
