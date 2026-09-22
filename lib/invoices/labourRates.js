// lib/invoices/labourRates.js
//
// Where the price on a "Labour — N h × rate" line comes from.
//
// The phone posts a RATE KEY, and this file turns it into a number by reading
// the company's own rows — Company.labourSellRate, or a service the company
// prices by the hour. There is no key that means "the rate I typed": a labour
// line priced by hand is an ordinary line item, typed in the editor with the
// rest, and never travels through the offline queue as an amount.
//
// The option list and the resolver are one module so the keys the offer
// SHOWS are the keys the POST ACCEPTS — a second list would be the copy that
// rots (AGENTS.md failure class 4).

const HOUR_UNITS = new Set(["hour", "hr", "hrs", "hours", "hourly", "h", "heure", "hora", "/hr", "per hour"]);

/** Is this unit string an hour, in any of the spellings the settings screens accept? */
export function isHourUnit(unit) {
  if (typeof unit !== "string") return false;
  return HOUR_UNITS.has(unit.trim().toLowerCase());
}

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * The rate options, from rows already read. Pure so the check can run it.
 *
 * @param {object} p
 * @param {{labourSellRate?: any}} p.company
 * @param {Array<{id, defaultRate, unit, enabled, category?:{name, key}}>} p.categories
 * @returns {Array<{ key: string, rate: number, label: string, source: "company"|"category" }>}
 */
export function labourRateOptionsFrom({ company, categories }) {
  const out = [];
  const companyRate = positive(company?.labourSellRate);
  if (companyRate != null) {
    out.push({ key: "company", rate: companyRate, label: "", source: "company" });
  }
  for (const c of Array.isArray(categories) ? categories : []) {
    if (!c || typeof c.id !== "string" || c.enabled === false) continue;
    if (!isHourUnit(c.unit)) continue;
    const rate = positive(c.defaultRate);
    if (rate == null) continue;
    out.push({
      key: `category:${c.id}`,
      rate,
      label: c.category?.name || c.name || c.category?.key || "",
      source: "category",
    });
  }
  return out;
}

/** The rate for one key, from the same options. Null for an unknown key — never a default. */
export function resolveLabourRateFrom(options, rateKey) {
  if (typeof rateKey !== "string") return null;
  const hit = (Array.isArray(options) ? options : []).find((o) => o.key === rateKey);
  return hit ? hit.rate : null;
}

/** The two reads behind labourRateOptionsFrom, scoped to one company. */
export async function loadLabourRateInputs(db, companyId) {
  const [company, categories] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { labourSellRate: true } }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true, defaultRate: { not: null } },
      select: { id: true, defaultRate: true, unit: true, enabled: true, category: { select: { name: true, key: true } } },
    }),
  ]);
  return { company: company || {}, categories };
}

export async function labourRateOptions(db, companyId) {
  return labourRateOptionsFrom(await loadLabourRateInputs(db, companyId));
}

export async function resolveLabourRate(db, companyId, rateKey) {
  return resolveLabourRateFrom(await labourRateOptions(db, companyId), rateKey);
}
