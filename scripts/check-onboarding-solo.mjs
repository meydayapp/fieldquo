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
// ══ What is asserted, and how ══════════════════════════════════════════════
//
// By EXECUTING getOnboardingStatus() against fixture rows, not by reading it.
// The claims here — "the step is absent", "complete is reachable", "the date
// is stamped once and never moved" — are all properties of a step array built
// from five queries and one conditional write. A regex over the source can
// pass on the version that doesn't do it; that is how the original bug lived
// through several sweeps of this file.
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
 * A company with every step but "team" already satisfied.
 *
 * Deliberately the FINISHED state: the interesting question is whether the one
 * remaining step is reachable, and padding the fixture with half-done
 * branding would only hide that behind a second unfinished item.
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
section("The bug: a solo company with everything else done");

{
  scenario({ company: soloCompany() });
  const status = await getOnboardingStatus(COMPANY_ID);

  ok("the team step is there and unticked", stepFor(status, "team")?.done === false);
  ok("every other step is ticked",
    status.steps.filter((s) => !s.done).length === 1);
  ok("...and complete is FALSE — the state this check exists for",
    status.complete === false);
  ok("...at 6 of 7, which is where a solo contractor sat permanently",
    status.percent === 86);
  ok("nothing was stamped, because nothing completed", companyWrites().length === 0);
}

// ───────────────────────────────────────────────────────────────────────────
section("The answer: worksAloneAt removes the step ENTIRELY");

{
  scenario({ company: soloCompany({ worksAloneAt: new Date("2026-08-30") }) });
  const status = await getOnboardingStatus(COMPANY_ID);

  // Absent, not greyed out and not auto-ticked. A step nobody can finish is
  // worse than no step; a step nobody can get rid of is the same bug wearing
  // a hat — the tax step's own comment, applied to the one beside it.
  ok("no team step in the array at all", !stepKeys(status).includes("team"));
  ok("...and none of the others went with it",
    stepKeys(status).join(",") ===
      "logo,business_info,services,pricing,payments,tax_registration");
  ok("complete is TRUE — reachable for a one-person shop", status.complete === true);
  ok("...at 100%", status.percent === 100);
  // The claim removes a STEP, never a requirement. A solo company with no
  // logo is still a company with no logo.
  const half = scenario({
    company: soloCompany({ worksAloneAt: new Date(), logoUrl: null }),
  });
  const partial = await getOnboardingStatus(COMPANY_ID);
  ok("it is not a shortcut: an unfinished step still blocks complete",
    partial.complete === false && half.onboardingCompletedAt == null);
  ok("...and the team step is still absent while the rest is unfinished",
    !stepKeys(partial).includes("team"));
}

// ───────────────────────────────────────────────────────────────────────────
section("Hiring later: the roster is the fact, worksAloneAt is only the claim");

{
  // Nobody clears the column when an invite goes out — deliberately. Clearing
  // it would destroy the record of when the owner said it, and would leave the
  // owner with an untickable step again the day that hire leaves.
  scenario({ company: soloCompany({ worksAloneAt: new Date() }), members: 2 });
  const hired = await getOnboardingStatus(COMPANY_ID);
  ok("an accepted second member brings the step back", stepKeys(hired).includes("team"));
  ok("...already ticked, because by then it is true",
    stepFor(hired, "team")?.done === true);
  ok("...and complete stays true", hired.complete === true);

  scenario({ company: soloCompany({ worksAloneAt: new Date() }), members: 1, pending: 1 });
  const invited = await getOnboardingStatus(COMPANY_ID);
  ok("a pending invitation counts the same — the seat is spoken for",
    stepKeys(invited).includes("team") && stepFor(invited, "team")?.done === true);

  // The other direction, which is why the column is not cleared on hire.
  scenario({ company: soloCompany({ worksAloneAt: new Date() }), members: 1 });
  rows.member.push({ id: "m_gone", companyId: COMPANY_ID, active: false });
  const soloAgain = await getOnboardingStatus(COMPANY_ID);
  ok("a deactivated member does not count, so a solo-again owner is solo again",
    !stepKeys(soloAgain).includes("team") && soloAgain.complete === true);
}

// ───────────────────────────────────────────────────────────────────────────
section("Seat counts still read the way they did");

{
  scenario({
    company: soloCompany({ worksAloneAt: null }),
    members: 2,
    pending: 1,
    plan: { name: "Crew", maxUsers: 5 },
  });
  const status = await getOnboardingStatus(COMPANY_ID);
  ok("seatsUsed counts members plus pending invites", status.seatsUsed === 3);
  ok("seatsRemaining is what the plan has left", status.seatsRemaining === 2);
  ok("the label still names the licence count",
    stepFor(status, "team")?.label === "Invite your team (3/5 licenses used)");
}

// ───────────────────────────────────────────────────────────────────────────
section("onboardingCompletedAt: stamped once, on the transition, never moved");

{
  const company = scenario({ company: soloCompany({ worksAloneAt: new Date() }) });
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
  const company = scenario({ company: soloCompany() }); // one step short
  await getOnboardingStatus(COMPANY_ID);
  ok("an incomplete company is never stamped",
    companyWrites().length === 0 && company.onboardingCompletedAt === null);
}

{
  const old = new Date("2026-01-05T09:00:00Z");
  const company = scenario({
    company: soloCompany({ worksAloneAt: new Date(), onboardingCompletedAt: old }),
  });
  await getOnboardingStatus(COMPANY_ID);
  ok("an already-stamped company is left alone",
    companyWrites().length === 0 && company.onboardingCompletedAt === old);
}

{
  // Two dashboard loads landing together, which is the everyday version of
  // this race: the browser refetches on mount and after adding an employee.
  const company = scenario({ company: soloCompany({ worksAloneAt: new Date() }) });
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
section("The control is in Settings, and it is wired to something");

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

  const CARD = codeOf("../app/components/dashboard/OnboardingProgress.js");
  ok("the dashboard card carries no dismiss control of its own",
    !/step\.dismissible/.test(CARD) && !/method: "POST"/.test(CARD));

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
console.log(`ALL PASS (${pass}) — a one-person shop can finish onboarding, and the day they did is on record`);
