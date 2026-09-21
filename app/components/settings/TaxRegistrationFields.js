// app/components/settings/TaxRegistrationFields.js
//
// The tax-registration half of Settings > Company's tax card — the
// registration's own name, the number labelled the way the company's country
// labels it, the one-sentence why, and the "I don't have one" statement — as
// a component, because the home page's "Add your tax registration number"
// dialog renders the same fields (app/components/dashboard/stepPanels.js).
//
// Everything lib/compliance/taxRegistration.js and scripts/check-tax-id.mjs
// say about these fields still holds and is asserted against THIS file now:
// the local name, the reason, no format validation, and the "not registered"
// answer recorded here beside the field rather than dismissed from a card.
// The tax RATES list below these on the page is not here — it is a different
// thing, and the onboarding step does not ask for it.
//
// Controlled from outside for the same reason CompanyDetailsFields is: the
// page's form and the dialog's form are different shapes with one PATCH each.
"use client";

import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";
import { useTranslation } from "@/app/hooks/useTranslation";
import { COMPANY_DETAILS_INPUT_CLASS } from "@/app/components/settings/CompanyDetailsFields";

/** The fields this component edits — what a partial PATCH should carry. */
export const TAX_REGISTRATION_FIELDS = ["taxIdName", "taxIdNumber", "taxRegistrationDismissed"];

/**
 * @param {object} props
 * @param {object} props.form — taxIdName, taxIdNumber, taxRegistrationDismissed, country
 * @param {(field: string, value: any) => void} props.set
 * @param {string} [props.inputClass]
 */
export default function TaxRegistrationFields({ form, set, inputClass = COMPANY_DETAILS_INPUT_CLASS }) {
  const { t } = useTranslation();
  // Labelled for the country in the form, so changing the country relabels
  // the field in the same keystroke — the label and the jurisdiction cannot
  // drift apart. Unknown or unloaded country: the generic profile, which
  // asserts nothing about anybody's law.
  const taxReg = taxRegistrationFor(form?.country);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.taxIdName")}
          </label>
          <input
            className={inputClass}
            placeholder={t("app.setCompany.taxIdNamePlaceholder")}
            value={form.taxIdName}
            onChange={(e) => set("taxIdName", e.target.value)}
          />
        </div>
        <div>
          {/* Labelled the way the contractor's own country labels it —
              "GST/HST number", "VAT number", "ABN" — rather than "Tax ID
              number", which is what a database calls it. No format
              validation, deliberately: see lib/compliance/taxRegistration.js
              for why rejecting a valid number is the expensive mistake. */}
          <label className="text-sm font-medium text-foreground block mb-1">
            {t(taxReg.nameKey)}
          </label>
          <input
            className={inputClass}
            value={form.taxIdNumber}
            onChange={(e) => set("taxIdNumber", e.target.value)}
          />
        </div>
      </div>
      <div className="-mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">{t(taxReg.whyKey)}</p>
        <p className="text-xs text-muted-foreground">
          {t("app.setCompany.taxIdHint")}{" "}
          {t("app.setCompany.taxRegDisclaimer")}
        </p>

        {/* ── "I don't have one" ────────────────────────────────────────
            A fact about the business, recorded next to the field it is
            about — not a dismiss button on the onboarding card. Ticking it
            clears the onboarding step; untick it the day they register and
            the step comes back.

            Offered in every country, including the ones where the number is
            required, because "required" in every one of those rules means
            "required IF registered". A Canadian sole trader under the $30k
            threshold has no GST number to give, and hiding this from them
            would leave exactly the smallest businesses carrying an item
            they can never tick.

            Hidden once a number is entered: there is nothing to declare an
            absence of, and a ticked box beside a filled field is a
            contradiction the screen shouldn't be able to show. */}
        {!String(form.taxIdNumber || "").trim() && (
          <label className="flex items-start gap-2.5 text-xs text-muted-foreground pt-1">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(form.taxRegistrationDismissed)}
              onChange={(e) =>
                set("taxRegistrationDismissed", e.target.checked)
              }
            />
            <span>{t("app.setCompany.taxRegNotRegistered")}</span>
          </label>
        )}
      </div>

    </>
  );
}
