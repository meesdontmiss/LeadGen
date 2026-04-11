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

    // Log the activity
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      actor: "operator",
      event_type: "queued_for_approval",
      event_summary: "Lead queued for approval",
      payload: { action: body.action },
    });

    return Response.json({
      ok: true,
      message: "Lead queued for approval",
    });
  } catch (error) {
    console.error("[API /leads/[id]/queue] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to queue lead";
    return Response.json({ error: message }, { status: 500 });
  }
}
