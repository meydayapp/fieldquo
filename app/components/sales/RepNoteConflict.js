"use client";

// app/components/sales/RepNoteConflict.js
//
// What a stale write looks like on the notes screen.
//
// ══ Why not app/components/StaleWriteBanner.js ═════════════════════════════
//
// That banner is right for a quote and wrong here for two reasons, and both
// are about not lying.
//
//   1. It composes "Sarah saved changes to this quote" through t() from
//      app.staleWrite.*, which is keyed for a QUOTE. This surface is
//      translated too now — the portal was keyed in full, so "that catalogue
//      does not reach here" has stopped being the reason — but a note is not a
//      quote, and borrowing the quote's wording would only buy this banner the
//      wrong noun in nine languages instead of one.
//   2. It says "someone on your team" when it cannot name the editor. On a
//      note there is nobody else it could be. Only the author can write one —
//      lib/sales/notes/visibility.js's canWriteNote — and a superadmin reading
//      the platform screen has no write path at all. So the conflict is always
//      the same person on another device, and telling them a colleague did it
//      would be a confidently-stated falsehood about a stranger.
//
// It reads the same `conflict` shape, produced by noteConflictBody() in
// lib/sales/notes/write.js and detected by readStaleConflict() — so the
// mechanism is shared even though the sentence is not.
//
// ══ The two controls, and the one deliberately absent ══════════════════════
//
//   "Keep what I typed"  re-submits against the version the server just named.
//                        Still GUARDED — a third save conflicts again rather
//                        than forcing. There is no unguarded overwrite here.
//   "Load the saved one" replaces the editor's contents with what is stored.
//                        Destructive to what is on screen, so it says so.
//
// No merge, and no field-by-field diff. A note is one block of prose; a merge
// that silently picks a winner per paragraph is the same data loss with more
// steps. Same conclusion docs/construction/AUDIT-realtime-hosting.md §8 reaches
// for the quote.

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object}   props
 * @param {object}   props.conflict   from readStaleConflict()
 * @param {Function} props.onKeepMine re-run the save against currentUpdatedAt
 * @param {Function} props.onLoadSaved discard what is on screen and reload
 * @param {boolean}  [props.busy]
 */
export default function RepNoteConflict({ conflict, onKeepMine, onLoadSaved, busy }) {
  const { t } = useTranslation();

  if (!conflict) return null;

  return (
    <div
      className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 sm:p-4"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t("app.salesNotes.conflictHeadline")}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {t("app.salesNotes.conflictExplain")}{" "}
            {/* The sentence that stops the panic, and it is only true because
                nothing below resets the textarea. Kept whole in one key: it is
                the promise, and a promise assembled from clauses is the one
                that comes out wrong in the ninth language. */}
            <span className="font-medium">{t("app.salesNotes.conflictNothingLost")}</span>
          </p>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onKeepMine}
              disabled={busy}
              className="min-h-[44px] px-3 rounded-md bg-amber-700 dark:bg-amber-600 text-white text-sm font-medium disabled:opacity-60"
            >
              {busy ? t("app.salesNotes.saving") : t("app.salesNotes.conflictKeepMine")}
            </button>
            <button
              type="button"
              onClick={onLoadSaved}
              disabled={busy}
              className="min-h-[44px] px-3 rounded-md border border-amber-400 dark:border-amber-700 text-sm font-medium text-amber-900 dark:text-amber-100 disabled:opacity-60"
            >
              {t("app.salesNotes.conflictLoadSaved")}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            {/* The English stays here as the fallback on purpose:
                scripts/check-rep-notes.mjs proves the destructive control says
                it is destructive by reading this line, and a bare key would
                leave that guard matching nothing. */}
            {t(
              "app.salesNotes.conflictLoadSavedWarning",
              "Loading the saved one replaces what is on screen.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
