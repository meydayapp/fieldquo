// lib/company/chat/fileLinks.js
//
// The link a reader's screen uses to open one chat photo or file:
//
//   /api/chat/files/<messageId>/<index>?v=thumb|full&exp=<unix s>&sig=<hex>
//
// ══ Two locks, and why the second one exists ══════════════════════════════
//
// The route re-checks, on EVERY open, that the session's member can read the
// room the message is in (a private channel answers a non-member 404, like a
// room that does not exist) and that the message has not been removed. That
// is the lock that matters, and it alone would make the files private.
//
// The link also carries an HMAC over (reader, message, index, variant,
// expiry). It is bound to the READER — a link copied out of one person's
// screen is refused for anybody else's session, even somebody in the same
// room — and it EXPIRES (FILE_LINK_TTL_SECONDS), so a URL that leaks into a
// screenshot, a pasted message or a proxy log stops working on its own. The
// Cloudinary link the route then redirects to expires in five minutes
// (lib/hr/documentFile.js signedOpenLink — the same signer HR uses).
//
// The secret is BETTER_AUTH_SECRET: already required, already documented,
// and already the secret a forged session would need. A new variable would
// be one more thing a deploy can be missing (memory: check-env-docs).
//
// Server-only (node:crypto). The screen never builds these; the thread
// payload carries them.
import { createHmac } from "node:crypto";
import { sameSignature } from "@/lib/media/directUpload";

/** How long a link in a thread payload works. Long enough for a room left
 *  open through a coffee; the screen re-reads the thread when one has run out. */
export const FILE_LINK_TTL_SECONDS = 60 * 60;

export const FILE_VARIANTS = Object.freeze(["thumb", "full"]);

/** Who a link is for: the member, or — for a read-only support session,
 *  which holds no member row — the platform admin behind it. */
export function readerKey(member) {
  if (member?.id) return `m:${member.id}`;
  if (member?.impersonation && member?.platformAdminId) return `pa:${member.platformAdminId}`;
  return null;
}

function secretOr(secret) {
  const s = secret ?? process.env.BETTER_AUTH_SECRET ?? "";
  return typeof s === "string" && s.length >= 16 ? s : null;
}

function signature({ reader, messageId, index, variant, exp }, secret) {
  return createHmac("sha256", secret).update(`chat-file|${reader}|${messageId}|${index}|${variant}|${exp}`).digest("hex");
}

/**
 * The link for one attachment, for one reader — or null when nothing can be
 * signed (no reader, no secret). A null link is drawn as "can't open this
 * file here", never as a link that 404s.
 */
export function fileLinkFor(member, messageId, index, variant, { now = Date.now(), secret, ttl = FILE_LINK_TTL_SECONDS } = {}) {
  const reader = readerKey(member);
  const key = secretOr(secret);
  if (!reader || !key || !messageId || !FILE_VARIANTS.includes(variant)) return null;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) return null;
  const exp = Math.floor(now / 1000) + ttl;
  const sig = signature({ reader, messageId, index: i, variant, exp }, key);
  return `/api/chat/files/${encodeURIComponent(messageId)}/${i}?v=${variant}&exp=${exp}&sig=${sig}`;
}

/**
 * Check a link the browser followed, for the session's member.
 * @returns { ok: true } | { ok: false, code: "bad_link" | "expired" | "unavailable" }
 *   `expired` is told apart so the screen can re-read the thread for fresh
 *   links; everything else answers like a file that is not there.
 */
export function verifyFileLink(member, { messageId, index, variant, exp, sig } = {}, { now = Date.now(), secret } = {}) {
  const key = secretOr(secret);
  if (!key) return { ok: false, code: "unavailable" };
  const reader = readerKey(member);
  const i = Number(index);
  const e = Number(exp);
  if (!reader || !messageId || !FILE_VARIANTS.includes(variant) || !Number.isInteger(i) || i < 0 || !Number.isInteger(e)) {
    return { ok: false, code: "bad_link" };
  }
  if (typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, code: "bad_link" };
  const expected = signature({ reader, messageId, index: i, variant, exp: e }, key);
  // Signature first: an expired link for somebody ELSE is "bad", not
  // "expired" — the second answer would confirm the link was once good.
  if (!sameSignature(expected, sig)) return { ok: false, code: "bad_link" };
  if (Math.floor(now / 1000) > e) return { ok: false, code: "expired" };
  return { ok: true };
}
