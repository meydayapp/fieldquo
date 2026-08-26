// lib/voice/topup.js
//
// Turning a paid Stripe Checkout Session into voice credit — from EITHER of the
// two things that can tell us the payment happened.
//
// ══ Why this is a module and not a branch in one route ═════════════════════
//
// Until now there was exactly one way a top-up became credit: the browser
// coming back to /app/settings/voice?topup=<session id>, which asks the API to
// confirm that session against Stripe and add the credit. That path works — the
// two real top-ups in production were credited by it, and their rows are still
// the only evidence of either payment.
//
// What it cannot survive is the browser not coming back. Pay on a phone and
// close the tab; lose signal in a driveway somewhere between Stripe and the
// redirect; have the confirm fetch fail for any of the ordinary reasons a fetch
// fails. The card is charged, the ledger never moves, and nothing ever revisits
// the question. The contractor is out of pocket with a balance that did not
// change and no error to point at.
//
// `checkout.session.completed` exists precisely because a redirect is not a
// receipt. Voice top-ups were the one payment FieldQuo takes that no webhook
// handled on EITHER endpoint — the metadata said `kind: "voice_topup"` and
// nothing in the repository read it. AGENTS.md failure class #1, applied to
// money.
//
// ══ Which means the two can race ═══════════════════════════════════════════
//
// The redirect and the webhook fire seconds apart, in either order, and after a
// re-delivery they can both fire twice. So "credited exactly once" has to be
// something the database enforces rather than something a comment claims. See
// topupRef() in credits.js: a unique (companyId, ref) index keyed on the payment
// intent. The lookup below is a fast path in front of that index, and it is also
// what recognises the rows written before refs existed — those carry the session
// id in stripeRef and nothing in ref, and must not be credited a second time now
// that a webhook has started asking.

import { db } from "@/lib/db";
import { addCredit, balanceFor, normaliseTopup, topupRef } from "@/lib/voice/credits";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { recordActivity } from "@/lib/activity/log";

/**
 * Credit a company for one paid voice top-up.
 *
 * @param session  a Stripe Checkout Session with `kind: "voice_topup"` metadata
 * @param member   the signed-in member, when a person is standing in front of
 *                 this. Absent on the webhook path, which has no actor.
 * @param deps     seams for scripts/check-voice-topup.mjs. A check that needs a
 *                 database and a Stripe secret is a check that stops being run,
 *                 and the thing most worth checking here — that two settlement
 *                 paths credit once between them — is unreadable and only
 *                 provable by execution. Production callers pass nothing.
 * @returns {{credited: boolean, alreadyCredited?: boolean, reason?: string,
 *            cents?: number, balance?: number}}
 *          `credited: true` means the credit for this payment is on the ledger
 *          — not necessarily that THIS call put it there.
 */
export async function creditVoiceTopup(session, { member = null, deps = {} } = {}) {
  const prisma = deps.db || db;
  const credit = deps.addCredit || addCredit;
  const readBalance = deps.balanceFor || balanceFor;
  const attachNumber = deps.syncNumberAttachment || syncNumberAttachment;
  const logActivity = deps.recordActivity || recordActivity;

  const companyId = session?.metadata?.companyId || null;
  if (!companyId) return { credited: false, reason: "no_company" };

  // A delayed-notification method completes the session `unpaid` and settles
  // minutes later. Crediting then would hand out talk time against money that
  // may never arrive, and a call already made cannot be un-made.
  if (session.payment_status !== "paid") {
    return { credited: false, reason: session.payment_status || "not_paid_yet" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // What Stripe actually TOOK, in preference to what we asked it for. The two
  // agree today, and the day they stop agreeing — a coupon, a currency
  // adjustment, an amount edited at the Stripe end — the honest number is the
  // one that left the contractor's card. metadata.cents stays as the fallback
  // for a session that somehow carries no total; it is server-written at
  // creation and never round-trips through a browser, so it is safe to trust,
  // but it is a statement of intent rather than of fact.
  //
  // Written without a `cents > x` comparison on purpose: this asks whether there
  // is an amount at all, and check:voice-spend rightly refuses to let any file
  // outside credits.js/spendGate.js hold an opinion about what a balance is
  // enough FOR. Crediting is not spending, but the two read identically at a
  // glance, and that resemblance is how a second affordability rule gets born.
  const cents = Math.max(
    0,
    Math.round(Number(session.amount_total) || normaliseTopup(session.metadata?.cents) || 0),
  );
  if (!cents) return { credited: false, reason: "no_amount" };

  const ref = topupRef(paymentIntentId || session.id);

  // Both keys, for the same reason chargeCall() matches on callId as well as
  // ref: rows written before this module existed key on the session id alone.
  const existing = await prisma.voiceCreditEntry.findFirst({
    where: { companyId, OR: [{ ref }, { stripeRef: session.id }] },
    select: { id: true },
  });
  if (existing) {
    return { credited: true, alreadyCredited: true, cents, balance: await readBalance(companyId) };
  }

  await credit({
    companyId,
    cents,
    kind: "topup",
    stripeRef: session.id,
    ref,
    note: `Top-up $${(cents / 100).toFixed(2)}`,
  });

  // Attributed to the person who paid when there is one, and to Stripe when the
  // webhook got here first. "Someone added $30 of credit" with no name against
  // it reads as a bug; naming the source is the difference between a log entry
  // and a mystery.
  await logActivity(member || { companyId }, {
    action: "voice.credit_added",
    entityType: "settings",
    actorName: member ? undefined : "Stripe (payment confirmed)",
    summary: `Added $${(cents / 100).toFixed(2)} of phone credit`,
    metadata: { cents, stripeRef: session.id, paymentIntentId },
  });

  // Back in credit — put the agent back on the number if the contractor still
  // has the receptionist switched on. Without this, an account that ran dry
  // stayed silent after paying, which reads as "the top-up didn't work".
  //
  // Never allowed to fail the settlement: the money is banked and the ledger is
  // written by this point, and throwing here would ask Stripe to redeliver an
  // event whose only remaining work is a provider call that will fail again.
  await attachNumber(companyId).catch(() => {});

  return { credited: true, alreadyCredited: false, cents, balance: await readBalance(companyId) };
}
