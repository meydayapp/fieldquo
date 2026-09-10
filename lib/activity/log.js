// lib/activity/log.js
//
// The one way to write the tenant activity trail. Import recordActivity and
// call it from a route handler AFTER the real mutation has committed.
//
// Contract: it NEVER throws. A failure to log must not fail — or roll back —
// the customer's actual action, so this swallows its own errors into a
// console.error and returns. That means the log can miss a row under failure;
// that's the deliberate trade (see the model comment in schema.prisma).
//
// Pass the `member` from getCurrentMember(). Actor name is resolved and stored
// at write time so a later rename or a departed employee never erases who did
// it. If the member carries an impersonation flag, that's recorded too — a
// write under read-only support access should be impossible, and this is where
// it would surface.
//
// ══ Why a row can carry a KEY as well as a sentence ════════════════════════
//
// `summary` is written in English at the call site, and a Spanish account
// reading its own log saw "Crew texting turned on — crew text +1716…" among
// translated headings. Translating the SCREEN cannot fix that: the sentence is
// data, written months ago.
//
// Two things follow, and they are not the same decision.
//
//   Rows already written stay exactly as written. A log whose contents change
//   retroactively is not a log — it is a document that disagrees with the
//   printout somebody kept — and rewriting them would be editing the
//   customer's own records, which is the one thing this product does not do.
//   They render as their stored English, forever.
//
//   Rows written from now on can ALSO carry `summaryKey` + `summaryParams`,
//   and the reader's language is applied at READ time. Not instead of the
//   sentence — as well as it. The English `summary` is still required and
//   still stored, because a row in the database, a support export or a CSV has
//   to say something a human can read, and a dotted catalogue key is a machine
//   name pretending to be a record.
//
// They ride in `metadata.i18n` rather than in two new columns on purpose: the
// column would need a migration on a schema several people are editing, and
// metadata is exactly the "extra facts about this event" slot. The API route
// projects them back out and returns nothing else from metadata.

import { db } from "@/lib/db";

/**
 * @param {object} member  from getCurrentMember(): { id, userId, companyId, role, impersonation? }
 * @param {object} event
 * @param {string} event.action       dotted verb, e.g. "quote.sent"
 * @param {string} [event.entityType] "quote" | "invoice" | "client" | "payment" | "settings" | ...
 * @param {string} [event.entityId]
 * @param {string} [event.summary]    human one-liner shown in the log; ENGLISH,
 *                                   and required even when a key is given
 * @param {string} [event.summaryKey] catalogue key rendered in the READER's
 *                                   language, falling back to `summary`
 * @param {object} [event.summaryParams] {placeholder} values for that key
 * @param {object} [event.metadata]
 * @param {string} [event.actorName]  overrides the resolved name (rarely needed)
 */
export async function recordActivity(member, event = {}) {
  try {
    if (!member?.companyId || !event?.action) return;

    // Resolve the actor's display name once, at write time. Cheap (one small
    // lookup) and only on logged actions, which are never hot loops.
    let actorName = event.actorName || null;
    if (!actorName && member.userId) {
      const user = await db.user.findUnique({
        where: { id: member.userId },
        select: { name: true, email: true },
      });
      actorName = user?.name || user?.email || null;
    }

    // Merged, not replaced: a caller that passes both metadata and a key keeps
    // its own facts. `i18n` is the reserved name and is documented as such.
    const metadata = event.summaryKey
      ? {
          ...(event.metadata || {}),
          i18n: {
            key: event.summaryKey,
            ...(event.summaryParams ? { params: event.summaryParams } : {}),
          },
        }
      : event.metadata || null;

    await db.activityLog.create({
      data: {
        companyId: member.companyId,
        actorUserId: member.userId || null,
        actorMemberId: member.id || null,
        actorName,
        actorRole: member.role || null,
        viaImpersonation: Boolean(member.impersonation),
        action: event.action,
        entityType: event.entityType || null,
        entityId: event.entityId || null,
        summary: event.summary || null,
        metadata,
      },
    });
  } catch (err) {
    console.error("[activity] record failed:", err?.message);
  }
}
