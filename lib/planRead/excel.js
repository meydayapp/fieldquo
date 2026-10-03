// lib/planRead/excel.js
//
// The scope spreadsheet that comes with a commercial drawing set — "Area /
// Description / Qty / Unit / Finish / Notes" — read in CODE. No model reads
// the raw file: the rows are parsed here, the header's columns are given a
// role by their own words, and the synthesis pass receives a compact table
// it can cite by row number ("Excel row 14").
//
// Pure. The bytes are turned into rows by lib/planRead/ingest.js
// (read-excel-file for .xlsx, papaparse for .csv); this file only sees
// `[{ sheet, data: unknown[][] }]`.

export const MAX_ROWS = 1500;
export const MAX_COLS = 30;
const CELL_CHARS = 160;

/** Header words → the role a column plays. First match wins, in this order. */
const ROLE_WORDS = [
  ["quantity", /^(qty|quantity|quant|amount|count|no\.?|#|sq\.?\s?ft|sf|area\s*\(?(?:sf|sq|m2|m²)|lf|lin\.?\s?ft|m2|m²)\b/i],
  ["unit", /^(unit|units|uom|u\/m|measure)\b/i],
  ["area", /^(area|location|room|space|level|floor|zone|elevation|building)\b/i],
  ["finish", /^(finish|paint|coating|product|colou?r|stain|system|spec)\b/i],
  ["height", /^(height|ht|hgt|ceiling)\b/i],
  ["description", /^(description|desc|scope|item|work|surface|element|task)\b/i],
  ["notes", /^(notes?|remarks?|comments?|clarifications?)\b/i],
];

const cellText = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length > CELL_CHARS ? `${s.slice(0, CELL_CHARS - 1)}…` : s;
};

/** Spreadsheet column letter for a 0-based index: 0 → A, 27 → AB. */
export function columnLetter(i) {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function headerRowIndex(rows) {
  // The first row, among the first 15, with at least two cells that name a
  // role — a title row ("St. Mark's — Paint Scope") above the header is the
  // norm, not the exception.
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const roles = rows[i].filter((c) => ROLE_WORDS.some(([, re]) => re.test(cellText(c)))).length;
    if (roles >= 2) return i;
  }
  return -1;
}

/**
 * Parse one workbook's sheets into the stored shape. Pure.
 *
 * @param {{ sheet: string, data: unknown[][] }[]} sheets
 * @returns {{ sheets: { name, header: string[], roles: Record<string,string>,
 *            rows: { r: number, cells: Record<string,string> }[] }[],
 *            rowCount: number, truncated: boolean }}
 */
export function parseScopeSheets(sheets) {
  const out = [];
  let rowCount = 0;
  let truncated = false;
  for (const s of Array.isArray(sheets) ? sheets : []) {
    const data = Array.isArray(s?.data) ? s.data.filter(Array.isArray) : [];
    if (!data.length) continue;
    const width = Math.min(MAX_COLS, Math.max(0, ...data.map((r) => r.length)));
    const h = headerRowIndex(data);
    const header = [];
    const roles = {};
    for (let c = 0; c < width; c++) {
      const text = h >= 0 ? cellText(data[h][c]) : "";
      header.push(text || columnLetter(c));
      if (h >= 0 && text) {
        const role = ROLE_WORDS.find(([, re]) => re.test(text))?.[0];
        if (role && !Object.values(roles).includes(role)) roles[columnLetter(c)] = role;
      }
    }
    const rows = [];
    for (let i = h + 1; i < data.length; i++) {
      if (rowCount >= MAX_ROWS) {
        truncated = true;
        break;
      }
      const cells = {};
      let any = false;
      for (let c = 0; c < width; c++) {
        const t = cellText(data[i][c]);
        if (t) {
          cells[columnLetter(c)] = t;
          any = true;
        }
      }
      if (!any) continue;
      // Spreadsheet row numbers are 1-based — the estimator opens the file
      // and goes to the row the overview cites.
      rows.push({ r: i + 1, cells });
      rowCount++;
    }
    out.push({ name: cellText(s.sheet) || `Sheet ${out.length + 1}`, header, roles, rows });
  }
  return { sheets: out, rowCount, truncated };
}

/** The table as compact text for a prompt: one line per row, cited by row. */
export function scopeSheetDigest(parsed, { maxChars = 12000 } = {}) {
  if (!parsed?.sheets?.length) return "";
  let text = "";
  for (const s of parsed.sheets) {
    const cols = s.header.map((h, i) => `${columnLetter(i)}=${h}${s.roles[columnLetter(i)] ? ` (${s.roles[columnLetter(i)]})` : ""}`);
    const head = `Sheet "${s.name}" columns: ${cols.join("; ")}\n`;
    if (text.length + head.length > maxChars) break;
    text += head;
    for (const row of s.rows) {
      const line = `row ${row.r}: ${Object.entries(row.cells).map(([k, v]) => `${k}:${v}`).join(" | ")}\n`;
      if (text.length + line.length > maxChars) return `${text}… (more rows not shown)\n`;
      text += line;
    }
  }
  return text;
}
