// lib/estimate/formFields.js
//
// Which questions the public instant-estimate form asks, per trade, and
// which of them a homeowner must answer before the button lights up.
//
// ── Why this is configurable at all ────────────────────────────────────────
//
// The form shipped with photos and a budget band as hard requirements — the
// Roofr study (docs/research/roofr-ui-study.md §4) counted seven taps on their
// estimator against ours, which "demands photos and a budget before any
// number". The owner's ask (2026-09-24): "if the company want to make some of
// the fields optional like picture.. or other things.. can you change it?"
//
// So each of the seven qualifier fields is `required`, `optional` or `hidden`
// per trade, saved under `fields` on the trade's InstantQuoteConfig.config.
// The DEFAULTS are exactly what the form did before this existed: nothing
// changes for a company that never opens the setting.
//
// ── Two rules the setting cannot override ──────────────────────────────────
//
// 1. A homeowner must leave a way to be reached. Phone and email can each be
//    optional (either one will do — today's rule), one of them can be hidden
//    (the other then becomes required), but both hidden is refused, because
//    a lead with a name and no contact is not a lead.
// 2. The address is not the form's to drop when the estimator MEASURES from
//    it (roofing, gutters, lawn care read the roof under that address), and
//    it is required whenever the company has drawn a service area, because
//    the area check has nothing to check without one. Both are LOCKS: the
//    saved value is kept, the effective value is `required`, and the reason
//    travels with it so the settings screen can say why the control is
//    greyed instead of leaving a switch that does nothing.
//
// Pure: no imports. The request route, the public payload, the settings PUT,
// the settings screen and the check script all read this one file, so the
// browser and the server cannot disagree about what is required — the
// browser is a courtesy, the route is the gate (non-negotiable #5's cousin).

export const FORM_FIELD_KEYS = ["photos", "budget", "timeline", "notes", "phone", "email", "address"];
export const FORM_FIELD_STATES = ["required", "optional", "hidden"];

/** What the form did before the setting existed. */
export const DEFAULT_FORM_FIELDS = Object.freeze({
  photos: "required",
  // "Required" only bites when the trade has budget bands to show; a trade
  // with none never asked, and still doesn't.
  budget: "required",
  timeline: "required",
  notes: "optional",
  phone: "optional",
  email: "optional",
  address: "required",
});

// The trades measured FROM an address: the address is the measurement input,
// so it is asked in the property section and cannot be optional there. Same
// predicate as the form's `byAddress`.
export const ADDRESS_MEASURED = new Set(["roof_address", "gutter_address", "lawn_address"]);

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * The saved `fields` block, cleaned. Unknown keys are dropped and named;
 * an unknown state falls back to the default for that field and is named;
 * both contact fields hidden is corrected to both optional and named as the
 * one problem a caller should refuse on (`contact`).
 *
 * @returns {{ fields: object, problems: Array<{key:string, problem:string}> }}
 */
export function normaliseFormFields(raw) {
  const fields = { ...DEFAULT_FORM_FIELDS };
  const problems = [];
  if (raw === undefined || raw === null) return { fields, problems };
  if (!isPlainObject(raw)) {
    problems.push({ key: "fields", problem: "not_an_object" });
    return { fields, problems };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!FORM_FIELD_KEYS.includes(key)) {
      problems.push({ key, problem: "unknown_field" });
      continue;
    }
    if (!FORM_FIELD_STATES.includes(value)) {
      problems.push({ key, problem: "unknown_state" });
      continue;
    }
    fields[key] = value;
  }
  if (fields.phone === "hidden" && fields.email === "hidden") {
    problems.push({ key: "contact", problem: "both_hidden" });
    fields.phone = "optional";
    fields.email = "optional";
  }
  return { fields, problems };
}

/**
 * The fields the form actually asks for one trade, with the locks applied.
 *
 * @param raw      the saved `fields` block (or nothing)
 * @param ctx.measure                 the trade's measurement kind
 * @param ctx.serviceAreaConfigured   whether the company has drawn an area
 * @returns {{ fields, locks: { address: "measured"|"service_area"|null, contact: "phone"|"email"|null } }}
 *   `locks.contact` names the field that became required because the other
 *   one is hidden.
 */
export function effectiveFormFields(raw, { measure, serviceAreaConfigured = false } = {}) {
  const { fields } = normaliseFormFields(raw);
  const locks = { address: null, contact: null };

  if (ADDRESS_MEASURED.has(measure)) {
    fields.address = "required";
    locks.address = "measured";
  } else if (serviceAreaConfigured) {
    fields.address = "required";
    locks.address = "service_area";
  }

  if (fields.phone === "hidden") {
    fields.email = "required";
    locks.contact = "email";
  } else if (fields.email === "hidden") {
    fields.phone = "required";
    locks.contact = "phone";
  }

  return { fields, locks };
}

/**
 * The contact rule the effective fields amount to:
 *   "either" — a phone or an email (today's rule)
 *   "phone"  — a phone; email optional or hidden
 *   "email"  — an email; phone optional or hidden
 *   "both"   — both required
 */
export function contactRule(fields) {
  const phone = fields?.phone === "required";
  const email = fields?.email === "required";
  if (phone && email) return "both";
  if (phone) return "phone";
  if (email) return "email";
  return "either";
}

/**
 * Whether a posted contact satisfies the rule. Strings only; whitespace is
 * not a phone number.
 */
export function contactSatisfied(fields, { phone, email } = {}) {
  const hasPhone = typeof phone === "string" && phone.trim().length > 0;
  const hasEmail = typeof email === "string" && email.trim().length > 0;
  switch (contactRule(fields)) {
    case "both":
      return hasPhone && hasEmail;
    case "phone":
      return hasPhone;
    case "email":
      return hasEmail;
    default:
      return hasPhone || hasEmail;
  }
}
