// lib/businessNumber/secrets.js
//
// The carrier account number, the port-out PIN and the phone bill: the three
// things that, together, let somebody steal a phone number. A SIM-swap
// fraudster's whole kit is an account number and a PIN.
//
// ══ Encrypted at rest, with its own key ═════════════════════════════════════
//
// The token-crypto pattern (lib/meta/tokenCrypto.js — AES-256-GCM, one base64
// blob per column) with a DEDICATED key, PORT_SECRETS_KEY, for the reason that
// file gives for not reusing BETTER_AUTH_SECRET: a key is rotated with what it
// protects in mind, and the mailbox credentials made the same choice
// (MAIL_CREDENTIALS_KEY). Each blob is sealed with the ROW ID as additional
// authenticated data, so a ciphertext copied onto another company's row will
// not open there.
//
// Without the key, porting is refused before anything is typed — the form says
// so rather than accepting a PIN it would then have to store in the clear.
//
// ══ Never in a log ══════════════════════════════════════════════════════════
//
// redactPortDetail() is what every error log and activity entry in this
// feature passes its detail through. It drops the secret fields by NAME and
// also masks any run of digits that IS one of the secrets, so a provider error
// message that echoes the PIN back ("PIN 4417 rejected") does not carry it into
// PlatformError. The check feeds it exactly that message.

import { parseAesKey, sealWithKey, openWithKey } from "@/lib/meta/tokenCrypto";

function loadKey() {
  return parseAesKey(process.env.PORT_SECRETS_KEY);
}

/** Is a usable key configured? Never throws. */
export function portSecretsConfigured() {
  return loadKey() !== null;
}

/** Seal one secret for one row. Null in, null out. */
export function sealPortSecret(rowId, plaintext) {
  if (plaintext == null || plaintext === "") return null;
  const key = loadKey();
  if (!key) throw new Error("PORT_SECRETS_KEY is not set (32 bytes, hex or base64) — refusing to store a port secret.");
  if (!rowId) throw new Error("sealPortSecret: the row id is the AAD and is required.");
  return sealWithKey(key, String(plaintext), `brought-number:${rowId}`);
}

/** Open one secret for one row. Throws on a wrong key, wrong row, or tampering. */
export function openPortSecret(rowId, blob) {
  if (!blob) return null;
  const key = loadKey();
  if (!key) throw new Error("PORT_SECRETS_KEY is not set — cannot open a port secret.");
  return openWithKey(key, blob, `brought-number:${rowId}`);
}

/** Field names that are secret wherever they appear. */
export const SECRET_FIELDS = Object.freeze([
  "pin",
  "accountNumber",
  "account_number",
  "accountNumberEnc",
  "pinEnc",
  "billEnc",
  "bill",
  "file",
]);

/**
 * A copy of `detail` that is safe to log. PURE.
 *
 * @param detail   any object about to reach recordError / console / activity
 * @param secrets  the actual secret VALUES in play, so a provider message that
 *                 quotes one is masked too
 */
export function redactPortDetail(detail, secrets = []) {
  const values = (Array.isArray(secrets) ? secrets : [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length >= 3);
  const maskString = (str) => {
    let out = String(str);
    for (const v of values) out = out.split(v).join("•".repeat(Math.min(v.length, 8)));
    return out;
  };
  const walk = (v, depth) => {
    if (depth > 6) return "[…]";
    if (v == null) return v;
    if (typeof v === "string") return maskString(v);
    if (typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (SECRET_FIELDS.includes(k)) {
        out[k] = val == null || val === "" ? val : "[redacted]";
        continue;
      }
      out[k] = walk(val, depth + 1);
    }
    return out;
  };
  return walk(detail, 0);
}

/** Last four, for a screen that has to show WHICH account was entered. */
export function lastFour(value) {
  const digits = String(value || "").replace(/\s/g, "");
  return digits.length > 4 ? `••••${digits.slice(-4)}` : digits ? "••••" : null;
}
