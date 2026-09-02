// lib/sales/invite.js
//
// The rep invitation: mint a token, email a link, let them set their own
// password, stamp acceptedAt.
//
// ══ Why this is a new pattern rather than a reused one ════════════════════
//
// The owner's requirement, verbatim: "i will be able to add the salespeople in
// the same way a company adds an employee." That is a statement about the
// EXPERIENCE — type a name and an email, click Invite, they get a link — and it
// is met by looking like /app/settings/team, not by calling it.
//
// POST /api/settings/members cannot be reused, and every one of its assumptions
// is false here: it resolves an actor through getCurrentMember (FieldQuo staff
// have no Member row), charges the invite against that company's licensed seats
// (FieldQuo pays the rep, not the reverse), validates a role against the
// per-company permission grid (there is no rung for "sales rep"), creates a
// real Better Auth organization invitation (a rep must never acquire an
// activeOrganizationId — that is the credential getCurrentMember reads), and
// lands a Member row inside one tenant on accept.
//
// The other candidate was FieldQuo's existing staff-creation route,
// POST /api/platform/admins — and it does not have an invite flow at all. A
// superadmin types the new admin's password server-side and hands it over out
// of band, which means FieldQuo's own staff credentials are, briefly, known to
// two people and travelling through whatever channel was handy. This file is
// the better pattern, built once, here: the invitee chooses a password nobody
// else ever sees.
//
// ══ Only the HASH of the token is stored ══════════════════════════════════
//
// SalesRep.inviteTokenHash, not inviteToken. A database dump, a log line or a
// support screenshot of the row must not be enough to become a FieldQuo sales
// rep. The plaintext exists exactly twice: in the email, and in the URL the
// invitee pastes back.
//
// SHA-256 rather than bcrypt, deliberately, and this is the opposite call from
// the password field two lines below it in the same model. An invite token is
// 32 bytes of crypto randomness with ~256 bits of entropy and a seven-day life;
// there is no dictionary to attack and no work factor worth paying on every
// page load of the accept screen. A password is user-chosen, low-entropy and
// permanent, so it gets bcrypt. Same table, different threat, different tool.

import { createHash, randomBytes } from "node:crypto";

/** How long an invitation is good for. */
export const INVITE_TTL_DAYS = 7;

/** Minimum length for a rep's chosen password. */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * A fresh invitation: the plaintext to email, and the hash to store.
 *
 * URL-safe base64 rather than hex so the link stays short enough to survive a
 * mail client's line wrapping without a dash landing mid-token.
 */
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

/** The stored form of an invite token. Never store the other one. */
export function hashInviteToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

/** When an invitation minted now stops working. */
export function inviteExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * May this invitation be accepted right now?
 *
 * Pure, so scripts/check-sales-auth.mjs can execute every refusal without a
 * database — the same reason lib/migrations/state.js is pure, and for the same
 * class of guarantee: this decides whether a stranger becomes FieldQuo staff.
 *
 * Four refusals, and each is a different fact:
 *
 *   unknown   — no row matched the hash. A wrong, forged or already-rotated
 *               token.
 *   accepted  — acceptedAt is stamped. An invite is single-use; a link sitting
 *               in a mailbox forever is a standing password reset for an
 *               account somebody else now holds.
 *   expired   — inviteExpiresAt is in the past.
 *   inactive  — the rep was deactivated (or has left) between the invitation
 *               being sent and the link being clicked. Refusing here rather
 *               than only at login means a revoked hire cannot even set a
 *               password.
 *
 * @param rep  the SalesRep row, or null when nothing matched the hash.
 * @returns `{ ok: true }` or `{ ok: false, reason }`.
 */
export function inviteState(rep, now = new Date()) {
  if (!rep) return { ok: false, reason: "unknown" };
  if (rep.acceptedAt) return { ok: false, reason: "accepted" };
  if (!rep.active || rep.endedAt) return { ok: false, reason: "inactive" };
  if (!rep.inviteExpiresAt) return { ok: false, reason: "expired" };
  if (new Date(rep.inviteExpiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/**
 * May this rep sign in with a password right now?
 *
 * Deliberately separate from inviteState: "the invite is still good" and "this
 * account may authenticate" are opposite states — an accepted invite is exactly
 * what makes a login possible and an acceptance impossible. Collapsing them
 * into one predicate is how a single-use link becomes reusable.
 *
 * A deactivated rep fails here even holding the right password, and their
 * existing token stops working within one request rather than within twelve
 * hours, because lib/sales/gate.js re-reads this on every call.
 */
export function canAuthenticate(rep) {
  if (!rep) return false;
  if (!rep.active) return false;
  if (rep.endedAt) return false;
  if (!rep.acceptedAt) return false;
  if (!rep.passwordHash) return false;
  return true;
}

/**
 * A rep's attribution code, derived from their name.
 *
 * Lowercase, hyphenated, ASCII only: it ends up in a query string on a public
 * signup URL, and a code that needs percent-encoding is a code somebody will
 * mistype off a business card. Uniqueness is the caller's job — SalesRep.code
 * is @unique and the route retries with a suffix rather than this function
 * guessing at a database it cannot see.
 */
export function codeFromName(name) {
  const slug = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  // A name that is entirely non-Latin leaves nothing behind. "rep" plus the
  // caller's uniqueness suffix is honest; an empty code would collide with
  // every other empty one and fail the unique index instead of saying why.
  return slug || "rep";
}

/** Is this a code a human could read off a card and type back correctly? */
export function isValidCode(code) {
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(String(code || ""));
}
