// app/components/quotes/builder/QuoteBuilder.js
//
// The quote screen. ONE of them, used by /app/quotes/new and by
// /app/quotes/[id]/edit.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Those two routes were two independent implementations of the same screen,
// and they drifted exactly the way AGENTS.md says a copy drifts — the copy is
// the one nobody looks at. It cost real money: the builder taxed the GROSS
// subtotal while the editor taxed subtotal − discount, so the same quote had
// two totals depending on which screen saved it last. It cost features too:
// the cost/margin panel, the expiry default, the readiness checks and "Save &
// review" all landed on the builder and none of them ever reached the editor,
// so a saved quote could not be re-costed at all.
//
// A field added here now appears on both, and cannot drift again.
//
// ── The differences that are real ───────────────────────────────────────────
//
// Creating and editing genuinely are not the same job, and the differences
// live as explicit branches on `mode` rather than as a second file:
//
//   create  a client is chosen, the language is chosen, the compose timer
//           runs, the save is a POST, and the three ways out are draft / send
//           / save-and-review.
//   edit    the client and the language are settled (PATCH takes neither, and
//           a quote keeps the language it was created in — non-negotiable #6),
//           the AI review panel is here because it reads the SAVED quote, and
//           the stored line items are the truth.
//
// That last one is the subtle one. See `persisted` below.
//
// ── Loading is split from the form on purpose ───────────────────────────────
//
// `QuoteBuilder` fetches; `QuoteBuilderForm` is everything else and takes it
// all as props. renderToStaticMarkup runs no effects, so a component that
// fetches its own data can only ever be rendered as its own loading skeleton —
// which is what scripts/check-takeoff-render.jsx already learned the hard way
// on another panel. Split, the whole screen can be rendered against hostile
// and absent data by a check that runs in CI.
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

import MediaUploader from "@/app/components/MediaUploader";
import OnboardingTour from "@/app/components/OnboardingTour";
import HelpButton from "@/app/components/HelpButton";
import SendConfirmModal from "@/app/components/SendConfirmModal";
import StaleWriteBanner from "@/app/components/StaleWriteBanner";
import { readStaleConflict } from "@/lib/concurrency/staleWriteClient";
import { fetchJson } from "@/lib/fetchJson";
import { startComposeTimer } from "@/lib/analytics/composeTimer";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCustomFields, CustomFieldInputs } from "@/app/components/customFields/CustomFieldsBox";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasToggle } from "@/lib/permissions/enforce";

import QuoteLanguageBar from "@/app/components/quotes/QuoteLanguageBar";
import SuggestAddOns from "@/app/components/quotes/SuggestAddOns";
import { applyActualsToDraft } from "@/lib/quotes/applyActuals";
import ServiceTiles from "./ServiceTiles";
import ScopeGroupCard from "./ScopeGroupCard";
import TradeTakeoff, { hasTakeoff } from "./TradeTakeoff";
import UnitPricingFields from "./UnitPricingFields";
import IntakeFields from "./IntakeFields";
import LotAreaMeasure from "./LotAreaMeasure";
import LawnProgramPicker from "./LawnProgramPicker";
import TierSelector from "./TierSelector";
import LineItemsTable from "./LineItemsTable";
import CostMarginPanel from "./CostMarginPanel";
import QuoteTotalsBar from "./QuoteTotalsBar";
import ClientPicker from "./ClientPicker";
import JobAddressField from "./JobAddressField";
import TemplatePicker from "./TemplatePicker";
import SiteVisitPanel from "@/app/components/quotes/SiteVisitPanel";
import { defaultSiteAddressFor, siteAddressRequired } from "@/lib/quotes/jobAddress";
// The document-shaped layout (mockup b7). Same state, same handlers, same
// save — see `layout` in the form and lib/quotes/builderLayout.js.
import DocumentBuilder from "./DocumentBuilder";
import EstimateTypeFirst, { paintingCategoriesOf, paintingCategoryFor } from "./EstimateTypeFirst";
import { resolveBuilderLayout } from "@/lib/quotes/builderLayout";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";

import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import { scopeGroupsLineItemCost } from "@/lib/costing/lineItemCost";
import {
  MARGIN_TARGET_PCT,
  FALLBACK_OVERHEAD_PCT,
  FALLBACK_LABOUR_RATE,
} from "@/lib/costing/quoteCosting";
import { isUnitPriced, UNIT_PRICED_CATEGORIES } from "@/app/data/cabinetPricing";
import { PAINT_ESTIMATE_TYPES } from "@/lib/pricing/paintTakeoff";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { fieldsForCategory } from "@/app/data/quoteIntakeFields";
import { isLotMeasureTrade } from "@/lib/measure/lotTakeoff";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  estimateCabinetDoorCost,
  tradeLabourHours,
} from "@/lib/pricing/tradeScope";
// The money. Pure and shared with scripts/check-quote-builder.mjs, which
// executes both modes against the same group and asserts they agree to the
// cent — the two screens once didn't, and reading them was how that was missed.
import {
  groupSubtotal,
  scopeGroupPayload as buildScopeGroupPayload,
  lineItemsFromStored,
  applyLineItemEdit,
  newScopeGroup,
  billedUnitsOf,
} from "@/lib/quotes/builderPayload";
import { lineFromProduct, lineFromSuggestion } from "@/lib/quotes/lineDetail";
import {
  expandServiceTemplate,
  measurementsFromGroups,
  refillTemplateRun,
  templateOffered,
  templateRunOf,
} from "@/lib/quotes/serviceTemplateLines";
import { describeTemplateLine } from "./templateLineNotes";
import { explainTaxSource, renderTaxNote } from "@/lib/tax/resolveTaxRate";
import { jsonBody } from "@/lib/jsonBody";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { quoteTotals, round2 } from "@/lib/quotes/totals";
import { formatAppMoney } from "@/lib/format/money";
import { defaultValidUntil } from "@/lib/quotes/validUntil";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";
import { taxPlaceOf } from "@/lib/quotes/taxPlace";
import { taxLineHeadline, taxLineSource, taxLineResolved, taxLineUnresolvedHint } from "@/lib/tax/taxLine";
import { readTaxResolution } from "@/lib/tax/taxResolution";
import { splitLawnLines } from "@/lib/quotes/lawnLines";
import { planRequiredFrom } from "@/lib/signup/planRequired";
import { LANGUAGES } from "@/app/i18n/languages";
import { useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * This company's saved edits to a trade's price book.
 *
 * Module-level because the loader needs it before the form mounts (the
 * phone-call prefill builds its groups there) and the form needs it after.
 */
const rateOverridesIn = (categories, categoryId) =>
  (Array.isArray(categories) ? categories : []).find((c) => c.id === categoryId)
    ?.rateOverrides ?? null;

/** Statuses whose line items the API still accepts. See PATCH /api/quotes/[id]. */
const OPEN_STATUSES = ["draft", "sent"];

// ───────────────────────────────────────────────────────────────────────────
// Normalising what the two modes start from
// ───────────────────────────────────────────────────────────────────────────

/**
 * A stored QuoteScopeGroup → the shape the form works in.
 *
 * `persisted: true` is the whole point. A stored group's line items ARE the
 * quote: the builder flattens its takeoff and its unit pricing into lines at
 * save time precisely so a sent quote keeps its prices when the rate card
 * moves next week. Re-deriving them here would reprice it, and prepending the
 * derived lines a second time would double the total. So a persisted group is
 * edited as lines, and only groups added in THIS session derive.
 */
function groupFromStored(g, importedIds, fallbackLabel) {
  return {
    tempId: g.id || `stored-${Math.random().toString(36).slice(2)}`,
    id: g.id,
    persisted: true,
    // Imported subcontractor cost: read-only here. The cost is fixed and the
    // markup is edited on the quote page (ImportedCostsPanel), but it still
    // counts in the total and still goes back with its id so it survives.
    imported: (importedIds || []).includes(g.id),
    categoryId: g.categoryId,
    categoryKey: g.category?.key || null,
    label: g.label || g.category?.label || fallbackLabel,
    isTiered: false,
    selectedTier: null,
    // Restored, not blanked. These drive the cost estimate, so a stored group
    // that came back with `{}` showed a costed quote as uncosted the moment it
    // was reopened.
    intakeValues: g.intakeValues || {},
    // Carried through untouched so a save doesn't blank the structured form
    // behind a stair or countertop group. Not rendered as an editor: editing
    // it would have to reprice, and repricing a sent quote is the thing the
    // flatten-at-save exists to prevent.
    takeoff: g.takeoff ?? null,
    lineItems: lineItemsFromStored(g.lineItems),
  };
}

// billedUnitsOf lives in lib/quotes/builderPayload.js now (pure, so the
// instant-draft check can execute it against a stored instant group).

/**
 * Everything the form starts from, in one shape, whichever mode it is in.
 *
 * Absent data stays absent — a create has no client and no status, and neither
 * is padded into something that looks like a statement.
 */
export function initialStateFromQuote(quote, { fallbackLabel = "Scope" } = {}) {
  if (!quote) {
    return {
      id: null,
      quoteNumber: null,
      status: null,
      client: null,
      language: null,
      groups: [],
      notes: "",
      reviewNotes: "",
      processNotes: null,
      clientPhotos: [],
      discount: "",
      taxEnabled: true,
      taxRate: null,
      validUntil: defaultValidUntil(),
      costing: null,
      assignedTo: null,
      siteAddress: "",
      taxResolution: null,
    };
  }

  const subtotal = num(quote.subtotal);
  const discount = num(quote.discount);
  // Recover the rate that was actually applied when the quote was written
  // rather than reading the company's current rate. If the company changed its
  // tax setting last month, re-saving an older quote must not reprice it.
  const base = subtotal - discount;
  const taxRate = base > 0 ? +((num(quote.tax) / base) * 100).toFixed(4) : 0;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber || null,
    status: quote.status || null,
    client: quote.client || null,
    language: quote.language || null,
    groups: (Array.isArray(quote.scopeGroups) ? quote.scopeGroups : []).map(
      (g) => groupFromStored(g, quote.importedGroupIds, fallbackLabel),
    ),
    notes: quote.notes || "",
    reviewNotes: quote.reviewNotes || "",
    processNotes: quote.processNotes || "",
    clientPhotos: Array.isArray(quote.clientPhotos) ? quote.clientPhotos : [],
    discount: discount ? String(discount) : "",
    taxEnabled: quote.taxEnabled !== false,
    taxRate,
    validUntil: quote.validUntil
      ? new Date(quote.validUntil).toISOString().slice(0, 10)
      : "",
    costing: null,
    assignedTo: quote.assignedTo || null,
    // Where the work is, as saved. "" for a quote written before the column
    // existed — the field then opens on the homeowner's own address, which is
    // what every reader of such a quote already assumed.
    siteAddress: quote.siteAddress || defaultSiteAddressFor(quote.client),
    // What the tax line said when the quote was written, so the edit screen
    // prints "HST 13% (Ontario)" from the record rather than re-resolving
    // (an edit never re-prices — see the tax effect below).
    taxResolution: readTaxResolution(quote.taxResolution),
  };
}

/**
 * The saved cost row → the four inputs the panel actually collects.
 *
 * Only PINNED crew hours come back as an input. A resolved even share is an
 * output; putting it in the box would freeze "split the pool evenly" into
 * hard-coded numbers the next save could not undo. Same rule QuoteCostEditor
 * documents — imported rather than restated would be better, but the two
 * panels take different shapes, so the rule is written down in both places.
 */
export function costingInputsFrom(costing) {
  if (!costing || !costing.saved) return null;
  return {
    crew: (Array.isArray(costing.crew) ? costing.crew : []).map((m) => ({
      id: m?.id ?? null,
      name: m?.name || "",
      rate: num(m?.hourlyRate ?? m?.rate),
      hours: m?.hoursExplicit ? (m?.hours ?? null) : null,
    })),
    addedLabourHours:
      costing.addedLabourHours === undefined || costing.addedLabourHours === null
        ? ""
        : String(costing.addedLabourHours),
    addedMaterialCost:
      costing.addedMaterialCost === undefined ||
      costing.addedMaterialCost === null
        ? ""
        : String(costing.addedMaterialCost),
    labourRate:
      costing.labourRate === undefined || costing.labourRate === null
        ? null
        : num(costing.labourRate),
    overheadPct:
      costing.overheadPct === undefined || costing.overheadPct === null
        ? null
        : num(costing.overheadPct),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The loader
// ───────────────────────────────────────────────────────────────────────────

export default function QuoteBuilder({ mode = "create", quoteId = null }) {
  const { t } = useTranslation();
  // The same grid question POST /api/quotes and PATCH /api/quotes/[id] ask.
  // See the refusal below, before the first return.
  const canWrite = useHasLevel("quotes", "view_create_edit");
  // ── And the second half, which no preset reaches but a custom grid can ──
  //
  // No preset pairs quotes:view_create_edit with showPricing:false — Dispatcher
  // and Manager hold both, and both Worker presets are view_only — so nobody in
  // the matrix is narrowed by this. A hand-edited grid CAN reach it, and what
  // that member would get is worse than a refusal: /api/products answers 403 so
  // the add-on catalogue is empty, and /api/settings/service-categories now
  // withholds `rateOverrides`, so getPriceBook() falls back to the CODE
  // defaults. They would price a quote off numbers that are not this company's
  // and never be told. Building a priced document is not something to do
  // half-blind.
  const canSeePrices = useHasToggle("showPricing");
  const [bootstrap, setBootstrap] = useState(null);
  const [initial, setInitial] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          clientsData,
          categoriesData,
          businessInfo,
          productsData,
          workersData,
          membersData,
          recipesData,
          overheadData,
          forecastData,
        ] = await Promise.all([
          // fetchJson throws on a non-ok/HTML-error response instead of feeding
          // a 404/500 body into a state setter — a failed load surfaces below
          // rather than rendering a corrupt builder.
          fetchJson("/api/clients"),
          fetchJson("/api/settings/service-categories"),
          fetchJson("/api/settings/business-info"),
          // Optional data: the builder still works without these, so a failure
          // degrades to the empty fallback rather than blocking the whole page.
          fetch("/api/products").then((r) => (r.ok ? r.json() : [])),
          fetch("/api/workers").then((r) => (r.ok ? r.json() : [])),
          // The roster the "Assigned to" picker offers — same endpoint the
          // appointments page already uses for the same purpose. Roles come
          // back with it so an estimator without quote:assign can still see
          // it is the account's default; the select itself is left enabled
          // for everyone since assigning YOURSELF needs no extra permission
          // — the server is what actually enforces reassigning to someone
          // else (see app/api/quotes/route.js).
          fetch("/api/settings/members").then((r) => (r.ok ? r.json() : [])),
          // Company-specific overrides on the internal cost recipe — see
          // Settings > Material Costs. Resolved server-side (defaults merged
          // with any saved overrides), so this is fed straight into
          // estimateQuoteCost() as-is.
          //
          // Both this and the overhead call below now answer 403 without the
          // jobCosting toggle (lib/permissions/costBasis.js). That lands on the
          // same fallback an empty override set already used, and `mayCost`
          // means the panel they feed is not rendered for that person anyway —
          // so the refusal costs nothing on screen and no branch is needed.
          fetch("/api/settings/material-recipes").then((r) =>
            r.ok ? r.json() : {},
          ),
          // Real overhead per job. Returns 400 with needsCapacity when the
          // company hasn't said how many jobs a week they can take — a
          // legitimate "we don't know", not an error to surface here, so the
          // panel falls back to the percentage and labels it. A 403 without
          // jobCosting arrives as a body with no costPerJob on it, which
          // resolves to the same null.
          fetch("/api/analytics/minimum-price")
            .then((r) => r.json().catch(() => null))
            .catch(() => null),
          // The company's own target margin (Settings → Overhead), so the
          // panel's badge measures against the number the owner chose. The
          // panel used a private 30 for a year while the setting sat unread;
          // lib/costing/marginTarget.js is the one definition now. A failed
          // read falls to the shared default, labelled as such by the review.
          fetch("/api/settings/forecast")
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);

        if (cancelled) return;

        setBootstrap({
          clients: Array.isArray(clientsData) ? clientsData : [],
          categories: Array.isArray(categoriesData)
            ? categoriesData.filter((c) => c.enabled)
            : [],
          products: Array.isArray(productsData) ? productsData : [],
          workers: Array.isArray(workersData) ? workersData : [],
          // ROSTER_SELECT rows: { id, userId, role, active, user:{id,name,email} }
          // — see app/api/settings/members. Filtered to active members only;
          // an assignee who has left the company shouldn't be offered for a
          // NEW pick even though an already-assigned quote keeps showing them
          // (start.assignedTo carries its own name, independent of this list).
          members: Array.isArray(membersData)
            ? membersData.filter((m) => m.active !== false)
            : [],
          recipeOverrides:
            recipesData && typeof recipesData === "object" ? recipesData : {},
          companyLanguage: businessInfo?.defaultLanguage || "en",
          // The billing currency, so every money render here matches the
          // document the client will receive.
          companyCurrency: businessInfo?.currency || null,
          // The company as the document's masthead prints it — name, logo,
          // address, phone, email, brand colour — and the e-transfer /
          // cheque switch the totals need. The document layout draws the
          // letterhead from this; the classic layout ignores it.
          company: businessInfo && typeof businessInfo === "object" ? businessInfo : null,
          // Which builder this company is on. Absent → classic, deliberately:
          // see resolveBuilderLayout.
          layout: resolveBuilderLayout(businessInfo?.quoteBuilderLayout),
          // What a saved quote WILL carry: the company's default is copied onto
          // Quote.processNotes at creation, so the "what happens next" box opens
          // holding it and the readiness panel doesn't warn about a company that
          // has already written one.
          defaultProcessNotes: businessInfo?.defaultProcessNotes || "",
          taxConfig: {
            taxRate: num(businessInfo?.taxRate),
            autoApplyLocalTax: Boolean(businessInfo?.autoApplyLocalTax),
            // auto | manual — lib/tax/taxMode.js. The route sends the
            // effective mode, never null.
            taxMode: businessInfo?.taxMode || null,
            taxRates: Array.isArray(businessInfo?.taxRates)
              ? businessInfo.taxRates
              : [],
            // The company's OWN country, not the client's. For B2C services
            // VAT is charged where the supplier is — see lib/tax/jurisdictions.js.
            country: businessInfo?.country || null,
            // And its province, which is what the rate is ASSUMED from when
            // the client's record can't answer. Never silently: see
            // lib/tax/documentTax.js and the note rendered below.
            province: businessInfo?.province || null,
            // Three-state, and `?? null` rather than `|| false`: an
            // unanswered VAT question must not arrive here as "not registered".
            vatRegistered: businessInfo?.vatRegistered ?? null,
            // The company's per-state US word — lib/tax/usOverrides.js.
            usTaxOverrides: businessInfo?.usTaxOverrides || null,
          },
          overheadPerJob: Number.isFinite(Number(overheadData?.costPerJob))
            ? Number(overheadData.costPerJob)
            : null,
          overheadSource: Number.isFinite(Number(overheadData?.costPerJob))
            ? {
                monthlyFixedCosts: overheadData.monthlyFixedCosts,
                jobsPerMonth: overheadData.jobsPerMonth,
              }
            : null,
          marginTargetPct: Number.isFinite(Number(forecastData?.targetMarginPct))
            ? Number(forecastData.targetMarginPct)
            : null,
        });
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || t("app.quoteNew.createError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Create: empty, or prefilled from a phone call ─────────────────────────
  //
  // `?fromCall=<voiceCallId>` opens the builder holding the scope FieldQuo AI
  // read off a finished call. It is a prefill and not a saved draft on purpose:
  // a stored scope group is `persisted`, and a persisted group is frozen — no
  // takeoff, no unit pricing, no derivation from the price book, because a sent
  // quote must keep the prices it was written with. Landing an AI draft as a
  // Quote row would therefore land it as scope the estimator can never price
  // from the rate card, only retype. Coming in this way, it goes through
  // exactly the code path a typed quote does, and nothing exists in the
  // database until a human presses Save.
  //
  // Prices are absent by construction: the draft carries categories and intake
  // answers, and every number on screen is computed here from the company's own
  // price book — same as if the estimator had picked the tiles themselves.
  useEffect(() => {
    if (mode === "edit") return;
    // Needs the category list to turn a category KEY from the draft into the
    // company's own row (id, rate card, custom fields).
    if (!bootstrap) return;

    // Read from the URL rather than useSearchParams: this component is shared
    // by two routes, and a hook that forces a Suspense boundary on both of them
    // to support one optional query parameter is the wrong trade.
    const callId =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("fromCall");

    if (!callId) {
      setInitial(initialStateFromQuote(null));
      return;
    }

    let cancelled = false;
    (async () => {
      const base = initialStateFromQuote(null);
      try {
        const res = await fetch(`/api/voice/calls/${callId}/draft-quote`);
        // A prefill that fails is still a working builder. It must never be an
        // error screen — the estimator came here to write a quote.
        if (!res.ok) throw new Error("no draft");
        const data = await res.json();
        if (cancelled) return;

        const draft = data?.draft;
        const cats = Array.isArray(bootstrap.categories)
          ? bootstrap.categories
          : [];
        const groups = (Array.isArray(draft?.groups) ? draft.groups : [])
          .map((g) => {
            // Second gate, client-side. The server already refused a category
            // this company doesn't sell; this refuses one it has since turned
            // off, so a stale draft can't add a service that is no longer on
            // the tiles.
            const category = cats.find((c) => c.key === g.categoryKey && c.enabled);
            if (!category) return null;
            return newScopeGroup(
              category,
              category.label,
              rateOverridesIn(cats, category.id),
              {
                tempId: crypto.randomUUID(),
                // Only what the caller actually said. Absent stays absent —
                // the boxes the call didn't answer open empty, and the
                // receptionist screen says which ones those were.
                intakeValues:
                  g.intakeValues && typeof g.intakeValues === "object"
                    ? g.intakeValues
                    : {},
                // The upgrades the caller asked for, as keys. newScopeGroup
                // ticks only the ones this company's own book prices and the
                // price book does the rest — the model never named a figure
                // and nothing here invents a quantity, so an upgrade on a call
                // where nobody counted doors opens ticked and worth nothing
                // until the estimator types the count.
                addOns: (Array.isArray(g.addOns) ? g.addOns : [])
                  .map((a) => a?.key)
                  .filter(Boolean),
              },
            );
          })
          .filter(Boolean);

        const client =
          (draft?.clientId &&
            (bootstrap.clients || []).find((c) => c.id === draft.clientId)) ||
          null;

        setInitial({
          ...base,
          groups,
          client,
          // What the call asked for that the draft could not place. Lands in
          // the INTERNAL review box, never in `notes` — see the schema comment
          // on Quote.reviewNotes.
          reviewNotes: typeof draft?.reviewNotes === "string" ? draft.reviewNotes : "",
        });
      } catch {
        if (!cancelled) setInitial(base);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, bootstrap]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!quoteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotes/${quoteId}`);
        if (!res.ok) throw new Error(t("app.quoteEdit.loadError"));
        const q = await res.json();
        if (cancelled) return;

        const base = initialStateFromQuote(q, {
          fallbackLabel: t("app.quoteEdit.scopeFallback"),
        });

        // The cost row is deliberately NOT on the quote's own GET — see
        // app/api/quotes/[id]/costing/route.js for why. A 403 there is normal:
        // job costing is a permission, and the panel simply isn't offered.
        //
        // Loaded BEFORE the form mounts, and its absence recorded, because a
        // PATCH that sends an empty costing block over an existing row is read
        // as "the estimator cleared the panel" and wipes it. Not knowing is not
        // the same as clearing, so a failed load means the block is omitted.
        let costing = null;
        let costingLoaded = false;
        try {
          const r = await fetch(`/api/quotes/${quoteId}/costing`);
          if (r.ok) {
            costing = await r.json();
            costingLoaded = true;
          } else if (r.status === 403) {
            costingLoaded = false;
          }
        } catch {
          costingLoaded = false;
        }

        if (!cancelled)
          setInitial({
            ...base,
            costing,
            costingLoaded,
            currency: q.company?.currency || null,
            quote: q,
          });
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, quoteId]);

  // ── Refused before the work, not after it ────────────────────────────────
  //
  // POST /api/quotes and PATCH /api/quotes/[id] both require
  // quotes:view_create_edit, and both correctly refuse a member at view_only.
  // The screen did not: QA opened the full builder, filled it in, pressed Save,
  // and got a 403 that set an error banner at the top of a page whose Save
  // button is at the bottom — so from where they were standing nothing
  // happened at all.
  //
  // Placed here rather than in the two route wrappers because
  // scripts/check-quote-builder.mjs requires those to stay thin — and because
  // there is one screen behind both of them, which is the entire point of this
  // component. Both verbs, one rule, one place.
  if (!canWrite || !canSeePrices) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-muted border border-border rounded-xl p-5 text-sm text-muted-foreground">
          {canWrite
            ? t(
                "app.access.pricingHidden",
                "Pricing is hidden by your access level. Ask an owner or admin if you need to see it.",
              )
            : t(
                "app.access.cannotCreateQuote",
                "Your access level lets you view quotes, not create them. Ask an owner or admin if you need to write one.",
              )}
        </div>
      </div>
    );
  }

  if (loadError && !initial) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
          {loadError ||
            (mode === "edit"
              ? t("app.quoteEdit.notFound")
              : t("app.quoteNew.createError"))}
        </div>
      </div>
    );
  }

  if (!bootstrap || !initial) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  }

  return (
    <QuoteBuilderForm
      mode={mode}
      quoteId={quoteId}
      bootstrap={bootstrap}
      initial={initial}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// The screen
// ───────────────────────────────────────────────────────────────────────────

export function QuoteBuilderForm({
  mode = "create",
  quoteId = null,
  bootstrap,
  initial,
}) {
  const { t, language: lang } = useTranslation();
  const router = useRouter();
  const caller = usePermissions();
  const isEdit = mode === "edit";

  const boot = bootstrap || {};
  const settingsAccess = useSettingsAccess();
  const start = initial || initialStateFromQuote(null);
  // The company's own extra boxes for a quote (Settings > Custom fields).
  // Saved against the quote's id straight after the quote itself saves —
  // for a new quote, the id the POST just minted. NOT part of `shared`: the
  // values route validates by the definition's type, and threading them
  // through PATCH /api/quotes would mean a second copy of that validation.
  const cf = useCustomFields("quote", quoteId);

  const categories = Array.isArray(boot.categories) ? boot.categories : [];
  const products = Array.isArray(boot.products) ? boot.products : [];
  const workers = Array.isArray(boot.workers) ? boot.workers : [];
  const teamRoster = Array.isArray(boot.members) ? boot.members : [];
  const recipeOverrides =
    boot.recipeOverrides && typeof boot.recipeOverrides === "object"
      ? boot.recipeOverrides
      : {};
  const companyLanguage = boot.companyLanguage || "en";
  // A saved quote formats in the currency ON the quote's company; a new one in
  // the company the estimator is signed into. Same value in practice, but the
  // edit route already had the authoritative one and dropping it would put the
  // fallback back on screen.
  const companyCurrency = start.currency ?? boot.companyCurrency ?? null;
  // The company's own target, or the shared default — the same resolution
  // the server makes when it freezes the row (companyMarginTarget).
  const marginTarget = boot.marginTargetPct ?? MARGIN_TARGET_PCT;

  // Same question the server asks of the same grid — lib/permissions/enforce.
  // Null means the provider resolved nothing, and the documented convention
  // there is "show everything"; the server refuses regardless.
  const mayCost = caller ? hasToggle(caller, "jobCosting") : true;

  // How long this quote actually took to build. Only on a create: an edit is
  // not composition, and lib/analytics/composeTimer explains why createdAt →
  // sentAt cannot answer the question either.
  const composeTimer = useRef(null);
  useEffect(() => {
    if (isEdit) return;
    composeTimer.current = startComposeTimer();
    // Abandoned drafts report nothing rather than a stray number — a quote
    // nobody finished says nothing about how long finishing one takes.
    return () => composeTimer.current?.cancel();
  }, [isEdit]);

  // ── Client ───────────────────────────────────────────────────────────────
  const [clients, setClients] = useState(() =>
    Array.isArray(boot.clients) ? boot.clients : [],
  );
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(start.client || null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClient, setNewClient] = useState({
    type: "individual",
    name: "",
    // Null = follow the company default, and null is DELIBERATE rather than
    // seeded with companyLanguage: writing the current default onto the row
    // freezes this client to it, so a company that later switches its default
    // keeps sending them the old language for ever. See LanguagePicker.
    //
    // It was absent entirely, which is why a client quick-added from the
    // builder had no language at all — the quote language bar's "this client
    // receives documents in X" warning could never fire for them, and every
    // document they ever got came out in the company default by omission
    // rather than by choice. The full client form has always asked.
    language: null,
    contactName: "",
    email: "",
    phone: "",
    address: "",
    // Set by the address autocomplete, not by a field the user sees. They
    // decide whether local tax applies, so dropping them meant every
    // quick-added client was quietly untaxed.
    //
    // `country` was missing from this object entirely, so ClientPicker had
    // nowhere to put it even once it stopped discarding it — and without a
    // country the province is inert (see lib/tax/documentTax.js).
    city: "",
    postalCode: "",
    county: "",
    province: "",
    country: "",
  });

  // The language this quote is WRITTEN in, fixed at creation. Not a display
  // preference — the stored line items and the PDF are produced in it, and it
  // never changes afterwards (non-negotiable #6).
  const [quoteLanguage, setQuoteLanguage] = useState(start.language || null);
  // Where the work is (Quote.siteAddress). Prefilled from a homeowner when
  // they are picked, typed for a company client — see JobAddressField.
  const [siteAddress, setSiteAddress] = useState(start.siteAddress || "");

  // ── Scope ────────────────────────────────────────────────────────────────
  const [scopeGroups, setScopeGroups] = useState(start.groups || []);
  const [reasonsOpen, setReasonsOpen] = useState({});

  // ── Terms & content ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState(start.notes || "");
  // INTERNAL. What a caller asked for that the draft could not place — never
  // rendered on a document. A second field rather than a prefix on `notes`
  // because `notes` goes on the PDF the homeowner opens, and one forgotten
  // deletion would put "we couldn't work out what you meant" in front of them.
  const [reviewNotes, setReviewNotes] = useState(start.reviewNotes || "");
  // So "Add to notes for review" can bring the box it wrote into view.
  const reviewNotesRef = useRef(null);
  const [processNotes, setProcessNotes] = useState(
    // On a create, the company's default is what the saved quote WILL carry,
    // so the box opens holding it rather than blank — editing it now writes a
    // per-quote version instead of the default, which is the whole point of
    // having the box here at all.
    start.processNotes ?? boot.defaultProcessNotes ?? "",
  );
  const [clientPhotos, setClientPhotos] = useState(start.clientPhotos || []);
  // Who's working this quote. "" means unset — on a create that resolves to
  // the person saving it (POST /api/quotes defaults assignedToId to the
  // caller when the body omits it); on an edit it means the quote genuinely
  // has nobody named, which an auto-estimated draft can honestly be. Seeded
  // from start.assignedTo (the User relation, not just the id) so the select
  // can show a name without a second lookup.
  const [assignedToId, setAssignedToId] = useState(start.assignedTo?.id || "");
  // Same discipline as taxRateTouched: PATCH only reassigns when the request
  // SAYS to. Sending the unchanged value on every save of somebody else's
  // quote would make "add a note" require quote:assign for no reason.
  const [assignedToTouched, setAssignedToTouched] = useState(false);
  const [discount, setDiscount] = useState(start.discount ?? "");
  const [taxEnabled, setTaxEnabled] = useState(start.taxEnabled !== false);
  const [taxRate, setTaxRate] = useState(
    start.taxRate ?? num(boot.taxConfig?.taxRate),
  );
  const [taxNote, setTaxNote] = useState("");
  // A caveat about the resolved rate, distinct from the note explaining where
  // it came from. Empty most of the time.
  const [taxCaution, setTaxCaution] = useState("");
  // Set when the rate came from the COMPANY's province because the client's
  // record could not answer. Rendered as a warning, not a note — it is a guess
  // that costs money when it is wrong.
  const [taxAssumed, setTaxAssumed] = useState("");
  // Has the estimator edited the rate by hand on this quote? Once true, the
  // resolver stops writing to the box. See the effect below.
  const [taxRateTouched, setTaxRateTouched] = useState(false);
  // Whether this job is renovation of a dwelling, which is what qualifies for
  // the EU reduced VAT rate. Null = the standard rate.
  //
  // It is a QUESTION and not an inference. Every reduced rate in
  // lib/tax/jurisdictions.js carries conditions FieldQuo cannot check from a
  // quote — how old the dwelling is, what share of the contract is materials,
  // whether the property sits in a designated area — so the contractor
  // answers and the conditions are printed next to the choice.
  const [vatWorkType, setVatWorkType] = useState(null);
  // What the resolver found: components, the US state base, the EU rates.
  // Null until a client is picked.
  const [taxDetail, setTaxDetail] = useState(null);
  // The whole resolution, for the tax line's sentence ("HST 13% (Ontario) ·
  // from the job address") — lib/tax/taxLine.js reads it.
  const [taxResult, setTaxResult] = useState(null);
  const [taxSchemeNote, setTaxSchemeNote] = useState("");
  const [validUntil, setValidUntil] = useState(start.validUntil ?? "");

  // ── Cost & margin (internal, never client-facing) ────────────────────────
  const seededCosting = useMemo(
    () => costingInputsFrom(start.costing),
    [start.costing],
  );
  const [crew, setCrew] = useState(seededCosting?.crew || []);
  // What an hour of crew COSTS the company, not what it bills for. $35 is the
  // burdened cost of a crew member paid around $25/hr; a charge-out rate here
  // understates margin on every quote. Overridden per quote, and superseded
  // entirely when a worker with an hourlyRate is assigned.
  const [fallbackRate, setFallbackRate] = useState(
    seededCosting?.labourRate ?? FALLBACK_LABOUR_RATE,
  );
  const [overheadPct, setOverheadPct] = useState(
    seededCosting?.overheadPct ?? FALLBACK_OVERHEAD_PCT,
  );
  // The estimator's own read on this job, on top of whatever a recipe worked
  // out. Kept as strings so an empty box stays empty instead of snapping to 0.
  const [manualLabourHours, setManualLabourHours] = useState(
    seededCosting?.addedLabourHours ?? "",
  );
  const [manualMaterialCost, setManualMaterialCost] = useState(
    seededCosting?.addedMaterialCost ?? "",
  );

  // ── Page state ───────────────────────────────────────────────────────────
  // "" | "draft" | "sent" | "review" — which action is in flight, not merely
  // that one is. The totals bar spins only the button that was pressed.
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef(null);

  // ── The stale-write guard's client half ─────────────────────────────────
  //
  // `version` is the quote's `updatedAt` as this screen loaded it. It rides
  // along on every PATCH; the server refuses the write if the stored value has
  // moved, which is what stops this form — which posts EVERY field, including
  // the ones nobody touched — from silently overwriting a colleague's save.
  // See lib/concurrency/staleWrite.js.
  //
  // Null on a create, and on an edit where the load somehow returned no
  // timestamp: missing means unguarded, which is the same behaviour this
  // screen had before the guard existed. Never invented.
  const [version, setVersion] = useState(start.quote?.updatedAt ?? null);
  const [conflict, setConflict] = useState(null);
  const conflictRef = useRef(null);
  const [showTour, setShowTour] = useState(false);
  const [pendingSend, setPendingSend] = useState(null);

  // See the banner's own note further down: it renders at the top of a very
  // long page and the Save buttons are at the bottom, so a refusal set here
  // was invisible from where it was triggered.
  // Same reason as the error banner below it: the Save buttons are at the
  // bottom of a page several screens long, and a refusal nobody can see is a
  // refusal that failed silently.
  useEffect(() => {
    if (conflict)
      conflictRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [conflict]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  // Arrived from the builder's "Save & review". Read from the URL once and then
  // stripped, so a refresh doesn't spend tokens on a second review nobody asked
  // for — the click that authorised the first one is long gone.
  //
  // Read off window rather than useSearchParams() on purpose: that hook forces
  // the route into a Suspense boundary at build time for one boolean.
  const [autoReview, setAutoReview] = useState(false);
  useEffect(() => {
    if (!isEdit || typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("review")) return;
    setAutoReview(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, [isEdit]);

  // Line items are only editable while the quote is open. PATCH refuses
  // scopeGroups on a decided quote — editing them would rewrite what was agreed
  // and could delete a subcontractor cost already materialised into a job
  // expense. Until this existed the edit page rendered live inputs over that
  // refusal and every Save on an accepted quote came back 400.
  const canEditScope = !isEdit || OPEN_STATUSES.includes(start.status);

  // ── Tax ──────────────────────────────────────────────────────────────────
  //
  // Only re-resolved on a CREATE. An existing quote carries the rate that was
  // applied when it was written; re-resolving would silently reprice it if the
  // company changed its tax setting last month.
  //
  // Fires only when Settings → Tax has "apply the client's local rate" switched
  // on. The reason is surfaced beside the tax line rather than left implicit —
  // a tax figure that moves on its own with no explanation is worse than one
  // the user picked.
  useEffect(() => {
    if (isEdit) return;
    // A rate the estimator typed by hand is a decision, and this effect
    // re-runs every time the client changes. Without this guard, picking a
    // client after overriding the rate silently threw the override away — the
    // exact "must not override a rate a contractor deliberately typed" case.
    // The note still updates, so they can see what the resolver WOULD have
    // chosen and put it back if they want it.
    const config = boot.taxConfig;
    if (!config) return;
    // resolveDocumentTax, not resolveTaxRate directly: it is the same
    // resolver with one layer over it, which falls back to the COMPANY's own
    // province when the client's record cannot answer. That fallback is the
    // owner's instruction and it is a guess — `result.assumed` says so, and
    // the note below puts it on screen naming the province. Never silent.
    const result = resolveDocumentTax({
      company: config,
      taxRates: config.taxRates,
      client: selectedClient,
      // Where the work is. Services on real property are taxed where the
      // property is, so the job address answers before the client's own
      // record does — an Ottawa client's Gatineau job is Quebec's rate.
      siteAddress,
      workType: vatWorkType,
      // The builder's own language, not the quote's: this note is read by the
      // estimator on screen and never appears on the document the client
      // receives, so it follows the person looking at it.
      lang,
    });
    if (!taxRateTouched) setTaxRate(result.rate);
    setTaxDetail(result.detail);
    setTaxResult(result);
    // A national relief scheme that is NOT a rate cut — Sweden's ROT credit,
    // Iceland's labour-VAT refund. Shown so the null reduced rate beside it
    // doesn't read as something we forgot to fill in.
    setTaxSchemeNote(
      result.detail?.schemeNoteKey ? t(result.detail.schemeNoteKey) : "",
    );

    // ── The assumption gets its own line, louder than the note ────────────
    //
    // When the rate came from the company's province rather than the client's,
    // saying "using your Ontario rate" in the quiet grey note would read as a
    // determination. It is not one. His own data is the argument: TrueFinish
    // is in Ottawa and the client Emilio Boves is in Gatineau — 14.975%, not
    // 13% — and that river has contractors on both sides of it every week.
    setTaxAssumed(
      result.assumed
        ? t(
            selectedClient ? "app.tax.assumed.note" : "app.tax.assumed.noClient",
            {
              region: result.assumedRegion || "",
              client: selectedClient?.name || "",
            },
          )
        : "",
    );

    // The mode is not consulted here: in `manual` the resolver already
    // answered with the company's own rate, and explainTaxSource has nothing
    // to add for that (lib/tax/taxLine.js prints "your default rate").
    const note =
      selectedClient && !result.assumed
        ? explainTaxSource(result, selectedClient, lang)
        : null;
    // explainTaxSource returns a key plus params, never a sentence — it used
    // to hand back hardcoded English that went straight onto a French screen.
    // The US note is several keys assembled in the reader's language;
    // renderTaxNote knows which shape it was handed.
    setTaxNote(renderTaxNote(note, t));
    // The jurisdiction's own caveat, where there is one: PST on real property
    // in BC/MB, "state base only" in the US, "you told us you're not VAT
    // registered". Separate from the note because it qualifies the number
    // rather than explaining where it came from.
    setTaxCaution(result.cautionKey ? t(result.cautionKey) : "");
  }, [isEdit, boot.taxConfig, selectedClient, siteAddress, taxRateTouched, vatWorkType, lang, t]);

  // ── The tax line, in words ───────────────────────────────────────────────
  //
  // On a create: the live resolution, unless the estimator has typed over it
  // — then the box is the truth and the line says so. On an edit: the record
  // the quote was written with, else the rate recovered from its money.
  const taxLine = (() => {
    const rate = num(taxRate);
    const typed = { source: "manual", rate };
    let basis;
    let recovered = false;
    if (isEdit) {
      const stored = start.taxResolution;
      if (stored && Math.abs(num(stored.rate) - rate) < 0.005) basis = stored;
      else {
        basis = typed;
        // A rate read back out of an older quote's money, not one anybody
        // typed on this screen — no provenance sentence for it.
        recovered = !taxRateTouched;
      }
    } else {
      basis = taxRateTouched ? typed : taxResult;
    }
    const resolved = taxLineResolved(basis);
    const headline = resolved ? taxLineHeadline(basis, lang) : null;
    const source = resolved && !recovered ? taxLineSource(basis) : null;
    const hint = resolved ? null : taxLineUnresolvedHint(basis, { place: taxPlaceOf(selectedClient) });
    return {
      resolved,
      headline: headline ? t(headline.key, headline.params) : "",
      source: source ? t(source.key, source.params) : "",
      hint: hint ? t(hint.key, hint.params) : "",
    };
  })();

  // ── Scope group helpers ──────────────────────────────────────────────────

  // A product with no linked quote types is available everywhere (e.g. a
  // generic "Rush Fee"); otherwise it only shows up for a scope group whose
  // category is one of the ones it's linked to.
  function getProductsForCategory(categoryId) {
    return products.filter(
      (p) =>
        !Array.isArray(p.categories) ||
        p.categories.length === 0 ||
        p.categories.some((c) => c.id === categoryId),
    );
  }

  // Custom quote types store their chosen fields directly on the category
  // (group.customFields); system categories keep using the static
  // quoteIntakeFields.js lookup. Same field shape either way.
  function getGroupFields(group) {
    return fieldsForCategory({
      key: group.categoryKey,
      customFields: group.customFields,
    });
  }

  // This company's saved edits to the trade's price book. The categories
  // endpoint returns the sparse patch alongside the resolved book, so the
  // builder prices from exactly what Settings shows.
  function rateOverridesFor(categoryId) {
    return rateOverridesIn(categories, categoryId);
  }

  // This company's saved WORDING for a service — the scope paragraph and the
  // "what's included" list Settings > Services edits — as the sparse patch
  // resolveServiceContent takes. Null when they sit on the catalogue's
  // defaults. Used twice: the group card shows the paragraph the client will
  // read under the service, and the readiness checks judge bare lines
  // against it (lib/quotes/completeness.js groupScopeParagraph).
  function wordingOverrideFor(categoryId) {
    const cat = categories.find((c) => c.id === categoryId);
    const o = cat?.contentOverrides;
    if (!o) return null;
    return {
      scopeDescription: o.scopeDescription ?? null,
      includedItems: o.includedItems ?? null,
      processSteps: o.processSteps ?? null,
    };
  }

  // The shape itself lives in lib/quotes/builderPayload.js, because the phone-
  // call prefill below needs exactly the same one and a second copy of "what a
  // new group looks like" is the duplication that rots.
  function addScopeGroup(category, label) {
    setScopeGroups((prev) => [
      ...prev,
      newScopeGroup(category, label, rateOverridesFor(category.id), {
        tempId: crypto.randomUUID(),
      }),
    ]);
  }

  /**
   * The painting company's first answer — "what kind of estimate is this?"
   * (EstimateTypeFirst.js) — becomes the painting service itself, with the
   * type on its takeoff, so the estimator never meets a tile for painting.
   * The group is the one newScopeGroup builds for the tile; only
   * `takeoff.estimateType` differs, and it is the field PaintAreas reads.
   */
  function addPaintingEstimate(estimateType) {
    // Owner's decision (2026-09-22): a company selling cabinet refinishing
    // or refacing has ONE cabinet takeoff — that trade's doors / drawers /
    // complexity card — and the painter's "Cabinets & millwork" card opens
    // it, refinishing first as the higher-volume trade. The painting
    // substrate list stays for a painter with no cabinet trade. Nothing
    // stored changes: this only decides which group a fresh pick creates.
    if (estimateType === "cabinets") {
      const cabinet = UNIT_PRICED_CATEGORIES.map((key) =>
        categories.find((c) => c?.key === key),
      ).find(Boolean);
      if (cabinet) {
        addScopeGroup(cabinet, cabinet.label);
        return;
      }
    }
    const category = paintingCategoryFor(estimateType, categories);
    if (!category) return;
    // The heading the CLIENT reads. The parent service's name only when it
    // IS the estimate — "Interior Painting" over an interior estimate; over
    // a cabinets, staining or commercial one it was the owner's report
    // ("Cabinets & millwork" created a group titled Interior Painting). The
    // type's label, in the document's own language (non-negotiable #6),
    // from the same catalogue the cards print it from.
    const own =
      (estimateType === "interior" && category.key === "interior_painting") ||
      (estimateType === "exterior" && category.key === "exterior_painting");
    const lang = String(quoteLanguage || companyLanguage || "en").slice(0, 2).toLowerCase();
    const key = `app.paint.type.${estimateType}`;
    const label = own
      ? category.label
      : APP_MESSAGES[lang]?.[key] ||
        APP_MESSAGES.en[key] ||
        PAINT_ESTIMATE_TYPES[estimateType]?.label ||
        category.label;
    const group = newScopeGroup(category, label, rateOverridesFor(category.id), {
      tempId: crypto.randomUUID(),
    });
    setScopeGroups((prev) => [
      ...prev,
      group.takeoff ? { ...group, takeoff: { ...group.takeoff, estimateType } } : group,
    ]);
  }

  function removeScopeGroup(tempId) {
    setScopeGroups((prev) => prev.filter((g) => g.tempId !== tempId));
  }

  function updatePricing(groupTempId, patch) {
    setScopeGroups((prev) =>
      prev.map((g) => (g.tempId === groupTempId ? { ...g, ...patch } : g)),
    );
  }

  /**
   * A quantity or a unit price the estimator typed over on a bill-of-materials
   * line, stored on the takeoff the bill was derived from.
   *
   * On the takeoff, not in component state, for the reason every override in
   * this file lives where the thing it overrides lives: `QuoteScopeGroup.takeoff`
   * is Json and round-trips verbatim, so this is saved with the quote and read
   * back by lib/costing/tradeMaterials.js — which is the one function the cost
   * panel, the job's sourcing list and the job-costing screen all already call.
   * State here would have shown a corrected price on screen and sent the yard
   * to buy against the old one.
   *
   * `patch === null` clears the material's entry entirely, which is what the
   * line's "back to the price book" control asks for. A patch key set to null
   * clears that one field and leaves the other — typing a price and then
   * emptying the quantity box must not also throw the price away.
   */
  function updateMaterialOverride(groupTempId, materialKey, patch) {
    if (!materialKey) return;
    setScopeGroups((prev) =>
      prev.map((g) => {
        // `persisted` re-checked here as well as in the caller's list: this
        // is the function that writes, and a guard on the screen is not a
        // guard on the write.
        if (g.tempId !== groupTempId || !g.takeoff || g.persisted) return g;
        const all = { ...(g.takeoff.materialOverrides || {}) };
        if (patch === null) {
          delete all[materialKey];
        } else {
          const next = { ...(all[materialKey] || {}) };
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || !Number.isFinite(Number(v))) {
              delete next[k];
            } else {
              next[k] = Number(v);
            }
          }
          if (Object.keys(next).length === 0) delete all[materialKey];
          else all[materialKey] = next;
        }
        return { ...g, takeoff: { ...g.takeoff, materialOverrides: all } };
      }),
    );
  }

  function updateIntakeValue(groupTempId, fieldKey, value) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, intakeValues: { ...g.intakeValues, [fieldKey]: value } }
          : g,
      ),
    );
  }

  // Several answers at once — the traced lot writes its area and its outline
  // together, and two separate setState calls would let a render see one
  // without the other.
  function updateIntakeValues(groupTempId, patch) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, intakeValues: { ...g.intakeValues, ...patch } }
          : g,
      ),
    );
  }

  // The measured evidence on a group that has no structured takeoff form —
  // the traced lawn's outline in lat/lng, for the document. Merged, so a
  // later patch (the save route's captured still) is not thrown away by an
  // earlier one.
  //
  // `patch` may be a FUNCTION of the current takeoff. Two effects on a paving
  // group write its takeoff in the same commit — the designer's traced totals
  // and the panel's still frame — and each closes over the takeoff of the
  // render that scheduled it, so whichever ran second replaced the first
  // with a stale copy. A function of the previous value composes instead.
  function updateTakeoff(groupTempId, patch) {
    setScopeGroups((prev) =>
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        const current = g.takeoff || {};
        return {
          ...g,
          takeoff: typeof patch === "function" ? patch(current) : { ...current, ...patch },
        };
      }),
    );
  }

  // The lawn program picker's lines replace the picker's OWN previous lines
  // (they carry meta.lawn) and leave anything typed by hand where it is.
  function replaceLawnLines(groupTempId, lines) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, lineItems: [...lines, ...splitLawnLines(g.lineItems).other] }
          : g,
      ),
    );
  }

  function toggleComplexityReason(groupTempId, reasonId) {
    setScopeGroups((prev) =>
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        const current = g.complexityReasons || [];
        return {
          ...g,
          complexityReasons: current.includes(reasonId)
            ? current.filter((r) => r !== reasonId)
            : [...current, reasonId],
        };
      }),
    );
  }

  function selectTier(groupTempId, tierKey, tierLabel) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? {
              ...g,
              selectedTier: tierKey,
              lineItems: [
                {
                  description: `${g.label} — ${tierLabel}`,
                  quantity: 1,
                  unit: "flat",
                  rate: 0,
                  amount: 0,
                },
              ],
            }
          : g,
      ),
    );
  }

  function updateLineItem(groupTempId, itemIndex, field, value) {
    setScopeGroups((prev) =>
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        // Shared so the amount can never be recomputed one way in the table and
        // another on save. It also coerces: a stored line with no rate, or a
        // half-typed "-", would otherwise write NaN into the amount, and NaN
        // reaches a Decimal column as null or as a crash.
        const lineItems = g.lineItems.map((item, i) =>
          i === itemIndex ? applyLineItemEdit(item, field, value) : item,
        );
        return { ...g, lineItems };
      }),
    );
  }

  function addLineItem(groupTempId) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? {
              ...g,
              lineItems: [
                ...g.lineItems,
                { description: "", quantity: 1, unit: "flat", rate: 0, amount: 0 },
              ],
            }
          : g,
      ),
    );
  }

  /**
   * Adds a Product from Settings > Products & Services (or a seeded standard
   * add-on) as a line.
   *
   * Built by lib/quotes/lineDetail.js rather than here, because this is where
   * the product's description used to be dropped: name, unit and price were
   * copied and the one-line scope text was not, so "Soft-Close Hinges" reached
   * the document and the AI review as a bare name. The helper copies the
   * description into the line's `detail`, in the quote's own language.
   */
  function addProductLineItem(groupTempId, product) {
    const line = lineFromProduct(product, {
      language: quoteLanguage || companyLanguage,
      defaultLanguage: companyLanguage,
    });
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, lineItems: [...g.lineItems, line] }
          : g,
      ),
    );
  }

  /**
   * Adds one of the trade's habitual extras.
   *
   * Rate deliberately 0: app/data/defaultLineItems.js ships the LIST, not
   * prices. Knowing a countertop job bills a disposal fee is the part people
   * forget; what to charge for it is the part they already know, and a
   * plausible-looking default would end up on a client's quote unread.
   */
  function addSuggestedLineItem(groupTempId, suggestion) {
    // lineFromSuggestion copies the catalogue's `detail` under the name and
    // carries `catalogKey` so the builder can look the line's benchmark up
    // while the rate is still blank. Local to the editor — the request body
    // drops the key and no document reads it, because a benchmark is
    // FieldQuo's research, not this company's price.
    const line = lineFromSuggestion(suggestion);
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, lineItems: [...g.lineItems, line] }
          : g,
      ),
    );
  }

  /**
   * A line the library dialog built — a text block, priced or not. Appended
   * as-is: the dialog already resolved the language and computed the amount
   * through the same pure helper the check script runs.
   */
  function addLibraryLine(groupTempId, line) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId ? { ...g, lineItems: [...g.lineItems, line] } : g,
      ),
    );
  }

  // ── A service's estimate template, expanded ─────────────────────────────
  //
  // "Add with its template lines" beside a service in the library. The lines
  // are built by lib/quotes/serviceTemplateLines.js from the company's own
  // Product row, in the quote's language, with every measured quantity the
  // quote's groups already hold filled in and said so. The plain row click
  // (addProductLineItem above) is untouched.
  function templateMeasurements(groupTempId) {
    return measurementsFromGroups(scopeGroups, { targetTempId: groupTempId });
  }

  function templateOfferedOn(group, product) {
    return templateOffered(product, {
      categoryId: group.categoryId,
      categoryKey: group.categoryKey,
      estimateType: group.takeoff?.estimateType || null,
    });
  }

  function addProductTemplate(groupTempId, product) {
    const { lines } = expandServiceTemplate(product, {
      measurements: templateMeasurements(groupTempId),
      language: quoteLanguage || companyLanguage,
      companyLanguage,
      currency: companyCurrency,
      runId: crypto.randomUUID(),
    });
    if (!lines.length) return;
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId ? { ...g, lineItems: [...g.lineItems, ...lines] } : g,
      ),
    );
  }

  function refillTemplate(groupTempId, runId) {
    const m = templateMeasurements(groupTempId);
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId ? { ...g, lineItems: refillTemplateRun(g.lineItems, runId, m) } : g,
      ),
    );
  }

  // "Open room takeoff" under a line still waiting for its figure. The
  // document layout registers how it opens a group (it folds them); the
  // classic layout has every group open already, so it scrolls.
  const calculatorOpenerRef = useRef(null);
  function openCalculator(tempId) {
    if (calculatorOpenerRef.current) {
      calculatorOpenerRef.current(tempId);
      return;
    }
    if (typeof document === "undefined") return;
    const el = document.querySelector(`[data-scope-group-anchor="${CSS.escape(String(tempId))}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * The rate an hourly text block opens on: the trade's hourly sell rate
   * from its price book where it has one (painting's hourlySellRate), else
   * the category's own default rate. Null when neither is set — the box
   * then opens blank rather than on a number nobody chose.
   */
  function hourlyRateFor(group) {
    const book = getPriceBook(group.categoryKey, rateOverridesFor(group.categoryId));
    const fromBook = num(book?.hourlySellRate);
    if (fromBook > 0) return fromBook;
    const cat = categories.find((c) => c.id === group.categoryId);
    return cat?.defaultRate != null ? num(cat.defaultRate) : null;
  }

  function removeLineItem(groupTempId, itemIndex) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, lineItems: g.lineItems.filter((_, i) => i !== itemIndex) }
          : g,
      ),
    );
  }

  // ── Derived money ────────────────────────────────────────────────────────
  //
  // Both of these are one-line calls into lib/quotes/builderPayload.js. They
  // are there and not here so the same arithmetic that renders can be executed
  // by a check script, in both modes, against the same group.

  function groupTotal(g) {
    return groupSubtotal(g, rateOverridesFor(g.categoryId));
  }

  // The aerial still for paving and the landscaping trades used to be
  // fetched here, once per client. It now belongs to each measuring panel
  // (PavingTakeoff, LotAreaMeasure) through useSatelliteStill.js: the still
  // is taken from the address the estimator chose for THAT takeoff — the job
  // site, which is often not the billing address — at the zoom they chose,
  // and both are stored on the takeoff. The client's address is passed down
  // as the default; nothing is geocoded until a panel that can use it mounts.

  const subtotal = round2(
    scopeGroups.reduce((sum, g) => sum + groupTotal(g), 0),
  );

  // Worked out in lib/quotes/totals.js, which the invoice editor uses too. Tax
  // is charged on subtotal MINUS discount — billing tax on money the client was
  // never charged is the bug this shares a helper to prevent — and the discount
  // is capped at the subtotal so an extra zero cannot produce a negative total.
  const {
    discount: appliedDiscount,
    taxableBase,
    tax,
    total,
  } = quoteTotals({ subtotal, discount, taxRate, taxEnabled });

  // Crew hours the priced takeoffs imply — "how long will this take", which is
  // both a cost input and the answer to the question every client asks.
  const takeoffLabourHours = scopeGroups.reduce(
    (sum, g) =>
      sum +
      (g.takeoff
        ? tradeLabourHours(g.categoryKey, g.takeoff, rateOverridesFor(g.categoryId))
        : 0),
    0,
  );

  // Doors bought for a refacing job — a real supplier cost, not a consumable a
  // coverage rate predicts.
  const purchasedMaterialCost = scopeGroups.reduce((sum, g) => {
    if (!g.takeoff) return sum;
    const cost = estimateCabinetDoorCost(
      g.takeoff,
      getPriceBook(g.categoryKey, rateOverridesFor(g.categoryId)) || {},
    );
    return sum + (cost?.total || 0);
  }, 0);

  const estimate = estimateQuoteCost({
    // The company's rate overrides ride along with each group, so the cost side
    // reads the same book the priced lines were built from.
    scopeGroups: scopeGroups.map((g) => ({
      ...g,
      rateOverrides: rateOverridesFor(g.categoryId),
    })),
    labourRatePerHour: num(fallbackRate),
    crew,
    // Hours the takeoffs imply, plus anything the estimator added by hand.
    // Both, not either: a recipe or a productivity rate is a prediction, and
    // the estimator standing on the site is allowed to know better.
    manualLabourHours: takeoffLabourHours + num(manualLabourHours),
    manualMaterialCost: num(manualMaterialCost),
    // Post-discount. The server costs the saved row against subtotal − discount,
    // so passing the gross subtotal here would show a margin on screen that the
    // saved QuoteCosting row disagreed with — money given away is not revenue.
    price: taxableBase,
    overheadPerJob: boot.overheadPerJob ?? null,
    overheadPctOfPrice: num(overheadPct),
    purchasedMaterialCost,
    marginTargetPct: marginTarget,
    recipeOverridesByCategory: recipeOverrides,
    // The lines' own cost — the unitCost typed in the line table's cost /
    // markup popover, or copied from Product.costPrice. Off the groups' own
    // lines, which is the same set the save routes sum (lib/costing/
    // lineItemCost.js), so the margin on screen is the margin the row keeps.
    lineItemCost: scopeGroupsLineItemCost(scopeGroups),
  });

  // ── Saving ───────────────────────────────────────────────────────────────

  /**
   * The costing block, or undefined to say nothing about costing at all.
   *
   * `undefined` is silence and the server leaves any existing row alone. An
   * EMPTY block over an existing row is read as the estimator clearing the
   * panel, so it must not be sent when the panel was never loaded — which is
   * exactly what happens when the costing GET 403s or fails on an edit.
   */
  function costingPayload() {
    if (!mayCost) return undefined;
    if (isEdit && start.costingLoaded !== true) return undefined;
    // INPUTS ONLY. No money: the server re-derives the takeoff hours, the bill
    // of materials and every total from the quote's own scope groups against
    // the company's price book.
    return {
      crew,
      addedLabourHours: num(manualLabourHours),
      addedMaterialCost: num(manualMaterialCost),
      labourRate: num(fallbackRate),
      overheadPct: num(overheadPct),
    };
  }

  async function handleCreateClient(e) {
    e.preventDefault();
    setError("");

    if (!newClient.name.trim()) {
      setError(
        newClient.type === "company"
          ? t("app.quoteNew.enterCompanyName")
          : t("app.quoteNew.enterClientName"),
      );
      return;
    }

    setCreatingClient(true);
    try {
      const created = await fetchJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      setClients((prev) => [created, ...prev]);
      setSelectedClient(created);
      if (created.language) setQuoteLanguage(created.language);
      setShowNewClient(false);
      setNewClient({
        type: "individual",
        name: "",
        contactName: "",
        email: "",
        phone: "",
        address: "",
        // Cleared with the rest. These arrive from the address autocomplete
        // rather than a visible field, so a leftover province would silently
        // attach the previous client's tax region to the next one.
        city: "",
        province: "",
        country: "",
      });
    } catch (err) {
      // Keep the panel open with whatever they typed still in it — losing a
      // filled-in form to an error is worse than the error.
      setError(err.message);
    } finally {
      setCreatingClient(false);
    }
  }

  /**
   * `confirmed` is a parameter rather than state on purpose: setState is not
   * synchronous, so a flag set in the modal's onConfirm would still be false
   * when this read it, and the modal would re-open forever.
   */
  // The thin wrapper exists for one reason: `jsonBody` throws, and an
  // exception out of an async click handler is an unhandled rejection — it
  // lands in the console, the spinner never stops, and the contractor watches a
  // button do nothing. The whole point of naming the bad field is that somebody
  // gets to READ the name.
  const [savingProcessDefault, setSavingProcessDefault] = useState(false);
  const [processDefaultSaved, setProcessDefaultSaved] = useState(false);
  // Held in state, not by mutating `boot`. Writing back onto the bootstrap
  // object would not re-render, so the button would go on offering to save text
  // it had just saved.
  const [savedProcessDefault, setSavedProcessDefault] = useState(
    boot.defaultProcessNotes || "",
  );

  // The same capability the route enforces — `user:manage`, which SUPERVISORS
  // hold, not owner/admin. My first version checked ["owner","admin"] against a
  // `boot.memberRole` that does not exist, so the control would never have
  // rendered for anyone: a dead control with the polarity reversed, offering
  // nothing to everybody rather than something to the wrong people.
  //
  // This only decides whether to OFFER it. The route is the access control.
  const canSaveProcessDefault = settingsAccess.canChange("user:manage");

  async function saveProcessNotesDefault() {
    setSavingProcessDefault(true);
    setProcessDefaultSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ defaultProcessNotes: processNotes }, "default wording"),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || t("app.quoteEdit.saveError"));
        return;
      }
      setSavedProcessDefault(processNotes);
      setProcessDefaultSaved(true);
    } catch {
      setError(t("app.quoteEdit.saveError"));
    } finally {
      setSavingProcessDefault(false);
    }
  }

  async function handleSave(action, opts) {
    try {
      await runSave(action, opts);
    } catch (err) {
      setSaving("");
      setError(err?.message || t("app.quoteEdit.saveError"));
    }
  }

  /**
   * @param {string} action  "draft" | "sent" | "review"
   * @param {object} [opts]
   * @param {boolean} [opts.confirmed]      the send dialog was answered
   * @param {string}  [opts.againstVersion] deliberately re-apply on top of the
   *   version the server just named in a stale-write refusal. Still GUARDED:
   *   if a third save landed while the banner was on screen, this conflicts
   *   again rather than forcing. There is no unguarded overwrite here.
   */
  async function runSave(action, { confirmed = false, againstVersion } = {}) {
    setError("");
    // Cleared as the retry starts, not on success — leaving last attempt's
    // banner up during a save that may well succeed reads as a failure.
    setConflict(null);

    if (!isEdit) {
      if (!selectedClient) {
        setError(t("app.quoteNew.selectClientFirst"));
        return;
      }
      if (scopeGroups.length === 0) {
        setError(t("app.quoteNew.addServiceFirst"));
        return;
      }
    }
    // A company client's quote must say where the job is — their address is
    // an office. The route refuses the same save; this is the sentence
    // beside the field rather than a red banner after the round trip.
    if (siteAddressRequired(selectedClient) && !siteAddress.trim()) {
      setError(t("app.quoteNew.jobAddressRequired", "Enter the job address — a company client's address is their office, not the site."));
      return;
    }
    // A required custom box left blank, or a bad number, is caught before
    // the quote saves — otherwise the quote would land and the answers not.
    if (!cf.validate()) {
      setError(t("app.customFields.fixFirst"));
      return;
    }

    // ── "Save & send" emails the client the moment it is pressed ──────────
    //
    // There is no unsend, and it sits next to a reversible Save. Only the SEND
    // path confirms; asking about a draft would train people to click through
    // the dialog.
    if (action === "sent" && !confirmed) {
      const to = selectedClient?.email;
      if (!to) {
        setError(t("app.quoteNew.noClientEmail"));
        return;
      }
      setPendingSend({ to });
      return;
    }

    setSaving(action);

    // The quote's own language goes in with the group so the lines derived at
    // save time (cabinet upgrades) are written in the language of the
    // document — the same value POST sends as `language` below.
    const groupsPayload = scopeGroups.map((g) =>
      buildScopeGroupPayload(
        g,
        rateOverridesFor(g.categoryId),
        quoteLanguage || companyLanguage,
      ),
    );
    const costing = costingPayload();

    // The body, as one pure function — lib/quotes/builderRequest.js. Both
    // layouts save through this one call, and scripts/check-doc-builder.mjs
    // hashes what it produces against the inline literal it replaced.
    const request = quoteRequestBody({
      isEdit,
      subtotal,
      appliedDiscount,
      tax,
      taxEnabled,
      total,
      notes,
      reviewNotes,
      processNotes,
      validUntil,
      clientPhotos,
      siteAddress,
      costing,
      groupsPayload,
      canEditScope,
      assignedToTouched,
      assignedToId,
      version,
      againstVersion,
      clientId: selectedClient?.id,
      // Stopped here rather than on unmount: the work is finished at Save,
      // and the seconds spent watching a spinner afterwards are not compose
      // time. Null on an edit — an edit is not composition.
      composeSeconds: isEdit ? null : (composeTimer.current?.stop() ?? null),
      language: quoteLanguage || companyLanguage,
    });

    let quote = null;

    if (isEdit) {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(request),
      });
      // BEFORE res.json(): readStaleConflict clones the response, and clone()
      // throws once the body has been consumed — the same trap
      // lib/clientErrors.js documents. Reading it after would make every
      // conflict fall through to the generic red banner.
      const stale = await readStaleConflict(res);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaving("");
        // A stale write gets the banner, not the red error box, and NOTHING on
        // this form is reset — everything typed is still on screen, which is
        // what the banner tells them and what makes "Save mine anyway" a real
        // recovery rather than a re-type.
        if (stale) {
          // The action is carried so "Save mine anyway" re-runs the button
          // they actually pressed — re-applying a "Save & send" as a plain
          // draft would quietly not send the quote.
          setConflict({ ...stale, action });
          return;
        }
        setError(data?.error || t("app.quoteEdit.saveError"));
        return;
      }
      // The version this save produced, so a second save from this same screen
      // is guarded against whatever lands between the two.
      if (data?.updatedAt) setVersion(data.updatedAt);
      quote = data;
    } else {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(request),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaving("");
        setError(data?.error || t("app.quoteNew.createError"));
        return;
      }
      quote = await res.json();
    }

    const id = quote?.id || quoteId;

    // The quote is saved; its extra boxes save against it. A refusal here is
    // named as the boxes' — the quote exists and the person stays on the
    // builder to fix the answer rather than being sent on without it.
    try {
      await cf.save(id);
    } catch (err) {
      setSaving("");
      setError(`${t("app.customFields.saveError")} ${err.message || ""}`.trim());
      return;
    }

    // "Save & Send" used to mean "create it with status: sent" — a Send control
    // that changed a word and emailed nothing. The quote is saved first and then
    // sent through the real route, which flips the status itself once Resend
    // accepts the message. A failed send therefore leaves something the user can
    // retry from, rather than a quote marked sent that never left the building.
    if (action === "sent") {
      const sendRes = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "quote" }),
      });
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => null);
        setSaving("");
        // An optional email section is switched on with nothing in it. That is
        // not a failure to report, it is a decision to make, and the detail page
        // has the dialog that offers both ways out — so hand it the flag rather
        // than a sentence. A red banner here would be a dead end.
        // The company never finished checkout. The quote IS saved — this is
        // the send half of "Save & Send" — so the prompt opens here and they
        // stay on the builder with their work intact, rather than being
        // bounced to the detail page carrying a sentence they can't act on.
        if (planRequiredFrom(sendRes.status, data)) {
          router.push(`/app/quotes/${id}`);
          return;
        }
        if (sendRes.status === 409 && data?.code === "email_sections_empty") {
          router.push(`/app/quotes/${id}?sendBlocked=quote`);
          return;
        }
        // Tax is switched on and nothing is charged. Same hand-off and the
        // same reason: the detail page owns the dialog that offers both ways
        // out, and a red banner here would be a dead end. The flag is enough
        // — that page re-asks the server rather than smuggling the 409 through
        // the URL, so the dialog opens on the CURRENT state.
        if (sendRes.status === 409 && data?.code === "tax_unresolved") {
          router.push(`/app/quotes/${id}?taxBlocked=quote`);
          return;
        }
        // Land them on the quote regardless — it exists and their work is
        // saved. The reason is carried through so the detail page can say why
        // it's still a draft instead of leaving them to guess.
        router.push(
          `/app/quotes/${id}?sendError=${encodeURIComponent(
            data?.error || t("app.quoteNew.sendFailedSaved"),
          )}`,
        );
        return;
      }
    }

    // "Save & review" lands on the EDIT route, with a flag that runs the review
    // on arrival. The review reads the SAVED quote out of the database, so there
    // is no reviewing an unsaved builder — which is exactly why the button says
    // "Save & review" and the line under it says it creates a draft.
    if (action === "review") {
      router.push(`/app/quotes/${id}/edit?review=1`);
      return;
    }

    // Deliberately still "saving" here: the router push is about to unmount this
    // screen. Clearing it first flashes an enabled button for a frame, which is
    // long enough to double-submit on a slow connection.
    router.push(`/app/quotes/${id}`);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  const languageMeta = LANGUAGES.find(
    (l) => l.code === (quoteLanguage || companyLanguage),
  );

  // Keys, not translated strings: OnboardingTour resolves `titleKey`/`bodyKey`
  // itself (app/components/tours.js is the pattern). Passing `title`/`body`
  // here made the tour call t(undefined), which crashed the whole builder
  // the moment the "?" was pressed — the render error reported from
  // /app/quotes/new on 2026-09-19.
  const TOUR_STEPS = [
    {
      target: "[data-tour='client-picker']",
      titleKey: "app.quoteNew.tourClientTitle",
      bodyKey: "app.quoteNew.tourClientBody",
    },
    {
      target: "[data-tour='service-picker']",
      titleKey: "app.quoteNew.tourServiceTitle",
      bodyKey: "app.quoteNew.tourServiceBody",
    },
    {
      target: "[data-tour='totals']",
      titleKey: "app.quoteNew.tourReviewTitle",
      bodyKey: "app.quoteNew.tourReviewBody",
    },
  ];


  // ── Pieces both layouts draw ─────────────────────────────────────────────
  //
  // One copy of each editor, closed over this component's state, so the
  // classic form and the document layout (DocumentBuilder.js) render the
  // same takeoff, the same line table, the same notes box and the same
  // review panel. The copy nobody looks at is the one that rots, so there
  // is no copy: the document layout receives these as functions.

  /** Everything inside a service card: takeoff, unit pricing, intake, lines. */
  const renderGroupEditor = (group) => {
    // Read-only: a subcontractor cost imported from another company's quote.
    // The lines and total are fixed; the markup is changed on the quote page
    // (ImportedCostsPanel), not by hand-editing here.
    const locked = group.imported || !canEditScope;
    return (
      <>
        {/* Where "Open room takeoff" under a template line lands in the
            classic layout (openCalculator). Renders nothing. */}
        <span data-scope-group-anchor={group.tempId} aria-hidden="true" />
        {!group.persisted && isUnitPriced(group.categoryKey) && (
          <UnitPricingFields
            book={getPriceBook(
              group.categoryKey,
              rateOverridesFor(group.categoryId),
            )}
            currency={companyCurrency}
            group={group}
            reasonsOpen={Boolean(reasonsOpen[group.tempId])}
            onToggleReasons={() =>
              setReasonsOpen((p) => ({
                ...p,
                [group.tempId]: !p[group.tempId],
              }))
            }
            onIntakeChange={(key, value) =>
              updateIntakeValue(group.tempId, key, value)
            }
            onPricingChange={(patch) => updatePricing(group.tempId, patch)}
            onToggleReason={(reasonId) =>
              toggleComplexityReason(group.tempId, reasonId)
            }
          />
        )}

        {!group.persisted &&
          hasTakeoff(group.categoryKey) &&
          group.takeoff && (
            <TradeTakeoff
              siteAddress={siteAddress || selectedClient?.address || ""}
              categoryKey={group.categoryKey}
              takeoff={group.takeoff}
              book={getPriceBook(
                group.categoryKey,
                rateOverridesFor(group.categoryId),
              )}
              onChange={(next) =>
                typeof next === "function"
                  ? updateTakeoff(group.tempId, next)
                  : updatePricing(group.tempId, { takeoff: next })
              }
            />
          )}

        {!group.persisted &&
          !group.isTiered &&
          !isUnitPriced(group.categoryKey) &&
          !hasTakeoff(group.categoryKey) && (
            <>
              {/* Trace it rather than guess it: the landscaping trades'
                  Lot Size and Edging boxes below can be filled from an
                  outline drawn on the aerial photo. The boxes stay
                  editable — a number paced on site overrules one traced
                  from the sky. */}
              {isLotMeasureTrade(group.categoryKey) && (
                <LotAreaMeasure
                  intakeValues={group.intakeValues || {}}
                  fields={getGroupFields(group)}
                  onIntakeChange={(patch) =>
                    updateIntakeValues(group.tempId, patch)
                  }
                  // The group's takeoff carries the still's address and
                  // frame (and the traced outline in lat/lng, for the
                  // client's document — see LotAreaMeasure).
                  takeoff={group.takeoff || null}
                  siteAddress={siteAddress || selectedClient?.address || ""}
                  onTakeoffChange={(patch) => updateTakeoff(group.tempId, patch)}
                />
              )}
              {/* Lawn care sells PROGRAMS priced by the lawn's size band
                  (lib/estimate/lawnCare.js). The picker prices the
                  company's card at the Lot Size above — traced or typed
                  — and writes the picks as this group's lines, each
                  program with its included treatments under it. */}
              {group.categoryKey === "lawn_care" && (
                <div className="rounded-lg border border-border p-3">
                  <LawnProgramPicker
                    areaSqft={group.intakeValues?.lotSize}
                    language={quoteLanguage || companyLanguage}
                    currency={companyCurrency}
                    lineItems={group.lineItems}
                    onLines={(lines) => replaceLawnLines(group.tempId, lines)}
                  />
                </div>
              )}
              <IntakeFields
                fields={getGroupFields(group)}
                values={group.intakeValues || {}}
                onChange={(key, value) =>
                  updateIntakeValue(group.tempId, key, value)
                }
              />
            </>
          )}

        {!group.persisted && group.isTiered && (
          <TierSelector
            group={group}
            onSelect={(tierKey, tierLabel) =>
              selectTier(group.tempId, tierKey, tierLabel)
            }
          />
        )}

        {/* A saved group's takeoff is kept but not re-opened. Its lines were
            priced against the rate card of the day it was written, and a
            quote already in a client's inbox must not silently reprice
            because gravel went up — so the numbers are edited as numbers. */}
        {group.persisted && group.takeoff && !locked && (
          <p className="text-xs text-muted-foreground">
            {t("app.quoteEdit.takeoffFrozen")}
          </p>
        )}

        {/* A saved unit-priced group's PRICE is frozen for the same reason
            its takeoff is. Its COST is not, and the two are different
            questions. Doors, drawer fronts and the door material feed the
            material recipe and nothing else — scopeGroupPayload and
            groupSubtotal both return early on `persisted`, so a number
            typed here cannot reach the client's copy of the quote.
            Without it, every quote written before intake answers were
            stored is permanently uncostable. */}
        {group.persisted &&
          isUnitPriced(group.categoryKey) &&
          !locked &&
          mayCost && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-xs text-muted-foreground">
                {t("app.quoteEdit.intakeCostOnly")}
              </p>
              {/* The billed unit count, as a reminder rather than a
                  prefill. 35 units is not 35 doors — the recipe costs a
                  door at 12 sqft and 45 minutes and a drawer front at 3
                  and 20, and splitting the total for the user would be
                  inventing the answer the boxes are asking for. */}
              {billedUnitsOf(group) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("app.quoteEdit.intakeBilledUnits", {
                    count: billedUnitsOf(group),
                  })}
                </p>
              )}
              <IntakeFields
                fields={getGroupFields(group)}
                values={group.intakeValues || {}}
                onChange={(key, value) =>
                  updateIntakeValue(group.tempId, key, value)
                }
              />
            </div>
          )}

        {locked ? (
          <div className="space-y-1.5">
            {/* Not group.lineItems directly — ScopeGroupCard above already
                shows this group's label and subtotal; a blended
                subcontractor import's one line item repeats both, word
                for word. See lib/quotes/scopeGroupDisplay.js. */}
            {visibleLineItems(group).map((item, li) => (
              <div
                key={li}
                className="flex justify-between gap-3 text-sm text-muted-foreground"
              >
                <span className="min-w-0 truncate">{item.description}</span>
                <span className="tabular-nums shrink-0">
                  {formatAppMoney(item.amount, companyCurrency, "en")}
                </span>
              </div>
            ))}
            {group.imported && (
              <p className="text-[11px] text-muted-foreground pt-2 mt-1 border-t border-border">
                {t("app.quoteEdit.importedLocked")}
              </p>
            )}
          </div>
        ) : (
          <LineItemsTable
            currency={companyCurrency}
            items={group.lineItems}
            products={getProductsForCategory(group.categoryId)}
            categoryKey={group.categoryKey}
            onChange={(i, field, value) =>
              updateLineItem(group.tempId, i, field, value)
            }
            onAdd={() => addLineItem(group.tempId)}
            onRemove={(i) => removeLineItem(group.tempId, i)}
            onAddProduct={(product) =>
              addProductLineItem(group.tempId, product)
            }
            onAddSuggested={(suggestion) =>
              addSuggestedLineItem(group.tempId, suggestion)
            }
            // A block from the library, already a line
            // (lib/quotes/textBlocks.js lineFromTextBlock) — in the
            // quote's language, priced in the dialog.
            onAddLine={(line) => addLibraryLine(group.tempId, line)}
            documentLanguage={quoteLanguage || companyLanguage}
            hourlyRate={hourlyRateFor(group)}
            showPricing={caller ? hasToggle(caller, "showPricing") : true}
            templateInfo={(product) => {
              if (!templateOfferedOn(group, product)) return null;
              const { summary } = expandServiceTemplate(product, {
                measurements: templateMeasurements(group.tempId),
                currency: companyCurrency,
                heading: false,
              });
              if (!summary.lines) return null;
              return {
                count: summary.lines,
                measured: summary.measured,
                filled: summary.filled,
                alreadyAdded: group.lineItems.some((l) => templateRunOf(l)?.productId === String(product.id)),
              };
            }}
            onAddProductTemplate={(product) => addProductTemplate(group.tempId, product)}
            describeLine={(() => {
              // Read the quote's figures once per render of this table, and
              // only when it holds a template line at all.
              let measured = null;
              return (item, i, items) => {
                if (!templateRunOf(item)) return null;
                if (!measured) measured = templateMeasurements(group.tempId);
                return describeTemplateLine({
                  t,
                  language: lang,
                  item,
                  index: i,
                  items,
                  groups: scopeGroups,
                  measurements: measured,
                  onOpenCalculator: openCalculator,
                  onRefill: (runId) => refillTemplate(group.tempId, runId),
                });
              };
            })()}
          />
        )}
      </>
    );
  };

  /** Internal cost & margin — never client-facing; see the component. */
  const renderCostMarginPanel = () => (
    <>
    {mayCost && (
      <CostMarginPanel
        currency={companyCurrency}
        estimate={estimate}
        workers={workers}
        crew={crew}
        onCrewChange={setCrew}
        overheadPct={overheadPct}
        onOverheadChange={setOverheadPct}
        manualLabourHours={manualLabourHours}
        onManualLabourHoursChange={setManualLabourHours}
        manualMaterialCost={manualMaterialCost}
        onManualMaterialCostChange={setManualMaterialCost}
        overheadSource={boot.overheadSource || null}
        subtotal={taxableBase}
        totalGroupCount={scopeGroups.length}
        marginTarget={marginTarget}
        onMaterialOverride={updateMaterialOverride}
        // Which groups' bills can actually be typed over. The same test the
        // takeoff editor uses, and for the same reason: scopeGroupPayload
        // returns early on a persisted group, so its takeoff never leaves
        // this screen. Offering boxes there would be a control that appears
        // to work and doesn't — the margin would move and the saved quote
        // would not.
        editableMaterialGroups={scopeGroups
          .filter((g) => !g.persisted && g.takeoff)
          .map((g) => g.tempId)}
      />
    )}

    </>
  );

  const renderNotesBox = () => (
    <>
    {/* Notes */}
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-2">
        {t("app.field.notes")}
      </h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder={t("app.quoteNew.notesPlaceholder")}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
      />
    </div>

    {/* Notes for review — INTERNAL.
        Rendered only when there is something in it. An always-present empty
        box beside the client-facing one is two textareas that look alike and
        do opposite things, which is how a back-office note ends up on a
        homeowner's PDF. It appears when a phone draft filled it, says plainly
        that the client never sees it, and clears to nothing once the
        estimator has dealt with what it says. */}
    </>
  );

  const renderReviewNotesBox = () => (
    <>
    {reviewNotes ? (
      <div ref={reviewNotesRef} className="bg-card border border-amber-300 dark:border-amber-800 rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">
          {t("app.quoteNew.reviewNotes")}
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          {t("app.quoteNew.reviewNotesHint")}
        </p>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          rows={3}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>
    ) : null}

    </>
  );

  const renderPhotosBox = () => (
    <>
    {/* Job photos. The column and the quote detail page already supported
        these, but only lead intake ever filled them — a quote typed up by
        staff had nowhere to put the pictures from the site visit. */}
    <div className="bg-card border border-border rounded-xl p-5" data-photos-box>
      <h2 className="font-semibold text-foreground mb-2">
        {t("app.quoteDetail.clientMedia")}
      </h2>
      <MediaUploader
        uploadUrl="/api/upload"
        value={clientPhotos}
        onChange={setClientPhotos}
        label={t("app.quoteNew.addPhotos")}
        hint={t("app.quoteNew.addPhotosHint")}
      />
    </div>

    </>
  );

  const renderProcessNotes = () => (
    <>
    {/* Sits below the totals because that's where it sits on the client's
        copy too — the extras are the last thing they read before deciding. */}
    <div data-process-notes-box>
      <label
        htmlFor="quote-process-notes"
        className="block text-sm font-medium text-foreground mb-1"
      >
        {t("app.quoteEdit.whatHappensNext")}
      </label>
      <p className="text-xs text-muted-foreground mb-2">
        {t("app.quoteEdit.whatHappensNextHint")}
      </p>
      <textarea
        id="quote-process-notes"
        value={processNotes}
        onChange={(e) => setProcessNotes(e.target.value)}
        rows={5}
        placeholder={t("app.quoteEdit.processNotesPlaceholder")}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
      />

      {/* ── Save it once, never type it again ─────────────────────────────
          Company.defaultProcessNotes has always existed and the builder has
          always seeded from it — but the only place to SET it was Settings >
          Company, three screens from where anybody actually writes the words.
          So this box sat empty on quote after quote: the owner's point was
          that it lives below the totals and never gets filled, and the fix he
          reached for was a preset.

          Offered here, where the text already is. It is the same text either
          way, so the only thing the trip to Settings ever added was the
          chance to forget.

          Owner-and-admin only, because it writes a COMPANY setting: the
          business-info PATCH refuses anyone below user:manage, and a button
          that 403s is worse than no button. */}
      {canSaveProcessDefault && processNotes.trim() && (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          {processNotes.trim() !== savedProcessDefault.trim() ? (
            <button
              type="button"
              onClick={saveProcessNotesDefault}
              disabled={savingProcessDefault}
              className="text-xs font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              {savingProcessDefault
                ? t("app.quoteEdit.savingDefault")
                : t("app.quoteEdit.saveAsDefault")}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("app.quoteEdit.isYourDefault")}
            </span>
          )}
          {processDefaultSaved && (
            <span className="text-xs text-green-700 dark:text-green-400">
              {t("app.quoteEdit.defaultSaved")}
            </span>
          )}
        </div>
      )}
    </div>

    {/* The AI review and the optional extras. Needs a saved quote — the review
        reads the stored row — which is why the builder's third button saves a
        draft first and lands here. */}
    </>
  );

  const renderSuggestAddOns = () => (
    <>
    {isEdit && quoteId && (
      <SuggestAddOns
        quoteId={quoteId}
        readOnly={["accepted", "declined"].includes(start.status)}
        onProcessNotes={setProcessNotes}
        // The actuals finding's "Apply 18% more hours" — arithmetic in
        // lib/quotes/applyActuals.js over THIS component's state, through
        // the same setters the cost panel and the line table use, so the
        // estimate, the totals bar and the client document all follow.
        // Refused there for anything but a draft, whatever the panel shows.
        quoteStatus={start.status || null}
        onApplyActuals={(finding) => {
          const r = applyActualsToDraft({
            status: start.status,
            scopeGroups,
            manualLabourHours,
            manualMaterialCost,
            estimate,
            categoryKey: finding.categoryKey,
            labourPct: finding.labourPct ?? null,
            materialsPct: finding.materialsPct ?? null,
          });
          if (!r.ok) return r;
          setScopeGroups(r.scopeGroups);
          setManualLabourHours(r.manualLabourHours);
          setManualMaterialCost(r.manualMaterialCost);
          return r;
        }}
        // The deep read's findings land in the internal notes for review —
        // appended under what is there, so a phone draft's own note and two
        // reads on different days all survive together.
        //
        // SAVED at once, through the append route, not only put in the box:
        // the box is two screens up and only exists once it has text, so
        // the press looked like nothing happened, and a reload before the
        // builder's own Save lost it. The route hands back the merged note
        // and the new updatedAt; the second is what keeps the next Save
        // from being refused as a stale write (see `version`).
        onReviewNotes={async (text) => {
          try {
            const saved = await fetchJson(`/api/quotes/${quoteId}/review-notes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: jsonBody({ append: text }, "review note"),
            });
            setReviewNotes(typeof saved?.reviewNotes === "string" ? saved.reviewNotes : text);
            if (saved?.updatedAt) setVersion(saved.updatedAt);
            // Shown, not only stored: scroll the box the text landed in into
            // view on the next paint, once it exists.
            setTimeout(() => reviewNotesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
            return { ok: true };
          } catch (err) {
            return { ok: false, error: err?.message || t("app.quoteEdit.saveError") };
          }
        }}
        autoReview={autoReview}
      />
    )}

    </>
  );

  const renderSendConfirm = () => (
    <>
    <SendConfirmModal
      isOpen={Boolean(pendingSend)}
      busy={saving === "sent"}
      onClose={() => setPendingSend(null)}
      onConfirm={() => {
        setPendingSend(null);
        handleSave("sent", { confirmed: true });
      }}
      recipient={pendingSend?.to}
      title={t("app.quoteNew.confirmSendTitle")}
      detail={t("app.quoteNew.confirmSendDetail")}
      confirmLabel={t("app.quoteNew.confirmSendCta")}
    />
    </>
  );

  // The readiness input, worked out here rather than by the model. Same
  // checks lib/ai/quoteReview.js runs — they were never AI work, just null
  // checks that happened to live behind an API call.
  const readiness = {
    validUntil,
    processNotes,
    // What the document prints when the box is empty — the company's own
    // default (Company.defaultProcessNotes). Passed so the readiness panel
    // judges what the CLIENT will read rather than what this row stores; see
    // effectiveProcessNotes in lib/quotes/completeness.js.
    defaultProcessNotes: boot.defaultProcessNotes || "",
    clientPhotos,
    discount,
    subtotal,
    // Each group with the company's saved wording beside it, so the "no
    // description" check reads the document the way the client does — a
    // name over a scope paragraph is not a bare name.
    scopeGroups: scopeGroups.map((g) => ({ ...g, override: wordingOverrideFor(g.categoryId) })),
    client: selectedClient,
  };
  const readinessItems = scopeGroups.flatMap((g) =>
    Array.isArray(g.lineItems) ? g.lineItems : [],
  );

  // A painting company's empty new quote opens on the estimate-type cards
  // (EstimateTypeFirst.js), in both layouts, instead of the service tiles.
  const paintingFirst =
    !isEdit && scopeGroups.length === 0 && paintingCategoriesOf(categories).length > 0;

  // ── Which layout ─────────────────────────────────────────────────────────
  //
  // Decided by the company (Company.quoteBuilderLayout, read into the
  // bootstrap). Everything above this line is shared: state, derivation,
  // the save. Only the arrangement differs, and the document layout is
  // handed the same closures the classic markup below calls.
  const layout = resolveBuilderLayout(boot.layout);
  if (layout === "document") {
    return (
      <DocumentBuilder
        b={{
          t, lang, isEdit, quoteId, start, boot, caller, mayCost, canEditScope,
          companyCurrency, companyLanguage, quoteLanguage, setQuoteLanguage, languageMeta,
          clients: filteredClients, clientSearch, setClientSearch, selectedClient, setSelectedClient,
          showNewClient, setShowNewClient, newClient, setNewClient, handleCreateClient, creatingClient,
          siteAddress, setSiteAddress,
          categories, products, teamRoster, settingsAccess,
          scopeGroups, setScopeGroups, addScopeGroup, addPaintingEstimate, paintingFirst, removeScopeGroup, updateLineItem, removeLineItem,
          groupFromStored, groupTotal, rateOverridesFor, wordingOverrideFor, getProductsForCategory,
          notes, setNotes, reviewNotes, setReviewNotes, reviewNotesRef, processNotes, setProcessNotes,
          assignedToId, setAssignedToId, setAssignedToTouched,
          discount, setDiscount, appliedDiscount, taxableBase, taxEnabled, setTaxEnabled, taxRate, setTaxRate,
          setTaxRateTouched, taxNote, taxCaution, taxAssumed, taxSchemeNote, taxDetail, vatWorkType, setVatWorkType,
          validUntil, setValidUntil, subtotal, tax, total, estimate,
          taxLine,
          saving, error, errorRef, conflict, conflictRef, runSave, handleSave, pendingSend, setPendingSend,
          cf, readiness, readinessItems, OPEN_STATUSES, TOUR_STEPS, showTour, setShowTour,
          renderGroupEditor, renderCostMarginPanel, renderNotesBox, renderReviewNotesBox,
          renderPhotosBox, renderProcessNotes, renderSuggestAddOns, renderSendConfirm,
          calculatorOpenerRef,
        }}
      />
    );
  }

  return (
    // No pb-24 for the totals bar: the /app shell's <main> pads by the bar's
    // measured height (useBottomDock in QuoteTotalsBar), so the last field
    // clears it whatever height the bar turns out to be at this width.
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {isEdit && (
        <Link
          href={`/app/quotes/${quoteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t("app.quoteEdit.backTo")}{" "}
          {start.quoteNumber}
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEdit
            ? `${t("app.action.edit")} ${start.quoteNumber || ""}`.trim()
            : t("app.quotes.new")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEdit
            ? selectedClient?.name || ""
            : t("app.quoteNew.subtitle")}
        </p>
      </div>

      {isEdit && start.status === "accepted" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("app.quoteEdit.acceptedWarning")}
        </div>
      )}

      {/* ── The ONE thing an instant-estimate draft shows that a hand-built
          quote does not ──────────────────────────────────────────────────
          Everything below this banner is the same editor, the same sections
          in the same order, the same service card and the same line table a
          quote an estimator built opens in; the draft's lines were stored in
          the builder's own shape for exactly that reason (lib/estimate/
          estimateLines.js). What is different is that nobody here has stood
          behind the number yet, and that is said here, once, at the top —
          not by a different-looking screen. Drafts only: once approved and
          sent it is a quote like any other. */}
      {isEdit && start.quote?.autoEstimated && start.status === "draft" && (
        <div
          className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200 space-y-1"
          data-auto-estimated-banner
        >
          <p className="font-semibold">{t("app.quoteEdit.autoEstimatedTitle")}</p>
          <p>{t("app.quoteEdit.autoEstimatedBody")}</p>
          {/* Why the picker below opens on nobody: with more than one person
              able to write quotes, the draft was left for the review queue to
              claim rather than handed to a guess. A solo company's one
              estimator is already named (lib/estimate/soloEstimator.js). */}
          {!start.assignedTo && <p>{t("app.quoteEdit.autoEstimatedUnassigned")}</p>}
        </div>
      )}

      {/* Said once, plainly, instead of rendering live inputs over a refusal.
          PATCH rejects scopeGroups on a decided quote — the lines below are
          read-only and this save carries everything else. */}
      {isEdit && !canEditScope && (
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {t("app.quoteEdit.linesLocked")}
        </div>
      )}

      {/* Somebody else saved while this screen was open. Above the red error
          banner because it is not an error: nothing is broken and nothing has
          been lost — it is a decision to make, and the banner carries both
          ways out. See app/components/StaleWriteBanner.js. */}
      {conflict && (
        <div ref={conflictRef}>
          <StaleWriteBanner
            conflict={conflict}
            href={quoteId ? `/app/quotes/${quoteId}` : undefined}
            busy={Boolean(saving)}
            onOverwrite={() =>
              runSave(conflict.action, {
                confirmed: true,
                againstVersion: conflict.currentUpdatedAt,
              })
            }
          />
        </div>
      )}

      {/* Scrolled to, not merely rendered.
          This banner sits at the TOP of a builder that is several screens long
          and whose Save buttons are at the BOTTOM. A save that came back 403
          set the sentence here and left the person looking at an unchanged
          form — which they reported, correctly, as the button doing nothing.
          A refusal the user cannot see is a refusal that failed silently. */}
      {error && (
        <div
          ref={errorRef}
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── A painting company's first screen (mockup b1) ─────────────────
          Before the client, before the tiles: which kind of estimate. The
          pick adds the painting service with its type set; "Other trades"
          unfolds the tiles for a company that also does something else. The
          tiles below are withheld in this state so painting never has a tile
          step. See EstimateTypeFirst.js for why this is first. */}
      {paintingFirst && (
        <EstimateTypeFirst
          categories={categories}
          onPickType={addPaintingEstimate}
          onAddOther={addScopeGroup}
          documentLanguage={quoteLanguage}
        />
      )}

      {/* Locked on an edit rather than hidden: the client is information the
          screen should keep showing, and PATCH takes no clientId, so an
          enabled "Change" here would be a control that appears to work. */}
      <ClientPicker
        locked={isEdit}
        clients={filteredClients}
        selectedClient={selectedClient}
        onSelect={(c) => {
          setSelectedClient(c);
          setClientSearch("");
          // Adopt their saved preference automatically — the whole point of
          // storing it. Still overridable in the language bar below.
          if (c.language) setQuoteLanguage(c.language);
          // A homeowner's job is at their address; a company's is not.
          setSiteAddress(defaultSiteAddressFor(c));
        }}
        onClear={() => {
          setSelectedClient(null);
          setSiteAddress("");
        }}
        search={clientSearch}
        onSearchChange={setClientSearch}
        showNewClient={showNewClient}
        onOpenNewClient={() => setShowNewClient(true)}
        onCloseNewClient={() => setShowNewClient(false)}
        newClient={newClient}
        onNewClientChange={(patch) =>
          setNewClient((prev) => ({ ...prev, ...patch }))
        }
        onCreateClient={handleCreateClient}
        creating={creatingClient}
        error={error}
      />

      {/* Where the work is — see JobAddressField. Below the client, because
          it is answered from the client and overridden for a company one. */}
      {selectedClient && (
        <JobAddressField client={selectedClient} value={siteAddress} onChange={setSiteAddress} />
      )}

      {/* A saved shape to start from — the groups, notes and process notes
          of a quote somebody kept (lib/quotes/quoteTemplates.js). Only on a
          create with nothing added yet: applying one over half a quote would
          be a silent replace. */}
      {!isEdit && scopeGroups.length === 0 && (
        <TemplatePicker
          onApply={(tpl) => {
            setScopeGroups(
              tpl.groups.map((g) => groupFromStored({ ...g, id: null }, [], t("app.quoteEdit.scopeFallback"))),
            );
            if (tpl.notes && !notes) setNotes(tpl.notes);
            if (tpl.processNotes) setProcessNotes(tpl.processNotes);
            // Applying a French template IS choosing French — the language
            // is chosen at creation and the template's words are in it.
            if (tpl.language) setQuoteLanguage(tpl.language);
          }}
        />
      )}

      {/* The estimator's measure, scheduled against THIS quote row — so only
          on an edit, where the row exists. On a new quote the first save is
          what creates the thing a visit would link to, and the detail page
          the save lands on carries the same panel. The payload is the one
          the edit load already fetched; nothing is read twice. */}
      {isEdit && start.quote && (
        <SiteVisitPanel quoteId={quoteId} quote={start.quote} />
      )}

      {/* Who's working this quote. Defaults to whoever saves it — the select
          opens on "(unassigned)" and the server resolves that to the caller
          on create, so most people never need to touch this. Reassigning to
          someone else needs quote:assign; a member without it gets a 403 back
          through the error banner above rather than a hidden control, since
          the server is the actual gate here (AGENTS.md: hiding a button isn't
          access control). */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">
          {t("app.quoteNew.assignedToHeading", "Assigned to")}
        </h2>
        <select
          value={assignedToId}
          onChange={(e) => {
            setAssignedToId(e.target.value);
            setAssignedToTouched(true);
          }}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="">
            {isEdit
              ? t("app.quoteNew.unassignedNeedsReview", "Unassigned — needs review")
              : t("app.quoteNew.meDefault", "Me (default)")}
          </option>
          {teamRoster
            // The current assignee stays offered even if they've since gone
            // inactive — teamRoster is filtered to active members, and an
            // edit that opens on someone deactivated shouldn't silently drop
            // them from the list they're currently shown as.
            .concat(
              start.assignedTo &&
                !teamRoster.some((m) => m.userId === start.assignedTo.id)
                ? [{ userId: start.assignedTo.id, user: start.assignedTo }]
                : [],
            )
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.name || m.user?.email || t("app.quoteDetail.unnamed")}
              </option>
            ))}
        </select>
      </div>

      {/* The company's own extra boxes for a quote. Absent entirely for a
          company that defined none. */}
      {cf.hasFields && (
        <div className="bg-card border border-border rounded-xl p-5">
          <CustomFieldInputs cf={cf} columns={2} />
        </div>
      )}

      {/* Language is chosen once, at creation, and baked into the saved quote.
          It is deliberately not a viewer toggle and deliberately not editable
          afterwards: the PDF and the emailed copy must say the same thing as
          what was approved (non-negotiable #6). */}
      {!isEdit && selectedClient && (
        <QuoteLanguageBar
          language={quoteLanguage}
          onChange={setQuoteLanguage}
          companyDefault={companyLanguage}
          client={selectedClient}
        />
      )}
      {isEdit && (
        <p className="text-xs text-muted-foreground">
          {t("app.quoteEdit.languageFixed", {
            language: languageMeta?.nativeName || quoteLanguage || companyLanguage,
          })}
        </p>
      )}

      {/* Service picker. The tile grid, the section-preset expansion and the
          per-trade accent all live in ServiceTiles — this component keeps the
          state and the pricing rules. */}
      {canEditScope && !paintingFirst && (
        <ServiceTiles
          categories={categories}
          onAdd={addScopeGroup}
          documentLanguage={quoteLanguage}
        />
      )}

      {isEdit && scopeGroups.length === 0 && !canEditScope && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {t("app.quoteEdit.noScopeGroups")}
        </div>
      )}

      {scopeGroups.map((group, groupIndex) => {
        // Read-only: a subcontractor cost imported from another company's quote.
        // The lines and total are fixed; the markup is changed on the quote page
        // (ImportedCostsPanel), not by hand-editing here.
        const locked = group.imported || !canEditScope;
        return (
          <ScopeGroupCard
            key={group.tempId}
            group={group}
            index={groupIndex}
            showIndex={scopeGroups.length > 1}
            subtotal={groupTotal(group)}
            onRemove={locked ? null : () => removeScopeGroup(group.tempId)}
            wordingOverride={wordingOverrideFor(group.categoryId)}
            t={t}
          >
            {renderGroupEditor(group)}
          </ScopeGroupCard>
        );
      })}

      {/* Internal cost & margin. Never client-facing — see the component.
          `subtotal` here is the POST-discount figure: the row it feeds is
          labelled "Quote price (pre-tax)", and once there is a discount the
          pre-tax price is what is left after it. */}
      {renderCostMarginPanel()}

      {renderNotesBox()}

      {renderReviewNotesBox()}

      {renderPhotosBox()}

      <QuoteTotalsBar
        // What is still missing, worked out here rather than by the model. Same
        // checks lib/ai/quoteReview.js runs — they were never AI work, just null
        // checks that happened to live behind an API call.
        readiness={readiness}
        readinessItems={readinessItems}
        taxNote={taxNote}
        taxCaution={taxCaution}
        taxAssumed={taxAssumed}
        // "HST 13% (Ontario) · from the job address", or the hint that says
        // what to add — see the prop.
        taxLine={taxLine}
        taxSchemeNote={taxSchemeNote}
        // Only where a reduced construction rate actually exists for the
        // company's country. Most member states have none, and offering a
        // choice between the standard rate and nothing would be a control that
        // does nothing.
        taxVat={
          taxDetail?.reducedRate != null
            ? {
                standardRate: taxDetail.standardRate,
                reducedRate: taxDetail.reducedRate,
                workType: vatWorkType,
                conditionText: taxDetail.reducedConditionKey
                  ? t(taxDetail.reducedConditionKey)
                  : "",
                onChange: (v) => {
                  setVatWorkType(v);
                  // Choosing here IS choosing a rate, so it re-arms the
                  // resolver — otherwise picking "renovation" after nudging
                  // the box would change nothing and look broken.
                  setTaxRateTouched(false);
                },
              }
            : null
        }
        subtotal={subtotal}
        taxableBase={taxableBase}
        discount={discount}
        onDiscountChange={setDiscount}
        tax={tax}
        taxRate={taxRate}
        // Editable on a CREATE too, which it was not before. The resolver
        // used to own the box outright, so a new quote had no way to enter a
        // rate — which made the US branch of lib/tax/jurisdictions.js a dead
        // end: it says "county and city taxes are not included, enter the rate
        // for this address" and there was no field to enter it in. The
        // `taxRateTouched` guard is what makes both possible at once — the
        // resolver seeds the box, and stops writing to it the moment a human
        // does.
        onTaxRateChange={(v) => {
          setTaxRate(v);
          if (!isEdit) setTaxRateTouched(true);
        }}
        total={total}
        taxEnabled={taxEnabled}
        onTaxToggle={setTaxEnabled}
        validUntil={validUntil}
        onValidUntilChange={setValidUntil}
        // A create opens on the 30-day suggestion and the hint says so. An edit
        // opens on whatever the quote already carries, and claiming that came
        // from a default would be describing something that never happened.
        validUntilDefaulted={!isEdit}
        currency={companyCurrency}
        saving={saving}
        disabled={isEdit ? false : !selectedClient || scopeGroups.length === 0}
        primaryLabel={
          isEdit ? t("app.quoteEdit.saveChanges") : t("app.quoteNew.saveAsDraft")
        }
        // The one word that fits beside Cancel and Save & send at 375px —
        // see the bar. "Save changes" beside both is what pushed the row
        // over the total.
        primaryLabelShort={
          isEdit ? t("app.quoteEdit.saveChangesShort") : t("app.quoteNew.saveAsDraftShort")
        }
        onSaveDraft={() => handleSave("draft")}
        // Sending is offered while the quote is still open. On a decided quote
        // it is not: re-emailing a price to someone who already accepted or
        // declined is a different act, and the quote page owns it.
        onSaveAndSend={
          !isEdit || OPEN_STATUSES.includes(start.status)
            ? () => handleSave("sent")
            : null
        }
        // Review lives on this page once the quote exists (SuggestAddOns
        // below), so the button that saves-then-goes-there is a create-only
        // shortcut rather than a duplicate.
        onSaveAndReview={isEdit ? null : () => handleSave("review")}
        cancelHref={isEdit ? `/app/quotes/${quoteId}` : null}
      />

      {renderProcessNotes()}

      {renderSuggestAddOns()}

      {renderSendConfirm()}

      {/* Onboarding tour. Create only: its three steps point at the client
          picker, the service tiles and the totals bar, and on a decided quote
          two of those aren't on screen — a tour that highlights nothing is
          worse than no tour. */}
      {!isEdit && <HelpButton onClick={() => setShowTour(true)} />}
      {!isEdit && showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          storageKey="quote-builder"
          onFinish={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
