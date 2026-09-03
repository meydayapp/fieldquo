// lib/signup/abandoned.js
//
// What an INCOMPLETE SIGNUP is, and when — if ever — to write to the person
// behind one.
//
// ══ The failure ════════════════════════════════════════════════════════════
//
// app/api/companies/route.js creates the Company and the owner's Member around
// line 271, and only reaches createTrialCheckoutSession around line 493. Every
// line between those two is unconditional. So closing the Stripe tab does not
// undo anything: it leaves a fully working tenant with full access
// (lib/billing/access.js accessFor(null) → "full"), no seat cap
// (lib/pricing/seatLimit.js: a null plan cannot be exceeded), and no card.
//
// Measured on the live database, 2026-09-02: twenty companies have no
// Subscription row. Ten are seeded sales demos. The other ten are real people:
//
//   five named "sunset", created 2026-07-08 within 85 seconds of each other,
//     four of them on ONE email address — one person retrying a checkout that
//     could not succeed (see lib/platform/sellablePlans.js, which predicted
//     this exact shape and named this exact consequence);
//   "zan test inc", which then went on to create a quote — somebody abandoned
//     checkout and used the product anyway;
//   "Localfy", created hours ago, which is what makes this live rather than
//     historical.
//
// The owner's ruling: "if they didn't finalize the last step which is the free
// checkout with stripe and entering their credit card then technically they
// should not have been signed up yet. we may keep the information and send
// them an email … flag it to the fieldquo platform so that we call them."
//
// So: keep every row, stop counting them as customers, write once, and put
// them on a screen a person reads.
//
// ══ Why "has a Subscription row" is the whole test ═════════════════════════
//
// Not onboardingStatus. lib/platform/trialCounting.js already wrote down why
// that column cannot answer this: it flips to "active" at
// checkout.session.completed, i.e. at trial START, so it says "active" about a
// company that has paid nothing and says "pending" about all ten of these.
//
// Not trialEndsAt either. That is stamped at signup, before checkout, so it is
// set on every one of these ten and says nothing about whether a card was
// given. awaitingCheckoutWhere() in trialCounting.js pairs "no subscription"
// with "trial still open" because it is answering a different question — who
// is inside a free month. A signup abandoned in July is still an incomplete
// signup in September; its trial lapsing did not complete it.
//
// The Subscription row is created by the checkout webhook and by
// /api/settings/subscription/reconcile. Both mean the same thing and only that
// thing: this company reached the end of Stripe Checkout.
//
// ══ Pure, and therefore executable ═════════════════════════════════════════
//
// No database, no clock of its own, no next/server. Every rule below is
// something scripts/check-abandoned-signup.mjs runs against a hostile fixture
// rather than reads — including the one that matters most, which is that a
// company holding a Subscription can never be nudged.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * How long after signup before the first (and only) nudge may go out.
 *
 * TWENTY-FOUR HOURS, and the number is chosen against the two ways this email
 * can be wrong rather than against a conversion-rate blog post.
 *
 *   Too early is the expensive mistake. A Stripe Checkout Session expires 24
 *   hours after it is created, and until it does, the link in the person's own
 *   tab still works. Writing "we noticed you didn't finish" to someone whose
 *   checkout is still open is writing to someone who is mid-signup — the exact
 *   failure the brief names. Waiting for the session to have expired makes
 *   "they cannot finish from where they left off" a fact rather than a guess.
 *
 *   The five "sunset" rows are the evidence. They were created inside 85
 *   seconds. A one-hour nudge, which is the e-commerce cart convention, would
 *   have written to that person while they were still hammering the button.
 *
 *   Too late costs a lead and nothing else. A contractor putting a business
 *   card into software is not an impulse cart; deferring it to the evening, or
 *   to whoever does the books, is normal. A day's delay does not lose that
 *   person.
 */
export const NUDGE_DELAY_HOURS = 24;

/**
 * And the outer edge: THIRTY DAYS.
 *
 * Two independent reasons, and the shorter one wins:
 *
 *   CASL. This message is commercial (see the classification note below), so
 *   it needs consent. What FieldQuo has is IMPLIED consent under s.10(9)(b) —
 *   the recipient "made an inquiry or application … within the previous six
 *   months relating to a commercial activity". Starting a paid signup is that
 *   application. Six months is therefore a hard ceiling, not a target.
 *
 *   Usefulness. A note four months after somebody typed their business name
 *   does not read as help; it reads as being watched. Thirty days is inside
 *   any reasonable memory of having tried, and it is also what stops the first
 *   deployment of this from mailing every abandoned signup FieldQuo has ever
 *   had in one batch — of the ten live rows, only the newest is inside the
 *   window, which is the correct blast radius for a first run.
 */
export const NUDGE_WINDOW_DAYS = 30;

/**
 * ══ CASL: commercial, not transactional. Stated here because the answer
 *    decides what the email must carry ═══════════════════════════════════
 *
 * CASL s.1(2) makes a message commercial when one of its purposes is to
 * encourage participation in a commercial activity. The whole purpose of this
 * one is to get an unfinished paid signup finished, so it is a CEM.
 *
 * The s.6(6) carve-outs were checked one at a time and none applies. The near
 * miss is 6(6)(b), a message that facilitates or completes "a commercial
 * transaction that the person … previously agreed to enter into". They did not
 * previously agree: Stripe Checkout is precisely where agreement is given, and
 * this population is defined by never having reached the end of it. That is
 * exactly what separates this email from the billing notices in
 * lib/email/billingEmail.js — those go to a company with a live subscription
 * and are factual information about an ongoing account under 6(6)(d), which is
 * why lib/marketing/unsubscribe.js classifies them as transactional and gives
 * them no unsubscribe link. This one is not that.
 *
 * So s.6(1) applies in full and the email must carry:
 *
 *   consent        implied, s.10(9)(b), six months from the application —
 *                  bounded far tighter by NUDGE_WINDOW_DAYS above;
 *   identification FieldQuo's name plus a mailing address plus a way to reach
 *                  us — SALES_MAILING_ADDRESS, the same env var
 *                  lib/sales/outreachSender.js already requires, with the same
 *                  refusal to invent one;
 *   unsubscribe    a working mechanism, honoured within ten business days and
 *                  valid for sixty. A link, not a "reply and we'll stop":
 *                  these go out from the platform sender, which is not a
 *                  human-read mailbox the way a rep's own address is, and
 *                  promising a reply nobody reads is a control that appears to
 *                  work and doesn't.
 *
 * FieldQuo's own do-not-contact list (SalesSuppression) is where that opt-out
 * lands, not MarketingSubscriber — that table is a TENANT's relationship with a
 * homeowner, keyed by companyId, and has nothing to do with FieldQuo writing to
 * a prospect.
 */
export const NUDGE_IS_COMMERCIAL = true;

/**
 * The Prisma fragment for "never completed checkout".
 *
 * `isDemo` is deliberately NOT in here, exactly as trialCounting.js keeps it
 * out of its fragments: every platform count spreads its own NOT_DEMO clause,
 * and baking the demo filter into a second place would leave two owners of one
 * rule. `isIncompleteSignup()` below DOES apply it, because a predicate handed
 * a whole row has no second clause to be composed with.
 */
export function incompleteSignupWhere() {
  return { subscription: { is: null } };
}

/** Its complement: a company that reached the end of Stripe Checkout. */
export function completedSignupWhere() {
  return { subscription: { isNot: null } };
}

/**
 * The same rule against a loaded row: { isDemo, subscription: {...} | null }.
 *
 * Throws when `subscription` was not selected, for the reason classifyTrial()
 * gives: `undefined` is not `null`, and a query that forgot the relation must
 * not be read as "this company never paid" — that mistake counts every paying
 * customer as an abandoned signup and would mail all of them.
 */
export function isIncompleteSignup(company) {
  if (!company) return false;
  if (company.isDemo) return false;
  if (company.subscription === undefined) {
    throw new Error(
      "isIncompleteSignup: company.subscription was not selected — cannot " +
        "tell 'never completed checkout' from 'not loaded'",
    );
  }
  return company.subscription === null;
}

/**
 * An email address as the nudge dedupes on it.
 *
 * Lower-cased and trimmed, nothing more. Plus-tags are kept for the reason
 * lib/sales/suppressionRules.js keeps them on the stored value: what somebody
 * gave us is the evidence, and widening happens at lookup. Returns null for
 * anything that is not an address, so "no recipient" is a state rather than an
 * empty string that compares equal to another empty string and merges two
 * strangers into one send.
 */
export function nudgeRecipient(email) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

/**
 * Should this company get the recovery email right now?
 *
 * @param company        { id, isDemo, createdAt, email, subscription,
 *                         signupNudgeSentAt, memberCount }
 * @param suppressed     true when FieldQuo's do-not-contact list closes email
 *                       for this address. Passed in rather than looked up, so
 *                       this stays pure — the caller re-reads the list in the
 *                       same request that sends, which is the rule
 *                       lib/sales/suppression.js states and the reason it
 *                       refuses to cache a verdict.
 * @param siblingNudgedAt the most recent signupNudgeSentAt on ANY OTHER company
 *                       sharing this address, or null.
 * @param now            injectable clock
 *
 * @returns { send: boolean, reason: string }
 */
export function decideSignupNudge({
  company,
  suppressed = false,
  siblingNudgedAt = null,
  now = new Date(),
} = {}) {
  if (!company) return { send: false, reason: "no_company" };

  // Demos first: they are FieldQuo's own sales fixtures, they have no
  // Subscription either, and demo1@fieldquo.com..demo10@fieldquo.com are real
  // deliverable addresses. lib/email/resend.js would simulate the send rather
  // than deliver it, but relying on that is relying on a safety net for
  // something that should never be attempted.
  if (company.isDemo) return { send: false, reason: "demo" };

  // ── The assertion this whole file exists to make ────────────────────────
  //
  // Checked before anything that could return a different refusal for the same
  // row, so "a completed signup was never nudged" is a property of the FIRST
  // branch that can fire rather than a lucky consequence of ordering. Reuses
  // isIncompleteSignup so the throw on an unselected relation is here too:
  // failing loudly beats mailing every paying customer.
  if (!isIncompleteSignup(company)) {
    return { send: false, reason: "completed_checkout" };
  }

  // A company with no Member was not a signup at all. The console's white-glove
  // POST /api/platform/companies creates exactly this shape — a Company row and
  // nothing else — and its own comment says the owner "still needs to complete
  // their own signup". There is nobody to write to and nothing was abandoned.
  // Every one of the ten live rows has exactly one member; all ten demos have
  // none, which is a second, independent reason they can never reach a send.
  if (!(Number(company.memberCount) > 0)) {
    return { send: false, reason: "no_owner" };
  }

  const to = nudgeRecipient(company.email);
  if (!to) return { send: false, reason: "no_recipient" };

  if (suppressed) return { send: false, reason: "suppressed" };

  if (company.signupNudgeSentAt) return { send: false, reason: "already_nudged" };

  // The address, not the row. Four "sunset" companies share one inbox, and a
  // per-row guard would have written to that person four times.
  if (siblingNudgedAt) return { send: false, reason: "address_already_nudged" };

  const created = company.createdAt ? new Date(company.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) {
    // Absence of a date is not a date. Without createdAt there is no way to
    // tell "signed up two minutes ago" from "signed up last spring", and both
    // ends of that range are refusals for different reasons.
    return { send: false, reason: "no_created_at" };
  }

  const ageMs = now.getTime() - created.getTime();
  if (ageMs < NUDGE_DELAY_HOURS * HOUR_MS) return { send: false, reason: "too_early" };
  if (ageMs > NUDGE_WINDOW_DAYS * DAY_MS) return { send: false, reason: "too_late" };

  return { send: true, reason: "due" };
}

/**
 * The whole batch, decided at once.
 *
 * Batch-shaped rather than one-row-at-a-time because the address rule cannot be
 * evaluated a row at a time: when five companies at one inbox are all due in
 * the same run, exactly one email may go out, and the other four must be
 * stamped without being mailed — otherwise tomorrow's run finds them still
 * unstamped and sends the second letter.
 *
 * @param companies           rows, each as decideSignupNudge expects
 * @param suppressedAddresses a Set of normalised addresses the do-not-contact
 *                            list closes for email
 * @param now                 injectable clock
 *
 * @returns { sends: [{ company, to, stampCompanyIds }], skipped: [{ companyId, reason }] }
 *          `stampCompanyIds` includes the mailed company AND every sibling at
 *          the same address, which is exactly what the caller must write in the
 *          same updateMany as the send.
 */
export function planSignupNudges({
  companies = [],
  suppressedAddresses = new Set(),
  now = new Date(),
} = {}) {
  const rows = Array.isArray(companies) ? companies : [];

  // Pass 1: what does each address already know? A stamp on ANY row at an
  // address blocks every row at it, including rows this run has not looked at
  // yet — which is why this cannot be folded into the loop below.
  const nudgedAt = new Map();
  for (const c of rows) {
    const to = nudgeRecipient(c?.email);
    if (!to || !c?.signupNudgeSentAt) continue;
    const at = new Date(c.signupNudgeSentAt);
    if (Number.isNaN(at.getTime())) continue;
    const prev = nudgedAt.get(to);
    if (!prev || at > prev) nudgedAt.set(to, at);
  }

  const sends = [];
  const skipped = [];
  // Addresses this run has already claimed. Two due companies at one inbox get
  // one letter, and the loser is skipped with a reason that says so rather than
  // with a silent `continue`.
  const claimed = new Map();

  // Newest first. When one person has five abandoned attempts, the letter
  // should name the most recent one — that is the business they were actually
  // trying to set up, and the four before it are the retries.
  const ordered = [...rows].sort(
    (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0),
  );

  for (const company of ordered) {
    const to = nudgeRecipient(company?.email);
    const decision = decideSignupNudge({
      company,
      suppressed: to ? suppressedAddresses.has(to) : false,
      siblingNudgedAt: to ? nudgedAt.get(to) || null : null,
      now,
    });

    if (!decision.send) {
      skipped.push({ companyId: company?.id ?? null, reason: decision.reason });
      continue;
    }

    if (claimed.has(to)) {
      claimed.get(to).stampCompanyIds.push(company.id);
      skipped.push({ companyId: company.id, reason: "same_address_this_run" });
      continue;
    }

    const send = { company, to, stampCompanyIds: [company.id] };
    claimed.set(to, send);
    sends.push(send);
  }

  // ── Which siblings get stamped, and which must NOT ──────────────────────
  //
  // A sibling that is a genuine abandoned signup at an address we just wrote to
  // is stamped even though no letter was addressed to it: the person has been
  // contacted about this address, and leaving a lapsed row unstamped would make
  // it "due" again the moment somebody widened NUDGE_WINDOW_DAYS.
  //
  // The list is closed on purpose. A company at the same address that COMPLETED
  // checkout, or a demo, must never be stamped: the column would then say a
  // recovery email covered a paying customer, which is both false and a write
  // to a customer's row for no reason.
  const STAMPABLE = new Set(["too_early", "too_late", "same_address_this_run"]);
  for (const entry of skipped) {
    if (!STAMPABLE.has(entry.reason)) continue;
    const company = rows.find((c) => c?.id === entry.companyId);
    const to = nudgeRecipient(company?.email);
    const send = to ? claimed.get(to) : null;
    if (!send) continue;
    if (!send.stampCompanyIds.includes(company.id)) send.stampCompanyIds.push(company.id);
  }

  return { sends, skipped };
}
