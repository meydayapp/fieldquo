// Fixture routes for the grow screens. See routes.js for the entry shape.
//
// Marketing, the Marketing Designer, Funnels, the phone receptionist, the
// crew SMS inbox, the social inbox, Refer a friend, Help and Account &
// Billing — each answered the way its real route under app/api answers it
// (same wrapper objects, same field names), with the cabinet shop's own
// people, client and job so a name on the crew inbox is a name on the job.
//
// The social inbox threads are a port of docs/screens/app-messages/harness/
// fixtures.js — the same shape that harness proved renders — with Érable's
// channels and people in place of Northside Painting's, and scored by the
// shipped scoring module rather than by hand so the temperature chips are
// the product's own answer.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, day, iso, TODAY } from "./company.js";
import { scoreConversation, storableScore } from "@/lib/messaging/conversationScore";
import { serviceWindowNotice } from "@/lib/messaging/serviceWindow";
import { responseStamps } from "@/lib/messaging/waiting";
import { readStatus } from "@/lib/messaging/outcomes";
import { SEAT_LADDER, defaultAnnualPrice } from "@/lib/pricing/ladder";

const [MARC, JULIE, SAM, , LEO, ANA] = PEOPLE;

// A thumbnail that needs no network: the capture runs from file:// and a
// hotlinked photo that fails to load photographs as a broken-image glyph.
const swatch = (a, b) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><rect x="18" y="52" width="124" height="56" rx="4" fill="rgba(255,255,255,0.18)"/><rect x="18" y="52" width="60" height="56" rx="4" fill="rgba(0,0,0,0.12)"/></svg>`,
  );
const PHOTO_OAK = swatch("#b8864f", "#7a4f22");
const PHOTO_SHAKER = swatch("#e9e4d8", "#b9b2a3");
const PHOTO_SITE = swatch("#8b9aa6", "#4b5a66");

// ── Marketing ──────────────────────────────────────────────────────────────
// app/api/marketing/campaigns GET: a bare array with the stop summary the hub
// cards read. The pamphlet one is the route the crew walks; the paid-ads one
// is the container the Designer's artwork hangs off.
export const CAMPAIGNS = [
  {
    id: "mc_flyers",
    name: "Fall flyer drop — Sainte-Rose",
    type: "pamphlet",
    status: "active",
    assignedTo: { id: SAM.userId, name: SAM.name },
    budget: null,
    externalUrl: null,
    stopCount: 40,
    visitedCount: 26,
    spokeCount: 9,
    template: null,
    sentAt: null,
    recipientCount: null,
    createdAt: iso(day(-12, 9)),
  },
  {
    id: "mc_reels",
    name: "Instagram — white oak island reels",
    type: "meta_ads",
    status: "draft",
    assignedTo: { id: JULIE.userId, name: JULIE.name },
    budget: 600,
    externalUrl: "https://business.facebook.com/adsmanager",
    stopCount: 0,
    visitedCount: 0,
    spokeCount: 0,
    template: null,
    sentAt: null,
    recipientCount: null,
    createdAt: iso(day(-4, 14)),
  },
];

// app/api/settings/document-templates GET: every template, bare array; the
// marketing page keeps only marketing_email / custom_email for its picker.
const DOCUMENT_TEMPLATES = [
  { id: "tpl_quote", type: "quote_email", name: "Quote", subject: null, sections: [], theme: null, createdAt: iso(day(-300)) },
  { id: "tpl_invoice", type: "invoice_email", name: "Invoice", subject: null, sections: [], theme: null, createdAt: iso(day(-300)) },
  { id: "tpl_seasonal", type: "marketing_email", name: "Seasonal offer — kitchens", subject: "A fall refresh for your kitchen", sections: [], theme: null, createdAt: iso(day(-60)) },
  { id: "tpl_followup", type: "custom_email", name: "Past-client check-in", subject: "How are the cabinets holding up?", sections: [], theme: null, createdAt: iso(day(-45)) },
];

// app/api/marketing/designer/designs GET: { designs } — the list row shape
// from toListRow(): every saved layout's ratioKey (never its canvas JSON) and
// the approval state computed server-side.
const DESIGNS = [
  {
    id: "md_flyer",
    name: "Fall flyer — front",
    campaignId: "mc_flyers",
    createdAt: iso(day(-11, 10)),
    updatedAt: iso(day(-9, 16, 30)),
    caption: "Shaker doors, white oak islands — built in Laval, installed in two days.",
    hashtags: ["#cabinets", "#laval", "#kitchenreno"],
    approvedAt: iso(day(-9, 17)),
    sourceJobId: null,
    layouts: [
      { ratioKey: "facebook_feed", width: 1200, height: 630, updatedAt: iso(day(-9, 16, 30)) },
      { ratioKey: "instagram_post", width: 1080, height: 1080, updatedAt: iso(day(-9, 16, 10)) },
    ],
    approval: "approved",
  },
  {
    id: "md_island",
    name: "White oak island — reel cover",
    campaignId: "mc_reels",
    createdAt: iso(day(-4, 14, 20)),
    updatedAt: iso(day(-1, 11, 45)),
    caption: "Rift-sawn white oak, waterfall end. Dubois kitchen, Laval.",
    hashtags: ["#whiteoak", "#kitchenisland"],
    approvedAt: null,
    sourceJobId: JOB.id,
    layouts: [
      { ratioKey: "instagram_post", width: 1080, height: 1080, updatedAt: iso(day(-1, 11, 45)) },
      { ratioKey: "instagram_story", width: 1080, height: 1920, updatedAt: iso(day(-1, 11, 40)) },
      { ratioKey: "tiktok", width: 1080, height: 1920, updatedAt: iso(day(-1, 11, 38)) },
    ],
    approval: "not_approved",
  },
];

// ── Funnels ────────────────────────────────────────────────────────────────
// app/api/funnels GET: bare array of { id, name, slug, status, channel,
// updatedAt, _count.responses }.
const FUNNELS = [
  { id: "fn_kitchen", name: "Kitchen quote — landing page", slug: "kitchen-quote", status: "published", channel: "web", updatedAt: iso(day(-3, 15)), _count: { responses: 14 } },
  { id: "fn_island", name: "Instagram — island reel offer", slug: "island-reel", status: "draft", channel: "instagram", updatedAt: iso(day(-1, 10)), _count: { responses: 0 } },
];

// ── Receptionist ───────────────────────────────────────────────────────────
// app/api/voice/calls GET. The number is provisioned and answering; the
// calls are last night's and this morning's, the flagged one on top.
const call = (over) => ({
  direction: "inbound",
  from: null,
  at: null,
  durationSec: 0,
  costCents: 0,
  summary: null,
  disposition: null,
  recordingHref: null,
  needsReview: false,
  leadId: null,
  bookingId: null,
  booking: null,
  hasTranscript: true,
  quoteDraftedAt: null,
  quoteDraftSkipped: null,
  quote: null,
  archivedAt: null,
  archived: false,
  recoveredAt: null,
  leadRecovered: false,
  ...over,
});
const CALLS = [
  call({
    id: "vc_leak",
    from: "+1 450 555 0199",
    at: iso(day(0, 8, 12)),
    durationSec: 134,
    costCents: 27,
    summary: "Chantal Mercier — the under-sink cabinet is leaking onto the new base cabinets we installed in June. Asked for someone today. Address and mobile taken.",
    disposition: "urgent",
    recordingHref: "/api/voice/calls/vc_leak/recording",
    needsReview: true,
    leadId: "lead_mercier",
  }),
  call({
    id: "vc_pantry",
    from: "+1 514 555 0173",
    at: iso(day(-1, 16, 40)),
    durationSec: 251,
    costCents: 50,
    summary: "Nathalie Lavoie wants an estimate for a walk-in pantry and a coffee bar in Vimont. Booked an in-home estimate Thursday at 10:00 and sent the confirmation by text.",
    disposition: "booked",
    recordingHref: "/api/voice/calls/vc_pantry/recording",
    leadId: "lead_lavoie",
    bookingId: "bk_lavoie",
    booking: { at: iso(day(3, 10)), status: "confirmed", onCalendar: true, mode: "visit" },
  }),
  call({
    id: "vc_fortin",
    from: "+1 450 555 0128",
    at: iso(day(0, 7, 55)),
    durationSec: 62,
    costCents: 12,
    summary: "Message for Marc: Pierre Fortin asking whether the Dubois installation is still on for Tuesday morning. Wants a call back on this number.",
    disposition: "message",
    recordingHref: "/api/voice/calls/vc_fortin/recording",
    quoteDraftSkipped: "nothing_quotable",
  }),
  call({
    id: "vc_confirm",
    direction: "outbound",
    from: CLIENT.phone,
    at: iso(day(-1, 14, 5)),
    durationSec: 48,
    costCents: 10,
    summary: `Called ${CLIENT.name} to confirm Tuesday's installation start at 8:00. She confirmed and asked that the crew park in the driveway.`,
    disposition: "confirmed",
    recordingHref: "/api/voice/calls/vc_confirm/recording",
  }),
  call({
    id: "vc_reface",
    from: "+1 438 555 0166",
    at: iso(day(-4, 11, 20)),
    durationSec: 312,
    costCents: 62,
    summary: "Éric Gagné asked for a price on refacing 22 doors and 8 drawer fronts in Chomedey. Took the address and the door style; the scope was drafted into a quote.",
    disposition: "quoted",
    recordingHref: "/api/voice/calls/vc_reface/recording",
    leadId: "lead_gagne",
    quoteDraftedAt: iso(day(-4, 11, 30)),
    quote: { id: "q_1041", number: "Q-1041", needsReview: false },
    archived: true,
  }),
  call({
    id: "vc_missed",
    from: "+1 450 555 0154",
    at: iso(day(-2, 19, 48)),
    durationSec: 6,
    costCents: 2,
    summary: null,
    disposition: "missed",
    hasTranscript: false,
    archivedAt: iso(day(-1, 8)),
    archived: true,
  }),
];

// ── Crew inbox ─────────────────────────────────────────────────────────────
// app/api/crew/line GET — the ready state: a texting number of their own,
// Twilio says SMS and MMS, credit in hand, Marc's mobile on file for the
// test text. Only `number`, `credit` and the Test / Turn off actions render
// (lib/crew/panelBlocks.js), which is the panel a working line shows.
const CREW_LINE = {
  line: { e164: "+1 450 555 0190", source: "purchased", connectedAt: iso(day(-75, 10)), expiresAt: null },
  capability: { ready: true, reason: "ready", messageKey: "app.crewSetup.ready.ready", message: "Your crew can text this number." },
  deployment: { available: true },
  provider: { sms: true, mms: true },
  owned: [],
  test: { to: MARC.phone, crewName: MARC.name },
  spend: { balanceCents: 1840, canReply: true, canReceive: true, low: false, smsCents: 2, mmsCents: 5, smsSegmentChars: 160, overdraftCents: -500 },
};

// app/api/crew/messages GET: { messages } — the exceptions on top (a photo
// nobody has filed), then the ones already on their job.
const CREW_MESSAGES = [
  {
    id: "cm_leo_base",
    from: LEO.phone,
    crew: LEO.name,
    known: true,
    body: "Base run in and levelled. Island crate is on the truck for tomorrow — which job do I file these to?",
    photoCount: 2,
    photos: [PHOTO_SHAKER, PHOTO_SITE],
    needsYou: true,
    superseded: false,
    filedTo: null,
    jobId: null,
    point: { lat: CLIENT.latitude || 45.5854, lng: CLIENT.longitude || -73.7269 },
    candidates: [
      { jobId: JOB.id, name: CLIENT.name },
      { jobId: "j_315", name: "Marc-André Lemieux" },
    ],
    at: iso(day(0, 8, 41)),
  },
  {
    id: "cm_ana_uppers",
    from: ANA.phone,
    crew: ANA.name,
    known: true,
    body: "Uppers hung, doors on. Corner filler needs a touch-up before the client sees it — see photo.",
    photoCount: 1,
    photos: [PHOTO_OAK],
    needsYou: false,
    superseded: false,
    filedTo: CLIENT.name,
    jobId: JOB.id,
    point: null,
    candidates: [],
    at: iso(day(-1, 15, 20)),
  },
  {
    id: "cm_leo_pickup",
    from: LEO.phone,
    crew: LEO.name,
    known: true,
    body: "Hinges and slides picked up at Richelieu. Invoice is in the van folder.",
    photoCount: 0,
    photos: [],
    needsYou: false,
    superseded: false,
    filedTo: CLIENT.name,
    jobId: JOB.id,
    point: null,
    candidates: [],
    at: iso(day(-1, 8, 5)),
  },
];

// ── Social inbox (/app/messages) ───────────────────────────────────────────
// Ported from docs/screens/app-messages/harness/fixtures.js. Minutes-ago are
// against the fixture clock, not the machine's.
const NOW = TODAY.getTime();
const at = (minAgo) => new Date(NOW - minAgo * 60000);
const NOTE = { bg: "#fff4d6", fg: "#3a2a00", border: "#e0b84a" };

let seq = 0;
const msg = (direction, body, minAgo, extra = {}) => ({
  id: `m${++seq}`,
  direction,
  private: direction === "note",
  activity: null,
  body,
  attachments: null,
  sentAt: at(minAgo),
  deliveredAt: direction === "out" ? at(minAgo - 0.5) : null,
  readAt: direction === "out" && !extra.failedReason ? at(minAgo - 1) : null,
  failedReason: null,
  sentByUserId: null,
  ...extra,
});
const activity = (data, minAgo) => msg("activity", "", minAgo, { activity: data });
const noteRow = (body, minAgo) => msg("note", body, minAgo);

function stamps(messages) {
  let thread = { firstInboundAt: null, firstReplyAt: null, waitingSince: null };
  for (const m of [...messages].sort((a, b) => a.sentAt - b.sentAt)) {
    thread = { ...thread, ...responseStamps({ thread, message: m }) };
  }
  return thread;
}

const CHANNEL_NAME = {
  facebook: COMPANY.name,
  instagram: "@erabledesign",
  whatsapp: COMPANY.phone,
};

function thread(id, platform, name, messages, extra = {}) {
  const spoken = messages.filter((m) => m.direction === "in" || m.direction === "out");
  const last = [...spoken].sort((a, b) => b.sentAt - a.sentAt)[0] || null;
  const inbound = messages.filter((m) => m.direction === "in").sort((a, b) => b.sentAt - a.sentAt);
  const scored = scoreConversation({ messages, now: new Date(NOW) });
  const stored = storableScore(scored, { at: new Date(NOW) });
  return {
    id,
    channelId: `ch_${platform}`,
    channelName: CHANNEL_NAME[platform],
    platform,
    participantName: name,
    participantExternalId: `psid_${id}`,
    threadNumber: extra.threadNumber ?? null,
    lastMessageAt: last?.sentAt || null,
    lastInboundAt: inbound[0]?.sentAt || null,
    unread: extra.unread ?? 0,
    status: extra.status || "open",
    statusChangedAt: null,
    snoozedUntil: extra.snoozedUntil || null,
    assignedToId: extra.assignedToId || null,
    outcome: extra.outcome || null,
    outcomeSetAt: extra.outcome ? at(60) : null,
    clientId: extra.clientId || null,
    leadId: extra.leadId || null,
    jobId: extra.jobId || null,
    quoteId: extra.quoteId || null,
    client: extra.clientId ? { id: extra.clientId, name } : null,
    createdAt: messages[0]?.sentAt || at(1000),
    temperature: stored.temperature,
    score: stored.score,
    canEditClients: true,
    companyLocation: platform === "whatsapp" ? { label: `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.city}` } : null,
    serviceWindow: platform === "whatsapp" ? serviceWindowNotice({ platform, lastInboundAt: inbound[0]?.sentAt || null, now: new Date(NOW) }) : null,
    templates: platform === "whatsapp" ? [{ id: "tpl1", name: "quote_follow_up", language: "fr", body: "Bonjour {{1}}, nous faisons suite à la soumission envoyée pour {{2}}. Toujours intéressé?", variableCount: 2 }] : [],
    messages: [...messages].sort((a, b) => a.sentAt - b.sentAt),
    ...stamps(messages),
  };
}

const THREADS = [
  thread("t_fb_lavoie", "facebook", "Nathalie Lavoie", [
    msg("in", "Hi — do you build walk-in pantries? We're in Vimont.", 3 * 24 * 60 + 40),
    msg("out", "We do! Happy to come by and take a look. Are mornings or afternoons better this week?", 3 * 24 * 60 + 29),
    msg("in", "Mornings. Thursday?", 3 * 24 * 60 + 10),
    msg("out", "Thursday 10am works. I'll send a confirmation.", 3 * 24 * 60 + 5),
    noteRow("She mentioned the neighbour's kitchen — ask who did it, the island looked like ours.", 2 * 24 * 60),
    activity({ type: "assigned", to: SAM.name, by: MARC.name }, 23 * 60),
    msg("in", "Can the pantry doors match a shaker kitchen? And a coffee bar on the same wall?", 55),
    msg("in", "When's the earliest you could start?", 54),
  ], { unread: 2, threadNumber: 41, leadId: "lead_lavoie", assignedToId: SAM.userId }),
  thread("t_ig_marco", "instagram", "Marco Bélanger", [
    msg("in", "Saw your reel of the white oak island 🔥 what does something like that run?", 26 * 60),
    msg("out", "Thanks! Depends on the wood and the top — most islands that size land in the same range as the one in the reel. Want me to swing by?", 25 * 60),
    msg("in", "Yeah. I'm in Chomedey.", 3 * 60 + 12),
    msg("in", "Also — could you do the bathroom vanity at the same time?", 3 * 60 + 10),
    msg("in", "Here's the vanity", 3 * 60 + 9, { attachments: [{ index: 0, type: "image", state: "ready", url: PHOTO_OAK, filename: null, bytes: 240000 }] }),
  ], { unread: 3, threadNumber: 42, leadId: "lead_belanger" }),
  thread("t_wa_dubois", "whatsapp", CLIENT.name, [
    msg("in", "Bonjour, c'est Sophie Dubois. Les armoires arrivent bien mardi?", 5 * 24 * 60),
    msg("out", "Bonjour Sophie — oui, l'équipe arrive mardi à 8 h. Deux jours d'installation.", 5 * 24 * 60 - 20),
    msg("in", "", 5 * 24 * 60 - 60, { attachments: [{ index: 0, type: "image", state: "ready", url: PHOTO_SHAKER, filename: "IMG_2231.jpg", bytes: 1800000 }] }),
    activity({ type: "linked", kind: "quote", by: MARC.name }, 4 * 24 * 60 + 30),
    msg("out", `Le dépôt de la soumission ${QUOTE.number} est bien reçu, merci. À mardi!`, 4 * 24 * 60),
  ], { threadNumber: 43, clientId: CLIENT.id, quoteId: QUOTE.id, jobId: JOB.id }),
];

const summary = (t) => {
  const spoken = t.messages.filter((m) => m.direction === "in" || m.direction === "out");
  const last = spoken[spoken.length - 1] || null;
  return {
    id: t.id, channelId: t.channelId, channelName: t.channelName, platform: t.platform,
    participantName: t.participantName, threadNumber: t.threadNumber, lastMessageAt: t.lastMessageAt,
    unread: t.unread, status: readStatus(t.status), snoozedUntil: t.snoozedUntil, assignedToId: t.assignedToId,
    waitingSince: t.waitingSince, outcome: t.outcome, temperature: t.temperature, score: t.score,
    preview: last?.body || (last?.attachments?.length ? "📷" : ""), lastDirection: last?.direction || null,
    lastFailed: Boolean(last?.failedReason), serviceWindow: t.serviceWindow,
  };
};

const CONNECTION = {
  connected: true,
  mock: false,
  reason: null,
  channels: [
    { id: "ch_facebook", platform: "facebook", name: CHANNEL_NAME.facebook, status: "connected" },
    { id: "ch_instagram", platform: "instagram", name: CHANNEL_NAME.instagram, status: "connected" },
    { id: "ch_whatsapp", platform: "whatsapp", name: CHANNEL_NAME.whatsapp, status: "connected" },
  ],
  readiness: { app: true, crypto: true, approved: true, whatsapp: true },
};
const PAGE_IMPORT = {
  available: true,
  reason: null,
  granted: { facebook: true, instagram: true },
  platforms: ["facebook", "instagram"],
  importedAt: iso(day(0, 6)),
};

// ── Refer a friend ─────────────────────────────────────────────────────────
// app/api/settings/referral GET. One referral has paid (the rewarded month is
// granted), one signed up and hasn't yet; two invites, one of them redeemed.
const REFERRAL = {
  referralCode: "ERABLE-MT",
  referralUrl: "https://app.fieldquo.com/refer/ERABLE-MT",
  refereeBonusMonths: 1,
  currency: COMPANY.currency,
  referred: [
    { id: "c_lachance", name: "Menuiserie Lachance", onboardingStatus: "complete", createdAt: iso(day(-48)), rewarded: true },
    { id: "c_boisvert", name: "Cuisines Boisvert", onboardingStatus: "complete", createdAt: iso(day(-6)), rewarded: false },
  ],
  creditEarnedCents: 0,
  rewardedCount: 1,
  invites: [
    { id: "ri_rivenord", email: "info@armoiresrivenord.ca", phone: null, channel: "email", status: "sent", createdAt: iso(day(-9, 11)) },
    { id: "ri_boisvert", email: null, phone: "+1 450 555 0177", channel: "sms", status: "redeemed", createdAt: iso(day(-8, 16)) },
  ],
};

// ── Account & Billing ──────────────────────────────────────────────────────
// app/api/settings/plans GET: { plans, currency } — the ladder in the
// company's own currency only, priced at the ladder's default annual deal.
export const PLANS = SEAT_LADDER.map((rung) => ({
  id: `plan_${rung.tierKey}`,
  name: rung.label,
  priceMonthly: rung.price,
  priceAnnual: defaultAnnualPrice(rung.price),
  seats: rung.seats,
  crewSeats: rung.crewSeats,
  tierKey: rung.tierKey,
  currency: COMPANY.currency,
  sortOrder: rung.sortOrder,
  stripePriceId: `price_${rung.tierKey}_cad_m`,
  stripePriceIdAnnual: `price_${rung.tierKey}_cad_y`,
  maxUsers: null,
  maxQuotesPerMonth: null,
  aiCopilotEnabled: true,
  aiMonthlyTokenCap: null,
  features: null,
  isPublic: true,
  createdAt: iso(day(-400)),
}));
const SHOP = PLANS.find((p) => p.tierKey === "shop");
const SUBSCRIPTION = {
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: iso(day(16, 0)), // 2026-09-30
  billingInterval: "month",
  pendingPlanId: null,
  pendingBillingInterval: null,
  pendingEffectiveAt: null,
  showTrialBadge: false,
  plan: { id: SHOP.id, name: SHOP.name, priceMonthly: SHOP.priceMonthly, maxUsers: null, seats: SHOP.seats, crewSeats: SHOP.crewSeats, priceAnnual: SHOP.priceAnnual },
};

export const ROUTES_GROW = [
  // Marketing hub + Designer
  { path: "/api/marketing/campaigns", method: "GET", reply: () => CAMPAIGNS },
  { path: "/api/settings/document-templates", method: "GET", reply: () => DOCUMENT_TEMPLATES },
  {
    path: "/api/marketing/designer/designs",
    method: "GET",
    reply: ({ search }) => {
      const campaignId = search.get("campaignId");
      return { designs: campaignId ? DESIGNS.filter((d) => d.campaignId === campaignId) : DESIGNS };
    },
  },
  {
    path: "/api/marketing/designer/job-post",
    method: "GET",
    reply: () => ({ jobs: [{ id: JOB.id, title: JOB.title, beforeAfter: true, preview: [PHOTO_SITE, PHOTO_OAK] }] }),
  },

  // Funnels
  { path: "/api/funnels", method: "GET", reply: () => FUNNELS },

  // Receptionist
  {
    path: "/api/voice/calls",
    method: "GET",
    reply: () => ({
      pending: CALLS.filter((c) => c.needsReview).length,
      setup: { hasNumber: true, answering: true },
      canRecover: true,
      aiAvailable: true,
      calls: CALLS,
    }),
  },

  // Crew inbox
  { path: "/api/crew/line", method: "GET", reply: () => CREW_LINE },
  { path: "/api/crew/messages", method: "GET", reply: () => ({ messages: CREW_MESSAGES }) },

  // Social inbox
  {
    path: "/api/messaging/threads",
    method: "GET",
    reply: ({ search }) => {
      const q = (search.get("q") || "").toLowerCase();
      const platform = search.get("platform");
      let rows = THREADS.map(summary);
      if (q) rows = rows.filter((t) => (t.participantName || "").toLowerCase().includes(q) || (t.preview || "").toLowerCase().includes(q));
      if (platform) rows = rows.filter((t) => t.platform === platform);
      return { connection: CONNECTION, note: NOTE, threads: rows, pageImport: PAGE_IMPORT };
    },
  },
  {
    path: /^\/api\/messaging\/threads\/([^/]+)$/,
    method: "GET",
    reply: ({ params }) => {
      const t = THREADS.find((x) => x.id === decodeURIComponent(params[1]));
      return t ? { connection: CONNECTION, thread: t } : new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    },
  },
  {
    path: /^\/api\/messaging\/threads\/([^/]+)$/,
    method: "PATCH",
    reply: ({ params }) => ({ thread: THREADS.find((x) => x.id === decodeURIComponent(params[1])) || null }),
  },
  {
    path: /^\/api\/messaging\/threads\/([^/]+)\/temperature$/,
    method: "GET",
    reply: ({ params }) => {
      const t = THREADS.find((x) => x.id === decodeURIComponent(params[1]));
      return { connection: CONNECTION, score: t ? scoreConversation({ messages: t.messages, now: new Date(NOW) }) : null, available: false, reasonKey: "app.messages.temperature.aiUnavailable" };
    },
  },
  { path: "/api/leads/assignees", method: "GET", reply: () => PEOPLE.map((p) => ({ id: p.userId, name: p.name })) },

  // Refer a friend
  { path: "/api/settings/referral", method: "GET", reply: () => REFERRAL },

  // Account & Billing
  { path: "/api/settings/plans", method: "GET", reply: () => ({ plans: PLANS, currency: COMPANY.currency }) },
  { path: "/api/settings/subscription", method: "GET", reply: () => SUBSCRIPTION },
];
