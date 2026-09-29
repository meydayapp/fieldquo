// scripts/check-member-request-cache.mjs
//
//   node --conditions=react-server --import ./scripts/alias-loader.mjs \
//     --import ./scripts/impersonation-stub-loader.mjs scripts/check-member-request-cache.mjs
//
// --conditions=react-server is required: it is what makes `react` resolve to
// the build whose cache() actually memoises (the default build's cache() is a
// pass-through), i.e. the build Next gives a server component.
//
// lib/currentMember.js memoises its database READS per server render (React's
// cache()), because app/app/layout.js asks getCurrentMember seven times per
// navigation and each used to re-read the session, company, member and
// subscription. This executes the real resolver and proves both halves:
//
//   1. the saving — seven layout-shaped callers in one render cost ONE session
//      read, one company, one member, one subscription;
//   2. what must not move — every DECISION is still per call. Inside a single
//      render: a skipBillingGate GET resolves while a gated POST is refused
//      402; an impersonated GET resolves while a POST and a write-shaped GET
//      are refused 403; a hidden feature's path 404s while the shell's path
//      resolves; one caller mutating its member changes nobody else's; two
//      concurrent renders for two users never see each other's rows; and
//      outside a render (route handlers) nothing is memoised at all.
//
// React's Flight server finds its per-request cache through the dispatcher on
// the server internals; this installs one backed by AsyncLocalStorage, which
// is what "one render" means here. The cache() under test is React's own.
process.env.IMPERSONATION_JWT_SECRET ||= "test-secret-for-guard-only-not-a-real-key";
delete process.env.DATABASE_URL;

import { AsyncLocalStorage } from "node:async_hooks";
import * as React from "react";
import { SignJWT } from "jose";
import { rows, resetImpersonationDb } from "./fixtures/impersonationDb.mjs";
import { auth } from "./fixtures/authStub.mjs";
import { getCurrentMember } from "@/lib/currentMember";
import { IMPERSONATION_COOKIE, impersonationSecret } from "@/lib/platform/impersonationToken";
import { featureForApiPath } from "@/lib/features/registry";

let passed = 0;
let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail !== undefined ? `  got: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
}
async function refusal(fn) {
  try {
    await fn();
    return null;
  } catch (err) {
    return err?.status ?? "threw-without-status";
  }
}

// ── One render = one cache ────────────────────────────────────────────────
const internals = React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
if (!internals) {
  console.log("✗ react resolved to the client build — run with --conditions=react-server");
  process.exit(1);
}
const renders = new AsyncLocalStorage();
internals.A = {
  getCacheForType(create) {
    const store = renders.getStore();
    if (!store) return create();
    if (!store.has(create)) store.set(create, create());
    return store.get(create);
  },
};
const inRender = (fn) => renders.run(new Map(), fn);

// ── The fixture: two companies, two users, counted reads ──────────────────
const DAY = 86_400_000;
const COMPANIES = {
  "org-a": { id: "co-a", authOrgId: "org-a" },
  "org-b": { id: "co-b", authOrgId: "org-b" },
};
const MEMBERS = {
  "u-a:co-a": { id: "m-a", role: "owner", active: true },
  "u-b:co-b": { id: "m-b", role: "estimator", active: true },
};
const SESSIONS = {
  "tok-a": { user: { id: "u-a" }, session: { activeOrganizationId: "org-a" } },
  "tok-b": { user: { id: "u-b" }, session: { activeOrganizationId: "org-b" } },
};
let subscriptions = {};
let counts = {};
const bump = (k) => (counts[k] = (counts[k] || 0) + 1);

function script({ subs = {}, adminRow = { role: "superadmin", active: true }, features = [] } = {}) {
  resetImpersonationDb();
  counts = {};
  subscriptions = subs;
  rows["company.findUnique"] = (args) => {
    if (args?.where?.authOrgId) {
      bump("company(authOrgId)");
      return COMPANIES[args.where.authOrgId] || null;
    }
    bump("company(id)");
    const c = Object.values(COMPANIES).find((x) => x.id === args?.where?.id);
    return c ? { ...c, createdAt: new Date(Date.now() - 90 * DAY), isDemo: false } : null;
  };
  rows["member.findUnique"] = (args) => {
    bump("member(userId_companyId)");
    const k = args?.where?.userId_companyId;
    return k ? MEMBERS[`${k.userId}:${k.companyId}`] || null : null;
  };
  rows["member.findFirst"] = (args) => {
    bump("member.findFirst");
    if (args?.where?.role === "owner") return args.where.companyId === "co-a" ? { id: "m-a", userId: "u-a", role: "owner" } : null;
    return null;
  };
  rows["subscription.findUnique"] = (args) => {
    bump("subscription");
    const s = subscriptions[args?.where?.companyId];
    return s ? { ...s, company: {} } : null;
  };
  rows["platformAdmin.findUnique"] = () => {
    bump("platformAdmin");
    return adminRow ? { ...adminRow } : null;
  };
  rows["platformFeature.findMany"] = () => {
    bump("platformFeature");
    return features;
  };
}

auth.api.getSession = async ({ headers }) => {
  bump("getSession");
  const m = (headers.get("cookie") || "").match(/better-auth\.session_token=([^;]+)/);
  return m ? SESSIONS[m[1]] || null : null;
};

const active = { status: "active", pastDueSince: null, canceledAt: null, cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: new Date(Date.now() + 20 * DAY), accessLockedAt: null, accessLockedReason: null, trialEndsAt: null };
const pastDue = { ...active, status: "past_due", pastDueSince: new Date(Date.now() - 2 * DAY) };

const userHeaders = (tok) => new Headers({ cookie: `better-auth.session_token=${tok}`, "user-agent": "check" });

// The seven calls app/app/layout.js makes, with its exact argument shapes —
// one Headers object shared by all, as `await headers()` is within a request.
function layoutCalls(h) {
  return Promise.all([
    getCurrentMember({ headers: h }), // getCompanyShell
    getCurrentMember({ headers: h }), // getAppLanguage
    getCurrentMember({ headers: h, method: "GET", url: "http://x/app" }, { skipBillingGate: true }), // getLockState
    getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true }), // getFeatureFlags
    getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true }), // resolveCallerPermissions
    getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true }), // getSetupRedirect
    getCurrentMember({ headers: h, method: "GET", url: "http://x/app/settings" }, { skipBillingGate: true }), // resolveSettingsShell
  ]);
}

// ═══════════════ 1. The saving ═════════════════════════════════════════════
console.log("\n1. Seven layout callers, one render\n");

script({ subs: { "co-a": active } });
const seven = await inRender(() => layoutCalls(userHeaders("tok-a")));
ok("all seven resolve the same member", seven.every((m) => m?.id === "m-a" && m?.companyId === "co-a" && m?.role === "owner"), seven.map((m) => m?.id));
ok("Better Auth getSession: once", counts.getSession === 1, counts.getSession);
ok("company by authOrgId: once", counts["company(authOrgId)"] === 1, counts["company(authOrgId)"]);
ok("member by userId_companyId: once", counts["member(userId_companyId)"] === 1, counts["member(userId_companyId)"]);
ok("subscription (billing access): once", counts.subscription === 1, counts.subscription);
ok("the skipBillingGate callers still carry billingAccess", seven.slice(2).every((m) => m?.billingAccess?.level === "full"));
ok("seven distinct objects, not one shared reference", new Set(seven).size === 7);
ok("…with distinct billingAccess objects too", new Set(seven.slice(2).map((m) => m.billingAccess)).size === 5);

console.log("\n   Outside a render (a route handler): no memo, exactly as before\n");
script({ subs: { "co-a": active } });
await layoutCalls(userHeaders("tok-a"));
ok("getSession ran for every call (7)", counts.getSession === 7, counts.getSession);
ok("subscription read for every call (7)", counts.subscription === 7, counts.subscription);

// ═══════════════ 2. Decisions stay per call ════════════════════════════════
console.log("\n2. Different options in one render never share a result\n");

script({ subs: { "co-a": pastDue } });
await inRender(async () => {
  const h = userHeaders("tok-a");
  const shell = await getCurrentMember({ headers: h, method: "GET", url: "http://x/app" }, { skipBillingGate: true });
  ok("past due: the layout's skipBillingGate call resolves", shell?.id === "m-a", shell);
  const read = await getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/quotes" });
  ok("…a gated GET in the same render still resolves (read-only grace)", read?.id === "m-a", read);
  const write = await refusal(() => getCurrentMember({ headers: h, method: "POST", url: "https://app.fieldquo.com/api/quotes" }));
  ok("…a gated POST in the same render is refused 402 — the GET's pass was not reused", write === 402, write);
  const pay = await getCurrentMember({ headers: h, method: "POST", url: "https://app.fieldquo.com/api/platform/billing/checkout" });
  ok("…and the billing POST is still allowed", pay?.id === "m-a", pay);
  ok("one subscription read served all four", counts.subscription === 1, counts.subscription);
});

// Order reversed: the refusal first, then the skip. Neither may colour the other.
script({ subs: { "co-a": { ...active, status: "past_due", pastDueSince: new Date(Date.now() - 30 * DAY) } } });
await inRender(async () => {
  const h = userHeaders("tok-a");
  const first = await refusal(() => getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/clients" }));
  ok("locked: a gated GET is refused 402", first === 402, first);
  const lock = await getCurrentMember({ headers: h, method: "GET", url: "http://x/app" }, { skipBillingGate: true });
  ok("…and the lock screen's skipBillingGate call after it still resolves, reading locked", lock?.billingAccess?.level === "locked", lock?.billingAccess);
});

console.log("\n   Impersonation stays read-only per call (non-negotiable #2)\n");
script({ subs: { "co-a": active } });
const token = await new SignJWT({ impersonation: true, mode: "read_only", companyId: "co-a", platformAdminId: "pa-1" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("30m")
  .sign(impersonationSecret());
await inRender(async () => {
  const h = new Headers({ cookie: `${IMPERSONATION_COOKIE}=${token}` });
  const layout = await layoutCalls(h);
  ok("seven layout callers resolve the read-only session", layout.every((m) => m?.impersonation === true && m?.impersonationMode === "read_only"));
  const get = await getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/clients" });
  ok("…a GET resolves", get?.impersonation === true, get);
  const post = await refusal(() => getCurrentMember({ headers: h, method: "POST", url: "https://app.fieldquo.com/api/clients" }));
  ok("…a POST in the same render is refused 403", post === 403, post);
  const shaped = await refusal(() => getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/calendar/google/callback" }));
  ok("…a write-shaped GET in the same render is refused 403", shaped === 403, shaped);
  const again = await getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/clients" });
  ok("…and a GET after the refusals still resolves (a throw is not cached)", again?.impersonation === true, again);
  ok("the platform admin row was read once for all eleven", counts.platformAdmin === 1, counts.platformAdmin);
  ok("no Better Auth session read at all for a support session", !counts.getSession, counts.getSession);
});

console.log("\n   Feature gate per path\n");
const hiddenKey = featureForApiPath("/api/voice/calls");
script({ subs: { "co-a": active }, features: [{ key: hiddenKey, state: "hidden", note: null }] });
await inRender(async () => {
  const h = userHeaders("tok-a");
  const shell = await getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true });
  ok(`the shell's call resolves with ${hiddenKey} hidden`, shell?.id === "m-a", shell);
  const hidden = await refusal(() => getCurrentMember({ headers: h, method: "GET", url: "https://app.fieldquo.com/api/voice/calls" }));
  ok("…the hidden feature's API in the same render answers 404", hidden === 404, hidden);
});

console.log("\n   One caller's mutation is nobody else's\n");
script({ subs: { "co-a": active } });
await inRender(async () => {
  const h = userHeaders("tok-a");
  const a = await getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true });
  a.role = "tampered";
  a.billingAccess.level = "tampered";
  const b = await getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true });
  ok("role unaffected", b?.role === "owner", b?.role);
  ok("billingAccess unaffected", b?.billingAccess?.level === "full", b?.billingAccess);
});

console.log("\n   Two concurrent renders, two users\n");
script({ subs: { "co-a": active, "co-b": pastDue } });
const [ra, rb] = await Promise.all([
  inRender(() => layoutCalls(userHeaders("tok-a"))),
  inRender(() => layoutCalls(userHeaders("tok-b"))),
]);
ok("render A sees only user A", ra.every((m) => m?.id === "m-a" && m?.companyId === "co-a"), ra.map((m) => m?.id));
ok("render B sees only user B", rb.every((m) => m?.id === "m-b" && m?.companyId === "co-b" && m?.role === "estimator"), rb.map((m) => m?.id));
ok("…with B's own billing state", rb.slice(2).every((m) => m?.billingAccess?.level !== "full"), rb[2]?.billingAccess);
ok("one session read per render (2)", counts.getSession === 2, counts.getSession);

console.log(`\n${passed + failed} checks, ${failed} failure(s).`);
process.exit(failed ? 1 : 0);
