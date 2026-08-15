// lib/voice/spendGate.js
//
// Nothing spends FieldQuo's money until the company's money is already here.
//
// ══ Why this module exists ═════════════════════════════════════════════════
//
// FieldQuo holds ONE Retell account (see lib/voice/retell.js). Every number
// provisioned "for a tenant" is billed to FieldQuo, immediately and every month
// after, whether or not that contractor ever pays a cent. Talk time was already
// prepaid; the number itself was not. `POST /api/settings/voice/number` bought a
// live phone number with no balance check at all and then GRANTED credit, so the
// first thing a brand-new company could do was cost FieldQuo $4–9 a month
// forever and take 30 minutes of calls, having paid nothing.
//
// So: one gate, and every path that turns into a provider charge goes through
// it. One, not one per route — the second copy is the one that rots, because
// it's the one nobody looks at. If a new voice feature costs money, it adds a
// kind here rather than a check of its own.
//
// ══ Reserve first, buy second ══════════════════════════════════════════════
//
// The debit is written BEFORE the provider call, not after. "Check, then buy,
// then charge" is the same as no gate at all when the buy succeeds and the
// charge throws — FieldQuo owns a number nobody paid for, and the only record is
// a log line. Reserving first inverts the failure: the worst case is a company
// briefly short of credit for a number they didn't get, and `refundReservation`
// puts it back with a note that says why.
//
// ══ Prepaid balance, not a card charge ═════════════════════════════════════
//
// Rent draws down the same prepaid balance talk time does. Two alternatives were
// considered and rejected:
//
//   * A Stripe subscription per number. That is FieldQuo's own Stripe BILLING
//     account (not Connect — different integration, see AGENTS.md), and it means
//     a contractor with a $9 toll-free line gets a second recurring invoice
//     separate from their plan, plus dunning, plus a card that expires while
//     their business number quietly stops being paid for. It also breaks the
//     promise credits.js makes: no surprise invoices, ever.
//   * Charging the card on file per month. Same surprise, less warning.
//
// Drawing on the balance means a company that stops topping up loses the number
// rather than FieldQuo eating the cost — and, crucially, they lose it the way a
// prepaid phone is lost: with a warning, a grace period, and a state they can
// see, not overnight.
//
// ══ What this gate does NOT cover, and where it would go ═══════════════════
//
// CONCURRENCY. The one Retell account has a single simultaneous-call ceiling
// shared by every tenant (`/get-concurrency`), so on a busy Monday one company's
// call volume can make another company's phone stop answering with
// `concurrency_limit_reached`. That is the same class of problem as this module
// — a shared platform resource a tenant can exhaust — but it is a CAPACITY limit,
// not a money one, and the honest fix is buying more concurrency, not refusing a
// paying customer's caller. It belongs in canTakeCall/`checkSpend({kind:"call"})`
// the day the ceiling is real: read the account's limit, compare against live
// calls, and refuse the OUTBOUND queue first (a callback can wait; a homeowner
// ringing in cannot). Deliberately not built on a guess about the ceiling —
// inventing a limit would drop calls nobody needed to drop.
//
// SMS. Twilio charges FieldQuo per message for appointment reminders, visit
// notifications and the crew inbox, and none of it is metered anywhere. Same
// leak shape as the rental was; it needs a price per message before it can have
// a gate, which is a product decision rather than a bug fix.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
// Whether FieldQuo still OFFERS voice to this company — a different question
// from whether the company can afford it, and it has to be asked first. See the
// header of lib/features/gate.js for what happens to money when it is withdrawn.
import { featureAllowsSpend } from "@/lib/features/gate";
import { releaseNumber } from "./retell";
import {
  balanceFor,
  canTakeCall,
  debitCredit,
  addCredit,
  monthlyCentsFor,
  ratePerMinute,
  minutesFor,
} from "./credits";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Everything that costs FieldQuo money on a tenant's behalf, and what it costs.
 *
 * `label` is shown to the contractor before they commit, so it has to be the
 * whole truth: "a number" is not a price, "$4.00 now, then $4.00 a month" is.
 */
export const SPEND_KINDS = {
  /**
   * Buying a number. The provider starts charging the moment it exists, so the
   * first month is taken up front — this is the charge the whole module is
   * about.
   */
  number_setup: { key: "number_setup", recurring: true },
  /** Each month after the first. Same price, taken by the rent cron. */
  number_rent: { key: "number_rent", recurring: true },
  /**
   * Talk time. Priced per minute and already gated by canTakeCall, which
   * provision.js and outboundCall.js call directly. Represented here so the gate
   * is the complete list of what spends money — and so the two can be asserted
   * to agree rather than assumed to.
   */
  call: { key: "call", recurring: false },
};

/** What one unit of this spend costs, in cents. Pure. */
export function priceSpend(kind, numberType = "local") {
  switch (kind) {
    case "number_setup":
    case "number_rent":
      return monthlyCentsFor(numberType);
    case "call":
      // A call's floor is one minute — costForSeconds rounds up with a
      // one-minute minimum, so anything less than that cannot be afforded.
      return ratePerMinute(numberType);
    default:
      return 0;
  }
}

/**
 * The decision, with no database in it.
 *
 * Pure so it can be executed against hostile input — a NaN balance, an unknown
 * kind, a negative one — in a check script rather than reasoned about. Every
 * "no" carries the numbers the UI needs to say WHY, because "insufficient
 * balance" after the fact is the dead control AGENTS.md forbids.
 */
export function spendVerdict({ kind, numberType = "local", balanceCents }) {
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;

  if (!SPEND_KINDS[kind]) {
    // An unknown kind is refused, not waved through. A typo in a new caller must
    // fail closed — the whole point of this module is that money can't leak past
    // it by accident.
    return {
      allowed: false,
      kind,
      needCents: 0,
      balanceCents: balance,
      shortfallCents: 0,
      reason: "unknown_spend",
    };
  }

  const needCents = priceSpend(kind, numberType);
  const allowed = balance >= needCents;
  return {
    allowed,
    kind,
    numberType,
    needCents,
    balanceCents: balance,
    shortfallCents: allowed ? 0 : needCents - balance,
    reason: allowed ? "ok" : "insufficient_balance",
  };
}

/**
 * Can this company afford it, right now?
 *
 * Read-only. Used by the settings API to decide whether a button is live, and by
 * reserveSpend immediately before taking the money.
 */
export async function checkSpend({ companyId, kind, numberType = "local" }) {
  if (!companyId) {
    return { allowed: false, kind, needCents: priceSpend(kind, numberType), balanceCents: 0, shortfallCents: priceSpend(kind, numberType), reason: "no_company" };
  }

  // Availability before affordability. A company that FieldQuo has withdrawn
  // voice from must not buy a number however much credit it holds — and asking
  // here rather than in the buy route means a future caller cannot spend by
  // forgetting, which is the same argument that put every price in this module.
  if (!(await featureAllowsSpend(companyId, "voice_receptionist"))) {
    return {
      allowed: false,
      kind,
      numberType,
      needCents: priceSpend(kind, numberType),
      balanceCents: await balanceFor(companyId),
      shortfallCents: 0,
      // Not "insufficient_balance" — topping up would not fix it, and telling
      // someone to add money to solve a problem money can't solve is the worst
      // kind of dead control.
      reason: "feature_unavailable",
    };
  }

  // Talk time defers to canTakeCall rather than re-deriving it: provision.js and
  // outboundCall.js call that function directly and cannot be edited from here,
  // and two implementations of "may this call happen" is exactly the drift this
  // module exists to prevent.
  if (kind === "call") {
    const verdict = await canTakeCall(companyId, numberType);
    return {
      allowed: verdict.allowed,
      kind,
      numberType,
      needCents: ratePerMinute(numberType),
      balanceCents: verdict.cents,
      shortfallCents: verdict.allowed ? 0 : ratePerMinute(numberType) - verdict.cents,
      reason: verdict.allowed ? "ok" : "insufficient_balance",
    };
  }

  return spendVerdict({ kind, numberType, balanceCents: await balanceFor(companyId) });
}

/**
 * Take the money, if it's there.
 *
 * Returns the same verdict shape as checkSpend, plus `entry` when it went
 * through. Callers branch on `allowed` and hand the rest to the UI — they never
 * compute a price themselves, because a price computed at a call site is a price
 * that can disagree with the one the contractor was shown.
 */
export async function reserveSpend({ companyId, kind, numberType = "local", ref, note }) {
  const verdict = await checkSpend({ companyId, kind, numberType });
  if (!verdict.allowed) return verdict;

  const entry = await debitCredit({
    companyId,
    cents: verdict.needCents,
    kind,
    ref,
    note,
  });
  return { ...verdict, entry };
}

/**
 * Give a reservation back.
 *
 * Only for the case where we took the money and then the provider refused — the
 * company must not be down $4 for a number they never got. Written under its own
 * ref so a retried failure path refunds once, and so the statement reads
 * "reserved / refunded" rather than showing a hole that has to be explained.
 */
export async function refundReservation({ companyId, ref, cents, note }) {
  if (!companyId || !ref) return null;
  return addCredit({
    companyId,
    cents,
    kind: "adjustment",
    ref: `refund:${ref}`,
    note: note || "Refund — the number couldn't be set up",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Monthly rental
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A "month" is 30 days, not a calendar month.
 *
 * Calendar months make the first charge land on the 31st and then argue about
 * February. Thirty days is what the provider's own metering behaves like, it
 * makes the paid-through arithmetic exact, and it is what the UI can state as a
 * date the contractor can check.
 */
export const RENT_PERIOD_DAYS = 30;

/**
 * How long a number keeps working after a rent debit fails.
 *
 * Seven days because the failure mode on the other side is a contractor's
 * advertised phone number disappearing while they're on a job site with no
 * signal. A week covers a working week away; it costs FieldQuo at most one week
 * of one number's rental (about $1) per delinquent company, which is a price
 * worth paying to never take someone's business line without warning.
 */
export const RENT_GRACE_DAYS = 7;

/** Warn this far ahead of a due date the balance can't cover. */
export const RENT_WARN_AHEAD_DAYS = 3;

/** Don't re-send the same warning more often than this. */
export const RENT_REMIND_EVERY_DAYS = 3;

const addDays = (date, days) => new Date(date.getTime() + days * DAY);

/** Day resolution, UTC — the idempotency key has to be stable across timezones. */
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/** The ledger ref for one number's rent for one period. Unique per (company, ref). */
export function rentRef(numberId, periodStart) {
  return `number_rent:${numberId}:${dayKey(periodStart)}`;
}

/** What this number's rent actually is. */
export function rentFor(number) {
  // The row's own price wins. A number bought at last year's rate keeps last
  // year's rate until someone changes it deliberately — that's what the column
  // is for. Falling back to the price list would silently re-price every
  // existing number the day the list moves.
  const stored = Math.round(Number(number?.monthlyCents) || 0);
  if (stored > 0) return stored;
  return monthlyCentsFor(number?.numberType);
}

/**
 * What should happen to this number today?
 *
 * Pure: a row, a balance, a clock. Every branch is reachable from a check script
 * without a database, which is the only way the "what happens when the balance
 * runs dry mid-month" path gets tested at all — it is, by definition, the path
 * nobody exercises by hand.
 *
 * @param available  is voice_receptionist still offered to this company?
 *                   Defaults true so every existing caller and every test that
 *                   isn't about availability behaves exactly as before.
 *
 * @returns { action, ... }
 *   none          nothing due
 *   charge        due and affordable — debit and advance paid-through
 *   warn_soon     due within a few days and the balance won't cover it
 *   grace_start   due, unaffordable, first time — number KEEPS WORKING, warn
 *   grace_remind  still unaffordable, and it's been a few days since we said so
 *   grace_wait    still unaffordable, already warned recently — say nothing
 *   release       grace has run out — the number goes back
 *   skip          not an active rented number (porting, released, no rental),
 *                 or FieldQuo has withdrawn the feature
 */
export function rentDecision({ number, balanceCents, now = new Date(), available = true }) {
  if (!number?.id) return { action: "skip", reason: "no_number" };

  // ── FieldQuo withdrew the feature ────────────────────────────────────────
  //
  // Checked FIRST, above every other branch, because the two things this cron
  // can do to a number are both wrong once the platform has switched voice off
  // for this company:
  //
  //   charging  — taking a contractor's prepaid balance for a month in which
  //               FieldQuo's own decision stopped them using the thing. That is
  //               billing for nothing, and it is not recoverable by apologising.
  //   releasing — handing back the phone number the contractor advertises,
  //               because a switch WE flipped stopped the rent being paid. A
  //               released number cannot be got back. It is the "turning a
  //               feature off must never delete data" rule at its sharpest: the
  //               call records, the agent and the credit balance all survive a
  //               withdrawal, and the number has to as well.
  //
  // So: nothing happens. rentPaidThroughAt is deliberately NOT advanced, so no
  // month is silently marked paid — the row simply stops moving, and FieldQuo
  // carries the provider's rental for as long as it has withheld the feature.
  // That cost is in the right place; FieldQuo made the decision.
  //
  // On switching back on, the existing arrears branch below takes over: a pause
  // longer than one period is forgiven wholesale (`forgaveArrears`), and a
  // shorter one bills a single period. It cannot compound.
  if (!available) return { action: "skip", reason: "feature_unavailable" };

  // Porting rows carry a price but nothing is rented yet — the port is a request
  // a human actions, and charging for a number that doesn't exist would be
  // charging for a wait. Rent starts when it goes active, which the null
  // paid-through below then treats as due immediately.
  if (number.status !== "active") return { action: "skip", reason: `status_${number.status}` };

  const cents = rentFor(number);
  if (!(cents > 0)) return { action: "skip", reason: "no_rental" };

  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  const affordable = balance >= cents;

  // Null paid-through means never charged: a number from before rent billing
  // existed, or a port that just went live. Due now, and it goes through exactly
  // the same warn-then-grace path, so nobody is surprised by the catch-up.
  const dueAt = number.rentPaidThroughAt ? new Date(number.rentPaidThroughAt) : new Date(now);
  const graceUntil = number.rentGraceUntilAt ? new Date(number.rentGraceUntilAt) : null;
  const warnedAt = number.rentWarnedAt ? new Date(number.rentWarnedAt) : null;

  if (now < dueAt) {
    // Not due. Say something only if it's close AND they can't cover it — a
    // heads-up while there's still time to act is the difference between a
    // prepaid service and a trap.
    if (!affordable && dueAt.getTime() - now.getTime() <= RENT_WARN_AHEAD_DAYS * DAY) {
      const quiet = warnedAt && now.getTime() - warnedAt.getTime() < RENT_REMIND_EVERY_DAYS * DAY;
      return quiet
        ? { action: "grace_wait", reason: "warned_recently", dueAt, cents, balanceCents: balance }
        : { action: "warn_soon", dueAt, cents, balanceCents: balance, shortfallCents: cents - balance };
    }
    return { action: "none", dueAt, cents, balanceCents: balance };
  }

  if (affordable) {
    // Advance from the period that just ended, so paying late doesn't buy extra
    // time. The exception is a long outage — more than a whole period behind
    // means OUR cron didn't run, and billing arrears for a gap we caused would
    // drain a contractor's balance for months they may not have used.
    const fromDue = addDays(dueAt, RENT_PERIOD_DAYS);
    const paidThroughAt = fromDue > now ? fromDue : addDays(now, RENT_PERIOD_DAYS);
    return {
      action: "charge",
      cents,
      balanceCents: balance,
      periodStart: dueAt,
      paidThroughAt,
      ref: rentRef(number.id, dueAt),
      forgaveArrears: fromDue <= now,
    };
  }

  if (!graceUntil) {
    return {
      action: "grace_start",
      cents,
      balanceCents: balance,
      shortfallCents: cents - balance,
      graceUntil: addDays(now, RENT_GRACE_DAYS),
    };
  }

  if (now >= graceUntil) {
    return { action: "release", cents, balanceCents: balance, graceUntil };
  }

  const quiet = warnedAt && now.getTime() - warnedAt.getTime() < RENT_REMIND_EVERY_DAYS * DAY;
  return quiet
    ? { action: "grace_wait", reason: "warned_recently", cents, balanceCents: balance, graceUntil }
    : { action: "grace_remind", cents, balanceCents: balance, shortfallCents: cents - balance, graceUntil };
}

/**
 * Execute today's decision for one number.
 *
 * The cron stays thin on purpose, the same way /api/cron/voice-outbound does:
 * the judgement lives here so a second caller (a platform console "bill now", a
 * backfill) can reuse it without re-deriving the rules.
 */
export async function billNumberRent(number, { now = new Date(), origin } = {}) {
  const balanceCents = await balanceFor(number.companyId);
  // Availability is resolved here rather than in the cron for the same reason
  // everything else is: a second caller ("bill now" from the console, a
  // backfill) must not be able to bill a company whose feature FieldQuo has
  // withdrawn just by forgetting to ask.
  const available = await featureAllowsSpend(number.companyId, "voice_receptionist");
  const decision = rentDecision({ number, balanceCents, now, available });

  switch (decision.action) {
    case "charge": {
      const entry = await debitCredit({
        companyId: number.companyId,
        cents: decision.cents,
        kind: "number_rent",
        ref: decision.ref,
        note: `Number rental — ${dayKey(decision.periodStart)} to ${dayKey(decision.paidThroughAt)}`,
      });
      // Written whether or not the debit was new: a ref collision means another
      // run already charged this period, and the paid-through still has to move
      // or the same period retries forever.
      await db.voicePhoneNumber.update({
        where: { id: number.id },
        data: {
          rentPaidThroughAt: decision.paidThroughAt,
          // Paid up: the past-due state is over, and the next warning should
          // start from silence rather than from a stale timestamp.
          rentGraceUntilAt: null,
          rentWarnedAt: null,
        },
      });
      return { ...decision, charged: Boolean(entry) };
    }

    case "grace_start":
    case "warn_soon":
    case "grace_remind": {
      const data = { rentWarnedAt: now };
      if (decision.action === "grace_start") data.rentGraceUntilAt = decision.graceUntil;
      await db.voicePhoneNumber.update({ where: { id: number.id }, data });
      const sent = await notifyRent(number, decision, { origin });
      return { ...decision, notified: sent };
    }

    case "release": {
      // The provider call first. Marking it released locally while it still
      // exists at Retell is the worst outcome available: FieldQuo keeps paying
      // for a number the contractor can no longer see, forever.
      //
      // Keyed on the E.164, never on `providerId`: that column holds Retell's
      // `phone_number_pretty` on rows written before this change — a display
      // string, not an identifier. A release that looked it up there would fail
      // silently and leave the rental running.
      let providerReleased = false;
      try {
        await releaseNumber(number.e164);
        providerReleased = true;
      } catch (err) {
        // Logged and retried tomorrow — the row stays active so we try again,
        // because giving up here means paying rent on it indefinitely.
        await recordError({
          area: "voice-rent",
          message: `Couldn't release ${number.e164}: ${err?.message}`,
          companyId: number.companyId,
        });
        return { ...decision, action: "release_failed", reason: err?.message };
      }

      await db.voicePhoneNumber.update({
        where: { id: number.id },
        data: { status: "released", releasedAt: now, agentId: null, rentGraceUntilAt: null },
      });
      const sent = await notifyRent(number, decision, { origin, providerReleased });
      return { ...decision, released: true, notified: sent };
    }

    default:
      return decision;
  }
}

/**
 * Tell them, in the one email family that is NOT white-labelled.
 *
 * FieldQuo is the vendor here and the contractor is the customer, so this looks
 * like FieldQuo — the same reasoning as the subscription emails it shares a
 * builder with. Never throws: the ledger write has already committed, and a
 * mailbox problem must not roll it back or make the cron retry the charge.
 */
async function notifyRent(number, decision, { origin, providerReleased } = {}) {
  try {
    const company = await db.company.findUnique({
      where: { id: number.companyId },
      select: { name: true, email: true },
    });
    const to = company?.email || (await ownerEmailFor(number.companyId));
    if (!to) {
      await recordError({
        area: "voice-rent",
        message: "No address to warn about the number rental",
        companyId: number.companyId,
      });
      return false;
    }

    const base = origin || "https://www.fieldquo.com";
    const money = (c) => `$${(Math.max(0, Number(c) || 0) / 100).toFixed(2)}`;
    const date = (d) => new Date(d).toLocaleDateString("en-CA", { dateStyle: "medium" });
    const num = number.publicNumber || number.e164;

    const copy = {
      warn_soon: {
        heading: "Your number's rental is due soon",
        sub: num,
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} comes out of your phone credit on ${date(decision.dueAt)}, and there isn't enough on the balance to cover it.`,
          "Top up before then and nothing changes. If it isn't covered, the number keeps working for a week while you sort it out — we'll say so again if that happens.",
        ],
      },
      grace_start: {
        heading: "We couldn't take your number's rental",
        sub: num,
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} was due today and your phone credit is ${money(decision.balanceCents)}.`,
          `<strong>Your number still works.</strong> It keeps working until ${date(decision.graceUntil)}. If the balance still won't cover the rental then, the number is released and you lose it — so anything printed on a van or a lawn sign would stop ringing.`,
        ],
      },
      grace_remind: {
        heading: "Your number will be released soon",
        sub: num,
        paragraphs: [
          `${num} is still unpaid — the rental is ${money(decision.cents)} and your credit is ${money(decision.balanceCents)}.`,
          `It stops working on ${date(decision.graceUntil)} and cannot be brought back afterwards; a released number goes back to the carrier's pool and someone else can take it.`,
        ],
      },
      release: {
        heading: "Your number has been released",
        sub: num,
        paragraphs: [
          `${num} has been released — the rental went unpaid past the ${RENT_GRACE_DAYS}-day grace period we wrote to you about.`,
          providerReleased
            ? "The number is gone from your account. You can set up a new one from the receptionist settings whenever you're ready, and if you were forwarding your own number to it, that forwarding now goes nowhere — turn it off with ##002# from your phone."
            : "The number has been marked released on your account.",
        ],
      },
    }[decision.action];

    if (!copy) return false;

    const { subject, html } = buildPlatformNotice({
      heading: copy.heading,
      sub: copy.sub,
      subject: `${copy.heading} — ${company?.name || "FieldQuo"}`,
      paragraphs: copy.paragraphs,
      facts: [
        ["Number", num],
        ["Monthly rental", money(decision.cents)],
        ["Your phone credit", money(decision.balanceCents)],
        ...(decision.graceUntil ? [["Works until", date(decision.graceUntil)]] : []),
        ...(decision.dueAt ? [["Due", date(decision.dueAt)]] : []),
      ],
      cta: { url: `${base}/app/settings/voice`, label: "Add credit" },
    });

    const result = await sendEmail({ from: await getPlatformFrom(), to, subject, html });
    return !result?.error && !result?.skipped;
  } catch (err) {
    await recordError({
      area: "voice-rent",
      message: `Rental notice failed: ${err?.message}`,
      companyId: number?.companyId,
    });
    return false;
  }
}

/**
 * The rental facts the settings screen needs, shaped for display.
 *
 * Derived here rather than in the page so "past due" means the same thing in the
 * UI, the email and the cron. `minutes` is included because a balance in dollars
 * is not what a contractor is deciding about.
 */
export function rentStatus(number, balanceCents, now = new Date()) {
  if (!number || number.status !== "active") return null;
  const cents = rentFor(number);
  if (!(cents > 0)) return null;

  const decision = rentDecision({ number, balanceCents, now });
  const pastDue = ["grace_start", "grace_remind", "grace_wait", "release"].includes(decision.action)
    && Boolean(number.rentGraceUntilAt || decision.action === "grace_start");

  return {
    monthlyCents: cents,
    dueAt: number.rentPaidThroughAt || null,
    graceUntil: number.rentGraceUntilAt || null,
    pastDue,
    // "Will it survive the next charge?" — the question the contractor is
    // actually asking, answered before it's too late to act on.
    coversNext: Number(balanceCents) >= cents,
    minutes: minutesFor(balanceCents, number.numberType),
  };
}
