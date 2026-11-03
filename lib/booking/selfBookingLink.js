// lib/booking/selfBookingLink.js
//
// The link a homeowner uses to put themselves on the calendar — /book/<slug>
// — and the one decision about whether a company has one to offer.
//
// ── Why the enquiry chase needs this and nothing else does ────────────────
//
// The owner, 2026-11-03: "if the company has the self booking page enabled
// they should have a link to create their own appointment if needed..
// something that makes it easy for them".
//
// Every other client-facing text in this product carries a link that is
// guaranteed to work, because the thing it points at is the thing that was
// just created: a quote's /q/<token>, an invoice's portal deep link, a
// booking's manage token. The booking page is the first link FieldQuo would
// put in front of a stranger that depends on the COMPANY having finished
// something — and a dead /book/<slug> in a homeowner's phone, under the
// contractor's name, is worse than no text at all.
//
// So the url is built in one place and only beside the question of whether it
// resolves. lib/booking/bookableMembers.js hasBookableMember() is that
// question, and its docblock lists the three conditions the page itself
// applies — notably that counting active EventTypes is the WRONG test,
// because the consultation event is created lazily.

/** The slug /book/<slug> uses: the chosen booking slug, else the company's. */
export function selfBookingSlug(company) {
  return String(company?.bookingSlug || company?.slug || "").trim() || null;
}

/**
 * The absolute booking url, or null.
 *
 * `origin` is resolved by the caller (lib/appUrl.js getAppOrigin) rather than
 * guessed here, exactly as the quote link is: a url in a text that a
 * homeowner taps is not a place to invent a host.
 *
 * Takes the slug it was GIVEN when there is one, so the caller that already
 * asked hasBookableMember() does not make this re-derive it from a row it may
 * not have selected.
 */
export function selfBookingUrl({ company, origin, slug = null } = {}) {
  const s = slug || selfBookingSlug(company);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!s || !base) return null;
  return `${base}/book/${s}`;
}

// ── Why a lead text with no booking link is refused, not shortened ────────
//
// This is the decision the owner asked to be made explicitly, so it is
// written here once rather than implied by three branches.
//
// A company with no self-booking has no action to offer in a text. The EMAIL
// still works for them — "reply with a couple of times that suit you" reaches
// the company's own inbox, because resolveSender sets Reply-To to it — but a
// REPLY TO A TEXT reaches nobody: app/api/sms/inbound reads STOP and START
// and acknowledges everything else with an empty 200. So the only wording
// left for a text would be "someone will be in touch", which asks the
// homeowner to do nothing, costs a billable message (two to four segments
// outside English — see scripts/check-lead-chase.mjs, which measures it), and
// is the kind of unasked-for contact a consent complaint is made about.
//
// A text that cannot carry the action is not a cheaper version of the chase.
// It is a notification nobody ordered. So the enquiry chase by TEXT is
// refused for such a company with its own reason — "no_booking" — which the
// settings page prints beside the channel picker with the screen that fixes
// it. The company keeps the enquiry chase by email, unchanged.
//
// The alternative, which the owner may prefer and can have in one line, is to
// send it anyway without the link. It is a product decision about money and
// unasked-for contact, not an engineering one, which is why it is a named
// constant and not a buried `if`.
export const LEAD_TEXT_REQUIRES_BOOKING = true;
