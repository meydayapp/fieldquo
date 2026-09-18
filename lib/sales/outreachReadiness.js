// lib/sales/outreachReadiness.js
//
// Whether a rep can actually send, and — when they cannot — the exact thing
// that is missing.
//
// ══ Why this is its own pure module ════════════════════════════════════════
//
// AGENTS.md's most emphasised rule is "never ship a control that appears to
// work and doesn't". The compose box in the sales portal is precisely that
// hazard: it can look completely fine while the mail it sends is refused by
// the mailbox, or while every reply to it lands somewhere the portal never
// reads. Neither failure is visible to the rep typing the email.
//
// So the UI never decides for itself whether to render a compose box. It asks
// this, the send route asks this again at request time, and both get the same
// answer from the same function. A blocker means the box does not render at
// all and the screen says what to fix instead; a warning means it renders with
// the honest caveat attached.
//
// ══ What changed on 2026-09-18 ═════════════════════════════════════════════
//
// Until then a rep's mail went out through Resend from their address, and
// this file asked Resend whether that address's domain was verified, whether
// a reply domain was receiving, whether a webhook secret was set. The
// owner's decision replaced all of it: the portal is a second window onto
// the Namecheap mailbox he bought each rep (lib/sales/mailbox/), so the
// questions are now three — is there a work mailbox, is it connected, and
// is the CASL address set — and every one of them is answered from a row or
// a variable, never from a vendor's status call. The Resend-door readiness
// (reply domain, webhook secret) went with the door's use; the door's code
// stays for the day a mailbox cannot be connected (docs/SALES-OUTREACH.md).
//
// Pure, and separate from lib/sales/outreachSender.js, because that file has
// to import the database to collect the inputs — and this is the part worth
// executing against every hostile combination in
// scripts/check-sales-outreach.mjs without it.

import { isPlausibleEmail, emailDomain } from "./outreach";

/**
 * @param repEmail        the rep's WORK mailbox (SalesRep.workEmail), which is
 *                        the From. Not their sign-in address — see the note
 *                        below on why the two are different columns and why
 *                        the absence of the first is its own blocker.
 * @param mailbox         the rep's SalesMailbox in its public shape, or null:
 *                        { address, status, lastError, imapResult, smtpResult }
 * @param mailingAddress  SALES_MAILING_ADDRESS, required by CASL
 *
 * @returns { canSend, blockers[], warnings[], from, domain, inboundConfigured,
 *            mailboxState }
 *          Every blocker and warning carries a `fix` written for the person who
 *          has to perform it — the OWNER, for everything about the mailbox,
 *          because the rep was promised no configuration step.
 */
export function outreachReadiness({ repEmail, mailbox = null, mailingAddress } = {}) {
  const blockers = [];
  const warnings = [];
  const domain = emailDomain(repEmail);
  const address = String(repEmail || "").trim().toLowerCase();

  // ── The mailbox itself ──────────────────────────────────────────────────
  //
  // SalesRep.workEmail is the mailbox a rep SENDS from, and its schema comment
  // is explicit that there is deliberately no fallback to their sign-in
  // address: quietly sending from the login address is a send that reads as
  // successful while the reply goes somewhere nobody is watching.
  if (!address) {
    blockers.push({
      code: "no_work_mailbox",
      title: "This rep has no work mailbox yet, so nothing can be sent.",
      fix:
        "The owner connects one on the rep's row under Sales reps in the " +
        "platform console — the mailbox address and its password, in one " +
        "step. It is deliberately not the sign-in address: a prospect's reply " +
        "has to land somewhere the rep is happy for a stranger to write to.",
    });
  } else if (!isPlausibleEmail(address)) {
    blockers.push({
      code: "rep_email_invalid",
      title: "This rep's work mailbox isn't a usable email address.",
      fix: "The owner can correct it on the rep's row under Sales reps in the platform console.",
    });
  } else if (!mailbox || mailbox.status === "revoked") {
    blockers.push({
      code: "mailbox_not_connected",
      title: "Your mailbox hasn't been connected yet — ask the owner.",
      fix:
        `Nothing is sent or received here until ${address} is connected. The owner ` +
        `does it on the rep's row under Sales reps in the platform console: the ` +
        `mailbox address and its password, tested on save. The rep has no step to do.`,
    });
  } else if (mailbox.status !== "connected") {
    blockers.push({
      code: "mailbox_error",
      title: "Your mailbox connection isn't working — ask the owner.",
      fix:
        `The last test of ${mailbox.address || address} failed` +
        `${mailbox.lastError ? `: ${mailbox.lastError}` : "."} The owner can press Retry ` +
        `on the rep's row under Sales reps, or enter the password again if it changed.`,
    });
  } else if (mailbox.address && mailbox.address.toLowerCase() !== address) {
    blockers.push({
      code: "mailbox_address_differs",
      title: "The connected mailbox isn't this rep's work address.",
      fix:
        `${mailbox.address} is connected but the rep's work mailbox reads ${address}. ` +
        `The owner reconnects on the rep's row so the two agree.`,
    });
  }

  // ── CASL ────────────────────────────────────────────────────────────────
  //
  // Not the rep's problem and not fixable by them; the blocker says so, and
  // the fix names the variable. lib/sales/outreach.js's caslFooterLines has
  // the legal argument.
  if (!String(mailingAddress || "").trim()) {
    blockers.push({
      code: "mailing_address_missing",
      title: "FieldQuo's mailing address isn't set, and every commercial email must carry one.",
      fix:
        "Set SALES_MAILING_ADDRESS in Vercel to FieldQuo's postal address (CASL " +
        "s.6(2)(b)). docs/SALES-OUTREACH.md §4.",
    });
  }

  const connected = Boolean(mailbox && mailbox.status === "connected");

  return {
    canSend: blockers.length === 0,
    blockers,
    warnings,
    from: isPlausibleEmail(address) ? address : null,
    domain,
    // Replies are received the same way they are sent: through the mailbox.
    // Connected means filed.
    inboundConfigured: connected,
    mailboxState: !mailbox ? "none" : mailbox.status,
  };
}
