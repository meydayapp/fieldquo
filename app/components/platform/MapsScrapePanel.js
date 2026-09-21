"use client";

// app/components/platform/MapsScrapePanel.js
//
// Two pieces of the same feature, on /platform/sales/prospects:
//
//   MapsScrapePanel  — what the Google Maps scrape has landed in the
//                      database: the last run (rows, matched, unmatched,
//                      first and last write), the runs before it, the rows
//                      that recorded no run id, and the $0 meter.
//   MapsListingCard  — on one prospect: the listing(s) the rule attached to
//                      it, stated read-only, or the sentence that says none
//                      has yet.
//
// ══ What this replaced, and why there is no button ════════════════════════
//
// This file was GooglePlacesPanel.js: the Places API's counters, the
// per-rep hourly window, and "Check Google" on every prospect. The API was
// retired on 2026-09-20 under the owner's rule that Google data is read
// from his Mac by scripts/scrape/maps.mjs — "API keys never involved" — and
// by then it had been refused on every request for two days
// (lib/sales/intel/places.js's header). A scrape is started by a person at
// that machine; nothing in production can start one, so nothing here
// offers to. A panel that only reads is honest; a button that cannot do
// the thing is not (AGENTS.md, "the rule that matters most").
//
// ══ What this can and cannot show ═════════════════════════════════════════
//
// Only what is IN the database. The run's own log — events, the summary
// with placesOpened / tilesSaturated / parseFailures, the tiles walked —
// is written under ~/Library/Application Support/fieldquo-scrape on the
// Mac (scripts/scrape/lib/log.mjs) and production cannot read a laptop.
// What reaches the database is one ExternalListing row per place read and
// one PlatformCostDaily row per day (lib/sales/intel/listings.js
// applyListing and meterLocalScrape), and those are what
// lib/sales/intel/mapsScrapeStatus.js counts. So "rows" here is rows
// written, not places opened.
//
// Every fetch goes through fetchJson so a refused or failed call is a
// sentence on the screen, never a panel that appeared to load.
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, MapPin, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { askedSentence, promotionSentence, runSentence, stamp } from "@/lib/sales/intel/mapsScrapeSentences";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
/** The same sentence lib/sales/intel/mapsScrapeStatus.js sends as
 *  `nextSweep` — repeated here, not imported, because that module reaches
 *  the database client and this is a browser component. The check asserts
 *  the two strings are equal, so they cannot drift. Printed before the
 *  status loads and beside it after, because it is true either way. */
const NEXT_SWEEP = "The next sweep runs from the owner's Mac (scripts/scrape/maps.mjs); nothing here calls Google.";

// The sentences are in lib/sales/intel/mapsScrapeSentences.js — pure, so
// the check executes them and this browser component never imports the
// database client. `runSentence` is re-exported for the retired-Places check.
export { runSentence };

export default function MapsScrapePanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setStatus(await fetchJson("/api/platform/sales/prospects/maps-scrape"));
    } catch (err) {
      setError(err?.message || "Could not read what the Maps scrape landed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className={CARD} aria-labelledby="maps-scrape-heading">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="shrink-0" />
          <h2 id="maps-scrape-heading" className="text-base font-semibold text-foreground">
            Google Maps — read from the owner&apos;s Mac
          </h2>
        </div>
        <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={load} disabled={busy}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error ? (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      {!status && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Reading the listings…
        </p>
      ) : null}

      {!status ? <p className="text-sm text-muted-foreground">{NEXT_SWEEP}</p> : null}

      {status ? (
        <>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">Last run</h3>
            {status.latestRun ? (
              <>
                <p className="text-sm text-foreground break-words">
                  <code className="text-xs">{status.latestRun.runId}</code> · {runSentence(status.latestRun)}
                </p>
                <p className={`text-sm break-words ${status.latestRun.asked ? "text-foreground" : "text-muted-foreground"}`}>{askedSentence(status.latestRun)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No run has recorded its id yet — the rows below are from runs before the scrape wrote one (fixed 2026-09-20 in
                lib/sales/intel/listings.js; the next run will appear here).
              </p>
            )}
          </div>

          {status.runs.length > 1 ? (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                Earlier runs{status.runCount > status.runs.length ? ` (${status.runs.length} of ${status.runCount})` : ""}
              </h3>
              <ul className="space-y-1 text-sm">
                {status.runs.slice(1).map((r) => (
                  <li key={r.runId} className="text-foreground break-words">
                    <code className="text-xs">{r.runId}</code> · {runSentence(r)}
                    {r.asked ? <span className="block text-xs text-muted-foreground">{askedSentence(r)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status.untagged ? (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">Rows with no run id</h3>
              <p className="text-sm text-foreground break-words">{runSentence(status.untagged)}</p>
              <p className="text-xs text-muted-foreground">
                The first runs did not record which run wrote a row; these are theirs, counted as one bucket rather than
                attributed to a run they never named.
              </p>
            </div>
          ) : null}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">All runs</dt>
              <dd className="text-foreground">
                {status.total.rows.toLocaleString()} listings · {status.total.matched.toLocaleString()} matched a prospect ·{" "}
                {status.total.unmatched.toLocaleString()} unmatched (kept for a later ingest)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Unmatched listings → prospects</dt>
              <dd className="text-foreground">
                {promotionSentence(status.promotion)} · an open listing with a phone that matched no register row becomes a
                prospect in the review folder with its crawl queued, at the end of every sweep and on{" "}
                <code className="text-xs">maps.mjs --promote --apply</code> from the owner&apos;s Mac
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Metered at $0</dt>
              <dd className="text-foreground">
                {status.metered.places.toLocaleString()} places over {status.metered.days} day{status.metered.days === 1 ? "" : "s"} · last
                metered {stamp(status.metered.lastAt)} · the same fields the Places API charged US$35 per 1,000 for
              </dd>
            </div>
          </dl>

          <p className="text-sm text-muted-foreground">{status.nextSweep || NEXT_SWEEP}</p>
        </>
      ) : null}
    </section>
  );
}

function Beside({ label, record, listing }) {
  const same = record && listing && String(record).toLowerCase() === String(listing).toLowerCase();
  return (
    <li className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">
        Record: {record || <em className="text-muted-foreground">none</em>}
      </span>
      <span className={`text-sm break-all ${same ? "text-muted-foreground" : "text-foreground"}`}>
        Listing: {listing || <em className="text-muted-foreground">none</em>}
        {same ? " — the same" : ""}
      </span>
    </li>
  );
}

/**
 * One prospect's matched Maps listing(s), stated. No control: a match is
 * made when the owner's Mac runs the scrape and the rule accepts a listing
 * (lib/sales/intel/listings.js), and a person at the console cannot make
 * that happen from here.
 */
export function MapsListingCard({ prospect }) {
  const listings = Array.isArray(prospect?.mapsListings) ? prospect.mapsListings : [];
  const result = prospect?.places?.result && typeof prospect.places.result === "object" ? prospect.places.result : null;
  const confirmations = Array.isArray(result?.confirmations) ? result.confirmations : [];

  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-foreground">Google Maps listing</h2>

      {listings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Maps listing matched yet — matched when the owner&apos;s Mac runs the scrape (scripts/scrape/maps.mjs) and the
          rule accepts a listing for this business. Nothing here calls Google.
        </p>
      ) : (
        <>
          {confirmations.length ? (
            <ul className="list-disc pl-5 text-sm text-foreground space-y-0.5">
              {confirmations.map((c) => (
                <li key={c.code} className={c.state === "closed" || c.state === "differs" ? "font-semibold" : ""}>
                  {c.text}
                </li>
              ))}
            </ul>
          ) : null}
          {listings.map((l) => (
            <div key={l.id} className="space-y-2">
              <p className="text-sm text-foreground break-words">
                Matched {stamp(l.matchedAt)}
                {l.runId ? (
                  <>
                    {" "}· run <code className="text-xs">{l.runId}</code>
                  </>
                ) : (
                  " · run id not recorded (a run before 2026-09-20)"
                )}
                {l.lastSeenAt ? ` · last seen ${stamp(l.lastSeenAt)}` : ""}
                {l.matchVerdict === "matched_verify"
                  ? " · attached on the phone or website alone — the name differs; confirm on the call"
                  : l.matchVerdict && l.matchVerdict !== "matched"
                    ? ` · ${l.matchVerdict}`
                    : ""}
              </p>
              <ul className="space-y-2">
                <Beside label="Name" record={prospect.businessName} listing={l.name} />
                <Beside
                  label="Address"
                  record={prospect.addressLine ? `${prospect.addressLine}, ${prospect.city || ""}` : prospect.city}
                  listing={[l.addressLine, l.city, l.province, l.postalCode].filter(Boolean).join(", ") || null}
                />
                <Beside label="Website" record={prospect.websiteUrl || prospect.domain} listing={l.websiteUrl} />
                <Beside label="Phone" record={prospect.phoneE164} listing={l.phoneE164} />
                <Beside
                  label="Rating"
                  record={prospect.rating != null ? `${prospect.rating} (${prospect.reviewCount ?? "?"} reviews)` : null}
                  listing={l.rating != null ? `${l.rating} (${l.reviewCount ?? "?"} reviews)` : null}
                />
                <Beside label="Trading status" record={prospect.businessStatus} listing={l.businessStatus} />
              </ul>
              {l.mapsUrl ? (
                <a href={l.mapsUrl} target="_blank" rel="noreferrer" className="text-sm underline text-foreground break-all">
                  Open the listing on Google Maps
                </a>
              ) : null}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
