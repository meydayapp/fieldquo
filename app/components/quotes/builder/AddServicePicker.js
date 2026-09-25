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
// ── Nothing it adds is decided here ────────────────────────────────────────
//
// Every press calls a function the builder handed over (`picker`): a quote
// type is QuoteBuilder's addScopeGroup(category, label) — the call the old
// tile made, same arguments, so the scope group, its calculator and its save
// are the ones the owner "finessed and perfected"; a templated service is
// addScopeGroupWithTemplate; "Add as one line" is the plain product line. The
// invoice hands its own addProductTemplate / addProductLine. The template
// preview under a row is `picker.preview(category, product)` — the lines
// THAT press would add, measured, held back and priced by the same call — so
// the dialog can never promise three lines and add one.
//
// ── What the list is ───────────────────────────────────────────────────────
//
// lib/quotes/servicePicker.js: the company's enabled quote types, each with
// its own active services under it, the quote's own trades first and open;
// searchable by name, description and trade, accents folded.
"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Search, Check, Settings2 } from "lucide-react";
import StepDialog from "@/app/components/dashboard/StepDialog";
import BottomSheet from "@/app/components/mobile/BottomSheet";
import ServiceTiles, { iconFor } from "./ServiceTiles";
import { measureLabel, calcLabel } from "./templateLineNotes";
import { useTranslation } from "@/app/hooks/useTranslation";
import { getSectionPresets } from "@/app/data/sectionPresets";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { formatAppMoney } from "@/lib/format/money";
import { serviceTextIn, calculatorFor } from "@/lib/quotes/serviceTemplateLines";
import {
  pickerGroups,
  pickerCount,
  uniqueServiceCount,
  pickerShape,
  filterPicker,
  initiallyOpen,
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
 *                  showPricing?, typeInfo?(cat), preview(cat|null, product),
 *                  addType?(cat, label), addTemplate(cat|null, product),
 *                  addLine(cat|null, product) }
 * @param documentLanguage the quote's language — a section preset becomes a
 *                  heading the client reads
 */
export default function AddServicePicker({ picker, documentLanguage }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
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
  const emptyQuote = !invoice && !(picker?.onQuoteCategoryIds || []).length;

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
    return <InlinePicker picker={picker} groups={groups} invoice={invoice} documentLanguage={documentLanguage} />;
  }

  return (
    <div data-tour="service-picker" data-service-picker="dialog">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-add-service-open
        className={
          emptyQuote
            ? "flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            : "flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-foreground/40 hover:bg-muted/40"
        }
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
        />
      )}
    </div>
  );
}

// ── Inline: the old quick path, for a handful ───────────────────────────────

function InlinePicker({ picker, groups, invoice, documentLanguage }) {
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
      <Link href={SERVICES_HREF} className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {t("app.servicePicker.manage", "Manage services")}
      </Link>
    </div>
  );
}

// ── The dialog ──────────────────────────────────────────────────────────────

function ServicePickerDialog({ picker, groups, invoice, documentLanguage, onClose }) {
  const { t } = useTranslation();
  const wide = useWide();
  const searchRef = useRef(null);
  const [selected, setSelected] = useState([]);
  const entries = useRef(new Map());

  // Adds in the order the list shows them, then closes: the document scrolls
  // to the last one added (DocumentBuilder's addAndOpen).
  const run = (entry) => {
    if (entry.kind === "type") picker.addType(entry.category, entry.label);
    else if (entry.withTemplate) picker.addTemplate(entry.category, entry.product);
    else picker.addLine(entry.category, entry.product);
  };
  const addNow = (entry) => {
    run(entry);
    onClose();
  };
  const addSelected = () => {
    for (const key of selected) {
      const e = entries.current.get(key);
      if (e) run(e);
    }
    onClose();
  };
  const toggle = (key) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const title = t("app.servicePicker.title", "Add a service");
  const intro = invoice
    ? t("app.servicePicker.introInvoice", "Adds the service to this invoice — with its template lines when it has them.")
    : t("app.servicePicker.intro", "Each one becomes its own section of this quote. A service with template lines brings them along — change anything after.");
  const footerButton = selected.length ? (
    <button
      type="button"
      onClick={addSelected}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 w-full sm:w-auto"
      data-add-service-selected
    >
      <Plus size={15} aria-hidden="true" />
      {t("app.servicePicker.addSelected", "Add {count} selected", { count: selected.length })}
    </button>
  ) : null;

  const list = (
    <ServicePickerList
      picker={picker}
      groups={groups}
      invoice={invoice}
      documentLanguage={documentLanguage}
      searchRef={searchRef}
      stickyClass={wide ? "-top-4 pt-4 -mt-4" : "-top-3 pt-3 -mt-3"}
      selected={selected}
      onToggle={toggle}
      onAdd={addNow}
      register={(key, entry) => entries.current.set(key, entry)}
      showManage={!wide}
    />
  );

  if (wide) {
    return (
      <StepDialog
        open
        id="add-service"
        title={title}
        intro={intro}
        href={SERVICES_HREF}
        onClose={onClose}
        footer={footerButton}
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
      description={intro}
      footer={footerButton}
    >
      {list}
    </BottomSheet>
  );
}

/**
 * The list inside the dialog — search, groups, rows. Exported so
 * scripts/check-service-picker-ui.mjs can render it without a portal.
 */
export function ServicePickerList({
  picker,
  groups,
  invoice = false,
  documentLanguage,
  searchRef = null,
  stickyClass = "top-0",
  selected = [],
  onToggle = () => {},
  onAdd = () => {},
  register = () => {},
  showManage = false,
  initialQuery = "",
  initialLinesOpen = null,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [openGroups, setOpenGroups] = useState(() => initiallyOpen(groups));
  const [presetsFor, setPresetsFor] = useState(null);
  const [linesFor, setLinesFor] = useState(initialLinesOpen);
  const lang = picker.language;
  const money = (n) => formatAppMoney(n, picker.currency, "en");
  const showPricing = picker.showPricing !== false;

  // Alphabetical by the name the row PRINTS — the document's language — so a
  // French quote's list reads in French order, not in the catalogue's.
  const shown = useMemo(() => {
    const nameOf = (p) => serviceTextIn(p, lang, picker.companyLanguage).name;
    return filterPicker(groups, query, (p) => textsOf(p, lang, picker.companyLanguage)).map((g) => ({
      ...g,
      services: [...g.services].sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang || undefined)),
    }));
  }, [groups, query, lang, picker.companyLanguage]);
  const searching = query.trim().length > 0;
  const isOpen = (id) => searching || openGroups.includes(id);

  // Arrow keys walk the controls a row offers, top to bottom, from the
  // search box through every group header and every Add — Tab still visits
  // everything, this is the quick way down a long list.
  const rootRef = useRef(null);
  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nav = [...(rootRef.current?.querySelectorAll("[data-picker-nav]") || [])];
    const i = nav.indexOf(document.activeElement);
    if (i < 0 && e.key === "ArrowUp") return;
    const next = e.key === "ArrowDown" ? nav[Math.min(nav.length - 1, i + 1)] : nav[Math.max(0, i - 1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="sm:min-h-[65vh]" data-service-picker-list>
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
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground" data-service-picker-nomatch>
          {t("app.servicePicker.noMatch", "Nothing matches “{query}”.", { query: query.trim() })}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((g) => {
            const cat = g.category;
            const accent = cat ? resolveServiceContent(cat.key).accent : "var(--muted-foreground)";
            const Icon = cat ? iconFor(cat) : null;
            const expanded = isOpen(g.id);
            const typeRow = !invoice && cat && (g.typeMatch || !searching);
            const n = g.services.length + (typeRow ? 1 : 0);
            const label = g.label || t("app.servicePicker.otherGroup", "Other services");
            return (
              <section key={g.id} className="rounded-xl border border-border" data-service-picker-group={cat?.key || g.id}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((o) => (o.includes(g.id) ? o.filter((x) => x !== g.id) : [...o, g.id]))}
                    aria-expanded={expanded}
                    className="flex w-full min-h-12 items-center gap-2.5 px-3 py-2 text-left"
                    data-picker-nav
                  >
                    {Icon ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${accent}1f`, color: accent }}>
                        <Icon size={15} aria-hidden="true" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
                      {g.onQuote && <span className="block text-[11px] text-muted-foreground">{t("app.servicePicker.onQuote", "On this quote")}</span>}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                    {expanded ? <ChevronDown size={16} className="text-muted-foreground" aria-hidden="true" /> : <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />}
                  </button>
                </h3>
                {expanded && (
                  <ul className="divide-y divide-border border-t border-border">
                    {typeRow && (
                      <TypeRow
                        cat={cat}
                        accent={accent}
                        picker={picker}
                        documentLanguage={documentLanguage}
                        showPricing={showPricing}
                        presetsOpen={presetsFor === g.id}
                        onPresets={() => setPresetsFor((v) => (v === g.id ? null : g.id))}
                        selected={selected}
                        onToggle={onToggle}
                        onAdd={onAdd}
                        register={register}
                      />
                    )}
                    {g.services.map((p) => (
                      <ServiceRow
                        key={p.id}
                        g={g}
                        p={p}
                        accent={accent}
                        picker={picker}
                        money={money}
                        showPricing={showPricing}
                        linesOpen={linesFor === `${g.id}:${p.id}`}
                        onLines={() => setLinesFor((v) => (v === `${g.id}:${p.id}` ? null : `${g.id}:${p.id}`))}
                        selected={selected}
                        onToggle={onToggle}
                        onAdd={onAdd}
                        register={register}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {showManage && (
        <Link href={SERVICES_HREF} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-2">
          <Settings2 size={14} aria-hidden="true" />
          {t("app.servicePicker.manage", "Manage services")}
        </Link>
      )}
    </div>
  );
}

// A 44px tick box, labelled for a screen reader by the row's name.
function SelectBox({ checked, onChange, label }) {
  return (
    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center -ml-2">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} aria-label={label} />
      <span className="flex h-5 w-5 items-center justify-center rounded border border-border bg-background peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring text-primary-foreground">
        {checked && <Check size={13} aria-hidden="true" />}
      </span>
    </label>
  );
}

function AddButton({ onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-16 shrink-0 items-center justify-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-picker-nav
      {...rest}
    >
      {children}
    </button>
  );
}

/** The quote type itself: its scope group and calculator, as the old tile added it. */
function TypeRow({ cat, accent, picker, documentLanguage, showPricing, presetsOpen, onPresets, selected, onToggle, onAdd, register }) {
  const { t } = useTranslation();
  const info = picker.typeInfo ? picker.typeInfo(cat) || {} : {};
  const presets = getSectionPresets(cat.key, documentLanguage);
  const key = `type:${cat.id}`;
  const entry = { kind: "type", category: cat, label: cat.label };
  register(key, entry);
  return (
    <li className="px-3 py-2.5" data-service-picker-type={cat.key || cat.id}>
      <div className="flex items-start gap-2">
        {presets ? (
          // A trade with section presets (Main staircase, Upper…) is added
          // through them, one at a time, as the tile always did.
          <span className="h-11 w-11 shrink-0 -ml-2" aria-hidden="true" />
        ) : (
          <SelectBox checked={selected.includes(key)} onChange={() => onToggle(key)} label={t("app.servicePicker.select", "Select {name}", { name: cat.label })} />
        )}
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium text-foreground">
            {cat.label}{" "}
            <span className="ml-1 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: `${accent}1a`, color: "var(--foreground)" }}>
              {t("app.servicePicker.quoteType", "Quote type")}
            </span>
          </p>
          {info.description ? <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{info.description}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showPricing && info.priceHint ? <span className="font-medium tabular-nums text-foreground">{info.priceHint}</span> : null}
            {showPricing && info.priceHint && info.calc ? " · " : null}
            {info.calc ? t("app.servicePicker.pricedBy", "Priced by the {calc}", { calc: calcLabel(t, info.calc) }) : null}
          </p>
        </div>
        {presets ? (
          <button
            type="button"
            onClick={onPresets}
            aria-expanded={presetsOpen}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted"
            data-picker-nav
            data-service-picker-type-add={cat.key || cat.id}
          >
            {t("app.action.add", "Add")}
            {presetsOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
        ) : (
          <AddButton onClick={() => onAdd(entry)} data-service-picker-type-add={cat.key || cat.id}>
            {t("app.action.add", "Add")}
          </AddButton>
        )}
      </div>
      {presets && presetsOpen && (
        <div className="mt-2 ml-9 flex flex-wrap gap-2" data-service-presets>
          <p className="w-full text-xs font-medium text-muted-foreground">{t("app.serviceTiles.pickSection", { label: cat.label })}</p>
          {presets.map((sectionLabel) => (
            <button
              key={sectionLabel}
              type="button"
              onClick={() => onAdd({ kind: "type", category: cat, label: sectionLabel })}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm text-foreground hover:bg-muted"
              data-picker-nav
            >
              <Plus size={13} style={{ color: accent }} aria-hidden="true" />
              {sectionLabel}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAdd({ kind: "type", category: cat, label: cat.label })}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
            data-picker-nav
          >
            <Plus size={13} aria-hidden="true" />
            {t("app.serviceTiles.somethingElse")}
          </button>
        </div>
      )}
    </li>
  );
}

/** One of the company's services — with its template lines by default. */
function ServiceRow({ g, p, accent, picker, money, showPricing, linesOpen, onLines, selected, onToggle, onAdd, register }) {
  const { t } = useTranslation();
  const lang = picker.language;
  const text = serviceTextIn(p, lang, picker.companyLanguage);
  const pv = picker.preview(g.category, p);
  const withTemplate = Boolean(pv?.offered);
  const key = `svc:${g.id}:${p.id}`;
  const entry = { kind: "service", category: g.category, product: p, withTemplate };
  register(key, entry);
  const price = Number(p.unitPrice);
  const unit = p.unit && p.unit !== "flat" ? ` / ${p.unit}` : "";
  const description = String(text.description || "").split(/\n/)[0];
  return (
    <li className="px-3 py-2.5" data-service-picker-service={String(p.id)}>
      <div className="flex items-start gap-2">
        <SelectBox checked={selected.includes(key)} onChange={() => onToggle(key)} label={t("app.servicePicker.select", "Select {name}", { name: text.name })} />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium text-foreground">{text.name}</p>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{description}</p> : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {showPricing && price > 0 ? (
              <span className="font-medium tabular-nums text-foreground" data-service-picker-price>
                {money(price)}
                {unit}
              </span>
            ) : null}
            {withTemplate ? (
              <button
                type="button"
                onClick={onLines}
                aria-expanded={linesOpen}
                className="inline-flex min-h-9 items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                data-service-picker-lines-toggle
              >
                {t("app.servicePicker.templateLines", "Template lines ({count})", { count: pv.count })}
                {linesOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
              </button>
            ) : pv && pv.offered === false ? (
              <span>{t("app.servicePicker.templateInside", "Its template lines come with a painting estimate of its type — here it adds as one line.")}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <AddButton onClick={() => onAdd(entry)} data-service-picker-add={String(p.id)}>
            {t("app.action.add", "Add")}
          </AddButton>
          {withTemplate && (
            <button
              type="button"
              onClick={() => onAdd({ ...entry, withTemplate: false })}
              className="min-h-9 px-1 text-right text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              data-service-picker-add-line={String(p.id)}
            >
              {t("app.servicePicker.addAsLine", "Add as one line")}
            </button>
          )}
        </div>
      </div>
      {/* Full width under the row, not in the text column beside Add: at
          375px that column is two words wide. */}
      {withTemplate && linesOpen && (
        <div className="ml-9">
          <TemplatePreview pv={pv} money={money} showPricing={showPricing} accent={accent} />
        </div>
      )}
    </li>
  );
}

const KIND_FALLBACK = { labour: "Labour", material: "Material", other: "Other" };

/** The lines the Add would write, each with how its quantity is found. */
function TemplatePreview({ pv, money, showPricing, accent }) {
  const { t } = useTranslation();
  const fmt = (n) => Number(n).toLocaleString("en", { maximumFractionDigits: 2 });
  const rateOf = (l) => (l.meta?.template?.unpriced ? t("app.servicePicker.noRate", "no price yet") : showPricing ? money(l.rate) : "—");
  const ruleOf = (l) => {
    const m = l.meta?.template || {};
    const rate = rateOf(l);
    if (m.measurementKey) {
      const measure = measureLabel(t, m.measurementKey);
      if (m.filled) {
        return t("app.servicePicker.ruleFilled", "{measure}: {value} × {rate} — from the {calc}", { measure, value: fmt(m.filled.value), rate, calc: calcLabel(t, m.filled.calc) });
      }
      // `groups` is the quote as it will be after this add (the new group
      // included), so a calculator found there is one the estimator can
      // open; an invoice passes none — nothing on it measures.
      const where = Array.isArray(pv.groups) ? calculatorFor(m.measurementKey, pv.groups) : null;
      if (where?.groupTempId) {
        return t("app.servicePicker.ruleMeasured", "{measure} × {rate} — from the {calc}", { measure, rate, calc: calcLabel(t, where.calc) });
      }
      if (where) {
        return t("app.servicePicker.ruleNotOnQuote", "{measure} × {rate} — you type it (the {calc} isn't on this quote)", { measure, rate, calc: calcLabel(t, where.calc) });
      }
      return t("app.servicePicker.ruleTyped", "{measure} × {rate} — you type the quantity", { measure, rate });
    }
    const unit = l.unit && !["flat", "each"].includes(l.unit) ? ` ${l.unit}` : "";
    return `${fmt(l.quantity)}${unit} × ${rate}`;
  };
  return (
    <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: `${accent}40` }} data-service-picker-preview>
      <ul className="space-y-1.5">
        {(pv.lines || []).map((l, i) => {
          const kind = l.meta?.template?.lineKind || "other";
          return (
            <li key={i} className="text-xs">
              <span className="mr-1.5 inline-block min-w-14 rounded bg-muted px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`app.serviceTemplates.kind_${kind}`, KIND_FALLBACK[kind] || kind)}
              </span>
              <span className="font-medium text-foreground">{l.description}</span>
              <span className="block pl-0.5 text-muted-foreground sm:inline sm:pl-0"> — {ruleOf(l)}</span>
            </li>
          );
        })}
      </ul>
      {pv.note ? <p className="mt-2 text-xs text-muted-foreground" data-service-picker-held>{pv.note}</p> : null}
    </div>
  );
}
