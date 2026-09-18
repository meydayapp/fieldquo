// scripts/check-sales-test-line.mjs
//
//   npm run check:sales-test-line
//
// The dialler's test-line allowlist (lib/sales/testLines.js), executed.
//
// ══ What it proves ════════════════════════════════════════════════════════
//
//   1. The list reader survives hostile JSON: not-a-list, numbers, nulls,
//      a stranger's formatting, duplicates, a list of a thousand.
//   2. A number on the list is ALLOWED by salesCallReadiness at 03:00 in
//      Oklahoma, over Florida's cap, in an unread state, under Arizona's
//      prohibition and with no location at all — and the answer carries
//      jurisdiction code "test", nothing else the screens key a law on, and
//      a caveat in nine languages. Anything but the literal `true` exempts
//      nothing.
//   3. The queue's window grouping puts a test line in "Callable now" with
//      no best-time score, and the retry pool's regroup leaves it there
//      over a scheduled retry.
//   4. Every count of work excludes a test dial: the pure reporting
//      functions when handed one, and every SalesCallAttempt query that
//      counts dials through the where fragment (with the NULL branch, which
//      Prisma's bare `not` drops — measured, see testLines.js).
//   5. Source: the dial route judges the number AFTER do-not-contact and the
//      suppression read and never before them; recordDial freezes the code
//      into the row; the queue and lead routes decide server-side and the
//      screens re-pass; the console's write is superadmin-only, audit-logged
//      and reachable from the Calling windows page; and NO file names the
//      owner's account — the exemption is on the number, never on a person.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  MAX_TEST_LINES,
  TEST_DIAL_EXCLUSION,
  TEST_DIAL_SQL_EXCLUSION,
  TEST_JURISDICTION_CODE,
  TEST_LINES_SETTING_KEY,
  excludingTestDials,
  isTestDial,
  isTestLine,
  normaliseTestLines,
  withoutTestDials,
} from "@/lib/sales/testLines";
import { CALL_ALLOWED, CALL_REFUSED, CALL_UNKNOWN, TEST_LINE_JURISDICTION_CODE, dialHref, salesCallReadiness } from "@/lib/sales/callingRules";
import { windowFor, groupByWindow, WINDOW_GROUP_NOW } from "@/lib/sales/queueWindows";
import { regroupForRetry } from "@/lib/sales/retryPool";
import { campaignCallRows, repCallStats, teamCallRows } from "@/lib/sales/calls/reporting";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (h) => console.log(`\n${h}\n`);
const LANGS = Object.keys(APP_MESSAGES);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The list reader, against hostile input");
// ═══════════════════════════════════════════════════════════════════════════

ok("the setting key and the code are the ones the rules use", TEST_LINES_SETTING_KEY === "sales.testLines" && TEST_JURISDICTION_CODE === "test" && TEST_JURISDICTION_CODE === TEST_LINE_JURISDICTION_CODE);
for (const [label, value] of [
  ["undefined", undefined],
  ["null", null],
  ["a string", "+14165550100"],
  ["a number", 14165550100],
  ["an object with no numbers", { foo: 1 }],
  ["numbers that is not a list", { numbers: "+14165550100" }],
  ["a list of non-strings", [1, null, {}, [], true]],
  ["a list of junk strings", ["", "   ", "abc", "+0", "+1", "555-0100"]],
]) {
  ok(`${label} reads as an empty list`, Array.isArray(normaliseTestLines(value)) && normaliseTestLines(value).length === 0, normaliseTestLines(value));
}
ok("a valid E.164 is kept as written", JSON.stringify(normaliseTestLines(["+14165550100"])) === '["+14165550100"]');
ok("formatting is normalised and duplicates collapse", JSON.stringify(normaliseTestLines(["+1 (416) 555-0100", "+14165550100", "+1-416-555-0100"])) === '["+14165550100"]');
ok("{ numbers: [...] } is read too", JSON.stringify(normaliseTestLines({ numbers: ["+14165550100"] })) === '["+14165550100"]');
ok("junk beside a good entry drops only the junk", JSON.stringify(normaliseTestLines(["abc", "+14165550100", null])) === '["+14165550100"]');
ok(`a list of a thousand is cut at ${MAX_TEST_LINES}`, normaliseTestLines(Array.from({ length: 1000 }, (_, i) => `+1416555${String(i).padStart(4, "0")}`)).length === MAX_TEST_LINES);

ok("isTestLine: a number on the list, however formatted, is a test line", isTestLine("+1 416 555 0100", ["+14165550100"]));
ok("isTestLine: a number not on the list is not", !isTestLine("+14165550101", ["+14165550100"]));
ok("isTestLine: no list, a bad list, a bad number — all no", !isTestLine("+14165550100", null) && !isTestLine("+14165550100", "nope") && !isTestLine(null, ["+14165550100"]) && !isTestLine("", ["+14165550100"]) && !isTestLine("+14165550100", [null, 1]));
ok("isTestLine: an empty list exempts nothing", !isTestLine("+14165550100", []));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The calling rules answer for our own phone");
// ═══════════════════════════════════════════════════════════════════════════

const at = (iso) => new Date(iso);
const us = (p) => ({ country: "US", province: p });
// 03:00 Oklahoma, a Tuesday — refused for everybody else.
const night = at("2026-09-08T08:00:00Z");
const base = salesCallReadiness({ prospect: us("OK"), now: night });
ok("the control: Oklahoma at 03:00 is refused for a stranger", base.decision === CALL_REFUSED && base.blockers.some((b) => b.code === "outside_window"));

const test = salesCallReadiness({ prospect: us("OK"), now: night, testLine: true });
ok("…and allowed for a test line at the same instant", test.decision === CALL_ALLOWED);
ok("the answer carries jurisdiction code \"test\" and no jurisdiction name", test.jurisdiction?.code === "test" && test.jurisdiction?.name === null && test.jurisdiction?.verified === false);
ok("…no window text, key, citation, cap or override — nothing a screen would print as a law", test.windowText === null && test.windowKey === null && test.citation === null && test.attemptCap === null && test.windowOverride === null && test.inWindow === null);
ok("…no blockers and no warnings", test.blockers.length === 0 && test.warnings.length === 0);
ok("…one caveat, coded test_line, with a title key and a fix key", test.unenforced.length === 1 && test.unenforced[0].code === "test_line" && test.unenforced[0].titleKey === "app.salesDial.unenforced.testLine.title" && test.unenforced[0].fixKey === "app.salesDial.unenforced.testLine.fix");
ok("…and the flag itself, so the queue can read it back", test.testLine === true);
ok("dialHref produces a target from it", dialHref(test, "+14165550100") === "tel:+14165550100");
for (const lang of LANGS) {
  ok(`the caveat has ${lang} words`, typeof APP_MESSAGES[lang]["app.salesDial.unenforced.testLine.title"] === "string" && typeof APP_MESSAGES[lang]["app.salesDial.unenforced.testLine.fix"] === "string");
}
ok("the English caveat says it is our own number and is counted nowhere", /FieldQuo’s own test/.test(APP_MESSAGES.en["app.salesDial.unenforced.testLine.title"]) && /left out of every count/.test(APP_MESSAGES.en["app.salesDial.unenforced.testLine.fix"]));

ok("over Florida's cap: refused for a stranger, allowed for a test line", salesCallReadiness({ prospect: us("FL"), timeZone: "America/New_York", now: at("2026-09-08T16:00:00Z"), attemptsLast24h: 3 }).decision === CALL_REFUSED && salesCallReadiness({ prospect: us("FL"), timeZone: "America/New_York", now: at("2026-09-08T16:00:00Z"), attemptsLast24h: 3, testLine: true }).decision === CALL_ALLOWED);
ok("no location: unknown for a stranger, allowed for a test line", salesCallReadiness({ prospect: {}, now: night }).decision === CALL_UNKNOWN && salesCallReadiness({ prospect: {}, now: night, testLine: true }).decision === CALL_ALLOWED);
ok("Arizona's prohibition: refused for a stranger, allowed for a test line — it is our phone", salesCallReadiness({ prospect: us("AZ"), now: at("2026-09-08T18:00:00Z") }).decision === CALL_REFUSED && salesCallReadiness({ prospect: us("AZ"), now: at("2026-09-08T18:00:00Z"), testLine: true }).decision === CALL_ALLOWED);
ok("an enforce override does not bind a test line; a test line does not relax anybody else", salesCallReadiness({ prospect: us("OK"), now: night, testLine: true, windowPolicy: { mode: "enforce" } }).decision === CALL_ALLOWED && salesCallReadiness({ prospect: us("OK"), now: night, testLine: false }).decision === CALL_REFUSED);
for (const [label, value] of [["the string \"true\"", "true"], ["1", 1], ["an object", {}], ["an array", [true]], ["null", null], ["undefined", undefined]]) {
  ok(`testLine = ${label} exempts nothing`, salesCallReadiness({ prospect: us("OK"), now: night, testLine: value }).decision === CALL_REFUSED);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The queue: callable now, no best-time score, no retry hold");
// ═══════════════════════════════════════════════════════════════════════════

{
  const w = windowFor({ prospect: us("OK"), now: night, testLine: true });
  ok("windowFor: a test line is callable now at 03:00 Oklahoma", w.callableNow === true && w.kind === WINDOW_GROUP_NOW && w.decision === CALL_ALLOWED);
  ok("…with no window score and no best-time chip — a test dial is never the best minute", w.windowScore === null && w.bestTimeNow === false);
  ok("…and says so", w.testLine === true);
  const plain = windowFor({ prospect: us("OK"), now: night });
  ok("…while the same row without the flag is not callable", plain.callableNow === false && plain.testLine === false);

  const grouped = groupByWindow(
    [
      { id: "stranger", country: "US", province: "OK", name: "A" },
      { id: "ours", country: "US", province: "OK", name: "B", testLine: true },
      { id: "forged", country: "US", province: "OK", name: "C", testLine: "true" },
    ],
    { now: night },
  );
  ok("groupByWindow: only the row flagged true lands in Callable now", grouped.byId.ours.kind === WINDOW_GROUP_NOW && grouped.byId.stranger.kind !== WINDOW_GROUP_NOW && grouped.byId.forged.kind !== WINDOW_GROUP_NOW);

  const later = new Date(night.getTime() + 2 * 3600 * 1000).toISOString();
  const re = regroupForRetry(grouped, { ours: { scheduled: true, nextAttemptAtIso: later, nextAttemptAtLocal: "05:00" }, stranger: { scheduled: true, nextAttemptAtIso: later, nextAttemptAtLocal: "05:00" } }, { now: night });
  ok("regroupForRetry: a scheduled retry does not hold a test line", re.byId.ours.callableNow === true && re.byId.ours.kind === WINDOW_GROUP_NOW && !re.byId.ours.retryHold);
  ok("…and an exhausted one does not either", regroupForRetry(grouped, { ours: { exhausted: true } }, { now: night }).byId.ours.kind === WINDOW_GROUP_NOW);
  ok("…while the stranger's row is held as before", re.byId.stranger.retryHold === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Every count ignores a test dial");
// ═══════════════════════════════════════════════════════════════════════════

{
  const real = { id: "r", salesRepId: "rep", direction: "out", dialledAt: "2026-09-08T14:00:00Z", disposition: "no_answer", jurisdictionCode: "US-OK", dialChannel: "browser", talkSeconds: 30 };
  const testRow = { ...real, id: "t", jurisdictionCode: "test", disposition: "reached_interested", talkSeconds: 600 };
  const nullRow = { ...real, id: "n", jurisdictionCode: null };
  ok("isTestDial reads the code and nothing else", isTestDial(testRow) && !isTestDial(real) && !isTestDial(nullRow) && !isTestDial(null) && !isTestDial({ jurisdictionCode: "TEST" }));
  ok("withoutTestDials keeps real and null-coded rows and drops the test one", withoutTestDials([real, testRow, nullRow]).map((r) => r.id).join() === "r,n");
  ok("…and passes a non-list through untouched", withoutTestDials(null) === null);

  const stats = repCallStats({ attempts: [real, testRow, nullRow], activity: [], from: at("2026-09-08T00:00:00Z"), to: at("2026-09-09T00:00:00Z") });
  ok("repCallStats: two dials, not three", stats.dials === 2, stats.dials);
  ok("…and the test row's outcome is not in the mix", stats.dispositions.total === 2 && stats.dispositions.byCode.reached_interested === 0);
  ok("…nor its talk time in the measured figures", stats.measured.talkMs === 60_000, stats.measured);

  const team = teamCallRows({ reps: [{ id: "rep", name: "R" }], attempts: [real, testRow, nullRow], activity: [], presence: [], from: at("2026-09-08T00:00:00Z"), to: at("2026-09-09T00:00:00Z") });
  const mine = Array.isArray(team) ? team.find((r) => r.id === "rep" || r.rep?.id === "rep") : null;
  const teamDials = mine?.stats?.dials ?? mine?.dials ?? null;
  ok("teamCallRows: the floor board counts two", teamDials === 2, mine);

  const camp = campaignCallRows({ attempts: [{ ...real, groupKey: "painting" }, { ...testRow, groupKey: "painting" }], from: at("2026-09-08T00:00:00Z"), to: at("2026-09-09T00:00:00Z") });
  const painting = (Array.isArray(camp) ? camp : camp?.rows || []).find((g) => g.key === "painting");
  ok("campaignCallRows: the campaign counts one", (painting?.stats?.dials ?? painting?.dials ?? painting?.attempts?.length) === 1, painting);

  ok("the where fragment keeps NULL-coded rows: null OR not test", JSON.stringify(TEST_DIAL_EXCLUSION) === '{"OR":[{"jurisdictionCode":null},{"jurisdictionCode":{"not":"test"}}]}');
  ok("excludingTestDials merges under AND and keeps a caller's OR", (() => {
    const w = excludingTestDials({ salesRepId: "rep", OR: [{ direction: "out" }] });
    return w.salesRepId === "rep" && Array.isArray(w.OR) && w.OR.length === 1 && Array.isArray(w.AND) && w.AND.length === 1 && w.AND[0] === TEST_DIAL_EXCLUSION;
  })());
  ok("…and appends to a caller's own AND, list or single", excludingTestDials({ AND: [{ a: 1 }] }).AND.length === 2 && excludingTestDials({ AND: { a: 1 } }).AND.length === 2);
  ok("…and survives no argument at all", excludingTestDials().AND.length === 1 && excludingTestDials(null).AND.length === 1);
  ok("the SQL clause uses IS DISTINCT FROM so NULL rows stay", TEST_DIAL_SQL_EXCLUSION === `"jurisdictionCode" IS DISTINCT FROM 'test'`);

  // The where clauses, captured from a stub client — the exact objects the
  // routes hand Prisma.
  const capture = [];
  // Both delegates the store requires are present, so callStoreState() says ready.
  const stub = {
    salesCallAttempt: {
      count: async (args) => (capture.push(["count", args.where]), 0),
      findMany: async (args) => (capture.push(["findMany", args.where]), []),
    },
    salesRepActivity: { findMany: async () => [] },
  };
  const carries = (where) => Array.isArray(where?.AND) && where.AND.includes(TEST_DIAL_EXCLUSION);
  const { attemptsLast24h } = await import("@/lib/sales/calls/store");
  await attemptsLast24h("+14165550100", { now: night, client: stub }).catch(() => null);
  ok("attemptsLast24h (the cap) excludes test dials", capture.length === 1 && carries(capture[0][1]), capture);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Source: where the number is judged, written and counted");
// ═══════════════════════════════════════════════════════════════════════════

{
  const dial = decomment(read("app/api/sales/calls/route.js"));
  const iDnc = dial.indexOf("if (target.doNotContactAt)");
  const iSupp = dial.indexOf("const suppression = await firstSuppression(db, { channel: \"phone\"");
  const iTest = dial.indexOf("const testLine = isTestLine(dialTo, await loadTestLines())");
  const iReady = dial.indexOf("const readiness = salesCallReadiness({");
  ok("the dial route judges the number against the list", iTest > 0);
  ok("…AFTER do-not-contact and AFTER the suppression read — a test line never steps past either", iDnc > 0 && iSupp > 0 && iDnc < iTest && iSupp < iTest);
  ok("…about the number that will ring, and before the readiness that decides", iTest < iReady && /testLine,\s*\}\);/.test(dial.slice(iReady, iReady + 1600)));
  ok("…and the exemption is never granted on a rep's identity", !/testLine\s*=\s*[^;]*rep\.(id|email)/.test(dial));

  const store = decomment(read("lib/sales/calls/store.js"));
  ok("recordDial freezes readiness.jurisdiction.code into the row — which is \"test\" for a test line", /jurisdictionCode: readiness\.jurisdiction\?\.code \|\| null,/.test(store));

  const queue = decomment(read("app/api/sales/queue/route.js"));
  ok("the queue route decides testLine server-side for the current pane and re-passes it in callingContext", /const testLine = isTestLine\(dialNumber, testLines\);/.test(queue) && /windowPolicy: windowPolicyFor\(full, policyContext\),\s*testLine,/.test(queue) && /attemptsLast24h: attempts24h,\s*testLine,/.test(queue));
  ok("…and flags list rows for the window grouping", /testLine: isTestLine\(p\.phoneE164, testLines\),/.test(queue));
  const queuePage = decomment(read("app/sales/queue/page.js"));
  const leadPage = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the queue screen re-passes only the literal true", /testLine: ctx\.testLine === true,/.test(queuePage));
  ok("…and so does the lead screen", /testLine: call\.callingContext\.testLine === true,/.test(leadPage));
  const leadRoute = decomment(read("app/api/sales/leads/[id]/route.js"));
  ok("the lead route decides it against the setting, twice (GET and PATCH)", (leadRoute.match(/testLine: isTestLine\(leadPhoneE164\(lead\), await loadTestLines\(\)\)/g) || []).length === 2);

  // Every count of work carries the exclusion.
  for (const [file, pattern, n] of [
    ["lib/sales/funnelData.js", /salesCallAttempt\.findMany\(\{\s*where: excludingTestDials\(/, 1],
    ["lib/sales/agency.js", /salesCallAttempt\.findMany\(\{\s*where: excludingTestDials\(/, 1],
    ["lib/sales/calls/floorBoard.js", /salesCallAttempt\.findMany\(\{\s*where: excludingTestDials\(/, 1],
    ["app/api/sales/badges/route.js", /salesCallAttempt\.count\(\{ where: excludingTestDials\(\{ salesRepId: rep\.id, direction: "out"/, 1],
    ["lib/sales/calls/store.js", /where: excludingTestDials\(\{ toE164: phone, direction: "out"/, 1],
  ]) {
    ok(`${file} counts through excludingTestDials`, (decomment(read(file)).match(new RegExp(pattern.source, "g")) || []).length >= n);
  }
  const growth = decomment(read("lib/platform/growthMeasured.js"));
  ok("growthMeasured: every Prisma count of attempts carries the exclusion", (growth.match(/salesCallAttempt\.count\(\{ where: excludingTestDials\(/g) || []).length === 7 && !/salesCallAttempt\.count\(\{ where: \{/.test(growth));
  ok("…both raw SQL counts AND in the clause", (growth.match(/AND \$\{notTest\}/g) || []).length === 2 && /Prisma\.raw\(TEST_DIAL_SQL_EXCLUSION\)/.test(growth));
  ok("…and the agreed-on-call read too", /where: excludingTestDials\(\{ direction: "out", disposition: AGREED_CODE \}\)/.test(growth));
  const reporting = decomment(read("lib/sales/calls/reporting.js"));
  ok("reporting.js drops test rows in repCallStats, teamCallRows and campaignCallRows", (reporting.match(/withoutTestDials\(attempts\)/g) || []).length === 3);

  // The console.
  const route = decomment(read("app/api/platform/sales/test-lines/route.js"));
  ok("the platform route reads for any admin and writes for a superadmin only", /getCurrentPlatformAdmin\(request\)/.test(route) && /superadminOrRefusal\(request\)/.test(route) && /export async function PUT/.test(route) && !/export async function DELETE/.test(route));
  ok("…refuses a number the normaliser would drop rather than saving short", /rejected\.length/.test(route) && /Not a number that can be dialled/.test(route));
  ok("…and logs the list before and after", /action: "sales_test_lines_updated"/.test(route) && /details: \{ before, after \}/.test(route));
  ok("the audit action has wording", Boolean(AUDIT_ACTIONS.sales_test_lines_updated) && AUDIT_ACTIONS.sales_test_lines_updated.tone === "danger");
  const page = decomment(read("app/platform/sales/windows/page.js"));
  ok("the Calling windows page carries the card and fetches the route", /<TestLinesCard canEdit=\{isSuperadmin\} \/>/.test(page) && (page.match(/"\/api\/platform\/sales\/test-lines"/g) || []).length === 2);
  ok("…asks before adding a number and says whose phone belongs here", /Only a phone FieldQuo itself owns belongs here/.test(page));
  const storeMod = decomment(read("lib/sales/testLinesStore.js"));
  ok("a failed read is an empty list — no number is exempt", /return \[\];/.test(storeMod) && /no number is exempt/.test(read("lib/sales/testLinesStore.js")));

  // No per-account bypass, anywhere.
  const { execSync } = await import("node:child_process");
  const hits = execSync("grep -rl 'emilio.daniel.boves' lib app middleware.js 2>/dev/null || true", { cwd: ROOT }).toString().trim();
  ok("no file under lib/ or app/ names the owner's rep account — the exemption is on the number", hits === "", hits);
  ok("SalesCallAttempt gained no column for this — the existing code says it", !/testLine/.test(read("prisma/schema.prisma")));

  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-test-line is wired", typeof pkg.scripts["check:sales-test-line"] === "string" && /npm run check:sales-test-line\b/.test(pkg.scripts["check:all"]));
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
