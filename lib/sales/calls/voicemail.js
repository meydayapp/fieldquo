// lib/sales/calls/voicemail.js
//
// Whose voicemail is it, and how does anybody hear it?
//
// ══ Two faults this file exists to fix ════════════════════════════════════
//
// 1. NOBODY WHO WANTS THE MESSAGE COULD REACH IT. A recording is written to
//    SalesCallAttempt.voicemailUrl, and the only screen that played it was
//    /platform/sales/floor — the SUPERADMIN board. A contractor rings the
//    number a rep gave them, leaves a message for that rep, and the rep cannot
//    hear it. The owner put it plainly: "It seems kinda illogical."
//
// 2. THE URL WAS THE PROVIDER'S. `voicemailUrl` holds Twilio's own
//    RecordingUrl and the floor board put it straight into <audio src>. This
//    repository already knows not to: lib/voice/recording.js's
//    callRecordingHref() serves a TENANT recording through
//    /api/voice/calls/{id}/recording instead, and its header explains why —
//    a provider URL carries no FieldQuo permission and hands a hundred
//    callers' voices to whoever holds the link.
//
//    Proxying is right whichever way Twilio's account setting falls. If the
//    media is public, the raw link is an unauthenticated recording of a
//    stranger's voice. If it is not, the audio tag simply fails and the board
//    has been showing a player that never played. Both are fixed by the same
//    route, so nothing here depends on resolving which one it was.
//
// ══ Who owns a message ════════════════════════════════════════════════════
//
// Two rules, and the second is the one that matters:
//
//   · the attempt is already attributed to the rep (`salesRepId`), OR
//   · it was left on a number ASSIGNED to that rep.
//
// The second rule carries the case the first cannot. Inbound attribution comes
// from matching the caller, and a contractor ringing from a mobile we have
// never seen matches nobody — `salesRepId` is null. The message is still for
// the rep whose number they rang, and dropping it because we could not
// identify the caller would lose exactly the callbacks worth having.
//
// Pure over rows the caller has already read.

/** A recording exists only when there is somewhere to fetch it from. */
export function hasRecording(attempt = {}) {
  return Boolean(attempt && typeof attempt.voicemailUrl === "string" && attempt.voicemailUrl.trim());
}

/**
 * The in-app URL that plays a message.
 *
 * Never the provider's. Mirrors lib/voice/recording.js's callRecordingHref so
 * the two recording paths in this product are shaped the same way.
 */
export function voicemailHref(attemptId) {
  const id = String(attemptId ?? "").trim();
  return id ? `/api/sales/voicemail/${encodeURIComponent(id)}/audio` : null;
}

/**
 * The database filter for one rep's messages.
 *
 * Returned as a `where` rather than applied here so the caller can add its own
 * scoping and the check can assert the shape without a database. `ourNumbers`
 * is the list of numbers assigned to this rep — read by the caller, because
 * this file stays synchronous.
 */
export function voicemailWhere({ salesRepId, ourNumbers = [] } = {}) {
  const mine = (Array.isArray(ourNumbers) ? ourNumbers : []).filter(
    (n) => typeof n === "string" && n.trim(),
  );
  const or = [{ salesRepId: salesRepId || "__none__" }];
  // Only added when the rep actually has a number. An empty `in` matches
  // nothing in Postgres, but writing the clause anyway invites somebody to
  // "fix" it later into a clause that matches everything.
  // The column is `fromE164`, not `ourE164`. On an INBOUND attempt the caller
  // is in `toE164` and OUR number is in `fromE164` — recordInbound writes them
  // that way and the floor board reads them that way. `ourE164` is the name
  // this module uses for the idea, and it exists nowhere in the schema, so the
  // clause below threw for any rep who actually had a number assigned. It
  // failed exactly for the reps the feature was built for, and silently for
  // everyone else, because a rep with no number never reached this branch.
  if (mine.length) or.push({ fromE164: { in: mine } });

  return {
    voicemailUrl: { not: null },
    direction: "in",
    OR: or,
  };
}

/**
 * Does this rep own this message? Re-checked in the route that serves audio.
 *
 * The list query and the audio route must agree, and the audio route must not
 * trust that the id came from the list — an attempt id in a URL is a guess
 * anybody can make.
 */
export function ownsVoicemail(attempt, { salesRepId, ourNumbers = [] } = {}) {
  if (!attempt || !hasRecording(attempt)) return false;
  if (attempt.direction !== "in") return false;
  if (salesRepId && attempt.salesRepId === salesRepId) return true;
  const mine = new Set((Array.isArray(ourNumbers) ? ourNumbers : []).filter(Boolean));
  return Boolean(attempt.ourE164 && mine.has(attempt.ourE164));
}

/**
 * One row, shaped for the screen.
 *
 * `seconds` of ZERO is kept apart from null, the same distinction the floor
 * board already draws: null means no recording stage ran, zero means one did
 * and nobody spoke — a caller who heard the beep and thought better of it.
 * Warmer than a missed call, colder than a message, and collapsing the two
 * loses the difference.
 */
export function voicemailView(attempt = {}) {
  const seconds = Number.isFinite(attempt.voicemailSeconds) ? attempt.voicemailSeconds : null;
  return {
    id: attempt.id,
    audioHref: voicemailHref(attempt.id),
    fromE164: attempt.contactE164 || attempt.toE164 || null,
    ourE164: attempt.ourE164 || attempt.fromE164 || null,
    leftAt: attempt.dialledAt || null,
    seconds,
    silent: seconds === 0,
    prospectId: attempt.prospectId || null,
    leadId: attempt.leadId || null,
    businessName: attempt.prospect?.businessName || attempt.lead?.businessName || null,
    // Where to go to act on it. Null when the caller matched nothing, which is
    // itself worth showing — an unmatched message is a business we do not have.
    href: attempt.leadId
      ? `/sales/leads/${attempt.leadId}`
      : attempt.prospectId
        ? `/sales/queue?prospectId=${encodeURIComponent(attempt.prospectId)}`
        : null,
    matchedBy: attempt.matchedBy || null,
  };
}
