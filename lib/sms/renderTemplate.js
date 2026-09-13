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
 * `on_my_way` (the job-visit route) and `appointment_reminder` (the reminder
 * cron) are wired to send, so those two are what the settings screen exposes.
 * `booking_confirmation` is defined so that WHEN its send path is built the
 * editor and the renderer already know it — but it is deliberately not
 * offered for editing until it sends, because an editor for a message that
 * never goes out is the dead control this codebase keeps removing.
 *
 * ── A custom template is written in ONE language ─────────────────────────
 *
 * The company types their wording once, in the language they work in. The
 * built-in wording exists in eight (lib/sms/templates.js). So renderMessage
 * uses the custom text only when the client reads the language the template
 * was written in — the company's default — and the built-in translation for
 * everyone else. The alternative, sending an English custom text to a client
 * whose quote was in Spanish, is the exact defect the catalogue was added to
 * remove; and machine-translating the company's own words at send time is a
 * decision the owner has not taken.
 */
export const SMS_TEMPLATE_TYPES = {
  on_my_way: {
    label: "On my way",
    // The heading the settings screen shows, as a catalogue key — `label` is
    // the English fallback. English in lib/ is English in every office.
    labelKey: "app.smsTemplates.type.on_my_way",
    editable: true,
    // token → how to describe it, and a sample value for the live preview.
    // `hintKey` is what the screen renders; `hint` is its English fallback.
    tokens: {
      company: { hint: "your business name", hintKey: "app.smsTemplates.token.company", sample: "Northside Painting" },
      worker: { hint: "the assigned crew member", hintKey: "app.smsTemplates.token.worker", sample: "Dave" },
      name: { hint: "the client's first name", hintKey: "app.smsTemplates.token.name", sample: "Sam" },
      // Filled by app/api/jobs/[id]/visits/[visitId] from the crew member's
      // position at the tap to the job's site, through the same travel
      // estimate the booking page uses. Empty — and the surrounding words
      // tidied away — when neither end is known.
      eta: { hint: "estimated arrival, if known", hintKey: "app.smsTemplates.token.eta", sample: "20 min" },
      // The number to call to reschedule — replies to this text are never
      // read (see onMyWayText), so the built-in wording points here.
      phone: { hint: "your business phone", hintKey: "app.smsTemplates.token.phone", sample: "555-0100" },
    },
    // The fallback, and the shape the default takes so the preview of an unedited
    // template matches what actually sends.
    fallback: (v) =>
      onMyWayText({ companyName: v.company, workerName: v.worker, eta: v.eta, phone: v.phone, language: v.language }),
  },

  appointment_reminder: {
    label: "Appointment reminder",
    labelKey: "app.smsTemplates.type.appointment_reminder",
    // Sent by app/api/cron/appointment-reminders — which used to call the
    // English builder directly, so this said "not wired" while the text went
    // out every day. It renders through here now, so the wording is the
    // company's when they set it.
    editable: true,
    tokens: {
      company: { hint: "your business name", hintKey: "app.smsTemplates.token.company", sample: "Northside Painting" },
      when: { hint: "the appointment time", hintKey: "app.smsTemplates.token.when", sample: "Tue, Aug 12 at 2:00 PM" },
      location: { hint: "where the visit is", hintKey: "app.smsTemplates.token.location", sample: "123 Oak St" },
    },
    // `when` arrives already formatted — by the cron in the client's locale
    // and the company's zone, by the settings screen as a sample.
    fallback: (v) =>
      appointmentReminderText({
        companyName: v.company,
        when: v.when,
        location: v.location,
        language: v.language,
      }),
  },

  booking_confirmation: {
    label: "Booking confirmation",
    labelKey: "app.smsTemplates.type.booking_confirmation",
    editable: false,
    tokens: {
      company: { hint: "your business name", hintKey: "app.smsTemplates.token.company", sample: "Northside Painting" },
      service: { hint: "what they booked", hintKey: "app.smsTemplates.token.service", sample: "on-site estimate" },
      when: { hint: "the appointment time", hintKey: "app.smsTemplates.token.when", sample: "Tue, Aug 12 at 2:00 PM" },
    },
    fallback: (v) =>
      bookingConfirmationText({
        companyName: v.company,
        eventTypeName: v.service,
        when: v.when,
        language: v.language,
      }),
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
 * Custom text when the company set (valid) wording for this type AND the
 * reader speaks the language it was written in; the built-in wording in the
 * reader's language otherwise. `values` uses the same token names as the
 * template.
 *
 * @param language          the CLIENT's language, from resolveClientLanguage.
 * @param templateLanguage  the language the company's custom wording is in —
 *                          their default language. Omitted means "assume the
 *                          template matches the reader", which is the old
 *                          behaviour and what the settings preview wants.
 */
export function renderMessage({ type, templates, values = {}, language = "en", templateLanguage = null }) {
  const spec = SMS_TEMPLATE_TYPES[type];
  if (!spec) return "";

  const custom = templates && typeof templates === "object" ? templates[type] : null;
  const readerMatchesTemplate = !templateLanguage || templateLanguage === language;
  if (custom && readerMatchesTemplate && validateTemplate(type, custom).ok) {
    return fillTemplate(type, custom, values);
  }
  return spec.fallback({ ...values, language });
}
