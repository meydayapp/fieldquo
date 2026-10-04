// app/components/quotes/builder/AddServicePicker.js
//
// "Add service" — the one control at the foot of a quote (and of an invoice)
// that puts a service on the document.
//
// ── What it replaces, and why ──────────────────────────────────────────────
//
// Until 2026-09-25 the foot was a grid of trade cards, each with its price,
// its "+ Add" and a bullet list of "Add with its template lines (3)" under it
// — fifteen cards on a handyman company. The owner: "This seems very busy.
// Maybe it should be a button 'Add service' and then a popup, the same way as
// the additional set-up dialogs, but using what they have selected, with a
// list." And then: "if there are more than 4 it makes a pop-up with the list
// so it's easier to read." So:
//
//   - up to INLINE_PICKER_MAX offerings (quote types + services): inline
//     buttons, the old quick path — the quote types are ServiceTiles' own row
//     of pills (its section presets and all), the services one pill each;
//   - more: ONE "Add service" button, and the list in a dialog — StepDialog,
//     the frame the home page's set-up steps open in, from 640px up; the
//     shared BottomSheet on a phone, where a sheet rising from the thumb is
//     the app's own idiom (app/components/mobile/BottomSheet.js).
//
// ── The dialog is a grid of names (2026-09-28) ─────────────────────────────
//
// The first dialog was a list with collapsible trades, tick boxes, an "Add"
// and an "Add as one line" per row, a price, a description and a "Template
// lines (3)" preview under each service. The owner showed another field-
// service app's "Create Line Item" window — a search box, then a two-column
// grid of plain tiles, each only the service's name, and a Cancel — and
// said: "this is how a company should be able to select from a list of
// services". So the dialog is that now:
//
//   - a search box (the same accent-folded search on name, description and
//     trade, lib/quotes/servicePicker.js filterPicker);
//   - small uppercase labels, not accordions — every tile is visible
//     without a tap first. Inside a trade the services sit under the
//     headings their seed was written under ("Drain cleaning", "Faucets and
//     fixtures", "Water heaters" — the Housecall Pro grouping the owner
//     asked for, lib/quotes/servicePicker.js pickerSections), a row the
//     company wrote itself under "Other". A company with more than one
//     trade gets each trade's name above its block, its own trades first;
//     with one, the headings are the whole structure. Each heading arrives
//     on the product row itself (`seedCategory`, attached by GET
//     /api/products on the server): the seed data it comes from is ~1.3 MB
//     gzipped, and a phone in a driveway should not download that to learn
//     a dozen category names;
//   - tiles: the NAME, one line, a thin border and the app's primary colour
//     as a bar down the left edge. The whole tile is the button and one tap
//     adds it — a quote type with its calculator, a service with its
//     template lines (the old row's default "Add"), then the dialog closes.
//     A quote type carries a small "Quote type" tag; nothing else does;
//   - Cancel.
//
// What went, deliberately, because the reference has none of it: the tick
// boxes and "Add n selected" (one tap adds one thing), "Add as one line"
// (a service's lines can be removed inside it afterwards; the builder's own
// addLine is still what a service WITHOUT a template adds), and the template
// preview, prices and descriptions (the lines still come in — the preview
// was a promise about them, not the mechanism). No price is drawn at all
// now, so a member without showPricing sees exactly what anyone else does.
//
// A quote type with section presets (plumbing: Groundworks, Drainage,
// Waterlines…) still asks which section, under its trade's tiles — the one press that is
// not immediate, kept because it is the tile's own load-bearing behaviour
// (ServiceTiles.js explains why); the press adds exactly what it did.
//
// "Create custom item" from the reference waited until it had a real add
// behind it: a quote's section must belong to a quote type
// (QuoteScopeGroup.categoryId is required), so a line cannot float free of
// one. The owner's answer (2026-10-03): "custom item should be based on the
// current estimate so they pick one service and based on what we have the
// custom line item makes sense." So it is here now, on a QUOTE only — the
// builder hands `picker.customItem` (an invoice hands none, and draws none):
// the press opens CustomItemDialog.js, which asks which service on the
// estimate the item is part of and offers that service's units
// (lib/quotes/customItem.js). With no service on the estimate yet there is
// nothing to write it into, so the control says that instead of opening.
//
// ── Nothing it adds is decided here ────────────────────────────────────────
//
// Every press calls a function the builder handed over (`picker`): a quote
// type is QuoteBuilder's addScopeGroup(category, label) — the call the old
// tile made, same arguments, so the scope group, its calculator and its save
// are the ones the owner "finessed and perfected"; a service whose template
// `picker.preview(category, product)` says is offered here is
// addScopeGroupWithTemplate, any other service the plain product line
// (addLine). The invoice hands its own addProductTemplate / addProductLine.
// The choice is made at the press, from the document as it stands then —
// the same state the old row's "Add" read.
"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Plus, Search, Settings2 } from "lucide-react";
import StepDialog from "@/app/components/dashboard/StepDialog";
import BottomSheet from "@/app/components/mobile/BottomSheet";
import ServiceTiles from "./ServiceTiles";
import CustomItemDialog from "./CustomItemDialog";
import { useTranslation } from "@/app/hooks/useTranslation";
import { getSectionPresets } from "@/app/data/sectionPresets";
import { serviceTextIn } from "@/lib/quotes/serviceTemplateLines";
import {
  pickerGroups,
  pickerCount,
  uniqueServiceCount,
  pickerShape,
  filterPicker,
  pickerSections,
  seedCategoryOf,
} from "@/lib/quotes/servicePicker";

const SERVICES_HREF = "/app/settings/services";
const CONFIRM_HREF = "/app/settings/services/confirm";

// From `sm` up the set-up dialogs' frame; below it the phone's bottom sheet.
// Read with JS because the two are different element trees, not one element
// restyled (BottomSheet.js explains the same choice at `lg`). The server
// answers "phone"; the dialog only exists after a press, in the browser.
const WIDE_QUERY = "(min-width: 640px)";
function subscribeWide(onChange) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => Boolean(typeof window !== "undefined" && window.matchMedia?.(WIDE_QUERY).matches),
    () => false,
  );
}

/** The texts a service is found by: its own words and the document's. */
function textsOf(p, language, companyLanguage) {
  const own = [p?.name, p?.description];
  const doc = serviceTextIn(p, language, companyLanguage);
  return [...own, doc.name, doc.description];
}

/**
 * @param picker  { kind: "quote"|"invoice", categories, products,
 *                  onQuoteCategoryIds, language, companyLanguage, currency,
 *                  showPricing?, preview(cat|null, product),
 *                  addType?(cat, label), addTemplate(cat|null, product),
 *                  addLine(cat|null, product) }
 * @param documentLanguage the quote's language — a section preset becomes a
 *                  heading the client reads
 */
export default function AddServicePicker({ picker, documentLanguage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const custom = picker?.kind === "invoice" ? null : picker?.customItem || null;
  const customDialog =
    custom && customOpen ? <CustomItemDialog customItem={custom} onClose={() => setCustomOpen(false)} /> : null;
  const invoice = picker?.kind === "invoice";
  const groups = useMemo(
    () =>
      pickerGroups({
        categories: invoice ? [] : picker?.categories,
        products: picker?.products,
        onQuoteCategoryIds: picker?.onQuoteCategoryIds,
        invoice,
      }),
    [invoice, picker?.categories, picker?.products, picker?.onQuoteCategoryIds],
  );
  const count = pickerCount(groups, { invoice });
  const shape = pickerShape(count);

  if (shape === "empty") {
    // An invoice with no services has nothing to offer here and draws
    // nothing: its card's "Add line item" is the way in, as before.
    if (invoice) return null;
    return (
      <div className="rounded-xl border border-border p-4" data-tour="service-picker" data-service-picker="empty">
        <p className="text-sm font-semibold text-foreground">{t("app.quoteNew.addServiceHeading", "Add a service")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(picker?.categories || []).length
            ? t("app.servicePicker.noServices", "You haven't listed the services you quote yet. Confirm them once and they appear here, with their line items.")
            : t("app.quoteNew.noServicesEnabled", "No services enabled yet — go to Settings → Services to turn some on.")}
        </p>
        <Link href={(picker?.categories || []).length ? CONFIRM_HREF : SERVICES_HREF} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-2">
          {(picker?.categories || []).length ? t("app.servicePicker.confirmServices", "Confirm what you quote") : t("app.servicePicker.manage", "Manage services")}
        </Link>
      </div>
    );
  }

  if (shape === "inline") {
    return (
      <>
        <InlinePicker
          picker={picker}
          groups={groups}
          invoice={invoice}
          documentLanguage={documentLanguage}
          onCustom={custom ? () => setCustomOpen(true) : null}
        />
        {customDialog}
      </>
    );
  }

  return (
    <div data-tour="service-picker" data-service-picker="dialog">
      {/* One solid button, on every quote — "Add service button nice and
          visible" (owner, 2026-09-28). It was a dashed outline once a
          service was on the quote, which read as a placeholder.

          Ink, not the brand: in the document layout this sits inside the
          company's data-brand region, where bg-primary IS the brand — and
          measured, a mid-grey brand (#808080) puts its label at 4.43:1 and
          a white, yellow or cyan one makes the button's edge vanish into
          the card (1.0–1.4:1). The foreground/background pair of the same
          tokens stays above 14:1 for label and edge on every brand we tried,
          light and dark (scripts/check-service-picker.mjs H). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-add-service-open
        className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Plus size={16} aria-hidden="true" />
        {t("app.servicePicker.button", "Add service")}
      </button>
      <p className="mt-1.5 text-center text-xs text-muted-foreground" data-add-service-count>
        {invoice
          ? t("app.servicePicker.countInvoice", "{count} services to choose from", { count })
          : t("app.servicePicker.count", "{types} quote types · {services} services", {
              types: groups.length,
              services: uniqueServiceCount(groups),
            })}
      </p>
      {open && (
        <ServicePickerDialog
          picker={picker}
          groups={groups}
          invoice={invoice}
          documentLanguage={documentLanguage}
          onClose={() => setOpen(false)}
          onCustom={
            custom
              ? () => {
                  setOpen(false);
                  setCustomOpen(true);
                }
              : null
          }
        />
      )}
      {customDialog}
    </div>
  );
}

/**
 * "Create custom item" — the entry to CustomItemDialog. With no service on
 * the estimate there is nothing to write the item into, so the button is
 * drawn disabled with the reason beside it rather than opening onto nothing.
 */
export function CustomItemEntry({ picker, onCustom, className = "" }) {
  const { t } = useTranslation();
  if (!onCustom || !picker?.customItem) return null;
  const targets = Array.isArray(picker.customItem.targets) ? picker.customItem.targets : [];
  const none = targets.length === 0;
  return (
    <div className={className} data-custom-item-entry={none ? "none" : "ready"}>
      <button
        type="button"
        onClick={onCustom}
        disabled={none}
        aria-describedby={none ? "custom-item-none" : undefined}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-picker-nav
        data-custom-item-open
      >
        <Plus size={14} aria-hidden="true" />
        {t("app.servicePicker.customItem", "Create custom item")}
      </button>
      {none ? (
        <p id="custom-item-none" className="mt-1 text-xs text-muted-foreground" data-custom-item-none>
          {t("app.servicePicker.customItemNeedsService", "Add a service first — a custom item is written inside one, in its units.")}
        </p>
      ) : null}
    </div>
  );
}

// ── Inline: the old quick path, for a handful ───────────────────────────────

function InlinePicker({ picker, groups, invoice, documentLanguage, onCustom = null }) {
  const { t } = useTranslation();
  const lang = picker.language;
  const rows = groups.flatMap((g) => g.services.map((p) => ({ g, p })));
  return (
    <div className="space-y-2" data-service-picker="inline">
      <p className="text-sm font-semibold text-foreground">{t("app.quoteNew.addServiceHeading", "Add a service")}</p>
      {!invoice && groups.length > 0 && (
        // The quote types as the pill row ServiceTiles has always drawn —
        // its section presets, its accent, the call to addScopeGroup.
        <ServiceTiles
          variant="row"
          categories={groups.map((g) => g.category)}
          onAdd={picker.addType}
          documentLanguage={documentLanguage}
        />
      )}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rows.map(({ g, p }) => {
            const pv = picker.preview(g.category, p);
            const withTemplate = Boolean(pv?.offered);
            const name = serviceTextIn(p, lang, picker.companyLanguage).name;
            return (
              <button
                key={`${g.id}:${p.id}`}
                type="button"
                onClick={() => (withTemplate ? picker.addTemplate(g.category, p) : picker.addLine(g.category, p))}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
                data-service-picker-inline={String(p.id)}
              >
                <Plus size={12} className="text-muted-foreground" aria-hidden="true" />
                <span>{name}</span>
                {withTemplate && (
                  <span className="text-xs text-muted-foreground">
                    · {t("app.servicePicker.templateLines", "Template lines ({count})", { count: pv.count })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <CustomItemEntry picker={picker} onCustom={onCustom} />
      <Link href={SERVICES_HREF} className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {t("app.servicePicker.manage", "Manage services")}
      </Link>
    </div>
  );
}

// ── The dialog ──────────────────────────────────────────────────────────────

/**
 * What one press adds, decided at the press. A service's template is used
 * when the builder's own preview says it is offered for a NEW group of that
 * quote type — the rule the old row's default "Add" followed — and
 * otherwise the service goes on as the one line addLine writes.
 */
export function runPickerEntry(picker, entry) {
  if (entry.kind === "type") return picker.addType(entry.category, entry.label);
  const pv = picker.preview ? picker.preview(entry.category, entry.product) : null;
  if (pv?.offered) return picker.addTemplate(entry.category, entry.product);
  return picker.addLine(entry.category, entry.product);
}

function ServicePickerDialog({ picker, groups, invoice, documentLanguage, onClose, onCustom = null }) {
  const { t } = useTranslation();
  const wide = useWide();
  const searchRef = useRef(null);
  // Adds, then closes: the document scrolls to what was added
  // (DocumentBuilder's addAndOpen).
  const addNow = (entry) => {
    runPickerEntry(picker, entry);
    onClose();
  };

  const title = t("app.servicePicker.title", "Add a service");
  const cancel = (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold uppercase tracking-wide text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:border-transparent"
      data-service-picker-cancel
    >
      {t("app.action.cancel", "Cancel")}
    </button>
  );

  const list = (
    <ServicePickerList
      picker={picker}
      groups={groups}
      invoice={invoice}
      documentLanguage={documentLanguage}
      searchRef={searchRef}
      stickyClass={wide ? "-top-4 pt-4 -mt-4" : "-top-3 pt-3 -mt-3"}
      onAdd={addNow}
      showManage={!wide}
      onCustom={onCustom}
    />
  );

  if (wide) {
    return (
      <StepDialog
        open
        id="add-service"
        title={title}
        href={SERVICES_HREF}
        onClose={onClose}
        footer={cancel}
        initialFocusRef={searchRef}
      >
        {list}
      </StepDialog>
    );
  }
  return (
    <BottomSheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      footer={cancel}
    >
      {list}
    </BottomSheet>
  );
}

/**
 * Where an arrow key goes from `from` among the dialog's controls: Left and
 * Right step through them in reading order; Up and Down go to the nearest
 * control in the row above or below, by position on screen — so the keys
 * follow the grid whether it is drawn in two columns or, on a phone, one.
 * Up from the first row reaches the search box.
 */
function arrowTarget(nav, from, key) {
  const i = nav.indexOf(from);
  if (i < 0) return key === "ArrowDown" ? nav[0] || null : null;
  if (key === "ArrowRight") return nav[i + 1] || null;
  if (key === "ArrowLeft") return i > 0 && nav[i - 1]?.tagName !== "INPUT" ? nav[i - 1] : null;
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const down = key === "ArrowDown";
  const rows = nav
    .filter((el) => el !== from)
    .map((el) => ({ el, q: el.getBoundingClientRect() }))
    .filter(({ q }) => (down ? q.top >= r.bottom - 1 : q.bottom <= r.top + 1));
  if (!rows.length) return null;
  const edge = down ? Math.min(...rows.map(({ q }) => q.top)) : Math.max(...rows.map(({ q }) => q.bottom));
  const row = rows.filter(({ q }) => Math.abs((down ? q.top : q.bottom) - edge) < 4);
  row.sort((a, b) => Math.abs(a.q.left + a.q.width / 2 - cx) - Math.abs(b.q.left + b.q.width / 2 - cx));
  return row[0].el;
}

const TILE_CLASS =
  "relative flex w-full min-h-12 items-center gap-2 overflow-hidden rounded-lg border border-border bg-card py-2.5 pl-4 pr-3 text-left text-sm font-medium text-foreground shadow-sm transition-shadow hover:border-foreground/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One tile: the name, the bar down its left edge, the whole of it the button. */
function Tile({ name, tag = null, onClick, ...rest }) {
  return (
    <button type="button" onClick={onClick} className={TILE_CLASS} title={name} data-picker-nav data-service-picker-tile {...rest}>
      <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {tag}
    </button>
  );
}


/**
 * The list inside the dialog — search, headings, tiles. Exported so
 * scripts/check-service-picker.mjs can render it without a portal.
 *
 * Each service's heading is the `seedCategory` its row carries
 * (seedCategoryOf, in the document's language); a row without one goes
 * under "Other".
 */
export function ServicePickerList({
  picker,
  groups,
  invoice = false,
  documentLanguage,
  searchRef = null,
  stickyClass = "top-0",
  onAdd = () => {},
  showManage = false,
  initialQuery = "",
  initialPresetsFor = null,
  onCustom = null,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [presetsFor, setPresetsFor] = useState(initialPresetsFor);
  const lang = picker.language;
  const categoryOf = useMemo(() => (p) => seedCategoryOf(p, lang), [lang]);
  // "grouped under each trade only when the company has more than one trade"
  // (owner) — counted on the whole list, so a search that narrows to one
  // trade does not change the page's structure under the reader.
  const multiTrade = groups.length > 1;

  // Alphabetical by the name the tile PRINTS — the document's language — so
  // a French quote's list reads in French order, not in the catalogue's.
  const shown = useMemo(() => {
    const nameOf = (p) => serviceTextIn(p, lang, picker.companyLanguage).name;
    return filterPicker(groups, query, (p) => textsOf(p, lang, picker.companyLanguage)).map((g) => {
      const sorted = { ...g, services: [...g.services].sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang || undefined)) };
      return { ...sorted, sections: pickerSections(sorted, categoryOf) };
    });
  }, [groups, query, lang, picker.companyLanguage, categoryOf]);
  const searching = query.trim().length > 0;

  const rootRef = useRef(null);
  const onKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    // In the search box the side arrows move the caret, as in any text box.
    if (e.target?.tagName === "INPUT" && e.key !== "ArrowDown") return;
    const nav = [...(rootRef.current?.querySelectorAll("[data-picker-nav]") || [])];
    const next = arrowTarget(nav, document.activeElement, e.key);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  // A trade's sections open under its tile; the first one takes the focus,
  // so the keyboard lands where the next choice is.
  useEffect(() => {
    if (!presetsFor) return;
    rootRef.current?.querySelector(`[data-service-presets="${presetsFor}"] button`)?.focus();
  }, [presetsFor]);

  const Heading = multiTrade ? "h4" : "h3";
  const tiles = (g, services) =>
    services.map((p) => (
      <li key={p.id} data-service-picker-service={String(p.id)}>
        <Tile
          name={serviceTextIn(p, lang, picker.companyLanguage).name}
          onClick={() => onAdd({ kind: "service", category: g.category, product: p })}
          data-service-picker-add={String(p.id)}
        />
      </li>
    ));

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="sm:min-h-[65vh]" data-service-picker-list>
      {/* The search, and — a follow-up — a row of kind chips (Installation,
          Repair, Removal, Maintenance, Inspection) under it, inside this
          sticky block so both stay put while the grid scrolls. */}
      <div className={`sticky ${stickyClass} z-10 bg-card pb-3`}>
        <label className="relative block">
          <span className="sr-only">{t("app.servicePicker.search", "Search services")}</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.servicePicker.searchPlaceholder", "Search by name, description or trade")}
            className="w-full min-h-11 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-picker-nav
            data-service-picker-search
          />
        </label>
        {/* The reference window's "Create custom item", under the search —
            a line written on the spot into a service already on the
            estimate (CustomItemDialog.js). */}
        <CustomItemEntry picker={picker} onCustom={onCustom} className="mt-2" />
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground" data-service-picker-nomatch>
          {t("app.servicePicker.noMatch", "Nothing matches “{query}”.", { query: query.trim() })}
        </p>
      ) : (
        <div className="space-y-6">
          {shown.map((g) => {
            const cat = g.category;
            const typeTile = !invoice && cat && (g.typeMatch || !searching);
            const presets = typeTile ? getSectionPresets(cat.key, documentLanguage) : null;
            const presetsOpen = Boolean(presets) && presetsFor === g.id;
            const label = g.label || t("app.servicePicker.otherGroup", "Other services");
            const headingId = `service-picker-group-${g.id}`;
            return (
              <section
                key={g.id}
                aria-labelledby={multiTrade ? headingId : undefined}
                className="space-y-3"
                data-service-picker-group={cat?.key || g.id}
              >
                {multiTrade && (
                  <h3 id={headingId} className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wider text-foreground" data-service-picker-trade>
                    {label}
                    {g.onQuote ? (
                      <span className="font-semibold text-muted-foreground" data-service-picker-onquote>
                        {" · "}
                        {t("app.servicePicker.onQuote", "On this quote")}
                      </span>
                    ) : null}
                  </h3>
                )}
                {typeTile && (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <li data-service-picker-type={cat.key || cat.id}>
                      <Tile
                        name={cat.label}
                        onClick={() =>
                          presets
                            ? setPresetsFor((v) => (v === g.id ? null : g.id))
                            : onAdd({ kind: "type", category: cat, label: cat.label })
                        }
                        aria-expanded={presets ? presetsOpen : undefined}
                        data-service-picker-type-add={cat.key || cat.id}
                        tag={
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-service-picker-type-tag>
                            {t("app.servicePicker.quoteType", "Quote type")}
                          </span>
                        }
                      />
                    </li>
                  </ul>
                )}
                {presetsOpen && (
                  // A trade with section presets (Main staircase, Upper…) is
                  // added through them, one at a time, as the tile always did.
                  <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3" data-service-presets={g.id}>
                    <p className="w-full text-xs font-medium text-muted-foreground">{t("app.serviceTiles.pickSection", { label: cat.label })}</p>
                    {presets.map((sectionLabel) => (
                      <button
                        key={sectionLabel}
                        type="button"
                        onClick={() => onAdd({ kind: "type", category: cat, label: sectionLabel })}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-picker-nav
                      >
                        <Plus size={13} aria-hidden="true" />
                        {sectionLabel}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onAdd({ kind: "type", category: cat, label: cat.label })}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-picker-nav
                    >
                      <Plus size={13} aria-hidden="true" />
                      {t("app.serviceTiles.somethingElse")}
                    </button>
                  </div>
                )}
                {g.sections.map((s) => {
                  const heading = s.other ? t("app.servicePicker.otherGroup", "Other services") : s.label;
                  return (
                    <div key={s.key} data-service-picker-section={s.key}>
                      {heading && (
                        <Heading className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" data-service-picker-section-label>
                          {heading}
                        </Heading>
                      )}
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{tiles(g, s.services)}</ul>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
      {showManage && (
        <Link href={SERVICES_HREF} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-2">
          <Settings2 size={14} aria-hidden="true" />
          {t("app.servicePicker.manage", "Manage services")}
        </Link>
      )}
    </div>
  );
}
