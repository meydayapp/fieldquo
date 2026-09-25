"use client";

// app/components/mobile/ActionMenu.js
//
// The one "More…" menu. A trigger and a list of actions: a bottom sheet on a
// phone, a dropdown pinned inside the viewport everywhere else.
//
// ── Why this exists (2026-09-25) ────────────────────────────────────────────
//
// The owner, on an iPhone, on a quote: "More…" opened its panel off the LEFT
// edge of the screen — "s. Opens in the" and "PDF" were the only words left —
// with a blank white column over the page. SendMenu drew its list as
// `absolute right-0 w-72` under the trigger. On a phone the action strip
// wraps, "More…" lands at the left of its row, and a 288px panel whose right
// edge is pinned to an ~90px button's right edge starts 200px left of the
// screen. Nothing measured the viewport; every other hand-rolled dropdown in
// /app had the same shape (absolute + right-0/left-0 + a fixed width) and
// only escaped because its trigger happened to sit near the correct edge.
//
// ── Two presentations, chosen by width, one list of items ──────────────────
//
// Below 640px (Tailwind's `sm`): a bottom sheet — BottomSheet.js, the
// @base-ui Drawer this repo already uses for exactly this, so the focus trap,
// Escape, backdrop tap, scroll lock, safe-area padding and swipe-down all come
// from the one tested implementation instead of a second copy. A sheet is the
// only thing that is ALWAYS full-width and reachable by a thumb; clamping a
// dropdown onto a 375px screen still leaves a floating box over the content.
//
// From 640px: @base-ui's Menu, positioned by its Positioner with collision
// avoidance — the side flips above the trigger when there is no room below,
// the alignment flips when the preferred edge would overflow, and the popup
// is capped at the space the viewport actually has (--available-height /
// width). Menu also brings arrow-key navigation, typeahead and focus return.
// Rejected: computing a fixed position by hand from getBoundingClientRect —
// that is the positioning engine @base-ui already ships, re-written worse,
// and the hand-written versions in this repo are the bug being fixed.
//
// Why 640 and not BottomSheet's 1024: a menu is a short list next to the
// thing it acts on, and on a tablet there is room for it there. A dialog is
// different content (BottomSheet's own header says why it waits for lg).
//
// The breakpoint is read with JS for the same reason BottomSheet reads its
// own: the two branches are different component trees (Menu.Root vs a
// Drawer), not one element restyled. `isPhone` starts true — mobile-first,
// and nothing is open on the first render, so the one re-render after
// hydration on a desktop swaps a closed trigger for a closed trigger.
//
// ── Items ───────────────────────────────────────────────────────────────────
//
// { key, label, icon, onSelect, href, disabled, hint, busy, danger, badge,
//   checked, divider }
// `checked` (true/false, not undefined) makes the row a radio choice — the
// current one carries a tick and aria-checked; `divider` rules a line above
// the row. An item that cannot work yet is passed `disabled` WITH a `hint` saying why;
// an item that cannot exist is not passed at all (SendMenu's header: a dead
// row is the control that appears to work). `href` rows navigate as real
// links, so the navigation survives the menu closing.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Check, Loader2 } from "lucide-react";
import BottomSheet from "@/app/components/mobile/BottomSheet";
import { TOUCH_FEEDBACK_CLASS } from "@/app/components/mobile/TouchFeedback";
import { cn } from "@/lib/utils";

/** Below Tailwind's `sm`. Exported so scripts/check-mobile-surfaces.mjs and
 *  anything else that needs "is this the sheet?" reads one number. */
export const ACTION_MENU_PHONE_QUERY = "(max-width: 639.98px)";

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia(ACTION_MENU_PHONE_QUERY);
    setIsPhone(mql.matches);
    const onChange = (e) => setIsPhone(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isPhone;
}

function ItemBody({ item }) {
  const Icon = item.icon;
  return (
    <>
      {item.busy ? (
        <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
      ) : Icon ? (
        <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block break-words">
          {item.label}
          {item.badge ? (
            <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground align-middle">
              {item.badge}
            </span>
          ) : null}
        </span>
        {item.hint ? <span className="block text-xs text-muted-foreground">{item.hint}</span> : null}
      </span>
      {item.checked ? <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> : null}
    </>
  );
}

const rowClass = (item) =>
  cn(
    "flex w-full min-h-[44px] items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none select-none",
    "disabled:opacity-50 data-[disabled]:opacity-50 aria-disabled:opacity-50",
    item.danger ? "text-red-700 dark:text-red-400" : "text-foreground",
    item.checked ? "bg-muted font-semibold" : "",
    item.divider ? "mt-1 border-t border-border rounded-t-none" : "",
  );

/** A radio row says so to assistive tech; an ordinary row stays a menuitem. */
const roleProps = (item) =>
  typeof item.checked === "boolean" ? { role: "menuitemradio", "aria-checked": item.checked } : { role: "menuitem" };

/**
 * @param trigger      the trigger's CONTENT (label, chevron, icon)
 * @param triggerClassName  the trigger button's classes — the caller's look
 * @param triggerProps extra attributes for the trigger (data-*, aria-label)
 * @param items        see the header
 * @param title        the sheet's heading, and the menu's accessible name
 * @param align        "end" (right edges line up) or "start"
 */
export default function ActionMenu({
  trigger,
  triggerClassName,
  triggerProps = {},
  items = [],
  title,
  align = "end",
  popupProps = {},
}) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  if (isPhone) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={triggerClassName}
          {...triggerProps}
        >
          {trigger}
        </button>
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title={title}
          // iOS does not focus a tapped button, so "back to whatever had
          // focus" would land on <body>. The trigger is where a keyboard or a
          // screen reader should resume.
          finalFocus={triggerRef}
        >
          <div role="menu" aria-label={title} className="-mx-2 pb-1" data-action-sheet {...popupProps}>
            {visible.map((item) => {
              const common = { ...roleProps(item), "data-action-item": item.key };
              const cls = cn(TOUCH_FEEDBACK_CLASS, rowClass(item), "active:bg-muted");
              if (item.href && !item.disabled) {
                return (
                  <Link key={item.key} {...common} className={cls} href={item.href} onClick={() => setOpen(false)}>
                    <ItemBody item={item} />
                  </Link>
                );
              }
              return (
                <button
                  key={item.key}
                  {...common}
                  className={cls}
                  type="button"
                  disabled={item.disabled || item.busy}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                >
                  <ItemBody item={item} />
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </>
    );
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        ref={triggerRef}
        className={triggerClassName}
        {...triggerProps}
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align={align}
          sideOffset={4}
          collisionPadding={8}
          // Flip the side when there is no room below; flip the alignment
          // when the preferred edge would overflow (a right-aligned list
          // under a trigger at the LEFT edge lines up with its left edge
          // instead), and @base-ui then shifts whatever still overflows
          // (align "flip" runs flip() before shift() — see its
          // useAnchorPositioning). A trigger at either edge, at any width,
          // keeps the whole list on screen: the clamping SendMenu never did.
          collisionAvoidance={{ side: "flip", align: "flip", fallbackAxisSide: "none" }}
          className="z-50 outline-none"
        >
          <Menu.Popup
            aria-label={title}
            className="w-72 max-w-[var(--available-width)] max-h-[var(--available-height)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 text-foreground shadow-lg outline-none origin-[var(--transform-origin)] transition-[transform,opacity] duration-100 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            data-action-popup
            {...popupProps}
          >
            {visible.map((item) =>
              item.href && !item.disabled ? (
                <Menu.LinkItem
                  key={item.key}
                  closeOnClick
                  render={<Link href={item.href} />}
                  className={cn(rowClass(item), "data-[highlighted]:bg-muted")}
                  data-action-item={item.key}
                >
                  <ItemBody item={item} />
                </Menu.LinkItem>
              ) : (
                <Menu.Item
                  key={item.key}
                  {...roleProps(item)}
                  disabled={item.disabled || item.busy}
                  onClick={() => item.onSelect?.()}
                  className={cn(rowClass(item), "cursor-pointer data-[highlighted]:bg-muted")}
                  data-action-item={item.key}
                >
                  <ItemBody item={item} />
                </Menu.Item>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
