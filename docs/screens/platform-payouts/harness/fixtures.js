// Fixture: two reps, two closed weeks, a reversal after a close — the same
// shape scripts/check-sales-payout-proof.mjs executes against. Amounts are
// re-summed here the way the routes do, so the screenshot shows the real
// components on the real arithmetic.
const W = (iso) => new Date(iso).toISOString();
export const REPS = [
  { id: "repana", name: "Ana Roy", email: "ana@fieldquo.com", workEmail: "ana@fieldquo.com", code: "ana", signupLink: "https://fieldquo.com/signup?sales=ana", active: true, invitedAt: W("2026-08-01T00:00:00Z"), acceptedAt: W("2026-08-02T00:00:00Z"), endedAt: null, inviteExpiresAt: null, commissionPlan: "Standard", commissionPlanId: "plan1", engagement: "freelancer", accruesPaidLeave: false, sellsIn: ["fr", "en"], companyCount: 3, queue: { held: 12, untouched: 4, dialled: 8, worked: 0, openLeads: 2, oldestClaimMs: 3600000 }, money: { thisWeekCents: 2000, owedCents: 6000, paidCents: 12500 }, sending: { canSend: true, blockers: [], warnings: [] } },
  { id: "repben", name: "Ben Okafor", email: "ben@fieldquo.com", workEmail: null, code: "ben", signupLink: "https://fieldquo.com/signup?sales=ben", active: true, invitedAt: W("2026-08-10T00:00:00Z"), acceptedAt: W("2026-08-11T00:00:00Z"), endedAt: null, inviteExpiresAt: null, commissionPlan: "Standard", commissionPlanId: "plan1", engagement: "employee", accruesPaidLeave: true, sellsIn: ["en"], companyCount: 1, queue: { held: 0, untouched: 0, dialled: 0, worked: 0, openLeads: 0, oldestClaimMs: null }, money: { thisWeekCents: 0, owedCents: 0, paidCents: 6500 }, sending: { canSend: false, blockers: [{ code: "no_work_email", title: "No work mailbox yet.", fix: "Set one above." }], warnings: [] } },
];
const week = (s, e) => ({ periodStart: W(s), periodEnd: W(e) });
export const BATCHES = [
  { id: "bana2", salesRepId: "repana", repName: "Ana Roy", ...week("2026-08-31T00:00:00Z", "2026-09-07T00:00:00Z"), status: "ready", paidAt: null, cents: 6000, closedCents: 6000, movedSinceClose: false, entryCount: 2, hasProof: false, paidVia: null, paymentReference: null, paymentNote: null, proofUrl: null, proofFilename: null },
  { id: "bana1", salesRepId: "repana", repName: "Ana Roy", ...week("2026-08-24T00:00:00Z", "2026-08-31T00:00:00Z"), status: "paid", paidAt: W("2026-09-01T14:02:00Z"), cents: 12500, closedCents: 12500, movedSinceClose: false, entryCount: 3, hasProof: true, paidVia: "Wise", paymentReference: "WISE-4471", paymentNote: "Sent minus the Wise fee.", proofUrl: "https://res.cloudinary.com/fieldquo/raw/upload/fieldquo/platform/payouts/bana1/receipt.pdf", proofFilename: "wise-transfer.pdf" },
  { id: "bben1", salesRepId: "repben", repName: "Ben Okafor", ...week("2026-08-24T00:00:00Z", "2026-08-31T00:00:00Z"), status: "paid", paidAt: W("2026-09-01T14:05:00Z"), cents: 6500, closedCents: 6500, movedSinceClose: false, entryCount: 1, hasProof: true, paidVia: "Interac", paymentReference: "CAxxx8812", paymentNote: null, proofUrl: null, proofFilename: null },
];
export const SNAPSHOT = { owedNowCents: 6000, accruingCents: 2000, paidThisCycleCents: 19000, readyBatchCount: 1, cycle: { period: "week", start: W("2026-09-07T00:00:00Z"), end: W("2026-09-14T00:00:00Z") } };
const cell = (repId, cents, status, batchId = null, paidAt = null) => ({ repId, cents, status, batchId, batchIds: batchId ? [batchId] : [], paidAt });
export const TABLE = {
  week: { period: "week", columns: REPS.map((r) => ({ id: r.id, name: r.name })), rows: [
    { key: W("2026-09-07T00:00:00Z"), label: "7 Sept – 13 Sept 2026", cells: [cell("repana", 2000, "open"), cell("repben", 0, null)], totalCents: 2000 },
    { key: W("2026-08-31T00:00:00Z"), label: "31 Aug – 6 Sept 2026", cells: [cell("repana", 6000, "owed", "bana2"), cell("repben", 0, null)], totalCents: 6000 },
    { key: W("2026-08-24T00:00:00Z"), label: "24 Aug – 30 Aug 2026", cells: [cell("repana", 12500, "paid", "bana1", W("2026-09-01T14:02:00Z")), cell("repben", 6500, "paid", "bben1", W("2026-09-01T14:05:00Z"))], totalCents: 19000 },
  ], totals: { byRep: [{ repId: "repana", cents: 20500 }, { repId: "repben", cents: 6500 }], cents: 27000 } },
  month: { period: "month", columns: REPS.map((r) => ({ id: r.id, name: r.name })), rows: [
    { key: W("2026-09-01T00:00:00Z"), label: "September 2026", cells: [cell("repana", 8000, "open"), cell("repben", 0, null)], totalCents: 8000 },
    { key: W("2026-08-01T00:00:00Z"), label: "August 2026", cells: [cell("repana", 12500, "paid", "bana1", W("2026-09-01T14:02:00Z")), cell("repben", 6500, "paid", "bben1", W("2026-09-01T14:05:00Z"))], totalCents: 19000 },
  ], totals: { byRep: [{ repId: "repana", cents: 20500 }, { repId: "repben", cents: 6500 }], cents: 27000 } },
};
export const ME = { id: "repana", name: "Ana Roy", email: "ana@fieldquo.com", workEmail: "ana@fieldquo.com", code: "ana", signupLink: "https://fieldquo.com/signup?sales=ana", signups: { today: 0, thisWeek: 1, total: 3 } };
export const LANG_OPTIONS = [
  { code: "en", nativeName: "English", name: "English" }, { code: "fr", nativeName: "Français", name: "French" }, { code: "es", nativeName: "Español", name: "Spanish" },
  { code: "uk", nativeName: "Українська", name: "Ukrainian" }, { code: "pa", nativeName: "ਪੰਜਾਬੀ", name: "Punjabi" }, { code: "tl", nativeName: "Tagalog", name: "Tagalog" },
  { code: "de", nativeName: "Deutsch", name: "German" }, { code: "zh", nativeName: "中文", name: "Chinese" }, { code: "it", nativeName: "Italiano", name: "Italian" },
];
