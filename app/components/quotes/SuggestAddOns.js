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

  // The PAID deep photo read — a separate spend from the free review above,
  // off a separate AI credit wallet. See app/api/quotes/[id]/vision/route.js.
  const [visionPasses, setVisionPasses] = useState([]);
  const [visionRunning, setVisionRunning] = useState(false);
  const [visionError, setVisionError] = useState("");

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
    } catch {
      setVisionPasses([]);
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
    } catch (err) {
      // The route's own message already states the price, the balance and the
      // shortfall when it's a credit refusal — see the route. Shown verbatim
      // rather than replaced with a generic "something went wrong".
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
                What the photos show
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
                    Things to check on site — not measurements, and not for the
                    client to read. Nothing has been added to the quote.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Nothing in {review.photosRead === 1 ? "the photo" : `the ${review.photosRead} photos`} that the quote
                  doesn&apos;t already cover.
                </p>
              )}
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
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Eye size={14} className="text-muted-foreground" />
                Deep photo read
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                  Paid
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A closer look at every photo on this quote — up to 8, read at
                full resolution instead of the quick check above. Spends AI
                credit each time it runs, separate from your phone balance.
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
                  ? "Reading..."
                  : visionPasses.length > 0
                    ? "Run again"
                    : "Run deep read"}
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
                      ? new Date(p.at).toLocaleString("en-CA", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                    {" · "}
                    {p.photosRead} photo{p.photosRead === 1 ? "" : "s"} read
                    {typeof p.costCents === "number" && (
                      <>
                        {" · "}
                        {formatAppMoney(p.costCents / 100, CREDIT_CURRENCY, "en")}
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
                      Nothing found beyond what the quote already covers.
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground/70">
                Things to check on site — not measurements, and not for the
                client to read. Nothing has been added to the quote.
              </p>
            </div>
          ) : (
            !readOnly && (
              <p className="text-xs text-muted-foreground mt-2.5">
                Not run yet. This is a closer look than the free check above —
                worth it before a job with photos that are hard to judge from
                a quick glance.
              </p>
            )
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
                    placeholder="Gutter guards"
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
                      aria-label="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <input
                  value={a.detail || ""}
                  onChange={(e) => update(i, { detail: e.target.value })}
                  disabled={locked}
                  placeholder="Why it's worth having — one line"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-70"
                />

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={a.taxable !== false}
                    onChange={(e) => update(i, { taxable: e.target.checked })}
                    disabled={locked}
                  />
                  Taxable
                </label>

                {fromTakeoff && (
                  <p className="text-xs text-muted-foreground">
                    Marked optional in the takeoff. Edit it there — this row is
                    rebuilt from the scope every time the quote is saved.
                  </p>
                )}

                {a.selected && (
                  <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                    <Check size={12} /> The client added this
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
