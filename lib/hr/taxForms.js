// lib/hr/taxForms.js
//
// The fields a TD1 (Canada, federal and provincial) and a W-4 (US) ask for,
// so a new hire can answer them on a phone and the payroll admin can print
// the answers on one sheet.
//
// ══ What this is NOT ═══════════════════════════════════════════════════════
//
// FieldQuo files nothing with the CRA, Revenu Québec or the IRS, and does
// not compute anybody's withholding. The screen says so in the reader's
// language and the PDF says so in its footer. This is the paper form as a
// form: the same questions, answered once, kept with the person's file, so
// the admin does not chase a new hire for a PDF they cannot open on a phone.
//
// ══ No SIN, no SSN ═════════════════════════════════════════════════════════
//
// Deliberately absent from every field list. A social insurance number in a
// Json column, readable by every supervisor with `user:manage`, is the one
// thing in this feature that would turn a data breach into identity theft.
// The PDF leaves that box blank with "write by hand" beside it, which is
// how the paper form works anyway. Adding it is a product decision, not a
// missing field — see docs/ROADMAP.md.
//
// ══ Amounts are what the person typed ══════════════════════════════════════
//
// The basic personal amount changes every year and differs by province and
// by income. Nothing here prefills it: a prefilled figure is a claim about
// tax law, and a wrong one on a signed form is the company's problem. The
// form shows the line, the person copies the figure from the government's
// worksheet, and the total is added up on screen so it is at least the sum
// of what they wrote.

export const TAX_FORM_KINDS = Object.freeze(["td1_federal", "td1_provincial", "w4"]);

/** Which country each form belongs to, so a US company never sees a TD1. */
export const TAX_FORM_COUNTRY = Object.freeze({ td1_federal: "CA", td1_provincial: "CA", w4: "US" });

export const CA_PROVINCES = Object.freeze([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

export const W4_FILING_STATUSES = Object.freeze(["single", "married_jointly", "head_of_household"]);

const NAME_MAX = 80;
const TEXT_MAX = 200;
const MONEY_MAX = 9_999_999;

/**
 * The field list per form. `type` is one of text | date | money | bool |
 * select; `required` decides validation; `group` is the heading the screen
 * and the PDF put it under. Labels are i18n KEYS under app.hr.tax.* so the
 * screen speaks the reader's language; the PDF prints English and French
 * headings (the two languages the forms exist in) from the same keys.
 */
const IDENTITY = [
  { key: "lastName", type: "text", required: true, group: "identity" },
  { key: "firstName", type: "text", required: true, group: "identity" },
  { key: "dateOfBirth", type: "date", required: true, group: "identity" },
  { key: "address", type: "text", required: true, group: "identity" },
  { key: "postalCode", type: "text", required: true, group: "identity" },
];

const TD1_CLAIMS = [
  { key: "basicPersonalAmount", type: "money", required: true, group: "claims" },
  { key: "additionalClaims", type: "money", required: false, group: "claims" },
  { key: "moreThanOneEmployer", type: "bool", required: false, group: "situations" },
  { key: "incomeBelowClaim", type: "bool", required: false, group: "situations" },
  { key: "additionalTaxPerPeriod", type: "money", required: false, group: "situations" },
];

export const TAX_FORM_FIELDS = Object.freeze({
  td1_federal: Object.freeze([...IDENTITY, ...TD1_CLAIMS]),
  td1_provincial: Object.freeze([
    ...IDENTITY,
    { key: "province", type: "select", options: CA_PROVINCES, required: true, group: "identity" },
    ...TD1_CLAIMS,
  ]),
  w4: Object.freeze([
    { key: "firstName", type: "text", required: true, group: "identity" },
    { key: "lastName", type: "text", required: true, group: "identity" },
    { key: "address", type: "text", required: true, group: "identity" },
    { key: "cityStateZip", type: "text", required: true, group: "identity" },
    { key: "filingStatus", type: "select", options: W4_FILING_STATUSES, required: true, group: "claims" },
    { key: "multipleJobs", type: "bool", required: false, group: "claims" },
    { key: "dependentsAmount", type: "money", required: false, group: "claims" },
    { key: "otherIncome", type: "money", required: false, group: "adjustments" },
    { key: "deductions", type: "money", required: false, group: "adjustments" },
    { key: "extraWithholding", type: "money", required: false, group: "adjustments" },
  ]),
});

function parseMoney(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > MONEY_MAX) return undefined;
  return Math.round(n * 100) / 100;
}

function parseDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : v;
}

/**
 * A submission body, validated against the form's field list.
 *
 * @returns {{ data: { formKind, taxYear, fields, signatureName } }} or {{ error }}
 */
export function parseTaxFormBody(body, { now = new Date() } = {}) {
  const formKind = body?.formKind;
  if (!TAX_FORM_KINDS.includes(formKind)) return { error: "Pick which tax form this is." };

  const year = Number(body?.taxYear ?? now.getUTCFullYear());
  const thisYear = now.getUTCFullYear();
  if (!Number.isInteger(year) || year < thisYear - 1 || year > thisYear + 1) {
    return { error: "The tax year must be this year, last year or next year." };
  }

  const raw = body?.fields && typeof body.fields === "object" ? body.fields : {};
  const fields = {};
  for (const f of TAX_FORM_FIELDS[formKind]) {
    const v = raw[f.key];
    const missing = v === undefined || v === null || v === "";
    if (missing) {
      if (f.required) return { error: `"${f.key}" is required.`, field: f.key };
      fields[f.key] = f.type === "bool" ? false : null;
      continue;
    }
    switch (f.type) {
      case "text": {
        if (typeof v !== "string") return { error: `"${f.key}" must be text.`, field: f.key };
        fields[f.key] = v.trim().slice(0, f.key.endsWith("Name") ? NAME_MAX : TEXT_MAX);
        if (!fields[f.key] && f.required) return { error: `"${f.key}" is required.`, field: f.key };
        break;
      }
      case "date": {
        const d = parseDate(v);
        if (d === undefined) return { error: `"${f.key}" isn't a date.`, field: f.key };
        fields[f.key] = d;
        break;
      }
      case "money": {
        const m = parseMoney(v);
        if (m === undefined) return { error: `"${f.key}" must be an amount.`, field: f.key };
        fields[f.key] = m;
        break;
      }
      case "bool":
        fields[f.key] = v === true || v === "true" || v === "on";
        break;
      case "select":
        if (!f.options.includes(v)) return { error: `"${f.key}" isn't one of the choices.`, field: f.key };
        fields[f.key] = v;
        break;
      default:
        return { error: `Unknown field type for "${f.key}".` };
    }
  }

  const signatureName = typeof body?.signatureName === "string" ? body.signatureName.trim().slice(0, NAME_MAX) : "";
  if (!signatureName) return { error: "Type your full name to sign the form.", field: "signatureName" };

  return { data: { formKind, taxYear: year, fields, signatureName } };
}

/** The TD1 total claim: what the person wrote, added up. Null when no claim. */
export function td1TotalClaim(fields) {
  const a = Number(fields?.basicPersonalAmount);
  const b = Number(fields?.additionalClaims);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return null;
  return Math.round(((Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0)) * 100) / 100;
}

/** The forms a company in this country hands a new hire. */
export function taxFormKindsForCountry(country) {
  return TAX_FORM_KINDS.filter((k) => TAX_FORM_COUNTRY[k] === country);
}
