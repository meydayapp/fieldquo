// lib/sales/notes/write.js
//
// The one function that saves a note, and the only place the guard is spelled.
//
// ══ Why autosave needs this more than a Save button does ═══════════════════
//
// The brief's sentence for it is exact: autosave without a conflict check is a
// faster way to overwrite a colleague. A Save button fires when somebody
// decides to; autosave fires every second and a half, from every tab that has
// the note open, forever. A rep with the note open on a laptop and a phone —
// which is the normal state for somebody working out of a van — has two
// writers racing, and last-write-wins means the phone's stale copy silently
// erases what they typed on the laptop.
//
// So the guard is not optional here the way it is on the 96 unguarded PATCH
// routes: this screen ALWAYS sends `expectedUpdatedAt`, and
// scripts/check-rep-notes.mjs asserts the client does.
//
// ══ The guard goes in the WHERE ════════════════════════════════════════════
//
// Not in an `if` above the write. lib/concurrency/staleWrite.js's header
// explains why at length — an `if` leaves a window between reading and
// writing, and the whole point is that there is no window. versionWhere() is
// spread into the same `where` as the id, and Prisma raises P2025 when nothing
// matches, which IS the refusal.
//
// ══ salesRepId is in the WHERE for a second reason ═════════════════════════
//
// It is the ownership check, and putting it in the write rather than in a
// preceding `findUnique` means a rep cannot patch a colleague's note even in
// the microsecond between the two. The rejection it produces is a 404, not a
// 403: "there is no such note of yours" is the truthful answer AND the one
// that does not confirm the note exists.

import {
  parseExpectedVersion,
  runGuardedWrite,
  versionWhere,
  STALE_WRITE_CODE,
} from "@/lib/concurrency/staleWrite";
import { REP_NOTE_MODEL } from "./model";
import { NOTE_DETAIL_SELECT } from "./select";

export { parseExpectedVersion, STALE_WRITE_CODE };

/**
 * Update one note, guarded on both ownership and version.
 *
 * @param {object}   client   a Prisma client, passed in so the check can run
 *                            this exact function against a double.
 * @param {object}   o
 * @param {string}   o.noteId
 * @param {string}   o.salesRepId  from the gate's fresh session read, NEVER
 *                                 from the request body.
 * @param {Date|null} o.expected   from parseExpectedVersion; null = unguarded
 * @param {object}   o.data        already sanitised
 *
 * @returns {{ok:true, note:object}}
 *        | {{ok:false, status:number, body:object}}
 */
export async function saveNote(client, { noteId, salesRepId, expected, data }) {
  const delegate = client[REP_NOTE_MODEL];

  const outcome = await runGuardedWrite({
    expected,
    write: () =>
      delegate.update({
        where: { id: noteId, salesRepId, ...versionWhere(expected) },
        data,
        select: NOTE_DETAIL_SELECT,
      }),
    // Scoped the same way. A note belonging to another rep must read as
    // absent here too, or the 404 above becomes a 409 that confirms it exists
    // and tells the caller when somebody else last touched it.
    readVersion: () =>
      delegate.findFirst({
        where: { id: noteId, salesRepId },
        select: { updatedAt: true },
      }),
  });

  if (outcome.ok) return { ok: true, note: outcome.result };

  if (outcome.reason === "gone") {
    return {
      ok: false,
      status: 404,
      body: { error: "That note no longer exists." },
    };
  }

  return { ok: false, status: 409, body: noteConflictBody(expected, outcome.currentUpdatedAt) };
}

/**
 * The 409 body, shaped so lib/concurrency/staleWriteClient.js's
 * readStaleConflict() picks it up unchanged.
 *
 * ── Why it never says "someone on your team" ──────────────────────────────
 *
 * It cannot be anyone else. canWriteNote() (lib/sales/notes/visibility.js)
 * lets only the author write, and a superadmin reading the platform screen has
 * no write path at all — so the only writer who can have moved this row is the
 * same rep, from another tab, phone or laptop.
 *
 * staleWriteBody() in lib/concurrency/staleWrite.js resolves the editor from a
 * RecordEdit row, and RecordEdit is keyed on `companyId` — which a rep note
 * does not have and must not be given one of. Rather than invent a tenant to
 * satisfy a lookup whose answer is already known, this states the known
 * answer: byYou, always, and honestly.
 */
export function noteConflictBody(expected, currentUpdatedAt) {
  return {
    error:
      "You saved this note somewhere else after opening it here — another tab, " +
      "or your phone. Saving now would overwrite that. Nothing you typed is lost.",
    code: STALE_WRITE_CODE,
    conflict: {
      entity: "salesRepNote",
      expectedUpdatedAt: expected ? expected.toISOString() : null,
      currentUpdatedAt: currentUpdatedAt.toISOString(),
      byName: null,
      byYou: true,
      knownEditor: true,
    },
  };
}
