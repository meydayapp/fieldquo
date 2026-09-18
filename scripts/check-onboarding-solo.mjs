// scripts/check-onboarding-solo.mjs
//
// A one-person company could never finish onboarding. Not "rarely" —
// impossible.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// lib/onboarding.js built seven steps and reported `complete: doneCount ===
// steps.length`. One of the seven was "Invite your team", `done: seatsUsed >
// 1`, where seatsUsed is active members plus pending invitations. A van-run
// solo painter has exactly one, forever, so `complete` was never true for
// them — and app/components/dashboard/OnboardingProgress.js hides the card
// only on `status.complete`. The result was a permanent checklist on the
// dashboard of a core FieldQuo customer, carrying one item they could tick
// only by paying for a seat and inviting somebody who doesn't exist. AGENTS.md
// calls a control that appears to work and doesn't the worst thing to ship;
// this is its cousin, a task that appears completable and isn't.
//
// The first answer (2026-08-30) was Company.worksAloneAt — "it's just me",
// ticked in Team Settings — which took the step off the list. The second
// (2026-09-18, the owner: "the on-boarding steps have add employee. That
// should be moved to the additional steps as it can be marked as done without
// leaving the window") took the step off the onboarding card altogether and
// put it on the "Additional set-up steps" card (lib/setupSteps.js), where the
// Add Employee popup now lives and where the works-alone claim is still
// honoured. So the claim this file makes is now the simple one: onboarding
// NEVER carries a team step, for anybody, and a solo company with everything
// else done is complete — with or without the checkbox.
//
// ══ What is asserted, and how ══════════════════════════════════════════════
//
// By EXECUTING getOnboardingStatus() against fixture rows, not by reading it.
// The claims here — "there is no team step", "complete is reachable", "the
// date is stamped once and never moved" — are all properties of a step array
// built from three queries and one conditional write. A regex over the source
// can pass on the version that doesn't do it; that is how the original bug
// lived through several sweeps of this file.
//
// @/lib/db resolves to scripts/fixtures/dbStub.mjs, which records every write.
// Everything else is the shipped module.
//
// Run: node --import ./scripts/alias-loader.mjs \
//           --import ./scripts/db-stub-loader.mjs scripts/check-onboarding-solo.mjs

import { readFileSync } from "node:fs";
import { getOnboardingStatus } from "@/lib/onboarding";
import { rows, writes, resetDbStub } from "@/lib/db";

let pass = 0;
const fails = [];
const ok = (label, cond) =>
  cond ? (pass++, console.log(`  ok   ${label}`)) : fails.push(label);
const section = (title) => console.log(`\n${title}\n`);

const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
// This file's own prose names every symbol it asserts about, so the source
// checks at the bottom read code only. Line-based for the reason
// check-route-callers.mjs gives: a lazy block-comment regex eats JSX.
const codeOf = (r) =>
  read(r)
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      return !(l.startsWith("//") || l.startsWith("*") || l.startsWith("/*"));
    })
    .join("\n");

const COMPANY_ID = "co_1";

/**
 * A company with every onboarding step satisfied and nobody else on the
 * roster — the van-run solo painter.
 *
 * Deliberately the FINISHED state: the interesting question is whether that
 * company is complete, and padding the fixture with half-done branding would
 * only hide the answer behind an unfinished item.
 */
function soloCompany(extra = {}) {
  return {
    id: COMPANY_ID,
    logoUrl: "https://example.com/logo.png",
    phone: "555-0100",
    address: "12 Bay St",
    city: "Toronto",
    province: "ON",
    country: "CA",
    stripeChargesEnabled: true,
    taxIdNumber: "123456789 RT0001",
    taxRegistrationDismissedAt: null,
    worksAloneAt: null,
    onboardingCompletedAt: null,
    ...extra,
  };
}

/** One enabled, priced service — the "services" and "pricing" steps. */
const PRICED_CATEGORY = {
  companyId: COMPANY_ID,
  enabled: true,
  defaultRate: 65,
  category: { key: "painting" },
};

function scenario({ company, members = 1, pending = 0, plan = null, categories = [PRICED_CATEGORY] }) {
  resetDbStub();
  rows.company = [company];
  rows.companyServiceCategory = categories;
  rows.member = Array.from({ length: members }, (_, i) => ({
    id: `m_${i}`,
    companyId: COMPANY_ID,
    active: true,
  }));
  rows.pendingTeamProfile = Array.from({ length: pending }, (_, i) => ({
    id: `p_${i}`,
    companyId: COMPANY_ID,
  }));
  rows.subscription = plan ? [{ companyId: COMPANY_ID, plan }] : [];
  return company;
}

const stepKeys = (status) => status.steps.map((s) => s.key);
const stepFor = (status, key) => status.steps.find((s) => s.key === key) || null;
const companyWrites = () =>
  writes.filter((w) => w.model === "company" && w.action !== "create");

// ───────────────────────────────────────────────────────────────────────────
section("A solo company with everything else done is complete — no team step");

const NO_TEAM_KEYS = "logo,business_info,services,pricing,payments,tax_registration";

{
  scenario({ company: soloCompany() });
  const status = await getOnboardingStatus(COMPANY_ID);

  ok("no team step in the array at all", !stepKeys(status).includes("team"));
  ok("...and the six that belong are all there, in order",
    stepKeys(status).join(",") === NO_TEAM_KEYS);
  ok("every step is ticked", status.steps.every((s) => s.done));
  ok("...and complete is TRUE for a one-person shop, with no checkbox ticked",
    status.complete === true);
  ok("...at 100%", status.percent === 100);
  ok("no plan name or seat figures ride along — nothing on the card reads them",
    !("plan" in status) && !("seatsUsed" in status) && !("seatsRemaining" in status));
}

// ───────────────────────────────────────────────────────────────────────────
section("Not a shortcut: the other steps still gate complete");

{
  const half = scenario({ company: soloCompany({ logoUrl: null }) });
  const partial = await getOnboardingStatus(COMPANY_ID);
  ok("an unfinished step still blocks complete",
    partial.complete === false && half.onboardingCompletedAt == null);
  ok("...at 5 of 6", partial.percent === 83);
  ok("...and there is still no team step to blame", !stepKeys(partial).includes("team"));

  // Before the move a company could be incomplete ONLY because of the team
  // row. That company is complete now — the owner's ask, not a regression.
  scenario({ company: soloCompany({ worksAloneAt: null }), members: 1, pending: 0, plan: { name: "Solo", maxUsers: 6 } });
  const wasBlockedByTeam = await getOnboardingStatus(COMPANY_ID);
  ok("a company that was incomplete only because of the team row is complete now",
    wasBlockedByTeam.complete === true);
}

// ───────────────────────────────────────────────────────────────────────────
section("The roster and the claim no longer change the onboarding answer");

{
  // Every combination that used to add, remove or tick the team step. None
  // of them may touch the onboarding array now — the step lives on the
  // set-up card (lib/setupSteps.js), which reads these same rows itself.
  const cases = [
    ["worksAloneAt set", { company: soloCompany({ worksAloneAt: new Date("2026-08-30") }) }],
    ["a second member", { company: soloCompany(), members: 2 }],
    ["a pending invitation", { company: soloCompany(), members: 1, pending: 1 }],
    ["worksAloneAt AND a second member", { company: soloCompany({ worksAloneAt: new Date() }), members: 2 }],
    ["a plan with seats to spare", { company: soloCompany(), plan: { name: "Crew", maxUsers: 5 } }],
    ["a one-seat plan, full", { company: soloCompany(), plan: { name: "Legacy", maxUsers: 1 } }],
  ];
  for (const [label, args] of cases) {
    scenario(args);
    const status = await getOnboardingStatus(COMPANY_ID);
    ok(`${label}: same six steps, complete`,
      stepKeys(status).join(",") === NO_TEAM_KEYS && status.complete === true);
  }

  // A deactivated member used to matter (a solo-again owner was solo again).
  // It still may not change anything here.
  scenario({ company: soloCompany(), members: 1 });
  rows.member.push({ id: "m_gone", companyId: COMPANY_ID, active: false });
  const soloAgain = await getOnboardingStatus(COMPANY_ID);
  ok("a deactivated member changes nothing either",
    stepKeys(soloAgain).join(",") === NO_TEAM_KEYS && soloAgain.complete === true);
}

// ───────────────────────────────────────────────────────────────────────────
section("onboardingCompletedAt: stamped once, on the transition, never moved");

{
  const company = scenario({ company: soloCompany() });
  const before = Date.now();
  await getOnboardingStatus(COMPANY_ID);

  const stamps = companyWrites();
  ok("exactly one write when completeness flips", stamps.length === 1);
  ok("...an updateMany, not an update", stamps[0]?.action === "updateMany");
  // The whole race defence. A findUnique-then-update in this process would
  // let two dashboard loads both stamp; the null in the WHERE makes Postgres
  // the arbiter, and the second UPDATE matches no row.
  ok("...guarded on the column still being null",
    stamps[0]?.where?.onboardingCompletedAt === null &&
      stamps[0]?.where?.id === COMPANY_ID);
  ok("...writing a real date", stamps[0]?.data?.onboardingCompletedAt instanceof Date);
  ok("...of now", stamps[0]?.data?.onboardingCompletedAt.getTime() >= before);
  ok("the column now holds it", company.onboardingCompletedAt instanceof Date);

  const stamped = company.onboardingCompletedAt;
  writes.length = 0;
  await getOnboardingStatus(COMPANY_ID);
  await getOnboardingStatus(COMPANY_ID);
  ok("re-reading does not write again — this runs on every page load",
    companyWrites().length === 0);
  ok("...and the date has not moved", company.onboardingCompletedAt === stamped);

  // A step regressing (Stripe disconnected, say) makes the checklist come
  // back. The day they finished still happened.
  company.stripeChargesEnabled = false;
  writes.length = 0;
  const regressed = await getOnboardingStatus(COMPANY_ID);
  ok("a later regression un-completes the checklist", regressed.complete === false);
  ok("...without clearing or moving the date",
    company.onboardingCompletedAt === stamped && companyWrites().length === 0);
}

{
  const company = scenario({ company: soloCompany({ stripeChargesEnabled: false }) }); // one step short
  await getOnboardingStatus(COMPANY_ID);
  ok("an incomplete company is never stamped",
    companyWrites().length === 0 && company.onboardingCompletedAt === null);
}

{
  const old = new Date("2026-01-05T09:00:00Z");
  const company = scenario({
    company: soloCompany({ onboardingCompletedAt: old }),
  });
  await getOnboardingStatus(COMPANY_ID);
  ok("an already-stamped company is left alone",
    companyWrites().length === 0 && company.onboardingCompletedAt === old);
}

{
  // Two dashboard loads landing together, which is the everyday version of
  // this race: the browser refetches on mount and on every return to home.
  const company = scenario({ company: soloCompany() });
  await Promise.all([
    getOnboardingStatus(COMPANY_ID),
    getOnboardingStatus(COMPANY_ID),
  ]);
  const attempted = companyWrites();
  const winner = attempted[0]?.data?.onboardingCompletedAt;
  ok("both requests may TRY — the guard is in the WHERE, not in this process",
    attempted.every((w) => w.where?.onboardingCompletedAt === null));
  ok("...but only the first one lands: the date is the winner's",
    company.onboardingCompletedAt === winner);
}

// ───────────────────────────────────────────────────────────────────────────
section("The control is in Settings, and it is wired to something — on the set-up card now");

{
  // Executable checks stop at the module boundary; these three are the "does
  // the button do the thing" half. See ask-whether-a-route-has-a-caller: every
  // check proving code correct proves nothing about it being reached.
  const TEAM = codeOf("../app/app/settings/team/page.js");
  ok("Settings > Team renders the checkbox",
    /t\("app\.setTeam\.worksAlone"\)/.test(TEAM));
  ok("...which saves through the same route the tax answer uses",
    /"\/api\/settings\/business-info"[\s\S]{0,300}worksAlone: next/.test(TEAM));
  ok("...and hides once anybody else is on the roster",
    /!anyoneElse/.test(TEAM));

  const BIZ = codeOf("../app/api/settings/business-info/route.js");
  ok("PATCH business-info writes the column",
    /worksAloneAt: worksAlone \? new Date\(\) : null/.test(BIZ));
  ok("...and GET returns it, so the checkbox can render its own state",
    /worksAloneAt: true/.test(BIZ));

  // Where the claim is READ now. A column written and never read is the
  // first failure class in AGENTS.md; the move must not have orphaned it.
  const ONBOARDING = codeOf("../lib/onboarding.js");
  ok("lib/onboarding.js reads neither the claim nor the roster any more",
    !/worksAloneAt/.test(ONBOARDING) && !/db\.member\./.test(ONBOARDING) &&
      !/pendingTeamProfile/.test(ONBOARDING) && !/db\.subscription\./.test(ONBOARDING));
  const SNAPSHOT = codeOf("../lib/setupStepsSnapshot.js");
  ok("the set-up snapshot reads the claim in its place",
    /worksAloneAt: true/.test(SNAPSHOT) && /worksAlone: Boolean\(company\.worksAloneAt\)/.test(SNAPSHOT));
  const SETUP = codeOf("../lib/setupSteps.js");
  ok("...and the team step honours it (executed in check-setup-steps.mjs)",
    /key: "team"/.test(SETUP) && /s\.worksAlone === true/.test(SETUP));

  const CARD = codeOf("../app/components/dashboard/OnboardingProgress.js");
  ok("the dashboard card carries no dismiss control of its own",
    !/step\.dismissible/.test(CARD) && !/method: "POST"/.test(CARD));
  ok("...and no longer hosts the Add Employee popup or a team row",
    !/AddEmployeeModal/.test(CARD) && !/"team"/.test(CARD) && !/onEmployeeAdded/.test(CARD));
  ok("the set-up card hosts the popup instead",
    /AddEmployeeModal/.test(codeOf("../app/components/dashboard/SetupSteps.js")));

  const SCHEMA = read("../prisma/schema.prisma");
  ok("both columns exist in the schema",
    /worksAloneAt\s+DateTime\?/.test(SCHEMA) &&
      /onboardingCompletedAt\s+DateTime\?/.test(SCHEMA));
}

console.log("");
if (fails.length) {
  for (const f of fails) console.log(`  FAIL ${f}`);
  console.log(`\n${fails.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`ALL PASS (${pass}) — a one-person shop can finish onboarding with no team step in the way, and the day they did is on record`);
