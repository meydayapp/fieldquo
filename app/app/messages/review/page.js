"use client";

// app/app/messages/review/page.js
//
// The month-end read, and the reason the conversations are stored at all.
//
// The owner's ask, in his words: "once a month I want to assess which
// conversations closed the job and which didn't, to understand the
// conversations and how to improve them."
//
// ══ What this screen refuses to do ═════════════════════════════════════════
//
//   * It never prints 0 for something it does not know. A month with nothing
//     judged has NO won rate and says so in a sentence; a conversation nobody
//     replied to has NO response time and reads "not answered". Every one of
//     those nulls comes out of lib/messaging/monthlyReview.js, which is pure
//     and executed against fixtures by scripts/check-messaging.mjs — including
//     an empty month and a month nobody answered.
//   * It puts the UNANSWERED conversations first. Won and lost are history;
//     "somebody wrote and nobody replied" is the only line here that is still
//     fixable, and burying it under a conversion rate would be the polite
//     version of hiding it.
//   * It offers no AI summary. That would be a metered model call, and every
//     one of those in this codebase goes through lib/ai/provider.js with a
//     quota check and a price the contractor agreed to. Half-doing it — a
//     summary that quietly spends somebody's allowance — is worse than not
//     having it.
//
// ══ Small numbers, said out loud ═══════════════════════════════════════════
//
// A contractor's month is five to fifty conversations. The comparison at the
// bottom ("won ones were answered in 8 minutes, lost ones in 4 hours") is a
// comparison of two small groups and the page says so, rather than dressing it
// as a statistic.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MessageCircle, AlertTriangle } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { THREAD_OUTCOMES, outcomeLabelKey } from "@/lib/messaging/outcomes";
import ConversationReviewPanel from "@/app/components/messaging/ConversationReviewPanel";
import { TemperatureChip } from "@/app/components/messaging/ConversationTemperature";

/**
 * A duration a person can read, or the "we never answered" sentence.
 *
 * Takes the null case FIRST and on purpose: every formatter in this repo that
 * took `minutes || 0` printed "0 min" for a conversation nobody replied to,
 * which is the exact opposite of the truth.
 */
export function formatMinutes(minutes, t) {
  if (!Number.isFinite(minutes)) return t("app.messages.review.noTime");
  if (minutes < 60) return t("app.messages.review.minutes", { count: Math.round(minutes) });
  if (minutes < 60 * 24) {
    return t("app.messages.review.hours", { count: Math.round(minutes / 60) });
  }
  return t("app.messages.review.days", { count: Math.round(minutes / (60 * 24)) });
}

/**
 * The one reason worth printing on a list row.
 *
 * A structural refusal outranks everything — "they are outside your area" is
 * the whole story — and otherwise it is the heaviest weighted reason, which is
 * already first because scoreConversation sorts them that way. Reasons worth
 * nothing (a stated budget, product questions) are never the headline: they
 * are the trap, and putting one at the top of a row would be the software
 * repeating the mistake it was built to stop.
 */
export function topReason(score) {
  if (!score) return null;
  if (score.disqualified) {
    return { labelKey: score.disqualified.labelKey, quote: score.disqualified.quote };
  }
  const counted = (score.reasons || []).filter((r) => r.weight);
  return counted.length ? counted[0] : null;
}

/** A rate as a percentage, or null — never "0%" for "nothing was judged". */
export function formatRate(rate) {
  return Number.isFinite(rate) ? Math.round(rate * 100) : null;
}

export default function MessagesReviewPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  const now = new Date();
  // ?year=&month= — how a conversation's History tab opens the month it
  // counts in. Read from the location rather than useSearchParams, which
  // would need a Suspense boundary for two integers; an absent or unusable
  // value falls back to this month, never to a blank screen. The drawer the
  // values open renders only after the load, so the first paint is the same
  // on the server and the client.
  const [year, setYear] = useState(() => {
    const y = Number(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("year") : "");
    return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : now.getUTCFullYear();
  });
  const [month, setMonth] = useState(() => {
    const m = Number(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("month") : "");
    return Number.isInteger(m) && m >= 1 && m <= 12 ? m : now.getUTCMonth() + 1;
  });

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async (y, m) => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchList("/api/messaging/review?year=" + y + "&month=" + m);
    if (result.aborted) return;
    if (result.ok) setReview(result.data?.review || null);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(year, month);
  }, [load, year, month]);

  function shift(delta) {
    const next = month + delta;
    if (next < 1) {
      setMonth(12);
      setYear(year - 1);
    } else if (next > 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(next);
    }
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const wonPercent = formatRate(review?.wonRate);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link
          href="/app/messages"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          {t("app.messages.inboxLink")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">
          {t("app.messages.review.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.messages.review.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t("app.messages.review.prevMonth")}
          className="min-h-[44px] min-w-[44px] grid place-items-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t("app.messages.review.nextMonth")}
          className="min-h-[44px] min-w-[44px] grid place-items-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={() => load(year, month)}
        isEmpty={Boolean(review) && review.totals?.started === 0}
        skeleton={
          <div className="space-y-3 animate-pulse">
            <div className="h-24 bg-accent rounded-xl" />
            <div className="h-40 bg-accent rounded-xl" />
          </div>
        }
        empty={
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <MessageCircle size={20} aria-hidden="true" className="mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mt-3">
              {t("app.messages.review.noneStarted")}
            </p>
          </div>
        }
      >
        {review && (
          <div className="space-y-5">
            {/* ── Three figures, and each one able to say "we don't know" ── */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label={t("app.messages.review.started")} value={String(review.totals.started)} />
              <Tile
                label={t("app.messages.review.wonRate")}
                value={wonPercent === null ? "—" : wonPercent + "%"}
                note={
                  wonPercent === null
                    ? t("app.messages.review.wonRateUnknown")
                    : t("app.messages.review.wonOf", {
                        won: review.byOutcome.won,
                        judged: review.totals.judged,
                      })
                }
              />
              <Tile
                label={t("app.messages.review.medianResponse")}
                value={
                  Number.isFinite(review.medianFirstResponseMinutes)
                    ? formatMinutes(review.medianFirstResponseMinutes, t)
                    : "—"
                }
                note={
                  Number.isFinite(review.medianFirstResponseMinutes)
                    ? null
                    : t("app.messages.review.medianResponseNone")
                }
              />
            </div>

            {/* ── FIRST: the ones nobody answered ────────────────────────
                Measured from the messages, not from anybody remembering to
                set an outcome. */}
            <section className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle size={15} aria-hidden="true" />
                {t("app.messages.review.neverAnswered", { count: review.neverAnswered.length })}
              </h2>
              {review.neverAnswered.length === 0 ? (
                <p className="text-sm text-foreground mt-2">
                  {t("app.messages.review.neverAnsweredNone")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-foreground mt-1">
                    {t("app.messages.review.neverAnsweredHint")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {review.neverAnswered.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={"/app/messages?thread=" + encodeURIComponent(row.id)}
                          className="min-h-[44px] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted"
                        >
                          <span className="font-medium text-foreground text-sm">
                            {row.participantName || t("app.messages.unknownPerson")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(row.createdAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t("app.messages.review.inboundCount", { count: row.inboundCount })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* ── What they turned out to be ─────────────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">
                {t("app.messages.review.byOutcome")}
              </h2>
              <ul className="mt-3 space-y-2">
                {[...THREAD_OUTCOMES, "unset"].map((o) => (
                  <li key={o} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">
                      {o === "unset" ? t("app.messages.review.outcomeUnset") : t(outcomeLabelKey(o))}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {review.byOutcome[o]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── How fast, split by what happened ───────────────────────── */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">
                {t("app.messages.review.responseByOutcome")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.messages.review.caution")}
              </p>
              <ul className="mt-3 space-y-2">
                {[...THREAD_OUTCOMES, "unset"].map((o) => {
                  const group = review.responseByOutcome[o];
                  if (!group || (group.answered === 0 && group.unanswered === 0)) return null;
                  return (
                    <li key={o} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-foreground">
                        {o === "unset"
                          ? t("app.messages.review.outcomeUnset")
                          : t(outcomeLabelKey(o))}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="text-sm font-semibold text-foreground">
                          {formatMinutes(group.medianMinutes, t)}
                        </span>
                        <span>{t("app.messages.review.answeredCount", { count: group.answered })}</span>
                        {group.unanswered > 0 && (
                          <span>
                            {t("app.messages.review.unansweredCount", { count: group.unanswered })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ── The paid assessment: what the winners did differently ──
                A separate, metered call with its price on the button. It sits
                below the free numbers because those are always true and cost
                nothing, and above the ranked list because it explains it. */}
            <ConversationReviewPanel year={year} month={month} />

            {/* ── Everything, ranked by what was said, nothing hidden ─────
                Ordered by lib/messaging/conversationScore.js, which reads the
                homeowner's own words — did they raise logistics, move their
                dates, add scope, or say they were getting other quotes. NOT by
                effort: the customer who wrote the most in the conversations
                this scorer was built from was quoted and never answered again.

                Every conversation in the month is in this list, including the
                cold ones and the ones nobody has scored. A ranking that hid
                its own bottom would have buried the man who came back two
                months later and asked for a revised quote. */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">
                {t("app.messages.review.rankedTitle")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.messages.review.rankedHint")}
              </p>
              <ul className="mt-3 space-y-2">
                {(review.ranked || review.threads).map((row) => (
                  <li key={row.id}>
                    <Link
                      href={"/app/messages?thread=" + encodeURIComponent(row.id)}
                      className="min-h-[44px] flex flex-col gap-1 rounded-lg border border-border px-3 py-2 hover:bg-muted"
                    >
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-foreground">
                          {row.participantName || t("app.messages.unknownPerson")}
                        </span>
                        <TemperatureChip
                          temperature={row.score?.temperature}
                          score={row.score?.score}
                          confidence={row.score?.confidence}
                          t={t}
                        />
                        {!row.score && (
                          <span className="text-xs text-muted-foreground">
                            {t("app.messages.temperature.notScored")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.outcome
                            ? t(outcomeLabelKey(row.outcome))
                            : t("app.messages.review.outcomeUnset")}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatMinutes(row.firstResponseMinutes, t)}
                        </span>
                      </span>
                      {/* WHY it ranks there, in the words they typed. A rank
                          with no argument is a rank nobody can disagree with,
                          and this one is meant to be disagreed with. */}
                      {topReason(row.score) && (
                        <span className="text-xs text-muted-foreground">
                          {t(topReason(row.score).labelKey)}
                          {topReason(row.score).quote
                            ? ` — ${t("app.messages.temperature.quoted", { quote: topReason(row.score).quote })}`
                            : ""}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </ListState>
    </div>
  );
}

function Tile({ label, value, note }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
