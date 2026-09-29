// app/(marketing)/industries/[slug]/showcase/LiveAddress.js
//
// Step 1's "try it on a real house" panel: the one control on the showcase
// that makes a request, and only when the visitor asks for it.
//
// ══ Zero calls until asked ═════════════════════════════════════════════════
//
// The address box is the product's own AddressAutocomplete (Places, the
// picker the real instant quote uses for a job address), and it loads the
// Maps script the moment it mounts — so it is not mounted until the visitor
// presses "Use a real address". The sample section renders fully, and
// check:roofing-example's Chrome pass proves it makes no Google request and
// no /api/ call, on a page where nobody pressed it.
//
// ══ Then one call per house, and never a price over the wire ══════════════
//
// A picked address goes to POST /api/showcase/roof-measure (./liveMeasure.js),
// which answers with the house — roof, jurisdiction, tax — or a reason. The
// price is the sample company's preset run through ./roofingRun.js in this
// tab, as for the sample; the browser never sends or receives an amount.
// A picked address abroad is refused here, before the call; the server
// refuses it again from its own geocode.
//
// Why a panel ABOVE the homeowner's form rather than its own address box:
// the form is the real InstantQuoteFlow, whose sample mode fixes the
// address, and the product's form is not this page's to change. The house
// measured here becomes that form's address (the form is re-seeded with it),
// so the visitor still sees the real form on their house.
"use client";

import { useState } from "react";
import { MapPin, RotateCcw } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { fetchJson } from "@/lib/fetchJson";
import { fixtureForHouse, fixtureWithSquares, cleanSquares, MANUAL_SQUARES } from "./houseFixture";

const MEASURE_URL = "/api/showcase/roof-measure";
const LIVE_COUNTRIES = ["CA", "US"];

// Reasons after which typing the size is offered: the address can't be
// measured, but pricing a size costs nothing. After a limit the sentence
// itself says what to do (keep the sample), so nothing else is offered.
const TYPE_INSTEAD = new Set(["outside", "not_found", "no_roof_coverage", "unavailable"]);

const REASON_COPY = {
  outside: "liveOutside",
  not_found: "liveNotFound",
  no_roof_coverage: "liveNoRoof",
  capped: "liveCapped",
  daily_limit: "liveDailyLimit",
  rate_limited: "liveRateLimited",
};

function fill(template, values) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) => (values[k] == null ? "" : String(values[k])));
}

const buttonClass =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-full border border-border bg-background text-sm font-semibold text-foreground hover:border-foreground/40 disabled:opacity-60";

/**
 * @param base     the sample fixture (buildRoofingShowcase)
 * @param active   the fixture on show — base, or one this panel produced
 * @param onUse    (fixture | null) — null goes back to the sample
 */
export default function LiveAddress({ base, active, onUse, copy }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  // { reason, house } — why the last address was not measured.
  const [outcome, setOutcome] = useState(null);
  const [squares, setSquares] = useState("");
  const [squaresErr, setSquaresErr] = useState("");

  const live = active?.live || null;

  async function measure(e) {
    e.preventDefault();
    if (!picked || busy) return;
    setOutcome(null);
    setSquaresErr("");
    if (picked.country && !LIVE_COUNTRIES.includes(picked.country)) {
      setOutcome({ reason: "outside", house: null });
      return;
    }
    setBusy(true);
    try {
      const res = await fetchJson(MEASURE_URL, { method: "POST", body: { address: picked.address, country: picked.country || null } });
      const next = res?.ok ? fixtureForHouse(base, res.house) : null;
      if (next?.measurement) onUse(next);
      else setOutcome({ reason: "unavailable", house: null });
    } catch (err) {
      const reason = err?.data?.reason || "unavailable";
      const known = Boolean(REASON_COPY[reason]) || TYPE_INSTEAD.has(reason);
      setOutcome({ reason: known ? reason : "unavailable", house: err?.data?.house || null });
    } finally {
      setBusy(false);
    }
  }

  function priceSquares(e) {
    e.preventDefault();
    const sq = cleanSquares(squares);
    if (sq == null) {
      setSquaresErr(fill(copy.liveSquaresInvalid, MANUAL_SQUARES));
      return;
    }
    setSquaresErr("");
    // Google placed the house but had no roof model: the house's own
    // jurisdiction and still, at the typed size. Otherwise the sample house.
    const where = outcome?.reason === "no_roof_coverage" && outcome.house ? fixtureForHouse(base, outcome.house) : null;
    const next = fixtureWithSquares(where || base, sq);
    if (next) onUse(next);
  }

  function backToSample() {
    onUse(null);
    setOutcome(null);
    setSquares("");
    setSquaresErr("");
  }

  const message = outcome ? copy[REASON_COPY[outcome.reason] || "liveUnavailable"] : "";
  const showing =
    live?.kind === "measured"
      ? fill(copy.liveShowingMeasured, {
          address: live.address,
          squares: active.measurement.squares,
          pitch: active.measurement.predominantPitch ? `${active.measurement.predominantPitch.rise}/12` : "—",
          currency: active.company.currency,
        })
      : live?.kind === "typed"
        ? fill(copy.liveShowingTyped, { squares: live.squares })
        : "";

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5" data-showcase-live={live?.kind || "sample"}>
      <p className="font-semibold text-foreground flex items-center gap-1.5">
        <MapPin size={16} aria-hidden="true" /> {copy.liveTitle}
      </p>
      <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{copy.liveBody}</p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`mt-3 ${buttonClass}`} data-live-open>
          {copy.liveCta}
        </button>
      ) : (
        <form onSubmit={measure} className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-end" data-live-form>
          <label className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{copy.liveAddressLabel}</span>
            <AddressAutocomplete
              value={text}
              onChange={(v) => {
                setText(v);
                // A typed change is a different address than the one picked.
                setPicked(null);
              }}
              onPlaceSelected={(place) => {
                setText(place.address);
                setPicked({ address: place.address, country: place.country || null });
              }}
              placeholder={copy.livePlaceholder}
              className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button type="submit" disabled={!picked || busy} className={buttonClass} data-live-measure>
            {busy ? copy.liveMeasuring : copy.liveMeasure}
          </button>
        </form>
      )}
      {open && !picked && text.trim().length > 3 && <p className="mt-2 text-xs text-muted-foreground">{copy.livePickHint}</p>}
      {open && <p className="mt-2 text-xs text-muted-foreground">{copy.livePrivacy}</p>}

      <div aria-live="polite">
        {message && (
          <p className="mt-3 text-sm text-foreground" data-live-reason={outcome.reason}>
            {message}
          </p>
        )}
        {showing && (
          <p className="mt-3 text-sm font-semibold text-foreground" data-live-showing={live.kind}>
            {showing}
            {live.kind === "measured" && !live.trustworthy ? ` ${copy.liveUntrusted}` : ""}
          </p>
        )}
      </div>

      {outcome && TYPE_INSTEAD.has(outcome.reason) && (
        <form onSubmit={priceSquares} noValidate className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-end" data-live-squares>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{copy.liveSquaresLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              min={MANUAL_SQUARES.min}
              max={MANUAL_SQUARES.max}
              step="0.1"
              value={squares}
              onChange={(e) => setSquares(e.target.value)}
              className="w-40 min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button type="submit" className={buttonClass}>
            {copy.liveUseSquares}
          </button>
        </form>
      )}
      {squaresErr && <p className="mt-2 text-sm text-foreground" role="alert">{squaresErr}</p>}

      {live && (
        <button type="button" onClick={backToSample} className={`mt-3 ${buttonClass}`} data-live-back>
          <RotateCcw size={14} aria-hidden="true" /> {copy.liveBackToSample}
        </button>
      )}
    </div>
  );
}
