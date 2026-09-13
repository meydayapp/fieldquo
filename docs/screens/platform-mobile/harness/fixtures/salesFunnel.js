// Fixtures for /platform/sales/funnel — the per-rep funnel from dial to
// retained-at-60-days (commit 7796c7c1). The route composes its answer
// through lib/sales/funnelStages.js, which is pure (it imports only the
// disposition table), so the fixture runs the same stageCounts →
// fieldquoReferences → buildRepFunnel over invented raw rows rather than
// hand-typing the shape. Only the rows are made up.
import {
  STAGES, BANDS, RAMP_FACTORS, BENCHMARKS, BENCHMARK_LABEL, BENCHMARK_MIN_DIALS,
  stageCounts, fieldquoReferences, buildRepFunnel, monthKeyOf, shiftMonth,
} from "@/lib/sales/funnelStages";

const now = new Date();
const monthKey = monthKeyOf(now);
const inMonth = (day, hour = 14) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, Math.min(day, 28), hour)).toISOString();
};

const REPS = [
  { id: "rep_ana", name: "Ana-Sophie Roy-Beauchemin", code: "ana-sophie", active: true, startedAt: "2026-03-02T14:00:00.000Z", acceptedAt: "2026-03-02T14:00:00.000Z", invitedAt: "2026-02-27T14:00:00.000Z" },
  { id: "rep_daniel", name: "Daniel Roy", code: "danielboves", active: true, startedAt: "2026-06-01T14:00:00.000Z", acceptedAt: "2026-06-01T14:00:00.000Z", invitedAt: "2026-05-28T14:00:00.000Z" },
  { id: "rep_gita", name: "Gita Ramanathan-Krishnamurthy", code: "gita", active: true, startedAt: inMonth(1), acceptedAt: inMonth(1), invitedAt: inMonth(1) },
  { id: "rep_farid", name: "Farid Al-Rashid", code: "farid", active: true, startedAt: null, acceptedAt: "2026-08-20T14:00:00.000Z", invitedAt: "2026-08-18T14:00:00.000Z" },
  { id: "rep_old", name: "Marcus Thibodeaux-Washington", code: "mtw", active: false, startedAt: "2026-01-05T14:00:00.000Z", acceptedAt: "2026-01-05T14:00:00.000Z", invitedAt: "2026-01-02T14:00:00.000Z" },
];

// Dials per rep: a mix of outcomes in the route's own disposition codes.
function attemptsFor(repId, n, mix) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const code = mix[i % mix.length];
    out.push({ salesRepId: repId, direction: "out", dialledAt: inMonth(1 + (i % 26), 13 + (i % 6)), disposition: code, leadId: code === "agreed_link_sent" ? `lead_${repId}_${i}` : null, prospectId: `p_${repId}_${i}`, toE164: `+1438555${String(1000 + i).slice(-4)}` });
  }
  return out;
}
const MIX_GOOD = ["no_answer", "no_answer", "voicemail", "gatekeeper", "reached_not_interested", "reached_interested", "callback", "agreed_link_sent", "no_answer", "busy"];
const MIX_THIN = ["no_answer", "voicemail", "no_answer", "gatekeeper", "no_answer", "reached_not_interested", "no_answer", "agreed_link_sent"];

const attempts = [
  ...attemptsFor("rep_ana", 640, MIX_GOOD),
  ...attemptsFor("rep_daniel", 410, MIX_GOOD),
  ...attemptsFor("rep_gita", 120, MIX_THIN),
  ...attemptsFor("rep_farid", 35, MIX_THIN),
];
const linkSends = [
  { salesRepId: "rep_ana", leadId: "lead_x1", sentAt: inMonth(3) },
  { salesRepId: "rep_ana", leadId: "lead_x2", sentAt: inMonth(9) },
  { salesRepId: "rep_daniel", leadId: "lead_x3", sentAt: inMonth(11) },
];
const companies = [];
const subscriptions = [];
const attributions = [];
const retainedByRep = { rep_ana: [], rep_daniel: [], rep_gita: [], rep_farid: [], rep_old: [] };
function signups(repId, n, { completed, activated, paid, retained }) {
  for (let i = 0; i < n; i += 1) {
    const id = `c_${repId}_${i}`;
    attributions.push({ salesRepId: repId, companyId: id, capturedAt: inMonth(2 + i) });
    companies.push({ id, stripeChargesEnabled: i < activated, isDemo: false });
    if (i < completed) subscriptions.push({ companyId: id, billingStartedAt: i < paid ? inMonth(4 + i) : null, createdAt: inMonth(2 + i), status: i < paid ? "active" : "trialing", canceledAt: null, refundedAt: null, refundedAmountCents: 0, disputeStatus: null });
    if (i < retained) retainedByRep[repId].push(id);
  }
}
signups("rep_ana", 14, { completed: 11, activated: 8, paid: 6, retained: 3 });
signups("rep_daniel", 8, { completed: 6, activated: 4, paid: 3, retained: 1 });
signups("rep_gita", 2, { completed: 1, activated: 1, paid: 0, retained: 0 });
signups("rep_farid", 1, { completed: 0, activated: 0, paid: 0, retained: 0 });

function byRep(rows, repId) { return rows.filter((r) => r.salesRepId === repId); }

function funnelsFor(repId, key) {
  const counts = REPS.map((rep) =>
    stageCounts({ attempts: byRep(attempts, rep.id), linkSends: byRep(linkSends, rep.id), attributions: byRep(attributions, rep.id), companies, subscriptions, retainedCompanyIds: retainedByRep[rep.id], monthKey: key }),
  );
  const references = fieldquoReferences(counts);
  return REPS.map((rep, i) => (repId && rep.id !== repId ? null : buildRepFunnel({ rep, counts: counts[i], monthKey: key, references }))).filter(Boolean);
}

export const scenes = {};

export default function answer({ method, path, url }) {
  if (path === "/api/platform/sales/funnel" && method === "GET") {
    const key = url.searchParams.get("month") || monthKey;
    const repId = url.searchParams.get("rep") || null;
    // An earlier month has no rows here, which is what the route returns for
    // a month before anybody dialled: zeros, not an error.
    const funnels = key === monthKey ? funnelsFor(repId, key) : REPS.map((rep) => buildRepFunnel({ rep, counts: stageCounts({ monthKey: key }), monthKey: key, references: null })).filter((f) => !repId || f.rep.id === repId);
    const months = [];
    for (let i = 0; i < 12; i += 1) months.push(shiftMonth(monthKey, -i));
    return {
      monthKey: key, funnels, generatedAt: now.toISOString(),
      reps: REPS.map((r) => ({ id: r.id, name: r.name, code: r.code, active: r.active })),
      selectedRepId: repId, months, currentMonth: monthKey,
      stages: STAGES, bands: BANDS, rampFactors: RAMP_FACTORS,
      benchmark: { label: BENCHMARK_LABEL, minDials: BENCHMARK_MIN_DIALS, values: BENCHMARKS },
    };
  }
  return undefined;
}
