// lib/sales/typedNumber.js
//
// What the dialler's display means as a number, or null — the console's
// PRE-CHECK before a typed number is saved and dialled.
//
// The server's normalisePhone (lib/sales/suppressionRules.js) is the
// authority and runs again on every save and every dial. This is written
// here rather than imported from there because that module reaches lib/db
// through lib/voice/numbers, and a client bundle cannot carry pg. The two
// must agree; scripts/check-sales-console.mjs feeds both the same inputs
// and refuses a difference. No dependencies, on purpose.

/** E.164 or null. NANP by default: ten digits get +1, eleven with a 1 get +. */
export function typedToE164(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  let e164 = null;
  if (raw.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else e164 = digits.length >= 8 ? `+${digits}` : null;
  return e164 && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Characters the display accepts from the keyboard. Everything else is dropped. */
export function cleanDialInput(value) {
  return String(value || "").replace(/[^\d+*#\s().-]/g, "").slice(0, 24);
}

/**
 * An E.164 number as a person reads it aloud — "+1 613 555 0100" — for the
 * Call button when the number that will ring is not one of the record's
 * stored numbers ("Call +1 613 555 0100", never "Call DRAIN KINGS": it is the
 * number that is being called). NANP gets its three groups; anything else
 * comes back as it was, because grouping another plan's digits without its
 * table is a guess dressed as a format, and the floor sells into CA/US.
 * Anything that is not E.164 also comes back as it was, so a label is never
 * blank.
 */
export function formatE164ForReading(e164) {
  const raw = String(e164 ?? "").trim();
  if (/^\+1\d{10}$/.test(raw)) return `+1 ${raw.slice(2, 5)} ${raw.slice(5, 8)} ${raw.slice(8)}`;
  return raw;
}
