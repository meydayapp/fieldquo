// lib/sms/renderTemplate.js
//
// Editable wording for the texts a CLIENT receives.
//
// ══ Tokens are a whitelist, not free substitution ══════════════════════════
//
// A contractor can rewrite "on the way" into their own voice, but only using
// the tokens the message actually has. A template that references {price} would
// render the literal string "{price}" to a customer — so an unknown token is a
// validation error at SAVE time, not a surprise on someone's phone. This is the
// same instinct as the rest of the product: absence of a value is not a value,
// and a control that appears to work must actually work.
//
// ══ No custom text → the built-in wording ══════════════════════════════════
//
// The default lives in ./templates.js and stays the single source for the
// wording nobody edited. A company that never touches this gets exactly what it
// got before the feature existed.
//
// Pure — no database. The caller passes the stored template (or null) and the
// values; this decides what string goes out.
import {
  onMyWayText,
  appointmentReminderText,
  bookingConfirmationText,
} from "./templates";

/**
 * The editable message types.
 *
 * Only `on_my_way` is wired to actually send today (see the job-visit route),
 * so it's the only one the settings screen exposes. The others are defined here
 * so that WHEN their send path is built, the editor and the renderer already
 * know them — but they are deliberately not offered for editing until they
 * send, because an editor for a message that never goes out is the dead control
 * this codebase keeps removing.
 */
export const SMS_TEMPLATE_TYPES = {
  on_my_way: {
    label: "On my way",
    editable: true,
    // token → how to describe it, and a sample value for the live preview.
    tokens: {
      company: { hint: "your business name", sample: "Northside Painting" },
      worker: { hint: "the assigned crew member", sample: "Dave" },
      name: { hint: "the client's first name", sample: "Sam" },
      eta: { hint: "estimated arrival, if known", sample: "20 min" },
    },
    // The fallback, and the shape the default takes so the preview of an unedited
    // template matches what actually sends.
    fallback: (v) => onMyWayText({ companyName: v.company, workerName: v.worker, eta: v.eta }),
  },

  appointment_reminder: {
    label: "Appointment reminder",
    editable: false, // not wired to send yet
    tokens: {
      company: { hint: "your business name", sample: "Northside Painting" },
      when: { hint: "the appointment time", sample: "Tue, Aug 12 at 2:00 PM" },
      location: { hint: "where the visit is", sample: "123 Oak St" },
    },
    fallback: (v) =>
      appointmentReminderText({ companyName: v.company, scheduledAt: v.when, location: v.location }),
  },

  booking_confirmation: {
    label: "Booking confirmation",
    editable: false,
    tokens: {
      company: { hint: "your business name", sample: "Northside Painting" },
      service: { hint: "what they booked", sample: "on-site estimate" },
      when: { hint: "the appointment time", sample: "Tue, Aug 12 at 2:00 PM" },
    },
    fallback: (v) =>
      bookingConfirmationText({ companyName: v.company, eventTypeName: v.service, startTime: v.when }),
  },
};

/** All `{token}` occurrences in a string. */
function tokensIn(text) {
  return [...String(text || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/**
 * Is this a valid template for this type?
 *
 * @returns { ok, unknownTokens, tooLong }
 *          A single SMS segment is 160 chars; past ~320 it's three segments and
 *          the cost triples, so a very long template is flagged (not refused —
 *          the company may accept the cost).
 */
export function validateTemplate(type, text) {
  const spec = SMS_TEMPLATE_TYPES[type];
  if (!spec) return { ok: false, unknownTokens: [], tooLong: false, unknownType: true };

  const allowed = new Set(Object.keys(spec.tokens));
  const unknownTokens = [...new Set(tokensIn(text))].filter((t) => !allowed.has(t));
  const trimmed = String(text || "").trim();

  return {
    ok: trimmed.length > 0 && unknownTokens.length === 0,
    unknownTokens,
    tooLong: trimmed.length > 320,
    empty: trimmed.length === 0,
  };
}

/**
 * Substitute a template's tokens with values.
 *
 * A token with no value collapses to empty and its surrounding whitespace is
 * tidied, so "ETA {eta}" with no eta becomes "ETA" rather than "ETA {eta}" or a
 * stray double space. Only whitelisted tokens are substituted; an unknown one
 * is left verbatim, which validateTemplate has already refused at save time —
 * this is belt-and-braces for a template that somehow got stored anyway.
 */
export function fillTemplate(type, text, values = {}) {
  const spec = SMS_TEMPLATE_TYPES[type];
  const allowed = spec ? new Set(Object.keys(spec.tokens)) : new Set();

  let out = String(text || "").replace(/\{(\w+)\}/g, (whole, token) => {
    if (!allowed.has(token)) return whole;
    const v = values[token];
    return v == null || v === "" ? "" : String(v);
  });

  // Tidy the holes an empty token left behind: doubled spaces, and a space
  // before punctuation ("ETA , reply STOP").
  out = out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  return out;
}

/**
 * The message to actually send.
 *
 * Custom text when the company set (valid) wording for this type; the built-in
 * fallback otherwise. `values` uses the same token names as the template.
 */
export function renderMessage({ type, templates, values = {} }) {
  const spec = SMS_TEMPLATE_TYPES[type];
  if (!spec) return "";

  const custom = templates && typeof templates === "object" ? templates[type] : null;
  if (custom && validateTemplate(type, custom).ok) {
    return fillTemplate(type, custom, values);
  }
  return spec.fallback(values);
}
