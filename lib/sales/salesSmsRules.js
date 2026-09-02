// lib/sales/salesSmsRules.js
//
// What a sales text says, and every reason one must not go out — with no
// database and no Twilio in any of it.
//
// ══ Why the rules are a separate, pure module ══════════════════════════════
//
// The same argument lib/sales/outreachReadiness.js makes for the email side,
// and it applies harder here. A text costs money at the carrier, arrives on a
// phone in somebody's pocket, and is the one channel where a mistake is
// irreversible in the most literal way — there is no "recall" and no spam
// folder to land in quietly. So every reason to refuse is a plain function
// executed against hostile input by scripts/check-sales-sms.mjs, rather than a
// branch inside an async function that needs Postgres and a Twilio account to
// reach.
//
// The screen asks this, the send route asks this again at request time, and
// both get the same answer from the same function — which is what stops the
// compose panel being a control that appears to work and doesn't.
//
// ══ CASL, in the message rather than in a policy document ══════════════════
//
// CASL treats a commercial text exactly as it treats a commercial email: it
// must identify the sender, carry a mailing address, and offer a working
// unsubscribe. lib/sales/outreach.js's caslFooterLines() does this for email
// and this is its SMS counterpart — deliberately not a call into that function,
// because an email footer is three lines of prose and an SMS has to say the
// same four things inside a couple of segments. Same obligation, different
// medium, and pretending one rendering serves both is how the address ends up
// truncated off the end of a text.
//
// The unsubscribe is STOP. That is not decoration: app/api/sms/inbound handles
// it, lib/sales/salesSms.js writes the suppression, and
// scripts/check-sales-sms.mjs asserts the whole path. A "Reply STOP" line with
// nothing listening behind it is the exact bug AGENTS.md opens with, and this
// repo has shipped it before — see app/api/sms/inbound/route.js's own header.

import { normalisePhone } from "./suppressionRules";
import { describeSalesSmsWindow, withinSalesSmsHours } from "./smsWindow";

/**
 * Is this a number FieldQuo's sales operation is allowed to text?
 *
 * +1 only. Not a technical limit — Twilio will happily deliver to +44 — but a
 * compliance one. Everything FieldQuo has established about texting strangers
 * is North American: CASL because it is a Canadian company, the TCPA window
 * because it is registered in the US, an internal do-not-call list retained for
 * three years and fourteen days because Canada's rules say so. A text to a UK
 * number is governed by PECR and the UK GDPR, which nothing here has been
 * checked against, and "it went through" is not the same as "it was allowed".
 *
 * Refusing is also the honest failure: the rep is told why, rather than the
 * message going out under rules nobody has read.
 */
export function isNorthAmerican(e164) {
  return typeof e164 === "string" && /^\+1\d{10}$/.test(e164);
}

/** How many GSM-7 segments a body of this length occupies. */
export function smsSegments(body) {
  const len = String(body ?? "").length;
  if (len === 0) return 0;
  // 160 for a single message, 153 each once it is concatenated — the extra
  // seven characters are the concatenation header the carrier adds to every
  // part. Getting this wrong under-reports what a send costs, which is the
  // only direction that matters for a number the platform console reports.
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

/**
 * The one message this feature sends.
 *
 * Deliberately fixed rather than composed by the rep. The rep already has a
 * free-text channel — email — with a compose box and a footer builder. A
 * free-text SMS would need the same CASL footer on every send with no way to
 * stop somebody deleting it from the box, and the thing being sent here is one
 * specific artefact: their own signup link. So the rep chooses WHO and WHEN,
 * and the message says what it has to say.
 *
 * Throws rather than returning a half-built message when an input is missing,
 * because every caller has already run the readiness check that refuses those
 * inputs — reaching here without them is a programming error, not a user one.
 */
export function signupLinkSmsBody({ repName, signupLink, mailingAddress } = {}) {
  const name = String(repName ?? "").trim();
  const link = String(signupLink ?? "").trim();
  const address = String(mailingAddress ?? "").trim();

  if (!name) throw new Error("A sales text has to name the person sending it.");
  if (!link) throw new Error("A sales text with no signup link has nothing to say.");
  if (!address) {
    throw new Error(
      "A sales text needs FieldQuo's mailing address — CASL requires it in every commercial message.",
    );
  }

  // Identification first, because that is what a stranger reads in the
  // notification preview and decides on. The address and the STOP line come
  // last, where a longer address cannot push the link out of the first segment.
  return (
    `${name} here, from FieldQuo — here's the link we talked about: ${link} ` +
    `FieldQuo, ${address}. Reply STOP to opt out.`
  );
}

/**
 * Every reason this text must not go out, in the order a person can act on.
 *
 * Config problems first (somebody at FieldQuo has to fix them), then the
 * prospect's own state (the rep can fix some of it), then the clock.
 *
 * @param repName          the rep's own name, which the message identifies
 * @param signupLink       from repStats.signupLinkFor — never rebuilt here
 * @param fromNumber       FieldQuo's sales number, or null when it holds none
 * @param mailingAddress   SALES_MAILING_ADDRESS. No default, ever.
 * @param twilioConfigured whether the deployment can reach Twilio at all
 * @param leadPhone        as the rep typed it; normalised here
 * @param leadTimeZone     the prospect's IANA zone, or null
 * @param suppression      { suppressed, reason } read FRESH by the caller, or
 *                         null when the list could not be read — which blocks,
 *                         see below
 * @param now              injectable so the window is executable
 *
 * @returns { canSend, blockers[], warnings[], to, from, body }
 *          Every blocker carries a `fix` written for whoever has to perform it.
 */
export function salesSmsReadiness({
  repName,
  signupLink,
  fromNumber,
  mailingAddress,
  twilioConfigured = true,
  leadPhone,
  leadTimeZone,
  suppression,
  now = new Date(),
} = {}) {
  const blockers = [];
  const warnings = [];

  // ── FieldQuo's side ──────────────────────────────────────────────────────

  if (!twilioConfigured) {
    blockers.push({
      code: "twilio_unconfigured",
      title: "Twilio credentials aren't set on this deployment.",
      fix: "Set TWILIO_ACCOUNT_SID and either TWILIO_AUTH_TOKEN or the API key pair.",
    });
  }

  if (!fromNumber) {
    blockers.push({
      code: "no_sales_number",
      title: "FieldQuo holds no sales number to text from.",
      fix:
        "Buy one in the platform console under Crew lines, with the purpose set " +
        "to “Sales”. It must be its own number: the system number sends on " +
        "behalf of contractors, so a STOP arriving there means something else " +
        "entirely and cannot be honoured as a sales opt-out.",
    });
  }

  if (!String(mailingAddress || "").trim()) {
    blockers.push({
      code: "mailing_address_unset",
      title: "FieldQuo's mailing address isn't set.",
      fix:
        "CASL requires the sender's mailing address in every commercial message, " +
        "a text included, so nothing can be sent without it. Set " +
        "SALES_MAILING_ADDRESS to FieldQuo's business address. It is the same " +
        "setting the email footer needs.",
    });
  }

  if (!String(repName || "").trim()) {
    blockers.push({
      code: "rep_name_missing",
      title: "This sales account has no name on it.",
      fix:
        "CASL requires the message to identify who is sending it. A superadmin " +
        "can set the rep's name in the platform console.",
    });
  }

  if (!String(signupLink || "").trim()) {
    blockers.push({
      code: "no_signup_link",
      title: "This rep has no signup link.",
      fix:
        "The link is built from the rep's own code. A rep with no code has " +
        "nothing to hand out — a superadmin can issue one in the platform console.",
    });
  }

  // ── The prospect's side ──────────────────────────────────────────────────

  const to = normalisePhone(leadPhone);

  if (!String(leadPhone || "").trim()) {
    blockers.push({
      code: "lead_no_phone",
      title: "This prospect has no phone number on their record.",
      fix: "Add their mobile to the lead, then the text can go out.",
    });
  } else if (!to) {
    blockers.push({
      code: "phone_unusable",
      title: `“${String(leadPhone).slice(0, 40)}” isn't a phone number we can text.`,
      fix:
        "Correct it on the lead. Nothing was sent — a number we cannot normalise " +
        "is a number we cannot tell you we reached.",
    });
  } else if (!isNorthAmerican(to)) {
    blockers.push({
      code: "phone_outside_nanp",
      title: `${to} is outside Canada and the United States.`,
      fix:
        "FieldQuo's texting rules — CASL, the TCPA window, the internal " +
        "do-not-call list — are North American, and nothing has been checked " +
        "against the rules that would govern this number. Email them instead.",
    });
  }

  // ── The list that binds FieldQuo ─────────────────────────────────────────
  //
  // A null suppression verdict means the list could not be read, and that
  // BLOCKS. The opposite choice — send when we cannot check — turns a database
  // blip into a text to somebody who told us to stop, which is the one failure
  // here that is a fine rather than an inconvenience. Note this is the reverse
  // of outreachReadiness's treatment of an unreachable Resend, and deliberately
  // so: that unknown is about whether OUR mail is configured, this one is about
  // whether we are ALLOWED to write to this person.
  if (!suppression) {
    blockers.push({
      code: "suppression_unreadable",
      title: "FieldQuo's do-not-contact list couldn't be read.",
      fix:
        "Nothing was sent. Try again in a moment — a text is not sent on the " +
        "assumption that somebody has not opted out.",
    });
  } else if (suppression.suppressed) {
    blockers.push({
      code: "suppressed",
      title: suppression.reason || "This person is on FieldQuo's do-not-contact list.",
      fix:
        "Nothing more can be sent to them. Only a superadmin can lift a " +
        "suppression, and only with a reason on the record.",
    });
  }

  // ── The clock ────────────────────────────────────────────────────────────
  //
  // Last, because it is the only blocker that fixes itself. Evaluated even when
  // the number is unusable, so a rep correcting two things is told about both
  // at once rather than one per attempt.
  if (!String(leadTimeZone || "").trim()) {
    blockers.push({
      code: "time_zone_unknown",
      title: "We don't know what time it is where this prospect is.",
      fix:
        `Texting is limited to ${describeSalesSmsWindow()}, so say where they ` +
        `are and the window can be checked. You spoke to them — nothing here ` +
        `guesses it from their area code, which is wrong for every ported mobile.`,
    });
  } else {
    const window = withinSalesSmsHours(now, leadTimeZone);
    if (!window.allowed) {
      blockers.push({
        code: window.retryLater ? "outside_sms_window" : "time_zone_unusable",
        title: window.reason,
        fix: window.retryLater
          ? "Send it once they're inside the window. Nothing is queued — you press send."
          : "Pick the prospect's time zone again; this one couldn't be read.",
      });
    }
  }

  const canSend = blockers.length === 0;

  return {
    canSend,
    blockers,
    warnings,
    to: to || null,
    from: fromNumber || null,
    // Built only when everything passed, so a screen can preview exactly what
    // will be sent — and so a half-configured deployment never renders a
    // message with a hole where the mailing address should be.
    body: canSend
      ? signupLinkSmsBody({ repName, signupLink, mailingAddress })
      : null,
  };
}
