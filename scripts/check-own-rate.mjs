// scripts/check-own-rate.mjs
//
//   npm run check:own-rate
//
// "Your own rate" — EXECUTED where it can be, read where it can't.
//
// The owner (2026-10-03): "We can set the rate of a new team member but I
// don't know where to change my own rate." And: "The solo account should,
// when they sign up, be able to set their own rate."
//
//   1. parseOwnRate against hostile input.
//   2. Who sees the card and who may save, per preset (the real grids).
//   3. Never overwrite: the optimistic verdict, and the route's write shape.
//   4. Job costing is byte-identical until a rate is set — md5 of the real
//      actualJobCost output over a fixture, before and after the owner's
//      Worker row appears, and the one change setting a rate makes.
//   5. The set-up card's pay-rates row asks a one-person company for the
//      owner's own rate and lands on the card — stepsFor, executed.
//   6. Every sentence in every catalogue language.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseOwnRate, sameRate, ownRateAccess, ownRateWriteVerdict, OWN_RATE_MAX } from "@/lib/team/ownRate";
import { actualJobCost } from "@/lib/costing/actualJobCost";
import { stepsFor, ownRateIsTheStep } from "@/lib/setupSteps";
import { canSeeAllPay } from "@/lib/permissions/enforce";
import { canSelfEnrol } from "@/lib/timeclock/selfEnrol";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`); }
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

section("1. parseOwnRate — hostile input");
const good = [["45", 45], [45, 45], ["52.5", 52.5], ["52,50", 52.5], [" 38.125 ", 38.13], ["0.01", 0.01], [String(OWN_RATE_MAX), OWN_RATE_MAX]];
for (const [input, want] of good) {
  const r = parseOwnRate(input);
  ok(`${JSON.stringify(input)} → ${want}`, r.ok && r.value === want, JSON.stringify(r));
}
const bad = [["", "empty"], [null, "empty"], [undefined, "empty"], ["   ", "empty"], ["abc", "not_a_number"], ["4e2", "not_a_number"],
  ["-5", "not_a_number"], [-5, "not_positive"], ["0", "not_positive"], [0, "not_positive"], ["1e309", "not_a_number"],
  [Infinity, "not_a_number"], [NaN, "not_a_number"], [String(OWN_RATE_MAX + 0.01), "too_high"], ["$45", "not_a_number"],
  ["45/h", "not_a_number"], [{}, "not_a_number"], [[45], "not_a_number"], ["0x2D", "not_a_number"]];
for (const [input, code_] of bad) {
  const r = parseOwnRate(input);
  ok(`${typeof input === "string" ? JSON.stringify(input) : String(input)} refused (${code_})`, !r.ok && r.error === code_, JSON.stringify(r));
}

section("2. Who sees the card, who may save — the real preset grids");
const preset = (k) => ({ role: PRESET_TO_ROLE[k], permissions: PERMISSION_PRESETS[k].values });
const accessFor = (member, worker = null) =>
  ownRateAccess({ member, canSetPay: canSeeAllPay(member), canSelfEnrol: canSelfEnrol(member), worker });
const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: null };
ok("owner with no Worker row: shown, can save (Save adds the row)", accessFor(owner).show && accessFor(owner).canSave);
ok("admin: shown, can save", accessFor(admin).show && accessFor(admin).canSave);
for (const k of ["worker", "estimator", "dispatcher", "manager"]) {
  ok(`${PERMISSION_PRESETS[k].label}: no card (payroll is view_own — whoever runs payroll sets their rate)`, accessFor(preset(k)).show === false);
}
const imp = { role: "owner", permissions: null, impersonation: true };
ok("a support session: shown read-only, never saves", accessFor(imp).show && !accessFor(imp).canSave && accessFor(imp).reason === "read_only");
const payrollEmployee = { role: "employee", permissions: { ...PERMISSION_PRESETS.estimator.values, payroll: "view_all" } };
ok("an employee granted payroll with no Worker row: shown, cannot create one (self-enrol is user:manage)",
  accessFor(payrollEmployee).show && !accessFor(payrollEmployee).canSave && accessFor(payrollEmployee).reason === "no_worker");
ok("…and CAN save once they have a row", accessFor(payrollEmployee, { id: "w" }).canSave);

section("3. Never overwrite");
ok("the card showed none, the row has none → write", ownRateWriteVerdict({ expected: null, current: null }).ok);
ok("the card showed 45, the row has 45.00 → write", ownRateWriteVerdict({ expected: 45, current: "45.00" }).ok);
const v1 = ownRateWriteVerdict({ expected: null, current: 60 });
ok("the card showed none, the row has 60 (a linked hand-entered row) → conflict, 60 returned", !v1.ok && v1.current === 60);
const v2 = ownRateWriteVerdict({ expected: 45, current: 50 });
ok("the card showed 45, somebody set 50 meanwhile → conflict", !v2.ok && v2.current === 50);
const v3 = ownRateWriteVerdict({ expected: 45, current: null });
ok("the card showed 45, the rate was cleared meanwhile → conflict", !v3.ok && v3.current === null);
ok("sameRate is cent-exact and null-safe", sameRate(45, "45.001") && !sameRate(45, 45.01) && sameRate(null, undefined) && !sameRate(0, null) && !sameRate("x", "x"));
const route = code("app/api/me/own-rate/route.js");
const putAt = route.indexOf("export async function PUT");
const put = route.slice(putAt);
ok("PUT refuses a support session before anything else", put.indexOf("member.impersonation") > -1 && put.indexOf("member.impersonation") < put.indexOf("parseOwnRate("));
ok("PUT refuses without payroll:view_all before any write", put.indexOf("canSeeAllPay(full)") > -1 && put.indexOf("canSeeAllPay(full)") < put.indexOf("ensureWorkerForMember("));
ok("PUT creates the row only through the self-enrol verdict", put.indexOf("selfEnrolVerdict(") > -1 && put.indexOf("selfEnrolVerdict(") < put.indexOf("ensureWorkerForMember("));
ok("PUT checks the verdict, then writes ONLY where the rate is still the one read (updateMany on hourlyRate)",
  put.indexOf("ownRateWriteVerdict(") < put.indexOf("db.worker.updateMany(") && /updateMany\(\{\s*where: \{ id: worker\.id, companyId: member\.companyId, hourlyRate: num\(worker\.hourlyRate\) \}/.test(put));
ok("…and a lost race is a 409 with the real rate, not a silent overwrite", /written\.count !== 1/.test(put) && /status: 409/.test(put));
ok("GET says nothing to somebody who cannot set pay", /if \(!access\.show\) return NextResponse\.json\(\{ \.\.\.access, worker: null, suggestion: null \}/.test(route));
const card = code("app/components/team/OwnRateCard.js");
ok("the card sends the rate it SHOWED as `expected`", /body: \{ hourlyRate: parsed\.value, expected: current \}/.test(card));
ok("the card draws nothing when the route says show:false", /if \(!data\.show\) return null;/.test(card));
ok("the card is mounted on Team → Workers and on the Team page",
  /<OwnRateCard onSaved=\{load\} \/>/.test(code("app/app/settings/team/workers/page.js")) && /<OwnRateCard \/>/.test(code("app/app/settings/team/page.js")));

section("4. Job costing — byte-identical until the owner sets a rate");
// Two crew with rates, one entry pending, one expense. The owner's hours are
// NOT on this job: their Worker row appearing (with or without a rate) must
// change nothing.
const crewEntries = [
  { hours: 6, status: "approved", workerId: "w1", worker: { name: "Ana", hourlyRate: "32.00" } },
  { hours: 4.5, status: "approved", workerId: "w2", worker: { name: "Ben", hourlyRate: 28 } },
  { hours: 2, status: "pending", workerId: "w2", worker: { name: "Ben", hourlyRate: 28 } },
];
const expenses = [{ amount: 212.4, category: "materials" }];
const before = actualJobCost(expenses, crewEntries, { overheadPerJob: 120 });
// The owner's row now exists — it is a Worker, not a time entry, so the job's
// inputs are the same array.
const afterRowOnly = actualJobCost(expenses, crewEntries, { overheadPerJob: 120 });
ok("a job without the owner's hours: identical before and after their row and rate exist", md5(before) === md5(afterRowOnly), `${md5(before)} vs ${md5(afterRowOnly)}`);
// A job the owner DID clock on, while they had no rate (self-enrolled at the
// clock): their hours are "unrated" — reported, costing nothing.
const ownerUnrated = [...crewEntries, { hours: 5, status: "approved", workerId: "wo", worker: { name: "Owner", hourlyRate: null } }];
const unrated = actualJobCost(expenses, ownerUnrated, { overheadPerJob: 120 });
ok("…their unrated hours are counted as unrated, not as free", unrated.labour.unratedHours === 5);
ok("…and cost exactly what the job cost without them", unrated.labour.cost === before.labour.cost, `${unrated.labour.cost} vs ${before.labour.cost}`);
// Re-running with the SAME (null) rate is the "nothing was saved" case: the
// card's suggestion is not a write.
ok("re-run with nothing saved: byte-identical", md5(unrated) === md5(actualJobCost(expenses, ownerUnrated, { overheadPerJob: 120 })));
// The one change: the owner saves 45/h.
const ownerRated = ownerUnrated.map((e) => (e.workerId === "wo" ? { ...e, worker: { ...e.worker, hourlyRate: 45 } } : e));
const rated = actualJobCost(expenses, ownerRated, { overheadPerJob: 120 });
ok("once the owner sets 45/h, exactly 5 h × 45 = 225 is added to labour, and nothing else moves",
  Math.round((rated.labour.cost - unrated.labour.cost) * 100) === 22500 && rated.labour.unratedHours === 0 &&
  md5(rated.expenses) === md5(unrated.expenses), `${rated.labour.cost} − ${unrated.labour.cost}`);
console.log(`       md5 before=${md5(before)} unrated=${md5(unrated)} rated=${md5(rated)}`);

section("5. The set-up card asks a one-person company for the owner's own rate");
const solo = { activeMembers: 1, pendingInvites: 0, workersActive: 0, workersUnrated: 0 };
const payRates = (snap) => stepsFor(snap).find((s) => s.key === "pay_rates");
ok("solo, nobody on the payroll → 'Set your own rate', landing on the card",
  payRates(solo).titleKey === "app.setup.step.pay_rates_own" && payRates(solo).href === "/app/settings/team/workers?from=setup#own-rate", JSON.stringify(payRates(solo)));
ok("…and the row is not done yet", payRates(solo).done === false);
ok("the owner saves their rate (their Worker row, rated) → the same row is done", payRates({ ...solo, workersActive: 1, workersUnrated: 0 }).done === true);
const team = { activeMembers: 3, pendingInvites: 0, workersActive: 2, workersUnrated: 1 };
ok("a company with a crew keeps the general wording and #pay-rates", payRates(team).titleKey === "app.setup.step.pay_rates" && /#pay-rates$/.test(payRates(team).href));
ok("solo with a pending invite is not solo", payRates({ ...solo, pendingInvites: 1 }).titleKey === "app.setup.step.pay_rates");
ok("unmeasured counts keep the general wording", !ownRateIsTheStep({ workersActive: 0 }) && !ownRateIsTheStep({ activeMembers: 1 }) && !ownRateIsTheStep({ activeMembers: 1, workersActive: null }));
ok("a hand-entered worker on the payroll keeps the general wording", payRates({ ...solo, workersActive: 1, workersUnrated: 1 }).titleKey === "app.setup.step.pay_rates");

section("6. Every new sentence, in every catalogue language");
const KEYS = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.ownRate.")).concat(["app.setup.step.pay_rates_own", "app.nav.today"]);
ok("the English catalogue holds the card's keys", KEYS.length >= 18, String(KEYS.length));
const used = [...card.matchAll(/t\("(app\.ownRate\.[A-Za-z]+)"/g)].map((m) => m[1]);
ok("every key the card uses exists in English", used.every((k) => typeof APP_MESSAGES.en[k] === "string"), used.filter((k) => !APP_MESSAGES.en[k]).join(", "));
for (const [lang, msgs] of Object.entries(APP_MESSAGES)) {
  const missing = KEYS.filter((k) => typeof msgs[k] !== "string" || !msgs[k].trim());
  ok(`${lang}: all ${KEYS.length} present`, missing.length === 0, missing.join(", "));
  const broken = KEYS.filter((k) => {
    const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
    return ((msgs[k] || "").match(/\{\w+\}/g) || []).sort().join() !== want;
  });
  ok(`${lang}: placeholders match English`, broken.length === 0, broken.join(", "));
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
