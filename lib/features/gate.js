// lib/features/gate.js
//
// ONE guard. Every layer calls into this file and nothing re-derives the rule.
//
// ══ Where enforcement lives, and why it is not middleware ══════════════════
//
// middleware.js was the obvious home — it already fronts every /app page and
// every /api route, and its ordering comment explains why gates belong there.
// It cannot host this one. Middleware runs on the Edge runtime, and resolving a
// feature needs two Prisma reads through the `pg` Pool (lib/db.js), which does
// not exist there. Putting the lookup in middleware would mean either a second
// data path with its own connection story, or an HTTP round trip to our own API
// on every request. Both are worse than the thing they would replace.
//
// So enforcement sits in the two places that DO have a database and DO see
// every request, and it sits in both deliberately — the same reasoning that put
// the impersonation gate in middleware.js and again in lib/currentMember.js:
//
//   1. lib/currentMember.js  — the API layer. Every authenticated route handler
//      calls getCurrentMember(); attaching the gate there covers all ~167 of
//      them, including the ones written before this existed and the ones nobody
//      remembers to update. A per-route check is a check that gets forgotten.
//
//   2. app/components/FeatureGate.js — the page layer, mounted as a server
//      `layout.js` on each gated route prefix. Pages are React server components
//      with no Request object, so the API gate cannot see them. Without this a
//      bookmarked /app/receptionist would still render its shell and only fail
//      when its fetches came back — a page that looks alive and is not.
//
// Hiding the nav row is done too, but it is cosmetics, not access control. It
// is listed third here on purpose.
//
// ══ What happens to money when a feature is withdrawn ══════════════════════
//
// Only voice_receptionist spends at a vendor today. The rules, in order of how
// bad the alternative is:
//
//   * Nothing NEW is provisioned. A withdrawn feature must not buy a number.
//   * Nothing is RELEASED. Releasing a contractor's advertised business number
//     because FieldQuo flipped a switch is destroying an asset they cannot get
//     back — the "turning it off never deletes data" rule at its sharpest.
//   * Nothing is CHARGED. FieldQuo withdrew the feature; billing rent for a
//     month the contractor could not use it is taking money for nothing.
//   * Nothing is DIALLED. Outbound calls are FieldQuo-initiated spend and stop.
//   * Inbound calls still ANSWER and still bill. The minutes are already spent
//     by the time we hear about them; refusing the webhook would lose the record
//     and the ledger entry without saving a cent. See registry.js apiExempt.
//
// The consequence is that FieldQuo carries the vendor's monthly rental for any
// number belonging to a company whose voice feature it has withdrawn. That is
// the correct place for the cost to land: FieldQuo made the decision.
import { db } from "@/lib/db";
import {
  FEATURE_KEYS,
  featureEntry,
  featureForApiPath,
  isAvailable,
  isVisible,
  resolveFeature,
} from "./registry";

/**
 * Resolve every feature for one company, in two queries.
 *
 * Two, not 2N: the map is built for all keys at once because the nav needs the
 * whole set anyway, and a per-key lookup would put seven round trips on every
 * page render.
 *
 * Never throws. A features table that is unreachable must not take down the
 * back office — and the safe direction here is the registry defaults, i.e.
 * exactly the behaviour of the product before this file existed. Failing to
 * HIDDEN on a database hiccup would black out the whole app.
 */
export async function featureMapForCompany(companyId) {
  let globals = [];
  let overrides = [];

  try {
    [globals, overrides] = await Promise.all([
      db.platformFeature.findMany({ select: { key: true, state: true, note: true } }),
      companyId
        ? db.companyFeatureOverride.findMany({
            where: { companyId },
            select: { key: true, state: true, note: true },
          })
        : Promise.resolve([]),
    ]);
  } catch (err) {
    console.error("[features] couldn't read feature availability:", err?.message);
    globals = [];
    overrides = [];
  }

  // Coerced, not trusted. A findMany that returns null instead of [] — a stubbed
  // database in a check script, a Prisma client generated before these models
  // existed — must degrade to "nobody has said anything", not throw a TypeError
  // out of a function that ~167 routes depend on. Rows that are not objects with
  // a string key are dropped for the same reason.
  const usable = (rows) =>
    (Array.isArray(rows) ? rows : []).filter(
      (r) => r && typeof r === "object" && typeof r.key === "string",
    );

  const globalByKey = new Map(usable(globals).map((r) => [r.key, r]));
  const overrideByKey = new Map(usable(overrides).map((r) => [r.key, r]));

  const map = {};
  for (const key of FEATURE_KEYS) {
    map[key] = resolveFeature({
      key,
      // `get` returns undefined for "no row", which resolveFeature reads as
      // inherit. A row that exists with a nonsense state is a different thing
      // and fails closed there.
      overrideRow: overrideByKey.get(key),
      globalRow: globalByKey.get(key),
    });
  }
  return map;
}

/** One feature, resolved. Same rules, for callers that only need one. */
export async function featureStateFor(companyId, key) {
  const map = await featureMapForCompany(companyId);
  return map[key] || resolveFeature({ key });
}

/**
 * May this company's money be spent on this feature right now?
 *
 * For the paths with no member and no session: crons, provisioning, anything
 * that turns into a vendor charge. `preview` counts as yes — a beta tester
 * placing real calls is placing real calls.
 *
 * Fails OPEN on an unreadable database, like featureMapForCompany, and for the
 * same reason inverted: the caller of this function is usually about to decide
 * whether to keep a contractor's phone number alive.
 */
export async function featureAllowsSpend(companyId, key) {
  const resolved = await featureStateFor(companyId, key);
  return isAvailable(resolved.state);
}

/**
 * The API gate. Called by getCurrentMember on every authenticated request.
 *
 * Returns the member (possibly annotated) or throws an error carrying `status`,
 * which every route already surfaces the same way it surfaces the billing and
 * impersonation gates.
 *
 * ── What a HIDDEN feature is allowed to say ────────────────────────────────
 *
 * Nothing. A 403 reading "voice_receptionist is disabled" announces the
 * existence of the thing being hidden, and the point of `hidden` is that a
 * not-ready feature leaves no trace. So it is a plain 404 with the same body
 * any unknown path would produce, and the feature key appears only in the
 * server log. `locked` is the opposite case — it is meant to be seen — so it
 * answers 403 and says why.
 *
 * ── Support sessions are gated too ─────────────────────────────────────────
 *
 * An impersonating admin sees exactly what the customer sees, including the
 * absence of a withheld feature. Support answering "it works for me" while the
 * customer's screen is empty is the failure this avoids. A superadmin who needs
 * to see the feature changes its availability in the console — deliberately, and
 * with an audit-log row — rather than seeing through it invisibly.
 */
export async function assertFeatureAccess(member, request) {
  if (!member?.companyId) return member;

  const pathname = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      // Server components call getCurrentMember with only headers — there is no
      // URL to read and no route to gate. Those surfaces are covered by
      // FeatureGate instead.
      return "";
    }
  })();
  if (!pathname) return member;

  const key = featureForApiPath(pathname);
  if (!key) return member;

  const resolved = await featureStateFor(member.companyId, key);
  if (isAvailable(resolved.state)) return member;

  if (resolved.state === "hidden") {
    const err = new Error("Not found");
    err.status = 404;
    // Read by nothing that reaches a browser. Present so a support engineer
    // reading a log can tell a real 404 from a withheld feature.
    err.featureKey = key;
    throw err;
  }

  const entry = featureEntry(key);
  const err = new Error(
    resolved.note ||
      `${entry?.label || "This feature"} isn't available on your account yet.`,
  );
  err.status = 403;
  err.featureLocked = true;
  err.featureKey = key;
  throw err;
}

/**
 * What the nav should do with each feature. Serialisable, for the client.
 *
 * Only the three facts a menu needs. The note and the source stay server-side:
 * "shut off for this company specifically by a platform admin" is FieldQuo's
 * internal reasoning, not something to ship to a tenant's browser.
 */
export function navFlagsFrom(map) {
  const out = {};
  for (const key of FEATURE_KEYS) {
    const state = map?.[key]?.state || "hidden";
    out[key] = {
      state,
      visible: isVisible(state),
      usable: isAvailable(state),
    };
  }
  return out;
}
