// lib/googleAds/reportParse.js
//
// A Google Ads report, as a contractor actually downloads it, → clean spend
// rows. Pure: no db, no fetch, no clock. The import route
// (app/api/marketing-spend/google-ads-import/route.js) hands it the cells and
// lib/googleAds/spendPlan.js decides what to write; scripts/check-google-ads.mjs
// runs this against real-shaped exports.
//
// ── What a real export looks like, and why each line below exists ─────────
//
// Google Ads → Campaigns → Download → CSV (or Reports → a saved report):
//
//     Campaign report                                   ← a title row
//     "September 1, 2026 - September 30, 2026"          ← the date range
//     Day,Campaign,Campaign ID,Currency code,Cost,Impr.,Clicks,Conversions
//     2026-09-01,Spring Roofs,12345678901,CAD,12.34,"1,234",7,1.00
//     …
//     Total: Account,--,--,CAD,"1,240.10","98,765",512,31.50   ← totals rows
//     Total: Campaigns,…
//
// and the same thing in the UI's language: "Jour,Campagne,Coût,Clics…" with
// "1 234,56" for a French account, "1.234,56" for a German one. The
// "CSV (Excel)" download is UTF-16 with TABS rather than commas. Some people
// download .xlsx instead. Every one of those is a file the owner's
// contractors will upload, so every one is handled here rather than refused
// as "unexpected format":
//
//   • title rows above the header are skipped — the header is the first row
//     that names BOTH a campaign column and a cost column;
//   • the date range is read from those title rows when a report has no Day
//     column (a per-campaign total for the whole range);
//   • totals rows ("Total: Account", "Total : campagnes", "Gesamt", "--") are
//     skipped and counted, never summed into a campaign;
//   • numbers are read in the file's own locale, decided ONCE for the whole
//     file from the cost column (a cost always has two decimals, which is
//     what makes "1,234" vs "12,34" decidable), not guessed per cell;
//   • a campaign split across several rows on the same day (a report
//     segmented by device or network) is ADDED UP into one row, and the
//     preview says how many rows were merged.
//
// ── What it refuses ────────────────────────────────────────────────────────
//
//   • A currency it was not told. A report without a "Currency code" column
//     gives no currency, and the company's own is NOT assumed — that would be
//     the absent-data-padded-with-a-default failure AGENTS.md lists. The
//     route asks the person to state it (`needsCurrency`).
//   • A day it cannot read unambiguously. "03/04/2026" with no row past the
//     12th on either side is refused, not coin-flipped.
//   • Week / Month / Quarter segments. A "Week" row is seven days of spend on
//     one date; storing it would put a week into whichever month its Monday
//     falls in. The preview says to download it by Day.
//
// Nothing here ever produces a lead count. Google's "Conversions" is Google's
// claim about its own tag firing, kept as `conversions` and labelled as
// Google's — never FieldQuo's leads (docs/GOOGLE-ADS-INTEGRATION.md).

import Papa from "papaparse";

/** A report bigger than this is not one contractor's ad account. */
export const MAX_REPORT_ROWS = 20000;
export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────
// Bytes → text
// ─────────────────────────────────────────────────────────────────────────

/**
 * The raw upload → text. Google's "CSV (Excel)" download is UTF-16LE with a
 * BOM; the plain CSV is UTF-8, sometimes with one. A UTF-16 file read as
 * UTF-8 is a null byte between every letter, which papaparse would happily
 * turn into one-column garbage — so the encoding is decided from the BOM
 * (or, failing one, from where the zero bytes sit) before anything parses.
 *
 * @param {Uint8Array|Buffer} bytes
 * @returns {{ text: string|null, encoding: string|null, error: string|null }}
 */
export function decodeReportBytes(bytes) {
  if (!bytes || typeof bytes.length !== "number") return { text: null, encoding: null, error: "unparseable" };
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length === 0) return { text: null, encoding: null, error: "empty_file" };
  // An .xlsx (or any zip) renamed .csv — "PK\x03\x04".
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    return { text: null, encoding: null, error: "is_xlsx" };
  }
  let encoding = "utf-8";
  let start = 0;
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    encoding = "utf-16le";
    start = 2;
  } else if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    encoding = "utf-16be";
    start = 2;
  } else if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    start = 3;
  } else if (b.length >= 4) {
    // No BOM: ASCII text in UTF-16 has a zero in every other byte.
    let evenZeros = 0;
    let oddZeros = 0;
    const n = Math.min(b.length, 400);
    for (let i = 0; i < n; i++) if (b[i] === 0) (i % 2 === 0 ? evenZeros++ : oddZeros++);
    if (oddZeros > n / 4 && evenZeros === 0) encoding = "utf-16le";
    else if (evenZeros > n / 4 && oddZeros === 0) encoding = "utf-16be";
  }
  let text;
  try {
    const slice = b.subarray(start);
    if (encoding === "utf-16be") {
      // TextDecoder has no utf-16be in every runtime; swap to LE.
      const swapped = new Uint8Array(slice.length - (slice.length % 2));
      for (let i = 0; i + 1 < slice.length; i += 2) {
        swapped[i] = slice[i + 1];
        swapped[i + 1] = slice[i];
      }
      text = new TextDecoder("utf-16le", { fatal: false }).decode(swapped);
    } else {
      text = new TextDecoder(encoding, { fatal: false }).decode(slice);
    }
  } catch {
    return { text: null, encoding: null, error: "unparseable" };
  }
  if (text.includes("\u0000")) return { text: null, encoding, error: "unparseable" };
  if (!text.trim()) return { text: null, encoding, error: "empty_file" };
  return { text, encoding, error: null };
}

/**
 * CSV text → a matrix of cells, in whichever delimiter makes it a report:
 * comma (Google's CSV), tab (Google's "CSV (Excel)"), semicolon (a European
 * Excel re-save). papaparse's own guess is made from the first lines, which
 * in a Google export are the title and the date range — no delimiter at all
 * — so it is asked once, and each delimiter is then tried until one of them
 * yields a row naming a campaign and a cost.
 */
export function csvTextToMatrix(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const parse = (delimiter) => {
    const result = Papa.parse(clean, { skipEmptyLines: "greedy", ...(delimiter ? { delimiter } : {}) });
    return Array.isArray(result?.data) ? result.data : [];
  };
  let first = null;
  for (const delimiter of [null, "\t", ";", ","]) {
    const matrix = parse(delimiter);
    if (first === null) first = matrix;
    if (findHeaderRow(matrix) !== -1) return matrix;
  }
  return first || [];
}

/**
 * One spreadsheet cell from read-excel-file → what the parser reads. A date
 * cell arrives as a Date at UTC midnight and is written as its UTC day; a
 * number stays a number (no locale to guess); anything else is text.
 */
export function xlsxCell(cell) {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : "";
  if (typeof cell === "boolean") return String(cell);
  return String(cell);
}

// ─────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────

/** Lower-case, accents off, NBSP to space, whitespace collapsed. */
export function normaliseHeader(h) {
  return String(h ?? "")
    .replace(/[  ]/g, " ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The header as Google writes it in each UI language the product serves,
// normalised. EXACT matches only: "Avg. cost", "Cost / conv." and "All conv."
// are real columns beside the ones wanted here, and a prefix match would sum
// an average into a total.
const HEADERS = {
  campaign: ["campaign", "campaign name", "campagne", "nom de la campagne", "campana", "nombre de la campana", "kampagne", "campagna", "campanha", "кампанія", "kampanya"],
  campaignId: ["campaign id", "id de la campagne", "id de campagne", "id de campana", "id de la campana", "kampagnen-id", "id campagna", "id da campanha"],
  day: ["day", "date", "jour", "dia", "tag", "giorno", "data", "fecha"],
  cost: ["cost", "cout", "costo", "coste", "kosten", "custo", "spend"],
  currency: ["currency code", "currency", "code de la devise", "code devise", "devise", "codigo de moneda", "codigo de la moneda", "moneda", "wahrungscode", "wahrung", "codice valuta", "valuta", "codigo da moeda", "moeda"],
  clicks: ["clicks", "clics", "klicks", "clic", "cliques"],
  impressions: ["impr.", "impressions", "impr", "impresiones", "impressionen", "impressioni", "impressoes"],
  conversions: ["conversions", "conv.", "conversiones", "conversioni", "conversoes", "konversionen"],
};
// Segments that are NOT a day. Their presence is a refusal, said in words.
const NON_DAY_SEGMENTS = ["week", "month", "quarter", "year", "semaine", "mois", "trimestre", "annee", "semana", "mes", "ano", "woche", "monat", "quartal", "jahr", "settimana", "mese", "anno", "trimestre"];

/** The column index for each field, or null. Pure. */
export function mapHeaders(headerRow) {
  const cells = (Array.isArray(headerRow) ? headerRow : []).map(normaliseHeader);
  const find = (names) => {
    const i = cells.findIndex((c) => names.includes(c));
    return i === -1 ? null : i;
  };
  const mapping = {};
  for (const [field, names] of Object.entries(HEADERS)) mapping[field] = find(names);
  const nonDay = cells.find((c) => NON_DAY_SEGMENTS.includes(c)) || null;
  return { mapping, nonDaySegment: mapping.day === null ? nonDay : null };
}

function findHeaderRow(matrix) {
  const limit = Math.min(matrix.length, 15);
  for (let i = 0; i < limit; i++) {
    const { mapping } = mapHeaders(matrix[i]);
    if (mapping.campaign !== null && mapping.cost !== null) return i;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────
// Numbers
// ─────────────────────────────────────────────────────────────────────────

const EMPTY_MARKERS = new Set(["", "--", "-", "—", "–", "n/a", "na", " --"]);

function stripNumber(raw) {
  return String(raw)
    .replace(/[   \s']/g, "")
    .replace(/^[^\d\-+.,]+/, "") // a currency symbol or code in front: "$", "CA$", "CAD "
    .replace(/[^\d.,]+$/, ""); // or behind: "12,34 €", "45%"
}

/**
 * Which character is the DECIMAL separator in this file: "." or ",", or
 * null when nothing in the sample decides it. Read off the cost column,
 * where Google always prints two decimals.
 */
export function detectDecimalSeparator(samples) {
  let dot = 0;
  let comma = 0;
  for (const raw of Array.isArray(samples) ? samples : []) {
    if (typeof raw === "number") continue;
    const s = stripNumber(raw ?? "");
    if (!s) continue;
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastDot !== -1 && lastComma !== -1) {
      lastDot > lastComma ? dot++ : comma++;
      continue;
    }
    if (/,\d{1,2}$/.test(s)) comma++;
    else if (/\.\d{1,2}$/.test(s)) dot++;
  }
  if (dot && !comma) return ".";
  if (comma && !dot) return ",";
  if (dot && comma) return dot >= comma ? "." : ",";
  return null;
}

/**
 * One cell → a number, in the file's locale, or null for "not reported"
 * ("--", blank). `NaN` for a cell that is present and unreadable, so the
 * caller can tell the two apart — absence is not zero, and garbage is not
 * absence.
 */
export function parseLocaleNumber(raw, decimal) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const trimmed = String(raw).trim();
  if (EMPTY_MARKERS.has(trimmed.toLowerCase())) return null;
  let s = stripNumber(trimmed);
  const negative = /^-/.test(s) || /^\(.*\)$/.test(trimmed);
  s = s.replace(/^[-+]/, "");
  if (!s || !/^[\d.,]+$/.test(s)) return NaN;
  if (decimal === ",") {
    s = s.replace(/\./g, "").replace(",", ".");
    if ((s.match(/\./g) || []).length > 1) return NaN;
  } else if (decimal === ".") {
    s = s.replace(/,/g, "");
  } else {
    // Undecided file: a value that is only digits and 3-digit groups is an
    // integer with grouping ("1,234", "1.234"); anything else is refused.
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
    else if (!/^\d+$/.test(s)) return NaN;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

// ─────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────

// Month words, normalised and keyed by their first letters, across the UI
// languages Google exports in. Checked longest-prefix first so "juin"/"juil"
// are never both "jui".
const MONTH_PREFIXES = [
  ["janv", 1], ["jan", 1], ["ene", 1], ["gen", 1],
  ["fevr", 2], ["febr", 2], ["feb", 2], ["fev", 2],
  ["marz", 3], ["mars", 3], ["mar", 3],
  ["avr", 4], ["apr", 4], ["abr", 4],
  ["mai", 5], ["may", 5], ["mag", 5],
  ["juin", 6], ["jun", 6], ["giu", 6],
  ["juil", 7], ["jul", 7], ["lug", 7],
  ["aout", 8], ["aug", 8], ["ago", 8],
  ["sept", 9], ["sep", 9], ["set", 9],
  ["oct", 10], ["okt", 10], ["ott", 10], ["out", 10],
  ["nov", 11],
  ["dec", 12], ["dez", 12], ["dic", 12],
];

function monthOf(word) {
  const w = normaliseHeader(word).replace(/[.,]/g, "");
  if (w.length < 3) return null;
  for (const [prefix, m] of MONTH_PREFIXES) if (w.startsWith(prefix)) return m;
  return null;
}

function isoDay(y, m, d) {
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31 Feb
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A date with a month WORD ("September 1, 2026", "1 sept. 2026",
 * "1. September 2026", "1 de septiembre de 2026") or ISO → "YYYY-MM-DD",
 * else null. Numeric slashed dates go through parseDayColumn instead, which
 * sees the whole column and can decide day/month order.
 */
export function parseWordDate(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (iso) return isoDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const tokens = s.split(/[\s,./]+/).filter(Boolean);
  let year = null;
  let month = null;
  let day = null;
  for (const t of tokens) {
    if (/^\d{4}$/.test(t)) year = Number(t);
    else if (/^\d{1,2}$/.test(t) && day === null) day = Number(t);
    else if (month === null) {
      const m = monthOf(t);
      if (m) month = m;
    }
  }
  if (year && month && day) return isoDay(year, month, day);
  return null;
}

/**
 * Every value of the Day column → ISO days, with the day/month order decided
 * across the WHOLE column for slashed dates. Returns
 *   { status: "ok", days: [...] }               every value read
 *   { status: "ambiguous" }                     03/04/2026-style, no row decides
 *   { status: "error", badIndexes: [...] }      some values unreadable
 */
export function parseDayColumn(values) {
  const list = Array.isArray(values) ? values : [];
  const slashed = list.map((v) => /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(String(v ?? "")));
  let dayFirst = null;
  if (slashed.some(Boolean)) {
    const firstOver12 = slashed.some((m) => m && Number(m[1]) > 12);
    const secondOver12 = slashed.some((m) => m && Number(m[2]) > 12);
    if (firstOver12 && !secondOver12) dayFirst = true;
    else if (secondOver12 && !firstOver12) dayFirst = false;
    else if (!firstOver12 && !secondOver12) {
      // Every slashed value has both parts ≤ 12. Only safe if they are all
      // the same either way round (01/01, 02/02…).
      const allSame = slashed.every((m) => !m || m[1] === m[2]);
      if (!allSame) return { status: "ambiguous" };
      dayFirst = true;
    } else return { status: "error", badIndexes: slashed.map((m, i) => (m ? i : -1)).filter((i) => i >= 0) };
  }
  const days = [];
  const bad = [];
  list.forEach((v, i) => {
    const m = slashed[i];
    let iso = null;
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      iso = dayFirst ? isoDay(Number(m[3]), b, a) : isoDay(Number(m[3]), a, b);
    } else {
      iso = parseWordDate(v);
    }
    if (!iso) bad.push(i);
    days.push(iso);
  });
  if (bad.length) return { status: "error", badIndexes: bad, days };
  return { status: "ok", days };
}

/**
 * The report's date range from the title rows above the header:
 * "September 1, 2026 - September 30, 2026", "1 sept. 2026 – 30 sept. 2026",
 * "2026-09-01 - 2026-09-30". Null when none of the rows holds one.
 */
export function parseReportRange(titleRows) {
  for (const row of Array.isArray(titleRows) ? titleRows : []) {
    for (const cell of Array.isArray(row) ? row : [row]) {
      const s = String(cell ?? "").trim();
      if (!s) continue;
      // Split on a dash that has whitespace around it — the ISO dates inside
      // contain dashes without.
      const parts = s.split(/\s+[-–—]\s+/);
      if (parts.length !== 2) continue;
      const start = parseWordDate(parts[0]);
      const end = parseWordDate(parts[1]);
      if (start && end && start <= end) return { start, end };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// The whole report
// ─────────────────────────────────────────────────────────────────────────

function isTotalsRow(cells, mapping) {
  const firstThree = cells.slice(0, 3).map(normaliseHeader);
  if (firstThree.some((c) => /^(total|totale|totales|gesamt|summe|insgesamt)\b/.test(c))) return true;
  const campaign = normaliseHeader(cells[mapping.campaign]);
  return campaign === "" || campaign === "--" || /^(total|totale|gesamt)\b/.test(campaign);
}

/** Campaign name → the stable piece of an externalId when Google gave no id. */
export function campaignNameKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CURRENCY_RE = /^[A-Z]{3}$/;
const ID_RE = /^\d{5,20}$/;

/**
 * A matrix of cells → the rows to import, and everything the preview has to
 * say about the file.
 *
 * @param {Array<Array<string|number>>} matrix
 * @param {object} [opts]
 * @param {string|null} [opts.statedCurrency]  what the person said the
 *        account bills in, when the file has no currency column
 * @returns {{
 *   error: string|null,
 *   rows: Array<{ externalKey: string, campaignId: string|null, campaignName: string,
 *     date: string, rangeEnd: string|null, amount: number, clicks: number|null,
 *     impressions: number|null, conversions: number|null, currency: string|null, sourceLines: number[] }>,
 *   granularity: "day"|"range"|null,
 *   range: {start,end}|null,
 *   needsCurrency: boolean,
 *   currencies: string[],
 *   decimal: "."|","|null,
 *   skippedTotals: number, skippedEmpty: number, mergedRows: number,
 *   rowErrors: Array<{ line: number, reason: string }>,
 * }}
 */
export function parseGoogleAdsReport(matrix, { statedCurrency = null } = {}) {
  const out = {
    error: null,
    rows: [],
    granularity: null,
    range: null,
    needsCurrency: false,
    currencies: [],
    decimal: null,
    nonDaySegment: null,
    skippedTotals: 0,
    skippedEmpty: 0,
    mergedRows: 0,
    rowErrors: [],
  };
  const m = Array.isArray(matrix) ? matrix.filter((r) => Array.isArray(r)) : [];
  if (!m.length) return { ...out, error: "empty_file" };
  if (m.length > MAX_REPORT_ROWS) return { ...out, error: "too_many_rows" };

  const headerIndex = findHeaderRow(m);
  if (headerIndex === -1) return { ...out, error: "no_header" };
  const { mapping, nonDaySegment } = mapHeaders(m[headerIndex]);
  if (nonDaySegment) return { ...out, error: "not_daily", nonDaySegment };
  out.range = parseReportRange(m.slice(0, headerIndex));

  const body = m.slice(headerIndex + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (!body.length) return { ...out, error: "headers_only" };

  // Lines are 1-based as a spreadsheet numbers them, so the preview's
  // "line 14" is line 14 in the file the person has open.
  const dataLines = [];
  for (let i = 0; i < body.length; i++) {
    const cells = body[i];
    if (isTotalsRow(cells, mapping)) {
      out.skippedTotals++;
      continue;
    }
    dataLines.push({ cells, line: m.indexOf(cells) + 1 });
  }
  if (!dataLines.length) return { ...out, error: "headers_only" };

  // ── Currency: the file's column, or what the person stated, or a refusal.
  const statedOk = typeof statedCurrency === "string" && CURRENCY_RE.test(statedCurrency.trim().toUpperCase())
    ? statedCurrency.trim().toUpperCase()
    : null;
  if (mapping.currency === null && !statedOk) {
    out.needsCurrency = true;
  }

  // ── The day of each line, or the report's range.
  let days = null;
  if (mapping.day !== null) {
    const parsed = parseDayColumn(dataLines.map((d) => d.cells[mapping.day]));
    if (parsed.status === "ambiguous") return { ...out, error: "ambiguous_dates" };
    if (parsed.status === "error") {
      for (const i of parsed.badIndexes) out.rowErrors.push({ line: dataLines[i]?.line ?? 0, reason: "unreadable_day" });
    }
    days = parsed.days || dataLines.map(() => null);
    out.granularity = "day";
  } else {
    if (!out.range) return { ...out, error: "no_day_no_range" };
    out.granularity = "range";
  }

  out.decimal = detectDecimalSeparator(dataLines.map((d) => d.cells[mapping.cost]));

  const merged = new Map();
  const currencies = new Set();
  dataLines.forEach(({ cells, line }, i) => {
    const campaignName = String(cells[mapping.campaign] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const idRaw = mapping.campaignId !== null ? String(cells[mapping.campaignId] ?? "").trim() : "";
    const campaignId = ID_RE.test(idRaw) ? idRaw : null;
    const date = days ? days[i] : out.range.start;
    if (!date) return; // already recorded as unreadable_day

    const amount = parseLocaleNumber(cells[mapping.cost], out.decimal);
    if (amount === null || Number.isNaN(amount)) {
      out.rowErrors.push({ line, reason: "unreadable_cost" });
      return;
    }
    if (amount < 0) {
      out.rowErrors.push({ line, reason: "negative_cost" });
      return;
    }
    const count = (field, { integer }) => {
      if (mapping[field] === null) return null;
      const n = parseLocaleNumber(cells[mapping[field]], out.decimal);
      if (n === null || Number.isNaN(n) || n < 0) return null;
      return integer ? Math.round(n) : Math.round(n * 100) / 100;
    };
    const clicks = count("clicks", { integer: true });
    const impressions = count("impressions", { integer: true });
    const conversions = count("conversions", { integer: false });

    let currency = statedOk;
    if (mapping.currency !== null) {
      const c = String(cells[mapping.currency] ?? "").trim().toUpperCase();
      if (!CURRENCY_RE.test(c)) {
        out.rowErrors.push({ line, reason: "unreadable_currency" });
        return;
      }
      currency = c;
    }
    if (currency) currencies.add(currency);

    if (amount === 0 && !clicks && !impressions && !conversions) {
      out.skippedEmpty++;
      return;
    }

    const campaignKey = campaignId || `name:${campaignNameKey(campaignName)}`;
    if (!campaignId && !campaignNameKey(campaignName)) {
      out.rowErrors.push({ line, reason: "no_campaign" });
      return;
    }
    const period = out.granularity === "range" ? `${out.range.start}..${out.range.end}` : date;
    const externalKey = `${campaignKey}:${period}`;
    const prior = merged.get(externalKey);
    if (prior) {
      // Same campaign, same day, two lines: a device- or network-segmented
      // report. Added up, and counted so the preview can say so.
      if (prior.currency !== currency) {
        out.rowErrors.push({ line, reason: "mixed_currency_campaign" });
        return;
      }
      prior.amount = Math.round((prior.amount + amount) * 100) / 100;
      prior.clicks = addNullable(prior.clicks, clicks);
      prior.impressions = addNullable(prior.impressions, impressions);
      prior.conversions = prior.conversions === null && conversions === null ? null : Math.round(((prior.conversions || 0) + (conversions || 0)) * 100) / 100;
      prior.sourceLines.push(line);
      out.mergedRows++;
      return;
    }
    merged.set(externalKey, {
      externalKey,
      campaignId,
      campaignName: campaignName || campaignId,
      date,
      rangeEnd: out.granularity === "range" ? out.range.end : null,
      amount: Math.round(amount * 100) / 100,
      clicks,
      impressions,
      conversions,
      currency: currency || null,
      sourceLines: [line],
    });
  });

  out.rows = [...merged.values()];
  out.currencies = [...currencies].sort();
  if (!out.rows.length && !out.rowErrors.length) return { ...out, error: out.skippedEmpty ? "only_empty_rows" : "headers_only" };
  return out;
}

function addNullable(a, b) {
  if (a === null && b === null) return null;
  return (a || 0) + (b || 0);
}
