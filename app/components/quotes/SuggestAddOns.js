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
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
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
  const [addOns, setAddOns] = useState([]);
  const [review, setReview] = useState(null);
  const [reviewedAt, setReviewedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState([]);

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

  async function save(next) {
    setError("");
    setSaving(true);
    try {
      const saved = await fetchJson(`/api/quotes/${quoteId}/add-ons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addOns: next }),
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
          Save this quote as a draft first — the review reads what&apos;s
          actually on it.
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
            Review &amp; optional extras
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reviewedAt
              ? `Last reviewed ${new Date(reviewedAt).toLocaleString("en-CA", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Checks the quote for the things that stop clients signing."}
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
              ? "Reviewing..."
              : reviewedAt
                ? "Review again"
                : "Review this quote"}
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
                ? "Nothing obvious missing — this one's ready to send."
                : `${review.checks.length} thing${
                    review.checks.length > 1 ? "s" : ""
                  } worth fixing before you send it.`}
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
                Price check
                {review.pricing.verdict === "high" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                    above your usual
                  </span>
                )}
                {review.pricing.verdict === "low" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                    below your usual
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
                Compared against your own accepted quotes only — never other
                companies&apos;.
              </p>
            </div>
          )}

          {review.rewrites?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Clearer wording
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
                Copy these into the line items yourself — nothing is changed for
                you.
              </p>
            </div>
          )}

          {review.suggestedProcessNotes && onProcessNotes && (
            <div className="border border-border rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Suggested &ldquo;what happens next&rdquo;
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1.5">
                {review.suggestedProcessNotes}
              </p>
              <button
                type="button"
                onClick={() => onProcessNotes(review.suggestedProcessNotes)}
                className="mt-2.5 text-xs font-semibold text-foreground underline"
              >
                Use this
              </button>
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                Fill in anything in [square brackets] — those are guesses left
                blank on purpose.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── The extras themselves ─────────────────────────────────────── */}

      {suggestions.length > 0 && !readOnly && (
        <div className="mt-5">
          <p className="text-sm font-medium text-foreground mb-2">
            You often sell these alongside this work
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
                    {s.amount
                      ? ` · you usually charge about ${money(s.amount)}`
                      : " · no price history yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => acceptSuggestion(s)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold border border-border px-3 py-1.5 rounded-full"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            Offered at the bottom of the quote
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={addBlank}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus size={12} /> Add one
            </button>
          )}
        </div>

        {addOns.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2">
            Nothing offered yet. Extras the client can tick themselves are the
            cheapest revenue in the business — they&apos;re already saying yes.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {addOns.map((a, i) => (
              <div
                key={i}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    value={a.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    disabled={readOnly}
                    placeholder="Gutter guards"
                    className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-card"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <input
                      value={a.amount}
                      onChange={(e) => update(i, { amount: e.target.value })}
                      disabled={readOnly}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full border border-border rounded-lg pl-6 pr-3 py-2 text-sm bg-card tabular-nums"
                    />
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="shrink-0 text-muted-foreground hover:text-red-600 p-2"
                      aria-label="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <input
                  value={a.detail || ""}
                  onChange={(e) => update(i, { detail: e.target.value })}
                  disabled={readOnly}
                  placeholder="Why it's worth having — one line"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
                />

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={a.taxable !== false}
                    onChange={(e) => update(i, { taxable: e.target.checked })}
                    disabled={readOnly}
                  />
                  Taxable
                </label>

                {a.selected && (
                  <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                    <Check size={12} /> The client added this
                  </p>
                )}
              </div>
            ))}

            {!readOnly && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => save(addOns)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  Save extras
                </button>
                {/* Saved separately from the quote, so there has to be some
                    signal that pressing the quote's own Save didn't cover
                    this. */}
                {dirty && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Unsaved
                  </span>
                )}
                {savedAt && !dirty && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Check size={12} /> Saved
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function Panel({ children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">{children}</div>
  );
}
