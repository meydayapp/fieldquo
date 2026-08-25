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
import { fetchJson } from "@/lib/fetchJson";
import { startComposeTimer } from "@/lib/analytics/composeTimer";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasToggle } from "@/lib/permissions/enforce";

import QuoteLanguageBar from "@/app/components/quotes/QuoteLanguageBar";
import SuggestAddOns from "@/app/components/quotes/SuggestAddOns";
import ServiceTiles from "./ServiceTiles";
import ScopeGroupCard from "./ScopeGroupCard";
import TradeTakeoff, { hasTakeoff } from "./TradeTakeoff";
import UnitPricingFields from "./UnitPricingFields";
import IntakeFields from "./IntakeFields";
import TierSelector from "./TierSelector";
import LineItemsTable from "./LineItemsTable";
import CostMarginPanel from "./CostMarginPanel";
import QuoteTotalsBar from "./QuoteTotalsBar";
import ClientPicker from "./ClientPicker";

import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import {
  MARGIN_TARGET_PCT,
  FALLBACK_OVERHEAD_PCT,
} from "@/lib/costing/quoteCosting";
import { isUnitPriced } from "@/app/data/cabinetPricing";
import { getIntakeFields } from "@/app/data/quoteIntakeFields";
import { isTieredPackageCategory } from "@/app/data/tieredPackages";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  createTradeConfig,
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
} from "@/lib/quotes/builderPayload";
import { resolveTaxRate, explainTaxSource } from "@/lib/tax/resolveTaxRate";
import { quoteTotals, round2 } from "@/lib/quotes/totals";
import { defaultValidUntil } from "@/lib/quotes/validUntil";
import { LANGUAGES } from "@/app/i18n/languages";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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
    intakeValues: {},
    // Carried through untouched so a save doesn't blank the structured form
    // behind a stair or countertop group. Not rendered as an editor: editing
    // it would have to reprice, and repricing a sent quote is the thing the
    // flatten-at-save exists to prevent.
    takeoff: g.takeoff ?? null,
    lineItems: lineItemsFromStored(g.lineItems),
  };
}

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
      processNotes: null,
      clientPhotos: [],
      discount: "",
      taxEnabled: true,
      taxRate: null,
      validUntil: defaultValidUntil(),
      costing: null,
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
    processNotes: quote.processNotes || "",
    clientPhotos: Array.isArray(quote.clientPhotos) ? quote.clientPhotos : [],
    discount: discount ? String(discount) : "",
    taxEnabled: quote.taxEnabled !== false,
    taxRate,
    validUntil: quote.validUntil
      ? new Date(quote.validUntil).toISOString().slice(0, 10)
      : "",
    costing: null,
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
          recipesData,
          overheadData,
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
          // Company-specific overrides on the internal cost recipe — see
          // Settings > Material Costs. Resolved server-side (defaults merged
          // with any saved overrides), so this is fed straight into
          // estimateQuoteCost() as-is.
          fetch("/api/settings/material-recipes").then((r) =>
            r.ok ? r.json() : {},
          ),
          // Real overhead per job. Returns 400 with needsCapacity when the
          // company hasn't said how many jobs a week they can take — a
          // legitimate "we don't know", not an error to surface here, so the
          // panel falls back to the percentage and labels it.
          fetch("/api/analytics/minimum-price")
            .then((r) => r.json().catch(() => null))
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
          recipeOverrides:
            recipesData && typeof recipesData === "object" ? recipesData : {},
          companyLanguage: businessInfo?.defaultLanguage || "en",
          // The billing currency, so every money render here matches the
          // document the client will receive.
          companyCurrency: businessInfo?.currency || null,
          // What a saved quote WILL carry: the company's default is copied onto
          // Quote.processNotes at creation, so the "what happens next" box opens
          // holding it and the readiness panel doesn't warn about a company that
          // has already written one.
          defaultProcessNotes: businessInfo?.defaultProcessNotes || "",
          taxConfig: {
            taxRate: num(businessInfo?.taxRate),
            autoApplyLocalTax: Boolean(businessInfo?.autoApplyLocalTax),
            taxRates: Array.isArray(businessInfo?.taxRates)
              ? businessInfo.taxRates
              : [],
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
        });
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || t("app.quoteNew.createError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit") {
      setInitial(initialStateFromQuote(null));
      return;
    }
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
  const { t } = useTranslation();
  const router = useRouter();
  const caller = usePermissions();
  const isEdit = mode === "edit";

  const boot = bootstrap || {};
  const start = initial || initialStateFromQuote(null);

  const categories = Array.isArray(boot.categories) ? boot.categories : [];
  const products = Array.isArray(boot.products) ? boot.products : [];
  const workers = Array.isArray(boot.workers) ? boot.workers : [];
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
  const marginTarget = MARGIN_TARGET_PCT;

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
    contactName: "",
    email: "",
    phone: "",
    address: "",
    // Set by the address autocomplete, not by a field the user sees. They
    // decide whether local tax applies, so dropping them meant every
    // quick-added client was quietly untaxed.
    city: "",
    province: "",
  });

  // The language this quote is WRITTEN in, fixed at creation. Not a display
  // preference — the stored line items and the PDF are produced in it, and it
  // never changes afterwards (non-negotiable #6).
  const [quoteLanguage, setQuoteLanguage] = useState(start.language || null);

  // ── Scope ────────────────────────────────────────────────────────────────
  const [scopeGroups, setScopeGroups] = useState(start.groups || []);
  const [reasonsOpen, setReasonsOpen] = useState({});
  const [siteImage, setSiteImage] = useState(null);

  // ── Terms & content ──────────────────────────────────────────────────────
  const [notes, setNotes] = useState(start.notes || "");
  const [processNotes, setProcessNotes] = useState(
    // On a create, the company's default is what the saved quote WILL carry,
    // so the box opens holding it rather than blank — editing it now writes a
    // per-quote version instead of the default, which is the whole point of
    // having the box here at all.
    start.processNotes ?? boot.defaultProcessNotes ?? "",
  );
  const [clientPhotos, setClientPhotos] = useState(start.clientPhotos || []);
  const [discount, setDiscount] = useState(start.discount ?? "");
  const [taxEnabled, setTaxEnabled] = useState(start.taxEnabled !== false);
  const [taxRate, setTaxRate] = useState(
    start.taxRate ?? num(boot.taxConfig?.taxRate),
  );
  const [taxNote, setTaxNote] = useState("");
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
    seededCosting?.labourRate ?? 35,
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
  const [showTour, setShowTour] = useState(false);
  const [pendingSend, setPendingSend] = useState(null);

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
    const config = boot.taxConfig;
    if (!config) return;
    const result = resolveTaxRate({
      company: config,
      taxRates: config.taxRates,
      client: selectedClient,
    });
    setTaxRate(result.rate);
    setTaxNote(
      config.autoApplyLocalTax && selectedClient
        ? explainTaxSource(result, selectedClient) || ""
        : "",
    );
  }, [isEdit, boot.taxConfig, selectedClient]);

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
    if (Array.isArray(group.customFields) && group.customFields.length > 0) {
      return group.customFields;
    }
    return getIntakeFields(group.categoryKey);
  }

  // This company's saved edits to the trade's price book. The categories
  // endpoint returns the sparse patch alongside the resolved book, so the
  // builder prices from exactly what Settings shows.
  function rateOverridesFor(categoryId) {
    return categories.find((c) => c.id === categoryId)?.rateOverrides ?? null;
  }

  function addScopeGroup(category, label) {
    const isTiered = isTieredPackageCategory(category.key);
    const unitPriced = isUnitPriced(category.key);

    setScopeGroups((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        id: null,
        persisted: false,
        imported: false,
        categoryId: category.id,
        categoryKey: category.key,
        // Custom quote types carry their fields on the category record itself
        // (ServiceCategory.customFields) rather than in the static
        // quoteIntakeFields.js map — system categories leave this null.
        customFields: category.customFields || null,
        label, // "Waterlines", "Gas", etc. — set once, at creation
        isTiered,
        selectedTier: null,
        intakeValues: {},
        // Client-facing unit pricing for door/drawer trades. Base rate seeds
        // from the trade's rate card, not `defaultRate` — that is null for
        // every trade that HAS a rate card, so a cabinet group used to open at
        // $0/unit with the book's $150 per door sitting there unreachable.
        ...(unitPriced
          ? {
              baseUnitPrice:
                Number(
                  getPriceBook(category.key, rateOverridesFor(category.id))
                    ?.perDoor,
                ) || Number(category.defaultRate || 0),
              complexityLevel: "standard",
              complexityUpcharge: 0,
              complexityReasons: [],
              color: "",
              sheen: "",
              doorStyle: "",
            }
          : {}),
        // Trades quoted by counting things (stairs, countertop) carry a
        // structured takeoff. Their line items are DERIVED from it, so the
        // generic "add a line" table only holds genuine extras.
        ...(hasTakeoff(category.key)
          ? {
              takeoff: createTradeConfig(
                category.key,
                rateOverridesFor(category.id),
              ),
            }
          : {}),
        // Unit-priced groups start with NO line items — the base scope is the
        // unit pricing; line items only hold add-ons (hinges, glass, etc.).
        lineItems:
          isTiered || unitPriced
            ? []
            : [
                {
                  description: label,
                  quantity: 1,
                  unit: category.unit || "flat",
                  rate: Number(category.defaultRate || 0),
                  amount: Number(category.defaultRate || 0),
                },
              ],
      },
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

  function updateIntakeValue(groupTempId, fieldKey, value) {
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? { ...g, intakeValues: { ...g.intakeValues, [fieldKey]: value } }
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

  function addProductLineItem(groupTempId, product) {
    setScopeGroups((prev) =>
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        const rate = Number(product.unitPrice || 0);
        return {
          ...g,
          lineItems: [
            ...g.lineItems,
            {
              description: product.name,
              quantity: 1,
              unit: product.unit || "flat",
              rate,
              amount: rate,
            },
          ],
        };
      }),
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
    setScopeGroups((prev) =>
      prev.map((g) =>
        g.tempId === groupTempId
          ? {
              ...g,
              lineItems: [
                ...g.lineItems,
                {
                  description: suggestion.description,
                  quantity: 1,
                  unit: suggestion.unit || "flat",
                  rate: 0,
                  amount: 0,
                  // Carried so the builder can look the line's benchmark up
                  // while the rate is still blank. Local to the editor — the
                  // request body drops it and no document reads it, because a
                  // benchmark is FieldQuo's research, not this company's price.
                  catalogKey: suggestion.key,
                },
              ],
            }
          : g,
      ),
    );
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

  // Trades whose takeoff can draw on an aerial photo. Fetched once per client
  // and only when a scope group that can use it is on the quote — geocoding
  // every client the moment they are selected would bill Google for quotes that
  // never go near a map.
  const wantsSiteImage = scopeGroups.some(
    (g) => !g.persisted && g.categoryKey === "paving",
  );

  useEffect(() => {
    const address = selectedClient?.address;
    if (!wantsSiteImage || !address) {
      setSiteImage(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/measure/satellite?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // A failure here is not worth a toast: the designer works on a blank
        // grid, and an address that will not geocode is the client's, not
        // something the estimator can fix from this screen.
        setSiteImage(data?.ok ? data : null);
      })
      .catch(() => {
        if (!cancelled) setSiteImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClient?.address, wantsSiteImage]);

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
  async function handleSave(action, { confirmed = false } = {}) {
    setError("");

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

    const groupsPayload = scopeGroups.map((g) =>
      buildScopeGroupPayload(g, rateOverridesFor(g.categoryId)),
    );
    const costing = costingPayload();

    const shared = {
      subtotal,
      // The CLAMPED figure quoteTotals worked with, not the raw box. If someone
      // typed 50000 off a 4850 quote, the screen already showed 4850 off and a
      // total of 0; saving the 50000 would put a number on the document that
      // contradicts the total beside it.
      discount: appliedDiscount,
      tax,
      taxEnabled,
      total,
      notes,
      processNotes,
      validUntil: validUntil || null,
      clientPhotos,
      ...(costing !== undefined ? { costing } : {}),
    };

    let quote = null;

    if (isEdit) {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shared,
          // Omitted once the client has decided: the API refuses line-item
          // changes on a decided quote, and sending them would fail the whole
          // save including the notes and the expiry that are still legitimately
          // editable.
          ...(canEditScope ? { scopeGroups: groupsPayload } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaving("");
        setError(data?.error || t("app.quoteEdit.saveError"));
        return;
      }
      quote = data;
    } else {
      // Stopped here rather than on unmount: the work is finished at Save, and
      // the seconds spent watching a spinner afterwards are not compose time.
      const composeSeconds = composeTimer.current?.stop() ?? null;

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shared,
          clientId: selectedClient.id,
          composeSeconds,
          scopeGroups: groupsPayload,
          // Always created as a draft. Only a confirmed send promotes it, in
          // app/api/quotes/[id]/send.
          status: "draft",
          language: quoteLanguage || companyLanguage,
        }),
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
        if (sendRes.status === 409 && data?.code === "email_sections_empty") {
          router.push(`/app/quotes/${id}?sendBlocked=quote`);
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

  const TOUR_STEPS = [
    {
      target: "[data-tour='client-picker']",
      title: t("app.quoteNew.tourClientTitle"),
      body: t("app.quoteNew.tourClientBody"),
    },
    {
      target: "[data-tour='service-picker']",
      title: t("app.quoteNew.tourServiceTitle"),
      body: t("app.quoteNew.tourServiceBody"),
    },
    {
      target: "[data-tour='totals']",
      title: t("app.quoteNew.tourReviewTitle"),
      body: t("app.quoteNew.tourReviewBody"),
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
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

      {/* Said once, plainly, instead of rendering live inputs over a refusal.
          PATCH rejects scopeGroups on a decided quote — the lines below are
          read-only and this save carries everything else. */}
      {isEdit && !canEditScope && (
        <div className="bg-muted border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          {t("app.quoteEdit.linesLocked")}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
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
        }}
        onClear={() => setSelectedClient(null)}
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
      {canEditScope && (
        <ServiceTiles categories={categories} onAdd={addScopeGroup} />
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
          >
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
                  siteImageUrl={siteImage?.image?.url || ""}
                  siteAddress={selectedClient?.address || ""}
                  categoryKey={group.categoryKey}
                  takeoff={group.takeoff}
                  book={getPriceBook(
                    group.categoryKey,
                    rateOverridesFor(group.categoryId),
                  )}
                  onChange={(next) =>
                    updatePricing(group.tempId, { takeoff: next })
                  }
                />
              )}

            {!group.persisted &&
              !group.isTiered &&
              !isUnitPriced(group.categoryKey) &&
              !hasTakeoff(group.categoryKey) && (
                <IntakeFields
                  fields={getGroupFields(group)}
                  values={group.intakeValues || {}}
                  onChange={(key, value) =>
                    updateIntakeValue(group.tempId, key, value)
                  }
                />
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

            {locked ? (
              <div className="space-y-1.5">
                {(group.lineItems || []).map((item, li) => (
                  <div
                    key={li}
                    className="flex justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="min-w-0 truncate">{item.description}</span>
                    <span className="tabular-nums shrink-0">
                      ${num(item.amount).toFixed(2)}
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
              />
            )}
          </ScopeGroupCard>
        );
      })}

      {/* Internal cost & margin. Never client-facing — see the component.
          `subtotal` here is the POST-discount figure: the row it feeds is
          labelled "Quote price (pre-tax)", and once there is a discount the
          pre-tax price is what is left after it. */}
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
        />
      )}

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

      {/* Job photos. The column and the quote detail page already supported
          these, but only lead intake ever filled them — a quote typed up by
          staff had nowhere to put the pictures from the site visit. */}
      <div className="bg-card border border-border rounded-xl p-5">
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

      <QuoteTotalsBar
        // What is still missing, worked out here rather than by the model. Same
        // checks lib/ai/quoteReview.js runs — they were never AI work, just null
        // checks that happened to live behind an API call.
        readiness={{
          validUntil,
          processNotes,
          clientPhotos,
          discount,
          subtotal,
          scopeGroups,
          client: selectedClient,
        }}
        readinessItems={scopeGroups.flatMap((g) =>
          Array.isArray(g.lineItems) ? g.lineItems : [],
        )}
        taxNote={taxNote}
        subtotal={subtotal}
        taxableBase={taxableBase}
        discount={discount}
        onDiscountChange={setDiscount}
        tax={tax}
        taxRate={taxRate}
        // Only where it can actually be applied. On an existing quote the rate
        // is whatever was charged when it was written, and it is editable
        // because correcting a wrong rate is a real job.
        onTaxRateChange={isEdit ? setTaxRate : null}
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
        primaryLabelShort={
          isEdit ? t("app.quoteEdit.saveChanges") : t("app.quoteNew.saveAsDraftShort")
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

      {/* Sits below the totals because that's where it sits on the client's
          copy too — the extras are the last thing they read before deciding. */}
      <div>
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
      </div>

      {/* The AI review and the optional extras. Needs a saved quote — the review
          reads the stored row — which is why the builder's third button saves a
          draft first and lands here. */}
      {isEdit && quoteId && (
        <SuggestAddOns
          quoteId={quoteId}
          readOnly={["accepted", "declined"].includes(start.status)}
          onProcessNotes={setProcessNotes}
          autoReview={autoReview}
        />
      )}

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
