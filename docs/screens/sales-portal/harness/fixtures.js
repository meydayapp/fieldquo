// Fixture data for the sales-portal harness — the pages the queue console
// and the texts screen do NOT cover: Today, My leads, My companies,
// Calendar, Notes, Playbook, Support, Pay, Voicemail, Demo.
//
// The rep is the training manual's running example: Daniel, code
// danielboves, with Easy Roofers Inc. signed up through his link on
// 10 September 2026 at 17:06 UTC and Activated (CA$20) at 19:19 UTC the
// same day — see docs/sales/manual/content.en.js, chapter 8. Shapes follow
// the route each page calls; where a route derives a view from a pure
// helper, the derived shape is written out here rather than the helper
// imported, because the helpers sit next to lib/db and a browser bundle
// must not pull that in.
//
// Dates are fixed, not relative: the manual is dated, and a screenshot in
// it must agree with the prose beside it. Only the calendar's month cursor
// is the machine's clock (the page seeds it with new Date()), so the
// calendar events sit in September 2026 — the month the manual shipped.
const T = (s) => new Date(s).toISOString();

export const ME = {
  id: "r1",
  name: "Daniel Roy",
  email: "daniel@fieldquo.com",
  code: "danielboves",
  signupLink: "https://fieldquo.com/signup?sales=danielboves",
  signups: { today: 1, thisWeek: 2, total: 9 },
};
export const BADGES = { callsToday: 24, dayCap: 250, texts: 3, team: 1, voicemail: 2 };

// ── Today ─────────────────────────────────────────────────────────────────
// A reply is waiting (the top rung), 7 rows claimed of which 5 are callable
// and not yet worked, 62 free to claim across the trades.
const claimed = (id, businessName, city, province, opts = {}) => ({
  id, businessName, tradeKey: "electrical", city, province,
  contact: { callable: opts.callable ?? true, code: opts.callable === false ? "do_not_contact" : "ok", title: "" },
  claim: { state: opts.worked ? "mine_worked" : "mine", expiresAt: opts.expiresAt || T("2026-09-13T20:12:00Z"), text: "Claimed by you until 4:12 PM tomorrow." },
});
export const QUEUE = {
  rep: { id: ME.id, name: ME.name, email: ME.email },
  tradeKey: null,
  trades: [
    { key: "electrical", label: "Electrical", available: 27 },
    { key: "roofing", label: "Roofing", available: 19 },
    { key: "plumbing", label: "Plumbing", available: 16 },
  ],
  queue: { items: [
    claimed("p1", "South County Electric, LLC", "Norman", "OK"),
    claimed("p2", "Bright Current Electrical", "Tulsa", "OK"),
    claimed("p3", "Red Dirt Wiring Co.", "Edmond", "OK"),
    claimed("p4", "Sooner Sparks Electric", "Moore", "OK", { worked: true }),
    claimed("p5", "Lone Star Volt", "Plano", "TX", { expiresAt: T("2026-09-12T22:30:00Z") }),
    claimed("p6", "Hill Country Electric", "Austin", "TX", { callable: false }),
    claimed("p7", "Golden State Wiring", "Fresno", "CA"),
  ], empty: false, emptyReason: null, emptyText: null, windows: { repZone: "America/Toronto", language: "en", groups: [] } },
  current: null,
  claimHours: 48,
  batch: { max: 25, topUpBelow: 5, topUpIntervalMs: 60000, dailyCap: 250, takenToday: 11, remainingToday: 239, timeZone: "America/Toronto", result: null },
  serverNow: T("2026-09-12T14:00:00Z"),
};

// Outreach readiness from the leads/threads routes: nothing blocked, no
// warnings — the notice component renders nothing, which is the shipped
// state for a rep whose mailbox is set up.
export const OUTREACH = { canSend: true, blockers: [], warnings: [] };

// ── My leads ──────────────────────────────────────────────────────────────
export const LEADS = [
  { id: "l1", businessName: "Easy Roofers Inc.", contactName: "Marc Tremblay", email: "marc@easyroofers.ca", phone: "+1 514 555 0148", status: "signed", convertedCompanyId: "c1", _count: { threads: 2 }, threads: [] },
  { id: "l2", businessName: "Bright Current Electrical", contactName: "Dave Kessler", email: "dave@brightcurrent.com", phone: "+1 405 555 0177", status: "demoed", convertedCompanyId: null, _count: { threads: 1 }, threads: [] },
  { id: "l3", businessName: "Maple Ridge Painting", contactName: "Priya Natarajan", email: "priya@mapleridgepainting.ca", phone: "+1 905 555 0122", status: "signed", convertedCompanyId: "c2", _count: { threads: 3 }, threads: [] },
  { id: "l4", businessName: "Northline Plumbing", contactName: "Sam Okafor", email: "sam@northlineplumbing.com", phone: "+1 613 555 0190", status: "contacted", convertedCompanyId: null, _count: { threads: 1 }, threads: [] },
  { id: "l5", businessName: "Sooner Sparks Electric", contactName: "", email: "", phone: "+1 405 555 0133", status: "contacted", convertedCompanyId: null, _count: { threads: 0 }, threads: [] },
  { id: "l6", businessName: "Tahoe Electric Co.", contactName: "Lena Ruiz", email: "lena@tahoeelectric.com", phone: "", status: "new", convertedCompanyId: null, _count: { threads: 0 }, threads: [] },
  { id: "l7", businessName: "Cascade Volt Works", contactName: "", email: "hello@cascadevolt.com", phone: "", status: "new", convertedCompanyId: null, _count: { threads: 0 }, threads: [] },
  { id: "l8", businessName: "Hill Country Electric", contactName: "Ray Alvarez", email: "ray@hillcountryelectric.com", phone: "+1 512 555 0104", status: "lost", convertedCompanyId: null, _count: { threads: 1 }, threads: [] },
];
export const LEAD_COUNTS = { new: 2, contacted: 2, demoed: 1, signed: 2, lost: 1 };

// ── Conversations (only the count and the top-rung test reach Today) ──────
export const THREADS = [
  { id: "t1", subject: "Re: A quicker way to quote roofing jobs", leadId: "l2", lastMessageAt: T("2026-09-12T13:20:00Z"), messages: [{ direction: "in", sentAt: T("2026-09-12T13:20:00Z"), body: "Thursday afternoon works — can you show the invoice side too?" }], _count: { messages: 3 } },
  { id: "t2", subject: "Booking more painting jobs without the back-and-forth", leadId: "l3", lastMessageAt: T("2026-09-09T15:02:00Z"), messages: [{ direction: "out", sentAt: T("2026-09-09T15:02:00Z"), body: "Great — the link is fieldquo.com/signup?sales=danielboves." }], _count: { messages: 4 } },
  { id: "t3", subject: "Quotes and invoices from the van", leadId: "l4", lastMessageAt: T("2026-09-08T18:41:00Z"), messages: [{ direction: "out", sentAt: T("2026-09-08T18:41:00Z"), body: "Hi Sam — following up on our call this morning." }], _count: { messages: 1 } },
];

// ── My companies ──────────────────────────────────────────────────────────
export const COMPANIES = [
  {
    id: "c1", name: "Easy Roofers Inc.", signedUpAt: T("2026-09-10T17:06:00Z"), isDemo: false, chargesEnabled: true,
    subscriptionStatus: "trialing",
    milestones: [{ milestone: "activation", status: "earned", occurredAt: T("2026-09-10T19:19:00Z") }],
    checkIn: { state: "due", touchpoint: 1, draft: { toE164: "+15145550148", scheduledFor: T("2026-09-12T17:06:00Z") }, noNumber: false, lastSentAt: null },
  },
  {
    id: "c2", name: "Maple Ridge Painting", signedUpAt: T("2026-07-21T14:30:00Z"), isDemo: false, chargesEnabled: true,
    subscriptionStatus: "active",
    milestones: [
      { milestone: "activation", status: "earned", occurredAt: T("2026-07-21T16:02:00Z") },
      { milestone: "first_payment", status: "earned", occurredAt: T("2026-08-21T09:00:00Z") },
    ],
    checkIn: { state: "scheduled", touchpoint: "retention", draft: null, upcoming: { touchpoint: "retention", at: T("2026-09-19T14:00:00Z"), timed: false }, lastSentAt: T("2026-07-28T15:10:00Z") },
  },
  {
    id: "c3", name: "Northline Plumbing", signedUpAt: T("2026-09-02T11:15:00Z"), isDemo: false, chargesEnabled: false,
    subscriptionStatus: "trialing",
    milestones: [],
    checkIn: { state: "sent", touchpoint: 7, draft: null, upcoming: null, lastSentAt: T("2026-09-09T13:00:00Z") },
  },
  {
    id: "c4", name: "Demo 3", signedUpAt: T("2026-06-01T09:00:00Z"), isDemo: true, chargesEnabled: false,
    subscriptionStatus: null,
    milestones: [],
    checkIn: { state: "suppressed", code: "demo_company", draft: null, upcoming: null, lastSentAt: null },
  },
];

// ── Calendar (September 2026) ─────────────────────────────────────────────
const ev = (id, type, startAt, endAt, extra = {}) => ({ id, type, title: null, startAt: T(startAt), endAt: T(endAt), location: null, notes: null, status: "planned", leadId: null, businessName: null, contactName: null, phone: null, website: null, createdAt: T("2026-09-01T09:00:00Z"), updatedAt: T("2026-09-01T09:00:00Z"), ...extra });
export const EVENTS = [
  ev("e1", "callback", "2026-09-14T14:30:00", "2026-09-14T14:45:00", { leadId: "l4", businessName: "Northline Plumbing", contactName: "Sam Okafor", phone: "+1 613 555 0190" }),
  ev("e2", "demo", "2026-09-15T15:00:00", "2026-09-15T15:30:00", { leadId: "l2", businessName: "Bright Current Electrical", contactName: "Dave Kessler", phone: "+1 405 555 0177" }),
  ev("e3", "callback", "2026-09-17T10:00:00", "2026-09-17T10:15:00", { leadId: "l6", businessName: "Tahoe Electric Co.", contactName: "Lena Ruiz" }),
  ev("e4", "walkthrough", "2026-09-22T13:00:00", "2026-09-22T14:00:00", { leadId: "l1", businessName: "Easy Roofers Inc.", contactName: "Marc Tremblay" }),
  ev("e5", "appointment", "2026-09-24T11:00:00", "2026-09-24T12:00:00", { title: "Trade show — Ottawa Home & Reno", location: "EY Centre, Ottawa" }),
  ev("e6", "callback", "2026-09-08T09:30:00", "2026-09-08T09:45:00", { leadId: "l3", businessName: "Maple Ridge Painting", status: "done" }),
];

// ── Notes ─────────────────────────────────────────────────────────────────
export const NOTES = [
  { id: "n1", title: "Easy Roofers — before the walkthrough", body: "Marc wants the invoice side shown first: deposits, then the balance on completion.\nAsk whether the crew lead gets a seat.\nStripe is on; pricing and team invites still open on their dashboard.", bodyTruncated: false, leadId: "l1", threadId: null, prospectId: null, parentLabel: "Easy Roofers Inc.", archivedAt: null, updatedAt: T("2026-09-12T13:48:00Z"), createdAt: T("2026-09-11T20:10:00Z") },
  { id: "n2", title: "Bright Current — demo Tuesday", body: "Dave is the owner, Tulsa, two vans. Objection was \"my guys won't use an app\"; the booking link landed.", bodyTruncated: false, leadId: "l2", threadId: null, prospectId: null, parentLabel: "Bright Current Electrical", archivedAt: null, updatedAt: T("2026-09-11T16:22:00Z"), createdAt: T("2026-09-11T16:20:00Z") },
  { id: "n3", title: "", body: "Ask in #sales: who has the Quebec French script printed?", bodyTruncated: false, leadId: null, threadId: null, prospectId: null, parentLabel: null, archivedAt: null, updatedAt: T("2026-09-10T12:05:00Z"), createdAt: T("2026-09-10T12:05:00Z") },
];
export const NOTES_ARCHIVED_COUNT = 1;

// ── Support ───────────────────────────────────────────────────────────────
export const TICKETS = [
  {
    id: "s1", subject: "Invoices not arriving in the client's inbox", priority: "high", status: "in_progress",
    body: "Easy Roofers sent two invoices on Thursday and neither reached the homeowner. Both show as sent in their log. The homeowner's address is a Bell (sympatico.ca) mailbox.",
    company: { id: "c1", name: "Easy Roofers Inc." }, createdAt: T("2026-09-11T14:22:00Z"), updatedAt: T("2026-09-12T09:10:00Z"), resolvedAt: null,
    statusLine: "FieldQuo support is on it.",
    notes: [{ id: "sn1", authorLabel: "support@fieldquo.com", createdAt: T("2026-09-12T09:10:00Z"), body: "Bell is greylisting the sending domain. We have asked them to lift it; in the meantime the invoices can be re-sent from the invoice page and will go through on the second attempt." }],
  },
  {
    id: "s2", subject: "Card payment declined at checkout", priority: "normal", status: "resolved",
    body: "Maple Ridge Painting's client tried to pay a CA$1,240 invoice and got \"card declined\" twice. Their Stripe account shows charges enabled.",
    company: { id: "c2", name: "Maple Ridge Painting" }, createdAt: T("2026-08-27T16:40:00Z"), updatedAt: T("2026-08-28T10:02:00Z"), resolvedAt: T("2026-08-28T10:02:00Z"),
    statusLine: "Resolved by FieldQuo support.",
    notes: [{ id: "sn2", authorLabel: "support@fieldquo.com", createdAt: T("2026-08-28T10:02:00Z"), body: "The decline came from the cardholder's bank (insufficient funds), not from Stripe or FieldQuo. The client paid with a different card the next morning." }],
  },
];
export const TICKET_COUNTS = { in_progress: 1, resolved: 1 };

// ── Pay ───────────────────────────────────────────────────────────────────
// lib/sales/earnings.js's earningsView, written out. Amounts in cents; the
// tab prints plain dollars (the manual says so). Easy Roofers' CA$20 is
// this week's — unbatched until Monday 14 September closes the week.
const rung = (milestone, label, state, occurredAt) => ({ milestone, label, labelKey: `app.salesPay.milestone.${milestone}`, state, occurredAt: occurredAt ? T(occurredAt) : null });
export const EARNINGS = {
  totals: { lifetimeCents: 10000, paidCents: 6000, awaitingCents: 2000, thisWeekCents: 2000 },
  weeks: [
    { id: "w3", periodStart: T("2026-08-31T12:00:00Z"), periodEnd: T("2026-09-07T12:00:00Z"), status: "closed", paidAt: null, cents: 2000, closedCents: 2000, movedSinceClose: false },
    { id: "w2", periodStart: T("2026-08-17T12:00:00Z"), periodEnd: T("2026-08-24T12:00:00Z"), status: "paid", paidAt: T("2026-08-25T15:00:00Z"), cents: 4000, closedCents: 4000, movedSinceClose: false },
    { id: "w1", periodStart: T("2026-07-20T12:00:00Z"), periodEnd: T("2026-07-27T12:00:00Z"), status: "paid", paidAt: T("2026-07-28T15:00:00Z"), cents: 2000, closedCents: 2000, movedSinceClose: false },
  ],
  openLines: [{ id: "ce4", companyId: "c1", companyName: "Easy Roofers Inc.", milestone: "activation", amountCents: 2000, status: "earned", occurredAt: T("2026-09-10T19:19:00Z"), payoutBatchId: null }],
  companies: [
    { companyId: "c1", companyName: "Easy Roofers Inc.", cents: 2000, progress: { reached: 1, total: 3 }, ladder: [rung("activation", "Activated", "earned", "2026-09-10T19:19:00Z"), rung("first_payment", "Renewed", "pending", null), rung("retention", "Still paying", "pending", null)] },
    { companyId: "c3", companyName: "Northline Plumbing", cents: 2000, progress: { reached: 1, total: 3 }, ladder: [rung("activation", "Activated", "earned", "2026-09-03T18:45:00Z"), rung("first_payment", "Renewed", "pending", null), rung("retention", "Still paying", "pending", null)] },
    { companyId: "c2", companyName: "Maple Ridge Painting", cents: 6000, progress: { reached: 2, total: 3 }, ladder: [rung("activation", "Activated", "earned", "2026-07-21T16:02:00Z"), rung("first_payment", "Renewed", "earned", "2026-08-21T09:00:00Z"), rung("retention", "Still paying", "pending", null)] },
  ],
  payoutReady: true,
};

// ── Voicemail ─────────────────────────────────────────────────────────────
export const VOICEMAIL = {
  numbers: ["+14055550999"],
  voicemails: [
    { id: "vm1", audioHref: "/api/sales/voicemail/vm1/audio", fromE164: "+14055550177", ourE164: "+14055550999", leftAt: T("2026-09-12T13:41:00Z"), seconds: 23, silent: false, prospectId: "p2", leadId: null, businessName: "Bright Current Electrical", href: "/sales/queue?prospectId=p2", matchedBy: "prospect" },
    { id: "vm2", audioHref: "/api/sales/voicemail/vm2/audio", fromE164: "+15145550148", ourE164: "+14055550999", leftAt: T("2026-09-11T21:05:00Z"), seconds: 41, silent: false, prospectId: null, leadId: "l1", businessName: "Easy Roofers Inc.", href: "/sales/leads/l1", matchedBy: "lead" },
    { id: "vm3", audioHref: "/api/sales/voicemail/vm3/audio", fromE164: "+19185550123", ourE164: "+14055550999", leftAt: T("2026-09-11T15:12:00Z"), seconds: 0, silent: true, prospectId: null, leadId: null, businessName: null, href: null, matchedBy: null },
  ],
};

// ── Demo ──────────────────────────────────────────────────────────────────
export const DEMO_INDUSTRIES = [
  { key: "painting", label: "Painting" }, { key: "cabinets", label: "Cabinet refinishing" }, { key: "flooring", label: "Flooring" },
  { key: "landscaping", label: "Landscaping & lawn care" }, { key: "cleaning", label: "Cleaning" }, { key: "plumbing", label: "Plumbing" },
  { key: "hvac", label: "HVAC" }, { key: "roofing", label: "Roofing" }, { key: "electrical", label: "Electrical" }, { key: "handyman", label: "Handyman / general contracting" },
];
// The shape of GET /api/sales/demo after 3914247a (one demo per rep per
// trade, a login the rep sets): lib/sales/repDemo.js's repDemoState plus
// the industries list. The earlier { company, loginEmail, pool } shape
// crashed the page on `data.login.plannedEmail`.
export const DEMO = {
  demos: [
    { id: "c4", name: "Daniel Roofing Demo", slug: "danielboves-roofing", demoIndustry: "roofing", tradeLabel: "Roofing", createdAt: T("2026-09-08T14:00:00Z"), current: true, loginReady: true },
    { id: "c5", name: "Daniel Painting Demo", slug: "danielboves-painting", demoIndustry: "painting", tradeLabel: "Painting", createdAt: T("2026-09-11T09:30:00Z"), current: false, loginReady: true },
  ],
  current: "c4",
  login: { email: "demo-danielboves@fieldquo.com", exists: true, plannedEmail: "demo-danielboves@fieldquo.com" },
  industries: DEMO_INDUSTRIES,
};
