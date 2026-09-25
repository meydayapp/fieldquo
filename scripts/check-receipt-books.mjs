// scripts/check-receipt-books.mjs
//
//   npm run check:receipt-books
//
// The receipts book, executed against hostile input: the validator, the split
// arithmetic, the suggestion scoring (overnight shifts, DST, two crews on two
// jobs, no printed time, an unknown store), duplicate detection, the PDF
// guard, the payer switch — and the couplings between them that a reading
// would miss.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-receipt-books.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { validateReceipt, bookableTax, ROUNDING_CENTS } from "@/lib/receipts/validate";
import { allocate, apportion } from "@/lib/receipts/allocate";
import { suggestPlacement, postalArea, WEIGHTS } from "@/lib/receipts/suggest";
import { findDuplicates, storeKey } from "@/lib/receipts/duplicates";
import { purchaseInstant, dayWindow, localClock, clockLabel } from "@/lib/receipts/time";
import { normaliseExtraction, normaliseTime, normaliseLast4, RECEIPT_SCHEMA, ITEM_KINDS } from "@/lib/receipts/extract";
import { receiptFilesOrRefusal, MAX_RECEIPT_FILES } from "@/lib/receipts/media";
import { isOurCloudinaryUrl, countPdfPages, fetchReceiptPdf, MAX_PDF_PAGES } from "@/lib/receipts/pdf";
import { KIND_CATEGORY, vendorHint, tradesIn, categoryForKind } from "@/lib/receipts/classify";
import { receiptFieldsFromExtraction, paymentLabel } from "@/lib/receipts/fields";
import { expenseRowsFor } from "@/lib/receipts/record";
import { simulatedExtraction } from "@/lib/receipts/demoReceipt";
import { EXPENSE_CATEGORY_PRESETS } from "@/lib/expenses/categories";
import { PAYER_FEATURES, resolvePayer, payerFor, clearPayerCache, PAYER_CACHE_MS } from "@/lib/ai/featurePayer";
import { inputTaxFigure } from "@/lib/accounting/statements";
import { assertStrictSchema } from "@/lib/ai/jsonSchema";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (pass) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}
const section = (s) => console.log(`\n── ${s}`);

const TZ = "America/Toronto";
const at = (local, tz = TZ) => {
  const [d, t] = local.split(" ");
  return purchaseInstant(d, t, tz);
};

// ═══════════════════════════════════════════════════════════════════════════
section("1. The validator flags; it never fixes");
// ═══════════════════════════════════════════════════════════════════════════
{
  const demo = validateReceipt(simulatedExtraction());
  ok("the demo receipt raises no flag", demo.flags.length === 0, demo.flags);
  ok("...its tax is the printed single figure", demo.taxCents === 2030 && demo.taxSource === "printed");
  ok("...and its GST/QST breakdown is carried", demo.taxBreakdown?.length === 2 && demo.taxBreakdown[0].cents === 678);
  ok("...and it can be split by line", demo.canSplitByLines === true);

  const short = validateReceipt({
    items: [
      { description: "Paint", lineTotal: "50.00" },
      { description: "Rollers", lineTotal: "20.00" },
    ],
    printedSubtotal: "85.00",
    printedTax: "11.05",
    printedTotal: "96.05",
  });
  ok("items that don't sum are flagged items_mismatch", short.flags.includes("items_mismatch"), short.flags);
  ok("...the printed total is untouched", short.totalCents === 9605);
  ok("...and a split by line is refused", short.canSplitByLines === false);

  const rounding = validateReceipt({
    items: [{ description: "A", lineTotal: "10.01" }, { description: "B", lineTotal: "10.00" }],
    printedSubtotal: "20.00",
    printedTax: "2.60",
    printedTotal: "22.60",
  });
  ok(`a ${ROUNDING_CENTS}-cent gap is rounding, not a mismatch`, rounding.flags.includes("items_rounding") && !rounding.flags.includes("items_mismatch"), rounding.flags);
  ok("...and rounding still allows a split by line", rounding.canSplitByLines === true);

  const gstPst = validateReceipt({
    items: [{ description: "Tile", lineTotal: "100.00" }],
    printedSubtotal: "100.00",
    printedTax: null,
    taxLines: [{ label: "GST", amount: "5.00" }, { label: "PST", amount: "7.00" }],
    printedTotal: "112.00",
  });
  ok("GST + PST with no combined line are summed for the books", gstPst.taxCents === 1200 && gstPst.taxSource === "lines");
  ok("...and subtotal + those taxes is checked against the total", !gstPst.flags.includes("totals_mismatch"));

  const badTaxes = validateReceipt({
    items: [{ description: "Tile", lineTotal: "100.00" }],
    printedSubtotal: "100.00",
    printedTax: "13.00",
    taxLines: [{ label: "GST", amount: "5.00" }, { label: "PST", amount: "7.00" }],
    printedTotal: "113.00",
  });
  ok("separate taxes that don't make the tax line are flagged", badTaxes.flags.includes("tax_lines_mismatch"));
  ok("...and the printed single tax still wins for the books", badTaxes.taxCents === 1300);

  const halfTax = bookableTax({ taxLines: [{ label: "GST", amount: "5.00" }, { label: "PST", amount: null }] });
  ok("an unreadable tax line makes the tax UNKNOWN, not the partial sum", halfTax.cents === null);

  const empty = validateReceipt({});
  ok("an empty extraction flags no_total and no_items", empty.flags.includes("no_total") && empty.flags.includes("no_items"));
  ok("...no tax is null, never 0", empty.taxCents === null && empty.flags.includes("no_tax"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Splits add up to the paper, to the cent");
// ═══════════════════════════════════════════════════════════════════════════
{
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  ok("apportion hands out every cent", sum(apportion(1000, [1, 1, 1])) === 1000);
  ok("...deterministically (the extra cent goes to the first)", JSON.stringify(apportion(1000, [1, 1, 1])) === "[334,333,333]");
  ok("apportion of a negative total keeps the sign", sum(apportion(-1001, [2, 1])) === -1001);
  ok("apportion refuses all-zero weights", apportion(100, [0, 0]) === null);

  const v = validateReceipt(simulatedExtraction());
  const one = allocate(v, [{ kind: "job", jobId: "j1" }]);
  ok("one target takes the whole total and tax", one.ok && one.rows[0].amountCents === 15585 && one.rows[0].taxCents === 2030);

  const byLines = allocate(v, [
    { kind: "job", jobId: "j1", lineIndexes: [0] },
    { kind: "job", jobId: "j2", lineIndexes: [1, 2] },
  ]);
  ok("a split by line succeeds on a receipt that adds up", byLines.ok, byLines.reason);
  if (byLines.ok) {
    ok("...the parts add up to the total exactly", sum(byLines.rows.map((r) => r.amountCents)) === 15585, byLines.rows.map((r) => r.amountCents));
    ok("...the tax parts add up to the tax exactly", sum(byLines.rows.map((r) => r.taxCents)) === 2030);
    ok("...each label's parts add up to that label", sum(byLines.rows.map((r) => r.taxBreakdown[0].cents)) === 678 && sum(byLines.rows.map((r) => r.taxBreakdown[1].cents)) === 1352);
    ok("...each part is proportional to its lines (85.00 of 135.55)", byLines.rows[0].amountCents === Math.round((15585 * 8500) / 13555) || byLines.rows[0].amountCents === Math.floor((15585 * 8500) / 13555));
    ok("...and records which lines it carries", JSON.stringify(byLines.rows[1].lineIndexes) === "[1,2]");
  }

  ok("a line left out is refused", allocate(v, [{ kind: "job", jobId: "a", lineIndexes: [0] }, { kind: "job", jobId: "b", lineIndexes: [1] }]).reason === "lines_unassigned");
  ok("a line used twice is refused", allocate(v, [{ kind: "job", jobId: "a", lineIndexes: [0, 1] }, { kind: "job", jobId: "b", lineIndexes: [1, 2] }]).reason === "line_twice");
  ok("a line that is not on the receipt is refused", allocate(v, [{ kind: "job", jobId: "a", lineIndexes: [0, 1] }, { kind: "job", jobId: "b", lineIndexes: [2, 9] }]).reason === "bad_line");
  ok("a split by line on a corrected total is refused", allocate(v, [{ kind: "job", jobId: "a", lineIndexes: [0] }, { kind: "job", jobId: "b", lineIndexes: [1, 2] }], { totalCents: 16000 }).reason === "lines_do_not_add_up");

  const bad = validateReceipt({ items: [{ description: "x", lineTotal: "10.00" }, { description: "y", lineTotal: "10.00" }], printedSubtotal: "25.00", printedTotal: "25.00" });
  ok("lines that don't add up cannot be split by line", allocate(bad, [{ kind: "job", jobId: "a", lineIndexes: [0] }, { kind: "job", jobId: "b", lineIndexes: [1] }]).reason === "lines_do_not_add_up");
  const byAmount = allocate(bad, [{ kind: "job", jobId: "a", amountCents: 1500 }, { kind: "overhead", category: "Fuel & Vehicle", amountCents: 1000 }]);
  ok("...but can be split by typed amounts that add up", byAmount.ok && sum(byAmount.rows.map((r) => r.amountCents)) === 2500);
  ok("typed amounts that don't add up are refused", allocate(bad, [{ kind: "job", jobId: "a", amountCents: 1500 }, { kind: "job", jobId: "b", amountCents: 999 }]).reason === "amounts_do_not_add_up");
  ok("a negative typed amount is refused", allocate(bad, [{ kind: "job", jobId: "a", amountCents: 2600 }, { kind: "job", jobId: "b", amountCents: -100 }]).reason === "amount_not_positive");
  ok("a job part with no job is refused", allocate(v, [{ kind: "job" }]).reason === "job_missing");
  ok("a refund cannot be split", allocate({ totalCents: -500, taxCents: null }, [{ kind: "job", jobId: "a", amountCents: -250 }, { kind: "job", jobId: "b", amountCents: -250 }]).reason === "cannot_split_refund");
  ok("an unreadable receipt with a TYPED total books", allocate({ totalCents: null, taxCents: null }, [{ kind: "job", jobId: "a" }], { totalCents: 4200 }).rows?.[0]?.amountCents === 4200);
  ok("...and with no total at all is refused", allocate({ totalCents: null }, [{ kind: "job", jobId: "a" }]).reason === "no_total");
  ok("tax larger than the total is refused", allocate(v, [{ kind: "job", jobId: "a" }], { taxCents: 99999 }).reason === "tax_exceeds_total");
  ok("a discount line alone cannot carry a share", allocate(validateReceipt({ items: [{ description: "Paint", lineTotal: "30.00" }, { description: "Coupon", lineTotal: "-5.00" }], printedTotal: "25.00" }), [{ kind: "job", jobId: "a", lineIndexes: [0] }, { kind: "job", jobId: "b", lineIndexes: [1] }]).reason === "group_not_positive");

  // The rows the confirm writes.
  const receipt = { id: "r1", companyId: "c1", createdById: "u1", files: [{ url: "https://res.cloudinary.com/x/image/upload/a.jpg" }], extract: simulatedExtraction(), vendorName: "Northline", paymentMethod: "VISA", cardLast4: "4242", purchasedDate: "2026-08-14", purchasedAt: null, createdAt: new Date() };
  const rows = expenseRowsFor(receipt, byLines.rows);
  ok("every written row points back at the receipt", rows.every((r) => r.receiptId === "r1"));
  ok("...carries the original file", rows.every((r) => r.receiptUrl === receipt.files[0].url));
  ok("...is owned by the person who PAID, not the confirmer", rows.every((r) => r.createdById === "u1"));
  ok("...states its tax, in dollars", rows.every((r) => typeof r.taxAmount === "number"));
  ok("...and the payment method with the last four", rows[0].paymentMethod === "VISA ····4242");
  ok("an overhead part is overhead and never recurring", expenseRowsFor(receipt, byAmount.rows)[1].isOverhead === true && expenseRowsFor(receipt, byAmount.rows)[1].recurring === false);
  ok("a job part is a projectId, never overhead", rows[0].projectId === "j1" && rows[0].isOverhead === false);
  ok("unknown tax is written as null, not 0", expenseRowsFor(receipt, [{ target: { kind: "general" }, amountCents: 100, taxCents: null, taxBreakdown: null, lineIndexes: null }])[0].taxAmount === null);
  ok("paymentLabel never invents a method", paymentLabel(null, null) === null && paymentLabel("CASH", null) === "CASH");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Time: the company's clock, DST, and no invented noon");
// ═══════════════════════════════════════════════════════════════════════════
{
  const winter = purchaseInstant("2026-01-15", "08:00", TZ);
  ok("08:00 in Toronto in January is 13:00 UTC", winter?.toISOString() === "2026-01-15T13:00:00.000Z", winter?.toISOString());
  const summer = purchaseInstant("2026-07-15", "08:00", TZ);
  ok("...and 12:00 UTC in July", summer?.toISOString() === "2026-07-15T12:00:00.000Z", summer?.toISOString());
  ok("no time printed → no instant (never noon)", purchaseInstant("2026-07-15", null, TZ) === null);
  ok("a garbage timezone falls back rather than throwing", purchaseInstant("2026-07-15", "08:00", "Mars/Olympus")?.toISOString() === "2026-07-15T12:00:00.000Z");
  const dst = dayWindow("2026-03-08", TZ);
  ok("the spring-forward day is 23 hours long", (dst.end - dst.start) / 3600000 === 23);
  const back = dayWindow("2026-11-01", TZ);
  ok("the fall-back day is 25 hours long", (back.end - back.start) / 3600000 === 25);
  ok("an ambiguous 01:30 on fall-back day still resolves", purchaseInstant("2026-11-01", "01:30", TZ) instanceof Date);
  ok("localClock reads the company's wall clock", localClock(winter, TZ)?.hour === 8);
  ok("clockLabel is HH:MM", clockLabel(winter, TZ) === "08:00");

  ok('"2:32 PM" becomes 14:32', normaliseTime("2:32 PM") === "14:32");
  ok('"12:05 a.m." becomes 00:05', normaliseTime("12:05 a.m.") === "00:05");
  ok('"25:10" is dropped, never clamped', normaliseTime("25:10") === null);
  ok('"13:00 PM" is dropped', normaliseTime("13:00 PM") === null);
  ok('"noon" is dropped', normaliseTime("noon") === null);
  ok("last four from a masked number", normaliseLast4("************1234") === "1234" && normaliseLast4("**** 1234") === "1234");
  ok("a whole card number is refused, not trimmed", normaliseLast4("4242424242424242") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Suggestions: deterministic, with a reason for every point");
// ═══════════════════════════════════════════════════════════════════════════
const job = (id, extra = {}) => ({
  id,
  title: extra.title || `Job ${id}`,
  status: "in_progress",
  siteAddress: extra.siteAddress || `${id} Street, Ottawa, ON K2M 1A1`,
  sitePostalCode: extra.sitePostalCode ?? null,
  siteCity: extra.siteCity ?? null,
  quoteLineNames: extra.quoteLineNames || [],
  materialNames: extra.materialNames || [],
  timeEntries: extra.timeEntries || [],
  visits: extra.visits || [],
  ...extra,
});
const paint = [
  { description: "Interior eggshell paint 3.78L", kind: "materials", lineTotalCents: 8999 },
  { description: "Roller covers", kind: "materials", lineTotalCents: 1299 },
];
const NOW = new Date("2026-09-20T23:00:00Z");
{
  // Dana clocked in on Elm St at the time of the receipt.
  const t = at("2026-09-15 10:15");
  const s = suggestPlacement({
    receipt: { purchasedAt: t, purchasedDate: "2026-09-15", vendorName: "Home Depot Kanata", vendorPostalCode: "K2M 2E1", items: paint, uploaderUserId: "dana" },
    jobs: [
      job("elm", { siteAddress: "14 Elm St, Kanata, ON K2M 1A1", quoteLineNames: ["Walls — two coats of paint"], timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:02"), clockOut: at("2026-09-15 16:00") }] }),
      job("oak", { siteAddress: "9 Oak Ave, Orleans, ON K1C 1A1", timeEntries: [] }),
    ],
    people: { dana: "Dana" },
    timezone: TZ,
    now: NOW,
  });
  ok("the job Dana was clocked in on is first", s.jobs[0]?.jobId === "elm", s.jobs.map((j) => j.jobId));
  ok("...with high confidence", s.jobs[0]?.confidence === "high", s.jobs[0]);
  const codes = s.jobs[0].reasons.map((r) => r.code);
  ok("...and says why: clocked in, same postal area, lines match", ["clocked_in", "same_postal_area", "lines_match"].every((c) => codes.includes(c)), codes);
  ok("...the clock-in time is the company's 08:02", s.jobs[0].reasons.find((r) => r.code === "clocked_in").params.from === "08:02");
  ok("...every point is accounted for by a reason", s.jobs[0].reasons.reduce((a, r) => a + r.points, 0) === s.jobs[0].score);
  ok("materials that match the job are not overhead", s.best === "job" && (!s.overhead || s.overhead.score < s.jobs[0].score));

  // No time on the receipt: only the weaker "worked there that day".
  const noTime = suggestPlacement({
    receipt: { purchasedAt: null, purchasedDate: "2026-09-15", vendorName: "Home Depot", items: paint, uploaderUserId: "dana" },
    jobs: [job("elm", { timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:02"), clockOut: at("2026-09-15 16:00") }] })],
    people: { dana: "Dana" },
    timezone: TZ,
    now: NOW,
  });
  const ntCodes = noTime.jobs[0]?.reasons.map((r) => r.code) || [];
  ok("no printed time → 'worked that day', never 'clocked in'", ntCodes.includes("worked_that_day") && !ntCodes.includes("clocked_in"), ntCodes);

  // Timezone edge: 20:30 in Toronto is 00:30 UTC the NEXT day.
  const late = at("2026-09-15 20:30");
  ok("(fixture) 20:30 Toronto is the next UTC day", late.toISOString().startsWith("2026-09-16"));
  const tz = suggestPlacement({
    receipt: { purchasedAt: late, purchasedDate: "2026-09-15", items: paint, uploaderUserId: "dana" },
    jobs: [job("elm", { timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 19:00"), clockOut: at("2026-09-15 22:00") }] })],
    people: { dana: "Dana" },
    timezone: TZ,
    now: NOW,
  });
  ok("a receipt across the UTC midnight still matches the evening shift", tz.jobs[0]?.reasons.some((r) => r.code === "clocked_in"));

  // Overnight: clocked in 22:00, out 06:00 next day; receipt 02:10.
  const night = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-16 02:10"), purchasedDate: "2026-09-16", items: paint, uploaderUserId: "sam" },
    jobs: [job("plant", { timeEntries: [{ userId: "sam", clockIn: at("2026-09-15 22:00"), clockOut: at("2026-09-16 06:00") }] })],
    people: { sam: "Sam" },
    timezone: TZ,
    now: NOW,
  });
  ok("an overnight receipt matches the shift that started the evening before", night.jobs[0]?.reasons.some((r) => r.code === "clocked_in"), night.jobs[0]?.reasons);
  ok("...and is not called after-hours overhead", !night.overhead?.reasons?.some((r) => r.code === "after_hours"));

  // Two members on two jobs; the OFFICE uploads (clocked in nowhere).
  const two = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-15 11:00"), purchasedDate: "2026-09-15", items: [{ description: "Screws", kind: "materials", lineTotalCents: 900 }], uploaderUserId: "owner" },
    jobs: [
      job("a", { timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:00"), clockOut: at("2026-09-15 16:00") }] }),
      job("b", { timeEntries: [{ userId: "lee", clockIn: at("2026-09-15 08:30"), clockOut: at("2026-09-15 15:00") }] }),
    ],
    people: { dana: "Dana", lee: "Lee" },
    timezone: TZ,
    now: NOW,
  });
  ok("office upload: both crews' jobs are candidates", two.jobs.length === 2);
  ok("...each says who was clocked in there", two.jobs.every((j) => j.reasons.some((r) => r.code === "others_clocked_in")));
  ok("...and neither is 'high' — they are too close to call", two.jobs.every((j) => j.confidence !== "high"), two.jobs.map((j) => j.confidence));

  // Two members, but the UPLOADER is Lee on job b: a's crew is not evidence.
  const mine = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-15 11:00"), purchasedDate: "2026-09-15", items: [{ description: "Screws", kind: "materials", lineTotalCents: 900 }], uploaderUserId: "lee" },
    jobs: [
      job("a", { timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:00"), clockOut: at("2026-09-15 16:00") }] }),
      job("b", { timeEntries: [{ userId: "lee", clockIn: at("2026-09-15 08:30"), clockOut: at("2026-09-15 15:00") }] }),
    ],
    people: { dana: "Dana", lee: "Lee" },
    timezone: TZ,
    now: NOW,
  });
  ok("the uploader's own clock beats a colleague's", mine.jobs[0]?.jobId === "b" && !mine.jobs.find((j) => j.jobId === "a")?.reasons.some((r) => r.code === "others_clocked_in"));

  // Store unknown: no vendor, no postal code, no city.
  const unknown = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-15 11:00"), purchasedDate: "2026-09-15", items: paint, uploaderUserId: "dana" },
    jobs: [job("elm")],
    people: {},
    timezone: TZ,
    now: NOW,
  });
  ok("an unknown store gives no location reason and no crash", !unknown.jobs.some((j) => j.reasons.some((r) => r.code === "same_postal_area" || r.code === "same_city")));

  // Visit booked, nobody clocked in.
  const visit = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-15 09:30"), purchasedDate: "2026-09-15", items: paint, uploaderUserId: "dana" },
    jobs: [job("elm", { status: "scheduled", visits: [{ assignedToId: "dana", scheduledAt: at("2026-09-15 11:00") }] })],
    people: { dana: "Dana" },
    timezone: TZ,
    now: NOW,
  });
  ok("a visit booked for the uploader near the time counts", visit.jobs[0]?.reasons.some((r) => r.code === "visit_near"));

  // Split: paint to the job, fuel to overhead.
  const mixed = suggestPlacement({
    receipt: {
      purchasedAt: at("2026-09-15 10:15"),
      purchasedDate: "2026-09-15",
      items: [...paint, { description: "Regular unleaded 40L", kind: "fuel", lineTotalCents: 6200 }],
      uploaderUserId: "dana",
    },
    jobs: [job("elm", { quoteLineNames: ["paint"], timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:02"), clockOut: at("2026-09-15 16:00") }] })],
    people: { dana: "Dana" },
    timezone: TZ,
    now: NOW,
  });
  ok("paint + fuel on one receipt suggests a split", mixed.split?.groups?.length === 2, mixed.split);
  ok("...materials to the job, fuel to overhead as Fuel & Vehicle", mixed.split?.groups[0].jobId === "elm" && mixed.split?.groups[1].kind === "overhead" && mixed.split?.groups[1].category === "Fuel & Vehicle");
  ok("...and every line is in exactly one group", JSON.stringify(mixed.split?.groups.flatMap((g) => g.lineIndexes).sort()) === "[0,1,2]");

  // A gas station on a Saturday night with nobody on the clock.
  const gas = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-19 21:40"), purchasedDate: "2026-09-19", vendorName: "Petro-Canada #4411", items: [{ description: "Diesel", kind: "fuel", lineTotalCents: 9000 }], uploaderUserId: "dana" },
    jobs: [],
    people: {},
    timezone: TZ,
    now: NOW,
  });
  ok("fuel at a gas station, Saturday night, no job → overhead", gas.best === "overhead" && gas.overhead?.category === "Fuel & Vehicle", gas);
  const gasCodes = gas.overhead?.reasons.map((r) => r.code) || [];
  ok("...with the reasons: items, store, after hours, no active job", ["overhead_items", "overhead_store", "after_hours", "no_active_job"].every((c) => gasCodes.includes(c)), gasCodes);
  ok("...flagged as a weekend", gas.overhead.reasons.find((r) => r.code === "after_hours").params.weekend === true);

  // Hostile input.
  let threw = null;
  try {
    suggestPlacement({ receipt: {}, jobs: null, people: null, timezone: "nope", now: NOW });
    suggestPlacement({ receipt: { purchasedAt: "not a date", items: [{}] }, jobs: [{ id: "x", timeEntries: [{ clockIn: "garbage" }], visits: [{ scheduledAt: null }] }, { id: "x" }, null], timezone: TZ, now: NOW });
    suggestPlacement();
  } catch (err) {
    threw = err;
  }
  ok("hostile input never throws", threw === null, threw?.message);
  const dup = suggestPlacement({ receipt: { purchasedAt: at("2026-09-15 10:00"), items: paint, uploaderUserId: "dana" }, jobs: [job("a"), job("a")], timezone: TZ, now: NOW });
  ok("a job listed twice is scored once", dup.jobs.filter((j) => j.jobId === "a").length === 1);
  const cancelled = suggestPlacement({ receipt: { purchasedAt: at("2026-09-15 10:00"), items: paint, uploaderUserId: "dana" }, jobs: [job("a", { status: "cancelled", timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:00"), clockOut: null }] })], timezone: TZ, now: NOW });
  ok("a cancelled job is never suggested", cancelled.jobs.length === 0);
  const open = suggestPlacement({
    receipt: { purchasedAt: at("2026-09-16 09:00"), items: paint, uploaderUserId: "dana" },
    jobs: [job("a", { timeEntries: [{ userId: "dana", clockIn: at("2026-09-15 08:00"), clockOut: null }] })],
    timezone: TZ,
    now: NOW,
  });
  ok("a forgotten clock-out is not believed for 25 hours", !open.jobs[0]?.reasons.some((r) => r.code === "clocked_in"));
  ok("at most three jobs are suggested", suggestPlacement({ receipt: { purchasedAt: at("2026-09-15 10:00"), items: paint, uploaderUserId: "d" }, jobs: ["1", "2", "3", "4", "5"].map((i) => job(i)), timezone: TZ, now: NOW }).jobs.length <= 3);

  ok("postal area: Canadian FSA", postalArea("123 Main St, Kanata ON K2M 1A1") === "K2M");
  ok("postal area: US ZIP sectional centre", postalArea("Austin, TX 78701") === "787");
  ok("postal area: nothing is null, never a guess", postalArea("Somewhere") === null);
  ok("trade families: paint → painting", tradesIn("Behr premium paint").has("painting"));
  ok("every kind maps to a shared category preset", ITEM_KINDS.every((k) => EXPENSE_CATEGORY_PRESETS.includes(categoryForKind(k))));
  ok("the kind map covers exactly the schema's enum", JSON.stringify(Object.keys(KIND_CATEGORY).sort()) === JSON.stringify([...ITEM_KINDS].sort()));
  ok("vendor hints match whole words ('Shell' ≠ 'Shellac Supply')", vendorHint("Shell #221")?.category === "Fuel & Vehicle" && vendorHint("Shellac Supply Co") === null);
  ok("weights are all positive numbers", Object.values(WEIGHTS).every((w) => Number.isFinite(w) && w > 0));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Duplicates warn; they never remove");
// ═══════════════════════════════════════════════════════════════════════════
{
  const base = { id: "r1", vendorName: "HOME DEPOT #7011", receiptNumber: "4471-22", totalCents: 15585, purchasedDate: "2026-09-15", purchasedAt: at("2026-09-15 10:42") };
  ok("same store + same receipt number", findDuplicates(base, [{ ...base, id: "r2", vendorName: "The Home Depot", totalCents: 1 }])[0]?.reason === "same_number");
  ok("same store + total within 5 minutes", findDuplicates({ ...base, receiptNumber: null }, [{ ...base, id: "r2", receiptNumber: null, purchasedAt: at("2026-09-15 10:45") }])[0]?.reason === "same_moment");
  ok("same store + total 2 hours apart is NOT a duplicate", findDuplicates({ ...base, receiptNumber: null }, [{ ...base, id: "r2", receiptNumber: null, purchasedAt: at("2026-09-15 12:45") }]).length === 0);
  ok("same store + total + day, one without a time", findDuplicates({ ...base, receiptNumber: null, purchasedAt: null }, [{ ...base, id: "r2", receiptNumber: null }])[0]?.reason === "same_day_total");
  ok("a different store is never a duplicate", findDuplicates(base, [{ ...base, id: "r2", vendorName: "Lowe's" }]).length === 0);
  ok("a receipt is not its own duplicate", findDuplicates(base, [base]).length === 0);
  ok("store keys ignore store numbers and 'The'", storeKey("The Home Depot #7011") === storeKey("HOME DEPOT"));
  ok("hostile others never throw", Array.isArray(findDuplicates(base, [null, {}, { id: "x" }])));
  const routeSrc = read("app/api/receipts/[id]/confirm/route.js");
  ok("the confirm asks before booking a likely duplicate", /duplicateOfId && body\.acknowledgeDuplicate !== true/.test(routeSrc));
  ok("nothing in the receipts book deletes a receipt", !walk("app/api/receipts").some((f) => /receipt\.delete(Many)?\(/.test(read(f))) && !walk("lib/receipts").some((f) => /receipt\.delete(Many)?\(/.test(read(f))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Files: photos AND a PDF, from our storage only");
// ═══════════════════════════════════════════════════════════════════════════
{
  const photo = (n) => ({ url: `https://res.cloudinary.com/demo/image/upload/${n}.jpg`, kind: "photo" });
  ok("one photo is a receipt", receiptFilesOrRefusal([photo(1)]).ok);
  ok(`${MAX_RECEIPT_FILES} photos are one receipt`, receiptFilesOrRefusal([1, 2, 3, 4].map(photo)).photos?.length === 4);
  ok("a fifth photo is refused", receiptFilesOrRefusal([1, 2, 3, 4, 5].map(photo)).code === "tooMany");
  const pdf = { url: "https://res.cloudinary.com/demo/raw/upload/r.pdf", kind: "document", filename: "r.pdf" };
  ok("a PDF alone is a receipt", receiptFilesOrRefusal([pdf]).pdf?.url === pdf.url);
  ok("a PDF mixed with a photo is refused", receiptFilesOrRefusal([pdf, photo(1)]).code === "mixed");
  ok("a video is refused", receiptFilesOrRefusal([{ url: "https://x/y.mov", kind: "video" }]).code === "video");
  ok("an http: (not https) URL is refused", receiptFilesOrRefusal([{ url: "http://x/y.jpg", kind: "photo" }]).code === "notHttp");

  ok("our cloud's URL is ours", isOurCloudinaryUrl("https://res.cloudinary.com/demo/raw/upload/v1/r.pdf", "demo"));
  ok("another cloud's is not", !isOurCloudinaryUrl("https://res.cloudinary.com/evil/raw/upload/r.pdf", "demo"));
  ok("a look-alike host is not", !isOurCloudinaryUrl("https://res.cloudinary.com.evil.net/demo/r.pdf", "demo"));
  ok("userinfo tricks are not", !isOurCloudinaryUrl("https://res.cloudinary.com@169.254.169.254/demo/r.pdf", "demo"));
  ok("a port is not", !isOurCloudinaryUrl("https://res.cloudinary.com:8443/demo/r.pdf", "demo"));
  ok("no configured cloud means nothing is ours", !isOurCloudinaryUrl("https://res.cloudinary.com/demo/r.pdf", ""));

  const twoPages = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type/Page >>\n");
  ok("pages are counted, the tree node is not", countPdfPages(twoPages) === 2);
  const res = (buf, headers = {}) => ({ ok: true, headers: { get: (k) => headers[k] ?? null }, arrayBuffer: async () => buf });
  process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/r.pdf`;
  ok("a real PDF is fetched as base64", (await fetchReceiptPdf({ url }, { fetchImpl: async () => res(twoPages) })).pages === 2);
  ok("a renamed JPEG is refused as not_pdf", (await fetchReceiptPdf({ url }, { fetchImpl: async () => res(Buffer.from("\xFF\xD8\xFF\xE0JFIF")) })).reason === "not_pdf");
  const many = Buffer.from("%PDF-1.4\n" + "<< /Type /Page >>\n".repeat(MAX_PDF_PAGES + 1));
  ok(`more than ${MAX_PDF_PAGES} pages is refused`, (await fetchReceiptPdf({ url }, { fetchImpl: async () => res(many) })).reason === "too_many_pages");
  ok("a declared size over the cap is refused before reading", (await fetchReceiptPdf({ url }, { fetchImpl: async () => res(twoPages, { "content-length": String(50 * 1024 * 1024) }) })).reason === "too_large");
  let fetched = false;
  await fetchReceiptPdf({ url: "https://evil.example/r.pdf" }, { fetchImpl: async () => { fetched = true; return res(twoPages); } });
  ok("a URL that isn't ours is never fetched", fetched === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The extraction schema and its normaliser");
// ═══════════════════════════════════════════════════════════════════════════
{
  const lint = assertStrictSchema(RECEIPT_SCHEMA);
  ok("the extended schema passes the strict subset", lint.ok, lint.errors?.join("; "));
  const n = normaliseExtraction({ items: [{ description: "x", lineTotal: "1.00", kind: "rocket" }], taxLines: [{ label: "", amount: "" }, { label: "GST", amount: "0.05" }], cardLast4: "4242424242424242", transactionTime: "9:05 pm" });
  ok("an out-of-enum kind becomes 'other'", n.items[0].kind === "other");
  ok("an empty tax line is dropped", n.taxLines.length === 1);
  ok("a full card number never survives", n.cardLast4 === null);
  ok("a time is normalised", n.transactionTime === "21:05");
  const f = receiptFieldsFromExtraction(simulatedExtraction(), TZ);
  ok("the demo receipt's instant is 10:42 Montréal-time (Toronto zone)", f.purchasedAt?.toISOString() === "2026-08-14T14:42:00.000Z", f.purchasedAt?.toISOString());
  ok("...its columns are what was printed", f.total === 155.85 && f.subtotal === 135.55 && f.tax === 20.3);
  ok("...a missing subtotal stays null", receiptFieldsFromExtraction({ printedTotal: "10.00" }, TZ).subtotal === null);
  ok("the prompt still forbids arithmetic", /NEVER add anything up/.test(read("lib/receipts/extract.js")));
  ok("the prompt forbids copying card digits", /Never copy any other digits of a card number/.test(read("lib/receipts/extract.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The payer switch is real");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("receipts default to FieldQuo paying", resolvePayer("receipt_scan", null) === "fieldquo");
  ok("copilot and translation default to FieldQuo (the owner's seed)", resolvePayer("copilot", null) === "fieldquo" && resolvePayer("translation", null) === "fieldquo");
  ok("the AI employee defaults to the company", resolvePayer("ai_employee_reply", null) === "company" && resolvePayer("ai_employee_front_desk", null) === "company");
  ok("an unlisted feature keeps its old behaviour (the company)", resolvePayer("quote_review", null) === "company");
  ok("a stored payer wins", resolvePayer("receipt_scan", { payer: "company" }) === "company");
  ok("a garbage stored payer is ignored", resolvePayer("receipt_scan", { payer: "martians" }) === "fieldquo");

  let reads = 0;
  const fake = { aiFeaturePayer: { findUnique: async () => { reads++; return { payer: "company" }; } } };
  clearPayerCache();
  const a = await payerFor("receipt_scan", { prisma: fake, now: 1000 });
  const b = await payerFor("receipt_scan", { prisma: fake, now: 1000 + PAYER_CACHE_MS - 1 });
  const c = await payerFor("receipt_scan", { prisma: fake, now: 1000 + PAYER_CACHE_MS + 1 });
  ok("the payer is read, cached, and re-read after the cache window", a === "company" && b === "company" && c === "company" && reads === 2, { reads });
  clearPayerCache();
  const broken = { aiFeaturePayer: { findUnique: async () => { throw new Error("down"); } } };
  ok("an unreadable table falls back to the DEFAULT, not to the company", (await payerFor("receipt_scan", { prisma: broken, now: 5 })) === "fieldquo");
  clearPayerCache();

  // "wired" is a claim about code: every wired feature has a meterFor call.
  const SOURCES = [...walk("app"), ...walk("lib")].filter((f) => !f.endsWith("lib/ai/featurePayer.js"));
  for (const f of PAYER_FEATURES.filter((x) => x.wired)) {
    const callers = SOURCES.filter((p) => {
      const src = read(p);
      return src.includes("meterFor(") && (src.includes(`meterFor("${f.feature}"`) || new RegExp(`AI_FEATURE\\s*=\\s*"${f.feature}"`).test(src));
    });
    ok(`${f.feature} is marked wired AND routes through meterFor (${callers.length} call sites)`, callers.length >= 2, callers);
  }
  const billing = read("app/api/platform/ai-billing/route.js");
  ok("the switch refuses to save an unwired feature", /if \(!f\.wired\)/.test(billing));
  ok("...and only a superadmin may change it", /admin\.role !== "superadmin"/.test(billing));
  ok("...and the change is audit-logged", /ai_payer_changed/.test(billing) && /ai_payer_changed/.test(read("lib/platform/auditActions.js")));
  for (const route of ["app/api/receipts/scan/route.js", "app/api/receipts/[id]/read/route.js"]) {
    const src = read(route);
    ok(`${route}: checked before the vendor call`, src.indexOf("meter.check(") !== -1 && src.indexOf("meter.check(") < src.indexOf("extractReceipt("));
    ok(`${route}: recorded on every outcome`, /if \(usage\) \{\s*await meter\.record\(usage\)/.test(src) && src.indexOf("meter.record(") < src.indexOf("if (!extraction.ok)"));
    ok(`${route}: a demo never reaches the vendor`, src.indexOf("isDemoCompany(") < src.indexOf("meter.check("));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. RBAC: every route re-checks, crew stay in their lane");
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const route of walk("app/api/receipts").filter((f) => f.endsWith("route.js"))) {
    const src = read(route);
    ok(`${route} resolves its member through memberOrRefusal`, /memberOrRefusal\(request\)/.test(src));
    if (!route.includes("/scan/")) {
      ok(`${route} loads the member's permissions fresh`, /loadEnforceableMember\(db, member\.id\)/.test(src));
    }
  }
  const confirm = read("app/api/receipts/[id]/confirm/route.js");
  ok("crew cannot book to overhead", /!office && targets\.some\(\(t\) => t\.kind !== "job"\)/.test(confirm));
  ok("every job id is re-checked against what this person may link", /linkableJobWhere\(\{ companyId: member\.companyId, userId: member\.userId, seesAll: office \}\)/.test(confirm));
  ok("re-linking a booked part is office-only", /if \(!seesAllReceipts\(full\)\)/.test(read("app/api/receipts/[id]/expenses/[expenseId]/route.js")));
  ok("...and the older expense PATCH cannot be used to walk around it", /existing\.receiptId &&/.test(read("app/api/expenses/[id]/route.js")));
  ok("a crew member's list is their own", /createdById: userId \|\| "__none__"/.test(read("lib/receipts/access.js")));
  ok("crew are suggested only jobs they could book to", /restrict = seesAll \? null : linkableJobWhere/.test(read("lib/receipts/view.js")));
  ok("the Create menu offers 'Snap receipt' at the lowest Expenses rung", /"app\.quickAdd\.receipt": \{ category: "expenses", level: "view_record_edit_own" \}/.test(read("lib/permissions/nav.js")));
  ok("no CSV export was added (the owner's 2026-09-24 decision)", !walk("app/api/receipts").some((f) => /export/i.test(f)) && !/text\/csv/.test(walk("app/api/receipts").map(read).join("\n")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The books read what the receipts write");
// ═══════════════════════════════════════════════════════════════════════════
{
  const fig = inputTaxFigure([
    { taxAmount: 20.3, taxBreakdown: [{ label: "GST", amount: 6.78 }, { label: "QST", amount: 13.52 }] },
    { taxAmount: 1.3, taxBreakdown: null },
    { taxAmount: null },
  ]);
  ok("tax paid on purchases sums the receipts that state it", Math.abs(fig.amount - 21.6) < 1e-9 && fig.count === 2);
  ok("...split by printed label", fig.components.find((c) => c.label === "GST")?.amount === 6.78 && fig.components.find((c) => c.label === "Tax")?.amount === 1.3);
  ok("...and says how many expenses state none (unknown, not zero)", fig.excludes[0].startsWith("1 expense(s)"));
  ok("no stated tax at all is 'nothing recorded', not a zero figure", inputTaxFigure([{ taxAmount: null }]).stated === false);
  ok("the statements route loads taxAmount", /taxAmount: true/.test(read("app/api/analytics/statements/route.js")));
  ok("the statements page renders it", /s\.paidOnPurchases/.test(read("app/app/analytics/statements/page.js")));
  const schema = read("prisma/schema.prisma");
  for (const field of ["taxAmount", "taxBreakdown", "paymentMethod", "receiptLines", "receiptId"]) {
    const readers = walk("lib").concat(walk("app")).filter((f) => !f.endsWith("lib/receipts/record.js") && read(f).includes(field));
    ok(`Expense.${field} is written by record.js AND read elsewhere`, read("lib/receipts/record.js").includes(field) && readers.length > 0, readers.slice(0, 3));
  }
  ok("the Receipt model exists", /model Receipt \{/.test(schema));
}

console.log(`\n${failures ? "✖" : "✓"} ${checks - failures}/${checks} passed\n`);
process.exit(failures ? 1 : 0);

function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  let entries = [];
  try {
    entries = readdirSync(abs);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|mjs)$/.test(name)) out.push(rel);
  }
  return out;
}
