// lib/dataDeletion/requests.js
//
// The parts of a data-deletion request that are the same whichever door it
// came through — the public form, Meta's callback, or an email registered by
// hand. Pure, so scripts/check-data-deletion.mjs can execute them.
//
// ══ What this deliberately does not contain ═══════════════════════════════
//
// No deletion. The owner's decision (2026-09-08) is that deletion is a manual
// act by FieldQuo's owner account, not an automated one, and this module is
// written to make that impossible to drift from by accident: it can mint a
// reference, validate an address and say how long the promise is, and it has
// no import of `db` at all.
//
// The constants and string helpers live in ./constants.js so client
// components can import them without dragging node:crypto into the browser
// bundle; this file is the server-side name for all of it.

import { randomBytes } from "node:crypto";
import { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX } from "./constants";

export {
  DELETION_BUSINESS_DAYS,
  DATA_DELETION_STATUSES,
  DATA_DELETION_SOURCES,
  HONEYPOT_FIELD,
  META_CALLBACK_PLACEHOLDER_EMAIL,
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_PREFIX,
  normaliseConfirmationCode,
  isPlausibleEmail,
  cleanText,
  publicStatus,
} from "./constants";

/** A fresh reference, e.g. "FQ-DEL-7K3M9Q". */
export function generateConfirmationCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${CODE_PREFIX}${out}`;
}
