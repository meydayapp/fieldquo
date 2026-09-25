// lib/payroll/runClaims.js
//
// What a pay run CLAIMS, and what cancelling one gives back.
//
// A run carries two kinds of rows that must never be paid twice: the daily
// sheets whose performance bonus it paid (DailyObjectiveSheet.payRunId) and
// the commission ledger rows the owner ticked (JobCommissionEntry.payRunId).
// Saving the run stamps both with its id; cancelling it must un-stamp both.
//
// The two used to be handled in two places by hand, and the cancel only
// remembered commissions — so a cancelled run's bonuses stayed pointing at a
// run that paid nobody, the next run's preview skipped them (it reads only
// `payRunId: null`), and the day's sheet stayed locked against edits. The
// claim, the release and the "what is still free" filter live together here
// so they cannot drift apart again, and so scripts/check-daily-objectives.mjs
// can run stamp → cancel → free again against an in-memory database instead
// of grepping the routes.
//
// `db` is passed in rather than imported: the functions stay executable in a
// check without the db-stub loader, and a caller inside a transaction can
// hand its own client.

/**
 * The daily sheets a pay run for this period may pay a bonus for: the
 * workers' own sheets, in the period, carrying a bonus figure, on no run yet.
 * A null bonusCents means the company has no rule (lib/dailySheets/bonus.js)
 * and is excluded by `gt: 0` — never read as $0.
 */
export function unclaimedBonusSheetsWhere({ companyId, workerIds, start, end }) {
  return {
    companyId,
    workerId: { in: workerIds },
    payRunId: null,
    bonusCents: { gt: 0 },
    date: { gte: start, lte: end },
  };
}

/**
 * Stamp the rows a just-saved run carries. Only rows still on no run are
 * stamped (`payRunId: null` in the where), so two runs saved at once cannot
 * both claim one. Called AFTER the run exists, so a failed create leaves
 * everything free; a failed stamp is logged, not fatal — the run is real,
 * and the next preview offering the row again is visible to a person.
 *
 * @returns {{ bonusSheets: number|null, commissionEntries: number|null }}
 *          rows stamped; null when that stamp failed or had nothing to do.
 */
export async function claimRunItems(db, { runId, companyId, bonusSheetIds = [], commissionEntryIds = [] }) {
  const out = { bonusSheets: null, commissionEntries: null };
  if (bonusSheetIds.length) {
    const stamped = await db.dailyObjectiveSheet
      .updateMany({
        where: { id: { in: bonusSheetIds }, companyId, payRunId: null },
        data: { payRunId: runId },
      })
      .catch((err) => {
        console.error("[payroll] could not stamp bonus sheets:", err?.message);
        return null;
      });
    out.bonusSheets = stamped ? stamped.count : null;
    if (stamped && stamped.count !== bonusSheetIds.length) {
      console.error(
        `[payroll] run ${runId}: ${bonusSheetIds.length - stamped.count} bonus sheet(s) were already on another run`,
      );
    }
  }
  if (commissionEntryIds.length) {
    const stamped = await db.jobCommissionEntry
      .updateMany({
        where: { id: { in: commissionEntryIds }, companyId, payRunId: null },
        data: { payRunId: runId },
      })
      .catch((err) => {
        console.error("[payroll] could not stamp commission rows:", err?.message);
        return null;
      });
    out.commissionEntries = stamped ? stamped.count : null;
    if (stamped && stamped.count !== commissionEntryIds.length) {
      console.error(
        `[payroll] run ${runId}: ${commissionEntryIds.length - stamped.count} commission row(s) were already on another run`,
      );
    }
  }
  return out;
}

/**
 * Cancel a run and give back everything it claimed, in ONE transaction with
 * the status change: a cancelled run paid nobody, and a row left pointing at
 * it would never be offered again. The rows keep their history (the
 * commission ledger is append-only; a sheet keeps its bonus figure) — only
 * the settlement is undone.
 *
 * Idempotent. Cancelling an already-cancelled run re-runs the release, which
 * matches nothing once it has run and heals a run cancelled before bonuses
 * were released here. It can never free a row a LATER run has since claimed:
 * the release matches `payRunId: <this run>` only.
 *
 * @param run  { id, status } — the caller has already scoped it to the company
 * @returns {{ ok: true, alreadyCancelled: boolean, released: { bonusSheets: number, commissionEntries: number } }
 *          | { ok: false, refused: "paid" }}
 */
export async function cancelPayRun(db, run, { companyId }) {
  if (run.status === "paid") return { ok: false, refused: "paid" };
  const alreadyCancelled = run.status === "cancelled";
  const [, sheets, entries] = await db.$transaction([
    db.payRun.update({ where: { id: run.id }, data: { status: "cancelled" } }),
    db.dailyObjectiveSheet.updateMany({
      where: { payRunId: run.id, companyId },
      data: { payRunId: null },
    }),
    db.jobCommissionEntry.updateMany({
      where: { payRunId: run.id, companyId },
      data: { payRunId: null },
    }),
  ]);
  return {
    ok: true,
    alreadyCancelled,
    released: { bonusSheets: sheets?.count ?? 0, commissionEntries: entries?.count ?? 0 },
  };
}
