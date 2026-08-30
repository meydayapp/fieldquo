// lib/expenses/csvImport.js
//
// Bank-statement CSV import — column mapping, date-format detection, sign
// convention, and duplicate detection. Every function here is PURE (no db,
// no fetch) so it can be executed directly against hostile input, per
// AGENTS.md's "execute pure functions against hostile input" rule. The two
// API routes (app/api/expenses/import/preview and .../commit) are thin
// wrappers that supply the company's existing rows and write the result —
// this file has no opinion about the database.
//
// ── Why CSV, and why it has to be able to become Plaid later ──────────────
//
// The owner evaluated Plaid and rejected it for now: no published pricing,
// four-figure monthly minimums, and no support for Canadian bank accounts at
// all. CSV gets most of the value — a contractor exports a statement from
// any bank and maps the columns themselves — at zero recurring cost and no
// bank credentials held. It is a stepping stone, not the permanent shape, so
// duplicate detection here is deliberately SOURCE-BLIND: naturalKey() never
// looks at where a row came from, only date + amount + normalised
// description. The day a Plaid sync redelivers months of transactions a
// contractor already imported by hand, this is what stops every one of them
// from being booked twice.
//
// ── The four bugs in the reference implementation this does NOT repeat ────
//
// 1. Its date format was hardcoded to "yyyy-MM-dd HH:mm:ss". Any other bank's
//    export silently became Invalid Date with nothing shown. detectDateFormat
//    below inspects the actual column values and refuses to guess when
//    day/month order is genuinely ambiguous (see "ambiguous" status).
// 2. Its bulk-create endpoint never checked the destination belonged to the
//    caller. Not this file's concern — every row this module touches is
//    scoped to companyId by the caller, and the API routes re-derive
//    companyId from the session, never from the request body.
// 3. Its paywall was client-side only. Also not this file's concern — same
//    reasoning: gating lives in the route, not here.
// 4. Its disconnect handler deleted rows. This module never deletes anything;
//    it only classifies rows as ok / duplicate / error / skipped.

import Papa from "papaparse";

// A field-service contractor's bank statement is a few hundred to a couple
// thousand rows. 5,000 is generous headroom while still being a number a
// route can process inline, in one request, without a background job.
export const MAX_ROWS = 5000;

// ─────────────────────────────────────────────────────────────────────────
// CSV parsing
// ─────────────────────────────────────────────────────────────────────────

export function stripBom(text) {
  return typeof text === "string" && text.charCodeAt(0) === 0xfeff
    ? text.slice(1)
    : text;
}

/**
 * Raw text -> { headers, rows, error }. `error` is one of:
 *   "unparseable"  — not readable as CSV at all (binary content)
 *   "empty_file"   — nothing in the file, not even a header row
 *   "headers_only" — a header row and zero data rows
 *   null           — parsed fine; `headers`/`rows` are populated
 *
 * These are kept as distinct outcomes rather than one generic failure
 * because AGENTS.md is explicit that an unparseable file, a file with no
 * rows, and a file whose columns can't be mapped are three different honest
 * messages, not one swallowed error.
 */
export function parseCsvText(text) {
  if (typeof text !== "string") {
    return { headers: [], rows: [], error: "unparseable" };
  }
  const clean = stripBom(text);
  // A null byte never appears in a legitimate CSV export; it's the cheapest
  // signal that this is binary content (an .xlsx renamed to .csv, an image,
  // etc.) rather than text Papa should be trusted to tokenise.
  if (clean.includes("\u0000")) {
    return { headers: [], rows: [], error: "unparseable" };
  }
  if (!clean.trim()) {
    return { headers: [], rows: [], error: "empty_file" };
  }

  // Papa handles quoted commas, CRLF vs LF, and stray whitespace-only lines
  // (skipEmptyLines: "greedy") natively — this is deliberately not
  // hand-rolled.
  const result = Papa.parse(clean, { skipEmptyLines: "greedy" });
  const data = Array.isArray(result?.data) ? result.data : [];
  if (!data.length) return { headers: [], rows: [], error: "empty_file" };

  const [headers, ...rows] = data;
  if (!rows.length) return { headers, rows: [], error: "headers_only" };
  return { headers, rows, error: null };
}

// ─────────────────────────────────────────────────────────────────────────
// Column mapping
// ─────────────────────────────────────────────────────────────────────────

// The three slots the "Continue (n/3)" counter tracks. `amount` is satisfied
// by mapping EITHER a single amount column OR a debit column — banks
// disagree about which shape they export, and both are first-class here
// rather than debit/credit being a lesser fallback.
export function mappingProgress(mapping) {
  const m = mapping || {};
  const hasDate = m.date !== null && m.date !== undefined;
  const hasDescription = m.description !== null && m.description !== undefined;
  const hasAmount =
    (m.amount !== null && m.amount !== undefined) ||
    (m.debit !== null && m.debit !== undefined);
  const satisfied = [hasDate, hasDescription, hasAmount].filter(Boolean).length;
  return { satisfied, required: 3, complete: satisfied === 3 };
}

const HEADER_HINTS = {
  date: ["date", "posted", "posting date", "transaction date"],
  description: ["description", "memo", "payee", "merchant", "details", "narrative", "transaction"],
  amount: ["amount", "value"],
  debit: ["debit", "withdrawal", "money out", "out", "debit amount"],
  credit: ["credit", "deposit", "money in", "in", "credit amount"],
  category: ["category", "type"],
};

/**
 * Best-effort starting point for the mapping screen — never trusted as
 * final. The UI still requires the user to see and confirm every mapped
 * column before Continue enables, exactly as the required-field counter
 * above enforces.
 */
export function guessMapping(headers) {
  const mapping = {
    date: null, description: null, amount: null,
    debit: null, credit: null, category: null,
  };
  const list = Array.isArray(headers) ? headers : [];
  const used = new Set();
  for (const field of Object.keys(HEADER_HINTS)) {
    const hints = HEADER_HINTS[field];
    const idx = list.findIndex(
      (h, i) => !used.has(i) && hints.includes(String(h ?? "").trim().toLowerCase()),
    );
    if (idx !== -1) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  // amount and debit/credit are mutually exclusive amount SOURCES — if the
  // header hints matched both (a file that happens to have columns named
  // both "Amount" and "Debit"), prefer the single amount column and drop the
  // split pair, rather than asking buildRowPreview to choose between them.
  if (mapping.amount !== null && (mapping.debit !== null || mapping.credit !== null)) {
    mapping.debit = null;
    mapping.credit = null;
  }
  return mapping;
}

// ─────────────────────────────────────────────────────────────────────────
// Amount parsing
// ─────────────────────────────────────────────────────────────────────────

/**
 * "$1,234.56", "(125.50)", "-45", "1.234,56", "" -> number | null.
 * Returns null for blank or genuinely unparseable input — never NaN, and
 * never a silently wrong number.
 */
export function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let negative = false;
  // Accounting parens: (125.50) = -125.50.
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // Trailing minus, some exports write "125.50-".
  if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1).trim();
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1).trim();
  } else if (/^\+/.test(s)) {
    s = s.slice(1).trim();
  }

  // Strip currency symbols, currency codes, and any other stray letters —
  // keep only digits and the two possible separators.
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator appears LAST is the decimal point.
    s = lastDot > lastComma
      ? s.replace(/,/g, "")
      : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    // Only commas. "1,234" (thousands) vs "12,50" (decimal, two-digit cents)
    // read differently — a lone comma followed by exactly two digits with no
    // other commas is read as a decimal point; anything else is thousands
    // separators.
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length === 2
      ? parts.join(".")
      : parts.join("");
  }
  // A lone "." or nothing but digits needs no rewriting.

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Sample amount-column values -> a DEFAULT SELECTION for the sign-convention
 * radio, never an applied decision. A spend-heavy account has more outflows
 * than inflows, so more negatives suggests "negative = expense" — but this
 * is only ever a pre-selected default; buildImportPreview always requires an
 * explicit signMode from the caller and never invents one.
 */
export function detectSignConvention(samples) {
  let negativeCount = 0, positiveCount = 0, zeroCount = 0, invalidCount = 0;
  for (const raw of Array.isArray(samples) ? samples : []) {
    const n = parseAmount(raw);
    if (n === null) invalidCount++;
    else if (n < 0) negativeCount++;
    else if (n > 0) positiveCount++;
    else zeroCount++;
  }
  const guess = negativeCount + positiveCount === 0
    ? null
    : negativeCount >= positiveCount ? "negative_is_expense" : "positive_is_expense";
  return { guess, negativeCount, positiveCount, zeroCount, invalidCount };
}

// ─────────────────────────────────────────────────────────────────────────
// Date format detection — refuse rather than guess on genuine ambiguity
// ─────────────────────────────────────────────────────────────────────────

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const NUMERIC_RE = /^(\d{1,4})([/\-.])(\d{1,2})\2(\d{1,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Sample raw date strings from the mapped column -> a format descriptor.
 *
 *   { status: "detected", kind, ... }     — safe to parse
 *   { status: "ambiguous", reason, ... }  — day-first vs month-first cannot
 *                                           be told apart from these values;
 *                                           the caller must ask the user
 *   { status: "unrecognised", reason }    — doesn't look like a date at all
 *
 * This never returns a guess for the ambiguous case. dd/mm and mm/dd are
 * genuinely indistinguishable when every sample value is 12 or below in both
 * positions, and coin-flipping that turns half of every such file's rows
 * into a different day (or, past the 12th, a crash) with nothing telling the
 * contractor it happened.
 */
export function detectDateFormat(samples) {
  const values = (Array.isArray(samples) ? samples : [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);

  if (!values.length) {
    return { status: "unrecognised", reason: "No date values to inspect." };
  }

  // Detection runs on whichever values look date-shaped at all, not on
  // literally every sample. A single garbled cell (a typo, an "N/A", a row
  // that shouldn't have made it into the export) must not block detecting
  // the format the other few thousand rows clearly share — that garbled cell
  // still fails, on its own, as that ONE row's error once parseDateWithFormat
  // is run against the confirmed format. What it must NOT do is make the
  // whole column look unrecognisable and block every other row too.
  const isoMatches = values.filter((v) => ISO_RE.test(v));
  const numericMatches = values.filter((v) => !ISO_RE.test(v) && NUMERIC_RE.test(v));

  if (isoMatches.length && numericMatches.length) {
    return {
      status: "unrecognised",
      reason: "Some sample values look like ISO dates (yyyy-mm-dd) and others look like a different shape — not one consistent column.",
    };
  }

  if (isoMatches.length) {
    const hasTime = isoMatches.some((v) => /[ T]\d{1,2}:\d{2}/.test(v));
    return { status: "detected", kind: "iso", hasTime };
  }

  if (!numericMatches.length) {
    return {
      status: "unrecognised",
      reason: "None of the sample values look like a date (expected ISO yyyy-mm-dd, or a numeric date separated by / - or .).",
    };
  }

  const parsed = numericMatches.map((v) => {
    const m = v.match(NUMERIC_RE);
    return {
      raw: v,
      aStr: m[1], cStr: m[4],
      a: Number(m[1]), b: Number(m[3]), c: Number(m[4]),
      sep: m[2],
      hasTime: Boolean(m[5]),
    };
  });

  // "2024/01/15" — first group is the 4-digit year. Unambiguous: banks that
  // write the year first always write it as year-month-day.
  if (parsed.every((p) => p.aStr.length === 4)) {
    const hasTime = parsed.some((p) => p.hasTime);
    return { status: "detected", kind: "ymd", separator: parsed[0].sep, hasTime };
  }

  const yearLast4 = parsed.every((p) => p.cStr.length === 4);
  const yearLast2 = parsed.every((p) => p.cStr.length === 2);
  if (!yearLast4 && !yearLast2) {
    return {
      status: "unrecognised",
      reason: "The sample values don't share one consistent shape — some look year-first, some don't.",
    };
  }

  // Disambiguate month/day order: a value over 12 in either position pins
  // which one is the day, and every sample has to agree.
  let dayFirst = null;
  for (const p of parsed) {
    const aOver = p.a > 12;
    const bOver = p.b > 12;
    if (aOver && bOver) {
      return {
        status: "unrecognised",
        reason: `"${p.raw}" has neither number in the 1–12 range — not a valid month/day pair.`,
      };
    }
    if (aOver) {
      if (dayFirst === false) {
        return {
          status: "unrecognised",
          reason: "Sample rows disagree about which column is the day — not one consistent format.",
        };
      }
      dayFirst = true;
    } else if (bOver) {
      if (dayFirst === true) {
        return {
          status: "unrecognised",
          reason: "Sample rows disagree about which column is the day — not one consistent format.",
        };
      }
      dayFirst = false;
    }
  }

  const hasTime = parsed.some((p) => p.hasTime);
  const separator = parsed[0].sep;
  const twoDigitYear = yearLast2;

  if (dayFirst === null) {
    // Every sample has both positions <= 12. Genuinely ambiguous — refuse.
    return {
      status: "ambiguous",
      separator,
      hasTime,
      twoDigitYear,
      reason:
        "Every sample date has both numbers at 12 or below, so day-first (DD/MM) and month-first (MM/DD) both fit. Choose which this file uses.",
    };
  }

  return { status: "detected", kind: dayFirst ? "dmy" : "mdy", separator, hasTime, twoDigitYear };
}

function finiteDate(year, month, day, hh = 0, mm = 0, ss = 0) {
  if (![year, month, day, hh, mm, ss].every(Number.isFinite)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
  // Date.UTC rolls Feb 30 into March 2 rather than refusing it — this guard
  // catches the roll-over instead of silently accepting the wrong day.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/**
 * One raw date string + a CONFIRMED descriptor from detectDateFormat (with
 * `dayFirst` filled in by the user if the descriptor was "ambiguous") ->
 * Date | null. Never guesses; a descriptor still carrying
 * status !== "detected" and no explicit dayFirst returns null rather than
 * picking a side.
 */
export function parseDateWithFormat(raw, descriptor) {
  const v = String(raw ?? "").trim();
  if (!v || !descriptor || typeof descriptor !== "object") return null;

  if (descriptor.kind === "iso") {
    const m = v.match(ISO_RE);
    if (!m) return null;
    return finiteDate(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  }

  const m = v.match(NUMERIC_RE);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]), c = Number(m[4]);
  const hh = Number(m[5] || 0), mm = Number(m[6] || 0), ss = Number(m[7] || 0);

  if (descriptor.kind === "ymd") {
    return finiteDate(a, b, c, hh, mm, ss);
  }

  const dayFirst =
    descriptor.kind === "dmy" ? true :
    descriptor.kind === "mdy" ? false :
    // An "ambiguous" descriptor the caller resolved by attaching dayFirst.
    typeof descriptor.dayFirst === "boolean" ? descriptor.dayFirst : null;
  if (dayFirst === null) return null; // still unresolved — refuse, don't guess

  let year = c;
  if (String(m[4]).length === 2) {
    // No bank export in this product's market realistically predates 1950;
    // this is the standard two-digit-year pivot, not a real ambiguity.
    year = year < 50 ? 2000 + year : 1900 + year;
  }
  const day = dayFirst ? a : b;
  const month = dayFirst ? b : a;
  return finiteDate(year, month, day, hh, mm, ss);
}

// ─────────────────────────────────────────────────────────────────────────
// Duplicate detection — source-blind by construction
// ─────────────────────────────────────────────────────────────────────────

/**
 * Lowercased, accent-stripped, punctuation-collapsed. "WALMART #4521" and
 * "Walmart   #4521" land on the same key; two genuinely different merchants
 * still don't collide because the merchant name itself is still in the key.
 */
export function normaliseDescription(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * date + amount + normalised description -> a stable string key, scoped to
 * nothing here — the caller scopes it to a company by only ever comparing
 * keys drawn from that company's own rows.
 *
 * Deliberately does NOT include importSource, importBatchId, or anything
 * else naming where a row came from. That omission is the whole point: it's
 * what makes a CSV-imported row and a later Plaid-delivered row for the same
 * transaction produce the SAME key, so the second one is recognised as a
 * duplicate instead of a new expense.
 */
export function naturalKey({ date, amount, description }) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  const iso = d ? d.toISOString().slice(0, 10) : "invalid-date";
  const cents = Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : "invalid-amount";
  return `${iso}|${cents}|${normaliseDescription(description)}`;
}

/**
 * Flags each "ok" preview row as a duplicate of an EXISTING company expense
 * (any source) or of an earlier row in the same file. `existingExpenses` is
 * whatever the caller already fetched from the database — this function
 * never queries anything.
 */
export function detectDuplicates(previewRows, existingExpenses) {
  const existingKeys = new Map();
  for (const e of Array.isArray(existingExpenses) ? existingExpenses : []) {
    const rawDate = e?.date;
    const d = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
    const key = naturalKey({
      date: d,
      amount: Number(e?.amount),
      description: e?.notes ?? e?.description ?? "",
    });
    if (!existingKeys.has(key)) {
      existingKeys.set(key, { id: e?.id ?? null, source: e?.importSource || "manual" });
    }
  }

  const seenInFile = new Set();
  return previewRows.map((row) => {
    if (row.status !== "ok") return { ...row, duplicate: false, duplicateOf: null };
    const key = naturalKey({ date: row.date, amount: row.amount, description: row.description });
    const existingMatch = existingKeys.get(key);
    const fileMatch = seenInFile.has(key);
    seenInFile.add(key);
    return {
      ...row,
      duplicate: Boolean(existingMatch) || fileMatch,
      duplicateOf: existingMatch ? existingMatch : fileMatch ? { id: null, source: "same-file" } : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Row + file preview pipeline
// ─────────────────────────────────────────────────────────────────────────

/**
 * One raw CSV row -> a classified preview row.
 *
 *   status: "ok"      — a real expense, ready to import
 *   status: "skipped" — parsed fine but isn't an expense (a credit/deposit
 *                        row under the confirmed sign convention) — this is
 *                        the NORMAL shape of a bank statement, not a mistake
 *   status: "error"   — couldn't be read as an expense row at all
 */
export function buildRowPreview({ rawRow, mapping, dateFormat, signMode, defaultCategory }) {
  const get = (idx) => (idx === null || idx === undefined ? "" : String(rawRow?.[idx] ?? "").trim());

  const dateRaw = get(mapping?.date);
  const description = get(mapping?.description);
  const category =
    mapping?.category !== null && mapping?.category !== undefined
      ? get(mapping.category) || defaultCategory || "Imported"
      : defaultCategory || "Imported";

  const errors = [];

  const date = dateRaw ? parseDateWithFormat(dateRaw, dateFormat) : null;
  if (!dateRaw) errors.push("Missing date");
  else if (!date) errors.push(`Unrecognised date "${dateRaw}"`);

  if (!description) errors.push("Missing description");

  let amount = null;
  let isCredit = false;

  if (mapping?.amount !== null && mapping?.amount !== undefined) {
    const raw = get(mapping.amount);
    if (!raw) {
      errors.push("Missing amount");
    } else {
      const parsed = parseAmount(raw);
      if (parsed === null) {
        errors.push(`Unrecognised amount "${raw}"`);
      } else if (parsed === 0) {
        errors.push("Zero amount");
      } else {
        const rowIsExpense = signMode === "negative_is_expense" ? parsed < 0 : parsed > 0;
        if (rowIsExpense) amount = Math.abs(parsed);
        else isCredit = true;
      }
    }
  } else if (mapping?.debit !== null && mapping?.debit !== undefined) {
    const debitRaw = get(mapping.debit);
    const creditRaw = mapping?.credit !== null && mapping?.credit !== undefined ? get(mapping.credit) : "";
    const debit = debitRaw ? parseAmount(debitRaw) : null;
    const credit = creditRaw ? parseAmount(creditRaw) : null;
    if (debit !== null && debit !== 0) {
      amount = Math.abs(debit);
    } else if (credit !== null && credit !== 0) {
      isCredit = true;
    } else {
      errors.push("No debit or credit amount on this row");
    }
  } else {
    errors.push("No amount column mapped");
  }

  if (errors.length) {
    return { raw: rawRow, date, description, category, amount: null, status: "error", errors };
  }
  if (isCredit) {
    return { raw: rawRow, date, description, category, amount: null, status: "skipped", errors: [] };
  }
  return { raw: rawRow, date, description, category, amount, status: "ok", errors: [] };
}

/**
 * Raw parsed CSV (headers + data rows) + a confirmed mapping/format/sign
 * decision + the company's existing expenses -> the full review list the
 * UI renders, with a summary the empty/error states are built from.
 *
 * This is the one function the API preview route calls. It has no idea
 * where `rows` or `existingExpenses` came from — a text file on disk, a
 * database query, a hand-built array in a test — which is what makes it
 * possible to execute directly against hostile input.
 */
export function buildImportPreview({ headers, rows, mapping, dateFormat, signMode, defaultCategory, existingExpenses }) {
  const allRows = Array.isArray(rows) ? rows : [];
  const truncated = allRows.length > MAX_ROWS;
  const working = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

  // Papa's skipEmptyLines already drops fully-blank lines, but a trailing
  // row of bare commas ("„,,,") survives that as a row of empty strings —
  // it isn't data and shouldn't be counted as one.
  const nonBlank = working.filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""),
  );

  let previewRows = nonBlank.map((raw) =>
    buildRowPreview({ rawRow: raw, mapping, dateFormat, signMode, defaultCategory }),
  );
  previewRows = detectDuplicates(previewRows, existingExpenses);

  const summary = {
    totalDataRows: nonBlank.length,
    ok: previewRows.filter((r) => r.status === "ok" && !r.duplicate).length,
    duplicates: previewRows.filter((r) => r.status === "ok" && r.duplicate).length,
    errors: previewRows.filter((r) => r.status === "error").length,
    skipped: previewRows.filter((r) => r.status === "skipped").length,
    truncated,
  };

  return { headers: Array.isArray(headers) ? headers : [], rows: previewRows, summary };
}
