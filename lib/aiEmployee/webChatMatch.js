// lib/aiEmployee/webChatMatch.js
//
// "Match website-chat visitors to existing clients" (owner, 2026-10-04) —
// so the installed-equipment card, a callback-as-ticket and the code lookup
// work for the site chat the way they already work for a text from a number
// on file.
//
// ══ The same matcher the Facebook work uses ════════════════════════════════
//
// lib/leads/identityMatch.js matchLeadIdentity, given clients only — the
// rules that decide when a Facebook lead is "somebody we already have":
//   an exact email                         certain → links
//   an exact phone, names not disagreeing  certain/likely → links
//   a phone with names that DISAGREE       possible (the family landline) → not linked
//   a name alone                           possible → not linked
//   two clients tied                       refused → not linked
// The visitor's name comes from what they typed ("I'm Jane Doe", "my name
// is…"); their email and phone from lib/leads/conversationLead.js's
// deterministicContacts, the same patterns the lead capture reads.
//
// ══ Reversible ═════════════════════════════════════════════════════════════
//
// The link is the thread's own clientId, written ONLY while it is null (a
// person's link always stands). A ThreadClientMatch row records why, and
// "Not this client" on the conversation (POST /api/messaging/threads/[id]/
// client-match) puts clientId back to null — only while it still points at
// the matched client — and marks the row undone, so the pair is never
// proposed again. If a person unlinks the thread some other way, the live
// row is read as rejected the next time too.
//
// ══ Privacy ════════════════════════════════════════════════════════════════
//
// A stranger can type someone else's email. So a web-matched card is marked
// as such in the prompt (clientContext.js), and the assistant may use it to
// pick the right manual and fill in a callback, but must not volunteer
// anything from the record — an address, a date, what was installed — that
// the visitor has not said first.
//
// Bounded: runs only on a web-chat thread with no client yet, only when the
// company's matchWebChatClients is on, and only when THIS message carries an
// email or a phone (so an ordinary message costs no client scan).

import { matchLeadIdentity } from "@/lib/leads/identityMatch";
import { deterministicContacts } from "@/lib/leads/conversationLead";
import { CLIENT_MATCH_SELECT, CANDIDATE_SCAN_LIMIT } from "@/lib/contacts/matchContact";
import { writeActivity } from "@/lib/messaging/activity";

/** How many of the visitor's own messages are read for contact details. */
export const MATCH_MESSAGES = 20;

// "I'm Jane Doe", "my name is Jane Doe", "this is Jane", "je m'appelle…",
// "me llamo…", "soy…". Two to four capitalised-or-not words, letters only.
const NAME_PATTERNS = [
  /\bmy name is ([\p{L}'’-]+(?: [\p{L}'’-]+){0,3})/iu,
  // Case-SENSITIVE on the name (capitalised words), so "I'm fine thanks" is
  // not a name; the lead-in itself in either case.
  /\b(?:[Ii] am|[Ii]['’]m|[Ii]m|[Tt]his is) ([\p{Lu}][\p{L}'’-]+(?: [\p{Lu}][\p{L}'’-]+){1,3})/u,
  /\bje m['’]appelle ([\p{L}'’-]+(?: [\p{L}'’-]+){0,3})/iu,
  /\b(?:me llamo|mi nombre es) ([\p{L}'’-]+(?: [\p{L}'’-]+){0,3})/iu,
];

const STOP_AT = /\s+(?:and|et|y|from|de|at|à|en|my|mon|ma|mi)\b.*$/i;

/** The name the visitor gave, or null. Pure. */
export function nameFromText(text) {
  const s = String(text || "");
  for (const re of NAME_PATTERNS) {
    const m = re.exec(s);
    if (m) {
      const name = m[1].replace(STOP_AT, "").trim();
      if (name.split(/\s+/).length >= 1 && name.length >= 2 && name.length <= 80) return name;
    }
  }
  return null;
}

/** Does this one message carry an email or a phone? Pure, cheap. */
export function carriesContact(text) {
  const det = deterministicContacts({ messages: [{ direction: "in", body: String(text || ""), private: false }] });
  return Boolean(det.email?.value || det.phone?.value);
}

/**
 * The visitor's contact details from their own messages. Pure.
 * @param messages  [{ direction, body, private }]
 */
export function visitorContacts(messages = [], participantName = null) {
  const inbound = (Array.isArray(messages) ? messages : []).filter((m) => m && m.direction === "in" && !m.private);
  const det = deterministicContacts({ messages: inbound });
  let name = String(participantName || "").trim() || null;
  if (!name) {
    for (const m of inbound) {
      name = nameFromText(m.body);
      if (name) break;
    }
  }
  return {
    name,
    email: det.email?.value || null,
    phone: det.phone?.value || null,
    address: det.address?.value || null,
  };
}

/**
 * Decide. Pure: the clients the caller read under companyId, the pairs a
 * person rejected, the visitor's contacts.
 *
 * @returns {{ link: boolean, clientId?, confidence?, matchedOn?, why }}
 */
export function decideWebMatch({ companyId, contacts = {}, clients = [], rejectedClientIds = [] } = {}) {
  if (!contacts.email && !contacts.phone) return { link: false, why: "no_contact" };
  const rejected = new Set((rejectedClientIds || []).map((id) => `client:${id}`));
  const m = matchLeadIdentity({ companyId, incoming: contacts, clients, rejected });
  if (m.kind !== "client" || !m.id) return { link: false, why: m.ambiguous ? "ambiguous" : "no_match", detail: m.why };
  return { link: true, clientId: m.id, confidence: m.confidence, matchedOn: m.matchedOn, why: m.why };
}

/**
 * Match one web-chat thread, and link it when the evidence is good enough.
 * Never throws; returns what it did.
 *
 * @param thread  { id, clientId, participantName, channel: { platform } }
 *                read under companyId by respond.js
 */
export async function matchWebChatThread({ prisma, companyId, thread, inboundText = "", settings = {} } = {}) {
  try {
    if (!prisma || !companyId || !thread?.id) return { linked: false, reason: "no_thread" };
    if (!prisma.threadClientMatch?.findMany || !prisma.client?.findMany) return { linked: false, reason: "no_store" };
    if (thread.channel?.platform !== "web") return { linked: false, reason: "not_web" };
    if (thread.clientId) return { linked: false, reason: "already_linked" };
    if (settings.matchWebChatClients === false) return { linked: false, reason: "switched_off" };
    if (!carriesContact(inboundText)) return { linked: false, reason: "no_contact_in_message" };

    const [messages, history] = await Promise.all([
      prisma.message.findMany({
        where: { threadId: thread.id, direction: "in", private: false },
        orderBy: { sentAt: "desc" },
        take: MATCH_MESSAGES,
        select: { direction: true, body: true, private: true },
      }),
      prisma.threadClientMatch.findMany({ where: { companyId, threadId: thread.id }, select: { id: true, clientId: true, status: true } }),
    ]);
    // A pair a person undid — or a live match whose link somebody removed by
    // hand (the thread has no client now, so it was taken off) — is never
    // proposed again.
    const rejectedClientIds = history.map((h) => h.clientId);
    const stale = history.filter((h) => h.status === "linked");
    if (stale.length) {
      await prisma.threadClientMatch.updateMany({ where: { companyId, id: { in: stale.map((h) => h.id) } }, data: { status: "undone", undoneAt: new Date() } });
    }

    const contacts = visitorContacts(messages.reverse(), thread.participantName);
    const clients = await prisma.client.findMany({
      where: { companyId },
      select: { ...CLIENT_MATCH_SELECT },
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_SCAN_LIMIT,
    });
    const decision = decideWebMatch({ companyId, contacts, clients, rejectedClientIds });
    if (!decision.link) return { linked: false, reason: decision.why };

    // Only while nobody has linked it — a person's choice always stands.
    const pointed = await prisma.messageThread.updateMany({
      where: { id: thread.id, companyId, clientId: null },
      data: { clientId: decision.clientId },
    });
    if (!pointed?.count) return { linked: false, reason: "already_linked" };
    const row = await prisma.threadClientMatch.create({
      data: {
        companyId,
        threadId: thread.id,
        clientId: decision.clientId,
        confidence: decision.confidence,
        matchedOn: decision.matchedOn || [],
        why: String(decision.why || "").slice(0, 300),
        status: "linked",
      },
      select: { id: true },
    });
    // The line in the conversation itself — "Client linked", with nobody's
    // name, because a machine did it — so a person reading the thread sees
    // the link arrive (lib/messaging/activity.js).
    await writeActivity(prisma, { threadId: thread.id, type: "linked", kind: "client" }).catch(() => null);
    return { linked: true, clientId: decision.clientId, matchId: row.id, confidence: decision.confidence };
  } catch (err) {
    console.error("[aiEmployee] web chat match failed:", err?.message);
    return { linked: false, reason: "error" };
  }
}

/** Is this thread's client link one the assistant made from a web chat? */
export async function liveWebMatch(prisma, { companyId, threadId, clientId }) {
  if (!prisma?.threadClientMatch?.findFirst || !companyId || !threadId || !clientId) return null;
  try {
    return await prisma.threadClientMatch.findFirst({
      where: { companyId, threadId, clientId, status: "linked" },
      orderBy: { createdAt: "desc" },
      select: { id: true, confidence: true, matchedOn: true, why: true, createdAt: true },
    });
  } catch {
    return null;
  }
}

/**
 * "Not this client." Puts the thread's clientId back to null — only while
 * it still points at the matched client — and marks the match undone.
 */
export async function undoWebMatch({ prisma, companyId, threadId, matchId, userId = null, actorName = null, now = new Date() }) {
  const match = await prisma.threadClientMatch.findFirst({ where: { id: matchId, companyId, threadId } });
  if (!match) return { ok: false, status: 404, reason: "not_found" };
  if (match.status === "undone") return { ok: true, already: true };
  const cleared = await prisma.messageThread.updateMany({
    where: { id: threadId, companyId, clientId: match.clientId },
    data: { clientId: null },
  });
  await prisma.threadClientMatch.update({ where: { id: match.id }, data: { status: "undone", undoneAt: now, undoneByUserId: userId } });
  if (cleared?.count) {
    await writeActivity(prisma, { threadId, type: "unlinked", kind: "client", ...(actorName ? { by: actorName } : {}) }).catch(() => null);
  }
  return { ok: true, unlinked: Boolean(cleared?.count) };
}

/**
 * "Not this client" on a thread that is NOT linked to the client — a match
 * the client timeline (lib/conversations/clientTimeline.js) made when it was
 * read, or a possible match a person refused. Writes the same row the undo
 * above leaves behind (status "undone"), so both matchers read one record of
 * a refused pair and neither proposes it again.
 *
 * A thread a PERSON linked to this client is refused here (409): taking that
 * link off is the inbox's job, where the link can be seen. A thread this
 * matcher linked is handed to undoWebMatch.
 *
 * `clientId` must already be proved to belong to companyId by the caller
 * (ownedIdsRefusal); it is re-read here under companyId regardless.
 */
export async function rejectClientMatch({ prisma, companyId, threadId, clientId, userId = null, actorName = null, now = new Date() }) {
  if (!prisma || !companyId || !threadId || !clientId) return { ok: false, status: 404, reason: "not_found" };
  const [thread, client] = await Promise.all([
    prisma.messageThread.findFirst({ where: { id: threadId, companyId }, select: { id: true, clientId: true } }),
    prisma.client.findFirst({ where: { id: clientId, companyId }, select: { id: true } }),
  ]);
  if (!thread || !client) return { ok: false, status: 404, reason: "not_found" };
  if (thread.clientId === client.id) {
    const live = await prisma.threadClientMatch.findFirst({
      where: { companyId, threadId: thread.id, clientId: client.id, status: "linked" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!live) return { ok: false, status: 409, reason: "linked_by_person" };
    return undoWebMatch({ prisma, companyId, threadId: thread.id, matchId: live.id, userId, actorName, now });
  }
  const already = await prisma.threadClientMatch.findFirst({
    where: { companyId, threadId: thread.id, clientId: client.id, status: "undone" },
    select: { id: true },
  });
  if (already) return { ok: true, already: true };
  await prisma.threadClientMatch.create({
    data: {
      companyId,
      threadId: thread.id,
      clientId: client.id,
      // Never linked, so there is no link confidence to record: the row is the
      // refusal, and "possible" is the most this pair ever was to the person
      // who has now looked.
      confidence: "possible",
      matchedOn: [],
      why: "Not this client — refused from the client's conversation timeline.",
      status: "undone",
      undoneAt: now,
      undoneByUserId: userId,
    },
    select: { id: true },
  });
  return { ok: true, rejected: true };
}
