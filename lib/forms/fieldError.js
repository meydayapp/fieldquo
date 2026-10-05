// lib/forms/fieldError.js
//
// A form error that remembers which fields caused it, so it can go away when
// one of them changes.
//
// The live test (2026-10-04): on Add visit, tick "This is a return to fix…",
// submit without a reason, and "Say why you're going back." appears — then
// untick the box and the sentence stays, telling the person to fill in a
// field that is no longer on the screen. An error is a statement about the
// form as it WAS at submit; once the person changes the thing it was about,
// the statement is stale, and a stale error is one people learn to ignore.
//
// An error with no fields (the server refused, the network dropped) is not
// about any one input and stays until the next submit replaces it.
//
// Pure, no imports — the check scripts run it directly.

/** @returns {{ message: string, fields: string[] }} */
export function fieldError(message, ...fields) {
  return { message: String(message || ""), fields: fields.filter(Boolean) };
}

/**
 * The error as it should stand after `field` changed: gone if that field was
 * one of its causes, untouched otherwise.
 */
export function afterFieldChange(error, field) {
  if (!error) return null;
  return Array.isArray(error.fields) && error.fields.includes(field) ? null : error;
}
