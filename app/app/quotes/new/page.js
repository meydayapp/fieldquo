// app/app/quotes/new/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import MediaUploader from "@/app/components/MediaUploader";
import { useRouter } from "next/navigation";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import {
  isUnitPriced,
  COMPLEXITY_LEVELS,
  COMPLEXITY_REASONS,
  finalUnitPrice,
  groupUnits,
  unitPricingSubtotal,
} from "@/app/data/cabinetPricing";

// app/app/quotes/new/page.js — updated imports
import { getIntakeFields } from "@/app/data/quoteIntakeFields";
import {
  isTieredPackageCategory,
  getTieredPackage,
} from "@/app/data/tieredPackages";

import OnboardingTour from "@/app/components/OnboardingTour";
import HelpButton from "@/app/components/HelpButton";
import { fetchJson } from "@/lib/fetchJson";
import { startComposeTimer } from "@/lib/analytics/composeTimer";
import QuoteLanguageBar from "@/app/components/quotes/QuoteLanguageBar";
import ServiceTiles from "@/app/components/quotes/builder/ServiceTiles";
import ScopeGroupCard from "@/app/components/quotes/builder/ScopeGroupCard";
import TradeTakeoff, {
  hasTakeoff,
} from "@/app/components/quotes/builder/TradeTakeoff";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import {
  createTradeConfig,
  buildTradeLineItems,
  estimateCabinetDoorCost,
  cabinetAddOnLines,
} from "@/lib/pricing/tradeScope";
import UnitPricingFields from "@/app/components/quotes/builder/UnitPricingFields";
import IntakeFields from "@/app/components/quotes/builder/IntakeFields";
import TierSelector from "@/app/components/quotes/builder/TierSelector";
import LineItemsTable from "@/app/components/quotes/builder/LineItemsTable";
import CostMarginPanel from "@/app/components/quotes/builder/CostMarginPanel";
import SendConfirmModal from "@/app/components/SendConfirmModal";
import QuoteTotalsBar from "@/app/components/quotes/builder/QuoteTotalsBar";
import ClientPicker from "@/app/components/quotes/builder/ClientPicker";
import { resolveTaxRate, explainTaxSource } from "@/lib/tax/resolveTaxRate";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function NewQuotePage() {
  // How long this quote actually took to build. Started on mount, stopped when
  // it saves. See lib/analytics/composeTimer.js for why createdAt → sentAt
  // can't answer this.
  const composeTimer = useRef(null);
  useEffect(() => {
    composeTimer.current = startComposeTimer();
    // Abandoned drafts report nothing rather than a stray number — a quote
    // nobody finished says nothing about how long finishing one takes.
    return () => composeTimer.current?.cancel();
  }, []);

  const { t } = useTranslation();
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  // The language this quote is WRITTEN in, fixed at creation. Not a display
  // preference — the stored line items and the PDF are produced in it, and it
  // never changes afterwards. See QuoteLanguageBar.
  const [quoteLanguage, setQuoteLanguage] = useState(null);
  const [companyLanguage, setCompanyLanguage] = useState("en");
  const [companyCurrency, setCompanyCurrency] = useState(null);
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

  const [categories, setCategories] = useState([]);
  // Products & Services catalog, each optionally linked to specific quote
  // types (categories) — see getProductsForCategory below for how a scope
  // group only offers the ones relevant to it.
  const [products, setProducts] = useState([]);
  const [scopeGroups, setScopeGroups] = useState([]);
  const [notes, setNotes] = useState("");
  const [clientPhotos, setClientPhotos] = useState([]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0);
  // The company's tax setup, kept raw so the rate can be re-resolved when the
  // selected client changes. See lib/tax/resolveTaxRate.js — it only ever
  // picks between rates the company created themselves.
  const [taxConfig, setTaxConfig] = useState(null);
  const [taxNote, setTaxNote] = useState("");

  // Internal cost & margin estimate (not client-facing). Workers carry an
  // hourlyRate; the estimate uses the selected worker's rate, or a manual
  // fallback rate when none is chosen / no rate is set.
  const [workers, setWorkers] = useState([]);
  const [costWorkerId, setCostWorkerId] = useState("");
  const [fallbackRate, setFallbackRate] = useState(65);
  const [overheadPct, setOverheadPct] = useState(10);
  // The estimator's own read on this job, on top of whatever a recipe worked
  // out. Kept as strings so an empty box stays empty instead of snapping to 0.
  const [manualLabourHours, setManualLabourHours] = useState("");
  const [manualMaterialCost, setManualMaterialCost] = useState("");
  // The company's real overhead for one job: monthly fixed costs divided by
  // how many jobs a week they can take on. Null until Settings > Overhead and
  // a job capacity exist — in which case the percentage above stands in and
  // the panel says so, rather than dressing a guess up as a cost.
  const [overheadPerJob, setOverheadPerJob] = useState(null);
  const [overheadSource, setOverheadSource] = useState(null);
  // Resolved (defaults + saved company overrides) recipe per categoryKey —
  // see Settings > Material Costs / app/api/settings/material-recipes.
  const [recipeOverrides, setRecipeOverrides] = useState({});
  const MARGIN_TARGET = 30;

  // Which cabinet groups have their complexity-reasons panel expanded.
  const [reasonsOpen, setReasonsOpen] = useState({});

  // "" | "draft" | "sent" — which action is in flight, not merely that one is.
  // The totals bar spins only the button that was pressed.
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

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

  useEffect(() => {
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
          // Company-specific overrides on the internal cost recipe (primer/top
          // coat coverage, per-gallon costs, coat counts, consumables, labour
          // minutes) — see Settings > Material Costs. Resolved server-side
          // (defaults merged with any saved overrides), so this is just fed
          // straight into estimateQuoteCost() as-is.
          fetch("/api/settings/material-recipes").then((r) =>
            r.ok ? r.json() : {},
          ),
          // Real overhead per job. Returns 400 with needsCapacity when the
          // company hasn't said how many jobs a week they can take — that is a
          // legitimate "we don't know", not an error to surface here, so the
          // panel falls back to the percentage and labels it.
          fetch("/api/analytics/minimum-price")
            .then((r) => r.json().catch(() => null))
            .catch(() => null),
        ]);
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setCategories(
          Array.isArray(categoriesData)
            ? categoriesData.filter((c) => c.enabled)
            : [],
        );
        setTaxRate(Number(businessInfo?.taxRate || 0));
        setTaxConfig({
          taxRate: Number(businessInfo?.taxRate || 0),
          autoApplyLocalTax: Boolean(businessInfo?.autoApplyLocalTax),
          taxRates: Array.isArray(businessInfo?.taxRates)
            ? businessInfo.taxRates
            : [],
        });
        setCompanyLanguage(businessInfo?.defaultLanguage || "en");
        // The billing currency, so every money render in the builder matches
        // the document the client will receive. businessInfo was already being
        // fetched here — the currency was simply never read out of it, which
        // is why the builder formatted in a hardcoded default.
        setCompanyCurrency(businessInfo?.currency || null);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setWorkers(Array.isArray(workersData) ? workersData : []);
        setRecipeOverrides(
          recipesData && typeof recipesData === "object" ? recipesData : {},
        );
        if (Number.isFinite(Number(overheadData?.costPerJob))) {
          setOverheadPerJob(Number(overheadData.costPerJob));
          setOverheadSource({
            monthlyFixedCosts: overheadData.monthlyFixedCosts,
            jobsPerMonth: overheadData.jobsPerMonth,
          });
        }
      } catch (e) {
        setError(e?.message || t("app.quoteNew.createError"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // A product with no linked quote types is available everywhere (e.g. a
  // generic "Rush Fee"); otherwise it only shows up for a scope group whose
  // category is one of the ones it's linked to (e.g. Flooring never offers
  // cabinet hinges).
  // Re-resolve the tax rate whenever the client changes.
  //
  // Only fires when Settings → Tax has "apply the client's local rate" switched
  // on; otherwise the company's single default stands, which is what every
  // quote did before this setting was honoured. The reason is surfaced beside
  // the tax line rather than left implicit — a tax figure that moves on its own
  // with no explanation is worse than one the user picked.
  useEffect(() => {
    if (!taxConfig) return;
    const result = resolveTaxRate({
      company: taxConfig,
      taxRates: taxConfig.taxRates,
      client: selectedClient,
    });
    setTaxRate(result.rate);
    setTaxNote(
      taxConfig.autoApplyLocalTax && selectedClient
        ? explainTaxSource(result, selectedClient) || ""
        : "",
    );
  }, [taxConfig, selectedClient]);

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
  // quoteIntakeFields.js lookup. Same field shape either way, so the rest of
  // the render logic below doesn't need to know which one it got.
  function getGroupFields(group) {
    if (Array.isArray(group.customFields) && group.customFields.length > 0) {
      return group.customFields;
    }
    return getIntakeFields(group.categoryKey);
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

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  function removeScopeGroup(tempId) {
    setScopeGroups((prev) => prev.filter((g) => g.tempId !== tempId));
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
        categoryId: category.id,
        categoryKey: category.key,
        // Custom quote types carry their fields on the category record
        // itself (ServiceCategory.customFields) rather than in the static
        // quoteIntakeFields.js map — system categories leave this null and
        // fall back to getIntakeFields(categoryKey) at render time.
        customFields: category.customFields || null,
        label, // "Waterlines", "Gas", etc. — already correct, set once, at creation
        isTiered,
        selectedTier: null,
        intakeValues: {},
        // Client-facing unit pricing for door/drawer trades. Base rate seeds
        // from the category's default rate (Settings > Services) and is
        // editable per quote.
        ...(unitPriced
          ? {
              // From the trade's rate card, not `defaultRate`. `defaultRate`
              // is null for every trade that HAS a rate card — Settings >
              // Services hides the single-rate box next to one on purpose —
              // so a cabinet group opened at $0/unit and the book's $150 per
              // door sat there unreachable. Falls back to defaultRate for a
              // unit-priced trade that has no book.
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
        // generic "add a line" table below only holds genuine extras.
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

  function updatePricing(groupTempId, patch) {
    setScopeGroups((prev) =>
      prev.map((g) => (g.tempId === groupTempId ? { ...g, ...patch } : g)),
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
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        return {
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
        };
      }),
    );
  }

  function updateLineItem(groupTempId, itemIndex, field, value) {
    setScopeGroups((prev) =>
      prev.map((g) => {
        if (g.tempId !== groupTempId) return g;
        const lineItems = g.lineItems.map((item, i) => {
          if (i !== itemIndex) return item;
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "rate") {
            updated.amount =
              Number(field === "quantity" ? value : item.quantity) *
              Number(field === "rate" ? value : item.rate);
          }
          return updated;
        });
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
                {
                  description: "",
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
                  // POST body below doesn't send it and no document reads it,
                  // because a benchmark is FieldQuo's research, not this
                  // company's price.
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

  // A group's client-facing total: unit-priced trades charge units × final
  // unit price for the base scope, PLUS any add-on line items; everything else
  // is just the sum of its line items.
  // Lines derived from a structured takeoff. Recomputed rather than stored on
  // the group so the total can never disagree with the form above it.
  function takeoffLines(g) {
    if (!g.takeoff || !hasTakeoff(g.categoryKey)) return [];
    return buildTradeLineItems(
      g.categoryKey,
      g.takeoff,
      rateOverridesFor(g.categoryId),
    );
  }

  function groupTotal(g) {
    const lineSum = (g.lineItems || []).reduce(
      (s, item) => s + Number(item.amount || 0),
      0,
    );
    const takeoffSum = takeoffLines(g).reduce(
      (s, i) => s + Number(i.amount || 0),
      0,
    );
    return (
      takeoffSum +
      (isUnitPriced(g.categoryKey)
        ? unitPricingSubtotal(g) + cabinetAddOnSum(g) + lineSum
        : lineSum)
    );
  }

  // Cabinet upgrades priced from the trade's rate card. Derived here rather
  // than stored on the group, for the same reason takeoff lines are: a total
  // that disagrees with the form above it is worse than no total.
  function cabinetAddOnLinesFor(g) {
    const iv = g.intakeValues || {};
    return cabinetAddOnLines(
      {
        doors: Number(iv.doorCount) || 0,
        drawers: Number(iv.drawerCount) || 0,
        ...g,
      },
      getPriceBook(g.categoryKey, rateOverridesFor(g.categoryId)) || {},
    );
  }

  function cabinetAddOnSum(g) {
    return cabinetAddOnLinesFor(g).reduce(
      (s, i) => s + Number(i.amount || 0),
      0,
    );
  }

  const subtotal = scopeGroups.reduce((sum, g) => sum + groupTotal(g), 0);
  const tax = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + tax;

  // Internal cost/margin estimate — only for scope groups whose category has a
  // recipe (cabinet refinishing in Phase 1). Uses the selected worker's
  // hourlyRate, else the manual fallback rate.
  const selectedWorker = workers.find((w) => w.id === costWorkerId);
  const labourRate =
    selectedWorker?.hourlyRate != null
      ? Number(selectedWorker.hourlyRate)
      : Number(fallbackRate) || 0;
  // Doors bought for a refacing job — a real supplier cost, not a consumable a
  // coverage rate predicts. Summed across groups so a quote with refacing in it
  // shows what the doors actually cost before margin.
  const purchasedMaterialCost = scopeGroups.reduce((sum, g) => {
    if (!g.takeoff) return sum;
    const cost = estimateCabinetDoorCost(
      g.takeoff,
      getPriceBook(g.categoryKey, rateOverridesFor(g.categoryId)) || {},
    );
    return sum + (cost?.total || 0);
  }, 0);

  const estimate = estimateQuoteCost({
    scopeGroups,
    labourRatePerHour: labourRate,
    manualLabourHours: Number(manualLabourHours) || 0,
    manualMaterialCost: Number(manualMaterialCost) || 0,
    price: subtotal,
    // The company's real overhead for one job when we know their capacity;
    // the percentage only stands in until they've told us.
    overheadPerJob: overheadPerJob,
    overheadPctOfPrice: Number(overheadPct) || 0,
    purchasedMaterialCost,
    marginTargetPct: MARGIN_TARGET,
    recipeOverridesByCategory: recipeOverrides,
  });

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

    // This used to check the response for success and do nothing whatsoever
    // on failure — no error, no close, no clue. The most common failure here
    // is a permission or schema error that the user can act on the moment
    // they can read it.
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

  const [pendingSend, setPendingSend] = useState(null);

  // `confirmed` is a parameter rather than state on purpose: setState is not
  // synchronous, so a flag set in the modal's onConfirm would still be false
  // when handleSave read it, and the modal would re-open forever.
  async function handleSave(status, { confirmed = false } = {}) {
    setError("");
    if (!selectedClient) {
      setError(t("app.quoteNew.selectClientFirst"));
      return;
    }
    if (scopeGroups.length === 0) {
      setError(t("app.quoteNew.addServiceFirst"));
      return;
    }

    // ── "Save & send" emails the client the moment it is pressed ──────────
    //
    // It sat next to "Save as draft" with the same weight and no
    // confirmation, so one misplaced click put a price in a homeowner's inbox
    // under the contractor's name. There is no unsend. QA sent two real
    // emails without being asked.
    //
    // Only the SEND path confirms; saving a draft is reversible and asking
    // about it would train people to click through the dialog.
    if (status === "sent" && !confirmed) {
      const to = selectedClient?.email;
      if (!to) {
        setError(
          t(
            "app.quoteNew.noClientEmail",
            "This client has no email address, so there's nowhere to send it. Save it as a draft and add one first.",
          ),
        );
        return;
      }
      setPendingSend({ to });
      return;
    }

    setSaving(status);

    // Stopped here rather than on unmount: the work is finished at Save, and
    // the seconds spent watching a spinner afterwards are not compose time.
    const composeSeconds = composeTimer.current?.stop() ?? null;

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient.id,
        composeSeconds,
        scopeGroups: scopeGroups.map((g) => {
          // For unit-priced trades, prepend a base line item (units × final
          // unit price) so the saved quote/PDF shows the client-facing scope,
          // carrying the pricing detail (complexity, reasons, finish) for the
          // review page.
          let lineItems = g.lineItems;
          if (isUnitPriced(g.categoryKey)) {
            const units = groupUnits(g);
            const rate = finalUnitPrice(g);
            const base = {
              description: g.label,
              quantity: units,
              unit: "unit",
              rate,
              amount: units * rate,
              meta: {
                baseUnitPrice: Number(g.baseUnitPrice) || 0,
                complexityLevel: g.complexityLevel,
                complexityUpcharge:
                  g.complexityLevel === "custom"
                    ? Number(g.complexityUpcharge) || 0
                    : undefined,
                complexityReasons: g.complexityReasons || [],
                color: g.color || "",
                sheen: g.sheen || "",
                doorStyle: g.doorStyle || "",
              },
            };
            lineItems = [
              base,
              ...cabinetAddOnLinesFor(g),
              ...(g.lineItems || []),
            ];
          }

          // Structured takeoffs contribute their derived lines FIRST, so the
          // stair elements or countertop items read above any extras the
          // estimator typed by hand. Derived once here and saved: a sent quote
          // must keep its prices even if the rate card moves next week.
          if (hasTakeoff(g.categoryKey) && g.takeoff) {
            lineItems = [...takeoffLines(g), ...(lineItems || [])];
          }

          return {
            categoryId: g.categoryId,
            label: g.label,
            // The form behind those lines, so reopening the quote restores it
            // instead of a flat list nobody can recount.
            ...(g.takeoff ? { takeoff: g.takeoff } : {}),
            // `catalogKey` is an editor-only handle for looking up the internal
            // benchmark while the rate is blank. It is dropped here rather than
            // saved: the quote a client reads must not carry a pointer into
            // FieldQuo's own pricing research, and a field nothing reads back
            // is the failure class AGENTS.md names first.
            lineItems: lineItems.map(({ catalogKey, ...item }) => item),
            subtotal: groupTotal(g),
          };
        }),
        subtotal,
        tax,
        taxEnabled,
        total,
        notes,
        clientPhotos,
        // Always created as a draft. Only a confirmed send promotes it,
        // in app/api/quotes/[id]/send.
        status: "draft",
        language: quoteLanguage || companyLanguage,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setSaving("");
      setError(data.error || t("app.quoteNew.createError"));
      return;
    }

    const quote = await res.json();

    // "Save & Send" used to mean "create it with status: sent" — the third
    // place in this app where a Send control changed a word and emailed
    // nothing. The quote is created as a DRAFT and then sent through the real
    // route, which flips the status itself once Resend accepts the message.
    //
    // A failed send therefore leaves a draft the user can retry from, rather
    // than a quote marked sent that never left the building.
    if (status === "sent") {
      const sendRes = await fetch(`/api/quotes/${quote.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "quote" }),
      });
      if (!sendRes.ok) {
        const data = await sendRes.json().catch(() => null);
        setSaving("");
        // Land them on the quote regardless — it exists and their work is
        // saved. The reason is carried through so the detail page can say why
        // it's still a draft instead of leaving them to guess.
        router.push(
          `/app/quotes/${quote.id}?sendError=${encodeURIComponent(
            data?.error || t("app.quoteNew.sendFailedSaved"),
          )}`,
        );
        return;
      }
    }

    // Deliberately still "saving" here: the router push is about to unmount
    // this page. Clearing it first flashes an enabled button for a frame,
    // which is long enough to double-submit on a slow connection.
    router.push(`/app/quotes/${quote.id}`);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.quotes.new")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.quoteNew.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <ClientPicker
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

      {/* Language is chosen once, here, and baked into the saved quote. It is
          deliberately not a viewer toggle: the PDF and the emailed copy must
          say the same thing as what was approved. */}
      {selectedClient && (
        <QuoteLanguageBar
          language={quoteLanguage}
          onChange={setQuoteLanguage}
          companyDefault={companyLanguage}
          client={selectedClient}
        />
      )}

      {/* Service picker. The tile grid, the section-preset expansion and the
          per-trade accent all live in ServiceTiles — this page keeps the
          state and the pricing rules. */}
      <ServiceTiles categories={categories} onAdd={addScopeGroup} />

      {/* Scope groups */}
      {scopeGroups.map((group, groupIndex) => (
        <ScopeGroupCard
          key={group.tempId}
          group={group}
          index={groupIndex}
          showIndex={scopeGroups.length > 1}
          subtotal={groupTotal(group)}
          onRemove={() => removeScopeGroup(group.tempId)}
        >
          {isUnitPriced(group.categoryKey) && (
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

          {hasTakeoff(group.categoryKey) && group.takeoff && (
            <TradeTakeoff
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

          {!group.isTiered &&
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

          {group.isTiered && (
            <TierSelector
              group={group}
              onSelect={(tierKey, tierLabel) =>
                selectTier(group.tempId, tierKey, tierLabel)
              }
            />
          )}

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
        </ScopeGroupCard>
      ))}

      {/* Internal cost & margin. Never client-facing — see the component. */}
      <CostMarginPanel
        currency={companyCurrency}
        estimate={estimate}
        workers={workers}
        costWorkerId={costWorkerId}
        onWorkerChange={setCostWorkerId}
        selectedWorker={selectedWorker}
        fallbackRate={fallbackRate}
        onFallbackRateChange={setFallbackRate}
        overheadPct={overheadPct}
        onOverheadChange={setOverheadPct}
        manualLabourHours={manualLabourHours}
        onManualLabourHoursChange={setManualLabourHours}
        manualMaterialCost={manualMaterialCost}
        onManualMaterialCostChange={setManualMaterialCost}
        overheadSource={overheadSource}
        subtotal={subtotal}
        totalGroupCount={scopeGroups.length}
        marginTarget={MARGIN_TARGET}
      />

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
        taxNote={taxNote}
        subtotal={subtotal}
        tax={tax}
        taxRate={taxRate}
        total={total}
        taxEnabled={taxEnabled}
        onTaxToggle={setTaxEnabled}
        saving={saving}
        disabled={!selectedClient || scopeGroups.length === 0}
        onSaveDraft={() => handleSave("draft")}
        onSaveAndSend={() => handleSave("sent")}
      />

      <SendConfirmModal
        isOpen={Boolean(pendingSend)}
        busy={saving === "sent"}
        onClose={() => setPendingSend(null)}
        onConfirm={() => {
          setPendingSend(null);
          handleSave("sent", { confirmed: true });
        }}
        recipient={pendingSend?.to}
        title={t("app.quoteNew.confirmSendTitle", "Send this quote?")}
        detail={t(
          "app.quoteNew.confirmSendDetail",
          "They'll get it by email straight away. You can't unsend it.",
        )}
        confirmLabel={t("app.quoteNew.confirmSendCta", "Save & send")}
      />

      {/* Onboarding tour — add these two lines right here */}
      <HelpButton onClick={() => setShowTour(true)} />
      {showTour && (
        <OnboardingTour
          steps={TOUR_STEPS}
          storageKey="quote-builder"
          onFinish={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
