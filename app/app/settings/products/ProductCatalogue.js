// app/app/settings/products/ProductCatalogue.js
//
// The whole of Settings > Products & Services as one component. The page
// renders it, and so does the home page's "Review your add-ons" dialog
// (app/components/dashboard/stepPanels.js): the same catalogue, the same
// Add Item form, the same POST — so an add-on repriced from the checklist is
// exactly one repriced from Settings.
//
// `compact` is what the dialog passes: no page heading, no "Back to home",
// and none of the cost / import / export cards below the table — the step
// is "review your add-ons", and the table with its Add and edit controls is
// that. `onChanged` fires after an item is added, edited or deleted so the
// checklist can re-read itself; the page passes neither.
//
// ── Removed, and Added for you (2026-09-25) ────────────────────────────────
//
// Two tabs: the list (every row still offered) and "Removed (N)" — rows set
// `active: false` by Remove here or by unticking in "Confirm what you
// quote". A removed row is never deleted (lib/products/offered.js says who
// stops offering it); "Add back" is PATCH { active: true } on the SAME row, so
// its price and template lines come back exactly as they were. The owner:
// "they might offer it in the future, so they can always add it back."
//
// A seeded row the company has not renamed or repriced carries an "Added for
// you" badge (the rule is lib/services/addedForYou.js, computed by GET
// /api/products), and the first time a user sees one, a line at the top says
// where those rows came from — dismissed per user through /api/ui-state, the
// same store the tours use.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Archive,
  RotateCcw,
  X,
} from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import AutoTranslateBanner from "@/app/components/settings/AutoTranslateBanner";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";
import { offeredOnly, removedOnly } from "@/lib/products/offered";
import ProductFormModal from "./ProductFormModal";

/** The per-user notice key for the "Added for you" explanation line. */
const ADDED_FOR_YOU_NOTICE = "products:added-for-you";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const PAGE_SIZE_OPTIONS = [6, 10, 25, 50];

const SAMPLE_CSV =
  "name,description,type,unitPrice,costPrice,unit\n" +
  "Concrete Pouring,Pouring and finishing of concrete for driveways and walkways,service,,,\n";

export default function ProductCatalogue({ compact = false, onChanged } = {}) {
  const { t } = useTranslation();
  const [autoTranslate, setAutoTranslate] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // The category list is loaded separately from the catalogue, so it needs
  // its own failure state — the modal below makes a claim when it is empty.
  const [quoteTypesError, setQuoteTypesError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  // "list" = still offered; "removed" = archived (Product.active false).
  const [tab, setTab] = useState("list");
  // The row whose Remove / Add back is in flight, so its button can't be
  // pressed twice.
  const [busyId, setBusyId] = useState(null);
  // The "Added for you" explanation: hidden until /api/ui-state answers, so a
  // user who dismissed it never sees it flash back while the read is out.
  const [noticeSeen, setNoticeSeen] = useState(true);
  useEffect(() => {
    let live = true;
    fetch("/api/ui-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live || !data) return;
        const dismissed = Array.isArray(data.dismissedNotices) ? data.dismissedNotices : [];
        setNoticeSeen(dismissed.includes(ADDED_FOR_YOU_NOTICE));
      })
      .catch(() => {
        /* the line stays hidden — a nudge, never a blocker */
      });
    return () => {
      live = false;
    };
  }, []);

  // Enabled quote types — the pool of categories a product can be linked to.
  // Same source as quotes/new/page.js so "which quote types can use this
  // product" and "which quote types can I even build a quote in" stay
  // consistent.
  const [quoteTypes, setQuoteTypes] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // product being edited, or null for "add"

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef(null);

  const [loadError, setLoadError] = useState("");
  // The billing currency, for the benchmark range in the price editor: the
  // range is USD quartiles and must be shown in the currency the price box is
  // in. CAD (the schema default) until business-info answers.
  const [currency, setCurrency] = useState("CAD");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/business-info");
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data?.currency === "string" && data.currency) setCurrency(data.currency);
      } catch {
        /* the range renders in CAD; the price box is unaffected */
      }
    })();
  }, []);

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

  useEffect(() => setPage(1), [search, pageSize, tab]);

  useEffect(() => {
    // No res.ok, no catch, and `useState([])` — so a 500 rendered
    // app.setProducts.noQuoteTypes ("you have no quote types to attach this
    // to") inside the modal, and the user saved a product with no category
    // links believing there were none to pick. It also left an unhandled
    // rejection. The /api/products load twelve lines above already does this
    // properly; this one was written the old way beside it.
    (async () => {
      try {
        const res = await fetch("/api/settings/service-categories");
        if (!res.ok) {
          setQuoteTypesError(await reportResponseError(res));
          return;
        }
        const data = await res.json();
        setQuoteTypes(Array.isArray(data) ? data.filter((c) => c.enabled) : []);
        setQuoteTypesError("");
      } catch {
        setQuoteTypesError(t("app.load.network"));
      }
    })();
  }, [t]);

  // The form itself is ProductFormModal.js (shared with the "Confirm what
  // you quote" screen); it builds its fields from `editing` when it mounts.
  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(product) {
    setEditing(product);
    setShowModal(true);
  }

  async function handleDelete(id, name) {
    // ── A hard delete behind one trash icon ──────────────────────────────
    //
    // DELETE /api/products/[id] is `db.product.delete` — no soft flag, no
    // undo, nothing else holds a copy of the rate. Two of these buttons render
    // per row (mobile and desktop) and neither asked. Its siblings on this
    // same settings section do: job-photo-tags confirms before retiring a tag,
    // and leave confirms before deactivating a policy — both less consequential
    // than deleting a price-book line.
    const confirmed = window.confirm(
      t(
        "app.setProducts.deleteConfirm",
        "Delete {name}? Its price and description are removed for good — quotes already written keep the numbers they were built with.",
        { name },
      ),
    );
    if (!confirmed) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      await onChanged?.();
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  // Remove (active: false) and Add back (active: true) — one PATCH of one
  // column on the same row. Nothing else is sent, so nothing else changes.
  async function setActive(product, active) {
    setBusyId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      await load();
      await onChanged?.();
    } catch {
      showError(t("app.load.network"));
    } finally {
      setBusyId(null);
    }
  }

  function dismissNotice() {
    // Optimistic, like the seat-sharing banner: gone now, and the write is
    // what keeps it gone on the user's other devices.
    setNoticeSeen(true);
    fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: ADDED_FOR_YOU_NOTICE }),
    }).catch(() => {});
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

  const offered = offeredOnly(products);
  const removed = removedOnly(products);
  const shown = tab === "removed" ? removed : offered;
  const anyAddedForYou = offered.some((p) => p.addedForYou === true);
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const pageItems = shown.slice((page - 1) * pageSize, page * pageSize);
  const startIdx = shown.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, shown.length);

  // The row's actions, rendered twice (beside the name below `sm`, in the
  // grid's fourth column above it). One definition so the two cannot drift.
  const rowActions = (p) =>
    tab === "removed" ? (
      <button
        onClick={() => setActive(p, true)}
        disabled={busyId === p.id}
        className="min-h-[44px] px-3 flex items-center gap-1.5 text-sm font-semibold text-foreground border border-border rounded-full hover:bg-muted disabled:opacity-50"
      >
        <RotateCcw size={14} aria-hidden="true" />
        {t("app.setProducts.addBack", "Add back")}
      </button>
    ) : (
      <>
        <button
          onClick={() => openEdit(p)}
          aria-label={t("app.action.edit", "Edit")}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => setActive(p, false)}
          disabled={busyId === p.id}
          aria-label={t("app.setProducts.removeFromList", "Remove from your list")}
          title={t("app.setProducts.removeFromList", "Remove from your list")}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Archive size={14} />
        </button>
        <button
          onClick={() => handleDelete(p.id, p.name)}
          aria-label={t("app.action.delete", "Delete")}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </>
    );

  return (
    <div className={compact ? "space-y-6" : "p-4 sm:p-6 max-w-4xl mx-auto space-y-6"}>
      <AutoTranslateBanner result={autoTranslate} id={autoTranslate?.id} />
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.settings.products")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setProducts.subtitle")}
          </p>
          <BackToHome />
        </div>
      )}

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
          the Add / Import controls, and the table. QA saw the refusal
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

      {/* Where the seeded rows came from — once per user, dismissible. Only
          when a row actually carries the badge, so the sentence is never
          about rows the company doesn't have. */}
      {!noticeSeen && anyAddedForYou && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground" data-added-for-you-notice>
          <p className="flex-1 py-1.5">
            {t(
              "app.setProducts.addedForYouNotice",
              "These were added for your trade at signup — edit prices or remove what you don't offer. Removed services aren't deleted — add them back any time.",
            )}
          </p>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label={t("app.toast.dismiss", "Dismiss")}
            className="shrink-0 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* The list, and what was removed from it. "Removed" is where the way
          back lives — the owner: "they can always add it back". */}
      <div role="tablist" aria-label={t("app.settings.products")} className="flex gap-2">
        {[
          ["list", t("app.setProducts.tabList", "Your list ({n})", { n: offered.length })],
          ["removed", t("app.setProducts.tabRemoved", "Removed ({n})", { n: removed.length })],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-[44px] px-4 rounded-full text-sm font-semibold border ${
              tab === key ? "bg-inverted text-inverted-foreground border-transparent" : "text-foreground border-border hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Below `sm` this was a 4-column CSS grid (1fr/1.5fr/auto/auto) inside
          a parent with `overflow-hidden`, not `overflow-x-auto` — a grid
          item's default min-width is its content's min-content size, not 0,
          so on a 375px phone the row didn't reflow and didn't scroll either.
          It just clipped: the edit/delete column could be cut off entirely,
          not merely hard to reach. Below `sm` this now stacks each product
          into a card instead; the grid returns at `sm` and up, where four
          columns fit without any of that. */}
      {/* id: the dashboard's "Review your add-ons" set-up step lands here
          (lib/setupSteps.js). */}
      <div id="catalogue" className="bg-card border border-border rounded-xl overflow-hidden scroll-mt-4">
        <div className="hidden sm:grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
          {/* Search is server-side (`?q=`), so "no rows" after a search is a
              statement about the SEARCH, not about the catalogue. A company
              with 400 items typing a term that misses was told it had none
              yet, under a button inviting it to add its first. */}
          {!loading && pageItems.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              {search.trim()
                ? t("app.setProducts.noSearchMatch", "Nothing matches that search.")
                : tab === "removed"
                  ? t("app.setProducts.removedEmpty", "Nothing removed. Services you remove from your list show here, ready to add back.")
                  : t("app.setProducts.emptyList")}
            </p>
          )}
          {!loading &&
            pageItems.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 px-5 py-3 sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto] sm:gap-4 sm:items-center"
              >
                <div className="flex items-start justify-between gap-2 sm:contents">
                  <span className="text-sm font-medium text-foreground min-w-0">
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
                  {/* Actions move up beside the name below `sm` — sm:contents
                      drops this wrapper from layout there so the grid's own
                      4th column (below) takes over instead of nesting one
                      grid cell inside another. */}
                  <div className="flex items-center gap-1 shrink-0 sm:hidden">
                    {rowActions(p)}
                  </div>
                </div>
                {p.description && (
                  <span className="text-sm text-muted-foreground sm:truncate">
                    {p.description}
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-xs bg-muted px-2.5 py-1 rounded-full capitalize w-fit">
                    {p.type}
                  </span>
                  {tab === "list" && p.addedForYou === true && (
                    <span className="text-xs border border-border text-foreground px-2.5 py-1 rounded-full w-fit" data-added-for-you>
                      {t("app.setProducts.addedForYou", "Added for you")}
                    </span>
                  )}
                </span>
                <div className="hidden sm:flex items-center gap-2">
                  {rowActions(p)}
                </div>
              </div>
            ))}
        </div>

        {!loading && shown.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              {t("app.setProducts.showingRange", {
                start: startIdx,
                end: endIdx,
                total: shown.length,
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
                  className="min-h-[44px] px-3 border border-border rounded disabled:opacity-40"
                >
                  {t("app.setProducts.prev")}
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="min-h-[44px] px-3 border border-border rounded disabled:opacity-40"
                >
                  {t("app.action.next")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!compact && (
      <>
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground">
          {t("app.setProducts.costsHeading")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setProducts.costsBody")}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {t("app.setProducts.importHeading")}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t("app.setProducts.importBody")}
          </p>
          {/* Add Item drafts the other languages' wording as it saves; the
              import does not — it writes rows with createMany and asks no
              model anything, so a company selling in French and English gets
              two hundred English-only rows and no hint. Said here, with the
              screen that fixes it, rather than wired in: drafting a whole
              catalogue on upload is an AI spend the owner has not approved,
              and Settings → Translations already drafts in batches against
              the company's own metered credit. */}
          <p className="text-xs text-muted-foreground mb-3">
            {t(
              "app.setProducts.importNoTranslations",
              "Imported items keep the language they were written in — nothing is translated on upload. To draft the other languages your quotes go out in, use",
            )}{" "}
            <Link href="/app/settings/translations" className="underline underline-offset-2">
              {t("app.settings.translations", "Translations")}
            </Link>
            .
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
        {/* No Export card beside it. A company can bring its price book in
            but not take it out as a file — the owner's decision of
            2026-09-24, paying customers included. The route
            (app/api/products/export/route.js) still exists and answers 403
            (lib/export/companyDataExport.js);
            a link to it here would be a button that downloads an error. */}
      </div>
      </>
      )}
      </>
      )}

      {showModal && (
        <ProductFormModal
          key={editing?.id || "new"}
          editing={editing}
          quoteTypes={quoteTypes}
          quoteTypesError={quoteTypesError}
          currency={currency}
          onClose={() => setShowModal(false)}
          onSaved={async (answer) => {
            // What the save queued for the other languages; the banner at the
            // top of the list reads it and asks for the truth a moment later.
            setAutoTranslate(answer?.autoTranslate ? { ...answer.autoTranslate, id: answer.id } : null);
            setShowModal(false);
            load();
            await onChanged?.();
          }}
        />
      )}
    </div>
  );
}
