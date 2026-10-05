"use client";

// app/components/company/chat/parts.js
//
// The small pieces the company chat's screen, panels and dialogs share: the
// line under a person's name, a modal frame, the team directory, and the
// people picker. One copy, imported by app/components/company/CompanyChat.js
// and the files beside this one — a second copy of a picker is the one that
// stops honouring a rule (AGENTS.md failure class 4).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { errorText } from "@/lib/fetchJson";
import { chatApi, CHAT_REFUSAL_KEYS } from "@/lib/company/chat/client";
import { personTitle } from "@/lib/team/personLabel";
import { Avatar, initialsOf } from "@/app/components/chat";

/** The catalogue key for a role label beside a name. */
export const LABEL_KEYS = {
  owner: "app.companyChat.label.owner",
  admin: "app.companyChat.label.admin",
  supervisor: "app.companyChat.label.supervisor",
  employee: "app.companyChat.label.employee",
};

// The word under a name: the person's JOB TITLE when they have one
// (Receptionist, Foreman — Worker.title), else the seat word as before. A
// person list is not the place for the permission tier, and the owner asked
// for the two to stop being one word; the seat label keeps its place where
// access is edited. No invented title for the rows without one — the seat
// word there is a fact, not a fallback. See lib/team/personLabel.js.
export function personLine(t, p) {
  return personTitle(p) || t(LABEL_KEYS[p.label] || LABEL_KEYS.employee);
}

/** The refusal in the reader's language, or the fallback key's sentence. */
export function useSay() {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  return useCallback((err, fallbackKey) => errorText(tRef.current, err, CHAT_REFUSAL_KEYS) || tRef.current(fallbackKey), []);
}

/** A modal frame. The kit has none; this screen needs one. */
export function Modal({ title, onClose, children, footer = null, wide = false }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-lg" : "sm:max-w-md"}`}
        data-chat-modal
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** A plain button in the screen's two weights. */
export function Button({ primary = false, danger = false, className = "", children, ...rest }) {
  const tone = primary
    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
    : danger
      ? "border-border bg-card text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
      : "border-border bg-card text-foreground hover:bg-muted";
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${tone} ${className}`}
    >
      {children}
    </button>
  );
}

/** Reads the directory once per open, filtered client-side as they type. */
export function useDirectory(open) {
  const say = useSay();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    chatApi
      .directory()
      .then((d) => alive && setPeople(d.people || []))
      .catch((err) => alive && setError(say(err, "app.companyChat.loadError")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, say]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!people || !q) return people;
    return people.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [people, query]);
  return { people: filtered, all: people, loading, error, query, setQuery };
}

/**
 * The directory, searchable. Single-select (`onPick`) or multi-select
 * (`selected` + `onToggle`) — New message is multi-select: one person is a
 * DM, two or more a group (the owner's "one control, not two concepts").
 *
 * @param excludeIds  people not offered at all (yourself)
 * @param inIds       people offered but marked "Already in" and not pickable
 */
export function PeoplePicker({ people, loading, error, query, onQuery, onPick = null, selected = null, onToggle = null, excludeIds = [], inIds = [] }) {
  const { t } = useTranslation();
  const exclude = new Set(excludeIds.filter(Boolean));
  const already = new Set(inIds.filter(Boolean));
  const chosen = new Set(selected || []);
  const multi = Boolean(onToggle);
  const rows = (people || []).filter((p) => !exclude.has(p.id));
  return (
    <div className="space-y-2" data-people-picker>
      <label className="relative block">
        <span className="sr-only">{t("app.companyChat.searchPeople")}</span>
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("app.companyChat.searchPeople")}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border" role="listbox" aria-multiselectable={multi || undefined}>
        {loading && !people ? (
          <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
          </li>
        ) : rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {query ? t("app.companyChat.noPeople") : t("app.companyChat.directoryEmpty")}
          </li>
        ) : (
          rows.map((p) => {
            const isIn = already.has(p.id);
            const isChosen = chosen.has(p.id);
            return (
              <li key={p.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isChosen}
                  aria-disabled={isIn || undefined}
                  disabled={isIn}
                  data-person={p.id}
                  onClick={() => (multi ? onToggle(p) : onPick?.(p))}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left min-h-[52px] ${isChosen ? "bg-muted" : "hover:bg-muted/60"} disabled:cursor-default disabled:opacity-70`}
                >
                  <Avatar initials={initialsOf(p.name || p.email || "?")} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name || p.email}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {personLine(t, p)}
                      {p.email && p.email !== p.name ? ` · ${p.email}` : ""}
                    </span>
                  </span>
                  {isIn ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t("app.companyChat.alreadyIn")}</span>
                  ) : multi ? (
                    <span
                      aria-hidden="true"
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${isChosen ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {isChosen ? <Check size={14} /> : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/** The picked people as removable chips, above the picker. */
export function PickedChips({ people, onRemove }) {
  const { t } = useTranslation();
  if (!people.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-picked>
      {people.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-sm text-foreground">
          <span className="max-w-[12rem] truncate">{p.name || p.email}</span>
          <button
            type="button"
            onClick={() => onRemove(p)}
            aria-label={t("app.companyChat.removePick", { name: p.name || p.email || "" })}
            className="-mr-1 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** A labelled radio row — the settings panel's and the create dialog's. */
export function RadioRow({ name, value, checked, onChange, title, hint = null, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 border-b border-border/60 py-2.5 last:border-b-0 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} disabled={disabled} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** A labelled on/off switch, as a real checkbox underneath. */
export function ToggleRow({ checked, onChange, title, hint = null, disabled = false, dataKey = undefined }) {
  return (
    <label className={`flex items-start gap-3 py-2.5 ${disabled ? "opacity-60" : "cursor-pointer"}`} data-toggle={dataKey}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="mt-1 h-5 w-5 accent-[var(--primary)]" />
    </label>
  );
}
