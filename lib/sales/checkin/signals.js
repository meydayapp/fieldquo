// lib/sales/checkin/signals.js
//
// When does a company a rep signed up need a check-in, and what is the honest
// reason for it?
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// A rep's first job is the signup. Their second is that the company is still
// there at the retention milestone — that is the third and largest commission
// (`SalesCommissionPlan.retentionCents`), and it is the only one the rep can
// still influence after the ink is dry. Sixty days is a long time to remember
// thirty companies by hand, so this file remembers for them: who to text, in
// what order, and on what evidence.
//
// ══ The evidence is superficial ON PURPOSE ════════════════════════════════
//
// Everything below is read from what the sales console can already see — the
// row set `GET /api/sales/companies` returns, plus the same setup-step signals
// the company's own dashboard shows them. A rep is not reading a customer's
// quotes to write a "how's it going" text, and nothing here asks them to. That
// is also the boundary that keeps this compatible with non-negotiable #3: the
// platform side looks, it does not touch.
//
// ══ Absence of a statement is not a statement ═════════════════════════════
//
// AGENTS.md failure class #5, and it is the whole reason `unknown_state`
// exists. A company whose setup snapshot failed to load, or whose subscription
// row we could not read, is NOT healthy — it is unmeasured, and the two have
// to be different words on the rep's screen or the rep will read silence as
// good news. `setupFacts(null)` is therefore not the same as `setupFacts([])`,
// and a decision can never carry both `all_good` and `unknown_state`.
//
// ══ Pure over rows the caller has already read ════════════════════════════
//
// The pattern lib/sales/calls/inboundDistribution.js sets: no database, no
// clock of its own, no model. The caller reads the company row, the plan's
// retentionDays and the setup snapshot; this file decides. That is what lets
// scripts/check-sales-checkin.mjs drive every branch — day 59, day 61, a
// cancelled subscription, a demo company, a null signup date — against
// fixtures, months before the first company is actually attributed to anybody.

/**
 * The two scheduled touchpoints, set by the owner.
 *
 *   "i think a good amount should be 1 day after they sign up to see if they
 *    have any questions and make sure they completed the onboarding process.
 *    and 7 days after they sign up ... to see if everything is okay."
 *
 * They do different jobs, which is why they are two entries rather than a
 * repeat of one:
 *
 *   DAY 1 is about SETUP. Did anything stop them finishing? A person who hit a
 *          wall on their first evening will not come back to it on their own,
 *          and by day three they have decided the product is hard.
 *   DAY 7 is about USE. They have had a working week to try it on a real job,
 *          so "is everything okay" is finally a question with an answer.
 *
 * This replaces a single "not before day 3" rule. That rule reasoned that
 * texting on day one is a sales call wearing a check-in's clothes — true if
 * the message is "how are you finding it", and not true of "did you get
 * everything set up", which is the one thing a person on day one can answer.
 * The day-1 text is aimed at setup for exactly that reason.
 */
export const SCHEDULED_CHECKIN_DAYS = Object.freeze([1, 7]);

/**
 * The smallest gap between two texts to one company, scheduled or not.
 *
 * Shorter than the reason-driven cadence guard on purpose — the touchpoints
 * are six days apart and that guard is fifteen — but not zero, because two
 * texts in three days is how a contractor learns to ignore the number.
 */
export const SCHEDULED_MIN_GAP_DAYS = 3;

/**
 * How long a missed touchpoint stays worth sending.
 *
 * A day-7 "how is your first week going" delivered on day 61 is not a
 * check-in, it is evidence that nobody was watching. Past this the touchpoint
 * lapses and the reason-driven rules take over — which, for a company that far
 * in, is the right conversation anyway.
 *
 * Caught by the check: without this bound the scheduled path outranked the
 * milestone-passed suppression and a company two months old with no contact
 * was reported as owed its first-week text.
 */
export const SCHEDULED_GRACE_DAYS = 14;

/**
 * How long we wait before the FIRST check-in.
 *
 * Now the first scheduled day, kept as its own export because callers and the
 * check read it by name. Deriving it rather than restating it means the two
 * cannot drift apart.
 */
export const FIRST_CHECKIN_DAY = SCHEDULED_CHECKIN_DAYS[0];

/** Below this many days to the milestone, "just checking in" earns its place. */
export const RETENTION_NEAR_DAYS = 14;

/**
 * A reason at or above this urgency is a PROBLEM rather than a courtesy, and
 * is the only thing that keeps a company due after the milestone has passed.
 */
export const PROBLEM_URGENCY = 60;

/** The floor and ceiling on the cadence guard, whatever the plan says. */
export const MIN_GAP_FLOOR_DAYS = 7;
export const MIN_GAP_CEILING_DAYS = 30;

/**
 * Is this one of the two SCHEDULED touchpoints, and is it still outstanding?
 *
 * Consulted BEFORE the cadence guard, and that order is the whole point. The
 * guard is fifteen days on a sixty-day plan; the two touchpoints are six days
 * apart, so a guard applied first would swallow the day-7 text entirely — and
 * it would do it silently, leaving a feature that looks like it is working
 * because day 1 still fires.
 *
 * "Outstanding" is measured against the last check-in, not against a stored
 * schedule. A company texted on day 3 for a failing card has HAD its day-1
 * conversation; texting again on day 7 because a calendar says so is how a
 * contractor starts ignoring the number. So a touchpoint is due when the day
 * has arrived and nothing has been sent since the touchpoint before it.
 *
 * @returns the day number that is due, or null.
 */
export function scheduledCheckinDue({ dayInLife, lastCheckInDaysAgo } = {}) {
  const day = Number(dayInLife);
  if (!Number.isFinite(day)) return null;

  for (const touchpoint of [...SCHEDULED_CHECKIN_DAYS].sort((a, b) => b - a)) {
    if (day < touchpoint) continue;

    // Long past, and therefore no longer this touchpoint's question.
    if (day - touchpoint > SCHEDULED_GRACE_DAYS) return null;

    // Nothing ever sent: the LATEST touchpoint that has arrived, not the
    // earliest. A company nine days in with no contact should get "how is it
    // going" — asking whether they finished setting up yesterday, eight days
    // after yesterday, reads as a message sent by a machine that has not
    // looked at them.
    if (lastCheckInDaysAgo === null || lastCheckInDaysAgo === undefined) return touchpoint;

    // Sent before this touchpoint came round? Then it is still outstanding.
    const daysSinceTouchpoint = day - touchpoint;
    if (lastCheckInDaysAgo <= daysSinceTouchpoint) return null;

    // ── Breathing room, even for a scheduled touchpoint ────────────────
    //
    // Day 7 arriving two days after a text about a failing card is still two
    // texts in one week. The touchpoint is not lost — it stays outstanding and
    // fires once this gap has passed — but a contractor who hears from us
    // twice in three days starts ignoring the number, and then neither message
    // works.
    if (lastCheckInDaysAgo < SCHEDULED_MIN_GAP_DAYS) return null;

    return touchpoint;
  }
  return null;
}

/**
 * The cadence guard: the minimum gap between two check-ins to one company.
 *
 * A QUARTER OF THE RETENTION WINDOW — 15 days on today's 60-day plan. Derived
 * rather than hardcoded for the same reason the milestone itself is read from
 * the plan: `retentionDays` is a policy the platform console can change, and a
 * fixed fortnight against a 30-day window would be two texts in a month while
 * the same fortnight against a 180-day window would be twelve. A quarter means
 * roughly three or four contacts across the window whatever the window is,
 * which is attentive; a fifth would be nagging and a half would be absent.
 *
 * Clamped at both ends because arithmetic on an extreme plan produces an
 * absurd gap: a 1-day retention window would otherwise permit a text every six
 * hours, and a ten-year one would permit one text per presidency.
 *
 * @param {number} retentionDays  from the rep's SalesCommissionPlan.
 * @returns {number} whole days.
 */
export function minGapDays(retentionDays) {
  const window = Number(retentionDays);
  if (!Number.isFinite(window) || window <= 0) return MIN_GAP_CEILING_DAYS;
  const quarter = Math.round(window / 4);
  return Math.min(MIN_GAP_CEILING_DAYS, Math.max(MIN_GAP_FLOOR_DAYS, quarter));
  // NOTE: this guard governs the REASON-DRIVEN check-ins only. The two
  // scheduled touchpoints are six days apart and would be swallowed by it —
  // see scheduledCheckinDue(), which is consulted before the guard for exactly
  // that reason. A guard that silently ate the day-7 text would look like the
  // feature working.
}

/**
 * The closed set of reasons a check-in can have.
 *
 * Closed, and not free text, for the reason lib/ai/platformUsage.js's
 * BUDGET_REFUSALS gives: a code gets counted, compared and switched on, and
 * English does not. `angle` is the customer-facing intent — what the rep is
 * actually trying to find out — and it is what the drafter turns into a
 * sentence. `headline` is for the rep's own screen.
 *
 * `urgency` orders a rep's thirty companies. The ordering is the product here:
 * a card failing today outranks a setup step outstanding since Tuesday, and
 * "everything looks fine, say hello" comes last without disappearing.
 */
export const CHECKIN_REASONS = Object.freeze({
  payment_failing: {
    urgency: 90,
    headline: "Their subscription payment is failing",
    // Not a sales problem — an operational one they may genuinely not have
    // seen, because a failed card notice looks like every other billing email.
    angle: "make sure they know their payment did not go through, before it lapses",
  },
  trial_ends_before_retention: {
    urgency: 80,
    headline: "Their free period ends before the retention date",
    angle: "check they know what happens when the free period ends, and that they want it to continue",
  },
  payments_not_connected: {
    urgency: 60,
    headline: "They cannot take a payment yet",
    // `chargesEnabled` is Stripe Connect saying money can move. It is the one
    // measurable fact standing between a contractor and getting paid through
    // the product, so a company sixty days in without it is a company using
    // half of what they bought.
    angle: "offer to finish connecting payouts so they can get paid through the app",
  },
  onboarding_unfinished: {
    urgency: 55,
    headline: "They never finished onboarding",
    angle: "offer to walk them through the last of the setup",
  },
  setup_steps_outstanding: {
    urgency: 40,
    headline: "Set-up steps are still open on their dashboard",
    // The owner's own example: "if they didn't complete all the on-boarding
    // steps or if they completed those additional list of tips we created".
    angle: "mention the steps still open and offer to help with them",
  },
  retention_milestone_near: {
    urgency: 35,
    headline: "The retention milestone is close",
    angle: "make sure nothing is quietly wrong before the milestone",
  },
  unknown_state: {
    urgency: 30,
    headline: "We cannot see how they are doing",
    // Deliberately ABOVE all_good. Not knowing is a worse position to be in
    // than knowing things are fine, and the ordering has to say so.
    angle: "ask how it is going, because we have nothing to go on",
  },
  all_good: {
    urgency: 10,
    headline: "Nothing looks wrong",
    // A legitimate reason, not a problem dressed up as one. The owner asked
    // for "if everything is good type of thing" in as many words.
    angle: "just checking in — no problem to raise",
  },
});

export const REASON_CODES = Object.freeze(Object.keys(CHECKIN_REASONS));

/**
 * The headline for one reason, in the rep's own language.
 *
 * ── Why `headline` is keyed and `angle` is not ────────────────────────────
 *
 * They go to different readers. `headline` is for the rep's own screen — it is
 * what /sales/messages prints above the company's card — and a rep on Spanish
 * was reading all eight of them in English. `angle` is not read by anybody: it
 * is an instruction to the DRAFTER, fed into a prompt, and what language it is
 * in is a question about how the model writes, not about what a rep sees. The
 * comment on CHECKIN_REASONS says as much already ("`angle` is the
 * customer-facing intent … `headline` is for the rep's own screen"), and this
 * split honours it rather than translating both and hoping.
 *
 * Derived from the code, so a ninth reason cannot ship without a key. The
 * English headline travels as the fallback.
 */
export function checkinHeadlineKey(code) {
  return REASON_CODES.includes(code) ? `app.salesCheckin.reason.${code}` : null;
}

/** Every key checkinHeadlineKey() can return. Asserted against the catalogue. */
export const CHECKIN_HEADLINE_KEYS = REASON_CODES.map(
  (code) => `app.salesCheckin.reason.${code}`,
);

/**
 * Why a company that might otherwise be due is not.
 *
 * Separate from the reasons because these are statements about US, not about
 * them: nothing here belongs in a message, and the screen renders them as the
 * explanation for an absent row.
 */
export const SUPPRESSIONS = Object.freeze({
  demo_company: "A demo company. There is nobody on the other end of the phone.",
  signup_date_unknown: "We do not know when they signed up, so we cannot say whether a check-in is due.",
  subscription_ended: "Their subscription has ended. A check-in is the wrong contact for this.",
  too_soon: "They only just signed up.",
  recently_checked_in: "They were checked in on recently.",
  milestone_passed: "The retention window has passed and nothing is wrong.",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Date, or null for anything that is not one. Never "today" as a guess. */
function asDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days from `from` to `to`, or null when either end is unknown. */
function daysBetween(from, to) {
  const a = asDate(from);
  const b = asDate(to);
  if (!a || !b) return null;
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * The setup-step half of the evidence, in the shape this file wants.
 *
 * @param steps  the array `stepsFor(await loadSetupSnapshot(companyId))`
 *               returns, or NULL when that load failed or was never attempted.
 *
 * The null case is the point of this function. `stepsFor({})` happily returns
 * ten steps all marked not-done, which is indistinguishable from a real
 * company that has done nothing — so a caller that swallows a snapshot error
 * and passes `stepsFor({})` would report a thriving company as neglected, and
 * a caller that passes `[]` would report an unmeasured one as perfect. Passing
 * null says "not measured", and not measured produces `unknown_state`.
 *
 * @returns {{measured:boolean, remainingCount:number|null, remainingTitles:string[], doneCount:number|null, total:number|null}}
 */
export function setupFacts(steps) {
  if (!Array.isArray(steps)) {
    return { measured: false, remainingCount: null, remainingTitles: [], doneCount: null, total: null };
  }
  const remaining = steps.filter((s) => s && !s.done && !s.dismissed);
  return {
    measured: true,
    remainingCount: remaining.length,
    // Two at most. A text message naming six chores is a to-do list, and the
    // person receiving it did not ask for one.
    remainingTitles: remaining.slice(0, 2).map((s) => String(s.title || s.key || "")).filter(Boolean),
    doneCount: steps.filter((s) => s?.done).length,
    total: steps.length,
  };
}

/**
 * Decide whether one attributed company needs a check-in, and why.
 *
 * @param {object}      company        exactly the shape GET /api/sales/companies
 *                                     emits: `{ id, name, signedUpAt, isDemo,
 *                                     chargesEnabled, onboardingCompletedAt,
 *                                     subscriptionStatus, attributedAt,
 *                                     attributionSource }`. Read there, decided
 *                                     here.
 * @param {Array|null}  setup          `stepsFor(snapshot)` output, or null when
 *                                     it could not be read. See setupFacts.
 * @param {Date|string|null} lastCheckInAt  when this rep last checked in on this
 *                                     company. Null means never.
 * @param {number}      retentionDays  the ACTIVE plan's `retentionDays`. Required
 *                                     — there is deliberately no default, because
 *                                     a wrong window silently misdates every
 *                                     milestone calculation on the screen.
 * @param {Date|string|null} trialEndsAt  optional. When the caller has selected
 *                                     `Subscription.trialEndsAt`, a free period
 *                                     ending before the milestone becomes its own
 *                                     reason. When it is not selected, that
 *                                     reason is simply not raised — it is not
 *                                     guessed from the status.
 * @param {Date}        now            injectable, so every window is executable.
 *
 * @returns {{
 *   companyId: string|null,
 *   companyName: string|null,
 *   contactable: boolean,
 *   due: boolean,
 *   suppressed: {code:string, text:string}|null,
 *   nextEligibleAt: Date|null,
 *   urgency: number,
 *   reasons: Array<{code:string, urgency:number, headline:string, angle:string}>,
 *   primary: {code:string, urgency:number, headline:string, angle:string}|null,
 *   dayInLife: number|null,
 *   daysToRetention: number|null,
 *   retentionDate: Date|null,
 *   retentionDays: number|null,
 *   minGapDays: number,
 *   facts: object
 * }}
 */
export function checkInSignals({
  company = null,
  setup = null,
  lastCheckInAt = null,
  retentionDays = null,
  trialEndsAt = null,
  now = new Date(),
} = {}) {
  const c = company || {};
  const signedUpAt = asDate(c.signedUpAt);
  const gap = minGapDays(retentionDays);
  const window = Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0 ? Number(retentionDays) : null;

  const dayInLife = signedUpAt ? daysBetween(signedUpAt, now) : null;
  const retentionDate = signedUpAt && window ? new Date(signedUpAt.getTime() + window * DAY_MS) : null;
  const daysToRetention = retentionDate ? daysBetween(now, retentionDate) : null;
  const lastCheckIn = asDate(lastCheckInAt);
  const lastCheckInDaysAgo = lastCheckIn ? daysBetween(lastCheckIn, now) : null;

  const setupInfo = setupFacts(setup);
  const status = typeof c.subscriptionStatus === "string" && c.subscriptionStatus ? c.subscriptionStatus : null;
  // `=== false` rather than falsy, three times over. `null` is "we did not
  // read it" and `false` is "Stripe says no"; collapsing them would turn every
  // unread column into an accusation.
  const paymentsConnected = c.chargesEnabled === true ? true : c.chargesEnabled === false ? false : null;
  const onboardingCompletedAt = asDate(c.onboardingCompletedAt);
  // Three states, not two. An absent KEY is "we did not select that column";
  // an explicit null is "the company has not finished"; anything that is
  // neither a date nor null is unreadable, and unreadable is not incomplete.
  const onboardingComplete = onboardingCompletedAt
    ? true
    : c.onboardingCompletedAt === null
      ? false
      : null;

  const facts = {
    companyName: typeof c.name === "string" && c.name.trim() ? c.name.trim() : null,
    dayInLife,
    daysToRetention,
    onboardingComplete,
    paymentsConnected,
    setupMeasured: setupInfo.measured,
    setupRemainingCount: setupInfo.remainingCount,
    setupRemainingTitles: setupInfo.remainingTitles,
    subscriptionStatus: status,
    lastCheckInDaysAgo,
  };

  const base = {
    companyId: c.id ?? null,
    companyName: facts.companyName,
    contactable: c.isDemo !== true,
    due: false,
    suppressed: null,
    nextEligibleAt: null,
    urgency: 0,
    reasons: [],
    primary: null,
    dayInLife,
    daysToRetention,
    retentionDate,
    retentionDays: window,
    minGapDays: gap,
    facts,
  };

  const suppress = (code, extra = {}) => ({
    ...base,
    ...extra,
    due: false,
    suppressed: { code, text: SUPPRESSIONS[code] || code },
  });

  // ── The two hard exclusions, before any reason is computed ──────────────
  //
  // A demo company has no owner, no phone and no opinion; lib/demo/seedDemo.js
  // makes it for a rep to show, not for a rep to text. This is the FIRST test
  // in the function so that no later branch can talk itself into a message.
  if (c.isDemo === true) return suppress("demo_company", { contactable: false });

  // No signup date means the window, the cadence and the milestone are all
  // undecidable. Reporting "day 0" would be inventing the one number every
  // other answer here is derived from — so it says it cannot tell, and the
  // rep decides. (This is a data fault, and the screen should show it as one.)
  if (!signedUpAt) return suppress("signup_date_unknown");

  // A cancelled subscription is not a check-in. "How's it going?" to somebody
  // who left reads as either oblivious or as a win-back pretending not to be
  // one, and a win-back is a different conversation with different words. The
  // rep still sees the row and its status; nothing here drafts for it.
  if (status === "canceled" || status === "incomplete_expired") return suppress("subscription_ended");

  // ── The reasons ─────────────────────────────────────────────────────────
  const reasons = [];
  const add = (code) => {
    const spec = CHECKIN_REASONS[code];
    if (spec) reasons.push({ code, ...spec });
  };

  if (status === "past_due" || status === "unpaid" || status === "incomplete") add("payment_failing");

  // Before the milestone AND soon. The second half arrived when the backlog
  // made day-1 drafts reachable: on a 60-day plan with a 30-day free month,
  // EVERY company's trial ends before the milestone, so every day-1 text —
  // written for "did you get set up" — opened with "Your free period is
  // coming to an end soon" instead, twenty-nine days early. The wording says
  // soon; the rule now means it, by the same fortnight the milestone itself
  // counts as near.
  const trialEnd = asDate(trialEndsAt);
  if (
    trialEnd &&
    retentionDate &&
    trialEnd.getTime() < retentionDate.getTime() &&
    trialEnd.getTime() >= now.getTime() &&
    trialEnd.getTime() - now.getTime() <= RETENTION_NEAR_DAYS * DAY_MS
  ) {
    add("trial_ends_before_retention");
  }

  if (paymentsConnected === false) add("payments_not_connected");
  if (onboardingComplete === false) add("onboarding_unfinished");
  if (setupInfo.measured && setupInfo.remainingCount > 0) add("setup_steps_outstanding");
  if (daysToRetention !== null && daysToRetention >= 0 && daysToRetention <= RETENTION_NEAR_DAYS) {
    add("retention_milestone_near");
  }

  // Anything we could not read at all. Added ALONGSIDE the problems we did
  // find, not instead of them: "their card is failing and we cannot see their
  // setup" is two facts and the rep should have both.
  const blind =
    !setupInfo.measured || paymentsConnected === null || onboardingComplete === null || status === null;
  if (blind) add("unknown_state");

  // The honest "everything looks fine". Only reachable when every input was
  // actually measured — which is why it is tested against `blind` and not
  // against `reasons.length`. A nearby milestone does not stop a company being
  // fine, so it does not block this.
  if (!blind && reasons.every((r) => r.code === "retention_milestone_near")) add("all_good");

  reasons.sort((a, b) => b.urgency - a.urgency);
  const urgency = reasons.length ? reasons[0].urgency : 0;
  const withReasons = { ...base, reasons, primary: reasons[0] || null, urgency };

  // ── The cadence guard: never nag ────────────────────────────────────────
  //
  // Absolute. Not overridable by urgency, and deliberately so: a rep who texts
  // twice in a week because the engine found a second reason has still texted
  // twice in a week, and the contractor cannot see the reasoning. The reasons
  // are still returned, so the screen can show WHY it wants to and WHEN it may.
  // ── The two scheduled touchpoints come first ──────────────────────────
  //
  // Day 1 (did you get set up) and day 7 (is it working) are not reason-driven
  // and must outrank both the cadence guard below and the too-soon rule: the
  // guard is longer than the space between them, and "too soon" was written
  // when the first check-in was day 3.
  const scheduledDay = scheduledCheckinDue({ dayInLife, lastCheckInDaysAgo });
  if (scheduledDay !== null) {
    return {
      ...withReasons,
      due: true,
      suppressed: null,
      scheduledDay,
      nextEligibleAt: null,
    };
  }

  if (lastCheckIn && lastCheckInDaysAgo !== null && lastCheckInDaysAgo < gap) {
    return {
      ...suppress("recently_checked_in", withReasons),
      nextEligibleAt: new Date(lastCheckIn.getTime() + gap * DAY_MS),
    };
  }

  if (dayInLife !== null && dayInLife < FIRST_CHECKIN_DAY) {
    return {
      ...suppress("too_soon", withReasons),
      nextEligibleAt: new Date(signedUpAt.getTime() + FIRST_CHECKIN_DAY * DAY_MS),
    };
  }

  // Past the milestone, the routine check-in stops. The commission is settled,
  // and a rep's list should empty out rather than accumulate every company
  // they ever signed. A real problem still gets through — a failing card at
  // day 90 is worth a text whether or not anybody gets paid for it.
  if (daysToRetention !== null && daysToRetention < 0 && urgency < PROBLEM_URGENCY) {
    return suppress("milestone_passed", withReasons);
  }

  return { ...withReasons, due: reasons.length > 0 };
}

/**
 * Sort order for a rep looking at thirty companies: who first?
 *
 * Due before not-due, then urgency, then whoever is running out of window
 * soonest. Stable on companyId so two identical rows do not swap places
 * between renders.
 */
export function compareCheckIns(a, b) {
  if ((b?.due ? 1 : 0) !== (a?.due ? 1 : 0)) return (b?.due ? 1 : 0) - (a?.due ? 1 : 0);
  if ((b?.urgency || 0) !== (a?.urgency || 0)) return (b?.urgency || 0) - (a?.urgency || 0);
  const at = a?.daysToRetention;
  const bt = b?.daysToRetention;
  // A company with no window sorts after one that has one: it is not urgent,
  // it is unmeasurable, and pretending it is due tomorrow would be inventing.
  const an = at === null || at === undefined ? Number.POSITIVE_INFINITY : at;
  const bn = bt === null || bt === undefined ? Number.POSITIVE_INFINITY : bt;
  if (an !== bn) return an - bn;
  return String(a?.companyId || "").localeCompare(String(b?.companyId || ""));
}

/** The rep's queue: every decision, hardest first. Does not drop the not-due. */
export function rankCheckIns(decisions) {
  return (Array.isArray(decisions) ? [...decisions] : []).sort(compareCheckIns);
}
