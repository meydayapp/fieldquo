// lib/apiMember.js
//
// getCurrentMember, with its refusals turned into real HTTP responses.
//
// ══ The problem this solves ════════════════════════════════════════════════
//
// getCurrentMember has three gates that THROW rather than return: the
// impersonation gate (403), the billing gate (402) and the feature gate
// (404/403). Throwing is right — it is what makes them impossible to forget —
// but a route handler that lets the throw escape gets a Next.js 500 with an
// empty body. So the carefully chosen status never reaches the browser:
//
//   * the billing 402 that exists specifically because "403 sends people to
//     their admin and 402 sends them to the billing screen" arrives as a 500,
//     which sends them to support;
//   * a HIDDEN feature answers 500 where an unknown path answers 404, and the
//     difference between those two is exactly the trace `hidden` promises not
//     to leave.
//
// Two lines at a call site fixes both:
//
//   const { member, response } = await memberOrRefusal(request);
//   if (response) return response;
//
// ══ Why not a per-route try/catch ══════════════════════════════════════════
//
// Because that is six lines copied thirty-five times, and the copy is the one
// that rots. One helper, one shape, one place to change when a fourth gate
// appears.
//
// ══ Why not every route, yet ═══════════════════════════════════════════════
//
// Every route SHOULD use this — the billing bug above is live on all of them.
// This change converts the routes the feature registry declares it gates,
// because those are the ones whose refusal is new and has to be right from the
// first deploy, and because scripts/check-feature-flags.mjs can then FAIL if one
// of them stops using it. Converting the other ~145 is a mechanical follow-up
// with no registry to keep it honest, so it is deliberately not bundled in here.
import { NextResponse } from "next/server";
// Aliased rather than relative so scripts/check-feature-flags.mjs can swap it
// for a stub and EXECUTE the refusal shaping below, instead of reading it.
import { getCurrentMember } from "@/lib/currentMember";

/**
 * @returns {{ member }} on success, or {{ response }} to return as-is.
 *
 * Anything without a numeric `status` is re-thrown untouched: a genuine bug must
 * stay a 500 and reach the error log, not be laundered into a tidy JSON refusal.
 */
export async function memberOrRefusal(request, opts) {
  let member;
  try {
    member = await getCurrentMember(request, opts);
  } catch (err) {
    if (typeof err?.status !== "number") throw err;
    return { response: refusalResponse(err) };
  }

  if (!member) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { member };
}

/**
 * The same decision, for the handful of routes whose handlers return a plain
 * `{ error, status }` object to their own wrapper instead of a NextResponse.
 */
export async function memberOrRefusalPlain(request, opts) {
  let member;
  try {
    member = await getCurrentMember(request, opts);
  } catch (err) {
    if (typeof err?.status !== "number") throw err;
    const body = refusalBody(err);
    return { refusal: { ...body, status: err.status } };
  }
  if (!member) return { refusal: { error: "Unauthorized", status: 401 } };
  return { member };
}

/**
 * The JSON body a refusal becomes. Exported so a check script can run it against
 * every gate's error rather than reason about it — the "does a hidden feature
 * name itself" assertion is only worth anything if it executes this function.
 */
export function refusalBody(err) {
  // A HIDDEN feature answers exactly what an unknown path answers, and nothing
  // else — no key, no label, no hint that a route was matched at all. The
  // feature key is on the error object for the server log and stops there.
  if (err.status === 404) return { error: "Not found" };

  const body = { error: err.message };
  // Carried through so the client can react the way it already does: the
  // billing banner reads `billing`, the read-only banner reads `readOnly`.
  if (err.billing) body.billing = err.billing;
  if (err.featureLocked) body.featureLocked = true;
  return body;
}

function refusalResponse(err) {
  return NextResponse.json(refusalBody(err), { status: err.status });
}
