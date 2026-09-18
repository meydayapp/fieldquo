// lib/sales/emailDrafts.js
//
// A rep's unsent emails: saved as they type, found again when they come
// back, deleted when sent or discarded.
//
// ══ One draft per place ═══════════════════════════════════════════════════
//
// The compose box autosaves 1.5 s after the last keystroke (Zero does 3 s;
// a floor on flaky Wi-Fi loses less at 1.5). It saves by draft id once it
// has one, and the FIRST save looks for an existing draft at the same place
// — this thread for a reply, this lead with no thread for a new message —
// so two tabs, or a reload mid-sentence, continue one draft rather than
// breeding one per keystroke session. "Place" is (rep, thread) or (rep,
// lead, no thread); a forward and a reply on the same thread are two places
// because they are two messages.
//
// ══ Nothing here validates recipients ═════════════════════════════════════
//
// A draft holds whatever the rep typed. The closed recipient set
// (lib/sales/emailRecipients.js) is enforced by the SEND route, on rows read
// in that request — a draft saved before a lead's address changed must not
// carry a stale permission into the send.
//
// `db` is a parameter for the reason lib/sales/outreachInbound.js gives:
// scripts/check-sales-email.mjs runs these against a fake client.

import { sanitiseBodyText, sanitiseHeaderText } from "./outreach";
import { joinAddresses } from "./emailRecipients";

export const DRAFT_KINDS = ["new", "reply", "replyAll", "forward"];

/** The most a draft body may hold; buildOutboundEmail caps the send at 20k. */
export const DRAFT_BODY_MAX = 20_000;

/** The shape a draft crosses the wire in. Never the rep id. */
export const DRAFT_SELECT = {
  id: true,
  leadId: true,
  threadId: true,
  kind: true,
  toAddresses: true,
  ccAddresses: true,
  subject: true,
  body: true,
  quotedMessageId: true,
  attachments: true,
  updatedAt: true,
};

function cleanKind(kind) {
  return DRAFT_KINDS.includes(kind) ? kind : "new";
}

/** The columns a PUT may set, cleaned. Unknown keys are dropped, not refused. */
export function draftDataFrom(input = {}) {
  const p = input && typeof input === "object" ? input : {};
  const data = {};
  if ("kind" in p) data.kind = cleanKind(p.kind);
  if ("toAddresses" in p) data.toAddresses = joinAddresses(p.toAddresses);
  if ("ccAddresses" in p) data.ccAddresses = joinAddresses(p.ccAddresses);
  if ("subject" in p) data.subject = sanitiseHeaderText(p.subject, 200) || null;
  if ("body" in p) data.body = sanitiseBodyText(p.body, DRAFT_BODY_MAX);
  if ("quotedMessageId" in p) {
    data.quotedMessageId = typeof p.quotedMessageId === "string" && p.quotedMessageId ? p.quotedMessageId.slice(0, 40) : null;
  }
  if ("attachments" in p) data.attachments = cleanAttachments(p.attachments);
  return data;
}

/**
 * Attachments a draft may name: files FieldQuo already hosts (a Cloudinary
 * URL from an inbound message on the thread). Anything else is dropped here
 * and, again, at send.
 */
export function cleanAttachments(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const a of list.slice(0, 10)) {
    const url = typeof a?.url === "string" ? a.url.trim() : "";
    if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) continue;
    out.push({
      url,
      filename: sanitiseHeaderText(a.filename, 200) || "attachment",
      mimeType: sanitiseHeaderText(a.mimeType, 100) || null,
      bytes: Number.isFinite(a.bytes) ? Math.max(0, Math.floor(a.bytes)) : null,
    });
  }
  return out.length ? out : null;
}

/** Is there anything in it worth keeping? An empty draft is deleted, not saved. */
export function draftIsEmpty(data) {
  return !String(data?.body || "").trim() && !String(data?.subject || "").trim();
}

/**
 * Find the draft at a place, or null.
 *
 * @param place  { threadId, leadId, kind }
 */
export async function findDraftAt(db, salesRepId, { threadId = null, leadId = null, kind = "new" } = {}) {
  return db.salesEmailDraft.findFirst({
    where: {
      salesRepId,
      ...(threadId ? { threadId, kind: cleanKind(kind) } : { threadId: null, leadId, kind: "new" }),
    },
    orderBy: { updatedAt: "desc" },
    select: DRAFT_SELECT,
  });
}

/**
 * Save: update the draft by id when the rep has one, else continue the draft
 * at the same place, else create. Returns the row, or null when the content
 * was empty (and any existing draft at that id was deleted).
 *
 * @param scope  { salesRepId, leadId, threadId } — ALL read by the route from
 *               rows the rep owns, never from the body.
 */
export async function saveDraft(db, { salesRepId, leadId, threadId = null, id = null, input = {} }) {
  const data = draftDataFrom(input);
  const kind = data.kind || cleanKind(input?.kind);

  const existing = id
    ? await db.salesEmailDraft.findFirst({ where: { id, salesRepId }, select: DRAFT_SELECT })
    : await findDraftAt(db, salesRepId, { threadId, leadId, kind });

  const merged = { ...(existing || {}), ...data };
  if (draftIsEmpty(merged)) {
    if (existing) await db.salesEmailDraft.delete({ where: { id: existing.id } });
    return null;
  }

  if (existing) {
    return db.salesEmailDraft.update({ where: { id: existing.id }, data, select: DRAFT_SELECT });
  }
  return db.salesEmailDraft.create({
    data: { salesRepId, leadId, threadId, kind, ...data },
    select: DRAFT_SELECT,
  });
}

/** The rep's drafts, newest first — for the list's pencil marks. */
export async function listDrafts(db, salesRepId, { threadIds = null } = {}) {
  return db.salesEmailDraft.findMany({
    where: { salesRepId, ...(threadIds ? { threadId: { in: threadIds } } : {}) },
    orderBy: { updatedAt: "desc" },
    select: DRAFT_SELECT,
  });
}

/** Discard. Only the rep's own; a foreign id deletes nothing and says so. */
export async function discardDraft(db, salesRepId, id) {
  const gone = await db.salesEmailDraft.deleteMany({ where: { id, salesRepId } });
  return gone.count > 0;
}
