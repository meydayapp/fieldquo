// lib/voice/callDuration.js
//
// How long a call was, according to the provider — or an honest "we don't know".
//
// Lifted out of lib/voice/reconcileCalls.js, which still re-exports it so every
// existing importer is unchanged. It moved because a SECOND reader appeared:
// lib/platform/salesCall.js records FieldQuo's own sales calls, and it had its
// own `Number(...) || 0`, which is the exact fallback the comment below spends a
// paragraph refusing. Two derivations of one fact is how one of them ends up
// wrong, and it was the copy nobody looked at.
//
// It does not import the database, Retell, or anything else: a call object in,
// a number or null out, so both readers and every check script can execute it.

/**
 * A call's length in seconds, or NULL when we genuinely do not know.
 *
 * Null is the whole point of this function. Every tempting fallback here is a
 * fabricated charge on somebody's prepaid balance:
 *
 *   `|| 0`        bills nothing for a call that may have run twenty minutes,
 *                 and closes the case so nobody ever looks at it again.
 *   an average    invents a number and puts it on a statement that says
 *                 "where did my credit go".
 *   `Number(x)`   carries Infinity straight through — a JSON body containing
 *                 1e400 parses to exactly that, and Math.ceil(Infinity/60)
 *                 times the rate is an unbounded debit.
 *
 * `duration_ms` is preferred because it is what Retell bills on. The timestamp
 * derivation is a fallback for rows where the field is absent, and it is only
 * trusted when BOTH endpoints are finite and the end is not before the start —
 * a clock that went backwards is not a negative call.
 *
 * `duration_seconds` is accepted LAST and only from a webhook payload that
 * carries it. It is not on the list-calls shape and the reconciler has never
 * seen one; the sales-call webhook reader has always read it, so dropping it
 * here would quietly shorten a fact that path already had.
 */
export function durationSecondsOf(call) {
  const ms = Number(call?.duration_ms);
  if (Number.isFinite(ms) && ms >= 0) return Math.round(ms / 1000);

  const start = Number(call?.start_timestamp);
  const end = Number(call?.end_timestamp);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return Math.round((end - start) / 1000);
  }

  const secs = Number(call?.duration_seconds);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs);

  return null;
}
