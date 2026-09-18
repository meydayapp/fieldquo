// lib/sales/mailbox/secret.js
//
// The mailbox password at rest.
//
// The platform already has one at-rest key and one AES-256-GCM
// implementation — lib/meta/tokenCrypto.js, under META_TOKEN_ENCRYPTION_KEY,
// written for a connected company's Meta token and executed by
// scripts/check-meta-token-crypto.mjs. A second key for a second secret would
// be a second thing to rotate, back up and lose; a second implementation
// would be the copy that rots. So this file is two names over that one
// implementation, and the rules that matter are stated here once:
//
//   · the password is sealed in the request that receives it and the
//     plaintext is not kept, logged or returned;
//   · it is opened only by the sync (IMAP) and the send (SMTP), on the
//     server, in the request that uses it;
//   · no route selects `secret` into a response — scripts/check-sales-mailbox.mjs
//     scans every route under /api for the column name;
//   · revoking clears the column; there is no "show password".

import { decryptToken, encryptToken, tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";

/** Is the at-rest key present? Connecting a mailbox is refused without it. */
export function mailboxSecretsConfigured() {
  return tokenCryptoConfigured();
}

/** Plaintext → the stored blob. Throws without a key. */
export function sealMailboxSecret(password) {
  return encryptToken(password);
}

/** The stored blob → plaintext, for one IMAP or SMTP session. Throws on a wrong key. */
export function openMailboxSecret(blob) {
  return decryptToken(blob);
}

/**
 * The sentence the card shows instead of a password field when the key is
 * missing — the same "can't store a token safely yet" shape Settings → Meta
 * Ads uses, because it is the same missing variable.
 */
export const SECRETS_UNCONFIGURED_SENTENCE =
  "The platform can't store a mailbox password safely yet: META_TOKEN_ENCRYPTION_KEY " +
  "isn't set in Vercel (docs/VERCEL.md). Set it and redeploy before connecting a mailbox.";
