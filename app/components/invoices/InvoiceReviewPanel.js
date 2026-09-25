// app/components/invoices/InvoiceReviewPanel.js
//
// The AI review and the paid deep photo read, on an invoice — the two
// controls the owner asked for on the invoice builder (2026-09-23: "it
// should also have the same features, AI review and AI deep read").
//
// ── A sibling of SuggestAddOns.js, not an extraction from it ────────────────
//
// The quote's panel (app/components/quotes/SuggestAddOns.js) draws these two
// blocks and, around them, the optional extras, the actuals finding and the
// what-happens-next offer — none of which an invoice has. Its source is
// pinned line by line by four check scripts (paid-refusals, photo-notes,
// review-notes, addon-descriptions), and lifting the two blocks out of it
// into a shared file would have been a refactor of a working control for
// the sake of one copy. So the two blocks are drawn again here, the same
// markup and the same rules — readiness leads, findings as a list by
// severity, the pill that says what a read costs and whether the wallet
// covers it, the 402 that opens the top-up dialog instead of a dead end —
// against the invoice's own routes (app/api/invoices/[id]/review and
// deep-read). What it deliberately does NOT carry: "Add to notes for
// review" (an invoice has no internal review notes), and any cost finding
// (the margin lives in the drawer beside it).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, AlertCircle, Info, Camera, Eye } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { VISION_PASS_CENTS } from "@/lib/ai/imageEconomics";
import { visionPillState } from "@/lib/ai/visionPill";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AiCreditTopupDialog, useAiCreditTopup } from "@/app/components/ai/AiCreditTopupDialog";
import DeepReadFindings from "@/app/components/ai/DeepReadFindings";

const SEVERITY = {
  high: { Icon: AlertTriangle, className: "text-red-600 dark:text-red-400" },
  medium: { Icon: AlertCircle, className: "text-amber-600 dark:text-amber-400" },
  low: { Icon: Info, className: "text-muted-foreground" },
};

/**
 * @param invoiceId   null before the first save — the review reads the SAVED
 *                    invoice, so the panel says so rather than offering a
 *                    button that would 404
 * @param readOnly    true once nothing about the invoice may change
 * @param autoReview  run the review once on arrival — set only when the
 *                    user already pressed "Save & review" on the previous
 *                    screen, never as a "review on open" setting
 */
export default function InvoiceReviewPanel({ invoiceId, readOnly = false, autoReview = false }) {
  const { t, language } = useTranslation();

  const [review, setReview] = useState(null);
  const [reviewedAt, setReviewedAt] = useState(null);
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");

  const [visionPasses, setVisionPasses] = useState([]);
  const [visionTradeNames, setVisionTradeNames] = useState({});
  const [visionSpend, setVisionSpend] = useState(null);
  const [visionRunning, setVisionRunning] = useState(false);
  const [visionError, setVisionError] = useState("");

  const topup = useAiCreditTopup({
    pendingKey: "invoice.vision",
    onCredited: () => setVisionError(""),
  });

  const load = useCallback(async () => {
    if (!invoiceId) return;
    try {
      // The stored review comes back free — GET never calls a model.
      const existing = await fetchJson(`/api/invoices/${invoiceId}/review`);
      setReview(existing?.review || null);
      setReviewedAt(existing?.reviewedAt || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // Separately, and its failure never touches `error`: a company the deep
    // read is withdrawn from must still see its own review.
    try {
      const vision = await fetchJson(`/api/invoices/${invoiceId}/deep-read`);
      setVisionPasses(Array.isArray(vision?.passes) ? vision.passes : []);
      setVisionTradeNames(vision?.tradeNames || {});
      setVisionSpend(vision?.spend || null);
    } catch {
      setVisionPasses([]);
      setVisionTradeNames({});
      setVisionSpend(null);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoReview || loading || readOnly || !invoiceId) return;
    if (autoRan.current) return;
    autoRan.current = true;
    runReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReview, loading, readOnly, invoiceId]);

  async function runReview() {
    setError("");
    setReviewing(true);
    try {
      const data = await fetchJson(`/api/invoices/${invoiceId}/review`, { method: "POST" });
      setReview(data.review);
      setReviewedAt(data.reviewedAt);
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
      const data = await fetchJson(`/api/invoices/${invoiceId}/deep-read`, { method: "POST" });
      setVisionPasses(Array.isArray(data?.passes) ? data.passes : []);
      setVisionTradeNames(data?.tradeNames || {});
      // The wallet just moved: re-read the verdict rather than arithmetic.
      try {
        const again = await fetchJson(`/api/invoices/${invoiceId}/deep-read`);
        setVisionSpend(again?.spend || null);
      } catch {
        setVisionSpend(null);
      }
    } catch (err) {
      // 402 with an offer: the dialog, not a sentence nobody can act on.
      if (err.status === 402 && err.data?.topup) {
        topup.open(err.data);
        return;
      }
      setVisionError(err.message);
    } finally {
      setVisionRunning(false);
    }
  }

  if (!invoiceId) {
    return (
      <Panel data-invoice-review-panel="unsaved">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles size={16} className="text-brand-accent-text" />
          {t("app.invoiceReview.title", "AI review")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.invoiceReview.saveFirst", "Save the invoice first — the review reads the saved copy. \"Save & review\" does both in one press.")}
        </p>
      </Panel>
    );
  }

  if (loading) {
    return (
      <Panel data-invoice-review-panel="loading">
        <div className="h-20 bg-accent rounded-lg animate-pulse" />
      </Panel>
    );
  }

  return (
    <Panel data-invoice-review-panel="ready">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles size={16} className="text-brand-accent-text" />
            {t("app.invoiceReview.title", "AI review")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reviewedAt
              ? t("app.quoteReview.lastReviewed", {
                  date: new Date(reviewedAt).toLocaleString(language || "en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
                })
              : t("app.invoiceReview.intro", "Checks the invoice before it goes out — the due date, the tax, the lines the client won't recognise, the total against the accepted quote.")}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={runReview}
            disabled={reviewing}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
            data-invoice-review-run
          >
            {reviewing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {reviewing ? t("app.quoteReview.reviewing") : reviewedAt ? t("app.quoteReview.reviewAgain") : t("app.quoteReview.review")}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {review && (
        <div className="mt-5 space-y-5" data-invoice-review-findings>
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
              <span className="text-sm font-normal text-muted-foreground">/100</span>
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
                const { Icon, className } = SEVERITY[chk.severity] || SEVERITY.low;
                return (
                  <li key={chk.id} className="flex gap-2.5">
                    <Icon size={15} className={`${className} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{chk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{chk.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {review.rewrites?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">{t("app.quoteReview.clearerWording")}</p>
              <div className="space-y-2">
                {review.rewrites.map((r, i) => (
                  <div key={i} className="text-xs border border-border rounded-lg px-3 py-2">
                    <p className="text-muted-foreground line-through">{r.from}</p>
                    <p className="text-foreground mt-1">{r.to}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-2">{t("app.quoteReview.copyYourself")}</p>
            </div>
          )}

          {review.photosAttached > 0 && (
            <div className="border border-border rounded-lg px-4 py-3" data-photos-not-read>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Camera size={14} className="text-muted-foreground" />
                {review.photosAttached === 1
                  ? t("app.quoteReview.photosNotReadOne")
                  : t("app.quoteReview.photosNotReadMany", { count: review.photosAttached })}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("app.quoteReview.photosNotReadHint", { price: formatAppMoney(VISION_PASS_CENTS / 100, CREDIT_CURRENCY, language) })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── The PAID deep photo read ────────────────────────────────────── */}
      {(visionPasses.length > 0 || !readOnly) && (
        <div className="mt-5 border border-border rounded-lg px-4 py-3" data-invoice-deep-read>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                <Eye size={14} className="text-muted-foreground" />
                {t("app.deepRead.title")}
                {(() => {
                  const pill = visionPillState({
                    spend: visionSpend,
                    passes: visionPasses,
                    costCents: VISION_PASS_CENTS,
                    money: (cents) => formatAppMoney(cents / 100, CREDIT_CURRENCY, language),
                  });
                  return (
                    <span data-vision-pill={pill.state} className={`text-[11px] font-semibold tracking-wide rounded-full px-2 py-0.5 ${pill.className}`}>
                      {pill.label}
                    </span>
                  );
                })()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("app.invoiceReview.deepReadDescription", { max: 8, price: formatAppMoney(VISION_PASS_CENTS / 100, CREDIT_CURRENCY, language) })}
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={runVision}
                disabled={visionRunning}
                className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60 shrink-0"
                data-invoice-deep-read-run
              >
                {visionRunning ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                {visionRunning ? t("app.deepRead.running") : visionPasses.length > 0 ? t("app.deepRead.runAgain") : t("app.deepRead.run")}
              </button>
            )}
          </div>

          {visionError && <p className="text-xs text-red-700 dark:text-red-300 mt-2.5">{visionError}</p>}

          {visionPasses.length > 0 ? (
            <div className="mt-3 space-y-3">
              {visionPasses.map((p, j) => (
                <div key={p.at || j} className="border border-dashed border-border rounded-lg px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground/70">
                    {p.at ? new Date(p.at).toLocaleString(language || "en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}
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
                      {p.notes.map((n, k) => (
                        <li key={k} className="text-xs text-foreground flex gap-2 leading-relaxed">
                          <span className="text-muted-foreground/60 shrink-0">—</span>
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1.5">{t("app.deepRead.nothingFound")}</p>
                  )}
                  {/* The same photo check and trade evidence as the quote's
                      panel, judged against the invoice's source quote. */}
                  <DeepReadFindings pass={p} tradeNames={visionTradeNames} docKind="invoice" />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground/70">{t("app.deepRead.notForClient")}</p>
            </div>
          ) : (
            !readOnly && <p className="text-xs text-muted-foreground mt-2.5">{t("app.deepRead.notRunYet")}</p>
          )}
        </div>
      )}
      <AiCreditTopupDialog {...topup.dialogProps} />
    </Panel>
  );
}

function Panel({ children, ...rest }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5" {...rest}>
      {children}
    </div>
  );
}
