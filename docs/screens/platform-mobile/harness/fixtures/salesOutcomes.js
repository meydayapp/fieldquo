// Fixtures for the call-outcomes screen and the owner's read of reps'
// conversations — see index.js for the contract.
//
// Routes answered here, and the screens they feed:
//   /api/platform/sales/outcomes/callbacks          → /platform/sales/outcomes (the callback agenda)
//   /api/platform/sales/outcomes/settings           → /platform/sales/outcomes (sub-reasons and settings)
//   /api/platform/sales/conversations?repId=&q=      → /platform/sales/conversations
//   /api/platform/sales/conversations/{sms,email}/…  → the thread it opens
//   /api/platform/sales/conversations/unowned        → the "texts nobody could file" card
//
// The settings payload is built from the shipped PURE tables — outcome
// settings at their defaults (outcomeSettingsTable(outcomeDefaults())) and
// the sub-reason lists as effectiveSubDispositions(null) gives them — so the
// rows, bounds and costs the screen prints are production's own. The
// callback agenda is lib/sales/calls/callbackAgenda.js's state rule and
// grouping, ported in miniature over invented rows (that module reaches the
// push sender and lib/db). Conversations are written out, in the shape
// lib/sales/conversationAudit.js returns.
//
// Dates: relative to Date.now() — the agenda is "due", "overdue", "past a
// day" against the clock.
import { AMD_USD_PER_CALL, outcomeDefaults, outcomeSettingsTable } from "@/lib/sales/calls/outcomeSettings";
import { DEFAULT_SUB_DISPOSITIONS, SUB_DISPOSITION_CODES, effectiveSubDispositions } from "@/lib/sales/calls/subDispositions";

// lib/sales/calls/callbackAgenda.js's callbackState and OVERDUE_FLAG_MS,
// ported: that module imports the push sender, the queue and the store,
// which have no place in a browser bundle. scripts/check-sales-outcomes.mjs
// executes the real one; these are its three thresholds.
const OVERDUE_FLAG_MS = 24 * 60 * 60 * 1000;
function callbackState(row, now) {
  const at = new Date(row.callbackAt);
  const age = now.getTime() - at.getTime();
  if (age < 0) return { state: "upcoming", ageMs: age };
  if (age >= OVERDUE_FLAG_MS) return { state: "flagged", ageMs: age };
  if (age >= 60 * 60 * 1000) return { state: "overdue", ageMs: age };
  return { state: "due", ageMs: age };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.now();
const iso = (t) => new Date(t).toISOString();

const REPS = [
  { id: "rep_ana", name: "Ana-Sophie Roy-Beauchemin", email: "ana-sophie.roy-beauchemin@gmail.com", active: true, endedAt: null },
  { id: "rep_ben", name: "Benjamin Okafor-Williams", email: "benjamin.okafor.williams@outlook.com", active: true, endedAt: null },
  { id: "rep_old", name: "Chris Lalonde", email: "chris.lalonde@example.com", active: false, endedAt: "2026-08-29T17:00:00.000Z" },
];
const repName = (id) => REPS.find((r) => r.id === id)?.name || null;

// ═══════════════════════════════════════════════════════════════════════════
// The callback agenda
// ═══════════════════════════════════════════════════════════════════════════

const CALLBACK_ROWS = [
  { id: "cb_1", at: NOW + 2 * HOUR, promisedBy: "rep_ana", deliveredTo: "rep_ana", scope: "personal", business: "Toitures Beauchemin & Fils", e164: "+14505550188", note: "Call back after 2 — the owner is on a roof all morning" },
  { id: "cb_2", at: NOW - 20 * MIN, promisedBy: "rep_ben", deliveredTo: "rep_ben", scope: "personal", business: "Greater Toronto Area Hardwood Flooring Installations Ltd.", e164: "+14165550133", note: null, notifiedAt: NOW - 20 * MIN },
  { id: "cb_3", at: NOW - 3 * HOUR, promisedBy: "rep_old", deliveredTo: "rep_ana", scope: "global", business: "Peinture Résidentielle de Saint-Hubert-de-Longueuil", e164: "+14505550121", note: "Wants the French demo", notifiedAt: NOW - 3 * HOUR, reassignedAt: NOW - 2 * HOUR },
  { id: "cb_4", at: NOW - OVERDUE_FLAG_MS - 5 * HOUR, promisedBy: "rep_ben", deliveredTo: "rep_ben", scope: "personal", business: null, e164: "+16475550190", note: null, notifiedAt: NOW - OVERDUE_FLAG_MS - 5 * HOUR },
  { id: "cb_5", at: NOW + 1 * DAY + 3 * HOUR, promisedBy: "rep_ana", deliveredTo: "rep_ana", scope: "personal", business: "Armoires et Comptoirs Bélanger-Tremblay inc.", e164: "+14505550150", note: null },
];

function callbackAgenda() {
  const items = CALLBACK_ROWS.map((r) => {
    const st = callbackState({ callbackAt: new Date(r.at) }, new Date(NOW));
    return {
      id: r.id,
      callbackAt: iso(r.at),
      state: st.state,
      ageMinutes: st.ageMs === null ? null : Math.round(st.ageMs / 60000),
      scope: r.scope,
      promisedByRepId: r.promisedBy,
      promisedBy: repName(r.promisedBy),
      deliveredToRepId: r.deliveredTo,
      deliveredTo: repName(r.deliveredTo),
      businessName: r.business,
      toE164: r.e164,
      note: r.note,
      notifiedAt: r.notifiedAt ? iso(r.notifiedAt) : null,
      reassignedAt: r.reassignedAt ? iso(r.reassignedAt) : null,
      prospectId: `pr_${r.id}`,
    };
  });
  const today = iso(NOW).slice(0, 10);
  const perRep = {};
  for (const i of items) {
    const key = i.deliveredToRepId || "unassigned";
    if (!perRep[key]) perRep[key] = { repId: i.deliveredToRepId, name: i.deliveredTo, open: 0, due: 0, overdue: 0, flagged: 0 };
    perRep[key].open += 1;
    if (i.state === "due") perRep[key].due += 1;
    if (i.state === "overdue") perRep[key].overdue += 1;
    if (i.state === "flagged") perRep[key].flagged += 1;
  }
  const settings = outcomeDefaults();
  return {
    items,
    dueToday: items.filter((i) => i.callbackAt.slice(0, 10) === today),
    overdue: items.filter((i) => i.state === "overdue" || i.state === "flagged"),
    flagged: items.filter((i) => i.state === "flagged"),
    perRep: Object.values(perRep).sort((a, b) => b.open - a.open),
    closedCount: 7,
    graceMinutes: settings["sales.callback.graceMinutes"],
    maxOpenPerRep: settings["sales.callback.maxOpenPerRep"],
    maxDaysAhead: settings["sales.callback.maxDaysAhead"],
    flagAfterHours: OVERDUE_FLAG_MS / 3600000,
    serverNow: iso(NOW),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-reasons and settings — the route's payload(), from the pure tables
// ═══════════════════════════════════════════════════════════════════════════

let storedValues = outcomeDefaults();
let storedLists = null;
function outcomeSettingsPayload() {
  const subs = effectiveSubDispositions(storedLists);
  return {
    settings: outcomeSettingsTable(storedValues),
    fallbacks: [],
    readFailed: false,
    subDispositions: { codes: SUB_DISPOSITION_CODES, lists: subs.lists, source: subs.source, fallbacks: subs.fallbacks, defaults: DEFAULT_SUB_DISPOSITIONS },
    amdUsdPerCall: AMD_USD_PER_CALL,
    serverNow: iso(NOW),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Conversations — conversationAudit.js's shapes
// ═══════════════════════════════════════════════════════════════════════════

const lead = (id, businessName, contactName, status, email = null) => ({ id, businessName, contactName, status, ...(email ? { email } : {}) });
const SMS = {
  rep_ana: [
    { e164: "+14505550188", name: "Toitures Beauchemin & Fils", leadId: "lead_1", lastAt: iso(NOW - 40 * MIN), lastBody: "Parfait, envoyez-moi le lien et je regarde ce soir.", lastDirection: "in", count: 6 },
    { e164: "+14505550121", name: null, leadId: null, lastAt: iso(NOW - 2 * DAY), lastBody: "Bonjour, c'est Ana-Sophie de FieldQuo — voici le lien pour la démo.", lastDirection: "out", count: 1 },
  ],
  rep_ben: [{ e164: "+14165550133", name: "GTA Hardwood Flooring", leadId: "lead_2", lastAt: iso(NOW - 5 * HOUR), lastBody: "Not interested right now, try me in the spring.", lastDirection: "in", count: 3 }],
};
const EMAIL = {
  rep_ana: [
    { id: "th_1", subject: "Votre soumission en ligne — FieldQuo", lead: lead("lead_1", "Toitures Beauchemin & Fils", "Luc Beauchemin", "contacted"), lastAt: iso(NOW - 1 * DAY), lastBody: "Merci, je vais regarder avec mon associé.", lastDirection: "in", count: 4 },
  ],
  rep_ben: [],
};
const MESSAGES = {
  "+14505550188": [
    { id: "m1", direction: "out", body: "Bonjour Luc, c'est Ana-Sophie de FieldQuo. On s'est parlé ce matin — voulez-vous le lien pour essayer?", at: iso(NOW - 3 * HOUR) },
    { id: "m2", direction: "in", body: "Oui, mais je suis sur un toit jusqu'à 16h.", at: iso(NOW - 2 * HOUR) },
    { id: "m3", direction: "in", body: "Parfait, envoyez-moi le lien et je regarde ce soir.", at: iso(NOW - 40 * MIN) },
  ],
};

function conversations(repId, q) {
  const rep = REPS.find((r) => r.id === repId) || null;
  if (!rep) return { rep: null, reps: REPS, sms: [], email: [] };
  const needle = String(q || "").trim().toLowerCase();
  const hit = (...xs) => !needle || xs.filter(Boolean).some((x) => String(x).toLowerCase().includes(needle));
  return {
    rep,
    reps: REPS,
    sms: (SMS[rep.id] || []).filter((c) => hit(c.name, c.e164)),
    email: (EMAIL[rep.id] || []).filter((t) => hit(t.subject, t.lead?.businessName)),
  };
}

const audited = () => ({ at: new Date().toISOString() });

const UNOWNED = [
  { id: "sms_u1", fromE164: "+15145550166", toE164: "+14385550100", body: "Hi, someone from FieldQuo called me yesterday about quotes — who was it?", sentAt: iso(NOW - 3 * HOUR), triage: null, lineHolder: null },
  { id: "sms_u2", fromE164: "+14505550199", toE164: "+14385550111", body: "Rappelez-moi demain matin svp", sentAt: iso(NOW - 1 * DAY), triage: null, lineHolder: { id: "rep_old", name: "Chris Lalonde" } },
];

// ═══════════════════════════════════════════════════════════════════════════
// The answer
// ═══════════════════════════════════════════════════════════════════════════

export default function answer({ method, path, url, body }) {
  if (path === "/api/platform/sales/outcomes/callbacks") return callbackAgenda();
  if (path === "/api/platform/sales/outcomes/settings") {
    // The route validates and saves; the harness keeps what was sent.
    if (method === "PUT") {
      if (body?.settings) storedValues = { ...storedValues, ...body.settings };
      if (body?.subDispositions) storedLists = body.subDispositions;
    }
    return outcomeSettingsPayload();
  }
  if (path === "/api/platform/sales/conversations") return conversations(url.searchParams.get("repId"), url.searchParams.get("q"));
  // Texts nobody could file to a rep (lib/sales/smsAttribution.js
  // unownedInboundTexts), each with the holder of the line it arrived on,
  // and the active reps a superadmin may file one to.
  if (path === "/api/platform/sales/conversations/unowned") {
    if (method === "POST") {
      const i = UNOWNED.findIndex((m) => m.id === body?.messageId);
      if (i >= 0) UNOWNED.splice(i, 1);
      return { ok: true, before: null, after: body?.repId || null };
    }
    return { unowned: UNOWNED, reps: REPS.filter((r) => r.active && !r.endedAt).map(({ id, name, email }) => ({ id, name, email })) };
  }
  {
    const m = path.match(/^\/api\/platform\/sales\/conversations\/(sms|email)\/([^/]+)$/);
    if (m) {
      const [, kind, rawId] = m;
      const id = decodeURIComponent(rawId);
      if (kind === "sms") {
        const repId = url.searchParams.get("repId");
        const rep = REPS.find((r) => r.id === repId);
        const row = (SMS[repId] || []).find((c) => c.e164 === id);
        if (!rep || !row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        return {
          kind: "sms",
          rep,
          with: id,
          lead: row.leadId ? lead(row.leadId, row.name, null, "contacted") : null,
          messages: MESSAGES[id] || [{ id: "m0", direction: row.lastDirection, body: row.lastBody, at: row.lastAt }],
          audited: audited(),
        };
      }
      const owner = Object.keys(EMAIL).find((r) => EMAIL[r].some((t) => t.id === id));
      const t = owner ? EMAIL[owner].find((x) => x.id === id) : null;
      if (!t) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      return {
        kind: "email",
        rep: REPS.find((r) => r.id === owner),
        thread: { id: t.id, subject: t.subject, lastMessageAt: t.lastAt, createdAt: iso(NOW - 3 * DAY) },
        lead: { ...t.lead, email: "luc@toitures-beauchemin.example" },
        messages: [
          { id: "em1", direction: "out", fromAddress: "ana-sophie@fieldquo.com", toAddress: "luc@toitures-beauchemin.example", subject: t.subject, body: "Bonjour Luc,\n\nComme promis, voici le lien pour essayer FieldQuo.", sentAt: iso(NOW - 3 * DAY), at: iso(NOW - 3 * DAY), attachments: [], forwardedToMailbox: false },
          { id: "em2", direction: "in", fromAddress: "luc@toitures-beauchemin.example", toAddress: "ana-sophie@fieldquo.com", subject: `Re: ${t.subject}`, body: t.lastBody, sentAt: t.lastAt, at: t.lastAt, attachments: [], forwardedToMailbox: false },
        ],
        audited: audited(),
      };
    }
  }
  return undefined;
}

// "?scene=rep" on the conversations route: pick the first rep, so the frame
// shows the two lists rather than the picker alone.
export const scenes = {
  "/platform/sales/conversations": {
    rep: async ({ until, wait }) => {
      const select = await until("[data-rep-picker]");
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, "rep_ana");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(300);
    },
  },
};
