// lib/tasks/completion.js
//
// Whether a to-do that requires photos and/or a comment is actually allowed
// to be marked done — and the one place that decides "yours to act on"
// applies to.
//
// ── Enforced where it can't be skipped ──────────────────────────────────────
//
// Every function here is pure: no db, no request, no session. That is
// deliberate — the enforcement has to run in app/api/tasks/[id]/route.js's
// PATCH handler, server-side, every time, or a "can't complete yet" is just
// decoration a browser DevTools console can route around. Being pure is also
// what makes it possible to execute these against hostile input the way
// AGENTS.md asks (see scripts/check-task-suggestions.mjs, which does the same
// for lib/tasks/suggestFromJob.js and now imports this file's exports too).
//
// completionGate() answers "is this to-do allowed to become done RIGHT NOW,
// given what's actually in the database" — never "was it allowed to become
// done a moment ago." That's why the caller passes live counts (a fresh
// db.jobPhoto.count) rather than a cached boolean: if the requirement is
// lowered after two of three photos are filed, the next completion attempt
// checks 2 against the NEW requirement and passes, honestly, with no separate
// code path for "requirement was reduced." The same live-check is why a
// required photo being deleted (there is no delete endpoint for JobPhoto
// anywhere in this codebase today, but Company deletion cascades and a future
// route might add one) can never leave a "done" to-do lying about what
// happened: an ALREADY-done to-do is not re-evaluated by this gate at all —
// PATCH only calls it when the request is trying to TRANSITION status to
// "done" — so a photo vanishing after the fact does not retroactively flip a
// completed to-do back to open. That's a deliberate choice, not an oversight:
// "done" is a historical record of what was true at the moment someone
// completed it, and silently rewriting history because evidence was removed
// later is a worse surprise than leaving the record as it was made.
export function completionGate(
  { requiredPhotoCount, requiresComment },
  { photoCount, completionComment },
) {
  const missing = [];

  const required = Math.max(0, Number(requiredPhotoCount) || 0);
  // Clamped at 0 — `db.jobPhoto.count()` can never be negative, but this
  // function is exercised directly against hostile input (see
  // scripts/check-task-suggestions.mjs), and a negative count sailing through
  // to `short = required - have` produced a message claiming MORE photos were
  // missing than were actually required ("Needs 7 more" against a requirement
  // of 2) — a real bug this file's own header claims to guard against, caught
  // by doing exactly what that header says.
  const have = Math.max(0, Number(photoCount) || 0);
  if (required > 0 && have < required) {
    const short = required - have;
    missing.push({
      code: "photos",
      message:
        short === required
          ? `Needs ${required} photo${required === 1 ? "" : "s"} before it can be marked done.`
          : `Needs ${short} more photo${short === 1 ? "" : "s"} before it can be marked done (${have} of ${required} attached).`,
    });
  }

  if (requiresComment && !String(completionComment || "").trim()) {
    missing.push({
      code: "comment",
      message: "Needs a comment before it can be marked done.",
    });
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Validates and normalises the `requiredPhotoCount` a caller sent (POST or
 * PATCH /api/tasks). Omitted, blank, null and 0 are all the same thing — "no
 * requirement" — and are normalised to a single stored shape (null) so
 * nothing downstream has to treat 0 and null as two different falsy cases.
 *
 * Capped at 20: a to-do that "requires" 200 photos is not a checklist, it's a
 * typo, and the cap is cheap insurance against fat-fingering a due-date field
 * into this one.
 *
 * @returns {{ ok: true, value: number|null } | { ok: false, error: string }}
 */
export function normaliseRequiredPhotoCount(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  // Only a number or a numeric string is a legitimate count. `Number(raw)`
  // alone doesn't stop there — JS unwraps a single-element array
  // (`Number([3]) === 3`) and coerces booleans (`Number(true) === 1`), so
  // `requiredPhotoCount: [3]` or `requiredPhotoCount: true` in a request body
  // would otherwise sail through as a valid count instead of being refused as
  // the malformed input it is.
  if (typeof raw !== "number" && typeof raw !== "string") {
    return {
      ok: false,
      error: "requiredPhotoCount must be a whole number from 0 to 20.",
    };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) {
    return {
      ok: false,
      error: "requiredPhotoCount must be a whole number from 0 to 20.",
    };
  }
  return { ok: true, value: n === 0 ? null : n };
}

/**
 * The ownership rule PATCH /api/tasks/[id] already enforced inline, pulled
 * out once it needed a second caller: POST /api/tasks/[id]/photos asks
 * exactly the same question ("may THIS member act on THIS to-do") before
 * letting a photo land against it, and a copy-pasted third copy of the same
 * three-line check is the duplication AGENTS.md names as a recurring failure
 * — the copy nobody looks at is the one that drifts from the original when
 * the rule changes.
 *
 * Deliberately NOT reused by DELETE /api/tasks/[id], whose predicate is
 * narrower on purpose (mine-or-task:create, no claimable) — see that route's
 * own comment for why claiming an unassigned to-do is not a reason to be
 * able to destroy it.
 *
 * @param member  a session member — needs `userId` and `role`.
 * @param task    needs `assignedToId` and `createdById`.
 */
export function canEditTask(member, task) {
  const mine =
    !!member?.userId &&
    (task?.assignedToId === member.userId || task?.createdById === member.userId);
  const claimable = task?.assignedToId === null;
  return mine || claimable;
}
