// lib/messaging/rescoreThread.js
//
// Keeping MessageThread.temperature current, and the two facts the pure
// scorer is not allowed to invent.
//
// ══ Why a thread is scored on ingest and not on read ═══════════════════════
//
// The inbox list draws two hundred rows and the month-end report draws a
// month. Scoring on read would mean loading every message BODY of every one of
// them to paint a chip — the query that is fine until the week a company
// finally gets traffic. So the columns are written when a message arrives, and
// the LIST reads columns.
//
// The thread screen still scores fresh from the messages it has already
// fetched, through the same scoreConversation(). Two call sites, one function,
// and scripts/check-conversation-score.mjs asserts they agree on one fixture —
// the same discipline lib/messaging/monthlyReview.js applies to its two
// implementations of first-response time.
//
// ══ The two facts that come from the company, not from the words ═══════════
//
// A conversation cannot be disqualified for being outside a service area the
// company has never described, or for a budget below a floor the company has
// never set. Both are read here, both may legitimately be absent, and absent
// means the rule CANNOT FIRE — never that it fires against a default. That is
// AGENTS.md failure class 5, and the failure it would produce is the worst
// kind: a real customer marked structurally unwinnable by a number FieldQuo
// made up.
import { db as defaultDb } from "@/lib/db";
import { scoreConversation, applyAiRead, storableScore } from "./conversationScore";
import { serviceAreaPlaces } from "./conversationSignals";

/**
 * The company's own answers to "where do you work" and "what is the least a
 * job can go out at".
 *
 *   places — CompanySite.interview.serviceArea, which is the contractor's own
 *            sentence ("Gatineau, Ottawa, and about an hour either side"),
 *            plus Company.city. An empty list disables the out-of-area rule
 *            entirely.
 *
 *   floor  — the largest `minCharge` across the trades this company has
 *            ENABLED on its instant estimator. That is a number the company
 *            reviewed and saved itself (non-negotiable #4: the estimator never
 *            prices off our defaults), which is the only kind of number
 *            allowed to decide that a homeowner's budget is too small. No
 *            enabled trade, no floor, no budget disqualification.
 */
export async function scoringContext(companyId, { db = defaultDb } = {}) {
  const [company, configs] = await Promise.all([
    db.company
      .findUnique({
        where: { id: companyId },
        select: { city: true, site: { select: { interview: true } } },
      })
      .catch(() => null),
    db.instantQuoteConfig
      .findMany({ where: { companyId, enabled: true }, select: { config: true } })
      .catch(() => []),
  ]);

  const interview = company?.site?.interview;
  const serviceAreaText =
    interview && typeof interview === "object" ? String(interview.serviceArea || "") : "";

  const floors = (configs || [])
    .map((row) => Number(row?.config?.minCharge))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    serviceArea: { places: serviceAreaPlaces({ serviceAreaText, city: company?.city || "" }) },
    // Null, not 0. Zero is a floor everything clears, which reads as "checked
    // and fine" — the opposite of "nobody has said".
    minimumJobPrice: floors.length ? Math.max(...floors) : null,
  };
}

/**
 * Recompute one thread's score and write the four columns.
 *
 * Best effort by construction: every caller is on the path of storing a
 * message that has already landed, and a conversation must never be lost
 * because a chip could not be painted. Returns the scored result, or null when
 * it could not run.
 *
 * The stored AI reading is RE-APPLIED rather than dropped. A company paid for
 * that sentence; a new message from the homeowner adds to the conversation, it
 * does not unsay what was already in it. What changes is `messagesSince`,
 * which is how a screen says "read after eight messages, three more since"
 * without anybody being charged again.
 */
export async function rescoreThread({ threadId, companyId, db = defaultDb, now = new Date() }) {
  if (!threadId || !companyId) return null;

  const thread = await db.messageThread
    .findFirst({
      where: { id: threadId, companyId },
      select: {
        id: true,
        quoteId: true,
        scoreReasons: true,
        messages: {
          orderBy: { sentAt: "asc" },
          select: { direction: true, private: true, body: true, sentAt: true, failedReason: true },
        },
      },
    })
    .catch(() => null);
  if (!thread) return null;

  const context = await scoringContext(companyId, { db });

  const rule = scoreConversation({
    messages: thread.messages,
    now,
    serviceArea: context.serviceArea,
    minimumJobPrice: context.minimumJobPrice,
    // A linked quote is a quote that went out. The transcript is read for one
    // too, because plenty of quotes in this trade are sent as a photograph of
    // a sheet of paper and never linked to anything.
    quoteSentAt: thread.quoteId ? true : null,
  });

  const previousAi =
    thread.scoreReasons && typeof thread.scoreReasons === "object" ? thread.scoreReasons.ai : null;
  const scored = applyAiRead(rule, previousAi);

  await db.messageThread
    .update({ where: { id: thread.id }, data: storableScore(scored, { at: now }) })
    .catch(() => null);

  return scored;
}
