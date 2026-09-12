// lib/messaging/pushInbound.js
//
// "New message from Maria Lopez" — the push for a genuinely new inbound
// message in the /app inbox (Messenger, Instagram, WhatsApp), to every
// active member who can READ the inbox: the same `requests` view_only
// level app/api/messaging/threads/route.js requires, decided by the same
// hasLevel, so a Crew member with no access to conversations is not told
// about one on their lock screen. No actor to exclude: the homeowner wrote.
//
// Called by lib/messaging/ingest.js after the message is stored, on a new
// inbound only — never on a re-delivery (Meta re-delivers for hours) and
// never on an imported history pull. Fire-and-forget through
// lib/notify/push.js; nothing here throws into the webhook.
//
// The body is the first line of what they said, cut short: a lock screen
// is a public place, and a homeowner's full paragraph has no business on
// one. Money never appears — there is none in an inbound message's data.

import { db } from "@/lib/db";
import { hasLevel } from "@/lib/permissions/enforce";
import { appSentence, pushToUsers } from "@/lib/notify/push";

const SNIPPET = 90;

/** Pure: the members who may read the inbox, from the company's rows. */
export function inboxReaders(members) {
  return (members || []).filter((m) => m.active !== false && m.userId && hasLevel(m, "requests", "view_only"));
}

export function snippet(body) {
  const line = String(body || "").replace(/\s+/g, " ").trim();
  return line.length > SNIPPET ? `${line.slice(0, SNIPPET - 1)}…` : line;
}

export async function pushInboundMessage({ companyId, threadId, participantName, body }) {
  try {
    const [members, company] = await Promise.all([
      db.member.findMany({
        where: { companyId, active: true },
        select: { id: true, userId: true, role: true, permissions: true, active: true },
      }),
      db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }),
    ]);
    const userIds = inboxReaders(members).map((m) => m.userId);
    const name = participantName || "";
    void pushToUsers({
      userIds,
      fallbackLanguage: company?.defaultLanguage || "en",
      payload: async (language) => ({
        title: name
          ? await appSentence(language, "app.notify.newMessage.title", { name })
          : await appSentence(language, "app.nav.messages"),
        body: snippet(body),
        tag: `inbox:${threadId}`,
        url: threadId ? `/app/messages?conversation=${encodeURIComponent(threadId)}` : "/app/messages",
      }),
    });
  } catch {
    /* best-effort: the message is stored; a push is a courtesy */
  }
}
