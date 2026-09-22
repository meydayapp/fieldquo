// app/components/quotes/builder/JobAddressField.js
//
// "Job address" on the quote — where the work is, as distinct from where the
// client lives (Quote.siteAddress; the owner's note on the document-shaped
// builder, 2026-09-21).
//
// Prefilled from a homeowner's own address the moment they are picked, so
// the common case costs nothing; blank and REQUIRED for a company client —
// a general contractor's office is never the site, and the quote used to
// pass it through to the document, the satellite measure and the job anyway.
// Editable on a create and on an edit alike: a wrong address on a sent quote
// is exactly the thing an edit is for, and PATCH /api/quotes/[id] takes it.
//
// Places autocomplete, like every other address box in the product, so the
// string that reaches Job.siteAddress geocodes to a parcel rather than to
// whatever the geocoder makes of an abbreviation.
"use client";

import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { useTranslation } from "@/app/hooks/useTranslation";
import { siteAddressRequired } from "@/lib/quotes/jobAddress";

export default function JobAddressField({ client, value, onChange, error = "" }) {
  const { t } = useTranslation();
  if (!client) return null;
  const required = siteAddressRequired(client);
  return (
    <div className="bg-card border border-border rounded-xl p-5" data-job-address-field>
      <label htmlFor="quote-site-address" className="block font-semibold text-foreground mb-1">
        {t("app.quoteNew.jobAddress", "Job address")}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <p className="text-xs text-muted-foreground mb-2">
        {required
          ? t("app.quoteNew.jobAddressCompanyHint", "A company client's address is their office — enter where this job is.")
          : t("app.quoteNew.jobAddressHint", "Where the work is. Filled from the client's address; change it if the job is somewhere else.")}
      </p>
      <AddressAutocomplete
        value={value}
        onChange={onChange}
        // address-jurisdiction: none — ONE string (Quote.siteAddress); the tax
        // ladder reads the province back out of the formatted line
        // (lib/tax/addressRegion.js), so older quotes answer the same way.
        // And it DOES decide the tax: real-property services are taxed where
        // the property is, so this answers before the client's own record
        // (lib/tax/documentTax.js placeOfSupply).
        onPlaceSelected={(p) => onChange(p?.address || value)}
        placeholder={t("app.quoteNew.jobAddressPlaceholder", "Start typing the job address…")}
        required={required}
        className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
      />
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
