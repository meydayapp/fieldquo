// lib/sales/mailbox/store.js
//
// Connecting, re-testing and revoking a rep's work mailbox — the owner's
// actions on the rep's card.
//
// ══ One action: the address and the password, tested, then saved ══════════
//
// The owner's words: "the connection should happen AT THE MOMENT he adds or
// changes the work mailbox on the rep's card". So connectMailbox() is what
// the card's "Work mailbox" control calls: it validates the address the way
// the older workEmail edit did (lib/sales/repAdmin.js's rules — not the
// login address, not another rep's), seals the password, tests IMAP and
// SMTP with it, and writes SalesRep.workEmail AND the SalesMailbox row in
// one transaction. A failed test still saves the row — as "error", with the
// two results in words — so the card can show what failed and offer Retry
// without the owner typing the password again; a wrong password is the one
// case Retry cannot fix, and its sentence says so.
//
// ══ What no caller ever gets back ═════════════════════════════════════════
//
// publicMailbox() is the only shape that leaves this file, and it has no
// `secret`. scripts/check-sales-mailbox.mjs asserts that no route under
// /api selects or returns the column.

import { normaliseWorkEmail, workEmailProblem } from "../repAdmin";
import { mailboxSecretsConfigured, openMailboxSecret, sealMailboxSecret, SECRETS_UNCONFIGURED_SENTENCE } from "./secret";
import { testImap } from "./imap";
import { testSmtp } from "./smtp";

export const DEFAULT_HOSTS = Object.freeze({
  imapHost: "mail.privateemail.com",
  imapPort: 993,
  smtpHost: "mail.privateemail.com",
  smtpPort: 465,
});

/** The card's shape. No secret, ever. */
export const MAILBOX_PUBLIC_SELECT = {
  id: true,
  address: true,
  imapHost: true,
  imapPort: true,
  smtpHost: true,
  smtpPort: true,
  status: true,
  imapResult: true,
  smtpResult: true,
  sentFolder: true,
  lastSyncAt: true,
  lastSyncCount: true,
  lastError: true,
  lastErrorAt: true,
  connectedAt: true,
  revokedAt: true,
};

function cleanHost(value, fallback) {
  const s = String(value || "").trim().toLowerCase();
  return /^[a-z0-9.-]{3,253}$/.test(s) ? s : fallback;
}
function cleanPort(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

/** The host settings from a request body, defaults for anything missing or odd. */
export function hostSettingsFrom(body = {}) {
  return {
    imapHost: cleanHost(body.imapHost, DEFAULT_HOSTS.imapHost),
    imapPort: cleanPort(body.imapPort, DEFAULT_HOSTS.imapPort),
    smtpHost: cleanHost(body.smtpHost, DEFAULT_HOSTS.smtpHost),
    smtpPort: cleanPort(body.smtpPort, DEFAULT_HOSTS.smtpPort),
  };
}

/** Both tests, in words, plus the folders IMAP named. */
export async function testMailbox(settings, password, { imap = testImap, smtp = testSmtp } = {}) {
  const [i, s] = await Promise.all([imap(settings, password), smtp(settings, password)]);
  return {
    ok: i.ok && s.ok,
    imapResult: i.sentence,
    smtpResult: s.sentence,
    sentFolder: i.sentFolder || null,
    draftsFolder: i.draftsFolder || null,
  };
}

/**
 * Connect (or re-connect with a new address/password).
 *
 * @param db
 * @param rep       { id, email, workEmail } — the row, read by the route
 * @param body      { workEmail, password, imapHost?, imapPort?, smtpHost?, smtpPort? }
 * @param deps      { test } for the check script
 * @returns { ok, status, error } | { ok, mailbox }
 */
export async function connectMailbox(db, rep, body, { test = testMailbox } = {}) {
  if (!mailboxSecretsConfigured()) {
    return { ok: false, status: 503, error: SECRETS_UNCONFIGURED_SENTENCE };
  }
  const address = normaliseWorkEmail(body?.workEmail);
  if (!address) return { ok: false, status: 400, error: "Enter the mailbox address." };
  const problem = workEmailProblem(address, rep.email);
  if (problem) return { ok: false, status: 400, error: problem };

  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return { ok: false, status: 400, error: "Enter the mailbox password." };
  if (password.length > 512) return { ok: false, status: 400, error: "That password is too long to be real." };

  const taken = await db.salesRep.findUnique({ where: { workEmail: address }, select: { id: true } });
  if (taken && taken.id !== rep.id) {
    return { ok: false, status: 409, error: `${address} is already another rep's work mailbox.` };
  }

  const settings = { address, ...hostSettingsFrom(body) };
  const result = await test(settings, password);
  const secret = sealMailboxSecret(password);

  const data = {
    ...settings,
    secret,
    status: result.ok ? "connected" : "error",
    imapResult: result.imapResult,
    smtpResult: result.smtpResult,
    sentFolder: result.sentFolder,
    draftsFolder: result.draftsFolder,
    lastError: result.ok ? null : "The connection test failed — see the IMAP and SMTP lines.",
    lastErrorAt: result.ok ? null : new Date(),
    revokedAt: null,
  };

  const mailbox = await db.$transaction(async (tx) => {
    const existing = await tx.salesMailbox.findUnique({ where: { salesRepId: rep.id }, select: { id: true, address: true } });
    // A new address is a new mailbox: its UIDs mean nothing here, so the
    // sync position starts over. The same address keeps its position.
    const reset = !existing || existing.address !== address
      ? { inboxUidValidity: null, inboxLastUid: 0, sentUidValidity: null, sentLastUid: 0, syncingSince: null }
      : {};
    await tx.salesRep.update({ where: { id: rep.id }, data: { workEmail: address } });
    return tx.salesMailbox.upsert({
      where: { salesRepId: rep.id },
      create: { salesRepId: rep.id, ...data, connectedAt: new Date() },
      update: { ...data, ...reset, connectedAt: new Date() },
      select: MAILBOX_PUBLIC_SELECT,
    });
  });

  return { ok: true, mailbox, tested: result.ok };
}

/** Re-run both tests with the stored password. The card's Retry. */
export async function retryMailbox(db, salesRepId, { test = testMailbox } = {}) {
  const row = await db.salesMailbox.findUnique({ where: { salesRepId } });
  if (!row) return { ok: false, status: 404, error: "This rep has no mailbox to retry." };
  if (!row.secret || row.status === "revoked") {
    return { ok: false, status: 409, error: "This mailbox was disconnected; connect it again with its password." };
  }
  let password;
  try {
    password = openMailboxSecret(row.secret);
  } catch (err) {
    return { ok: false, status: 500, error: `The stored password could not be read (${err?.message || "wrong key"}); connect it again.` };
  }
  const result = await test(row, password);
  const mailbox = await db.salesMailbox.update({
    where: { id: row.id },
    data: {
      status: result.ok ? "connected" : "error",
      imapResult: result.imapResult,
      smtpResult: result.smtpResult,
      sentFolder: result.sentFolder ?? row.sentFolder,
      draftsFolder: result.draftsFolder ?? row.draftsFolder,
      lastError: result.ok ? null : "The connection test failed — see the IMAP and SMTP lines.",
      lastErrorAt: result.ok ? null : new Date(),
    },
    select: MAILBOX_PUBLIC_SELECT,
  });
  return { ok: true, mailbox, tested: result.ok };
}

/**
 * Disconnect: the secret is cleared, the sync stops, the threads stay. The
 * rep's workEmail is left alone — the address is still theirs; what is gone
 * is the portal's way in.
 */
export async function revokeMailbox(db, salesRepId) {
  const row = await db.salesMailbox.findUnique({ where: { salesRepId }, select: { id: true } });
  if (!row) return { ok: false, status: 404, error: "This rep has no mailbox connected." };
  const mailbox = await db.salesMailbox.update({
    where: { id: row.id },
    data: { secret: null, status: "revoked", revokedAt: new Date(), syncingSince: null },
    select: MAILBOX_PUBLIC_SELECT,
  });
  return { ok: true, mailbox };
}

/** The card's row for one rep, or null. */
export async function publicMailboxFor(db, salesRepId) {
  return db.salesMailbox.findUnique({ where: { salesRepId }, select: MAILBOX_PUBLIC_SELECT });
}

/**
 * The rep-facing verdict: is their mail flowing? One of three sentences the
 * rep's Conversations page can show, never a setting to change.
 *
 * @returns { connected, state: "none" | "connected" | "error" | "revoked", address }
 */
export function mailboxState(mailbox) {
  if (!mailbox) return { connected: false, state: "none", address: null };
  if (mailbox.status === "connected") return { connected: true, state: "connected", address: mailbox.address };
  if (mailbox.status === "revoked") return { connected: false, state: "revoked", address: mailbox.address };
  return { connected: false, state: "error", address: mailbox.address };
}
