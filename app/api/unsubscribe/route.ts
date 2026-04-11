import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

const unsubscribeSchema = z.object({
  companyId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = unsubscribeSchema.parse(await request.json());

    if (!body.email && !body.companyId) {
      return Response.json(
        { error: "Either email or companyId is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return Response.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Add to suppression list
    const { error } = await supabase.from("suppression_list").insert({
      company_id: body.companyId || null,
      email: body.email || null,
      reason: "opt_out",
      source: "unsubscribe_endpoint",
      notes: body.reason || "User unsubscribed via API endpoint",
    });

    if (error) {
      console.error("[API /unsubscribe] Failed to add to suppression list:", error);
      return Response.json(
        { error: "Failed to process unsubscribe request" },
        { status: 500 }
      );
    }

    // Also update contact's do_not_contact flag if email provided
    if (body.email) {
      await supabase
        .from("contacts")
        .update({ do_not_contact: true })
        .eq("email", body.email);
    }

    return Response.json({
      ok: true,
      message: "Successfully unsubscribed",
    });
  } catch (error) {
    console.error("[API /unsubscribe] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to unsubscribe";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    message: "Send POST with email or companyId to unsubscribe",
  });
}
