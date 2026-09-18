// lib/sales/mailbox/readMirror.js
//
// The rep opened a thread in the portal → the server learns the messages
// are read, so their phone stops showing them bold.
//
// Best-effort and after the portal's own write: readAt is set first, in the
// request, and this runs on the messages that were unseen. A mailbox that
// cannot be reached right now leaves them unseen on the server; the next
// open tries again, because the rows still say `seen: false`. Never the
// other way round — the portal's read state is never held back by IMAP.

import { withImap, markSeen } from "./imap";
import { openMailboxSecret } from "./secret";

/**
 * @param db
 * @param threadId
 * @param deps  { imap = withImap } for the check script
 * @returns the number of messages marked, or 0
 */
export async function mirrorThreadReadToServer(db, threadId, { imap = withImap } = {}) {
  const thread = await db.salesThread.findUnique({
    where: { id: threadId },
    select: {
      mailbox: { select: { id: true, address: true, imapHost: true, imapPort: true, secret: true, status: true } },
      messages: { where: { direction: "in", seen: false, imapFolder: "INBOX", imapUid: { not: null } }, select: { id: true, imapUid: true } },
    },
  });
  const mailbox = thread?.mailbox;
  if (!mailbox?.secret || mailbox.status !== "connected" || !thread.messages.length) return 0;
  let password;
  try {
    password = openMailboxSecret(mailbox.secret);
  } catch {
    return 0;
  }
  const uids = thread.messages.map((m) => m.imapUid);
  try {
    await imap(mailbox, password, (client) => markSeen(client, "INBOX", uids));
  } catch {
    return 0;
  }
  await db.salesMessage.updateMany({ where: { id: { in: thread.messages.map((m) => m.id) } }, data: { seen: true } });
  return uids.length;
}
