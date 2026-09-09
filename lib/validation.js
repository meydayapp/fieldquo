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
  return emailProblem(value) === null;
}

// ══ The address a quote could not be delivered to ══════════════════════════
//
// Manny Conto gave 26 doors, 7 drawers, photos, an address and a colour, and
// typed his email as `Macksab  1@hotmail.com` — two spaces and then a digit.
// The quote was written, sent, and bounced. Nobody was told. The contractor
// found out himself, asked twice, and by then the momentum was gone.
//
// The address was refusable at the second it was typed, by anything that
// looked at it. Nothing did: every homeowner-facing path in this app stored
// whatever arrived, untrimmed and unchecked, and the four that did check
// (the phone agent, the AI employee, call-lead recovery, the past-jobs import)
// each carried their own regular expression.
//
// ── Why a PROBLEM and not a boolean ────────────────────────────────────────
//
// "That doesn't look like an email address" tells somebody who typed two
// spaces exactly nothing; they read it back, see a plausible address, and
// conclude the form is broken. Naming the fault — "there is a space in it" —
// is the difference between a correction and a dead end. So the primitive is
// `emailProblem`, which returns WHICH rule failed, and the boolean is derived
// from it rather than the other way round.
//
// ── Deliberately not RFC 5322 ──────────────────────────────────────────────
//
// The same position lib/voice/tools.js's normaliseEmail takes, for the same
// reason: RFC 5322 permits quoted local parts with spaces in them, which no
// homeowner has ever typed and which is precisely the shape of the bug. The
// job is to refuse a string that cannot be delivered to, not to be a parser.

/** Every fault `emailProblem` can name. Closed, so a caller can switch on it. */
export const EMAIL_PROBLEMS = Object.freeze([
  "empty",
  "spaces",
  "no_at",
  "many_at",
  "no_local",
  "no_domain",
  "no_domain_dot",
  "domain_edge",
  "bad_chars",
  "too_long",
]);

/** 254 is the SMTP path limit; anything longer cannot be delivered anywhere. */
export const EMAIL_MAX_LENGTH = 254;

// Characters that cannot appear in an address anybody can actually send to.
// Whitespace is handled separately above so it gets its own, more useful
// message — it is the fault that cost the job.
const EMAIL_BAD_CHARS = /[<>()[\]\\,;:"]/;

/**
 * What is wrong with this email address, or null if nothing is.
 *
 * Leading and trailing whitespace is TRIMMED before judging — somebody who
 * pasted an address with a trailing space has typed a correct address — but
 * whitespace anywhere inside is a refusal, because `Macksab  1@hotmail.com`
 * has no correct reading.
 */
export function emailProblem(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "empty";
  if (raw.length > EMAIL_MAX_LENGTH) return "too_long";
  if (/\s/.test(raw)) return "spaces";
  if (EMAIL_BAD_CHARS.test(raw)) return "bad_chars";

  const parts = raw.split("@");
  if (parts.length === 1) return "no_at";
  if (parts.length > 2) return "many_at";

  const [local, domain] = parts;
  if (!local) return "no_local";
  if (!domain) return "no_domain";
  if (!domain.includes(".")) return "no_domain_dot";
  // "a@.com", "a@example." and "a@ex..com" are all undeliverable and all pass
  // a naive "has an @ and a dot" test — which is the test this replaces.
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return "domain_edge";
  }
  return null;
}

/**
 * The address as it should be STORED, or null when it cannot be stored.
 *
 * Trimmed and lowercased, because this string is a matching key as well as a
 * destination. lib/leads/convertLead.js and lib/estimate/createEstimateQuote.js
 * both matched an existing client on `.trim().toLowerCase()` and then stored
 * the raw original, so " Bob@Example.COM " never matched itself on the second
 * visit and produced a duplicate client. One normaliser removes that.
 */
export function cleanEmail(value) {
  if (emailProblem(value) !== null) return null;
  return String(value).trim().toLowerCase();
}

/**
 * A sentence naming the problem, for a refusal a person reads.
 *
 * English, matching every other server-side refusal in this app's public
 * routes ("Provide at least an email or phone number", "Tell us your name and
 * an email or phone so we can send your quote"). The app's own screens surface
 * whatever the route returns, so there is one wording per fault and it lives
 * beside the rule that produced it rather than being restated at eleven call
 * sites.
 */
export function emailProblemMessage(problem, { subject = "That email address" } = {}) {
  switch (problem) {
    case "empty":
      return "Enter an email address.";
    case "spaces":
      return `${subject} has a space in it. Remove the space and try again — a quote sent to it will not arrive.`;
    case "no_at":
      return `${subject} is missing the @ sign.`;
    case "many_at":
      return `${subject} has more than one @ sign.`;
    case "no_local":
      return `${subject} has nothing before the @.`;
    case "no_domain":
      return `${subject} has nothing after the @.`;
    case "no_domain_dot":
      return `${subject} has no domain ending — it needs something like .com after the @.`;
    case "domain_edge":
      return `${subject} has a stray dot in the part after the @.`;
    case "bad_chars":
      return `${subject} contains a character an address cannot have.`;
    case "too_long":
      return `${subject} is too long to be delivered to.`;
    default:
      return `${subject} does not look like an address anything can be delivered to.`;
  }
}

/**
 * The refusal for one captured address, or null when it is fine.
 *
 * The shape every capture point returns: `{ error, code, problem }`. `code` is
 * stable so a browser can branch on it without matching English, and the
 * sentence is there so a browser that does not branch still says something
 * useful.
 *
 * `required: false` is the common case on an intake form that accepts a phone
 * number instead — an absent address is not a wrong one.
 */
export function emailRefusal(value, { required = false, subject } = {}) {
  const problem = emailProblem(value);
  if (problem === null) return null;
  if (problem === "empty" && !required) return null;
  return {
    error: emailProblemMessage(problem, subject ? { subject } : undefined),
    code: "invalid_email",
    problem,
  };
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
