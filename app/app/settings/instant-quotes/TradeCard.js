// app/app/settings/instant-quotes/TradeCard.js
//
// One trade's instant-quote card — the toggle, the rates, the surcharges, the
// minimum and the band — and the field helpers it is built from. Moved out
// of page.js whole (nothing rewritten) because the home page's "Enable
// instant quotes" dialog renders the same cards for the company's own trades
// (app/components/dashboard/stepPanels.js). One card, two doors: a rate
// saved from the checklist is the rate the estimator prices off, exactly as
// it is from Settings.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import JunkGuidance from "@/app/components/settings/JunkGuidance";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import {
  budgetBands,
  normaliseBudgetThresholds,
  DEFAULT_BUDGET_THRESHOLDS,
} from "@/lib/estimate/budgetBands";
import {
  groupRateFields,
  rateFieldPatch,
  readRate,
} from "@/lib/estimate/instantRateFields";
import { PAINTING_SCOPE_CATEGORY } from "@/lib/estimate/instantSeed";
import {
  FORM_FIELD_KEYS,
  FORM_FIELD_STATES,
  effectiveFormFields,
} from "@/lib/estimate/formFields";
import { categoryLabel } from "@/lib/trades/catalog";
import LawnCareEditor from "./LawnCareEditor";

const MEASURE_COPY = {
  roof_address:
    "Roof measured automatically from the address (Google satellite).",
  gutter_address:
    "Gutter run and downspouts measured automatically from the address (Google roof model); priced per foot and per downspout with a low–high range.",
  lawn_polygon:
    "Homeowner traces the lawn on a satellite map; area computed from the outline.",
  area_polygon:
    "Homeowner traces the area on a satellite map (a driveway, a patio, a walkway); area computed from the outline and priced per sq ft.",
  lawn_address:
    "Lawn sized from the address — the lot boundary minus the roof and a driveway allowance where the city publishes parcels (Gatineau), otherwise your minimum band, always labelled as an estimate — and the homeowner can trace the lawn to correct it. Programs and add-ons priced by lawn-size band.",
  manual_area: "Homeowner enters the area and picks options.",
  manual_units: "Homeowner enters counts (doors, drawers).",
  item_picker:
    "Homeowner picks the items to remove; priced by volume with a built-in load discount.",
  stair_count:
    "Homeowner enters the number of steps and picks the build; priced per tread.",
};

// A labelled number input that keeps an empty string editable (so a field can
// be cleared without snapping to 0 mid-type).
function NumField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "1",
  width = "w-28",
  disabled = false,
}) {
  // ── Twenty-four boxes on this screen were labelled in dollars ───────────
  //
  // Every money field here passed `prefix="$"`. This is the rate card a
  // stranger is quoted from, so a contractor in Zurich or Manchester was
  // typing the numbers a homeowner sees against the wrong symbol.
  // cabinet-rates/page.js hit exactly this and fixed it by passing the
  // company's currency CODE; check:app-currency cannot see either case,
  // because it scans for `$${…}` and this is a plain string literal.
  //
  // Resolved HERE rather than at the call sites: twenty-four of them is
  // twenty-four chances to reintroduce it, and the twenty-fifth field somebody
  // adds gets it right for free. `prefix="$"` is read as "this is money" and
  // becomes the company's own code; any other prefix passes through untouched.
  const { currency } = useCompanyPreferences();
  const shownPrefix = prefix === "$" ? currency : prefix;
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="flex items-center gap-1">
        {shownPrefix && (
          <span className="text-sm text-muted-foreground">{shownPrefix}</span>
        )}
        <input
          type="number"
          step={step}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className={`${width} rounded-lg border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50 disabled:bg-muted`}
        />
        {suffix && (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        )}
      </span>
    </label>
  );
}

// Editable surcharge map ({ good:0, fair:0.12, ... }) shown as whole percents.
function PercentMap({ title, map, onChange }) {
  if (!map) return null;
  return (
    <div>
      <div className="text-sm font-medium text-foreground mb-2">{title}</div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(map).map(([key, pct]) => (
          <NumField
            key={key}
            label={key.replace(/_/g, " ")}
            value={Math.round((Number(pct) || 0) * 100)}
            suffix="%"
            width="w-20"
            onChange={(v) =>
              onChange({ ...map, [key]: (v === "" ? 0 : v) / 100 })
            }
          />
        ))}
      </div>
    </div>
  );
}

// ── The unit rates a trade prices by ────────────────────────────────────────
//
// Declared by the trade, not by this file: `fields` arrives from the settings
// route, which resolves it out of the trade's price book and its estimator seed
// (lib/estimate/instantRateFields.js). This block used to be three hand-typed
// boxes behind `trade.trade === "cabinet_refacing"`, which is why cabinet
// refinishing — wired later, priced per door, no materials — had no editor at
// all and quoted $150 a door that nobody could see.
//
// ── Where the labels come from ──────────────────────────────────────────────
//
// The book's own words, with the catalogue allowed to override them: the key is
// derived from the field's path, and cabinetFields()' English label is the
// FALLBACK. No parallel list of rate names was written.
//
// That keeps both halves honest. "Per door", "Per drawer" and "Per box linear
// ft" were already translated into all six languages under exactly those key
// names, so refacing loses nothing — and the eight refinishing rates that have
// no key ("Soft-close hinges", "Three-colour base") render the book's label
// rather than a missing string. A twelfth rate added to the book tomorrow shows
// up here named correctly with no edit to this file and no dead key; translate
// it later by adding `app.setInstantQuotes.<path>` and nothing here changes.
//
// A hand-kept translated copy of the eleven names was the alternative, and it
// is the copy that rots: a stale rate NAME beside a live rate VALUE is worse
// than an English one. The group headings below are this screen's own chrome,
// not the book's, so those are ordinary translated strings.
//
// The key is built by concatenation, so check-translations' literal scan can't
// see it. Naming the three that exist here is what keeps them off that script's
// "defined but not referenced" list and out of a future prune:
// "app.setInstantQuotes.perDoor", "app.setInstantQuotes.perDrawer",
// "app.setInstantQuotes.perBoxLinearFt".
function UnitRates({ fields, config, onPatch, t }) {
  const blocks = groupRateFields(fields);
  if (blocks.length === 0) return null;

  // A Map, not an object literal: the group key is a config path segment, and
  // groupTitles["__proto__"] on a literal returns Object.prototype — a truthy
  // "title" React then tries to render.
  const groupTitles = new Map([
    [
      "complexityUpchargePerUnit",
      t(
        "app.setInstantQuotes.rateGroup.complexity",
        "Complexity uplift (dollars per face, on top of the rate)",
      ),
    ],
    [
      "addOns",
      t(
        "app.setInstantQuotes.rateGroup.addOns",
        "Upgrades (charged only when the homeowner asks for them)",
      ),
    ],
  ]);

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.key || "_base"}>
          {block.key && (
            <div className="text-sm font-medium text-foreground mb-2">
              {groupTitles.get(block.key) || block.key}
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            {block.fields.map((field) => (
              <NumField
                key={field.path}
                label={t(`app.setInstantQuotes.${field.path}`, field.label)}
                prefix="$"
                suffix={field.suffix}
                step={String(field.step)}
                // Absent stays absent. readRate returns undefined for a rate the
                // company has never set, and NumField renders that as an empty
                // box — never a confident 0, which on "Per door" would quote a
                // free kitchen.
                value={readRate(config, field.path)}
                onChange={(v) => onPatch(field.path, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Painting's scope surcharge, one box per scope the company SELLS ────────
//
// Was a generic PercentMap titled "Interior vs exterior", which read as a
// choice between two rates and was neither: the map is a SURCHARGE on the base
// rate, and 0% on interior means "the base rate as typed". Retitled to say so.
//
// Which boxes are live comes from Services: a box for a scope the company
// doesn't sell is a control that changes no number — the server fixes the
// scope to the one they do sell (withOfferedScope in instantQuoteServer.js)
// and the public form never asks — so that box is greyed and says why, rather
// than sitting there looking editable.
function ScopeSurcharges({ map, offered, onChange, t }) {
  if (!map) return null;
  const scopeName = (scope) => t(`app.setInstantQuotes.scope.${scope}`, scope);
  return (
    <div>
      <div className="text-sm font-medium text-foreground mb-1">
        {t(
          "app.setInstantQuotes.scopeSurchargeTitle",
          "Surcharge by scope (added to the base rate)",
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2 max-w-md">
        {t(
          "app.setInstantQuotes.scopeSurchargeHelp",
          "Interior 0% means the base rate as typed; exterior 30% means the base rate plus 30% for height, weather and prep.",
        )}
      </p>
      <div className="flex flex-wrap gap-4">
        {Object.entries(map).map(([scope, pct]) => {
          const sold = offered.includes(scope);
          return (
            <div key={scope} className="flex flex-col gap-1">
              <NumField
                label={scopeName(scope)}
                value={Math.round((Number(pct) || 0) * 100)}
                suffix="%"
                width="w-20"
                disabled={!sold}
                onChange={(v) =>
                  onChange({ ...map, [scope]: (v === "" ? 0 : v) / 100 })
                }
              />
              {!sold && (
                <span className="text-xs text-muted-foreground max-w-[14rem]">
                  {t(
                    "app.setInstantQuotes.scopeNotSold",
                    "{service} is off under Services, so homeowners aren't asked about it.",
                    { service: categoryLabel(PAINTING_SCOPE_CATEGORY[scope]) },
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {offered.length === 1 && (
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          {t(
            "app.setInstantQuotes.scopeFixedNote",
            "Homeowners aren't asked interior or exterior — every painting estimate is priced as {scope}.",
            { scope: scopeName(offered[0]) },
          )}
        </p>
      )}
    </div>
  );
}

// ── The rates that come from Services & Pricing, shown and not edited ─────
//
// There used to be a drift notice here: the saved instant row priced, the
// company's price book moved on without it, and this panel listed the two
// figures side by side with a "Use my services pricing" button to reconcile
// them by hand. That was housekeeping the contractor had to remember to do,
// on a number a stranger is being quoted in the meantime.
//
// The owner settled it — "keep only the information that is NOT in a quote ...
// because the pricing is already there" — so the book is now read LIVE on
// every estimate (effectiveInstantConfig in lib/estimate/instantQuoteServer.js)
// and there is nothing left to drift or to adopt. What is left is this: the
// figures the estimator will use, stated plainly, and the one link that
// changes them. Read-only because two boxes for one number is how they
// disagree, and because the other box is the one the quote builder reads.
//
// Keys built by concatenation, invisible to check-translations' literal scan:
// "app.setInstantQuotes.materials.standard.ratePerSqft",
// "app.setInstantQuotes.scopeSurcharge.exterior",
// "app.setInstantQuotes.conditionSurcharge.fair",
// "app.setInstantQuotes.conditionSurcharge.poor",
// "app.setInstantQuotes.minCharge", "app.setInstantQuotes.scope.interior",
// "app.setInstantQuotes.scope.exterior". The cabinet paths (perDoor, perDrawer,
// the add-ons) resolve exactly as UnitRates resolves them.
function PricedFromServices({ fields, serviceLabels, money, t }) {
  if (!fields?.length) return null;
  const shown = (f) =>
    f.kind === "percent" ? `${Math.round(Number(f.value) * 100)}%` : money(f.value);
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-3">
      <div className="text-sm font-medium text-foreground">
        {t(
          "app.setInstantQuotes.pricedFromServicesTitle",
          "Priced from your rates in Services & Pricing",
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "app.setInstantQuotes.pricedFromServicesIntro",
          "These are read every time a homeowner gets an estimate, so this card and your quotes always quote the same number. Change them where they live:",
        )}{" "}
        <Link
          href="/app/settings/services"
          className="underline font-medium text-foreground"
        >
          {serviceLabels?.length
            ? t("app.setInstantQuotes.pricedFromServicesLink", "Open {service} rates", {
                service: serviceLabels.join(" / "),
              })
            : t("app.setInstantQuotes.mismatchServicesLink", "Open Services")}
        </Link>
      </p>
      <dl className="mt-2 space-y-1">
        {fields.map((f) => (
          <div key={f.path} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="text-muted-foreground min-w-0">
              {t(`app.setInstantQuotes.${f.path}`, f.label)}
            </dt>
            <dd className="font-medium text-foreground tabular-nums shrink-0">
              {shown(f)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Which questions the public form asks ────────────────────────────────────
//
// One row per qualifier field, three states each (lib/estimate/formFields.js).
// The row shows the EFFECTIVE state — the saved value with the two locks
// applied — and says why a locked row is greyed, because a switch that can be
// flipped and changes nothing is the thing this codebase is swept for.
// Nothing here is a price; the same table gates the public request route.
function FormFieldsEditor({ fields, measure, serviceAreaConfigured, canEdit, onChange, t }) {
  const { fields: effective, locks } = effectiveFormFields(fields, { measure, serviceAreaConfigured });
  const stateLabel = {
    required: t("app.setInstantQuotes.fields.required", "Required"),
    optional: t("app.setInstantQuotes.fields.optional", "Optional"),
    hidden: t("app.setInstantQuotes.fields.hidden", "Hidden"),
  };
  const fieldLabel = {
    photos: t("app.setInstantQuotes.fields.photos", "Photos"),
    budget: t("app.setInstantQuotes.fields.budget", "Budget range"),
    timeline: t("app.setInstantQuotes.fields.timeline", "When they need it done"),
    notes: t("app.setInstantQuotes.fields.notes", "Note (free text)"),
    phone: t("app.setInstantQuotes.fields.phone", "Phone"),
    email: t("app.setInstantQuotes.fields.email", "Email"),
    address: t("app.setInstantQuotes.fields.address", "Job address"),
  };
  const lockReason = (key) => {
    if (key === "address" && locks.address === "measured") {
      return t("app.setInstantQuotes.fields.addressMeasured", "Required — the estimate is measured from this address.");
    }
    if (key === "address" && locks.address === "service_area") {
      return t(
        "app.setInstantQuotes.fields.addressServiceArea",
        "Required — you've set a service area, and it can't be checked without an address.",
      );
    }
    if (key === locks.contact) {
      return t(
        "app.setInstantQuotes.fields.contactLocked",
        "Required — the other contact field is hidden, so this is the one way to reach them.",
      );
    }
    return null;
  };
  return (
    <div>
      <div className="text-sm font-medium text-foreground mb-1">
        {t("app.setInstantQuotes.fields.title", "Form fields")}
      </div>
      <p className="text-xs text-muted-foreground mb-3 max-w-md">
        {t(
          "app.setInstantQuotes.fields.intro",
          "Which questions this form asks, and which a homeowner must answer before they can submit. The server holds every request to the same rule, so nothing can be posted around it.",
        )}
      </p>
      <div className="space-y-2">
        {FORM_FIELD_KEYS.map((key) => {
          const reason = lockReason(key);
          const locked = Boolean(reason);
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <span className="text-sm text-foreground">{fieldLabel[key]}</span>
                {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
              </div>
              <div
                role="radiogroup"
                aria-label={fieldLabel[key]}
                className={`inline-flex rounded-lg border border-border overflow-hidden ${locked ? "opacity-60" : ""}`}
              >
                {FORM_FIELD_STATES.map((state) => {
                  const on = effective[key] === state;
                  return (
                    <button
                      key={state}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={!canEdit || locked}
                      onClick={() => onChange({ ...(fields || {}), [key]: state })}
                      className={`px-3 min-h-9 text-xs font-medium border-r border-border last:border-r-0 disabled:cursor-not-allowed ${
                        on ? "bg-inverted text-inverted-foreground" : "bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {stateLabel[state]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2 max-w-md">
        {t(
          "app.setInstantQuotes.fields.contactRule",
          "At least one of phone or email is always required; hiding one makes the other required.",
        )}
      </p>
    </div>
  );
}

export default function TradeCard({ trade, canEdit, onSaved, serviceAreaConfigured = false }) {
  const { t } = useTranslation();
  // Three money fields on this card are laid out by hand rather than through
  // NumField, and each carried its own literal "$". Same defect, same fix.
  const { currency, money } = useCompanyPreferences();
  const [enabled, setEnabled] = useState(trade.enabled);
  const [config, setConfig] = useState(trade.config || {});
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  // Server-computed, and it describes the SAVED row — not the unsaved edits in
  // this form. Refreshed by onSaved(), which reloads the page data.
  const readiness = trade.readiness;

  const rateKey =
    trade.trade === "roofing"
      ? "ratePerSquare"
      : trade.trade === "stair"
        ? "ratePerTread"
        : "ratePerSqft";
  const rateSuffix =
    trade.trade === "roofing"
      ? t("app.setInstantQuotes.perSquare", "/ square")
      : trade.trade === "stair"
        ? t("app.setInstantQuotes.perTread", "/ tread")
        : t("app.setInstantQuotes.perSqft", "/ sqft");

  function patch(next) {
    setConfig((c) => ({ ...c, ...next }));
  }

  // One dotted rate — "addOns.softCloseHingesPerDoor" — through the shallow
  // merge above. rateFieldPatch rebuilds the whole `addOns` branch, because
  // patching `{ addOns: { softCloseHingesPerDoor: 35 } }` would take the other
  // six upgrade rates with it. It reads off the CURRENT state rather than the
  // captured `config` so two edits in the same tick don't clobber each other,
  // and returns null for a prototype-poisoning path, which writes nothing.
  function patchRate(path, value) {
    setConfig((c) => {
      const next = rateFieldPatch(c, path, value);
      return next ? { ...c, ...next } : c;
    });
  }

  // `configToSave` exists for a caller that has just replaced the form state
  // and must not save the render-old closure. The last such caller was the
  // drift notice's "use my services pricing" button; the parameter stays
  // because the hazard does, and a future caller finding the default is a bug
  // that costs a save.
  async function save(configToSave = config) {
    setSaving(true);
    setSavedNote("");
    try {
      await fetchJson("/api/settings/instant-quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: trade.trade, enabled, config: configToSave }),
      });
      setSavedNote(t("app.action.saved"));
      onSaved?.();
    } catch (err) {
      // Server refuses to enable an unpriced trade; surface its message.
      showError(
        err.message || t("app.setInstantQuotes.couldNotSave", "Could not save"),
      );
      setEnabled(trade.enabled); // roll the toggle back to the known-good state
    } finally {
      setSaving(false);
    }
  }

  // The route sends this only when the company's own price book states this
  // trade's rates. It is what suppresses every editor for a number that now
  // lives under Services & Pricing — see PricedFromServices above.
  const pricedFromServices = Array.isArray(trade.pricedFromServices)
    && trade.pricedFromServices.length > 0;
  const minChargeFromServices = (trade.pricedFromServices || []).some(
    (f) => f.path === "minCharge",
  );

  const materials = Array.isArray(config.materials) ? config.materials : [];
  // Painting only. Absent for every other trade, and [] when the company sells
  // neither painting service — in which case the public page offers no
  // painting and the card says so below.
  const scopesOffered = Array.isArray(trade.scopesOffered) ? trade.scopesOffered : null;

  // Shown as typed, not as normalised: run the saved value through
  // normaliseBudgetThresholds for display and a half-typed "35" silently
  // becomes 1000 under the cursor. The preview line below says which of the two
  // the homeowner will actually get.
  const budgetThresholds =
    Array.isArray(config.budgetThresholds) &&
    config.budgetThresholds.length === DEFAULT_BUDGET_THRESHOLDS.length
      ? config.budgetThresholds
      : [...DEFAULT_BUDGET_THRESHOLDS];
  const budgetBandsValid =
    JSON.stringify(normaliseBudgetThresholds(budgetThresholds)) ===
    JSON.stringify(budgetThresholds.map((n) => Math.round(Number(n))));

  // Junk rates are stored in CENTS (priceJunk's unit); the form shows dollars.
  const rates = config.rates || {};
  const centsToDollars = (c) =>
    Number(c) > 0 ? Math.round(Number(c) / 100) : "";
  const dollarsToCents = (d) =>
    d === "" || d == null ? 0 : Math.round(Number(d) * 100);
  const setRate = (field, dollars) =>
    patch({ rates: { ...rates, [field]: dollarsToCents(dollars) } });
  const setLoad = (tier, dollars) =>
    patch({
      rates: {
        ...rates,
        loadCents: {
          ...(rates.loadCents || {}),
          [tier]: dollarsToCents(dollars),
        },
      },
    });

  return (
    // Anchored so the "this one needs your price" finding above can link
    // straight at the card instead of saying "scroll down and find Roofing".
    // scroll-mt keeps the heading clear of the sticky app chrome.
    <div
      id={`trade-${trade.trade}`}
      className="rounded-xl border border-border bg-card p-5 scroll-mt-20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
            {trade.label}
            {/* Only on a card that is ON for work the company doesn't list as
                a service — the case that put a roofing rate card in a cabinet
                painter's account. Silent otherwise: a trade they haven't
                touched needs no label, and the disclosure above already says
                what that group is. */}
            {trade.enabled && !trade.offeredAsService && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                {t(
                  "app.setInstantQuotes.notYourService",
                  "Not one of your services",
                )}
              </span>
            )}
          </h3>
          {/* The estimator's name and the catalogue's name are not the same
              word — this card is "Stairs & Railings" and the service to switch
              on is "Stairs" — so a contractor who does sell it is told which
              row to go and tick rather than left to guess. Only on a card
              that's off and unsold; naming it on one he's already using would
              be nagging. */}
          {!trade.enabled &&
            !trade.offeredAsService &&
            trade.serviceLabels?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "app.setInstantQuotes.addServiceFirst",
                  "Sell this? Switch on {service} under Services first.",
                  { service: trade.serviceLabels.join(" / ") },
                )}
              </p>
            )}
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {t(
              `app.setInstantQuotes.measure.${trade.measure}`,
              MEASURE_COPY[trade.measure],
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">
            {enabled
              ? t("app.setInstantQuotes.on", "On")
              : t("app.setInstantQuotes.off", "Off")}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand,#06356b)]"
          />
        </label>
      </div>

      {/* Two different truths for an unsaved card. Derived from the company's
          own Services & Pricing book, these ARE their figures and the note
          says where they came from; otherwise they are FieldQuo's reference
          points and the note must not let them pass for anything else. */}
      {trade.isDefaults && (
        <p className="mt-3 text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
          {trade.derivedFromServices
            ? t(
                "app.setInstantQuotes.derivedDefaultsNote",
                "Started from your Services & Pricing rates. Change anything here, then save — nothing is offered to homeowners until you do.",
              )
            : t(
                "app.setInstantQuotes.defaultsNote",
                "These are typical starting figures, not your prices. Edit them to your market, then save — nothing is offered to homeowners until you do.",
              )}
        </p>
      )}

      {scopesOffered && scopesOffered.length === 0 && (
        <p className="mt-3 text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
          {t(
            "app.setInstantQuotes.paintingNotOffered",
            "Painting isn't offered as an instant quote: neither Interior Painting nor Exterior Painting is on under Services. Switch one on there first — until then homeowners don't see it, whatever is saved here.",
          )}
        </p>
      )}

      <PricedFromServices
        fields={trade.pricedFromServices}
        serviceLabels={trade.serviceLabels}
        money={money}
        t={t}
      />

      {/* ── Readiness ─────────────────────────────────────────────────────
          The public page tells a homeowner only that the service isn't
          available — it must never show a stranger the state of someone's
          rate card. So this is the one screen where the reason exists, and
          it sits directly above the fields that fix it. It's computed by
          dry-running the public pricer, not by a second opinion about it. */}
      {!trade.isDefaults && readiness && !readiness.ok && (
        <p
          className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
            trade.enabled
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          <strong>
            {t(
              "app.setInstantQuotes.notPriceable",
              "Homeowners can't get a price for this yet.",
            )}
          </strong>{" "}
          {[readiness.message, readiness.fix].filter(Boolean).join(" ")}
        </p>
      )}

      {readiness?.warnings?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {readiness.warnings.map((w, i) => (
            <li
              key={i}
              className="text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2"
            >
              {w.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-5">
        {/* ── What the homeowner sees ──────────────────────────────────────
            Per trade, because a cabinet shop is happy to flash a range and a
            GC never is. Defaults to "don't show" — a company opts INTO
            revealing a number. */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2">
            {t("app.setInstantQuotes.homeownerSees", "What the homeowner sees")}
          </div>
          <div className="flex flex-col gap-2">
            {[
              {
                key: "gated",
                label: t(
                  "app.setInstantQuotes.visGatedLabel",
                  "Don't show a price",
                ),
                hint: t(
                  "app.setInstantQuotes.visGatedHint",
                  "They submit and we say a quote is on the way.",
                ),
              },
              {
                key: "after_submit",
                label: t(
                  "app.setInstantQuotes.visAfterSubmitLabel",
                  "Show the range after they submit",
                ),
                hint: t(
                  "app.setInstantQuotes.visAfterSubmitHint",
                  "They fill in the form to unlock their range. You get their details either way — the usual pick.",
                ),
              },
              {
                key: "range",
                label: t(
                  "app.setInstantQuotes.visRangeLabel",
                  "Show the range straight away",
                ),
                hint: t(
                  "app.setInstantQuotes.visRangeHint",
                  "The number appears before they leave any details. Expect people to read it and go.",
                ),
              },
            ].map((opt) => {
              const current =
                (config.estimateVisibility || "gated") === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => patch({ estimateVisibility: opt.key })}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    current
                      ? "border-foreground bg-inverted/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 ${
                        current
                          ? "border-foreground bg-foreground"
                          : "border-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5.5">
                    {opt.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Budget bands ──────────────────────────────────────────────────
            Three cuts, four bands. Per trade because the generic $1k/$5k/$15k
            set is useless for most of them: a cabinet shop's cheapest real job
            clears $3,000, so "under $1,000" is a band nobody picks. A question
            whose answers don't fit gets answered at random, and a qualifier
            answered at random is worse than one never asked. */}
        <div>
          <div className="text-sm font-medium text-foreground mb-1">
            {t("app.setInstantQuotes.budgetBands", "Budget bands")}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {t(
              "app.setInstantQuotes.budgetBandsHint",
              "The four options shown when we ask their budget. Set the three cut-off points; they must go up.",
            )}
          </p>
          <div className="flex items-center gap-2">
            {budgetThresholds.map((v, i) => (
              <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-sm text-muted-foreground">{currency}</span>
                <input
                  type="number"
                  min="1"
                  value={v}
                  onChange={(e) => {
                    const next = [...budgetThresholds];
                    next[i] =
                      e.target.value === "" ? "" : Number(e.target.value);
                    patch({ budgetThresholds: next });
                  }}
                  className="w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          {/* Say what the homeowner will actually read, and say plainly when
              the numbers won't be used. The server falls back to the generic
              bands for an unusable list rather than publishing "$6,000 –
              $3,500" on a public page; without this line that fallback is
              silent, and the owner sees their typed numbers saved and no idea
              why the form still shows the old ones. */}
          <p className="text-xs mt-2 text-muted-foreground">
            {budgetBandsValid ? (
              <>
                {t("app.setInstantQuotes.budgetBandsPreview", "They'll see:")}{" "}
                {budgetBands(budgetThresholds)
                  .map((b) => b.label)
                  .join(" · ")}
              </>
            ) : (
              <span className="text-amber-600">
                {t(
                  "app.setInstantQuotes.budgetBandsInvalid",
                  "These need to be three amounts in increasing order — until they are, the standard bands are shown instead.",
                )}
              </span>
            )}
          </p>
        </div>

        {/* Material sell rates.
            Keyed on whether the trade HAS a material rate list, not on
            `hasMaterials && trade !== "cabinet_refacing"`. hasMaterials means
            the homeowner is asked to pick one; refacing does ask, and then
            prices off a per-door rate times a multiplier with no rows to edit.
            The route derives hasMaterialRates from the seed, and it resolves to
            exactly the same set of trades this exclusion produced. */}
        {trade.hasMaterialRates && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              {t(
                "app.setInstantQuotes.materialsAndRates",
                "Materials & sell rates",
              )}
            </div>
            <div className="space-y-2">
              {materials.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={m.label ?? ""}
                    onChange={(e) => {
                      const next = [...materials];
                      next[i] = { ...m, label: e.target.value };
                      patch({ materials: next });
                    }}
                    placeholder={t(
                      "app.setInstantQuotes.materialNamePlaceholder",
                      "Material name",
                    )}
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">{currency}</span>
                  <input
                    type="number"
                    step="1"
                    value={m[rateKey] ?? ""}
                    onChange={(e) => {
                      const next = [...materials];
                      next[i] = {
                        ...m,
                        [rateKey]:
                          e.target.value === "" ? "" : Number(e.target.value),
                      };
                      patch({ materials: next });
                    }}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {rateSuffix}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patch({ materials: materials.filter((_, j) => j !== i) })
                    }
                    className="text-muted-foreground hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={t(
                      "app.setInstantQuotes.removeMaterial",
                      "Remove material",
                    )}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  materials: [
                    ...materials,
                    {
                      key: `custom_${materials.length}`,
                      label: "",
                      [rateKey]: "",
                    },
                  ],
                })
              }
              className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} />{" "}
              {t("app.setInstantQuotes.addMaterial", "Add material")}
            </button>
          </div>
        )}

        {/* Unit rates — per door, per drawer, complexity, upgrades. */}
        <UnitRates
          fields={trade.rateFields}
          config={config}
          onPatch={patchRate}
          t={t}
        />

        {/* Lawn-care programs, included services and add-ons, priced by
            lawn-size band — its own form, in its own file. */}
        {trade.trade === "lawn_care" && (
          <LawnCareEditor config={config} patch={patch} currency={currency} isDefaults={trade.isDefaults} />
        )}

        {/* Lawn size tiers */}
        {trade.trade === "lawn_mowing" && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              {t(
                "app.setInstantQuotes.perVisitByLotSize",
                "Per-visit price by lot size",
              )}
            </div>
            <div className="space-y-2">
              {(config.tiers || []).map((tier, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {t("app.setInstantQuotes.upTo", "up to")}
                  </span>
                  <input
                    type="number"
                    value={tier.maxSqft ?? ""}
                    onChange={(e) => {
                      const next = [...config.tiers];
                      next[i] = {
                        ...tier,
                        maxSqft:
                          e.target.value === "" ? "" : Number(e.target.value),
                      };
                      patch({ tiers: next });
                    }}
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                  <span className="text-muted-foreground">
                    {t("app.setInstantQuotes.sqftArrow", "sqft →")}
                  </span>
                  <span className="text-muted-foreground">{currency}</span>
                  <input
                    type="number"
                    value={tier.pricePerVisit ?? ""}
                    onChange={(e) => {
                      const next = [...config.tiers];
                      next[i] = {
                        ...tier,
                        pricePerVisit:
                          e.target.value === "" ? "" : Number(e.target.value),
                      };
                      patch({ tiers: next });
                    }}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                  <span className="text-muted-foreground">
                    {t("app.setInstantQuotes.perVisit", "/ visit")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <NumField
                label={t(
                  "app.setInstantQuotes.extraAcre",
                  "Each extra acre over the top tier",
                )}
                prefix="$"
                width="w-24"
                value={config.pricePerAcreOver}
                onChange={(v) => patch({ pricePerAcreOver: v })}
              />
            </div>
          </div>
        )}

        {/* Surcharge maps per trade */}
        {trade.trade === "roofing" && (
          <PercentMap
            title={t(
              "app.setInstantQuotes.steepPitchSurcharge",
              "Steep-pitch surcharge",
            )}
            map={config.steepnessSurcharge}
            onChange={(m) => patch({ steepnessSurcharge: m })}
          />
        )}
        {trade.trade === "roofing" && (
          <NumField
            label={t(
              "app.setInstantQuotes.tearOff",
              "Tear-off per square, per existing layer",
            )}
            prefix="$"
            width="w-24"
            value={config.tearOffPerSquarePerLayer}
            onChange={(v) => patch({ tearOffPerSquarePerLayer: v })}
          />
        )}
        {trade.trade === "epoxy" && (
          <PercentMap
            title={t(
              "app.setInstantQuotes.surfacePrepSurcharge",
              "Surface-prep surcharge",
            )}
            map={config.prepSurcharge}
            onChange={(m) => patch({ prepSurcharge: m })}
          />
        )}
        {trade.trade === "parging" && (
          <>
            <PercentMap
              title={t(
                "app.setInstantQuotes.accessSurcharge",
                "Access surcharge",
              )}
              map={config.accessSurcharge}
              onChange={(m) => patch({ accessSurcharge: m })}
            />
            <PercentMap
              title={t(
                "app.setInstantQuotes.conditionSurcharge",
                "Condition surcharge",
              )}
              map={config.conditionSurcharge}
              onChange={(m) => patch({ conditionSurcharge: m })}
            />
          </>
        )}
        {trade.trade === "stair" && (
          <NumField
            label={t(
              "app.setInstantQuotes.railingPerFt",
              "Railing, per linear ft",
            )}
            prefix="$"
            value={config.railingPerFt}
            onChange={(v) => patch({ railingPerFt: v })}
          />
        )}
        {trade.trade === "flooring" && (
          <PercentMap
            title={t(
              "app.setInstantQuotes.subfloorSurcharge",
              "Subfloor / removal surcharge",
            )}
            map={config.prepSurcharge}
            onChange={(m) => patch({ prepSurcharge: m })}
          />
        )}
        {/* Painting's two surcharges are DERIVED from the interior and
            exterior books — siding over walls, the moderate and high tiers
            over standard (lib/estimate/instantSeed.js) — so once the book is
            read live they are shown in the panel above and not edited here.
            Leaving the boxes would be two controls that change no number, on
            the screen this codebase is repeatedly swept for exactly that. The
            condition is: no derivation for this company (their painting
            services are off), in which case the saved row still prices and
            the boxes are still the only place to set it. */}
        {trade.trade === "painting" && !pricedFromServices && (
          <>
            <ScopeSurcharges
              map={config.scopeSurcharge}
              offered={scopesOffered || []}
              onChange={(m) => patch({ scopeSurcharge: m })}
              t={t}
            />
            <PercentMap
              title={t(
                "app.setInstantQuotes.surfaceConditionSurcharge",
                "Surface condition surcharge",
              )}
              map={config.conditionSurcharge}
              onChange={(m) => patch({ conditionSurcharge: m })}
            />
          </>
        )}
        {trade.trade === "countertop" && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              {t(
                "app.setInstantQuotes.countertopExtras",
                "Extras (added on top of the material rate)",
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              <NumField
                label={t(
                  "app.setInstantQuotes.upgradedEdge",
                  "Upgraded edge, per ft",
                )}
                prefix="$"
                value={config.edgePerFt}
                onChange={(v) => patch({ edgePerFt: v })}
              />
              <NumField
                label={t(
                  "app.setInstantQuotes.perCutout",
                  "Per cutout (sink/cooktop)",
                )}
                prefix="$"
                value={config.cutoutFee}
                onChange={(v) => patch({ cutoutFee: v })}
              />
              <NumField
                label={t(
                  "app.setInstantQuotes.backsplash",
                  "Backsplash, per sqft",
                )}
                prefix="$"
                value={config.backsplashPerSqft}
                onChange={(v) => patch({ backsplashPerSqft: v })}
              />
            </div>
          </div>
        )}

        {/* Junk removal rate card — the whole cost model in one place.
            Priced by VOLUME (a load discount is built in: the per-item price
            falls as the truck fills), plus the recycling fees that eat the
            margin and the access surcharges that are real labour. */}
        {trade.trade === "junk_removal" && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-foreground mb-2">
                {t(
                  "app.setInstantQuotes.theLoad",
                  "The load (what a truckful costs)",
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <NumField
                  label={t(
                    "app.setInstantQuotes.oneItemMinTrip",
                    "One-item / min trip",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.loadCents?.minimum)}
                  onChange={(v) => setLoad("minimum", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.quarterLoad", "Quarter load")}
                  prefix="$"
                  value={centsToDollars(rates.loadCents?.quarter)}
                  onChange={(v) => setLoad("quarter", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.halfLoad", "Half load")}
                  prefix="$"
                  value={centsToDollars(rates.loadCents?.half)}
                  onChange={(v) => setLoad("half", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.fullTruck", "Full truck")}
                  prefix="$"
                  value={centsToDollars(rates.loadCents?.full)}
                  onChange={(v) => setLoad("full", v)}
                />
                <NumField
                  label={t(
                    "app.setInstantQuotes.fullTruckUnits",
                    "Volume units in a full truck",
                  )}
                  value={rates.fullLoadUnits}
                  onChange={(v) =>
                    patch({
                      rates: {
                        ...rates,
                        fullLoadUnits: v === "" ? 1 : Number(v),
                      },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground mb-2">
                {t(
                  "app.setInstantQuotes.recyclingFees",
                  "Recycling & disposal fees (what the depot charges you)",
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <NumField
                  label={t(
                    "app.setInstantQuotes.fridgeAc",
                    "Fridge / AC (Freon)",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.refrigerantFeeCents)}
                  onChange={(v) => setRate("refrigerantFeeCents", v)}
                />
                <NumField
                  label={t(
                    "app.setInstantQuotes.tvElectronics",
                    "TV / electronics",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.ewasteFeeCents)}
                  onChange={(v) => setRate("ewasteFeeCents", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.mattress", "Mattress")}
                  prefix="$"
                  value={centsToDollars(rates.mattressFeeCents)}
                  onChange={(v) => setRate("mattressFeeCents", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.perTire", "Per tire")}
                  prefix="$"
                  value={centsToDollars(rates.tirePerUnitCents)}
                  onChange={(v) => setRate("tirePerUnitCents", v)}
                />
                <NumField
                  label={t(
                    "app.setInstantQuotes.heavyDebris",
                    "Heavy debris, per truck-bed",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.heavyPerLoadCents)}
                  onChange={(v) => setRate("heavyPerLoadCents", v)}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground mb-2">
                {t(
                  "app.setInstantQuotes.accessSurcharges",
                  "Access surcharges (real labour)",
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <NumField
                  label={t(
                    "app.setInstantQuotes.perFlight",
                    "Per flight of stairs",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.stairsPerFlightCents)}
                  onChange={(v) => setRate("stairsPerFlightCents", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.disassembly", "Disassembly")}
                  prefix="$"
                  value={centsToDollars(rates.disassemblyCents)}
                  onChange={(v) => setRate("disassemblyCents", v)}
                />
                <NumField
                  label={t(
                    "app.setInstantQuotes.smallDemolition",
                    "Small demolition",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.demolitionCents)}
                  onChange={(v) => setRate("demolitionCents", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.longCarry", "Long carry")}
                  prefix="$"
                  value={centsToDollars(rates.longCarryCents)}
                  onChange={(v) => setRate("longCarryCents", v)}
                />
                <NumField
                  label={t("app.setInstantQuotes.noElevator", "No elevator")}
                  prefix="$"
                  value={centsToDollars(rates.noElevatorCents)}
                  onChange={(v) => setRate("noElevatorCents", v)}
                />
                <NumField
                  label={t(
                    "app.setInstantQuotes.outOfArea",
                    "Out of free area",
                  )}
                  prefix="$"
                  value={centsToDollars(rates.outOfAreaCents)}
                  onChange={(v) => setRate("outOfAreaCents", v)}
                />
              </div>
            </div>

            <NumField
              label={t("app.setInstantQuotes.minimumCharge", "Minimum charge")}
              prefix="$"
              value={centsToDollars(rates.minimumCents)}
              onChange={(v) => setRate("minimumCents", v)}
            />

            <JunkGuidance />
          </div>
        )}

        {/* Which questions the public form asks for this trade, and which
            it insists on. Per trade because a roofer wants photos of the
            roof and a lawn programme does not need any. */}
        <FormFieldsEditor
          fields={config.fields}
          measure={trade.measure}
          serviceAreaConfigured={serviceAreaConfigured}
          canEdit={canEdit}
          onChange={(fields) => patch({ fields })}
          t={t}
        />

        {/* Shared knobs */}
        <div className="flex flex-wrap gap-4 pt-1">
          {/* A lawn-care program has a price, not a range, and its floor is
              its minimum lawn size — so neither shared knob applies there,
              and a box that changed nothing would be the dead control this
              screen is swept for. */}
          {trade.trade !== "lawn_care" && (
            <NumField
              label={t("app.setInstantQuotes.rangeWidth", "Range width (±)")}
              suffix="%"
              width="w-20"
              value={Math.round((Number(config.rangeBandPct) || 0) * 100)}
              onChange={(v) => patch({ rangeBandPct: (v === "" ? 0 : v) / 100 })}
            />
          )}
          {/* Junk's minimum lives in its own rate card (in cents); the shared
              dollar minCharge would be a second, conflicting control.
              Cabinet refinishing's floor is its price book's `minimumTotal`
              and is now read from there, so the box is shown in the
              read-only panel instead — same rule, one more trade. The other
              trades' floors have no book equivalent (instantSeed.js says so
              for paving), so this IS the only place they are stated and the
              box stays. */}
          {trade.trade !== "junk_removal" &&
            trade.trade !== "lawn_care" &&
            !minChargeFromServices && (
            <NumField
              label={t("app.setInstantQuotes.minimumCharge", "Minimum charge")}
              prefix="$"
              value={config.minCharge}
              onChange={(v) => patch({ minCharge: v })}
            />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {/* Not `onClick={ save }` bare: save's first parameter is the config to
            write, and a click handler receives the click EVENT — which is
            cyclic, so every press died in JSON.stringify ("cannot serialize
            cyclic structure", the owner's report of 2026-09-14). */}
        <button
          type="button"
          onClick={() => save()}
          disabled={!canEdit || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {enabled
            ? t("app.setInstantQuotes.saveAndEnable", "Save & enable")
            : t("app.action.save")}
        </button>
        {savedNote && (
          <span className="text-sm text-green-600">{savedNote}</span>
        )}
        {!canEdit && (
          <span className="text-xs text-muted-foreground">
            {t(
              "app.setInstantQuotes.ownerAdminOnly",
              "Only an owner or admin can edit pricing.",
            )}
          </span>
        )}
      </div>
    </div>
  );
}
