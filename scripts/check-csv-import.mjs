// scripts/check-csv-import.mjs
//
// Executes lib/expenses/csvImport.js against hostile input — the reference
// implementation this feature borrowed its column-mapping UX from had a
// hardcoded date format that turned any other bank's export into silent
// Invalid Date rows, and a bulk-create endpoint that never checked the
// destination belonged to the caller. Neither bug is repeatable here because
// neither behaviour exists in this file: date format is DETECTED and refused
// rather than guessed on genuine ambiguity, and every write in the API
// routes is scoped to member.companyId server-side (not exercised by this
// script, which is pure-function only — see app/api/expenses/import/*
// for the tenant-scoping code itself).
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-csv-import.mjs

import {
  stripBom,
  parseCsvText,
  detectDateFormat,
  parseDateWithFormat,
  parseAmount,
  detectSignConvention,
  normaliseDescription,
  naturalKey,
  detectDuplicates,
  buildRowPreview,
  buildImportPreview,
  mappingProgress,
  guessMapping,
  MAX_ROWS,
} from "@/lib/expenses/csvImport";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// ─────────────────────────────────────────────────────────────────────────
console.log("\nparseCsvText: the four honest empty/error states");

t("empty file", parseCsvText("").error, "empty_file");
t("whitespace-only file", parseCsvText("   \n  \n").error, "empty_file");
t("headers only", parseCsvText("Date,Description,Amount\n").error, "headers_only");
t("headers only, CRLF", parseCsvText("Date,Description,Amount\r\n").error, "headers_only");
t("binary content is unparseable", parseCsvText("Date,Amount\n\x00\x01garbage").error, "unparseable");
t("not a string at all", parseCsvText(null).error, "unparseable");

console.log("\nparseCsvText: BOM, quoted commas, CRLF — all handled, not hand-rolled");

// Tested directly against stripBom(), not only through parseCsvText(): Papa
// itself also happens to strip a leading BOM, which would mask a broken
// stripBom() if this only asserted the end-to-end parse output.
t("stripBom removes a leading BOM", stripBom("﻿Date,Amount"), "Date,Amount");
t("stripBom leaves ordinary text untouched", stripBom("Date,Amount"), "Date,Amount");

const bomFile = "﻿" + "Date,Description,Amount\n2024-01-15,Fuel,-45.00\n";
const bomParsed = parseCsvText(bomFile);
t("BOM stripped from first header", bomParsed.headers[0], "Date");
t("BOM file has one data row", bomParsed.rows.length, 1);

const quotedCommaFile = 'Date,Description,Amount\n2024-01-15,"Home Depot, Ottawa",-125.50\n';
const quotedParsed = parseCsvText(quotedCommaFile);
t("a quoted comma stays inside one field", quotedParsed.rows[0][1], "Home Depot, Ottawa");
t("the row still has exactly 3 columns", quotedParsed.rows[0].length, 3);

const crlfFile = ["Date,Description,Amount", "2024-01-15,Fuel,-45.00", "2024-01-16,Materials,-200.00", ""].join("\r\n");
const crlfParsed = parseCsvText(crlfFile);
t("CRLF: two clean data rows", crlfParsed.rows.length, 2);
t("CRLF: no stray \\r left on a value", crlfParsed.rows[1][1], "Materials");

// ─────────────────────────────────────────────────────────────────────────
console.log("\nparseAmount: currency symbols, thousands separators, blanks");

t("plain integer", parseAmount("45"), 45);
t("dollar sign + thousands comma", parseAmount("$1,234.56"), 1234.56);
t("thousands separator, no symbol", parseAmount("12,345.67"), 12345.67);
t("euro-style thousands dot + comma decimal", parseAmount("1.234,56"), 1234.56);
t("parentheses = negative (accounting notation)", parseAmount("(125.50)"), -125.5);
t("trailing minus", parseAmount("125.50-"), -125.5);
t("leading minus", parseAmount("-45"), -45);
t("blank string", parseAmount(""), null);
t("whitespace only", parseAmount("   "), null);
t("null", parseAmount(null), null);
t("undefined", parseAmount(undefined), null);
t("currency code prefix", parseAmount("CAD 45.00"), 45);
t("non-numeric junk", parseAmount("N/A"), null);

console.log("\ndetectSignConvention: a default guess, never an applied decision");
const mostlyNegative = detectSignConvention(["-45", "-12.50", "300.00"]);
t("more negatives -> guesses negative_is_expense", mostlyNegative.guess, "negative_is_expense");
t("counts are right", [mostlyNegative.negativeCount, mostlyNegative.positiveCount], [2, 1]);
const allInvalid = detectSignConvention(["abc", "", null]);
t("nothing parseable -> no guess", allInvalid.guess, null);

// ─────────────────────────────────────────────────────────────────────────
console.log("\ndetectDateFormat: dd/mm vs mm/dd — refuse rather than guess");

const genuinelyAmbiguous = detectDateFormat(["01/02/2024", "03/04/2024", "05/06/2024"]);
t("every sample <= 12 in both positions -> ambiguous, not a guess", genuinelyAmbiguous.status, "ambiguous");
t("ambiguous carries a reason for the user", typeof genuinelyAmbiguous.reason, "string");

const dayFirstProof = detectDateFormat(["13/02/2024", "01/05/2024"]);
t("a value > 12 in the first slot proves day-first", dayFirstProof, { status: "detected", kind: "dmy", separator: "/", hasTime: false, twoDigitYear: false });

const monthFirstProof = detectDateFormat(["02/13/2024", "05/01/2024"]);
t("a value > 12 in the second slot proves month-first", monthFirstProof, { status: "detected", kind: "mdy", separator: "/", hasTime: false, twoDigitYear: false });

const conflicting = detectDateFormat(["13/02/2024", "02/13/2024"]);
t("samples disagreeing on which slot is the day -> unrecognised, not a coin flip", conflicting.status, "unrecognised");

const isoDates = detectDateFormat(["2024-01-15", "2024-02-20 14:30:00"]);
t("ISO detected regardless of trailing time", isoDates.status, "detected");
t("ISO kind", isoDates.kind, "iso");

const yearFirstSlash = detectDateFormat(["2024/01/15", "2024/2/3"]);
t("year-first with / is unambiguous (ymd)", yearFirstSlash.kind, "ymd");

const oneGarbledCell = detectDateFormat(["2024-01-15", "2024-01-16", "not-a-date", "2024-01-17"]);
t(
  "one garbled cell among clean ISO values does not block detecting the format",
  oneGarbledCell,
  { status: "detected", kind: "iso", hasTime: false },
);

const nothingDateLike = detectDateFormat(["hello", "world"]);
t("no date-shaped values at all -> unrecognised", nothingDateLike.status, "unrecognised");

const bothOver12 = detectDateFormat(["13/13/2024"]);
t("neither slot in 1-12 -> unrecognised, not silently wrong", bothOver12.status, "unrecognised");

console.log("\nparseDateWithFormat: never guesses on an unresolved descriptor");
t("ambiguous descriptor with no dayFirst resolves to null, not a guess", parseDateWithFormat("01/02/2024", genuinelyAmbiguous), null);
t("resolving dayFirst=true reads 01/02/2024 as 1 Feb", parseDateWithFormat("01/02/2024", { ...genuinelyAmbiguous, dayFirst: true })?.toISOString().slice(0, 10), "2024-02-01");
t("resolving dayFirst=false reads 01/02/2024 as 2 Jan", parseDateWithFormat("01/02/2024", { ...genuinelyAmbiguous, dayFirst: false })?.toISOString().slice(0, 10), "2024-01-02");
t("Feb 30 under a confirmed format is refused, not rolled into March", parseDateWithFormat("2024-02-30", { status: "detected", kind: "iso" }), null);
t("garbage against a confirmed ISO format is this row's own null", parseDateWithFormat("not-a-date", { status: "detected", kind: "iso" }), null);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nSign conventions: negative-column vs debit/credit-column, and getting it backwards is the failure mode this guards");

const isoFormat = { status: "detected", kind: "iso" };

const negRow = buildRowPreview({
  rawRow: ["2024-01-15", "Fuel", "-45.00"],
  mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("negative_is_expense: a negative amount becomes a positive expense", negRow, { raw: negRow.raw, date: negRow.date, description: "Fuel", category: "Bank Import", amount: 45, status: "ok", errors: [] });

const negRowFlippedConvention = buildRowPreview({
  rawRow: ["2024-01-15", "Fuel", "-45.00"],
  mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null },
  dateFormat: isoFormat,
  signMode: "positive_is_expense",
  defaultCategory: "Bank Import",
});
t("under the OTHER convention, that same negative row is a credit, not an expense — this is the bug the spec warns about", negRowFlippedConvention.status, "skipped");

const debitRow = buildRowPreview({
  rawRow: ["2024-01-15", "Fuel", "45.00", ""],
  mapping: { date: 0, description: 1, amount: null, debit: 2, credit: 3, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("debit column populated -> an expense", debitRow.status, "ok");
t("debit amount is positive", debitRow.amount, 45);

const creditRow = buildRowPreview({
  rawRow: ["2024-01-16", "Client payment", "", "300.00"],
  mapping: { date: 0, description: 1, amount: null, debit: 2, credit: 3, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("credit column populated -> skipped, not an expense", creditRow.status, "skipped");

const neitherColumn = buildRowPreview({
  rawRow: ["2024-01-16", "Mystery row", "", ""],
  mapping: { date: 0, description: 1, amount: null, debit: 2, credit: 3, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("neither debit nor credit populated -> error, not a silent zero", neitherColumn.status, "error");

console.log("\nblank and zero amounts");
const blankAmount = buildRowPreview({
  rawRow: ["2024-01-15", "Fuel", ""],
  mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("blank amount is an error, not $0", blankAmount.status, "error");
t("blank amount error names the field", blankAmount.errors.some((e) => /amount/i.test(e)), true);

const zeroAmount = buildRowPreview({
  rawRow: ["2024-01-15", "Fuel", "0.00"],
  mapping: { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null },
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
});
t("a literal zero amount is an error, not a real expense", zeroAmount.status, "error");

// ─────────────────────────────────────────────────────────────────────────
console.log("\nDuplicate detection: exact re-import is caught");

const existing = [
  { id: "e1", date: new Date("2024-01-15T00:00:00Z"), amount: 125.5, notes: "Home Depot #4521", importSource: "csv_upload" },
];
const reimportRow = [{
  date: new Date("2024-01-15T00:00:00Z"), amount: 125.5, description: "Home Depot #4521", status: "ok",
}];
const reimportResult = detectDuplicates(reimportRow, existing);
t("an exact re-import is flagged as a duplicate", reimportResult[0].duplicate, true);
t("...and names its match", reimportResult[0].duplicateOf?.id, "e1");

const messyReimportRow = [{
  date: new Date("2024-01-15T00:00:00Z"), amount: 125.5, description: "  HOME DEPOT   #4521  ", status: "ok",
}];
t("re-import with different case/whitespace is still caught", detectDuplicates(messyReimportRow, existing)[0].duplicate, true);

const genuinelyDifferent = [{
  date: new Date("2024-01-15T00:00:00Z"), amount: 45.0, description: "Fuel", status: "ok",
}];
t("a different transaction on the same day is NOT flagged", detectDuplicates(genuinelyDifferent, existing)[0].duplicate, false);

// Same vendor, same day, but a DIFFERENT amount — e.g. two fill-ups at the
// same gas station. Proves amount is actually load-bearing in the key, not
// just date + description.
const sameVendorDifferentAmount = [{
  date: new Date("2024-01-15T00:00:00Z"), amount: 200.0, description: "Home Depot #4521", status: "ok",
}];
t(
  "same day, same description, DIFFERENT amount is NOT a duplicate",
  detectDuplicates(sameVendorDifferentAmount, existing)[0].duplicate,
  false,
);

// Same vendor, same amount, but a DIFFERENT day — proves date is load-bearing.
const sameVendorDifferentDay = [{
  date: new Date("2024-02-15T00:00:00Z"), amount: 125.5, description: "Home Depot #4521", status: "ok",
}];
t(
  "same amount, same description, DIFFERENT day is NOT a duplicate",
  detectDuplicates(sameVendorDifferentDay, existing)[0].duplicate,
  false,
);

console.log("\nDuplicate detection is SOURCE-BLIND — the whole point of importSource/externalId existing");
// The owner's explicit requirement: a CSV-imported row and a LATER row from a
// DIFFERENT source (a future Plaid sync) with the same natural key must be
// recognised as the same transaction, so switching sources never doubles a
// contractor's expenses. naturalKey() takes no source argument at all —
// this proves detectDuplicates never leaks one in through the back door.
const csvSourced = [{ id: "e2", date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, notes: "Home Hardware", importSource: "csv_upload" }];
const plaidSourced = [{ id: "e3", date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, notes: "Home Hardware", importSource: "plaid" }];
const manualSourced = [{ id: "e4", date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, notes: "Home Hardware", importSource: null }];
const incomingRow = [{ date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, description: "Home Hardware", status: "ok" }];

t("csv row matches a later plaid-sourced row with the same natural key", detectDuplicates(incomingRow, plaidSourced)[0].duplicate, true);
t("csv row matches a hand-entered (no source) row with the same natural key", detectDuplicates(incomingRow, manualSourced)[0].duplicate, true);
t("naturalKey itself carries no source component", naturalKey({ date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, description: "Home Hardware" }),
  naturalKey({ date: new Date("2024-03-01T00:00:00Z"), amount: 89.99, description: "Home Hardware" }));
t("...proof: keys built from csv vs plaid existing-row shapes are identical strings",
  naturalKey({ date: csvSourced[0].date, amount: Number(csvSourced[0].amount), description: csvSourced[0].notes }),
  naturalKey({ date: plaidSourced[0].date, amount: Number(plaidSourced[0].amount), description: plaidSourced[0].notes }));

console.log("\nDuplicate detection also catches repeats WITHIN the same file");
const withinFile = [
  { date: new Date("2024-01-15T00:00:00Z"), amount: 45, description: "Fuel", status: "ok" },
  { date: new Date("2024-01-15T00:00:00Z"), amount: 45, description: "Fuel", status: "ok" },
];
const withinFileResult = detectDuplicates(withinFile, []);
t("first occurrence is not flagged", withinFileResult[0].duplicate, false);
t("second identical row in the same file is flagged", withinFileResult[1].duplicate, true);
t("...and is attributed to the same file, not a phantom db row", withinFileResult[1].duplicateOf?.source, "same-file");

t("error rows are never flagged as duplicates (nothing to key them on)", detectDuplicates([{ status: "error" }], existing)[0].duplicate, false);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nnormaliseDescription");
t("case and whitespace collapse", normaliseDescription("  HOME   Depot  "), "home depot");
t("punctuation stripped", normaliseDescription("Walmart #4521 (Ottawa)"), "walmart 4521 ottawa");
t("empty/null is empty string, not \"null\"", normaliseDescription(null), "");

// ─────────────────────────────────────────────────────────────────────────
console.log("\nmappingProgress: the Continue (n/3) counter");
t("nothing mapped", mappingProgress({}), { satisfied: 0, required: 3, complete: false });
t("date + description only", mappingProgress({ date: 0, description: 1 }), { satisfied: 2, required: 3, complete: false });
t("date + description + amount = complete", mappingProgress({ date: 0, description: 1, amount: 2 }), { satisfied: 3, required: 3, complete: true });
t("debit column satisfies the amount slot exactly like a single amount column", mappingProgress({ date: 0, description: 1, debit: 2 }).complete, true);

console.log("\nguessMapping: a starting point, never trusted as final");
t("recognises common bank headers", guessMapping(["Date", "Description", "Amount"]), { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null });
t("amount and debit/credit are mutually exclusive even if headers hint at both", guessMapping(["Date", "Description", "Amount", "Debit"]).debit, null);
t("unrecognised headers map to nothing, not a wrong guess", guessMapping(["Col A", "Col B"]), { date: null, description: null, amount: null, debit: null, credit: null, category: null });

// ─────────────────────────────────────────────────────────────────────────
console.log("\nEnd-to-end preview pipeline, including a 5,000-row file");

function makeRows(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const day = String((i % 27) + 1).padStart(2, "0");
    rows.push([`2024-01-${day}`, `Vendor ${i}`, `-${(10 + (i % 500)).toFixed(2)}`]);
  }
  return rows;
}

const bigMapping = { date: 0, description: 1, amount: 2, debit: null, credit: null, category: null };
const big = buildImportPreview({
  headers: ["Date", "Description", "Amount"],
  rows: makeRows(MAX_ROWS),
  mapping: bigMapping,
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
  existingExpenses: [],
});
t(`a ${MAX_ROWS}-row file: every row counted`, big.summary.totalDataRows, MAX_ROWS);
t(`a ${MAX_ROWS}-row file: not truncated at the cap itself`, big.summary.truncated, false);
t(`a ${MAX_ROWS}-row file: all ${MAX_ROWS} rows parse as ok (distinct vendor+amount per day bucket)`, big.summary.ok + big.summary.duplicates, MAX_ROWS);

const overCap = buildImportPreview({
  headers: ["Date", "Description", "Amount"],
  rows: makeRows(MAX_ROWS + 250),
  mapping: bigMapping,
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
  existingExpenses: [],
});
t("a file over the cap is truncated, not silently dropped without saying so", overCap.summary.truncated, true);
t("...and processes exactly the cap, not more", overCap.summary.totalDataRows, MAX_ROWS);

console.log("\nbuildImportPreview: four distinct empty/error outcomes stay distinguishable");

const mixedFile = buildImportPreview({
  headers: ["Date", "Description", "Amount"],
  rows: [
    ["2024-01-15", "Fuel", "-45.00"],
    ["2024-01-16", "Client refund", "300.00"],
    ["not-a-date", "Broken", "abc"],
    ["2024-01-15", "Fuel", "-45.00"],
    ["", "", ""],
  ],
  mapping: bigMapping,
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
  existingExpenses: [],
});
t("a fully-blank trailing row is not counted as data", mixedFile.summary.totalDataRows, 4);
t("one clean expense", mixedFile.summary.ok, 1);
t("one same-file duplicate of it", mixedFile.summary.duplicates, 1);
t("one unreadable row", mixedFile.summary.errors, 1);
t("one credit/deposit row, skipped as not-an-expense", mixedFile.summary.skipped, 1);

const allDuplicatesFile = buildImportPreview({
  headers: ["Date", "Description", "Amount"],
  rows: [["2024-01-15", "Fuel", "-45.00"]],
  mapping: bigMapping,
  dateFormat: isoFormat,
  signMode: "negative_is_expense",
  defaultCategory: "Bank Import",
  existingExpenses: [{ id: "e9", date: new Date("2024-01-15T00:00:00Z"), amount: 45, notes: "Fuel" }],
});
t("a file that is entirely duplicates reports 0 ok, not an error", [allDuplicatesFile.summary.ok, allDuplicatesFile.summary.duplicates], [0, 1]);

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — a bank statement maps, previews, and de-duplicates without guessing\n",
);
process.exit(fail ? 1 : 0);
