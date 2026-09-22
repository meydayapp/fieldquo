// app/components/quotes/SendMenu.js
//
// The split button on a quote: one primary action and a "Send…" menu of
// everything else that gets the quote out of the building (mockup b8).
//
// ── What lives here and what stays a pill ───────────────────────────────────
//
// The menu holds the WAYS TO SEND and the things adjacent to sending:
// preview as the client, share with staff, create the invoice, save as a
// template, copy the link, download the PDF, copy the quote, archive it.
// Follow up, Call, "Client accepted / didn't go ahead" and Get approved stay
// on the page as pills: they are things that happen AFTER sending, not ways
// to send. The page composes the items; this component only draws them.
//
// ── Absent, disabled, present ───────────────────────────────────────────────
//
// An item the page cannot foresee working is passed with `hint` and drawn
// disabled with the reason ("after the client accepts") — a greyed row that
// says why is honest. An item that cannot exist yet at all (a work-order
// link, until there is a work-order document) is not passed and not drawn:
// a dead row would be the control that appears to work.
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

/**
 * @param primary  { label, icon, onClick, disabled, busy } or null
 * @param items    [{ key, label, icon, onSelect, disabled, hint, busy, danger, badge }]
 * @param menuLabel the dropdown's own word — "Send…" while sending is
 *                  possible, "More…" once it is not
 */
export default function SendMenu({ primary = null, items = [], menuLabel = "Send…", align = "right" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = items.filter(Boolean);
  if (!primary && visible.length === 0) return null;

  const PrimaryIcon = primary?.icon;
  return (
    <div ref={rootRef} className="relative inline-flex" data-send-menu>
      {primary ? (
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled || primary.busy}
          className={`flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
            visible.length ? "rounded-l-full" : "rounded-full"
          }`}
          data-send-primary
        >
          {primary.busy ? <Loader2 size={14} className="animate-spin" /> : PrimaryIcon ? <PrimaryIcon size={14} /> : null}
          {primary.label}
        </button>
      ) : null}
      {visible.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold ${
            primary
              ? "bg-inverted text-inverted-foreground rounded-r-full border-l border-inverted-foreground/20"
              : "border border-border text-foreground rounded-full"
          }`}
          data-send-menu-toggle
        >
          {primary ? null : menuLabel}
          <ChevronDown size={14} />
          {primary ? <span className="sr-only">{menuLabel}</span> : null}
        </button>
      )}
      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 z-40 w-72 rounded-xl border border-border bg-card shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          data-send-menu-list
        >
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled || item.busy}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-50 hover:bg-muted ${
                  item.danger ? "text-red-700 dark:text-red-400" : "text-foreground"
                }`}
                data-send-item={item.key}
              >
                {item.busy ? (
                  <Loader2 size={14} className="animate-spin mt-0.5 shrink-0" />
                ) : Icon ? (
                  <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block">
                    {item.label}
                    {item.badge ? (
                      <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground align-middle">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  {item.hint ? <span className="block text-xs text-muted-foreground">{item.hint}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
