import { z } from "zod";

import { updateCampaignBookingStatus } from "@/lib/services/dashboard-repository";

const updateBookingSchema = z.object({
  companyId: z.string().min(1),
  status: z.enum(["scheduled", "completed", "canceled"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const body = updateBookingSchema.parse(await request.json());
    const result = await updateCampaignBookingStatus({
      companyId: body.companyId,
      bookingId,
      status: body.status,
    });

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update booking.";
    return Response.json({ error: message }, { status: 500 });
  }
}
