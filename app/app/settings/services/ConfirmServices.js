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
// ══ Three honest states a row can be in ════════════════════════════════════
//
//   held      the company already has it (by seed key): ticked and locked,
//             "In your list". Offering it again would promise a second copy
//             the server refuses to create.
//   priced    the suggested starting price — the benchmark median converted
//             the way the signup seeder converts it — beside it.
//   unpriced  "No benchmark for this service — set your rate", never a
//             number invented to fill the column.
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

const whole = (n, currency, language) =>
  n == null ? "" : formatMoney(n, currency, language).replace(/[.,]00(?=\D*$)/, "");

const matches = (row, q) =>
  !q || `${row.name} ${row.description || ""}`.toLowerCase().includes(q);

export default function ConfirmServices({ compact = false, onChanged } = {}) {
  const { t, language: uiLanguage } = useTranslation();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [open, setOpen] = useState(() => new Set());
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
        .map((g) => ({ ...g, rows: g.services.filter((s) => matches(s, q)) }))
        .filter((g) => g.rows.length > 0),
    [groups, q],
  );

  const currency = data?.currency || "CAD";
  const moneyLanguage = data?.language || uiLanguage || "en";
  const thin = (data?.trades || []).filter((tr) => tr.thin);
  const tradeNames = (thin.length ? thin : data?.trades || []).map((tr) => tr.label).join(", ");

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setGroup(group, on) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of group.rows) {
        if (s.held) continue;
        if (on) next.add(s.seedKey);
        else next.delete(s.seedKey);
      }
      return next;
    });
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
    try {
      const answer = await fetchJson("/api/settings/products/confirm-services", {
        method: "POST",
        body: { seedKeys: [...selected] },
      });
      setMessage({
        text:
          answer?.created > 0
            ? t("app.confirmServices.added", "Added: {n}. Your list is confirmed.", { n: answer.created })
            : t("app.confirmServices.confirmedNothing", "Confirmed. Nothing new was added."),
      });
      setSelected(new Set());
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
          <div className="h-5 w-64 bg-accent rounded" />
          <div className="h-40 bg-accent rounded-xl" />
        </div>
      </section>
    );
  }

  const noTrade = (data.trades || []).length === 0;
  const selectedCount = selected.size;

  return (
    <section id="confirm-services" className={compact ? "space-y-4" : "p-4 sm:p-6 max-w-3xl mx-auto space-y-4"}>
      {header}

      <div className="space-y-1 text-sm text-muted-foreground">
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
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("app.confirmServices.filter", "Filter services")}
          aria-label={t("app.confirmServices.filter", "Filter services")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
      )}

      {groups.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("app.confirmServices.noMatch", "No service matches that filter.")}</p>
      )}

      <div className="space-y-3">
        {visible.map((g) => {
          const isOpen = q ? true : open.has(g.key);
          const pickable = g.rows.filter((s) => !s.held);
          const picked = pickable.filter((s) => selected.has(s.seedKey)).length;
          return (
            <div key={g.key} className="border border-border rounded-xl" data-confirm-group={g.key}>
              <div className="flex items-center justify-between gap-2 px-4 py-2">
                <button
                  type="button"
                  onClick={() => toggleOpen(g.key)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left min-h-9"
                >
                  <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground break-words">{g.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {g.via === "related"
                        ? t("app.confirmServices.fromTrade", "From {trade}", { trade: g.fromTradeLabel })
                        : g.forTradeLabel}
                      {" · "}
                      {t("app.confirmServices.selectedCount", "{n} of {total} selected", { n: picked, total: pickable.length })}
                    </span>
                  </span>
                </button>
                {isOpen && pickable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGroup(g, picked < pickable.length)}
                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground border border-foreground/20 rounded-full px-3 min-h-9"
                  >
                    {picked < pickable.length
                      ? t("app.confirmServices.selectAll", "Select all")
                      : t("app.confirmServices.clearAll", "Clear")}
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="border-t border-border divide-y divide-border">
                  {g.rows.map((s) => (
                    <li key={s.seedKey}>
                      <label className={`flex items-start gap-3 px-4 py-2 ${s.held ? "" : "cursor-pointer hover:bg-muted"}`}>
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={s.held || selected.has(s.seedKey)}
                          disabled={s.held || saving}
                          onChange={() => toggle(s.seedKey)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-foreground break-words">{s.name}</span>
                          {s.description && (
                            <span className="block text-xs text-muted-foreground break-words">{s.description}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums text-foreground">
                          {s.held ? (
                            <span className="text-xs font-medium text-muted-foreground">{t("app.confirmServices.inList", "In your list")}</span>
                          ) : s.price != null ? (
                            <>
                              {whole(s.price, currency, moneyLanguage)}
                              {s.unit && s.unit !== "flat" ? (
                                <span className="text-xs text-muted-foreground">
                                  {" / "}
                                  {t(`app.quoteReview.unit_${s.unit}`, s.unit)}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="block max-w-[9rem] text-xs text-muted-foreground">
                              {t("app.serviceSeeds.setYourRate", "No benchmark for this service — set your rate.")}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
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
          {saving
            ? t("app.action.saving")
            : selectedCount > 0
              ? t("app.confirmServices.addSelected", "Add selected ({n}) and confirm", { n: selectedCount })
              : t("app.confirmServices.confirmNone", "None of these — confirm my list")}
        </button>
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
