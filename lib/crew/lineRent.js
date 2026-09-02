// lib/crew/lineRent.js
//
// The monthly rental on a crew texting line a company BOUGHT.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// A dedicated line is a real, recurring charge to FieldQuo from the moment it
// exists. purchaseCrewLine takes the first month up front; without this file it
// would take that one month and then rent the number from Twilio for ever. That
// is not hypothetical — it is exactly the voice-number bug that took its own
// commit to fix ("A number we bought bills us forever, and nothing could give
// one back"). Buying without billing and releasing is half a feature.
//
// ══ Why it does not re-implement the rules ═════════════════════════════════
//
// Every question this has to answer — is rent due, can they afford it, does the
// line keep working, when does it actually go back — is answered by
// `rentDecision` in lib/voice/spendGate.js, which is pure and already carries
// the hard-won parts: a week of grace because a contractor's advertised number
// going dark mid-job is worse than FieldQuo carrying $1 of rental; warnings
// that don't repeat daily; arrears that cannot compound.
//
// Two kinds of number, one rule. A second copy of that logic would drift, and
// the drift would land on whichever kind of number nobody was looking at.
//
// So the ONLY thing here is the adapter: a CrewInboxNumber does not have the
// columns rentDecision reads, so `rentShimFor` gives it those columns and
// nothing else. Everything after that is writing the outcome to the right table
// and sending the right email.
export const runtime = "nodejs";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import {
  balanceFor,
  debitCredit,
  CREW_LINE_MONTHLY_CENTS,
} from "@/lib/voice/credits";
import { rentDecision } from "@/lib/voice/spendGate";
import { releaseCrewLine } from "@/lib/crew/line";

/**
 * A CrewInboxNumber, shaped as the thing rentDecision knows how to judge.
 *
 * `status: "active"` is asserted rather than read: a crew row only exists while
 * the line is held — release DELETES it — so there is no released or porting
 * state for this to misreport. The voice table keeps those rows, which is why
 * its own column has to exist.
 *
 * `monthlyCents` is stamped from the price list rather than stored on the row.
 * That is a DELIBERATE difference from VoicePhoneNumber, which stores its price
 * so a number bought at last year's rate keeps it. Crew lines have only ever had
 * one price and none have been sold yet, so there is no historical rate to
 * honour — and inventing a column to hold a value that has never varied would be
 * the unread field this codebase keeps finding. If the price ever moves, that is
 * the moment to add the column, and this comment is the note saying so.
 */
export function rentShimFor(line) {
  return {
    id: line.id,
    companyId: line.companyId,
    e164: line.e164,
    status: "active",
    monthlyCents: CREW_LINE_MONTHLY_CENTS,
    rentPaidThroughAt: line.rentPaidThroughAt,
    rentGraceUntilAt: line.rentGraceUntilAt,
    rentWarnedAt: line.rentWarnedAt,
  };
}

/**
 * Is this row one that pays rent at all?
 *
 * A `shared_test` loan is FieldQuo's own number lent out. It costs the company
 * nothing and expires instead of being billed; charging for it would be charging
 * a contractor for the trial that exists to prove the feature works.
 */
export function rentApplies(line) {
  return Boolean(line && line.source === "dedicated");
}

/** The ledger ref for one line's rent for one period. Unique per (company, ref). */
export function crewRentRef(lineId, periodStart) {
  return `crew_line_rent:${lineId}:${new Date(periodStart).toISOString().slice(0, 10)}`;
}

/**
 * Decide and act for one line.
 *
 * Mirrors billNumberRent's shape on purpose — same verdicts, same order, same
 * "write the row whether or not the debit was new" rule, so the two read alike
 * to anyone who has read either.
 */
export async function billCrewLineRent(line, { now = new Date(), origin } = {}) {
  if (!rentApplies(line)) return { action: "skip", reason: "not_dedicated" };

  const balanceCents = await balanceFor(line.companyId);
  const decision = rentDecision({
    number: rentShimFor(line),
    balanceCents,
    now,
  });

  switch (decision.action) {
    case "charge": {
      const ref = crewRentRef(line.id, decision.periodStart);
      const entry = await debitCredit({
        companyId: line.companyId,
        cents: decision.cents,
        kind: "crew_line_rent",
        ref,
        note: `Crew texting number — ${dayKey(decision.periodStart)} to ${dayKey(decision.paidThroughAt)}`,
      });
      // Written whether or not the debit was new: a ref collision means another
      // run already charged this period, and the paid-through still has to move
      // or the same period retries for ever.
      await db.crewInboxNumber.update({
        where: { id: line.id },
        data: {
          rentPaidThroughAt: decision.paidThroughAt,
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
      await db.crewInboxNumber.update({ where: { id: line.id }, data });
      const sent = await notifyCrewRent(line, decision, { origin });
      return { ...decision, notified: sent };
    }

    case "release": {
      // One release path, shared with the contractor's own button — which is
      // what actually hands a dedicated number back to the carrier. Doing the
      // provider call by hand here would be the copy that rots: this branch
      // runs unattended, at most once per delinquent company, and nobody would
      // ever watch it.
      const outcome = await releaseCrewLine(line.companyId).catch((err) => ({
        ok: false,
        reason: err?.message,
      }));
      if (!outcome?.ok) {
        await recordError({
          area: "crew-line-rent",
          message: `Couldn't release ${line.e164}: ${outcome?.reason || "unknown"}`,
          companyId: line.companyId,
        });
        return { ...decision, action: "release_failed", reason: outcome?.reason };
      }
      const sent = await notifyCrewRent(line, decision, { origin });
      return { ...decision, released: true, notified: sent };
    }

    default:
      return decision;
  }
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Tell them — in the one email family that is NOT white-labelled.
 *
 * FieldQuo is the vendor here and the contractor is the customer, so this looks
 * like FieldQuo, the same reasoning the voice rental notice carries. Never
 * throws: the ledger write has already committed, and a mailbox problem must not
 * roll it back or make the cron retry the charge.
 */
async function notifyCrewRent(line, decision, { origin } = {}) {
  try {
    const company = await db.company.findUnique({
      where: { id: line.companyId },
      select: { name: true, email: true },
    });
    const to = company?.email || (await ownerEmailFor(line.companyId));
    if (!to) {
      await recordError({
        area: "crew-line-rent",
        message: "No address to warn about the crew line rental",
        companyId: line.companyId,
      });
      return false;
    }

    const base = origin || "https://www.fieldquo.com";
    const money = (c) => `$${(Math.max(0, Number(c) || 0) / 100).toFixed(2)}`;
    const date = (d) => new Date(d).toLocaleDateString("en-CA", { dateStyle: "medium" });
    const num = line.e164;

    const copy = {
      warn_soon: {
        heading: "Your crew texting number is due soon",
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} comes out of your phone credit on ${date(decision.dueAt)}, and there isn't enough on the balance to cover it.`,
          "Top up before then and nothing changes. If it isn't covered, the number keeps working for a week while you sort it out — we'll say so again if that happens.",
        ],
      },
      grace_start: {
        heading: "We couldn't take your crew number's rental",
        paragraphs: [
          `The ${money(decision.cents)} monthly rental for ${num} was due today and your phone credit is ${money(decision.balanceCents)}.`,
          `<strong>Your crew can still text it.</strong> It keeps working until ${date(decision.graceUntil)}. If the balance still won't cover the rental then, the number goes back — and anything your crew has saved in their phones stops reaching you.`,
        ],
      },
      grace_remind: {
        heading: "Your crew texting number will be released soon",
        paragraphs: [
          `${num} is still unpaid — the rental is ${money(decision.cents)} and your credit is ${money(decision.balanceCents)}.`,
          `It stops working on ${date(decision.graceUntil)} and cannot be brought back afterwards; a released number goes back to the carrier's pool and someone else can take it.`,
        ],
      },
      release: {
        heading: "Your crew texting number has been released",
        paragraphs: [
          `${num} has gone back to the carrier — the rental went unpaid past the grace period.`,
          "Texts to it no longer reach FieldQuo. You can set up a new number whenever you're ready, but it will be a different number, so your crew will need the new one.",
        ],
      },
    }[decision.action];

    if (!copy) return false;

    const { subject, html } = buildPlatformNotice({
      heading: copy.heading,
      sub: num,
      subject: `${copy.heading} — ${company?.name || "FieldQuo"}`,
      paragraphs: copy.paragraphs,
      facts: [
        ["Number", num],
        ["Monthly rental", money(decision.cents)],
        ["Your phone credit", money(decision.balanceCents)],
        ...(decision.graceUntil ? [["Works until", date(decision.graceUntil)]] : []),
        ...(decision.dueAt ? [["Due", date(decision.dueAt)]] : []),
      ],
      cta: { url: `${base}/app/crew-inbox`, label: "Add credit" },
    });

    // FieldQuo's own notice about a tenant's phone credit. Carries the tenant
    // for the same reason the billing letters do: a demo has no real balance
    // and no card, and this must not reach whoever the seeded owner's address
    // was edited to.
    const result = await sendEmail({ companyId: line?.companyId, from: await getPlatformFrom(), to, subject, html });
    return !result?.error && !result?.skipped;
  } catch (err) {
    await recordError({
      area: "crew-line-rent",
      message: `Crew rental notice failed: ${err?.message}`,
      companyId: line?.companyId,
    });
    return false;
  }
}
