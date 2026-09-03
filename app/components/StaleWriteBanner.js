"use client";

// app/components/StaleWriteBanner.js
//
// What a stale write looks like to the person who hit it.
//
// This is the banner the owner asked for — "notifying when a document has been
// updated by someone else in the team" — and it is the half of the feature that
// decides whether the guard is worth having. A refusal that says only
// "conflict" leaves someone staring at a Save button that has stopped working,
// which is barely better than the silent overwrite it replaced.
//
// So it says four things, in this order:
//
//   1. WHO. Named when the server can prove who produced the stored version,
//      "someone on your team" when it can't (see resolveEditor in
//      lib/concurrency/staleWrite.js — it never guesses), and a calmer
//      second-person sentence when it turns out to be you on another device,
//      which is a common and much less alarming case.
//   2. WHEN, relative, in the reader's own language.
//   3. That NOTHING THEY TYPED IS LOST. It is still on screen, unsaved. This is
//      the sentence that stops the panic, and it is only true because the
//      caller does not reset its form or navigate on a 409 — see the
//      onOverwrite contract below.
//   4. What they can do about it.
//
// ── The two controls, and the one deliberately absent ──────────────────────
//
//   "Open the saved version" — a plain link with target="_blank". It cannot
//   lose anything: this tab keeps its unsaved state exactly as it is. Rendered
//   only when the caller passes a `href`, because a control that opens nothing
//   is the failure this codebase sweeps for.
//
//   "Save mine anyway" — re-submits against the version the server just named,
//   so the overwrite is deliberate rather than accidental. Note that it is
//   still GUARDED: if a third save lands in the meantime, it conflicts again
//   rather than forcing. There is no unguarded force anywhere in this feature.
//
//   There is NO merge and NO field-by-field diff. Both were considered and
//   neither is honest at this size: a quote is line items, scope groups and
//   costing rows, and a half-built merge that silently picks a winner per field
//   is the same data loss with more steps. See the report in
//   docs/construction/AUDIT-realtime-hosting.md §8.

import { useTranslation } from "@/app/hooks/useTranslation";
import { relativeTime } from "@/lib/concurrency/staleWriteClient";

/**
 * @param {object}   props
 * @param {object}   props.conflict     from readStaleConflict()
 * @param {string}   [props.href]       where to open the stored version, if any
 * @param {Function} [props.onOverwrite] re-run the save against conflict.currentUpdatedAt.
 *                   Omit it and no overwrite button is drawn — a screen that
 *                   cannot re-submit must not offer a button that says it can.
 * @param {boolean}  [props.busy]       a re-save is in flight
 */
export default function StaleWriteBanner({
  conflict,
  href,
  onOverwrite,
  busy = false,
}) {
  const { t, language } = useTranslation();
  if (!conflict) return null;

  const when = relativeTime(conflict.currentUpdatedAt, language);

  const title = conflict.byYou
    ? t("app.staleWrite.titleYou")
    : conflict.byName
      ? t("app.staleWrite.titleNamed", { name: conflict.byName })
      : t("app.staleWrite.titleUnknown");

  // The clause is dropped rather than filled with a placeholder when the
  // timestamp can't be formatted. "Saved Invalid Date ago" is worse than a
  // sentence that simply doesn't mention the time.
  const body = when
    ? t("app.staleWrite.bodyWhen", { when })
    : t("app.staleWrite.body");

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("app.staleWrite.keptSafe")}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            {t("app.staleWrite.review")}
          </a>
        ) : null}

        {onOverwrite ? (
          <button
            type="button"
            onClick={onOverwrite}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy
              ? t("app.staleWrite.overwriteBusy")
              : t("app.staleWrite.overwrite")}
          </button>
        ) : null}
      </div>

      {onOverwrite ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.staleWrite.overwriteHint")}
        </p>
      ) : null}
    </div>
  );
}
