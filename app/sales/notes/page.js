// app/sales/notes/page.js
//
// A rep's notes. Their own, and nobody else's.
//
// ══ The list is scoped server-side ═════════════════════════════════════════
//
// Same shape app/sales/leads/page.js has and for the same reason: this screen
// has no notion of "whose" notes these are and cannot ask for another rep's. A
// UI that could request them and merely doesn't is one query-string edit away
// from a leak.
//
// ══ Mobile first, because this is the screen the standing rule is about ════
//
// A rep opens this standing in a car park between calls. One column, cards not
// rows, 44px targets, and "New note" is the first thing under the thumb rather
// than a toolbar button in a corner.
//
// ══ Translated, like the rest of the portal ════════════════════════════════
//
// This screen used to be English on purpose: docs/sales-intel/STATUS.md
// recorded that the outreach screens were English-only while the shell was
// translated, and one translated screen beside eight English ones is a worse
// inconsistency than an even one. That argument expired when the whole /sales
// surface was keyed — the even state is now the translated one, so the
// exception went with it.
//
// What is still English is what this screen does not write: a server-composed
// error, and a note's own text. Neither is copy.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, NotebookPen, Archive } from "lucide-react";
import { displayTitle } from "@/lib/sales/notes/body";
// parentSentence lives beside describeParent now. Both screens held a copy
// of it, both said in a comment that it belonged in the lib file "where
// describeParent would take `t` instead of composing English", and that is
// what it does — so there is one sentence again instead of two that have to
// be kept in step.
import { describeParent, parentSentence } from "@/lib/sales/notes/parents";
import { useTranslation } from "@/app/hooks/useTranslation";
import RepNoteVisibilityNotice from "@/app/components/sales/RepNoteVisibilityNotice";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";

export default function SalesNotesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setUnavailable("");
    let res;
    try {
      res = await fetch(`/api/sales/notes?archived=${showArchived ? "1" : "0"}`);
    } catch {
      setError(t("app.salesNotes.serverUnreachable"));
      setData(null);
      return;
    }
    // Never `if (res.ok)` with no else — AGENTS.md failure class #2. The 503
    // gets its own branch because "the table isn't there" and "something went
    // wrong" need different sentences and different screens.
    const payload = await res.json().catch(() => null);
    if (res.status === 503 && payload?.code === "notes_model_missing") {
      setUnavailable(payload.error);
      setData(null);
      return;
    }
    if (!res.ok) {
      setError(payload?.error || t("app.salesNotes.notesLoadFailed", { status: res.status }));
      setData(null);
      return;
    }
    setData(payload);
    // `t` changes only when the rep changes language, so it does not re-fetch
    // on every render — but it is read in here, so it is declared.
  }, [showArchived, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function newNote() {
    setCreating(true);
    setError("");
    let res;
    try {
      // Created empty and opened. The alternative — a form, then a save, then
      // a redirect — puts three steps between "I need to write this down" and
      // a cursor, which on a phone between calls is where note-taking dies.
      res = await fetch("/api/sales/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", body: "" }),
      });
    } catch {
      setCreating(false);
      setError(t("app.salesNotes.serverUnreachable"));
      return;
    }
    const payload = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      setError(payload?.error || t("app.salesNotes.noteCreateFailed", { status: res.status }));
      return;
    }
    router.push(`/sales/notes/${payload.note.id}`);
  }

  return (
    // No max-w/px/py wrapper: SalesShell's <main> already applies exactly this
    // one, so these two notes screens were inset twice — 32px of side padding
    // on a 375px phone where every other screen in the portal has 16, and a
    // measurably narrower column than the leads screen beside it. The other
    // seven pages return a bare spacing div; these now match.
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <NotebookPen size={18} className="text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold text-foreground">{t("app.salesNotes.notesHeading")}</h1>
      </div>

      <RepNoteVisibilityNotice />

      {unavailable && (
        // The code as well as the sentence: the panel keys the refusal off the
        // code so a rep reads it in their own language, and falls back to the
        // server's English when the catalogue has not got that key.
        <RepNoteUnavailable detail={unavailable} code="notes_model_missing" />
      )}

      {error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}

      {/* The button exists only when there is somewhere to save. */}
      {!unavailable && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={newNote}
            disabled={creating}
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-60"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t("app.salesNotes.newNote")}
          </button>

          {/* Rendered only when there is something behind it. A filter that
              always shows and always returns nothing is a control that appears
              to work. */}
          {data?.archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground"
            >
              <Archive size={16} />
              {showArchived
                ? t("app.salesNotes.showCurrent")
                : t("app.salesNotes.showArchived", { count: data.archivedCount })}
            </button>
          )}
        </div>
      )}

      {!unavailable && !error && !data && (
        <p className="text-sm text-muted-foreground">{t("app.salesNotes.loading")}</p>
      )}

      {data?.notes?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {showArchived
            ? t("app.salesNotes.nothingArchived")
            : t("app.salesNotes.notesEmpty")}
        </p>
      )}

      <ul className="space-y-2">
        {(data?.notes || []).map((note) => {
          const parent = describeParent(note);
          // displayTitle() answers with the rep's OWN words, except in the one
          // case where there are none — no title and no body — where its
          // answer is copy rather than data. That case, and only that case, is
          // keyed: a title a rep typed is never translated.
          const untitled = !(note.title || "").trim() && !(note.body || "").trim();
          return (
            <li key={note.id}>
              <Link
                href={`/sales/notes/${note.id}`}
                className="block rounded-lg border border-border bg-card p-3 sm:p-4"
              >
                <p className="font-medium text-foreground break-words">
                  {untitled ? t("app.salesNotes.untitledNote") : displayTitle(note)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground break-words">
                  {/* The preview, not the note. The list carries 200
                      characters — see LIST_BODY_PREVIEW. */}
                  {note.body
                    ? `${note.body.split("\n")[0].slice(0, 120)}${note.bodyTruncated ? "…" : ""}`
                    : t("app.salesNotes.noteBodyEmpty")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground break-words">
                  {parentSentence(t, parent)} · {new Date(note.updatedAt).toLocaleString()}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
