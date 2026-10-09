// scripts/check-invite-accept-access.mjs
//
//   npm run check:invite-accept-access
//
// Three access questions about how a person comes to hold a permission grid,
// each answered by RUNNING the shipped route against a scripted database
// (scripts/fixtures/teamAccessStub.mjs) rather than by reading it:
//
//   1. Does an accepted invitation's role and grid REPLACE what an existing
//      Member row held — and can a deactivated member let themselves back in
//      by re-running the invitation they accepted years ago?
//   2. If the write that copies the invitation's grid fails, is the person
//      left active with NO grid — which enforce.js reads as "fall back to the
//      coarse role", i.e. every quote, job and invoice in the company?
//   3. Can Crew (quotes: none) read a quote's kitchen design through the
//      Kitchen Designer page or its API?
//
// The fixture's $transaction rolls back on a throw, so "nothing was left
// half-written" is something this file can actually observe.

import { rows, resetStub, setSession, setCurrentMember, failures, renderedProps } from "./fixtures/teamAccessStub.mjs";
import { PERMISSION_PRESETS, PERMISSION_CATEGORIES, PERMISSION_TOGGLES } from "@/lib/permissions";
import { hasLevel } from "@/lib/permissions/enforce";
// Loaded dynamically so this file still RUNS — and reports — against a tree
// that predates the module; a missing helper is then a failed assertion in
// section 2, not a crash that hides sections 1 and 3.
const acceptMember = await import("@/lib/invitations/acceptMember").catch(() => ({}));
const restrictivePresetFor = acceptMember.restrictivePresetFor || (() => undefined);
const RESTRICTIVE_PRESET_FOR_ROLE = acceptMember.RESTRICTIVE_PRESET_FOR_ROLE || { employee: "(none)", supervisor: "(none)" };

const { POST: acceptPOST } = await import("@/app/api/invitations/[id]/accept/route.js");
const { POST: invitePOST } = await import("@/app/api/settings/members/route.js");
const { POST: quickAddPOST } = await import("@/app/api/team/quick-add/route.js");
const { GET: kitchenGET } = await import("@/app/api/quotes/[id]/kitchen/route.js");
const { default: KitchenServerPage } = await import("@/app/app/quotes/[id]/kitchen/page.js");

let failed = 0;
function ok(label, cond, detail) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.log(`  ✗ ${label}${detail !== undefined ? `\n      observed: ${JSON.stringify(detail)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

const CREW = { ...PERMISSION_PRESETS.worker.values };
const MANAGER = { ...PERMISSION_PRESETS.manager.values };
const ESTIMATOR = { ...PERMISSION_PRESETS.estimator.values };

function world() {
  resetStub();
  rows.company.push({ id: "co1", authOrgId: "org1", brandColor: "#123456" });
  rows.user.push({ id: "u_owner", email: "owner@co.test" }, { id: "u_ex", email: "ex@co.test" }, { id: "u_new", email: "new@co.test" });
  rows.member.push({ id: "m_owner", userId: "u_owner", companyId: "co1", role: "owner", active: true, permissions: null });
}
function addFormerManager() {
  rows.member.push({ id: "m_ex", userId: "u_ex", companyId: "co1", role: "supervisor", active: false, permissions: { ...MANAGER } });
}
const memberOf = (userId) => rows.member.find((m) => m.userId === userId && m.companyId === "co1") || null;
const req = (body) => new Request("http://x.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
async function accept(invitationId, user) {
  setSession(user);
  const res = await acceptPOST(req({}), { params: Promise.resolve({ id: invitationId }) });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

/* ══ 1. An invitation's terms replace the old ones; an old one re-opens nothing ═ */

section("1a. The invite doors refuse an email that already has a Member row, active or not");
{
  world();
  addFormerManager();
  setCurrentMember({ id: "m_owner", userId: "u_owner", companyId: "co1", authOrgId: "org1", role: "owner" });
  const full = await invitePOST(req({ email: "ex@co.test", role: "employee", permissions: CREW }));
  ok("POST /api/settings/members refuses re-inviting a deactivated ex-Manager (409)", full.status === 409, full.status);
  const quick = await quickAddPOST(req({ name: "Ex Manager", email: "ex@co.test", role: "employee", permissions: CREW }));
  ok("POST /api/team/quick-add refuses it too (409)", quick.status === 409, quick.status);
  ok("…and neither created a pending profile or an invitation", rows.pendingTeamProfile.length === 0 && rows.invitation.length === 0,
    { pending: rows.pendingTeamProfile.length, invitations: rows.invitation.length });
}

section("1b. A PENDING invitation accepted onto an existing Member row: the invitation's role and grid win");
{
  world();
  addFormerManager();
  rows.invitation.push({ id: "inv_new", organizationId: "org1", email: "ex@co.test", role: "member", status: "pending", expiresAt: new Date(Date.now() + 864e5) });
  rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "ex@co.test", role: "employee", permissions: { ...CREW }, phone: "555" });
  const res = await accept("inv_new", { id: "u_ex", email: "ex@co.test" });
  const m = memberOf("u_ex");
  ok("accept answers 200", res.status === 200, res);
  ok("role is the invitation's (employee), not the old supervisor", m?.role === "employee", m?.role);
  ok("grid is the invitation's Crew grid, not the old Manager grid", JSON.stringify(m?.permissions) === JSON.stringify(CREW), m?.permissions);
  ok("…so the person cannot read quotes (Crew is quotes: none)", hasLevel(m, "quotes", "view_only") === false, m?.permissions?.quotes);
  ok("the member is active", m?.active === true, m?.active);
  ok("the pending profile is consumed", rows.pendingTeamProfile.length === 0, rows.pendingTeamProfile.length);
}

section("1c. A deactivated member cannot re-activate themselves by re-running an ALREADY-ACCEPTED invitation");
{
  world();
  addFormerManager();
  // The invitation they accepted when they were first hired, still in their inbox.
  rows.invitation.push({ id: "inv_old", organizationId: "org1", email: "ex@co.test", role: "member", status: "accepted", expiresAt: new Date(Date.now() - 864e5 * 400) });
  const res = await accept("inv_old", { id: "u_ex", email: "ex@co.test" });
  const m = memberOf("u_ex");
  ok("accept refuses (403)", res.status === 403, res);
  ok("the member stays inactive", m?.active === false, { active: m?.active, role: m?.role });
}

section("1d. Re-running an accepted invitation while ACTIVE is still harmless (bookmarked link)");
{
  world();
  rows.member.push({ id: "m_est", userId: "u_new", companyId: "co1", role: "employee", active: true, permissions: { ...ESTIMATOR } });
  rows.invitation.push({ id: "inv_done", organizationId: "org1", email: "new@co.test", role: "member", status: "accepted", expiresAt: new Date(Date.now() - 864e5) });
  const res = await accept("inv_done", { id: "u_new", email: "new@co.test" });
  const m = memberOf("u_new");
  ok("accept answers 200", res.status === 200, res);
  ok("role and grid are untouched", m?.role === "employee" && JSON.stringify(m?.permissions) === JSON.stringify(ESTIMATOR), m);
}

/* ══ 2. A failed accept fails closed ═════════════════════════════════════════ */
//
// The invariant, whatever single database call fails: after the response,
// the invitee is EITHER not an active member OR an active member holding the
// invitation's grid. "Active with no grid" is the state enforce.js reads as
// full coarse-role access, and the one this section exists to rule out.

section("2a. Any one failed database call leaves the invitee either locked out or holding the invited grid");
{
  const points = [
    ["member", "update"],
    ["member", "upsert"],
    ["member", "create"],
    ["member", "findMany"],
    ["pendingTeamProfile", "findMany"],
    ["pendingTeamProfile", "findUnique"],
    ["pendingTeamProfile", "findFirst"],
    ["pendingTeamProfile", "delete"],
  ];
  for (const [model, action] of points) {
    world();
    rows.invitation.push({ id: "inv_new", organizationId: "org1", email: "new@co.test", role: "member", status: "pending", expiresAt: new Date(Date.now() + 864e5) });
    rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "new@co.test", role: "employee", permissions: { ...CREW } });
    failures.push({ model, action, times: 1 });
    let res;
    try { res = await accept("inv_new", { id: "u_new", email: "new@co.test" }); }
    catch (err) { res = { status: "threw", body: err.message }; }
    const m = memberOf("u_new");
    const lockedOut = !m || m.active !== true;
    const holdsGrid = m && JSON.stringify(m.permissions) === JSON.stringify(CREW);
    ok(`${model}.${action} fails → locked out or Crew grid (never active with no grid)`, lockedOut || holdsGrid,
      { status: res.status, member: m && { role: m.role, active: m.active, permissions: m.permissions } });
    if (m && m.active && !holdsGrid) {
      ok(`   …and that member would read every quote: hasLevel(quotes, view_only) = ${hasLevel(m, "quotes", "view_only")}`, false);
    }
    // A failed accept must be retryable: same link, second try, lands right.
    if (lockedOut) {
      const again = await accept("inv_new", { id: "u_new", email: "new@co.test" });
      const m2 = memberOf("u_new");
      ok(`   …and a retry of the same link lands the Crew grid`, again.status === 200 && m2?.active === true && JSON.stringify(m2?.permissions) === JSON.stringify(CREW),
        { status: again.status, member: m2 && { active: m2.active, permissions: m2.permissions } });
    }
  }
}

section("2a'. The same, onto an EXISTING (switched-off) Member row: a failed write leaves the old row switched off, and the retry lands");
{
  for (const [model, action] of [["member", "update"], ["pendingTeamProfile", "delete"], ["pendingTeamProfile", "findUnique"]]) {
    world();
    addFormerManager();
    rows.invitation.push({ id: "inv_new", organizationId: "org1", email: "ex@co.test", role: "member", status: "pending", expiresAt: new Date(Date.now() + 864e5) });
    rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "ex@co.test", role: "employee", permissions: { ...CREW } });
    failures.push({ model, action, times: 1 });
    const res = await accept("inv_new", { id: "u_ex", email: "ex@co.test" });
    const m = memberOf("u_ex");
    ok(`${model}.${action} fails → 500 and the ex-Manager is still switched off`, res.status === 500 && m?.active === false,
      { status: res.status, active: m?.active, role: m?.role });
    // Better Auth has flipped the invitation to accepted by now; the pending
    // profile is what proves it was a fresh one.
    const again = await accept("inv_new", { id: "u_ex", email: "ex@co.test" });
    const m2 = memberOf("u_ex");
    ok(`   …and the retry lands Crew, active`, again.status === 200 && m2?.active === true && m2?.role === "employee" && JSON.stringify(m2?.permissions) === JSON.stringify(CREW),
      { status: again.status, member: m2 && { active: m2.active, role: m2.role, quotes: m2.permissions?.quotes } });
  }
}

section("2b. An invitation that carries no grid lands the most restrictive preset for its role, never none");
{
  for (const [role, stored] of [["employee", null], ["employee", {}], ["supervisor", null], ["supervisor", {}]]) {
    world();
    rows.invitation.push({ id: "inv_new", organizationId: "org1", email: "new@co.test", role: "member", status: "pending", expiresAt: new Date(Date.now() + 864e5) });
    rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "new@co.test", role, permissions: stored });
    await accept("inv_new", { id: "u_new", email: "new@co.test" });
    const m = memberOf("u_new");
    const want = restrictivePresetFor(role);
    ok(`${role} invited with grid ${JSON.stringify(stored)} → ${RESTRICTIVE_PRESET_FOR_ROLE[role]} grid`,
      want && JSON.stringify(m?.permissions) === JSON.stringify(want), m?.permissions);
  }
  // admin is unrestricted by design (enforce.js UNRESTRICTED_ROLES) — the grid
  // is never read, so none is invented for it.
  world();
  rows.invitation.push({ id: "inv_new", organizationId: "org1", email: "new@co.test", role: "admin", status: "pending", expiresAt: new Date(Date.now() + 864e5) });
  rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "new@co.test", role: "admin", permissions: null });
  await accept("inv_new", { id: "u_new", email: "new@co.test" });
  ok("admin invited with no grid stays gridless (the grid does not apply to admin)", memberOf("u_new")?.role === "admin" && memberOf("u_new")?.permissions == null, memberOf("u_new"));
}

section("2c. 'Most restrictive' is measured, not asserted: the chosen preset is at or below every other preset of its role");
{
  const { PRESET_TO_ROLE } = await import("@/lib/permissions");
  for (const [role, key] of Object.entries(RESTRICTIVE_PRESET_FOR_ROLE)) {
    ok(`${key} produces role ${role}`, PRESET_TO_ROLE[key] === role, PRESET_TO_ROLE[key]);
    if (!PERMISSION_PRESETS[key]) continue;
    const mine = PERMISSION_PRESETS[key].values;
    for (const [other, preset] of Object.entries(PERMISSION_PRESETS)) {
      if (other === key || PRESET_TO_ROLE[other] !== role) continue;
      const above = Object.keys(PERMISSION_CATEGORIES).filter((cat) => {
        const levels = PERMISSION_CATEGORIES[cat].levels.map((l) => l.value);
        const a = levels.indexOf(mine[cat] ?? levels[0]);
        const b = levels.indexOf(preset.values[cat] ?? levels[0]);
        return a > b;
      });
      ok(`${key} grants no category above ${other}`, above.length === 0, above);
      const toggles = Object.keys(PERMISSION_TOGGLES).filter((t) => mine[t] === true && preset.values[t] !== true);
      ok(`${key} turns on no switch ${other} leaves off`, toggles.length === 0, toggles);
    }
  }
}

section("2d. The self-heal on the Team page (reconcilePendingProfiles) never leaves a gridded role with no grid");
{
  const { reconcilePendingProfiles } = await import("@/lib/team/reconcilePendingProfile");
  const cases = [
    ["null grid + leftover Crew profile → Crew", null, { ...CREW }, CREW],
    ["null grid + leftover gridless profile → Crew (most restrictive)", null, null, PERMISSION_PRESETS.worker.values],
    ["{} grid + leftover gridless profile → Crew", {}, {}, PERMISSION_PRESETS.worker.values],
    ["an Estimator grid set since stays (a later edit by the owner is not undone)", { ...ESTIMATOR }, { ...CREW }, ESTIMATOR],
  ];
  for (const [label, held, offered, want] of cases) {
    world();
    rows.member.push({ id: "m_new", userId: "u_new", companyId: "co1", role: "employee", active: true, permissions: held });
    rows.pendingTeamProfile.push({ id: "p1", companyId: "co1", email: "new@co.test", role: "employee", permissions: offered });
    await reconcilePendingProfiles("co1");
    ok(label, JSON.stringify(memberOf("u_new")?.permissions) === JSON.stringify(want), memberOf("u_new")?.permissions);
  }
}

/* ══ 3. The Kitchen Designer and Crew ════════════════════════════════════════ */

section("3. Crew (quotes: none) gets nothing of a quote's kitchen design");
{
  world();
  const design = { serviceType: "kitchen", room: { width: 300 }, cabinets: [{ id: "c1" }] };
  rows.quote.push({ id: "q1", companyId: "co1", quoteNumber: "Q-1", status: "draft", quoteType: "kitchen", scopeDetails: design, clientKitchenConfig: null, scopeGroups: [], shareToken: "tok" });
  rows.member.push(
    { id: "m_crew", userId: "u_new", companyId: "co1", role: "employee", active: true, permissions: { ...CREW } },
    { id: "m_est", userId: "u_ex", companyId: "co1", role: "employee", active: true, permissions: { ...ESTIMATOR } },
  );
  const call = async (memberId, userId) => {
    setCurrentMember({ id: memberId, userId, companyId: "co1", authOrgId: "org1", role: "employee" });
    const res = await kitchenGET(new Request("http://x.test/api/quotes/q1/kitchen"), { params: Promise.resolve({ id: "q1" }) });
    return { status: res.status, body: await res.json() };
  };
  const crew = await call("m_crew", "u_new");
  ok("GET /api/quotes/[id]/kitchen refuses Crew (403)", crew.status === 403, crew);
  ok("…and the refusal carries no design", !JSON.stringify(crew.body).includes("cabinets"), crew.body);
  const est = await call("m_est", "u_ex");
  ok("…while an Estimator (quotes: view_create_edit) gets the design — the gate is the grid, not a blanket block", est.status === 200 && est.body?.design?.cabinets?.length === 1, est.status);

  // The page shell: what the server hands the browser is the whole leak surface.
  setCurrentMember({ id: "m_crew", userId: "u_new", companyId: "co1", authOrgId: "org1", role: "employee" });
  renderedProps.length = 0;
  const el = await KitchenServerPage({ params: Promise.resolve({ id: "q1" }) });
  const props = el?.props || {};
  ok("the page shell hands the browser only the company's brand colour", JSON.stringify(Object.keys(props)) === '["company"]' && JSON.stringify(Object.keys(props.company || {})) === '["brandColor"]', props);
  ok("…no scope, no design, no share token in what is rendered", !/cabinets|serviceType|tok/.test(JSON.stringify(props)), props);
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll invite/accept/kitchen access checks passed.");
process.exit(failed ? 1 : 0);
