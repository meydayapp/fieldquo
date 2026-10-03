// lib/mailbox/supportView.js
//
// What a FieldQuo superadmin's "view as company" session may NOT read: the
// content FieldQuo received from Google — a Gmail message's body, subject
// and attachments, and a Google Business Profile review's words.
//
// ══ Why ═══════════════════════════════════════════════════════════════════
//
// The privacy policy's Section 9 (Google user data) carries Google's Limited
// Use promise: nobody at FieldQuo reads Google user data without the
// company's permission, for security, or for the law. Impersonation
// (lib/platform/impersonate.js) needs no consent and opens the inbox, so
// before this file the promise was policy only — anyone opening a company
// with a connected Gmail could read its clients' email. Now the API answers
// that session with the fact of the message (who, when, which direction) and
// a sentence saying the content is withheld. There is no consent flow yet;
// when there is one, it lifts THIS gate and nothing else.
//
// Server-side, in the GET handlers the screens read (hiding a bubble in the
// browser is not access control). Every route that applies it asks
// inSupportView() first and changes NOTHING for a normal session — no extra
// key, no extra field — so a company's own staff get byte-identical answers.
// scripts/check-support-view-google.mjs executes the routes both ways.
//
// ══ Which messages ═══════════════════════════════════════════════════════
//
// A message with an EmailMessage row whose mailbox is a Google one, or whose
// mailbox is unknown (mailboxId null: the mailbox row went, or an inbox reply
// recorded with none). Unknown counts as Google on purpose — the safe answer
// to "might this have come from Gmail?" is yes. An inbox reply typed in
// FieldQuo and sent through Gmail is hidden too: its subject is the client's
// subject with "Re:" in front.
//
// Microsoft and IMAP mail are not Google user data and stay visible, the
// same as SMS, chat and Meta messages.
//
// Demo sandboxes (impersonationMode "demo_sandbox") are impersonation too
// and get the same answer; a demo company has no Gmail to hide.

/** The body every hidden email carries in a support session. */
export const SUPPORT_VIEW_EMAIL_TEXT = "Email content hidden in support view — ask the company for permission";

/** The text every hidden Google review carries in a support session. */
export const SUPPORT_VIEW_REVIEW_TEXT = "Review text hidden in support view — ask the company for permission";

/** "Email from client" / "Email to client" — the whole subject line, hidden. */
export function supportViewEmailSubject(direction) {
  return direction === "out" ? "Email to client" : "Email from client";
}

/** Is this request a FieldQuo staff member viewing as the company? */
export function inSupportView(member) {
  return Boolean(member?.impersonation);
}

/** Prisma select for a Message's provenance — added ONLY in a support session. */
export const EMAIL_PROVENANCE_SELECT = Object.freeze({
  select: { mailboxId: true, mailbox: { select: { provider: true } } },
});

/**
 * Prisma where: a Message that came through a Google mailbox (or an unknown
 * one). Written in the direct to-one form (no `is`), which Prisma accepts for
 * a relation filter; a message with no EmailMessage row never matches, so
 * `NOT: GOOGLE_EMAIL_MESSAGE_WHERE` keeps every SMS, chat and Meta message.
 */
export const GOOGLE_EMAIL_MESSAGE_WHERE = Object.freeze({
  email: { OR: [{ mailboxId: null }, { mailbox: { provider: "google" } }] },
});

/** Pure: the `email` relation as EMAIL_PROVENANCE_SELECT (or the filed route) loads it. */
export function isGoogleEmail(email) {
  if (!email || typeof email !== "object") return false;
  return !email.mailboxId || email.mailbox?.provider === "google";
}

/**
 * Pure: one shaped message for a support session. `m.email` must have been
 * loaded with EMAIL_PROVENANCE_SELECT; it never reaches the browser either
 * way (the caller added it, so the caller's normal shape has no `email`).
 * Anything that is not a Google email comes back exactly as it went in, minus
 * that key.
 */
export function supportViewMessage(m) {
  const { email, ...rest } = m || {};
  if (!isGoogleEmail(email)) return rest;
  return { ...rest, body: SUPPORT_VIEW_EMAIL_TEXT, attachments: [], hiddenInSupportView: true };
}

/** Pure: one Google review row for a support session — rating and name stay, the words go. */
export function supportViewReview(r) {
  if (!r || typeof r !== "object") return r;
  return {
    ...r,
    comment: r.comment == null ? null : SUPPORT_VIEW_REVIEW_TEXT,
    replyComment: r.replyComment == null ? null : SUPPORT_VIEW_REVIEW_TEXT,
    hiddenInSupportView: true,
  };
}

/** The keys a conversation score carries the homeowner's own words under. */
const QUOTED_TEXT_KEYS = new Set(["quote", "note"]);

/**
 * Pure: every `quote` / `note` string anywhere in a conversation score
 * blanked. The free score's signals quote what the homeowner wrote,
 * verbatim, and the paid read's `note` is the model's sentence about it — on
 * an email thread, that is the email. Structure, labels and numbers stay, so
 * the screen still draws the chip and the signal; only the words go. Applied
 * to a score object only — `note` means something else elsewhere.
 */
export function withoutQuotedText(value) {
  if (Array.isArray(value)) return value.map(withoutQuotedText);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = QUOTED_TEXT_KEYS.has(k) && typeof v === "string" ? "" : withoutQuotedText(v);
    }
    return out;
  }
  return value;
}

/** Does this thread hold any Google email? One count, for the routes that quote a thread. */
export async function threadHasGoogleEmail(db, { companyId, threadId }) {
  const n = await db.message.count({
    where: { threadId, thread: { companyId }, ...GOOGLE_EMAIL_MESSAGE_WHERE },
  });
  return n > 0;
}
