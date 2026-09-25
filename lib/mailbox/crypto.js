// lib/mailbox/crypto.js
//
// A connected work mailbox's credential at rest — an IMAP password, or a
// Google / Microsoft refresh token that can read the whole mailbox.
//
// ══ Its own key, on purpose ═══════════════════════════════════════════════
//
// The sales portal's rep mailboxes (lib/sales/mailbox/secret.js) share
// META_TOKEN_ENCRYPTION_KEY with the Meta tokens, and argue for it: one key
// to rotate. This is a different class of secret — a contractor's whole
// inbox, their personal mail included — and the owner asked for it to live
// under its own key, MAIL_CREDENTIALS_KEY, so a leak or rotation of one
// never touches the other. The AES-256-GCM implementation is NOT copied: it
// is lib/meta/tokenCrypto.js's sealWithKey / openWithKey with the key passed
// in, so there is one cipher routine in the codebase and its check
// (scripts/check-meta-token-crypto.mjs) covers both.
//
// ══ The rules ═════════════════════════════════════════════════════════════
//
//   · No key, no connection. mailCryptoConfigured() is asked before any
//     password field or OAuth button is drawn and again by every route. There
//     is no default key and no plaintext fallback — a missing variable is a
//     disabled option with one honest sentence, never a quieter store.
//   · The blob is bound to its row: the MailboxConnection id is the GCM
//     associated data, so a ciphertext copied onto another company's row
//     (by a SQL slip, or on purpose) fails authentication instead of logging
//     somebody into the wrong mailbox.
//   · Opened only by the sync and the send, on the server, for one session.
//     No route selects `secretEnc`; scripts/check-mailbox.mjs scans for it.

import { parseAesKey, sealWithKey, openWithKey } from "@/lib/meta/tokenCrypto";

export const MAIL_KEY_VAR = "MAIL_CREDENTIALS_KEY";

function loadKey() {
  return parseAesKey(process.env[MAIL_KEY_VAR]);
}

/** Is a real 32-byte key configured? Never throws. */
export function mailCryptoConfigured() {
  return loadKey() !== null;
}

/**
 * Plaintext → stored blob, bound to `connectionId`. Throws without a key or
 * without an id — a blob bound to nothing is exactly what the binding exists
 * to prevent.
 */
export function sealMailSecret(plaintext, connectionId) {
  const key = loadKey();
  if (!key) throw new Error(`${MAIL_KEY_VAR} is not set (or is not a 32-byte base64/hex value) — cannot store a mailbox credential.`);
  if (typeof connectionId !== "string" || !connectionId) throw new Error("sealMailSecret: the connection id is required.");
  return sealWithKey(key, plaintext, `mailbox:${connectionId}`);
}

/** Stored blob → plaintext, for one session. Throws on a wrong key, a wrong row, or tampering. */
export function openMailSecret(blob, connectionId) {
  const key = loadKey();
  if (!key) throw new Error(`${MAIL_KEY_VAR} is not set — cannot open a mailbox credential.`);
  if (typeof connectionId !== "string" || !connectionId) throw new Error("openMailSecret: the connection id is required.");
  return openWithKey(key, blob, `mailbox:${connectionId}`);
}
