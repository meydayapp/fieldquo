// lib/leave/statutoryHolidays.js
//
// Statutory (public) holidays by country and province/state, COMPUTED from
// their rules rather than typed as dates — "the Monday before May 25", "the
// first Monday in September", "Easter minus two days" — so 2027 is right
// without anyone editing a table in December. scripts/check-shift-notify.mjs
// executes every rule against known 2026 and 2027 dates.
//
// Pure. Dates are ISO calendar days ("2026-09-07"), never instants: a holiday
// is a day on the calendar, and lib/leave/accrual.js's countWorkingDays takes
// exactly that shape as its `holidays` list.
//
// ── What this is for, and what it is not ────────────────────────────────────
//
// It answers two questions: which days should NOT be charged against
// somebody's vacation balance (the leave request route passes the list to
// countWorkingDays), and which day the rota should band as "Labour Day —
// statutory holiday" (the day board and the time-off Team view). It does NOT
// compute holiday PAY — statutory-holiday pay rules differ by province in
// ways this product deliberately leaves to the company's payroll numbers, the
// same division lib/payroll/computePayRun.js draws for tax.
//
// ── Coverage ────────────────────────────────────────────────────────────────
//
// Canada: the federal set (Canada Labour Code) and every province and
// territory's statutory set. Where a province's list is genuinely contested
// (Quebec lets an employer choose Good Friday or Easter Monday; Nova Scotia's
// Remembrance Day sits under its own Act), the comment on the entry says
// which was chosen and why. The National Day for Truth and Reconciliation is
// listed only where it is a statutory holiday under employment standards —
// federal, BC, PEI, Yukon, NWT, Nunavut — not where only government offices
// close. United States: the federal holidays; state holidays are not modelled.
// Anything else returns an empty list rather than a guess.
//
// ── Observed days ───────────────────────────────────────────────────────────
//
// Both countries move a weekend holiday: Canada to the next working day
// (Saturday and Sunday both land on Monday; a Sunday Boxing Day after a
// Saturday Christmas lands on the Tuesday), the US federal rule to the
// Friday before a Saturday and the Monday after a Sunday. `observed` is the
// day the crew is actually off and is what the leave count skips; `date` is
// the calendar day, kept for the label.

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const MS_DAY = 86_400_000;

function utc(y, m, d) {
  return Date.UTC(y, m - 1, d);
}
function isoOf(ms) {
  const d = new Date(ms);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function dow(y, m, d) {
  return new Date(utc(y, m, d)).getUTCDay();
}

/** The Nth (1-based) given weekday of a month; n = -1 for the last. */
export function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = dow(year, month, 1);
    const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
    return iso(year, month, day);
  }
  const lastDay = new Date(utc(year, month + 1, 0)).getUTCDate();
  const last = dow(year, month, lastDay);
  const day = lastDay - ((last - weekday + 7) % 7);
  return iso(year, month, day);
}

/** The given weekday ON OR BEFORE a date (Victoria Day: Monday before May 25). */
export function weekdayOnOrBefore(year, month, day, weekday) {
  const d = dow(year, month, day);
  const back = (d - weekday + 7) % 7;
  return isoOf(utc(year, month, day) - back * MS_DAY);
}

/** Western (Gregorian) Easter Sunday — the anonymous algorithm. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

function shiftDays(isoDay, n) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return isoOf(utc(y, m, d) + n * MS_DAY);
}
function weekdayOf(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return dow(y, m, d);
}

/** Canada: a weekend holiday is taken on the next working day. */
function observedCA(isoDay, taken) {
  let day = isoDay;
  const wd = weekdayOf(day);
  if (wd === 6) day = shiftDays(day, 2);
  else if (wd === 0) day = shiftDays(day, 1);
  // Boxing Day after a moved Christmas: the next FREE working day.
  while (taken.has(day) || weekdayOf(day) === 0 || weekdayOf(day) === 6) day = shiftDays(day, 1);
  return day;
}
/** United States (federal): Saturday → Friday, Sunday → Monday. */
function observedUS(isoDay) {
  const wd = weekdayOf(isoDay);
  if (wd === 6) return shiftDays(isoDay, -1);
  if (wd === 0) return shiftDays(isoDay, 1);
  return isoDay;
}

// ── The rules, as functions of the year ─────────────────────────────────────
//
// `key` is the closed vocabulary the catalogue translates
// (app.holiday.<key>); `name` is the English fallback.
const H = (key, name, fn) => ({ key, name, fn });

const CA_RULES = {
  newYear: H("newYear", "New Year's Day", (y) => iso(y, 1, 1)),
  familyDay: H("familyDay", "Family Day", (y) => nthWeekday(y, 2, 1, 3)),
  louisRielDay: H("louisRielDay", "Louis Riel Day", (y) => nthWeekday(y, 2, 1, 3)),
  islanderDay: H("islanderDay", "Islander Day", (y) => nthWeekday(y, 2, 1, 3)),
  heritageDayNS: H("heritageDayNS", "Nova Scotia Heritage Day", (y) => nthWeekday(y, 2, 1, 3)),
  goodFriday: H("goodFriday", "Good Friday", (y) => shiftDays(easterSunday(y), -2)),
  victoriaDay: H("victoriaDay", "Victoria Day", (y) => weekdayOnOrBefore(y, 5, 24, 1)),
  patriotsDay: H("patriotsDay", "National Patriots' Day", (y) => weekdayOnOrBefore(y, 5, 24, 1)),
  indigenousPeoplesDay: H("indigenousPeoplesDay", "National Indigenous Peoples Day", (y) => iso(y, 6, 21)),
  feteNationale: H("feteNationale", "Fête nationale du Québec", (y) => iso(y, 6, 24)),
  canadaDay: H("canadaDay", "Canada Day", (y) => iso(y, 7, 1)),
  memorialDayNL: H("memorialDayNL", "Memorial Day", (y) => iso(y, 7, 1)),
  nunavutDay: H("nunavutDay", "Nunavut Day", (y) => iso(y, 7, 9)),
  civicHoliday: H("civicHoliday", "Civic Holiday", (y) => nthWeekday(y, 8, 1, 1)),
  bcDay: H("bcDay", "British Columbia Day", (y) => nthWeekday(y, 8, 1, 1)),
  nbDay: H("nbDay", "New Brunswick Day", (y) => nthWeekday(y, 8, 1, 1)),
  saskatchewanDay: H("saskatchewanDay", "Saskatchewan Day", (y) => nthWeekday(y, 8, 1, 1)),
  discoveryDayYT: H("discoveryDayYT", "Discovery Day", (y) => nthWeekday(y, 8, 1, 3)),
  labourDay: H("labourDay", "Labour Day", (y) => nthWeekday(y, 9, 1, 1)),
  truthReconciliation: H("truthReconciliation", "National Day for Truth and Reconciliation", (y) => iso(y, 9, 30)),
  thanksgivingCA: H("thanksgivingCA", "Thanksgiving", (y) => nthWeekday(y, 10, 1, 2)),
  remembranceDay: H("remembranceDay", "Remembrance Day", (y) => iso(y, 11, 11)),
  christmas: H("christmas", "Christmas Day", (y) => iso(y, 12, 25)),
  boxingDay: H("boxingDay", "Boxing Day", (y) => iso(y, 12, 26)),
};

// Which rules apply where. Federal first; each province is the statutory set
// under its own employment-standards law, not the government-office calendar.
const CA_FEDERAL = ["newYear", "goodFriday", "victoriaDay", "canadaDay", "labourDay", "truthReconciliation", "thanksgivingCA", "remembranceDay", "christmas", "boxingDay"];
const CA_PROVINCES = {
  AB: ["newYear", "familyDay", "goodFriday", "victoriaDay", "canadaDay", "labourDay", "thanksgivingCA", "remembranceDay", "christmas"],
  BC: ["newYear", "familyDay", "goodFriday", "victoriaDay", "canadaDay", "bcDay", "labourDay", "truthReconciliation", "thanksgivingCA", "remembranceDay", "christmas"],
  MB: ["newYear", "louisRielDay", "goodFriday", "victoriaDay", "canadaDay", "labourDay", "thanksgivingCA", "christmas"],
  NB: ["newYear", "familyDay", "goodFriday", "canadaDay", "nbDay", "labourDay", "remembranceDay", "christmas"],
  NL: ["newYear", "goodFriday", "memorialDayNL", "labourDay", "remembranceDay", "christmas"],
  // Remembrance Day is a holiday under Nova Scotia's own Remembrance Day Act
  // rather than the Labour Standards Code; it is a day off for nearly every
  // employee all the same, which is the question this list answers.
  NS: ["newYear", "heritageDayNS", "goodFriday", "canadaDay", "labourDay", "remembranceDay", "christmas"],
  NT: ["newYear", "goodFriday", "victoriaDay", "indigenousPeoplesDay", "canadaDay", "civicHoliday", "labourDay", "truthReconciliation", "thanksgivingCA", "remembranceDay", "christmas"],
  NU: ["newYear", "goodFriday", "victoriaDay", "canadaDay", "nunavutDay", "civicHoliday", "labourDay", "truthReconciliation", "thanksgivingCA", "remembranceDay", "christmas"],
  ON: ["newYear", "familyDay", "goodFriday", "victoriaDay", "canadaDay", "labourDay", "thanksgivingCA", "christmas", "boxingDay"],
  PE: ["newYear", "islanderDay", "goodFriday", "canadaDay", "labourDay", "truthReconciliation", "remembranceDay", "christmas"],
  // Quebec's Act lets an employer observe Good Friday OR Easter Monday. Good
  // Friday is listed because it is the day nearly every trade in the province
  // actually closes; a company on Easter Monday marks it as a blackout or a
  // company holiday instead.
  QC: ["newYear", "goodFriday", "patriotsDay", "feteNationale", "canadaDay", "labourDay", "thanksgivingCA", "christmas"],
  SK: ["newYear", "familyDay", "goodFriday", "victoriaDay", "canadaDay", "saskatchewanDay", "labourDay", "thanksgivingCA", "remembranceDay", "christmas"],
  YT: ["newYear", "goodFriday", "victoriaDay", "indigenousPeoplesDay", "canadaDay", "discoveryDayYT", "labourDay", "truthReconciliation", "thanksgivingCA", "remembranceDay", "christmas"],
};

const US_RULES = {
  newYear: H("newYear", "New Year's Day", (y) => iso(y, 1, 1)),
  mlkDay: H("mlkDay", "Martin Luther King Jr. Day", (y) => nthWeekday(y, 1, 1, 3)),
  presidentsDay: H("presidentsDay", "Washington's Birthday", (y) => nthWeekday(y, 2, 1, 3)),
  memorialDay: H("memorialDay", "Memorial Day", (y) => nthWeekday(y, 5, 1, -1)),
  juneteenth: H("juneteenth", "Juneteenth", (y) => iso(y, 6, 19)),
  independenceDay: H("independenceDay", "Independence Day", (y) => iso(y, 7, 4)),
  laborDay: H("laborDay", "Labor Day", (y) => nthWeekday(y, 9, 1, 1)),
  columbusDay: H("columbusDay", "Columbus Day", (y) => nthWeekday(y, 10, 1, 2)),
  veteransDay: H("veteransDay", "Veterans Day", (y) => iso(y, 11, 11)),
  thanksgivingUS: H("thanksgivingUS", "Thanksgiving Day", (y) => nthWeekday(y, 11, 4, 4)),
  christmas: H("christmas", "Christmas Day", (y) => iso(y, 12, 25)),
};
const US_FEDERAL = Object.keys(US_RULES);

/** Every holiday key this module can produce — for the catalogue check. */
export const HOLIDAY_KEYS = [...new Set([...Object.values(CA_RULES), ...Object.values(US_RULES)].map((h) => h.key))];

export const HOLIDAY_REGIONS = {
  CA: Object.keys(CA_PROVINCES),
  US: [],
};

/**
 * Normalise a stated country/province to the keys above. Accepts "Canada",
 * "ca", "Québec", "Quebec", "qc"; returns null parts for anything unknown so
 * a caller can say "no holiday table for this region" rather than guess.
 */
export function holidayRegion({ country, province } = {}) {
  const c = String(country || "").trim().toUpperCase();
  const cc = c === "CANADA" ? "CA" : c === "UNITED STATES" || c === "USA" || c === "U.S." ? "US" : c;
  if (cc !== "CA" && cc !== "US") return { country: null, province: null };
  if (cc === "US") return { country: "US", province: null };
  const p = String(province || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const NAMES = {
    ALBERTA: "AB", "BRITISH COLUMBIA": "BC", MANITOBA: "MB", "NEW BRUNSWICK": "NB",
    "NEWFOUNDLAND AND LABRADOR": "NL", NEWFOUNDLAND: "NL", "NOVA SCOTIA": "NS",
    "NORTHWEST TERRITORIES": "NT", NUNAVUT: "NU", ONTARIO: "ON",
    "PRINCE EDWARD ISLAND": "PE", PEI: "PE", QUEBEC: "QC", SASKATCHEWAN: "SK", YUKON: "YT",
  };
  const code = CA_PROVINCES[p] ? p : NAMES[p] || null;
  return { country: "CA", province: code };
}

/**
 * The holidays for one year in one region.
 *
 * @param {object} p
 * @param {string} p.country   "CA" | "US" (or a name; see holidayRegion)
 * @param {string} [p.province] a Canadian province/territory code; absent →
 *                              the federal set
 * @param {number} p.year
 * @returns {Array<{ key, name, date, observed }>} sorted by observed day
 */
export function holidaysFor({ country, province, year } = {}) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return [];
  const region = holidayRegion({ country, province });
  if (!region.country) return [];

  if (region.country === "US") {
    return US_FEDERAL.map((k) => {
      const rule = US_RULES[k];
      const date = rule.fn(y);
      return { key: rule.key, name: rule.name, date, observed: observedUS(date) };
    }).sort((a, b) => a.observed.localeCompare(b.observed));
  }

  const keys = region.province ? CA_PROVINCES[region.province] : CA_FEDERAL;
  const taken = new Set();
  // Christmas before Boxing Day so a moved Christmas pushes Boxing Day on.
  const ordered = [...keys].sort((a, b) => CA_RULES[a].fn(y).localeCompare(CA_RULES[b].fn(y)));
  return ordered
    .map((k) => {
      const rule = CA_RULES[k];
      const date = rule.fn(y);
      const observed = observedCA(date, taken);
      taken.add(observed);
      return { key: rule.key, name: rule.name, date, observed };
    })
    .sort((a, b) => a.observed.localeCompare(b.observed));
}

/**
 * Holidays across a span of years — what a leave request or a rota needs
 * when December leaks into January. Returns the same shape as holidaysFor.
 */
export function holidaysBetween({ country, province, from, to } = {}) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return [];
  const out = [];
  for (let y = a.getUTCFullYear(); y <= b.getUTCFullYear(); y += 1) {
    out.push(...holidaysFor({ country, province, year: y }));
  }
  const lo = from instanceof Date ? isoOf(from.getTime()) : String(from).slice(0, 10);
  const hi = to instanceof Date ? isoOf(to.getTime()) : String(to).slice(0, 10);
  return out.filter((h) => h.observed >= lo && h.observed <= hi);
}

/** The observed days only — the shape countWorkingDays takes. */
export function holidayDays(list) {
  return (Array.isArray(list) ? list : []).map((h) => h.observed);
}
