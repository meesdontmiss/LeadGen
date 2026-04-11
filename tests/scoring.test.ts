import { describe, it, expect } from "vitest";
import { calculateOutreachScore, qualifiesForOutreach, recommendOfferType } from "../lib/scoring";

describe("Scoring Engine", () => {
  describe("calculateOutreachScore", () => {
    it("should calculate score correctly with perfect scores", () => {
      const score = calculateOutreachScore({
        premiumFit: 100,
        presentationGap: 100,
        contactability: 100,
      });
      expect(score).toBe(100);
    });

    it("should calculate score with zero values", () => {
      const score = calculateOutreachScore({
        premiumFit: 0,
        presentationGap: 0,
        contactability: 0,
      });
      expect(score).toBe(0);
    });

    it("should weight premium_fit at 40%", () => {
      const score = calculateOutreachScore({
        premiumFit: 100,
        presentationGap: 0,
        contactability: 0,
      });
      expect(score).toBe(40);
    });

    it("should weight presentation_gap at 35%", () => {
      const score = calculateOutreachScore({
        premiumFit: 0,
        presentationGap: 100,
        contactability: 0,
      });
      expect(score).toBe(35);
    });

    it("should weight contactability at 25%", () => {
      const score = calculateOutreachScore({
        premiumFit: 0,
        presentationGap: 0,
        contactability: 100,
      });
      expect(score).toBe(25);
    });

    it("should handle typical mid-range values", () => {
      const score = calculateOutreachScore({
        premiumFit: 75,
        presentationGap: 60,
        contactability: 70,
      });
      expect(score).toBe(68.5);
    });
  });

  describe("qualifiesForOutreach", () => {
    it("should qualify when all thresholds are met", () => {
      expect(
        qualifiesForOutreach({
          premiumFit: 70,
          presentationGap: 60,
          contactability: 55,
        })
      ).toBe(true);
    });

    it("should not qualify when premium_fit is too low", () => {
      expect(
        qualifiesForOutreach({
          premiumFit: 60,
          presentationGap: 70,
          contactability: 70,
        })
      ).toBe(false);
    });

    it("should not qualify when presentation_gap is too low", () => {
      expect(
        qualifiesForOutreach({
          premiumFit: 70,
          presentationGap: 40,
          contactability: 70,
        })
      ).toBe(false);
    });

    it("should not qualify when contactability is too low", () => {
      expect(
        qualifiesForOutreach({
          premiumFit: 70,
          presentationGap: 60,
          contactability: 40,
        })
      ).toBe(false);
    });

    it("should qualify at exact thresholds", () => {
      expect(
        qualifiesForOutreach({
          premiumFit: 65,
          presentationGap: 50,
          contactability: 50,
        })
      ).toBe(true);
    });
  });

  describe("recommendOfferType", () => {
    it("should recommend prototype site for high presentation gap and low visual/cta", () => {
      const offer = recommendOfferType({
        presentationGap: 70,
        visualQuality: 50,
        ctaQuality: 45,
        contactability: 60,
      });
      expect(offer).toBe("free_prototype_site");
    });

    it("should recommend video/photo concept for low visual quality", () => {
      const offer = recommendOfferType({
        presentationGap: 60,
        visualQuality: 40,
        ctaQuality: 70,
        contactability: 60,
      });
      expect(offer).toBe("free_video_photo_concept");
    });

    it("should recommend teardown brief for low contactability", () => {
      const offer = recommendOfferType({
        presentationGap: 50,
        visualQuality: 60,
        ctaQuality: 65,
        contactability: 50,
      });
      expect(offer).toBe("free_teardown_brief");
    });

    it("should default to teardown brief when no specific condition matches", () => {
      const offer = recommendOfferType({
        presentationGap: 40,
        visualQuality: 70,
        ctaQuality: 75,
        contactability: 70,
      });
      expect(offer).toBe("free_teardown_brief");
    });
  });
});
