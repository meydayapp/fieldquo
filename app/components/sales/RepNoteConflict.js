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
//      app.staleWrite.* — and the sales portal's outreach screens are
//      English-only (docs/sales-intel/STATUS.md records this), so half its
//      sentence would land in a catalogue this surface does not use.
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

/**
 * @param {object}   props
 * @param {object}   props.conflict   from readStaleConflict()
 * @param {Function} props.onKeepMine re-run the save against currentUpdatedAt
 * @param {Function} props.onLoadSaved discard what is on screen and reload
 * @param {boolean}  [props.busy]
 */
export default function RepNoteConflict({ conflict, onKeepMine, onLoadSaved, busy }) {
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
            This note changed somewhere else
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            You saved it from another tab, or your phone, after opening it here.
            Saving now would overwrite that.{" "}
            {/* The sentence that stops the panic, and it is only true because
                nothing below resets the textarea. */}
            <span className="font-medium">Nothing you typed is lost — it is still on screen.</span>
          </p>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onKeepMine}
              disabled={busy}
              className="min-h-[44px] px-3 rounded-md bg-amber-700 dark:bg-amber-600 text-white text-sm font-medium disabled:opacity-60"
            >
              {busy ? "Saving…" : "Keep what I typed"}
            </button>
            <button
              type="button"
              onClick={onLoadSaved}
              disabled={busy}
              className="min-h-[44px] px-3 rounded-md border border-amber-400 dark:border-amber-700 text-sm font-medium text-amber-900 dark:text-amber-100 disabled:opacity-60"
            >
              Load the saved one instead
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            Loading the saved one replaces what is on screen.
          </p>
        </div>
      </div>
    </div>
  );
}
