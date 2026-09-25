// Fixtures for FieldQuo's own systems and spending — see index.js for the
// contract.
//
// Routes answered here, and the screens they feed:
//   /api/platform/sms-health?days=     → /platform/sms-health
//   /api/platform/ai-billing           → /platform/ai-billing
//   /api/platform/costs?range=         → /platform/costs
//
// SMS health runs the route's own arithmetic in miniature over invented
// SmsDelivery rows, with lib/sms/deliveryStatus.js's pure verdict, reason and
// mask — so the tallies, the per-number and per-company tables and the
// "callback missing" line are what the route would compute from those rows.
// The AI-billing payload is written out: the route's modules reach the
// OpenAI client and lib/db, which the browser bundle cannot hold. Its
// feature list and labels are the shipped PAYER_FEATURES (lib/ai/
// featurePayer.js) as of 2026-09-25; the numbers are invented. The costs
// payload is a snapshot of the shipped summary's own output — see
// costs.snapshot.gen.mjs.
//
// Dates: relative to Date.now() wherever a page ages them ("last pulled 3 h
// ago", "failed 2 days ago"); the periods follow the current month.
import { COMPANY_ID } from "./ids.js";
import { deliveryVerdict, reasonText, maskPhone, FAILED_STATUSES } from "@/lib/sms/deliveryStatus";
import COSTS from "./costs.snapshot.json";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.now();
const iso = (t) => new Date(t).toISOString();

const COMPANY_NAMES = {
  [COMPANY_ID]: "Easy Roofers & Exterior Renovations of Greater Moncton Ltd.",
  cmp_rivesud: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.",
  cmp_northline: "Northline Painting & Decorating",
  cmp_summit: "Summit Cabinetry and Custom Millwork Company of Colorado, LLC",
};

// ═══════════════════════════════════════════════════════════════════════════
// SMS delivery receipts
// ═══════════════════════════════════════════════════════════════════════════

/** One invented SmsDelivery row per text; `n` copies of a template. */
function deliveries() {
  const rows = [];
  let i = 0;
  const add = (n, row) => {
    for (let k = 0; k < n; k++) {
      i += 1;
      const sentAt = NOW - ((i * 7919) % (29 * DAY)) - HOUR;
      const failed = FAILED_STATUSES.includes(row.status);
      rows.push({
        id: `smsd_${i}`,
        toE164: `+1506555${String(1000 + ((i * 37) % 9000)).padStart(4, "0")}`,
        sentAt,
        statusAt: row.status === "queued" ? null : sentAt + (failed && row.errorCode === 30034 ? 3 * MIN : 40 * 1000),
        // Most receipts arrive by Twilio's callback; the rest were settled
        // by the hourly reconcile, which is the evidence the route reports.
        lastCallbackAt: row.viaReconcile ? null : sentAt + 30 * 1000,
        reconciledAt: row.viaReconcile ? sentAt + 70 * MIN : null,
        callbackCount: row.viaReconcile ? 0 : 2,
        errorMessage: null,
        ...row,
      });
    }
  };
  // The main company's local number: US recipients blocked for want of A2P
  // registration — the failure the owner lives with — and the rest arriving.
  add(46, { companyId: COMPANY_ID, fromE164: "+15068557890", purpose: "booking_confirmation", status: "delivered", errorCode: null });
  add(19, { companyId: COMPANY_ID, fromE164: "+15068557890", purpose: "appointment_reminder", status: "delivered", errorCode: null });
  add(11, { companyId: COMPANY_ID, fromE164: "+15068557890", purpose: "on_my_way", status: "undelivered", errorCode: 30034 });
  add(2, { companyId: COMPANY_ID, fromE164: "+15068557890", purpose: "thread_reply", status: "undelivered", errorCode: 30006 });
  add(28, { companyId: "cmp_rivesud", fromE164: "+14505550188", purpose: "visit_reminder", status: "delivered", errorCode: null });
  add(6, { companyId: "cmp_rivesud", fromE164: "+14505550188", purpose: "change_order", status: "sent", errorCode: null, viaReconcile: true });
  add(3, { companyId: "cmp_rivesud", fromE164: "+14505550188", purpose: "booking_moved", status: "failed", errorCode: 21610 });
  add(9, { companyId: "cmp_northline", fromE164: "+16135550121", purpose: "thread_reply", status: "delivered", errorCode: null });
  add(1, { companyId: "cmp_northline", fromE164: "+16135550121", purpose: "referral_invite", status: "queued", errorCode: null });
  // FieldQuo's own sales texts, from the system number.
  add(14, { companyId: null, fromE164: "+14385550100", purpose: "sales_signup_link", status: "delivered", errorCode: null });
  add(4, { companyId: null, fromE164: "+14385550100", purpose: "sales_reply", status: "undelivered", errorCode: 30007, viaReconcile: true });
  return rows;
}
const DELIVERIES = deliveries();

// The route's tally() and breakdown(), over rows rather than groupBy counts.
function tally(rows) {
  const t = { total: 0, delivered: 0, failed: 0, sent: 0, pending: 0 };
  for (const r of rows) {
    t.total += 1;
    t[deliveryVerdict({ status: r.status })] += 1;
  }
  return t;
}
function breakdown(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const k = r[key] ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups].map(([k, rs]) => ({ key: k, ...tally(rs) })).sort((a, b) => b.total - a.total);
}
function topCodeBy(failed, key) {
  const counts = new Map();
  for (const r of failed) {
    const k = r[key] ?? null;
    const byCode = counts.get(k) || new Map();
    byCode.set(r.errorCode, (byCode.get(r.errorCode) || 0) + 1);
    counts.set(k, byCode);
  }
  const best = new Map();
  for (const [k, byCode] of counts) {
    const [code, count] = [...byCode].sort((a, b) => b[1] - a[1])[0];
    best.set(k, { code, count, reason: reasonText(code) });
  }
  return best;
}

function smsHealth(daysParam) {
  const days = daysParam === "30" ? 30 : 7;
  const since = NOW - days * DAY;
  const rows = DELIVERIES.filter((r) => r.sentAt >= since);
  const failed = rows.filter((r) => FAILED_STATUSES.includes(r.status));
  const codeCounts = new Map();
  for (const r of failed) codeCounts.set(r.errorCode, (codeCounts.get(r.errorCode) || 0) + 1);
  const codes = [...codeCounts].map(([code, count]) => ({ code, count, reason: reasonText(code) })).sort((a, b) => b.count - a.count);
  const totals = tally(rows);
  const top = codes[0] || null;
  const callbackSettled = rows.filter((r) => r.lastCallbackAt).length;
  const reconcileOnly = rows.filter((r) => !r.lastCallbackAt && r.reconciledAt).length;
  const byNumberTop = topCodeBy(failed, "fromE164");
  const byCompanyTop = topCodeBy(failed, "companyId");
  return {
    days,
    since: iso(since),
    totals,
    mechanism: {
      callbackSettled,
      reconcileOnly,
      callbacksReceived: rows.reduce((s, r) => s + r.callbackCount, 0),
      callbackMissing: reconcileOnly > 0 && reconcileOnly >= callbackSettled,
    },
    topError: top ? { ...top, share: totals.failed ? top.count / totals.failed : 0 } : null,
    codes,
    byNumber: breakdown(rows, "fromE164").map((r) => ({ ...r, number: r.key, topError: byNumberTop.get(r.key) || null })),
    byCompany: breakdown(rows, "companyId").map((r) => ({
      ...r,
      companyId: r.key,
      name: r.key ? COMPANY_NAMES[r.key] || "(deleted company)" : "FieldQuo's own texts",
      topError: byCompanyTop.get(r.key) || null,
    })),
    byPurpose: breakdown(rows, "purpose"),
    recentFailures: failed
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, 25)
      .map((r) => ({
        id: r.id,
        company: r.companyId ? COMPANY_NAMES[r.companyId] || "(company)" : "FieldQuo",
        purpose: r.purpose,
        status: r.status,
        errorCode: r.errorCode,
        reason: reasonText(r.errorCode, r.errorMessage),
        to: maskPhone(r.toE164),
        from: r.fromE164,
        sentAt: iso(r.sentAt),
        failedAt: r.statusAt ? iso(r.statusAt) : null,
      })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Who pays for AI
// ═══════════════════════════════════════════════════════════════════════════

const monthStart = (offset = 0) => {
  const d = new Date(NOW);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString();
};
const spend = (fqThis, coThis, fqLast, coLast) => ({
  thisMonth: { fieldquo: fqThis, company: coThis },
  lastMonth: { fieldquo: fqLast, company: coLast },
});
const use = (costMicros, calls) => ({ costMicros, calls });
const ZERO = use(0, 0);

// PAYER_FEATURES (lib/ai/featurePayer.js), each resolved to its default
// payer with no row stored — except copilot, which a superadmin set.
const AI_FEATURES = [
  { feature: "receipt_scan", label: "Receipt reading", blurb: "Reading a photographed or PDF receipt into lines, totals and tax (the receipts book and the job materials scanner).", defaultPayer: "fieldquo", wired: true, companyLedger: "allowance", payer: "fieldquo", explicit: false, updatedAt: null, spend: spend(use(412_300, 188), ZERO, use(1_204_900, 541), ZERO) },
  { feature: "copilot", label: "FieldQuo AI (in-app assistant)", blurb: "The assistant in /app answering questions about the company's own data.", defaultPayer: "fieldquo", wired: true, companyLedger: "allowance", payer: "fieldquo", explicit: true, updatedAt: iso(NOW - 3 * DAY), spend: spend(use(2_870_400, 1_310), ZERO, use(6_115_000, 2_902), use(88_000, 40)) },
  { feature: "translation", label: "Translation drafts", blurb: "Drafting translations of a company's own client-facing text — auto-translation on save, the catalogue's \"fill in the blanks\" and a quote text block's draft.", defaultPayer: "fieldquo", wired: true, companyLedger: "allowance", payer: "fieldquo", explicit: false, updatedAt: null, spend: spend(use(96_200, 77), ZERO, use(301_000, 240), ZERO) },
  { feature: "ai_employee_reply", label: "AI employee replies", blurb: "The company's AI employee answering its customers — the company's paid AI, in dollars from its AI credit.", defaultPayer: "company", wired: true, companyLedger: "wallet", payer: "company", explicit: false, updatedAt: null, spend: { ...spend(ZERO, use(1_930_000, 624), ZERO, use(4_402_000, 1_415)), thisMonth: { fieldquo: ZERO, company: use(1_930_000, 624), wallet: { cents: 386, debits: 624 } }, lastMonth: { fieldquo: ZERO, company: use(4_402_000, 1_415), wallet: { cents: 881, debits: 1_415 } } } },
  { feature: "ai_employee_front_desk", label: "AI employee front desk routing", blurb: "Routing an inbound conversation to one of the company's AI employees — charged from its AI credit with the replies.", defaultPayer: "company", wired: true, companyLedger: "wallet", payer: "company", explicit: false, updatedAt: null, spend: { thisMonth: { fieldquo: ZERO, company: use(71_000, 212), wallet: { cents: 15, debits: 212 } }, lastMonth: { fieldquo: ZERO, company: use(160_000, 480), wallet: { cents: 32, debits: 480 } } } },
  { feature: "conversation_coach", label: "Conversation coaching", blurb: "\"Coach me on this conversation\" on an inbox thread — likelihood, approach, red flags, slips to walk back and a draft reply, on demand.", defaultPayer: "company", wired: true, companyLedger: "allowance", payer: "company", explicit: false, updatedAt: null, spend: spend(ZERO, use(144_000, 31), ZERO, use(52_000, 12)) },
];

function aiBilling() {
  const receipt = (companyId, fqThis, callsThis, fqLast, callsLast) => ({
    companyId,
    name: COMPANY_NAMES[companyId],
    thisMonth: { fieldquo: fqThis, company: 0, calls: callsThis },
    lastMonth: { fieldquo: fqLast, company: 0, calls: callsLast },
  });
  const employee = (companyId, cThis, rThis, mThis, cLast, rLast, mLast) => ({
    companyId,
    name: COMPANY_NAMES[companyId],
    thisMonth: { chargedCents: cThis, replies: rThis, costMicros: mThis },
    lastMonth: { chargedCents: cLast, replies: rLast, costMicros: mLast },
  });
  return {
    periodStart: monthStart(0),
    lastPeriodStart: monthStart(-1),
    cacheSeconds: 60,
    isSuperadmin: true,
    features: AI_FEATURES,
    receiptScans: [
      receipt(COMPANY_ID, 214_000, 97, 610_500, 276),
      receipt("cmp_summit", 131_800, 60, 402_100, 181),
      receipt("cmp_rivesud", 66_500, 31, 192_300, 84),
    ],
    receiptScansCapped: false,
    aiEmployeeCharges: [
      employee("cmp_rivesud", 244, 402, 1_220_000, 561, 930, 2_805_000),
      employee(COMPANY_ID, 157, 434, 781_000, 352, 965, 1_757_000),
    ],
    walletMultiplier: 2,
    aiEmployeeGraceEndsOn: "2026-10-01",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The answer
// ═══════════════════════════════════════════════════════════════════════════

export default function answer({ method, path, url, body }) {
  if (path === "/api/platform/sms-health") return smsHealth(url.searchParams.get("days"));
  if (path === "/api/platform/ai-billing") {
    if (method === "PATCH") {
      const f = AI_FEATURES.find((x) => x.feature === body?.feature);
      if (f && (body?.payer === "fieldquo" || body?.payer === "company")) {
        f.payer = body.payer;
        f.explicit = true;
        f.updatedAt = new Date().toISOString();
      }
      return { ok: true };
    }
    return aiBilling();
  }
  if (path === "/api/platform/costs" || path.startsWith("/api/platform/costs/")) return costsAnswer({ method, path, url, body });
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// What FieldQuo pays
// ═══════════════════════════════════════════════════════════════════════════
//
// costs.snapshot.json is the shipped platformCostSummary's own output over
// scripted rows — see costs.snapshot.gen.mjs for why, and to regenerate.
// "This month" and "Last month" are the two ranges it holds; any other range
// is answered with the route's own 503 shape rather than one of these two
// under the wrong label.
function costsAnswer({ method, path, url, body }) {
  if (path === "/api/platform/costs" && method === "POST") {
    const month = COSTS.month.period;
    return { provider: body?.provider || "twilio", records: 48, from: body?.from || month.fromKey, to: body?.to || month.toKey, written: 48, dropped: 0, failed: [] };
  }
  if (path === "/api/platform/costs") {
    const range = url.searchParams.get("range") || "month";
    if (range === "month" || range === "prevmonth") return COSTS[range];
    return new Response(JSON.stringify({ error: `The harness holds "This month" and "Last month" only, not ${range}.` }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  // GET lists; a save or a void answers with the one row, as the route does.
  if (path === "/api/platform/costs/fixed-bills") {
    if (method === "GET") return { rows: COSTS.month.fixedBills.rows, providers: COSTS.month.fixedBills.providers };
    return { row: COSTS.month.fixedBills.rows[0] };
  }
  return undefined;
}

export const scenes = {};
