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
import { useTranslation } from "@/app/hooks/useTranslation";

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

// A function taking `t` rather than the module-scope map this used to be: a
// translated note cannot exist before the hook has resolved the rep's
// language, and `earned` deliberately returns nothing so the caller falls
// through to the date the rung was reached.
function rungNote(state, t) {
  if (state === "reversed") return t("app.salesPay.rungReversed");
  if (state === "under_review") return t("app.salesPay.rungUnderReview");
  if (state === "pending") return t("app.salesPay.rungPending");
  return null;
}

export default function EarningsPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  // A flag rather than the sentence itself: the sentence is now a translation,
  // and one stored in state at fetch time would keep the old language after a
  // rep changes it on the screen directly below this one.
  const [failed, setFailed] = useState(false);

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
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t("app.salesPay.earningsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("app.salesPay.earningsLoadFailed")}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t("app.salesPay.earningsTitle")}</h2>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          {t("app.salesPay.loading")}
        </p>
      </section>
    );
  }

  const { totals, weeks, openLines, companies, payoutReady } = data;
  const nothingYet = totals.lifetimeCents === 0 && companies.length === 0;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{t("app.salesPay.earningsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("app.salesPay.earningsIntro")}</p>
      </div>

      {nothingYet ? (
        // Absence of a statement is not a statement: no ledger rows means
        // nothing has happened yet, not that anything is wrong or owed.
        <p className="text-sm text-muted-foreground">{t("app.salesPay.nothingRecorded")}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat
              label={t("app.salesPay.statLifetime")}
              cents={totals.lifetimeCents}
              strong
              hint={t("app.salesPay.statLifetimeHint")}
            />
            <Stat
              label={t("app.salesPay.statPaid")}
              cents={totals.paidCents}
              hint={t("app.salesPay.statPaidHint")}
            />
            <Stat
              label={t("app.salesPay.statAwaiting")}
              cents={totals.awaitingCents}
              hint={t("app.salesPay.statAwaitingHint")}
            />
            <Stat
              label={t("app.salesPay.statThisWeek")}
              cents={totals.thisWeekCents}
              hint={t("app.salesPay.statThisWeekHint")}
            />
          </div>

          {totals.lifetimeCents > 0 && !payoutReady && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-foreground">
              {t("app.salesPay.noDestinationNotice")}
            </p>
          )}

          {/* ── Which company is at which stage ──────────────────────────── */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.salesPay.companiesHeading")}
            </h3>
            <div className="space-y-2">
              {companies.map((c) => (
                <div key={c.companyId} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.companyName || t("app.salesPay.unnamedCompany")}
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {centsToMoney(c.cents)}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t("app.salesPay.progressOf", {
                          reached: c.progress.reached,
                          total: c.progress.total,
                        })}
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
                        {/* MILESTONE_LABELS decides the words and still does;
                            the key beside them is what lets a rep read
                            "Activated / Renewed / Still paying" in their own
                            language on the screen that tells them what they
                            have earned. */}
                        <span className="truncate">{t(rung.labelKey, rung.label)}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {rungNote(rung.state, t) || day(rung.occurredAt)}
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
                {t("app.salesPay.byWeekHeading")}
              </h3>

              {openLines.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("app.salesPay.thisWeekStillOpen")}
                    </span>
                    <span className="text-sm tabular-nums text-foreground">
                      {centsToMoney(totals.thisWeekCents)}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {openLines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {l.companyName || t("app.salesPay.unnamedCompany")} · {day(l.occurredAt)}
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
                      ? t("app.salesPay.weekPaidOn", { date: day(w.paidAt) })
                      : t("app.salesPay.weekClosedUnpaid")}
                  </p>
                  {/* Said out loud rather than reconciled behind the scenes: if
                      a reversal landed after the week closed, the figure a rep
                      was told at close is not the figure they are getting. */}
                  {w.movedSinceClose && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("app.salesPay.weekMovedSinceClose", {
                        amount: centsToMoney(w.closedCents),
                      })}
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
