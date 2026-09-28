// lib/platform/cancelOptions.js
//
// What the platform console's "Cancel the subscription" panel may offer for
// ONE company, in words that are true for that company, and what the route
// writes when there is no Stripe subscription to cancel.
//
// ══ Why this exists (2026-09-28) ═══════════════════════════════════════════
//
// The panel offered three modes to every company and the route answered
// "No Stripe subscription on this company — there is nothing to cancel" for
// every company without one. Since 2026-09-24 that is every new company: the
// free trial takes no card and makes no Subscription row. The owner: "if i
// lock the account because of terms break locked immediately it should still
// block the trial". A lock is still possible without Stripe — it is FieldQuo's
// decision about FieldQuo's own relationship with the company — so the panel
// now works for every company and says, per company, what each mode does.
//
// ══ Five kinds, decided from the rows, never from a label ═══════════════════
//
//   stripe      a Subscription with a stripeSubscriptionId. The route's
//               original path, UNCHANGED — the labels below are the exact
//               strings the panel printed before this file existed, and
//               scripts/check-platform-cancel-lock.mjs replays the route
//               against a recording Stripe and database to prove the calls
//               and the write set are byte-identical.
//   trial       no Stripe subscription, trial date still ahead.
//   trial_over  no Stripe subscription, trial date passed (read-only week,
//               or already locked).
//   no_trial    no Stripe subscription and no trial date: a company made by
//               hand, or a legacy Subscription row with no Stripe id. There
//               is no period to wait for, so "at the end" is not offered.
//   demo        FieldQuo's own sales fixture. Refused: there is no customer,
//               nothing is billed (Company.isDemo — "billing never chases
//               them"), and the demo tools reset or retire one.
//
// Pure and import-free on purpose: the client panel imports it to render,
// the route imports it to decide, so the words on the button and the thing
// the button does cannot drift — and a client bundle must never pull in
// lib/billing/access.js (it imports the database).

/** The same three modes as the Stripe path, mildest first. */
export const CANCEL_MODES = Object.freeze(["period_end", "now", "terms"]);
const RANK = { period_end: 0, now: 1, terms: 2 };

/** The read-only window after an ending — lib/billing/access.js CANCELLED_DAYS. */
const READ_ONLY_DAYS_WORD = "thirty";

function toDate(value) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** "Oct 14, 2026" — UTC, so the server and the browser print the same day. */
export function shortDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null;
}

// The exact words the panel printed for a Stripe-subscribed company before
// 2026-09-28. Do not edit: the check compares them with that version.
const STRIPE_MODES = Object.freeze([
  {
    value: "period_end",
    label: "At the end of the paid period",
    consequence: "They keep full access until the date they paid to, then thirty days read-only.",
    button: "Cancel at period end",
  },
  {
    value: "now",
    label: "Now — thirty days read-only, then locked",
    consequence: "Nothing more is charged. Read-only for thirty days from now, then locked.",
    button: "Cancel now",
  },
  {
    value: "terms",
    label: "Terms breach — locked immediately",
    consequence: "Locked immediately — no read-only window. The locked screen says FieldQuo ended it, with your reason.",
    button: "Cancel and lock now",
  },
]);

const TERMS_MODE = Object.freeze({
  value: "terms",
  label: "Terms breach — locked immediately",
  consequence: "Locked immediately — no read-only window. The locked screen says FieldQuo ended it, with your reason.",
  button: "Lock now",
});

/**
 * Which kind of company this is, for this panel.
 *
 * @param company       { isDemo, trialEndsAt }
 * @param subscription  { stripeSubscriptionId } | null — must be passed;
 *                      undefined throws rather than read "not loaded" as
 *                      "no subscription" and offer a Stripe-subscribed
 *                      company the trial path.
 */
export function cancelKind({ company, subscription, now = new Date() } = {}) {
  if (subscription === undefined) {
    throw new Error("cancelKind: subscription was not read — pass null for a company with no Subscription row");
  }
  if (subscription?.stripeSubscriptionId) return "stripe";
  if (company?.isDemo) return "demo";
  const trialEnd = toDate(company?.trialEndsAt);
  if (!trialEnd) return "no_trial";
  // A Subscription row with no Stripe id is not on the card-free trial —
  // access.js reads the row, not the trial date, for it — so its trial
  // date is not a period anybody is waiting for.
  if (subscription) return "no_trial";
  return trialEnd > now ? "trial" : "trial_over";
}

/**
 * Everything the panel renders for one company.
 *
 * @param company       { isDemo, trialEndsAt, platformEndsAt, platformEndMode }
 * @param subscription  { stripeSubscriptionId } | null
 * @param trialAccess   optional { level, daysLeft } — what the trial alone
 *                      allows today (lib/billing/access.js trialAccessFor
 *                      WITHOUT the ending), so an expired trial's "now" can
 *                      say what it changes. Server-side callers pass it.
 * @returns {{ kind, heading, subtitle, refusal, ended, modes: [{ value,
 *            label, consequence, button, available, unavailable }] }}
 */
export function cancelOptions({ company, subscription, trialAccess = null, now = new Date() } = {}) {
  const kind = cancelKind({ company, subscription, now });

  if (kind === "stripe") {
    return {
      kind,
      heading: "Cancel the subscription",
      subtitle: "FieldQuo ends it — from here, not the Stripe dashboard",
      refusal: null,
      ended: null,
      modes: STRIPE_MODES.map((m) => ({ ...m, available: true, unavailable: null })),
    };
  }

  if (kind === "demo") {
    return {
      kind,
      heading: "Cancel the subscription",
      subtitle: "Not for a demo",
      refusal:
        "This is a FieldQuo demo — our own sales fixture, not a customer. Nothing is billed and there is nobody to lock out; reset or retire it from the demo tools instead.",
      ended: null,
      modes: [],
    };
  }

  const trialEnd = toDate(company?.trialEndsAt);
  const endDate = shortDate(trialEnd);
  const noConvert = "No plan can be chosen afterwards — it cannot convert.";

  const modes = [];
  if (kind === "trial") {
    modes.push({
      value: "period_end",
      label: "At the end of the free trial",
      consequence: `Full access until ${endDate}, then ${READ_ONLY_DAYS_WORD} days read-only, then locked. ${noConvert}`,
      button: "End at the trial's end",
    });
  } else {
    modes.push({
      value: "period_end",
      label: kind === "trial_over" ? "At the end of the free trial" : "At the end of the paid period",
      consequence: "",
      button: "End at period end",
      unavailableReason:
        kind === "trial_over"
          ? `The free trial already ended on ${endDate} — there is no period left to wait for.`
          : "No free trial and no Stripe subscription on this company — there is no period to wait for.",
    });
  }

  let nowConsequence;
  if (kind === "trial") {
    nowConsequence = `The trial ends now. Read-only for ${READ_ONLY_DAYS_WORD} days from now, then locked. ${noConvert}`;
  } else if (kind === "trial_over") {
    const today =
      trialAccess?.level === "readonly"
        ? `it is read-only for ${trialAccess.daysLeft} more day${trialAccess.daysLeft === 1 ? "" : "s"}`
        : trialAccess?.level === "locked"
          ? "it is already locked"
          : "it is past its trial";
    nowConsequence =
      `Its trial ended on ${endDate} and ${today}. Ending it now gives ${READ_ONLY_DAYS_WORD} days read-only from now` +
      ` (the window a cancelled subscription gets), then locked. ${noConvert}`;
  } else {
    nowConsequence = `Nothing is charged — there is no Stripe subscription. Read-only for ${READ_ONLY_DAYS_WORD} days from now, then locked. ${noConvert}`;
  }
  modes.push({
    value: "now",
    label: `Now — ${READ_ONLY_DAYS_WORD} days read-only, then locked`,
    consequence: nowConsequence,
    button: kind === "no_trial" ? "End now" : "End the trial now",
  });
  modes.push({ ...TERMS_MODE });

  // ── Already ended by FieldQuo ─────────────────────────────────────────
  // A second press may only TIGHTEN (the Stripe path allows terms on a
  // subscription already cancelled, and nothing else): period_end → now or
  // terms, now → terms. Nothing loosens an ending — there is no reinstate.
  const endedMode = company?.platformEndMode && RANK[company.platformEndMode] !== undefined ? company.platformEndMode : null;
  const endedAt = toDate(company?.platformEndsAt);
  const ended = endedAt ? { mode: endedMode, endsAt: endedAt } : null;
  let refusal = null;
  if (ended) {
    const said =
      endedMode === "terms"
        ? `Locked by FieldQuo on ${shortDate(endedAt)} for a terms breach.`
        : endedMode === "period_end"
          ? `Ending by FieldQuo: full access until ${shortDate(endedAt)}, then ${READ_ONLY_DAYS_WORD} days read-only.`
          : `Ended by FieldQuo on ${shortDate(endedAt)}: ${READ_ONLY_DAYS_WORD} days read-only from then, then locked.`;
    if (endedMode === "terms" || !endedMode) {
      refusal = `${said} There is no reinstate control yet.`;
    } else {
      ended.note = `${said} Only a stricter ending can be chosen now.`;
    }
    for (const m of modes) {
      if (!m.unavailableReason && endedMode && RANK[m.value] <= RANK[endedMode]) {
        m.unavailableReason = m.value === endedMode ? "Already chosen." : "Looser than the ending already set.";
      }
    }
  }

  const heading =
    kind === "no_trial" ? "End this company's access" : "Cancel the free trial";
  const subtitle =
    kind === "no_trial"
      ? "No Stripe subscription — FieldQuo ends access from here"
      : "No Stripe subscription yet — FieldQuo ends the trial from here";

  return {
    kind,
    heading,
    subtitle,
    refusal,
    ended,
    modes: modes.map(({ unavailableReason, ...m }) => ({
      ...m,
      available: !refusal && !unavailableReason,
      unavailable: refusal ? "See above." : unavailableReason || null,
    })),
  };
}

/**
 * What the route writes for a company with NO Stripe subscription, or why
 * it refuses. Pure; the route re-reads the rows fresh on every press and
 * passes them here, so a stale panel cannot write a looser ending.
 *
 * @returns { error, status } | { data, access, previous }
 *   data     the Company columns to write (platformEndsAt / Mode / Reason)
 *   access   one line for the panel's success message
 */
export function planFieldquoEnd({ company, subscription, mode, reason, trialAccess = null, now = new Date() } = {}) {
  if (!company) return { error: "Not found", status: 404 };
  if (!CANCEL_MODES.includes(mode)) return { error: `Say how: ${CANCEL_MODES.join(", ")}.`, status: 400 };
  const options = cancelOptions({ company, subscription, trialAccess, now });
  if (options.kind === "stripe") {
    // Never reached from the route (it takes the Stripe path first); said so
    // rather than silently writing Company columns beside a live Stripe
    // subscription, which access.js would then read FIRST.
    return { error: "This company has a Stripe subscription — the Stripe path cancels it.", status: 409 };
  }
  if (options.refusal) return { error: options.refusal, status: 409 };
  const chosen = options.modes.find((m) => m.value === mode);
  if (!chosen?.available) {
    return { error: chosen?.unavailable || "That ending is not available for this company.", status: 409 };
  }
  const text = String(reason || "").trim().slice(0, 500);
  const trialEnd = toDate(company.trialEndsAt);
  const endsAt = mode === "period_end" ? trialEnd : now;
  if (!endsAt) return { error: "No trial date to end at.", status: 409 };
  const access =
    mode === "terms"
      ? "locked now — no read-only window; automatic top-up switched off; numbers released by the rent run; prepaid balance left as it is; no plan can be chosen"
      : mode === "now"
        ? `${READ_ONLY_DAYS_WORD} days read-only from now, then locked; no plan can be chosen`
        : `full access until ${shortDate(endsAt)}, then ${READ_ONLY_DAYS_WORD} days read-only, then locked; no plan can be chosen`;
  return {
    kind: options.kind,
    data: { platformEndsAt: endsAt, platformEndMode: mode, platformEndReason: text },
    access,
    previous: company.platformEndMode
      ? { mode: company.platformEndMode, endsAt: toDate(company.platformEndsAt), reason: company.platformEndReason || null }
      : null,
  };
}
