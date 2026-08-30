// lib/validation.js
export function formatPhoneInput(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);

  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
}

export function isValidPhone(value) {
  return /^\d{3}-\d{3}-\d{4}$/.test(value || "");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

// ══ Confirming a destructive action by typing the number ═══════════════════
//
// Separate from formatPhoneInput above, which writes 365-517-6689 and is what
// every ENTRY field in the app uses. These write and compare the DISPLAY form,
// (365) 517-6689 — the form lib/voice/numbers.js formatNumber() produces, which
// is what a confirmation box quoting a number asks somebody to retype.
//
// The bug: the release box compared "digits only, so punctuation doesn't defeat
// anyone" — against the E.164. digits("+13655176689") is ELEVEN characters and
// digits("3655176689") is ten, so a contractor typing exactly what the label
// told them to type could never match, and the red button never enabled. The
// looseness was real and pointed at the wrong string.

/** The ten national digits, with a NANP country code dropped. Null if not ten. */
export function nanpDigits(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

/** As-you-type (365) 517-6689. Non-NANP input is returned untouched. */
export function formatNanpInput(value) {
  const raw = String(value || "");
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  // A number that is not, or not yet, NANP is left exactly as typed rather than
  // rewritten into a shape it does not have. Silently reformatting somebody's
  // international number into brackets it does not use would be this file
  // asserting a fact about their phone that nobody checked.
  if (raw.trim().startsWith("+") && !/^1/.test(raw.replace(/\D/g, ""))) return raw;
  if (d.length > 10) return raw;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Did they type the number the confirmation box named?
 *
 * Deliberately loose about punctuation and about the country code — somebody
 * retyping a number off the screen above them on a phone keyboard is confirming
 * they read it, not proving they can reproduce E.164. It is deliberately STRICT
 * about the digits: that is the whole point of the box.
 */
export function confirmsNumber(typed, target) {
  const want = nanpDigits(target);
  if (want) return nanpDigits(typed) === want;
  // Not a NANP number: fall back to comparing every digit, so an international
  // line is still confirmable rather than being permanently unreleasable.
  const t = String(target || "").replace(/\D/g, "");
  return t.length > 0 && String(typed || "").replace(/\D/g, "") === t;
}
