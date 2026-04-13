import { z } from "zod";

import {
  getDashboardData,
  scheduleCampaignBooking,
} from "@/lib/services/dashboard-repository";

const createBookingSchema = z.object({
  companyId: z.string().min(1),
  type: z.enum(["call", "gig"]),
  scheduledAt: z.string().datetime(),
  title: z.string().trim().min(1),
  notes: z.string().trim().optional().default(""),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const data = await getDashboardData();

    const bookings = data.leads
      .flatMap((lead) =>
        lead.campaign.bookings.map((booking) => ({
          ...booking,
          companyId: lead.company.id,
          companyName: lead.company.name,
          contactName: lead.contact.fullName,
          contactEmail: lead.contact.email,
        })),
      )
      .filter((booking) => !companyId || booking.companyId === companyId)
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

    return Response.json({
      generatedAt: new Date().toISOString(),
      bookings,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load bookings.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = createBookingSchema.parse(await request.json());
    const booking = await scheduleCampaignBooking({
      companyId: body.companyId,
      type: body.type,
      scheduledAt: body.scheduledAt,
      title: body.title,
      notes: body.notes,
    });

    return Response.json({
      ok: true,
      booking,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to schedule booking.";
    return Response.json({ error: message }, { status: 500 });
  }
}
