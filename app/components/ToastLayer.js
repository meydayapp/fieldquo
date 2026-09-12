// app/components/ToastLayer.js
//
// The one toast layer, for all three staff surfaces.
//
// ══ What was wrong before ══════════════════════════════════════════════════
//
// The owner: "the notification pop-ups are half hidden". Reproduced in a
// harness (docs/screens/notifications/harness) at 1280 and 375:
//
//   * /sales on a phone: the queue's own top-up toast ("Added 25 leads…") was
//     `fixed bottom-[tab-bar+1rem] left-1/2 z-40` — the SAME bottom offset and
//     the SAME z-index as the tour's launcher pill at left-4, which is later
//     in the tree and so painted over the toast's lower-left corner. With the
//     lead panel maximised (fixed inset-0 z-40, also later in the tree) the
//     toast was under the whole panel.
//   * /sales and /platform generally: showError() had no listener at all.
//     ErrorToast was mounted only in app/app/layout.js, so every
//     reportResponseError on those two surfaces reported to nobody.
//   * /app's bell popover (NotificationBell.js) was anchored `right-0` to a
//     bell at the right edge of the 256px rail, 352px wide — a third of it
//     fell off the LEFT edge of the viewport, most of it with the rail
//     collapsed. That one is fixed in NotificationBell.js by the same means
//     as this file: a portal at document.body and a fixed position measured
//     from the viewport, not from the rail.
//
// ══ How it is placed ═══════════════════════════════════════════════════════
//
// A portal at document.body, `position: fixed`, above every sidebar, drawer
// and dialog (z-120; PlanRequiredPrompt is 110 and nothing else is higher).
// The positioning is ONE rule in app/globals.css (.fq-toast-layer), not a
// class list here, because it has to read the bottom-dock variables:
//
//   from lg up   bottom-right, above the page's Save bar (--fq-dock-height),
//                clear of the launcher column where the surface has one
//                (--fq-toast-right, declared by the surface class below).
//   below lg     centred, above the tab bar AND the page's Save bar —
//                --fq-tab-bar-height + --fq-dock-height + a gap — with
//                env(safe-area-inset-bottom) when there is no bar to carry
//                it (the platform console has no tab bar).
//
// The portal root carries the SURFACE'S shell class (fq-app-shell /
// fq-sales-shell). Those classes exist to declare what is pinned to the
// bottom of that surface — the tab bar's row below lg, 0 from lg up — and a
// node rendered at document.body is outside the shell's subtree, so it must
// carry the declaration itself or it reads :root's 0 and lands under the
// tab bar. --fq-dock-height is written to <html> by useBottomDock, so that
// one inherits regardless.
//
// ══ Behaviour ══════════════════════════════════════════════════════════════
//
//   * At most three at once; the oldest goes when a fourth arrives.
//   * The same message twice in a row is one toast (a double-clicked button
//     must not stack two identical errors); the same `tag` replaces.
//   * Click anywhere on a toast to dismiss it; a toast with an href also
//     navigates. The X is for keyboards and screen readers.
//   * aria-live="polite" on the region, so a screen reader announces without
//     interrupting. Errors are still polite: the layer is for things that
//     happened, not things that need an answer.
//   * Auto-dismiss after the tone's duration; motion-reduce turns the enter
//     animation off.
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { TOAST_EVENT, showToast } from "@/lib/toast";
import { onPushMessage } from "@/lib/notify/swClient";
import { useTranslation } from "@/app/hooks/useTranslation";

export const MAX_TOASTS = 3;

const SURFACES = {
  // Jennifer's launcher (56px at right-5) and the quote builder's Help
  // button share /app's bottom-right corner; the layer sits to their left
  // from lg up rather than on top of them.
  app: { shellClass: "fq-app-shell", right: "6rem" },
  sales: { shellClass: "fq-sales-shell", right: "1.5rem" },
  platform: { shellClass: "", right: "1.5rem" },
  // A screen with no chrome at all — /sales/login, /sales/invite — where
  // there is no bar to clear at any width.
  bare: { shellClass: "", right: "1.5rem" },
};

const TONE = {
  error: { Icon: AlertCircle, icon: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-900" },
  success: { Icon: CheckCircle2, icon: "text-green-700 dark:text-green-300", border: "border-border" },
  info: { Icon: Info, icon: "text-muted-foreground", border: "border-border" },
};

/**
 * @param {{ surface: "app" | "sales" | "platform" | "bare" }} props
 */
export default function ToastLayer({ surface = "app" }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  // The portal target only exists in the browser; rendering it during SSR
  // would throw, and rendering nothing on the first client pass keeps the
  // hydration tree identical to the server's.
  const [host, setHost] = useState(null);
  // The effect below owns the list and its timers; a click on a toast has to
  // go through the same remove() so the mirror it keeps stays true.
  const removeRef = useRef(() => {});

  useEffect(() => {
    setHost(document.body);
  }, []);

  // A push that arrived while this tab was visible: public/sw.js hands it
  // here instead of showing a system notification over a screen the person
  // is already looking at. Same tag as the page's own poll would use, so
  // the two announce once.
  useEffect(
    () =>
      onPushMessage((p) =>
        showToast({ message: p.body ? `${p.title} — ${p.body}` : p.title, href: p.url || null, tag: p.tag || null }),
      ),
    [],
  );

  useEffect(() => {
    // Timers live beside the list, not inside the state updater: an updater
    // must be pure, and clearing a timeout inside one runs twice in strict
    // mode with the second run seeing a map the first already emptied.
    const timers = new Map();
    let list = [];
    const commit = (next) => {
      list = next;
      setToasts(next);
    };
    const forget = (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
    };
    const remove = (id) => {
      forget(id);
      commit(list.filter((x) => x.id !== id));
    };
    removeRef.current = remove;

    function onToast(e) {
      const d = e.detail;
      if (!d?.message) return;
      if (list.some((x) => x.message === d.message)) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      let next = list;
      if (d.tag) {
        for (const replaced of next.filter((x) => x.tag === d.tag)) forget(replaced.id);
        next = next.filter((x) => x.tag !== d.tag);
      }
      next = [...next, { id, ...d }];
      // Oldest first out, its timer cleared so a stale timeout cannot later
      // fire for a toast that is already gone.
      while (next.length > MAX_TOASTS) forget(next.shift().id);
      commit(next);
      timers.set(id, setTimeout(() => remove(id), d.duration));
    }

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  const cfg = SURFACES[surface] || SURFACES.app;

  if (!host) return null;

  return createPortal(
    <div
      className={`fq-toast-layer ${cfg.shellClass}`}
      style={{ "--fq-toast-right": cfg.right }}
      role="status"
      aria-live="polite"
      data-toast-layer={surface}
    >
      {toasts.map((item) => {
        const tone = TONE[item.tone] || TONE.info;
        const Icon = tone.Icon;
        const dismiss = () => removeRef.current(item.id);
        const body = (
          <>
            <Icon size={17} className={`${tone.icon} shrink-0 mt-0.5`} aria-hidden="true" />
            <span className="text-sm text-foreground flex-1 min-w-0 break-words">{item.message}</span>
          </>
        );
        return (
          <div
            key={item.id}
            data-toast
            data-tone={item.tone}
            className={`pointer-events-auto bg-card border ${tone.border} shadow-lg rounded-xl flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none`}
          >
            {item.href ? (
              <a href={item.href} onClick={dismiss} className="flex-1 min-w-0 flex items-start gap-2.5 px-4 py-3 text-left">
                {body}
              </a>
            ) : (
              <button type="button" onClick={dismiss} className="flex-1 min-w-0 flex items-start gap-2.5 px-4 py-3 text-left cursor-default">
                {body}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
              aria-label={t("app.toast.dismiss")}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>,
    host,
  );
}
