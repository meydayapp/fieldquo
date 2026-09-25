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
//
// ── Drawn by ActionMenu (2026-09-25) ────────────────────────────────────────
//
// This file used to draw its own list: `absolute right-0 w-72` under the
// toggle, with a document mousedown listener to close it. On a phone the
// action strip wraps, "More…" lands at the left of its row, and the list —
// right edge pinned to the button's right edge, 288px wide — opened 200px off
// the left of the screen (the owner's screenshot: "s. Opens in the", "PDF",
// and a white column over the page). The list is now ActionMenu's: a bottom
// sheet below 640px, a viewport-clamped dropdown above. This file keeps the
// split-button look and the item vocabulary; it no longer positions anything.
"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import ActionMenu from "@/app/components/mobile/ActionMenu";

/**
 * @param primary  { label, icon, onClick, disabled, busy } or null
 * @param items    [{ key, label, icon, onSelect, disabled, hint, busy, danger, badge }]
 * @param menuLabel the dropdown's own word — "Send…" while sending is
 *                  possible, "More…" once it is not
 * @param align    "right" lines the list's right edge up with the toggle's
 *                 (the default); "left" the left edges. Either way the list
 *                 is kept on screen — this is a preference, not a position.
 */
export default function SendMenu({ primary = null, items = [], menuLabel = "Send…", align = "right" }) {
  const visible = items.filter(Boolean);
  if (!primary && visible.length === 0) return null;

  const PrimaryIcon = primary?.icon;
  return (
    <div className="relative inline-flex" data-send-menu>
      {primary ? (
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled || primary.busy}
          className={`flex min-h-[40px] items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
            visible.length ? "rounded-l-full" : "rounded-full"
          }`}
          data-send-primary
        >
          {primary.busy ? <Loader2 size={14} className="animate-spin" /> : PrimaryIcon ? <PrimaryIcon size={14} /> : null}
          {primary.label}
        </button>
      ) : null}
      {visible.length > 0 && (
        <ActionMenu
          title={menuLabel.replace(/[….]+$/, "")}
          align={align === "left" ? "start" : "end"}
          items={visible}
          triggerClassName={`flex min-h-[40px] items-center gap-1 px-3 py-2 text-sm font-semibold ${
            primary
              ? "bg-inverted text-inverted-foreground rounded-r-full border-l border-inverted-foreground/20"
              : "border border-border text-foreground rounded-full"
          }`}
          triggerProps={{ "data-send-menu-toggle": true }}
          popupProps={{ "data-send-menu-list": true }}
          trigger={
            <>
              {primary ? null : menuLabel}
              <ChevronDown size={14} />
              {primary ? <span className="sr-only">{menuLabel}</span> : null}
            </>
          }
        />
      )}
    </div>
  );
}
