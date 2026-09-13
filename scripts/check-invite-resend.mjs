// scripts/check-invite-resend.mjs
//
//   npm run check:invite-resend
//
// Invitations can be sent again, and they say when they die.
//
// What was wrong: an invitation lived 48 hours (Better Auth's default,
// invitationExpiresIn never set) and Manage Team offered Cancel and nothing
// else. A crew member who opened Friday's email on Monday found a dead link
// and the owner's only move was to cancel and type the whole New User form
// again. The help-centre writers found it while documenting the Team page.
//
// This executes the shipped resend route and the pending list with the stub
// trio scripts/check-rbac-redaction.mjs uses, plus stubs for Better Auth
// itself and the invite mailer, and reads the plugin's own source for the
// two facts the route relies on (a `resend` flag, and that expired rows are
// not "pending" to it).
import { readFileSync } from "node:fs";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};
const src = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

console.log("\nThe lifetime\n");
const AUTH = src("lib/auth.js");
check("INVITATION_EXPIRES_DAYS is 7", /export const INVITATION_EXPIRES_DAYS = 7;/.test(AUTH));
check("…and the plugin is handed it in seconds",
  /invitationExpiresIn: INVITATION_EXPIRES_DAYS \* 24 \* 60 \* 60,/.test(AUTH));
check("…with the Friday-to-Monday reason written down", /Friday/.test(AUTH) && /Monday/.test(AUTH));
const PLUGIN = src("node_modules/better-auth/dist/plugins/organization/routes/crud-invites.mjs");
check("the plugin reads invitationExpiresIn as SECONDS (getDate(…, \"sec\"))",
  /getDate\(ctx\.context\.orgOptions\.invitationExpiresIn \|\| 3600 \* 48, "sec"\)/.test(PLUGIN));
check("the plugin has a `resend` flag on createInvitation", /resend: z\.boolean\(\)/.test(PLUGIN));
check("…which renews expiresAt and re-runs sendInvitationEmail on a live pending row",
  /if \(alreadyInvited\.length && ctx\.body\.resend\)/.test(PLUGIN) && /update: \{ expiresAt: newExpiresAt \}/.test(PLUGIN));
const ADAPTER = src("node_modules/better-auth/dist/plugins/organization/adapter.mjs");
check("…and its findPendingInvitation drops EXPIRED rows, which is why the route cancels them first",
  /filter\(\(invite\) => new Date\(invite\.expiresAt\) > \/\* @__PURE__ \*\/ new Date\(\)\)/.test(ADAPTER));

// ── Stubs ─────────────────────────────────────────────────────────────────
const { register } = await import("node:module");
globalThis.__FQ_ENFORCEABLE = null;
globalThis.__FQ_MEMBER = async () => null;
globalThis.__FQ_DB = null;
globalThis.__FQ_AUTH = { calls: [], result: null, throws: null };
globalThis.__FQ_OUTCOME = { sent: true };
globalThis.__FQ_ERRORS = [];

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
  "@/lib/auth": "fq-stub:auth",
  "@/lib/email/teamInvite": "fq-stub:mail",
  "@/lib/platform/errorLog": "fq-stub:errors",
  "@/lib/platform/planLimits": "fq-stub:limits",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  const mod = (source) => ({ format: "module", shortCircuit: true, source });
  if (url === "fq-stub:db") return mod("export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });");
  if (url === "fq-stub:member") return mod("export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);");
  if (url === "fq-stub:next") return mod("export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };");
  if (url === "fq-stub:auth") return mod(\`export const auth = { api: { createInvitation: async (args) => {
    globalThis.__FQ_AUTH.calls.push(args);
    if (globalThis.__FQ_AUTH.throws) throw globalThis.__FQ_AUTH.throws;
    return globalThis.__FQ_AUTH.result;
  } } }; export const INVITATION_EXPIRES_DAYS = 7;\`);
  if (url === "fq-stub:mail") return mod("export const takeInviteEmailOutcome = () => globalThis.__FQ_OUTCOME;");
  if (url === "fq-stub:errors") return mod("export const recordError = async (e) => { globalThis.__FQ_ERRORS.push(e); }; export const errorDetail = () => ({});");
  if (url === "fq-stub:limits") return mod("export const checkUserLimit = async () => ({ allowed: true, limit: null, currentCount: 0 });");
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const DAY = 86400000;
const PENDING = { id: "p1", companyId: "co", email: "crew@x.ca", name: "Jonny", role: "employee", createdAt: new Date("2026-09-01") };
let invitationRows = [];
const writes = { updateMany: [] };
function makeDb() {
  const explicit = {
    member: {
      async findUnique() { return globalThis.__FQ_ENFORCEABLE; },
      async findMany() { return []; },
    },
    pendingTeamProfile: {
      async findUnique({ where }) { return where.id === "p1" ? PENDING : where.id === "p-other" ? { ...PENDING, id: "p-other", companyId: "other" } : null; },
      async findMany() { return [PENDING]; },
    },
    invitation: {
      async findMany({ where }) {
        return invitationRows.filter((r) => (where.status ? r.status === where.status : true));
      },
      async updateMany(args) { writes.updateMany.push(args); return { count: args.where.id.in.length }; },
    },
    subscription: { async findUnique() { return null; } },
  };
  const byName = (prop) => {
    if (/^(findMany|groupBy)$/.test(prop)) return async () => [];
    if (/^count$/.test(prop)) return async () => 0;
    return async () => null;
  };
  return new Proxy(explicit, {
    get(target, model) {
      if (model in target)
        return new Proxy(target[model], { get: (t, prop) => (prop in t ? t[prop] : byName(prop)) });
      return new Proxy({}, { get: (_t, prop) => byName(prop) });
    },
  });
}
globalThis.__FQ_DB = makeDb();

function become(role) {
  const row = { id: "m-x", userId: "u1", companyId: "co", authOrgId: "org1", role, permissions: null };
  globalThis.__FQ_ENFORCEABLE = row;
  globalThis.__FQ_MEMBER = async () => ({ ...row, impersonation: false });
}
const req = (url, body) => ({ url, json: async () => body ?? {}, headers: new Map() });
const params = (o) => Promise.resolve(o);
const reset = () => { writes.updateMany = []; globalThis.__FQ_AUTH.calls = []; globalThis.__FQ_AUTH.throws = null; globalThis.__FQ_ERRORS = []; };

const resend = await import("@/app/api/settings/members/pending/[id]/resend/route");
const pendingList = await import("@/app/api/settings/members/pending/route");

console.log("\nPOST /api/settings/members/pending/[id]/resend\n");
const live = { id: "inv1", email: "crew@x.ca", status: "pending", expiresAt: new Date(Date.now() + 3 * DAY), createdAt: new Date() };
invitationRows = [live];
globalThis.__FQ_AUTH.result = { id: "inv1", expiresAt: new Date(Date.now() + 7 * DAY) };

reset(); become("employee");
let res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("an employee is refused (403) and Better Auth is not called", res.status === 403 && globalThis.__FQ_AUTH.calls.length === 0);

reset(); become("owner");
res = await resend.POST(req("http://x"), { params: params({ id: "p-other" }) });
check("another tenant's pending id is 404, not resent", res.status === 404 && globalThis.__FQ_AUTH.calls.length === 0);

reset(); become("owner");
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("owner, live invitation: 200", res.status === 200);
const call = globalThis.__FQ_AUTH.calls[0];
check("…createInvitation called ONCE with resend:true, the same email, the org id and a Better Auth role",
  globalThis.__FQ_AUTH.calls.length === 1 && call.body.resend === true && call.body.email === "crew@x.ca" &&
  call.body.organizationId === "org1" && call.body.role === "member");
check("…nothing was cancelled (the row was live)", writes.updateMany.length === 0 && res.body.renewed === true);
check("…the new expiry is returned", res.body.expiresAt instanceof Date && res.body.expiresAt.getTime() > Date.now() + 6 * DAY);
check("…and the email outcome is READ, not assumed", res.body.emailSent === true);

reset(); become("supervisor");
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("a supervisor (Dispatcher/Manager) may resend — the same user:manage that sends and cancels", res.status === 200);

reset(); become("owner"); globalThis.__FQ_OUTCOME = { sent: false, error: "Resend refused the address" };
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("a renewed link whose email failed says so: emailSent false with the reason",
  res.status === 200 && res.body.emailSent === false && /refused/.test(res.body.emailError));
globalThis.__FQ_OUTCOME = { sent: true };

reset(); become("owner");
invitationRows = [{ id: "inv0", status: "pending", expiresAt: new Date(Date.now() - 2 * DAY), createdAt: new Date() }];
globalThis.__FQ_AUTH.result = { id: "inv-new", expiresAt: new Date(Date.now() + 7 * DAY) };
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("EXPIRED pending row: the dead row is marked canceled first…",
  writes.updateMany.length === 1 && writes.updateMany[0].where.id.in[0] === "inv0" && writes.updateMany[0].data.status === "canceled");
check("…then createInvitation issues a fresh link (200, renewed:false, new id)",
  res.status === 200 && res.body.renewed === false && res.body.invitationId === "inv-new");

reset(); become("owner");
invitationRows = [{ id: "inv1", status: "accepted", expiresAt: new Date(Date.now() + DAY), createdAt: new Date() }];
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("an ACCEPTED invitation is refused (409) and Better Auth is not called",
  res.status === 409 && res.body.status === "accepted" && globalThis.__FQ_AUTH.calls.length === 0);

reset(); become("owner");
invitationRows = [{ id: "inv1", status: "canceled", expiresAt: new Date(Date.now() + DAY), createdAt: new Date() }];
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("a CANCELLED invitation is refused (409) — send a new one, not resend this one",
  res.status === 409 && res.body.status === "canceled" && globalThis.__FQ_AUTH.calls.length === 0);

reset(); become("owner");
invitationRows = [live];
globalThis.__FQ_AUTH.throws = Object.assign(new Error("boom"), { status: "BAD_REQUEST" });
res = await resend.POST(req("http://x"), { params: params({ id: "p1" }) });
check("a Better Auth failure is 502 with the reason, and recorded for /platform/errors",
  res.status === 502 && /boom/.test(res.body.error) && globalThis.__FQ_ERRORS.length === 1);

console.log("\nGET /api/settings/members/pending — the expiry on the row\n");
reset(); become("owner");
invitationRows = [live];
res = await pendingList.GET(req("http://x"));
check("each pending row carries expiresAt from the newest pending Invitation",
  res.status === 200 && res.body.pending[0].expiresAt === live.expiresAt);
become("employee");
res = await pendingList.GET(req("http://x"));
check("…in the narrow (no user:view) branch too", res.status === 200 && res.body.pending[0].expiresAt === live.expiresAt);
invitationRows = [];
become("owner");
res = await pendingList.GET(req("http://x"));
check("no invitation row → expiresAt null, not an invented date", res.body.pending[0].expiresAt === null);

console.log("\nThe screen\n");
const PAGE = src("app/app/settings/team/page.js");
check("Manage Team posts to the resend route", /\/api\/settings\/members\/pending\/\$\{pendingRow\.id\}\/resend/.test(PAGE));
check("…offers it only where Cancel is offered (canManageInvites)", /canManageInvites \? \(\s*<span[\s\S]*?resendInvite\(p\)/.test(PAGE));
check("…renders Expires in / today / Expired off expiresAt",
  /app\.setTeam\.expiresIn/.test(PAGE) && /app\.setTeam\.expiresToday/.test(PAGE) && /app\.setTeam\.expired/.test(PAGE) && /invitationExpiry\(p\.expiresAt\)/.test(PAGE));
check("…and distinguishes 'sent again' from 'renewed but the email failed'",
  /app\.setTeam\.resentInvite/.test(PAGE) && /app\.setTeam\.resentInviteNoEmail/.test(PAGE) && /data\?\.emailSent/.test(PAGE));

console.log("\nThe catalogue — every language has the strings\n");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
for (const key of ["app.setTeam.resendInvite", "app.setTeam.expiresIn", "app.setTeam.expiresToday", "app.setTeam.expired", "app.setTeam.errResend", "app.setTeam.resentInvite", "app.setTeam.resentInviteNoEmail", "app.setTeam.resendingInvite"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  check(`${key} in all ${Object.keys(APP_MESSAGES).length} languages`, missing.length === 0);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
