// app/sales/notes/[id]/page.js
//
// One note, open.
//
// ══ `params` is a Promise ══════════════════════════════════════════════════
//
// Next 16, on a client component too — React's `use()` unwraps it. AGENTS.md
// failure class #3, and the reason `use` is imported from react rather than
// the id being read synchronously.
//
// ══ The visibility notice is above the editor, not below it ════════════════
//
// A rep should read who can see this BEFORE they type, not after. It is the
// same component the index renders, so the statement cannot appear on one
// screen and not the other — see RepNoteVisibilityNotice's own header.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { describeParent } from "@/lib/sales/notes/parents";
import RepNoteEditor from "@/app/components/sales/RepNoteEditor";
import RepNoteVisibilityNotice from "@/app/components/sales/RepNoteVisibilityNotice";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";

export default function SalesNotePage({ params }) {
  const { id } = use(params);

  const [note, setNote] = useState(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setUnavailable("");
    let res;
    try {
      res = await fetch(`/api/sales/notes/${id}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (res.status === 503 && payload?.code === "notes_model_missing") {
      setUnavailable(payload.error);
      return;
    }
    if (!res.ok) {
      // A 404 here is also what a colleague's note id produces — see the GET
      // handler's own comment on why the two answers are the same.
      setError(payload?.error || `Couldn't open that note (${res.status}).`);
      return;
    }
    setNote(payload.note);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setArchived(archived) {
    setBusy(true);
    setError("");
    let res;
    try {
      res = await fetch(`/api/sales/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // No expectedUpdatedAt: archiving is not an overwrite of anybody's
        // prose. Guarding it would refuse the archive because the editor
        // autosaved a second ago, which is a conflict about nothing.
        body: JSON.stringify({ archived }),
      });
    } catch {
      setBusy(false);
      setError("Couldn't reach the server. Nothing was changed.");
      return;
    }
    const payload = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error || `Couldn't ${archived ? "archive" : "restore"} it (${res.status}).`);
      return;
    }
    setNote((prev) => (prev ? { ...prev, archivedAt: payload.note.archivedAt } : prev));
  }

  const parent = note ? describeParent(note) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <Link
        href="/sales/notes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground min-h-[44px]"
      >
        <ArrowLeft size={16} />
        All notes
      </Link>

      <RepNoteVisibilityNotice showEditorNote />

      {unavailable && <RepNoteUnavailable detail={unavailable} />}

      {error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}

      {!unavailable && !error && !note && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {note && (
        <>
          {/* What the note is about — including "the lead it was about is
              gone", which describeParent states rather than silently turning
              into a scratchpad. */}
          <p className="text-sm text-muted-foreground break-words">{parent.text}</p>

          {note.archivedAt ? (
            <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
              Archived. It is still here and still readable — archiving is not a delete.
            </p>
          ) : null}

          <RepNoteEditor
            note={note}
            onSaved={(fresh) => setNote((prev) => ({ ...prev, ...fresh }))}
          />

          <button
            type="button"
            onClick={() => setArchived(!note.archivedAt)}
            disabled={busy}
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground disabled:opacity-60"
          >
            {note.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {note.archivedAt ? "Restore" : "Archive"}
          </button>
        </>
      )}
    </div>
  );
}
