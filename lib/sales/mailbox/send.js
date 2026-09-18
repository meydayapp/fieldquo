// lib/sales/mailbox/send.js
//
// Send as the rep through the rep's own mailbox, and leave the copy where
// their phone will find it.
//
// Order: compose once → SMTP → IMAP append to Sent → report. The append is
// after the send because a copy in Sent of a message the server refused is
// a lie the rep would read as "sent"; and the append's failure does NOT
// un-send — the message left, so the caller records it with `imapUid` null
// and the next sync neither finds it (it is not on the server) nor needs to
// (the row exists). lib/sales/outreachSender.js is the caller and writes
// the SalesMessage; this file touches no table.

import { openMailboxSecret } from "./secret";
import { composeMessage, sendRaw } from "./smtp";
import { appendToSent, withImap } from "./imap";

/**
 * @param mailbox  the full SalesMailbox row (with `secret`)
 * @param mail     { from: { name, address }, to, cc, subject, text, html,
 *                   attachments, inReplyTo, references }
 * @param deps     { send = sendRaw, imap = withImap } for the check script
 * @returns { ok: true, messageId, imapUid, imapFolder, appendError }
 *        | { ok: false, error }
 */
export async function sendFromMailbox(mailbox, mail, { send = sendRaw, imap = withImap, appendLater = null } = {}) {
  if (!mailbox?.secret || mailbox.status !== "connected") {
    return { ok: false, error: "This rep's mailbox isn't connected, so nothing was sent." };
  }
  let password;
  try {
    password = openMailboxSecret(mailbox.secret);
  } catch (err) {
    return { ok: false, error: `The stored mailbox password could not be read (${err?.message || "wrong key"}); the owner has to connect it again.` };
  }

  const composed = await composeMessage(mail);
  const sent = await send(mailbox, password, composed);
  if (!sent.ok) return { ok: false, error: sent.error };

  let imapUid = null;
  let appendError = null;
  // ── The Sent copy can wait; the rep cannot ───────────────────────────────
  //
  // SMTP and then a second TLS session to IMAP, from Vercel to Namecheap,
  // was fifteen seconds of a spinning wheel after the message had already
  // left. With `appendLater` the caller hands over a scheduler (Next's
  // `after()`), the send is reported the moment SMTP accepts it, and the
  // append runs behind the response; the caller records the uid when it
  // lands (`appendSentCopy`). The failure semantics are unchanged: a copy
  // that could not be placed is an error row, never an un-send.
  if (appendLater && mailbox.sentFolder) {
    appendLater(() => appendSentCopy(mailbox, password, composed.raw, { imap }));
    return { ok: true, messageId: composed.messageId, imapUid: null, imapFolder: null, appendError: null, appendPending: true };
  }
  if (mailbox.sentFolder) {
    try {
      const appended = await imap(mailbox, password, (client) => appendToSent(client, mailbox.sentFolder, composed.raw));
      imapUid = appended?.uid ?? null;
    } catch (err) {
      appendError = `Sent, but the copy could not be placed in "${mailbox.sentFolder}": ${err?.message || "unknown"}.`;
    }
  } else {
    appendError = "Sent, but the mailbox named no Sent folder, so no copy was placed there.";
  }

  return {
    ok: true,
    messageId: composed.messageId,
    imapUid,
    imapFolder: imapUid !== null ? mailbox.sentFolder : null,
    appendError,
  };
}

/**
 * The deferred half of a send: put the raw message in the Sent folder and
 * report the uid, or the reason. Never throws.
 */
export async function appendSentCopy(mailbox, password, raw, { imap = withImap } = {}) {
  try {
    const appended = await imap(mailbox, password, (client) => appendToSent(client, mailbox.sentFolder, raw));
    return { ok: true, imapUid: appended?.uid ?? null, imapFolder: mailbox.sentFolder };
  } catch (err) {
    return { ok: false, imapUid: null, imapFolder: null, appendError: `Sent, but the copy could not be placed in "${mailbox.sentFolder}": ${err?.message || "unknown"}.` };
  }
}
