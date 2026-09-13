// Fixtures for the salesTeam group — see index.js for the contract.
//
// Routes answered here, and the screens they feed:
//   /api/platform/sales/reps (+ /[id]/payouts, /[id]/queue)  → /platform/sales/reps
//   /api/platform/sales/plans                                → /platform/sales/plans
//   /api/platform/sales/payouts?period=                      → /platform/sales/payouts (and the owed strip on reps)
//   /api/platform/sales/floor                                → /platform/sales/floor
//   /api/platform/sales/performance?preset=                  → /platform/sales/performance
//   /api/platform/growth                                     → /platform/growth
//   /api/platform/sales/notes (+ /[id])                      → /platform/sales/notes
//   /api/platform/sales/campaigns (+ /[id], /registrations)  → /platform/sales/campaigns, /[id]
//   /api/platform/sales/windows                              → /platform/sales/windows
//
// Where a route's shape is produced by a PURE helper in lib/ (the growth
// projection, the pipeline stage board, the calling-window policy, the
// campaign funnel, live presence), the fixture feeds that helper the same
// kind of rows the route reads and returns what it returns — so the screen
// draws the real arithmetic on invented rows rather than an invented shape.
// Helpers whose module touches @/lib/db (the payout ledger, the call-stats
// reporter, the performance builder) are ported here in miniature instead;
// the port is marked where it happens.
//
// Dates: the ledger, the floor and the growth actuals are pinned RELATIVE to
// Date.now(), because those screens compare against the clock ("this week",
// "stale for 22 minutes", "month 0"). Everything else is fixed in
// September 2026.
import { COMPANY_ID, CAMPAIGN_ID } from "./ids.js";
import { NUMBER_CAPABILITIES, salesNumberState } from "@/lib/sales/repAdmin";
import { PLAN_MONEY_FIELDS, STANDARD_PLAN, dollarsFromCents } from "@/lib/sales/commissionPlanAdmin";
import { REP_STATES, STATE_ORDER, PAUSE_REASONS, livePresence, describeDuration } from "@/lib/sales/calls/agentState";
import {
  project,
  rate as growthRate,
  monthsRate,
  monthlyCount,
  ASSUMPTION_FIELDS,
  FLOORS as GROWTH_FLOORS,
  MILESTONES as GROWTH_MILESTONES,
  monthLabel,
  marketingAssumption,
} from "@/lib/platform/growthModel";
import { campaignProgress, funnelRows, funnelProblems } from "@/lib/sales/discovery/funnel";
import { territoryRegistration, campaignStartBlockers } from "@/lib/sales/discovery/campaignGate";
import { registeredKeys, registrationStatus, withRegistrations } from "@/lib/sales/registrations";
import { CALLING_JURISDICTIONS, describeWindow } from "@/lib/sales/callingRules";
import { WINDOW_MODES, effectiveWindowPolicy, overrideKey } from "@/lib/sales/windowPolicy";
import { campaignTradeLabel, DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { SIGNUP_FLAG_LABELS, needsReview } from "@/lib/platform/signupFlags";

const ORIGIN = "https://fieldquo.com";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ISO = (t) => new Date(t).toISOString();

// ═══════════════════════════════════════════════════════════════════════════
// The team
// ═══════════════════════════════════════════════════════════════════════════

export const PLANS = [
  { id: "plan_standard", name: "Standard closer plan", active: true, activationCents: 2000, firstPaymentCents: 4000, retentionCents: 6500, retentionDays: 60, createdAt: "2026-06-02T14:00:00.000Z" },
  { id: "plan_senior", name: "Senior closer plan — Québec & Ontario enterprise accounts", active: true, activationCents: 3000, firstPaymentCents: 6000, retentionCents: 9000, retentionDays: 90, createdAt: "2026-07-15T09:30:00.000Z" },
  { id: "plan_qc_launch", name: "Québec launch bonus plan", active: true, activationCents: 2500, firstPaymentCents: 5000, retentionCents: 7500, retentionDays: 60, createdAt: "2026-08-20T16:45:00.000Z" },
  { id: "plan_legacy", name: "Legacy 2025 plan", active: false, activationCents: 1500, firstPaymentCents: 3000, retentionCents: 5000, retentionDays: 60, createdAt: "2025-11-03T11:00:00.000Z" },
];
const planById = (id) => PLANS.find((p) => p.id === id) || null;

const company = (id, name, country, origin) => ({ id, name, country, origin });
const originOf = (ipCountry, flag, reviewedAt = null) => ({
  ipCountry,
  flag,
  flagLabel: SIGNUP_FLAG_LABELS[flag] || flag,
  flagReason: flag === "none" ? null : `Signup request came from ${ipCountry}; the company says it is in another country.`,
  reviewedAt,
});

// The eight reps. Names, mailboxes and codes are deliberately long — the
// accordion header carries all three beside three money figures.
const REP_ROWS = [
  {
    id: "rep_ana", name: "Ana-Sophie Roy-Beauchemin", email: "ana-sophie.roy-beauchemin@gmail.com", workEmail: "ana-sophie@fieldquo.com", code: "ana-sophie",
    active: true, invitedAt: "2026-06-03T13:12:00.000Z", acceptedAt: "2026-06-04T08:41:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: "plan_senior", engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["fr", "en"],
    companies: [
      company("cmp_toiture_rive_sud", "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", "CA", originOf("CA", "none")),
      company(COMPANY_ID, "Easy Roofers", "CA", originOf("CA", "none")),
      company("cmp_plomberie_lavoie", "Plomberie & Chauffage Lavoie-Deschamps et Associés", "CA", originOf("US", "country_mismatch")),
      company("cmp_peinture_st_hubert", "Peinture Résidentielle de Saint-Hubert-de-Longueuil", "CA", originOf("CA", "none")),
      company("cmp_armoires_belanger", "Armoires et Comptoirs Bélanger-Tremblay inc.", "CA", originOf("CA", "repeat_ip", "2026-09-02T15:00:00.000Z")),
      company("cmp_paysagement_vm", "Paysagement Vallée-Montérégie", "CA", null),
      company("cmp_planchers_dl", "Planchers de Bois Franc D.L. — Sablage & Vernissage", "CA", originOf("CA", "none")),
    ],
    queue: { held: 37, leased: 32, worked: 5, untouched: 12, dialled: 20, french: 29, oldestClaimAt: null, oldestClaimMs: 3 * HOUR + 12 * MIN, openLeads: 12 },
    sending: { canSend: true, blockers: [], warnings: [] },
  },
  {
    id: "rep_ben", name: "Benjamin Okafor-Williams", email: "benjamin.okafor.williams@outlook.com", workEmail: null, code: "benjamin",
    active: true, invitedAt: "2026-07-01T15:00:00.000Z", acceptedAt: "2026-07-01T19:22:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: "plan_standard", engagement: "employee", accruesPaidLeave: true, sellsIn: ["en"],
    companies: [
      company("cmp_gta_flooring", "Greater Toronto Area Hardwood Flooring Installations Ltd.", "CA", originOf("CA", "none")),
      company("cmp_mississauga_hvac", "Mississauga Heating, Cooling & Ductwork Specialists", "CA", originOf("CA", "none")),
    ],
    queue: { held: 0, leased: 0, worked: 0, untouched: 0, dialled: 0, french: 0, oldestClaimAt: null, oldestClaimMs: null, openLeads: 3 },
    sending: {
      canSend: false,
      blockers: [{ code: "no_work_email", title: "No work mailbox yet.", fix: "Assign one under Work mailbox — outreach is sent from it and replies come back to it. Until then the compose box in their portal refuses to render." }],
      warnings: [],
    },
  },
  {
    id: "rep_carla", name: "Carla Mendes-Ferreira dos Santos", email: "carla.mendesferreira.dossantos@icloud.com", workEmail: "carla@fieldquo.com", code: "carla",
    active: true, invitedAt: "2026-06-10T10:05:00.000Z", acceptedAt: "2026-06-10T12:30:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: "plan_senior", engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["en", "es"],
    companies: [
      company("cmp_sunbelt_painting", "Sunbelt Residential & Commercial Painting Contractors of Central Florida LLC", "US", originOf("US", "none")),
      company("cmp_hernandez_roofing", "Hernández Brothers Roofing & Gutters", "US", originOf("MX", "country_mismatch")),
      company("cmp_orlando_cabinets", "Orlando Custom Cabinetry & Millwork", "US", originOf("US", "none")),
      company("cmp_tampa_plumb", "Tampa Bay Plumbing Solutions Inc.", "US", originOf("US", "none")),
      company("cmp_miami_landscape", "Miami-Dade Landscaping & Irrigation Services", "US", originOf("US", "vpn_or_hosting")),
      company("cmp_jax_tile", "Jacksonville Tile & Stone Installers", "US", originOf("US", "none")),
      company("cmp_naples_paint", "Naples Fine Finishes Painting", "US", originOf("US", "none")),
      company("cmp_pensacola_hvac", "Pensacola Air Conditioning & Heating Co.", "US", originOf("US", "none")),
      company("cmp_ftl_floor", "Fort Lauderdale Luxury Vinyl & Laminate Flooring", "US", null),
    ],
    queue: { held: 54, leased: 46, worked: 8, untouched: 31, dialled: 15, french: 0, oldestClaimAt: null, oldestClaimMs: 47 * MIN, openLeads: 21 },
    sending: { canSend: true, blockers: [], warnings: [{ code: "reply_backlog", title: "14 replies unanswered for more than two days.", fix: "Open the inbox in their portal." }] },
  },
  {
    id: "rep_dmitri", name: "Dmitri Volkov-Petrenko", email: "dmitri.volkov.petrenko@protonmail.com", workEmail: "dmitri@fieldquo.com", code: "dmitri",
    active: true, invitedAt: "2026-08-18T09:00:00.000Z", acceptedAt: "2026-08-18T09:48:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: null, engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["uk", "en"],
    companies: [
      company("cmp_etobicoke_drywall", "Etobicoke Drywall, Taping & Plastering Contractors", "CA", originOf("CA", "none")),
    ],
    queue: { held: 18, leased: 16, worked: 2, untouched: 9, dialled: 7, french: 0, oldestClaimAt: null, oldestClaimMs: 6 * DAY + 2 * HOUR, openLeads: 4 },
    sending: {
      canSend: true,
      blockers: [],
      warnings: [{ code: "no_plan", title: "No commission plan — every milestone earns $0.", fix: "Assign a plan below; the next milestone pays from then on." }],
    },
  },
  {
    id: "rep_eloise", name: "Éloïse Tremblay-Gagnon", email: "eloise.tremblay-gagnon@videotron.ca", workEmail: null, code: "eloise",
    active: true, invitedAt: "2026-09-10T14:20:00.000Z", acceptedAt: null, endedAt: null, inviteExpiresAt: "2026-09-17T14:20:00.000Z",
    commissionPlanId: "plan_qc_launch", engagement: null, accruesPaidLeave: false, sellsIn: ["fr"],
    companies: [],
    queue: { held: 0, leased: 0, worked: 0, untouched: 0, dialled: 0, french: 0, oldestClaimAt: null, oldestClaimMs: null, openLeads: 0 },
    sending: {
      canSend: false,
      blockers: [
        { code: "not_accepted", title: "Has not accepted the invitation yet.", fix: "The link in the email works once and expires 17 Sept 2026." },
        { code: "no_work_email", title: "No work mailbox yet.", fix: "Assign one under Work mailbox." },
      ],
      warnings: [],
    },
  },
  {
    id: "rep_farid", name: "Farid Al-Rashid", email: "farid.alrashid@gmail.com", workEmail: "farid@fieldquo.com", code: "farid",
    active: true, invitedAt: "2026-07-22T11:00:00.000Z", acceptedAt: "2026-07-23T07:15:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: "plan_standard", engagement: "employee", accruesPaidLeave: true, sellsIn: ["en", "fr"],
    companies: [
      company("cmp_ottawa_roof", "Ottawa-Gatineau Roofing & Exterior Renovations", "CA", originOf("CA", "none")),
      company("cmp_kanata_paint", "Kanata Painting Professionals", "CA", originOf("CA", "none")),
      company("cmp_gatineau_plomb", "Plomberie Gatineau-Aylmer", "CA", originOf("CA", "none")),
    ],
    queue: { held: 22, leased: 20, worked: 2, untouched: 4, dialled: 16, french: 6, oldestClaimAt: null, oldestClaimMs: 1 * DAY + 5 * HOUR, openLeads: 7 },
    sending: { canSend: true, blockers: [], warnings: [] },
  },
  {
    id: "rep_gita", name: "Gita Ramanathan-Krishnamurthy", email: "gita.ramanathan.krishnamurthy@yahoo.ca", workEmail: "gita@fieldquo.com", code: "gita",
    active: true, invitedAt: "2026-08-04T16:30:00.000Z", acceptedAt: "2026-08-05T13:05:00.000Z", endedAt: null, inviteExpiresAt: null,
    commissionPlanId: "plan_standard", engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["en", "pa", "tl"],
    companies: [
      company("cmp_surrey_cabinets", "Surrey & Langley Kitchen Cabinet Refacing Company", "CA", originOf("CA", "none")),
      company("cmp_brampton_paving", "Brampton Interlock, Paving & Concrete Ltd.", "CA", originOf("IN", "outside_ca_us")),
      company("cmp_abbotsford_hvac", "Abbotsford Furnace & Heat Pump Installers", "CA", originOf("CA", "none")),
      company("cmp_richmond_floor", "Richmond BC Flooring Depot Installations", "CA", originOf("CA", "none")),
    ],
    queue: { held: 9, leased: 9, worked: 0, untouched: 9, dialled: 0, french: 0, oldestClaimAt: null, oldestClaimMs: 25 * MIN, openLeads: 2 },
    sending: { canSend: true, blockers: [], warnings: [] },
  },
  {
    id: "rep_hugo", name: "Hugo Lefebvre", email: "hugo.lefebvre@hotmail.com", workEmail: "hugo@fieldquo.com", code: "hugo",
    active: false, invitedAt: "2025-11-05T10:00:00.000Z", acceptedAt: "2025-11-05T10:40:00.000Z", endedAt: "2026-08-14T17:00:00.000Z", inviteExpiresAt: null,
    commissionPlanId: "plan_legacy", engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["fr", "en"],
    companies: [
      company("cmp_sherbrooke_toit", "Toitures de l'Estrie Lefebvre & Fils", "CA", null),
      company("cmp_magog_paint", "Peinture Magog-Orford", "CA", null),
    ],
    queue: { held: 0, leased: 0, worked: 0, untouched: 0, dialled: 0, french: 0, oldestClaimAt: null, oldestClaimMs: null, openLeads: 0 },
    sending: {
      canSend: false,
      blockers: [{ code: "inactive", title: "Deactivated.", fix: "Reactivate the rep to send again. Their attributions and ledger are kept." }],
      warnings: [],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// The commission ledger — entries and batches, relative to this week
//
// A miniature of lib/sales/payoutLedger.js + payoutAdmin.js (those import
// @/lib/db). Same arithmetic: a cell is the sum of its entries, a batch is
// re-summed from its rows, "owed" is a ready batch, "paid" is a paid one.
// ═══════════════════════════════════════════════════════════════════════════

function weekStart(t) {
  const d = new Date(t);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - dow);
  return day.getTime();
}
const NOW = Date.now();
const W0 = weekStart(NOW);
const wk = (n) => W0 - n * 7 * DAY; // n weeks back

// [rep, weeksBack, cents, milestone, company]
const LEDGER = [
  ["rep_ana", 0, 3000, "activation", "Planchers de Bois Franc D.L."], ["rep_ana", 0, 6000, "first_payment", "Easy Roofers"],
  ["rep_ana", 1, 3000, "activation", "Paysagement Vallée-Montérégie"], ["rep_ana", 1, 6000, "first_payment", "Armoires Bélanger-Tremblay"], ["rep_ana", 1, 9000, "retention", "Toiture Rive-Sud Beauchemin & Fils"], ["rep_ana", 1, -3000, "reversal", "Plomberie Lavoie-Deschamps — refunded in trial"],
  ["rep_ana", 2, 3000, "activation", "Plomberie Lavoie-Deschamps"], ["rep_ana", 2, 6000, "first_payment", "Peinture Saint-Hubert"],
  ["rep_ana", 3, 9000, "retention", "Easy Roofers"], ["rep_ana", 3, 6000, "first_payment", "Toiture Rive-Sud Beauchemin & Fils"],
  ["rep_ana", 4, 3000, "activation", "Easy Roofers"], ["rep_ana", 4, 3000, "activation", "Toiture Rive-Sud Beauchemin & Fils"],
  ["rep_ben", 1, 4000, "first_payment", "GTA Hardwood Flooring"],
  ["rep_ben", 2, 2000, "activation", "Mississauga HVAC"],
  ["rep_ben", 3, 6500, "retention", "GTA Hardwood Flooring"],
  ["rep_carla", 0, 3000, "activation", "Fort Lauderdale Flooring"], ["rep_carla", 0, 6000, "first_payment", "Naples Fine Finishes"],
  ["rep_carla", 1, 9000, "retention", "Sunbelt Painting"], ["rep_carla", 1, 6000, "first_payment", "Pensacola A/C"], ["rep_carla", 1, 3000, "activation", "Jacksonville Tile"],
  ["rep_carla", 2, 6000, "first_payment", "Orlando Cabinetry"], ["rep_carla", 2, 3000, "activation", "Miami-Dade Landscaping"],
  ["rep_carla", 3, 9000, "retention", "Hernández Brothers Roofing"], ["rep_carla", 3, 6000, "first_payment", "Tampa Bay Plumbing"],
  ["rep_carla", 4, 3000, "activation", "Tampa Bay Plumbing"],
  ["rep_farid", 0, 2000, "activation", "Plomberie Gatineau-Aylmer"],
  ["rep_farid", 1, 4000, "first_payment", "Kanata Painting"], ["rep_farid", 1, 2000, "activation", "Kanata Painting"],
  ["rep_farid", 2, 4000, "first_payment", "Ottawa-Gatineau Roofing"],
  ["rep_gita", 0, 4000, "first_payment", "Surrey & Langley Cabinets"],
  ["rep_gita", 1, 2000, "activation", "Richmond Flooring Depot"],
  ["rep_gita", 2, 6500, "retention", "Brampton Paving"],
  ["rep_gita", 4, 2000, "activation", "Abbotsford Furnace"],
  ["rep_hugo", 3, 5000, "retention", "Toitures de l'Estrie"],
  ["rep_hugo", 4, 1500, "activation", "Peinture Magog-Orford"],
];

// Proof on the paid batches: where and how each was sent.
const PROOF = {
  Wise: (id) => ({ paidVia: "Wise", paymentReference: `WISE-${id.slice(-4).toUpperCase()}-7712`, paymentNote: "Sent minus the Wise fee.", proofUrl: `https://res.cloudinary.com/fieldquo/raw/upload/fieldquo/platform/payouts/${id}/wise-transfer.pdf`, proofFilename: "wise-transfer-receipt.pdf" }),
  Interac: (id) => ({ paidVia: "Interac e-Transfer", paymentReference: `CA${id.length}x8812`, paymentNote: null, proofUrl: `https://res.cloudinary.com/fieldquo/image/upload/fieldquo/platform/payouts/${id}/interac.png`, proofFilename: "interac-confirmation.png" }),
  Payroll: () => ({ paidVia: "Payroll (Wagepoint)", paymentReference: "WP-2026-09-RUN-14", paymentNote: "On the September payroll run with the paid leave accrual.", proofUrl: null, proofFilename: null }),
  NoProof: () => ({ paidVia: "Wise", paymentReference: null, paymentNote: "Reference to follow — screenshot lost when the phone was replaced.", proofUrl: null, proofFilename: null }),
};
const proofFor = (repId, id, weeksBack) => {
  const rep = REP_ROWS.find((r) => r.id === repId);
  if (rep?.engagement === "employee") return PROOF.Payroll(id);
  if (repId === "rep_gita" && weeksBack === 4) return PROOF.NoProof(id);
  return weeksBack % 2 ? PROOF.Interac(id) : PROOF.Wise(id);
};

function buildLedger() {
  const entries = [];
  const batches = [];
  const batchKey = new Map();
  LEDGER.forEach(([repId, weeksBack, cents, milestone, companyName], i) => {
    const occurredAt = wk(weeksBack) + (i % 5) * DAY + 14 * HOUR + (i % 7) * 11 * MIN;
    let payoutBatchId = null;
    if (weeksBack >= 1) {
      const key = `${repId}:${weeksBack}`;
      if (!batchKey.has(key)) {
        const id = `pb_${repId.slice(4)}_w${weeksBack}`;
        const paid = weeksBack >= 2;
        const paidAt = paid ? wk(weeksBack - 2) + 1 * DAY + 15 * HOUR + 2 * MIN : null; // the Tuesday after the close-Monday, so last week's close was paid THIS week
        batches.push({
          id, salesRepId: repId, periodStart: ISO(wk(weeksBack)), periodEnd: ISO(wk(weeksBack - 1)),
          status: paid ? "paid" : "ready", paidAt: paidAt ? ISO(paidAt) : null, totalCentsAtClose: 0,
          ...(paid ? proofFor(repId, id, weeksBack) : { paidVia: null, paymentReference: null, paymentNote: null, proofUrl: null, proofFilename: null }),
        });
        batchKey.set(key, id);
      }
      payoutBatchId = batchKey.get(key);
    }
    entries.push({ id: `ce_${i}`, salesRepId: repId, amountCents: cents, milestone, companyName, occurredAt: ISO(occurredAt), payoutBatchId });
  });
  // totalCentsAtClose: what the batch summed to when the Monday cron closed
  // it. Ana's W-1 reversal landed AFTER the close, so that batch drifted.
  for (const b of batches) {
    const rows = entries.filter((e) => e.payoutBatchId === b.id);
    b.totalCentsAtClose = rows.filter((e) => !(b.id === "pb_ana_w1" && e.milestone === "reversal")).reduce((s, e) => s + e.amountCents, 0);
  }
  return { entries, batches };
}
const { ENTRIES, BATCHES } = (() => {
  const l = buildLedger();
  return { ENTRIES: l.entries, BATCHES: l.batches };
})();

const sum = (rows) => rows.reduce((s, e) => s + (Number(e.amountCents) || 0), 0);
const batchById = new Map(BATCHES.map((b) => [b.id, b]));

function batchView(b) {
  const lines = ENTRIES.filter((e) => e.payoutBatchId === b.id);
  const cents = sum(lines);
  const rep = REP_ROWS.find((r) => r.id === b.salesRepId);
  return {
    id: b.id, salesRepId: b.salesRepId, repName: rep?.name || null, periodStart: b.periodStart, periodEnd: b.periodEnd,
    status: b.status, paidAt: b.paidAt, cents, closedCents: b.totalCentsAtClose, movedSinceClose: cents !== b.totalCentsAtClose,
    entryCount: lines.length, hasProof: Boolean(b.proofUrl || b.paymentReference),
    paidVia: b.paidVia, paymentReference: b.paymentReference, paymentNote: b.paymentNote, proofUrl: b.proofUrl, proofFilename: b.proofFilename,
  };
}

function repMoney(repId) {
  const rows = ENTRIES.filter((e) => e.salesRepId === repId);
  const statusOf = (e) => (e.payoutBatchId ? batchById.get(e.payoutBatchId)?.status || "open" : null);
  return {
    thisWeekCents: sum(rows.filter((e) => !e.payoutBatchId)),
    owedCents: sum(rows.filter((e) => statusOf(e) === "ready")),
    paidCents: sum(rows.filter((e) => statusOf(e) === "paid")),
  };
}

function periodBounds(period, at) {
  const d = new Date(at);
  if (period === "month") {
    return { start: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), end: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) };
  }
  return { start: new Date(weekStart(at)), end: new Date(weekStart(at) + 7 * DAY) };
}
function periodLabel(period, start) {
  const s = new Date(start);
  if (period === "month") return s.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
  const e = new Date(s);
  e.setUTCDate(e.getUTCDate() + 6);
  const day = (d) => d.toLocaleDateString("en-CA", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${day(s)} – ${day(e)} ${s.getUTCFullYear()}`;
}

function owedSnapshot(period) {
  const { start, end } = periodBounds(period, NOW);
  const inCycle = (at) => at && new Date(at) >= start && new Date(at) < end;
  const inReady = ENTRIES.filter((e) => e.payoutBatchId && batchById.get(e.payoutBatchId)?.status === "ready");
  const paidThisCycle = ENTRIES.filter((e) => {
    const b = e.payoutBatchId ? batchById.get(e.payoutBatchId) : null;
    return b?.status === "paid" && inCycle(b.paidAt);
  });
  return {
    owedNowCents: sum(inReady),
    accruingCents: sum(ENTRIES.filter((e) => !e.payoutBatchId)),
    paidThisCycleCents: sum(paidThisCycle),
    readyBatchCount: new Set(inReady.map((e) => e.payoutBatchId)).size,
    cycle: { period, start: start.toISOString(), end: end.toISOString() },
  };
}

function cellStatus(rows) {
  if (!rows.length) return null;
  if (rows.some((e) => !e.payoutBatchId)) return "open";
  const statuses = rows.map((e) => batchById.get(e.payoutBatchId)?.status || "open");
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.some((s) => s === "ready" || s === "paid")) return "owed";
  return "open";
}

function periodTable(period) {
  const columns = REP_ROWS.map((r) => ({ id: r.id, name: r.name }));
  const keyOf = (at) => periodBounds(period, at).start.toISOString();
  const buckets = new Map();
  const put = (key, repId, e) => {
    if (!buckets.has(key)) buckets.set(key, new Map());
    const m = buckets.get(key);
    if (!m.has(repId)) m.set(repId, []);
    if (e) m.get(repId).push(e);
  };
  put(keyOf(NOW), null, null);
  for (const e of ENTRIES) put(keyOf(e.occurredAt), e.salesRepId, e);
  const keys = [...buckets.keys()].sort().reverse();
  const columnTotals = new Map(columns.map((c) => [c.id, 0]));
  const rows = keys.map((key) => {
    const perRep = buckets.get(key);
    const cells = columns.map((c) => {
      const cellRows = perRep.get(c.id) || [];
      const cents = sum(cellRows);
      columnTotals.set(c.id, columnTotals.get(c.id) + cents);
      const status = cellStatus(cellRows);
      const batchIds = [...new Set(cellRows.map((e) => e.payoutBatchId).filter(Boolean))];
      const paidAts = batchIds.map((id) => batchById.get(id)?.paidAt).filter(Boolean).sort();
      return { repId: c.id, cents, status, batchId: batchIds.length === 1 ? batchIds[0] : null, batchIds, paidAt: status === "paid" && paidAts.length ? paidAts[paidAts.length - 1] : null };
    });
    return { key, label: periodLabel(period, key), cells, totalCents: cells.reduce((s, c) => s + c.cents, 0) };
  });
  return {
    period, columns, rows,
    totals: { byRep: columns.map((c) => ({ repId: c.id, cents: columnTotals.get(c.id) })), cents: [...columnTotals.values()].reduce((s, v) => s + v, 0) },
  };
}

const sortedBatches = () => [...BATCHES].sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1)).map(batchView);

function repsPayload() {
  const assigned = REP_ROWS.map((r) => r.commissionPlanId).filter(Boolean);
  return {
    reps: REP_ROWS.map((r) => ({
      id: r.id, name: r.name, email: r.email, workEmail: r.workEmail, code: r.code,
      signupLink: `${ORIGIN}/signup?sales=${r.code}`,
      active: r.active, invitedAt: r.invitedAt, acceptedAt: r.acceptedAt, endedAt: r.endedAt, inviteExpiresAt: r.inviteExpiresAt,
      commissionPlan: planById(r.commissionPlanId)?.name || null, commissionPlanId: r.commissionPlanId,
      engagement: r.engagement, accruesPaidLeave: r.accruesPaidLeave, sellsIn: r.sellsIn,
      companyCount: r.companies.length,
      companies: r.companies.map((c, i) => ({
        ...c,
        attributedAt: ISO(NOW - (i + 1) * 9 * DAY),
        origin: c.origin ? { ...c.origin, needsReview: needsReview(c.origin) } : null,
      })),
      flaggedSignups: r.companies.filter((c) => c.origin && needsReview(c.origin)).length,
      queue: r.queue,
      money: repMoney(r.id),
      sending: r.sending,
    })),
    salesNumber: salesNumberState({ e164: "+14385550142" }),
    numberCapabilities: NUMBER_CAPABILITIES,
    plans: PLANS.filter((p) => p.active || assigned.includes(p.id)).map(({ createdAt, ...p }) => p),
  };
}

function plansPayload() {
  const onPlan = (id) => REP_ROWS.filter((r) => r.commissionPlanId === id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)).map((r) => ({ id: r.id, name: r.name, active: r.active }));
  return {
    plans: PLANS.map((p) => ({
      ...p,
      totalCents: p.activationCents + p.firstPaymentCents + p.retentionCents,
      dollars: Object.fromEntries(PLAN_MONEY_FIELDS.map((f) => [f.dollarKey, dollarsFromCents(p[f.key])])),
      repCount: onPlan(p.id).length,
      reps: onPlan(p.id),
    })),
    fields: PLAN_MONEY_FIELDS.map((f) => ({ dollarKey: f.dollarKey, label: f.label, milestone: f.milestone, milestoneLabel: { activation: "Activated", first_payment: "Renewed", retention: "Still paying" }[f.milestone] })),
    standard: STANDARD_PLAN,
  };
}

// The presence of a rep as the floor route reports it (livePresence over an
// activity row is the real function; the row is invented).
const ACTIVITY = {
  rep_ana: { state: "on_call", startedAt: ISO(NOW - 4 * MIN - 12_000), heartbeatAt: ISO(NOW - 20_000), endedAt: null, pauseReason: null },
  rep_ben: { state: "available", startedAt: ISO(NOW - 2 * HOUR - 7 * MIN), heartbeatAt: ISO(NOW - 30_000), endedAt: null, pauseReason: null },
  rep_carla: { state: "after_call", startedAt: ISO(NOW - 92_000), heartbeatAt: ISO(NOW - 15_000), endedAt: null, pauseReason: null },
  rep_dmitri: { state: "paused", startedAt: ISO(NOW - 26 * MIN), heartbeatAt: ISO(NOW - 40_000), endedAt: null, pauseReason: "lunch" },
  rep_farid: { state: "on_call", startedAt: ISO(NOW - 51 * MIN), heartbeatAt: ISO(NOW - 22 * MIN), endedAt: null, pauseReason: null },
};
const PORTAL_SEEN = { rep_ana: NOW - 20_000, rep_ben: NOW - 30_000, rep_carla: NOW - 15_000, rep_dmitri: NOW - 40_000, rep_farid: NOW - 22 * MIN, rep_gita: NOW - 41 * MIN, rep_eloise: null, rep_hugo: NOW - 30 * DAY };
const presenceOf = (repId) => livePresence(ACTIVITY[repId] || null, new Date(NOW), { portalSeenAt: PORTAL_SEEN[repId] ? ISO(PORTAL_SEEN[repId]) : null });

function queuePayload(repId) {
  const rep = REP_ROWS.find((r) => r.id === repId);
  if (!rep) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const live = presenceOf(repId);
  const need = rep.queue.french;
  return {
    rep: { id: rep.id, name: rep.name, active: rep.active },
    queue: {
      ...rep.queue,
      presence: {
        state: live.state, label: REP_STATES[live.state]?.label || live.state,
        pauseReason: live.pauseReason, pauseLabel: live.pauseReason ? PAUSE_REASONS[live.pauseReason]?.label || live.pauseReason : null,
        since: live.since, lastSeenAt: live.lastSeenAt, stale: live.stale, everSeen: live.everSeen, everSignedIn: live.everSignedIn, portalSeenAt: live.portalSeenAt,
      },
    },
    targets: REP_ROWS.filter((r) => r.active && r.acceptedAt && r.id !== repId).map((r) => {
      const eligible = need === 0 || r.sellsIn.includes("fr");
      return { id: r.id, name: r.name, isMe: false, sellsFrench: r.sellsIn.includes("fr"), eligible, why: eligible ? null : `${need} of the held rows need French and ${r.name} does not sell in it.` };
    }),
    meIsRep: false,
    at: ISO(NOW),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The floor
// ═══════════════════════════════════════════════════════════════════════════

// lib/sales/performance.js's rate(): a percentage once `floor` outcomes exist,
// the counts and a sentence otherwise. Ported (that module reaches kpis.js).
function rate(hit, of, floor = 10) {
  const n = Number(of) || 0;
  const k = Number(hit) || 0;
  if (n <= 0) return { value: null, hit: 0, sampleSize: 0, floor, remaining: floor, reason: "none_yet", statement: `Nothing to measure yet — ${floor} are needed before a percentage means anything.` };
  if (n < floor) return { value: null, hit: k, sampleSize: n, floor, remaining: floor - n, reason: "below_floor", statement: `${k} of ${n}. ${floor - n} more and this becomes a percentage.` };
  return { value: Math.round((k / n) * 1000) / 10, hit: k, sampleSize: n, floor, remaining: 0, reason: null, statement: null };
}

const dispositionMix = ({ total, pending, reached, interested = 0, notInterested = 0, voicemail = 0, noAnswer = 0, wrongNumber = 0 }) => ({
  total, pending, unknown: 0, reached, logged: total - pending,
  byCode: { reached_interested: interested, reached_not_interested: notInterested, voicemail, no_answer: noAnswer, wrong_number: wrongNumber },
  rows: [
    { code: "reached_interested", label: "Reached — interested", count: interested, reached: true },
    { code: "reached_not_interested", label: "Reached — not interested", count: notInterested, reached: true },
    { code: "voicemail", label: "Voicemail", count: voicemail, reached: false },
    { code: "no_answer", label: "No answer", count: noAnswer, reached: false },
    { code: "wrong_number", label: "Wrong number", count: wrongNumber, reached: false },
  ],
});

function repStats(repId) {
  const S = {
    rep_ana: { dials: 47, mix: { total: 49, pending: 2, reached: 14, interested: 6, notInterested: 8, voicemail: 19, noAnswer: 13, wrongNumber: 1 }, onCallMs: 2 * HOUR + 41 * MIN, pausedMs: 22 * MIN, talk: { of: 11, total: 47, meanMs: 4 * MIN + 12_000 }, overdue: 2, upcoming: 3, callbacksReceived: 2 },
    rep_ben: { dials: 31, mix: { total: 31, pending: 0, reached: 7, interested: 2, notInterested: 5, voicemail: 15, noAnswer: 9 }, onCallMs: HOUR + 18 * MIN, pausedMs: 48 * MIN, talk: { of: 5, total: 31, meanMs: 3 * MIN + 5_000 }, overdue: 0, upcoming: 1, callbacksReceived: 0 },
    rep_carla: { dials: 62, mix: { total: 64, pending: 5, reached: 21, interested: 9, notInterested: 12, voicemail: 22, noAnswer: 14, wrongNumber: 2 }, onCallMs: 3 * HOUR + 5 * MIN, pausedMs: 35 * MIN, talk: { of: 18, total: 62, meanMs: 5 * MIN + 41_000 }, overdue: 4, upcoming: 6, callbacksReceived: 2 },
    rep_dmitri: { dials: 12, mix: { total: 12, pending: 1, reached: 2, interested: 1, notInterested: 1, voicemail: 6, noAnswer: 3 }, onCallMs: 28 * MIN, pausedMs: 26 * MIN, talk: { of: 0, total: 12, meanMs: null }, overdue: 1, upcoming: 0, callbacksReceived: 0 },
    rep_eloise: null,
    rep_farid: { dials: 38, mix: { total: 38, pending: 3, reached: 9, interested: 4, notInterested: 5, voicemail: 16, noAnswer: 10 }, onCallMs: 2 * HOUR + 2 * MIN, pausedMs: 0, talk: { of: 8, total: 38, meanMs: 3 * MIN + 48_000 }, overdue: 0, upcoming: 2, callbacksReceived: 0 },
    rep_gita: { dials: 0, mix: { total: 0, pending: 0, reached: 0 }, onCallMs: 0, pausedMs: 0, talk: { of: 0, total: 0, meanMs: null }, overdue: 3, upcoming: 0, callbacksReceived: 0 },
  }[repId];
  if (!S) return { period: { from: ISO(W0), to: ISO(NOW) }, dials: 0, callbacksReceived: 0, dispositions: dispositionMix({ total: 0, pending: 0, reached: 0 }), measured: { total: 0, bridged: 0, measuredOf: 0, talkMs: null, meanTalkMs: null, meanTalkText: null, holdMs: null, holdOf: 0, costCents: null }, reportedReachRate: rate(0, 0), reportedReachStatement: null, callbacks: { booked: 0, upcoming: [], overdue: [] }, onCallMs: null, afterCallMs: null, pausedMs: null, workingMs: null, onCallText: null, pausedText: null, pauses: null };
  const mix = dispositionMix(S.mix);
  const reach = rate(mix.reached, mix.logged);
  const cb = (n, past) => Array.from({ length: n }, (_, i) => ({ attemptId: `att_${repId}_${past ? "o" : "u"}${i}`, toE164: `+1438555${String(100 + i).padStart(4, "0")}`, dueAt: ISO(NOW + (past ? -1 : 1) * (i + 1) * 50 * MIN) }));
  return {
    period: { from: ISO(new Date(NOW).setUTCHours(0, 0, 0, 0)), to: ISO(NOW) },
    dials: S.dials, callbacksReceived: S.callbacksReceived, dispositions: mix,
    measured: { total: S.talk.total, bridged: S.talk.total, measuredOf: S.talk.of, talkMs: S.talk.meanMs ? S.talk.meanMs * S.talk.of : null, meanTalkMs: S.talk.meanMs, meanTalkText: S.talk.meanMs ? describeDuration(S.talk.meanMs) : null, holdMs: null, holdOf: 0, costCents: S.dials ? S.dials * 3 : null },
    reportedReachRate: reach, reportedReachStatement: reach.statement,
    callbacks: { booked: S.overdue + S.upcoming, upcoming: cb(S.upcoming, false), overdue: cb(S.overdue, true) },
    onCallMs: S.onCallMs, afterCallMs: 14 * MIN, pausedMs: S.pausedMs, workingMs: S.onCallMs + S.pausedMs + 2 * HOUR,
    onCallText: S.onCallMs ? describeDuration(S.onCallMs) : null, pausedText: S.pausedMs ? describeDuration(S.pausedMs) : null,
    pauses: null,
  };
}

const NOT_TRACKED_CALLS = [
  { key: "handsetDurations", label: "Talk time on calls placed from a rep's own phone", reason: "A handset dial is a tel: handoff — the operating system takes the call and FieldQuo never learns it was answered, let alone for how long. Those rows are excluded from every duration rather than counted as zero, and the count they were excluded from is printed beside the figure." },
  { key: "abandonRate", label: "Abandon rate and dialler statistics", reason: "These describe a dialler's behaviour, and FieldQuo has no dialler — a human presses the button, once, per call. There is nothing to abandon and nothing to over-dial." },
  { key: "recording", label: "Call recording and QA scoring", reason: "Recording is off. Recording a two-party call is consent law rather than a setting — several of the states the calling window already enumerates require every party to agree — so it needs a per-jurisdiction disclosure played to both legs and stored. Nothing to score follows from nothing recorded." },
  { key: "connectRate", label: "Connect rate, as a description of what a rep achieved", reason: "Twilio reports whether a call was answered, and that is printed. What it cannot report is whether the person answering was the one the rep needed — an apprentice picking up is an answered call and not a conversation." },
  { key: "voicemail", label: "Messages left by a contractor who rang back", reason: "A sales_voice number is answered now — the call is logged, and put through to the transfer destination when one is set and somebody is on the floor — but nobody who reaches the message can leave one." },
];

function floorPayload() {
  const active = REP_ROWS.filter((r) => r.active).sort((a, b) => a.name.localeCompare(b.name));
  const inbound = [
    { id: "in_1", at: ISO(NOW - 3 * HOUR - 12 * MIN), fromE164: "+15145550187", rangE164: "+14385550142", repName: "Ana-Sophie Roy-Beauchemin", businessName: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", matchedBy: "last_outbound", disposition: "reached_interested", providerStatus: "completed", talkSeconds: 312, voicemailUrl: null, voicemailSeconds: null },
    { id: "in_2", at: ISO(NOW - 2 * HOUR - 40 * MIN), fromE164: "+14075550133", rangE164: "+14075550190", repName: "Carla Mendes-Ferreira dos Santos", businessName: "Sunbelt Residential & Commercial Painting Contractors of Central Florida LLC", matchedBy: "last_outbound", disposition: null, providerStatus: "no-answer", talkSeconds: null, voicemailUrl: "https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/RE1", voicemailSeconds: 41 },
    { id: "in_3", at: ISO(NOW - 2 * HOUR - 1 * MIN), fromE164: "+16135550101", rangE164: "+16135550177", repName: null, businessName: null, matchedBy: null, disposition: null, providerStatus: "completed", talkSeconds: 18, voicemailUrl: null, voicemailSeconds: 0 },
    { id: "in_4", at: ISO(NOW - 1 * HOUR - 22 * MIN), fromE164: "+14185550166", rangE164: "+14385550142", repName: "Ana-Sophie Roy-Beauchemin", businessName: "Plomberie & Chauffage Lavoie-Deschamps et Associés", matchedBy: "last_outbound", disposition: "reached_not_interested", providerStatus: "completed", talkSeconds: 96, voicemailUrl: null, voicemailSeconds: null },
    { id: "in_5", at: ISO(NOW - 48 * MIN), fromE164: "+19045550119", rangE164: "+14075550190", repName: "Carla Mendes-Ferreira dos Santos", businessName: "Jacksonville Tile & Stone Installers", matchedBy: "last_outbound", disposition: null, providerStatus: "in-progress", talkSeconds: null, voicemailUrl: null, voicemailSeconds: null },
    { id: "in_6", at: ISO(NOW - 9 * MIN), fromE164: "+16045550158", rangE164: "+16045550199", repName: "Gita Ramanathan-Krishnamurthy", businessName: "Surrey & Langley Kitchen Cabinet Refacing Company", matchedBy: "last_outbound", disposition: null, providerStatus: "completed", talkSeconds: null, voicemailUrl: null, voicemailSeconds: null },
  ];
  const trade = (key, dials, pending, hit, of) => ({ key, label: DISCOVERY_TRADES[key]?.label || key, dials, callbacksReceived: 1, dispositions: dispositionMix({ total: dials, pending, reached: hit }), reportedReachRate: rate(hit, of), reportedReachStatement: rate(hit, of).statement });
  return {
    store: { ready: true, missing: [], pendingSchemaFile: "prisma/pending/sales-calls.prisma" },
    period: { from: ISO(new Date(NOW).setUTCHours(0, 0, 0, 0)), to: ISO(NOW) },
    reps: active.map((r) => ({ id: r.id, name: r.name, active: true, presence: presenceOf(r.id), stats: repStats(r.id) })),
    states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
    pauseReasons: Object.values(PAUSE_REASONS),
    campaigns: [
      trade("roofing", 61, 4, 19, 57), trade("painting", 48, 3, 12, 45), trade("plumbing", 33, 2, 9, 31), trade("cabinets", 21, 1, 7, 20),
      trade("hvac", 14, 1, 3, 13), trade("flooring", 9, 0, 2, 9), trade("landscaping", 4, 0, 1, 4),
      { key: "__ungrouped__", label: "No campaign — leads typed in by a rep", dials: 6, callbacksReceived: 0, dispositions: dispositionMix({ total: 6, pending: 0, reached: 3 }), reportedReachRate: rate(3, 6), reportedReachStatement: rate(3, 6).statement },
    ],
    inbound: { state: "transfer_ready", text: "The agent answers and can put the caller through to whoever is on the floor." },
    salesVoice: { state: "transfer_ready", text: "Four sales_voice numbers are held (+1 438 555 0142, +1 407 555 0190, +1 613 555 0177, +1 604 555 0199). A contractor ringing one back is logged against the rep who last called them from it and put through to +1 514 555 0100 while somebody is on the floor — three reps are right now." },
    inboundCalls: inbound,
    dialMode: { mode: "preview", requested: null, automated: false, refused: false, reason: null },
    notTracked: NOT_TRACKED_CALLS,
    teamLeadCannotSee: ["commission", "other reps' notes"],
    serverNow: ISO(NOW),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Performance
// ═══════════════════════════════════════════════════════════════════════════

const ACQUISITIONS = [
  ["cmp_planchers_dl", "Planchers de Bois Franc D.L. — Sablage & Vernissage", "rep_ana", 2, "signup_link", "trialing", "Starter", true],
  ["cmp_ftl_floor", "Fort Lauderdale Luxury Vinyl & Laminate Flooring", "rep_carla", 3, "signup_link", "trialing", "Starter", false],
  ["cmp_gatineau_plomb", "Plomberie Gatineau-Aylmer", "rep_farid", 5, "signup_link", "trialing", "Pro", true],
  ["cmp_richmond_floor", "Richmond BC Flooring Depot Installations", "rep_gita", 8, "signup_link", "active", "Starter", true],
  ["cmp_naples_paint", "Naples Fine Finishes Painting", "rep_carla", 11, "sms", "active", "Pro", true],
  ["cmp_paysagement_vm", "Paysagement Vallée-Montérégie", "rep_ana", 12, "signup_link", "active", "Starter", false],
  ["cmp_etobicoke_drywall", "Etobicoke Drywall, Taping & Plastering Contractors", "rep_dmitri", 15, "signup_link", "past_due", "Pro", true],
  ["cmp_armoires_belanger", "Armoires et Comptoirs Bélanger-Tremblay inc.", "rep_ana", 19, "signup_link", "active", "Pro", true],
  ["cmp_pensacola_hvac", "Pensacola Air Conditioning & Heating Co.", "rep_carla", 23, "signup_link", "active", "Starter", true],
  ["cmp_kanata_paint", "Kanata Painting Professionals", "rep_farid", 27, "referral", "active", "Starter", true],
  [COMPANY_ID, "Easy Roofers", "rep_ana", 40, "signup_link", "active", "Pro", true],
  ["cmp_mississauga_hvac", "Mississauga Heating, Cooling & Ductwork Specialists", "rep_ben", 44, "signup_link", "canceled", "Starter", false],
  ["cmp_magog_paint", "Peinture Magog-Orford", "rep_hugo", 120, "signup_link", "canceled", "Starter", false],
];

function performancePayload(preset) {
  const scale = { thisMonth: 1, lastMonth: 0.8, thisQuarter: 2.4, yearToDate: 5.5, lastYear: 0.6 }[preset] || 1;
  const from = { thisMonth: "2026-09-01", lastMonth: "2026-08-01", thisQuarter: "2026-07-01", yearToDate: "2026-01-01", lastYear: "2025-01-01" }[preset] || "2026-09-01";
  const to = { lastMonth: "2026-08-31", lastYear: "2025-12-31" }[preset] || "2026-09-30";
  const n = (x) => Math.round(x * scale);
  const leadsOf = (counts) => {
    const decided = counts.signed + counts.lost;
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    return {
      total, counts, unknownStatus: 0,
      byStatus: [["new", "New"], ["contacted", "Contacted"], ["demoed", "Demoed"], ["signed", "Signed"], ["lost", "Lost"]].map(([key, label]) => ({ key, label, count: counts[key] })),
      winRate: rate(counts.signed, decided), conversionRate: rate(counts.signed, total),
    };
  };
  const LEADS = {
    rep_ana: { new: 5, contacted: 9, demoed: 4, signed: 7, lost: 6 }, rep_ben: { new: 2, contacted: 3, demoed: 1, signed: 2, lost: 4 },
    rep_carla: { new: 8, contacted: 14, demoed: 6, signed: 9, lost: 11 }, rep_dmitri: { new: 3, contacted: 2, demoed: 0, signed: 1, lost: 2 },
    rep_eloise: { new: 0, contacted: 0, demoed: 0, signed: 0, lost: 0 }, rep_farid: { new: 4, contacted: 6, demoed: 3, signed: 3, lost: 3 },
    rep_gita: { new: 6, contacted: 2, demoed: 1, signed: 4, lost: 1 }, rep_hugo: { new: 0, contacted: 0, demoed: 0, signed: 2, lost: 5 },
  };
  const reps = REP_ROWS.map((r) => {
    const mine = ENTRIES.filter((e) => e.salesRepId === r.id);
    const statusOf = (e) => (e.payoutBatchId ? batchById.get(e.payoutBatchId)?.status || "open" : null);
    const positives = mine.filter((e) => e.amountCents > 0);
    const negatives = mine.filter((e) => e.amountCents < 0);
    const paid = sum(mine.filter((e) => statusOf(e) === "paid"));
    const thisWeek = ACQUISITIONS.filter((a) => a[2] === r.id && a[3] <= 6).length;
    return {
      id: r.id, name: r.name, code: r.code, active: r.active, endedAt: r.endedAt, acceptedAt: r.acceptedAt, hasCommissionPlan: Boolean(r.commissionPlanId),
      signups: { today: ACQUISITIONS.filter((a) => a[2] === r.id && a[3] <= 1).length, thisWeek, total: r.companies.length, inPeriod: Math.min(r.companies.length, n(ACQUISITIONS.filter((a) => a[2] === r.id && a[3] <= 30).length)) },
      milestones: { activation: positives.filter((e) => e.milestone === "activation").length, first_payment: positives.filter((e) => e.milestone === "first_payment").length, retention: positives.filter((e) => e.milestone === "retention").length },
      commission: { earnedCents: sum(positives), reversedCents: Math.abs(sum(negatives)), balanceCents: sum(mine), payableCents: sum(mine.filter((e) => !e.payoutBatchId)), batchedCents: sum(mine.filter((e) => e.payoutBatchId)), paidCents: paid, owedCents: sum(mine) - paid, reversalCount: negatives.length },
      leads: leadsOf(LEADS[r.id]),
    };
  }).sort((a, b) => b.signups.thisWeek - a.signups.thisWeek || b.signups.inPeriod - a.signups.inPeriod || b.signups.total - a.signups.total || a.name.localeCompare(b.name));
  const attributed = REP_ROWS.reduce((s, r) => s + r.companies.length, 0);
  const allLeads = Object.values(LEADS).reduce((acc, c) => { for (const k of Object.keys(c)) acc[k] = (acc[k] || 0) + c[k]; return acc; }, {});
  const unplanned = REP_ROWS.filter((r) => !r.commissionPlanId);
  const blind = unplanned.reduce((s, r) => s + r.companies.length, 0);
  return {
    period: { from, to },
    headline: {
      signupsThisWeek: ACQUISITIONS.filter((a) => a[3] <= 6).length, signupsToday: ACQUISITIONS.filter((a) => a[3] <= 1).length,
      signupsInPeriod: n(ACQUISITIONS.filter((a) => a[3] <= 30).length), signupsTotal: attributed,
      weekStartsAt: ISO(W0), dayStartsAt: ISO(new Date(NOW).setUTCHours(0, 0, 0, 0)),
      owedCents: reps.reduce((s, r) => s + r.commission.owedCents, 0), paidCents: reps.reduce((s, r) => s + r.commission.paidCents, 0), reversedCents: reps.reduce((s, r) => s + r.commission.reversedCents, 0),
      activeReps: REP_ROWS.filter((r) => r.active).length, repsWithoutPlan: unplanned.length,
    },
    reps,
    funnel: {
      stages: [
        { key: "attributed", label: "Brought in", count: attributed, source: "fact", incomplete: false, reason: null },
        { key: "activation", label: "Activated", count: 21, source: "fact", incomplete: false, reason: null },
        { key: "first_payment", label: "Renewed", count: 14, source: "ledger", incomplete: blind > 0, reason: blind > 0 ? "unplanned_reps" : null },
        { key: "retention", label: "Still paying", count: 8, source: "ledger", incomplete: blind > 0, reason: blind > 0 ? "unplanned_reps" : null },
      ],
      blindCompanies: blind,
      activationRate: rate(21, attributed), retentionRate: rate(8, attributed),
      incompleteReason: blind > 0 ? `${blind} attributed ${blind === 1 ? "company is" : "companies are"} invisible to the payment stages: the rep who brought them in has no commission plan, so no ledger row was ever written. Assign a plan and the stages fill in from the next milestone onwards.` : null,
    },
    pipeline: leadsOf(allLeads),
    notTracked: [
      { key: "costPerAcquisition", label: "Cost per acquisition", reason: "Nothing in this database holds what a rep costs. SalesCommissionPlan is what FieldQuo pays PER SALE, not salary, tooling or the hours behind an unsold call — so a CAC built from it would be the commission figure wearing a different name." },
      { key: "callsAndTalkTime", label: "Calls made, talk time, connect rate", reason: "The sales floor board has today's calls; this report does not fold receptionist minutes into a person's day." },
      { key: "timeToClose", label: "Time from first touch to signup", reason: "SalesLead.createdAt is when a REP TYPED the lead in, which is usually after the first conversation and sometimes days after it. Measuring from a data-entry timestamp would produce a number that improves when reps get slower at paperwork." },
      { key: "pipelineValue", label: "Pipeline value", reason: "A SalesLead carries no deal size, and it could not: what a contractor will pay is their plan price, which is not chosen until signup." },
    ],
    floors: { rate: 10, count: 5 },
    acquisitions: ACQUISITIONS.map(([companyId, companyName, repId, daysAgo, source, subscriptionStatus, planName, chargesEnabled]) => ({
      companyId, companyName, repId, repName: REP_ROWS.find((r) => r.id === repId)?.name || null,
      capturedAt: ISO(NOW - daysAgo * DAY - 9 * HOUR), source, isDemo: companyId === "cmp_magog_paint",
      chargesEnabled, onboardingStatus: chargesEnabled ? "complete" : "pending_stripe", subscriptionStatus, planName,
      canceledAt: subscriptionStatus === "canceled" ? ISO(NOW - (daysAgo - 10) * DAY) : null,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Growth — the real projection over invented actuals
// ═══════════════════════════════════════════════════════════════════════════

function growthPayload() {
  const now = new Date(NOW);
  const assumptions = { reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, reach: 0.18, signup: 0.06, conversion: 0.35, churn: 0.04, referral: 0.03, organic: 4, refill: 20000, redial: 0.004, marketing: null, marketingSpend: 3000, marketingCostPerSignup: 120, saved: true };
  // Six finished months, oldest first; the first is the launch month, the
  // rates are measured from the five after it.
  const raw = [
    { dials: 1840, reached: 302, rep: 9, referral: 0, marketing: 0, organic: 1, prospectsAdded: 1320105, payingAtStart: 0, churned: 0 },
    { dials: 6210, reached: 1088, rep: 41, referral: 1, marketing: 2, organic: 3, prospectsAdded: 0, payingAtStart: 7, churned: 0 },
    { dials: 9875, reached: 1791, rep: 78, referral: 2, marketing: 3, organic: 4, prospectsAdded: 18240, payingAtStart: 39, churned: 1 },
    { dials: 14320, reached: 2612, rep: 131, referral: 4, marketing: 5, organic: 6, prospectsAdded: 22910, payingAtStart: 88, churned: 3 },
    { dials: 18960, reached: 3407, rep: 176, referral: 7, marketing: 9, organic: 5, prospectsAdded: 19870, payingAtStart: 149, churned: 6 },
    { dials: 21440, reached: 3891, rep: 204, referral: 11, marketing: 12, organic: 8, prospectsAdded: 24160, payingAtStart: 212, churned: 9 },
  ];
  const byMonth = raw.map((m, i) => ({ label: monthLabel(now, -(6 - i)), dials: m.dials, reached: m.reached, signups: { rep: m.rep, referral: m.referral, marketing: m.marketing, organic: m.organic, total: m.rep + m.referral + m.marketing + m.organic }, prospectsAdded: m.prospectsAdded, payingAtStart: m.payingAtStart, churned: m.churned }));
  const cur = { dials: 8720, reached: 1566, rep: 84, referral: 5, marketing: 4, organic: 3, prospectsAdded: 9410, payingAtStart: 261, churned: 4 };
  const currentMonth = { label: monthLabel(now, 0), dials: cur.dials, reached: cur.reached, signups: { rep: cur.rep, referral: cur.referral, marketing: cur.marketing, organic: cur.organic, total: cur.rep + cur.referral + cur.marketing + cur.organic }, prospectsAdded: cur.prospectsAdded, payingAtStart: cur.payingAtStart, churned: cur.churned, partial: true, dayOfMonth: now.getUTCDate() };
  const observed = byMonth.slice(1);
  const sumOf = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
  const churnMonths = observed.filter((m) => m.payingAtStart >= GROWTH_FLOORS.churnBase);
  const dispositioned = sumOf(byMonth, (m) => m.dials) + cur.dials - 4120;
  const reached = sumOf(byMonth, (m) => m.reached) + cur.reached;
  const attributions = sumOf(byMonth, (m) => m.signups.rep) + cur.rep;
  const rates = {
    reach: growthRate({ hit: reached, of: dispositioned, floor: GROWTH_FLOORS.reach, assumed: assumptions.reach }),
    signup: growthRate({ hit: attributions, of: reached, floor: GROWTH_FLOORS.signup, assumed: assumptions.signup }),
    conversion: growthRate({ hit: 143, of: 388, floor: GROWTH_FLOORS.conversion, assumed: assumptions.conversion }),
    churn: monthsRate({ hit: sumOf(churnMonths, (m) => m.churned), of: sumOf(churnMonths, (m) => m.payingAtStart), months: churnMonths.length, floorMonths: GROWTH_FLOORS.churnMonths, assumed: assumptions.churn }),
    referral: monthsRate({ hit: sumOf(churnMonths, (m) => m.signups.referral), of: sumOf(churnMonths, (m) => m.payingAtStart), months: churnMonths.length, floorMonths: GROWTH_FLOORS.referralMonths, assumed: assumptions.referral, max: 10 }),
    redial: growthRate({ hit: 3, of: 612, floor: GROWTH_FLOORS.redial, assumed: assumptions.redial }),
  };
  const organic = monthlyCount({ total: sumOf(observed, (m) => m.signups.organic), months: observed.length, floorMonths: GROWTH_FLOORS.organicMonths, assumed: assumptions.organic });
  const refill = monthlyCount({ total: sumOf(observed, (m) => m.prospectsAdded), months: observed.length, floorMonths: GROWTH_FLOORS.refillMonths, assumed: assumptions.refill });
  const marketing = monthlyCount({ total: sumOf(observed, (m) => m.signups.marketing), months: observed.length, floorMonths: GROWTH_FLOORS.marketingMonths, assumed: marketingAssumption(assumptions) });
  const measured = {
    rates, organic, refill, marketing,
    starting: { paying: 261, trialing: 38 },
    repsActive: REP_ROWS.filter((r) => r.active).length,
    listSize: 1320105 + 9410 + sumOf(observed, (m) => m.prospectsAdded),
    actuals: {
      dialsLast30: 21840, dialsPerDayLast30: 728, observedMonths: observed.length, byMonth,
      firstObservedMonth: observed[0].label, launchMonth: byMonth[0].label, currentMonth,
      reachedCodes: ["reached_interested", "reached_not_interested"], repeatDials: 612, repeatSignups: 3, listLoadMonth: byMonth[0].label,
    },
  };
  let forecast = null;
  let needs = [];
  try {
    forecast = project({ reps: assumptions.reps, dialsPerRepPerDay: assumptions.dialsPerRepPerDay, workingDaysPerMonth: assumptions.workingDaysPerMonth, rates, organic, refill, marketing, startingPaying: measured.starting.paying, startingTrialing: measured.starting.trialing, listSize: measured.listSize, trialMonths: 1, now });
  } catch (err) {
    if (!Array.isArray(err?.missing)) throw err;
    needs = err.missing;
  }
  return { assumptions, measured, forecast, needs, fields: ASSUMPTION_FIELDS, floors: GROWTH_FLOORS, milestones: GROWTH_MILESTONES, generatedAt: now.toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════
// Notes
// ═══════════════════════════════════════════════════════════════════════════

const NOTES = [
  { id: "note_01", salesRepId: "rep_ana", title: "Toiture Rive-Sud — rappeler après le 15", body: "Le propriétaire (M. Beauchemin père) veut voir la soumission bilingue avant de signer.\nLe fils gère les courriels: jf.beauchemin@toiture-rivesud-beauchemin-et-fils.qc.ca\nIls utilisent Jobber depuis 2022 et se plaignent du prix — 3 sièges à 129 $/mois.\nPoint sensible: la synchronisation QuickBooks, ils ont eu un double paiement en mai.", bodyFormat: "text", leadId: "lead_toiture_rs", threadId: null, prospectId: null, parentLabel: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", archivedAt: null, createdAt: "2026-09-11T14:22:00.000Z", updatedAt: "2026-09-12T18:05:00.000Z" },
  { id: "note_02", salesRepId: "rep_carla", title: "Sunbelt Painting — demo notes", body: "Owner Marcus wants the crew app in Spanish for 6 of his 9 painters. Showed him the quote PDF in Spanish with his logo, he pulled up a competitor's quote on his phone and compared them side by side.\nObjection: 'my guys won't use another app'. Answered with the SMS-only crew flow.\nNext: send the Florida telemarketer disclosure PDF he asked about, then the trial link Tuesday.", bodyFormat: "text", leadId: "lead_sunbelt", threadId: null, prospectId: null, parentLabel: "Sunbelt Residential & Commercial Painting Contractors of Central Florida LLC", archivedAt: null, createdAt: "2026-09-09T20:10:00.000Z", updatedAt: "2026-09-12T16:40:00.000Z" },
  { id: "note_03", salesRepId: "rep_ana", title: null, body: "Script tweak for Québec plumbers: lead with the RBQ licence number being printed on the quote automatically. Three of four asked whether it does that unprompted.", bodyFormat: "text", leadId: null, threadId: null, prospectId: null, parentLabel: null, archivedAt: null, createdAt: "2026-09-12T13:00:00.000Z", updatedAt: "2026-09-12T13:00:00.000Z" },
  { id: "note_04", salesRepId: "rep_farid", title: "Ottawa-Gatineau Roofing — Stripe onboarding stuck", body: "Their bookkeeper (Priya) is the one who has to finish the Stripe identity check and she is away until the 21st. Owner asked me not to chase him about it. Retention milestone depends on this — flagging so nobody rings him twice.", bodyFormat: "text", leadId: null, threadId: "thr_ottawa_roof", prospectId: null, parentLabel: "Ottawa-Gatineau Roofing & Exterior Renovations — reply thread", archivedAt: null, createdAt: "2026-09-10T15:30:00.000Z", updatedAt: "2026-09-11T09:12:00.000Z" },
  { id: "note_05", salesRepId: "rep_gita", title: "Brampton Paving — signup flagged from India", body: "Called the number on the website; the owner (Harpreet) confirmed he signed up himself while visiting family in Ludhiana. Business is real, 14 trucks, yard on Steeles Ave W. Told the origins review it is fine to clear.", bodyFormat: "text", leadId: "lead_brampton_pave", threadId: null, prospectId: null, parentLabel: "Brampton Interlock, Paving & Concrete Ltd.", archivedAt: null, createdAt: "2026-09-08T17:45:00.000Z", updatedAt: "2026-09-08T17:45:00.000Z" },
  { id: "note_06", salesRepId: "rep_dmitri", title: "Etobicoke Drywall — past due", body: "Card declined on the second cycle. Owner says the business card was replaced after fraud; he will update it 'this week'. Second time he has said that.", bodyFormat: "text", leadId: null, threadId: null, prospectId: "pr_etobicoke_dw", parentLabel: "Etobicoke Drywall, Taping & Plastering Contractors", archivedAt: null, createdAt: "2026-09-05T19:20:00.000Z", updatedAt: "2026-09-12T11:55:00.000Z" },
  { id: "note_07", salesRepId: "rep_carla", title: "Pensacola A/C — referral", body: "Jim referred his brother-in-law's plumbing outfit in Mobile AL. Alabama needs the telemarketer registration before I can call — parked until it is recorded on the campaigns screen. Email is fine.", bodyFormat: "text", leadId: null, threadId: null, prospectId: "pr_mobile_plumb", parentLabel: "Mobile Bay Plumbing & Drain (referral)", archivedAt: null, createdAt: "2026-09-07T21:00:00.000Z", updatedAt: "2026-09-07T21:00:00.000Z" },
  { id: "note_08", salesRepId: "rep_ben", title: "Mississauga HVAC — why they cancelled", body: "Cancelled after 6 weeks. Reason given: they never got the booking page onto their Google Business Profile and the office manager went back to the paper calendar. Nobody walked them through it after the demo. Worth a re-approach in the spring with the onboarding call offered up front.", bodyFormat: "text", leadId: "lead_miss_hvac", threadId: null, prospectId: null, parentLabel: "Mississauga Heating, Cooling & Ductwork Specialists", archivedAt: null, createdAt: "2026-08-29T14:00:00.000Z", updatedAt: "2026-09-02T10:30:00.000Z" },
  { id: "note_09", salesRepId: "rep_ana", title: "Armoires Bélanger-Tremblay", body: "Deux associés, décision à deux. Stéphane veut le catalogue de prix par pied linéaire; Marie-Ève veut voir la facture d'acompte. Démo refaite avec les deux le 3 septembre — signé le 4.", bodyFormat: "text", leadId: "lead_belanger", threadId: null, prospectId: null, parentLabel: "Armoires et Comptoirs Bélanger-Tremblay inc.", archivedAt: null, createdAt: "2026-09-03T22:10:00.000Z", updatedAt: "2026-09-04T15:00:00.000Z" },
  { id: "note_10", salesRepId: "rep_gita", title: null, body: "Punjabi-speaking owners in Surrey ask first whether the quote can go out in Punjabi. It cannot — the document languages are EN/FR/ES/UK/PA... check which. Do not promise it on the call until confirmed.", bodyFormat: "text", leadId: null, threadId: null, prospectId: null, parentLabel: null, archivedAt: null, createdAt: "2026-09-06T16:20:00.000Z", updatedAt: "2026-09-06T16:20:00.000Z" },
  { id: "note_11", salesRepId: "rep_farid", title: "Kanata Painting — referred by Ottawa-Gatineau Roofing", body: "Came in on the referral code, not my link — attribution went to the referrer, which is right. Keeping the note because he asked for the French quote template next week.", bodyFormat: "text", leadId: "lead_kanata", threadId: null, prospectId: null, parentLabel: "Kanata Painting Professionals", archivedAt: null, createdAt: "2026-08-31T13:40:00.000Z", updatedAt: "2026-08-31T13:40:00.000Z" },
];
const noteRow = (n) => ({ ...n, salesRep: (() => { const r = REP_ROWS.find((x) => x.id === n.salesRepId); return r ? { id: r.id, name: r.name, email: r.email, active: r.active } : null; })() });
const notePreview = (n) => (n.body.length <= 200 ? n : { ...n, body: n.body.slice(0, 200), bodyTruncated: true });

function notesPayload(repId) {
  const notes = NOTES.filter((n) => !n.archivedAt && (!repId || n.salesRepId === repId)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const counts = {};
  for (const n of NOTES) if (!n.archivedAt) counts[n.salesRepId] = (counts[n.salesRepId] || 0) + 1;
  return {
    notes: notes.map((n) => notePreview(noteRow(n))),
    reps: [...REP_ROWS].sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ id: r.id, name: r.name, email: r.email, active: r.active })),
    counts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaigns, registrations, windows
// ═══════════════════════════════════════════════════════════════════════════

const CERTIFICATES = [
  { id: "reg_wa", jurisdictionKey: "US-WA", certificateNumber: "CTS-2026-004417", registeredAt: "2026-03-01T00:00:00.000Z", expiresAt: "2027-02-28T23:59:59.000Z", revokedAt: null, note: "Renews annually with the Secretary of State; bond on file." },
  { id: "reg_tx", jurisdictionKey: "US-TX", certificateNumber: "TX-TELE-88213", registeredAt: "2026-06-15T00:00:00.000Z", expiresAt: null, revokedAt: null, note: "Registration through the Secretary of State does not expire; the $10,000 security stays posted." },
  { id: "reg_ut", jurisdictionKey: "US-UT", certificateNumber: "UT-DCP-2025-1190", registeredAt: "2025-07-01T00:00:00.000Z", expiresAt: "2026-06-30T23:59:59.000Z", revokedAt: null, note: "Lapsed 30 June 2026 — renewal not filed." },
  { id: "reg_nj", jurisdictionKey: "US-NJ", certificateNumber: "NJ-TM-31007", registeredAt: "2026-02-10T00:00:00.000Z", expiresAt: "2027-02-09T23:59:59.000Z", revokedAt: "2026-08-22T00:00:00.000Z", revokedReason: "Agent for service resigned; re-filing." },
];
const jurisdictionsLive = () => withRegistrations(registeredKeys(CERTIFICATES, new Date(NOW)));

const TERRITORIES = [
  { id: "ter_qc", name: "Québec — whole province", country: "CA", province: "QC", city: null, centerLat: null, centerLng: null, radiusKm: null, active: true, createdAt: "2026-07-02T14:00:00.000Z" },
  { id: "ter_mtl_60", name: "Montréal et Rive-Sud — 60 km around Longueuil", country: "CA", province: "QC", city: "Longueuil", centerLat: "45.536900", centerLng: "-73.510800", radiusKm: 60, active: true, createdAt: "2026-07-20T11:15:00.000Z" },
  { id: "ter_on", name: "Ontario — whole province", country: "CA", province: "ON", city: null, centerLat: null, centerLng: null, radiusKm: null, active: true, createdAt: "2026-07-05T09:00:00.000Z" },
  { id: "ter_fl_central", name: "Central Florida — 120 km around Orlando", country: "US", province: "FL", city: "Orlando", centerLat: "28.538300", centerLng: "-81.379200", radiusKm: 120, active: true, createdAt: "2026-08-01T16:30:00.000Z" },
  { id: "ter_ca_state", name: "California — whole state", country: "US", province: "CA", city: null, centerLat: null, centerLng: null, radiusKm: null, active: true, createdAt: "2026-08-12T18:00:00.000Z" },
  { id: "ter_wa", name: "Washington State — whole state", country: "US", province: "WA", city: null, centerLat: null, centerLng: null, radiusKm: null, active: true, createdAt: "2026-08-25T15:45:00.000Z" },
  { id: "ter_al", name: "Alabama — whole state", country: "US", province: "AL", city: null, centerLat: null, centerLng: null, radiusKm: null, active: true, createdAt: "2026-09-08T13:00:00.000Z" },
];
const territoryById = (id) => TERRITORIES.find((t) => t.id === id) || null;

const SOURCE_META = {
  overture: { label: "Overture Places", licence: { name: "CDLA-Permissive-2.0", url: "https://cdla.dev/permissive-2-0/", obligation: "No attribution is required in anything built from this data. The obligation is on the DATA: if the rows are passed on to anyone outside FieldQuo, the licence notice and disclaimer go with them." } },
  rbq: { label: "RBQ — Quebec contractor licences", licence: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", obligation: "Attribution is a CONDITION of the grant, not a courtesy: every surface that shows a business discovered here must carry the notice below. Commercial use and redistribution are permitted once it does.", attribution: "Contient des données de la Régie du bâtiment du Québec (Registre des détenteurs de licence), sous licence CC BY 4.0." } },
  us_ca_cslb: { label: "California CSLB — licensed contractors", licence: { name: "Public record (California Public Records Act)", url: "https://www.cslb.ca.gov/", obligation: "Public record; no attribution required. The board asks that the licence status be shown as of the release date." } },
  us_wa_lni: { label: "Washington L&I — contractor registrations", licence: { name: "Public record (Washington Public Records Act)", url: "https://lni.wa.gov/", obligation: "Public record; no attribution required." } },
  us_or_ccb: { label: "Oregon CCB — active contractor licences", licence: { name: "Public record", url: "https://www.oregon.gov/ccb/", obligation: "Public record; no attribution required." } },
};
const PROVIDERS = Object.entries(SOURCE_META).map(([key, m]) => ({
  key, label: m.label,
  description: key === "rbq"
    ? "Active construction licences from Quebec's Régie du bâtiment — 54,264 licence-holders, 92% with a phone and 87% with an email, every one an active licence the regulator asserts today. Names no trade for anybody, so rows are banked and classified when they are read."
    : key === "overture" ? "Free, open business listings under CDLA-Permissive-2.0. Read from a snapshot extracted offline from the current Overture release."
    : `${m.label}: the board's own licence register, read from a snapshot in the library.`,
  configFields: [{ name: "snapshotUrl", label: "Snapshot URL", required: true, help: "Filled from the library." }],
  licence: m.licence,
  unavailable: key === "us_or_ccb" ? "The Oregon extract in the library is from release 2026-05 and the board changed its file layout in July; the reader refuses it until the snapshot is rebuilt." : null,
}));

// [id, name, territoryId, tradeKey|null, allTrades, targetCount, sources, status, counts{found,dup,acc,ready,review,rej,noSite,unmapped,banked}, sourceState, startedAt, completedAt, createdAt]
const CAMPAIGN_ROWS = [
  { id: CAMPAIGN_ID, name: "Québec — RBQ licence-holders + Overture, every trade (part 1 of 3)", territoryId: "ter_qc", tradeKey: null, allTrades: true, targetCount: 25000, discoverySources: ["rbq", "overture"], status: "running",
    counts: { foundCount: 41207, duplicateCount: 3312, acceptedCount: 18471, readyCount: 12904, needsReviewCount: 23, rejectedCount: 5108, noWebsiteCount: 6211, unmappedCount: 14293, bankedCount: 14102 },
    sourceState: { rbq: { cursor: "38400", ended: false, blocked: null, failures: 0, lastError: null, lastErrorAt: null }, overture: { cursor: "12000", ended: false, blocked: null, failures: 2, lastError: "HTTP 503 from the snapshot bucket (attempt 2 of 6)", lastErrorAt: ISO(NOW - 11 * MIN) } },
    startedAt: "2026-09-02T13:05:00.000Z", completedAt: null, createdAt: "2026-09-02T12:58:00.000Z" },
  { id: "camp_mtl_roof", name: "Montréal Rive-Sud — roofing", territoryId: "ter_mtl_60", tradeKey: "roofing", allTrades: false, targetCount: 800, discoverySources: ["overture"], status: "completed",
    counts: { foundCount: 2141, duplicateCount: 188, acceptedCount: 812, readyCount: 790, needsReviewCount: 0, rejectedCount: 402, noWebsiteCount: 233, unmappedCount: 739, bankedCount: 0 },
    sourceState: { overture: { cursor: "2141", ended: true, blocked: null, failures: 0, lastError: null, lastErrorAt: null } },
    startedAt: "2026-07-21T14:00:00.000Z", completedAt: "2026-07-21T19:42:00.000Z", createdAt: "2026-07-20T11:20:00.000Z" },
  { id: "camp_on_paint", name: "Ontario — painting contractors", territoryId: "ter_on", tradeKey: "painting", allTrades: false, targetCount: 3000, discoverySources: ["overture"], status: "paused",
    counts: { foundCount: 9860, duplicateCount: 1204, acceptedCount: 2266, readyCount: 2011, needsReviewCount: 41, rejectedCount: 1877, noWebsiteCount: 690, unmappedCount: 4472, bankedCount: 0 },
    sourceState: { overture: { cursor: "9860", ended: false, blocked: "The snapshot bucket returned 403 Forbidden six times in a row — the public base URL may have been changed. Fix it under Snapshots and resume.", failures: 6, lastError: "HTTP 403 from the snapshot bucket", lastErrorAt: "2026-09-11T03:14:00.000Z" } },
    startedAt: "2026-09-09T12:00:00.000Z", completedAt: null, createdAt: "2026-09-08T17:10:00.000Z" },
  { id: "camp_fl_paint", name: "Central Florida — painting & cabinets (Spanish-speaking crews)", territoryId: "ter_fl_central", tradeKey: "painting", allTrades: false, targetCount: 1500, discoverySources: ["overture"], status: "running",
    counts: { foundCount: 4022, duplicateCount: 311, acceptedCount: 1188, readyCount: 903, needsReviewCount: 17, rejectedCount: 640, noWebsiteCount: 412, unmappedCount: 1866, bankedCount: 0 },
    sourceState: { overture: { cursor: "4022", ended: false, blocked: null, failures: 0, lastError: null, lastErrorAt: null } },
    startedAt: "2026-09-10T15:30:00.000Z", completedAt: null, createdAt: "2026-09-10T15:22:00.000Z" },
  { id: "camp_ca_cslb_1", name: "California CSLB — every trade (part 1 of 5)", territoryId: "ter_ca_state", tradeKey: null, allTrades: true, discoverySources: ["us_ca_cslb"], targetCount: 50000, status: "completed",
    counts: { foundCount: 50000, duplicateCount: 2216, acceptedCount: 23494, readyCount: 20017, needsReviewCount: 0, rejectedCount: 1993, noWebsiteCount: 9870, unmappedCount: 22297, bankedCount: 22297 },
    sourceState: { us_ca_cslb: { cursor: "50000", ended: true, blocked: null, failures: 0, lastError: null, lastErrorAt: null } },
    startedAt: "2026-08-12T18:20:00.000Z", completedAt: "2026-08-14T02:11:00.000Z", createdAt: "2026-08-12T18:05:00.000Z" },
  { id: "camp_ca_cslb_2", name: "California CSLB — every trade (part 2 of 5)", territoryId: "ter_ca_state", tradeKey: null, allTrades: true, discoverySources: ["us_ca_cslb"], targetCount: 50000, status: "draft",
    counts: { foundCount: 0, duplicateCount: 0, acceptedCount: 0, readyCount: 0, needsReviewCount: 0, rejectedCount: 0, noWebsiteCount: 0, unmappedCount: 0, bankedCount: 0 },
    sourceState: null, startedAt: null, completedAt: null, createdAt: "2026-08-12T18:05:30.000Z" },
  { id: "camp_wa_lni", name: "Washington State — plumbing & HVAC (L&I register)", territoryId: "ter_wa", tradeKey: "plumbing", allTrades: false, discoverySources: ["us_wa_lni", "overture"], targetCount: 2500, status: "draft",
    counts: { foundCount: 0, duplicateCount: 0, acceptedCount: 0, readyCount: 0, needsReviewCount: 0, rejectedCount: 0, noWebsiteCount: 0, unmappedCount: 0, bankedCount: 0 },
    sourceState: null, startedAt: null, completedAt: null, createdAt: "2026-08-25T15:50:00.000Z" },
  { id: "camp_al_roof", name: "Alabama — roofing (waiting on telemarketer registration)", territoryId: "ter_al", tradeKey: "roofing", allTrades: false, discoverySources: ["overture"], targetCount: 600, status: "draft",
    counts: { foundCount: 0, duplicateCount: 0, acceptedCount: 0, readyCount: 0, needsReviewCount: 0, rejectedCount: 0, noWebsiteCount: 0, unmappedCount: 0, bankedCount: 0 },
    sourceState: null, startedAt: null, completedAt: null, createdAt: "2026-09-08T13:05:00.000Z" },
  { id: "camp_qc_old", name: "Québec — cabinets (first attempt, wrong file)", territoryId: "ter_qc", tradeKey: "cabinets", allTrades: false, discoverySources: ["rbq"], targetCount: 400, status: "cancelled",
    counts: { foundCount: 120, duplicateCount: 0, acceptedCount: 0, readyCount: 0, needsReviewCount: 0, rejectedCount: 0, noWebsiteCount: 0, unmappedCount: 120, bankedCount: 120 },
    sourceState: { rbq: { cursor: "120", ended: false, blocked: "Cancelled by emilio@fieldquo.com.", failures: 0, lastError: null, lastErrorAt: null } },
    startedAt: "2026-07-03T10:00:00.000Z", completedAt: null, createdAt: "2026-07-02T14:05:00.000Z" },
];

function campaignRow(c) {
  const { counts, ...rest } = c;
  return { ...rest, ...counts, keywords: [], sourceConfigs: null, discoveryProvider: null, providerConfig: null, discoveryCursor: null, territory: territoryById(c.territoryId) };
}
function sourcesOf(c) {
  return c.discoverySources.map((key) => {
    const meta = SOURCE_META[key];
    const provider = PROVIDERS.find((p) => p.key === key);
    const state = c.sourceState?.[key] || { cursor: null, ended: false, blocked: null, failures: 0, lastError: null, lastErrorAt: null };
    const unavailable = provider?.unavailable || null;
    return { key, label: meta?.label || key, registered: Boolean(meta), licence: meta?.licence || null, unavailable, configOk: Boolean(meta) && !unavailable, problems: unavailable ? [unavailable] : [], summary: meta ? `${c.territory?.province || territoryById(c.territoryId)?.province}-${key}-2026-08.ndjson.gz from the library (release 2026-08-01)` : "", state };
  });
}

function campaignsPayload() {
  const rows = CAMPAIGN_ROWS.map(campaignRow).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return {
    registeredJurisdictions: registeredKeys(CERTIFICATES, new Date(NOW)),
    library: { baseUrl: "https://pub-4f1c9e2a7b3d4c8e9f0a1b2c3d4e5f60.r2.dev/fieldquo-snapshots", verifiedObjectKey: "CA-QC-rbq-2026-08.ndjson.gz", verifiedRows: 54264, verifiedAt: "2026-09-01T18:22:00.000Z", configured: true },
    campaigns: rows.map((c) => {
      const sources = sourcesOf(c);
      return {
        ...c, tradeLabel: campaignTradeLabel(c), progress: campaignProgress(c), funnel: funnelRows(c),
        sources: sources.map((s) => ({ key: s.key, label: s.label, ready: s.configOk, blocked: s.state.blocked, ended: s.state.ended })),
        sourcesReady: sources.length > 0 && sources.every((s) => s.configOk),
      };
    }),
    territories: TERRITORIES,
    providers: PROVIDERS,
    trades: Object.keys(DISCOVERY_TRADES).map((key) => ({ key, label: DISCOVERY_TRADES[key].label, categoryKeys: DISCOVERY_TRADES[key].categoryKeys || [] })),
  };
}

// lib/sales/pipeline/progress.js's stageBoard() + boardSummary(), ported:
// that module re-exports ensureResearchQueued from ./research, which reaches
// @/lib/db, so it cannot be bundled for the browser. Same labels, same
// arithmetic, same sentence.
const STAGES = [
  ["DISCOVER_BUSINESSES", "Finding businesses", "Pages through the directory file and accepts the rows that look like contractors."],
  ["ENRICH_BUSINESS", "Checking we may contact them", "Re-reads the row against the do-not-contact and suppression lists, then sends it to the crawler — or straight past it, if the business has no website."],
  ["CRAWL_WEBSITE", "Reading their website", "Asks robots.txt, then fetches a few pages and records what they say. Skips a site crawled recently."],
  ["DETECT_TECHNOLOGY", "Working out what software they run", "Matches the pages against known signatures — the booking widget, the CMS, the competitor."],
  ["ANALYZE_CAPABILITIES", "Seeing what their site can do", "Forms, booking links, schema.org blocks — what a homeowner can actually do on the site."],
  ["DETECT_OPPORTUNITIES", "Finding what they are missing", "Turns those capabilities into the gaps worth a phone call. No quoting online, no booking, no reviews."],
  ["CALCULATE_LEAD_SCORE", "Scoring the lead", "Ranks the business against the rest of the campaign so a rep calls the best one first."],
  ["INFER_FROM_SITE", "Reading what their site says about them", "Only for a business a rep has claimed: a model reads the about, services and home pages and records the owner's name, the years, the crew, the service area — each with the exact sentence it came from, or not at all."],
  ["GENERATE_RESEARCH_BRIEF", "Writing the rep's brief", "The one page a rep reads before dialling. Spends money at a model when a rep is waiting; composed from rows alone for the backlog."],
  ["GENERATE_CALL_SCRIPT", "Writing the call script", "Only for a business a rep has claimed: turns the brief, the capabilities and the tier playbook into the script for this one call."],
];
function stageBoard(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (!counts.has(r.kind)) counts.set(r.kind, {});
    counts.get(r.kind)[r.status] = (counts.get(r.kind)[r.status] || 0) + r.count;
  }
  return STAGES.map(([kind, label, what]) => {
    const c = counts.get(kind) || {};
    const queued = c.queued || 0, claimed = c.claimed || 0, done = c.done || 0, failed = c.failed || 0, abandoned = c.abandoned || 0;
    const total = queued + claimed + done + failed + abandoned;
    let settled = null;
    if (total > 0) {
      const pct = Math.round(((done + failed + abandoned) / total) * 100);
      settled = queued + claimed > 0 ? Math.min(pct, 99) : pct;
    }
    const state = claimed > 0 ? "working" : queued > 0 ? "waiting" : failed + abandoned > 0 ? "stopped" : done > 0 ? "done" : "not_started";
    return { kind, label, what, queued, claimed, done, failed, abandoned, total, settled, state, known: true };
  });
}
function boardSummary(board) {
  const working = board.filter((s) => s.state === "working");
  const waiting = board.filter((s) => s.state === "waiting");
  const stopped = board.filter((s) => s.state === "stopped" || s.failed + s.abandoned > 0);
  const inFlight = board.reduce((n, s) => n + s.claimed, 0);
  const outstanding = board.reduce((n, s) => n + s.queued + s.claimed, 0);
  let sentence = "Nothing queued. Every stage has finished what it was given.";
  if (working.length) {
    const names = working.map((s) => s.label.toLowerCase());
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    sentence = `Working on ${list} right now — ${inFlight} ${inFlight === 1 ? "task" : "tasks"} in flight.`;
  } else if (waiting.length) {
    sentence = `${outstanding} ${outstanding === 1 ? "task is" : "tasks are"} queued, waiting for the next run. Next up: ${waiting[0].label.toLowerCase()}.`;
  }
  return { running: working.length ? working.map((s) => s.label) : null, next: waiting.length ? waiting[0].label : null, stoppedCount: stopped.reduce((n, s) => n + s.failed + s.abandoned, 0), inFlight, outstanding, sentence };
}

const REVIEW = [
  { id: "pr_rv_1", businessName: "Centre de Rénovation Beauchemin — Matériaux & Quincaillerie", phoneE164: "+14505550171", websiteUrl: "https://renovation-beauchemin-materiaux.qc.ca", city: "Saint-Jean-sur-Richelieu", province: "QC", addressLine: "1450 boulevard du Séminaire Nord", sourceCategories: ["building_materials", "hardware_store", "roofing_contractor"], classification: "unclear", classificationReason: "Categories say a hardware store, the licence says a roofing contractor (RBQ 5678-9012-01). A supplier that also installs is a contractor; a store with a licence on file for warranty work is not.", sourceDataset: "rbq", sourceRelease: "2026-08-01", sourceUpdatedAt: ISO(NOW - 41 * DAY), possibleDuplicateOfId: null, sharedPhoneCount: 0, duplicateOf: null },
  { id: "pr_rv_2", businessName: "Toitures Beauchemin & Fils inc.", phoneE164: "+14505550172", websiteUrl: null, city: "Longueuil", province: "QC", addressLine: "88 rue Saint-Charles Ouest", sourceCategories: ["roofing_contractor"], classification: "unclear", classificationReason: "Another prospect has the same name in the same town — likely the same business under its RBQ name and its Overture name.", sourceDataset: "overture", sourceRelease: "2026-08-20.0", sourceUpdatedAt: ISO(NOW - 24 * DAY), possibleDuplicateOfId: "pr_toiture_rs", sharedPhoneCount: 1, duplicateOf: { id: "pr_toiture_rs", businessName: "Les Entreprises de Toiture Rive-Sud Beauchemin & Fils inc.", addressLine: "88 rue Saint-Charles O", city: "Longueuil", status: "converted" } },
  { id: "pr_rv_3", businessName: "1-800-PLOMBIER Québec", phoneE164: "+18005550199", websiteUrl: "https://1800plombier.example", city: "Montréal", province: "QC", addressLine: null, sourceCategories: ["plumber", "franchise"], classification: "unclear", classificationReason: "Toll-free number shared by 14 other prospects — a franchise head office, not a crew a rep can sell to.", sourceDataset: "overture", sourceRelease: "2026-08-20.0", sourceUpdatedAt: ISO(NOW - 24 * DAY), possibleDuplicateOfId: null, sharedPhoneCount: 14, duplicateOf: null },
  { id: "pr_rv_4", businessName: "Construction Générale Lévesque-Ouellet & Associés S.E.N.C.", phoneE164: "+14185550143", websiteUrl: "https://levesque-ouellet-construction.ca", city: "Lévis", province: "QC", addressLine: "2200 chemin du Sault", sourceCategories: ["general_contractor", "excavation", "commercial_construction"], classification: "unclear", classificationReason: "A general contractor with an excavation category and a commercial construction category. FieldQuo sells to trades; a GC with 40 staff is out of scope, a two-person GC doing decks is not, and the row does not say which.", sourceDataset: "rbq", sourceRelease: "2026-08-01", sourceUpdatedAt: ISO(NOW - 210 * DAY), possibleDuplicateOfId: null, sharedPhoneCount: 0, duplicateOf: null },
  { id: "pr_rv_5", businessName: "Peintures Sico — Dépositaire Saint-Hubert", phoneE164: "+14505550188", websiteUrl: null, city: "Saint-Hubert", province: "QC", addressLine: "3560 boulevard Taschereau", sourceCategories: ["paint_store", "painter"], classification: "unclear", classificationReason: "A paint store category beside a painter category. Stores are rejected; the second category is what stopped it.", sourceDataset: "overture", sourceRelease: "2026-08-20.0", sourceUpdatedAt: null, possibleDuplicateOfId: null, sharedPhoneCount: 0, duplicateOf: null },
  { id: "pr_rv_6", businessName: "Émondage et Aménagement Paysager des Laurentides", phoneE164: null, websiteUrl: "https://emondage-laurentides.ca", city: "Sainte-Adèle", province: "QC", addressLine: "1120 rue Valiquette", sourceCategories: ["tree_service", "landscaper"], classification: "unclear", classificationReason: "No phone number in either source. A prospect nobody can dial is banked for email outreach only, and the trade map has no row for tree services — it is landscaping or it is nothing.", sourceDataset: "rbq", sourceRelease: "2026-08-01", sourceUpdatedAt: ISO(NOW - 3 * DAY), possibleDuplicateOfId: null, sharedPhoneCount: 0, duplicateOf: null },
];
const stalenessOf = (at) => {
  if (!at) return { level: "unknown", days: null };
  const days = Math.floor((NOW - new Date(at).getTime()) / DAY);
  return { level: days > 180 ? "stale" : "fresh", days };
};

function campaignDetailPayload(id) {
  const base = CAMPAIGN_ROWS.find((c) => c.id === id);
  if (!base) return new Response(JSON.stringify({ error: "No such campaign." }), { status: 404, headers: { "Content-Type": "application/json" } });
  const c = campaignRow(base);
  const sources = sourcesOf(c);
  const jurisdictions = jurisdictionsLive();
  const taskRows = [
    { kind: "DISCOVER_BUSINESSES", status: "done", count: 212 }, { kind: "DISCOVER_BUSINESSES", status: "claimed", count: 1 }, { kind: "DISCOVER_BUSINESSES", status: "queued", count: 3 }, { kind: "DISCOVER_BUSINESSES", status: "failed", count: 2 },
    { kind: "ENRICH_BUSINESS", status: "done", count: 6120 }, { kind: "ENRICH_BUSINESS", status: "queued", count: 1904 }, { kind: "ENRICH_BUSINESS", status: "claimed", count: 12 },
    { kind: "CRAWL_WEBSITE", status: "done", count: 4877 }, { kind: "CRAWL_WEBSITE", status: "queued", count: 1231 }, { kind: "CRAWL_WEBSITE", status: "failed", count: 388 }, { kind: "CRAWL_WEBSITE", status: "abandoned", count: 41 },
    { kind: "DETECT_TECHNOLOGY", status: "done", count: 4402 }, { kind: "DETECT_TECHNOLOGY", status: "queued", count: 475 },
    { kind: "ANALYZE_CAPABILITIES", status: "done", count: 4011 }, { kind: "ANALYZE_CAPABILITIES", status: "queued", count: 391 }, { kind: "ANALYZE_CAPABILITIES", status: "failed", count: 27 },
    { kind: "DETECT_OPPORTUNITIES", status: "done", count: 3980 }, { kind: "DETECT_OPPORTUNITIES", status: "queued", count: 31 },
    { kind: "CALCULATE_LEAD_SCORE", status: "done", count: 3902 }, { kind: "CALCULATE_LEAD_SCORE", status: "queued", count: 78 },
  ];
  const stages = stageBoard(taskRows);
  const disc = taskRows.filter((t) => t.kind === "DISCOVER_BUSINESSES");
  return {
    campaign: {
      ...c, providerConfig: undefined, sourceConfigs: undefined,
      tradeLabel: campaignTradeLabel(c), progress: campaignProgress(c),
      research: { queued: 6132, target: c.targetCount, remaining: Math.max(0, c.targetCount - 6132) },
      funnel: funnelRows(c), funnelProblems: funnelProblems(c), sourceKeys: c.discoverySources,
    },
    sources: sources.map((s) => ({ key: s.key, label: s.label, registered: s.registered, licence: s.licence, unavailable: s.unavailable, configFields: [{ name: "snapshotUrl", label: "Snapshot URL", required: true }], config: { ok: s.configOk, problems: s.problems, summary: s.summary }, state: s.state })),
    startProblems: campaignStartBlockers(c.territory, { jurisdictions }).map((b) => `${b.title} ${b.fix}`),
    registration: territoryRegistration(c.territory, { jurisdictions }),
    review: REVIEW.map((p) => ({ ...p, staleness: stalenessOf(p.sourceUpdatedAt), duplicateNote: p.possibleDuplicateOfId ? "Flagged as a possible duplicate." : null, tollFreeNote: p.phoneE164?.startsWith("+1800") ? `Toll-free number, shared with ${p.sharedPhoneCount} other prospects — dialling it reaches a switchboard, not the business.` : null })),
    reviewTotal: c.needsReviewCount,
    flaggedDuplicates: 4,
    tasks: Object.fromEntries(disc.map((t) => [t.status, t.count])),
    stages,
    pipeline: boardSummary(stages),
    stalled: [
      { kind: "CRAWL_WEBSITE", status: "failed", count: 388, reason: "fetch failed: getaddrinfo ENOTFOUND www.toitures-lachance-et-freres-inc.qc.ca — the domain on the licence no longer resolves." },
      { kind: "CRAWL_WEBSITE", status: "abandoned", count: 41, reason: "Gave up after 6 attempts: 429 Too Many Requests from a Wix-hosted site that rate-limits by ASN." },
      { kind: "ANALYZE_CAPABILITIES", status: "failed", count: 27, reason: "OpenAI: insufficient_quota — the platform key's monthly budget was exhausted on 11 Sept at 03:14 UTC." },
      { kind: "DISCOVER_BUSINESSES", status: "failed", count: 2, reason: "HTTP 503 from the snapshot bucket (attempt 2 of 6)" },
    ],
    lastError: { status: "failed", lastError: "HTTP 503 from the snapshot bucket (attempt 2 of 6) — https://pub-4f1c9e2a7b3d4c8e9f0a1b2c3d4e5f60.r2.dev/fieldquo-snapshots/CA-QC-overture-2026-08-part1.ndjson.gz", attempts: 2, completedAt: null },
  };
}

const OVERRIDES = [
  { id: "ov_ny", country: "US", region: "NY", mode: "warn", note: "Warn only while the Long Island pilot runs — the reps there call from 8:30 local and the state window is being verified with counsel. Review 30 Sept.", setById: "adm1", setBy: { email: "emilio@fieldquo.com" }, updatedAt: new Date("2026-09-04T19:22:00.000Z") },
  { id: "ov_ca", country: "CA", region: null, mode: "off", note: "Québec and Ontario reps dial inside the CRTC window by their own clocks; the evaluator was refusing 21:00–21:30 calls that are lawful. Off until the half-hour cutoff is fixed in callingWindow.js.", setById: "adm1", setBy: { email: "emilio@fieldquo.com" }, updatedAt: new Date("2026-08-28T14:05:00.000Z") },
  { id: "ov_tx", country: "US", region: "TX", mode: "warn", note: "Registered 15 June; warn while the Dallas campaign ramps.", setById: "adm2", setBy: { email: "ops@fieldquo.com" }, updatedAt: new Date("2026-09-10T16:40:00.000Z") },
  { id: "ov_ut", country: "US", region: "UT", mode: "off", note: "Set before the registration lapsed — the hold should now be pinning this back to enforce.", setById: "adm2", setBy: { email: "ops@fieldquo.com" }, updatedAt: new Date("2026-06-02T13:00:00.000Z") },
];

function windowsPayload() {
  const now = new Date(NOW);
  const registered = registeredKeys(CERTIFICATES, now);
  const byKey = new Map(OVERRIDES.map((r) => [overrideKey(r), r]));
  const jurisdictions = Object.keys(CALLING_JURISDICTIONS).map((key) => {
    const law = CALLING_JURISDICTIONS[key];
    const [country, region = ""] = key.split("-");
    const policy = effectiveWindowPolicy({ country, region: region || null, overrides: OVERRIDES, registeredKeys: registered });
    const row = byKey.get(key) || null;
    const registration = registrationStatus(key, CERTIFICATES, { now });
    return {
      key, country, region, name: law.name, verified: law.verified === true,
      window: law.window ? describeWindow(law.window) : null, statutoryWindow: Boolean(law.window), prohibition: Boolean(law.prohibition),
      cap: law.maxCallsPer24h ?? null, registrationRequired: law.registration?.required === true, registrationState: registration.state,
      registrationGated: policy.registrationGated, mode: policy.mode, requestedMode: policy.requestedMode, heldByRegistration: policy.heldByRegistration, note: policy.note,
      setBy: row?.setBy?.email || null, updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { jurisdictions, modes: WINDOW_MODES, serverNow: now.toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenes — clicks on shipped controls
// ═══════════════════════════════════════════════════════════════════════════

export const scenes = {
  "/platform/sales/reps": {
    // The accordion: open Ana's card through its header button, and wait for
    // the Payments section inside it to have read her batches.
    open: async ({ until, settled }) => {
      (await until('[data-rep-toggle="rep_ana"]')).click();
      await until('[data-rep-card="rep_ana"][data-open="true"]');
      await until('[data-rep-payments="rep_ana"] [data-payout-batch]');
      await settled();
    },
    // …and then the Queue… panel on the same card.
    queue: async ({ until, wait, settled }) => {
      (await until('[data-rep-toggle="rep_ana"]')).click();
      await until('[data-rep-payments="rep_ana"] [data-payout-batch]');
      const buttons = [...document.querySelectorAll('[data-rep-panel="rep_ana"] button')];
      const queue = buttons.find((b) => /Queue…/.test(b.textContent || ""));
      if (!queue) throw new Error("scene: no Queue… button on Ana's card");
      queue.click();
      await wait(400);
      await settled();
    },
  },
  "/platform/sales/payouts": {
    month: async ({ until, settled }) => {
      (await until('[data-period-switch="month"]')).click();
      await until('[data-period-table][data-period="month"]');
      await settled();
    },
  },
  "/platform/sales/notes": {
    read: async ({ until, wait, settled }) => {
      await until("#rep-filter");
      const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Read it");
      if (!btn) throw new Error("scene: no Read it button");
      btn.click();
      await wait(400);
      await settled();
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// The answerer
// ═══════════════════════════════════════════════════════════════════════════

export default function answer({ method, path, url, body }) {
  if (!path.startsWith("/api/platform/")) return undefined;

  // ── Reps ────────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/reps") {
    if (method === "POST") return { ok: true, rep: { ...repsPayload().reps[0], id: "rep_new", name: body?.name || "New rep", email: body?.email || "", code: body?.code || "new" }, invited: true };
    return repsPayload();
  }
  let m = /^\/api\/platform\/sales\/reps\/([^/]+)\/payouts$/.exec(path);
  if (m) {
    const rep = REP_ROWS.find((r) => r.id === m[1]);
    if (!rep) return new Response(JSON.stringify({ error: "No such rep" }), { status: 404, headers: { "Content-Type": "application/json" } });
    return {
      rep: { id: rep.id, name: rep.name, active: rep.active },
      batches: sortedBatches().filter((b) => b.salesRepId === rep.id),
      accruingCents: sum(ENTRIES.filter((e) => e.salesRepId === rep.id && !e.payoutBatchId)),
      canMarkPaid: true,
    };
  }
  m = /^\/api\/platform\/sales\/reps\/([^/]+)\/queue$/.exec(path);
  if (m) {
    if (method === "POST") return { ok: true, action: body?.action || null, released: 12, kept: 25, moved: 0 };
    return queuePayload(m[1]);
  }
  m = /^\/api\/platform\/sales\/reps\/([^/]+)\/invite$/.exec(path);
  if (m && method === "POST") return { ok: true, sentTo: REP_ROWS.find((r) => r.id === m[1])?.email || null };
  m = /^\/api\/platform\/sales\/reps\/([^/]+)$/.exec(path);
  if (m && (method === "PATCH" || method === "PUT")) {
    const rep = repsPayload().reps.find((r) => r.id === m[1]);
    return rep ? { ...rep, ...(body || {}) } : new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // ── Plans ───────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/plans") {
    if (method === "POST") return { plan: { ...plansPayload().plans[0], id: "plan_new", name: body?.name || "New plan", repCount: 0, reps: [] } };
    return plansPayload();
  }
  m = /^\/api\/platform\/sales\/plans\/([^/]+)$/.exec(path);
  if (m) {
    const plan = plansPayload().plans.find((p) => p.id === m[1]);
    return plan ? { plan: { ...plan, ...(body || {}) } } : new Response(JSON.stringify({ error: "No such plan" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // ── Payouts ─────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/payouts") {
    const period = url.searchParams.get("period") === "month" ? "month" : "week";
    return { snapshot: owedSnapshot(period), table: periodTable(period), batches: sortedBatches(), canMarkPaid: true };
  }
  m = /^\/api\/platform\/sales\/payouts\/([^/]+)\/paid$/.exec(path);
  if (m && method === "POST") {
    const b = BATCHES.find((x) => x.id === m[1]);
    if (!b) return new Response(JSON.stringify({ error: "No such batch" }), { status: 404, headers: { "Content-Type": "application/json" } });
    Object.assign(b, { status: "paid", paidAt: b.paidAt || ISO(NOW), paidVia: body?.paidVia || b.paidVia || "Wise", paymentReference: body?.paymentReference || b.paymentReference || null, paymentNote: body?.paymentNote || b.paymentNote || null });
    const view = batchView(b);
    return { batch: view, cents: view.cents, driftedFromClose: view.movedSinceClose, notified: true };
  }

  // ── Floor, performance, growth ──────────────────────────────────────────
  if (path === "/api/platform/sales/floor") return floorPayload();
  if (path === "/api/platform/sales/performance") return performancePayload(url.searchParams.get("preset") || "thisMonth");
  if (path === "/api/platform/growth") return growthPayload();

  // ── Notes ───────────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/notes") return notesPayload(url.searchParams.get("repId") || "");
  m = /^\/api\/platform\/sales\/notes\/([^/]+)$/.exec(path);
  if (m) {
    const note = NOTES.find((n) => n.id === m[1]);
    return note ? { note: noteRow(note) } : new Response(JSON.stringify({ error: "That note no longer exists." }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // ── Campaigns ───────────────────────────────────────────────────────────
  if (path === "/api/platform/sales/campaigns") {
    if (method === "POST") return { ok: true, created: 1, campaigns: [campaignsPayload().campaigns[0]] };
    return campaignsPayload();
  }
  if (path === "/api/platform/sales/registrations") {
    if (method === "POST") return { ok: true, registration: { jurisdictionKey: body?.jurisdictionKey || null, certificateNumber: body?.certificateNumber || null } };
    return { registrations: CERTIFICATES, registered: registeredKeys(CERTIFICATES, new Date(NOW)) };
  }
  m = /^\/api\/platform\/sales\/campaigns\/([^/]+)\/review$/.exec(path);
  if (m && method === "POST") return { ok: true, prospectId: body?.prospectId || null, decision: body?.decision || null };
  m = /^\/api\/platform\/sales\/campaigns\/([^/]+)$/.exec(path);
  if (m) {
    if (method === "PATCH") return { ok: true, campaign: campaignDetailPayload(m[1])?.campaign || null };
    return campaignDetailPayload(m[1]);
  }

  // ── Calling windows ─────────────────────────────────────────────────────
  if (path === "/api/platform/sales/windows") return windowsPayload();

  return undefined;
}
