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
 * @param repEmail              the rep's WORK mailbox, which is the From. Not
 *                              their sign-in address — see the note below on
 *                              why the two are different columns and why the
 *                              absence of the first is its own blocker.
 * @param senderDomainVerified  true / false / null — null means "we could not
 *                              ask Resend", which is NOT the same as "no"
 * @param replyAddressing       SALES_REPLY_ADDRESSING: "plus" | "plain" | unset
 * @param mailingAddress        SALES_MAILING_ADDRESS, required by CASL
 * @param inboundSecretSet      whether SALES_INBOUND_SECRET exists — the
 *                              generic forwarder door, docs/SALES-OUTREACH.md §5
 * @param replyDomain           SALES_REPLY_DOMAIN — the Resend Receiving door,
 *                              §5b. Unset means the reply goes to the rep's own
 *                              mailbox as before.
 * @param replyDomainReceiving  true / false / null — is that domain verified
 *                              AND receiving-enabled on the Resend account.
 *                              Null means "we could not ask", which is not "no".
 * @param resendWebhookSecretSet whether RESEND_INBOUND_WEBHOOK_SECRET exists
 *
 * @returns { canSend, blockers[], warnings[], from, replyAddressing, domain,
 *            replyDomain, inboundConfigured }
 *          Every blocker and warning carries a `fix` written for the person who
 *          has to perform it, not for a developer reading a log.
 */
export function outreachReadiness({
  repEmail,
  senderDomainVerified,
  replyAddressing,
  mailingAddress,
  inboundSecretSet,
  replyDomain,
  replyDomainReceiving,
  resendWebhookSecretSet,
} = {}) {
  const blockers = [];
  const warnings = [];
  const domain = emailDomain(repEmail);
  const wantedReplyDomain = String(replyDomain || "").trim().toLowerCase();
  const usableReplyDomain = wantedReplyDomain ? emailDomain(`x@${wantedReplyDomain}`) : null;

  // ── The blocker that had no way to be cleared ───────────────────────────
  //
  // SalesRep.workEmail is the mailbox a rep SENDS from, and its schema comment
  // is explicit that there is deliberately no fallback to their sign-in
  // address: quietly sending from the login address is a send that reads as
  // successful while the reply goes somewhere nobody is watching.
  //
  // Until now this file was handed the sign-in address instead, so that rule
  // was written down in three places and enforced in none — and workEmail was
  // a column with no writer and no reader on the sending path, which is
  // AGENTS.md failure class 1 in both directions at once. The console can now
  // set it, so the blocker names it and says where to go.
  if (!String(repEmail || "").trim()) {
    blockers.push({
      code: "no_work_mailbox",
      title: "This rep has no work mailbox yet, so nothing can be sent.",
      fix:
        "A superadmin assigns one on the rep's row under Sales reps in the " +
        "platform console, once the inbox has been bought. It is deliberately " +
        "not their sign-in address: a prospect's reply has to land somewhere " +
        "the rep is happy for a stranger to write to.",
    });
  } else if (!isPlausibleEmail(repEmail)) {
    blockers.push({
      code: "rep_email_invalid",
      title: "This rep's work mailbox isn't a usable email address.",
      fix: "A superadmin can correct it on the rep's row under Sales reps in the platform console.",
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
      fix: wantedReplyDomain
        ? 'Set SALES_REPLY_ADDRESSING to "plus". With SALES_REPLY_DOMAIN set the ' +
          "reply goes to Resend, which receives for every address at that domain, " +
          "so sub-addressing cannot bounce there and the token rides in the " +
          'reply\'s own To: header. "plain" also works but relies on the quoted ' +
          "Ref: line. docs/SALES-OUTREACH.md §3 and §5b."
        : 'Set SALES_REPLY_ADDRESSING to "plus" if your mail provider supports ' +
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

  // ── Inbound: which door, and is it actually open ────────────────────────
  //
  // Two ways a reply can reach FieldQuo, and they fail in opposite
  // directions, which is why one is a warning and the other a set of
  // blockers.
  //
  // The GENERIC FORWARDER (§5): the reply goes to the rep's own mailbox, which
  // is expected to POST a copy to us. If that is not set up, the rep still
  // has the mail — FieldQuo just does not — so sending is allowed and the
  // gap is stated.
  //
  // RESEND RECEIVING (§5b): the Reply-To is moved to a domain Resend receives
  // for. Now the reply goes to Resend and NOT to the rep, and it reaches a
  // human only because our webhook forwards it on. So every piece of that
  // chain has to be proven before a single message goes out with that
  // Reply-To on it: a domain that is set but not receiving bounces every
  // reply; a domain that receives with no webhook secret drops every reply
  // into Resend's inbox where nobody looks. Both lose the prospect's answer
  // invisibly, which is the one outcome the addressing mode's own "no
  // default" rule exists to prevent. Blockers, all of them.
  let inboundConfigured = false;

  if (wantedReplyDomain) {
    if (!usableReplyDomain) {
      blockers.push({
        code: "reply_domain_invalid",
        title: `SALES_REPLY_DOMAIN isn't a usable domain name.`,
        fix:
          `It is set to "${wantedReplyDomain}". Set it to the bare subdomain ` +
          `Resend receives for, e.g. reply.fieldquo.com — no @, no scheme, no ` +
          `path. docs/SALES-OUTREACH.md §5b.`,
      });
    } else if (replyDomainReceiving === false) {
      blockers.push({
        code: "reply_domain_not_receiving",
        title: `Resend isn't receiving mail for ${usableReplyDomain}.`,
        fix:
          `Every reply would bounce, so nothing is sent with that Reply-To. In ` +
          `the Resend dashboard, add ${usableReplyDomain} as a domain (or open ` +
          `it if it exists), verify it, and switch on Receiving on its domain ` +
          `page — Resend then shows an MX record to add at the DNS host. ` +
          `Until Resend reports the domain verified and receiving enabled, this ` +
          `blocker stays. docs/SALES-OUTREACH.md §5b has the exact records.`,
      });
    } else if (replyDomainReceiving === null) {
      // Same reasoning as sender_domain_unknown: a status call failing must
      // not ground the feature. If the domain is not in fact receiving, the
      // bounce is the failure — and it is the one this file otherwise works
      // hard to prevent — so the warning says exactly that rather than
      // "probably fine".
      warnings.push({
        code: "reply_domain_unknown",
        title: `Couldn't check with Resend whether ${usableReplyDomain} is receiving mail.`,
        fix:
          "Sending continues. If receiving is not actually enabled for that " +
          "domain in Resend, replies to what is sent now will bounce — so if " +
          "this warning persists, confirm it on the domain's page in the Resend " +
          "dashboard rather than waiting.",
      });
    }

    if (!resendWebhookSecretSet) {
      blockers.push({
        code: "reply_domain_without_webhook",
        title: "Replies would reach Resend and nobody else.",
        fix:
          `SALES_REPLY_DOMAIN is set, so replies go to ${usableReplyDomain || wantedReplyDomain} ` +
          `— but RESEND_INBOUND_WEBHOOK_SECRET isn't, so the webhook that files ` +
          `each reply and forwards a copy to the rep's mailbox refuses ` +
          `everything (an unset secret denies, never allows). Create the ` +
          `email.received webhook in Resend pointing at ` +
          `/api/webhooks/resend-inbound, copy its signing secret into that ` +
          `variable, and redeploy. docs/SALES-OUTREACH.md §5b.`,
      });
    }

    inboundConfigured =
      Boolean(usableReplyDomain) && replyDomainReceiving !== false && Boolean(resendWebhookSecretSet);
  } else if (inboundSecretSet) {
    inboundConfigured = true;
  } else {
    // Deliberately a warning and not a blocker. Outbound works and is captured
    // either way; what is missing is the filing of replies, and the honest
    // thing is to send with that stated rather than to withhold the feature.
    warnings.push({
      code: "inbound_not_configured",
      title: "Replies are not being filed: no inbound path is configured.",
      fix:
        "Prospects' replies still arrive in your own mailbox; they just won't " +
        "appear here. Neither inbound door is set up — SALES_REPLY_DOMAIN and " +
        "RESEND_INBOUND_WEBHOOK_SECRET for Resend Receiving (the one that works " +
        "with the reps' Namecheap mailboxes, docs/SALES-OUTREACH.md §5b), or " +
        "SALES_INBOUND_SECRET for a mailbox that can POST to a webhook (§5).",
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
    // The domain the Reply-To is built on, or null for the rep's own. Only ever
    // non-null when it passed the checks above, so the sender can use it
    // without a second opinion.
    replyDomain: usableReplyDomain && replyDomainReceiving !== false ? usableReplyDomain : null,
    inboundConfigured,
  };
}
