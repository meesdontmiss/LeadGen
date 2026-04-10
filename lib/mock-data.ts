import {
  calculateOutreachScore,
  qualifiesForOutreach,
  recommendOfferType,
} from "@/lib/scoring";
import type {
  ActivityItem,
  Campaign,
  Company,
  Contact,
  DashboardData,
  DiscoveryPreset,
  DomainHealth,
  EmailDraft,
  LeadRecord,
  Offer,
  QueueSummary,
  SiteAudit,
  WorkerStatus,
} from "@/lib/types";

const discoveryPreset: DiscoveryPreset = {
  neighborhoods: [
    "Beverly Hills",
    "West Hollywood",
    "Brentwood",
    "Pacific Palisades",
    "Newport Coast",
  ],
  verticals: [
    "Med spa",
    "Cosmetic dentistry",
    "Interior design",
    "Landscape design",
    "Concierge recovery",
  ],
  keywords: [
    "luxury med spa",
    "cosmetic dentist",
    "interior designer",
    "landscape architect",
    "concierge recovery",
  ],
  domainFilters: [".com", ".co", ".studio"],
  minimumPremiumFit: 65,
};

const companies: Company[] = [
  {
    id: "cmp_atelier_ora",
    name: "Atelier Ora Medspa",
    vertical: "Med spa",
    neighborhood: "Beverly Hills",
    city: "Los Angeles",
    state: "CA",
    domain: "atelierora.studio",
    website: "https://atelierora.studio",
    phone: "(310) 555-0191",
    ownerName: "Dr. Helena Ross",
    premiumFit: 84,
    contactability: 82,
    status: "draft_ready",
    source: "Google Maps actor",
    discoveredAt: "2026-04-09T16:12:00.000Z",
    notes:
      "Strong in-person luxury cues and a solid review footprint, but the website still reads like a commodity clinic.",
  },
  {
    id: "cmp_crescent_glen",
    name: "Crescent Glen Dental Atelier",
    vertical: "Cosmetic dentistry",
    neighborhood: "West Hollywood",
    city: "Los Angeles",
    state: "CA",
    domain: "crescentglen.com",
    website: "https://crescentglen.com",
    phone: "(323) 555-0148",
    ownerName: "Dr. Adrian Cole",
    premiumFit: 88,
    contactability: 74,
    status: "qualified",
    source: "Directory crawler",
    discoveredAt: "2026-04-08T19:48:00.000Z",
    notes:
      "Strong positioning and authority, but the visual presentation feels outdated and under-photographed.",
  },
  {
    id: "cmp_house_meridian",
    name: "House Meridian Interiors",
    vertical: "Interior design",
    neighborhood: "Brentwood",
    city: "Los Angeles",
    state: "CA",
    domain: "housemeridian.co",
    website: "https://housemeridian.co",
    phone: "(424) 555-0110",
    ownerName: "Mara Quinn",
    premiumFit: 79,
    contactability: 68,
    status: "sent",
    source: "Google Maps actor",
    discoveredAt: "2026-04-07T17:05:00.000Z",
    notes:
      "The work is premium, but the site hierarchy obscures the strongest residential portfolio examples.",
  },
  {
    id: "cmp_north_cove",
    name: "North Cove Landscape Studio",
    vertical: "Landscape design",
    neighborhood: "Pacific Palisades",
    city: "Los Angeles",
    state: "CA",
    domain: "northcove.studio",
    website: "https://northcove.studio",
    phone: "(310) 555-0166",
    ownerName: "Owen Hart",
    premiumFit: 81,
    contactability: 71,
    status: "interested",
    source: "Directory crawler",
    discoveredAt: "2026-04-06T15:22:00.000Z",
    notes:
      "Great local fit and a high-ticket service mix. The mobile site hides trust signals and makes booking harder than it should be.",
  },
  {
    id: "cmp_sable_house",
    name: "Sable House Recovery",
    vertical: "Concierge recovery",
    neighborhood: "Newport Coast",
    city: "Newport Beach",
    state: "CA",
    domain: "sablehouse.co",
    website: "https://sablehouse.co",
    phone: "(949) 555-0107",
    ownerName: "Daniel Ives",
    premiumFit: 76,
    contactability: 64,
    status: "new",
    source: "Google Maps actor",
    discoveredAt: "2026-04-10T12:08:00.000Z",
    notes:
      "Premium service envelope is there, but the current site underplays the concierge angle and lacks urgency around inquiry.",
  },
  {
    id: "cmp_lumiere_skin",
    name: "Lumiere Skin Haus",
    vertical: "Aesthetic clinic",
    neighborhood: "Laguna Beach",
    city: "Laguna Beach",
    state: "CA",
    domain: "lumiereskinhaus.com",
    website: "https://lumiereskinhaus.com",
    phone: "(949) 555-0134",
    ownerName: "Dr. Jules Mercer",
    premiumFit: 83,
    contactability: 79,
    status: "booked",
    source: "Google Maps actor",
    discoveredAt: "2026-04-05T20:14:00.000Z",
    notes:
      "The practice books premium services already; the opportunity is a more cinematic presentation and stronger conversion path.",
  },
];

const contacts: Contact[] = [
  {
    id: "con_1",
    companyId: "cmp_atelier_ora",
    fullName: "Mila Sutton",
    title: "Practice Director",
    email: "mila@atelierora.studio",
    confidence: 92,
    source: "contact page",
    primary: true,
  },
  {
    id: "con_2",
    companyId: "cmp_crescent_glen",
    fullName: "Adrian Cole",
    title: "Founder",
    email: "drcole@crescentglen.com",
    confidence: 83,
    source: "about page",
    primary: true,
  },
  {
    id: "con_3",
    companyId: "cmp_house_meridian",
    fullName: "Mara Quinn",
    title: "Creative Director",
    email: "mara@housemeridian.co",
    confidence: 78,
    source: "portfolio footer",
    primary: true,
  },
  {
    id: "con_4",
    companyId: "cmp_north_cove",
    fullName: "Owen Hart",
    title: "Principal Designer",
    email: "owen@northcove.studio",
    confidence: 81,
    source: "contact page",
    primary: true,
  },
  {
    id: "con_5",
    companyId: "cmp_sable_house",
    fullName: "Claire Benton",
    title: "Client Experience Lead",
    email: "claire@sablehouse.co",
    confidence: 72,
    source: "directory enrichment",
    primary: true,
  },
  {
    id: "con_6",
    companyId: "cmp_lumiere_skin",
    fullName: "Jules Mercer",
    title: "Founder",
    email: "drmercer@lumiereskinhaus.com",
    confidence: 89,
    source: "instagram bio link",
    primary: true,
  },
];

const rawAuditData = [
  {
    companyId: "cmp_atelier_ora",
    presentationGap: 77,
    visualQuality: 44,
    ctaQuality: 48,
    trustSignals: 53,
    mobileQuality: 52,
    seoBasics: 41,
    navFindings: ["7 top-nav items", "No founder proof in first viewport", "Menu labels feel transactional"],
    ctaFindings: ["Single CTA buried below fold", "Book now routes to generic form", "No concierge framing"],
    formFindings: ["5-field form", "No service preference selector", "No SLA expectation"],
    strengths: ["High review count", "Premium location signal", "Clear treatment breadth"],
    weaknesses: [
      "Hero copy leads with services instead of an elevated outcome.",
      "Photography quality is below the in-person experience.",
      "Primary CTA and trust proof compete with promotions.",
    ],
    hook:
      "You already feel premium in person; the current site still reads entry-level because the first screen sells treatments instead of experience.",
    screenshotNotes: {
      desktop: "Muted hero, cluttered navigation, weak contrast on booking CTA.",
      mobile: "Testimonials collapse below promotions and trust cues disappear.",
    },
  },
  {
    companyId: "cmp_crescent_glen",
    presentationGap: 61,
    visualQuality: 46,
    ctaQuality: 66,
    trustSignals: 57,
    mobileQuality: 64,
    seoBasics: 58,
    navFindings: ["Tight nav structure", "Service segmentation is clear", "Before/after gallery is hard to find"],
    ctaFindings: ["Consult CTA is visible", "Pricing language feels procedural", "No founder-led intro"],
    formFindings: ["Lead form is short", "Submission state is generic", "No reassurance around next step"],
    strengths: ["Strong offer clarity", "Good CTA placement", "Strong treatment mix"],
    weaknesses: [
      "Visual language does not match the premium ticket size.",
      "Founder credibility is text-heavy and photo-light.",
      "Case studies lack cinematic proof.",
    ],
    hook:
      "The practice already sounds elite; better imagery and a tighter founder story would make the site feel as expensive as the outcomes.",
    screenshotNotes: {
      desktop: "Functional layout with dated imagery blocks and thin storytelling.",
      mobile: "Clean enough, but case studies stack awkwardly and look repetitive.",
    },
  },
  {
    companyId: "cmp_house_meridian",
    presentationGap: 58,
    visualQuality: 63,
    ctaQuality: 54,
    trustSignals: 49,
    mobileQuality: 71,
    seoBasics: 45,
    navFindings: ["Portfolio taxonomy is broad", "Journal exists", "No clear residential vs. hospitality path"],
    ctaFindings: ["Inquiry CTA appears late", "No project-fit CTA", "Footer form lacks context"],
    formFindings: ["Multi-step intake missing", "No lead qualification cues", "No response promise"],
    strengths: ["Strong portfolio images", "Good whitespace discipline", "Luxury service fit is obvious"],
    weaknesses: [
      "Lead capture asks too little for a premium design engagement.",
      "Trust markers are understated.",
      "SEO basics miss project-specific metadata and location language.",
    ],
    hook:
      "The work sells itself. The opportunity is a teardown that turns quiet elegance into a clearer conversion path for higher-intent inquiries.",
    screenshotNotes: {
      desktop: "Beautiful image-led layout with underpowered conversion moments.",
      mobile: "Portfolio looks strong, but inquiry path is easy to miss.",
    },
  },
  {
    companyId: "cmp_north_cove",
    presentationGap: 73,
    visualQuality: 51,
    ctaQuality: 39,
    trustSignals: 42,
    mobileQuality: 46,
    seoBasics: 38,
    navFindings: ["Portfolio buried under generic service labels", "No regional proof", "Project flow is unclear"],
    ctaFindings: ["No visible CTA in hero", "Contact form hidden in footer", "No consultation framing"],
    formFindings: ["Long generic form", "No project budget prompt", "No calendar handoff"],
    strengths: ["Strong premium fit", "Clear service category", "High-value neighborhood alignment"],
    weaknesses: [
      "Booking path is weak on both desktop and mobile.",
      "Trust signals are scarce for a six-figure service.",
      "Site structure hides the best project work.",
    ],
    hook:
      "This is the clearest prototype-site candidate in the queue: great business, low-conviction site, and obvious upside from a stronger first impression.",
    screenshotNotes: {
      desktop: "Hero feels generic and does not sell finished estates or process.",
      mobile: "Menus take over the screen and the contact path feels hidden.",
    },
  },
  {
    companyId: "cmp_sable_house",
    presentationGap: 52,
    visualQuality: 60,
    ctaQuality: 47,
    trustSignals: 63,
    mobileQuality: 58,
    seoBasics: 49,
    navFindings: ["Service list is clear", "No concierge narrative in top nav", "FAQ tucked away"],
    ctaFindings: ["Inquiry CTA exists", "Urgency is weak", "No high-touch reassurance"],
    formFindings: ["Simple contact form", "No service urgency selection", "No transport or aftercare prompts"],
    strengths: ["Distinct service angle", "Good trust baseline", "Clear premium geography"],
    weaknesses: [
      "Positioning sounds medical before it sounds concierge.",
      "CTA language is passive.",
      "Search basics do not capture local intent strongly enough.",
    ],
    hook:
      "This lead is medium confidence: a concise teardown would likely land better than a full prototype pitch on first touch.",
    screenshotNotes: {
      desktop: "Site is clean but emotionally flat and not obviously premium.",
      mobile: "Readable layout, weak urgency, and no standout concierge moments.",
    },
  },
  {
    companyId: "cmp_lumiere_skin",
    presentationGap: 56,
    visualQuality: 58,
    ctaQuality: 62,
    trustSignals: 61,
    mobileQuality: 67,
    seoBasics: 54,
    navFindings: ["Clear funnel into treatments", "Founder is visible", "No signature visual system"],
    ctaFindings: ["Consult CTA is consistent", "No richer media entry point", "Video proof absent"],
    formFindings: ["Short form", "Fast follow-up expectations are visible", "Consult path feels credible"],
    strengths: ["Healthy conversion structure", "Good founder visibility", "Strong local trust baseline"],
    weaknesses: [
      "The brand feels premium, but the photography and motion do not.",
      "No high-end media storytelling around results.",
      "The best opportunity is elevating visuals rather than rewriting the funnel.",
    ],
    hook:
      "A free video and photo concept lands here because the business already converts. Better visuals would raise perceived value immediately.",
    screenshotNotes: {
      desktop: "Competent funnel with room for more editorial richness.",
      mobile: "Works fine, but the experience lacks a signature visual moment.",
    },
  },
];

const audits: SiteAudit[] = rawAuditData.map((audit) => {
  const company = companies.find((candidate) => candidate.id === audit.companyId);

  if (!company) {
    throw new Error(`Missing company for audit ${audit.companyId}`);
  }

  const outreachScore = calculateOutreachScore({
    premiumFit: company.premiumFit,
    presentationGap: audit.presentationGap,
    contactability: company.contactability,
  });

  return {
    id: `aud_${audit.companyId}`,
    companyId: audit.companyId,
    capturedAt: "2026-04-10T18:05:00.000Z",
    scores: {
      premiumFit: company.premiumFit,
      presentationGap: audit.presentationGap,
      visualQuality: audit.visualQuality,
      ctaQuality: audit.ctaQuality,
      trustSignals: audit.trustSignals,
      mobileQuality: audit.mobileQuality,
      seoBasics: audit.seoBasics,
      contactability: company.contactability,
      outreachScore,
    },
    navFindings: audit.navFindings,
    ctaFindings: audit.ctaFindings,
    formFindings: audit.formFindings,
    strengths: audit.strengths,
    weaknesses: audit.weaknesses,
    hook: audit.hook,
    screenshotNotes: audit.screenshotNotes,
    recommendedOfferType: recommendOfferType({
      presentationGap: audit.presentationGap,
      visualQuality: audit.visualQuality,
      ctaQuality: audit.ctaQuality,
      contactability: company.contactability,
    }),
  };
});

const offersByCompany: Record<string, Offer> = {
  cmp_atelier_ora: {
    id: "off_cmp_atelier_ora",
    companyId: "cmp_atelier_ora",
    type: "free_prototype_site",
    rationale:
      "Overall site presentation is weak enough that a homepage prototype feels immediately tangible and high-value.",
    teaserHeadline: "A founder-led homepage prototype for Beverly Hills conversion",
    teaserSummary:
      "Reframe the brand around luxury outcomes, founder trust, and a concierge booking path instead of a treatment list.",
    homepageBrief: [
      "Hero with founder portrait, outcome-led headline, and concierge consult CTA",
      "Signature treatments reframed as elevated experiences",
      "Trust block with reviews, awards, and Beverly Hills proof",
      "Fast-contact panel with response promise and preferred treatment intake",
    ],
    teaserJson: {
      mood: "quiet luxury / warm stone / editorial light",
      hero: "Founder's promise + concierge consult",
      sections: ["Signature experiences", "Proof", "Before / after story", "Fast inquiry"],
      primaryCTA: "Request a private consultation",
    },
  },
  cmp_crescent_glen: {
    id: "off_cmp_crescent_glen",
    companyId: "cmp_crescent_glen",
    type: "free_video_photo_concept",
    rationale:
      "The funnel is functional already; richer imagery and cinematic proof would do more than a structural rebuild.",
    teaserHeadline: "A photo and short-form video concept built for premium cosmetic cases",
    teaserSummary:
      "Show how the practice could feel more editorial, more founder-led, and more premium without rewriting the whole site.",
    homepageBrief: [
      "Case-study hero storyboard",
      "Founder intro frame list",
      "Before / after proof sequence",
      "Consult CTA tied to a premium media refresh",
    ],
    teaserJson: {
      format: "15-second teaser + landing stills",
      angle: "cinematic founder authority",
      deliverables: ["hero shot list", "before / after motion concept", "landing still system"],
      objective: "Raise perceived value without changing the booking funnel",
    },
  },
  cmp_house_meridian: {
    id: "off_cmp_house_meridian",
    companyId: "cmp_house_meridian",
    type: "free_teardown_brief",
    rationale:
      "The site already looks credible. The bigger win is a concise conversion teardown with stronger inquiry logic.",
    teaserHeadline: "A focused teardown for turning portfolio traffic into qualified project inquiries",
    teaserSummary:
      "Keep the calm visual system, tighten trust proof, and improve the luxury-intake path.",
    homepageBrief: [
      "Re-sequence portfolio proof above inquiry prompts",
      "Add fit-based CTA language",
      "Surface residential trust cues earlier",
      "Turn the footer form into a structured intake",
    ],
    teaserJson: {
      format: "8-slide brief",
      priorities: ["CTA hierarchy", "trust placement", "portfolio sequencing", "qualified intake"],
      outcome: "Higher-quality discovery calls",
    },
  },
  cmp_north_cove: {
    id: "off_cmp_north_cove",
    companyId: "cmp_north_cove",
    type: "free_prototype_site",
    rationale:
      "The business is premium enough and the site is weak enough that a prototype can show immediate upside.",
    teaserHeadline: "A landscape studio prototype that sells six-figure estates, not generic services",
    teaserSummary:
      "Lead with completed estates, process clarity, and a better project-fit inquiry path for mobile users.",
    homepageBrief: [
      "Full-bleed estate imagery with regional proof",
      "Process section built for large residential projects",
      "Budget-aware inquiry flow",
      "Trust strip with awards, neighborhoods, and designer profile",
    ],
    teaserJson: {
      mood: "coastal modern / estate scale / bright stone",
      hero: "Finished estate + principal designer promise",
      sections: ["Estates", "Process", "Neighborhood proof", "Project-fit inquiry"],
      primaryCTA: "Start a project conversation",
    },
  },
  cmp_sable_house: {
    id: "off_cmp_sable_house",
    companyId: "cmp_sable_house",
    type: "free_teardown_brief",
    rationale:
      "Medium-confidence lead. A teardown is easier to say yes to than a site concept on first touch.",
    teaserHeadline: "A teardown focused on premium positioning and higher-intent inquiries",
    teaserSummary:
      "Push the concierge angle forward, sharpen urgency, and make inquiry feel more private and high-touch.",
    homepageBrief: [
      "Move concierge promise into the first screen",
      "Tighten CTA language around private recovery planning",
      "Add urgency and response-time reassurance",
      "Improve local intent signals for search",
    ],
    teaserJson: {
      format: "5-part recommendation brief",
      priorities: ["positioning", "CTA language", "trust", "local SEO"],
      outcome: "A safer first-touch offer with clear operator value",
    },
  },
  cmp_lumiere_skin: {
    id: "off_cmp_lumiere_skin",
    companyId: "cmp_lumiere_skin",
    type: "free_video_photo_concept",
    rationale:
      "The best opportunity is in perception lift, not structural rescue, so a media concept is the right wedge.",
    teaserHeadline: "A media concept for making the brand feel as elevated as the results",
    teaserSummary:
      "Add a cinematic visual layer that improves perceived value while leaving the conversion funnel intact.",
    homepageBrief: [
      "Hero storyboard for a founder-led intro",
      "Editorial treatment photography direction",
      "Short-form motion proof for social and site",
      "Updated hero CTA context for premium consults",
    ],
    teaserJson: {
      format: "hero concept + shot list",
      angle: "editorial confidence",
      deliverables: ["hero motion", "portrait direction", "social teaser cut"],
      objective: "Lift premium impression before the consultation",
    },
  },
};

const campaignsByCompany: Record<string, Campaign> = {
  cmp_atelier_ora: {
    id: "cam_cmp_atelier_ora",
    companyId: "cmp_atelier_ora",
    status: "draft_ready",
    offerType: "free_prototype_site",
    assignedTo: "Toby",
    sendDomain: "northatelier.co",
    lastTouchAt: "2026-04-10T18:10:00.000Z",
    nextTouchAt: "2026-04-11T18:00:00.000Z",
    pipelineValue: 18000,
  },
  cmp_crescent_glen: {
    id: "cam_cmp_crescent_glen",
    companyId: "cmp_crescent_glen",
    status: "qualified",
    offerType: "free_video_photo_concept",
    assignedTo: "Toby",
    sendDomain: "northatelier.co",
    lastTouchAt: "2026-04-09T20:18:00.000Z",
    nextTouchAt: "2026-04-10T23:00:00.000Z",
    pipelineValue: 24000,
  },
  cmp_house_meridian: {
    id: "cam_cmp_house_meridian",
    companyId: "cmp_house_meridian",
    status: "sent",
    offerType: "free_teardown_brief",
    assignedTo: "Toby",
    sendDomain: "studioharbor.co",
    lastTouchAt: "2026-04-09T16:44:00.000Z",
    nextTouchAt: "2026-04-13T16:44:00.000Z",
    pipelineValue: 22000,
  },
  cmp_north_cove: {
    id: "cam_cmp_north_cove",
    companyId: "cmp_north_cove",
    status: "interested",
    offerType: "free_prototype_site",
    assignedTo: "Toby",
    sendDomain: "northatelier.co",
    lastTouchAt: "2026-04-10T15:05:00.000Z",
    nextTouchAt: "2026-04-12T17:30:00.000Z",
    pipelineValue: 32000,
  },
  cmp_sable_house: {
    id: "cam_cmp_sable_house",
    companyId: "cmp_sable_house",
    status: "new",
    offerType: "free_teardown_brief",
    assignedTo: "Creative operator",
    sendDomain: "studioharbor.co",
    lastTouchAt: "2026-04-10T12:14:00.000Z",
    nextTouchAt: "2026-04-10T22:00:00.000Z",
    pipelineValue: 14000,
  },
  cmp_lumiere_skin: {
    id: "cam_cmp_lumiere_skin",
    companyId: "cmp_lumiere_skin",
    status: "booked",
    offerType: "free_video_photo_concept",
    assignedTo: "Toby",
    sendDomain: "northatelier.co",
    lastTouchAt: "2026-04-10T14:18:00.000Z",
    nextTouchAt: "2026-04-14T20:00:00.000Z",
    pipelineValue: 38000,
  },
};

const emailsByCompany: Record<string, EmailDraft> = {
  cmp_atelier_ora: {
    id: "em_cmp_atelier_ora",
    companyId: "cmp_atelier_ora",
    contactId: "con_1",
    status: "approved",
    subjectVariants: [
      "A quick idea for Atelier Ora's first impression",
      "Free homepage concept for Atelier Ora",
      "One fast site concept for your Beverly Hills funnel",
    ],
    plainText:
      "Mila,\n\nI looked through Atelier Ora after a Beverly Hills med spa sweep and thought the in-person brand feels more premium than the current homepage does.\n\nI mocked up a fast concept direction that leads with founder trust, a stronger concierge CTA, and a cleaner luxury frame instead of the treatment list.\n\nIf it is useful, I can send the one-page preview over as a free prototype.\n\nBest,\nToby",
    html:
      "<p>Mila,</p><p>I looked through Atelier Ora after a Beverly Hills med spa sweep and thought the in-person brand feels more premium than the current homepage does.</p><p>I mocked up a fast concept direction that leads with founder trust, a stronger concierge CTA, and a cleaner luxury frame instead of the treatment list.</p><p>If it is useful, I can send the one-page preview over as a free prototype.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "If timing is off, just reply opt out and I will close the loop.",
    ],
    complianceChecks: [
      { label: "Physical address included", passed: true },
      { label: "Clear opt-out line included", passed: true },
      { label: "Subject is non-deceptive", passed: true },
      { label: "First-touch still requires human send approval", passed: true },
    ],
  },
  cmp_crescent_glen: {
    id: "em_cmp_crescent_glen",
    companyId: "cmp_crescent_glen",
    contactId: "con_2",
    status: "draft",
    subjectVariants: [
      "A visual concept for Crescent Glen",
      "Free photo / video direction for the practice site",
      "One quick media idea for your consult funnel",
    ],
    plainText:
      "Dr. Cole,\n\nYour consult funnel is already clear. The gap I noticed is that the visuals do not quite match the premium feel of the work.\n\nI put together a short photo and video concept that would make the founder story and case-study proof feel more expensive without changing the whole site.\n\nHappy to share it if useful.\n\nBest,\nToby",
    html:
      "<p>Dr. Cole,</p><p>Your consult funnel is already clear. The gap I noticed is that the visuals do not quite match the premium feel of the work.</p><p>I put together a short photo and video concept that would make the founder story and case-study proof feel more expensive without changing the whole site.</p><p>Happy to share it if useful.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "Reply opt out if you do not want follow-up.",
    ],
    complianceChecks: [
      { label: "Physical address included", passed: true },
      { label: "Clear opt-out line included", passed: true },
      { label: "Subject is non-deceptive", passed: true },
      { label: "First-touch still requires human send approval", passed: true },
    ],
  },
  cmp_house_meridian: {
    id: "em_cmp_house_meridian",
    companyId: "cmp_house_meridian",
    contactId: "con_3",
    status: "sent",
    subjectVariants: [
      "A quick teardown idea for House Meridian",
      "One conversion note on the inquiry flow",
      "Brief teardown for your Brentwood portfolio site",
    ],
    plainText:
      "Mara,\n\nYour portfolio work is strong. I sent a short teardown yesterday focused on surfacing the strongest residential proof earlier and tightening the inquiry path.\n\nIf helpful, I can send the annotated version as well.\n\nBest,\nToby",
    html:
      "<p>Mara,</p><p>Your portfolio work is strong. I sent a short teardown yesterday focused on surfacing the strongest residential proof earlier and tightening the inquiry path.</p><p>If helpful, I can send the annotated version as well.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "Reply opt out and I will not follow up again.",
    ],
    complianceChecks: [
      { label: "Physical address included", passed: true },
      { label: "Clear opt-out line included", passed: true },
      { label: "Subject is non-deceptive", passed: true },
      { label: "Suppression checks passed before send", passed: true },
    ],
  },
  cmp_north_cove: {
    id: "em_cmp_north_cove",
    companyId: "cmp_north_cove",
    contactId: "con_4",
    status: "replied",
    subjectVariants: [
      "Prototype concept for North Cove",
      "A better first screen for the studio",
      "Quick idea for the project inquiry path",
    ],
    plainText:
      "Owen,\n\nI sent a quick prototype direction built around completed estates and a stronger inquiry path. You replied asking to see the first screen before next week.\n\nQueued for delivery with a mobile variant.\n\nBest,\nToby",
    html:
      "<p>Owen,</p><p>I sent a quick prototype direction built around completed estates and a stronger inquiry path. You replied asking to see the first screen before next week.</p><p>Queued for delivery with a mobile variant.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "Conversation already active. Suppression paused automatically.",
    ],
    complianceChecks: [
      { label: "Reply detected", passed: true },
      { label: "Further cold follow-up suppressed", passed: true },
      { label: "Thread sync healthy", passed: true },
      { label: "Complaint risk clear", passed: true },
    ],
  },
  cmp_sable_house: {
    id: "em_cmp_sable_house",
    companyId: "cmp_sable_house",
    contactId: "con_5",
    status: "draft",
    subjectVariants: [
      "A quick positioning teardown for Sable House",
      "One idea for the concierge recovery site",
      "A private first-impression note",
    ],
    plainText:
      "Claire,\n\nI came across Sable House while reviewing premium recovery services in Newport Coast and thought the concierge positioning could be stronger on the site.\n\nI put together a short teardown with three practical changes around positioning, CTA language, and local search basics.\n\nIf useful, I can send it over.\n\nBest,\nToby",
    html:
      "<p>Claire,</p><p>I came across Sable House while reviewing premium recovery services in Newport Coast and thought the concierge positioning could be stronger on the site.</p><p>I put together a short teardown with three practical changes around positioning, CTA language, and local search basics.</p><p>If useful, I can send it over.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "If this is not relevant, reply opt out and I will close the file.",
    ],
    complianceChecks: [
      { label: "Physical address included", passed: true },
      { label: "Clear opt-out line included", passed: true },
      { label: "Subject is non-deceptive", passed: true },
      { label: "First-touch still requires human send approval", passed: true },
    ],
  },
  cmp_lumiere_skin: {
    id: "em_cmp_lumiere_skin",
    companyId: "cmp_lumiere_skin",
    contactId: "con_6",
    status: "replied",
    subjectVariants: [
      "Media concept follow-up",
      "Quick hero direction before Tuesday",
      "Visual concept for Lumiere Skin Haus",
    ],
    plainText:
      "Dr. Mercer,\n\nFollowing up with the hero storyboard and still references before Tuesday's booked intro call.\n\nThe concept focuses on better editorial framing while leaving your existing consult flow intact.\n\nBest,\nToby",
    html:
      "<p>Dr. Mercer,</p><p>Following up with the hero storyboard and still references before Tuesday's booked intro call.</p><p>The concept focuses on better editorial framing while leaving your existing consult flow intact.</p><p>Best,<br />Toby</p>",
    complianceFooter: [
      "Studio North LLC, 9080 Santa Monica Blvd, West Hollywood, CA 90069",
      "Booked pipeline stage. No automated follow-up until after the call.",
    ],
    complianceChecks: [
      { label: "Reply detected", passed: true },
      { label: "Booked-call stage synced", passed: true },
      { label: "Auto follow-up paused", passed: true },
      { label: "Complaint risk clear", passed: true },
    ],
  },
};

const domains: DomainHealth[] = [
  {
    domain: "northatelier.co",
    status: "healthy",
    spf: true,
    dkim: true,
    dmarc: true,
    inboxPlacement: 96,
    complaintRate: 0.03,
    dailyVolume: 24,
    maxDailyVolume: 80,
    lastWarmupAt: "2026-04-09T13:00:00.000Z",
    notes: ["Primary sending domain", "Green-lit for first-touch drafts", "Inbox placement is stable"],
  },
  {
    domain: "studioharbor.co",
    status: "warming",
    spf: true,
    dkim: true,
    dmarc: true,
    inboxPlacement: 91,
    complaintRate: 0.01,
    dailyVolume: 11,
    maxDailyVolume: 30,
    lastWarmupAt: "2026-04-10T09:00:00.000Z",
    notes: ["Secondary domain", "Keep below 30 daily sends", "Use for follow-ups and lower-risk touches"],
  },
  {
    domain: "northpreview.co",
    status: "attention",
    spf: true,
    dkim: true,
    dmarc: false,
    inboxPlacement: 0,
    complaintRate: 0,
    dailyVolume: 0,
    maxDailyVolume: 20,
    lastWarmupAt: "2026-04-08T10:00:00.000Z",
    notes: ["DMARC missing", "Hold all first-touch traffic", "Fix DNS before using prototype send-outs"],
  },
];

const workers: WorkerStatus[] = [
  {
    key: "discovery",
    label: "Discovery worker",
    state: "busy",
    queueDepth: 24,
    throughputPerHour: 62,
    lastRunAt: "2026-04-10T18:20:00.000Z",
    nextAction: "Finish Brentwood and Beverly Hills keyword sweep, then enqueue new domains for audit.",
  },
  {
    key: "audit",
    label: "Site audit worker",
    state: "healthy",
    queueDepth: 7,
    throughputPerHour: 18,
    lastRunAt: "2026-04-10T18:14:00.000Z",
    nextAction: "Capture desktop and mobile screenshots, then score CTA and trust gaps.",
  },
  {
    key: "outreach",
    label: "Outreach drafter",
    state: "busy",
    queueDepth: 3,
    throughputPerHour: 11,
    lastRunAt: "2026-04-10T18:10:00.000Z",
    nextAction: "Generate subject variants and compliance-ready plain text for newly qualified leads.",
  },
  {
    key: "prototype",
    label: "Prototype generator",
    state: "attention",
    queueDepth: 2,
    throughputPerHour: 4,
    lastRunAt: "2026-04-10T16:50:00.000Z",
    nextAction: "Preview render is waiting on Playwright screenshot storage wiring.",
  },
  {
    key: "gmail",
    label: "Gmail layer",
    state: "healthy",
    queueDepth: 0,
    throughputPerHour: 39,
    lastRunAt: "2026-04-10T18:18:00.000Z",
    nextAction: "Keep drafts labeled and pause all outbound automation until first-touch approvals land.",
  },
];

const summary: QueueSummary = {
  discoveredThisWeek: 42,
  qualifiedThisWeek: 17,
  draftsReady: 5,
  sentToday: 12,
  positiveReplyRate: 11.4,
  complaintRate: 0.03,
  pipelineValue: 148000,
};

const activity: ActivityItem[] = [
  {
    id: "act_1",
    at: "2026-04-10T18:18:00.000Z",
    tone: "positive",
    title: "North Cove replied",
    detail: "Reply sync moved the campaign to Interested and suppressed follow-ups.",
  },
  {
    id: "act_2",
    at: "2026-04-10T18:12:00.000Z",
    tone: "warning",
    title: "northpreview.co blocked",
    detail: "DMARC is missing, so the domain is excluded from first-touch routing.",
  },
  {
    id: "act_3",
    at: "2026-04-10T17:54:00.000Z",
    tone: "neutral",
    title: "Atelier Ora draft approved",
    detail: "Human review passed. Draft is ready for Gmail creation on the primary domain.",
  },
  {
    id: "act_4",
    at: "2026-04-10T17:26:00.000Z",
    tone: "neutral",
    title: "Discovery sweep completed",
    detail: "Five premium-fit candidates found across Beverly Hills and Newport Coast.",
  },
];

const leads: LeadRecord[] = companies
  .map((company) => {
    const contact = contacts.find((candidate) => candidate.companyId === company.id);
    const audit = audits.find((candidate) => candidate.companyId === company.id);
    const offer = offersByCompany[company.id];
    const campaign = campaignsByCompany[company.id];
    const latestEmail = emailsByCompany[company.id];

    if (!contact || !audit || !offer || !campaign || !latestEmail) {
      throw new Error(`Incomplete lead data for ${company.id}`);
    }

    return {
      company,
      contact,
      audit,
      offer,
      campaign,
      latestEmail,
      qualifies: qualifiesForOutreach({
        premiumFit: audit.scores.premiumFit,
        presentationGap: audit.scores.presentationGap,
        contactability: audit.scores.contactability,
      }),
    };
  })
  .sort(
    (left, right) =>
      right.audit.scores.outreachScore - left.audit.scores.outreachScore,
  );

export const dashboardData: DashboardData = {
  discoveryPreset,
  leads,
  domains,
  workers,
  summary,
  activity,
  integrations: {
    dataSource: "mock",
    supabaseConfigured: false,
    gmailConfigured: false,
    gmailMode: "connector_scope_missing",
    notes: [
      "Dashboard is currently using seeded demo data.",
      "Supabase is not configured in runtime env yet.",
      "Gmail connector exists for the agent but is missing the scopes required for labels and draft management.",
    ],
  },
};
