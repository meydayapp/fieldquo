// app/components/layout/GlobalSearch.js
//
// One box, three sources: the menu (every rail row and every More row), the
// settings rows, and the company's own records — clients, quotes, jobs,
// invoices — by name or number. `/` opens it from anywhere in /app, the way
// Jobber's "Press / to search" does, but only when no input is focused: a
// slash typed into a quote's description must stay a slash.
//
// ── Why the menu corpus is filtered before it is searched ───────────────────
//
// Typing "receptionist" must not surface a feature this company does not
// have, or a screen this member may not open — that would reopen, by search,
// the leak the nav filters close. So the corpus is AdminSidebar's own
// useNavGroups pipeline over SEARCH_CORPUS (feature flags, permission grid,
// trade gate) plus useSettingsGroups (the same, with the settings capability
// map), and navDisclosure's filterGroups does the matching — the function
// scripts/check-sidebar.mjs and check-shell.mjs execute to prove every row
// is found by its own label.
//
// Records come from /api/search, which asks the caller's grid per type
// (lib/permissions/enforce.js hasLevel) and never returns a money figure —
// a result row is a name, a number and a status, so nothing here has to
// know about showPricing.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Users, FileText, Briefcase, Receipt, CornerDownLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { SEARCH_CORPUS, useNavGroups } from "@/app/components/layout/AdminSidebar";
import { useSettingsGroups } from "@/app/components/layout/SettingsSidebar";
import { filterGroups } from "@/app/components/layout/navDisclosure";
import { useNavShell } from "@/app/components/layout/NavShell";
import { fetchJson } from "@/lib/fetchJson";

const RECORD_ICON = { client: Users, quote: FileText, job: Briefcase, invoice: Receipt };
// The Create menu's own nouns — Client, Quote, Job, Invoice — not four new
// strings for the same four words.
const RECORD_LABEL = {
  client: "app.quickAdd.client",
  quote: "app.quickAdd.quote",
  job: "app.quickAdd.job",
  invoice: "app.quickAdd.invoice",
};
const MIN_RECORD_QUERY = 2;
const PAGE_CAP = 8;

/** Is the keyboard "in" something that takes text? Then `/` is a character. */
function typingSomewhere() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Mounts the `/` shortcut once, for the whole shell. */
export function useSlashToSearch() {
  const shell = useNavShell();
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typingSomewhere()) return;
      if (shell.overlay === "search") return;
      e.preventDefault();
      shell.open("search");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shell]);
}

export default function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const shell = useNavShell();
  const open = shell.isOpen("search");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState([]);
  const [recordsState, setRecordsState] = useState("idle"); // idle | loading | done | error
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const navGroups = useNavGroups(SEARCH_CORPUS);
  const settingsGroups = useSettingsGroups();
  const label = (key) => t(key);

  // Menu matches: rail + More first, then settings, each capped so records
  // are never pushed off the bottom by thirty settings rows matching "e".
  const pageHits = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const nav = filterGroups(navGroups, q, label).flatMap((g) =>
      g.items.map((i) => ({ kind: "page", href: i.href, key: i.key, group: g.key, icon: i.icon })),
    );
    const settings = filterGroups(settingsGroups, q, label).flatMap((g) =>
      g.items.map((i) => ({ kind: "settings", href: i.href, key: i.key, group: g.key, icon: i.icon })),
    );
    return [...nav, ...settings].slice(0, PAGE_CAP);
    // `label` is a fresh closure every render but reads only `t`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, navGroups, settingsGroups, t]);

  const rows = useMemo(
    () => [
      ...pageHits,
      ...records.map((r) => ({ kind: "record", ...r })),
    ],
    [pageHits, records],
  );

  // Reset on open; focus the box.
  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setRecords([]);
    setRecordsState("idle");
    setCursor(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Records, debounced. The state machine is what lets the empty state be
  // honest: "nothing matches" only after the request came back, never while
  // it is in flight or after it failed (lib/clientErrors' empty-vs-error).
  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < MIN_RECORD_QUERY) {
      setRecords([]);
      setRecordsState("idle");
      return undefined;
    }
    let live = true;
    setRecordsState("loading");
    const id = window.setTimeout(async () => {
      try {
        const data = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
        if (!live) return;
        setRecords(Array.isArray(data?.results) ? data.results : []);
        setRecordsState("done");
      } catch {
        if (!live) return;
        setRecords([]);
        setRecordsState("error");
      }
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [open, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  function go(row) {
    if (!row) return;
    shell.close();
    if (row.href !== pathname) router.push(row.href);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      shell.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[cursor]);
    }
  }

  // Keep the highlighted row in view as the arrows move it.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${cursor}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const q = query.trim();
  const showRecordsEmpty = q.length >= MIN_RECORD_QUERY && recordsState === "done" && records.length === 0;

  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label={t("app.search.title")} data-global-search>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={shell.close} />
      <div className="absolute inset-x-0 top-0 lg:top-[8vh] mx-auto w-full lg:max-w-xl lg:rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[100dvh] lg:max-h-[80vh] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("app.search.placeholder")}
            aria-label={t("app.search.title")}
            type="search"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-base lg:text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5"
          />
          <button type="button" onClick={shell.close} aria-label={t("app.sidebar.closeMenu")} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-2">
          {!q && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("app.search.hint")}</p>
          )}

          {q && pageHits.length > 0 && (
            <div className="pb-2">
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t("app.search.pages")}
              </div>
              {pageHits.map((row, i) => (
                <ResultRow key={`${row.kind}:${row.href}`} index={i} active={cursor === i} onPick={() => go(row)} onHover={() => setCursor(i)}>
                  <row.icon size={16} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-foreground">{t(row.key)}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {row.kind === "settings" ? `${t("app.settings.title")} › ${t(row.group)}` : t(row.group)}
                  </span>
                </ResultRow>
              ))}
            </div>
          )}

          {q.length >= MIN_RECORD_QUERY && (
            <div className="pb-1">
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t("app.search.records")}
              </div>
              {records.map((r, k) => {
                const i = pageHits.length + k;
                const Icon = RECORD_ICON[r.type] || FileText;
                return (
                  <ResultRow key={`${r.type}:${r.id}`} index={i} active={cursor === i} onPick={() => go({ href: r.href })} onHover={() => setCursor(i)}>
                    <Icon size={16} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{t(RECORD_LABEL[r.type] || "app.search.records")}</span>
                  </ResultRow>
                );
              })}
              {recordsState === "loading" && records.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">{t("app.search.searching")}</p>
              )}
              {showRecordsEmpty && (
                <p className="px-3 py-2 text-xs text-muted-foreground">{t("app.search.noRecords", { query: q })}</p>
              )}
              {recordsState === "error" && (
                <p className="px-3 py-2 text-xs text-destructive">{t("app.search.error")}</p>
              )}
            </div>
          )}

          {q && pageHits.length === 0 && q.length < MIN_RECORD_QUERY && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("app.nav.noMatches", { query: q })}</p>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
          <span>↑↓ {t("app.search.keyMove")}</span>
          <span className="inline-flex items-center gap-1"><CornerDownLeft size={11} /> {t("app.search.keyOpen")}</span>
          <span>esc {t("app.search.keyClose")}</span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ index, active, onPick, onHover, children }) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={onPick}
      onMouseMove={onHover}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${active ? "bg-muted" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
