// app/components/quotes/builder/MeasureAddressField.js
//
// The one "measure from this address" field on the builder's three measure
// panels — roofing (Google Solar), paving (the paver designer's still) and
// the landscaping trades (the lot tracer's still).
//
// It used to exist only on the roof panel, because the roof being re-roofed
// is frequently not the address the invoice goes to. That is just as true of
// a driveway and a lawn, and the owner asked for the same field on those —
// through ONE component, not three copies, because the copy is the one that
// rots (the roof panel's original address box is the copy that was replaced).
//
// ── Places, not free text ───────────────────────────────────────────────────
//
// The address typed here is geocoded and, for a roof, handed to Google's
// Solar API, whose whole failure mode is answering confidently about the
// wrong building. A typed string resolves to whatever the geocoder makes of
// it; a picked suggestion is Google's own canonical address, which geocodes
// to a rooftop. So picking a suggestion measures immediately, and the PICKED
// string is what gets measured — not the letters the estimator stopped
// typing, which setValue has not committed by the time place_changed fires.
// Coordinates from Places are deliberately NOT passed through: the routes
// set `precise` from the geocoder's location_type, Places has no such field,
// and the "pin may not be on a building" warning would quietly become a
// guess.
//
// Enter does NOT measure. AddressAutocomplete's capture handler suppresses
// the Enter that CHOOSES a suggestion, and a bubble-phase handler here would
// still fire — measuring the half-typed string underneath. The button and
// the suggestion are the two ways in.
//
// This component owns no network and no takeoff. The panel that renders it
// decides what "measure" means (Solar, or a still) and what to store; this
// is the field, the button, the "use the client's address" way back, and the
// "Measured at …" line once something has been measured.
"use client";

import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { useTranslation } from "@/app/hooks/useTranslation";
import { inputClass } from "./fields";

/**
 * @param {object}   p
 * @param {string}   p.value           the address in the box
 * @param {Function} p.onChange        (address) → void
 * @param {Function} p.onMeasure       (address) → void — the button, or a picked suggestion
 * @param {string}   [p.defaultAddress] the client's address; offered as a way back when the box differs
 * @param {boolean}  [p.busy]
 * @param {string}   [p.measuredAt]    the formatted address the last measurement resolved to
 * @param {string}   [p.error]
 * @param {string}   [p.label]         panel-specific wording; the generic one otherwise
 * @param {string}   [p.placeholder]
 * @param {string}   [p.buttonLabel]
 */
export default function MeasureAddressField({
  value = "",
  onChange,
  onMeasure,
  defaultAddress = "",
  busy = false,
  measuredAt = "",
  error = "",
  label,
  placeholder,
  buttonLabel,
}) {
  const { t } = useTranslation();
  const current = String(value || "");
  const differs = Boolean(defaultAddress) && current.trim() !== String(defaultAddress).trim();

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="text-xs text-muted-foreground">
            {label || t("app.measure.fromAddress", "Measure from an address")}
          </label>
          {/* address-jurisdiction: none — this is WHERE to point the
              satellite, not who to bill. No Client is created and no tax
              jurisdiction is informed; the province and country of the
              job site are not read. */}
          <AddressAutocomplete
            value={current}
            onChange={(next) => onChange?.(next)}
            onPlaceSelected={(place) => {
              const picked = place?.address || "";
              if (!picked) return;
              onChange?.(picked);
              onMeasure?.(picked);
            }}
            placeholder={placeholder || t("app.measure.addressPlaceholder", "Start typing the job address")}
            className={inputClass}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          onClick={() => onMeasure?.(current)}
          disabled={busy || !current.trim()}
          className="shrink-0 rounded border border-border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
        >
          {busy
            ? t("app.measure.measuring", "Measuring…")
            : buttonLabel || t("app.measure.button", "Measure from this address")}
        </button>
      </div>

      {differs && (
        <button
          type="button"
          onClick={() => onChange?.(defaultAddress)}
          className="text-[11px] text-muted-foreground underline"
        >
          {t("app.measure.useClientAddress", "Use the client's address ({address})", {
            address: defaultAddress,
          })}
        </button>
      )}

      {/* Said once something has been measured, in the geocoder's own
          spelling of the address — which is what the document will print
          (lib/measure/measureImages.js measureEvidence), so the estimator
          sees the exact line the client will. */}
      {measuredAt && (
        <p className="text-[11px] text-muted-foreground">
          {t("app.measure.measuredAt", "Measured at {address}", { address: measuredAt })}
        </p>
      )}

      {error && <p className="text-xs text-muted-foreground">{error}</p>}
    </div>
  );
}
