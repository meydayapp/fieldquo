// app/app/settings/services/ConfirmServices.js
//
// "Confirm what you quote" — the set-up step for a company whose trade
// FieldQuo has no full service list for (lib/setupSteps.js). The page at
// /app/settings/services/confirm renders it, and so does the home page's
// set-up dialog (app/components/dashboard/stepPanels.js); `compact` drops the
// page heading and the "Back to home" link, never a control.
//
// What is offered, and from where — the trade's own seed, the rows other
// trades tag for it, and the explicit nearest-trades table — is decided by
// the server (lib/services/confirmServices.js), in the company's language and
// currency. This screen ticks keys and posts KEYS: never a name, never a
// price (the route reprices from its own rows, AGENTS.md non-negotiable #5).
//
// ══ A row's standing (lib/services/confirmSelection.js#rowState) ═══════════
//
//   addedForYou  in the list, exactly as signup wrote it — "Added for you".
//                The owner, 2026-09-25: "it is loaded by default, so if it
//                is loaded by default it should say so."
//   inList       in the list, renamed or repriced, or added by the company.
//   removing     a held row unticked on this screen — "Removed from your
//                list — Undo" until the confirm button is pressed.
//   removed      removed earlier (Product.active false) — listed unticked,
//                "tick to add back". Ticking restores the same row.
//   restoring    a removed row ticked back.
//   offered /    a suggestion, with the price it would be created at, or
//   adding       "No benchmark for this service — set your rate", never a
//                number invented to fill the column.
//
// Unticking is never a delete: the route archives the row, past quotes keep
// it, and the line above the button says so before anything is saved.
//
// ══ Two tabs ═══════════════════════════════════════════════════════════════
//
// "All" is the grouped list. "Selected (N)" is everything that will be in the
// list after the button — held, minus unticked, plus ticked — flat, each row
// with its group's name, so an owner can read what they are confirming
// without opening every accordion (the owner's ask, 2026-09-25). The filter
// box filters both.
//
// "Add my own service" is the catalogue's own Add Item form (Settings ›
// Products & Services — ProductFormModal.js), so a service typed here is the
// same row, through the same POST, as one typed there.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { formatCompanyDate } from "@/lib/format/companyDate";
import BackToHome from "@/app/components/BackToHome";
import ProductFormModal from "@/app/app/settings/products/ProductFormModal";
import {
  emptySelection,
  groupCount,
  isChecked,
  pendingChanges,
  rowMatches,
  rowState,
  selectedRows,
  setRows,
  toggleRow,
} from "@/lib/services/confirmSelection";

const whole = (n, currency, language) =>
  n == null ? "" : formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");

export default function ConfirmServices({ compact = false, onChanged } = {}) {
  const { t, language: uiLanguage } = useTranslation();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [sel, setSel] = useState(emptySelection);
  const [open, setOpen] = useState(() => new Set());
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  // "Add my own service": the catalogue's form, and the quote types it
  // links to — loaded when the form is opened, with their failure shown in
  // the form rather than read as "you have none".
  const [showOwn, setShowOwn] = useState(false);
  const [quoteTypes, setQuoteTypes] = useState([]);
  const [quoteTypesError, setQuoteTypesError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchJson("/api/settings/products/confirm-services");
      setData(next);
      setLoadError("");
      // Groups for the company's own trade start open; borrowed ones start
      // closed, so a list drawn from three trades opens on the one it is
      // about. Decided on the first load only — a reload after "Add" must
      // not fold what the reader just opened.
      setOpen((prev) =>
        prev.size ? prev : new Set((next?.groups || []).filter((g) => g.via !== "related").map((g) => g.key)),
      );
    } catch (err) {
      setLoadError(err.message || t("app.confirmServices.loadFailed", "Couldn't load the suggested services."));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => (Array.isArray(data?.groups) ? data.groups : []), [data]);
  const q = filter.trim().toLowerCase();
  const visible = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, rows: g.services.filter((s) => rowMatches(s, q)) }))
        .filter((g) => g.rows.length > 0),
    [groups, q],
  );
  const chosen = useMemo(() => selectedRows(groups, sel, q), [groups, sel, q]);
  const chosenTotal = useMemo(() => selectedRows(groups, sel).length, [groups, sel]);
  // Held rows unticked on this screen, for the Selected tab's "Undo" list —
  // they are not in the list after Done, so they are not in the count.
  const removing = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const g of groups) {
      for (const s of g.services) {
        if (s.held && sel.remove.has(s.seedKey) && !seen.has(s.seedKey) && rowMatches(s, q)) {
          seen.add(s.seedKey);
          out.push({ ...s, groupName: g.name });
        }
      }
    }
    return out;
  }, [groups, sel, q]);
  const hasHeld = groups.some((g) => g.services.some((s) => s.held || s.archived));

  const currency = data?.currency || "CAD";
  const moneyLanguage = data?.language || uiLanguage || "en";
  const thin = (data?.trades || []).filter((tr) => tr.thin);
  const tradeNames = (thin.length ? thin : data?.trades || []).map((tr) => tr.label).join(", ");

  function toggle(row) {
    setSel((prev) => toggleRow(prev, row));
  }

  function toggleOpen(key) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function confirm() {
    setSaving(true);
    setMessage(null);
    const { add, remove } = pendingChanges(sel);
    try {
      const answer = await fetchJson("/api/settings/products/confirm-services", {
        method: "POST",
        body: { seedKeys: add, removeSeedKeys: remove },
      });
      const added = (answer?.created || 0) + (answer?.restored || 0);
      setMessage({
        text:
          answer?.removed > 0
            ? t("app.confirmServices.savedSummary", "Added: {added}. Removed: {removed}. Your list is confirmed.", {
                added,
                removed: answer.removed,
              })
            : added > 0
              ? t("app.confirmServices.added", "Added: {n}. Your list is confirmed.", { n: added })
              : t("app.confirmServices.confirmedNothing", "Confirmed. Nothing new was added."),
      });
      setSel(emptySelection());
      await load();
      await onChanged?.();
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setSaving(false);
    }
  }

  // The quote types are read BEFORE the form opens: opened first, the form
  // would say "you have no quote types" for the moment the read takes.
  async function openOwn() {
    try {
      const rows = await fetchJson("/api/settings/service-categories");
      setQuoteTypes(Array.isArray(rows) ? rows.filter((c) => c.enabled) : []);
      setQuoteTypesError("");
    } catch (err) {
      setQuoteTypes([]);
      setQuoteTypesError(err.message || t("app.load.network"));
    }
    setShowOwn(true);
  }

  const header = !compact && (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("app.confirmServices.title", "Confirm what you quote")}
      </h1>
      <BackToHome />
    </div>
  );

  if (loadError) {
    return (
      <section id="confirm-services" className={compact ? "space-y-4" : "p-4 sm:p-6 max-w-3xl mx-auto space-y-4"}>
        {header}
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section id="confirm-services" className={compact ? "space-y-4" : "p-4 sm:p-6 max-w-3xl mx-auto space-y-4"} aria-busy="true">
        {header}
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-64 max-w-full bg-accent rounded" />
          <div className="h-40 bg-accent rounded-xl" />
        </div>
      </section>
    );
  }

  const noTrade = (data.trades || []).length === 0;
  const { add: toAdd, remove: toRemove } = pendingChanges(sel);
  const seeded = data.seededAtSignup;

  // The right-hand column of a row: its standing, or the price it would be
  // created at. The Undo on a row being removed is a real button beside the
  // checkbox's label, never inside it, so pressing it cannot also flip the tick.
  function standing(s) {
    const state = rowState(s, sel);
    if (state === "addedForYou" || state === "inList") {
      return (
        <span className="text-xs font-medium text-muted-foreground" data-row-state={state}>
          {state === "addedForYou"
            ? t("app.confirmServices.addedForYou", "Added for you")
            : t("app.confirmServices.inList", "In your list")}
        </span>
      );
    }
    if (state === "removing") {
      return (
        <span className="flex flex-col items-end gap-1" data-row-state={state}>
          <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {t("app.confirmServices.removing", "Removed from your list")}
          </span>
          <button
            type="button"
            onClick={() => toggle(s)}
            disabled={saving}
            className="text-xs font-semibold text-foreground underline underline-offset-2 min-h-11 min-w-11 px-2"
          >
            {t("app.confirmServices.undo", "Undo")}
          </button>
        </span>
      );
    }
    if (state === "removed" || state === "restoring") {
      return (
        <span className="block max-w-[9rem] text-xs text-muted-foreground" data-row-state={state}>
          {state === "removed"
            ? t("app.confirmServices.removedAddBack", "Removed — tick to add back")
            : t("app.confirmServices.restoring", "Will be added back")}
        </span>
      );
    }
    return s.price != null ? (
      <span className="text-sm tabular-nums text-foreground">
        {whole(s.price, currency, moneyLanguage)}
        {s.unit && s.unit !== "flat" ? (
          <span className="text-xs text-muted-foreground">
            {" / "}
            {t(`app.quoteReview.unit_${s.unit}`, s.unit)}
          </span>
        ) : null}
      </span>
    ) : (
      <span className="block max-w-[9rem] text-xs text-muted-foreground">
        {t("app.serviceSeeds.setYourRate", "No benchmark for this service — set your rate.")}
      </span>
    );
  }

  function row(s, groupName) {
    const state = rowState(s, sel);
    return (
      <li key={s.seedKey} className="flex items-start gap-2 px-4" data-confirm-row={s.seedKey}>
        <label className="flex min-w-0 flex-1 items-start gap-3 py-3 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={isChecked(s, sel)}
            disabled={saving}
            onChange={() => toggle(s)}
          />
          <span className="min-w-0 flex-1">
            <span className={`block text-sm break-words ${state === "removing" || state === "removed" ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {s.name}
            </span>
            {groupName && <span className="block text-xs text-muted-foreground break-words">{groupName}</span>}
            {!groupName && s.description && (
              <span className="block text-xs text-muted-foreground break-words">{s.description}</span>
            )}
          </span>
        </label>
        <span className="shrink-0 py-3 text-right">{standing(s)}</span>
      </li>
    );
  }

  const confirmLabel = saving
    ? t("app.action.saving")
    : toRemove.length > 0 && toAdd.length > 0
      ? t("app.confirmServices.saveChanges", "Add {add}, remove {remove} and confirm", { add: toAdd.length, remove: toRemove.length })
      : toRemove.length > 0
        ? t("app.confirmServices.removeSelected", "Remove {n} and confirm", { n: toRemove.length })
        : toAdd.length > 0
          ? t("app.confirmServices.addSelected", "Add selected ({n}) and confirm", { n: toAdd.length })
          : hasHeld
            ? t("app.confirmServices.confirmList", "Confirm my list")
            : t("app.confirmServices.confirmNone", "None of these — confirm my list");

  const tabClass = (on) =>
    `flex-1 sm:flex-none min-h-11 px-4 rounded-full text-sm font-semibold border ${
      on ? "bg-inverted text-inverted-foreground border-transparent" : "text-foreground border-border hover:bg-muted"
    }`;

  return (
    <section id="confirm-services" className={compact ? "space-y-4" : "p-4 sm:p-6 max-w-3xl mx-auto space-y-4"}>
      {header}

      <div className="space-y-1 text-sm text-muted-foreground">
        {seeded?.count > 0 && (
          <p className="font-medium text-foreground" data-seeded-at-signup>
            {seeded.trades?.length
              ? t(
                  "app.confirmServices.seededAtSignup",
                  "We added {services} for {trades} when you signed up. Untick any you don't offer — they'll stop appearing on new quotes.",
                  { services: t("app.confirmServices.servicesCount", { value: seeded.count }), trades: seeded.trades.join(", ") },
                )
              : t(
                  "app.confirmServices.seededAtSignupNoTrade",
                  "We added {services} when you signed up. Untick any you don't offer — they'll stop appearing on new quotes.",
                  { services: t("app.confirmServices.servicesCount", { value: seeded.count }) },
                )}
          </p>
        )}
        <p>
          {noTrade
            ? t("app.confirmServices.noTrade", "You haven't picked a trade, so there is nothing to suggest yet. Add the services you quote, then confirm.")
            : groups.length === 0
              ? t("app.confirmServices.nothingFits", "Nothing in our service lists fits {trades} yet. Add the services you quote, then confirm.", { trades: tradeNames })
              : thin.length
                ? t("app.confirmServices.intro", "FieldQuo doesn't have a full service list for {trades} yet. Tick the services you quote — suggested from your trade and the trades closest to it — and add anything that's missing.", { trades: tradeNames })
                : t("app.confirmServices.introAll", "Tick any other services you quote for {trades}, and add anything that's missing.", { trades: tradeNames })}
        </p>
        {groups.length > 0 && (
          <p className="text-xs">
            {t("app.confirmServices.priceNote", "Prices are suggested starting prices in {currency}. Change them any time in Products & Services.", { currency })}
          </p>
        )}
        {data.confirmedAt && (
          <p className="text-xs font-medium text-foreground" data-confirmed-at>
            {t("app.confirmServices.confirmedOn", "Confirmed on {date}. You can still add more.", {
              date: formatCompanyDate(data.confirmedAt, data.dateFormat || undefined),
            })}
          </p>
        )}
      </div>

      {groups.length > 0 && (
        <>
          <div role="tablist" aria-label={t("app.confirmServices.title", "Confirm what you quote")} className="flex gap-2">
            <button
              type="button"
              role="tab"
              id="confirm-tab-all"
              aria-selected={tab === "all"}
              aria-controls="confirm-panel"
              onClick={() => setTab("all")}
              className={`min-h-11 ${tabClass(tab === "all")}`}
            >
              {t("app.confirmServices.tabAll", "All")}
            </button>
            <button
              type="button"
              role="tab"
              id="confirm-tab-selected"
              aria-selected={tab === "selected"}
              aria-controls="confirm-panel"
              onClick={() => setTab("selected")}
              className={`min-h-11 ${tabClass(tab === "selected")}`}
              data-selected-total={chosenTotal}
            >
              {t("app.confirmServices.tabSelected", "Selected ({n})", { n: chosenTotal })}
            </button>
          </div>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("app.confirmServices.filter", "Filter services")}
            aria-label={t("app.confirmServices.filter", "Filter services")}
            className="w-full border border-border rounded-lg px-3 min-h-11 text-sm bg-background"
          />
        </>
      )}

      <div id="confirm-panel" role={groups.length > 0 ? "tabpanel" : undefined} aria-labelledby={groups.length > 0 ? `confirm-tab-${tab}` : undefined}>
        {tab === "all" && (
          <>
            {groups.length > 0 && visible.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("app.confirmServices.noMatch", "No service matches that filter.")}</p>
            )}
            <div className="space-y-3">
              {visible.map((g) => {
                const isOpen = q ? true : open.has(g.key);
                // Counted over the whole group, rows already in the list
                // included (lib/services/confirmSelection.js#groupCount);
                // "Select all" acts on the rows the filter shows.
                const { n, total } = groupCount(g.services, sel);
                const allOn = g.rows.every((s) => isChecked(s, sel));
                return (
                  <div key={g.key} className="border border-border rounded-xl" data-confirm-group={g.key}>
                    <div className="flex items-center justify-between gap-2 px-4 py-1">
                      <button
                        type="button"
                        onClick={() => toggleOpen(g.key)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left min-h-11"
                      >
                        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground break-words">{g.name}</span>
                          <span className="block text-xs text-muted-foreground" data-group-count={`${n}/${total}`}>
                            {g.via === "related"
                              ? t("app.confirmServices.fromTrade", "From {trade}", { trade: g.fromTradeLabel })
                              : g.forTradeLabel}
                            {" · "}
                            {t("app.confirmServices.selectedCount", "{n} of {total} selected", { n, total })}
                          </span>
                        </span>
                      </button>
                      {isOpen && g.rows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSel((prev) => setRows(prev, g.rows, !allOn))}
                          disabled={saving}
                          className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground border border-foreground/20 rounded-full px-3 min-h-11"
                        >
                          {allOn
                            ? t("app.confirmServices.clearAll", "Clear")
                            : t("app.confirmServices.selectAll", "Select all")}
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <ul className="border-t border-border divide-y divide-border">
                        {g.rows.map((s) => row(s))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "selected" && (
          <div className="space-y-3">
            {chosen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {q
                  ? t("app.confirmServices.noMatch", "No service matches that filter.")
                  : t("app.confirmServices.selectedEmpty", "Nothing is selected yet. Tick services on the All tab.")}
              </p>
            ) : (
              <ul className="border border-border rounded-xl divide-y divide-border" data-selected-list>
                {chosen.map((s) => row(s, s.groupName))}
              </ul>
            )}
            {removing.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("app.confirmServices.removingHeading", "Coming off your list ({n})", { n: removing.length })}
                </p>
                <ul className="border border-border rounded-xl divide-y divide-border">
                  {removing.map((s) => row(s, s.groupName))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
          {message.text}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        {hasHeld && (
          <p className={`text-xs ${toRemove.length ? "font-medium text-foreground" : "text-muted-foreground"}`} data-untick-effect>
            {t(
              "app.confirmServices.untickEffect",
              "Unticked services stay on past quotes but won't be offered for new ones. Removed services aren't deleted — add them back any time.",
            )}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={openOwn}
            disabled={saving}
            className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground border border-border rounded-full px-4 min-h-11 disabled:opacity-60"
          >
            <Plus size={14} aria-hidden="true" />
            {t("app.confirmServices.addOwn", "Add my own service")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-inverted text-inverted-foreground rounded-full px-5 min-h-11 text-sm font-semibold disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>

      {showOwn && (
        <ProductFormModal
          quoteTypes={quoteTypes}
          quoteTypesError={quoteTypesError}
          currency={currency}
          onClose={() => setShowOwn(false)}
          onSaved={async () => {
            setShowOwn(false);
            setMessage({ text: t("app.confirmServices.ownAdded", "Service added to your list. Confirm when you're done.") });
            await onChanged?.();
          }}
        />
      )}
    </section>
  );
}
