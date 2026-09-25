// lib/commissions/payRun.js
//
// What the pay-run screen offers for commissions, and what it adds when the
// owner ticks a person. Pure — lib/payroll/buildPayRun.js does the reads and
// hands the rows here — so scripts/check-commissions.mjs can prove the rule
// the owner set: nobody's pay changes unless they are included.
//
// One figure per person: every ledger row on no pay run yet, netted — so a
// refund reversal earned this period cancels against a payment earned last
// period that was never paid out. A net clawback is shown and never offered
// (a deduction from someone's pay for a commission is a conversation, not a
// default) and stays due until later earnings outweigh it.
//
// Commission belongs to a MEMBER; a pay run pays WORKERS. The bridge is
// Worker.userId = Member.userId, and a member with no active Worker cannot be
// paid on a run — the screen names them and says why rather than dropping
// them.

/**
 * @param p.rows      JobCommissionEntry rows: { id, memberId, memberName, amount, jobId }
 * @param p.members   [{ id, userId, user: { name, email } }]
 * @param p.workers   the run's workers: [{ id, userId, name }]
 * @param p.include   worker ids the owner ticked
 * @returns {{ due: object[], adjustments: Record<string, object[]>, entryIds: string[] }}
 */
export function commissionLinesForRun({ rows = [], members = [], workers = [], include = [] } = {}) {
  const memberById = new Map((members || []).map((m) => [m.id, m]));
  const workerByUser = new Map((workers || []).filter((w) => w?.userId).map((w) => [w.userId, w]));
  const ticked = new Set(Array.isArray(include) ? include : []);

  const byMember = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.memberId) continue;
    const cur = byMember.get(r.memberId) || { cents: 0, jobs: new Set(), ids: [], name: r.memberName || null };
    const c = Math.round(Number(r.amount) * 100);
    cur.cents += Number.isFinite(c) ? c : 0;
    cur.jobs.add(r.jobId);
    cur.ids.push(r.id);
    byMember.set(r.memberId, cur);
  }

  const due = [];
  const adjustments = {};
  const entryIds = [];
  for (const [memberId, c] of byMember) {
    if (c.cents === 0) continue;
    const m = memberById.get(memberId);
    const worker = m?.userId ? workerByUser.get(m.userId) : null;
    const payable = Boolean(worker) && c.cents > 0;
    const included = payable && ticked.has(worker.id);
    due.push({
      memberId,
      name: worker?.name || m?.user?.name || m?.user?.email || c.name || null,
      workerId: worker?.id || null,
      amount: c.cents / 100,
      jobs: c.jobs.size,
      payable,
      // Why a line cannot be offered, so the screen can say it.
      reason: !worker ? "no_worker" : c.cents < 0 ? "clawback" : null,
      included,
    });
    if (included) {
      // English, like the performance-bonus line beside it: payslip item
      // labels are frozen onto the PayRunLine at run time in the company's
      // payroll wording, not translated per reader.
      adjustments[worker.id] = [
        ...(adjustments[worker.id] || []),
        {
          label: `Commission — ${c.jobs.size} job${c.jobs.size === 1 ? "" : "s"}`,
          amount: c.cents / 100,
          kind: "earning",
          source: "commission",
        },
      ];
      entryIds.push(...c.ids);
    }
  }
  due.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return { due, adjustments, entryIds };
}
