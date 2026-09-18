// lib/equipment/installed.js
//
// The kit installed at the address a JOB is at, and what a job may say about
// it. Every decision the job page's "Installed at this site" panel makes,
// with no database and no wall clock reaching the maths.
//
// ══ Two panels, two tables, one word ═══════════════════════════════════════
//
// The job page already had a panel called "Equipment used". It logs the
// COMPANY's own assets — the compressor, the Ram 3500 in the register — for
// job costing (AssetUseLog). The owner opened it expecting the furnace he had
// just put in somebody's basement, and its warranty. That is `ClientEquipment`,
// a different table for the reason lib/equipment/warranty.js's header gives: a
// homeowner's boiler must never reach the company's price floor.
//
// So the job page carries both, side by side, and the first one is now titled
// "Company equipment used" so the two cannot be read as one. Nothing here
// touches Asset.
//
// ══ The rule that reaches a customer ═══════════════════════════════════════
//
// A warranty length is a CHOICE the person makes on the form — one, two, five,
// ten years, a date of their own, or "I don't know". Only a made choice
// produces a date. "I don't know" produces null, which lib/equipment/warranty.js
// renders as UNKNOWN and never as expired. Nothing here defaults the length,
// and a length with no install date to count from is an error the form is
// told about, not a date counted from today.

/** The lengths the form offers, in the order it offers them. */
export const WARRANTY_LENGTH_OPTIONS = Object.freeze([
  { key: "unknown", years: null },
  { key: "1y", years: 1 },
  { key: "2y", years: 2 },
  { key: "5y", years: 5 },
  { key: "10y", years: 10 },
  { key: "custom", years: null },
]);

const YEARS_BY_KEY = new Map(WARRANTY_LENGTH_OPTIONS.map((o) => [o.key, o.years]));

export function isWarrantyLength(key) {
  return YEARS_BY_KEY.has(key);
}

/** yyyy-mm-dd for a <input type="date">, or "" when there is no usable date. */
export function dateInputValue(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Add whole years to a date, in UTC, keeping the calendar day.
 *
 * A 29 February install plus one year lands on 1 March (JavaScript's own
 * roll-over), which is the ordinary reading of "a year from then" and one day
 * generous to the customer rather than one day short.
 */
export function addYears(date, years) {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/**
 * The warranty end date a form's choice means.
 *
 * @param {object} input
 * @param {string|Date|null} input.installedAt   what the form holds
 * @param {string} input.length                  one of WARRANTY_LENGTH_OPTIONS
 * @param {string|Date|null} input.customEndsAt  only read when length is "custom"
 * @returns {{ warrantyEndsAt: Date|null }} or {{ error: string }}
 *
 * "unknown" is a real answer and returns null on purpose. A years choice
 * needs the install date — counting five years from TODAY for a furnace put in
 * two winters ago would state a cover date nobody gave (AGENTS.md #5).
 */
export function warrantyEndFrom({ installedAt, length, customEndsAt } = {}) {
  if (!isWarrantyLength(length)) return { error: "Pick how long the warranty runs." };
  if (length === "unknown") return { warrantyEndsAt: null };

  if (length === "custom") {
    if (customEndsAt === null || customEndsAt === undefined || customEndsAt === "") {
      return { error: "Enter the date the warranty runs to." };
    }
    const when = customEndsAt instanceof Date ? customEndsAt : new Date(customEndsAt);
    if (Number.isNaN(when.getTime())) return { error: "That warranty date isn't a date." };
    return { warrantyEndsAt: when };
  }

  const years = YEARS_BY_KEY.get(length);
  if (installedAt === null || installedAt === undefined || installedAt === "") {
    return { error: "Say when it was installed — the warranty is counted from that day." };
  }
  const start = installedAt instanceof Date ? installedAt : new Date(installedAt);
  if (Number.isNaN(start.getTime())) return { error: "That install date isn't a date." };
  return { warrantyEndsAt: addYears(start, years) };
}

/**
 * What the "Installed" field starts as for a job.
 *
 * The job's completion date, because "what we installed" is written up after
 * the work; failing that, the job's own end date; failing that, BLANK. Never
 * today: a form opened a week after the visit would otherwise record the day
 * of the typing as the day of the install, and that is the date a warranty
 * claim is counted from.
 */
export function defaultInstalledAt(job) {
  return dateInputValue(job?.completedAt) || dateInputValue(job?.endDate) || "";
}

/** Case, punctuation and spacing dropped, so "14 Rue Principale," equals "14 rue principale". */
export function normaliseAddress(value) {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Split a client's equipment into what is at THIS job's address and what is
 * at the client's other properties.
 *
 * A row with no `siteAddress` is at the client's main address, and so is a
 * job with no `siteAddress` — so those two always meet. A job at a named site
 * matches rows naming the same site, plus the unaddressed rows: a company
 * that never filled the address in on the furnace has not said it is
 * somewhere else, and hiding it from the crew standing next to it would be
 * reading a blank as a statement (AGENTS.md #5).
 *
 * Rows naming a DIFFERENT site are returned separately, not dropped: a
 * property manager's three buildings are one client, and "the boiler at the
 * other block is out of warranty" is worth a line on the job page.
 */
export function partitionBySite(rows, jobSiteAddress) {
  const here = [];
  const elsewhere = [];
  const site = normaliseAddress(jobSiteAddress);
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    const rowSite = normaliseAddress(row.siteAddress);
    if (!rowSite || !site || rowSite === site) here.push(row);
    else elsewhere.push(row);
  }
  return { here, elsewhere };
}

/**
 * May this job carry a link to a piece of the client's equipment?
 *
 * Only a WARRANTY callback. A rework job "about" a water heater says nothing
 * anybody meant — rework is about what we did, not about a thing under
 * cover — and a plain job has no reason to point at one either; the
 * `installedByJobId` on the equipment row is the link in that direction.
 */
export function canLinkWarrantyEquipment(job) {
  return !!job && job.callbackReason === "warranty";
}

/**
 * Whether a warranty callback may point at this equipment row.
 *
 * @returns {{ ok: true }} or {{ ok: false, error: string, status: number }}
 *
 * The equipment has to be the SAME CLIENT's. The tenant check is the caller's
 * (lib/tenant/ownedIds.js proves the row is the company's); this is the
 * narrower rule on top of it, because a callback for the Smiths that points at
 * the Joneses' furnace is within the tenant and still wrong.
 */
export function warrantyLinkVerdict({ job, equipment } = {}) {
  if (!canLinkWarrantyEquipment(job)) {
    return {
      ok: false,
      status: 400,
      error: "Only a warranty callback can be linked to a piece of equipment.",
    };
  }
  if (!equipment) {
    return { ok: false, status: 404, error: "That equipment record wasn't found." };
  }
  if (!job.clientId || equipment.clientId !== job.clientId) {
    return {
      ok: false,
      status: 400,
      error: "That equipment belongs to a different client than this job.",
    };
  }
  return { ok: true };
}
