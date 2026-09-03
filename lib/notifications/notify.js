// lib/notifications/notify.js
//
// notifyEvent — the one way a notification comes into existence.
//
// Called fire-and-forget AFTER the real mutation has committed, the pattern
// lib/invoices/recordStripePayment.js:41 and the visit "on my way" SMS both
// already use: the thing that happened is already durable, and a notification
// problem must never turn a real payment into a retried webhook.
//
// ══ Never throws into its caller, and never fails silently either ══════════
//
// recordActivity (lib/activity/log.js:44-46) swallows its own failures by
// design, and that is the right trade for an audit trail you consult when
// something looks wrong. It is the WRONG trade for the only record that
// somebody was told a chargeback landed. So this swallows the throw — the
// caller is a webhook, a public route or a cron and must not be broken by it —
// and reports to recordError, which surfaces at /platform/errors. A feed that
// stops working becomes visible to FieldQuo rather than invisible to everybody.
import { db as defaultDb } from "@/lib/db";
import { typeMeta, typeProblems } from "@/lib/notifications/catalog";
import { resolveRecipients } from "@/lib/notifications/recipients";

/**
 * Report a feed failure to /platform/errors.
 *
 * The error log is imported LAZILY, never at module top, for the same reason
 * app/api/public/quotes/[token]/route.js imports the PDF engine lazily: the far
 * commoner path through notifyEvent is success, and a static import would drag
 * lib/platform/errorLog — and the Prisma delegate it writes — into the module
 * graph of every route that creates a lead, accepts a quote or drafts an
 * estimate. It also stopped a real breakage: scripts/check-voice-number-race.mjs
 * stubs "@/lib/platform/errorLog" with `recordError` alone, and a STATIC
 * `import { errorDetail }` here made that check die with a SyntaxError from six
 * modules away — the voice number route reaches this file through
 * provision → quoteQuestions → callEstimate → createEstimateQuote. A dynamic
 * import resolves through the same hook and simply finds the export missing,
 * which the optional call below handles.
 *
 * Never throws. The whole point of this function is the path where something
 * has already gone wrong.
 */
async function report(entry) {
  try {
    const { recordError, errorDetail } = await import("@/lib/platform/errorLog");
    await recordError({
      ...entry,
      detail: entry.err ? errorDetail?.(entry.err, entry.extra || {}) : null,
    });
  } catch {
    // Deliberately terminal, exactly as recordError's own catch is: if the
    // error log is broken, the last thing to do is throw from a catch block.
  }
}

/**
 * @param {object} p
 * @param {string} p.companyId
 * @param {string} p.type            a NOTIFICATION_TYPES key
 * @param {string} [p.entityId]      the record the feed row opens
 * @param {object} [p.params]        sentence parameters — keys outside the
 *                                   type's declared `params` list are DROPPED
 * @param {number|string} [p.amount] only for a `money: true` type
 * @param {string} [p.currency]
 * @param {string} [p.actorUserId]   null for client-driven and system events
 * @param {string} [p.actorName]
 * @param {object} [deps]            { db } — the check script's seam
 *
 * @returns {Promise<{created:boolean, delivered:number, reason:string}>}
 *   Always resolves. `delivered: 0` with reason "no_recipients" is a real,
 *   expected answer — a one-person company where the owner is the actor, or a
 *   money event in a company whose only other member is Crew.
 */
export async function notifyEvent(
  { companyId, type, entityId = null, params = null, amount = null, currency = null, actorUserId = null, actorName = null },
  deps = {},
) {
  const prisma = deps.db || defaultDb;

  try {
    if (!companyId) return { created: false, delivered: 0, reason: "no_company" };

    // ── An unknown or unsound type is refused, loudly ───────────────────
    //
    // Not a silent success and not a permissive default: the catalog is the
    // allowlist, and a type that is not in it — or whose audience names a
    // category that no longer exists — has no computable audience. The opposite
    // of hasLevel's fail-open.
    //
    // It does NOT throw, in any environment, and an earlier draft that threw in
    // development was wrong about its own effect: every call site here is
    // `notifyEvent(...).catch(() => {})`, because a notification must never
    // break the mutation it reports, so a throw is swallowed by the caller and
    // reaches nobody. Console plus /platform/errors is the channel that
    // actually carries it.
    const problems = typeProblems(type);
    if (problems.length) {
      const message = `notifyEvent refused "${type}": ${problems.join("; ")}`;
      console.error(`[notifications] ${message}`);
      await report({ area: "notifications", message, companyId });
      return { created: false, delivered: 0, reason: "unknown_type" };
    }

    const meta = typeMeta(type);

    const recipients = await resolveRecipients({ companyId, type, actorUserId, deps: { db: prisma } });
    // No row at all when nobody is eligible. An event with no deliveries is a
    // feed nobody reads and a table that grows forever — and the fact is still
    // in ActivityLog wherever the call site already logged one.
    if (recipients.length === 0) {
      return { created: false, delivered: 0, reason: "no_recipients" };
    }

    const event = await prisma.notificationEvent.create({
      data: {
        companyId,
        type,
        entityType: meta.entityType || null,
        entityId: entityId || null,
        params: safeParams(meta, params),
        // Money is stored structurally and NEVER composed into a sentence. See
        // the comment on NotificationEvent in prisma/schema.prisma: a figure
        // inside a stored string is DELIVERED, and redacting at render is too
        // late. A type the catalog does not flag as money cannot carry one.
        amount: meta.money && amount != null ? amount : null,
        currency: meta.money ? currency || null : null,
        actorUserId: actorUserId || null,
        actorName: actorName || null,
      },
      select: { id: true },
    });

    // skipDuplicates leans on @@unique([eventId, memberId]). A retried Stripe
    // delivery creates a second NotificationEvent (they are different facts as
    // far as this table knows), but a re-run of the SAME event id — the shape a
    // partial failure and a retry of this function produce — cannot double up.
    const result = await prisma.notificationDelivery.createMany({
      data: recipients.map((m) => ({
        eventId: event.id,
        companyId,
        memberId: m.id,
        channels: ["in_app"],
      })),
      skipDuplicates: true,
    });

    return { created: true, delivered: result?.count ?? recipients.length, reason: "delivered", eventId: event.id };
  } catch (err) {
    // Deliberately not rethrown even in development past this point: by here the
    // mutation this reports has already committed, and the caller is a webhook
    // whose retry would re-charge, re-accept or re-create something.
    await report({
      area: "notifications",
      message: `notifyEvent("${type}") failed`,
      companyId,
      err,
      extra: { type },
    });
    console.error(`[notifications] ${type} failed:`, err?.message);
    return { created: false, delivered: 0, reason: "error" };
  }
}

/**
 * Drop anything the type did not declare.
 *
 * The allowlist is the structural half of "money must not be inside a stored
 * summary string": a caller cannot smuggle `{ total: 12400 }` into `params`
 * and have it rendered, because the key is not on the list and never reaches
 * the row. A denylist of money-shaped names would leak the first key nobody
 * thought of, which is the reasoning CLIENT_RESTRICTED_FIELDS in
 * lib/permissions/enforce.js already spells out for the same class of problem.
 *
 * Values are coerced to primitives for the same reason: a nested object is a
 * place to hide a figure.
 */
function safeParams(meta, params) {
  if (!params || typeof params !== "object") return null;
  const allowed = Array.isArray(meta.params) ? meta.params : [];
  const out = {};
  for (const key of allowed) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string") out[key] = value.slice(0, 200);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}
