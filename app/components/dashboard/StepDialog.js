// app/components/dashboard/StepDialog.js
//
// The window a set-up step opens in, on the home page, instead of a
// navigation. The owner's ask (2026-09-21): "Can a pop window be used instead
// of redirecting a company to the missing onboarding steps? So they don't
// necessarily navigate outside of the home page and get lost in the weeds."
//
// ══ What it is, and what it is not ═════════════════════════════════════════
//
// A frame, nothing more. The form inside it is the SAME component the
// settings page renders — app/components/dashboard/stepPanels.js maps each
// step key to one — so a logo uploaded here is uploaded by the code Settings >
// Branding runs, and the two can never disagree about what a save sends. This
// file owns only the frame: the heading, the close control, a body that
// scrolls, and the one link out for anybody who would rather have the whole
// page.
//
// Built on AlertDialog, the house primitive, because it already does the eight
// lines every modal needs (focus in, Tab wrapped, Escape, focus back) and a
// second copy is the one that rots. Escape and the scrim both close, which is
// the opposite of the incoming-call ring's choice and right here: nothing in
// a set-up form is lost by closing it that a second open does not offer
// again, and a form that traps the reader until they find the X is a worse
// bug than a dropped keystroke.
//
// ══ Phone width ════════════════════════════════════════════════════════════
//
// A full-height sheet: square corners, no gutter, the viewport's height, the
// body scrolling inside it. Contractors open the dashboard from a van; a
// centred card the size of a business card with a form scrolling inside it
// is what "lost in the weeds" looks like at 375px. From `sm` up it is a
// centred card, at most 90% of the viewport tall, with the wider width a
// form needs (the alert-dialog default is sized for two buttons).
//
// The "Open in settings" link is the deep link the row used to be. It is
// kept — visibly, at the foot of every dialog — because the settings page is
// also where the surrounding sections live, and because deep links from
// emails to /app/settings/... are unchanged and somebody who prefers the
// page should be one tap from it.
"use client";

import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import AlertDialog from "@/app/components/AlertDialog";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.id — base for the heading's id (aria-labelledby)
 * @param {string} props.title
 * @param {string} [props.intro] — one sentence under the title
 * @param {string} [props.href] — the settings page this step lives on
 * @param {() => void} props.onClose
 * @param {import("react").ReactNode} [props.footer] — a Done button for a
 *   list panel; a form panel closes itself on save and passes nothing
 * @param {import("react").RefObject} [props.initialFocusRef] — focused on
 *   open instead of the close button (the quote's Add service dialog puts
 *   the reader in its search box); absent = AlertDialog's first control
 */
export default function StepDialog({ open, id, title, intro, href, onClose, footer, initialFocusRef, children }) {
  const { t } = useTranslation();
  const titleId = `${id}-title`;
  const introId = intro ? `${id}-intro` : undefined;

  return (
    <AlertDialog
      open={open}
      role="dialog"
      labelledBy={titleId}
      describedBy={introId}
      initialFocusRef={initialFocusRef}
      onEscape={onClose}
      onScrim={onClose}
      scrimLabel={t("app.action.close")}
      placement="sheet"
      wrapperClass="p-0 sm:p-4"
      widthClass="sm:max-w-2xl"
      shapeClass="rounded-none sm:rounded-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col"
      // Above the mobile tab bar (z-40) and BELOW the popups the editors open
      // for themselves — Add Item, Add custom type, the delete confirm — which
      // are z-50 in their own files and must paint over this sheet.
      zClass="z-[45]"
      wrapperProps={{ "data-step-dialog": id }}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-foreground/15 shrink-0">
        <div className="min-w-0">
          <h2 id={titleId} className="font-semibold text-foreground text-lg leading-snug">
            {title}
          </h2>
          {intro && (
            <p id={introId} className="text-sm text-muted-foreground mt-1">
              {intro}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("app.action.close")}
          className="shrink-0 -mr-2 -mt-2 p-2 min-h-11 min-w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>

      {(href || footer) && (
        <div className="shrink-0 border-t border-foreground/15 px-5 py-3 flex items-center justify-between gap-3">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 min-h-9"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t("app.stepDialog.openInSettings", "Open in settings")}
            </Link>
          ) : (
            <span />
          )}
          {footer}
        </div>
      )}
    </AlertDialog>
  );
}
