"use client";

// app/components/messaging/ConversationReviewPanel.js
//
// The AI assessment, on the monthly review screen.
//
// ══ Why a component and not markup inside the page ═════════════════════════
//
// app/app/messages/review/page.js is being edited by another change in the same
// session, so this lands as a self-contained panel it can mount with one line
// rather than as a diff inside it. Everything the panel needs it fetches for
// itself from /api/messaging/review/ai; the only thing the page has to do is
// render it with the year and month it is already showing:
//
//     <ConversationReviewPanel year={year} month={month} />
//
// ══ The price is on the button, before the click ═══════════════════════════
//
// In the units the contractor actually spends — their monthly AI allowance, in
// tokens, next to what is left of it. Not dollars: FieldQuo pays the vendor,
// the company pays allowance, and quoting somebody a currency figure for money
// they are not spending is a price nobody can check.
//
// ══ Every refusal names itself ═════════════════════════════════════════════
//
// Too few conversations, too few wins, no allowance left, a demo tenant, AI not
// configured — five different sentences, each in the same bordered block as the
// button it explains, which is the shape scripts/check-paid-refusals.mjs
// established for the three paid surfaces that came before this one. A greyed
// button with a reason floating somewhere above it reads as "the feature is
// gone".

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { createdViaLabelKey } from "@/lib/quotes/createdVia";

export default function ConversationReviewPanel({ year, month }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (y, m) => {
    setLoading(true);
    const result = await fetchList(`/api/messaging/review/ai?year=${y}&month=${m}`);
    if (result.aborted) return;
    // No `else`-less `if (res.ok)`: a failed load sets the panel to null AND
    // records why, so the block below shows a retry rather than an empty box
    // that looks like "no review yet".
    if (result.ok) {
      setState(result.data);
      setError("");
    } else {
      setState(null);
      setError(t("app.messages.aiReview.loadError"));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load(year, month);
  }, [load, year, month]);

  async function generate() {
    setRunning(true);
    setError("");
    const res = await fetch(`/api/messaging/review/ai?year=${year}&month=${month}`, {
      method: "POST",
    });
    if (!res.ok) {
      await reportResponseError(res, setError, t("app.messages.aiReview.runError"));
      setRunning(false);
      return;
    }
    const data = await res.json().catch(() => null);
    if (data?.review) setState((s) => ({ ...(s || {}), review: data.review }));
    // Reload so the price and the remaining allowance reflect what was just
    // spent. Regenerating shows the new price, not the one from before.
    await load(year, month);
    setRunning(false);
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="h-20 bg-accent rounded-lg animate-pulse" />
      </section>
    );
  }

  const review = state?.review || null;
  const findings = review?.findings || null;
  const price = state?.price || null;
  const canRun = Boolean(state?.available) && !running;

  // The one sentence that explains why the button is off, chosen once so the
  // markup below has a single place to print it.
  const blockedKey = state?.reasonKey || null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <Sparkles size={15} aria-hidden="true" />
        {t("app.messages.aiReview.title")}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        {t("app.messages.aiReview.subtitle")}
      </p>

      {/* ── The control and its reason, in one block ────────────────────── */}
      <div className="mt-3 rounded-lg border border-border p-3">
        {blockedKey && (
          <p className="text-sm text-foreground">
            {t(blockedKey, state?.reasonValues || {})}
          </p>
        )}
        {!blockedKey && price && price.allowed === false && (
          <p className="text-sm text-foreground">{price.reason}</p>
        )}
        {price && (
          <p className="text-xs text-muted-foreground mt-1">
            {Number.isFinite(price.remaining)
              ? t("app.messages.aiReview.priceWithRemaining", {
                  tokens: price.estimatedTokens.toLocaleString(),
                  remaining: price.remaining.toLocaleString(),
                })
              : t("app.messages.aiReview.price", {
                  tokens: price.estimatedTokens.toLocaleString(),
                })}
          </p>
        )}
        <button
          type="button"
          onClick={generate}
          disabled={!canRun}
          className="mt-3 min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {running && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
          {review
            ? t("app.messages.aiReview.regenerate")
            : t("app.messages.aiReview.generate")}
        </button>
        {error && (
          <p className="mt-2 text-sm text-destructive flex items-start gap-1.5">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* ── What came back ─────────────────────────────────────────────── */}
      {review && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("app.messages.aiReview.generatedOn", {
              date: formatDate(review.generatedAt),
              sampled: review.sampleSize,
              won: review.wonSampled,
            })}
          </p>

          {/* ── Who wrote the quotes these conversations produced ─────────
              The stats half of the ask, and the only screen that reads
              Quote.createdVia. Shown on a refused review too: it is arithmetic,
              it cost nothing, and it is exactly as true without a model's
              paragraph around it. */}
          {findings?.numbers?.quotesByOrigin?.total > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("app.messages.aiReview.quotesFrom", {
                  count: findings.numbers.quotesByOrigin.total,
                })}
              </h3>
              <ul className="mt-1 space-y-1">
                {Object.entries(findings.numbers.quotesByOrigin.counts).map(([via, n]) => (
                  <li key={via} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{t(createdViaLabelKey(via))}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{n}</span>
                  </li>
                ))}
                {findings.numbers.quotesByOrigin.notRecorded > 0 && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {t(createdViaLabelKey(null))}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {findings.numbers.quotesByOrigin.notRecorded}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {review.status !== "ready" ? (
            <p className="text-sm text-foreground">
              {findings?.reasonKey
                ? t(findings.reasonKey, findings.reasonValues || {})
                : t("app.messages.aiReview.notAssessed")}
            </p>
          ) : (
            <>
              {findings?.confidence === "not_enough" && (
                <p className="text-sm text-foreground">
                  {t("app.messages.aiReview.confidenceNotEnough")}
                </p>
              )}
              {findings?.whatWinnersDid && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("app.messages.aiReview.whatWorked")}
                  </h3>
                  <p className="text-sm text-foreground mt-1">{findings.whatWinnersDid}</p>
                </div>
              )}
              {Array.isArray(findings?.changes) && findings.changes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("app.messages.aiReview.changes")}
                  </h3>
                  <ul className="mt-1 space-y-2">
                    {findings.changes.map((c, i) => (
                      <li key={i} className="text-sm text-foreground">
                        <span className="font-medium">{c.title}</span>
                        {c.why && (
                          <span className="block text-muted-foreground text-xs mt-0.5">{c.why}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(findings?.goBackTo) && findings.goBackTo.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t("app.messages.aiReview.goBackTo")}
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {findings.goBackTo.map((id) => (
                      <li key={id}>
                        <a
                          href={"/app/messages?thread=" + encodeURIComponent(id)}
                          className="text-sm text-primary underline"
                        >
                          {t("app.messages.aiReview.openConversation")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* The sample, said out loud. Advice written off nine of forty
                  conversations has to say so beside itself. */}
              {findings?.numbers?.sample && (
                <p className="text-xs text-muted-foreground">
                  {t("app.messages.aiReview.sampleNote", {
                    sampled: findings.numbers.sample.sampled,
                    won: findings.numbers.sample.won,
                    unmatched: findings.numbers.sample.unmatched,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
