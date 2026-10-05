// scripts/check-google-ads.mjs
//
//   npm run check:google-ads
//
// Google Ads spend, executed rather than read: real-shaped report exports
// (title rows, a date-range line, totals rows, comma decimals, UTF-16 tab
// "Excel CSV", CAD and USD accounts) through lib/googleAds/reportParse.js,
// then the write plan in lib/googleAds/spendPlan.js against existing rows —
// re-import idempotency, never touching a manual or Meta row, duplicates
// flagged and skipped. Nothing here reaches a network or a database.

import {
  decodeReportBytes,
  csvTextToMatrix,
  xlsxCell,
  parseGoogleAdsReport,
  parseLocaleNumber,
  detectDecimalSeparator,
  parseDayColumn,
  parseReportRange,
  parseWordDate,
} from "@/lib/googleAds/reportParse";
import { buildGoogleSpendPlan, planWindow } from "@/lib/googleAds/spendPlan";
import { isSyncedSource } from "@/lib/googleAds/sources";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : (fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`), console.log(`  ✗ ${label}`));

const parseText = (text, opts) => parseGoogleAdsReport(csvTextToMatrix(text), opts);

// ── Fixtures: what Google Ads actually hands a contractor ──────────────────

// English UI, Campaigns view segmented by Day, plain CSV, CAD account.
const EN_DAILY_CAD = `Campaign report
"September 1, 2026 - September 3, 2026"
Day,Campaign,Campaign ID,Currency code,Cost,Impr.,Clicks,Conversions
2026-09-01,Spring Roofs & Gutters,12345678901,CAD,12.34,"1,234",7,1.00
2026-09-02,Spring Roofs & Gutters,12345678901,CAD,"1,020.50","10,500",88,2.50
2026-09-01,Brand - Search,22222222222,CAD,3.10,40,2,0.00
2026-09-03,Brand - Search,22222222222,CAD,0.00,0,0,0.00
Total: Account,--,--,CAD,"1,035.94","11,774",97,3.50
Total: Search,--,--,CAD,"1,035.94","11,774",97,3.50
Total: Campaigns,--,--,CAD,"1,035.94","11,774",97,3.50
`;

// French UI (Québec), comma decimals, narrow no-break-space thousands,
// semicolon-delimited the way a French Excel re-save writes it.
const FR_DAILY = `Rapport sur les campagnes
"1 sept. 2026 - 2 sept. 2026"
Jour;Campagne;Code de la devise;Coût;Impr.;Clics;Conversions
2026-09-01;Toitures printemps;CAD;12,34;1 234;7;1,00
2026-09-02;Toitures printemps;CAD;1 020,50;10 500;88;2,50
Total : compte;--;CAD;1 032,84;11 734;95;3,50
`;

// German UI, dot thousands + comma decimals, USD account.
const DE_DAILY_USD = `Kampagnenbericht
"1. September 2026 - 2. September 2026"
Tag,Kampagne,Währungscode,Kosten,Impr.,Klicks,Conversions
2026-09-01,Dach Frühling,USD,"1.234,56","12.345",120,"3,00"
2026-09-02,Dach Frühling,USD,"99,90",900,9,"0,50"
Gesamt: Konto,--,USD,"1.334,46","13.245",129,"3,50"
`;

// Per-campaign totals for the whole range — no Day column.
const EN_RANGE = `Campaign report
"September 1, 2026 - September 30, 2026"
Campaign status,Campaign,Budget,Campaign type,Impr.,Interactions,Avg. cost,Cost,Currency code,Conversions,Cost / conv.
Enabled,Spring Roofs & Gutters,50.00,Search,"40,000",900,1.10,990.00,CAD,30.00,33.00
Paused,Old Promo,10.00,Display,0,0,0.00,0.00,CAD,0.00,0.00
Total: Account,--,--,--,"40,000",900,1.10,990.00,CAD,30.00,33.00
`;

// Segmented by device: the same campaign and day on three lines.
const EN_DEVICE = `Campaign report
"September 1, 2026 - September 1, 2026"
Day,Campaign,Device,Currency code,Cost,Impr.,Clicks,Conversions
2026-09-01,Spring Roofs,Mobile phones,CAD,10.00,100,5,1.00
2026-09-01,Spring Roofs,Computers,CAD,4.50,50,2,0.50
2026-09-01,Spring Roofs,Tablets,CAD,0.50,5,0,--
`;

const EN_WEEKLY = `Campaign report
"September 1, 2026 - September 30, 2026"
Week,Campaign,Currency code,Cost
2026-08-31,Spring Roofs,CAD,70.00
`;

const NO_CURRENCY = `Day,Campaign,Cost,Clicks
2026-09-01,Spring Roofs,12.34,7
`;

const AMBIGUOUS = `Day,Campaign,Currency code,Cost
03/04/2026,Spring Roofs,CAD,12.34
04/03/2026,Spring Roofs,CAD,1.00
`;

const SLASHED_DAY_FIRST = `Day,Campaign,Currency code,Cost
13/09/2026,Spring Roofs,CAD,12.34
03/09/2026,Spring Roofs,CAD,1.00
`;

function utf16le(text) {
  const buf = Buffer.alloc(2 + text.length * 2);
  buf[0] = 0xff;
  buf[1] = 0xfe;
  for (let i = 0; i < text.length; i++) buf.writeUInt16LE(text.charCodeAt(i), 2 + i * 2);
  return new Uint8Array(buf);
}

console.log("\n1. Numbers, dates and bytes\n");

ok("en: 1,020.50 → 1020.5", parseLocaleNumber("1,020.50", ".") === 1020.5);
ok("fr: 1 020,50 (NBSP) → 1020.5", parseLocaleNumber("1 020,50", ",") === 1020.5);
ok("de: 1.234,56 → 1234.56", parseLocaleNumber("1.234,56", ",") === 1234.56);
ok("de counts: 12.345 → 12345", parseLocaleNumber("12.345", ",") === 12345);
ok("currency symbol in front: CA$12.34 → 12.34", parseLocaleNumber("CA$12.34", ".") === 12.34);
ok("trailing €: '12,34 €' → 12.34", parseLocaleNumber("12,34 €", ",") === 12.34);
ok("'--' is not reported (null), never 0", parseLocaleNumber("--", ".") === null);
ok("garbage is NaN, not null and not 0", Number.isNaN(parseLocaleNumber("twelve", ".")));
ok("undecided file: '1,234' is an integer with grouping", parseLocaleNumber("1,234", null) === 1234);
ok("undecided file: '12,34' is refused (NaN), not guessed", Number.isNaN(parseLocaleNumber("12,34", null)));
ok("decimal detected from cost column — en", detectDecimalSeparator(["12.34", "1,020.50"]) === ".");
ok("decimal detected from cost column — fr", detectDecimalSeparator(["12,34", "1 020,50"]) === ",");
ok("decimal undecided on integers only", detectDecimalSeparator(["12", "1,234"]) === null);
ok("ISO day", parseWordDate("2026-09-01") === "2026-09-01");
ok("English month words", parseWordDate("September 1, 2026") === "2026-09-01");
ok("French abbreviation 'sept.'", parseWordDate("1 sept. 2026") === "2026-09-01");
ok("German '2. September 2026'", parseWordDate("2. September 2026") === "2026-09-02");
ok("Spanish '1 de septiembre de 2026'", parseWordDate("1 de septiembre de 2026") === "2026-09-01");
ok("French 'juil.' is July, 'juin' is June", parseWordDate("4 juil. 2026") === "2026-07-04" && parseWordDate("4 juin 2026") === "2026-06-04");
ok("31 February is refused", parseWordDate("2026-02-31") === null);
ok("range line parsed", JSON.stringify(parseReportRange([["Campaign report"], ["September 1, 2026 - September 30, 2026"]])) === JSON.stringify({ start: "2026-09-01", end: "2026-09-30" }));
ok("ISO range line parsed (dashes inside dates are not the separator)", parseReportRange([["2026-09-01 - 2026-09-30"]])?.end === "2026-09-30");
ok("slashed dates: ambiguous column refused", parseDayColumn(["03/04/2026", "04/03/2026"]).status === "ambiguous");
ok("slashed dates: a 13 decides day-first", parseDayColumn(["13/09/2026", "03/09/2026"]).days?.[1] === "2026-09-03");
ok("UTF-16LE 'CSV (Excel)' decodes", decodeReportBytes(utf16le("Day\tCampaign\n")).text === "Day\tCampaign\n");
ok("an .xlsx renamed .csv is recognised, not parsed as text", decodeReportBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2])).error === "is_xlsx");
ok("empty bytes → empty_file", decodeReportBytes(new Uint8Array([])).error === "empty_file");
ok("xlsx date cell → its UTC day", xlsxCell(new Date(Date.UTC(2026, 8, 1))) === "2026-09-01");
ok("xlsx number cell stays a number", xlsxCell(12.34) === 12.34);

console.log("\n2. Real-shaped reports\n");

{
  const r = parseText(EN_DAILY_CAD);
  ok("en daily: no error", r.error === null, r.error);
  ok("en daily: title rows skipped, header found", r.granularity === "day");
  ok("en daily: three totals rows skipped, never summed", r.skippedTotals === 3, r.skippedTotals);
  ok("en daily: the all-zero row is skipped as empty", r.skippedEmpty === 1, r.skippedEmpty);
  ok("en daily: three rows", r.rows.length === 3, r.rows.length);
  const big = r.rows.find((x) => x.date === "2026-09-02");
  ok("en daily: '1,020.50' read as 1020.5", big?.amount === 1020.5, big);
  ok("en daily: impressions '10,500' → 10500", big?.impressions === 10500);
  ok("en daily: Google's fractional conversions kept (2.5)", big?.conversions === 2.5);
  ok("en daily: campaign id used in the key", big?.externalKey === "12345678901:2026-09-02", big?.externalKey);
  ok("en daily: currency as reported", big?.currency === "CAD");
  ok("en daily: zero conversions is 0, not null", r.rows.find((x) => x.campaignName === "Brand - Search")?.conversions === 0);
  ok("en daily: nothing on any row is named 'leads'", r.rows.every((x) => !("leads" in x)));
}
{
  const r = parseText(FR_DAILY);
  ok("fr: semicolon file, comma decimals parsed", r.error === null && r.decimal === ",", r);
  ok("fr: '1 020,50' → 1020.5", r.rows.find((x) => x.date === "2026-09-02")?.amount === 1020.5);
  ok("fr: 'Total : compte' skipped", r.skippedTotals === 1);
  ok("fr: no campaign id → name key", r.rows[0]?.externalKey === "name:toitures printemps:2026-09-01", r.rows[0]?.externalKey);
}
{
  const r = parseText(DE_DAILY_USD);
  ok("de USD: '1.234,56' → 1234.56", r.rows[0]?.amount === 1234.56, r.rows[0]);
  ok("de USD: '12.345' impressions → 12345", r.rows[0]?.impressions === 12345);
  ok("de USD: 'Gesamt' totals skipped", r.skippedTotals === 1);
  ok("de USD: currency USD on every row", r.rows.every((x) => x.currency === "USD"));
}
{
  const bytes = utf16le(EN_DAILY_CAD.replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "\t").replace(/"/g, ""));
  const decoded = decodeReportBytes(bytes);
  const r = parseGoogleAdsReport(csvTextToMatrix(decoded.text));
  ok("UTF-16 tab 'Excel CSV' parses to the same rows", r.error === null && r.rows.length === 3 && r.rows.find((x) => x.date === "2026-09-02")?.amount === 1020.5, r.error || r.rows);
}
{
  const r = parseText(EN_RANGE);
  ok("range report: granularity 'range'", r.granularity === "range");
  ok("range report: 'Cost' read, not 'Avg. cost' or 'Cost / conv.'", r.rows[0]?.amount === 990, r.rows[0]);
  ok("range report: key carries the whole range", r.rows[0]?.externalKey === "name:spring roofs gutters:2026-09-01..2026-09-30", r.rows[0]?.externalKey);
  ok("range report: dated on the range start", r.rows[0]?.date === "2026-09-01" && r.rows[0]?.rangeEnd === "2026-09-30");
  ok("range report: the paused all-zero campaign is skipped", r.rows.length === 1 && r.skippedEmpty === 1);
}
{
  const r = parseText(EN_DEVICE);
  ok("device-segmented: three lines become one row", r.rows.length === 1 && r.mergedRows === 2, r);
  ok("device-segmented: cost added up (15.00)", r.rows[0]?.amount === 15);
  ok("device-segmented: conversions added, '--' contributes nothing", r.rows[0]?.conversions === 1.5);
}
{
  // A real .xlsx, built here (fflate zip, inline strings, one date cell and
  // number cells), read by the SAME library the route uses.
  const { zipSync, strToU8 } = await import("fflate");
  const cell = (ref, v) =>
    typeof v === "number"
      ? `<c r="${ref}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
  const rowsXml = [
    ["Campaign report"],
    ["September 1, 2026 - September 2, 2026"],
    ["Day", "Campaign", "Currency code", "Cost", "Clicks"],
    [46266, "Spring Roofs", "CAD", 1020.5, 88], // 46266 = 2026-09-01 as an Excel serial, styled as a date
    ["Total: Account", "--", "CAD", 1020.5, 88],
  ]
    .map((r, i) => `<row r="${i + 1}">${r.map((v, j) => (i === 3 && j === 0 ? `<c r="A4" s="1"><v>${v}</v></c>` : cell(`${"ABCDE"[j]}${i + 1}`, v))).join("")}</row>`)
    .join("");
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Campaign report" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`),
  };
  const bytes = zipSync(files);
  let r = null;
  let err = null;
  try {
    const readXlsxFile = (await import("read-excel-file/node")).default;
    const sheets = await readXlsxFile(Buffer.from(bytes));
    r = parseGoogleAdsReport((sheets[0]?.data || []).map((row) => (row || []).map(xlsxCell)));
  } catch (e) {
    err = e?.message;
  }
  ok(".xlsx: read through read-excel-file, date cell → day, totals skipped", r && !r.error && r.rows.length === 1 && r.rows[0].date === "2026-09-01" && r.rows[0].amount === 1020.5 && r.skippedTotals === 1, err || r);
}
ok("weekly report refused with the reason", parseText(EN_WEEKLY).error === "not_daily");
ok("no currency column → asks, never assumes", parseText(NO_CURRENCY).needsCurrency === true);
ok("no currency column + stated USD → rows in USD", parseText(NO_CURRENCY, { statedCurrency: "usd" }).rows[0]?.currency === "USD");
ok("no currency column + garbage stated → still asks", parseText(NO_CURRENCY, { statedCurrency: "dollars" }).needsCurrency === true);
ok("ambiguous slashed days refused", parseText(AMBIGUOUS).error === "ambiguous_dates");
ok("slashed days decided by a 13", parseText(SLASHED_DAY_FIRST).rows.map((x) => x.date).sort().join() === "2026-09-03,2026-09-13");
ok("a file with no Campaign/Cost header is refused", parseText("Foo,Bar\n1,2\n").error === "no_header");
ok("header only → headers_only", parseText("Day,Campaign,Currency code,Cost\n").error === "headers_only");
ok("negative cost line is a row error, not imported", (() => {
  const r = parseText("Day,Campaign,Currency code,Cost\n2026-09-01,A,CAD,-5.00\n2026-09-02,A,CAD,5.00\n");
  return r.rows.length === 1 && r.rowErrors[0]?.reason === "negative_cost";
})());
ok("unreadable cost line is a row error with its file line number", (() => {
  const r = parseText("Campaign report\nDay,Campaign,Currency code,Cost\n2026-09-01,A,CAD,abc\n");
  return r.rowErrors[0]?.line === 3 && r.rowErrors[0]?.reason === "unreadable_cost";
})());
ok("hostile input never throws", (() => {
  for (const x of [null, undefined, 5, "x", [[null]], [[{}, [], 1]], [["Campaign", "Cost"], [{}, "1"]]]) parseGoogleAdsReport(x);
  return true;
})());

console.log("\n3. The write plan — idempotency, never touching what it didn't write\n");

const CAD = "CAD";
const rows = parseText(EN_DAILY_CAD).rows;
{
  const plan = buildGoogleSpendPlan({ rows, existingSpend: [], companyCurrency: CAD, source: "google_ads_csv" });
  ok("first import: every row is a create", plan.toCreate.length === 3 && plan.toUpdate.length === 0);
  ok("platform 'google', source 'google_ads_csv'", plan.toCreate.every((d) => d.platform === "google" && d.source === "google_ads_csv"));
  ok("never writes .leads", plan.toCreate.every((d) => !("leads" in d)));
  ok("conversions: rounded Int + exact kept", plan.toCreate.find((d) => d.externalId.endsWith("2026-09-02"))?.conversions === 3 && plan.toCreate.find((d) => d.externalId.endsWith("2026-09-02"))?.conversionsExact === 2.5);
  ok("same currency as the company → currency null", plan.toCreate.every((d) => d.currency === null));
  ok("date is a Date at UTC midnight", plan.toCreate[0].date instanceof Date && plan.toCreate[0].date.toISOString().endsWith("T00:00:00.000Z"));

  // Re-import of the same file, with the first import's rows now on file.
  const onFile = plan.toCreate.map((d, i) => ({ id: `g${i}`, ...d }));
  const again = buildGoogleSpendPlan({ rows, existingSpend: onFile, companyCurrency: CAD, source: "google_ads_csv" });
  ok("re-import: zero creates, every row an update of its own id", again.toCreate.length === 0 && again.toUpdate.length === 3 && again.toUpdate.every((u) => onFile.some((o) => o.id === u.id)));
  ok("re-import: no possible duplicates against its own rows", again.possibleDuplicates.length === 0);
}
{
  const manual = { id: "m1", source: "manual", externalId: null, platform: "google", date: new Date("2026-09-01T00:00:00Z"), campaignName: "Spring Roofs & Gutters!", campaignId: null };
  const meta = { id: "f1", source: "meta_api", externalId: "999:2026-09-01", platform: "facebook", date: new Date("2026-09-01T00:00:00Z"), campaignName: "Spring Roofs & Gutters", campaignId: "999" };
  const plan = buildGoogleSpendPlan({ rows, existingSpend: [manual, meta], companyCurrency: CAD, source: "google_ads_csv" });
  ok("a hand-typed Google row for the same campaign+day is flagged", plan.possibleDuplicates.length === 1 && plan.possibleDuplicates[0].matches[0].id === "m1", plan.possibleDuplicates);
  ok("…and skipped by default — never double counted", plan.skipped.length === 1 && plan.toCreate.length === 2);
  ok("the manual row is never in an update", plan.toUpdate.every((u) => u.id !== "m1"));
  ok("the Meta row (platform facebook) is neither updated nor a duplicate", plan.toUpdate.every((u) => u.id !== "f1") && plan.possibleDuplicates.every((d) => d.matches.every((m) => m.id !== "f1")));
  const keep = buildGoogleSpendPlan({ rows, existingSpend: [manual, meta], companyCurrency: CAD, source: "google_ads_csv", skipPossibleDuplicates: false });
  ok("unticking 'skip' imports the flagged row and still flags it", keep.toCreate.length === 3 && keep.possibleDuplicates.length === 1);
}
{
  // An API row for the same campaign id and day — the CSV must not double it.
  const api = { id: "a1", source: "google_ads_api", externalId: "12345678901:2026-09-01", platform: "google", date: new Date("2026-09-01T00:00:00Z"), campaignName: "Renamed campaign", campaignId: "12345678901" };
  const plan = buildGoogleSpendPlan({ rows, existingSpend: [api], companyCurrency: CAD, source: "google_ads_csv" });
  ok("CSV vs API on the same campaign id+day: flagged even after a rename", plan.possibleDuplicates.some((d) => d.matches.some((m) => m.id === "a1")));
  ok("…and the API row is not updated by the CSV import", plan.toUpdate.length === 0);
}
{
  // A monthly range row already on file; daily rows inside it overlap.
  const rangeRows = parseText(EN_RANGE).rows;
  const r1 = buildGoogleSpendPlan({ rows: rangeRows, existingSpend: [], companyCurrency: CAD, source: "google_ads_csv" });
  const onFile = r1.toCreate.map((d, i) => ({ id: `r${i}`, ...d }));
  const daily = buildGoogleSpendPlan({ rows, existingSpend: onFile, companyCurrency: CAD, source: "google_ads_csv" });
  ok("a daily import inside an imported month is flagged against the month", daily.possibleDuplicates.filter((d) => d.campaignName === "Spring Roofs & Gutters").length === 2, daily.possibleDuplicates);
}
{
  const usd = parseText(DE_DAILY_USD).rows;
  const plan = buildGoogleSpendPlan({ rows: usd, existingSpend: [], companyCurrency: CAD, source: "google_ads_csv" });
  ok("USD account for a CAD company: currency kept on the row, amount NOT converted", plan.toCreate[0].currency === "USD" && plan.toCreate[0].amount === 1234.56);
  ok("currencyMismatch reported", plan.currencyMismatch === true);
}
ok("unknown source is refused", (() => { try { buildGoogleSpendPlan({ rows, existingSpend: [], companyCurrency: CAD, source: "manual" }); return false; } catch { return true; } })());
ok("planWindow reaches back far enough to see a range row's start", (() => {
  const w = planWindow(rows);
  return w && w.gte < new Date("2025-09-01T00:00:00Z") && w.lte >= new Date("2026-09-02T00:00:00Z");
})());
ok("isSyncedSource: meta + both Google sources, not manual", isSyncedSource("meta_api") && isSyncedSource("google_ads_csv") && isSyncedSource("google_ads_api") && !isSyncedSource("manual"));

// @@MORE@@

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
