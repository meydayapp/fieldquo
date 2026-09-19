// lib/tax/usRatesLoad.js
//
// The pure half of scripts/us-tax-rates-load.mjs: turns the files the states
// publish into UsSalesTaxRate rows. No network, no database — so
// scripts/check-us-tax.mjs can run it against a fixture and prove the same
// input produces the same rows twice.
//
// ── Where a ZIP's rate comes from ────────────────────────────────────────────
//
// There is no free, published, machine-readable table of combined US sales
// tax rates by ZIP for all fifty states. Avalara's monthly tables are free but
// gated behind an e-mail form; Texas keys its downloads to a login; New York
// and California publish jurisdiction lists, not ZIP lists. What IS published
// openly, dated, and in a fixed format is:
//
//   1. THE STREAMLINED SALES TAX RATE AND BOUNDARY FILES. The 24 member states
//      (AR GA IA IN KS KY MI MN NC ND NE NJ NV OH OK RI SD TN UT VT WA WI WV
//      WY) are each required to publish a rate file (one row per taxing
//      jurisdiction) and a boundary file (which jurisdictions apply to a ZIP,
//      a ZIP+4 range or an address). They are listed at
//      https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and
//      .../Boundary/, named STATE + R|B + year + quarter + file date, e.g.
//      OHR2026Q4SEP17.csv. The states themselves write them; the SST
//      Governing Board hosts them. `sourceKind: "sst"`.
//
//   2. THE CENSUS ZCTA→COUNTY CROSSWALK, for the one non-member state whose
//      local rate is a county surcharge and nothing else: Pennsylvania (6%
//      state, +1% Allegheny, +2% Philadelphia). `sourceKind: "census_county"`.
//
//   3. States with NO local sales tax at all need no rows: the state rate IS
//      the combined rate for every ZIP, and lib/tax/jurisdictions.js says so
//      with `localTax: "none"` on the state.
//
// Everything else — TX, CA, NY, FL, IL, CO, AZ, AL, LA, MO, NM, SC, VA, AK,
// ID, MS, HI's surcharge nuance — has no open ZIP-level file this loader can
// fetch without a login, and the resolver falls back to the state rate with
// the sentence that says county and city are not known. That is the honest
// gap, and it is a smaller gap than it looks: in most of those states a
// lump-sum real-property contract charges the homeowner no sales tax at all
// (lib/tax/usTaxability.js), so the local rate never reaches the document.
//
// ── The SST file layouts, as read from the files themselves ─────────────────
//
// The SST Technology Guide (chapter 5) is the spec; the layouts below were
// confirmed against the September 2026 files of Ohio, Utah, Washington, North
// Carolina and Minnesota because the guide is a PDF and the files are not
// all identical to it (Minnesota writes a lowercase "z", North Carolina writes
// jurisdiction type "0" where Ohio writes "00", Washington labels a special
// district "45" in the boundary file and "63" in the rate file).
//
//   Rate file, one row per jurisdiction and period:
//     state FIPS, jurisdiction type, jurisdiction code, general rate
//     (intrastate), general rate (interstate), food rate ×2, begin YYYYMMDD,
//     end YYYYMMDD.  Type 45 = the state itself (code = state FIPS), 00 =
//     county (code = county FIPS), 01 = city/place (code = place FIPS),
//     anything else = a special district.
//
//   Boundary file, one row per ZIP / ZIP+4 range / address range:
//     [0] record type Z (5-digit ZIP), 4 (ZIP+4 range) or A (address range)
//     [1] begin YYYYMMDD  [2] end YYYYMMDD
//     [3..16] address fields, empty on Z and 4 rows
//     [17] ZIP low  [18] +4 low  [19] ZIP high  [20] +4 high
//     [21] composite code (state-specific, ignored)
//     [22] FIPS state  [23] FIPS state again  [24] FIPS county  [25] FIPS place
//     [26] place class  [27] longitude  [28] latitude
//     [29..] special jurisdictions as triplets: label, code, type
//
//   A ZIP's combined rate = state + county + place + each special, each read
//   from the rate file for the date asked about. Codes are matched by
//   (type, code) first and by code alone second, which is what absorbs
//   Washington's 45/63 disagreement without special-casing a state.
//
// ── A ZIP is not a jurisdiction ─────────────────────────────────────────────
//
// Downtown Milwaukee's 53202 is one ZIP and two rates: 5.9% (state + county)
// on the +4 ranges the state files outside the city and 7.9% inside it. The
// Streamlined agreement's answer for a seller who only has five digits is to
// apply the LOWEST rate in the ZIP and be held harmless, and the states'
// own Z rows are written to that rule. So the loader stores the Z row's
// composition as `combinedRate` (or, where a state files only +4 ranges, the
// lowest of them), the highest +4 composition as `maxRate`, and marks
// `zipSpansRates` when they differ — so the document can say "addresses in
// this ZIP pay up to 7.9%" instead of pretending five digits settle it. It
// never averages: an average is a rate nobody pays.

const SST_STATES = {
  AR: "05", GA: "13", IA: "19", IN: "18", KS: "20", KY: "21", MI: "26",
  MN: "27", NC: "37", ND: "38", NE: "31", NJ: "34", NV: "32", OH: "39",
  OK: "40", RI: "44", SD: "46", TN: "47", UT: "49", VT: "50", WA: "53",
  WI: "55", WV: "54", WY: "56",
};

export const SST_MEMBER_STATES = Object.freeze(Object.keys(SST_STATES));

/** FIPS state code → two-letter state, for every state and DC. */
export const FIPS_TO_STATE = Object.freeze({
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
});

// Kentucky, which levies no local tax, files its whole state as one Z row
// (40003–42788); anything wider than that is a typo, not a jurisdiction.
const MAX_RANGE_EXPANSION = 3000;

/** "2026-09-19" or a Date → 20260919, the integer form the files use. */
export function yyyymmdd(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) throw new Error(`bad date: ${d}`);
  return (
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

/** 20260919 → a UTC Date. */
export function dateFromYyyymmdd(n) {
  const s = String(n).padStart(8, "0");
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

/**
 * Picks the newest file per state from an SST directory listing.
 *
 * Names look like OHR2026Q4SEP17.csv / WAB2026Q4AUG27.zip / WYR2026Q4AUG20.CSV.
 * Newest = highest (year, quarter, file date). The listing is raw HTML from
 * an IIS directory page; only the hrefs are read.
 *
 * @returns {{ [state]: { name, url, year, quarter, fileDate } }}
 */
export function parseSstListing(html, kind, baseUrl) {
  const re = /HREF="([^"]*\/([A-Z]{2})([RB])(\d{4})Q([1-4])([A-Z]{3})(\d{1,2})\.(csv|zip))"/gi;
  const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const out = {};
  let m;
  while ((m = re.exec(html))) {
    const [, href, state, letter, year, quarter, mon, day] = m;
    if (letter.toUpperCase() !== kind) continue;
    if (!SST_STATES[state.toUpperCase()]) continue;
    const month = MONTHS[mon.toUpperCase()];
    if (!month) continue;
    // The file date's year is the file year for Q1–Q3 files and can be the
    // previous calendar year for a Q4-labelled file published in August; the
    // label year is what orders files, the date only breaks ties.
    const rank = Number(year) * 100 + Number(quarter) * 10;
    const entry = {
      state: state.toUpperCase(),
      name: href.split("/").pop(),
      url: new URL(href, baseUrl).toString(),
      year: Number(year),
      quarter: Number(quarter),
      fileDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      rank,
    };
    const prev = out[entry.state];
    if (!prev || entry.rank > prev.rank || (entry.rank === prev.rank && entry.fileDate > prev.fileDate)) {
      out[entry.state] = entry;
    }
  }
  return out;
}

function splitLine(line) {
  // The files carry no quoted fields; the guard is for the day one does.
  if (!line.includes('"')) return line.split(",");
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const norm = (code) => String(code || "").trim().toUpperCase();
const numeric = (code) => {
  const n = norm(code).replace(/^0+(?=\d)/, "");
  return n;
};

/**
 * Reads an SST rate file into a lookup.
 *
 * @returns {{ rateFor(type, code, asOf): {rate, begin}|null, rows: number }}
 *   `rate` is a PERCENT (6.5, not 0.065). Matching is (type, code) first,
 *   code alone second — see the header on Washington.
 */
export function parseSstRateFile(text) {
  const byTypeCode = new Map();
  const byCode = new Map();
  let rows = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const f = splitLine(line).map((s) => s.trim());
    if (f.length < 9) continue;
    const type = String(parseInt(f[1], 10));
    if (!Number.isFinite(Number(type))) continue; // header line
    const code = norm(f[2]);
    const rate = Number(f[3]);
    const begin = parseInt(f[7], 10);
    const end = parseInt(f[8], 10);
    if (!Number.isFinite(rate) || !Number.isFinite(begin) || !Number.isFinite(end)) continue;
    const row = { type, code, rate: Math.round(rate * 100 * 10000) / 10000, begin, end };
    rows++;
    const k = `${type}|${numeric(code)}`;
    if (!byTypeCode.has(k)) byTypeCode.set(k, []);
    byTypeCode.get(k).push(row);
    const c = numeric(code);
    if (!byCode.has(c)) byCode.set(c, []);
    byCode.get(c).push(row);
  }
  const pick = (list, asOf) => {
    if (!list) return null;
    let best = null;
    for (const r of list) {
      if (r.begin <= asOf && asOf <= r.end && (!best || r.begin > best.begin)) best = r;
    }
    return best;
  };
  return {
    rows,
    rateFor(type, code, asOf) {
      const t = String(parseInt(type, 10));
      return (
        pick(byTypeCode.get(`${t}|${numeric(code)}`), asOf) ||
        pick(byCode.get(numeric(code)), asOf)
      );
    },
  };
}

/**
 * Composes every ZIP in an SST boundary file against its rate file.
 *
 * @param boundaryText  the boundary CSV
 * @param rates         parseSstRateFile()'s result
 * @param opts.state    two-letter state the file is for
 * @param opts.asOf     Date — which day's rates
 * @param opts.source   provenance string stamped on every row
 * @param opts.fetchedAt Date
 * @returns {{ rows: object[], stats: object }}
 */
export function composeSstZipRates(boundaryText, rates, { state, asOf, source, fetchedAt }) {
  const fips = SST_STATES[state];
  if (!fips) throw new Error(`${state} is not a Streamlined Sales Tax member`);
  const day = yyyymmdd(asOf);
  const stateRow = rates.rateFor("45", fips, day);
  if (!stateRow) throw new Error(`${state}: no state-level rate (type 45, code ${fips}) effective ${day}`);

  const zRows = new Map(); // zip → composition
  const plus4 = new Map(); // zip → Map(key → { count, composition })
  const stats = { z: 0, plus4: 0, skippedRange: 0, unmatchedCodes: new Set() };

  const compose = (f) => {
    const parts = [{ kind: "state", code: fips, rate: stateRow.rate, begin: stateRow.begin }];
    const county = norm(f[24]);
    const place = norm(f[25]);
    if (county) {
      const r = rates.rateFor("0", county, day);
      if (r) parts.push({ kind: "county", code: county, rate: r.rate, begin: r.begin });
      else stats.unmatchedCodes.add(`county:${county}`);
    }
    if (place) {
      const r = rates.rateFor("1", place, day);
      if (r) parts.push({ kind: "city", code: place, rate: r.rate, begin: r.begin });
      else stats.unmatchedCodes.add(`place:${place}`);
    }
    // Not `break` on an empty slot: Minnesota leaves gaps between triplets
    // ("ST,80004,63,,,,ST,80008,63"), and stopping at the first one dropped
    // the metro transit and housing districts from every Minneapolis ZIP.
    for (let i = 29; i + 2 < f.length; i += 3) {
      const code = norm(f[i + 1]);
      if (!code) continue;
      const r = rates.rateFor(f[i + 2] || "63", code, day);
      if (r) parts.push({ kind: "special", code, rate: r.rate, begin: r.begin });
      else stats.unmatchedCodes.add(`special:${code}`);
    }
    return parts;
  };

  for (const raw of String(boundaryText).split(/\r?\n/)) {
    if (!raw) continue;
    const t = raw[0];
    if (t !== "Z" && t !== "z" && t !== "4") continue; // address rows are not ZIP facts
    const f = splitLine(raw).map((s) => s.trim());
    if (f.length < 26) continue;
    const begin = parseInt(f[1], 10);
    const end = parseInt(f[2], 10);
    if (!(begin <= day && day <= end)) continue;
    if (norm(f[22]) && norm(f[22]) !== fips) continue; // a neighbour's ZIP filed by mistake
    const lo = parseInt(f[17], 10);
    const hi = parseInt(f[19] || f[17], 10);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) continue;
    if (hi - lo > MAX_RANGE_EXPANSION) {
      stats.skippedRange++;
      continue;
    }
    const parts = compose(f);
    const key = parts.map((p) => `${p.kind}:${p.code}=${p.rate}`).join("+");
    for (let z = lo; z <= hi; z++) {
      const zip = String(z).padStart(5, "0");
      if (t === "4") {
        stats.plus4++;
        if (!plus4.has(zip)) plus4.set(zip, new Map());
        const m = plus4.get(zip);
        const e = m.get(key) || { count: 0, parts };
        e.count++;
        m.set(key, e);
      } else {
        stats.z++;
        // A later-beginning Z row for the same ZIP wins; the files carry the
        // whole history and two current rows would be the state's error.
        const prev = zRows.get(zip);
        if (!prev || begin >= prev.begin) zRows.set(zip, { parts, begin });
      }
    }
  }

  const rows = [];
  const total = (parts) => Math.round(parts.reduce((s, p) => s + p.rate, 0) * 10000) / 10000;
  const emit = (zip, parts, maxRate) => {
    const sum = (kind) => {
      const of = parts.filter((p) => p.kind === kind);
      return of.length ? Math.round(of.reduce((s, p) => s + p.rate, 0) * 10000) / 10000 : null;
    };
    const combined = total(parts);
    const county = parts.find((p) => p.kind === "county")?.code || null;
    const city = parts.find((p) => p.kind === "city")?.code || null;
    rows.push({
      zip,
      state,
      county: county ? `${fips}${county}` : null,
      city: city ? `${fips}:${city}` : null,
      combinedRate: combined,
      stateRate: stateRow.rate,
      countyRate: sum("county"),
      cityRate: sum("city"),
      specialRate: sum("special"),
      maxRate: maxRate != null && maxRate > combined ? maxRate : null,
      zipSpansRates: maxRate != null && maxRate > combined,
      effectiveFrom: dateFromYyyymmdd(Math.max(...parts.map((p) => p.begin))),
      source,
      sourceKind: "sst",
      fetchedAt,
    });
  };

  const plus4Range = (zip) => {
    const m = plus4.get(zip);
    if (!m) return null;
    let lo = null;
    let hi = -1;
    for (const e of m.values()) {
      const t = total(e.parts);
      if (!lo || t < total(lo.parts)) lo = e;
      if (t > hi) hi = t;
    }
    return { lowest: lo.parts, maxRate: hi };
  };
  for (const [zip, { parts }] of zRows) {
    const r = plus4Range(zip);
    emit(zip, parts, r ? Math.max(r.maxRate, total(parts)) : null);
  }
  for (const [zip] of plus4) {
    if (zRows.has(zip)) continue;
    const r = plus4Range(zip);
    emit(zip, r.lowest, r.maxRate);
  }
  rows.sort((a, b) => (a.zip < b.zip ? -1 : 1));
  stats.unmatchedCodes = [...stats.unmatchedCodes];
  return { rows, stats };
}

/* ── Pennsylvania: state + county surcharge, from the Census crosswalk ─────
 *
 * Pennsylvania levies 6% statewide, an extra 1% in Allegheny County and an
 * extra 2% in Philadelphia, and nothing else local — Pennsylvania Department
 * of Revenue, "Sales, Use and Hotel Occupancy Tax" (72 P.S. § 7202; Act 77 of
 * 1993 for Allegheny; Philadelphia under the First Class City Business Tax
 * Reform Act), checked September 2026. That is the whole local picture, so
 * the only thing to look up is which county a ZIP is in, and the Census
 * Bureau publishes that: the 2020 ZCTA-to-county relationship file at
 * https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
 * (pipe-delimited; GEOID_ZCTA5_20, GEOID_COUNTY_20, NAMELSAD_COUNTY_20,
 * AREALAND_PART). A ZCTA that straddles two counties is assigned to the one
 * holding most of its land, and marked `zipSpansRates` when the two counties
 * would charge different rates.
 */
export const PA_COUNTY_SURCHARGES = Object.freeze({
  "42003": { name: "Allegheny County", rate: 1 },
  "42101": { name: "Philadelphia County", rate: 2 },
});
const PA_STATE_RATE = 6;

/**
 * @param text  the Census relationship file
 * @returns {{ rows: object[], stats: object }}
 */
export function composePaZipRates(text, { asOf, source, fetchedAt }) {
  const lines = String(text).split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("|").map((h) => h.trim());
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Census crosswalk: no column ${name}`);
    return i;
  };
  const iZ = col("GEOID_ZCTA5_20");
  const iC = col("GEOID_COUNTY_20");
  const iN = col("NAMELSAD_COUNTY_20");
  const iA = col("AREALAND_PART");
  const byZip = new Map();
  for (const line of lines.slice(1)) {
    const f = line.split("|");
    const county = f[iC];
    if (!county || !county.startsWith("42")) continue;
    const zip = f[iZ];
    if (!/^\d{5}$/.test(zip)) continue;
    if (!byZip.has(zip)) byZip.set(zip, []);
    byZip.get(zip).push({ county, name: f[iN], land: Number(f[iA]) || 0 });
  }
  const rows = [];
  for (const [zip, parts] of byZip) {
    parts.sort((a, b) => b.land - a.land);
    const main = parts[0];
    // Same rule as the SST adapter: the ZIP carries the LOWEST rate any of
    // its counties charge, and the highest rides along as maxRate. A ZIP
    // that is mostly Philadelphia with a sliver of Delaware County is
    // stored at 6% with maxRate 8% and spans=true — the document then says
    // an address in Philadelphia pays 8%, rather than the loader deciding
    // by land area which side of the line a homeowner lives on.
    const surcharges = parts.map((p) => PA_COUNTY_SURCHARGES[p.county]?.rate || 0);
    const lowest = Math.min(...surcharges);
    const highest = Math.max(...surcharges);
    rows.push({
      zip,
      state: "PA",
      county: main.name,
      city: null,
      combinedRate: PA_STATE_RATE + lowest,
      stateRate: PA_STATE_RATE,
      countyRate: lowest || null,
      cityRate: null,
      specialRate: null,
      maxRate: highest > lowest ? PA_STATE_RATE + highest : null,
      zipSpansRates: highest > lowest,
      // The surcharges have not moved in decades; the date that matters for
      // the document is the one the crosswalk was read at.
      effectiveFrom: asOf instanceof Date ? asOf : new Date(asOf),
      source,
      sourceKind: "census_county",
      fetchedAt,
    });
  }
  rows.sort((a, b) => (a.zip < b.zip ? -1 : 1));
  return { rows, stats: { zips: rows.length } };
}

/**
 * The SQL for one batch of rows — an upsert keyed on zip, so re-running the
 * loader with the same files changes nothing and re-running with next
 * month's files updates in place. Nothing is ever deleted.
 *
 * @returns {{ sql: string, params: any[] }}
 */
export function upsertSql(rows) {
  const cols = [
    "zip", "state", "county", "city", "combinedRate", "stateRate", "countyRate",
    "cityRate", "specialRate", "maxRate", "zipSpansRates", "effectiveFrom", "source",
    "sourceKind", "fetchedAt",
  ];
  const params = [];
  const values = rows.map((r) => {
    const slots = cols.map((c) => {
      params.push(r[c] ?? null);
      return `$${params.length}`;
    });
    return `(${slots.join(",")})`;
  });
  const sql =
    `INSERT INTO "UsSalesTaxRate" (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${values.join(",")} ` +
    `ON CONFLICT ("zip") DO UPDATE SET ` +
    cols
      .filter((c) => c !== "zip")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");
  return { sql, params };
}
