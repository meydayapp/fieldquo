// app/components/layout/CreateMenu.js
//
// The Create menu — client · lead · quote · job · invoice — in its two
// forms: a pill in the desktop top bar with a popover under it, and a
// floating + above the phone's tab bar with a bottom sheet. Same items
// (AdminSidebar's QUICK_ADD_ITEMS), same two filters (feature flags, then
// the permission grid — filterNavItemsByPermission, not filterNavItems
// alone: QA once found all five entries offered to a Worker whose API
// refused every one), so what a Crew member is offered on the phone is
// exactly what they would be offered at a desk.
//
// Hidden entirely when the caller can create NOTHING — a primary button
// that opens an empty menu is a worse control than no button.
//
// The phone's + used to have no equivalent: on a phone, Create was a row
// inside the drawer. Starting a quote is the main reason somebody reaches
// for the app in a driveway, so it earns the one floating control.
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { QUICK_ADD_ITEMS, useNavItems } from "@/app/components/layout/AdminSidebar";
import { useNavShell } from "@/app/components/layout/NavShell";

const OVERLAY = "create";

function useCloseOnOutside(ref, active, close) {
  useEffect(() => {
    if (!active) return undefined;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) close();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active, close]);
}

/** The desktop pill + popover. Renders nothing when the member may create nothing. */
export function CreateButton() {
  const { t } = useTranslation();
  const shell = useNavShell();
  const items = useNavItems(QUICK_ADD_ITEMS);
  const ref = useRef(null);
  const open = shell.isOpen(OVERLAY);
  useCloseOnOutside(ref, open, shell.close);
  if (items.length === 0) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => shell.toggle(OVERLAY)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-create-button
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold bg-inverted text-inverted-foreground hover:brightness-110"
      >
        <Plus size={16} className="shrink-0" />
        <span>{t("app.quickAdd.title")}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 z-50 bg-card rounded-xl shadow-lg border border-border p-2"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                onClick={shell.close}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted"
              >
                <Icon size={16} className="shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The phone's floating + and its sheet. Sits above the tab bar and above
 * whatever Save bar the page has docked (the two CSS variables the bottom
 * dock declares — app/globals.css), never under either. Hidden from `lg` up,
 * where CreateButton in the top bar takes over, and hidden on the employee
 * home's own screens (the /app/me tab bar has its own idea of "add").
 */
export function CreateFab() {
  const { t } = useTranslation();
  const shell = useNavShell();
  const items = useNavItems(QUICK_ADD_ITEMS);
  const open = shell.isOpen(OVERLAY);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && shell.close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, shell]);
  if (items.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => shell.toggle(OVERLAY)}
        aria-label={t("app.quickAdd.title")}
        aria-expanded={open}
        data-create-fab
        className="lg:hidden fixed right-4 z-40 w-12 h-12 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_6px_16px_rgba(0,0,0,0.25)] flex items-center justify-center active:brightness-95"
        style={{ bottom: "calc(var(--fq-tab-bar-height) + var(--fq-dock-height) + 1rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" data-create-sheet>
          <div className="absolute inset-0 bg-black/40" onClick={shell.close} />
          <div
            role="menu"
            aria-label={t("app.quickAdd.title")}
            className="absolute inset-x-0 bottom-0 bg-card rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.18)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/25" />
            <div className="flex items-center justify-between px-4 py-2">
              <span className="font-bold text-foreground">{t("app.quickAdd.title")}</span>
              <button type="button" onClick={shell.close} aria-label={t("app.sidebar.closeMenu")} className="p-1.5 -mr-1.5 text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="px-2 pb-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    role="menuitem"
                    onClick={shell.close}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground active:bg-muted"
                  >
                    <span className="w-9 h-9 rounded-lg bg-muted text-inverted flex items-center justify-center">
                      <Icon size={18} />
                    </span>
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
