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
// Resend, or while every reply to it vanishes because nothing forwards them
// back. Neither failure is visible to the rep typing the email.
//
// So the UI never decides for itself whether to render a compose box. It asks
// this, the send route asks this again at request time, and both get the same
// answer from the same function. A blocker means the box does not render at
// all and the screen says what to fix instead; a warning means it renders with
// the honest caveat attached ("your prospect's reply will reach your mailbox,
// but FieldQuo will not file it yet").
//
// Pure, and separate from lib/sales/outreachSender.js, because that file has to
// import the database and Resend to collect the inputs — and this is the part
// worth executing against every hostile combination in
// scripts/check-sales-outreach.mjs without either.

import { REPLY_ADDRESSING_MODES, isPlausibleEmail, emailDomain } from "./outreach";

/**
 * @param repEmail              the rep's own mailbox, which is the From
 * @param senderDomainVerified  true / false / null — null means "we could not
 *                              ask Resend", which is NOT the same as "no"
 * @param replyAddressing       SALES_REPLY_ADDRESSING: "plus" | "plain" | unset
 * @param mailingAddress        SALES_MAILING_ADDRESS, required by CASL
 * @param inboundSecretSet      whether SALES_INBOUND_SECRET exists
 *
 * @returns { canSend, blockers[], warnings[], from, replyAddressing, domain }
 *          Every blocker and warning carries a `fix` written for the person who
 *          has to perform it, not for a developer reading a log.
 */
export function outreachReadiness({
  repEmail,
  senderDomainVerified,
  replyAddressing,
  mailingAddress,
  inboundSecretSet,
} = {}) {
  const blockers = [];
  const warnings = [];
  const domain = emailDomain(repEmail);

  if (!isPlausibleEmail(repEmail)) {
    blockers.push({
      code: "rep_email_invalid",
      title: "This sales account has no usable email address.",
      fix: "A superadmin can correct it on the rep's record in the platform console.",
    });
  } else if (senderDomainVerified === false) {
    // The constraint that actually bites. Resend will only send from a domain
    // verified on the account — a rep's real mailbox at fieldquo.com is not
    // automatically one of those, because the platform's own verified sending
    // domain is usually a `send.` subdomain instead.
    blockers.push({
      code: "sender_domain_unverified",
      title: `Resend can't send as ${domain}.`,
      fix:
        `Add ${domain} as a sending domain in the Resend dashboard and complete ` +
        `its DNS records, alongside the existing FieldQuo domain. Until then a ` +
        `send from a @${domain} address is rejected by Resend, not delivered. ` +
        `See docs/SALES-OUTREACH.md.`,
    });
  } else if (senderDomainVerified === null) {
    // Not a blocker: refusing to send because a status call failed would ground
    // the feature over a Resend hiccup, and the send itself fails loudly and is
    // recorded by sendEmail() if the domain really is unverified.
    warnings.push({
      code: "sender_domain_unknown",
      title: "Couldn't check with Resend which domains are verified.",
      fix:
        "Sending still works if the domain is verified. If it isn't, Resend " +
        "will reject the message and the failure will be recorded — nothing " +
        "will be filed as sent.",
    });
  }

  if (!REPLY_ADDRESSING_MODES.includes(replyAddressing)) {
    blockers.push({
      code: "reply_addressing_unset",
      title: "Reply addressing hasn't been chosen yet.",
      fix:
        'Set SALES_REPLY_ADDRESSING to "plus" if your mail provider supports ' +
        'sub-addressing (name+tag@ delivers to name@), or "plain" if it does ' +
        "not. docs/SALES-OUTREACH.md has a two-minute test. There is no " +
        "default on purpose: guessing wrong bounces every reply.",
    });
  }

  if (!String(mailingAddress || "").trim()) {
    blockers.push({
      code: "mailing_address_unset",
      title: "FieldQuo's mailing address isn't set.",
      fix:
        "CASL requires the sender's mailing address in every commercial email, " +
        "so cold outreach can't be sent without it. Set SALES_MAILING_ADDRESS " +
        "to FieldQuo's business address.",
    });
  }

  if (!inboundSecretSet) {
    // Deliberately a warning and not a blocker. Outbound works and is captured
    // either way; what is missing is the filing of replies, and the honest
    // thing is to send with that stated rather than to withhold the feature.
    warnings.push({
      code: "inbound_not_configured",
      title: "Replies aren't being filed yet.",
      fix:
        "SALES_INBOUND_SECRET isn't set, so the inbound endpoint refuses " +
        "everything (as designed — an unset secret denies rather than allows). " +
        "Replies still arrive in your own mailbox; they just won't appear here " +
        "until the forwarding rule in docs/SALES-OUTREACH.md is set up.",
    });
  }

  return {
    canSend: blockers.length === 0,
    blockers,
    warnings,
    from: isPlausibleEmail(repEmail) ? repEmail : null,
    replyAddressing: REPLY_ADDRESSING_MODES.includes(replyAddressing)
      ? replyAddressing
      : null,
    domain,
  };
}
