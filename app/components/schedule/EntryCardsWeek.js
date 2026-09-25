// app/components/schedule/EntryCardsWeek.js
//
// The Cards view of /app/appointments (?view=cards): one week, a column per
// day, each entry a compact card (EntryCard) that opens a side panel
// (EntryPanel) — the leads board's shape applied to the schedule, which is
// what the owner asked for on 2026-09-24.
//
// ── Additive, on purpose ───────────────────────────────────────────────────
//
// The month grid, the list and the map are untouched and read the same feed.
// This view receives the page's already status-filtered entries, so the chips
// above it filter it exactly as they filter the grid — one filter, three
// renderings, never three answers.
//
// ── Columns stack on a phone ───────────────────────────────────────────────
//
// Seven columns at 375px are 50px each and hold nothing. Below `lg` the days
// stack, today first in view, the way the leads board's columns stack; the
// week is still one scroll, and a card is still one tap from its panel.
"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, localeFormat } from "@/lib/calendar/monthGrid";
import { entryCard, mayActOnEntry, weekDays } from "@/lib/schedule/entryCard";
import EntryCard from "@/app/components/schedule/EntryCard";
import EntryPanel from "@/app/components/schedule/EntryPanel";

/**
 * @param entries      the page's status-filtered feed rows
 * @param access       { quotes, jobs, invoices, clients } — which pages this
 *                     viewer may open (see lib/schedule/entryCard.js)
 * @param caller       usePermissions() — for mayActOnEntry
 * @param myUserId     the session user's id
 * @param serviceText  (card) => string — the page's own wording for "what for"
 * @param initialDay   "YYYY-MM-DD" to open on, else today
 * @param onChanged    reload the feed after a reschedule/cancel/complete
 */
export default function EntryCardsWeek({
  entries,
  ready = true,
  access,
  caller,
  myUserId,
  serviceText,
  initialDay,
  weekStartsOn,
  onChanged,
  t,
  language,
}) {
  const [anchor, setAnchor] = useState(() => {
    if (initialDay && /^\d{4}-\d{2}-\d{2}$/.test(initialDay)) {
      const [y, m, d] = initialDay.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [openKey, setOpenKey] = useState("");

  const days = useMemo(() => weekDays(anchor, weekStartsOn), [anchor, weekStartsOn]);

  // Shaped once per feed, keyed the way the list keys its rows — an
  // Appointment id and a JobVisit id come from different tables.
  const cards = useMemo(() => {
    const out = [];
    for (const e of entries || []) {
      if (!e || e.kind === "busy") continue;
      const card = entryCard(e, access);
      if (card?.start) out.push({ entry: e, card });
    }
    out.sort((a, b) => a.card.start - b.card.start);
    return out;
  }, [entries, access]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const item of cards) {
      const k = dayKey(item.card.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  }, [cards]);

  // Looked up from the CURRENT feed, so a reload after "Reschedule" shows the
  // new time in the open panel — and a row that left the feed (filtered out,
  // reassigned away from a crew member) closes it rather than showing a ghost.
  const open = openKey ? cards.find((c) => c.card.key === openKey) || null : null;
  const close = useCallback(() => setOpenKey(""), []);

  const todayKey = dayKey(new Date());
  const shift = (n) =>
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + n * 7));

  const rangeLabel = `${localeFormat(days[0], language, { month: "short", day: "numeric" })} – ${localeFormat(
    days[6],
    language,
    { month: "short", day: "numeric", year: "numeric" },
  )}`;

  return (
    <section aria-label={t("app.map.viewCards", "Cards")} className="mb-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground truncate">{rangeLabel}</h2>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t("app.entryCards.prevWeek", "Previous week")}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="min-h-[44px] px-3 rounded-lg border border-border text-sm hover:bg-muted"
          >
            {t("app.entryCards.thisWeek", "This week")}
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t("app.entryCards.nextWeek", "Next week")}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Not loaded (or failed — the page's banner says which) is not "nothing
          booked": the columns wait rather than state an empty week. */}
      {!ready ? (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-2 animate-pulse" aria-busy="true">
          {days.map((day) => (
            <div key={dayKey(day)} className="h-24 rounded-xl bg-accent" />
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-2">
        {days.map((day) => {
          const k = dayKey(day);
          const items = byDay.get(k) || [];
          const isToday = k === todayKey;
          return (
            <div
              key={k}
              className={`rounded-xl border bg-muted/30 p-2 min-w-0 ${
                isToday ? "border-foreground/40" : "border-border"
              }`}
            >
              <div className="flex items-baseline justify-between gap-1 px-1 mb-2">
                <span className={`text-xs font-semibold capitalize ${isToday ? "text-foreground" : "text-muted-foreground"}`}>
                  {localeFormat(day, language, { weekday: "short", day: "numeric" })}
                </span>
                {items.length > 0 && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70 px-1 pb-1">
                  {t("app.entryCards.emptyDay", "Nothing booked")}
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map(({ card }) => (
                    <EntryCard
                      key={card.key}
                      card={card}
                      serviceText={serviceText(card)}
                      onOpen={setOpenKey}
                      active={card.key === openKey}
                      t={t}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {open && (
        <EntryPanel
          entry={open.entry}
          card={open.card}
          serviceText={serviceText(open.card)}
          canAct={mayActOnEntry(open.entry, { caller, myUserId })}
          onClose={close}
          onChanged={onChanged}
          t={t}
          language={language}
        />
      )}
    </section>
  );
}
