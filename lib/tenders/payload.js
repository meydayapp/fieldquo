// lib/tenders/payload.js
//
// The boundary between what a browser sent and what lands on a Tender row.
// Refuses rather than clamps: a 210-character title is an error the person
// sees, not a title silently cut at 200. Pure, so the check script throws
// hostile input at it.
//
// Not settable here, on purpose: status (POST /api/tenders/[id]/status walks
// the table in ./status.js), quoteId and jobId (their own routes prove the
// row is ours), companyId (always the caller's), and the computed instants
// (./time.js derives them from the wall-clock fields on every write).
import { emailRefusal, cleanEmail } from "@/lib/validation";
import { TENDER_SOURCES, LIMITS, MAX_BID_VALIDITY_DAYS } from "./constants";
import { isIsoDate, isHhmm, isTimeZone, tenderInstants } from "./time";
import { parseMoney } from "./status";
import { CONTACT_FIELDS, MONEY_FIELDS } from "./access";

class Refusal {
  constructor(error, status = 400) {
    this.error = error;
    this.status = status;
  }
}

function present(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

function textField(body, key, max, label, { required = false } = {}) {
  const v = body[key];
  if (v === null || v === "") {
    if (required) throw new Refusal(`${label} is required.`);
    return null;
  }
  if (typeof v !== "string") throw new Refusal(`${label} must be text.`);
  const s = v.trim();
  if (!s && required) throw new Refusal(`${label} is required.`);
  if (s.length > max) throw new Refusal(`${label} is longer than ${max} characters.`);
  return s || null;
}

function dateField(body, key, label) {
  const v = body[key];
  if (v === null || v === "") return null;
  if (!isIsoDate(v)) throw new Refusal(`${label} must be a date (YYYY-MM-DD).`);
  return v;
}

function timeField(body, key, label) {
  const v = body[key];
  if (v === null || v === "") return null;
  if (!isHhmm(v)) throw new Refusal(`${label} must be a time (HH:MM, 24-hour).`);
  return v;
}

function boolField(body, key, label) {
  const v = body[key];
  if (typeof v !== "boolean") throw new Refusal(`${label} must be true or false.`);
  return v;
}

function urlField(body, key, label) {
  const v = textField(body, key, LIMITS.sourceUrl, label);
  if (v === null) return null;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new Refusal(`${label} must be a web address starting with https://.`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Refusal(`${label} must be a web address starting with https://.`);
  if (u.username || u.password) throw new Refusal(`${label} can't carry a username or password.`);
  return u.toString();
}

function emailField(body, key, label) {
  const v = textField(body, key, LIMITS.email, label);
  if (v === null) return null;
  const refusal = emailRefusal(v, { subject: label });
  if (refusal) throw new Refusal(refusal.error);
  return cleanEmail(v);
}

/**
 * Parse a create or an edit.
 *
 * @param {object} body
 * @param {object} opts
 * @param {boolean} opts.creating
 * @param {boolean} opts.canSeeContacts  below this, a contact field is a 403
 * @param {boolean} opts.canSeeMoney     below this, a money field is a 403
 * @returns {{ ok: true, data } | { ok: false, error, status }}
 */
export function parseTenderBody(body, { creating = false, canSeeContacts = false, canSeeMoney = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Send the tender as an object." };
  }
  const data = {};
  try {
    // ── What the member may not touch, refused by name ─────────────────
    //
    // A pricing-blind member's form never draws these, so one arriving is a
    // crafted request. Refused, not ignored: an ignored field is a Save that
    // "worked" and kept the old value.
    if (!canSeeContacts && CONTACT_FIELDS.some((f) => present(body, f))) {
      throw new Refusal("Your access level doesn't include client contact details.", 403);
    }
    if (!canSeeMoney && MONEY_FIELDS.some((f) => present(body, f))) {
      throw new Refusal("Your access level doesn't include prices.", 403);
    }

    if (creating || present(body, "clientId")) {
      if (typeof body.clientId !== "string" || !body.clientId.trim()) throw new Refusal("Choose the buyer — the client this tender is from.");
      data.clientId = body.clientId.trim();
    }
    if (creating || present(body, "title")) data.title = textField(body, "title", LIMITS.title, "The title", { required: true });
    if (present(body, "solicitationNumber")) data.solicitationNumber = textField(body, "solicitationNumber", LIMITS.solicitationNumber, "The solicitation number");
    if (present(body, "buyerBranch")) data.buyerBranch = textField(body, "buyerBranch", LIMITS.buyerBranch, "The branch or department");
    if (present(body, "source")) {
      if (!TENDER_SOURCES.includes(body.source)) throw new Refusal("Pick where the tender is published from the list.");
      data.source = body.source;
    }
    if (present(body, "sourceUrl")) data.sourceUrl = urlField(body, "sourceUrl", "The tender's link");
    if (present(body, "questionsChannel")) data.questionsChannel = textField(body, "questionsChannel", LIMITS.questionsChannel, "How questions must be asked");

    for (const prefix of ["contractingAuthority", "technicalAuthority"]) {
      const who = prefix === "contractingAuthority" ? "The Contracting Authority's" : "The Technical Authority's";
      if (present(body, `${prefix}Name`)) data[`${prefix}Name`] = textField(body, `${prefix}Name`, LIMITS.personName, `${who} name`);
      if (present(body, `${prefix}Email`)) data[`${prefix}Email`] = emailField(body, `${prefix}Email`, `${who} email`);
      if (present(body, `${prefix}Phone`)) data[`${prefix}Phone`] = textField(body, `${prefix}Phone`, LIMITS.phone, `${who} phone`);
    }

    if (present(body, "timeZone")) {
      if (!isTimeZone(body.timeZone)) throw new Refusal("That time zone isn't recognised.");
      data.timeZone = body.timeZone;
    }
    if (present(body, "publishedDate")) data.publishedDate = dateField(body, "publishedDate", "The published date");
    if (present(body, "questionsDeadlineDate")) data.questionsDeadlineDate = dateField(body, "questionsDeadlineDate", "The questions deadline");
    if (present(body, "questionsDeadlineTime")) data.questionsDeadlineTime = timeField(body, "questionsDeadlineTime", "The questions deadline time");
    if (present(body, "siteVisitDate")) data.siteVisitDate = dateField(body, "siteVisitDate", "The site visit date");
    if (present(body, "siteVisitTime")) data.siteVisitTime = timeField(body, "siteVisitTime", "The site visit time");
    if (present(body, "siteVisitMandatory")) data.siteVisitMandatory = boolField(body, "siteVisitMandatory", "Mandatory site visit");
    if (present(body, "siteVisitLocation")) data.siteVisitLocation = textField(body, "siteVisitLocation", LIMITS.siteVisitLocation, "The site visit location");
    if (creating || present(body, "closingDate")) {
      const d = dateField(body, "closingDate", "The closing date");
      if (!d) throw new Refusal("The closing date is required.");
      data.closingDate = d;
    }
    if (creating || present(body, "closingTime")) {
      const t = timeField(body, "closingTime", "The closing time");
      if (!t) throw new Refusal("The closing time is required — bids are refused one minute late.");
      data.closingTime = t;
    }
    if (present(body, "bidValidityDays")) {
      const v = body.bidValidityDays;
      if (v === null || v === "") data.bidValidityDays = null;
      else {
        const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
        if (!Number.isInteger(n) || n < 1 || n > MAX_BID_VALIDITY_DAYS) throw new Refusal(`The bid validity must be a whole number of days, 1 to ${MAX_BID_VALIDITY_DAYS}.`);
        data.bidValidityDays = n;
      }
    }
    if (present(body, "expectedAwardDate")) data.expectedAwardDate = dateField(body, "expectedAwardDate", "The expected award date");

    if (present(body, "estimatedValue")) {
      const r = parseMoney(body.estimatedValue, "The estimated value");
      if (!r.ok) throw new Refusal(r.error);
      data.estimatedValue = r.value;
    }
    if (present(body, "bidSecurityRequired")) data.bidSecurityRequired = boolField(body, "bidSecurityRequired", "Bid security required");
    if (present(body, "bidSecurityAmount")) {
      const r = parseMoney(body.bidSecurityAmount, "The bid security amount");
      if (!r.ok) throw new Refusal(r.error);
      data.bidSecurityAmount = r.value;
    }
    if (present(body, "securityClearance")) data.securityClearance = textField(body, "securityClearance", LIMITS.securityClearance, "The security clearance");
    if (present(body, "notes")) data.notes = textField(body, "notes", LIMITS.notes, "The notes");
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, status: err.status, error: err.error };
    throw err;
  }
  return { ok: true, data };
}

/**
 * The row as it will be after this write, with its instants recomputed —
 * or a refusal when the combination does not make sense (a time with no
 * date). `existing` is null on a create.
 *
 * @returns {{ ok: true, data } | { ok: false, status, error }}
 */
export function finaliseTenderWrite(existing, data, { defaultTimeZone }) {
  const merged = { ...(existing || {}), ...data };
  if (!merged.timeZone) merged.timeZone = defaultTimeZone;
  if (!isTimeZone(merged.timeZone)) return { ok: false, status: 400, error: "That time zone isn't recognised." };

  if (merged.questionsDeadlineTime && !merged.questionsDeadlineDate) {
    return { ok: false, status: 400, error: "The questions deadline has a time but no date." };
  }
  if (merged.siteVisitTime && !merged.siteVisitDate) {
    return { ok: false, status: 400, error: "The site visit has a time but no date." };
  }
  // A mandatory visit with no date is a fact worth keeping (the date is often
  // in an addendum), so it is allowed; the screen says the date is missing.

  const out = { ...data };
  if (!existing || data.timeZone === undefined) out.timeZone = merged.timeZone;
  // Bid security amount means nothing when no security is required — and a
  // stale amount left behind would be printed beside "Not required".
  if (merged.bidSecurityRequired === false && merged.bidSecurityAmount != null) out.bidSecurityAmount = null;

  const instants = tenderInstants(merged);
  if (!instants.closingAt) return { ok: false, status: 400, error: "The closing date and time don't make a real moment in that time zone." };
  out.closingAt = instants.closingAt;
  out.questionsDeadlineAt = instants.questionsDeadlineAt;
  out.siteVisitAt = instants.siteVisitAt;
  return { ok: true, data: out };
}
