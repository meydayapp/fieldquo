"use client";

// app/components/platform/GooglePlacesPanel.js
//
// Two pieces of the same feature, on /platform/sales/prospects:
//
//   GooglePlacesPanel  — the counters at the top of the list: how many held
//                        rows are unchecked, what the checks so far said,
//                        this month's requests and spend, the standing job's
//                        per-rep hourly window ("Google check: 25/25 this
//                        hour for Favor · next window 23:00"), the pool's
//                        size with its projected cost (reported, never run
//                        from here), and one button: check the held leads.
//   GooglePlacesCard   — on one prospect: what Google said beside what the
//                        record says, the verdict, the confirmations in
//                        words, and "Check Google" (force: a re-ask inside
//                        the 90-day window is a deliberate act).
//
// Both read /api/platform/sales/prospects/enrich. Superadmin only — the
// page mounts them behind the same role the assign bar uses, and the route
// refuses everybody else regardless.
//
// Every fetch goes through fetchJson so a refused or failed call is a
// sentence on the screen, never a button that appeared to work.
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, MapPin, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

function dollars(cents) {
  return `US$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function clock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** The sentence a batch report reads as. */
export function reportSentence(r) {
  if (!r) return "";
  if (r.refused === "confirm_required") return r.message || "Refused: confirmation required.";
  const bits = [
    `${r.checked} checked`,
    `${r.matched} matched`,
    `${r.noConfidentMatch} unconfirmed`,
    `${r.noResults} not found`,
    `${r.closedPermanently} permanently closed`,
    `${r.websitesGained} gained a website`,
    `${r.phonesGained} gained a phone`,
    `${r.skipped} skipped (checked in the last ${r.recheckDays || 90} days)`,
    `${r.requests} requests ≈ ${dollars(r.costCents)} at list price`,
  ];
  if (r.errors) bits.push(`${r.errors} error${r.errors === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

export default function GooglePlacesPanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setStatus(await fetchJson("/api/platform/sales/prospects/enrich"));
    } catch (err) {
      setError(err?.message || "Could not read the Google Places counters.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function checkHeld() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const r = await fetchJson("/api/platform/sales/prospects/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "held" }),
      });
      setReport(r);
      await load();
    } catch (err) {
      setError(err?.message || "The check did not run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD} aria-labelledby="google-places-heading">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="shrink-0" />
          <h2 id="google-places-heading" className="text-base font-semibold text-foreground">
            Google Places
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
          <Loader2 className="animate-spin" size={16} /> Reading the counters…
        </p>
      ) : null}

      {status ? (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Held by reps</dt>
              <dd className="text-foreground">
                {status.held.total} · {status.held.unchecked} not checked in {status.recheckDays} days
                {status.held.unchecked ? ` (≈ ${dollars(status.held.projectedCents)})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Checked so far</dt>
              <dd className="text-foreground">
                {status.checked.total} · {status.checked.matched} matched · {status.checked.noConfidentMatch} unconfirmed ·{" "}
                {status.checked.noResults} not found
                {status.checked.duplicatePlace ? ` · ${status.checked.duplicatePlace} duplicate listings` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">This month</dt>
              <dd className="text-foreground">
                {status.month.requests} requests ≈ {dollars(status.month.cents)} at list price ({status.sku}, US$
                {(status.costPerRequestMicros / 10_000 / 100).toFixed(3)} each; first {status.freePerMonth} a month free)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Whole pool — reported, not run</dt>
              <dd className="text-foreground">
                {status.pool.unchecked.toLocaleString()} claimable rows unchecked ≈ {dollars(status.pool.projectedCents)}. Needs the
                owner&apos;s yes; nothing here presses it.
              </dd>
            </div>
          </dl>

          {/* The standing job's window, per rep. */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">Standing job — {status.perRepPerHour} lookups per rep per hour, in queue order</h3>
            {Array.isArray(status.windows) && status.windows.length ? (
              <ul className="space-y-1 text-sm">
                {status.windows.map((w) => (
                  <li key={w.repId} className="text-foreground break-words">
                    Google check: {w.checkedThisHour}/{w.cap} this hour for {w.name} · {w.heldUnchecked} of {w.held} held still to check ·
                    next window {clock(w.nextWindowAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No rep holds a prospect right now, so the job has nothing to do.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground`}
              onClick={checkHeld}
              disabled={busy || !status.held.unchecked}
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
              {status.held.unchecked ? `Check Google for ${status.held.unchecked} held leads` : "Every held lead is checked"}
            </button>
          </div>

          {report ? (
            <div className="rounded-lg border border-border bg-background p-3 text-sm text-foreground space-y-1">
              <p>{reportSentence({ ...report, recheckDays: status.recheckDays })}</p>
              {report.stopped ? (
                <p className="text-red-700 dark:text-red-300">
                  Stopped: {report.stopped.message}. {report.stopped.howToEnable}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

const VERDICT_TEXT = {
  matched: "Matched",
  no_confident_match: "No confident match — a human decides",
  no_results: "No listing found",
  duplicate_place: "This listing is already on another prospect",
  error: "The last check failed",
};

function Beside({ label, record, google }) {
  const same = record && google && String(record).toLowerCase() === String(google).toLowerCase();
  return (
    <li className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">
        Record: {record || <em className="text-muted-foreground">none</em>}
      </span>
      <span className={`text-sm break-all ${same ? "text-muted-foreground" : "text-foreground"}`}>
        Google: {google || <em className="text-muted-foreground">none</em>}
        {same ? " — the same" : ""}
      </span>
    </li>
  );
}

export function GooglePlacesCard({ prospect, onChanged = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);
  const places = prospect?.places || null;
  const result = places?.result || null;

  async function check() {
    setBusy(true);
    setError("");
    setLast(null);
    try {
      const r = await fetchJson("/api/platform/sales/prospects/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [prospect.id], force: true }),
      });
      setLast(r);
      if (typeof onChanged === "function") onChanged();
    } catch (err) {
      setError(err?.message || "The check did not run.");
    } finally {
      setBusy(false);
    }
  }

  const row = last?.rows?.[0] || null;

  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-foreground">Google Places</h2>
        <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={check} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />}
          {places?.checkedAt ? "Check Google again" : "Check Google"}
        </button>
      </div>

      {error ? (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
      {row?.outcome === "error" ? (
        <p className="text-sm text-red-700 dark:text-red-300">
          {row.message}
          {last?.stopped?.howToEnable ? ` ${last.stopped.howToEnable}` : ""}
        </p>
      ) : null}

      {!places?.checkedAt ? (
        <p className="text-sm text-muted-foreground">
          Not yet checked against Google. The standing job reaches held rows at 25 an hour per rep; this button asks now.
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground">
            {VERDICT_TEXT[places.verdict] || places.verdict} · checked {new Date(places.checkedAt).toISOString().slice(0, 10)}
            {result?.score?.nameOverlap != null
              ? ` · name overlap ${Math.round(result.score.nameOverlap * 100)}% · place signals: ${
                  (result.score.placeSignals || []).join(", ") || "none"
                }`
              : ""}
          </p>

          {places.verdict === "matched" || places.verdict === "duplicate_place" ? (
            <>
              {Array.isArray(result?.confirmations) && result.confirmations.length ? (
                <ul className="list-disc pl-5 text-sm text-foreground space-y-0.5">
                  {result.confirmations.map((c) => (
                    <li key={c.code} className={c.state === "closed" || c.state === "differs" ? "font-semibold" : ""}>
                      {c.text}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="space-y-2">
                <Beside label="Name" record={prospect.businessName} google={result?.name} />
                <Beside label="Address" record={prospect.addressLine ? `${prospect.addressLine}, ${prospect.city || ""}` : prospect.city} google={result?.address} />
                <Beside label="Website" record={prospect.websiteUrl || prospect.domain} google={result?.websiteUri} />
                <Beside label="Phone" record={prospect.phoneE164} google={result?.phone} />
                <Beside
                  label="Rating"
                  record={prospect.rating != null ? `${prospect.rating} (${prospect.reviewCount ?? "?"} reviews)` : null}
                  google={result?.rating != null ? `${result.rating} (${result.userRatingCount ?? "?"} reviews)` : null}
                />
                <Beside label="Trading status" record={prospect.businessStatus} google={result?.businessStatus} />
              </ul>
              {Array.isArray(result?.hours) && result.hours.length ? (
                <div>
                  <span className="text-xs text-muted-foreground">Hours on Google</span>
                  <ul className="text-sm text-foreground">
                    {result.hours.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result?.mapsUrl ? (
                <a href={result.mapsUrl} target="_blank" rel="noreferrer" className="text-sm underline text-foreground break-all">
                  Open the listing on Google Maps
                </a>
              ) : null}
              {places.verdict === "duplicate_place" && result?.duplicateOfProspectId ? (
                <p className="text-sm text-foreground">
                  Prospect {result.duplicateOfProspectId} already carries this Place ID. Nothing was filled here; the Review folder decides
                  the merge.
                </p>
              ) : null}
            </>
          ) : null}

          {places.verdict === "no_confident_match" && result?.candidate ? (
            <div className="text-sm text-foreground space-y-1">
              <p>
                Top result: <strong>{result.candidate.name}</strong> — {result.candidate.address}
              </p>
              <p className="text-muted-foreground">
                Refused because: {result.candidate.reason} (name overlap {Math.round((result.candidate.nameOverlap || 0) * 100)}%,
                place signals: {(result.candidate.placeSignals || []).join(", ") || "none"}). Nothing was attached; a person confirms
                this by hand.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
