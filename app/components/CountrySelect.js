"use client";

// app/components/CountrySelect.js
//
// Which country a client is in — the field that lets lib/tax/jurisdictions.js
// answer at all.
//
// ── Why a picker and not a text box ────────────────────────────────────────
//
// The tax lookup keys on an ISO-3166 alpha-2 code. A text box collects
// "Canada", "canada", "CAN" and "Ca" in about equal measure, and every one of
// those normalises to null, which puts the contractor in front of a "no
// country set" message on a field they just filled in. A picker cannot produce
// a value the resolver will reject.
//
// ── The blank option is a real answer ──────────────────────────────────────
//
// "Not set" is first and is the default, because every client row created
// before this field existed genuinely has no country and the form must be able
// to show that truthfully. It is NOT pre-selected to the company's own country:
// that would be the app answering a question about the client on the
// contractor's behalf, and the answer would be stored as though someone had
// said it.
//
// ── Why the list is short ──────────────────────────────────────────────────
//
// Only countries lib/tax/jurisdictions.js holds rates for. Offering all 195
// would let someone pick Japan and then wonder why no rate appeared; a country
// missing from this list is a country FieldQuo has nothing to say about, and
// the list saying so is the honest version.

import { supportedCountryOptions } from "@/lib/tax/jurisdictions";
import { useTranslation } from "@/app/hooks/useTranslation";

const OPTIONS = supportedCountryOptions();

export default function CountrySelect({
  value,
  onChange,
  className = "",
  id,
  label = true,
}) {
  const { t } = useTranslation();

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-foreground block mb-1"
        >
          {t("app.field.country")}
        </label>
      )}
      <select
        id={id}
        className={className}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("app.field.countryNotSet")}</option>
        {OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
