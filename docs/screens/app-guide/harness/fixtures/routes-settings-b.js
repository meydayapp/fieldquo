// Fixture routes for the settings-b screens. See routes.js for the entry shape.
//
// The second half of Settings: the documents and messages a company sends, the
// integrations it has connected (Stripe, Meta, email domain), the money-adjacent
// screens (AI credit, payroll) and the growth surfaces (website, instant quotes,
// lead form, bio link, the phone receptionist, the AI employee, reviews).
//
// Every screen is photographed in its CONFIGURED state — a rep demonstrates a
// company whose Stripe is live, whose domain is verified and whose receptionist
// has a Laval number — because that is what a prospect is buying. Where a
// route's shape is built by a library the browser can import (instant quotes,
// the bio-link candidate list), the fixture runs that library over fixture rows
// rather than restating its output by hand, so the picture cannot drift from
// what the real route would send.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso, TODAY } from "./company.js";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { instantRateFields } from "@/lib/estimate/instantRateFields";
import {
  applyDerivedSeed,
  deriveInstantSeed,
  seedDrift,
  seedInputsFor,
} from "@/lib/estimate/instantSeed";
import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";
import {
  categoryKeysForInstantTrade,
  categoryLabel,
  catalogueMismatches,
} from "@/lib/trades/catalog";
import { normaliseFinancing } from "@/lib/estimate/financing";
import { TUNING_SETTINGS, TUNING_FIELDS } from "@/lib/voice/agentTuning";
import { QUOTE_CALL_SCOPE_VALUES } from "@/lib/voice/quoteCallScope";
import { SITE_STYLES, SITE_STYLE_KEYS } from "@/lib/site/siteStyles";
import { COMPOSITION_PRESETS, COMPOSITION_KEYS } from "@/lib/site/composition";
import { SOURCE_KINDS, READABLE_EXTENSIONS } from "@/lib/aiEmployee/sources";

const SLUG = COMPANY.bookingSlug || COMPANY.slug;
// Restated from lib/aiEmployee/roles.js, which imports node:crypto for the
// instructions fingerprint and so cannot be bundled for the browser.
const AI_EMPLOYEE_TONES = ["professional", "warm", "brief"];
const AI_EMPLOYEE_TOOLS = ["look_up_service_prices", "create_instant_quote", "book_callback", "hand_off_to_human"];

// ── Document templates (email + PDF) ─────────────────────────────────────────
//
// One list answers three screens: Email templates (the *_email types), PDF
// templates (quote_pdf / invoice_pdf) and Follow-ups (the picker of what to
// send). `isDefault` is what the screens print as "Active".
const tpl = (id, type, name, isDefault, sections, daysAgo, subject = null) => ({
  id,
  companyId: COMPANY.id,
  type,
  name,
  subject,
  sections,
  theme: null,
  isDefault,
  createdAt: iso(day(-daysAgo - 30)),
  updatedAt: iso(day(-daysAgo)),
});
const EMAIL_SECTIONS = [
  { id: "s1", type: "greeting", content: "Bonjour {{clientFirstName}}," },
  { id: "s2", type: "paragraph", content: "Voici votre soumission pour {{quoteTitle}}." },
  { id: "s3", type: "button", content: "Voir la soumission" },
  { id: "s4", type: "signature", content: "{{companyName}}" },
];
const PDF_SECTIONS = ["header", "client", "items", "totals", "terms", "signature", "footer"].map(
  (type, i) => ({ id: `p${i}`, type, enabled: true }),
);
export const DOCUMENT_TEMPLATES = [
  tpl("dt_quote_std", "quote_email", "Quote — standard", true, EMAIL_SECTIONS, 12, "Votre soumission {{quoteNumber}} — {{companyName}}"),
  tpl("dt_quote_premium", "quote_email", "Quote — premium kitchens", false, EMAIL_SECTIONS, 4, "Votre projet de cuisine — {{companyName}}"),
  tpl("dt_instructions", "instructions_email", "Install-day instructions", true, EMAIL_SECTIONS, 25, "Avant notre arrivée — {{companyName}}"),
  tpl("dt_receipt", "receipt_email", "Deposit receipt", true, EMAIL_SECTIONS, 20, "Reçu — {{invoiceNumber}}"),
  tpl("dt_followup_3d", "follow_up_email", "Quote follow-up — 3 days", true, EMAIL_SECTIONS, 9, "Des questions sur votre soumission ?"),
  tpl("dt_payment_reminder", "follow_up_email", "Payment reminder", false, EMAIL_SECTIONS, 9, "Rappel — facture {{invoiceNumber}}"),
  tpl("dt_quote_pdf", "quote_pdf", "Érable — quote layout", true, PDF_SECTIONS, 15),
  tpl("dt_invoice_pdf", "invoice_pdf", "Érable — invoice layout", true, PDF_SECTIONS, 15),
  // The two the Marketing screen picks from (routes-grow.js lists the same
  // ids), so whichever file answers first, both screens see one catalogue.
  tpl("tpl_seasonal", "marketing_email", "Seasonal offer — kitchens", true, EMAIL_SECTIONS, 60, "A fall refresh for your kitchen"),
  tpl("tpl_followup", "custom_email", "Past-client check-in", true, EMAIL_SECTIONS, 45, "How are the cabinets holding up?"),
];

// ── Products & services, for the translations screen ─────────────────────────
const PRODUCTS = [
  { id: "p_upper", type: "service", name: "Upper cabinets — shaker, painted", description: "Soft-close hinges, painted in the colour of your choice.", fr: { name: "Armoires du haut — shaker, peintes", description: "Charnières à fermeture douce, peintes dans la couleur de votre choix.", reviewed: true, reviewedAt: iso(day(-10)) } },
  { id: "p_base", type: "service", name: "Base cabinets — shaker, painted", description: "Dovetail drawers on full-extension slides.", fr: { name: "Armoires du bas — shaker, peintes", description: "Tiroirs à queue d'aronde sur coulisses à extension complète.", reviewed: true, reviewedAt: iso(day(-10)) } },
  { id: "p_island", type: "service", name: "Island — white oak", description: "Rift-sawn white oak, waterfall end optional.", fr: { name: "Îlot — chêne blanc", description: "Chêne blanc sur quartier, extrémité en cascade en option.", reviewed: false, reviewedAt: null } },
  { id: "p_install", type: "service", name: "Installation", description: "Two installers, levelled and scribed to your walls.", fr: null },
  { id: "p_hardware", type: "product", name: "Cabinet hardware — brushed brass", description: "", fr: { name: "Quincaillerie — laiton brossé", description: "", reviewed: true, reviewedAt: iso(day(-30)) } },
];

// ── Checklists ────────────────────────────────────────────────────────────────
// Ids as routes-settings-a.js's Services screen spells them (`sc_<key>`), so a
// checklist filed under Cabinet Refacing here is the same row that screen edits.
const CATEGORY_CAB = { id: "sc_cabinet_refacing", label: "Cabinet Refacing" };
const CATEGORY_REFINISH = { id: "sc_cabinet_refinishing", label: "Cabinet Refinishing" };
const CATEGORY_COUNTERTOP = { id: "sc_countertop", label: "Countertop Installation" };
const CHECKLISTS = [
  {
    id: "ck_install",
    companyId: COMPANY.id,
    name: "Install day",
    phase: "during",
    categoryId: CATEGORY_CAB.id,
    category: CATEGORY_CAB,
    items: [
      { label: "Protect floors and countertops before unloading", done: false, phase: "during" },
      { label: "Confirm layout against the signed drawing", done: false, phase: "during" },
      { label: "Level and scribe base run before uppers", done: false, phase: "during" },
      { label: "Adjust doors and drawer fronts — 3 mm reveals", done: false, phase: "during" },
      { label: "Photograph every run before the client walkthrough", done: false, phase: "during" },
    ],
    createdAt: iso(day(-120)),
    updatedAt: iso(day(-30)),
  },
  {
    id: "ck_walkthrough",
    companyId: COMPANY.id,
    name: "Final walkthrough",
    phase: "post",
    categoryId: CATEGORY_CAB.id,
    category: CATEGORY_CAB,
    items: [
      { label: "Client opens every door and drawer", done: false, phase: "post" },
      { label: "Touch-up paint left with the client, labelled", done: false, phase: "post" },
      { label: "Care sheet handed over and explained", done: false, phase: "post" },
      { label: "Client signs the completion form", done: false, phase: "post" },
    ],
    createdAt: iso(day(-120)),
    updatedAt: iso(day(-30)),
  },
];
const SYSTEM_CHECKLISTS = [
  {
    id: "sys_refinish_pre",
    companyId: null,
    isSystem: true,
    name: "Cabinet refinishing — before you start",
    phase: "pre",
    categoryId: CATEGORY_REFINISH.id,
    category: CATEGORY_REFINISH,
    items: [
      { label: "Label every door and drawer front with its position", phase: "pre" },
      { label: "Degrease the boxes and face frames too", phase: "pre" },
      { label: "Confirm the sheen with the client before spraying", phase: "pre" },
    ],
    key: "cabinet_refinishing:pre",
  },
];
const SERVICE_CATEGORIES = [
  { id: CATEGORY_REFINISH.id, key: "cabinet_refinishing", label: CATEGORY_REFINISH.label, icon: "Paintbrush", isSystem: true, enabled: true, unit: null },
  { id: CATEGORY_CAB.id, key: "cabinet_refacing", label: CATEGORY_CAB.label, icon: "Layers", isSystem: true, enabled: true, unit: null },
  // Off, as on the Services screen: they sell cabinets, not stone.
  { id: CATEGORY_COUNTERTOP.id, key: "countertop", label: CATEGORY_COUNTERTOP.label, icon: "Square", isSystem: true, enabled: false, unit: null },
];

// ── Job photo tags ────────────────────────────────────────────────────────────
const PHOTO_TAGS = [
  ["Before", "#2563eb"],
  ["After", "#16a34a"],
  ["Damage", "#dc2626"],
  ["Template", "#7c3aed"],
  ["Hardware", "#b45309"],
].map(([name, color], i) => ({
  id: `tag_${name.toLowerCase()}`,
  name,
  color,
  sortOrder: i,
  active: true,
  createdAt: iso(day(-200 + i)),
}));

// ── Instant quotes, computed the way the route computes them ─────────────────
//
// The company sells the two cabinet categories with no rate overrides (their
// price book is the default one) and has saved-and-enabled rows for both, so
// the public link quotes exactly what the Services screen says they sell.
const INSTANT_LABELS = {
  roofing: "Roofing",
  epoxy: "Epoxy & Concrete Coatings",
  parging: "Parging",
  lawn_mowing: "Lawn Mowing",
  cabinet_refinishing: "Cabinet Refinishing",
  cabinet_refacing: "Cabinet Refacing",
  countertop: "Countertops",
  flooring: "Flooring",
  painting: "Painting",
  stair: "Stairs & Railings",
  junk_removal: "Junk Removal",
};
const tradeLabel = (trade) => INSTANT_LABELS[trade] || trade;
function instantQuotePayload() {
  const enabledRows = SERVICE_CATEGORIES.filter((c) => c.enabled).map((c) => ({ key: c.key, rates: null }));
  const enabledKeys = enabledRows.map((r) => r.key);
  const enabledSet = new Set(enabledKeys);
  const saved = [];
  for (const trade of ["cabinet_refinishing", "cabinet_refacing"]) {
    const seed = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
    const derived = deriveInstantSeed(trade, seedInputsFor(trade, enabledRows));
    // "the usual pick" (lib/estimate/visibility.js): the homeowner leaves
    // their details, then sees the range.
    const config = { ...(derived && seed ? applyDerivedSeed(trade, seed, derived) : seed), estimateVisibility: "after_submit" };
    saved.push({ id: `iq_${trade}`, companyId: COMPANY.id, trade, enabled: true, config, updatedAt: iso(day(-14)) });
  }
  const byTrade = new Map(saved.map((r) => [r.trade, r]));
  const trades = Object.entries(INSTANT_ESTIMATE_TRADES).map(([trade, spec]) => {
    const row = byTrade.get(trade);
    const seed = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
    const seedInputs = seedInputsFor(trade, enabledRows);
    const derived = deriveInstantSeed(trade, seedInputs);
    const config = row?.config ?? (derived && seed ? applyDerivedSeed(trade, seed, derived) : seed) ?? null;
    const categoryKeys = categoryKeysForInstantTrade(trade);
    return {
      trade,
      label: tradeLabel(trade),
      measure: spec.measure,
      hasMaterialRates: Array.isArray(seed?.materials),
      rateFields: instantRateFields(trade, seed),
      enabled: row?.enabled ?? false,
      offeredAsService: categoryKeys.some((k) => enabledSet.has(k)),
      serviceLabels: categoryKeys.map(categoryLabel),
      config,
      isDefaults: !row,
      derivedSeed: derived,
      derivedFromServices: !row && Boolean(derived),
      seedDrift: row ? seedDrift(trade, row.config, derived) : [],
      ...(trade === "painting" && { scopesOffered: seedInputs.offered }),
      readiness: instantQuoteReadiness(trade, row?.config ?? null),
    };
  });
  const mismatches = catalogueMismatches({
    enabledCategoryKeys: enabledKeys,
    instantRows: saved.map((r) => ({ trade: r.trade, enabled: r.enabled })),
    wiredTrades: Object.keys(INSTANT_ESTIMATE_TRADES),
  });
  return {
    trades,
    canEdit: true,
    mismatches: {
      instantWithoutService: mismatches.instantWithoutService.map((m) => ({ ...m, tradeLabel: tradeLabel(m.trade) })),
      serviceWithoutInstant: mismatches.serviceWithoutInstant.map((m) => ({ ...m, tradeLabel: tradeLabel(m.trade) })),
    },
    liveTradeCount: trades.filter((t) => t.enabled && t.readiness.ok && !(t.trade === "painting" && t.scopesOffered.length === 0)).length,
    companySlug: SLUG,
    financing: normaliseFinancing({ enabled: false }),
  };
}

// ── Funnels (lead form + bio link) ───────────────────────────────────────────
// The same two rows routes-grow.js answers /api/funnels with, so the bio-link
// candidate below names a funnel that exists whichever file answers first.
const FUNNELS = [
  { id: "fn_kitchen", name: "Kitchen quote — landing page", slug: "kitchen-quote", status: "published", channel: "web", updatedAt: iso(day(-3, 15)), _count: { responses: 14 } },
  { id: "fn_island", name: "Instagram — island reel offer", slug: "island-reel", status: "draft", channel: "instagram", updatedAt: iso(day(-1, 10)), _count: { responses: 0 } },
];

// ── Bio link ─────────────────────────────────────────────────────────────────
const LINK_CANDIDATES = [
  { key: "instant", kind: "internal", url: `/instant-quote/${SLUG}`, label: "Instant estimate", group: "price", defaultOn: true },
  { key: "quote", kind: "internal", url: `/quote/${SLUG}`, label: "Get a free quote", group: "price", defaultOn: true },
  { key: "book", kind: "internal", url: `/book/${SLUG}`, label: "Book a visit", group: "book", defaultOn: true },
  { key: "funnel:kitchen-quote", kind: "internal", url: `/f/${SLUG}/kitchen-quote`, label: "Kitchen quote — landing page", group: "price", defaultOn: true },
  { key: "site", kind: "external", url: COMPANY.website, label: "Our website", group: "more", defaultOn: true },
  { key: "phone", kind: "contact", url: "tel:+14505550180", label: "Call us", group: "contact", defaultOn: true },
  { key: "email", kind: "contact", url: "mailto:hello@erabledesign.ca", label: "Email us", group: "contact", defaultOn: true },
  { key: "review", kind: "external", url: "https://g.page/r/erable-design-cabinetry/review", label: "Leave a review", group: "more", defaultOn: true },
];
const LINK_PAGE = {
  slug: SLUG,
  published: true,
  headline: "Custom kitchens, built in Laval",
  bio: "Shaker doors, white oak islands, full refits. Serving Laval and the North Shore since 2014.",
  companyName: COMPANY.name,
  // The four the owner switched on, then the rest as candidates the switches
  // can still flip — the same list resolveLinks() returns, disabled rows
  // included.
  links: [
    { key: "social:instagram", kind: "social", platform: "instagram", url: "https://instagram.com/erabledesign", label: "Instagram", enabled: true },
    { key: "social:facebook", kind: "social", platform: "facebook", url: "https://facebook.com/erabledesign", label: "Facebook", enabled: true },
    { key: "quote", kind: "internal", url: `/quote/${SLUG}`, label: "Get a free quote", group: "price", enabled: true },
    { key: "book", kind: "internal", url: `/book/${SLUG}`, label: "Book a visit", group: "book", enabled: true },
    { key: "site", kind: "external", url: COMPANY.website, label: "Our website", group: "more", enabled: true },
    { key: "phone", kind: "contact", url: "tel:+14505550180", label: "Call us", group: "contact", enabled: true },
    { key: "instant", kind: "internal", url: `/instant-quote/${SLUG}`, label: "Instant estimate", group: "price", enabled: false },
    { key: "funnel:kitchen-quote", kind: "internal", url: `/f/${SLUG}/kitchen-quote`, label: "Kitchen quote — landing page", group: "price", enabled: false },
    { key: "email", kind: "contact", url: "mailto:hello@erabledesign.ca", label: "Email us", group: "contact", enabled: false },
    { key: "review", kind: "external", url: "https://g.page/r/erable-design-cabinetry/review", label: "Leave a review", group: "more", enabled: false },
  ],
  unavailable: [],
  brandColor: COMPANY.brandColor,
  logoUrl: COMPANY.logoUrl,
  candidates: LINK_CANDIDATES,
  company: {
    name: COMPANY.name,
    logoUrl: COMPANY.logoUrl,
    brandColor: COMPANY.brandColor,
    website: COMPANY.website,
    city: COMPANY.city,
    province: COMPANY.province,
    defaultLanguage: "fr",
  },
};

// ── The phone receptionist ────────────────────────────────────────────────────
const VOICE_E164 = "+14505550190";
const VOICE_DISPLAY = "(450) 555-0190";
const VOICE_CENTS = 4260; // US$42.60 on the balance
const VOICE_RATE = 35; // ¢ per minute on a local number
const VOICE_ENTRIES = [
  { cents: -70, kind: "call", note: `Inbound call · 2 min · ${CLIENT.name}`, at: iso(day(-1, 16, 40)) },
  { cents: -5, kind: "crew_mms", note: "Crew photo received · Léo Bouchard", at: iso(day(-1, 14, 5)) },
  { cents: -105, kind: "call", note: "Inbound call · 3 min · (514) 555-0162", at: iso(day(-2, 10, 12)) },
  { cents: -400, kind: "number_rent", note: `Monthly rental · ${VOICE_DISPLAY}`, at: iso(day(-6, 0, 5)) },
  { cents: 5000, kind: "topup", note: "Top-up · Visa •••• 4242", at: iso(day(-6, 0, 0)) },
  { cents: -140, kind: "call", note: "Inbound call · 4 min · (450) 555-0133", at: iso(day(-8, 11, 30)) },
];
const VOICE_KNOWLEDGE = [
  "We don't do commercial work — residential kitchens, bathrooms and built-ins only.",
  "Showroom visits are by appointment, weekdays 9 to 4, at 1420 boul. Curé-Labelle in Laval.",
  "Lead time on a full kitchen is about 8 weeks from the signed quote; refinishing is 2 to 3 weeks.",
].join("\n");
const VOICE_SETTINGS = {
  configured: true,
  companyName: COMPANY.name,
  demo: { isDemo: false, fieldquoNumber: null, fieldquoNumberDisplay: null },
  agent: {
    enabled: true,
    name: "Érable Design",
    greeting: "Bonjour, Érable Design Cabinetry — comment puis-je vous aider ?",
    instructions: VOICE_KNOWLEDGE,
    transferTo: COMPANY.phone,
    voice: "cartesia-emma",
    provisioned: true,
    greetingNamesOther: false,
  },
  hasAnsweredCall: true,
  tuning: {
    values: { interruptions: "balanced", background: "normal", pace: "unhurried", manner: "warm" },
    settings: TUNING_SETTINGS,
    fields: TUNING_FIELDS,
  },
  number: {
    e164: VOICE_E164,
    display: VOICE_DISPLAY,
    forwardsToDisplay: null,
    publicNumber: VOICE_E164,
    source: "purchased",
    status: "active",
    numberType: "local",
    simulated: false,
    monthlyCents: 400,
    portExpectedAt: null,
    rent: {
      monthlyCents: 400,
      dueAt: iso(day(24)),
      graceUntil: null,
      pastDue: false,
      coversNext: true,
      minutes: Math.floor(VOICE_CENTS / VOICE_RATE),
    },
    forwarding: null,
  },
  credit: {
    cents: VOICE_CENTS,
    minutes: Math.floor(VOICE_CENTS / VOICE_RATE),
    low: false,
    centsPerMinute: VOICE_RATE,
    crew: { smsCents: 2, mmsCents: 5, smsSegmentChars: 160 },
    entries: VOICE_ENTRIES,
  },
  autoTopup: {
    config: {
      enabled: true,
      hasCard: true,
      consentCurrent: true,
      thresholdCents: 1000,
      amountCents: 3000,
      cardBrand: "visa",
      cardLast4: "4242",
      acceptedAt: iso(day(-40)),
      acceptedByName: PEOPLE[0].name,
      disabledReason: null,
      lastFailureMessage: null,
      maxPerDay: 3,
    },
    thresholds: [
      { cents: 500, label: "$5" },
      { cents: 1000, label: "$10" },
      { cents: 2000, label: "$20" },
    ],
    maxPerDay: 3,
    language: "fr",
  },
  pricing: {
    topups: [
      { cents: 1000, label: "$10" },
      { cents: 3000, label: "$30", popular: true },
      { cents: 5000, label: "$50" },
      { cents: 10000, label: "$100" },
    ],
    numberTypes: [
      {
        key: "local",
        label: "Local number",
        hint: "A number in your own area code. What most customers expect to see.",
        monthlyCents: 400,
        perMinuteSurchargeCents: 0,
        perMinuteCents: 35,
        afford: { allowed: true, kind: "number_setup", numberType: "local", needCents: 400, balanceCents: VOICE_CENTS, shortfallCents: 0, reason: "ok" },
      },
      {
        key: "toll_free",
        label: "Toll-free (800/833/844)",
        hint: "Reads as a bigger operation, and free for your customer to call. Costs more to run.",
        monthlyCents: 900,
        perMinuteSurchargeCents: 5,
        perMinuteCents: 40,
        afford: { allowed: true, kind: "number_setup", numberType: "toll_free", needCents: 900, balanceCents: VOICE_CENTS, shortfallCents: 0, reason: "ok" },
      },
    ],
    freeTrialMinutes: 30,
    freeTrialCents: 30 * VOICE_RATE,
    freeTrialAvailable: false,
    graceDays: 7,
  },
  sources: [
    { key: "forwarded", label: "Keep my number, forward missed calls", recommended: true, setupMinutes: 2, blurb: "You keep the number that's on your van. Calls you don't pick up ring through to the receptionist instead of voicemail.", caveat: "This rents a second line for the receptionist to answer on — that's the monthly charge, and it's the number your forwarding code points at." },
    { key: "purchased", label: "Get a new number", recommended: false, setupMinutes: 1, blurb: "A separate line for the receptionist. Good for ads, or a second trade you want to track on its own.", caveat: "It's a new number, so it won't catch calls to the one you already advertise." },
    { key: "ported", label: "Move my number over", recommended: false, setupMinutes: 60 * 24 * 21, blurb: "Your existing number transfers to us permanently. Nothing to forward, and one number to manage.", caveat: "Two to four weeks, and the timing is your old carrier's to control." },
  ],
  numberChoice: { canChoose: true, areaCode: "450", from: "phone", locality: COMPANY.city, region: COMPANY.province },
  readiness: { ready: true, reason: "ok", message: null },
  outbound: {
    enabled: true,
    queued: 1,
    scope: "instant",
    options: QUOTE_CALL_SCOPE_VALUES,
    report: {
      considered: 4,
      queued: 1,
      called: 2,
      refusals: [{ quoteNumber: QUOTE.number, clientName: CLIENT.name, reason: "already_accepted" }],
      moreRefusals: 0,
      headline: { reason: "already_accepted", count: 1 },
    },
    windowDays: 30,
  },
  intake: {
    trades: ["Cabinet Refinishing", "Cabinet Refacing"],
    photosTo: COMPANY.email,
  },
  crewInbox: { enabled: true, textTo: VOICE_E164, textToDiffersFromPublic: false },
};
const VOICE_DIAGNOSIS = {
  verdict: "ok",
  side: null,
  repairable: false,
  billing: true,
  boundAgent: "agent_erable",
  wantAgent: "agent_erable",
  statusStale: false,
  source: "purchased",
  publicNumber: VOICE_E164,
  existsAtProvider: true,
  agentEnabled: true,
  hasCredit: true,
  balanceCents: VOICE_CENTS,
  e164: VOICE_E164,
  status: "active",
};
const VOICES = {
  voices: [
    { id: "cartesia-emma", name: "Emma", provider: "cartesia", gender: "female", accent: "Canadian French", age: "young adult", previewUrl: null, cheaper: true, automaticFailover: false },
    { id: "cartesia-andrew", name: "Andrew", provider: "cartesia", gender: "male", accent: "American", age: "adult", previewUrl: null, cheaper: true, automaticFailover: false },
    { id: "cartesia-alejandro", name: "Alejandro", provider: "cartesia", gender: "male", accent: "Mexican", age: "adult", previewUrl: null, cheaper: true, automaticFailover: false },
  ],
  defaultVoiceId: "cartesia-emma",
  reason: null,
};

// ── The AI employee (inbox) ──────────────────────────────────────────────────
const AI_EMPLOYEE = {
  employee: {
    id: "aie_erable",
    role: "receptionist",
    name: "Camille",
    enabled: true,
    autoReplyEnabled: false,
    tone: "warm",
    greeting: "Bonjour ! Camille ici, de chez Érable Design. Je peux répondre à vos questions ou organiser un rappel.",
    instructions: "Residential kitchens, bathrooms and built-ins only. Lead time on a full kitchen is about 8 weeks. Never quote a price — offer the instant estimate link or a callback from Samuel.",
    escalationRules: "Hand off anything about a warranty claim, a complaint, or a job already in progress.",
    handoffPhrase: "Je transmets ça à l'équipe — quelqu'un vous revient aujourd'hui.",
    businessHoursOnly: true,
    maxRepliesPerThread: 3,
    updatedAt: iso(day(-3)),
  },
  roles: [
    { key: "closer", labelKey: "app.aiEmployee.role.closer", blurbKey: "app.aiEmployee.role.closer.blurb", allowed: [...AI_EMPLOYEE_TOOLS], forbidden: [] },
    { key: "receptionist", labelKey: "app.aiEmployee.role.receptionist", blurbKey: "app.aiEmployee.role.receptionist.blurb", allowed: ["book_callback", "hand_off_to_human"], forbidden: ["look_up_service_prices", "create_instant_quote"] },
    { key: "troubleshooter", labelKey: "app.aiEmployee.role.troubleshooter", blurbKey: "app.aiEmployee.role.troubleshooter.blurb", allowed: ["book_callback", "hand_off_to_human"], forbidden: ["look_up_service_prices", "create_instant_quote"] },
    { key: "custom", labelKey: "app.aiEmployee.role.custom", blurbKey: "app.aiEmployee.role.custom.blurb", allowed: ["book_callback", "hand_off_to_human"], forbidden: ["look_up_service_prices", "create_instant_quote"] },
  ],
  tones: AI_EMPLOYEE_TONES,
  sourceKinds: SOURCE_KINDS,
  readableExtensions: READABLE_EXTENSIONS,
  ai: { configured: true, allowed: true, reason: null, remaining: 412, cap: 600, nearLimit: false },
  businessHoursOpenNow: true,
  hasBusinessHours: true,
  channel: { connected: true, reason: null, mock: false },
};
const AI_SOURCES = {
  sources: [
    { id: "src_policy", kind: "policy", title: "Warranty and care policy", originalFilename: "garantie-entretien.md", bytes: 6120, tokenCount: 1480, status: "ready", failureReason: null, createdAt: iso(day(-18)) },
    { id: "src_faq", kind: "troubleshooting", title: "Door and drawer adjustment FAQ", originalFilename: null, bytes: 3890, tokenCount: 960, status: "ready", failureReason: null, createdAt: iso(day(-11)) },
  ],
};
const AI_SUGGESTIONS = {
  suggestions: [
    {
      id: "sg_1",
      threadId: "th_martin",
      thread: { id: "th_martin", participantName: "Martin Lavoie", status: "open", platform: "instagram", lastMessageAt: iso(day(0, 8, 42)) },
      text: "Bonjour Martin ! Oui, on fait le refinissage d'armoires existantes — c'est environ 2 à 3 semaines. Je peux demander à Samuel de vous rappeler cet après-midi pour regarder vos photos ?",
      tools: ["book_callback"],
      costCents: 3,
      handedOff: false,
      handoffReason: null,
      suppressedReason: null,
      createdAt: iso(day(0, 8, 43)),
      stale: false,
    },
    {
      id: "sg_2",
      threadId: "th_nguyen",
      thread: { id: "th_nguyen", participantName: "Thi Nguyen", status: "open", platform: "facebook", lastMessageAt: iso(day(-1, 19, 10)) },
      text: "Bonjour Thi, merci pour votre message ! Pour un îlot en chêne blanc, le mieux est de passer par notre estimation en ligne — ça prend deux minutes et vous avez une fourchette tout de suite. Voulez-vous le lien ?",
      tools: [],
      costCents: 2,
      handedOff: false,
      handoffReason: null,
      suppressedReason: null,
      createdAt: iso(day(-1, 19, 11)),
      stale: false,
    },
  ],
  stopped: [],
};

// ── Meta: ads, page publishing, WhatsApp, lead forms ─────────────────────────
const META_ADS_STATUS = {
  appConfigured: true,
  missing: [],
  encryptionConfigured: true,
  fullyConfigured: true,
  connection: {
    adAccountId: "act_1029384756",
    adAccountName: "Érable Design — Ads",
    adAccountCurrency: "CAD",
    status: "connected",
    lastSyncedAt: iso(day(0, 6, 0)),
    lastSyncError: null,
    connectedAt: iso(day(-45)),
    tokenExpiresAt: iso(day(15)),
  },
};
const META_LEAD_FORMS = {
  leadsScopeEnabled: true,
  connected: true,
  connectionStatus: "connected",
  forms: [
    { id: "mlf_1", pageId: "1122334455", pageName: "Érable Design Cabinetry", formId: "9081726354", name: "Kitchen refit — free consultation", active: true, lastLeadAt: iso(day(-1, 17, 20)), leadCount: 11 },
    { id: "mlf_2", pageId: "1122334455", pageName: "Érable Design Cabinetry", formId: "9081726355", name: "Cabinet refinishing — spring", active: false, lastLeadAt: iso(day(-40)), leadCount: 4 },
  ],
  campaigns: [
    { campaignId: "cmp_1", campaignName: "Laval kitchens — Sept", leadCount: 9 },
    { campaignId: "cmp_2", campaignName: "Refinishing — North Shore", leadCount: 6 },
  ],
  lastLeadAt: iso(day(-1, 17, 20)),
};
const SOCIAL_STATUS = {
  connectEnabled: true,
  appConfigured: true,
  fullyConfigured: true,
  connection: {
    pageId: "1122334455",
    pageName: "Érable Design Cabinetry",
    instagramUserId: "17841400000001",
    instagramUsername: "erabledesign",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "pages_messaging", "instagram_basic", "instagram_content_publish", "instagram_manage_messages"],
    connectedAt: iso(day(-45)),
    tokenExpiresAt: iso(day(15)),
    webhookSubscribedAt: iso(day(-45)),
    webhookSubscribeErrorKind: null,
    connectedByName: PEOPLE[0].name,
    missingScopes: [],
    webhookMissingPermissions: [],
    missingInboxChannels: [],
    pageImport: {
      available: true,
      granted: { facebook: true, instagram: true },
      platforms: ["facebook", "instagram"],
      pending: [],
      importedAt: iso(day(-44)),
    },
  },
};
const WHATSAPP_STATUS = {
  connectEnabled: true,
  featureState: "on",
  appConfigured: true,
  fullyConfigured: true,
  signupConfigured: true,
  readOnly: false,
  channels: [
    {
      id: "ch_wa",
      platform: "whatsapp",
      name: "Érable Design Cabinetry",
      externalId: "104455667788",
      status: "connected",
      connectedAt: iso(day(-30)),
      disconnectedAt: null,
      lastError: null,
      wabaId: "2233445566",
      displayPhoneNumber: "+1 450-555-0180",
      verifiedName: "Érable Design Cabinetry",
      connectedVia: "embedded_signup",
      importedAt: null,
    },
  ],
  templates: [
    { id: "wt_1", name: "quote_ready", language: "fr_CA", category: "UTILITY", status: "APPROVED", body: "Bonjour {{1}}, votre soumission {{2}} est prête : {{3}}", variableCount: 3, syncedAt: iso(day(-2)) },
    { id: "wt_2", name: "visit_reminder", language: "fr_CA", category: "UTILITY", status: "APPROVED", body: "Rappel : notre visite est prévue {{1}} à {{2}}.", variableCount: 2, syncedAt: iso(day(-2)) },
    { id: "wt_3", name: "review_request", language: "fr_CA", category: "MARKETING", status: "PENDING", body: "Merci {{1}} ! Un mot sur Google nous aiderait beaucoup : {{2}}", variableCount: 2, syncedAt: iso(day(-2)) },
  ],
};

// ── AI credit ─────────────────────────────────────────────────────────────────
const AI_CREDIT = {
  vendorConfigured: true,
  voice: {
    cents: VOICE_CENTS,
    low: false,
    centsPerMinute: VOICE_RATE,
    entries: VOICE_ENTRIES,
    topupHref: "/app/settings/voice#credit",
  },
  ai: {
    cents: 1836,
    entries: [
      { at: iso(day(-1, 15, 20)), kind: "image_vision", note: `Deep photo read · ${QUOTE.number}`, cents: -25 },
      { at: iso(day(-2, 9, 5)), kind: "image_generation", note: "Website hero image", cents: -12 },
      { at: iso(day(-2, 9, 4)), kind: "image_generation", note: "Website hero image", cents: -12 },
      { at: iso(day(-7, 11, 0)), kind: "image_vision", note: "Deep photo read · Q-1039", cents: -25 },
      { at: iso(day(-9, 10, 30)), kind: "image_vision", note: "Deep photo read · Q-1037", cents: -25 },
      { at: iso(day(-12, 0, 0)), kind: "topup", note: "Top-up · Visa •••• 4242", cents: 3000 },
    ],
    priceCents: { image_generation: 12, image_vision: 25 },
    topups: [
      { cents: 1000, label: "$10" },
      { cents: 3000, label: "$30", popular: true },
      { cents: 5000, label: "$50" },
      { cents: 10000, label: "$100" },
    ],
    bundles: [
      { key: "starter", priceCents: 3000, credits: 4000 },
      { key: "busy", priceCents: 5000, credits: 7000 },
      { key: "agency", priceCents: 8000, credits: 11500 },
    ],
    bundle: null,
    bundleRolloverNotice:
      "Credit rolls over. Whatever you don't use this month is still there next month — nothing expires, and cancelling never takes back credit you've already been granted.",
    // A CAD-billed company cannot add a USD plan — the real route says so, and
    // the page prints the reason under a disabled button.
    bundleAvailable: {
      ok: false,
      reason:
        "AI credit plans are billed in US dollars — the AI is bought in US dollars, and exchange rates move — and your FieldQuo plan bills in CAD. Stripe can't run both on one account, so plans aren't available on a non-USD account. One-time top-ups are.",
    },
  },
};

// ── Payroll ───────────────────────────────────────────────────────────────────
const comp = (id, name, extra) => ({
  id,
  companyId: COMPANY.id,
  name,
  kind: "deduction",
  calculation: "percent",
  amount: null,
  percent: null,
  slabs: null,
  statutory: true,
  region: "CA",
  active: true,
  appliesToAll: true,
  createdAt: iso(day(-90)),
  updatedAt: iso(day(-90)),
  ...extra,
});
const PAYROLL_COMPONENTS = {
  components: [
    comp("sc_fed", "Federal income tax", {
      calculation: "slabs",
      slabs: [
        { upTo: 55867, percent: 15 },
        { upTo: 111733, percent: 20.5 },
        { upTo: 173205, percent: 26 },
        { upTo: 246752, percent: 29 },
        { upTo: null, percent: 33 },
      ],
    }),
    comp("sc_qc", "Québec income tax", {
      calculation: "slabs",
      slabs: [
        { upTo: 51780, percent: 14 },
        { upTo: 103545, percent: 19 },
        { upTo: 126000, percent: 24 },
        { upTo: null, percent: 25.75 },
      ],
    }),
    comp("sc_qpp", "QPP", { percent: 6.4 }),
    comp("sc_ei", "EI (Québec rate)", { percent: 1.32 }),
    comp("sc_qpip", "QPIP", { percent: 0.494 }),
    comp("sc_tool", "Tool allowance", { kind: "earning", calculation: "fixed", amount: 40, statutory: false, region: null, appliesToAll: false }),
  ],
  templates: [
    { key: "CA", label: "Canada", sourceYear: 2024, note: "Federal income tax brackets and the employee share of CPP/EI for 2024. Provincial tax is NOT included — add your province's brackets as a separate component. Confirm every figure with your accountant.", count: 3 },
    { key: "US", label: "United States", sourceYear: 2024, note: "Federal income tax brackets for a single filer, plus the employee share of Social Security and Medicare (FICA), 2024. State tax is NOT included, and brackets differ by filing status. Confirm with your accountant.", count: 3 },
    { key: "UK", label: "United Kingdom", sourceYear: 2024, note: "PAYE income tax bands (2024/25, England/Wales/NI) with the personal allowance, plus employee National Insurance. Confirm with your accountant.", count: 2 },
  ],
};
// Bi-weekly, closing Sunday, paid the Thursday after. TODAY is Monday 14 Sept,
// so the fortnight that closed yesterday (31 Aug – 13 Sept) is paid Thursday
// the 17th and the current one runs 14–27 Sept, paid 1 Oct. PayCycleCard
// recomputes these from `cycle` itself; they are stated here so the payload
// agrees with what the card draws.
const PAY_CYCLE = {
  cycle: { frequency: "biweekly", periodEndDayOfWeek: 0, payDayOfWeek: 4, anchorDate: "2026-09-06" },
  configured: true,
  describe: "Every 2 weeks, periods close Sunday, paid the Thursday after.",
  reviewDays: 4,
  frequencies: [
    { key: "weekly", label: "Every week", alignsToWeeks: true },
    { key: "biweekly", label: "Every 2 weeks", alignsToWeeks: true },
    { key: "semimonthly", label: "Twice a month", alignsToWeeks: false },
    { key: "monthly", label: "Once a month", alignsToWeeks: false },
  ],
  current: { start: "2026-09-14", end: "2026-09-27", payDate: "2026-10-01", alignsToWeeks: true },
  previous: { start: "2026-08-31", end: "2026-09-13", payDate: "2026-09-17" },
  canEdit: true,
};

// ── Website ───────────────────────────────────────────────────────────────────
const SITE_BLOCKS = [
  { id: "b_hero", type: "hero", content: { heading: "Custom kitchens, built in Laval", subheading: "Shaker doors, white oak islands and full refits — designed, built and installed by one team.", cta: "Get a free quote" } },
  { id: "b_services", type: "services", content: {} },
  { id: "b_gallery", type: "gallery", content: { images: [] } },
  { id: "b_about", type: "about", content: { heading: "A small shop that finishes what it starts", body: "Marc started Érable Design in 2014 after twelve years building kitchens for other people. Today it is a team of six, and every kitchen still leaves the shop through his hands." } },
  { id: "b_testimonials", type: "testimonials", content: {} },
  { id: "b_hours", type: "hours", content: {} },
  { id: "b_cta", type: "cta", content: { heading: "Ready to talk about your kitchen?", body: "Send a few photos and we'll come back with a range within a day." } },
  { id: "b_contact", type: "contact", content: {} },
];
const WEBSITE = {
  gaps: [],
  photoPool: [],
  suggestedPairs: [],
  confirmedPairs: [],
  chat: [
    { role: "user", text: "Premium finish, but keep it warm — we're a small family shop." },
    { role: "assistant", text: "Done. I've written the site in a quiet, precise voice and kept the hero on the work itself. Your services, hours and contact details come straight from your company settings." },
  ],
  placeholderCount: 0,
  languages: ["fr", "en"],
  availableLanguages: ["en", "fr", "es"],
  translatedLanguages: ["en"],
  site: {
    id: "site_erable",
    companyId: COMPANY.id,
    subdomain: SLUG,
    published: true,
    publishedAt: iso(day(-60)),
    styleKey: "warm",
    composition: "showcase",
    blocks: SITE_BLOCKS,
    pages: null,
    languages: ["fr", "en"],
    translations: { en: {} },
    photoLibrary: [],
    interview: { style: "Premium finish, but keep it warm — we're a small family shop." },
    handEditedAt: null,
    updatedAt: iso(day(-8)),
  },
  suggestedSubdomain: SLUG,
  company: {
    id: COMPANY.id,
    name: COMPANY.name,
    slug: COMPANY.slug,
    logoUrl: COMPANY.logoUrl,
    brandColor: COMPANY.brandColor,
    phone: COMPANY.phone,
    email: COMPANY.email,
    address: COMPANY.address,
    city: COMPANY.city,
    province: COMPANY.province,
    bookingSlug: COMPANY.bookingSlug,
    businessHours: COMPANY.businessHours,
    timezone: COMPANY.timezone,
    weekStartsOn: COMPANY.weekStartsOn,
  },
  questions: [],
  stylePresets: [
    { label: "Straight-talking", text: "Plain and direct. No marketing language. Say what we do and what it costs us to do it well." },
    { label: "Established and reassuring", text: "Calm and experienced. Emphasise how long we've been doing this and that the job gets finished properly." },
    { label: "Local and personal", text: "Friendly and local. We know the area, people know us, and they can ring and speak to an actual person." },
    { label: "Premium finish", text: "Understated and precise. The work is high-end and the writing should be quiet rather than loud about it." },
  ],
  compositions: COMPOSITION_KEYS.map((key) => ({ key, label: COMPOSITION_PRESETS[key].label, sections: COMPOSITION_PRESETS[key].sections })),
  siteStyles: SITE_STYLE_KEYS.map((key) => ({ key, label: SITE_STYLES[key].label, hint: SITE_STYLES[key].hint })),
};

export const ROUTES_SETTINGS_B = [
  // Quote email — the covering email's optional sections.
  {
    path: "/api/settings/quote-email",
    reply: () => ({
      references: {
        include: true,
        max: 6,
        items: [
          { id: "r1", name: "Isabelle Fortin", phone: "(450) 555-0114", note: "Full kitchen, Sainte-Rose — 2025" },
          { id: "r2", name: "Karim Bensaïd", phone: "(514) 555-0177", note: "Refinishing + new island — 2026" },
          { id: "r3", name: "Nathalie Roy", phone: "(450) 555-0128", note: "Built-in wall unit — 2025" },
        ],
      },
      beforeAfter: {
        include: true,
        max: 4,
        items: [
          { id: "ba1", beforeUrl: "https://picsum.photos/seed/erable-before-1/640/420", afterUrl: "https://picsum.photos/seed/erable-after-1/640/420", caption: "Fortin kitchen — oak to painted shaker" },
          { id: "ba2", beforeUrl: "https://picsum.photos/seed/erable-before-2/640/420", afterUrl: "https://picsum.photos/seed/erable-after-2/640/420", caption: "Bensaïd island — white oak, waterfall end" },
        ],
      },
    }),
  },

  // Email templates, PDF templates and the follow-up picker all read this.
  { path: "/api/settings/document-templates", method: "GET", reply: () => DOCUMENT_TEMPLATES },

  // Translations — the company's own catalogue with the requested language's
  // column beside it, sorted by the page (missing first).
  {
    path: "/api/settings/translations",
    method: "GET",
    reply: ({ search }) => {
      const language = search.get("language") || "fr";
      const items = PRODUCTS.map((p) => {
        const entry = language === "fr" ? p.fr : null;
        return {
          id: p.id,
          type: p.type,
          source: { name: p.name, description: p.description || "" },
          translation: { name: entry?.name || "", description: entry?.description || "" },
          missing: !entry?.name || (Boolean(p.description) && !entry?.description),
          reviewed: Boolean(entry?.reviewed),
          reviewedAt: entry?.reviewedAt || null,
        };
      });
      return {
        language,
        sourceLanguage: "en",
        total: items.length,
        missing: items.filter((i) => i.missing).length,
        unreviewed: items.filter((i) => !i.reviewed && !i.missing).length,
        items,
        aiAvailable: true,
        canDraft: true,
      };
    },
  },

  // Checklists — the company's two, plus the starter library for its trades.
  {
    path: "/api/settings/checklists",
    method: "GET",
    reply: ({ search }) => (search.get("includeSystem") === "1" ? [...CHECKLISTS, ...SYSTEM_CHECKLISTS] : CHECKLISTS),
  },
  { path: "/api/settings/service-categories", method: "GET", reply: () => SERVICE_CATEGORIES },

  // Job photo tags — every starter already exists, so no suggestions.
  { path: "/api/settings/job-photo-tags", method: "GET", reply: () => ({ tags: PHOTO_TAGS, starterSuggestions: [] }) },

  // SMS templates — only the two types the product can actually send today.
  {
    path: "/api/settings/message-templates",
    method: "GET",
    reply: () => ({
      types: [
        {
          key: "on_my_way",
          label: "On my way",
          tokens: [
            { token: "company", hint: "your business name" },
            { token: "worker", hint: "the assigned crew member" },
            { token: "name", hint: "the client's first name" },
            { token: "eta", hint: "estimated arrival, if known" },
          ],
          custom: "Bonjour {name}, {worker} de {company} est en route — arrivée dans environ {eta}.",
          preview: "Bonjour Sam, Dave de Northside Painting est en route — arrivée dans environ 20 min.",
          defaultPreview: "Dave from Northside Painting is on the way — ETA 20 min.",
        },
        {
          key: "appointment_reminder",
          label: "Appointment reminder",
          tokens: [
            { token: "company", hint: "your business name" },
            { token: "when", hint: "the appointment time" },
            { token: "location", hint: "where the visit is" },
          ],
          custom: null,
          preview: "Reminder from Northside Painting: your appointment is Tue, Aug 12 at 2:00 PM at 123 Oak St. Reply to this message if you need to reschedule.",
          defaultPreview: "Reminder from Northside Painting: your appointment is Tue, Aug 12 at 2:00 PM at 123 Oak St. Reply to this message if you need to reschedule.",
        },
      ],
    }),
  },

  // Follow-up rules.
  {
    path: "/api/settings/follow-up-rules",
    method: "GET",
    reply: () => [
      { id: "fr_quote3", companyId: COMPANY.id, name: "Nudge unanswered quotes", triggerEvent: "quote_no_response", delayValue: 3, delayUnit: "days", templateId: "dt_followup_3d", template: { id: "dt_followup_3d", name: "Quote follow-up — 3 days", type: "follow_up_email" }, active: true, createdAt: iso(day(-80)), updatedAt: iso(day(-80)) },
      { id: "fr_inv7", companyId: COMPANY.id, name: "Overdue invoice reminder", triggerEvent: "invoice_overdue", delayValue: 7, delayUnit: "days", templateId: "dt_payment_reminder", template: { id: "dt_payment_reminder", name: "Payment reminder", type: "follow_up_email" }, active: true, createdAt: iso(day(-80)), updatedAt: iso(day(-80)) },
    ],
  },

  // Notifications.
  {
    path: "/api/settings/notification-rules",
    method: "GET",
    reply: () => [
      { id: "nr_large", companyId: COMPANY.id, type: "large_quote", threshold: 15000, active: true, createdAt: iso(day(-100)), updatedAt: iso(day(-100)) },
      { id: "nr_paid", companyId: COMPANY.id, type: "invoice_paid", threshold: null, active: true, createdAt: iso(day(-100)), updatedAt: iso(day(-100)) },
    ],
  },
  { path: "/api/settings/appointment-reminders", method: "GET", reply: () => ({ hours: 24 }) },
  // The browser-push card on the same screen (lib/notify/pushSubscriptionRoute.js).
  { path: "/api/notifications/push-subscription", method: "GET", reply: () => ({ configured: true, publicKey: "BHarnessPublicKeyNotARealVapidKey", live: 2 }) },

  // Email domain — verified, so quotes leave from quotes@erabledesign.ca.
  {
    path: "/api/settings/email-domain",
    method: "GET",
    reply: () => ({
      emailDomain: "erabledesign.ca",
      emailDomainId: "dom_erable",
      emailDomainStatus: "verified",
      emailFromLocal: "quotes",
      emailDomainRecords: [
        { record: "DKIM", type: "TXT", name: "resend._domainkey", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC…", status: "verified" },
        { record: "SPF", type: "TXT", name: "send", value: "v=spf1 include:amazonses.com ~all", status: "verified" },
        { record: "SPF", type: "MX", name: "send", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, status: "verified" },
      ],
      emailDomainCheckedAt: iso(day(0, 6, 0)),
      email: COMPANY.email,
      name: COMPANY.name,
    }),
  },

  // Payments — Stripe Connect live, payouts on.
  {
    path: "/api/stripe/connect/status",
    method: "GET",
    reply: () => ({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirements: [],
      eventuallyDue: 0,
      pendingVerification: false,
      disabledReason: null,
      currentDeadline: null,
      accountDetails: { accountId: COMPANY.stripeAccountId, email: PEOPLE[0].email },
    }),
  },

  // Meta — ads, lead forms, page publishing, WhatsApp.
  { path: "/api/meta-ads/status", method: "GET", reply: () => META_ADS_STATUS },
  { path: "/api/meta/leads/forms", method: "GET", reply: () => META_LEAD_FORMS },
  { path: "/api/settings/social/status", method: "GET", reply: () => SOCIAL_STATUS },
  { path: "/api/settings/whatsapp/status", method: "GET", reply: () => WHATSAPP_STATUS },

  // AI credit.
  { path: "/api/settings/ai/credit", method: "GET", reply: () => AI_CREDIT },

  // Payroll.
  { path: "/api/settings/payroll-components", method: "GET", reply: () => PAYROLL_COMPONENTS },
  { path: "/api/settings/pay-cycle", method: "GET", reply: () => PAY_CYCLE },

  // Website.
  { path: "/api/settings/website", method: "GET", reply: () => WEBSITE },

  // Instant quotes.
  { path: "/api/settings/instant-quote", method: "GET", reply: () => instantQuotePayload() },

  // Lead form (funnels) and bio link.
  { path: "/api/funnels", method: "GET", reply: () => FUNNELS },
  { path: "/api/settings/links", method: "GET", reply: () => LINK_PAGE },

  // The phone receptionist.
  { path: "/api/settings/voice", method: "GET", reply: () => VOICE_SETTINGS },
  { path: "/api/settings/voice/number/repair", method: "GET", reply: () => VOICE_DIAGNOSIS },
  { path: "/api/settings/voice/voices", method: "GET", reply: () => VOICES },
  // Only fetched when "Run the check" is pressed; shaped like
  // lib/voice/readiness.js so a press in a live demo renders a real chain.
  {
    path: "/api/settings/voice/readiness",
    method: "GET",
    reply: () => {
      const ok = (id, reason, detail = null) => ({ id, state: "ok", reasonKey: `app.setVoice.chain.${id}.${reason}`, reason, fixer: null, fix: null, detail, blockedBy: null });
      return {
        links: [
          ok("provider", "reachable"),
          ok("number", "ours", { e164: VOICE_E164 }),
          ok("agent", "present", { agentId: "agent_erable" }),
          ok("engine", "present"),
          ok("binding", "attached"),
          ok("switch", "on"),
          ok("webhook", "matches", { url: "https://app.fieldquo.com/api/voice/webhook" }),
          ok("prompt", "in_step"),
          ok("events", "landing"),
        ],
        overall: "ready",
        repairable: false,
        fixes: [],
      };
    },
  },

  // The AI employee.
  { path: "/api/ai-employee", method: "GET", reply: () => AI_EMPLOYEE },
  { path: "/api/ai-employee/sources", method: "GET", reply: () => AI_SOURCES },
  { path: "/api/ai-employee/suggestions", method: "GET", reply: () => AI_SUGGESTIONS },

  // Reviews — the ask, and the testimonials the company shows on its site.
  {
    path: "/api/settings/testimonials",
    method: "GET",
    reply: () => ({
      testimonials: [
        { id: "tm_1", authorName: "Isabelle Fortin", authorTitle: null, companyLabel: "Sainte-Rose, Laval", quote: "Marc and his team rebuilt our kitchen in eight weeks, exactly as drawn. The painted shaker doors are flawless and the install crew left the house cleaner than they found it.", approved: true, sortOrder: 0, source: "google", createdAt: iso(day(-60)) },
        { id: "tm_2", authorName: "Karim Bensaïd", authorTitle: null, companyLabel: "Vimont, Laval", quote: "The white oak island is the first thing everyone comments on. Quote was clear, price didn't move, and they showed up when they said they would.", approved: true, sortOrder: 1, source: "google", createdAt: iso(day(-35)) },
        { id: "tm_3", authorName: "Nathalie Roy", authorTitle: null, companyLabel: "Rosemère", quote: "Built-in wall unit for the living room — beautiful work, and Samuel's measurements were spot on.", approved: false, sortOrder: 2, source: "manual", createdAt: iso(day(-4)) },
      ],
      publishedCount: 2,
      embedSlug: SLUG,
    }),
  },
  {
    path: "/api/settings/reviews",
    method: "GET",
    reply: () => ({
      reviewUrl: "https://g.page/r/erable-design-cabinetry/review",
      reviewDelayHours: 24,
      reviewRequestsEnabled: true,
      waiting: 1,
      askedRecently: 3,
    }),
  },
];
