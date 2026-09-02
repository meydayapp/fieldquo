// lib/sales/outreachIdentity.js
//
// Which address a rep sends from, and whether they can send at all.
//
// ══ Why the sending mailbox is not the login address ══════════════════════
//
// SalesRep.email is how a rep signs in and where their invite went.
// SalesRep.workEmail is the mailbox they SEND from. They are separate columns
// because they are separate facts, and conflating them breaks in two ways that
// both end with a prospect's reply going somewhere nobody reads.
//
// A mailbox is BOUGHT. The owner adds a rep, then purchases the inbox, so
// there is a real window — hours or days — where a rep has a working login and
// no address to send from. And a login address may be personal or
// pre-existing; sending cold outreach from it puts a stranger's reply in a
// mailbox the portal cannot see.
//
// ══ Why there is no fallback, deliberately ════════════════════════════════
//
// The tempting fallbacks are `email` and the platform sender. Both are the
// same bug wearing different clothes: the send succeeds, the UI says sent, and
// the reply lands somewhere nobody is watching. lib/sales/outreachSender.js
// already refuses the platform-sender fallback for exactly this reason and
// says so in its header. This refuses the other one.
//
// A rep with no work mailbox is BLOCKED and told why. That is honest; a
// silently redirected reply is not.
import { senderDomainVerified } from "./outreachSender";

/**
 * Can this rep send, and from where?
 *
 * Pure — takes an already-loaded rep and an already-loaded domain list, so the
 * decision can be executed against hostile input rather than only read. The
 * caller does the database work.
 *
 * @param {{ email?: string|null, workEmail?: string|null, name?: string|null }} rep
 * @param {boolean|null} domainVerified  whether the work mailbox's domain is
 *   verified on the mail account. NULL means "could not ask" — which is not
 *   the same as "no", and is refused with a different reason so a provider
 *   outage never reads as a misconfigured domain.
 * @returns {{ ok: boolean, address: string|null, reason: string|null, detail: string|null }}
 */
export function resolveSendingIdentity(rep, domainVerified) {
  const work = typeof rep?.workEmail === "string" ? rep.workEmail.trim().toLowerCase() : "";

  if (!work) {
    return {
      ok: false,
      address: null,
      reason: "no_work_mailbox",
      // Written for the person who has to fix it, not for a log. They bought a
      // rep before they bought the inbox, which is the normal order.
      detail:
        "This rep has no work mailbox yet. Assign one in the platform console " +
        "once the inbox exists — outreach deliberately will not fall back to " +
        "their sign-in address, because a reply to that address would land " +
        "somewhere the portal cannot file it.",
    };
  }

  const at = work.lastIndexOf("@");
  if (at <= 0 || at === work.length - 1) {
    return {
      ok: false,
      address: null,
      reason: "invalid_work_mailbox",
      detail: `"${work}" is not a usable email address.`,
    };
  }

  const domain = work.slice(at + 1);

  if (domainVerified === null || domainVerified === undefined) {
    return {
      ok: false,
      address: null,
      reason: "verification_unknown",
      detail:
        `Could not check whether ${domain} is verified with the mail provider. ` +
        `Refusing rather than guessing: sending on an unchecked domain either ` +
        `bounces or silently rewrites the sender.`,
    };
  }

  // The constraint that surprises people: the mail provider will only send
  // from a domain verified on ITS account. A deployment can be healthily
  // sending quotes from a verified `send.` subdomain while the root domain the
  // human mailboxes live on is not verified at all — so this rep's real,
  // working, reply-receiving address is refused outright.
  if (!domainVerified) {
    return {
      ok: false,
      address: null,
      reason: "domain_not_verified",
      detail:
        `${domain} is not verified on the mail account, so mail from ${work} ` +
        `would be refused. Verify ${domain} and merge its SPF record with the ` +
        `mailbox provider's — a subdomain being verified does not cover the ` +
        `root domain, and vice versa.`,
    };
  }

  return { ok: true, address: work, reason: null, detail: null };
}

/**
 * The db half: load the verified domains and ask the pure function.
 *
 * Kept thin on purpose — every decision above is testable without a network.
 */
export async function sendingIdentityFor(rep) {
  const work = typeof rep?.workEmail === "string" ? rep.workEmail.trim() : "";
  // No mailbox means nothing to verify — ask the pure function first so the
  // reason is "no mailbox" rather than a confusing verification failure.
  if (!work) return resolveSendingIdentity(rep, false);
  // null on error, never false: a provider outage is not a misconfiguration.
  const verified = await senderDomainVerified(work).catch(() => null);
  return resolveSendingIdentity(rep, verified);
}
