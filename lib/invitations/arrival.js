// lib/invitations/arrival.js
//
// What /accept-invitation is looking at, decided once and in the open.
//
// ── Why this is a module and not four `if`s in the page ────────────────────
//
// The page used to do this:
//
//     fetch(`/api/invitations/${id}`).then((r) => r.json())
//
// No `r.ok`, no `.catch`. A 404 happens to answer in JSON so it worked; a 500
// answers with an HTML error page, `r.json()` threw, the rejection escaped the
// effect, `setLoading(false)` never ran, and the front door for every employee
// after the first one sat on "Loading…" until they gave up. AGENTS.md warns
// that Neon scales to zero and the first connection after idle can fail with
// P1001 — that is not a hypothetical 500, it is the ordinary morning one.
//
// "We asked and the answer is no" and "we could not ask" are opposite
// instructions to the person reading the screen, and they were the same code
// path. Pulling the decision out here makes the whole matrix executable:
// scripts/check-auth-front-door.mjs runs every shape a fetch can come back as,
// rather than a regex agreeing with the source about what it probably does.
//
// Nothing in here touches the network, React or the database. Given a
// response, it names a screen.

/**
 * The invitation statuses that may still be accepted.
 *
 * Imported by BOTH app/accept-invitation/[id]/page.js and
 * app/api/invitations/[id]/accept/route.js, so the screen and the gate cannot
 * drift. The page previously tested only for "canceled" while the route
 * admitted exactly this pair — so any other status rendered a full sign-up
 * form that the route was always going to refuse.
 *
 * "accepted" is here on purpose: the accept route is re-runnable for somebody
 * who already joined (the email match has already proved it is the same
 * person), which is what makes a bookmarked invitation link harmless rather
 * than a 403.
 */
export const ACCEPTABLE_INVITATION_STATUSES = ["pending", "accepted"];

/**
 * Which screen a load of GET /api/invitations/:id lands on.
 *
 * @param res  `{ ok, status, body }` — or null/undefined when the fetch itself
 *             never resolved. `body` is null when the response was not JSON,
 *             which is what an HTML 500 page is.
 *
 * @returns "notFound"    — the server answered, and there is no such invite.
 *          "unavailable" — we could not get an answer. The link is probably
 *                          fine; the only useful control is "try again".
 *          "ready"       — `res.body` is an invitation to work with.
 */
export function inviteArrival(res) {
  if (!res) return "unavailable";

  // 404 is the ONE refusal that is about the link rather than about us, so it
  // is tested before `ok` — everything else that isn't ok is our problem, and
  // saying "this invitation doesn't exist" to somebody holding a good link is
  // the mistake that loses the employee.
  if (res.status === 404) return "notFound";

  if (!res.ok) return "unavailable";
  // An `error` key in a 200 body is the shape the route used to answer with
  // and may again; treated as "we could not get a usable answer" rather than
  // silently rendering a form over an object with no email in it.
  if (!res.body || res.body.error) return "unavailable";

  return "ready";
}

/**
 * Whether a loaded invitation can still be used, and if not, why.
 *
 * Expiry is checked BEFORE status: an expired invitation is still "pending",
 * and "this expired" is the more useful of the two sentences — it tells them
 * the link was real and that a new one will work.
 *
 * @param invite  the body from GET /api/invitations/:id.
 * @returns "usable" | "expired" | "cancelled"
 */
export function inviteUsability(invite) {
  if (!invite) return "cancelled";

  const status = String(invite.status || "").toLowerCase();
  if (!ACCEPTABLE_INVITATION_STATUSES.includes(status)) return "cancelled";

  // Boolean(), not a truthiness test on a date string: the API sends a
  // computed boolean, and a missing one must read as "not expired" rather than
  // sending somebody who has a perfectly good link to ask for another.
  if (invite.expired === true) return "expired";

  return "usable";
}
