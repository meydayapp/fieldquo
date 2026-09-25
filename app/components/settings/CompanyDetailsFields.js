// app/components/settings/CompanyDetailsFields.js
//
// The "Company details" fields of Settings > Company — name, phone, email,
// website, the subdomain note, the address with autocomplete, the four
// address parts and the map — as one component, because the home page's
// "Complete your business address and phone" dialog renders the same fields
// (app/components/dashboard/stepPanels.js). The page and the dialog hold
// their own `form` and their own save; this is the markup and the field
// wiring, identical in both, so a phone typed in either place is the same
// field going to the same column.
//
// Controlled from outside on purpose: the page's form carries forty fields
// and one PATCH, and the dialog's carries these eleven and a partial PATCH
// (the route accepts either — app/api/settings/business-info). Owning state
// here would force the two to agree on a form shape they have no reason to
// share.
"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import MiniMap from "@/app/components/MiniMap";
import { useTranslation } from "@/app/hooks/useTranslation";

export const COMPANY_DETAILS_INPUT_CLASS =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const WEBSITE_PLACEHOLDER = "https://yourcompany.com";

/** The fields this component edits — what a partial PATCH should carry. */
export const COMPANY_DETAILS_FIELDS = [
  "name",
  "phone",
  "email",
  "website",
  "address",
  "city",
  "province",
  "postalCode",
  "country",
  "latitude",
  "longitude",
];

/**
 * @param {object} props
 * @param {object} props.form — holds at least COMPANY_DETAILS_FIELDS
 * @param {(field: string, value: any) => void} props.set
 * @param {(place: object) => void} props.onPlaceSelected — Google Places pick
 * @param {string} [props.slug] — the company's subdomain, for the note
 * @param {string} [props.inputClass]
 */
export default function CompanyDetailsFields({
  form,
  set,
  onPlaceSelected,
  slug = "",
  inputClass = COMPANY_DETAILS_INPUT_CLASS,
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.companyName")}
          </label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.phoneNumber")}
          </label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.emailAddress")}
          </label>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.websiteUrl")}
          </label>
          <input
            className={inputClass}
            placeholder={WEBSITE_PLACEHOLDER}
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </div>
      </div>

      {/* Auto-hosted subdomain.
          The toggle is GONE, not disabled-looking-enabled. There is no
          /site route, no page renderer and no hostname handling in
          middleware — nothing is served at this address by anything.
          Leaving a switch here let a company turn it on, see "Currently
          published", and believe they had a website. The platform console
          then repeated the claim back to FieldQuo staff.
          Restore the toggle in the same commit that makes the address
          resolve, not before. */}
      <div className="flex items-start gap-2.5 bg-muted border border-border rounded-lg px-4 py-3">
        <Globe size={16} className="text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-medium text-foreground">
            {slug
              ? `${slug}.fieldquo.com`
              : t("app.setCompany.yourSubdomain")}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("app.setCompany.subdomainHint")}{" "}
            <Link href="/app/settings/website" className="underline">
              {t("app.settings.website")}
            </Link>
            .
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground block mb-1">
          {t("app.setCompany.streetAddress")}
        </label>
        <AddressAutocomplete
          value={form.address}
          onChange={(v) => set("address", v)}
          // address-jurisdiction: forwarded — this component chooses nothing.
          // The whole place object goes to the caller's `onPlaceSelected`
          // (Settings > Company, and the home page's business-info dialog),
          // which is where city, province and country are kept — and checked.
          onPlaceSelected={onPlaceSelected}
          placeholder={t("app.setCompany.addressPlaceholder")}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.field.city")}
          </label>
          <input
            className={inputClass}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.field.province")}
          </label>
          <input
            className={inputClass}
            value={form.province}
            onChange={(e) => set("province", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.postalCode")}
          </label>
          <input
            className={inputClass}
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.country")}
          </label>
          <input
            className={inputClass}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </div>
      </div>

      <MiniMap lat={form.latitude} lng={form.longitude} />
    </>
  );
}
