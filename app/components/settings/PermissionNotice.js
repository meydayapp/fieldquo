// app/components/settings/PermissionNotice.js
//
// The two honest answers a settings screen can give someone who can't change it.
//
// ── Why there are exactly two, and no third ────────────────────────────────
//
//   <NoAccessPanel>   the screen is not theirs at all. Nothing on it is
//                     rendered — not greyed out, not behind a disabled button.
//   <ReadOnlyNotice>  the screen carries information they genuinely need, so it
//                     is rendered as TEXT with this banner above it.
//
// The third option — draw the form, disable the inputs — is the one this file
// exists to remove. A ticked-but-dead checkbox and a number field that accepts
// typing and then refuses to save are the failure AGENTS.md names first: a
// control that appears to work and doesn't. Disabling it is only marginally
// better, because a disabled field still says "this is where you'd change it"
// and gives no clue who can.
//
// Both name WHO can do the thing. That is the only useful next step for the
// person reading it, and it is the half every version of this message in the
// codebase was missing.
"use client";

import { Lock, Eye } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";

/** The stock "who" phrases, so twelve screens can't describe one rule twelve ways. */
export function whoLabel(t, capability) {
  switch (capability) {
    case "billing":
    case "payroll":
      return t("app.perm.whoOwnerAdmin");
    // Not a role at all. jobCosting is a per-member toggle an owner grants, so
    // naming a role here would be wrong in both directions: a Manager holds it
    // and a Dispatcher with the same role does not.
    case "jobCosting":
      return t("app.perm.whoJobCosting");
    default:
      // user:manage and workarea:assign are both held by supervisors.
      return t("app.perm.whoManagers");
  }
}

/**
 * A whole screen someone may not open.
 *
 * Renders INSTEAD of the page, never around it — the point is that none of the
 * data loads. Pages using this must return it before their fetches, not after.
 */
export function NoAccessPanel({ capability = "user:manage", children }) {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Lock size={18} className="text-muted-foreground shrink-0" />
          <h1 className="text-lg font-bold text-foreground">
            {t("app.perm.noAccessTitle")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("app.perm.noAccessBody", { who: whoLabel(t, capability) })}
        </p>
        {children}
        <Link
          href="/app"
          className="inline-block text-sm font-semibold text-foreground underline"
        >
          {t("app.perm.backHome")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Sits above a surface rendered as text rather than as a form.
 *
 * `what` is an optional sentence naming what is still useful about the screen
 * ("these are the hours clients see"), because "you can't edit this" on its own
 * reads as an error rather than as an answer.
 */
export function ReadOnlyNotice({ capability = "user:manage", what = null }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted px-4 py-3">
      <Eye size={16} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">
          {t("app.perm.readOnlyTitle")}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {what ? `${what} ` : ""}
          {t("app.perm.readOnlyBody", { who: whoLabel(t, capability) })}
        </p>
      </div>
    </div>
  );
}

/**
 * One labelled fact, rendered the way a fact is rendered.
 *
 * Deliberately not an <input disabled>: a bordered box with a caret in it is a
 * form control whatever its disabled attribute says, and on a phone it still
 * invites a tap. A definition list reads as information.
 */
export function ReadOnlyField({ label, value, empty }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm mt-0.5 ${
          value ? "text-foreground" : "text-muted-foreground italic"
        }`}
      >
        {value || empty || "—"}
      </dd>
    </div>
  );
}
