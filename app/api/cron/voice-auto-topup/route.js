// app/api/cron/voice-auto-topup/route.js
//
// Every quarter of an hour: top up anybody whose balance has fallen below the
// level they set, and who has agreed to it.
//
// ══ Why a cron AS WELL AS the hot path ═════════════════════════════════════
//
// The call webhook already calls maybeAutoTopup the moment a call is billed,
// and that is the important one — it fires before the credit check that would
// otherwise detach the agent, so the phone never goes quiet. This sweep exists
// for the balance drops that arrive by other doors and for the case the hot
// path structurally cannot cover:
//
//   * a crew text or a monthly number rental spends the same balance, and
//     neither of those is a call;
//   * a company that has just gone under the threshold and then takes NO more
//     calls never triggers the hot path again — which is precisely the account
//     that is about to be caught out by the next caller;
//   * an attempt whose outcome we never learned holds its in-flight claim for
//     ten minutes. Nothing retries it until something asks again, and this is
//     what asks. It replays the same Stripe idempotency key, so the retry is
//     the same payment rather than a second one.
//
// ══ Why this cannot run away ═══════════════════════════════════════════════
//
// It doesn't decide anything. runAutoTopup does, through the pure
// autoTopupDecision in lib/voice/credits.js, and every cap lives there: one
// charge in flight, a fifteen-minute gap, at most three a day, a frozen daily
// ceiling, and a hard stop on a decline. A cron that ran every minute, or twice
// at once, would change none of that — which is the property worth having,
// because a schedule is a thing somebody edits.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { runAutoTopup } from "@/lib/voice/autoTopup";

// Every enabled row, in practice. Bounded anyway so one pathological account
// cannot make the invocation time out and take the rest of the sweep with it;
// the leftovers are picked up fifteen minutes later.
const BATCH = 500;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  // `enabled` is the only filter, and the balance is deliberately NOT one.
  // Reading it here would put a second opinion about what a low balance is
  // outside credits.js — the exact drift check:voice-spend fails the build for —
  // and the rows are few enough that asking runAutoTopup about each is cheaper
  // than being clever.
  const rows = await db.voiceAutoTopup.findMany({
    // A demo never charges. This is the ONE path that spends without anybody
    // present to stop it — an off-session PaymentIntent against a saved card,
    // on a schedule — so it is filtered in the query rather than skipped in the
    // loop, keeping `considered` honest, the same reasoning
    // app/api/cron/crew-line-rent uses for shared_test loans.
    where: { enabled: true, company: { isDemo: false } },
    orderBy: { lastChargeAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
    select: { companyId: true },
  });

  const counts = {};
  const tally = (reason) => {
    counts[reason] = (counts[reason] || 0) + 1;
  };

  for (const row of rows) {
    // runAutoTopup never throws — it catches its own — but the loop is written
    // as if it might. One company's bad row must not stop every other
    // company's phone from being topped up.
    try {
      const result = await runAutoTopup(row.companyId, { now });
      tally(result.charged ? "charged" : result.reason);
    } catch (err) {
      console.error(`[voice-auto-topup] ${row.companyId} failed:`, err?.message);
      tally("error");
    }
  }

  return NextResponse.json({ success: true, considered: rows.length, ...counts });
}
