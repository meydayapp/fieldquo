// app/app/quotes/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Search, TrendingUp, AlertTriangle } from "lucide-react";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import { hasRecipe } from "@/app/data/materialRecipes";
import {
  isUnitPriced,
  COMPLEXITY_LEVELS,
  COMPLEXITY_REASONS,
  finalUnitPrice,
  groupUnits,
  unitPricingSubtotal,
} from "@/app/data/cabinetPricing";
import { getSectionPresets } from "@/app/data/sectionPresets";

// app/app/quotes/new/page.js — updated imports
import { getIntakeFields } from "@/app/data/quoteIntakeFields";
import {
  isTieredPackageCategory,
  getTieredPackage,
} from "@/app/data/tieredPackages";

import OnboardingTour from "@/app/components/OnboardingTour";
import HelpButton from "@/app/components/HelpButton";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput } from "@/lib/validation";

export default function NewQuotePage() {
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    type: "individual",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
  });

  const [categories, setCategories] = useState([]);
  // Products & Services catalog, each optionally linked to specific quote
  // types (categories) — see getProductsForCategory below for how a scope
  // group only offers the ones relevant to it.
  const [products, setProducts] = useState([]);
  const [scopeGroups, setScopeGroups] = useState([]);
  const [notes, setNotes] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0);

  // Internal cost & margin estimate (not client-facing). Workers carry an
  // hourlyRate; the estimate uses the selected worker's rate, or a manual
  // fallback rate when none is chosen / no rate is set.
  const [workers, setWorkers] = useState([]);
  const [costWorkerId, setCostWorkerId] = useState("");
  const [fallbackRate, setFallbackRate] = useState(65);
  const [overheadPct, setOverheadPct] = useState(10);
  // Resolved (defaults + saved company overrides) recipe per categoryKey —
  // see Settings > Material Costs / app/api/settings/material-recipes.
  const [recipeOverrides, setRecipeOverrides] = useState({});
  const MARGIN_TARGET = 30;

  // Which cabinet groups have their complexity-reasons panel expanded.
  const [reasonsOpen, setReasonsOpen] = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  const TOUR_STEPS = [
    {
      target: "[data-tour='client-picker']",
      title: "Start with a client",
      body: "Search an existing client or add a new one.",
    },
    {
      target: "[data-tour='service-picker']",
      title: "Add your services",
      body: "Click a service to add it — your own pricing fills in automatically.",
    },
    {
      target: "[data-tour='totals']",
      title: "Review and send",
      body: "Check the total, then save as a draft or send it right away.",
    },
  ];

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/settings/service-categories").then((r) => r.json()),
      fetch("/api/settings/business-info").then((r) => r.json()),
      fetch("/api/products").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/workers").then((r) => (r.ok ? r.json() : [])),
      // Company-specific overrides on the internal cost recipe (primer/top
      // coat coverage, per-gallon costs, coat counts, consumables, labour
      // minutes) — see Settings > Material Costs. Resolved server-side
      // (defaults merged with any saved overrides), so this is just fed
      // straight into estimateQuoteCost() as-is.
      fetch("/api/settings/material-recipes").then((r) => (r.ok ? r.json() : {})),
    ]).then(
      ([
        clientsData,
        categoriesData,
        businessInfo,
        productsData,
        workersData,
        recipesData,
      ]) => {
        setClients(Array.isArray(clientsData) ? clientsData : []);
        setCategories(
          Array.isArray(categoriesData)
            ? categoriesData.filter((c) => c.enabled)
            : [],
        );
        setTaxRate(Number(businessInfo?.taxRate || 0));
        setProducts(Array.isArray(productsData) ? productsData : []);
        setWorkers(Array.isArray(workersData) ? workersData : []);
        setRecipeOverrides(recipesData && typeof recipesData === "object" ? recipesData : {});
        setLoading(false);
      },
    );
  }, []);

  // A product with no linked quote types is available everywhere (e.g. a
  // generic "Rush Fee"); otherwise it only shows up for a scope group whose
  // category is one of the ones it's linked to (e.g. Flooring never offers
  // cabinet hinges).
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

  function addScopeGroup(category) {
    setScopeGroups((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        categoryId: category.id,
        label: category.label,
        lineItems: [
          {
            description: category.label,
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

  function addScopeGroup(category) {
    const isTiered = isTieredPackageCategory(category.key);
    const fields = getIntakeFields(category.key);

    setScopeGroups((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        categoryId: category.id,
        categoryKey: category.key,
        label: category.label,
        isTiered,
        selectedTier: null,
        intakeValues: {},
        lineItems: isTiered
          ? [] // tiered categories build their line item once a tier is selected
          : [
              {
                description: category.label,
                quantity: 1,
                unit: category.unit || "flat",
                rate: Number(category.defaultRate || 0),
                amount: Number(category.defaultRate || 0),
              },
            ],
      },
    ]);
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
              baseUnitPrice: Number(category.defaultRate || 0),
              complexityLevel: "standard",
              complexityUpcharge: 0,
              complexityReasons: [],
              color: "",
              sheen: "",
              doorStyle: "",
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
  function groupTotal(g) {
    const lineSum = (g.lineItems || []).reduce(
      (s, item) => s + Number(item.amount || 0),
      0,
    );
    return isUnitPriced(g.categoryKey)
      ? unitPricingSubtotal(g) + lineSum
      : lineSum;
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
  const estimate = estimateQuoteCost({
    scopeGroups,
    labourRatePerHour: labourRate,
    price: subtotal,
    overheadPctOfPrice: Number(overheadPct) || 0,
    marginTargetPct: MARGIN_TARGET,
    recipeOverridesByCategory: recipeOverrides,
  });

  async function handleCreateClient(e) {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    if (res.ok) {
      const created = await res.json();
      setClients((prev) => [created, ...prev]);
      setSelectedClient(created);
      setShowNewClient(false);
      setNewClient({
        type: "individual",
        name: "",
        contactName: "",
        email: "",
        phone: "",
        address: "",
      });
    }
  }

  async function handleSave(status) {
    setError("");
    if (!selectedClient) {
      setError("Select or create a client first");
      return;
    }
    if (scopeGroups.length === 0) {
      setError("Add at least one service to the quote");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient.id,
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
            lineItems = [base, ...(g.lineItems || [])];
          }
          return {
            categoryId: g.categoryId,
            label: g.label,
            lineItems,
            subtotal: groupTotal(g),
          };
        }),
        subtotal,
        tax,
        total,
        notes,
        status,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Could not create quote");
      return;
    }

    const quote = await res.json();
    router.push(`/app/quotes/${quote.id}`);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-gray-200 rounded-xl" />
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
        <p className="text-sm text-gray-500 mt-1">
          Build a quote from your enabled services.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Client selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Client</h2>

        {selectedClient ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div>
              <div className="font-medium text-gray-900">
                {selectedClient.name}
              </div>
              <div className="text-sm text-gray-500">
                {selectedClient.email || selectedClient.phone}
              </div>
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-sm text-gray-500 underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {clientSearch && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto mb-2">
                {filteredClients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-gray-500">No matches.</p>
                )}
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setClientSearch("");
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.email || c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowNewClient(true)}
              className="text-sm font-medium text-gray-900 flex items-center gap-1"
            >
              <Plus size={14} /> Add new client
            </button>
          </div>
        )}
      </div>

      {/* Service picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Add a service</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">
            No services enabled yet — go to Settings → Services to turn some on.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const presets = getSectionPresets(cat.key);

              if (!presets) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => addScopeGroup(cat, cat.label)}
                    className="border border-gray-300 rounded-full px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    + {cat.label}
                  </button>
                );
              }

              // Trades with known sections show them as their own one-click buttons,
              // grouped visually under the category name — no retyping, no generic label.
              return (
                <div key={cat.id} className="w-full">
                  <div className="text-xs font-medium text-gray-500 mb-1.5">
                    {cat.label}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {presets.map((sectionLabel) => (
                      <button
                        key={sectionLabel}
                        onClick={() => addScopeGroup(cat, sectionLabel)}
                        className="border border-gray-300 rounded-full px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        + {sectionLabel}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scope groups */}
      {scopeGroups.map((group) => (
        <div
          key={group.tempId}
          className="bg-white border border-gray-200 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{group.label}</h3>
            <button
              onClick={() => removeScopeGroup(group.tempId)}
              className="text-gray-400"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Client-facing unit pricing — cabinet refinishing / refacing */}
          {isUnitPriced(group.categoryKey) &&
            (() => {
              const units = groupUnits(group);
              const finalPrice = finalUnitPrice(group);
              const iv = group.intakeValues || {};
              return (
                <div className="mb-4 pb-4 border-b border-gray-100 space-y-4">
                  {/* Doors / Drawers / Units */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Doors</label>
                      <input
                        type="number"
                        min="0"
                        value={iv.doorCount || ""}
                        onChange={(e) =>
                          updateIntakeValue(group.tempId, "doorCount", e.target.value)
                        }
                        className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Drawers</label>
                      <input
                        type="number"
                        min="0"
                        value={iv.drawerCount || ""}
                        onChange={(e) =>
                          updateIntakeValue(group.tempId, "drawerCount", e.target.value)
                        }
                        className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Total Units</label>
                      <div className="mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-center text-gray-900">
                        {units}
                      </div>
                    </div>
                  </div>

                  {/* Wood — feeds the internal primer-coats rule */}
                  <div>
                    <label className="text-xs text-gray-500">
                      Wood / Door Material
                    </label>
                    <select
                      value={iv.woodSpecies || ""}
                      onChange={(e) =>
                        updateIntakeValue(group.tempId, "woodSpecies", e.target.value)
                      }
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {["oak", "ash", "hickory", "pine", "maple", "mdf_prefinished", "thermofoil", "other"].map(
                        (w) => (
                          <option key={w} value={w}>
                            {w.replace(/_/g, " ")}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  {/* Base / Upcharge / Final */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">
                        Base Price / Unit
                      </label>
                      <div className="relative mt-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={group.baseUnitPrice ?? ""}
                          onChange={(e) =>
                            updatePricing(group.tempId, {
                              baseUnitPrice: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full border border-gray-300 rounded pl-5 pr-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Upcharge</label>
                      <div className="mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm text-center text-gray-700">
                        {group.complexityLevel === "custom"
                          ? `+$${Number(group.complexityUpcharge) || 0}`
                          : `+$${COMPLEXITY_LEVELS.find((l) => l.value === group.complexityLevel)?.upcharge || 0}`}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Final / Unit</label>
                      <div className="mt-1 px-3 py-1.5 bg-gray-900 rounded text-sm font-semibold text-center text-white">
                        ${finalPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Complexity level */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">
                      Project Complexity
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMPLEXITY_LEVELS.map((lvl) => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() =>
                            updatePricing(group.tempId, {
                              complexityLevel: lvl.value,
                            })
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            group.complexityLevel === lvl.value
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {lvl.label}
                          {lvl.upcharge ? ` (+$${lvl.upcharge})` : ""}
                        </button>
                      ))}
                    </div>
                    {group.complexityLevel === "custom" && (
                      <div className="mt-2 w-40">
                        <label className="text-xs text-gray-500">
                          Custom upcharge / unit
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={group.complexityUpcharge || ""}
                          onChange={(e) =>
                            updatePricing(group.tempId, {
                              complexityUpcharge: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                          placeholder="e.g. 60"
                        />
                      </div>
                    )}
                  </div>

                  {/* Complexity reasons */}
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setReasonsOpen((p) => ({
                          ...p,
                          [group.tempId]: !p[group.tempId],
                        }))
                      }
                      className="text-xs font-medium text-gray-700 flex items-center gap-1"
                    >
                      {reasonsOpen[group.tempId] ? "▾" : "▸"} Complexity Reasons
                      {(group.complexityReasons?.length || 0) > 0 && (
                        <span className="bg-gray-900 text-white rounded-full px-1.5 text-[10px]">
                          {group.complexityReasons.length}
                        </span>
                      )}
                      <span className="text-gray-400 font-normal">
                        — shown on quote &amp; PDF
                      </span>
                    </button>
                    {reasonsOpen[group.tempId] && (
                      <div className="mt-2 border border-gray-200 rounded-lg p-3 space-y-3">
                        {Object.entries(COMPLEXITY_REASONS).map(([cat, reasons]) => (
                          <div key={cat}>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                              {cat}
                            </p>
                            {reasons.map((r) => (
                              <label
                                key={r.id}
                                className="flex items-start gap-2 text-sm py-0.5 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={
                                    group.complexityReasons?.includes(r.id) || false
                                  }
                                  onChange={() =>
                                    toggleComplexityReason(group.tempId, r.id)
                                  }
                                />
                                <span className="text-gray-700">{r.label}</span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Finish details */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Color</label>
                      <input
                        value={group.color || ""}
                        onChange={(e) =>
                          updatePricing(group.tempId, { color: e.target.value })
                        }
                        className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                        placeholder="e.g. BM Chantilly Lace"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Sheen</label>
                      <select
                        value={group.sheen || ""}
                        onChange={(e) =>
                          updatePricing(group.tempId, { sheen: e.target.value })
                        }
                        className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">Select…</option>
                        <option value="matte">Matte</option>
                        <option value="satin">Satin</option>
                        <option value="semi-gloss">Semi-Gloss</option>
                        <option value="gloss">Gloss</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Door Style</label>
                      <input
                        value={group.doorStyle || ""}
                        onChange={(e) =>
                          updatePricing(group.tempId, { doorStyle: e.target.value })
                        }
                        className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                        placeholder="e.g. Shaker"
                      />
                    </div>
                  </div>

                  {/* Base scope total */}
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-gray-600">
                      {units} unit{units === 1 ? "" : "s"} × ${finalPrice.toFixed(2)}
                    </span>
                    <span className="text-base font-bold text-gray-900">
                      ${(units * finalPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Structured intake fields — formula-driven categories, or a
              custom quote type's chosen fields */}
          {!group.isTiered &&
            !isUnitPriced(group.categoryKey) &&
            getGroupFields(group).length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-gray-100">
              {getGroupFields(group).map((field) => (
                <div key={field.key}>
                  <label className="text-xs text-gray-500">{field.label}</label>
                  {field.type === "select" ? (
                    <select
                      value={group.intakeValues[field.key] || ""}
                      onChange={(e) =>
                        updateIntakeValue(
                          group.tempId,
                          field.key,
                          e.target.value,
                        )
                      }
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "boolean" ? (
                    <label className="flex items-center gap-2 mt-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!group.intakeValues[field.key]}
                        onChange={(e) =>
                          updateIntakeValue(
                            group.tempId,
                            field.key,
                            e.target.checked,
                          )
                        }
                      />
                      Yes
                    </label>
                  ) : (
                    <input
                      type="number"
                      value={group.intakeValues[field.key] || ""}
                      onChange={(e) =>
                        updateIntakeValue(
                          group.tempId,
                          field.key,
                          e.target.value,
                        )
                      }
                      className="w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tiered package selector — junk removal, auto detailing, chimney sweep, elevator */}
          {group.isTiered && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-2">
                {getTieredPackage(group.categoryKey)?.label}
              </div>
              <div className="space-y-2">
                {getTieredPackage(group.categoryKey)?.tiers.map((tier) => (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() =>
                      selectTier(group.tempId, tier.key, tier.label)
                    }
                    className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm ${
                      group.selectedTier === tier.key
                        ? "border-gray-900 bg-gray-50 font-medium"
                        : "border-gray-200"
                    }`}
                  >
                    {tier.label}
                    {tier.priceHint && (
                      <span className="text-xs text-gray-400 ml-2">
                        ({tier.priceHint})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line items — same editable table regardless of how the group started */}
          <div className="space-y-2">
            {group.lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(
                      group.tempId,
                      i,
                      "description",
                      e.target.value,
                    )
                  }
                  className="col-span-5 border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    updateLineItem(
                      group.tempId,
                      i,
                      "quantity",
                      Number(e.target.value),
                    )
                  }
                  className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={item.rate}
                  onChange={(e) =>
                    updateLineItem(
                      group.tempId,
                      i,
                      "rate",
                      Number(e.target.value),
                    )
                  }
                  className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm"
                />
                <div className="col-span-2 text-sm font-medium text-gray-900 text-right">
                  ${Number(item.amount).toFixed(2)}
                </div>
                <button
                  onClick={() => removeLineItem(group.tempId, i)}
                  className="col-span-1 text-gray-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <button
              onClick={() => addLineItem(group.tempId)}
              className="text-xs font-medium text-gray-900 flex items-center gap-1"
            >
              <Plus size={12} /> Add line item
            </button>

            {getProductsForCategory(group.categoryId).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const product = products.find(
                    (p) => p.id === e.target.value,
                  );
                  if (product) addProductLineItem(group.tempId, product);
                  e.target.value = "";
                }}
                className="text-xs border border-gray-300 rounded-full px-3 py-1.5 bg-white"
              >
                <option value="">+ Add from Products & Services...</option>
                {getProductsForCategory(group.categoryId).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.unitPrice != null ? ` — $${Number(p.unitPrice).toFixed(2)}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}

      {/* Internal Cost & Margin — only shown when at least one scope group is
          estimable. Never client-facing. */}
      {estimate.hasEstimable && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={16} /> Cost &amp; Margin
              <span className="text-xs font-normal text-gray-400">
                (internal — not shown to client)
              </span>
            </h2>
            {estimate.marginPct != null && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  estimate.signal === "green"
                    ? "bg-green-50 text-green-700"
                    : estimate.signal === "amber"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {estimate.signal === "red" && <AlertTriangle size={12} />}
                {estimate.marginPct}% margin
                {estimate.signal !== "green" &&
                  ` · below ${MARGIN_TARGET}% target`}
              </span>
            )}
          </div>

          {/* Labour rate source */}
          <div className="flex flex-wrap items-end gap-3 mt-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Assigned worker
              </label>
              <select
                value={costWorkerId}
                onChange={(e) => setCostWorkerId(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Use manual rate</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.hourlyRate != null ? ` — $${Number(w.hourlyRate)}/hr` : " — no rate set"}
                  </option>
                ))}
              </select>
            </div>
            {(!selectedWorker || selectedWorker.hourlyRate == null) && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Labour rate $/hr
                </label>
                <input
                  type="number"
                  value={fallbackRate}
                  onChange={(e) => setFallbackRate(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Overhead % of price
              </label>
              <input
                type="number"
                value={overheadPct}
                onChange={(e) => setOverheadPct(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-20"
              />
            </div>
          </div>

          {/* Per-group material + labour breakdown */}
          {estimate.groups.map((g) => (
            <div key={g.tempId} className="mb-3 border-t border-gray-100 pt-3">
              <div className="text-sm font-medium text-gray-800 mb-1">
                {g.label}{" "}
                <span className="text-xs text-gray-400">
                  · {g.summaryParts.join(" · ")}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {g.materials.map((m, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {m.name} — {m.qty} {m.unit}
                    </span>
                    <span>${m.cost.toFixed(2)}</span>
                  </div>
                ))}
                {g.labourBreakdown.map((l, i) => (
                  <div key={`l${i}`} className="flex justify-between text-gray-600">
                    <span>
                      {l.name} — {l.hours} hrs
                    </span>
                    <span>${l.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Estimate totals vs price */}
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Materials</span>
              <span>${estimate.materialTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Labour</span>
              <span>${estimate.labourCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Overhead ({overheadPct}%)</span>
              <span>${estimate.overhead.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100 mt-1">
              <span>Estimated cost</span>
              <span>${estimate.estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Quote price (pre-tax)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {estimate.marginPct != null && (
              <div
                className={`flex justify-between font-semibold pt-1 ${
                  estimate.signal === "red" ? "text-red-600" : "text-gray-900"
                }`}
              >
                <span>Estimated profit</span>
                <span>
                  ${(subtotal - estimate.estimatedCost).toFixed(2)} (
                  {estimate.marginPct}%)
                </span>
              </div>
            )}
          </div>
          {estimate.groups.length < scopeGroups.length && (
            <p className="text-xs text-gray-400 mt-3">
              Only quote types with a cost recipe are estimated (cabinet
              refinishing so far). Other line items aren't included in this
              estimate yet.
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything the client should know..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      {/* Totals + tax toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
          />
          Apply tax ({taxRate}%)
        </label>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 text-base pt-1 border-t border-gray-100 mt-1">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="border border-gray-300 px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSave("sent")}
          disabled={saving}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save & Send"}
        </button>
      </div>

      {showNewClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">New Client</h2>
              <button onClick={() => setShowNewClient(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setNewClient({ ...newClient, type: "individual" })
                  }
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    newClient.type !== "company"
                      ? "border-gray-900 bg-gray-50 font-medium"
                      : "border-gray-200"
                  }`}
                >
                  Homeowner
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewClient({ ...newClient, type: "company" })
                  }
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    newClient.type === "company"
                      ? "border-gray-900 bg-gray-50 font-medium"
                      : "border-gray-200"
                  }`}
                >
                  Company / Contractor
                </button>
              </div>
              <input
                required
                placeholder={
                  newClient.type === "company" ? "Company name" : "Name"
                }
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              {newClient.type === "company" && (
                <input
                  placeholder="Contact person"
                  value={newClient.contactName}
                  onChange={(e) =>
                    setNewClient({ ...newClient, contactName: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(e) =>
                  setNewClient({ ...newClient, email: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                placeholder="555-123-4567"
                value={newClient.phone}
                onChange={(e) =>
                  setNewClient({
                    ...newClient,
                    phone: formatPhoneInput(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <AddressAutocomplete
                value={newClient.address}
                onChange={(v) => setNewClient({ ...newClient, address: v })}
                onPlaceSelected={({ address }) =>
                  setNewClient((prev) => ({ ...prev, address }))
                }
                placeholder={
                  newClient.type === "company"
                    ? "Business address (optional)"
                    : "Address"
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-2 rounded-full text-sm font-semibold"
              >
                Create Client
              </button>
            </form>
          </div>
        </div>
      )}
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
