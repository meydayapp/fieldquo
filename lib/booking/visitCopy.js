// lib/booking/visitCopy.js
//
// The three decisions the manage-my-visit page makes about wording, kept apart
// from the component that renders them.
//
// Not for tidiness. app/visit/[token]/VisitManager.js is a "use client" module
// full of JSX, which means nothing can execute these against hostile input
// without standing up a renderer — and the one that matters, refundLine, is the
// difference between telling a homeowner their deposit is coming back and
// telling them it isn't. That has to be runnable in a script, so it lives here
// and scripts/check-visit-copy.mjs runs the SAME function the page calls rather
// than a paraphrase of it.
//
// Pure: reason keys and a copy pack in, strings out. No fetch, no clock, no
// policy of its own — every verdict is decided server-side by
// lib/booking/changePolicy.js and merely explained here.

/**
 * What the change refusal says, from the stable reason key.
 *
 * `callable` is whether "they can still move it for you" is a true sentence.
 * It isn't for a visit that already happened or was already cancelled — there
 * is nothing left to move — so those get the neutral questions line instead.
 *
 * An unrecognised reason produces NO sentence rather than a guessed one. A
 * wrong explanation is worse than none: it sends someone to argue about a
 * policy that isn't why they were refused.
 *
 * @param policy  the server's verdict: { reason, noticeHours }
 * @param copy    clientDocCopy(language).visit
 */
export function changeRefusal(policy, copy, companyName) {
  switch (policy?.reason) {
    case "already_cancelled":
      return { text: copy.cannotCancelled, callable: false };
    case "already_happened":
      return { text: copy.cannotHappened, callable: false };
    case "awaiting_payment":
      return { text: copy.cannotAwaitingPayment, callable: false };
    case "not_found":
      return { text: copy.cannotNotFound, callable: false };
    case "too_late": {
      // The company's own notice period, so the refusal names a number the
      // reader can act on. Absent or malformed, the sentence stays honest and
      // vague rather than falling back on changePolicy's 24-hour default — a
      // company that set 48 must not have this page tell their client 24.
      const n = Number(policy?.noticeHours);
      return {
        text:
          Number.isFinite(n) && n > 0
            ? copy.cannotTooLate(copy.noticeHours(Math.round(n)), companyName)
            : copy.cannotTooLateNoNotice(companyName),
        callable: true,
      };
    }
    default:
      return { text: null, callable: true };
  }
}

/**
 * What happens to money already paid, if they cancel now.
 *
 * Null when nothing was taken — a screen that says "your fee is not
 * automatically returned" to someone who never paid one is its own kind of
 * wrong, and `nothing_paid` exists in the policy precisely so this can tell the
 * difference.
 *
 * Everything that is not an explicit `willRefund: true` falls to the non-refund
 * wording. That default is the whole point of this function: policy_off,
 * inside_cutoff, already_happened, no_payment_intent, a reason key added next
 * year, a verdict mangled in transit — none of them may produce a promise.
 *
 * And the non-refund wording never says "non-refundable", because the
 * contractor may well hand it back when asked. It says the refund is not
 * automatic and to get in touch, which is the true statement.
 *
 * @param refund  the server's verdict: { willRefund, reason, amountCents }
 * @param money   (cents) => formatted string
 */
export function refundLine(refund, copy, money) {
  const cents = Number(refund?.amountCents) || 0;
  if (cents <= 0) return null;
  if (refund?.reason === "already_refunded") return copy.refundAlready(money(cents));
  if (refund?.willRefund === true) return copy.refundYes(money(cents));
  return copy.refundNo(money(cents));
}

/**
 * A mid-action failure, in the reader's language.
 *
 * The API's `error` string is English by design — it exists for logs and for
 * the shared fetch helpers (see reasonMessage in lib/booking/manageVisit.js).
 * Rendering it straight would put an English sentence in the middle of a
 * Ukrainian page. So the stable `reason` key is translated here, and the
 * server's own wording is the fallback for anything this page doesn't know
 * about: accurate beats blank, and blank is what a bare lookup would give.
 */
export function actionErrorText(err, copy, companyName) {
  const reason = err?.data?.reason;
  if (reason === "slot_unavailable") return copy.slotTaken;
  if (reason === "too_soon" || reason === "in_the_past") return copy.tooSoon;
  if (reason === "refund_failed") return copy.refundFailed;
  const known = changeRefusal({ reason }, copy, companyName);
  return known.text || err?.message || copy.loadFailed;
}

/**
 * The exact time, in the company's zone, named so the reader knows which zone
 * they are reading.
 *
 * Used when there is no arrival window — describeWindow returns null then, on
 * purpose, so this is the one copy of exact-time formatting rather than a
 * second one hiding inside a fallback string.
 */
export function exactWhen(startTime, timezone, locale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timezone && { timeZone: timezone }),
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    // A bad IANA string must not blank the one line that says when somebody is
    // turning up. Same rule as the confirmation email.
    return new Date(startTime).toString();
  }
}
