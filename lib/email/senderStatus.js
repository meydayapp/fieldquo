// lib/email/senderStatus.js
//
// What Settings › Email domain prints as "Clients see: From … · Replies to …",
// and the proposals built from the company email (lib/email/senderSuggestion.js).
//
// ══ Computed by the send path, not beside it ══════════════════════════════
//
// The page used to describe the sender in its own words — "Emails will send
// from quotes@<domain>", "replies go to your account owner's email" — which is
// a second implementation of senderFor() written in JSX, and the copy is the
// one that rots (AGENTS.md failure class 4). Here every field comes from the
// functions a real send calls, in the order it calls them:
//
//   resolveSender()          lib/email/companySender.js — senderFor() plus the
//                            owner-login fallback and the discovered platform
//                            sender (lib/email/platformSender.js)
//   replyToHeader()          lib/email/resend.js — EMAIL_REPLY_TO when nothing
//                            else is set, exactly as sendEmail() applies it
//   sendingMailboxFor()      lib/mailbox/send.js — the connected mailbox client
//                            mail goes through first when "send from this
//                            mailbox" is on (Reply-To is left off there, so
//                            replies reach the mailbox itself)
//
// so the line on the page and the header on the client's email cannot
// disagree without one of those functions changing for both.

import { resolveSender } from "./companySender";
import { senderFor, replyToHeader } from "./resend";
import { getPlatformFrom } from "./platformSender";
import { senderSuggestionFor, domainPrefillFor } from "./senderSuggestion";
import { emailProblem } from "@/lib/validation";

/**
 * @param company   Company row with SENDER_SELECT fields plus `website`
 * @param companyId the tenant — resolveSender looks its owner up by it
 * @param deps      { mailboxLib } — the check passes nothing too; it runs
 *                  the real lib/mailbox/send.js against the scripted db
 */
export async function senderStatusFor(company = {}, companyId, deps = {}) {
  const sender = await resolveSender(company, companyId);
  const platformFrom = await getPlatformFrom();
  // What Company.email alone gives — the same senderFor() call resolveSender
  // made, so "company" vs "owner" is read off the function, not re-derived.
  const companyReplyTo = senderFor(company, platformFrom).replyTo;

  // Loaded on demand, as lib/email/resend.js does, so the IMAP/SMTP code is
  // only pulled in where it is used. A lookup that fails is reported as "no
  // mailbox": the send path's own answer to a failing mailbox is to fall
  // back to the sender above.
  const mailboxLib = deps.mailboxLib || (await import("@/lib/mailbox/send"));
  const mailbox = await mailboxLib.sendingMailboxFor(null, companyId).catch(() => null);

  let clientsSee;
  if (mailbox?.address) {
    // The display name composeClientMail is handed — displayNameOf(mail.from)
    // with the From the caller resolved, which is this one.
    const name = mailboxLib.displayNameOf(sender.from);
    clientsSee = {
      via: "mailbox",
      from: name ? `${name} <${mailbox.address}>` : mailbox.address,
      replyTo: mailbox.address,
      replyToSource: "mailbox",
      // What goes out instead when the mailbox refuses one (lib/mailbox/send.js
      // never drops a client email — it falls through to this sender).
      fallbackFrom: sender.from,
    };
  } else {
    const replyTo = replyToHeader(sender.replyTo) || null;
    clientsSee = {
      via: "resend",
      from: sender.from,
      replyTo,
      replyToSource: !replyTo
        ? "none"
        : companyReplyTo && replyTo === companyReplyTo
          ? "company"
          : sender.replyTo
            ? "owner"
            : "platform",
    };
  }

  const raw = typeof company.email === "string" ? company.email.trim() : "";
  const suggestion = senderSuggestionFor({ email: company.email });

  // The From line the suggestion would produce, through senderFor itself —
  // the page prints it verbatim beside the one-tap button.
  const fromFor = (domain, local) =>
    senderFor({ ...company, emailDomain: domain, emailDomainStatus: "verified", emailFromLocal: local }, platformFrom).from;

  return {
    clientsSee,
    companyEmail: {
      value: raw,
      state: !raw ? "blank" : emailProblem(raw) === null ? "set" : "invalid",
    },
    senderSuggestion: suggestion
      ? {
          ...suggestion,
          ...(suggestion.local ? { from: fromFor(suggestion.domain, suggestion.local) } : {}),
          // What the same domain gives with the local part as stored — the
          // "once verified" preview when the company keeps it.
          ...(!suggestion.freeMailbox
            ? { fromAsStored: fromFor(suggestion.domain, company.emailFromLocal || "quotes") }
            : {}),
        }
      : null,
    domainPrefill: domainPrefillFor(company),
  };
}
