"use client";

// app/components/ListState.js
//
// The three states a loaded list can be in — loading, failed, empty — and the
// guarantee that exactly one of them renders.
//
// See lib/loadState.js for the bug this pair exists to prevent. The short
// version: /app/clients showed "0 clients total", a red "Couldn't load
// clients." AND "No clients yet / Add your first client" simultaneously on a
// 401. Someone with 400 clients was invited to start typing them in again.
//
// ── Why a component rather than a documented convention ────────────────────
//
// Because a convention is per-page improvisation with extra steps, and this
// codebase already ran that experiment: one page load surfaced the same 401
// three different ways. The mutual exclusion here is a single if/else-if
// chain, in one file, that no page can partially adopt. A page either passes
// its list body as `children` — in which case the body is unreachable while
// loading or failed — or it does not use this component at all.
//
// ── Why the error panel says "nothing has been deleted" ────────────────────
//
// The realistic harm is not confusion, it is data re-entry. A contractor who
// believes their client list is gone starts rebuilding it, and now there are
// duplicates to merge on top of the original outage. Naming the thing the user
// is actually afraid of is cheaper than any amount of retry UI.

import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object} props
 * @param {boolean} props.loading   request still in flight
 * @param {string}  props.errorKey  i18n key from lib/loadState.js, "" if fine
 * @param {boolean} props.isEmpty   the server SUCCEEDED and returned nothing.
 *   Callers must derive this from a non-null list, never from `items.length`
 *   on a list that is still `null`.
 * @param {React.ReactNode} [props.skeleton]  loading placeholder
 * @param {React.ReactNode} [props.empty]     the empty-state panel
 * @param {() => void}      [props.onRetry]   re-runs the load
 * @param {React.ReactNode} props.children    the list itself
 */
export default function ListState({
  loading,
  errorKey,
  isEmpty,
  skeleton,
  empty,
  onRetry,
  children,
}) {
  const { t } = useTranslation();

  // Order is load-bearing and the branches are exclusive: an `if` chain with a
  // return, not a series of `&&` fragments. `&&` fragments are exactly how the
  // original bug rendered an error and an empty state at the same time.
  if (loading) {
    return (
      skeleton ?? (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-16 bg-accent rounded-xl" />
          <div className="h-16 bg-accent rounded-xl" />
          <div className="h-16 bg-accent rounded-xl" />
        </div>
      )
    );
  }

  if (errorKey) {
    return (
      <div
        role="alert"
        className="bg-card border border-red-200 dark:border-red-900 rounded-xl p-8 text-center"
      >
        <AlertCircle size={32} className="mx-auto text-red-600 dark:text-red-400 mb-3" />
        <p className="text-sm font-semibold text-foreground">
          {t("app.load.title")}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {t(errorKey)}
        </p>
        {/* The sentence that stops someone re-entering their data. */}
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          {t("app.load.reassure")}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-2 rounded-full text-sm font-semibold text-foreground"
          >
            <RefreshCw size={14} /> {t("app.load.retry")}
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) return empty ?? null;

  return children;
}

/**
 * The header line that used to read "0 clients total." on a failed load.
 *
 * Renders nothing at all when the count is unknown. Not "—", not "0", not a
 * spinner: the honest rendering of a number you were refused is no number.
 * Absence of a statement is not a statement (AGENTS.md).
 *
 * @param {number|null|undefined} props.count  null/undefined = not known
 */
export function ListCount({ count, children }) {
  if (count === null || count === undefined) return null;
  return <p className="text-sm text-muted-foreground mt-1">{children}</p>;
}
