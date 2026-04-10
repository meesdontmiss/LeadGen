import type { OfferType } from "@/lib/types";

export function calculateOutreachScore({
  premiumFit,
  presentationGap,
  contactability,
}: {
  premiumFit: number;
  presentationGap: number;
  contactability: number;
}) {
  return Math.round(
    premiumFit * 0.4 + presentationGap * 0.35 + contactability * 0.25,
  );
}

export function qualifiesForOutreach({
  premiumFit,
  presentationGap,
  contactability,
}: {
  premiumFit: number;
  presentationGap: number;
  contactability: number;
}) {
  return premiumFit >= 65 && presentationGap >= 50 && contactability >= 50;
}

export function recommendOfferType({
  presentationGap,
  visualQuality,
  ctaQuality,
  contactability,
}: {
  presentationGap: number;
  visualQuality: number;
  ctaQuality: number;
  contactability: number;
}) {
  if (presentationGap >= 65 && Math.min(visualQuality, ctaQuality) <= 55) {
    return "free_prototype_site" satisfies OfferType;
  }

  if (visualQuality <= 58 && presentationGap >= 55) {
    return "free_video_photo_concept" satisfies OfferType;
  }

  if (contactability < 68) {
    return "free_teardown_brief" satisfies OfferType;
  }

  return "free_teardown_brief" satisfies OfferType;
}
