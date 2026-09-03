// lib/notifications/recipients.js
//
// The ONE resolver: given a company and an event type, who is told?
//
// ══ Why one ════════════════════════════════════════════════════════════════
//
// Five hand-rolled copies of the same recipient query already exist, and the
// audit (§1.3) caught them mid-drift:
//
//   lib/notifications/invoicePaymentNotice.js:80-83   owner+admin, active
//   app/api/cron/large-quote-check/route.js:55-62     owner+admin, active
//   app/api/public/quotes/[token]/route.js:577-586    owner+admin, active, distinct userId
//   app/api/self-quote/kitchen/route.js:203-208       owner+admin, active, distinct userId
//   lib/ai/monthlyDigest.js:182                       owner+admin, active
//
// Two use `distinct: ["userId"]` and three do not. (Worth saying plainly, since
// the audit reads that as a live duplicate-email bug: within ONE company it
// cannot be, because Member carries @@unique([userId, companyId]) — there is at
// most one Member row per person per company, so the distinct is a no-op. The
// drift is still real as a signal that five people wrote the same query five
// times and disagreed about it.)
//
// This file is not a sixth copy. It names no role: the audience comes from
// lib/notifications/catalog.js, and everything below is the mechanics of
// applying it.
import { db as defaultDb } from "@/lib/db";
import { satisfiesAudience, typeMeta, typeProblems } from "@/lib/notifications/catalog";

/**
 * The columns an audience decision needs. Mirrors loadEnforceableMember's own
 * select (lib/permissions/enforce.js) rather than fetching whole rows — a
 * notification resolver has no business loading a member's home address.
 */
const MEMBER_SELECT = {
  id: true,
  userId: true,
  role: true,
  permissions: true,
  companyId: true,
};

/**
 * Members of one company who should receive one event type.
 *
 * @param {object} p
 * @param {string} p.companyId
 * @param {string} p.type          a NOTIFICATION_TYPES key
 * @param {string} [p.actorUserId] the person who caused it — never told
 * @param {object} [p.deps]        { db } injection seam for the check script
 * @returns {Promise<Array<{id, userId, role}>>}
 *
 * Returns [] rather than throwing when the type is unsound. The caller
 * (notifyEvent) turns that into a recorded refusal; a resolver that throws into
 * a webhook would turn a silent notification into a retried payment.
 */
export async function resolveRecipients({ companyId, type, actorUserId = null, deps = {} }) {
  const prisma = deps.db || defaultDb;
  if (!companyId) return [];

  const problems = typeProblems(type);
  if (problems.length) return [];

  const members = await prisma.member.findMany({
    where: { companyId, active: true },
    select: MEMBER_SELECT,
  });

  return selectRecipients({ members, type, actorUserId });
}

/**
 * The pure half — the whole decision, with no database anywhere near it.
 *
 * Split out so scripts/check-notifications.mjs can EXECUTE it against a Crew
 * member, an Estimator, a Dispatcher, a Manager and an owner for every catalog
 * type. AGENTS.md: "Execute pure functions against hostile input. Most of the
 * real bugs in this repo were found that way, not by reading."
 */
export function selectRecipients({ members, type, actorUserId = null }) {
  const problems = typeProblems(type);
  if (problems.length) return [];

  const meta = typeMeta(type);
  const list = Array.isArray(members) ? members : [];

  return list.filter((member) => {
    if (!member || member.active === false) return false;

    // ── Never tell somebody what they just did ──────────────────────────
    //
    // Filtered HERE, at write time, not skipped at delivery — the rule
    // lib/photoComments/mentionable.js's resolveMentions already follows, and
    // for the same reason: a row that exists and is hidden later is a row
    // somebody eventually renders.
    //
    // Guarded on actorUserId being truthy, because null actorUserId means "the
    // homeowner did it" or "Stripe told us", and null === null would then drop
    // every member whose userId is also null.
    if (actorUserId && member.userId && member.userId === actorUserId) return false;

    // The supervisor decision, read from the catalog and nowhere else. See the
    // block at the bottom of catalog.js for why the money types say false.
    if (member.role === "supervisor" && meta.supervisors !== true) return false;

    return satisfiesAudience(member, meta.audience, { requiresMoneySight: meta.money === true });
  });
}
