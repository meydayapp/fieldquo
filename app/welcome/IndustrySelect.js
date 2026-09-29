"use client";

// app/welcome/IndustrySelect.js
//
// "What industry are you in?" — a searchable select whose options are grouped
// under FieldQuo's industries, with the group's name pinned to the top of the
// list while its options scroll under it (sticky headers), so a painter
// scrolling past "Cabinet Refinishing" still sees that it sits under Painting.
//
// A combobox rather than a native <select>: a native one cannot be searched
// on a phone and cannot pin its <optgroup> labels. Keyboard: type to filter,
// ↑/↓ to move, Enter to pick, Escape to close. The value is the option's
// `${industry}:${tradeKey}` (lib/signup/welcome.js readIndustryChoice), and
// nothing is picked until the person picks it — the field opens empty.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fieldClass } from "@/app/components/auth/fieldStyles";

/** Groups filtered by a search — options whose label or group label matches. Exported for the check. */
export function filterGroups(groups, query) {
  const q = String(query || "").trim().toLowerCase();
  const list = Array.isArray(groups) ? groups : [];
  if (!q) return list;
  return list
    .map((g) => {
      const groupHit = String(g.label || "").toLowerCase().includes(q);
      const options = groupHit ? g.options : g.options.filter((o) => String(o.label).toLowerCase().includes(q));
      return { ...g, options };
    })
    .filter((g) => g.options.length > 0);
}

export default function IndustrySelect({ groups = [], value = "", onChange, invalid = false, id = "welcome-industry" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const named = useMemo(
    () => groups.map((g) => ({ ...g, label: g.label || t("app.welcome.business.otherTrades", "Other trades") })),
    [groups, t],
  );
  const shown = useMemo(() => filterGroups(named, query), [named, query]);
  const flat = useMemo(() => shown.flatMap((g) => g.options), [shown]);
  const selected = useMemo(() => named.flatMap((g) => g.options).find((o) => o.value === value) || null, [named, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function pick(option) {
    onChange?.(option.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && flat[active]) {
        e.preventDefault();
        pick(flat[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let index = -1;
  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : selected?.label || ""}
          placeholder={selected ? selected.label : t("app.welcome.business.industryPlaceholder", "Search for your industry")}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`${fieldClass(invalid)} pl-9 pr-9`}
        />
        <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground" />
      </div>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {shown.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {t("app.welcome.business.industryNone", "Nothing matches — try another word.")}
            </p>
          )}
          {shown.map((g) => (
            <div key={g.slug} role="group" aria-label={g.label}>
              {/* Sticky: the group's name stays at the top of the list while
                  its options scroll under it, until the next group's name
                  pushes it off. */}
              <div className="sticky top-0 z-10 border-b border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </div>
              {g.options.map((o) => {
                index += 1;
                const i = index;
                const on = o.value === value;
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={on}
                    data-index={i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setActive(i)}
                    className={`cursor-pointer px-4 py-2 text-sm ${i === active ? "bg-muted" : ""} ${
                      on ? "font-semibold text-foreground" : "text-foreground"
                    }`}
                  >
                    {o.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
