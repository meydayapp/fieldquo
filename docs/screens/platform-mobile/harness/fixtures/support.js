// Fixtures for the support group — see index.js for the contract.
//
// Routes answered here, in the order the console lists them:
//   /platform/support            escalation tickets + one ticket's thread
//   /platform/feedback           the feedback queue
//   /platform/jennifer           escalated Jennifer conversations + one thread
//   /platform/data-deletion      the deletion register
//   /platform/errors             the failure queue
//   /platform/ai-usage           spend per company
//   /platform/sales-agent        the Retell inbound line
//   /platform/crew-lines         Twilio numbers and who holds them
//   /platform/voice-numbers      the Retell number estate
//   /platform/voice-webhooks     agent webhook delivery
//   /platform/voice-economics    margin on the voice product
//   /platform/audit-log          staff actions
//   /platform/service-categories the global catalogue
//   /platform/team               platform admins (/api/platform/admins)
//   /platform/demo               demo fixture companies (+ /demo/assign)
//   /platform/demos              demo bookings
//   /platform/demo-availability  hosts' demo hours
//
// Every shape is copied from the matching app/api/platform/**/route.js (or the
// lib/ helper it spreads into its response), so what the page destructures is
// what it gets. Dates are pinned to September 2026 except where a page measures
// against `Date.now()` — ages on /feedback, /jennifer, /errors and the
// business-day counter on /data-deletion — which are computed relative to now
// so the stale/overdue styling those pages ship actually renders.
import { COMPANY_ID } from "./ids.js";

// ── Time helpers ──────────────────────────────────────────────────────────
const NOW = Date.now();
const DAY = 86_400_000;
const ago = ({ days = 0, hours = 0, minutes = 0 } = {}) =>
  new Date(NOW - days * DAY - hours * 3_600_000 - minutes * 60_000).toISOString();

// ── The cast ──────────────────────────────────────────────────────────────
// Long names on purpose: these are what a phone-width audit has to survive.
const COMPANIES = [
  { id: COMPANY_ID, name: "Easy Roofers", slug: "easy-roofers" },
  { id: "cmp_rivesud", name: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", slug: "toiture-rive-sud-beauchemin" },
  { id: "cmp_precision", name: "Precision Painting & Decorating of Greater Vancouver Ltd.", slug: "precision-painting-vancouver" },
  { id: "cmp_erable", name: "Érable Design Cabinetry", slug: "erable-design" },
  { id: "cmp_northside", name: "Northside Painting Co.", slug: "northside-painting" },
  { id: "cmp_hardwood", name: "Hardwood & Laminate Flooring Installers of Mississauga–Brampton", slug: "hardwood-mississauga" },
  { id: "cmp_bluewater", name: "Bluewater Plumbing, Heating & Drain Cleaning Services Inc.", slug: "bluewater-plumbing" },
  { id: "cmp_greenscape", name: "GreenScape Landscaping and Snow Removal — Ottawa/Gatineau", slug: "greenscape-ottawa" },
  { id: "cmp_sunset", name: "Sunset Electrical Contractors", slug: "sunset-electrical" },
];
const company = (i) => COMPANIES[i % COMPANIES.length];

const ADMINS = [
  { id: "adm1", email: "emilio@fieldquo.com", role: "superadmin", active: true, createdAt: "2026-01-04T14:02:11.000Z" },
  { id: "adm2", email: "marie-christine.desrosiers-lafontaine@fieldquo.com", role: "admin", active: true, createdAt: "2026-02-18T16:40:00.000Z" },
  { id: "adm3", email: "support-queue+montreal@fieldquo.com", role: "support", active: true, createdAt: "2026-03-02T13:15:00.000Z" },
  { id: "adm4", email: "jonathan.okonkwo-fitzgerald@fieldquo.com", role: "admin", active: true, createdAt: "2026-04-11T09:30:00.000Z" },
  { id: "adm5", email: "priya.venkataraman-holdsworth@fieldquo.com", role: "support", active: false, createdAt: "2026-05-22T11:05:00.000Z" },
  { id: "adm6", email: "ops@fieldquo.com", role: "superadmin", active: true, createdAt: "2026-06-30T20:00:00.000Z" },
  { id: "adm7", email: "alexandre.beaulieu-tremblay.contractor@fieldquo.com", role: "support", active: true, createdAt: "2026-08-14T15:45:00.000Z" },
];

const REPS = [
  { id: "rep_ana", name: "Ana Lucía Fernández-Ribeiro", email: "ana.fernandez-ribeiro@fieldquo-sales.com" },
  { id: "rep_marc", name: "Marc-Antoine Lévesque", email: "marc-antoine.levesque@fieldquo-sales.com" },
  { id: "rep_dev", name: "Devendra Krishnamurthy", email: "devendra.krishnamurthy@fieldquo-sales.com" },
  { id: "rep_sam", name: "Samantha O'Brien-Whitaker", email: "samantha.obrien-whitaker@fieldquo-sales.com" },
];

// ── /platform/support ──────────────────────────────────────────────────────
const TICKETS = [
  {
    id: "tk_01", status: "open", priority: "urgent", createdAt: "2026-09-12T13:04:00.000Z", updatedAt: "2026-09-12T13:04:00.000Z", resolvedAt: null,
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(1), salesRep: REPS[0],
    subject: "Invoice emails to the homeowner bounce — Resend says the sender domain is unverified after they changed their DNS host",
    body: "The owner moved toiture-rive-sud-beauchemin.com from GoDaddy to Cloudflare on Tuesday and every invoice since then bounces. Resend's dashboard shows the DKIM record missing. They have three invoices totalling $41,250 waiting on this and the homeowners are asking why nothing arrived. They tried re-sending from /app twice.",
    notes: [
      { id: "n_01a", kind: "message", authorKind: "admin", body: "Confirmed: the DKIM CNAME did not survive the move. I have sent the owner the three records to add at Cloudflare. Sender falls back to the platform address in the meantime, so the resend from /app should land now.", internal: false, createdAt: "2026-09-12T14:20:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
      { id: "n_01b", kind: "message", authorKind: "admin", body: "Internal: this is the third DNS-move bounce this month. Worth a warning banner on the sender page when verification lapses.", internal: true, createdAt: "2026-09-12T14:22:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
      { id: "n_01c", kind: "message", authorKind: "rep", body: "Owner says the records are in. Can somebody re-check verification? He's on site and can't get to a computer until tonight.", internal: false, createdAt: "2026-09-12T17:48:00.000Z", authorAdmin: null, authorRep: { name: REPS[0].name, email: REPS[0].email } },
    ],
  },
  {
    id: "tk_02", status: "open", priority: "high", createdAt: "2026-09-11T19:30:00.000Z", updatedAt: "2026-09-11T19:30:00.000Z", resolvedAt: null,
    assignedAdminId: null, assignedAdmin: null,
    company: company(2), salesRep: REPS[3],
    subject: "Stripe Connect payout stuck in 'pending verification' for 9 days",
    body: "Precision Painting completed onboarding on the 2nd, took a $6,800 deposit on the 3rd, and the payout has sat in pending ever since. Stripe's dashboard (which they can't see — we can) is asking for a document that was already uploaded. Owner is threatening to go back to cheques.",
    notes: [],
  },
  {
    id: "tk_03", status: "in_progress", priority: "high", createdAt: "2026-09-09T15:12:00.000Z", updatedAt: "2026-09-10T12:00:00.000Z", resolvedAt: null,
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(5), salesRep: REPS[2],
    subject: "Quote PDF renders the brand colour as black on a black background",
    body: "Brand colour is #1a1a1a. The PDF header comes out with black text on the near-black band. Web version is fine. See attached quote Q-2026-0417.",
    notes: [
      { id: "n_03a", kind: "status_change", authorKind: "admin", body: "Moved from open to in progress.", internal: false, createdAt: "2026-09-10T12:00:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
      { id: "n_03b", kind: "message", authorKind: "admin", body: "Reproduced. lib/documents/theme.js measures contrast for the web surface but the PDF header uses a fixed ink. Fix is in review.", internal: false, createdAt: "2026-09-10T12:04:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
    ],
  },
  {
    id: "tk_04", status: "open", priority: "normal", createdAt: "2026-09-08T10:45:00.000Z", updatedAt: "2026-09-08T10:45:00.000Z", resolvedAt: null,
    assignedAdminId: "adm4", assignedAdmin: { id: "adm4", email: "jonathan.okonkwo-fitzgerald@fieldquo.com" },
    company: company(3), salesRep: REPS[1],
    subject: "French booking page shows English day names in the calendar",
    body: "Client language is fr-CA, company language fr. The /book/erable-design calendar header shows 'Monday' etc. Everything else on the page is in French.",
    notes: [],
  },
  {
    id: "tk_05", status: "open", priority: "normal", createdAt: "2026-09-06T21:10:00.000Z", updatedAt: "2026-09-06T21:10:00.000Z", resolvedAt: null,
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(6), salesRep: REPS[0],
    subject: "Receptionist answers but the transfer to the owner's cell rings once and drops",
    body: "Bluewater's voice agent picks up fine. When a caller asks for a person, the transfer to +1 519 555 0142 rings once on the owner's phone and the caller hears silence then a click. Happens on every call since the 4th. Owner is on Rogers.",
    notes: [
      { id: "n_05a", kind: "message", authorKind: "rep", body: "Owner tested from two different phones, same result.", internal: false, createdAt: "2026-09-07T13:30:00.000Z", authorAdmin: null, authorRep: { name: REPS[0].name, email: REPS[0].email } },
    ],
  },
  {
    id: "tk_06", status: "open", priority: "low", createdAt: "2026-09-02T16:00:00.000Z", updatedAt: "2026-09-02T16:00:00.000Z", resolvedAt: null,
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(7), salesRep: REPS[3],
    subject: "Website builder: uploaded hero photo is cropped to the wrong side on mobile",
    body: "The crew photo on greenscape-ottawa.fieldquo.com is cropped so the truck is cut off at 375px wide. Desktop is fine. Not urgent, the owner would just like it fixed before the fall campaign.",
    notes: [],
  },
  {
    id: "tk_07", status: "open", priority: "urgent", createdAt: "2026-09-13T08:15:00.000Z", updatedAt: "2026-09-13T08:15:00.000Z", resolvedAt: null,
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(0), salesRep: REPS[2],
    subject: "Owner cannot sign in — 'session expired' loop on iPhone Safari after the 12 Sept deploy",
    body: "Easy Roofers' owner gets bounced to /login every time she taps a quote from the email link. Works in Chrome on her laptop. She has two crews waiting on approvals this morning.",
    notes: [],
  },
  {
    id: "tk_08", status: "in_progress", priority: "normal", createdAt: "2026-09-04T12:20:00.000Z", updatedAt: "2026-09-05T09:00:00.000Z", resolvedAt: null,
    assignedAdminId: "adm2", assignedAdmin: { id: "adm2", email: "marie-christine.desrosiers-lafontaine@fieldquo.com" },
    company: company(8), salesRep: REPS[1],
    subject: "Job costing shows materials twice when an expense is edited",
    body: "Editing an expense's amount on job J-0088 adds a second line instead of replacing the first. Totals are off by exactly the original amount.",
    notes: [
      { id: "n_08a", kind: "status_change", authorKind: "admin", body: "Moved from open to in progress.", internal: false, createdAt: "2026-09-05T09:00:00.000Z", authorAdmin: { email: "marie-christine.desrosiers-lafontaine@fieldquo.com" }, authorRep: null },
    ],
  },
  {
    id: "tk_09", status: "resolved", priority: "high", createdAt: "2026-08-28T14:00:00.000Z", updatedAt: "2026-08-30T10:30:00.000Z", resolvedAt: "2026-08-30T10:30:00.000Z",
    assignedAdminId: "adm1", assignedAdmin: { id: "adm1", email: "emilio@fieldquo.com" },
    company: company(4), salesRep: REPS[0],
    subject: "Self-quote form submissions arriving with an empty address",
    body: "Google autocomplete was returning a place id with no formatted address for rural Ontario lots.",
    notes: [
      { id: "n_09a", kind: "message", authorKind: "admin", body: "Fixed in the 29 Aug deploy — the form now falls back to the typed text when Places returns nothing.", internal: false, createdAt: "2026-08-30T10:28:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
      { id: "n_09b", kind: "status_change", authorKind: "admin", body: "Moved from in progress to resolved.", internal: false, createdAt: "2026-08-30T10:30:00.000Z", authorAdmin: { email: "emilio@fieldquo.com" }, authorRep: null },
    ],
  },
  {
    id: "tk_10", status: "resolved", priority: "low", createdAt: "2026-08-20T09:00:00.000Z", updatedAt: "2026-08-21T16:45:00.000Z", resolvedAt: "2026-08-21T16:45:00.000Z",
    assignedAdminId: "adm4", assignedAdmin: { id: "adm4", email: "jonathan.okonkwo-fitzgerald@fieldquo.com" },
    company: company(2), salesRep: REPS[3],
    subject: "Typo in the Spanish invoice footer",
    body: "'Gracias por su preferencia' was rendered as 'Gracias por su preferencía'.",
    notes: [],
  },
];

const PRIORITY_RANK = { low: 0, normal: 1, high: 2, urgent: 3 };
function supportList(status) {
  const rows = TICKETS.filter((t) => !status || t.status === status)
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || new Date(a.createdAt) - new Date(b.createdAt));
  const counts = {};
  for (const t of TICKETS) counts[t.status] = (counts[t.status] || 0) + 1;
  return {
    tickets: rows.map(({ notes, body, ...t }) => ({ ...t, company: { id: t.company.id, name: t.company.name }, noteCount: notes.length })),
    counts,
  };
}
const supportDetail = (id) => {
  const t = TICKETS.find((x) => x.id === id);
  return t ? { ticket: t } : null;
};

// ── /platform/feedback ─────────────────────────────────────────────────────
const FEEDBACK = [
  { id: "fb_01", companyId: company(1).id, userId: "usr_1", email: "jean-francois.beauchemin@toiture-rive-sud-beauchemin.com", companyName: company(1).name, type: "bug", subject: "Le PDF de soumission coupe la dernière ligne du tableau quand il y a plus de 14 items", body: "Sur la soumission S-2026-0912, la ligne « Ventilation de toit — 4 unités » disparaît entre la page 1 et la page 2. Le total est bon, mais le client ne voit pas l'item.", pageUrl: "https://app.fieldquo.com/app/quotes/q_8f2a1c9e-long-identifier-for-width/preview?lang=fr&print=1", status: "open", adminNotes: null, resolvedAt: null, createdAt: ago({ days: 12, hours: 3 }), updatedAt: ago({ days: 12 }) },
  { id: "fb_02", companyId: company(2).id, userId: "usr_2", email: "ops@precisionpaintingvancouver.ca", companyName: company(2).name, type: "billing", subject: "Charged for 6 seats, we only have 4 active painters", body: "Two of the seats belong to guys who left in July. I deactivated them in Team but the invoice this month still says 6.", pageUrl: "https://app.fieldquo.com/app/settings/billing", status: "open", adminNotes: "Seats are counted at the billing anchor date — deactivations after the 1st roll into next month. Need to explain, and consider prorating.", resolvedAt: null, createdAt: ago({ days: 9 }), updatedAt: ago({ days: 8 }) },
  { id: "fb_03", companyId: company(6).id, userId: "usr_3", email: "dispatch@bluewaterplumbing.ca", companyName: company(6).name, type: "feature_request", subject: "Let the receptionist book an emergency visit outside business hours", body: "Half our calls are at 11pm with a burst pipe. Right now the AI says we're closed and offers a callback in the morning. We'd pay for an after-hours slot type with a surcharge.", pageUrl: "https://app.fieldquo.com/app/settings/voice", status: "open", adminNotes: null, resolvedAt: null, createdAt: ago({ days: 6, hours: 20 }), updatedAt: ago({ days: 6 }) },
  { id: "fb_04", companyId: company(3).id, userId: "usr_4", email: "info@erabledesign.ca", companyName: company(3).name, type: "question", subject: "Can a client approve a quote without creating an account?", body: "Our clients are 60+ and won't make a password. Is the link in the email enough?", pageUrl: "https://app.fieldquo.com/app/quotes", status: "open", adminNotes: null, resolvedAt: null, createdAt: ago({ days: 3, hours: 5 }), updatedAt: ago({ days: 3 }) },
  { id: "fb_05", companyId: null, userId: null, email: "someone.who.left.the.company.a.while.ago@gmail.com", companyName: "Maple Ridge Drywall & Taping (account closed)", type: "other", subject: "Please delete my data", body: "I no longer use your product.", pageUrl: null, status: "open", adminNotes: "Routed to the data-deletion register as FQ-DEL-7K2M9P.", resolvedAt: null, createdAt: ago({ days: 2 }), updatedAt: ago({ days: 1 }) },
  { id: "fb_06", companyId: company(0).id, userId: "usr_6", email: "owner@easyroofers.ca", companyName: company(0).name, type: "jennifer_escalation", subject: "Refund of a duplicate deposit payment", body: "Homeowner paid the $2,500 deposit twice and wants one refunded through Stripe.", pageUrl: "https://app.fieldquo.com/app/invoices/inv_44a9", status: "open", adminNotes: null, resolvedAt: null, createdAt: ago({ hours: 6 }), updatedAt: ago({ hours: 6 }) },
  { id: "fb_07", companyId: company(7).id, userId: "usr_7", email: "kevin@greenscapeottawa.com", companyName: company(7).name, type: "bug", subject: "Snow-removal seasonal contract quote shows a per-visit price instead of per-season", body: "Set the unit to 'season' in the price book, still shows '/visit' on the PDF.", pageUrl: "https://app.fieldquo.com/app/settings/price-book", status: "open", adminNotes: null, resolvedAt: null, createdAt: ago({ days: 15 }), updatedAt: ago({ days: 15 }) },
  { id: "fb_08", companyId: company(5).id, userId: "usr_8", email: "raj@hardwoodmississauga.ca", companyName: company(5).name, type: "feature_request", subject: "Square-foot calculator from a photo of the room", body: "You already measure roofs from satellite — do floors from a phone photo?", pageUrl: "https://app.fieldquo.com/app/quotes/new", status: "in_progress", adminNotes: "On the roadmap as 'floor measurement'. Owner asked to be told when it ships.", resolvedAt: null, createdAt: ago({ days: 30 }), updatedAt: ago({ days: 4 }) },
  { id: "fb_09", companyId: company(8).id, userId: "usr_9", email: "office@sunsetelectrical.ca", companyName: company(8).name, type: "bug", subject: "Invoice reminder went out twice on the same morning", body: "Client got two identical emails 4 minutes apart.", pageUrl: "https://app.fieldquo.com/app/invoices", status: "resolved", adminNotes: "Cron overlap on the 2nd — fixed by the lock in lib/cron.", resolvedAt: ago({ days: 8 }), createdAt: ago({ days: 11 }), updatedAt: ago({ days: 8 }) },
  { id: "fb_10", companyId: company(4).id, userId: "usr_10", email: "hello@northsidepainting.co", companyName: company(4).name, type: "feature_request", subject: "Dark mode for the whole app", body: "The white screens are blinding in the van at night.", pageUrl: "https://app.fieldquo.com/app", status: "wont_fix", adminNotes: "Already exists — system theme. Told them where the toggle is.", resolvedAt: ago({ days: 20 }), createdAt: ago({ days: 22 }), updatedAt: ago({ days: 20 }) },
];
function feedbackList(status) {
  const rows = FEEDBACK.filter((r) => !status || r.status === status)
    .sort((a, b) => (status === "open" ? 1 : -1) * (new Date(a.createdAt) - new Date(b.createdAt)));
  const counts = {};
  for (const r of FEEDBACK) counts[r.status] = (counts[r.status] || 0) + 1;
  return { rows, counts };
}

// ── /platform/jennifer ─────────────────────────────────────────────────────
const JENNIFER = [
  {
    id: "jc_01", companyId: company(0).id, companyName: company(0).name, status: "escalated",
    escalationReason: "Money moving — a refund of a duplicate deposit payment",
    createdAt: ago({ days: 1, hours: 4 }), updatedAt: ago({ days: 1, hours: 2 }),
    messages: [
      { id: "jm_01a", role: "user", content: "A homeowner paid the $2,500 deposit on invoice INV-0442 twice — once from the email link and once from the portal. Can you refund one of them?", createdAt: ago({ days: 1, hours: 4 }) },
      { id: "jm_01b", role: "assistant", content: "I can see both payments on INV-0442: $2,500.00 at 09:12 and $2,500.00 at 09:15, both succeeded. A refund moves money, which I don't do myself — I've handed this to the FieldQuo team, and they'll reply here. In the meantime the invoice shows a $2,500.00 credit, so nothing further will be requested from the homeowner.", createdAt: ago({ days: 1, hours: 4 }) },
      { id: "jm_01c", role: "user", content: "Ok. The homeowner is asking when she'll see it. Her name is Mrs. Abernathy-Kowalczyk, she's 78 and quite worried.", createdAt: ago({ days: 1, hours: 2 }) },
    ],
  },
  {
    id: "jc_02", companyId: company(1).id, companyName: company(1).name, status: "escalated",
    escalationReason: "Data-deletion request for a former employee",
    createdAt: ago({ days: 2, hours: 9 }), updatedAt: ago({ days: 2, hours: 8 }),
    messages: [
      { id: "jm_02a", role: "user", content: "Un ancien employé (Ghislain Pelletier-Rousseau) demande qu'on efface toutes ses données. Comment on fait?", createdAt: ago({ days: 2, hours: 9 }) },
      { id: "jm_02b", role: "assistant", content: "Une demande d'effacement est traitée par l'équipe FieldQuo, pas par moi. Je l'ai transmise; quelqu'un vous répondra ici. Il n'est pas nécessaire de rien supprimer vous-même d'ici là.", createdAt: ago({ days: 2, hours: 8 }) },
    ],
  },
  {
    id: "jc_03", companyId: company(2).id, companyName: company(2).name, status: "escalated",
    escalationReason: "Legal/privacy — a subpoena mentioning quote records",
    createdAt: ago({ days: 3 }), updatedAt: ago({ hours: 5 }),
    messages: [
      { id: "jm_03a", role: "user", content: "We've been served with a subpoena from a strata council for all quotes and invoices on 1188 West Georgia between March and June. What do we hand over and does it come from you or us?", createdAt: ago({ days: 3 }) },
      { id: "jm_03b", role: "assistant", content: "That's a legal request, so I've passed it to the FieldQuo team rather than answer it myself. They'll reply here.", createdAt: ago({ days: 3 }) },
      { id: "jm_03c", role: "operator", content: "The records are yours — you export them from Reports → Export with the address filter, and FieldQuo doesn't hand anything to a third party on your behalf. If their lawyer contacts us directly we'll point them to you. Want me to walk you through the export?", createdAt: ago({ days: 1 }) },
      { id: "jm_03d", role: "user", content: "Yes please, and can the export include the signed approval timestamps?", createdAt: ago({ hours: 5 }) },
    ],
  },
  { id: "jc_04", companyId: company(6).id, companyName: company(6).name, status: "escalated", escalationReason: "Money moving — chargeback on a $3,100 drain-cleaning invoice", createdAt: ago({ hours: 20 }), updatedAt: ago({ hours: 19 }), messages: [ { id: "jm_04a", role: "user", content: "Got a chargeback notice for INV-0917. The customer signed the work order. What do I send Stripe?", createdAt: ago({ hours: 20 }) }, { id: "jm_04b", role: "assistant", content: "A dispute involves money, so the FieldQuo team will handle this with you here.", createdAt: ago({ hours: 19 }) } ] },
  { id: "jc_05", companyId: company(7).id, companyName: company(7).name, status: "escalated", escalationReason: "Money moving — the owner wants the seasonal subscription refunded", createdAt: ago({ hours: 3 }), updatedAt: ago({ hours: 3 }), messages: [ { id: "jm_05a", role: "user", content: "We're closing for the winter, can we get the rest of the annual plan refunded?", createdAt: ago({ hours: 3 }) }, { id: "jm_05b", role: "assistant", content: "A refund is something the FieldQuo team decides, not me. I've handed this over and they'll answer here.", createdAt: ago({ hours: 3 }) } ] },
  { id: "jc_06", companyId: company(5).id, companyName: company(5).name, status: "escalated", escalationReason: "Privacy — a homeowner asking what data is held about them", createdAt: ago({ days: 4 }), updatedAt: ago({ days: 4 }), messages: [ { id: "jm_06a", role: "user", content: "A client wants to know everything we have stored about her. Is there a report?", createdAt: ago({ days: 4 }) }, { id: "jm_06b", role: "assistant", content: "That's a privacy request; I've passed it to the FieldQuo team.", createdAt: ago({ days: 4 }) } ] },
  { id: "jc_07", companyId: company(3).id, companyName: company(3).name, status: "unresolved", escalationReason: null, createdAt: ago({ hours: 1 }), updatedAt: ago({ hours: 1 }), messages: [ { id: "jm_07a", role: "user", content: "Combien de soumissions on a envoyées ce mois-ci?", createdAt: ago({ hours: 1 }) }, { id: "jm_07b", role: "assistant", content: "Vous avez envoyé 14 soumissions en septembre, pour un total de 87 450 $. Six ont été approuvées.", createdAt: ago({ hours: 1 }) } ] },
  { id: "jc_08", companyId: company(8).id, companyName: company(8).name, status: "unresolved", escalationReason: null, createdAt: ago({ hours: 2 }), updatedAt: ago({ hours: 2 }), messages: [ { id: "jm_08a", role: "user", content: "Which jobs are unpaid past 30 days?", createdAt: ago({ hours: 2 }) }, { id: "jm_08b", role: "assistant", content: "Three: INV-0871 ($1,240), INV-0866 ($3,980) and INV-0851 ($560). I can send a reminder for any of them.", createdAt: ago({ hours: 2 }) } ] },
  { id: "jc_09", companyId: company(4).id, companyName: company(4).name, status: "resolved", escalationReason: "Money moving — refund request", createdAt: ago({ days: 12 }), updatedAt: ago({ days: 10 }), messages: [ { id: "jm_09a", role: "user", content: "Refund the $200 booking fee for the cancelled visit?", createdAt: ago({ days: 12 }) }, { id: "jm_09b", role: "assistant", content: "Handed to the FieldQuo team.", createdAt: ago({ days: 12 }) }, { id: "jm_09c", role: "operator", content: "Refunded in full — it'll show on their card in 5–10 business days.", createdAt: ago({ days: 10 }) } ] },
];
function jenniferList(status) {
  const rows = JENNIFER.filter((c) => c.status === status).sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  const counts = {};
  for (const c of JENNIFER) counts[c.status] = (counts[c.status] || 0) + 1;
  return {
    rows: rows.map((r) => ({ id: r.id, companyId: r.companyId, companyName: r.companyName, status: r.status, escalationReason: r.escalationReason, createdAt: r.createdAt, updatedAt: r.updatedAt, preview: r.messages[0]?.content?.slice(0, 140) || "" })),
    counts,
  };
}
const jenniferDetail = (id) => {
  const c = JENNIFER.find((x) => x.id === id);
  return c ? { conversation: c } : null;
};

// ── /platform/data-deletion ────────────────────────────────────────────────
// receivedAt is relative to now: the page counts business days against a
// 30-day promise and the overdue styling only fires past it.
const DELETIONS = [
  { id: "dd_01", confirmationCode: "FQ-DEL-7K2M9P", source: "form", status: "received", name: "Ghislain Pelletier-Rousseau", email: "ghislain.pelletier-rousseau.personal.mailbox@protonmail.com", companyName: company(1).name, message: "J'ai quitté l'entreprise en juin. Effacez mon numéro, mes photos de chantier et tout ce qui me concerne, s'il vous plaît.", metaUserId: null, receivedAt: ago({ days: 52 }), acknowledgedAt: ago({ days: 52 }), completedAt: null, createdAt: ago({ days: 52 }), updatedAt: ago({ days: 52 }) },
  { id: "dd_02", confirmationCode: "FQ-DEL-3XW8QA", source: "meta_callback", status: "received", name: null, email: "meta-callback@unknown.invalid", companyName: null, message: null, metaUserId: "10229471183350512", receivedAt: ago({ days: 44 }), acknowledgedAt: null, completedAt: null, createdAt: ago({ days: 44 }), updatedAt: ago({ days: 44 }) },
  { id: "dd_03", confirmationCode: "FQ-DEL-9RT4NB", source: "email", status: "received", name: "Mrs. Henrietta Abernathy-Kowalczyk", email: "henrietta.abernathy.kowalczyk@sympatico.ca", companyName: company(0).name, message: "My roof was done in 2025. I would like my address and phone number removed from your system.", metaUserId: null, receivedAt: ago({ days: 18 }), acknowledgedAt: ago({ days: 18 }), completedAt: null, createdAt: ago({ days: 18 }), updatedAt: ago({ days: 18 }) },
  { id: "dd_04", confirmationCode: "FQ-DEL-2CD6HG", source: "form", status: "received", name: "Someone Who Left A Very Long Name In The Box Indeed", email: "someone.who.left.the.company.a.while.ago@gmail.com", companyName: "Maple Ridge Drywall & Taping (account closed)", message: "I no longer use your product.", metaUserId: null, receivedAt: ago({ days: 9 }), acknowledgedAt: null, completedAt: null, createdAt: ago({ days: 9 }), updatedAt: ago({ days: 9 }) },
  { id: "dd_05", confirmationCode: "FQ-DEL-5MN7PV", source: "form", status: "received", name: "Tomasz Wiśniewski", email: "t.wisniewski@outlook.com", companyName: null, message: null, metaUserId: null, receivedAt: ago({ days: 2 }), acknowledgedAt: ago({ days: 2 }), completedAt: null, createdAt: ago({ days: 2 }), updatedAt: ago({ days: 2 }) },
  { id: "dd_06", confirmationCode: "FQ-DEL-8JK3ZE", source: "meta_callback", status: "received", name: null, email: "meta-callback@unknown.invalid", companyName: null, message: null, metaUserId: "10158834472019387", receivedAt: ago({ hours: 14 }), acknowledgedAt: null, completedAt: null, createdAt: ago({ hours: 14 }), updatedAt: ago({ hours: 14 }) },
  { id: "dd_07", confirmationCode: "FQ-DEL-4QX2WR", source: "form", status: "completed", name: "Dorothée Lachance-Bergeron", email: "dorothee.lachance-bergeron@videotron.ca", companyName: company(3).name, message: "Merci de retirer mes coordonnées.", metaUserId: null, receivedAt: ago({ days: 40 }), acknowledgedAt: ago({ days: 40 }), completedAt: ago({ days: 25 }), createdAt: ago({ days: 40 }), updatedAt: ago({ days: 25 }) },
  { id: "dd_08", confirmationCode: "FQ-DEL-6VB9TC", source: "email", status: "completed", name: "R. Singh", email: "rsingh1979@yahoo.ca", companyName: company(5).name, message: null, metaUserId: null, receivedAt: ago({ days: 70 }), acknowledgedAt: ago({ days: 69 }), completedAt: ago({ days: 48 }), createdAt: ago({ days: 70 }), updatedAt: ago({ days: 48 }) },
];
function deletionList(status) {
  const rows = DELETIONS.filter((r) => !status || r.status === status)
    .sort((a, b) => (status === "received" ? 1 : -1) * (new Date(a.receivedAt) - new Date(b.receivedAt)));
  const counts = {};
  for (const r of DELETIONS) counts[r.status] = (counts[r.status] || 0) + 1;
  return { rows, counts };
}

// ── /platform/errors ───────────────────────────────────────────────────────
const ERRORS = [
  { id: "er_01", area: "email", code: "resend_rejected", message: "Resend rejected invoice INV-0442 to henrietta.abernathy.kowalczyk@sympatico.ca: 422 sender domain toiture-rive-sud-beauchemin.com is not verified (DKIM record missing).", companyId: company(1).id, detail: { invoiceId: "inv_0442", to: "henrietta.abernathy.kowalczyk@sympatico.ca", status: 422, resendId: "re_4Hx9kQ2mL8pN3vT7yB1cD6fG", domain: "toiture-rive-sud-beauchemin.com" }, resolvedAt: null, resolvedBy: null, createdAt: ago({ minutes: 14 }) },
  { id: "er_02", area: "stripe", code: "payout_pending_verification", message: "Connect account acct_1Q8xZk2eZvKYlo2C has a payout of $6,800.00 blocked pending identity verification for 9 days.", companyId: company(2).id, detail: { accountId: "acct_1Q8xZk2eZvKYlo2C", payoutId: "po_1Q9aBcDeFgHiJkLm", amountCents: 680000, requirements: ["individual.verification.document"] }, resolvedAt: null, resolvedBy: null, createdAt: ago({ hours: 3 }) },
  { id: "er_03", area: "pdf", code: "render_timeout", message: "Quote PDF for Q-2026-0417 did not render within 30s (Chromium exited 137).", companyId: company(5).id, detail: { quoteId: "q_0417", attempt: 3, exitCode: 137, memoryMb: 1024 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ hours: 7 }) },
  { id: "er_04", area: "ai", code: "quota_exceeded", message: "AI quote review refused: company is at 104% of its 400,000-token monthly cap.", companyId: company(0).id, detail: { feature: "quote_review", tokensUsed: 416120, cap: 400000 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ hours: 11 }) },
  { id: "er_05", area: "webhook", code: "retell_signature_mismatch", message: "Retell call_ended event for call_9f3a2b rejected: signature did not verify against RETELL_WEBHOOK_SECRET.", companyId: company(6).id, detail: { providerCallId: "call_9f3a2bc4d5e6f7a8b9c0d1e2f3a4b5c6", event: "call_ended", headerPresent: true }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 1, hours: 2 }) },
  { id: "er_06", area: "upload", code: "cloud_name_mismatch", message: "Cloudinary signed upload refused: cloud name in the signature (fieldquo-prod) does not match the request (fieldquo-preview).", companyId: company(7).id, detail: { publicId: "sites/greenscape-ottawa/hero-crew-truck-2026", bytes: 4_812_344 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 1, hours: 9 }) },
  { id: "er_07", area: "cron", code: "invoice_reminders_overlap", message: "invoice-reminders ran twice at 09:00 and 09:04 — the second run was refused by the lock but had already queued 2 sends.", companyId: null, detail: { job: "invoice-reminders", firstRun: "2026-09-12T13:00:02Z", secondRun: "2026-09-12T13:04:11Z", duplicateSends: 2 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 1, hours: 20 }) },
  { id: "er_08", area: "account_abuse", code: "seat_sharing_suspected", message: "One login used from 4 devices across 3 cities (Mississauga, Brampton, Calgary) within 6 hours.", companyId: company(5).id, detail: { userId: "usr_8", devices: 4, cities: ["Mississauga", "Brampton", "Calgary"], windowHours: 6 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 2 }) },
  { id: "er_09", area: "sms", code: "twilio_30007", message: "Twilio filtered an outbound crew text to +15195550142 as spam (error 30007).", companyId: company(6).id, detail: { to: "+15195550142", sid: "SM8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3", errorCode: 30007 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 2, hours: 6 }) },
  { id: "er_10", area: "email", code: "resend_rejected", message: "Resend rejected a booking confirmation: recipient address 'homeowner@' is not a valid address.", companyId: company(8).id, detail: { to: "homeowner@", status: 422 }, resolvedAt: null, resolvedBy: null, createdAt: ago({ days: 3 }) },
  { id: "er_11", area: "stripe", code: "webhook_replay", message: "Stripe event evt_1Q7yTt2eZvKYlo2C arrived 3 times; the second and third were ignored as replays.", companyId: null, detail: { eventId: "evt_1Q7yTt2eZvKYlo2C", type: "invoice.paid", deliveries: 3 }, resolvedAt: ago({ days: 4 }), resolvedBy: "adm1", createdAt: ago({ days: 5 }) },
  { id: "er_12", area: "pdf", code: "font_missing", message: "Invoice PDF fell back to Helvetica: the brand font 'Cormorant Garamond' could not be fetched.", companyId: company(3).id, detail: { font: "Cormorant Garamond", status: 503 }, resolvedAt: ago({ days: 6 }), resolvedBy: "adm2", createdAt: ago({ days: 7 }) },
];
function errorsList(url) {
  const area = url.searchParams.get("area");
  const resolved = url.searchParams.get("resolved") === "1";
  const unresolved = ERRORS.filter((e) => !e.resolvedAt);
  const rows = ERRORS.filter((e) => (resolved ? Boolean(e.resolvedAt) : !e.resolvedAt))
    .filter((e) => !area || e.area === area)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const areaCounts = new Map();
  for (const e of unresolved) areaCounts.set(e.area, (areaCounts.get(e.area) || 0) + 1);
  const owner = { [company(1).id]: "jean-francois.beauchemin@toiture-rive-sud-beauchemin.com", [company(2).id]: "ops@precisionpaintingvancouver.ca", [company(5).id]: "raj@hardwoodmississauga.ca", [company(0).id]: "owner@easyroofers.ca", [company(6).id]: "dispatch@bluewaterplumbing.ca", [company(7).id]: "kevin@greenscapeottawa.com", [company(3).id]: null, [company(8).id]: "office@sunsetelectrical.ca" };
  return {
    unresolvedCount: unresolved.length,
    areas: [...areaCounts].map(([a, count]) => ({ area: a, count })),
    errors: rows.map((e) => ({
      ...e,
      companyName: e.companyId ? COMPANIES.find((c) => c.id === e.companyId)?.name || null : null,
      companyOwnerEmail: e.companyId ? owner[e.companyId] ?? null : null,
    })),
  };
}

// ── /platform/ai-usage ─────────────────────────────────────────────────────
function aiUsage() {
  const d = new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  const rows = [
    { companyId: company(0).id, name: company(0).name, status: "active", planName: "Pro", tokens: 416_120, costMicros: 3_121_400, calls: 812, lastMonthTokens: 118_400, companyCap: 400_000, planCap: 250_000 },
    { companyId: company(1).id, name: company(1).name, status: "active", planName: "Business", tokens: 288_905, costMicros: 2_166_790, calls: 431, lastMonthTokens: 301_220, companyCap: null, planCap: 1_000_000 },
    { companyId: company(2).id, name: company(2).name, status: "active", planName: "Pro", tokens: 152_330, costMicros: 1_142_475, calls: 267, lastMonthTokens: 21_000, companyCap: null, planCap: 250_000 },
    { companyId: company(5).id, name: company(5).name, status: "trialing", planName: null, tokens: 96_410, costMicros: 723_075, calls: 190, lastMonthTokens: 0, companyCap: null, planCap: null },
    { companyId: company(6).id, name: company(6).name, status: "active", planName: "Business", tokens: 74_200, costMicros: 556_500, calls: 141, lastMonthTokens: 80_115, companyCap: null, planCap: null },
    { companyId: company(3).id, name: company(3).name, status: "active", planName: "Starter", tokens: 41_880, costMicros: 314_100, calls: 96, lastMonthTokens: 39_700, companyCap: 50_000, planCap: 100_000 },
    { companyId: company(7).id, name: company(7).name, status: "active", planName: "Starter", tokens: 12_004, costMicros: 90_030, calls: 33, lastMonthTokens: 15_880, companyCap: 0, planCap: 100_000 },
    { companyId: company(8).id, name: company(8).name, status: "trialing", planName: null, tokens: 1_260, costMicros: 9_450, calls: 4, lastMonthTokens: 0, companyCap: null, planCap: null },
    { companyId: "cmp_gone", name: "(deleted company)", status: undefined, planName: null, tokens: 340, costMicros: 2_550, calls: 1, lastMonthTokens: 0, companyCap: null, planCap: null },
  ].map((r) => {
    const effectiveCap = r.companyCap ?? r.planCap ?? 100_000;
    return { ...r, effectiveCap, percentUsed: effectiveCap && effectiveCap > 0 ? Math.round((r.tokens / effectiveCap) * 100) : null };
  });
  const byFeature = [
    { feature: "quote_review", tokens: 402_110, costMicros: 3_015_825, calls: 640 },
    { feature: "site_generation", tokens: 288_400, costMicros: 2_163_000, calls: 92 },
    { feature: "jennifer", tokens: 201_775, costMicros: 1_513_312, calls: 880 },
    { feature: "voice_receptionist", tokens: 118_320, costMicros: 887_400, calls: 214 },
    { feature: "upsell_add_ons", tokens: 52_844, costMicros: 396_330, calls: 141 },
    { feature: "email_draft", tokens: 20_000, costMicros: 150_000, calls: 8 },
  ];
  return {
    periodStart,
    totals: {
      tokens: rows.reduce((s, r) => s + r.tokens, 0),
      costMicros: rows.reduce((s, r) => s + r.costMicros, 0),
      calls: rows.reduce((s, r) => s + r.calls, 0),
      companies: rows.length,
    },
    byFeature,
    rows,
    defaultCap: 100_000,
  };
}

// ── /platform/sales-agent ──────────────────────────────────────────────────
const SALES_E164 = "+18885550190";
const link = (id, state, reason, extra = {}) => ({
  id, state,
  reasonKey: ["unchecked", "voice_off", "no_credit"].includes(reason)
    ? { unchecked: "app.setVoice.chain.unchecked", voice_off: "app.setVoice.chain.voiceOff", no_credit: "app.setVoice.chain.noCredit" }[reason]
    : `app.setVoice.chain.${id}.${reason}`,
  reason, fixer: null, fix: null, detail: null, blockedBy: null, ...extra,
});
const SALES_PROMPT = `You are the inbound sales line for FieldQuo, software for field-service contractors — painters, cabinet makers, flooring installers, plumbers, landscapers, roofers.

RULES (these come first and nothing below can loosen them)
1. Never quote a price that is not in the PLANS section. If asked about a plan that is not listed, say you can only quote the plans you have and offer to have somebody call back.
2. Never promise a date, a feature that is not in FEATURES, or an integration.
3. You cannot look up any company's account. You have no tool that reads customer data. Say so plainly if asked.
4. You cannot put anybody through. Offer https://fieldquo.com/contact and take a message.
5. Calls are recorded; say so in the first sentence if the caller asks.

WHAT FIELDQUO IS
Everything the homeowner sees is the contractor's branding — the quote, the invoice, the booking page, the website, the emails. FieldQuo's name is not on any of it.
A new company can start a trial from the public signup form. Joining an existing company is invite-only.

CORE PRODUCT (8 areas)
Quotes · Jobs · Invoices & payments · Scheduling & visits · Clients · Website & booking page · Reports · Team & permissions

FEATURES (7 offered)
- AI quote review: a second pair of eyes on every quote before it goes out — catches missing line items and suggests add-ons.
- Receptionist: an AI that answers the company's phone, books visits and takes messages, on the company's own number.
- Crew texting: a number the crew texts photos and updates to, filed against the job.
- Roof measurement: measures a roof from the address, using satellite imagery.
- Website builder: a one-page site with the company's services, photos and booking link.
- Client portal: homeowners see their quotes, invoices and visits in one place.
- Referrals (preview): a referral link that gives both sides a free month.

PLANS (3 quotable; 1 held back — say the list may be partial)
- Starter: $49 per month · 2 seats · 25 quotes a month · AI included
- Pro: $129 per month · 5 seats · unlimited quotes · AI included
- Business: $299 per month · 15 seats · unlimited quotes · AI included
Trial: the first month is free.

TONE NOTES (from the owner — emphasis and phrasing only)
\`\`\`
Ask what trade they're in before anything else. Roofers care about the measurement tool; say that first for them. Keep it under two minutes unless they want more.
\`\`\``;

function salesAgent() {
  const links = [
    link("provider", "ok", "reachable"),
    link("number", "ok", "ours"),
    link("agent", "ok", "present"),
    link("engine", "ok", "present"),
    link("binding", "ok", "attached"),
    link("switch", "ok", "on"),
    link("webhook", "ok", "matches"),
    link("prompt", "fail", "drifted", { fixer: "fieldquo", fix: "resync" }),
    link("events", "ok", "landing", { detail: { last: "2026-09-13T11:52:00.000Z" } }),
    link("forwarding", "unknown", "uncheckable", { fixer: "unknown" }),
  ];
  const transcript = (turns) => turns.map(([role, content]) => ({ role, content }));
  const calls = [
    { id: "vc_s01", providerCallId: "call_7c1e9a4b2d3f5e6a7b8c9d0e1f2a3b4c", direction: "inbound", fromE164: "+15145550137", toE164: SALES_E164, startedAt: "2026-09-13T11:48:12.000Z", endedAt: "2026-09-13T11:52:03.000Z", durationSec: 231, disposition: "user_hangup", summary: "Roofing contractor from Longueuil (Toiture Rive-Sud) calling back rep Ana. Asked whether the roof measurement works on the South Shore, what the Pro plan includes, and whether the quote can be in French. Agent answered all three and took a message for Ana to call back after 4pm.", recordingUrl: "https://recordings.retellai.com/call_7c1e9a4b2d3f5e6a7b8c9d0e1f2a3b4c.wav", transcript: transcript([
      ["agent", "Thanks for calling FieldQuo, this call is recorded. What trade are you in?"],
      ["user", "Roofing. I'm in Longueuil — I talked to Ana last week, she said you can measure a roof from the address?"],
      ["agent", "Yes — the roof measurement tool uses satellite imagery, so it works anywhere the imagery covers, which includes the South Shore. You put in the address and get the area and pitch back."],
      ["user", "And what does the Pro plan give me? I've got five guys."],
      ["agent", "Pro is $129 a month, 5 seats, unlimited quotes, and AI included. That includes the quote review and the roof measurement."],
      ["user", "Can the quotes be in French? Most of my clients are French."],
      ["agent", "Yes. A quote keeps the language it was created in, and the email that goes with it matches. Would you like Ana to call you back?"],
      ["user", "After four, yeah."],
      ["agent", "I'll pass that on. Thanks for calling."],
    ]) },
    { id: "vc_s02", providerCallId: "call_2b8d4f6a1c3e5d7f9a0b2c4d6e8f0a1b", direction: "inbound", fromE164: "+16045550122", toE164: SALES_E164, startedAt: "2026-09-12T22:14:40.000Z", endedAt: "2026-09-12T22:16:05.000Z", durationSec: 85, disposition: "agent_hangup", summary: "Painter in Vancouver asked if FieldQuo integrates with QuickBooks. Agent said it could not promise integrations and offered the contact page.", recordingUrl: null, transcript: "AGENT: Thanks for calling FieldQuo. What trade are you in?\nUSER: Painting. Do you sync with QuickBooks?\nAGENT: I can't promise any integration on this call — I can only speak to what's on the plans. Somebody on the team can answer that at fieldquo.com/contact, or I can take a message.\nUSER: I'll email. Bye." },
    { id: "vc_s03", providerCallId: "call_9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b", direction: "inbound", fromE164: null, toE164: SALES_E164, startedAt: "2026-09-12T15:03:11.000Z", endedAt: "2026-09-12T15:03:29.000Z", durationSec: 18, disposition: "dial_no_answer", summary: null, recordingUrl: null, transcript: null },
    { id: "vc_s04", providerCallId: "call_5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d", direction: "inbound", fromE164: "+14165550188", toE164: SALES_E164, startedAt: "2026-09-11T18:40:00.000Z", endedAt: "2026-09-11T18:47:22.000Z", durationSec: 442, disposition: "user_hangup", summary: "Flooring installer in Mississauga wanted to know if FieldQuo could look up his existing account balance. Agent explained it has no access to any company's data and offered the contact page. Caller then asked about the Business plan's seat count.", recordingUrl: "https://recordings.retellai.com/call_5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d.wav", transcript: transcript([
      ["agent", "Thanks for calling FieldQuo. What trade are you in?"],
      ["user", "Flooring. I'm already a customer — can you tell me what I owe this month?"],
      ["agent", "I can't — I don't have access to any company's account, so I can't look anything up. Your billing page in the app has it, or the team can help at fieldquo.com/contact."],
      ["user", "Fine. How many seats on Business?"],
      ["agent", "Business is $299 a month with 15 seats and unlimited quotes."],
    ]) },
    { id: "vc_s05", providerCallId: "call_1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c", direction: "inbound", fromE164: "+13065550166", toE164: SALES_E164, startedAt: "2026-09-10T14:20:00.000Z", endedAt: "2026-09-10T14:21:10.000Z", durationSec: 70, disposition: "user_hangup", summary: "Wrong number — caller was looking for a fuel company.", recordingUrl: null, transcript: "AGENT: Thanks for calling FieldQuo. What trade are you in?\nUSER: Is this Federated Co-op fuel?\nAGENT: No, this is FieldQuo, software for contractors.\nUSER: Sorry." },
    { id: "vc_s06", providerCallId: "call_8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f", direction: "inbound", fromE164: "+15875550109", toE164: SALES_E164, startedAt: "2026-09-09T19:05:00.000Z", endedAt: "2026-09-09T19:11:48.000Z", durationSec: 408, disposition: "user_hangup", summary: "Landscaper in Calgary asked about seasonal pricing, the crew texting feature, and whether the trial needs a card. Agent quoted the three plans and the free first month.", recordingUrl: "https://recordings.retellai.com/call_8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f.wav", transcript: transcript([
      ["agent", "Thanks for calling FieldQuo. What trade are you in?"],
      ["user", "Landscaping and snow. Do you do seasonal contracts?"],
      ["agent", "Quotes can be priced per season, and the receptionist can book recurring visits. The plans are Starter at $49, Pro at $129, and Business at $299 a month. The first month is free."],
      ["user", "What's crew texting?"],
      ["agent", "A number your crew texts photos and updates to, and FieldQuo files them against the job."],
    ]) },
  ];
  return {
    readiness: {
      links, overall: "ready_with_warnings", repairable: true, fixes: ["resync"],
      numberProblems: [],
      number: SALES_E164, numberDisplay: "+1 (888) 555-0190", numberVar: "FIELDQUO_SALES_NUMBER",
      enabled: true, providerAgentId: "agent_3f9a2b1c8d7e6f5a4b3c2d1e0f",
      transferTo: null, transferToDisplay: null, transferVar: "FIELDQUO_SALES_TRANSFER_TO",
      transferIsSharedTestNumber: false,
      calls: { count: 6, last: "2026-09-13T11:52:03.000Z" },
    },
    candidates: null,
    linkOrder: ["provider", "number", "agent", "engine", "binding", "switch", "webhook", "prompt", "events", "forwarding"],
    knowledge: {
      core: { categories: ["quotes", "jobs", "invoices", "scheduling", "clients", "website", "reports", "team"] },
      features: [
        { key: "ai_quote_review", label: "AI quote review", line: "A second pair of eyes on every quote before it goes out — catches missing line items and suggests add-ons.", state: "on", preview: false },
        { key: "voice_receptionist", label: "Receptionist", line: "An AI that answers the company's phone, books visits and takes messages, on the company's own number.", state: "on", preview: false },
        { key: "crew_inbox", label: "Crew texting", line: "A number the crew texts photos and updates to, filed against the job.", state: "on", preview: false },
        { key: "roof_measurement", label: "Roof measurement", line: "Measures a roof from the address, using satellite imagery.", state: "on", preview: false },
        { key: "website_builder", label: "Website builder", line: "A one-page site with the company's services, photos and booking link.", state: "on", preview: false },
        { key: "client_portal", label: "Client portal", line: "Homeowners see their quotes, invoices and visits in one place.", state: "on", preview: false },
        { key: "referrals", label: "Referrals", line: "A referral link that gives both sides a free month.", state: "preview", preview: true },
      ],
      plans: [
        { name: "Starter", priceMonthly: 49, maxUsers: 2, maxQuotesPerMonth: 25, aiCopilotEnabled: true, aiMonthlyTokenCap: 100_000, extras: [] },
        { name: "Pro", priceMonthly: 129, maxUsers: 5, maxQuotesPerMonth: null, aiCopilotEnabled: true, aiMonthlyTokenCap: 250_000, extras: ["priority support"] },
        { name: "Business", priceMonthly: 299, maxUsers: 15, maxQuotesPerMonth: null, aiCopilotEnabled: true, aiMonthlyTokenCap: null, extras: ["priority support", "custom domain"] },
      ],
      withheldPlanCount: 1,
      nothingSellable: false,
      trial: { price: 0, label: "first month free" },
    },
    prompt: SALES_PROMPT,
    greeting: "Thanks for calling FieldQuo — this call is recorded. What trade are you in?",
    notes: "Ask what trade they're in before anything else. Roofers care about the measurement tool; say that first for them. Keep it under two minutes unless they want more.",
    enabled: true,
    tools: [{ name: "end_call", type: "end_call" }],
    agentPayload: { agent_name: "FieldQuo sales line", voice_id: "11labs-Adrian", webhook_url: "https://app.fieldquo.com/api/voice/webhook" },
    contactUrl: "https://fieldquo.com/contact",
    calls,
  };
}

// ── /platform/crew-lines ───────────────────────────────────────────────────
const CREW_HOOK = "https://app.fieldquo.com/api/crew/inbound";
function crewLines() {
  const line = (e164, sid, extra) => ({ e164, sid, mms: true, smsUrl: CREW_HOOK, pointedHere: true, pointedSomewhere: true, missingAtProvider: false, drift: false, driftMessage: null, claim: null, purpose: null, assignedRepId: null, assignedRepName: null, assignedAdminId: null, assignedAdminName: null, ...extra });
  const claim = (c, extra = {}) => ({ companyId: c.id, companyName: c.name, enabled: true, source: "purchased", connectedAt: "2026-08-02T14:00:00.000Z", expiresAt: null, expired: false, ready: true, reason: null, opsMessage: "Connected — Twilio delivers to /api/crew/inbound and the signature verifies.", ...extra });
  const lines = [
    line("+14385550171", "PN2a4f6c8e0b1d3f5a7c9e1b3d5f7a9c1e", { claim: claim(company(1)) }),
    line("+16045550144", "PN9c1e3a5b7d9f1a3c5e7b9d1f3a5c7e9b", { claim: claim(company(2), { connectedAt: "2026-07-15T10:00:00.000Z" }), smsUrl: "https://fieldquo-git-feature-crew-photos-emilioboves.vercel.app/api/crew/inbound", pointedHere: false, drift: true, driftMessage: "Our row says connected and ready; Twilio is delivering this number's texts to https://fieldquo-git-feature-crew-photos-emilioboves.vercel.app/api/crew/inbound. Their crew's photos are landing in whatever deployment that is, not here." }),
    line("+19055550133", "PN4b6d8f0a2c4e6a8c0e2a4c6e8a0c2e4a", { claim: claim(company(5), { enabled: false, ready: false, reason: "company_disabled", opsMessage: "Company.crewInboxEnabled is false — the webhook drops their texts." }) }),
    line("+15195550158", "PN7e9a1c3e5a7c9e1a3c5e7a9c1e3a5c7e", { claim: claim(company(6)), mms: false }),
    line("+16135550119", "PN1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c", { claim: claim(company(7), { source: "shared_test", expiresAt: "2026-09-20T00:00:00.000Z" }) }),
    line("+17375550102", "PN8a0c2e4a6c8e0a2c4e6a8c0e2a4c6e8a", { purpose: "system", smsUrl: null, pointedHere: false, pointedSomewhere: false }),
    line("+18885550190", "PN3c5e7a9c1e3a5c7e9a1c3e5a7c9e1a3c", { purpose: "sales_voice", smsUrl: "https://app.fieldquo.com/api/sms/inbound", pointedHere: false, assignedRepId: "rep_ana", assignedRepName: REPS[0].name }),
    line("+14165550177", "PN6f8a0c2e4a6c8e0a2c4e6a8c0e2a4c6e", { purpose: "sales", smsUrl: "https://app.fieldquo.com/api/sms/inbound", pointedHere: false, assignedAdminId: "adm1", assignedAdminName: "emilio@fieldquo.com" }),
    line("+12505550165", "PN0b2d4f6a8c0e2a4c6e8a0c2e4a6c8e0a", {}),
  ];
  const orphans = [
    { ...line("+15145550199", "PN_released_by_hand_00000000000000", { mms: null, smsUrl: null, pointedHere: false, pointedSomewhere: false, missingAtProvider: true, claim: claim(company(8), { connectedAt: "2026-05-01T12:00:00.000Z", ready: false, reason: "missing_at_provider", opsMessage: "Twilio does not list this number." }) }) },
  ];
  return {
    salesReps: REPS.map((r) => ({ id: r.id, name: r.name })),
    platformAdmins: ADMINS.filter((a) => a.active).map((a) => ({ id: a.id, email: a.email })),
    deployment: {
      webhookUrl: CREW_HOOK,
      twilioConfigured: true,
      signatureConfigured: true,
      missingEnv: [],
      platformNumbers: [
        { id: "psn_1", e164: "+17375550102", purpose: "system", active: true, createdAt: "2026-06-01T00:00:00.000Z" },
        { id: "psn_2", e164: "+18885550190", purpose: "sales_voice", active: true, createdAt: "2026-07-20T00:00:00.000Z" },
        { id: "psn_3", e164: "+14165550177", purpose: "sales", active: true, createdAt: "2026-08-14T00:00:00.000Z" },
      ],
      sharedLineEnv: "+17372212163",
      sharedLineHeld: false,
      sharedLine: {
        state: "env_partly_live", tone: "warn",
        headline: "TWILIO_PHONE_NUMBER names +17372212163, which this account does not hold.",
        why: "The system From is now the bought number +17375550102, so outbound texts are fine — but no number has been bought with the “shared test line” purpose, and the env value still stands in for it. A contractor pressing “turn on crew texting” is offered a number Twilio will refuse.",
        action: "Buy a shared test line above, or unset TWILIO_PHONE_NUMBER in Vercel and redeploy so contractors are told honestly that there is nothing to lend.",
      },
    },
    numbersError: null,
    lines,
    orphans,
    counts: { held: lines.length, claimed: 5, free: lines.filter((l) => !l.claim).length, drifting: 1, orphaned: orphans.length },
  };
}

// ── /platform/voice-numbers ────────────────────────────────────────────────
function voiceNumbers() {
  const holder = (c, extra = {}) => ({ id: `vpn_${c.id}`, companyId: c.id, companyName: c.name, status: "active", source: "purchased", numberType: "local", monthlyCents: 1500, rentPaidThroughAt: "2026-10-01T00:00:00.000Z", releasedAt: null, createdAt: "2026-06-12T15:00:00.000Z", ...extra });
  const row = (e164, extra) => ({ e164, nickname: null, boundAgent: null, answering: false, tollFree: null, holder: null, unheld: false, fieldquoOwn: false, ownLabel: null, leak: false, unheldReason: null, lapsed: null, ...extra });
  const lines = [
    row("+18885550190", { nickname: "FieldQuo sales line", boundAgent: "agent_3f9a2b1c8d7e6f5a4b3c2d1e0f", answering: true, tollFree: true, unheld: true, fieldquoOwn: true, ownLabel: "sales", unheldReason: "fieldquo_own" }),
    row("+17375550118", { nickname: "shared receptionist test", boundAgent: null, answering: false, unheld: true, fieldquoOwn: true, ownLabel: "test", unheldReason: "fieldquo_own" }),
    row("+18445550127", { nickname: "toll-free bought by hand 2026-08", boundAgent: "agent_0a1b2c3d4e5f6a7b8c9d0e1f2a", answering: true, tollFree: true, unheld: true, leak: true, unheldReason: "no_row" }),
    row("+14185550153", { boundAgent: null, answering: false, unheld: true, leak: true, unheldReason: "marked_released", lapsed: holder(company(4), { status: "released", releasedAt: "2026-07-30T09:12:00.000Z" }) }),
    row("+15065550181", { boundAgent: null, answering: false, unheld: true, leak: true, unheldReason: "row_failed", lapsed: holder(company(8), { status: "failed" }) }),
    row("+14385550171", { boundAgent: "agent_7c8d9e0f1a2b3c4d5e6f7a8b9c", answering: true, holder: holder(company(1)) }),
    row("+16045550144", { boundAgent: "agent_2e3f4a5b6c7d8e9f0a1b2c3d4e", answering: true, holder: holder(company(2), { numberType: "toll-free", monthlyCents: 2500 }) }),
    row("+15195550158", { boundAgent: null, answering: false, holder: holder(company(6)) }),
    row("+16135550119", { boundAgent: "agent_9f0a1b2c3d4e5f6a7b8c9d0e1f", answering: true, holder: holder(company(7), { source: "ported", status: "porting", monthlyCents: 1500 }) }),
    row("+16135550120", { boundAgent: "agent_9f0a1b2c3d4e5f6a7b8c9d0e1f", answering: true, holder: holder(company(7), { id: "vpn_gs2", numberType: "toll-free", monthlyCents: 2500, createdAt: "2026-08-30T12:00:31.000Z" }) }),
    row("+19055550133", { boundAgent: "agent_4d5e6f7a8b9c0d1e2f3a4b5c6d", answering: true, holder: holder(company(5)) }),
  ];
  const orphans = [
    { ...holder(company(3)), e164: "+15145550140", billingRent: true },
    { ...holder(company(0), { status: "provisioning", createdAt: "2026-09-12T20:00:00.000Z" }), e164: "+14505550112", billingRent: false },
  ];
  const unheld = lines.filter((l) => l.unheld);
  const leaks = lines.filter((l) => l.leak);
  return {
    deployment: { voiceConfigured: true, missingEnv: [], listComplete: true, salesNumberVar: "FIELDQUO_SALES_NUMBER", salesNumberSet: true },
    providerError: null,
    lines,
    orphans,
    counts: {
      atProvider: lines.length, held: lines.length - unheld.length, unheld: unheld.length,
      fieldquoOwn: unheld.length - leaks.length, leak: leaks.length,
      markedReleased: unheld.filter((l) => l.unheldReason === "marked_released").length,
      orphaned: orphans.length, orphanedAndBilling: orphans.filter((o) => o.billingRent).length,
    },
    checkedAt: "2026-09-13T12:00:00.000Z",
    multiHolders: [
      { companyId: company(7).id, companyName: company(7).name, numbers: [
        { e164: "+16135550119", status: "porting", source: "ported", numberType: "local", monthlyCents: 1500, createdAt: "2026-08-30T12:00:00.000Z", atProvider: true },
        { e164: "+16135550120", status: "active", source: "purchased", numberType: "toll-free", monthlyCents: 2500, createdAt: "2026-08-30T12:00:31.000Z", atProvider: true },
      ] },
      { companyId: company(3).id, companyName: company(3).name, numbers: [
        { e164: "+15145550140", status: "active", source: "purchased", numberType: "local", monthlyCents: 1500, createdAt: "2026-06-12T15:00:00.000Z", atProvider: false },
        { e164: "+15145550141", status: "provisioning", source: "purchased", numberType: "local", monthlyCents: 1500, createdAt: "2026-09-01T09:00:00.000Z", atProvider: false },
      ] },
    ],
  };
}

// ── /platform/voice-webhooks ───────────────────────────────────────────────
function voiceWebhooks() {
  const expected = "https://app.fieldquo.com/api/voice/webhook";
  const ok = (agentId) => ({ agentId, holds: expected, state: "ok", reason: "matches" });
  const wrong = (agentId, holds, reason = "points_elsewhere") => ({ agentId, holds, state: "wrong", reason });
  const rows = [
    { companyId: company(2).id, companyName: company(2).name, recoveredCalls: 14, agents: [wrong("agent_2e3f4a5b6c7d8e9f0a1b2c3d4e", "https://fieldquo-git-feature-voice-retry-emilioboves.vercel.app/api/voice/webhook"), wrong("agent_out_2e3f4a5b6c7d8e9f0a1b2c3d", null, "never_set")] },
    { companyId: company(7).id, companyName: company(7).name, recoveredCalls: 6, agents: [wrong("agent_9f0a1b2c3d4e5f6a7b8c9d0e1f", "http://localhost:3000/api/voice/webhook"), ok("agent_out_9f0a1b2c3d4e5f6a7b8c9d0e")] },
    { companyId: company(1).id, companyName: company(1).name, recoveredCalls: 2, agents: [ok("agent_7c8d9e0f1a2b3c4d5e6f7a8b9c"), ok("agent_out_7c8d9e0f1a2b3c4d5e6f7a8b")] },
    { companyId: company(5).id, companyName: company(5).name, recoveredCalls: 0, agents: [wrong("agent_4d5e6f7a8b9c0d1e2f3a4b5c6d", "", "empty")] },
    { companyId: company(6).id, companyName: company(6).name, recoveredCalls: 0, agents: [ok("agent_bw_1a2b3c4d5e6f7a8b9c0d1e2f3a")] },
    { companyId: company(0).id, companyName: company(0).name, recoveredCalls: 0, agents: [ok("agent_er_5f6a7b8c9d0e1f2a3b4c5d6e7f"), ok("agent_out_er_5f6a7b8c9d0e1f2a3b4c5d6e")] },
    { companyId: company(8).id, companyName: company(8).name, recoveredCalls: 0, agents: [{ agentId: "agent_se_0e1f2a3b4c5d6e7f8a9b0c1d2e", holds: null, state: "unknown", reason: "unreadable", problem: { kind: "not_found", message: "Retell answered 404 — it has no agent with this id. Our row names an agent the provider does not hold." } }] },
    { companyId: company(3).id, companyName: company(3).name, recoveredCalls: 0, agents: [ok("agent_ed_3b4c5d6e7f8a9b0c1d2e3f4a5b")] },
  ];
  const verdicts = rows.flatMap((r) => r.agents);
  const count = (s) => verdicts.filter((v) => v.state === s).length;
  return {
    configured: true, expected, originStable: true, canRepair: true, repairRefusedBecause: null,
    summary: { total: verdicts.length, ok: count("ok"), wrong: count("wrong"), unknown: count("unknown"), healthy: false },
    rows,
  };
}

// ── /platform/voice-economics ──────────────────────────────────────────────
function voiceEconomics(days) {
  const scale = days / 30;
  const callCount = Math.round(412 * scale);
  const minutes = Math.round(1873.4 * scale * 10) / 10;
  const callRevenue = Math.round(minutes * 25);
  const callCost = Math.round(minutes * 9.8);
  const numberRevenue = 11 * 1500 + 2 * 1000;
  const numberCost = 13 * 200;
  const concurrencyCents = 2 * 800;
  const knowledgeBaseCents = 3 * 500;
  const revenue = callRevenue + numberRevenue;
  const cost = callCost + numberCost + concurrencyCents + knowledgeBaseCents;
  const marginPerMinute = minutes > 0 ? (callRevenue - callCost) / minutes : null;
  return {
    revenueCents: revenue, costCents: cost, marginCents: revenue - cost,
    marginPct: Math.round(((revenue - cost) / revenue) * 1000) / 10,
    calls: { count: callCount, revenueCents: callRevenue, costCents: callCost, uncosted: Math.max(1, Math.round(7 * scale)) },
    numbers: { count: 13, revenueCents: numberRevenue, costCents: numberCost },
    fixed: { concurrencyLimit: 22, paidSlots: 2, concurrencyCents, knowledgeBases: 3, knowledgeBaseCents },
    incomplete: true,
    days,
    minutes,
    chargedCentsPerMinute: 25,
    marginCentsPerMinute: marginPerMinute === null ? null : Math.round(marginPerMinute * 10) / 10,
    slotBreakEvenMinutes: marginPerMinute ? Math.ceil(800 / marginPerMinute) : null,
    concurrencyProblem: null,
    emptyNote: null,
    concurrency: { inUse: 5, limit: 22, burstEnabled: false },
  };
}

// ── /platform/audit-log ────────────────────────────────────────────────────
const AUDIT = [
  { id: "al_01", action: "impersonation_started", platformAdminId: "adm1", targetCompanyId: company(1).id, details: { reason: "Support ticket tk_01 — checking the sender verification state", mode: "read_only", ip: "2607:fea8:1e40:9c00:5d2a:9b3f:7e11:c04d" }, createdAt: "2026-09-13T13:05:44.000Z" },
  { id: "al_02", action: "ai_cap_changed", platformAdminId: "adm1", targetCompanyId: company(0).id, details: { cap: 400000, previous: 250000 }, createdAt: "2026-09-13T12:41:02.000Z" },
  { id: "al_03", action: "feedback_updated", platformAdminId: "adm2", targetCompanyId: company(8).id, details: { feedbackId: "fb_09", status: "resolved", subject: "Invoice reminder went out twice on the same morning" }, createdAt: "2026-09-12T19:20:15.000Z" },
  { id: "al_04", action: "trial_extended", platformAdminId: "adm4", targetCompanyId: company(5).id, details: { days: 14, until: "2026-10-04", reason: "Owner asked for time to import the price book" }, createdAt: "2026-09-12T16:03:30.000Z" },
  { id: "al_05", action: "sales_number_assigned", platformAdminId: "adm1", targetCompanyId: null, details: { e164: "+18885550190", salesRepId: "rep_ana", salesRepName: REPS[0].name }, createdAt: "2026-09-12T14:12:09.000Z" },
  { id: "al_06", action: "company_suspended", platformAdminId: "adm6", targetCompanyId: "cmp_gone", details: { reason: "Chargeback on the subscription, three failed retries", previousStatus: "active" }, createdAt: "2026-09-11T22:48:00.000Z" },
  { id: "al_07", action: "demo_login_created", platformAdminId: "adm2", targetCompanyId: "cmp_demo3", details: { email: "demo3@fieldquo.com", forRep: REPS[3].name }, createdAt: "2026-09-11T15:30:00.000Z" },
  { id: "al_08", action: "promo_code_created", platformAdminId: "adm1", targetCompanyId: null, details: { code: "TORONTO-HOMESHOW-2026-FALL", percentOff: 20, maxRedemptions: 200, expiresAt: "2026-11-30" }, createdAt: "2026-09-10T18:00:00.000Z" },
  { id: "al_09", action: "impersonation_ended", platformAdminId: "adm3", targetCompanyId: company(2).id, details: { durationSec: 412 }, createdAt: "2026-09-10T17:25:12.000Z" },
  { id: "al_10", action: "impersonation_started", platformAdminId: "adm3", targetCompanyId: company(2).id, details: { reason: "Payout stuck — reading the Stripe Connect state", mode: "read_only" }, createdAt: "2026-09-10T17:18:20.000Z" },
  { id: "al_11", action: "feature_override_set", platformAdminId: "adm1", targetCompanyId: company(6).id, details: { feature: "voice_receptionist", state: "on", previous: "preview" }, createdAt: "2026-09-09T20:14:00.000Z" },
  { id: "al_12", action: "platform_admin_created", platformAdminId: "adm1", targetCompanyId: null, details: { email: "alexandre.beaulieu-tremblay.contractor@fieldquo.com", role: "support" }, createdAt: "2026-08-14T15:45:00.000Z" },
  { id: "al_13", action: "migration_quoted", platformAdminId: "adm1", targetCompanyId: company(1).id, details: { migrationId: "mig_1", amountCents: 45000, currency: "CAD" }, createdAt: "2026-08-12T13:00:00.000Z" },
  { id: "al_14", action: "sales_rep_deactivated", platformAdminId: "adm6", targetCompanyId: null, details: { salesRepId: "rep_old", name: "Former Rep Who Left" }, createdAt: "2026-08-05T11:11:11.000Z" },
  { id: "al_15", action: "plan_updated", platformAdminId: "adm1", targetCompanyId: null, details: { planId: "plan_pro", changed: { priceMonthly: [119, 129] } }, createdAt: "2026-08-01T09:00:00.000Z" },
  { id: "al_16", action: "something_this_console_cannot_name", platformAdminId: "adm6", targetCompanyId: company(4).id, details: {}, createdAt: "2026-07-28T08:00:00.000Z" },
  { id: "al_17", action: "company_created", platformAdminId: "adm1", targetCompanyId: company(8).id, details: { via: "signup form", plan: "trial" }, createdAt: "2026-07-20T14:30:00.000Z" },
  { id: "al_18", action: "signup_reviewed", platformAdminId: "adm4", targetCompanyId: company(7).id, details: { verdict: "genuine", flags: ["disposable_email"] }, createdAt: "2026-07-18T10:05:00.000Z" },
];
function auditLog(url) {
  const action = url.searchParams.get("action");
  const adminId = url.searchParams.get("adminId");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const PAGE_SIZE = 50;
  const filtered = AUDIT.filter((r) => (!action || r.action === action) && (!adminId || r.platformAdminId === adminId));
  const total = filtered.length + (action || adminId ? 0 : 1_183); // the DB holds more than one page
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => {
    const admin = ADMINS.find((a) => a.id === r.platformAdminId);
    return {
      ...r,
      platformAdmin: admin ? { id: admin.id, email: admin.email, role: admin.role } : null,
      targetCompanyName: r.targetCompanyId ? COMPANIES.find((c) => c.id === r.targetCompanyId)?.name || "(deleted company)" : null,
    };
  });
  return {
    rows, total, page, pageSize: PAGE_SIZE, pageCount,
    filters: { actions: [...new Set(AUDIT.map((r) => r.action))].sort(), admins: ADMINS.map((a) => ({ id: a.id, email: a.email })) },
  };
}

// ── /platform/service-categories ───────────────────────────────────────────
const CATEGORIES = [
  ["interior_painting", "Interior painting", "Walls, ceilings, trim and doors inside the home", "paintbrush"],
  ["exterior_painting", "Exterior painting", "Siding, stucco, decks and fences", "paintbrush"],
  ["cabinet_refinishing", "Cabinet refinishing", "Doors and drawer fronts stripped, sprayed and reinstalled", "layers"],
  ["cabinet_refacing", "Cabinet refacing", "New doors and veneer over the existing boxes", "layers"],
  ["countertop", "Countertops", "Quartz, granite and laminate supply and install", "square"],
  ["hardwood_flooring", "Hardwood flooring", "Solid and engineered hardwood supply, install and refinishing — including stairs and transitions", "grid"],
  ["laminate_vinyl_flooring", "Laminate & vinyl plank flooring", "Click-lock laminate and LVP", "grid"],
  ["tile", "Tile", "Floor and wall tile, backsplash, shower surrounds", "grid"],
  ["roofing", "Roofing", "Asphalt shingle, metal and flat roof replacement and repair", "home"],
  ["plumbing", "Plumbing", "Repairs, fixtures, water heaters, drain cleaning", "droplet"],
  ["hvac", "Heating & cooling", "Furnace, heat pump and AC install and service", "thermometer"],
  ["electrical", "Electrical", "Panels, EV chargers, lighting, rewiring", "zap"],
  ["landscaping", "Landscaping", "Design, planting, sod, interlock and retaining walls", "leaf"],
  ["snow_removal", "Snow removal", "Seasonal residential and commercial contracts", "snowflake"],
  ["drywall", "Drywall & taping", "Board, tape, mud and texture", "square"],
  ["handyman", "Handyman", "Small repairs and odd jobs", "wrench"],
  ["cleaning", "Cleaning", "Residential deep cleans, move-out and post-construction", "sparkles"],
].map(([key, label, description, icon], i) => ({
  id: `sc_${key}`, key, label,
  labelTranslations: { fr: label, es: label },
  description, icon, sortOrder: (i + 1) * 10, isSystem: true, companyId: null,
  createdAt: "2026-01-04T14:02:11.000Z", updatedAt: "2026-06-01T00:00:00.000Z",
}));

// ── /platform/demo + /platform/demo/assign ─────────────────────────────────
function demoPool() {
  const demo = (i, slug, industry, name, brandColor, extra = {}) => ({
    id: `cmp_demo${i}`, name, slug, demoIndustry: industry, brandColor,
    sitePublished: i % 2 === 1, site: i % 2 === 1 ? { id: `site_demo${i}` } : null,
    members: i <= 4 ? [{ role: "owner", user: { email: `${slug}@fieldquo.com` } }] : [],
    _count: { quotes: 6 + i, jobs: 3 + i, clients: 9 + i },
    salesRepDemo: null,
    ...extra,
  });
  const demos = [
    demo(1, "demo1", "painting", "Northside Painting Co.", "#1E5F8C", { salesRepDemo: { id: "rep_ana", name: REPS[0].name, email: REPS[0].email } }),
    demo(2, "demo2", "cabinets", "Érable Design Cabinetry", "#8C5A2B", { salesRepDemo: { id: "rep_marc", name: REPS[1].name, email: REPS[1].email } }),
    demo(3, "demo3", "flooring", "Lakeshore Hardwood & Tile Installations Limited", "#2F6B4F"),
    demo(4, "demo4", "landscaping", "Evergreen Landscape Design & Maintenance", "#3B7A2A"),
    demo(5, "demo5", "plumbing", "Bluewater Plumbing Co.", "#1F4E79"),
    demo(6, "demo6", "roofing", "Summit Roofing", "#7A2E2E"),
    demo(7, "demo7", null, "demo7 (no trade set)", null, { _count: { quotes: 0, jobs: 0, clients: 0 } }),
  ];
  const repDemos = [
    { id: "cmp_rd1", name: "Ana's Painting Demo — Northside Painting Co.", slug: "rep-ana-painting", isDemo: true, authOrgId: "org_rd1", demoIndustry: "painting", demoOwnerRepId: "rep_ana", demoRepSlot: 1, demoRetiredAt: null, createdAt: "2026-08-20T00:00:00.000Z", demoOwnerRep: { id: "rep_ana", name: REPS[0].name, email: REPS[0].email }, _count: { quotes: 12, jobs: 5, clients: 14 } },
    { id: "cmp_rd2", name: "Ana's Roofing Demo — Summit Roofing", slug: "rep-ana-roofing", isDemo: true, authOrgId: "org_rd1", demoIndustry: "roofing", demoOwnerRepId: "rep_ana", demoRepSlot: 2, demoRetiredAt: null, createdAt: "2026-08-22T00:00:00.000Z", demoOwnerRep: { id: "rep_ana", name: REPS[0].name, email: REPS[0].email }, _count: { quotes: 8, jobs: 3, clients: 9 } },
    { id: "cmp_rd3", name: "Marc-Antoine — Érable Design Cabinetry", slug: "rep-marc-cabinets", isDemo: true, authOrgId: null, demoIndustry: "cabinets", demoOwnerRepId: "rep_marc", demoRepSlot: 1, demoRetiredAt: null, createdAt: "2026-09-01T00:00:00.000Z", demoOwnerRep: { id: "rep_marc", name: REPS[1].name, email: REPS[1].email }, _count: { quotes: 4, jobs: 2, clients: 6 } },
    { id: "cmp_rd4", name: "Devendra — Bluewater Plumbing Co.", slug: "rep-dev-plumbing", isDemo: true, authOrgId: "org_rd4", demoIndustry: "plumbing", demoOwnerRepId: "rep_dev", demoRepSlot: 1, demoRetiredAt: null, createdAt: "2026-09-03T00:00:00.000Z", demoOwnerRep: { id: "rep_dev", name: REPS[2].name, email: REPS[2].email }, _count: { quotes: 6, jobs: 4, clients: 7 } },
    { id: "cmp_rd5", name: "Samantha — Evergreen Landscape (retired copy)", slug: "rep-sam-landscaping-1", isDemo: true, authOrgId: "org_rd5", demoIndustry: "landscaping", demoOwnerRepId: "rep_sam", demoRepSlot: 1, demoRetiredAt: "2026-09-08T16:00:00.000Z", createdAt: "2026-08-25T00:00:00.000Z", demoOwnerRep: { id: "rep_sam", name: REPS[3].name, email: REPS[3].email }, _count: { quotes: 3, jobs: 1, clients: 4 } },
    { id: "cmp_rd6", name: "Samantha — Evergreen Landscape Design & Maintenance", slug: "rep-sam-landscaping-2", isDemo: true, authOrgId: "org_rd5", demoIndustry: "landscaping", demoOwnerRepId: "rep_sam", demoRepSlot: 1, demoRetiredAt: null, createdAt: "2026-09-08T16:00:01.000Z", demoOwnerRep: { id: "rep_sam", name: REPS[3].name, email: REPS[3].email }, _count: { quotes: 2, jobs: 1, clients: 3 } },
  ];
  const industries = [
    ["painting", "Painting", "Northside Painting Co.", "#1E5F8C", 3],
    ["cabinets", "Cabinet refinishing", "Érable Design Cabinetry", "#8C5A2B", 3],
    ["flooring", "Flooring", "Lakeshore Hardwood & Tile", "#2F6B4F", 3],
    ["landscaping", "Landscaping", "Evergreen Landscape Design", "#3B7A2A", 2],
    ["cleaning", "Cleaning", "Spotless Home Services", "#4A6FA5", 1],
    ["plumbing", "Plumbing", "Bluewater Plumbing Co.", "#1F4E79", 2],
    ["hvac", "Heating & cooling", "Comfort Air Systems", "#B5451B", 1],
    ["roofing", "Roofing", "Summit Roofing", "#7A2E2E", 1],
    ["electrical", "Electrical", "Bright Line Electric", "#C48A1A", 1],
    ["handyman", "Handyman", "Fix-It Fred", "#556B2F", 1],
  ].map(([key, label, co, brandColor, categories]) => ({ key, label, company: co, brandColor, categories }));
  return { repDemos, demos, industries };
}
const DEMO_REPS = { reps: REPS.map((r, i) => ({ id: r.id, name: r.name, email: r.email, demoCompanyId: i < 2 ? `cmp_demo${i + 1}` : null })) };

// ── /platform/demos ────────────────────────────────────────────────────────
function demoBookings() {
  const b = (id, name, email, companyName, phone, notes, scheduledAt, status, hostAdminId = "adm1") => ({ id, name, email, companyName, phone, notes, scheduledAt, status, source: "marketing_site", createdAt: "2026-09-01T00:00:00.000Z", hostAdminId });
  return {
    upcoming: [
      b("db_01", "Jean-François Beauchemin", "jean-francois.beauchemin@toiture-rive-sud-beauchemin.com", "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", "+14385550171", "Veut voir la mesure de toiture et les soumissions en français. 12 employés, 3 camions.", "2026-09-14T18:30:00.000Z", "booked"),
      b("db_02", "Priya Raghunathan", "priya@precisionpaintingvancouver.ca", "Precision Painting & Decorating of Greater Vancouver Ltd.", "+16045550144", null, "2026-09-15T21:00:00.000Z", "booked", "adm2"),
      b("db_03", "Kevin O'Donnell-Mackenzie", "kevin@greenscapeottawa.com", "GreenScape Landscaping and Snow Removal — Ottawa/Gatineau", null, "Interested in the receptionist for the snow season — wants to know if it can handle 200 calls on a storm day.", "2026-09-16T14:00:00.000Z", "booked"),
      b("db_04", "Raj Patel", "raj@hardwoodmississauga.ca", "Hardwood & Laminate Flooring Installers of Mississauga–Brampton", "+19055550133", null, "2026-09-17T15:30:00.000Z", "booked", "adm4"),
      b("db_05", "Dorothée Lachance-Bergeron", "dorothee@erabledesign.ca", "Érable Design Cabinetry", "+15145550140", "Already trialing; wants a walkthrough of job costing.", "2026-09-18T17:00:00.000Z", "booked"),
      b("db_06", "Tomasz Wiśniewski", "t.wisniewski@outlook.com", null, "+14165550177", null, "2026-09-21T13:00:00.000Z", "booked", "adm2"),
      b("db_07", "Samuel Whitehorse", "sam@sunsetelectrical.ca", "Sunset Electrical Contractors", "+15875550109", "EV charger installs — asked about permits on the quote.", "2026-09-23T19:00:00.000Z", "booked"),
    ],
    past: [
      b("db_08", "Marie-Ève Tremblay", "marie-eve.tremblay@northsidepainting.co", "Northside Painting Co.", "+15145550199", "Signed up on the call.", "2026-09-10T15:00:00.000Z", "completed"),
      b("db_09", "Owen Abernathy", "owen.abernathy@bluewaterplumbing.ca", "Bluewater Plumbing, Heating & Drain Cleaning Services Inc.", "+15195550158", null, "2026-09-09T18:00:00.000Z", "completed", "adm4"),
      b("db_10", "no-show@example.com", "no-show@example.com", null, null, null, "2026-09-08T16:00:00.000Z", "cancelled"),
      b("db_11", "Linda Chang", "linda.chang@maplecabinets.ca", "Maple Ridge Custom Cabinets", "+16045550122", "Rescheduled twice.", "2026-09-04T20:00:00.000Z", "cancelled", "adm2"),
      b("db_12", "Gurpreet Singh Dhillon", "gsdhillon@dhillonflooring.ca", "Dhillon Flooring & Stairs", "+16045550166", null, "2026-09-02T17:30:00.000Z", "completed"),
      b("db_13", "Test Booking", "qa@fieldquo.com", "FieldQuo QA", null, "Internal test of the booking flow.", "2026-08-28T14:00:00.000Z", "wont_show_up_in_enum"),
    ],
  };
}

// ── /platform/demo-availability ────────────────────────────────────────────
function demoAvailability() {
  const w = (adminId, i, dayOfWeek, startTime, endTime, timezone = "America/Toronto") => ({ id: `dha_${adminId}_${i}`, dayOfWeek, startTime, endTime, timezone });
  const admins = ADMINS.map((a) => {
    const rows =
      a.id === "adm1" ? [w(a.id, 1, 1, "09:00", "12:00"), w(a.id, 2, 1, "13:00", "17:00"), w(a.id, 3, 2, "09:00", "17:00"), w(a.id, 4, 3, "09:00", "12:00"), w(a.id, 5, 4, "09:00", "17:00"), w(a.id, 6, 5, "09:00", "15:00")]
      : a.id === "adm2" ? [w(a.id, 1, 1, "10:00", "16:00"), w(a.id, 2, 3, "10:00", "16:00"), w(a.id, 3, 5, "10:00", "14:00")]
      : a.id === "adm4" ? [w(a.id, 1, 2, "08:00", "12:00", "America/Vancouver"), w(a.id, 2, 4, "08:00", "12:00", "America/Vancouver"), w(a.id, 3, 6, "09:00", "13:00", "America/Toronto")]
      : a.id === "adm6" ? [w(a.id, 1, 0, "13:00", "17:00", "Europe/Lisbon")]
      : [];
    return { id: a.id, email: a.email, role: a.role, active: a.active, demoAvailability: rows };
  });
  return { admins, me: { id: "adm1", email: "emilio@fieldquo.com", role: "superadmin", active: true } };
}

// ── Scenes ────────────────────────────────────────────────────────────────
// Each one presses a shipped control; nothing here draws anything staff could
// not reach by tapping the same thing.
const clickButtonWithText = async (until, text) => {
  await until("button");
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(text));
  if (!btn) throw new Error(`scene: no button containing "${text}"`);
  btn.click();
};
const openAllDetails = () => document.querySelectorAll("details").forEach((d) => { d.open = true; });

export const scenes = {
  "/platform/support": {
    // The first ticket in the queue (urgent, oldest) expanded to its thread.
    open: async ({ until, settled }) => {
      await clickButtonWithText(until, TICKETS[0].subject.slice(0, 40));
      await settled();
      await until("textarea");
    },
  },
  "/platform/jennifer": {
    // The oldest escalated conversation opened in the reading pane.
    open: async ({ until, settled }) => {
      await clickButtonWithText(until, "Money moving — a refund of a duplicate deposit payment");
      await settled();
      await until("textarea");
    },
  },
  "/platform/sales-agent": {
    // The most recent call expanded to its transcript.
    open: async ({ until, settled }) => {
      await clickButtonWithText(until, "+15145550137");
      await settled();
      await until("ol");
    },
  },
  "/platform/errors": {
    // Every row's Detail disclosure opened.
    open: async ({ until, wait }) => { await until("details"); openAllDetails(); await wait(200); },
  },
  "/platform/audit-log": {
    open: async ({ until, wait }) => { await until("details"); openAllDetails(); await wait(200); },
  },
  "/platform/feedback": {
    // The Internal notes disclosure on every card.
    open: async ({ until, wait }) => { await until("details"); openAllDetails(); await wait(200); },
  },
};

// ── The answer ────────────────────────────────────────────────────────────
export default function answer({ method, path, url, body }) {
  // /platform/support
  if (path === "/api/platform/support") return supportList(url.searchParams.get("status"));
  let m = path.match(/^\/api\/platform\/support\/([^/]+)$/);
  if (m) {
    const detail = supportDetail(decodeURIComponent(m[1]));
    if (!detail) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    return detail;
  }

  // /platform/feedback
  if (path === "/api/platform/feedback") {
    if (method === "PATCH") return { ...FEEDBACK.find((r) => r.id === body?.id), ...body };
    return feedbackList(url.searchParams.get("status"));
  }

  // /platform/jennifer
  if (path === "/api/platform/jennifer/conversations") return jenniferList(url.searchParams.get("status") || "escalated");
  m = path.match(/^\/api\/platform\/jennifer\/conversations\/([^/]+)$/);
  if (m) {
    const detail = jenniferDetail(m[1]);
    if (!detail) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    return detail;
  }

  // /platform/data-deletion
  if (path === "/api/platform/data-deletion") return deletionList(url.searchParams.get("status"));
  m = path.match(/^\/api\/platform\/data-deletion\/([^/]+)\/complete$/);
  if (m && method === "POST") return { ok: true, noAddress: false };

  // /platform/errors
  if (path === "/api/platform/errors") return method === "PATCH" ? { ok: true, resolved: body?.ids?.length || 0 } : errorsList(url);

  // /platform/ai-usage
  if (path === "/api/platform/ai-usage") return method === "PATCH" ? { id: body?.companyId, name: "", aiMonthlyTokenCap: body?.cap ?? null } : aiUsage();

  // /platform/sales-agent
  if (path === "/api/platform/sales-agent") return method === "POST" ? { ok: true, provision: { ok: true } } : salesAgent();

  // /platform/crew-lines
  if (path === "/api/platform/crew-lines") {
    if (method === "POST") {
      if (body?.action === "search") return { ok: true, searched: { areaCode: body.areaCode || null, region: body.region || null }, numbers: [
        { e164: "+13435550101", locality: "Ottawa", region: "ON", mms: true },
        { e164: "+13435550102", locality: "Ottawa", region: "ON", mms: true },
        { e164: "+13435550103", locality: "Kanata", region: "ON", mms: false },
      ] };
      return { ok: true };
    }
    return crewLines();
  }

  // /platform/voice-numbers
  if (path === "/api/platform/voice-numbers") return voiceNumbers();

  // /platform/voice-webhooks
  if (path === "/api/platform/voice-webhooks") return method === "POST" ? { repaired: 4, alreadyOk: 8, failed: 0 } : voiceWebhooks();

  // /platform/voice-economics
  if (path === "/api/platform/voice-economics") return voiceEconomics(Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30)));

  // /platform/audit-log
  if (path === "/api/platform/audit-log") return auditLog(url);

  // /platform/service-categories
  if (path === "/api/platform/service-categories") {
    if (method === "POST") return new Response(JSON.stringify({ id: `sc_${body?.key}`, ...body, isSystem: true, companyId: null }), { status: 201, headers: { "Content-Type": "application/json" } });
    return CATEGORIES;
  }

  // /platform/team
  if (path === "/api/platform/admins") return method === "POST" ? { id: "adm_new", ...body, active: true, createdAt: "2026-09-13T12:00:00.000Z" } : ADMINS;
  m = path.match(/^\/api\/platform\/admins\/([^/]+)$/);
  if (m) return { ...ADMINS.find((a) => a.id === m[1]), ...body };

  // /platform/demo
  if (path === "/api/platform/demo") return method === "GET" ? demoPool() : { ok: true };
  if (path === "/api/platform/demo/assign") return method === "GET" ? DEMO_REPS : { ok: true };
  if (path === "/api/platform/demo/login" && method === "POST") return { ok: true, email: "demo3@fieldquo.com" };

  // /platform/demos
  if (path === "/api/platform/demos") return method === "PATCH" ? { id: body?.id, status: body?.status } : demoBookings();

  // /platform/demo-availability
  if (path === "/api/platform/demo-availability") return method === "PUT" ? { adminId: body?.adminId, windows: body?.windows || [] } : demoAvailability();

  return undefined;
}
