// scripts/fixtures/currentMemberStub.mjs
//
// A scriptable stand-in for lib/currentMember.js's getCurrentMember, so a
// check can execute a route BOTH ways round: as the world, and as a signed-in
// member of a named company.
//
// ── Why a stub and not a real session ───────────────────────────────────────
//
// getCurrentMember resolves a Better Auth session out of the request's
// cookies. Minting one offline would mean standing up Better Auth against a
// database, and the check would then be testing Better Auth. The thing worth
// testing is what the ROUTE does with the answer — "a member of another
// company gets the same not-found a stranger gets" — and that is a property of
// the route, reachable only if the answer can be varied.
//
// What this deliberately does NOT do is let a check pretend the gates inside
// getCurrentMember passed. It returns exactly what that function returns on
// success (a resolved member) or on failure (null); the impersonation,
// feature, billing and active-seat gates all live upstream of the value, and a
// check that scripts a member is asserting about what happens AFTER they pass,
// never that they did.

/** The member the next getCurrentMember call will resolve. null = nobody. */
let current = null;

/** Every call made, so a check can assert the route asked at all. */
export const memberCalls = [];

export function setCurrentMember(member) {
  current = member;
}

export function resetCurrentMemberStub() {
  current = null;
  memberCalls.length = 0;
}

export async function getCurrentMember(requestLike, opts = {}) {
  memberCalls.push({ opts, hasHeaders: Boolean(requestLike?.headers) });
  return current;
}
