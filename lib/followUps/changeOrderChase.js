// lib/followUps/changeOrderChase.js
//
// The cron's finder for change_order_no_response: a change order that went
// out to the homeowner for signature and is still unsigned.
//
// ── Why this one finder is not in the cron route ───────────────────────────
//
// The other four live in app/api/cron/follow-ups/route.js. A route file can
// only export the handler Next recognises, so a finder written there can be
// READ by a check script and never EXECUTED by one — and every real bug this
// repo has found in the follow-up stack was found by executing something
// against hostile input, not by reading it. lib/followUps/mergeData.js and
// lib/followUps/stopConditions.js moved out for the same reason. So this one
// takes its Prisma client as an argument and scripts/check-follow-up-flow.mjs
// drives it against a scripted fake, asserting that a never-sent change order
// and a signed one are genuinely absent from the result rather than absent
// from a regex.
//
// ── The clock starts at sentAt, never createdAt ────────────────────────────
//
// The delay measures how long the CLIENT has had it. A change order is
// commonly typed days before anyone sends it — "Save without sending" is a
// first-class path on this model — so createdAt would chase a homeowner about
// a document they have never seen. `sentAt: null` means it was never sent and
// must never be chased; there is no catch-up guess for one.
//
// ── Which status means "out with the client" ───────────────────────────────
//
// `waiting_client`, written by lib/jobs/changeOrderSend.js only after a
// channel ACCEPTED the message. Not `pending`: pending is the staff-side
// "jotted down, not agreed" state, and it is also where a staff WITHDRAWAL
// puts a sent change order back (lib/jobs/changeOrderDecision.js) — chasing
// one of those would be emailing a homeowner about a change the company has
// just taken off the table.

// Prisma, for the AnyNull sentinel the Json? filter below needs. The client
// itself is still an ARGUMENT, never imported — see the header.
import { Prisma } from "@prisma/client";

/**
 * @param prisma  the Prisma client (injected so a check can execute this)
 * @param rule    the FollowUpRule row (companyId, id, delayValue, delayUnit)
 * @param cutoff  the moment a change order must have been sent before, from
 *                the cron's own cutoffFor(rule) — passed rather than
 *                recomputed so the five finders cannot drift on what a
 *                "2 days" delay means.
 * @returns rows shaped the way the cron's shared send code reads every
 *          entity: `client`, `company`, `companyId`, `clientId`.
 */
export async function findChangeOrderNoResponse(prisma, rule, cutoff) {
  // Same dedupe the other finders use: one chase per (rule, entity), ever.
  const logs = await prisma.followUpLog.findMany({
    where: { ruleId: rule.id },
    select: { entityId: true },
  });
  const excluded = logs.map((l) => l.entityId);

  const rows = await prisma.changeOrder.findMany({
    where: {
      // ChangeOrder has no companyId of its own — it hangs off the job, and
      // the job carries the tenant. Scoped through the relation rather than
      // filtered in JS afterwards, so a rule can never see another tenant's
      // row even for an instant.
      // No historicalImportedAt guard, unlike the quote/invoice/job finders.
      // That guard exists because an imported past job carries REAL old
      // dates that are past every cutoff on the first run. ChangeOrder.sentAt
      // is written by nothing but an actual send (lib/jobs/changeOrderSend.js
      // stamps it only after a carrier accepted), so there is no back-dated
      // value for a cutoff to trip over, and a change order raised today on
      // an imported job SHOULD be chased.
      job: { companyId: rule.companyId },
      status: "waiting_client",
      sentAt: { not: null, lte: cutoff },
      // Signed is the end of it. A client-signed change order has `signature`
      // set and `decidedById` null — the client decided, not a staff member —
      // so the signature is the column that answers "did they respond?".
      //
      // `signature` is Json?, and Prisma REFUSES a bare `null` on a Json
      // column in a filter — it throws PrismaClientValidationError before the
      // query ever reaches Postgres. This read `signature: null` when it
      // shipped, so every run of this finder threw and no change order was
      // ever chased. The scripted fake this file's header describes accepted
      // the bare null happily, which is exactly how it got past the checks;
      // scripts/check-follow-up-flow.mjs now builds the same where clause
      // through the real client's validator.
      //
      // AnyNull, not DbNull: both mean "nobody signed", and a filter that
      // recognised only SQL NULL would silently stop chasing the day some
      // path wrote JSON `null` here. Measured 2026-11-18 — 20 SQL NULL,
      // 0 JSON null, 1 real signature — so this is a guard, not a fix for
      // rows that exist.
      signature: { equals: Prisma.AnyNull },
      // No token, no page to send them to. Minted on the first send, so a
      // row with sentAt and no token should not exist; this is here because
      // a chase whose button has an empty href is the bug this codebase
      // keeps re-finding, not because the state is expected.
      shareToken: { not: null },
      ...(excluded.length > 0 && { id: { notIn: excluded } }),
    },
    select: {
      id: true,
      jobId: true,
      seq: true,
      createdAt: true,
      description: true,
      priceDelta: true,
      status: true,
      sentAt: true,
      shareToken: true,
      job: {
        select: {
          id: true,
          companyId: true,
          clientId: true,
          title: true,
          client: true,
          company: true,
          // The originating quote, for the LANGUAGE and nothing else. An
          // addendum is an addition to that document and must read in its
          // language (AGENTS.md #6) — exactly what lib/jobs/changeOrderSend.js
          // resolves for the first send, so the chase cannot arrive in a
          // different language from the thing it is chasing.
          quote: { select: { id: true, quoteNumber: true, language: true } },
          // Every change order on this job, so changeOrderLabel can number a
          // row written before `seq` existed. id/seq/createdAt only.
          changeOrders: { select: { id: true, seq: true, createdAt: true } },
        },
      },
    },
  });

  // The cron's shared code reads entity.client, entity.company,
  // entity.companyId and entity.clientId for EVERY entity type. A change
  // order reaches all four through its job, so the row is shaped into that
  // contract here — the same thing findLeadNoResponse does for a lead, and
  // for the same reason: teaching six downstream sites a sixth shape is how
  // one of them ends up reading undefined.
  return rows.map((co) => ({
    ...co,
    companyId: co.job.companyId,
    clientId: co.job.clientId,
    client: co.job.client,
    company: co.job.company,
    quote: co.job.quote || null,
    jobTitle: co.job.title || "",
  }));
}
