// app/app/estimate-reviews/page.js
//
// The queue of instant estimates awaiting sign-off. Each card shows what the
// homeowner saw — the satellite image, the measurements, the range — and the
// figure that will stick. Approving clears the review flag so the quote can be
// opened, edited and sent like any other; the "Open quote" link is where real
// editing happens, this page is just the gate.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, BadgeCheck, ExternalLink, Play } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { jsonBody } from "@/lib/jsonBody";

import { useTranslation } from "@/app/hooks/useTranslation";
import {
  useCompanyMoney,
  useCompanyPreferences,
} from "@/app/providers/CompanyPreferencesProvider";

// ── Where the estimate came from ──────────────────────────────────────────
//
// Key and English fallback, not finished English. This was a bare map of
// sentences, so a Quebec reviewer read "Measured from satellite" in the middle
// of a French screen — and its fallback was `q.estimateSource`, which put the
// raw column, `google_solar`, in a chip when a build met a source it did not
// know. A snake_case enum reaching a human is the canonical failure this
// codebase is swept for.
//
// `phone_call` is read off a recorded call by FieldQuo AI in the back office,
// after the fact — the receptionist that took the call never quoted anything,
// see lib/ai/callQuoteDraft.js. It gets its own label because the reviewer's
// first question about an unexpected draft is where it came from.
// i18n PENDING — keys requested from the lead in one batch; English literals
// stay until they land, because a t() call on a key that does not exist yet
// turns check:translations red for every other agent in this tree. Keys, in
// order: app.reviews.source.satellite / .lawn / .manual / .phoneCall /
// .unknown. The STRUCTURE is the fix and is already correct: a map plus an
// unknown branch, so `google_solar` can no longer reach a chip.
//
// `phone_call` is read off a recorded call by FieldQuo AI in the back office,
// after the fact — the receptionist that took the call never quoted anything,
// see lib/ai/callQuoteDraft.js. It gets its own label because the reviewer's
// first question about an unexpected draft is where it came from.
const SOURCE_LABEL = {
  google_solar: "Measured from satellite",
  lawn_polygon: "Lawn traced on map",
  manual: "Homeowner-entered",
  phone_call: "Taken from a phone call",
};

/**
 * The chip's words.
 *
 * The bug this closes is the FALLBACK, not the map: this was
 * `SOURCE_LABEL[q.estimateSource] || q.estimateSource`, so any source a build
 * did not know printed the raw snake_case column in a chip — a reviewer read
 * `google_solar`. An unknown source now says it is unknown, which is a
 * sentence; the column never is.
 */
function sourceLabel(source) {
  return SOURCE_LABEL[source] || "Source not recorded";
}

export default function EstimateReviewsPage() {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const data = await fetchJson("/api/quotes/estimate-reviews");
      setQuotes(data.quotes);
      setCanApprove(Boolean(data.canApprove));
      setCurrentUserId(data.currentUserId || null);
    } catch (err) {
      setError(err.message || "Could not load reviews."); // i18n PENDING app.reviews.loadError
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(q, adjusted) {
    setBusyId(q.id);
    try {
      await fetchJson(`/api/quotes/${q.id}/approve-estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(adjusted != null ? { total: adjusted } : {}, "estimate approval"),
      });
      await load();
    } catch (err) {
      showError(err.message || "Could not approve that estimate."); // i18n PENDING app.reviews.approveError
    } finally {
      setBusyId(null);
    }
  }

  // Nobody was signed in when the instant-quote flow created this draft — see
  // createEstimateDraft — so it always lands here unassigned. Claiming it is
  // the one reassignment that never needs quote:assign (you're naming
  // yourself, not somebody else), so this is safe for anyone who can see the
  // queue at all.
  async function assignToMe(q) {
    setBusyId(q.id);
    try {
      await fetchJson(`/api/quotes/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ assignedToId: currentUserId }, "self-assign"),
      });
      await load();
    } catch (err) {
      showError(err.message || "Could not assign that estimate."); // i18n PENDING app.reviews.assignError
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div data-tour="reviews-header" className="flex items-center gap-2 mb-1">
        <BadgeCheck size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{t("app.reviews.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        {/* i18n PENDING app.reviews.intro */}
        Instant estimates from your website land here first. Confirm the price —
        adjusting it if the property needs it — before the quote can be sent.
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">{error}</p>
      )}

      {!quotes && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading… {/* i18n PENDING app.action.loading */}
        </div>
      )}

      {quotes && quotes.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("app.reviews.empty")}
        </div>
      )}

      <div className="space-y-4">
        {quotes?.map((q) => (
          <ReviewCard
            key={q.id}
            q={q}
            canApprove={canApprove}
            busy={busyId === q.id}
            onApprove={approve}
            onAssignToMe={assignToMe}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ q, canApprove, busy, onApprove, onAssignToMe, currentUserId }) {
  const { t } = useTranslation();
  // The company's own currency. This page formatted every figure as
  // `"$" + Math.round(...)`, so a GBP contractor read dollars on the screen
  // where they sign a price off — and the literal "$" concatenation is
  // invisible to check:app-currency, which is how it outlived a sweep of 114
  // hardcoded ones.
  const money = useCompanyMoney();
  const { currency } = useCompanyPreferences();
  const d = q.estimateData || {};
  const m = d.measurement || {};
  const range = d.range || {};
  // ── The rounding that silently changed the price ────────────────────────
  //
  // This was `useState(Math.round(Number(q.total) || 0))`. A reviewer who
  // opened the queue and pressed Approve without touching the field wrote the
  // ROUNDED figure back to the quote: a $6,750.40 estimate was approved at
  // $6,750. Nothing on the screen said so, and this page's own header calls
  // this "the figure that will stick."
  //
  // Held as a string so a decimal can be typed through — a numeric state
  // discards the "." the moment it is entered and the field fights the person
  // using it. `q.total` of 0 is a real figure and must show; only an absent
  // one is blank, which is why this asks about null rather than truthiness.
  const [total, setTotal] = useState(q.total == null ? "" : String(q.total));
  // `pricingHidden` means the API removed `total` and every figure inside
  // estimateData — the range the homeowner saw, the breakdown, the budget they
  // stated. Rendering the block anyway prints "$0–$0" and an Approve control
  // that would submit a price of zero, which is worse than either the boundary
  // or the screen. This queue exists to sign off a number, so when the number
  // is withheld the honest screen is the reason and no controls.
  const pricingHidden = q.pricingHidden === true;

  // What to send. POST .../approve-estimate documents an empty body as
  // "approve at the current total", and that is exactly what an untouched
  // field means — so an unchanged figure is not sent back at all. Round-
  // tripping it would re-write the quote's own total with a value this screen
  // reformatted, which is how the rounding above changed a price nobody
  // intended to change.
  const typed = Number(total);
  const adjusted =
    Number.isFinite(typed) && typed !== Number(q.total) ? typed : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{q.client?.name || "Website enquiry"/* i18n PENDING app.reviews.websiteEnquiry */}</h3>
            <span className="text-xs text-muted-foreground">{q.quoteNumber}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[q.client?.email, q.client?.phone, q.client?.address].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground shrink-0">
          {sourceLabel(q.estimateSource)}
        </span>
      </div>

      {/* Nobody was signed in to name when this draft was created — the
          honest outcome AGENTS.md's "absence of a statement" rule calls for,
          not a guessed default. This queue is where that gets fixed: whoever
          picks it up claims it in one click, with no permission needed since
          naming yourself isn't a staffing decision. */}
      <div className="mt-2">
        {q.assignedTo ? (
          <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {/* i18n PENDING app.reviews.assignedToYou / app.reviews.assignedTo */}
            {q.assignedTo.id === currentUserId
              ? "Assigned to you"
              : `Assigned to ${q.assignedTo.name}`}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAssignToMe(q)}
            disabled={busy || !currentUserId}
            className="text-xs rounded-full border border-dashed border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-50"
          >
            Unassigned — assign to me{/* i18n PENDING app.reviews.claim */}
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-4">
        {m.satelliteImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.satelliteImageUrl} alt={t("app.reviews.property")} className="h-28 w-40 object-cover rounded-lg border border-border shrink-0" />
        )}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {/* i18n PENDING app.reviews.squareCount — a COUNTED NOUN, not "{n} squares" */}
            {m.squares != null && <span><strong className="text-foreground">{m.squares}</strong> squares</span>}
            {/* i18n PENDING app.reviews.areaSqft */}
            {m.areaSqft != null && <span><strong className="text-foreground">{Math.round(m.areaSqft).toLocaleString()}</strong> sq ft</span>}
            {/* i18n PENDING app.reviews.pitch */}
            {m.predominantPitch && <span><strong className="text-foreground">{m.predominantPitch.rise}/12</strong> pitch</span>}
            {/* i18n PENDING app.reviews.tearOffCount — a COUNTED NOUN */}
            {m.tearOffLayers ? <span>{m.tearOffLayers} layer(s) tear-off</span> : null}
          </div>
          {/* The price-book KEY, tidied. Every other consumer of materialKey
              looks it up in the company's configured materials to get a label
              (lib/estimate/instantEstimate.js), and this route does not send
              that list — so the reviewer was reading `architectural_shingle`.
              Underscores out is not the real fix; the real fix is the route
              sending the label, and that is a payload change flagged in the
              report rather than made silently here. */}
          {d.materialKey && (
            <div>
              {t("app.reviews.material")}
              <strong className="text-foreground">
                {String(d.materialKey).replace(/_/g, " ")}
              </strong>
            </div>
          )}
          {!pricingHidden && (
          <div>
            Homeowner saw:{" "}{/* i18n PENDING app.reviews.homeownerSaw */}
            <strong className="text-foreground">{money(range.low)}–{money(range.high)}{d.unit ? ` ${d.unit}` : ""}</strong>
          </div>
          )}
          {/* What they said they could spend, next to what it prices at. The
              over-budget flag is the reviewer's cue to lead with financing on
              the call — computed at capture, from the bands in force that day,
              so a later edit to the thresholds can't rewrite what this lead
              was told. */}
          {d.budget && (
            <div>
              {/* i18n PENDING app.reviews.theirBudget */}
              Their budget: <strong className="text-foreground">{d.budget.label}</strong>
              {d.budget.exceeded && (
                <span className="ml-2 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                  over budget{/* i18n PENDING app.reviews.overBudget */}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {Array.isArray(d.breakdown) && d.breakdown.length > 0 && (
        <ul className="mt-3 text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
          {d.breakdown.map((b, i) => (
            <li key={i} className="flex justify-between">
              <span>{b.label}</span>
              {/* The line survives, the amount does not — same rule the quote
                  builder follows: what the work is stays, what it costs goes. */}
              {!pricingHidden && <span>{money(b.amount)}</span>}
            </li>
          ))}
        </ul>
      )}

      {/* What the call asked for that this price does not include. Rendered
          above the approve button on purpose: approving at a figure that is
          missing the upgrades the caller rang about is the mistake this exists
          to stop, and a caveat below the button is a caveat read afterwards. */}
      {q.reviewNotes && (
        <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {t("app.reviews.reviewNotes")}
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80 whitespace-pre-line">
            {q.reviewNotes}
          </p>
        </div>
      )}

      {/* ── Hearing the call before approving a figure ────────────────────
          The note above says what the caller asked for; this is the caller
          asking. Present only when the quote came off a phone call and the
          recording is still there.

          The href is /api/voice/calls/<id>/recording, not the provider's URL:
          that one is a bearer link and this is a quote screen, one field away
          from the document a homeowner receives. See lib/voice/recording.js. */}
      {q.recordingHref && (
        <a
          href={q.recordingHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-foreground hover:bg-muted"
        >
          <Play size={13} /> {t("app.receptionist.listen")}
        </a>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {pricingHidden ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "app.access.pricingHidden",
              "Pricing is hidden by your access level. Ask an owner or admin if you need to see it.",
            )}
          </p>
        ) : (
          <>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("app.reviews.approveAt")}</span>
          {/* The company's currency code, not a hardcoded "$". A bare dollar
              sign beside the one number on this page that gets written back is
              the last place to guess at a currency. */}
          <span className="text-muted-foreground tabular-nums">{currency}</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            disabled={!canApprove}
            aria-label={t("app.reviews.approveAt")}
            className="w-28 min-h-11 rounded-lg border border-border bg-background px-2 py-1.5 text-base"
          />
        </label>
        <button
          type="button"
          onClick={() => onApprove(q, adjusted)}
          disabled={!canApprove || busy || !(Number(total) > 0)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
          Approve{/* i18n PENDING app.reviews.approve */}
        </button>
          </>
        )}
        <Link
          href={`/app/quotes/${q.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >{t("app.reviews.openQuote")}<ExternalLink size={13} />
        </Link>
        {!canApprove && (
          <span className="text-xs text-muted-foreground">{t("app.reviews.supervisorOnly")}</span>
        )}
      </div>
    </div>
  );
}
