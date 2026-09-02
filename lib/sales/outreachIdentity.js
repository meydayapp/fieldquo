// lib/sales/outreachIdentity.js
//
// Which address a rep's mail is sent FROM, and which address a reply goes TO.
//
// ══ These are two different addresses, and an earlier version confused them ═
//
// The first draft required the rep's own mailbox domain to be verified with
// the mail provider before they could send. That was wrong, and it blocked
// sending for a reason that does not exist.
//
// A provider needs a verified DOMAIN to send FROM. It does not need a mailbox
// there — `quotes@send.fieldquo.com` sends perfectly well and no inbox by that
// name exists anywhere. A mailbox only matters for RECEIVING, and receiving is
// what Reply-To is for.
//
// lib/email/platformSender.js already had this right and says so: "A root
// domain usually carries the company's real mailbox; a `send.` or `mail.`
// subdomain was set up for exactly this." That rule was applied to quotes and
// then forgotten for reps.
//
// So:
//
//   From:     daniel@send.fieldquo.com   — a verified sending domain, no inbox
//   Reply-To: daniel@fieldquo.com        — the rep's REAL mailbox
//
// The prospect replies and it lands in the rep's actual inbox. Nothing needs
// verifying about that address, because nothing sends from it.
//
// ══ Why the reply address is still required ═══════════════════════════════
//
// Sending with no reply address would put the prospect's answer on a sending
// subdomain nobody reads. So a rep with no mailbox assigned is still blocked —
// but blocked on the thing that is actually missing, which is somewhere for
// the answer to go, not a DNS record.
/** A conservative local part: letters, digits, dots and hyphens only. */
function localPartOf(value) {
  const at = String(value || "").indexOf("@");
  const local = at > 0 ? String(value).slice(0, at) : String(value || "");
  const clean = local.toLowerCase().replace(/[^a-z0-9.-]/g, "");
  return clean || null;
}

/**
 * Decide the From and Reply-To for one rep.
 *
 * Pure — takes an already-loaded rep and an already-resolved sending domain,
 * so every branch can be executed against hostile input rather than only read.
 *
 * @param {{ name?: string|null, email?: string|null, workEmail?: string|null, code?: string|null }} rep
 * @param {string|null} sendingDomain  a domain verified with the mail provider
 *   and not claimed by a tenant. NULL means "could not ask", which is refused
 *   with its own reason so a provider outage never reads as a misconfiguration.
 * @returns {{ ok: boolean, from: string|null, replyTo: string|null, reason: string|null, detail: string|null }}
 */
export function resolveSendingIdentity(rep, sendingDomain) {
  const reply = typeof rep?.workEmail === "string" ? rep.workEmail.trim().toLowerCase() : "";

  if (sendingDomain === null || sendingDomain === undefined) {
    return {
      ok: false,
      from: null,
      replyTo: null,
      reason: "sending_domain_unknown",
      detail:
        "Could not ask the mail provider which domains are verified. Refusing " +
        "rather than guessing — sending on an unchecked domain either bounces " +
        "or silently rewrites the sender.",
    };
  }

  if (!sendingDomain) {
    return {
      ok: false,
      from: null,
      replyTo: null,
      reason: "no_sending_domain",
      detail:
        "No verified sending domain. Verify one with the mail provider — a " +
        "`send.` subdomain is the usual choice, and it needs no mailboxes.",
    };
  }

  if (!reply) {
    return {
      ok: false,
      from: null,
      replyTo: null,
      reason: "no_reply_mailbox",
      // The honest blocker. Not DNS — somewhere for the answer to go.
      detail:
        "This rep has no reply mailbox yet. Assign one in the platform console " +
        "once the inbox exists. Sending without it would put the prospect's " +
        "reply on a sending subdomain nobody reads.",
    };
  }

  const at = reply.lastIndexOf("@");
  if (at <= 0 || at === reply.length - 1) {
    return {
      ok: false,
      from: null,
      replyTo: null,
      reason: "invalid_reply_mailbox",
      detail: `"${reply}" is not a usable email address.`,
    };
  }

  // The From local part follows the rep, so a prospect who has spoken to Daniel
  // sees Daniel. Derived from the reply mailbox's local part where it is
  // usable, falling back to their attribution code — never to a shared address,
  // which would make two reps indistinguishable in a prospect's inbox.
  const local = localPartOf(reply) || localPartOf(rep?.code);
  if (!local) {
    return {
      ok: false,
      from: null,
      replyTo: null,
      reason: "no_usable_local_part",
      detail: `Could not build a sending address for this rep from "${reply}".`,
    };
  }

  return {
    ok: true,
    from: `${local}@${sendingDomain}`,
    replyTo: reply,
    reason: null,
    detail: null,
  };
}
