// app/components/quotes/SuggestAddOns.js
//
// The optional extras offered at the bottom of a quote, and the AI review
// that proposes them.
//
// One component rather than two, because they're one job: you press Review,
// it tells you what's missing and what you usually sell alongside this, and
// the extras land in an editable list you can price and send. Splitting the
// advice from the thing it's advising about would mean copying suggestions
// across by hand, which nobody does.
//
// The list is saved separately from the quote (PUT /api/quotes/[id]/add-ons)
// so it works identically on the builder and the edit page without either
// needing to know the shape.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  TrendingUp,
  Camera,
  Eye,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { VISION_PASS_CENTS } from "@/lib/ai/imageEconomics";
import { visionPillState } from "@/lib/ai/visionPill";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  AiCreditTopupDialog,
  useAiCreditTopup,
} from "@/app/components/ai/AiCreditTopupDialog";

// Whole dollars in the reader's own locale. This was pinned to en-CA/CAD,
// which printed "CA$1,200" for an American company and "1 200 $CA" for
// nobody — the panel is internal, so the reader's language is the right one.
const moneyFor = (language) => (n) =>
  Number(n ?? 0).toLocaleString(language || "en", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

const SEVERITY = {
  high: { Icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  medium: { Icon: AlertCircle, className: "text-amber-600 dark:text-amber-400" },
  low: { Icon: Info, className: "text-muted-foreground" },
};

/**
 * @param quoteId   required — the review reads the saved quote, so a draft
 *                  has to exist before it can be reviewed
 * @param readOnly  true once the client has decided; the extras become a
 *                  record and the editor disappears
 * @param onProcessNotes  called when the user accepts the suggested
 *                  what-happens-next text, so the parent can put it in its
 *                  own form state
 * @param autoReview  run the review once, on arrival, without a second click.
 *                  Set only when the user has ALREADY pressed a review button
 *                  somewhere else — the builder's "Save & review", which saves
 *                  a draft and lands here because the review reads the saved
 *                  quote. It is not a "review on open" setting: the whole
 *                  reason POST and GET are split on that route is that
 *                  reopening a quote must not spend tokens.
 */
export default function SuggestAddOns({
  quoteId,
  readOnly = false,
  onProcessNotes,
  autoReview = false,
}) {
  const { t, language } = useTranslation();
  const money = moneyFor(language);
  const [addOns, setAddOns] = useState([]);
  const [review, setReview] = useState(null);
  const [reviewedAt, setReviewedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState([]);

  // The PAID deep photo read — a separate spend from the free review above,
  // off a separate AI credit wallet. See app/api/quotes/[id]/vision/route.js.
  const [visionPasses, setVisionPasses] = useState([]);
  // GET /api/quotes/[id]/vision's read-only verdict on whether the wallet
  // covers one read. Drives the pill's colour (lib/ai/visionPill.js); null
  // until it arrives or when it never does, which the pill treats as "price
  // known, balance unknown" rather than as a refusal.
  const [visionSpend, setVisionSpend] = useState(null);
  const [visionRunning, setVisionRunning] = useState(false);
  const [visionError, setVisionError] = useState("");

  // ── The deep read's own dead end, closed the same way the designer's was ──
  //
  // The 402 from /api/quotes/[id]/vision names the price, the balance and the
  // shortfall to the cent, and this panel showed all three verbatim with
  // nowhere to pay — the identical shape the owner hit in the Marketing
  // Designer. Adopting the shared dialog rather than growing a second copy of
  // the flow: same wallet, same tiers, same round trip back.
  //
  // No `onResume` and no `capturePending`: unlike the AI image panel there is
  // nothing typed to restore, and the deep read is not re-run on the way back.
  // Spending on arrival is a charge nobody pressed a button for — see the
  // dialog's rule 3. `onCredited` only clears the stale refusal sentence, so a
  // funded account is not still reading "you are $0.34 short" under a button
  // that would now work.
  const topup = useAiCreditTopup({
    pendingKey: "quote.vision",
    onCredited: () => setVisionError(""),
  });

  const load = useCallback(async () => {
    if (!quoteId) return;
    try {
      // The stored review comes back free — GET never calls a model. Only the
      // button below spends anything.
      const [existing, saved] = await Promise.all([
        fetchJson(`/api/quotes/${quoteId}/review`),
        fetchJson(`/api/quotes/${quoteId}/add-ons`),
      ]);
      setReview(existing?.review || null);
      setReviewedAt(existing?.reviewedAt || null);
      setAddOns(saved || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    // Fetched separately, and its failure never touches `error` above — a
    // company FieldQuo has withdrawn the deep read from (lib/features/gate.js
    // resolving ai_vision to `hidden`) must still see its own quote review and
    // add-ons, not a panel that failed to load over a feature it never asked
    // for.
    try {
      const vision = await fetchJson(`/api/quotes/${quoteId}/vision`);
      setVisionPasses(Array.isArray(vision?.passes) ? vision.passes : []);
      setVisionSpend(vision?.spend || null);
    } catch {
      setVisionPasses([]);
      setVisionSpend(null);
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  // The one place a review runs without a click on THIS screen — and only
  // because there was a click on the previous one. Waits for the initial load
  // so the panel isn't fetching the stored review and generating a new one at
  // the same time, and the ref makes it once-per-mount: React's development
  // double-invoke would otherwise buy two.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoReview || loading || readOnly || !quoteId) return;
    if (autoRan.current) return;
    autoRan.current = true;
    runReview();
  }, [autoReview, loading, readOnly, quoteId]);

  async function runReview() {
    setError("");
    setReviewing(true);
    try {
      const data = await fetchJson(`/api/quotes/${quoteId}/review`, {
        method: "POST",
      });
      setReview(data.review);
      setReviewedAt(data.reviewedAt);
      setDismissed([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  }

  async function runVision() {
    setVisionError("");
    setVisionRunning(true);
    try {
      const data = await fetchJson(`/api/quotes/${quoteId}/vision`, { method: "POST" });
      setVisionPasses(Array.isArray(data?.passes) ? data.passes : []);
      // The wallet just moved. Re-read the verdict rather than arithmetic on
      // the old one, so the pill and the next refusal agree to the cent.
      try {
        const again = await fetchJson(`/api/quotes/${quoteId}/vision`);
        setVisionSpend(again?.spend || null);
      } catch {
        setVisionSpend(null);
      }
    } catch (err) {
      // 402 with an offer is "you are short by exactly this much, and here is
      // the way past it" — the dialog is opened on it instead of the sentence
      // being printed at somebody who cannot act on it. fetchJson hands the
      // whole parsed body back on `err.data`, which is where the tier list is.
      if (err.status === 402 && err.data?.topup) {
        topup.open(err.data);
        return;
      }
      // Everything else: the route's own message already states the price, the
      // balance and the shortfall when it's a credit refusal — see the route.
      // Shown verbatim rather than replaced with a generic "something went
      // wrong".
      setVisionError(err.message);
    } finally {
      setVisionRunning(false);
    }
  }

  async function save(next) {
    setError("");
    setSaving(true);
    try {
      const saved = await fetchJson(`/api/quotes/${quoteId}/add-ons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ addOns: next }, "add-on list"),
      });
      setAddOns(saved);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function update(i, patch) {
    setAddOns((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setSavedAt(null);
  }

  function remove(i) {
    setAddOns((prev) => prev.filter((_, j) => j !== i));
    setSavedAt(null);
  }

  function addBlank() {
    setAddOns((prev) => [
      ...prev,
      {
        description: "",
        detail: "",
        amount: "",
        taxable: true,
        source: "manual",
      },
    ]);
    setSavedAt(null);
  }

  function acceptSuggestion(s) {
    setAddOns((prev) => [
      ...prev,
      {
        description: s.description,
        detail: s.detail || "",
        // A suggestion with no price history arrives empty rather than
        // guessed. An invented number on a document a client signs is worse
        // than a blank one the contractor has to fill in.
        amount: s.amount ?? "",
        taxable: true,
        source: s.source === "history" ? "history" : "ai",
      },
    ]);
    setDismissed((prev) => [...prev, s.description]);
    setSavedAt(null);
  }

  if (!quoteId) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          {t("app.quoteReview.saveFirst")}
        </p>
      </Panel>
    );
  }

  if (loading) {
    return (
      <Panel>
        <div className="h-20 bg-accent rounded-lg animate-pulse" />
      </Panel>
    );
  }

  const suggestions = (review?.addOns || []).filter(
    (s) =>
      !dismissed.includes(s.description) &&
      !addOns.some(
        (a) =>
          a.description.trim().toLowerCase() ===
          s.description.trim().toLowerCase(),
      ),
  );

  const dirty = addOns.length > 0 && savedAt === null;

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            {/* -text variant, not the raw accent: #ff5a00 as TEXT on a light
                card is 2.9:1, under the floor. See globals.css. */}
            <Sparkles size={16} className="text-brand-accent-text" />
            {t("app.quoteReview.title")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reviewedAt
              ? t("app.quoteReview.lastReviewed", {
                  date: new Date(reviewedAt).toLocaleString(language || "en", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                })
              : t("app.quoteReview.intro")}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={runReview}
            disabled={reviewing}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
          >
            {reviewing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {reviewing
              ? t("app.quoteReview.reviewing")
              : reviewedAt
                ? t("app.quoteReview.reviewAgain")
                : t("app.quoteReview.review")}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {review && (
        <div className="mt-5 space-y-5">
          {/* Readiness leads, because it answers "is this ready to send" in
              one glance. Presented as a count of what's missing, not as a
              probability — it isn't one, and dressing it up as one would be a
              number the contractor can't argue with and shouldn't trust. */}
          <div className="flex items-center gap-3">
            <div
              className={`text-2xl font-bold tabular-nums ${
                review.readiness >= 80
                  ? "text-green-600 dark:text-green-400"
                  : review.readiness >= 55
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {review.readiness}
              <span className="text-sm font-normal text-muted-foreground">
                /100
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {review.checks.length === 0
                ? t("app.quoteReview.readyToSend")
                : t("app.quoteReview.thingsToFix", { value: review.checks.length })}
            </p>
          </div>

          {review.checks.length > 0 && (
            <ul className="space-y-2.5">
              {review.checks.map((chk) => {
                const { Icon, className } =
                  SEVERITY[chk.severity] || SEVERITY.low;
                return (
                  <li key={chk.id} className="flex gap-2.5">
                    <Icon size={15} className={`${className} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {chk.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {chk.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {review.pricing && (
            <div className="border border-border rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <TrendingUp size={14} className="text-muted-foreground" />
                {t("app.quoteReview.priceCheck")}
                {review.pricing.verdict === "high" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                    {t("app.quoteReview.aboveUsual")}
                  </span>
                )}
                {review.pricing.verdict === "low" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                    {t("app.quoteReview.belowUsual")}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {review.pricing.detail}
              </p>
              {/* Said out loud because "compared to the industry" and
                  "compared to your own history" are very different claims,
                  and only the second one is true here. */}
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                {t("app.quoteReview.ownHistoryOnly")}
              </p>
            </div>
          )}

          {review.rewrites?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                {t("app.quoteReview.clearerWording")}
              </p>
              <div className="space-y-2">
                {review.rewrites.map((r, i) => (
                  <div
                    key={i}
                    className="text-xs border border-border rounded-lg px-3 py-2"
                  >
                    <p className="text-muted-foreground line-through">
                      {r.from}
                    </p>
                    <p className="text-foreground mt-1">{r.to}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-2">
                {t("app.quoteReview.copyYourself")}
              </p>
            </div>
          )}

          {/* ── What the model saw in the photographs ──────────────────────
              Rendered at all for the first time. The notes were being
              generated and dropped, so a review of a quote with photos paid to
              send them and told the estimator nothing.

              Shown whenever photos were READ, including when there is nothing
              to report. "We looked at 3 photos and found nothing the quote
              misses" is a different statement from silence, and it is the one
              that lets an estimator stop worrying — the prompt calls an empty
              array "a real and useful answer" and this is where that promise
              is either kept or broken.

              For the ESTIMATOR, never the client: these are hedged
              observations from one angle of one moment, and nothing here is
              copied onto a document a homeowner reads. */}
          {review.photosRead > 0 && (
            <div className="border border-border rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Camera size={14} className="text-muted-foreground" />
                {t("app.quoteReview.photosShow")}
              </p>
              {review.photoNotes?.length > 0 ? (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {review.photoNotes.map((n, i) => (
                      <li
                        key={i}
                        className="text-xs text-foreground flex gap-2 leading-relaxed"
                      >
                        <span className="text-muted-foreground/60 shrink-0">—</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground/70 mt-2.5">
                    {t("app.deepRead.notForClient")}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {review.photosRead === 1
                    ? t("app.quoteReview.photoNothingOne")
                    : t("app.quoteReview.photoNothingMany", { count: review.photosRead })}
                </p>
              )}
            </div>
          )}

          {review.suggestedProcessNotes && onProcessNotes && (
            <div className="border border-border rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("app.quoteReview.suggestedProcess")}
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1.5">
                {review.suggestedProcessNotes}
              </p>
              <button
                type="button"
                onClick={() => onProcessNotes(review.suggestedProcessNotes)}
                className="mt-2.5 text-xs font-semibold text-foreground underline"
              >
                {t("app.quoteReview.useThis")}
              </button>
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                {t("app.quoteReview.fillBrackets")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── The PAID deep photo read ──────────────────────────────────────
          A separate, higher-detail pass over the same photos "What the
          photos show" above reads for free — up to 8 of them at full
          resolution instead of the quick, flat-rate check. Shown whenever
          there's a quote to run it against, independent of whether the free
          review above has been run at all: an estimator may want the deep
          read on its own, without re-running the wording/pricing checks.
          Never merges into the free photoNotes panel — it costs real AI
          credit each run and every past read stays on record (see the
          Quote.aiVisionPasses schema comment), so it gets its own history
          rather than being folded into a panel that overwrites on refresh. */}
      {(visionPasses.length > 0 || !readOnly) && (
        <div className="mt-5 border border-border rounded-lg px-4 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                <Eye size={14} className="text-muted-foreground" />
                {t("app.deepRead.title")}
                {/* Amber: pressing the button spends this much and will work.
                    Red: the wallet can't cover one read — the shortfall is
                    the number. Green: already read today; nothing more is
                    spent unless they run it again. Solid fills, measured —
                    see lib/ai/visionPill.js. */}
                {(() => {
                  const pill = visionPillState({
                    spend: visionSpend,
                    passes: visionPasses,
                    costCents: VISION_PASS_CENTS,
                    money: (cents) => formatAppMoney(cents / 100, CREDIT_CURRENCY, language),
                  });
                  return (
                    <span
                      data-vision-pill={pill.state}
                      className={`text-[11px] font-semibold tracking-wide rounded-full px-2 py-0.5 ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  );
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("app.deepRead.description", {
                  max: 8,
                  price: formatAppMoney(VISION_PASS_CENTS / 100, CREDIT_CURRENCY, language),
                })}
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={runVision}
                disabled={visionRunning}
                className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60 shrink-0"
              >
                {visionRunning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eye size={14} />
                )}
                {visionRunning
                  ? t("app.deepRead.running")
                  : visionPasses.length > 0
                    ? t("app.deepRead.runAgain")
                    : t("app.deepRead.run")}
              </button>
            )}
          </div>

          {visionError && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2.5">
              {visionError}
            </p>
          )}

          {visionPasses.length > 0 ? (
            <div className="mt-3 space-y-3">
              {visionPasses.map((p, i) => (
                <div
                  key={p.at || i}
                  className="border border-dashed border-border rounded-lg px-3 py-2.5"
                >
                  <p className="text-[11px] text-muted-foreground/70">
                    {p.at
                      ? new Date(p.at).toLocaleString(language || "en", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                    {" · "}
                    {t("app.deepRead.photosRead", { value: p.photosRead })}
                    {typeof p.costCents === "number" && (
                      <>
                        {" · "}
                        {formatAppMoney(p.costCents / 100, CREDIT_CURRENCY, language)}
                      </>
                    )}
                  </p>
                  {p.notes?.length > 0 ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {p.notes.map((n, j) => (
                        <li
                          key={j}
                          className="text-xs text-foreground flex gap-2 leading-relaxed"
                        >
                          <span className="text-muted-foreground/60 shrink-0">
                            —
                          </span>
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t("app.deepRead.nothingFound")}
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground/70">
                {t("app.deepRead.notForClient")}
              </p>
            </div>
          ) : (
            !readOnly && (
              <p className="text-xs text-muted-foreground mt-2.5">
                {t("app.deepRead.notRunYet")}
              </p>
            )
          )}
        </div>
      )}

      {/* ── The extras themselves ─────────────────────────────────────── */}

      {suggestions.length > 0 && !readOnly && (
        <div className="mt-5">
          <p className="text-sm font-medium text-foreground mb-2">
            {t("app.quoteReview.oftenSold")}
          </p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.description}
                className="flex items-start gap-3 border border-dashed border-border rounded-lg px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{s.description}</p>
                  {s.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.detail}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {s.note}
                    {" · "}
                    {s.amount
                      ? t("app.quoteReview.usuallyCharge", { amount: money(s.amount) })
                      : t("app.quoteReview.noPriceHistory")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => acceptSuggestion(s)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold border border-border px-3 py-1.5 rounded-full"
                >
                  <Plus size={12} /> {t("app.action.add")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {t("app.quoteReview.offeredAtBottom")}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={addBlank}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus size={12} /> {t("app.quoteReview.addOne")}
            </button>
          )}
        </div>

        {addOns.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2">
            {t("app.quoteReview.nothingOffered")}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {addOns.map((a, i) => {
              // An extra the takeoff owns. It is regenerated from the scope
              // group every time the quote is saved, so the fields are shown
              // and not offered: accepting an edit here and discarding it on
              // the next save is exactly the control-that-doesn't-work this
              // codebase gets swept for. Change the room, not this row.
              const fromTakeoff = a.source === "takeoff";
              const locked = readOnly || fromTakeoff;
              return (
              <div
                key={a.id || i}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    value={a.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    disabled={locked}
                    placeholder={t("app.quoteReview.extraPlaceholder")}
                    className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-70"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <input
                      value={a.amount}
                      onChange={(e) => update(i, { amount: e.target.value })}
                      disabled={locked}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full border border-border rounded-lg pl-6 pr-3 py-2 text-sm bg-card tabular-nums disabled:opacity-70"
                    />
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="shrink-0 text-muted-foreground hover:text-red-600 p-2"
                      aria-label={t("app.action.remove")}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <input
                  value={a.detail || ""}
                  onChange={(e) => update(i, { detail: e.target.value })}
                  disabled={locked}
                  placeholder={t("app.quoteReview.detailPlaceholder")}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-70"
                />

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={a.taxable !== false}
                    onChange={(e) => update(i, { taxable: e.target.checked })}
                    disabled={locked}
                  />
                  {t("app.quoteReview.taxable")}
                </label>

                {fromTakeoff && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.quoteReview.fromTakeoff")}
                  </p>
                )}

                {a.selected && (
                  <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                    <Check size={12} /> {t("app.quoteReview.clientAdded")}
                  </p>
                )}
              </div>
              );
            })}

            {!readOnly && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => save(addOns)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {t("app.quoteReview.saveExtras")}
                </button>
                {/* Saved separately from the quote, so there has to be some
                    signal that pressing the quote's own Save didn't cover
                    this. */}
                {dirty && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t("app.quoteReview.unsaved")}
                  </span>
                )}
                {savedAt && !dirty && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Check size={12} /> {t("app.action.saved")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Mounted outside the deep-read block on purpose: that block is hidden
          on a read-only quote with no passes, and the trip back from Stripe
          has to be able to report what happened wherever it lands. The dialog
          renders nothing until it has an offer or a settlement to show. */}
      <AiCreditTopupDialog {...topup.dialogProps} />
    </Panel>
  );
}

function Panel({ children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">{children}</div>
  );
}
