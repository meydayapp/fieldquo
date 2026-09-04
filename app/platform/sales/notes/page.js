// app/platform/sales/notes/page.js
//
// The sales team's notes, read by a superadmin.
//
// ══ This is a surveillance surface, and it says so ═════════════════════════
//
// PLATFORM_NOTICE is rendered at the top rather than kept in a code comment,
// and it says four things on purpose: that reps are told, that nothing here
// can edit or delete, that superadmins see all reps, and that there is no
// manager tier. Somebody arriving at this screen expecting to filter to
// "my reps" should find out why they cannot from the screen, not from a
// support ticket.
//
// The fourth sentence changed on 2026-09-03 and the mechanism that changed it
// is worth keeping: `SalesRep.managerId` landed, so HAS_REPORTING_LINE flipped
// to true, and scripts/check-rep-notes.mjs — which asserts that constant equals
// what the schema actually says — failed until this screen's sentence was
// rewritten to the new truth. The reason it is now TWO constants is that the
// column existing and the tier working are different claims: MANAGER_TIER_LIVE
// is what gates the sentence, and it is still false, because nothing fills the
// column in and no screen sets it.
//
// ══ Read-only, and there are no write controls to hide ═════════════════════
//
// No edit field, no delete button, no archive. The API has no write handler
// either (app/api/platform/sales/notes/route.js) — hiding a button is not
// access control, and the honest version is that the capability does not
// exist.
//
// ══ English ════════════════════════════════════════════════════════════════
//
// Zero of the /platform pages use i18n; the console is English-only by
// convention. Adding t() to one screen would be inconsistent, not correct —
// the same finding docs/sales-intel/STATUS.md records from the rule consoles.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, NotebookPen } from "lucide-react";
import { displayTitle } from "@/lib/sales/notes/body";
import { describeParent } from "@/lib/sales/notes/parents";
import {
  PLATFORM_NOTICE,
  HAS_REPORTING_LINE,
  MANAGER_TIER_LIVE,
} from "@/lib/sales/notes/visibility";
import { RETENTION } from "@/lib/sales/notes/model";
import RepNoteUnavailable from "@/app/components/sales/RepNoteUnavailable";

export default function PlatformSalesNotesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [repId, setRepId] = useState("");
  const [open, setOpen] = useState(null);
  const [openError, setOpenError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setUnavailable("");
    const params = new URLSearchParams();
    if (repId) params.set("repId", repId);
    let res;
    try {
      res = await fetch(`/api/platform/sales/notes?${params}`);
    } catch {
      setError("Couldn't reach the server.");
      setData(null);
      return;
    }
    const payload = await res.json().catch(() => null);
    if (res.status === 503 && payload?.code === "notes_model_missing") {
      setUnavailable(payload.error);
      setData(null);
      return;
    }
    if (!res.ok) {
      setError(payload?.error || `Couldn't load notes (${res.status}).`);
      setData(null);
      return;
    }
    setData(payload);
  }, [repId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openNote(id) {
    setOpenError("");
    // The listing truncates — LIST_BODY_PREVIEW — so opening one is a real
    // request rather than expanding what is already on the page. A screen that
    // silently showed 200 characters as if they were the note would be the
    // quietest kind of wrong.
    let res;
    try {
      res = await fetch(`/api/platform/sales/notes/${id}`);
    } catch {
      setOpenError("Couldn't reach the server.");
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setOpenError(payload?.error || `Couldn't open that note (${res.status}).`);
      return;
    }
    setOpen(payload.note);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <NotebookPen size={18} className="text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold text-foreground">Sales notes</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 sm:p-4 text-sm">
        <div className="flex items-start gap-2">
          <Eye size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{PLATFORM_NOTICE.headline}</p>
            <p className="mt-1 text-muted-foreground">{PLATFORM_NOTICE.detail}</p>
            {!MANAGER_TIER_LIVE && (
              <p className="mt-2 text-muted-foreground">
                {HAS_REPORTING_LINE
                  ? "SalesRep has a reporting line now, but there is still no screen to set one, so every rep's manager is empty. Scoping this to a manager's own reps would show an empty team, so it stays superadmin-only until the org chart can be edited."
                  : "To scope this to a manager's own reps, SalesRep needs a reporting line and a screen to set it. Neither exists — that is a product decision, not a missing query."}
              </p>
            )}
            {!RETENTION.applied && (
              <p className="mt-2 text-muted-foreground">{RETENTION.statement}</p>
            )}
          </div>
        </div>
      </div>

      {unavailable && <RepNoteUnavailable detail={unavailable} />}

      {error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-2">
          <label htmlFor="rep-filter" className="block text-sm font-medium text-foreground">
            Rep
          </label>
          <select
            id="rep-filter"
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            className="w-full sm:max-w-sm min-h-[44px] px-3 rounded-md border border-border bg-card text-foreground"
          >
            <option value="">Everyone</option>
            {data.reps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {/* The count is on the option because "this rep writes
                    nothing" is one of the answers this screen is for, and a
                    rep with no notes would otherwise be indistinguishable from
                    a filter that failed. */}
                {rep.name} — {data.counts[rep.id] || 0}
                {rep.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {data?.notes?.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes.</p>
      )}

      {openError && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">
          {openError}
        </p>
      )}

      <ul className="space-y-2">
        {(data?.notes || []).map((note) => {
          const parent = describeParent(note);
          const isOpen = open?.id === note.id;
          return (
            <li key={note.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <p className="font-medium text-foreground break-words">{displayTitle(note)}</p>
              <p className="mt-1 text-xs text-muted-foreground break-words">
                {note.salesRep?.name || "Unknown rep"} · {parent.text} ·{" "}
                {new Date(note.updatedAt).toLocaleString()}
              </p>

              {isOpen ? (
                // whitespace-pre-wrap, not a markdown renderer: the body is
                // plain text (bodyFormat "text") and rendering it as anything
                // else would put formatting in a rep's note that the rep never
                // wrote.
                <p className="mt-3 text-sm text-foreground whitespace-pre-wrap break-words">
                  {open.body || "Empty"}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground break-words">
                    {note.body ? `${note.body.slice(0, 160)}${note.bodyTruncated ? "…" : ""}` : "Empty"}
                  </p>
                  <button
                    type="button"
                    onClick={() => openNote(note.id)}
                    className="mt-2 min-h-[44px] px-3 inline-flex items-center rounded-md border border-border text-sm font-medium text-foreground"
                  >
                    Read it
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
