#!/usr/bin/env node
// scripts/check-sales-agency.mjs
//
// The call-centre agency tier, executed rather than read.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-sales-agency.mjs
//
// lib/sales/agency.js quotes the owner's brief. Every clause of it is a claim
// about which rows get written, who a batch lands under, and who is refused
// — and those are properties of functions that talk to the database, so the
// shipped functions run here against scripts/fixtures/dbStub.mjs, the way
// check-influencer.mjs and check-sales-attribution.mjs do. Where a claim is
// about a ROUTE (an employee is refused before anything is read), the route
// source is decommented and read, the way check-sales-auth.mjs reads routes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rows, writes, reads, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  AGENCY_ENGAGEMENT,
  AGENCY_KIND,
  agencyEarnings,
  agencyEmployeeRefusal,
  agencyTeam,
  agencyTeamIds,
  canSeeOwnPay,
  clearSetupIfComplete,
  createAgencyRep,
  isAgency,
  isAgencyEmployee,
  payeeGroups,
  payeeIdFor,
  reinviteAgencyRep,
  repDisplayName,
  setAgencyRepActive,
  setupComplete,
} from "@/lib/sales/agency";
import { closeWeekForRep, previousWeekBounds } from "@/lib/sales/payouts";
import { batchView } from "@/lib/sales/payoutAdmin";
import { ENGAGEMENTS, payoutReadiness, payoutMethodsFor } from "@/lib/sales/payoutDetails";
import { AGENCY_TEAM_HREF, portalTabsFor } from "@/lib/sales/portalTabs";
import { boardRepWhere, floorBoard } from "@/lib/sales/calls/floorBoard";
import { NO_REP, repViewer, visibleRepIds } from "@/lib/sales/team";
import { REP_KINDS } from "@/lib/influencers";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

// No email leaves a check. sendSalesInviteEmail returns { sent: false }
// when the origin cannot be built, and never reaches Resend without a key.
delete process.env.RESEND_API_KEY;
delete process.env.NEXT_PUBLIC_APP_URL;
delete process.env.APP_URL;

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
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-16T15:00:00Z");
const AGENCY = { id: "ag_1", kind: AGENCY_KIND, name: "Northline Contact", email: "ops@northline.example", commissionPlanId: "plan_a", engagement: null, managerId: null, active: true };
const EMP = (id, name) => ({
  id,
  kind: "rep",
  name,
  email: `${id}@northline.example`,
  code: id,
  engagement: AGENCY_ENGAGEMENT,
  managerId: AGENCY.id,
  manager: { id: AGENCY.id, kind: AGENCY_KIND, name: AGENCY.name, email: AGENCY.email },
  commissionPlanId: "plan_a",
  active: true,
  endedAt: null,
  acceptedAt: NOW,
  workEmail: null,
  sellsIn: [],
  _count: { phoneNumbers: 0 },
});
const FREELANCER = { id: "rep_solo", kind: "rep", name: "Dana Solo", email: "dana@example.com", code: "dana", engagement: "freelancer", managerId: null, manager: null, active: true };

function fresh() {
  resetDbStub();
  rows.salesRep.push({ ...AGENCY, _count: { phoneNumbers: 0 } }, EMP("e1", "Ann Lee"), EMP("e2", "Bo Chen"), EMP("e3", "Cy Diaz"), { ...FREELANCER });
}

// ── 1. Vocabulary and the pure decisions ────────────────────────────────────
section("1. Who is an agency, who is an employee, who is paid");
ok("REP_KINDS carries the agency kind", REP_KINDS.includes(AGENCY_KIND));
ok("ENGAGEMENTS carries the agency engagement with its keys", ENGAGEMENTS.some((e) => e.key === AGENCY_ENGAGEMENT && e.labelKey && e.noteKey && e.accruesPaidLeave === false));
ok("isAgency is the kind, nothing else", isAgency(AGENCY) && !isAgency(EMP("x", "X")) && !isAgency(FREELANCER) && !isAgency(null));
ok("isAgencyEmployee needs the engagement AND an agency manager", isAgencyEmployee(EMP("e1", "A")) && !isAgencyEmployee({ ...EMP("e1", "A"), engagement: "freelancer" }) && !isAgencyEmployee({ ...EMP("e1", "A"), managerId: null, manager: null }) && !isAgencyEmployee({ ...EMP("e1", "A"), manager: { id: "lead", kind: "rep" } }));
ok("the payee is the agency for an employee and the rep for everyone else", payeeIdFor(EMP("e1", "A")) === AGENCY.id && payeeIdFor(FREELANCER) === FREELANCER.id && payeeIdFor(AGENCY) === AGENCY.id && payeeIdFor(null) === null);
ok("an employee cannot see their own pay; an agency and a freelancer can", !canSeeOwnPay(EMP("e1", "A")) && canSeeOwnPay(AGENCY) && canSeeOwnPay(FREELANCER));
ok("the refusal names the agency and carries the catalogue key", (() => {
  const r = agencyEmployeeRefusal(EMP("e1", "A"));
  return r?.status === 403 && r.body.error.includes("Northline Contact") && r.body.errorKey === "app.salesPay.agencyEmployeeRefusal" && r.body.agency?.id === AGENCY.id && agencyEmployeeRefusal(FREELANCER) === null && agencyEmployeeRefusal(AGENCY) === null;
})());
ok("repDisplayName appends the agency for an employee only", repDisplayName(EMP("e1", "Ann Lee")) === "Ann Lee (Northline Contact)" && repDisplayName(FREELANCER) === "Dana Solo");
ok("payoutReadiness treats the agency engagement as decided", payoutReadiness({ engagement: AGENCY_ENGAGEMENT, payoutMethod: "paypal", payoutHandle: "x" }).ready === true && payoutReadiness({ engagement: null, payoutMethod: "paypal", payoutHandle: "x" }).problems.some((p) => p.code === "no_engagement"));
ok("an agency's payout methods have no Upwork", !payoutMethodsFor(AGENCY_KIND).some((m) => m.key === "upwork") && payoutMethodsFor(AGENCY_KIND).length === 4);
ok("setupComplete needs the mailbox AND a number", !setupComplete({ workEmail: null, numberCount: 1 }) && !setupComplete({ workEmail: "a@b.c", numberCount: 0 }) && setupComplete({ workEmail: "a@b.c", numberCount: 1 }) && setupComplete({ workEmail: "a@b.c", _count: { phoneNumbers: 2 } }));

// ── 2. payeeGroups ─────────────────────────────────────────────────────────
section("2. payeeGroups — one batch per payee");
{
  const reps = [AGENCY, EMP("e1", "A"), EMP("e2", "B"), EMP("e3", "C"), FREELANCER, { id: "orphan", kind: "rep", engagement: AGENCY_ENGAGEMENT, managerId: "gone" }];
  const groups = payeeGroups(reps);
  ok("the three employees and the agency are ONE group keyed by the agency", JSON.stringify(groups.get(AGENCY.id)) === JSON.stringify([AGENCY.id, "e1", "e2", "e3"]), groups.get(AGENCY.id));
  ok("a freelancer is their own group", JSON.stringify(groups.get(FREELANCER.id)) === JSON.stringify([FREELANCER.id]));
  ok("an employee whose manager row is missing is paid as themselves, not dropped", JSON.stringify(groups.get("orphan")) === JSON.stringify(["orphan"]));
  ok("no rep appears in two groups", [...groups.values()].flat().length === new Set([...groups.values()].flat()).size);
  ok("hostile input: an empty list is an empty map", payeeGroups([]).size === 0);
}

// ── 3. The weekly close pools ──────────────────────────────────────────────
section("3. closeWeekForRep — three employees' entries → one batch under the agency");
{
  fresh();
  const { start, end } = previousWeekBounds(NOW);
  const inWeek = new Date(start.getTime() + 2 * 86_400_000);
  rows.salesCommissionEntry.push(
    { id: "c1", salesRepId: "e1", companyId: "co1", amountCents: 2000, occurredAt: inWeek, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "A Co" } },
    { id: "c2", salesRepId: "e2", companyId: "co2", amountCents: 4000, occurredAt: inWeek, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "B Co" } },
    { id: "c3", salesRepId: "e3", companyId: "co3", amountCents: 6500, occurredAt: inWeek, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "C Co" } },
    // The agency's own link earned too.
    { id: "c4", salesRepId: AGENCY.id, companyId: "co4", amountCents: 1000, occurredAt: inWeek, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "D Co" } },
    // A freelancer's entry, which must NOT be gathered.
    { id: "c5", salesRepId: FREELANCER.id, companyId: "co5", amountCents: 9999, occurredAt: inWeek, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "E Co" } },
    // An employee's entry from THIS week — outside the window.
    { id: "c6", salesRepId: "e1", companyId: "co6", amountCents: 500, occurredAt: NOW, payoutBatchId: null, status: "earned", milestone: "activation", company: { name: "F Co" } },
  );
  const groups = payeeGroups(rows.salesRep);
  const batch = await closeWeekForRep({ salesRepId: AGENCY.id, start, end, earnerIds: groups.get(AGENCY.id) });
  ok("a batch was created under the AGENCY's id", batch && batch.salesRepId === AGENCY.id, batch);
  ok("its total is the three employees' entries plus the agency's own", batch?.totalCentsAtClose === 13500, batch?.totalCentsAtClose);
  const claimed = rows.salesCommissionEntry.filter((e) => e.payoutBatchId === batch?.id).map((e) => e.id).sort();
  ok("exactly those four entries were claimed into it", JSON.stringify(claimed) === JSON.stringify(["c1", "c2", "c3", "c4"]), claimed);
  ok("the entries KEEP their own salesRepId — who earned it is still answerable", rows.salesCommissionEntry.filter((e) => e.payoutBatchId === batch?.id).every((e) => e.salesRepId !== AGENCY.id || e.id === "c4") && rows.salesCommissionEntry.find((e) => e.id === "c1").salesRepId === "e1");
  ok("the freelancer's entry and this week's entry are untouched", rows.salesCommissionEntry.find((e) => e.id === "c5").payoutBatchId === null && rows.salesCommissionEntry.find((e) => e.id === "c6").payoutBatchId === null);
  ok("no batch was created for any employee", rows.salesPayoutBatch.every((b) => b.salesRepId === AGENCY.id));
  const again = await closeWeekForRep({ salesRepId: AGENCY.id, start, end, earnerIds: groups.get(AGENCY.id) });
  // The entries are claimed, so the second run finds nothing in the window
  // and creates nothing — the cron reads that as "nothing owed". The P2002
  // path is for the race where unclaimed entries meet an existing batch.
  ok("a second run is idempotent — nothing owed, no second batch", again === null && rows.salesPayoutBatch.length === 1, again);
  ok("without earnerIds the closer reads only the rep's own entries (the freelancer's path is unchanged)", await (async () => {
    const b = await closeWeekForRep({ salesRepId: FREELANCER.id, start, end });
    return b && b.salesRepId === FREELANCER.id && b.totalCentsAtClose === 9999;
  })());

  // The platform's batch view names the earners.
  const view = batchView(rows.salesPayoutBatch[0], rows.salesCommissionEntry, AGENCY.name, { payeeKind: AGENCY_KIND, names: new Map([["e1", "Ann Lee"], ["e2", "Bo Chen"], ["e3", "Cy Diaz"], [AGENCY.id, AGENCY.name]]) });
  ok("batchView says the payee is an agency and lists a line per earner, largest first", view.isAgency && view.byEarner.length === 4 && view.byEarner[0].salesRepId === "e3" && view.byEarner[0].cents === 6500 && view.byEarner.find((l) => l.salesRepId === AGENCY.id)?.cents === 1000, view.byEarner);
  ok("…and a plain rep's batch is not an agency's", batchView(rows.salesPayoutBatch[1], rows.salesCommissionEntry, "Dana").isAgency === false);
}

// ── 4. The agency's earnings, by employee ──────────────────────────────────
section("4. agencyEarnings — the pool and the split");
{
  // Same fixture as §3, after the close.
  rows.salesPayoutBatch[0].status = "paid";
  const view = await agencyEarnings({ agency: AGENCY });
  ok("returns the pooled totals over the team and the agency's own link", view.totals.lifetimeCents === 14000, view.totals);
  ok("the freelancer's entry is not in the pool", !view.openLines.some((l) => l.salesRepId === FREELANCER.id) && view.totals.lifetimeCents !== 14000 + 9999);
  ok("this week's open line is the employee's unbatched entry", view.totals.thisWeekCents === 500);
  ok("paid = the agency's paid batch, summed from its rows", view.totals.paidCents === 13500);
  const by = Object.fromEntries(view.byEmployee.map((r) => [r.salesRepId, r]));
  ok("byEmployee has a line per employee with what THEY earned", by.e1?.earnedCents === 2500 && by.e2?.earnedCents === 4000 && by.e3?.earnedCents === 6500, view.byEmployee);
  ok("…paid / awaiting / open split per employee", by.e1?.paidCents === 2000 && by.e1?.openCents === 500 && by.e1?.awaitingCents === 0 && by.e2?.paidCents === 4000);
  ok("…the agency's own link appears because it earned", by[AGENCY.id]?.isAgency === true && by[AGENCY.id]?.earnedCents === 1000);
  ok("…and the columns add up to the totals above", view.byEmployee.reduce((s, r) => s + r.earnedCents, 0) === view.totals.lifetimeCents && view.byEmployee.reduce((s, r) => s + r.paidCents, 0) === view.totals.paidCents);
  ok("…sorted largest first", view.byEmployee[0].salesRepId === "e3");
  ok("an employee or a freelancer gets null, never a pool", (await agencyEarnings({ agency: EMP("e1", "A") })) === null && (await agencyEarnings({ agency: FREELANCER })) === null);
  ok("the agency's batches were read under the agency's id only", reads.some((r) => r.model === "salesPayoutBatch" && r.args.where?.salesRepId === AGENCY.id));
}

// ── 5. The routes refuse an employee before reading ────────────────────────
section("5. /api/sales/earnings, /api/sales/payout and /sales/pay refuse an employee");
{
  const earnings = decomment(read("app/api/sales/earnings/route.js"));
  const gate = earnings.indexOf("agencyEmployeeRefusal(rep)");
  const firstRead = earnings.indexOf("db.salesCommissionEntry.findMany");
  ok("earnings: the employee refusal runs BEFORE any ledger read", gate !== -1 && firstRead !== -1 && gate < firstRead);
  ok("earnings: the agency gets the pooled view from agencyEarnings", /isAgency\(rep\)/.test(earnings) && /agencyEarnings\(\{ agency: rep \}\)/.test(earnings));
  const payout = decomment(read("app/api/sales/payout/route.js"));
  const getBody = payout.slice(payout.indexOf("export async function GET("), payout.indexOf("export async function PUT("));
  const putBody = payout.slice(payout.indexOf("export async function PUT("));
  ok("payout GET refuses an employee before the row is read", getBody.indexOf("agencyEmployeeRefusal(rep)") !== -1 && getBody.indexOf("agencyEmployeeRefusal(rep)") < getBody.indexOf("db.salesRep.findUnique"));
  ok("payout PUT refuses an employee before the body is parsed", putBody.indexOf("agencyEmployeeRefusal(rep)") !== -1 && putBody.indexOf("agencyEmployeeRefusal(rep)") < putBody.indexOf("request.json()"));
  ok("payout offers and refuses methods BY KIND", /payoutMethodsFor\(kind\)/.test(payout) && /isPayoutMethodFor\(rep\.kind, method\)/.test(payout));
  const outreachGate = decomment(read("lib/sales/outreachGate.js"));
  ok("the write gate reads engagement, managerId and the manager, so the refusal judges a fresh row", /engagement: true/.test(outreachGate) && /managerId: true/.test(outreachGate) && /manager: \{ select: \{ id: true, kind: true, name: true/.test(outreachGate));
  const page = decomment(read("app/sales/pay/page.js"));
  ok("/sales/pay renders the refusal for an employee and neither panel", /me\?\.agencyEmployee/.test(page) && /data-agency-employee/.test(page) && /app\.salesPay\.agencyEmployeeRefusal/.test(page));
  const me = decomment(read("app/api/sales/me/route.js"));
  ok("/api/sales/me carries isAgency, agencyEmployee and agency", /isAgency: isAgency\(rep\)/.test(me) && /agencyEmployee: isAgencyEmployee\(rep\)/.test(me) && /agency: agencyOf\(rep\)/.test(me));
  const panel = decomment(read("app/components/sales/EarningsPanel.js"));
  ok("EarningsPanel draws the By employee table when byEmployee is present", /data\.byEmployee/.test(panel) && /data-by-employee/.test(panel));
}

// ── 6. The shell ───────────────────────────────────────────────────────────
section("6. The rail: Pay hidden for an employee, My team added for an agency");
{
  const tabs = [{ href: "/sales", label: "Today" }, { href: "/sales/pay", label: "Pay" }, { href: "/sales/settings", label: "Settings" }];
  ok("an employee loses Pay", portalTabsFor(tabs, { agencyEmployee: true }).map((t) => t.href).join() === "/sales,/sales/settings");
  ok("an agency gains My team, before Pay", portalTabsFor(tabs, { isAgency: true }, { teamLabel: "My team" }).map((t) => t.href).join() === `/sales,${AGENCY_TEAM_HREF},/sales/pay,/sales/settings`);
  ok("a plain rep, and an unloaded identity, get the list as declared", portalTabsFor(tabs, { isAgency: false, agencyEmployee: false }).length === 3 && portalTabsFor(tabs, null).length === 3);
  ok("hostile input does not throw", portalTabsFor("x", {}).length === 0 && portalTabsFor([null, 3, { href: 9 }], { isAgency: true }).length === 1);
  const shell = decomment(read("app/sales/SalesShell.js"));
  ok("SalesShell filters through portalTabsFor and keeps `tabs` as the name the bar receives", /const tabs = portalTabsFor\(allTabs, me/.test(shell) && /<SalesMobileTabBar tabs=\{tabs\}/.test(shell));
  ok("…and has an icon for the agency row, keyed by the same href the constant carries", shell.includes(`"${AGENCY_TEAM_HREF}": `) && AGENCY_TEAM_HREF === "/sales/agency");
}

// ── 7. createAgencyRep forces what the agency may not choose ───────────────
section("7. createAgencyRep — the forced values, the flag, the log");
{
  fresh();
  const result = await createAgencyRep({
    agency: { ...AGENCY },
    name: "Dee Ng",
    email: "Dee@Northline.example",
    sellsIn: ["fr", "en"],
    // A hostile body: every one of these must be ignored.
    kind: "agency",
    engagement: "employee",
    commissionPlanId: "plan_rich",
    managerId: "somebody_else",
  });
  ok("the rep was created", result.ok === true && result.rep?.id, result);
  const created = writes.find((w) => w.model === "salesRep" && w.action === "create")?.data;
  ok("kind is rep, engagement is agency, manager is the agency, plan is the agency's — whatever the caller sent", created?.kind === "rep" && created?.engagement === AGENCY_ENGAGEMENT && created?.managerId === AGENCY.id && created?.commissionPlanId === AGENCY.commissionPlanId, created);
  ok("the email is lower-cased and the languages kept", created?.email === "dee@northline.example" && JSON.stringify(created?.sellsIn) === '["fr","en"]');
  ok("setupRequestedAt is stamped", created?.setupRequestedAt instanceof Date);
  ok("an invite token is issued (hash stored, never the token)", typeof created?.inviteTokenHash === "string" && created.inviteTokenHash.length > 20 && !("inviteToken" in created));
  ok("the owner is flagged: an error-log line names the agency, the rep and the console", (() => {
    const w = writes.find((x) => x.model === "platformErrorLog");
    return w && w.data.code === "agency_rep_needs_setup" && w.data.message.includes("Northline Contact") && w.data.message.includes("Dee Ng") && w.data.message.includes("/platform/sales/reps") && w.data.detail.salesRepId === result.rep.id;
  })(), writes.filter((x) => x.model === "platformErrorLog"));
  ok("an audit row names the agency as the actor, with no platform admin", (() => {
    const w = writes.find((x) => x.model === "platformAuditLog");
    return w && w.data.actorSalesRepId === AGENCY.id && !("platformAdminId" in w.data) && w.data.action === "sales_rep_invited";
  })());
  ok("the invite was reported, not assumed sent (no mail leaves a check)", result.inviteSent === false && typeof result.inviteError === "string");
  ok("a non-agency cannot create", (await createAgencyRep({ agency: FREELANCER, name: "X", email: "x@y.z" })).status === 403 && (await createAgencyRep({ agency: EMP("e1", "A"), name: "X", email: "x@y.z" })).status === 403);
  ok("a duplicate email is refused", (await createAgencyRep({ agency: AGENCY, name: "Ann", email: "e1@northline.example" })).status === 409);
  ok("a bad email is refused", (await createAgencyRep({ agency: AGENCY, name: "Ann", email: "nope" })).status === 400);
  const teamIds = await agencyTeamIds(AGENCY.id);
  ok("agencyTeamIds now lists four employees", teamIds.length === 4 && teamIds.includes(result.rep.id));
  ok("…and the same read for a non-agency id is empty", (await agencyTeamIds(FREELANCER.id)).length === 0 && (await agencyTeamIds(null)).length === 0);

  // The route reads only name/email/sellsIn/language from the body.
  const route = decomment(read("app/api/sales/agency/route.js"));
  ok("POST /api/sales/agency reads no kind, engagement, plan or manager from the body", !/body\.(kind|engagement|commissionPlanId|managerId|code)\b/.test(route) && /body\.name/.test(route) && /body\.email/.test(route));
  ok("…and goes through requireOutreachRep, the portal's one write door", /requireOutreachRep\(request\)/.test(route.slice(route.indexOf("export async function POST("))));
  ok("…and refuses a non-agency", /isAgency\(rep\)/.test(route) && /status: 403/.test(route));
  const patch = decomment(read("app/api/sales/agency/[id]/route.js"));
  ok("PATCH /api/sales/agency/[id] reads only active and handoff", !/body\.(kind|engagement|commissionPlanId|managerId|code|name|email)\b/.test(patch) && /body\.active/.test(patch) && /body\.handoff/.test(patch));
  const platformPost = decomment(read("app/api/platform/sales/reps/route.js"));
  ok("the platform's create refuses engagement \"agency\" — only the agency sets it", /engagement === "agency"/.test(platformPost) && /kind === AGENCY_KIND && !assignment\.commissionPlanId/.test(platformPost));
  const platformPatch = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  // Until 2026-09-17 the PATCH refused engagement "agency" unless the row
  // already reported to an agency; now it SETS the manager with it, through
  // lib/sales/repEngagement.js, whose refusals the later section executes.
  ok("the platform's PATCH decides the agency engagement through resolveEngagementChange (no inline manager test left)", /resolveEngagementChange\(/.test(platformPatch) && !/engagement === AGENCY_ENGAGEMENT && existing\.manager/.test(platformPatch));
}

// ── 8. The set-up flag clears only when both halves are there ──────────────
section("8. clearSetupIfComplete");
{
  fresh();
  const rep = rows.salesRep.find((r) => r.id === "e1");
  rep.setupRequestedAt = NOW;
  ok("nothing yet → stays", (await clearSetupIfComplete("e1")) === false && rep.setupRequestedAt === NOW);
  rep.workEmail = "ann@northline-mail.example";
  ok("mailbox only → stays", (await clearSetupIfComplete("e1")) === false && rep.setupRequestedAt === NOW);
  rep.workEmail = null;
  rep._count = { phoneNumbers: 1 };
  ok("number only → stays", (await clearSetupIfComplete("e1")) === false && rep.setupRequestedAt === NOW);
  rep.workEmail = "ann@northline-mail.example";
  ok("both → cleared", (await clearSetupIfComplete("e1")) === true && rep.setupRequestedAt === null);
  ok("already clear → false, no write", (await clearSetupIfComplete("e1")) === false && writes.filter((w) => w.model === "salesRep" && w.action === "updateMany").length === 1);
  ok("the two platform routes that give a number or a mailbox call it", /clearSetupIfComplete\(salesRepId\)/.test(decomment(read("app/api/platform/crew-lines/route.js"))) && /clearSetupIfComplete\(updated\.id\)/.test(decomment(read("app/api/platform/sales/reps/[id]/route.js"))));
}

// ── 9. Deactivate / reactivate / re-invite, scoped to the team ────────────
section("9. setAgencyRepActive and reinviteAgencyRep");
{
  fresh();
  const off = await setAgencyRepActive({ agency: AGENCY, salesRepId: "e2", active: false, now: NOW });
  ok("an employee with nothing held is deactivated", off.ok === true && off.rep?.active === false, off);
  ok("…endedAt is stamped", rows.salesRep.find((r) => r.id === "e2").endedAt instanceof Date);
  ok("…and the audit row names the agency as the actor", writes.some((w) => w.model === "platformAuditLog" && w.data.action === "sales_rep_deactivated" && w.data.actorSalesRepId === AGENCY.id));
  const on = await setAgencyRepActive({ agency: AGENCY, salesRepId: "e2", active: true, now: NOW });
  ok("…and reactivated, endedAt cleared", on.ok === true && rows.salesRep.find((r) => r.id === "e2").active === true && rows.salesRep.find((r) => r.id === "e2").endedAt === null);
  ok("a rep outside the team is 'not on your team', never touched", (await setAgencyRepActive({ agency: AGENCY, salesRepId: FREELANCER.id, active: false })).status === 404 && rows.salesRep.find((r) => r.id === FREELANCER.id).active === true);
  ok("the agency cannot deactivate ITSELF through this", (await setAgencyRepActive({ agency: AGENCY, salesRepId: AGENCY.id, active: false })).status === 404);
  ok("a non-agency caller is refused", (await setAgencyRepActive({ agency: EMP("e1", "A"), salesRepId: "e2", active: false })).status === 403);
  ok("a non-boolean is refused", (await setAgencyRepActive({ agency: AGENCY, salesRepId: "e2", active: "yes" })).status === 400);

  // Held work: the gate refuses with counts until a hand-off is given.
  rows.salesLead.push({ id: "L1", salesRepId: "e3", status: "new", convertedAt: null, prospectId: null });
  const held = await setAgencyRepActive({ agency: AGENCY, salesRepId: "e3", active: false, now: NOW });
  ok("an employee holding an open lead is refused with the counts (409)", held.ok === false && held.status === 409 && held.counts?.openLeads === 1, held);
  ok("…work may not move to a rep outside the team", (await setAgencyRepActive({ agency: AGENCY, salesRepId: "e3", active: false, handoff: { prospects: "move", toRepId: FREELANCER.id }, now: NOW })).status === 403);
  ok("no write touched plan, engagement, kind or manager", writes.filter((w) => w.model === "salesRep").every((w) => !("commissionPlanId" in (w.data || {})) && !("engagement" in (w.data || {})) && !("kind" in (w.data || {})) && !("managerId" in (w.data || {}))));

  // Re-invite.
  rows.salesRep.find((r) => r.id === "e1").acceptedAt = null;
  const re = await reinviteAgencyRep({ agency: AGENCY, salesRepId: "e1" });
  ok("re-invite rotates the token on the employee's row, scoped to the agency", writes.some((w) => w.model === "salesRep" && w.action === "updateMany" && w.where.id === "e1" && w.where.managerId === AGENCY.id && typeof w.data.inviteTokenHash === "string"));
  ok("…and reports the send honestly (no mail leaves a check → 502 with the reason)", re.ok === false && re.status === 502);
  ok("an accepted employee is not re-invited", (await reinviteAgencyRep({ agency: AGENCY, salesRepId: "e2" })).status === 409);
  ok("a stranger's rep is not on the team", (await reinviteAgencyRep({ agency: AGENCY, salesRepId: FREELANCER.id })).status === 404);
}

// ── 10. The team list and the team floor never leave the team ─────────────
section("10. agencyTeam and the floor scope");
{
  fresh();
  rows.salesAttribution.push({ salesRepId: "e1", capturedAt: NOW }, { salesRepId: "e1", capturedAt: new Date("2026-08-01T00:00:00Z") }, { salesRepId: FREELANCER.id, capturedAt: NOW });
  rows.salesCallAttempt.push({ salesRepId: "e1", direction: "out", dialledAt: NOW }, { salesRepId: "e1", direction: "in", dialledAt: NOW }, { salesRepId: FREELANCER.id, direction: "out", dialledAt: NOW });
  rows.salesCommissionEntry.push({ salesRepId: "e1", amountCents: 700, payoutBatchId: null });
  const team = await agencyTeam({ agencyId: AGENCY.id, origin: "https://app.example", now: NOW });
  ok("lists the three employees and nobody else", team.length === 3 && team.every((m) => ["e1", "e2", "e3"].includes(m.id)), team.map((m) => m.id));
  const ann = team.find((m) => m.id === "e1");
  ok("each carries their unique link", ann.signupLink === "https://app.example/signup?sales=e1");
  ok("calls today/week count outbound dials only", ann.calls.today === 1 && ann.calls.thisWeek === 1 && team.find((m) => m.id === "e2").calls.today === 0);
  ok("signups today / week / total from attribution rows", ann.signups.today === 1 && ann.signups.total === 2);
  ok("earned from the ledger rows", ann.earned.lifetimeCents === 700 && ann.earned.openCents === 700);
  ok("needsSetup reads the flag against the two halves", ann.needsSetup === false && ann.hasNumber === false && ann.hasWorkEmail === false);
  ok("an empty agency id or a non-agency id lists nobody", (await agencyTeam({ agencyId: null })).length === 0 && (await agencyTeam({ agencyId: FREELANCER.id })).length === 0);

  // The floor.
  const teamIds = await agencyTeamIds(AGENCY.id);
  const viewer = repViewer(AGENCY.id, teamIds);
  const scope = visibleRepIds(viewer);
  ok("the viewer is a team lead whose scope is the agency plus its team", viewer.kind === "team_lead" && scope.length === 4 && scope.includes(AGENCY.id) && !scope.includes(FREELANCER.id), scope);
  ok("boardRepWhere narrows to the list; null is the platform's whole floor; an empty list is nobody", JSON.stringify(boardRepWhere(scope)) === JSON.stringify({ active: true, id: { in: scope } }) && JSON.stringify(boardRepWhere(null)) === JSON.stringify({ active: true }) && JSON.stringify(boardRepWhere([])) === JSON.stringify({ active: true, id: { in: [NO_REP] } }));
  reads.length = 0;
  const board = await floorBoard({ repIds: scope, now: NOW });
  ok("the board lists only the team", board.reps.every((r) => scope.includes(r.id)) && !board.reps.some((r) => r.id === FREELANCER.id) && board.reps.length === 4, board.reps.map((r) => r.id));
  const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x) => b.includes(x));
  ok("…every read was scoped to those ids", reads.filter((r) => ["salesCallAttempt", "salesRepActivity"].includes(r.model)).every((r) => sameSet(r.args.where?.salesRepId?.in, scope)), reads.filter((r) => ["salesCallAttempt", "salesRepActivity"].includes(r.model)).map((r) => r.args.where));
  ok("…and the freelancer's dial is not in the team's campaigns", (board.campaigns || []).reduce((s, c) => s + c.dials, 0) === 1);
  const floorRoute = decomment(read("app/api/sales/agency/floor/route.js"));
  ok("the agency floor route scopes through repViewer → visibleRepIds → floorBoard", /repViewer\(rep\.id, teamIds\)/.test(floorRoute) && /floorBoard\(\{ repIds: visibleRepIds\(viewer\)/.test(floorRoute) && /isAgency\(rep\)/.test(floorRoute));
  ok("…and never reaches the inbound line or the number pool", !/inboundCalls|salesCallerNumbers|salesVoiceInboundState/.test(floorRoute));
  const platformFloor = decomment(read("app/api/platform/sales/floor/route.js"));
  ok("the platform floor draws from the same function, unscoped", /floorBoard\(\{ repIds: null/.test(platformFloor));
}

// ── 11. Nine languages ─────────────────────────────────────────────────────
section("11. Every new key exists in all nine languages");
{
  const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  const page = decomment(read("app/sales/agency/page.js")) + decomment(read("app/sales/pay/page.js")) + decomment(read("app/components/sales/EarningsPanel.js")) + decomment(read("app/sales/SalesShell.js"));
  const keys = new Set([...page.matchAll(/"(app\.(?:salesAgency|salesPay|salesPortal)\.[A-Za-z0-9_.]+)"/g)].map((m) => m[1]));
  for (const e of ENGAGEMENTS) {
    keys.add(e.labelKey);
    keys.add(e.noteKey);
  }
  ok(`the screens ask for ${keys.size} keys (≥ 60)`, keys.size >= 60, keys.size);
  const missing = [];
  for (const key of keys) for (const lang of LANGS) if (typeof APP_MESSAGES[lang]?.[key] !== "string" || !APP_MESSAGES[lang][key]) missing.push(`${key} (${lang})`);
  ok("every one of them has a non-empty value in all nine languages", missing.length === 0, missing.slice(0, 10));
  const refusal = LANGS.map((l) => APP_MESSAGES[l]["app.salesPay.agencyEmployeeRefusal"]);
  ok("the refusal sentence keeps its {agency} placeholder everywhere", refusal.every((s) => s.includes("{agency}")));
  ok("the hand-off title keeps {name}, {prospects} and {leads} everywhere", LANGS.every((l) => ["{name}", "{prospects}", "{leads}"].every((p) => APP_MESSAGES[l]["app.salesAgency.handoffTitle"].includes(p))));
  ok("the complete languages do not echo the English on the multi-word strings", ["fr", "es", "de", "zh", "it"].every((l) => APP_MESSAGES[l]["app.salesAgency.intro"] !== APP_MESSAGES.en["app.salesAgency.intro"] && APP_MESSAGES[l]["app.salesPay.agencyEmployeeRefusal"] !== APP_MESSAGES.en["app.salesPay.agencyEmployeeRefusal"]));
}

// ── 12. Wiring ─────────────────────────────────────────────────────────────
section("12. Wiring");
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-agency is in check:all", /check:sales-agency/.test(pkg.scripts["check:all"]) && Boolean(pkg.scripts["check:sales-agency"]));
  const cron = decomment(read("app/api/cron/sales-payouts/route.js"));
  ok("the Monday cron closes one batch per PAYEE through payeeGroups", /payeeGroups\(reps\)/.test(cron) && /earnerIds/.test(cron));
  const admin = decomment(read("lib/sales/payoutAdmin.js"));
  ok("repPayouts reads the entries in the payee's batches, not only the payee's own", /payoutBatch: \{ salesRepId \}/.test(admin));
  const card = decomment(read("app/components/platform/payouts/BatchCard.js"));
  ok("the platform batch card shows the agency chip and the per-employee lines", /data-batch-agency/.test(card) && /data-batch-earners/.test(card) && /batch\.byEarner/.test(card));
  const repsPage = decomment(read("app/platform/sales/reps/page.js"));
  ok("/platform/sales/reps has the Type picker with the agency option", /data-rep-type/.test(repsPage) && /key: "agency"/.test(repsPage) && /kind: draft\.type === "agency" \? "agency" : "rep"/.test(repsPage));
  ok("…an Agencies section with employees nested under their agency", /data-agencies-heading/.test(repsPage) && /data-agency-employee=/.test(repsPage) && /r\.agency\?\.id === a\.id/.test(repsPage));
  ok("…the Needs number & work mailbox chip", /data-needs-setup=/.test(repsPage) && /rep\.needsSetup/.test(repsPage));
  ok("…via <agency> on an employee's row, and the team table on the agency's card", /via \{rep\.agency\.name\}/.test(repsPage) && /data-agency-team=/.test(repsPage) && /rep\.team\.map/.test(repsPage));
  const repsRoute = decomment(read("app/api/platform/sales/reps/route.js"));
  ok("the reps route returns agency, needsSetup, hasNumber and team, and pools the agency's money", /agency: isAgencyEmployee\(r, r\.manager\)/.test(repsRoute) && /needsSetup:/.test(repsRoute) && /team: teamByAgency\.get\(r\.id\)/.test(repsRoute) && /money: moneyFor\(r\)/.test(repsRoute));
  const activation = decomment(read("lib/sales/repActivation.js"));
  ok("the platform PATCH and the agency both flip `active` through lib/sales/repActivation.js", /changeRepActive\(/.test(decomment(read("app/api/platform/sales/reps/[id]/route.js"))) && /changeRepActive\(/.test(decomment(read("lib/sales/agency.js"))) && /export async function changeRepActive/.test(activation));
  const schema = read("prisma/schema.prisma");
  ok("the schema carries setupRequestedAt and the audit log's agency actor", /setupRequestedAt DateTime\?/.test(schema) && /actorSalesRepId String\?/.test(schema) && /platformAdminId String\?/.test(schema));
  const origin = decomment(read("lib/platform/signupOrigin.js"));
  ok("the signup-origin attribution names the agency beside the rep", /agency:/.test(origin) && /manager: \{ select: \{ id: true, kind: true, name: true \} \}/.test(origin));
}

section("Deactivate is never one tap (QA 2026-09-17, finding 3)");
{
  const page = decomment(read("app/sales/agency/page.js"));
  const fn = page.slice(page.indexOf("async function setActive(m, active, chosen = null) {"), page.indexOf("async function resend(m)"));
  ok("heldWork() reads the listing's own counts — leased and openLeads — and is null when the rep holds nothing", /function heldWork\(m\)/.test(page) && /leased > 0 \|\| openLeads > 0 \? \{/.test(page));
  ok("a first tap on a rep who holds work opens the hand-off on those counts, with no PATCH", /if \(!active && !chosen\) \{[\s\S]*?const held = heldWork\(m\);\s*if \(held\) \{\s*setHandoff\(\{ repId: m\.id, counts: held, mode: "release", toRepId: "" \}\);\s*return;/.test(fn));
  ok("…a rep who holds nothing gets the confirm sentence, and a No does nothing", /if \(!window\.confirm\(t\("app\.salesAgency\.confirmDeactivate", \{ name: m\.name \}\)\)\) return;/.test(fn));
  ok("…both before setBusy — nothing is posted on a refused tap", fn.indexOf("window.confirm(") < fn.indexOf("setBusy(true)") && fn.indexOf("const held = heldWork(m)") < fn.indexOf("setBusy(true)"));
  ok("…and the hand-off's own confirm button (chosen set) is not asked twice", /if \(!active && !chosen\)/.test(fn));
  ok("the held-work line is printed under the card before the tap", /data-holds-work=\{m\.id\}/.test(page) && /app\.salesAgency\.holdsWork/.test(page));
  ok("reactivate is still one tap — it takes nothing away", !/active && !window\.confirm/.test(fn));
  const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  ok("the confirm sentence names the rep in every language, and the held-work line its counts", LANGS.every((l) => APP_MESSAGES[l]["app.salesAgency.confirmDeactivate"]?.includes("{name}") && ["{name}", "{prospects}", "{leads}"].every((p) => APP_MESSAGES[l]["app.salesAgency.holdsWork"]?.includes(p))));
  ok("…and says what stays: what they earned", /earned/.test(APP_MESSAGES.en["app.salesAgency.confirmDeactivate"]) && /reactivate/.test(APP_MESSAGES.en["app.salesAgency.confirmDeactivate"]));
  const route = decomment(read("app/api/sales/agency/route.js"));
  ok("the listing carries the counts the screen reads (queue: leased, openLeads)", /queue: queue\.get\(m\.id\) \|\| null/.test(route));
}

section("Deactivating an agency deactivates its employees (owner, 2026-09-16)");
{
  const route = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  ok("the platform PATCH cascades: an agency going inactive reads its active employees first", /active === false && existing\.kind === AGENCY_KIND/.test(route) && /managerId: existing\.id, engagement: AGENCY_ENGAGEMENT, active: true/.test(route));
  ok("…every employee is judged by the deactivation gate BEFORE anything is written, with the same hand-off", /for \(const e of employees\) \{[\s\S]*?deactivationGate\(\{ leased: c\.leased, openLeads: c\.openLeads, worked: c\.worked, handoff: body\.handoff \}\)/.test(route));
  ok("…a refusal names the employee and stops the whole change", /an employee of this agency\): \$\{gate\.error\}/.test(route));
  ok("…and each employee goes through changeRepActive with the same hand-off, audited as cascaded from the agency", /changeRepActive\(\{ db, existing: e, active: false, handoff: body\.handoff/.test(route) && /cascadedFromAgencyId: existing\.id/.test(route));
  ok("reactivating an agency does not touch its employees (the cascade is inside `active === false`)", !/active === true && existing\.kind === AGENCY_KIND/.test(route));
  ok("the write-up lives in the sales manual, chapter 13, in three languages — not the contractor help centre", ["en", "fr", "es"].every((l) => /n: 13,\s*id: "agencies"/.test(read(`docs/sales/manual/content.${l}.js`))) && !/agencies-and-call-centres/.test(read("lib/help/tree.js")));
}

section("Linking an existing rep to an agency, and back, from /platform (owner, 2026-09-17)");
{
  const { engagementTransition, openWeekRefusal, resolveEngagementChange, agencyConversion, conversionCounts, ENGAGEMENT_EXISTING_SELECT } = await import("@/lib/sales/repEngagement");
  const AG2 = { id: "ag_2", kind: AGENCY_KIND, name: "Southline Contact", email: "ops@southline.example", commissionPlanId: "plan_b", engagement: null, managerId: null, active: true, commissionPlan: { id: "plan_b", name: "Plan B" } };
  const DEAD = { ...AG2, id: "ag_dead", name: "Closed Contact", active: false };
  const solo = { ...FREELANCER, commissionPlanId: "plan_solo", payoutMethod: "paypal", workEmail: null, setupRequestedAt: null, _count: { phoneNumbers: 0 } };

  // ── The pure decision ─────────────────────────────────────────────────
  const into = engagementTransition({ existing: solo, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [], now: NOW });
  ok("a freelancer with nothing open goes under an active agency: engagement agency, manager the agency, plan the agency's, leave off", into.ok && into.data.engagement === AGENCY_ENGAGEMENT && into.data.managerId === AG2.id && into.data.commissionPlanId === "plan_b" && into.data.accruesPaidLeave === false, into);
  ok("…the payee moves from the rep to the agency, and the audit says so with both", into.payee.from === solo.id && into.payee.to === AG2.id && into.audit.some((a) => a.action === "sales_rep_agency_set" && a.details.payeeFrom === solo.id && a.details.payeeTo === AG2.id && a.details.toAgencyName === "Southline Contact"));
  ok("…the plan change is its own audit row, marked as aligned to the agency", into.audit.some((a) => a.action === "sales_rep_commission_plan_set" && a.details.from === "plan_solo" && a.details.to === "plan_b" && a.details.reason === "aligned_to_agency"));
  ok("…no number and no mailbox → the owner's set-up flag is stamped and flagSetup is true", into.flagSetup === true && into.data.setupRequestedAt instanceof Date);
  const readyRep = { ...solo, workEmail: "dana@northline-mail.example", _count: { phoneNumbers: 1 } };
  const intoReady = engagementTransition({ existing: readyRep, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [] });
  ok("a rep who already has both is NOT flagged — nothing to assign", intoReady.ok && intoReady.flagSetup === false && !("setupRequestedAt" in intoReady.data));
  ok("the same plan already → no plan row, no plan write", (() => {
    const r = engagementTransition({ existing: { ...solo, commissionPlanId: "plan_b" }, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [] });
    return r.ok && !("commissionPlanId" in r.data) && !r.audit.some((a) => a.action === "sales_rep_commission_plan_set");
  })());

  // Hostile input, each refused in words and with nothing to write.
  ok("hostile: a rep as their own agency → 400", (() => {
    const r = engagementTransition({ existing: solo, engagement: "agency", agency: { ...solo, kind: "rep" }, agencyId: solo.id, openEntries: [] });
    return !r.ok && r.status === 400 && /own agency/.test(r.error) && !r.data;
  })());
  ok("hostile: an inactive agency → 409, naming it", (() => {
    const r = engagementTransition({ existing: solo, engagement: "agency", agency: DEAD, agencyId: DEAD.id, openEntries: [] });
    return !r.ok && r.status === 409 && /Closed Contact/.test(r.error) && /deactivated/.test(r.error);
  })());
  ok("hostile: an agency under an agency → 400", (() => {
    const r = engagementTransition({ existing: { ...AGENCY }, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [] });
    return !r.ok && r.status === 400 && /cannot work for another agency/.test(r.error);
  })());
  ok("hostile: an agency given freelancer/employee → 400", !engagementTransition({ existing: { ...AGENCY }, engagement: "freelancer", openEntries: [] }).ok);
  ok("hostile: a plain rep (not an agency) as the manager → 400, 'never through another rep'", (() => {
    const r = engagementTransition({ existing: solo, engagement: "agency", agency: { id: "lead", kind: "rep", name: "Lead Rep", active: true }, agencyId: "lead", openEntries: [] });
    return !r.ok && r.status === 400 && /not an agency/.test(r.error);
  })());
  ok("hostile: an agency id nobody has → 404; no id at all → 400", engagementTransition({ existing: solo, engagement: "agency", agency: null, agencyId: "nope", openEntries: [] }).status === 404 && engagementTransition({ existing: solo, engagement: "agency", agency: null, agencyId: null, openEntries: [] }).status === 400);
  ok("hostile: an influencer ledger → 400", engagementTransition({ existing: { ...solo, kind: "influencer" }, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [] }).status === 400);
  ok("hostile: an engagement that is not one → 400", engagementTransition({ existing: solo, engagement: "contractor", openEntries: [] }).status === 400);

  // The open payout week.
  const openWeek = [{ id: "o1", amountCents: 2000 }, { id: "o2", amountCents: -500 }];
  const split = engagementTransition({ existing: solo, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: openWeek });
  ok("an open payout week (unbatched entries) refuses the move INTO an agency: 409, the count, the sum, both payees, Monday", !split.ok && split.status === 409 && split.code === "open_payout_week" && split.counts.openEntries === 2 && split.counts.openCents === 1500 && /2 commission entries \(\$15\.00\)/.test(split.error) && /Southline Contact/.test(split.error) && /Dana Solo was the payee/.test(split.error) && /Monday/.test(split.error), split);
  const emp = { ...EMP("e1", "Ann Lee"), commissionPlanId: "plan_a", payoutMethod: null, setupRequestedAt: null };
  const out = engagementTransition({ existing: emp, engagement: "freelancer", openEntries: openWeek });
  ok("…and the move OUT of an agency, naming the agency as the payee it was earned under", !out.ok && out.status === 409 && /Northline Contact was the payee/.test(out.error) && /to Ann Lee at the next weekly close/.test(out.error), out);
  ok("a reversal-only week (net negative) is still an open week", openWeekRefusal({ rep: solo, openEntries: [{ amountCents: -300 }], payeeFromName: "a", payeeToName: "b" })?.counts.openCents === -300 && /−\$3\.00/.test(openWeekRefusal({ rep: solo, openEntries: [{ amountCents: -300 }], payeeFromName: "a", payeeToName: "b" }).error));
  ok("no open entries → no refusal", openWeekRefusal({ rep: solo, openEntries: [], payeeFromName: "a", payeeToName: "b" }) === null && openWeekRefusal({ rep: solo, openEntries: null, payeeFromName: "a", payeeToName: "b" }) === null);
  ok("freelancer → employee never meets the open-week rule (no money moves)", (() => {
    const r = engagementTransition({ existing: solo, engagement: "employee", openEntries: openWeek });
    return r.ok && r.data.engagement === "employee" && !("managerId" in r.data) && !("accruesPaidLeave" in r.data) && r.audit.length === 1 && r.audit[0].action === "sales_rep_engagement_set";
  })());
  ok("…to freelancer clears paid leave; the same value again is unchanged", engagementTransition({ existing: { ...solo, engagement: "employee" }, engagement: "freelancer", openEntries: [] }).data.accruesPaidLeave === false && engagementTransition({ existing: solo, engagement: "freelancer", openEntries: openWeek }).unchanged === true);

  // Out of an agency, cleanly.
  const detach = engagementTransition({ existing: emp, engagement: "employee", openEntries: [] });
  ok("an employee with nothing open leaves the agency: managerId null, engagement set, plan KEPT", detach.ok && detach.data.managerId === null && detach.data.engagement === "employee" && !("commissionPlanId" in detach.data), detach);
  ok("…the payee moves from the agency to the rep, in a sales_rep_agency_detached row plus the engagement row", detach.payee.from === AGENCY.id && detach.payee.to === "e1" && detach.audit.some((a) => a.action === "sales_rep_agency_detached" && a.details.fromAgencyId === AGENCY.id && a.details.commissionPlanIdKept === "plan_a") && detach.audit.some((a) => a.action === "sales_rep_engagement_set" && a.details.from === "agency" && a.details.to === "employee"));
  ok("…to 'not decided' (null) also detaches", engagementTransition({ existing: emp, engagement: null, openEntries: [] }).data.managerId === null);
  ok("the same agency again is unchanged; a DIFFERENT agency moves the payee (and meets the open-week rule)", engagementTransition({ existing: emp, engagement: "agency", agency: { ...AGENCY, commissionPlan: null }, agencyId: AGENCY.id, openEntries: openWeek }).unchanged === true && engagementTransition({ existing: emp, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: openWeek }).status === 409 && engagementTransition({ existing: emp, engagement: "agency", agency: AG2, agencyId: AG2.id, openEntries: [] }).data.managerId === AG2.id);
  ok("a rep under a team lead (a rep, not an agency) keeps that line on a plain change", (() => {
    const led = { ...solo, managerId: "lead", manager: { id: "lead", kind: "rep", name: "Lead" } };
    const r = engagementTransition({ existing: led, engagement: "employee", openEntries: [] });
    return r.ok && !("managerId" in r.data);
  })());

  // ── The fresh reads behind the decision ────────────────────────────────
  fresh();
  rows.salesRep.push({ ...AG2, _count: { phoneNumbers: 0 } }, { ...DEAD, _count: { phoneNumbers: 0 } });
  const soloRow = rows.salesRep.find((r) => r.id === FREELANCER.id);
  Object.assign(soloRow, { commissionPlanId: "plan_solo", payoutMethod: "paypal", workEmail: null, setupRequestedAt: null, _count: { phoneNumbers: 0 } });
  const r1 = await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: AG2.id, now: NOW });
  ok("resolveEngagementChange reads the agency and the open entries fresh and decides", r1.ok && r1.agency?.id === AG2.id && r1.data.managerId === AG2.id && reads.some((x) => x.model === "salesCommissionEntry" && x.args.where.salesRepId === FREELANCER.id && x.args.where.payoutBatchId === null));
  rows.salesCommissionEntry.push({ id: "open1", salesRepId: FREELANCER.id, amountCents: 900, payoutBatchId: null, occurredAt: NOW });
  ok("…and refuses once an unbatched entry exists in the database", (await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: AG2.id })).status === 409);
  rows.salesCommissionEntry[rows.salesCommissionEntry.length - 1].payoutBatchId = "b_old";
  ok("…a batched entry is not an open week", (await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: AG2.id })).ok === true);
  ok("…the dead agency is read as dead", (await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: DEAD.id })).status === 409);
  ok("…the agency id is never trusted to be an agency: an employee's id → 'not an agency'", /not an agency/.test((await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: "e1" })).error || ""));
  ok("…the rep's own id → own agency, without a read for it", (await resolveEngagementChange({ existing: soloRow, engagement: "agency", agencyId: FREELANCER.id })).status === 400);
  ok("the select the route reads with carries everything the decision judges", ["kind", "engagement", "managerId", "commissionPlanId", "payoutMethod", "workEmail", "setupRequestedAt"].every((k) => ENGAGEMENT_EXISTING_SELECT[k] === true) && ENGAGEMENT_EXISTING_SELECT.manager.select.kind === true && ENGAGEMENT_EXISTING_SELECT._count.select.phoneNumbers === true);

  // ── Converting a rep row into an agency ────────────────────────────────
  const blank = { ...solo, engagement: "freelancer", managerId: null, manager: null };
  const conv = agencyConversion({ existing: blank, counts: { entries: 0, batches: 0, reports: 0 } });
  ok("a blank-slate rep with a plan becomes an agency: kind agency, engagement null, manager null, its plan kept", conv.ok && conv.data.kind === AGENCY_KIND && conv.data.engagement === null && conv.data.managerId === null && conv.data.commissionPlanId === "plan_solo" && conv.audit[0].action === "sales_rep_converted_to_agency", conv);
  ok("…a plan named in the request replaces the row's", agencyConversion({ existing: blank, counts: {}, commissionPlanId: "plan_b" }).data.commissionPlanId === "plan_b");
  ok("refused with earned commission (entries) — in words, with the counts", (() => {
    const r = agencyConversion({ existing: blank, counts: { entries: 3, batches: 1, reports: 0 } });
    return !r.ok && r.status === 409 && r.code === "has_commission" && /3 ledger entries, 1 payout batch/.test(r.error) && /new account/.test(r.error);
  })());
  ok("refused with a batch and no entries (a batch is money too)", agencyConversion({ existing: blank, counts: { entries: 0, batches: 1, reports: 0 } }).code === "has_commission");
  ok("refused with reps reporting to it", agencyConversion({ existing: blank, counts: { entries: 0, batches: 0, reports: 2 } }).code === "has_reports");
  ok("refused while it works for an agency (an agency cannot be under an agency), naming the way out", (() => {
    const r = agencyConversion({ existing: { ...EMP("e1", "Ann Lee"), commissionPlanId: "plan_a", payoutMethod: null }, counts: {} });
    return r.code === "has_manager" && /cannot be under an agency/.test(r.error) && /freelancer or employee first/.test(r.error);
  })());
  ok("refused while it reports to a team lead", agencyConversion({ existing: { ...blank, managerId: "lead", manager: { id: "lead", kind: "rep", name: "Lead" } }, counts: {} }).code === "has_manager");
  ok("refused without a plan", agencyConversion({ existing: { ...blank, commissionPlanId: null }, counts: {} }).status === 400);
  ok("refused on Upwork (an agency cannot be paid through it); PayPal is fine", agencyConversion({ existing: { ...blank, payoutMethod: "upwork" }, counts: {} }).code === "payout_method" && agencyConversion({ existing: { ...blank, payoutMethod: "paypal" }, counts: {} }).ok);
  ok("an influencer ledger and an agency are refused / unchanged", agencyConversion({ existing: { ...blank, kind: "influencer" }, counts: {} }).status === 400 && agencyConversion({ existing: { ...AGENCY }, counts: {} }).unchanged === true);
  rows.salesCommissionEntry.push({ id: "e1_earned", salesRepId: "e1", amountCents: 100, payoutBatchId: null });
  rows.salesPayoutBatch.push({ id: "b_ag", salesRepId: AGENCY.id, status: "ready" });
  const c = await conversionCounts(AGENCY.id);
  ok("conversionCounts reads entries, batches and reports fresh (the agency: 0 entries, 1 batch, 3 reports)", c.entries === 0 && c.batches === 1 && c.reports === 3, c);
  ok("…and a rep with one entry", (await conversionCounts("e1")).entries === 1 && (await conversionCounts(null)).entries === 0);

  // ── The route and the screen ────────────────────────────────────────────
  const route = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  ok("PATCH /api/platform/sales/reps/[id] decides the engagement through resolveEngagementChange with the body's agencyId", /resolveEngagementChange\(\{[\s\S]*?agencyId: body\.agencyId/.test(route) && /transition\.data/.test(route) && /transition\.audit/.test(route));
  ok("…kind may only become agency, through agencyConversion over fresh counts", /body\.kind !== AGENCY_KIND/.test(route) && /conversionCounts\(existing\.id\)/.test(route) && /agencyConversion\(\{ existing, counts/.test(route));
  ok("…and fires the owner's number-and-mailbox line when the rep still needs one", /code: "agency_rep_needs_setup"/.test(route) && /transition\.flagSetup/.test(route));
  const repsPage = decomment(read("app/platform/sales/reps/page.js"));
  ok("the rep card offers employee / freelancer / works for an agency, with an agency picker of active agencies", /value="agency"/.test(repsPage) && /data-agency-picker/.test(repsPage) && /activeAgencies\.map/.test(repsPage) && /agencyReps\.filter\(\(a\) => a\.active\)/.test(repsPage));
  ok("…confirms the consequence in a sentence that says who is paid from the next close and that batches and earners stay", /From the next weekly close/.test(repsPage) && /Batches already closed stay with/.test(repsPage) && /keeps \$\{rep\.name\} as the earner/.test(repsPage) && /confirm\(`\$\{consequence\}/.test(repsPage));
  ok("…warns about the open week before the server refuses it", /data-open-week-warning/.test(repsPage) && /rep\.ledger\?\.openEntries/.test(repsPage));
  ok("…an employee's card is editable (Change), and says detaching pays them from the next close", /Works for \$\{rep\.agency\.name\}/.test(repsPage) && /detaches them/.test(repsPage));
  ok("…and offers the conversion only for a rep row with no ledger and a plan, in words otherwise", /data-convert-to-agency/.test(repsPage) && /kind: "agency"/.test(repsPage) && /Not convertible into an agency/.test(repsPage) && /Assign a commission plan above first/.test(repsPage));
  const listRoute = decomment(read("app/api/platform/sales/reps/route.js"));
  ok("the list route returns the ledger counts the card reads", /ledger: \{[\s\S]*?openEntries:[\s\S]*?entries:/.test(listRoute));
}

section("The funnel, the performance dashboard and the floor name the agency beside its reps");
{
  const { agencyOf } = await import("@/lib/sales/agencyLabel");
  ok("agencyOf: an agency employee → { id, name } of the agency", JSON.stringify(agencyOf({ engagement: "agency", manager: { id: "ag", kind: "agency", name: "Northline Contact" } })) === JSON.stringify({ id: "ag", name: "Northline Contact" }));
  ok("…a freelancer, a FieldQuo rep, a team-lead report → null", agencyOf({ engagement: "freelancer" }) === null && agencyOf({ engagement: "agency", manager: { id: "m", kind: "rep", name: "Lead" } }) === null);
  for (const [file, needle] of [
    ["lib/sales/funnelData.js", /manager: \{ select: \{ id: true, kind: true, name: true \} \}[\s\S]*agency: agencyOf\(rep\)/],
    // The reads moved out of the route into one loader on 2026-09-17, when
    // the agency got the same page for its own team.
    ["lib/sales/performanceLoad.js", /manager: \{ select: \{ id: true, kind: true, name: true \} \}/],
    ["lib/sales/performance.js", /agency: agencyOf\(rep\)/],
    ["lib/sales/calls/floorBoard.js", /manager: \{ select: \{ id: true, kind: true, name: true \} \}/],
    ["lib/sales/calls/reporting.js", /agency: agencyOf\(rep\)/],
    ["lib/sales/funnelStages.js", /agency: rep\.agency \|\| null/],
    ["app/platform/sales/funnel/page.js", /f\.rep\.agency \? /],
    ["app/platform/sales/performance/page.js", /rep\.agency \? /],
    ["app/platform/sales/floor/page.js", /rep\.agency \? /],
  ]) {
    ok(`${file} carries the agency`, needle.test(decomment(read(file))));
  }
}

section("Warm/cold transfer targets: teammates first, everyone labelled");
{
  const { transferTargets } = await import("@/lib/sales/calls/transfer");
  const now = new Date();
  const presence = ["me", "mate", "fq", "other"].map((id, i) => ({ salesRepId: id, presence: { state: "available", stale: false, lastSeenAt: new Date(now.getTime() - 1000 * (i + 1)).toISOString() } }));
  const reps = [
    { id: "me", name: "Me", agency: { id: "ag1", name: "Northline" } },
    { id: "mate", name: "Teammate", agency: { id: "ag1", name: "Northline" } },
    { id: "fq", name: "FieldQuo Rep", agency: null },
    { id: "other", name: "Other Agency Rep", agency: { id: "ag2", name: "Southline" } },
  ];
  const targets = transferTargets({ reps, presence, excludeRepId: "me", ownAgencyId: "ag1", now }).filter((t) => t.kind === "client");
  ok("the transferring rep's teammate is listed first, labelled your team", targets[0]?.salesRepId === "mate" && targets[0]?.team === "mine" && /your team/.test(targets[0]?.why || ""), targets.map((t) => [t.salesRepId, t.team]));
  ok("…then FieldQuo's own reps, then other agencies', each labelled", targets[1]?.team === "fieldquo" && /FieldQuo/.test(targets[1].why) && targets[2]?.team === "agency" && /Southline/.test(targets[2].why));
  ok("a FieldQuo rep (no agency) sees the longest-idle order with labels and no 'your team'", !transferTargets({ reps, presence, excludeRepId: "fq", now }).some((t) => t.team === "mine"));
  const route = decomment(read("app/api/sales/calls/transfer/route.js"));
  ok("the route reads each rep's manager and passes ownAgencyId", /manager: \{ select: \{ id: true, kind: true, name: true \} \}/.test(route) && /ownAgencyId,/.test(route));
}

// ── The agency's performance and call-quality pages: the team, and only the team ──
section("The agency performance page: one computation, scoped to the team (owner, 2026-09-21)");
{
  fresh();
  const { loadPerformanceReport } = await import("@/lib/sales/performanceLoad");
  const { callQaQueue } = await import("@/lib/sales/calls/qaQueue");
  const dial = (salesRepId, i, extra = {}) => ({ id: `${salesRepId}-${i}`, salesRepId, direction: "out", dialChannel: "browser", dialledAt: NOW, providerCallSid: `CA${salesRepId}${i}`, providerStatus: "completed", talkSeconds: 90, answeredAt: NOW, endedAt: NOW, disposition: "reached", qa: null, ...extra });
  rows.salesCallAttempt.push(
    dial("e1", 1), dial("e1", 2, { talkSeconds: 30, disposition: "voicemail" }), dial("e1", 3, { providerStatus: "no-answer", talkSeconds: 0, answeredAt: null, disposition: "no_answer" }),
    dial("e2", 1),
    dial(FREELANCER.id, 1), dial(FREELANCER.id, 2),
    dial("ag_1", 1, { dialChannel: "handset", providerCallSid: null, providerStatus: null, talkSeconds: null, answeredAt: null }),
  );
  const teamIds = await agencyTeamIds(AGENCY.id);
  const repIds = visibleRepIds(repViewer(AGENCY.id, teamIds));
  const from = new Date("2026-09-14T00:00:00Z");
  const to = new Date("2026-09-21T23:59:59Z");
  const report = await loadPerformanceReport({ from, to, repIds });
  const ids = report.calls.reps.map((r) => r.id);
  ok("an agency sees its team and itself — never the freelancer, never the floor", ids.length === 4 && ids.every((id) => repIds.includes(id)) && !ids.includes(FREELANCER.id), ids);
  const ann = report.calls.reps.find((r) => r.id === "e1");
  ok("the same plain-word table: Ann's row has 3 dials, one in each of nobody / voicemail-or-brief / real", ann?.table?.dials === 3 && ann.table.buckets.nobodyAnswered === 1 && ann.table.buckets.voicemailOrBrief === 1 && ann.table.buckets.realConversation === 1, ann?.table?.buckets);
  ok("…with the source on every column", ann?.table?.sources?.dials === "twilio" && ann.table.sources.reached === "rep");
  ok("everyone's row is the team's four dials, the agency's own handset dial named as unverified, and no freelancer", report.calls.totalTable.dials === 4 && report.calls.totalTable.unverified.handset === 1 && report.calls.totalTable.buckets.realConversation === 2, report.calls.totalTable);
  ok("the reconciliation line is scoped to the team, and when the carrier was not asked it says so rather than agreeing", report.calls.reconciliation === null && report.calls.carrierError === "twilio_not_configured", { rec: report.calls.reconciliation, err: report.calls.carrierError });
  ok("…every attempt read was scoped to the team's ids", reads.filter((r) => r.model === "salesCallAttempt" && r.action === "findMany").every((r) => Array.isArray(r.args.where?.salesRepId?.in) && r.args.where.salesRepId.in.every((id) => repIds.includes(id))));
  ok("the call-quality section is over the team's calls only", report.callQuality.reps.every((r) => repIds.includes(r.id)) && !report.callQuality.reps.some((r) => r.id === FREELANCER.id));

  reads.length = 0;
  const queue = await callQaQueue({ repIds, from, to });
  ok("the call-quality queue reads only the team's attempts", reads.filter((r) => r.model === "salesCallAttempt").every((r) => Array.isArray(r.args.where?.salesRepId?.in) && r.args.where.salesRepId.in.every((id) => repIds.includes(id))) && Array.isArray(queue));

  const perfRoute = decomment(read("app/api/sales/agency/performance/route.js"));
  const qaRoute = decomment(read("app/api/sales/agency/call-quality/route.js"));
  ok("/api/sales/agency/performance refuses a non-agency rep with not_agency, then loads the SAME loadPerformanceReport the platform uses, scoped", /if \(!isAgency\(rep\)\)/.test(perfRoute) && /code: "not_agency"/.test(perfRoute) && /loadPerformanceReport\(\{ from, to, repIds \}\)/.test(perfRoute) && /visibleRepIds\(repViewer\(rep\.id, teamIds\)\)/.test(perfRoute));
  ok("/api/sales/agency/call-quality refuses a non-agency rep and scopes callQaQueue to the team", /code: "not_agency"/.test(qaRoute) && /callQaQueue\(\{\s*repIds,/.test(qaRoute));
  ok("the platform page reads the same loader, unscoped", /loadPerformanceReport\(/.test(read("app/api/platform/sales/performance/route.js")) || /loadPerformanceReport\(/.test(read("app/platform/sales/performance/page.js")));
  const perfPage = read("app/sales/agency/performance/page.js");
  ok("a non-agency rep at /sales/agency/performance sees the refusal sentence, not an empty table", /failed === "not_agency"/.test(perfPage) && /t\("app\.salesAgency\.notAgency"\)/.test(perfPage));
  ok("…and at /sales/agency itself", /failed === "not_agency"/.test(read("app/sales/agency/page.js")) && /t\("app\.salesAgency\.notAgency"\)/.test(read("app/sales/agency/page.js")));
  ok("the agency page draws the shared CallPerformanceSections with the plain-word labels", /CallPerformanceSections/.test(perfPage) && /nobodyAnswered: t\("app\.salesAgencyPerf\.nobodyAnswered"\)/.test(perfPage) && /sourceTwilio: t\("app\.salesAgencyPerf\.sourceTwilio"\)/.test(perfPage));
  ok("the refusal sentence exists in all nine languages", Object.values(APP_MESSAGES).filter((m) => typeof m["app.salesAgency.notAgency"] === "string").length === 9);
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
