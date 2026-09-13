// Fixtures for the salesDiscovery group — see index.js for the contract.
//
// Routes: /platform/sales/review, retry-pool, snapshots, prospects,
// capabilities, rules, playbooks (+ preview), confidence, signatures, and
// /platform/suppressions.
//
// Wherever a route builds its response through a PURE helper in lib/ — the
// capability matrix, the seed rules, the seed playbooks, the snapshot
// catalogue, prospectView() — the fixture calls the same helper over
// hand-written raw rows, so the shape on the screen is the route's own and a
// renamed field breaks the harness the way it would break production. The
// row DATA is invented; the shapes are not. Nothing here imports lib/db.
import { CAMPAIGN_ID } from "./ids.js";
import { RETRY_BLOCKS, retryRuleTable } from "@/lib/sales/retryRules";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import { librarySummary } from "@/lib/sales/discovery/snapshotSetting";
import { DISCOVERY_TRADES, discoveryTradeKeys, discoveryTradeLabel } from "@/lib/sales/discovery/trades";
import {
  CLAIM_HOURS,
  PROSPECT_STATUS_LABELS,
  claimState,
  contactability,
  prospectView,
  sourceCategoryView,
} from "@/lib/sales/prospectView";
import {
  EXCLUDED_CAPABILITIES,
  OBSERVABLE_CAPABILITY_CODES,
  capabilityMatrix,
  repScript,
} from "@/lib/sales/intel/capabilities";
import { CONDITION_KINDS, REFUSALS, indexProspect, validateRule } from "@/lib/sales/intel/opportunity";
import { seedOpportunityRules } from "@/lib/sales/intel/rules";
import { CATEGORIES, FUZZY_CEILING, MATCH_THRESHOLD, SIGNALS, weightsFrom } from "@/lib/sales/intel/confidence";
import { DETECTOR_VERSION, PATTERN_KINDS } from "@/lib/sales/intel/technology";
import { seedSignatures, sourcingNotes } from "@/lib/sales/intel/signatureSeed";
import { PLAYBOOK_PROBLEMS, PLAYBOOK_VARS, seedPlaybooks, validatePlaybook } from "@/lib/sales/playbook/defaults";
import { OBJECTION_PROBLEMS, objectionsForProspect, seedObjections, validateObjection } from "@/lib/sales/playbook/objections";
import { EXPERIMENT_PROBLEMS, WINNER_POLICY, deriveVariant, summariseExperiment, validateExperiment } from "@/lib/sales/playbook/experiments";
import { SELECTION_REFUSALS, selectPlaybook } from "@/lib/sales/playbook/select";
import { selectorCatalogue } from "@/lib/sales/playbook/selectors";
import { STAGES, STAGE_KEYS } from "@/lib/sales/playbook/stages";
import { deterministicTalkingPoints, talkingPointContext } from "@/lib/sales/playbook/talkingPoints";
import { buildCallScript } from "@/lib/sales/playbook/script";

// ── Time ───────────────────────────────────────────────────────────────────
// Pinned to September 2026 except where a page compares against Date.now()
// (claim expiry), which is computed from now so the badge renders as meant.
const NOW = Date.now();
const H = 3600 * 1000;
const inHours = (h) => new Date(NOW + h * H).toISOString();

const sayWith = (vocab) => (codes) => (codes || []).map((p) => ({ code: p, text: vocab?.[p] || p }));

// ═══════════════════════════════════════════════════════════════════════════
// The prospect bank — raw rows in Prisma's shape, with their relations.
// Shared by /prospects (list + detail), the playbook preview's search and
// assembly, and the retry pool's exhausted list.
// ═══════════════════════════════════════════════════════════════════════════
const TERRITORIES = [
  { id: "ter_qc_mtl", name: "Montréal and the South Shore (Longueuil, Brossard, Saint-Jean-sur-Richelieu)" },
  { id: "ter_qc_laval", name: "Laval and the Laurentians" },
  { id: "ter_ca_socal", name: "Southern California — Los Angeles, Orange, Riverside, San Bernardino" },
  { id: "ter_or_pdx", name: "Portland metro" },
];
const CAMPAIGNS = [
  { id: CAMPAIGN_ID, name: "Quebec — rbq part 1 (roofing, siding, gutters, insulation — 42,821 licences)" },
  { id: "camp_qc_overture", name: "Quebec — overture" },
  { id: "camp_ca_cslb_1", name: "California — us_ca_cslb part 1" },
  { id: "camp_or_ccb", name: "Oregon — us_or_ccb" },
];
const REPS = {
  rep_marie: { id: "rep_marie", name: "Marie-Ève Desrosiers-Lachapelle", email: "marie-eve.desrosiers-lachapelle@fieldquo.com" },
  rep_jordan: { id: "rep_jordan", name: "Jordan Whitfield", email: "jordan.whitfield@fieldquo.com" },
};

const RBQ_GENERAL = ["rbq:1.2", "rbq:2.5", "rbq:2.7", "rbq:3.2", "rbq:4.2", "rbq:5.2", "rbq:6.2", "rbq:7", "rbq:8", "rbq:9", "rbq:11.2", "rbq:12", "rbq:13.5", "rbq:17.2"];

const ev = (id, prospectId, type, source, extra = {}) => ({
  id,
  prospectId,
  type,
  source,
  sourceUrl: null,
  rawValue: null,
  normalizedValue: null,
  observedAt: "2026-09-02T14:12:30.000Z",
  confidence: 1,
  detector: "capabilities",
  detectorVersion: "3",
  createdAt: "2026-09-02T14:12:30.000Z",
  ...extra,
});

const cap = (prospectId, code, value, evidenceIds, confidence = 0.9) => ({
  id: `cap_${prospectId}_${code}`,
  prospectId,
  code,
  value,
  confidence,
  evidenceIds,
  detectedAt: "2026-09-02T14:12:31.000Z",
  detectorVersion: "3",
});

function prospect(id, over = {}) {
  return {
    id,
    googlePlaceId: null,
    phoneE164: null,
    domain: null,
    businessName: "",
    rawName: null,
    addressLine: null,
    city: null,
    province: "QC",
    postalCode: null,
    country: "CA",
    latitude: null,
    longitude: null,
    sourceCategories: [],
    tradeKey: null,
    googleRating: null,
    googleReviewCount: null,
    businessStatus: null,
    sourceProvider: "rbq",
    sourceRecordId: null,
    tradingNames: [],
    licenceNumber: null,
    sourceRelease: "2026-08-31",
    sourceDataset: "Régie du bâtiment du Québec — Registre des détenteurs de licence (CC-BY 4.0)",
    sourceConfidence: null,
    sourceUpdatedAt: "2026-08-31T04:00:00.000Z",
    classification: "contractor",
    classificationReason: "Holds a contractor licence (Quebec RBQ).",
    hasWebsite: null,
    websiteUrl: null,
    email: null,
    emailSource: null,
    status: "discovered",
    territoryId: "ter_qc_mtl",
    campaignId: CAMPAIGN_ID,
    assignedRepId: null,
    assignedAt: null,
    claimExpiresAt: null,
    doNotContactAt: null,
    doNotContactReason: null,
    possibleDuplicateOfId: null,
    reviewDeferredAt: null,
    attemptCount: 0,
    nextAttemptAt: null,
    lastOutcome: null,
    retryBlock: null,
    exhaustedAt: null,
    recycledAt: null,
    recycledById: null,
    lastCrawledAt: null,
    lastGoogleRefreshAt: null,
    lastOpportunityAnalysisAt: null,
    contentHash: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-02T14:12:31.000Z",
    capabilities: [],
    technologies: [],
    inferences: [],
    opportunities: [],
    evidence: [],
    scores: [],
    corrections: [],
    ...over,
  };
}

// The prospect the detail screen and the preview open. Fully crawled: a
// website with no booking and no form, an email address, no competitor.
const P1 = "pro_toitures_beauchemin";
const P1_EVIDENCE = [
  ev("ev_p1_1", P1, "schema_org", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: '{"@type":"RoofingContractor","telephone":"+1 450-555-0137"}', normalizedValue: "RoofingContractor" }),
  ev("ev_p1_2", P1, "form", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/contact", rawValue: "mailto:soumission@toiture-beauchemin-rive-sud.ca", normalizedValue: "mailto", detector: "email_contact", detectorVersion: "2" }),
  ev("ev_p1_3", P1, "page_content", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: "Lundi au vendredi 7h à 17h — Samedi sur rendez-vous", normalizedValue: "Mo-Fr 07:00-17:00", detector: "published_hours", detectorVersion: "1" }),
  ev("ev_p1_4", P1, "link", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: "tel:+14505550137", normalizedValue: "+14505550137", detector: "phone_contact", detectorVersion: "1" }),
  ev("ev_p1_5", P1, "page_content", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: "Aucune réservation en ligne — pas de widget, pas de calendrier, pas de lien Calendly", normalizedValue: "no_booking", detector: "booking", detectorVersion: "3" }),
  ev("ev_p1_6", P1, "script_src", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: "https://www.googletagmanager.com/gtag/js?id=G-7Q2X9K1", normalizedValue: "googletagmanager.com", detector: "technology", detectorVersion: "1" }),
  ev("ev_p1_7", P1, "page_content", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/temoignages", rawValue: "★★★★★ « Travail impeccable, équipe ponctuelle » — Josée L., Brossard", normalizedValue: "reviews_on_site", detector: "reviews", detectorVersion: "1" }),
  ev("ev_p1_8", P1, "google_field", "google_places", { sourceUrl: null, rawValue: "4.7 (128)", normalizedValue: "4.7", detector: "google", detectorVersion: "1", observedAt: "2026-09-01T12:00:04.000Z" }),
  ev("ev_p1_9", P1, "meta", "crawl", { sourceUrl: "https://www.toiture-beauchemin-rive-sud.ca/", rawValue: '<meta name="generator" content="WordPress 6.6">', normalizedValue: "wordpress", detector: "technology", detectorVersion: "1" }),
];
const P1_ROW = prospect(P1, {
  googlePlaceId: "ChIJ4zGFAZpU2YkR8nmn8vhLpXc",
  phoneE164: "+14505550137",
  domain: "toiture-beauchemin-rive-sud.ca",
  businessName: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.",
  rawName: "LES ENTREPRISES DE TOITURE RIVE-SUD BEAUCHEMIN & FILS INC.",
  addressLine: "4585, boulevard Grande-Allée, bureau 210",
  city: "Saint-Hubert (Longueuil)",
  postalCode: "J4T 2V8",
  latitude: 45.4894,
  longitude: -73.4211,
  sourceCategories: RBQ_GENERAL,
  tradeKey: "roofing",
  googleRating: 4.7,
  googleReviewCount: 128,
  businessStatus: "OPERATIONAL",
  sourceRecordId: "5782-8402-01",
  tradingNames: ["Toitures Beauchemin", "Beauchemin Couvreurs Rive-Sud"],
  licenceNumber: "5782-8402-01",
  hasWebsite: true,
  websiteUrl: "https://www.toiture-beauchemin-rive-sud.ca/",
  email: "soumission@toiture-beauchemin-rive-sud.ca",
  emailSource: "mailto",
  assignedRepId: "rep_marie",
  assignedAt: "2026-09-10T13:05:00.000Z",
  claimExpiresAt: inHours(31),
  lastCrawledAt: "2026-09-02T14:12:30.000Z",
  lastGoogleRefreshAt: "2026-09-01T12:00:04.000Z",
  lastOpportunityAnalysisAt: "2026-09-02T14:12:33.000Z",
  contentHash: "9f2c1a7e0b4d",
  capabilities: [
    cap(P1, "WEBSITE", true, ["ev_p1_1", "ev_p1_9"], 0.98),
    cap(P1, "ONLINE_BOOKING", false, ["ev_p1_5"], 0.86),
    cap(P1, "LEAD_CAPTURE_FORM", false, ["ev_p1_2"], 0.82),
    cap(P1, "EMAIL_CONTACT", true, ["ev_p1_2"], 0.97),
    cap(P1, "PHONE_CONTACT", true, ["ev_p1_4", "ev_p1_1"], 0.97),
    cap(P1, "PUBLISHED_HOURS", true, ["ev_p1_3"], 0.8),
    cap(P1, "ONLINE_PAYMENT", false, ["ev_p1_5"], 0.7),
    cap(P1, "INSTANT_ESTIMATE", false, ["ev_p1_5"], 0.7),
    cap(P1, "ONLINE_REVIEWS", true, ["ev_p1_7"], 0.75),
    cap(P1, "LIVE_CHAT", false, ["ev_p1_6"], 0.7),
    cap(P1, "CLIENT_PORTAL", null, [], 0.5),
  ],
  technologies: [
    { id: "tech_p1_wp", prospectId: P1, technologyCode: "WORDPRESS", isCompetitor: false, confidence: 0.95, evidenceIds: ["ev_p1_9"], detectedAt: "2026-09-02T14:12:31.000Z", signatureVersion: "1" },
    { id: "tech_p1_ga", prospectId: P1, technologyCode: "GOOGLE_ANALYTICS", isCompetitor: false, confidence: 0.9, evidenceIds: ["ev_p1_6"], detectedAt: "2026-09-02T14:12:31.000Z", signatureVersion: "1" },
  ],
  inferences: [
    { id: "inf_p1_size", prospectId: P1, kind: "crew_size", value: "medium", confidence: 0.55, evidenceIds: ["ev_p1_3", "ev_p1_7"], source: "derived", observedAt: "2026-09-02T14:12:32.000Z", modelVersion: null },
    { id: "inf_p1_lang", prospectId: P1, kind: "primary_language", value: "fr", confidence: 0.9, evidenceIds: ["ev_p1_3"], source: "derived", observedAt: "2026-09-02T14:12:32.000Z", modelVersion: null },
  ],
  opportunities: [
    { id: "opp_p1_booking", prospectId: P1, capabilityCode: "ONLINE_BOOKING", capability: { code: "ONLINE_BOOKING", name: "Online booking" }, rank: 1, confidence: 0.86, reason: "They have a site and no way to book on it, so a homeowner reading it at ten at night has to remember to ring in the morning. Most do not.", evidenceIds: ["ev_p1_1", "ev_p1_5"], ruleCode: "WEBSITE_NO_BOOKING", ruleVersion: "1", generatedAt: "2026-09-02T14:12:33.000Z" },
    { id: "opp_p1_form", prospectId: P1, capabilityCode: "LEAD_CAPTURE_FORM", capability: { code: "LEAD_CAPTURE_FORM", name: "Lead capture form" }, rank: 2, confidence: 0.82, reason: "Quotes are requested by writing to soumission@ — an address, not a form — so every enquiry arrives without the address, the photos or the budget, and somebody has to write back to ask.", evidenceIds: ["ev_p1_2"], ruleCode: "EMAIL_ONLY_CONTACT", ruleVersion: "1", generatedAt: "2026-09-02T14:12:33.000Z" },
    { id: "opp_p1_pay", prospectId: P1, capabilityCode: "ONLINE_PAYMENT", capability: { code: "ONLINE_PAYMENT", name: "Online payment" }, rank: 3, confidence: 0.7, reason: "Nothing on the site takes a payment, so a deposit means a cheque or an e-transfer chased by phone.", evidenceIds: ["ev_p1_5"], ruleCode: "NO_ONLINE_PAYMENT", ruleVersion: "1", generatedAt: "2026-09-02T14:12:33.000Z" },
  ],
  evidence: P1_EVIDENCE,
  scores: [{ id: "sc_p1_1", prospectId: P1, score: 78, reasons: ["website_no_booking", "email_only", "rating_4_7"], scoringVersion: "1", computedAt: "2026-09-02T14:12:34.000Z" }],
  corrections: [
    { id: "cor_p1_1", prospectId: P1, target: "tradeKey", originalValue: null, correctedValue: "roofing", reason: "Review folder — name carries 'toiture'; licence is the general bundle.", correctedByAdminId: "adm1", correctedByRepId: null, correctedAt: "2026-09-03T09:41:00.000Z" },
    { id: "cor_p1_2", prospectId: P1, target: "phoneE164", originalValue: "+14505550100", correctedValue: "+14505550137", reason: "Switchboard number on the licence; the site lists the estimator's direct line.", correctedByAdminId: null, correctedByRepId: "rep_marie", correctedAt: "2026-09-10T13:20:00.000Z" },
  ],
});

const P2 = "pro_electro_plomberie_jp";
const P3 = "pro_9410_5111";
const P4 = "pro_paysagistes_cinquino";
const P5 = "pro_plomberie_charbonneau";
const P6 = "pro_peinture_depot";
const P7 = "pro_construction_2much";
const P8 = "pro_gestion_arpin";
const P9 = "pro_pacific_coast_painting";
const P10 = "pro_golden_state_cabinetry";
const P11 = "pro_rose_city_landscape";
const P12 = "pro_mcallister_flooring";
const P13 = "pro_entreprises_arpin";

const PROSPECTS = [
  P1_ROW,
  prospect(P2, {
    phoneE164: "+18195550142",
    domain: "electroplomberiejp.ca",
    businessName: "Électro-Plomberie J.-P. & Associés inc. (chauffage, climatisation, géothermie)",
    city: "Gatineau (secteur Aylmer)",
    sourceCategories: ["rbq:15.5", "rbq:16", "rbq:15.2", "rbq:15.4", "rbq:15.9"],
    tradeKey: "plumbing",
    sourceRecordId: "5782-8485-01",
    licenceNumber: "5782-8485-01",
    tradingNames: ["Électro-Plomberie JP"],
    hasWebsite: true,
    websiteUrl: "https://electroplomberiejp.ca",
    territoryId: "ter_qc_laval",
    lastCrawledAt: "2026-09-04T08:30:00.000Z",
    googleRating: 4.2,
    googleReviewCount: 41,
    capabilities: [cap(P2, "WEBSITE", true, ["ev_p2_1"]), cap(P2, "ONLINE_BOOKING", true, ["ev_p2_2"])],
    technologies: [{ id: "tech_p2_hcp", prospectId: P2, technologyCode: "HOUSECALL_PRO", isCompetitor: true, confidence: 0.92, evidenceIds: ["ev_p2_2"], detectedAt: "2026-09-04T08:30:01.000Z", signatureVersion: "1" }],
    evidence: [ev("ev_p2_1", P2, "meta", "crawl", { sourceUrl: "https://electroplomberiejp.ca", normalizedValue: "wix" }), ev("ev_p2_2", P2, "iframe_host", "crawl", { sourceUrl: "https://electroplomberiejp.ca/reservation", rawValue: "https://book.housecallpro.com/book/Electro-Plomberie-JP/1a2b3c", normalizedValue: "book.housecallpro.com", detector: "technology", detectorVersion: "1" })],
    scores: [{ id: "sc_p2_1", prospectId: P2, score: 34, reasons: ["competitor_installed"], scoringVersion: "1", computedAt: "2026-09-04T08:30:02.000Z" }],
    createdAt: "2026-09-01T12:00:01.000Z",
  }),
  prospect(P3, {
    phoneE164: "+15145550118",
    businessName: "9410-5111 Québec inc.",
    city: "Montréal",
    sourceCategories: ["rbq:16"],
    tradeKey: "electrical",
    sourceRecordId: "5782-8584-01",
    licenceNumber: "5782-8584-01",
    tradingNames: ["Les Installations Électriques Mercier", "Mercier Électrique Résidentiel et Commercial"],
    hasWebsite: false,
    lastCrawledAt: "2026-09-04T08:31:00.000Z",
    capabilities: [cap(P3, "WEBSITE", false, ["ev_p3_1"], 0.9)],
    evidence: [ev("ev_p3_1", P3, "page_content", "site_search", { rawValue: "No site found for the licence name, the trading names or the phone number.", normalizedValue: "none", detector: "site_identity", detectorVersion: "2" })],
    opportunities: [{ id: "opp_p3_site", prospectId: P3, capabilityCode: "WEBSITE", capability: { code: "WEBSITE", name: "Website" }, rank: 1, confidence: 0.9, reason: "There is no website for this business, so a homeowner who hears the name has nowhere to look them up.", evidenceIds: ["ev_p3_1"], ruleCode: "NO_WEBSITE", ruleVersion: "1", generatedAt: "2026-09-04T08:31:02.000Z" }],
    assignedRepId: "rep_jordan",
    assignedAt: "2026-09-08T15:00:00.000Z",
    claimExpiresAt: "2026-09-10T15:00:00.000Z",
    createdAt: "2026-09-01T12:00:02.000Z",
  }),
  prospect(P4, {
    sourceProvider: "overture",
    sourceRecordId: "08f2a4c1b7e9d3a5f6c8b2d4e1a9c7f3",
    sourceRelease: "2026-08-20.0",
    sourceDataset: "Overture Maps Foundation — places (Microsoft, Meta)",
    sourceConfidence: 0.7321,
    classificationReason: "Listed under a landscaping category with no shop word in the name.",
    campaignId: "camp_qc_overture",
    phoneE164: "+15145550190",
    domain: "cinquino.example",
    businessName: "Les Paysagistes Cinquino Compagnie Ltée — Aménagement paysager, pavé-uni, murets et excavation",
    city: "Saint-Léonard",
    sourceCategories: ["landscaper", "landscape_architect", "snow_removal_service"],
    tradeKey: "landscaping",
    hasWebsite: true,
    websiteUrl: "https://cinquino.example",
    googleRating: 3.9,
    googleReviewCount: 12,
    createdAt: "2026-09-01T12:00:03.000Z",
  }),
  prospect(P5, {
    phoneE164: "+15145550171",
    domain: "plomberiecharbonneau.example",
    businessName: "Plomberie & Chauffage Charbonneau inc.",
    city: "Montréal (Rosemont–La Petite-Patrie)",
    sourceCategories: ["rbq:15.5", "rbq:15.1", "rbq:15.10"],
    tradeKey: "hvac",
    sourceRecordId: "5782-8576-01",
    licenceNumber: "5782-8576-01",
    hasWebsite: true,
    websiteUrl: "https://plomberiecharbonneau.example",
    doNotContactAt: "2026-09-06T16:45:00.000Z",
    doNotContactReason: "Owner said on the phone: 'Enlevez-moi de votre liste, je ne veux plus d'appels.'",
    lastOutcome: "do_not_call",
    createdAt: "2026-09-01T12:00:04.000Z",
  }),
  prospect(P6, {
    phoneE164: "+14505550164",
    businessName: "Peinture Dépôt Rive-Sud (Boucherville) — Peintures Sico, Benjamin Moore, Dulux",
    city: "Boucherville",
    sourceCategories: ["rbq:9", "rbq:11.2"],
    sourceRecordId: "5782-8611-01",
    licenceNumber: "5782-8611-01",
    status: "needs_review",
    classification: "needs_review",
    classificationReason: "The name carries a shop word ('dépôt'); a licence-holder with a showroom is possible.",
    createdAt: "2026-09-01T12:00:05.000Z",
  }),
  prospect(P7, {
    phoneE164: "+15145550101",
    businessName: "Construction 2Much inc.",
    city: "Montréal",
    sourceCategories: RBQ_GENERAL,
    sourceRecordId: "5782-8485-02",
    licenceNumber: "5782-8485-02",
    exhaustedAt: "2026-09-09T21:15:00.000Z",
    attemptCount: 3,
    lastOutcome: "no_answer",
    retryBlock: "evening",
    createdAt: "2026-09-01T12:00:06.000Z",
  }),
  prospect(P8, {
    sourceProvider: "overture",
    sourceRecordId: "08f2a4c1b7e9d3a5f6c8b2d4e1a9c7f4",
    sourceRelease: "2026-08-20.0",
    sourceDataset: "Overture Maps Foundation — places (Microsoft, Meta)",
    sourceConfidence: 0.51,
    campaignId: "camp_qc_overture",
    phoneE164: null,
    businessName: "Gestion Immobilière Arpin inc.",
    city: "Saint-Thomas",
    sourceCategories: ["contractor", "home_improvement_store", "property_management_company"],
    status: "needs_review",
    classification: "needs_review",
    classificationReason: "The source lists this as a shop as well as a trade — it may be a contractor with a showroom.",
    possibleDuplicateOfId: P13,
    createdAt: "2026-09-01T12:00:07.000Z",
  }),
  prospect(P9, {
    sourceProvider: "us_ca_cslb",
    sourceRecordId: "1087456",
    sourceRelease: "2026-09-01",
    sourceDataset: "California Contractors State License Board — public licence file",
    classificationReason: "Holds a contractor licence (California CSLB).",
    campaignId: "camp_ca_cslb_1",
    territoryId: "ter_ca_socal",
    province: "CA",
    country: "US",
    phoneE164: "+13105550144",
    domain: "pacificcoastpaintingandwaterproofing.com",
    businessName: "Pacific Coast Painting & Waterproofing Contractors of Southern California, LLC",
    city: "Torrance",
    postalCode: "90503",
    sourceCategories: ["cslb:C-33", "cslb:C-39", "cslb:B"],
    tradeKey: "painting",
    licenceNumber: "1087456",
    hasWebsite: true,
    websiteUrl: "https://pacificcoastpaintingandwaterproofing.com",
    googleRating: 4.9,
    googleReviewCount: 312,
    lastCrawledAt: "2026-09-05T02:10:00.000Z",
    capabilities: [cap(P9, "WEBSITE", true, ["ev_p9_1"]), cap(P9, "ONLINE_BOOKING", false, ["ev_p9_1"], 0.8), cap(P9, "LEAD_CAPTURE_FORM", true, ["ev_p9_2"])],
    technologies: [{ id: "tech_p9_jb", prospectId: P9, technologyCode: "JOBBER", isCompetitor: true, confidence: 0.88, evidenceIds: ["ev_p9_2"], detectedAt: "2026-09-05T02:10:01.000Z", signatureVersion: "1" }],
    evidence: [ev("ev_p9_1", P9, "meta", "crawl", { sourceUrl: "https://pacificcoastpaintingandwaterproofing.com", normalizedValue: "squarespace" }), ev("ev_p9_2", P9, "iframe_host", "crawl", { sourceUrl: "https://pacificcoastpaintingandwaterproofing.com/request-a-quote", rawValue: "https://clienthub.getjobber.com/client_hubs/8f1c/public/work_request/embedded", normalizedValue: "clienthub.getjobber.com", detector: "technology", detectorVersion: "1" })],
    scores: [{ id: "sc_p9_1", prospectId: P9, score: 41, reasons: ["competitor_installed"], scoringVersion: "1", computedAt: "2026-09-05T02:10:02.000Z" }],
    assignedRepId: "rep_jordan",
    assignedAt: "2026-09-12T18:00:00.000Z",
    claimExpiresAt: inHours(40),
    createdAt: "2026-09-01T12:00:08.000Z",
  }),
  prospect(P10, {
    sourceProvider: "us_ca_cslb",
    sourceRecordId: "0993211",
    sourceRelease: "2026-09-01",
    sourceDataset: "California Contractors State License Board — public licence file",
    classificationReason: "Holds a contractor licence (California CSLB).",
    campaignId: "camp_ca_cslb_1",
    territoryId: "ter_ca_socal",
    province: "CA",
    country: "US",
    phoneE164: "+19495550188",
    businessName: "Golden State Custom Cabinetry, Millwork & Countertops Inc.",
    city: "Irvine",
    sourceCategories: ["cslb:C-6", "cslb:C-54"],
    tradeKey: "cabinets",
    licenceNumber: "0993211",
    hasWebsite: false,
    lastCrawledAt: "2026-09-05T02:11:00.000Z",
    capabilities: [cap(P10, "WEBSITE", false, ["ev_p10_1"], 0.9)],
    evidence: [ev("ev_p10_1", P10, "page_content", "site_search", { rawValue: "No site found.", normalizedValue: "none", detector: "site_identity", detectorVersion: "2" })],
    opportunities: [{ id: "opp_p10_site", prospectId: P10, capabilityCode: "WEBSITE", capability: { code: "WEBSITE", name: "Website" }, rank: 1, confidence: 0.9, reason: "There is no website for this business, so a homeowner who hears the name has nowhere to look them up.", evidenceIds: ["ev_p10_1"], ruleCode: "NO_WEBSITE", ruleVersion: "1", generatedAt: "2026-09-05T02:11:02.000Z" }],
    exhaustedAt: "2026-09-11T17:40:00.000Z",
    recycledAt: "2026-09-08T14:00:00.000Z",
    recycledById: "adm1",
    attemptCount: 3,
    lastOutcome: "voicemail",
    retryBlock: "afternoon",
    createdAt: "2026-09-01T12:00:09.000Z",
  }),
  prospect(P11, {
    sourceProvider: "us_or_ccb",
    sourceRecordId: "241877",
    sourceRelease: "2026-08-28",
    sourceDataset: "Oregon Construction Contractors Board — licensee list",
    classificationReason: "Holds a contractor licence (Oregon CCB).",
    campaignId: "camp_or_ccb",
    territoryId: "ter_or_pdx",
    province: "OR",
    country: "US",
    phoneE164: "+15035550129",
    businessName: "Rose City Landscape, Irrigation & Hardscape LLC",
    city: "Portland",
    sourceCategories: ["ccb:Landscape Contracting", "ccb:Residential General Contractor"],
    tradeKey: "landscaping",
    licenceNumber: "241877",
    exhaustedAt: "2026-09-08T00:05:00.000Z",
    attemptCount: 3,
    lastOutcome: "no_answer",
    retryBlock: "morning",
    createdAt: "2026-09-01T12:00:10.000Z",
  }),
  prospect(P12, {
    sourceProvider: "us_or_ccb",
    sourceRecordId: "198320",
    sourceRelease: "2026-08-28",
    sourceDataset: "Oregon Construction Contractors Board — licensee list",
    classificationReason: "Holds a contractor licence (Oregon CCB).",
    campaignId: "camp_or_ccb",
    territoryId: "ter_or_pdx",
    province: "OR",
    country: "US",
    phoneE164: "+15415550176",
    domain: "mcallisterhardwoodfloors.com",
    businessName: "McAllister & Daughters Hardwood Flooring, Refinishing and Tile",
    city: "Bend",
    sourceCategories: ["ccb:Residential Specialty Contractor"],
    tradeKey: "flooring",
    licenceNumber: "198320",
    hasWebsite: true,
    websiteUrl: "https://mcallisterhardwoodfloors.com",
    googleRating: 5,
    googleReviewCount: 9,
    exhaustedAt: "2026-09-07T22:30:00.000Z",
    attemptCount: 3,
    lastOutcome: "voicemail",
    retryBlock: "midday",
    createdAt: "2026-09-01T12:00:11.000Z",
  }),
  prospect(P13, {
    phoneE164: "+14505550128",
    businessName: "Les Entreprises Arpin inc.",
    city: "Saint-Thomas",
    sourceCategories: RBQ_GENERAL,
    tradeKey: "general_contracting",
    sourceRecordId: "5782-8527-02",
    licenceNumber: "5782-8527-02",
    createdAt: "2026-09-01T12:00:12.000Z",
  }),
];
const byId = new Map(PROSPECTS.map((p) => [p.id, p]));

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/prospects — list, with every filter the route reads
// ═══════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = 50;
const SOURCE_CATEGORY_OPTIONS = [
  ["rbq:9", 31022], ["rbq:1.2", 29811], ["rbq:8", 29655], ["rbq:7", 29102], ["rbq:6.2", 28990], ["rbq:2.5", 27341], ["rbq:4.2", 26120],
  ["rbq:15.5", 6412], ["rbq:16", 5983], ["landscaper", 2201], ["contractor", 1843], ["cslb:B", 41220], ["cslb:C-33", 6031], ["cslb:C-10", 5877],
  ["ccb:Residential General Contractor", 3120], ["home_improvement_store", 402],
].map(([category, count]) => ({ category, count }));

function listProspects(url) {
  const g = (k) => (url.searchParams.get(k) || "").trim();
  const q = g("q").toLowerCase();
  const now = new Date(NOW);
  let rows = PROSPECTS.slice();
  if (q) rows = rows.filter((p) => [p.businessName, p.city, p.domain, p.phoneE164, ...p.tradingNames].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  if (g("territoryId")) rows = rows.filter((p) => p.territoryId === g("territoryId"));
  if (g("campaignId")) rows = rows.filter((p) => p.campaignId === g("campaignId"));
  if (g("tradeKey")) rows = rows.filter((p) => p.tradeKey === g("tradeKey"));
  if (g("status")) rows = rows.filter((p) => p.status === g("status"));
  if (g("website") === "yes") rows = rows.filter((p) => p.hasWebsite === true);
  else if (g("website") === "no") rows = rows.filter((p) => p.hasWebsite === false);
  else if (g("website") === "unknown") rows = rows.filter((p) => p.hasWebsite === null);
  if (g("competitor") === "yes") rows = rows.filter((p) => p.technologies.some((t) => t.isCompetitor));
  else if (g("competitor") === "no") rows = rows.filter((p) => !p.technologies.some((t) => t.isCompetitor));
  if (g("contact") === "callable") rows = rows.filter((p) => contactability(p).callable);
  else if (g("contact") === "blocked") rows = rows.filter((p) => !contactability(p).callable);
  if (g("claim")) rows = rows.filter((p) => claimState(p, { repId: null, now }).state === g("claim"));
  if (g("sourceCategory")) rows = rows.filter((p) => p.sourceCategories.includes(g("sourceCategory")));
  const minScore = Number(g("minScore"));
  if (g("minScore") && Number.isFinite(minScore)) rows = rows.filter((p) => (p.scores[0]?.score ?? -1) >= minScore);
  const page = Math.max(0, Math.floor(Number(g("page")) || 0));
  const statusCounts = {};
  for (const p of PROSPECTS) statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;

  return {
    prospects: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((p) => ({
      id: p.id,
      businessName: p.businessName,
      where: [p.city, p.province].filter(Boolean).join(", ") || null,
      tradeKey: p.tradeKey,
      tradeLabel: p.tradeKey ? DISCOVERY_TRADES[p.tradeKey]?.label || p.tradeKey : null,
      sourceCategoryCount: p.sourceCategories.length,
      status: p.status,
      statusLabel: PROSPECT_STATUS_LABELS[p.status] || p.status,
      classification: p.classification,
      hasWebsite: p.hasWebsite,
      websiteUrl: p.websiteUrl,
      rating: p.googleRating === null ? null : Number(p.googleRating),
      reviewCount: p.googleReviewCount,
      crawled: Boolean(p.lastCrawledAt),
      competitors: p.technologies.filter((t) => t.isCompetitor).map((t) => t.technologyCode),
      score: p.scores[0]?.score ?? null,
      territory: TERRITORIES.find((t) => t.id === p.territoryId) || null,
      campaign: CAMPAIGNS.find((c) => c.id === p.campaignId) || null,
      claim: claimState(p, { repId: null, now }),
      contact: contactability(p),
    })),
    total: rows.length,
    page,
    pageSize: PAGE_SIZE,
    territories: TERRITORIES,
    campaigns: CAMPAIGNS,
    trades: discoveryTradeKeys().map((key) => ({ key, label: DISCOVERY_TRADES[key].label })),
    statuses: Object.entries(PROSPECT_STATUS_LABELS).map(([key, label]) => ({ key, label })),
    statusCounts,
    scoredCount: PROSPECTS.filter((p) => p.scores.length).length,
    sourceCategoryOptions: SOURCE_CATEGORY_OPTIONS,
    sourceCategoryOptionsComplete: true,
    sourceCategoryOptionsError: null,
    sourceCategory: g("sourceCategory") || null,
  };
}

// /api/platform/sales/prospects/:id — the route's own assembly over the raw row.
const CONFIDENCE_RULES = Object.entries(SIGNALS).map(([signal, s], i) => ({
  id: `cr_${i}`,
  signal,
  weight: s.weight,
  category: s.category,
  enabled: true,
  version: "1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}));
const SIGNATURE_NAMES = Object.fromEntries(seedSignatures().map((s) => [s.code, s.name]));

function prospectDetail(p) {
  const view = prospectView({
    prospect: p,
    capabilities: p.capabilities,
    technologies: p.technologies.map((t) => ({ ...t, name: SIGNATURE_NAMES[t.technologyCode] || t.technologyCode })),
    inferences: p.inferences,
    opportunities: p.opportunities,
    evidence: p.evidence,
    scores: p.scores,
    rules: CONFIDENCE_RULES,
    capabilityNames: Object.fromEntries(p.opportunities.map((o) => [o.capabilityCode, o.capability?.name || o.capabilityCode])),
    repId: null,
    now: new Date(NOW),
  });
  return {
    prospect: {
      ...view,
      tradeLabel: p.tradeKey ? DISCOVERY_TRADES[p.tradeKey]?.label || p.tradeKey : null,
      territory: TERRITORIES.find((t) => t.id === p.territoryId) || null,
      campaign: CAMPAIGNS.find((c) => c.id === p.campaignId) || null,
      provenance: {
        provider: p.sourceProvider,
        recordId: p.sourceRecordId,
        release: p.sourceRelease,
        dataset: p.sourceDataset,
        confidence: p.sourceConfidence === null ? null : Number(p.sourceConfidence),
      },
      possibleDuplicateOfId: p.possibleDuplicateOfId,
      sourceCategories: p.sourceCategories,
      sourceCategoriesView: sourceCategoryView(p),
      assignedRep: p.assignedRepId ? REPS[p.assignedRepId] || null : null,
      assignedAt: p.assignedAt,
      claimExpiresAt: p.claimExpiresAt,
      doNotContactAt: p.doNotContactAt,
      doNotContactReason: p.doNotContactReason,
      corrections: p.corrections,
      evidenceCount: p.evidence.length,
      evidence: p.evidence.slice(0, 60).map((e) => ({
        id: e.id, type: e.type, source: e.source, sourceUrl: e.sourceUrl, rawValue: e.rawValue,
        normalizedValue: e.normalizedValue, observedAt: e.observedAt, detector: e.detector, detectorVersion: e.detectorVersion,
      })),
    },
    claimHours: CLAIM_HOURS,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/review — the folder (ported from
// docs/screens/platform-review/harness/reviewFetch.js, widened to 12 rows)
// ═══════════════════════════════════════════════════════════════════════════
const RBQ_WORDS = ["1.2 — Entrepreneur en petits bâtiments", "2.5 — Entrepreneur en excavation et terrassement", "2.7 — Entrepreneur en travaux d'emplacement", "3.2 — Entrepreneur en petits ouvrages de béton", "4.2 — Entrepreneur en travaux de maçonnerie non structurale, marbre et céramique", "5.2 — Entrepreneur en ouvrages métalliques", "6.2 — Entrepreneur en travaux de bois et plastique", "7 — Entrepreneur en isolation, étanchéité, couvertures et revêtements extérieurs", "8 — Entrepreneur en portes et fenêtres", "9 — Entrepreneur en travaux de finition", "11.2 — Entrepreneur en équipements et produits spéciaux", "12 — Entrepreneur en armoires et comptoirs usinés", "13.5 — Entrepreneur en installations spéciales ou préfabriquées", "17.2 — Entrepreneur en intercommunication, téléphonie et surveillance"];
const RBQ_LABEL = "RBQ — Quebec contractor licences";
const RBQ_REASON = "Holds a contractor licence (Quebec RBQ).";
const REVIEW_CAMPAIGN = { id: CAMPAIGN_ID, name: "Quebec — rbq part 1" };
const reviewRow = (id, businessName, city, phone, licence, suggestions, extra = {}) => ({
  id, businessName, tradingNames: [], city, province: "QC", phoneE164: phone, websiteUrl: null, hasWebsite: null,
  sourceProvider: "rbq", sourceLabel: RBQ_LABEL, register: "Quebec RBQ", licenceNumber: licence, categories: RBQ_WORDS,
  classificationReason: RBQ_REASON, status: "discovered", classification: "contractor", tradeKey: null, tradeLabel: null,
  reasons: ["no_trade"], deferred: false, campaign: REVIEW_CAMPAIGN, suggestions, retailWord: null, duplicateOf: null, ...extra,
});
const S = (tradeKey, label, source, basis) => ({ tradeKey, label, source, basis });

let reviewRows = [
  reviewRow("rv1", "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", "Saint-Hubert (Longueuil)", "+14505550137", "5782-8402-01", [S("roofing", "Roofing", "name", "name: 'toitur'")], { tradingNames: ["Toitures Beauchemin", "Beauchemin Couvreurs Rive-Sud"], websiteUrl: "https://www.toiture-beauchemin-rive-sud.ca/", hasWebsite: true }),
  reviewRow("rv2", "Toitures Dupont inc.", "Terrebonne", "+14505550152", "5782-8411-01", [S("roofing", "Roofing", "name", "name: 'toitur'")]),
  reviewRow("rv3", "Toiture & Rénovation D'Aoust inc.", "Mirabel", "+14505550177", "5782-8419-01", [S("roofing", "Roofing", "name", "name: 'toitur'"), S("remodeling", "Remodelling", "name", "name: 'renov'")]),
  reviewRow("rv4", "Électro-Plomberie J.-P. & Associés inc. (chauffage, climatisation, géothermie)", "Gatineau (secteur Aylmer)", "+18195550142", "5782-8485-01", [S("electrical", "Electrical", "name", "name: 'electro'"), S("plumbing", "Plumbing", "name", "name: 'plomb'"), S("hvac", "Heating and cooling", "name", "name: 'chauffage'")]),
  reviewRow("rv5", "9410-5111 Québec inc.", "Montréal", "+15145550118", "5782-8584-01", [S("electrical", "Electrical", "licence", "licence: only 16 électricité")], { categories: ["16 — Entrepreneur en électricité"], tradingNames: ["Les Installations Électriques Mercier", "Mercier Électrique Résidentiel et Commercial"] }),
  reviewRow("rv6", "Les Paysagistes Cinquino Compagnie Ltée", "Saint-Léonard", "+15145550190", "5782-8527-01", [S("landscaping", "Landscaping", "name", "name: 'paysag'")], { websiteUrl: "https://cinquino.example", hasWebsite: true }),
  reviewRow("rv7", "Plomberie & Chauffage Charbonneau inc.", "Montréal (Rosemont–La Petite-Patrie)", "+15145550171", "5782-8576-01", [S("plumbing", "Plumbing", "site", "site: plomberiecharbonneau.example"), S("hvac", "Heating and cooling", "name", "name: 'chauffage'")], { websiteUrl: "https://plomberiecharbonneau.example", hasWebsite: true }),
  reviewRow("rv8", "Peinture Dépôt Rive-Sud (Boucherville) — Peintures Sico, Benjamin Moore, Dulux", "Boucherville", "+14505550164", "5782-8611-01", [], { retailWord: "depot" }),
  reviewRow("rv9", "Construction 2Much inc.", "Montréal", "+15145550101", "5782-8485-02", []),
  reviewRow("rv10", "Armoires de Cuisine Beaulieu-Tremblay & Frères — Ébénisterie architecturale", "Saint-Jérôme", "+14505550183", "5782-8633-01", [S("cabinets", "Cabinets", "name", "name: 'armoire'"), S("carpentry", "Carpentry", "licence", "licence: 6.2 bois et plastique")], { categories: ["6.2 — Entrepreneur en travaux de bois et plastique", "12 — Entrepreneur en armoires et comptoirs usinés"] }),
  reviewRow("rv11", "Excavation & Déneigement Lévesque-Fortin et Fils inc.", "Sainte-Julie", "+14505550199", "5782-8640-01", [S("excavation", "Excavation", "name", "name: 'excavation'")], { deferred: true }),
  reviewRow("rv12", "Gestion Immobilière Arpin inc.", "Saint-Thomas", "+14505550128", "5782-8527-02", [], {
    status: "needs_review", classification: "needs_review", classificationReason: "The source lists this as a shop as well as a trade — it may be a contractor with a showroom.",
    sourceProvider: "overture", sourceLabel: "Overture Maps — places", register: null, licenceNumber: null, categories: ["contractor", "home_improvement_store", "property_management_company"], reasons: ["unclear", "duplicate"], campaign: { id: "camp_qc_overture", name: "Quebec — overture" },
    duplicateOf: { id: P13, businessName: "Les Entreprises Arpin inc.", city: "Saint-Thomas", status: "discovered", tradeKey: "general_contracting" },
  }),
];
let reviewTotal = 46485;

const REVIEW_BASE = {
  pageSize: 50,
  reasons: [
    { key: "no_trade", label: "No trade", note: "A contractor with no trade — in nobody's queue until one is chosen." },
    { key: "unclear", label: "Unclear contractor / shop", note: "The classifier could not tell a contractor from a shop." },
    { key: "duplicate", label: "Possible duplicate", note: "Flagged as possibly the same business as another row." },
  ],
  trades: ["cabinets", "carpentry", "countertops", "demolition", "drywall", "electrical", "excavation", "fencing", "flooring", "general_contracting", "gutters", "hvac", "insulation", "landscaping", "masonry_concrete", "painting", "paving", "plumbing", "pool_spa", "remodeling", "roofing", "siding", "tiling"]
    .map((k) => ({ key: k, label: discoveryTradeLabel(k) })),
  sources: [{ key: "us_ca_cslb", label: "California CSLB", count: 119454 }, { key: "overture", label: "Overture", count: 82167 }, { key: "rbq", label: RBQ_LABEL, count: 49131 }, { key: "us_or_ccb", label: "Oregon CCB", count: 5281 }],
  provinces: [{ key: "CA", count: 119454 }, { key: "QC", count: 51193 }, { key: "NY", count: 31022 }, { key: "FL", count: 24011 }, { key: "OR", count: 5281 }],
  campaigns: [{ id: CAMPAIGN_ID, name: "Quebec — rbq part 1", count: 42821 }, { id: "camp_ca_cslb_1", name: "California — us_ca_cslb part 1", count: 25374 }, { id: "camp_qc_overture", name: "Quebec — overture", count: 2396 }],
};

function reviewFolder(url) {
  const g = (k) => url.searchParams.get(k) || null;
  const q = (g("q") || "").toLowerCase();
  const filter = { campaignId: g("campaignId"), source: g("source"), province: g("province"), reason: g("reason"), q: g("q"), website: g("website"), retail: g("retail") };
  let out = reviewRows;
  let total = reviewTotal;
  if (q) { out = out.filter((r) => r.businessName.toLowerCase().includes(q)); total = 583; }
  if (filter.retail === "yes") { out = out.filter((r) => r.retailWord); total = 1093; }
  if (filter.reason) { out = out.filter((r) => r.reasons.includes(filter.reason)); total = filter.reason === "no_trade" ? 44006 : filter.reason === "unclear" ? 2396 : 83; }
  if (filter.source) { out = out.filter((r) => r.sourceProvider === filter.source); total = REVIEW_BASE.sources.find((s) => s.key === filter.source)?.count || out.length; }
  if (filter.province) { out = out.filter((r) => r.province === filter.province); total = REVIEW_BASE.provinces.find((p) => p.key === filter.province)?.count || out.length; }
  if (filter.campaignId) { out = out.filter((r) => r.campaign.id === filter.campaignId); total = REVIEW_BASE.campaigns.find((c) => c.id === filter.campaignId)?.count || out.length; }
  if (filter.website === "yes") out = out.filter((r) => r.hasWebsite === true);
  if (filter.website === "no") out = out.filter((r) => r.hasWebsite !== true);
  const page = Math.max(0, Number(g("page")) || 0);
  return { ...REVIEW_BASE, total: Math.max(total, out.length), page, filter, rows: page === 0 ? out : [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/retry-pool
// ═══════════════════════════════════════════════════════════════════════════
// The ceilings are the rule table's own (DISPOSITIONS labels, RETRY_RULES
// maxAttempts), so a row here cannot disagree with the table above it.
const RULE_MAX = Object.fromEntries(retryRuleTable().map((r) => [r.code, r.maxAttempts]));
const exhaustedRow = ({ lastOutcome = "no_answer", ...over }) => ({
  id: "", businessName: "", place: "", tradeKey: null, tradeLabel: null, phoneE164: null,
  attemptCount: RULE_MAX[lastOutcome], maxAttempts: RULE_MAX[lastOutcome], lastOutcome,
  lastOutcomeLabel: DISPOSITIONS[lastOutcome]?.label || lastOutcome,
  exhaustedAt: "2026-09-09T21:15:00.000Z", recycledAt: null, recycledById: null, heldByRepId: null, doNotContact: false, status: "discovered",
  ...over,
});
let exhaustedRows = [
  exhaustedRow({ id: P7, businessName: "Construction 2Much inc.", place: "Montréal, QC, CA", phoneE164: "+15145550101", exhaustedAt: "2026-09-11T21:15:00.000Z" }),
  exhaustedRow({ id: P10, businessName: "Golden State Custom Cabinetry, Millwork & Countertops Inc.", place: "Irvine, CA, US", tradeKey: "cabinets", tradeLabel: "Cabinets", phoneE164: "+19495550188", lastOutcome: "voicemail", exhaustedAt: "2026-09-11T17:40:00.000Z", recycledAt: "2026-09-08T14:00:00.000Z", recycledById: "adm1" }),
  exhaustedRow({ id: P11, businessName: "Rose City Landscape, Irrigation & Hardscape LLC", place: "Portland, OR, US", tradeKey: "landscaping", tradeLabel: "Landscaping", phoneE164: "+15035550129", exhaustedAt: "2026-09-08T00:05:00.000Z", heldByRepId: "rep_jordan" }),
  exhaustedRow({ id: P12, businessName: "McAllister & Daughters Hardwood Flooring, Refinishing and Tile", place: "Bend, OR, US", tradeKey: "flooring", tradeLabel: "Flooring", phoneE164: "+15415550176", lastOutcome: "voicemail", exhaustedAt: "2026-09-07T22:30:00.000Z" }),
  exhaustedRow({ id: "pro_ex_5", lastOutcome: "gatekeeper", businessName: "Isolation & Étanchéité Grand Montréal — Uréthane giclé, cellulose, calfeutrage", place: "Laval, QC, CA", tradeKey: "insulation", tradeLabel: "Insulation", phoneE164: "+14505550211", exhaustedAt: "2026-09-07T19:10:00.000Z" }),
  exhaustedRow({ id: "pro_ex_6", businessName: "Gouttières Sans Joint Lanaudière inc.", place: "Repentigny, QC, CA", tradeKey: "gutters", tradeLabel: "Gutters", phoneE164: "+14505550222", lastOutcome: "voicemail", exhaustedAt: "2026-09-06T15:45:00.000Z", recycledAt: "2026-09-01T10:00:00.000Z", recycledById: "adm1" }),
  exhaustedRow({ id: "pro_ex_7", businessName: "Plomberie & Chauffage Charbonneau inc.", place: "Montréal (Rosemont–La Petite-Patrie), QC, CA", tradeKey: "hvac", tradeLabel: "Heating and cooling", phoneE164: "+15145550171", exhaustedAt: "2026-09-06T14:00:00.000Z", doNotContact: true }),
  exhaustedRow({ id: "pro_ex_8", lastOutcome: "busy", businessName: "Sunshine Pools, Spas & Outdoor Living of the Inland Empire, Inc.", place: "Riverside, CA, US", tradeKey: "pool_spa", tradeLabel: "Pools and spas", phoneE164: "+19515550133", exhaustedAt: "2026-09-05T23:20:00.000Z" }),
  exhaustedRow({ id: "pro_ex_9", businessName: "Béton Décoratif Vallée-du-Richelieu — Planchers de garage époxy et polyaspartique", place: "Beloeil, QC, CA", tradeKey: "masonry_concrete", tradeLabel: "Masonry and concrete", phoneE164: "+14505550244", lastOutcome: "voicemail", exhaustedAt: "2026-09-05T20:00:00.000Z" }),
  exhaustedRow({ id: "pro_ex_10", businessName: "Willamette Valley Fence & Deck Co.", place: "Salem, OR, US", tradeKey: "fencing", tradeLabel: "Fencing", phoneE164: "+15035550255", exhaustedAt: "2026-09-04T18:30:00.000Z", status: "researching" }),
  exhaustedRow({ id: "pro_ex_11", businessName: "Clôtures et Terrasses Bois-Franc du Nord inc.", place: "Saint-Sauveur, QC, CA", tradeKey: "fencing", tradeLabel: "Fencing", phoneE164: null, exhaustedAt: "2026-09-03T16:00:00.000Z" }),
];
const exhaustedPage = (page) => ({ total: 1287, recycledTotal: 214, page, pageSize: 50, rows: page === 1 ? exhaustedRows : [] });

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/snapshots
// ═══════════════════════════════════════════════════════════════════════════
const SNAPSHOT_LIBRARY = {
  baseUrl: "https://pub-4f19c2e8a7b34d6e9c0a1b2c3d4e5f60.r2.dev",
  verifiedObjectKey: "us_or_ccb/us-or.ndjson",
  verifiedRows: 5281,
  verifiedAt: "2026-09-02T09:14:52.000Z",
  configured: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/capabilities and /rules — the matrix and the seed
// rules, through the route's own helpers
// ═══════════════════════════════════════════════════════════════════════════
const MATRIX = capabilityMatrix();
const UNSEEDED = ["CUSTOM_FIELDS"];
const RULE_ROWS = [
  ...seedOpportunityRules({ matrix: MATRIX }).map((r, i) => ({
    id: `rule_${i}`,
    ...r,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: i === 1 ? "2026-09-04T11:20:00.000Z" : "2026-08-01T00:00:00.000Z",
    ...(i === 1 ? { version: "2" } : {}),
  })),
  // A superadmin's own rule, switched off — the screen shows the off state.
  {
    id: "rule_custom_1", code: "REVIEWS_ON_SITE_NO_BOOKING", name: "Shows reviews, still cannot book (Quebec roofers)", capabilityCode: "ONLINE_BOOKING",
    conditions: { all: [{ kind: "capability", code: "ONLINE_REVIEWS", is: true }, { kind: "capability", code: "ONLINE_BOOKING", is: false }, { kind: "competitor", present: false }] },
    reasonTemplate: "They are proud enough of the work to put the reviews on the site, and the only way to act on them is to phone during office hours.",
    priority: 55, active: false, version: "3", createdAt: "2026-08-19T15:02:00.000Z", updatedAt: "2026-09-08T10:15:00.000Z",
  },
  // A rule that cites a variable nothing fills: validateRule refuses it, and
  // the card draws the problems with the reason each is a problem.
  {
    id: "rule_custom_2", code: "PORTAL_PITCH_BROKEN", name: "Client portal pitch (drafted, never valid)", capabilityCode: "CLIENT_PORTAL",
    conditions: { all: [{ kind: "capability", code: "CLIENT_PORTAL", is: false }] },
    reasonTemplate: "Their customers cannot see {invoiceCount} invoices in one place — {capabilityName} would fix that.",
    priority: 10, active: true, version: "1", createdAt: "2026-09-11T20:30:00.000Z", updatedAt: "2026-09-11T20:30:00.000Z",
  },
];
const RULE_RESULT_COUNTS = { NO_WEBSITE: 8412, WEBSITE_NO_BOOKING: 3170, EMAIL_ONLY_CONTACT: 1244, NO_ONLINE_PAYMENT: 2905, COMPETITOR_WHITE_LABEL: 611, COMPETITOR_MISSED_CALLS: 590, NO_CHAT_NO_HOURS: 77 };
const sayRule = sayWith(REFUSALS);

function capabilitiesPayload() {
  const rulesByCapability = new Map();
  for (const r of RULE_ROWS) {
    if (!rulesByCapability.has(r.capabilityCode)) rulesByCapability.set(r.capabilityCode, []);
    rulesByCapability.get(r.capabilityCode).push({ code: r.code, name: r.name, capabilityCode: r.capabilityCode, active: r.active, priority: r.priority });
  }
  return {
    capabilities: MATRIX.filter((c) => !UNSEEDED.includes(c.code)).map((c, i) => ({
      ...c,
      // Two rows switched off, so the matrix shows the state a superadmin can
      // put a capability in and the rep script it then loses.
      active: !["AERIAL_MEASURE", "KITCHEN_DESIGNER"].includes(c.code),
      script: repScript(c),
      rules: rulesByCapability.get(c.code) || [],
      reachable: (rulesByCapability.get(c.code) || []).some((r) => r.active),
      id: `capdef_${i}`,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    })),
    unseeded: UNSEEDED,
    excluded: EXCLUDED_CAPABILITIES,
  };
}

function rulesPayload() {
  return {
    rules: RULE_ROWS.map((r) => {
      const { ok, problems } = validateRule(r, { matrix: MATRIX });
      const resultCount = RULE_RESULT_COUNTS[r.code] || 0;
      return { ...r, resultCount, deletable: resultCount === 0, valid: ok, problems: sayRule(problems) };
    }),
    capabilities: MATRIX.map((c) => ({ code: c.code, name: c.name, active: c.active, tableStakes: c.recommendedTalkingPoints.tableStakes !== false })),
    conditionKinds: CONDITION_KINDS,
    observableCapabilityCodes: OBSERVABLE_CAPABILITY_CODES,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/confidence
// ═══════════════════════════════════════════════════════════════════════════
const MISSING_SIGNALS = new Set(["detection.transcript", "identity.postal_code"]);
const TUNED = { "detection.page_content": 0.35, "identity.name_fuzzy": 0.45 };
const DISABLED_SIGNALS = new Set(["detection.meta"]);
function confidencePayload() {
  const rows = Object.keys(SIGNALS)
    .filter((s) => !MISSING_SIGNALS.has(s))
    .map((signal, i) => ({
      id: `cr_${i}`, signal, weight: TUNED[signal] ?? SIGNALS[signal].weight, category: SIGNALS[signal].category,
      enabled: !DISABLED_SIGNALS.has(signal), version: TUNED[signal] != null ? "2" : "1",
      createdAt: "2026-08-01T00:00:00.000Z", updatedAt: TUNED[signal] != null ? "2026-09-06T17:22:10.000Z" : "2026-08-01T00:00:00.000Z",
    }));
  const legacy = { id: "cr_legacy", signal: "detection.legacy_widget", weight: 0.4, enabled: true, category: null, version: "1", createdAt: "2026-07-02T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z" };
  const all = [...rows, legacy];
  const { weights, disabled, unrecognised } = weightsFrom(all);
  const byName = new Map(all.map((r) => [r.signal, r]));
  return {
    signals: Object.entries(SIGNALS).map(([signal, s]) => {
      const row = byName.get(signal);
      return {
        signal, category: s.category, defaultWeight: s.weight,
        seeded: Boolean(row),
        weight: row ? Number(row.weight) : s.weight,
        enabled: row ? row.enabled : true,
        version: row?.version ?? null,
        updatedAt: row?.updatedAt ?? null,
        effectiveWeight: disabled.has(signal) ? null : (weights.get(signal) ?? null),
        tunedAwayFromDefault: row ? Number(row.weight) !== s.weight : false,
      };
    }),
    categories: CATEGORIES,
    unrecognised: unrecognised.map((signal) => {
      const row = byName.get(signal);
      return { signal, weight: row ? Number(row.weight) : null, enabled: row?.enabled ?? null };
    }),
    missing: Object.keys(SIGNALS).filter((s) => !byName.has(s)),
    thresholds: { matchThreshold: MATCH_THRESHOLD, fuzzyCeiling: FUZZY_CEILING },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/signatures
// ═══════════════════════════════════════════════════════════════════════════
const DETECTION_COUNTS = { HOUSECALL_PRO: 1211, JOBBER: 987, SERVICETITAN: 402, WORDPRESS: 9310, GOOGLE_ANALYTICS: 7720, SQUARESPACE: 1843, WIX: 2210, CALENDLY: 355 };
function signaturesPayload() {
  const rows = seedSignatures().map((s, i) => ({
    id: `sig_${i}`, ...s,
    createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", createdByAdminId: null,
  }));
  rows.push({
    id: "sig_custom_1", code: "SOUMISSION_RENOVATION", name: "SoumissionRénovation.ca lead widget", isCompetitor: true, active: true,
    patterns: [{ kind: "script_src", value: "widget.soumissionrenovation.ca", weight: 0.9 }, { kind: "iframe_host", value: "app.soumissionrenovation.ca", weight: 0.9 }],
    version: "2", createdAt: "2026-08-22T13:00:00.000Z", updatedAt: "2026-09-09T08:40:00.000Z", createdByAdminId: "adm1",
  });
  rows.sort((a, b) => Number(b.isCompetitor) - Number(a.isCompetitor) || a.code.localeCompare(b.code));
  return {
    signatures: rows.map((s) => {
      const detectionCount = DETECTION_COUNTS[s.code] || 0;
      return { ...s, detectionCount, deletable: detectionCount === 0 };
    }),
    patternKinds: PATTERN_KINDS,
    crawledProspects: 14822,
    detectionsPending: false,
    detectorVersion: DETECTOR_VERSION,
    sourcing: sourcingNotes(),
    seedable: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/sales/playbooks, /objections, /experiments, /preview
// ═══════════════════════════════════════════════════════════════════════════
const STORE = { ready: true, missing: [], pendingSchemaFile: "lib/sales/playbook/schema.pending.prisma" };
// Three of the four built-ins are installed; QUOTE_AUTOMATION is left for the
// Install button to offer. One superadmin-written playbook sits switched off.
const NOT_INSTALLED = "QUOTE_AUTOMATION";
const PLAYBOOK_ROWS = [
  ...seedPlaybooks()
    .filter((p) => p.key !== NOT_INSTALLED)
    .map((p, i) => ({
      id: `pb_${i}`, ...p, source: "db", createdByAdminId: null,
      createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z",
    })),
  {
    id: "pb_custom_1", key: "QC_ROOFER_WINTER_BOOKINGS", name: "Quebec roofers — booking the spring before the snow is gone (draft)",
    selectorKey: "website_without_booking", priority: 5, active: false, version: "4", source: "db", createdByAdminId: "adm1",
    createdAt: "2026-09-03T14:00:00.000Z", updatedAt: "2026-09-11T19:45:00.000Z",
    stages: STAGE_KEYS.map((stageKey) => ({
      stageKey,
      say: stageKey === "open" ? "Hi, is that {businessName} in {city}? I know I'm catching you out of nowhere — can I give you thirty seconds on why I called?"
        : stageKey === "relevance" ? "I was on your site last night. It's a good site — the reviews are right there — and there is no way to book you from it, so everybody who reads it at ten at night has to remember to ring you in the morning."
        : stageKey === "fit" ? "We put a booking page on the site you already have, in French and English, and the {tradeName} calendar fills itself while you are on a roof."
        : "",
      prompts: stageKey === "discovery" ? ["How do people reach you when they read the site after hours?", "Who answers the phone when the whole crew is on a roof?"] : [],
    })),
  },
];
const sayPlaybook = sayWith(PLAYBOOK_PROBLEMS);
const sayObjection = sayWith(OBJECTION_PROBLEMS);
const sayExperiment = sayWith(EXPERIMENT_PROBLEMS);
const PLAYBOOK_USED = { COMPETITIVE_DISPLACEMENT: 611, ONLINE_PRESENCE: 8412, BOOKING_GAP: 3170 };

function playbooksPayload() {
  return {
    store: STORE,
    playbooks: PLAYBOOK_ROWS.map((p) => {
      const { ok, problems } = validatePlaybook(p);
      const usedCount = PLAYBOOK_USED[p.key] || 0;
      return { ...p, usedCount, deletable: usedCount === 0, valid: ok, problems: sayPlaybook(problems) };
    }),
    selectors: selectorCatalogue(),
    stages: STAGES.map((s) => ({ ...s })),
    variables: PLAYBOOK_VARS,
    selectionRefusals: SELECTION_REFUSALS,
    availableDefaults: seedPlaybooks().filter((p) => p.key === NOT_INSTALLED).map((p) => ({ key: p.key, name: p.name, selectorKey: p.selectorKey })),
  };
}

const OBJECTION_ROWS = seedObjections().map((o, i) => ({
  ...o, id: o.code, source: "db", createdByAdminId: null,
  createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z",
}));
function objectionsPayload() {
  return {
    store: STORE,
    objections: OBJECTION_ROWS.map((o) => {
      const { ok, problems } = validateObjection(o);
      return { ...o, valid: ok, problems: sayObjection(problems) };
    }),
    selectors: selectorCatalogue(),
    availableDefaults: [],
  };
}

const EXPERIMENTS = [
  {
    id: "exp_1", key: "BOOKING_GAP_OPENER_CANDOUR", name: "Booking gap — candour opener vs. the built-in opener",
    hypothesis: "Leading with 'I know I'm catching you out of nowhere' before the thirty-second ask keeps more Quebec roofers on the line past the opener than the built-in line does.",
    playbookKey: "BOOKING_GAP",
    variants: [
      { key: "control", label: "Built-in opener", weight: 1, stages: [] },
      { key: "candour_first", label: "Candour before the ask", weight: 1, stages: [{ stageKey: "open", say: "I know I'm catching you out of nowhere — is that {businessName}? Can I give you thirty seconds on why I called?", prompts: [] }] },
    ],
    active: true, startedAt: "2026-09-04T13:00:00.000Z", stoppedAt: null, createdByAdminId: "adm1",
    createdAt: "2026-09-04T12:55:00.000Z", updatedAt: "2026-09-04T13:00:00.000Z",
    assignments: [...Array(212).fill({ variantKey: "control" }), ...Array(219).fill({ variantKey: "candour_first" }), ...Array(3).fill({ variantKey: "candour_v0" })],
  },
  {
    id: "exp_2", key: "ONLINE_PRESENCE_NEXT_STEP_DEMO_LENGTH", name: "No website — offer a ten-minute demo instead of fifteen",
    hypothesis: "A shorter stated demo gets more next-step agreements from one-person businesses with no site, without changing what is shown.",
    playbookKey: "ONLINE_PRESENCE",
    variants: [
      { key: "fifteen", label: "Fifteen minutes (built-in)", weight: 2, stages: [] },
      { key: "ten", label: "Ten minutes", weight: 1, stages: [{ stageKey: "next_step", say: "I can show you in ten minutes how it works for a business like yours — when is a bad time NOT, this week?", prompts: [] }] },
    ],
    active: false, startedAt: "2026-08-20T09:00:00.000Z", stoppedAt: "2026-09-09T16:30:00.000Z", createdByAdminId: "adm1",
    createdAt: "2026-08-20T08:50:00.000Z", updatedAt: "2026-09-09T16:30:00.000Z",
    assignments: [...Array(1040).fill({ variantKey: "fifteen" }), ...Array(498).fill({ variantKey: "ten" })],
  },
  {
    id: "exp_3", key: "DISPLACEMENT_WEIGHTS_DRAFT", name: "Displacement — draft with both arms at zero (never started)",
    hypothesis: "Placeholder while the second arm is written.",
    playbookKey: "COMPETITIVE_DISPLACEMENT",
    variants: [{ key: "a", label: "A", weight: 0, stages: [] }, { key: "b", label: "B", weight: 0, stages: [] }],
    active: false, startedAt: null, stoppedAt: null, createdByAdminId: "adm1",
    createdAt: "2026-09-12T22:10:00.000Z", updatedAt: "2026-09-12T22:10:00.000Z",
    assignments: [],
  },
];
function experimentsPayload() {
  return {
    store: STORE,
    experiments: EXPERIMENTS.map((e) => {
      const { ok, problems } = validateExperiment(e, { stageKeys: STAGE_KEYS });
      const { assignments, ...row } = e;
      return { ...row, valid: ok, problems: sayExperiment(problems), summary: summariseExperiment(e, assignments) };
    }),
    playbooks: PLAYBOOK_ROWS.map((p) => ({ key: p.key, name: p.name })),
    stageKeys: STAGE_KEYS,
    winnerPolicy: WINNER_POLICY,
  };
}

/** lib/sales/playbook/assemble.js's assembly, over the bank's raw rows. */
function assemblePreview(prospectId, { useAi = false } = {}) {
  const p = byId.get(prospectId);
  if (!p) return null;
  const index = indexProspect({ capabilities: p.capabilities, technologies: p.technologies });
  const playbooks = PLAYBOOK_ROWS.filter((pb) => pb.active);
  const selection = selectPlaybook({ playbooks, index });
  const catalogue = selectorCatalogue();
  const selectorLabel = selection.selected ? catalogue.find((s) => s.key === selection.selected.selectorKey)?.label || null : null;

  let experiment = null;
  let assignment = null;
  let variant = null;
  let assignmentRefusal = null;
  if (selection.selected) {
    experiment = EXPERIMENTS.find((e) => e.active && e.playbookKey === selection.selected.key) || null;
    if (experiment) {
      const { variantKey, refusal } = deriveVariant(experiment, prospectId);
      assignmentRefusal = refusal;
      if (variantKey) {
        assignment = { variantKey, assignedAt: "2026-09-10T13:05:02.000Z", assignedBy: "system" };
        variant = experiment.variants.find((v) => v.key === variantKey) || null;
      }
    }
  }

  const ctx = talkingPointContext({ opportunities: p.opportunities, matrix: MATRIX });
  const { accepted, refused } = deterministicTalkingPoints(ctx);
  const generation = useAi
    ? { points: accepted.map((pt) => ({ ...pt, source: "ai" })), refused, source: "ai", degraded: false, reason: null, reasonText: null, model: "gpt-4.1-mini" }
    : {
        points: accepted, refused, source: "rule", degraded: true, reason: "not_requested",
        reasonText: "Built from the rules alone. Nothing was sent to a model — generating costs money and a page view should not spend it.",
        model: null,
      };

  const objections = objectionsForProspect({ objections: OBJECTION_ROWS.filter((o) => o.active), index });
  const script = selection.selected
    ? buildCallScript({
        playbook: playbooks.find((pb) => pb.key === selection.selected.key) || null,
        variant,
        prospect: p,
        index,
        rep: null,
        points: generation.points,
        objections,
      })
    : null;

  return {
    found: true,
    prospect: { id: p.id, businessName: p.businessName, city: p.city, tradeKey: p.tradeKey, phoneE164: p.phoneE164, domain: p.domain },
    selection: { ...selection, selectorLabel },
    unchecked: index.unchecked,
    conflicts: index.conflicts,
    experiment: experiment
      ? { key: experiment.key, name: experiment.name, hypothesis: experiment.hypothesis, variantKey: assignment?.variantKey ?? null, assignedAt: assignment?.assignedAt ?? null, assignedBy: assignment?.assignedBy ?? null, refusal: assignmentRefusal }
      : null,
    talkingPoints: generation.points,
    refusedPoints: generation.refused,
    generation: { source: generation.source, degraded: generation.degraded, reason: generation.reason, reasonText: generation.reasonText, model: generation.model, persisted: useAi },
    objections,
    script,
    store: STORE,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/platform/suppressions
// ═══════════════════════════════════════════════════════════════════════════
const sup = (id, kind, value, rawValue, source, reason, requestedAt, over = {}) => ({
  id, kind, value, rawValue, channels: ["email", "phone", "sms"], source, reason, evidenceUrl: null,
  requestedAt, retainUntil: "2031-" + requestedAt.slice(5), removedAt: null, removedByAdminId: null, removedReason: null, createdAt: requestedAt,
  ...over,
});
const SUPPRESSIONS = [
  sup("sup_1", "phone", "+15145550171", "514 555-0171", "call", "Owner said on the phone: 'Enlevez-moi de votre liste, je ne veux plus d'appels.'", "2026-09-06T16:45:00.000Z", { evidenceUrl: "https://app.fieldquo.com/platform/sales/floor?call=call_8f13a" }),
  sup("sup_2", "email", "comptabilite@les-entreprises-de-toiture-rive-sud-beauchemin-et-fils.ca", "Comptabilite@Les-Entreprises-de-Toiture-Rive-Sud-Beauchemin-et-Fils.ca", "reply", "Replied 'UNSUBSCRIBE — ne plus écrire à cette adresse' to the second sequence email.", "2026-09-05T12:03:11.000Z", { channels: ["email"], salesMessageId: "msg_41a9" }),
  sup("sup_3", "domain", "servicetitan.com", "ServiceTitan.com", "manual", "Competitor's own staff domain — nobody at a competitor is a prospect.", "2026-08-28T09:00:00.000Z"),
  sup("sup_4", "phone", "+13105550144", "(310) 555-0144", "sms", "Texted STOP.", "2026-09-09T02:14:38.000Z", { channels: ["sms", "phone"] }),
  sup("sup_5", "email", "jordan.mcallister@mcallisterhardwoodfloors.com", "jordan.mcallister@mcallisterhardwoodfloors.com", "form", "Used the 'stop contacting me' link on the FieldQuo sales page.", "2026-09-08T17:22:05.000Z", { evidenceUrl: "https://fieldquo.com/unsubscribe?t=9c1e" }),
  sup("sup_6", "phone", "+18195550142", "819-555-0142", "regulator", "On the Canadian National Do Not Call List (DNCL) at the 2026-09-01 refresh.", "2026-09-01T06:00:00.000Z", { channels: ["phone", "sms"] }),
  sup("sup_7", "domain", "gouvernement.qc.ca", "gouvernement.qc.ca", "import", "Loaded from the pre-launch list — public bodies.", "2026-08-15T08:00:00.000Z"),
  sup("sup_8", "email", "info@peinture-depot-rive-sud.ca", "INFO@PEINTURE-DEPOT-RIVE-SUD.CA", "import", "Loaded from the pre-launch list.", "2026-08-15T08:00:00.000Z"),
  sup("sup_9", "phone", "+14505550199", "450 555 0199", "call", "Asked not to be called again until the spring; recorded as a full stop rather than a snooze, which this list cannot express.", "2026-09-11T14:50:00.000Z"),
  sup("sup_10", "email", "reception@electroplomberiejp.ca", "reception@electroplomberiejp.ca", "reply", "Auto-reply loop, then a human: 'Please remove us.'", "2026-08-30T19:40:00.000Z", {
    removedAt: "2026-09-07T10:12:00.000Z", removedByAdminId: "adm1", removedReason: "The owner rang back and asked for the demo; lifted at his request, recorded on the call.",
  }),
  sup("sup_11", "phone", "+15035550255", "503.555.0255", "sms", "Texted STOP.", "2026-08-25T21:05:00.000Z", { channels: ["sms"], removedAt: "2026-09-02T15:00:00.000Z", removedByAdminId: "adm1", removedReason: "Wrong number — the reply came from a personal phone that was never the business's." }),
];
function suppressionsPayload(url) {
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const rows = q ? SUPPRESSIONS.filter((r) => [r.value, r.rawValue, r.reason].filter(Boolean).some((v) => v.toLowerCase().includes(q))) : SUPPRESSIONS;
  return { rows, total: q ? rows.length : 1372, sources: ["reply", "call", "sms", "form", "manual", "import", "regulator"], channels: ["email", "phone", "sms"] };
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenes — shipped controls only
// ═══════════════════════════════════════════════════════════════════════════
const setValue = (el, value) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};
const buttonByText = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));

export const scenes = {
  "/platform/sales/prospects": {
    // The first row's card → the detail panel (facts, inferences, recommendations…).
    open: async ({ until, wait, settled }) => {
      (await until("ul li button")).click();
      await settled();
      await until("section h2");
      await wait(200);
    },
    // The Filters button → the "Narrow it down" card with every select populated.
    filters: async ({ until, wait }) => {
      await until("ul li button");
      buttonByText("Filters").click();
      await until("#f-territory");
      await wait(200);
    },
  },
  "/platform/sales/playbooks": {
    // The first playbook's row → its stages, with the words.
    open: async ({ until, wait }) => {
      const first = await until('button[class*="w-full text-left"]');
      first.click();
      await until("ul.pl-5, .whitespace-pre-wrap");
      await wait(200);
    },
    objections: async ({ until, wait }) => {
      await until('button[class*="w-full text-left"]');
      buttonByText("Objections").click();
      await until(".whitespace-pre-wrap");
      await wait(200);
    },
    experiments: async ({ until, wait }) => {
      await until('button[class*="w-full text-left"]');
      buttonByText("Experiments").click();
      await wait(300);
    },
  },
  "/platform/sales/playbooks/preview": {
    // Search → pick the roofer → the assembled call.
    open: async ({ until, wait, settled }) => {
      const input = await until('input[placeholder="Business name, phone or domain"]');
      setValue(input, "beauchemin");
      buttonByText("Search").click();
      (await until("ul li button")).click();
      await settled();
      await until("h2");
      await wait(300);
    },
  },
  "/platform/sales/review": {
    // The bulk panel: search "toiture", Select all, pick Roofing.
    open: async ({ until, wait }) => {
      await until("[data-review-rows] [data-review-row]");
      const input = await until('input[aria-label="Search"]');
      setValue(input, "toiture");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(400);
      (await until("[data-bulk-open]")).click();
      setValue(await until("[data-bulk-trade]"), "roofing");
      await wait(200);
    },
  },
  "/platform/sales/rules": {
    // The first rule's Edit control → the condition editor.
    open: async ({ until, wait }) => {
      await until("pre");
      const edit = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Edit");
      if (!edit) throw new Error("scene: no Edit button on the rules page");
      edit.click();
      await until("select");
      await wait(200);
    },
  },
  "/platform/sales/signatures": {
    open: async ({ until, wait }) => {
      await until("pre");
      const edit = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Edit");
      if (!edit) throw new Error("scene: no Edit button on the signatures page");
      edit.click();
      await until("textarea");
      await wait(200);
    },
  },
  "/platform/sales/capabilities": {
    // The first capability's "Rep script" summary and its talking-points editor.
    open: async ({ until, wait }) => {
      (await until("details summary")).click();
      const edit = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Edit");
      if (edit) edit.click();
      await wait(300);
    },
  },
  "/platform/suppressions": {
    // "Add one" → the kind / value / source form.
    open: async ({ until, wait }) => {
      await until("tbody tr");
      const add = buttonByText("Add");
      if (!add) throw new Error("scene: no Add button on the suppressions page");
      add.click();
      await until("select");
      await wait(200);
    },
  },
  "/platform/sales/retry-pool": {
    // Tick the first exhausted row so the bulk Recycle control is armed.
    open: async ({ until, wait }) => {
      (await until('tbody input[type="checkbox"]')).click();
      await wait(200);
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// The answerer
// ═══════════════════════════════════════════════════════════════════════════
export default function answer({ method, path, url, body }) {
  // ── Review ──────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/review/bulk" && method === "POST") {
    return { ok: true, count: body?.expectedCount ?? 583, byStatus: { discovered: body?.expectedCount ?? 583 }, campaigns: 1, sample: reviewRows.slice(0, 3).map((r) => r.businessName), tradeLabel: body?.tradeKey ? discoveryTradeLabel(body.tradeKey) : "Roofing", research: "Not queued here. The backlog cron researches rows with a website, trade first; a claim queues the rest." };
  }
  if (path === "/api/platform/sales/review/reclassify" && method === "POST") {
    return { dryRun: body?.dryRun !== false, byProvider: { rbq: { found: 39655, withTrade: 0, withoutTrade: 37010, skipped: 2645 }, us_ca_cslb: { found: 119454, withTrade: 88102, withoutTrade: 31352, skipped: 0 } }, planned: 68362, updated: body?.dryRun === false ? 68362 : 0, campaigns: 3 };
  }
  if (path === "/api/platform/sales/review" && method === "POST") {
    if (body?.decision !== "skip") { reviewRows = reviewRows.filter((r) => r.id !== body?.prospectId); reviewTotal -= 1; }
    return { ok: true, decision: body?.decision, bucket: "banked", counters: {}, research: { queued: 1 } };
  }
  if (path === "/api/platform/sales/review") return reviewFolder(url);

  // ── Retry pool ──────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/retry-pool" && method === "POST") {
    const ids = body?.prospectIds || [];
    const recycledIds = exhaustedRows.filter((r) => ids.includes(r.id) && !r.doNotContact).map((r) => r.id);
    exhaustedRows = exhaustedRows.filter((r) => !recycledIds.includes(r.id));
    return { ok: true, recycled: recycledIds.length, recycledIds, skipped: ids.length - recycledIds.length, exhausted: exhaustedPage(Number(body?.page) || 1) };
  }
  if (path === "/api/platform/sales/retry-pool") {
    return { rules: retryRuleTable(), blocks: [...RETRY_BLOCKS], exhausted: exhaustedPage(Number(url.searchParams.get("page")) || 1), at: new Date(NOW).toISOString() };
  }

  // ── Snapshots ───────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/snapshots") {
    const library = method === "PUT" && body?.baseUrl ? { ...SNAPSHOT_LIBRARY, baseUrl: body.baseUrl.replace(/\/+$/, ""), verifiedAt: new Date(NOW).toISOString() } : SNAPSHOT_LIBRARY;
    return { library, catalogue: librarySummary() };
  }

  // ── Prospects ───────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/prospects") return listProspects(url);
  if (path.startsWith("/api/platform/sales/prospects/")) {
    const p = byId.get(path.slice("/api/platform/sales/prospects/".length));
    return p ? prospectDetail(p) : new Response(JSON.stringify({ error: "Not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // ── Capabilities ────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/capabilities" && method === "POST") return { counts: { capabilitiesCreated: 1, capabilitiesRefreshed: 34, rulesCreated: 0, signaturesCreated: 0 } };
  if (path === "/api/platform/sales/capabilities") return capabilitiesPayload();
  if (path.startsWith("/api/platform/sales/capabilities/")) {
    const code = path.split("/").pop();
    const c = capabilitiesPayload().capabilities.find((x) => x.code === code);
    return { capability: { ...c, ...(body || {}) } };
  }

  // ── Rules ───────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/rules" && method === "POST") return { rule: { ...RULE_ROWS[0], ...(body || {}), id: "rule_new", version: "1", active: true } };
  if (path === "/api/platform/sales/rules") return rulesPayload();
  if (path.startsWith("/api/platform/sales/rules/")) {
    const code = path.split("/").pop();
    const r = RULE_ROWS.find((x) => x.code === code) || RULE_ROWS[0];
    if (method === "DELETE") return { ok: true, deleted: code };
    return { rule: { ...r, ...(body || {}) }, bumped: Boolean(body?.conditions || body?.reasonTemplate) };
  }

  // ── Confidence ──────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/confidence") return confidencePayload();
  if (path.startsWith("/api/platform/sales/confidence/")) {
    const signal = decodeURIComponent(path.split("/").pop());
    return { rule: { id: "cr_x", signal, weight: body?.weight ?? SIGNALS[signal]?.weight ?? 0.5, enabled: body?.enabled ?? true, category: SIGNALS[signal]?.category ?? null, version: "2" }, bumped: body?.weight != null };
  }

  // ── Signatures ──────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/signatures" && method === "POST") {
    if (body?.action === "seed") return { counts: { created: 0, refreshed: 12 } };
    return { signature: { id: "sig_new", code: body?.code || "NEW", name: body?.name || "New signature", isCompetitor: Boolean(body?.isCompetitor), active: true, patterns: body?.patterns || [], version: "1" } };
  }
  if (path === "/api/platform/sales/signatures") return signaturesPayload();
  if (path.startsWith("/api/platform/sales/signatures/")) {
    const code = path.split("/").pop();
    const s = signaturesPayload().signatures.find((x) => x.code === code) || signaturesPayload().signatures[0];
    if (method === "DELETE") return { ok: true, deleted: code };
    return { signature: { ...s, ...(body || {}) }, bumped: Boolean(body?.patterns) };
  }

  // ── Playbooks ───────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/playbooks/install-defaults" && method === "POST") {
    return { playbooksCreated: [NOT_INSTALLED], objectionsCreated: [], playbooksSkipped: 3, objectionsSkipped: OBJECTION_ROWS.length };
  }
  if (path === "/api/platform/sales/playbooks/refresh-builtins" && method === "POST") {
    return { playbooksUpdated: 1, objectionsUpdated: 2, playbooksKept: ["BOOKING_GAP"], objectionsKept: ["TOO_EXPENSIVE"] };
  }
  if (path === "/api/platform/sales/playbooks/preview") {
    const id = method === "POST" ? body?.prospectId : url.searchParams.get("prospectId");
    if (!id) return new Response(JSON.stringify({ error: "A prospectId is required." }), { status: 400, headers: { "Content-Type": "application/json" } });
    const out = assemblePreview(id, { useAi: method === "POST" });
    return out || new Response(JSON.stringify({ error: "No prospect with that id." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  if (path === "/api/platform/sales/playbooks/objections" && method === "POST") return { objection: { ...OBJECTION_ROWS[0], ...(body || {}) } };
  if (path === "/api/platform/sales/playbooks/objections") return objectionsPayload();
  if (path.startsWith("/api/platform/sales/playbooks/objections/")) {
    const code = path.split("/").pop();
    if (method === "DELETE") return { ok: true, deleted: code };
    return { objection: { ...(OBJECTION_ROWS.find((o) => o.code === code) || OBJECTION_ROWS[0]), ...(body || {}) }, bumped: Boolean(body?.response) };
  }
  if (path === "/api/platform/sales/playbooks/experiments" && method === "POST") return { experiment: { ...EXPERIMENTS[0], ...(body || {}), id: "exp_new", active: false } };
  if (path === "/api/platform/sales/playbooks/experiments") return experimentsPayload();
  if (path.startsWith("/api/platform/sales/playbooks/experiments/")) {
    const id = path.split("/").pop();
    const e = EXPERIMENTS.find((x) => x.id === id) || EXPERIMENTS[0];
    if (method === "DELETE") return { ok: true, deleted: id };
    return { experiment: { ...e, ...(body || {}) } };
  }
  if (path === "/api/platform/sales/playbooks" && method === "POST") return { playbook: { ...PLAYBOOK_ROWS[0], ...(body || {}), id: "pb_new", active: false, version: "1" } };
  if (path === "/api/platform/sales/playbooks") return playbooksPayload();
  if (path.startsWith("/api/platform/sales/playbooks/")) {
    const key = path.split("/").pop();
    const pb = PLAYBOOK_ROWS.find((x) => x.key === key) || PLAYBOOK_ROWS[0];
    if (method === "DELETE") return { ok: true, deleted: key };
    return { playbook: { ...pb, ...(body || {}) }, bumped: Boolean(body?.stages) };
  }

  // ── Suppressions ────────────────────────────────────────────────────────
  if (path === "/api/platform/suppressions" && method === "POST") {
    if (typeof body?.text === "string") return { added: 4, updated: 1, unreadable: ["ligne 3: 'appeler jamais' — ni courriel, ni téléphone, ni domaine"], failed: [] };
    return { ...SUPPRESSIONS[0], id: "sup_new", kind: body?.kind || "email", value: String(body?.value || "").trim().toLowerCase(), rawValue: body?.value || "", source: body?.source || "manual", reason: body?.reason || null };
  }
  if (path === "/api/platform/suppressions" && method === "PATCH") return { ok: true, kind: body?.kind, value: body?.value, removedAt: new Date(NOW).toISOString() };
  if (path === "/api/platform/suppressions") return suppressionsPayload(url);

  return undefined;
}

