// app/app/settings/products/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  X,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const PAGE_SIZE_OPTIONS = [6, 10, 25, 50];

const SAMPLE_CSV =
  "name,description,type,unitPrice,costPrice,unit\n" +
  "Concrete Pouring,Pouring and finishing of concrete for driveways and walkways,service,,,\n";

function emptyForm() {
  return {
    name: "",
    description: "",
    type: "service",
    unitPrice: "",
    costPrice: "",
    unit: "",
    categoryIds: [],
  };
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Enabled quote types — the pool of categories a product can be linked to.
  // Same source as quotes/new/page.js so "which quote types can use this
  // product" and "which quote types can I even build a quote in" stay
  // consistent.
  const [quoteTypes, setQuoteTypes] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // product being edited, or null for "add"
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef(null);

  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    // `.then(r => r.json())` with no res.ok check turned every refusal into an
    // empty catalogue — and the route's own comment says it refuses outright
    // rather than blanking prices precisely so this doesn't "read as a broken
    // screen rather than a boundary". The client then produced exactly that
    // broken screen, complete with a live Add product button.
    //
    // It also hid a real outage: a bad call in the route 403'd everybody,
    // owner included, and it looked like nobody had any products.
    return fetch(`/api/products${qs}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "Couldn't load the price book.");
        return data;
      })
      .then((data) => {
        setLoadError("");
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setLoadError(err.message);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => setPage(1), [search, pageSize]);

  useEffect(() => {
    fetch("/api/settings/service-categories")
      .then((r) => r.json())
      .then((data) =>
        setQuoteTypes(Array.isArray(data) ? data.filter((c) => c.enabled) : []),
      );
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description || "",
      type: product.type,
      unitPrice: product.unitPrice ?? "",
      costPrice: product.costPrice ?? "",
      unit: product.unit || "",
      categoryIds: Array.isArray(product.categories)
        ? product.categories.map((c) => c.id)
        : [],
    });
    setShowModal(true);
  }

  function toggleCategory(id) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        unit: form.unit || null,
        categoryIds: form.categoryIds,
      };
      const res = await fetch(
        editing ? `/api/products/${editing.id}` : "/api/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        setShowModal(false);
        load();
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setImportMessage(
        res.ok
          ? t("app.setProducts.importedN", { count: data.imported })
          : data.error || t("app.setProducts.importFailed"),
      );
      if (res.ok) load(); else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const pageItems = products.slice((page - 1) * pageSize, page * pageSize);
  const startIdx = products.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, products.length);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.products")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setProducts.subtitle")}
        </p>
      </div>

      {/* A refusal, said out loud. This screen used to render an empty
          catalogue with a working Add product button for anyone the API turned
          away — which is the "broken screen rather than a boundary" the route
          explicitly set out to avoid. */}
      {loadError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {/* ── Everything below is the catalogue ─────────────────────────────
          When the price book is refused, this whole block goes: the search,
          the Add / Import / Export controls, and the table. QA saw the refusal
          banner sitting ABOVE a live "Add Item" form (with a Cost price
          field), Import CSV, Export CSV and an empty table reading "No
          products or services yet" — which says the catalogue is empty, not
          that access was denied. Every one of those buttons 403s.
          The route's own comment says it refuses outright rather than blanking
          prices, so the screen "reads as a boundary rather than a broken
          screen". This is the half that made it a broken screen. */}
      {!loadError && (
      <>
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            placeholder={t("app.action.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold shrink-0"
        >
          <Plus size={14} /> {t("app.setProducts.addItem")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>{t("app.field.name")}</span>
          <span>{t("app.setProducts.description")}</span>
          <span>{t("app.setProducts.type")}</span>
          <span></span>
        </div>
        <div className="divide-y divide-border">
          {loading && (
            <div className="p-6 animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-muted rounded" />
              ))}
            </div>
          )}
          {!loading && pageItems.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              {t("app.setProducts.emptyList")}
            </p>
          )}
          {!loading &&
            pageItems.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 items-center"
              >
                <span className="text-sm font-medium text-foreground">
                  {p.name}
                  {Array.isArray(p.categories) && p.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.categories.map((c) => (
                        <span
                          key={c.id}
                          className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {p.description}
                </span>
                <span className="text-xs bg-muted px-2.5 py-1 rounded-full capitalize w-fit">
                  {p.type}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {!loading && products.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              {t("app.setProducts.showingRange", {
                start: startIdx,
                end: endIdx,
                total: products.length,
              })}
            </span>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-border rounded px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t("app.setProducts.perPage", { n })}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 border border-border rounded disabled:opacity-40"
                >
                  {t("app.setProducts.prev")}
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 border border-border rounded disabled:opacity-40"
                >
                  {t("app.action.next")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground">
          {t("app.setProducts.costsHeading")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setProducts.costsBody")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {t("app.setProducts.importHeading")}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t("app.setProducts.importBody")}
          </p>
          {importMessage && (
            <p className="text-sm text-foreground mb-2">{importMessage}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm font-medium border border-border rounded-full px-4 py-2 cursor-pointer hover:bg-muted">
              <Upload size={14} />
              {importing
                ? t("app.setProducts.importing")
                : t("app.setProducts.importCsv")}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
                disabled={importing}
              />
            </label>
            <button
              onClick={downloadSample}
              className="text-sm font-medium text-muted-foreground px-4 py-2 rounded-full hover:bg-muted"
            >
              {t("app.setProducts.downloadSample")}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {t("app.setProducts.exportHeading")}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t("app.setProducts.exportBody")}
          </p>
          <a
            href="/api/products/export"
            className="flex items-center gap-2 w-fit text-sm font-medium border border-border rounded-full px-4 py-2 hover:bg-muted"
          >
            <Download size={14} /> {t("app.setProducts.exportCsv")}
          </a>
        </div>
      </div>
      </>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {editing
                  ? t("app.setProducts.editItem")
                  : t("app.setProducts.addItem")}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder={t("app.field.name")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <textarea
                placeholder={t("app.setProducts.description")}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={inputClass}
                >
                  <option value="service">
                    {t("app.setProducts.optService")}
                  </option>
                  <option value="product">
                    {t("app.setProducts.optProduct")}
                  </option>
                </select>
                <input
                  placeholder={t("app.setProducts.unitPlaceholder")}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {t("app.setProducts.unitPrice")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(e) =>
                      setForm({ ...form, unitPrice: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {t("app.setProducts.costPrice")}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("app.setProducts.availableOnTypes")}
                </label>
                {quoteTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("app.setProducts.noQuoteTypes")}
                  </p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                    {quoteTypes.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={form.categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.setProducts.leaveUnchecked")}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving
                  ? t("app.action.saving")
                  : editing
                    ? t("app.setProducts.saveChanges")
                    : t("app.setProducts.addItem")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
