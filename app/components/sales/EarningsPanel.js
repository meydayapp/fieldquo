"use client";

// app/components/sales/EarningsPanel.js
//
// What the rep has earned, what is coming, and where each company got to.
//
// ══ The gap this fills ════════════════════════════════════════════════════
//
// Every figure already existed and none of it was visible to the person who
// earned it. The commission ledger, the weekly batches, the paid dates — all
// on /platform/sales/performance, superadmin-only. /sales/pay was a settings
// screen with no numbers on it at all, and /sales/companies showed milestone
// pills with the amounts deliberately stripped.
//
// So a salesperson could not answer "what have I made this week" from inside
// the portal they work in all day. That is not a missing report; it is the
// question the job is done for.
//
// ══ A reversal is shown, never netted away ════════════════════════════════
//
// reverseMilestone writes a negative row and leaves the original standing —
// the pair is the history. This renders both. A screen that quietly dropped
// the minus row would show a rep money that is not coming, and they would go
// looking for it on payday.
//
// ══ Honest about the parts that are not decided here ══════════════════════
//
// No money moves from this build: a batch closes on a Monday cron, and a human
// marks it paid. So an unpaid closed week says "closed, not paid yet" rather
// than implying a transfer is in flight, and the open week says plainly that
// it has not closed. Neither is a promise, and neither is dressed as one.
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
// From lib/sales/money, NOT lib/sales/earnings: that module reaches `db`
// through commission.js, and importing it here put `pg` and `dns` in the
// browser bundle and failed the build.
import { centsToMoney } from "@/lib/sales/money";
import { AlertTriangle, Check, Circle, Loader2, RotateCcw } from "lucide-react";

function day(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

/** One figure, large, with what it means under it. */
function Stat({ label, cents, hint, strong = false }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p
        className={`tabular-nums ${strong ? "text-2xl font-semibold text-foreground" : "text-xl text-foreground"}`}
      >
        {centsToMoney(cents)}
      </p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

const RUNG_ICON = {
  earned: <Check size={13} className="shrink-0" />,
  reversed: <RotateCcw size={13} className="shrink-0" />,
  under_review: <AlertTriangle size={13} className="shrink-0" />,
  pending: <Circle size={13} className="shrink-0 opacity-50" />,
};

const RUNG_NOTE = {
  earned: null,
  reversed: "taken back",
  under_review: "under review",
  pending: "not yet",
};

export default function EarningsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson("/api/sales/earnings");
        if (!cancelled) setData(res);
      } catch {
        // Named, not silent. Unlike the tour, a rep who cannot see their pay
        // needs to know the screen failed rather than concluding they earned
        // nothing — those two look identical and mean opposite things.
        if (!cancelled) setError("Your earnings could not be loaded just now. Try again in a moment.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Your earnings</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Your earnings</h2>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          Loading…
        </p>
      </section>
    );
  }

  const { totals, weeks, openLines, companies, payoutReady } = data;
  const nothingYet = totals.lifetimeCents === 0 && companies.length === 0;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Your earnings</h2>
        <p className="text-sm text-muted-foreground">
          Recorded by FieldQuo when each milestone actually happens. Nothing on this
          screen can be edited from here — it is the same ledger the payout run reads.
        </p>
      </div>

      {nothingYet ? (
        // Absence of a statement is not a statement: no ledger rows means
        // nothing has happened yet, not that anything is wrong or owed.
        <p className="text-sm text-muted-foreground">
          Nothing recorded yet. Your first commission lands when a company you signed
          up can take payments — you will see it here the same day.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="Earned all time" cents={totals.lifetimeCents} strong hint="After anything taken back" />
            <Stat label="Paid to you" cents={totals.paidCents} hint="Weeks marked paid" />
            <Stat label="Closed, not paid yet" cents={totals.awaitingCents} hint="Waiting on the payout run" />
            <Stat label="This week so far" cents={totals.thisWeekCents} hint="Closes Monday" />
          </div>

          {totals.lifetimeCents > 0 && !payoutReady && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-foreground">
              You have money recorded and no payout destination set, so there is nowhere
              to send it. Fill in the form below and it will go out with the next run.
            </p>
          )}

          {/* ── Which company is at which stage ──────────────────────────── */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your companies
            </h3>
            <div className="space-y-2">
              {companies.map((c) => (
                <div key={c.companyId} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.companyName || "A company"}
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {centsToMoney(c.cents)}
                      <span className="text-xs text-muted-foreground ml-2">
                        {c.progress.reached} of {c.progress.total}
                      </span>
                    </span>
                  </div>
                  <ul className="mt-1.5 grid gap-1 sm:grid-cols-3">
                    {c.ladder.map((rung) => (
                      <li
                        key={rung.milestone}
                        className={`flex items-center gap-1.5 text-xs ${
                          rung.state === "pending" ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {RUNG_ICON[rung.state]}
                        <span className="truncate">{rung.label}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {RUNG_NOTE[rung.state] || day(rung.occurredAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ── The weeks ────────────────────────────────────────────────── */}
          {(weeks.length > 0 || openLines.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                By week
              </h3>

              {openLines.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">This week, still open</span>
                    <span className="text-sm tabular-nums text-foreground">
                      {centsToMoney(totals.thisWeekCents)}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {openLines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {l.companyName || "A company"} · {day(l.occurredAt)}
                        </span>
                        <span className="tabular-nums shrink-0">{centsToMoney(l.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weeks.map((w) => (
                <div key={w.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {day(w.periodStart)} – {day(w.periodEnd)}
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {centsToMoney(w.cents)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {w.status === "paid"
                      ? `Paid ${day(w.paidAt)}`
                      : "Closed. Waiting on the payout run — no transfer has been made yet."}
                  </p>
                  {/* Said out loud rather than reconciled behind the scenes: if
                      a reversal landed after the week closed, the figure a rep
                      was told at close is not the figure they are getting. */}
                  {w.movedSinceClose && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This week was {centsToMoney(w.closedCents)} when it closed. Something
                      changed after that — the figure above is the current one.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
