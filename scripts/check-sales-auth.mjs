// scripts/check-sales-auth.mjs
//
//   npm run check:sales-auth
//
// The sales rep is a THIRD identity, beside a tenant's User and FieldQuo's own
// PlatformAdmin. This file proves the five things that make that safe, by
// RUNNING them — the shipped functions, against the inputs that would make a
// lazy implementation wave things through.
//
// ══ What is proven, and why each one earns a check ════════════════════════
//
//   1. Scope rejection is MUTUAL. A rep's token and a platform admin's token
//      are signed with the same secret (lib/sales/auth.js explains why one
//      secret beats a second env var that can be unset), so the signature says
//      nothing about which system minted it. Both verifiers are executed
//      against the other's token, in both directions. The direction that
//      matters most is the second: a long tail of /api/platform/* routes ask
//      only "is there an admin?", so a rep credential readable as a platform
//      one silently grants whatever the least careful of them grants.
//
//   2. An invitation is single-use and expires. Executed against an accepted
//      row, an expired row, a row with no expiry at all, a deactivated row and
//      a token that matches nothing.
//
//   3. A deactivated rep cannot authenticate — both the pure predicate and the
//      real gate, with the database stubbed, because a twelve-hour JWT
//      outlives a deactivation and the only thing that closes that window is
//      re-reading the row on every request.
//
//   4. assignedCompanyWhere() restricts to attributed companies ONLY. The
//      fragment is executed against fixture companies through a matcher that
//      implements Prisma's `is` semantics, rather than being read. This is the
//      tenant boundary itself, not a filter behind one — getting it wrong leaks
//      a whole customer's business, so "it looks right" is not evidence.
//
//   5. A rep has NO write path to attribution, commission, payouts or billing.
//      Proved twice: by executing the gate (every non-read method is refused
//      even for a perfectly valid, active rep) and by scanning every
//      app/api/sales route on disk for a Prisma write.
//
// ══ Source assertions are scoped to ONE named function ════════════════════
//
// Every text match below runs against the body of a single named function,
// extracted by brace matching and decommented first. A guard string appearing
// elsewhere in the same file — in a comment explaining it, or in a sibling
// handler — makes a whole-file match pass over a deleted guard. That produced
// a false pass earlier in this session, so it is not a hypothetical.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each guarantee was broken in turn, this file confirmed to FAIL, and the file
// restored from a `cp` backup taken first (never `git checkout` — that restores
// the commit, not the working copy). See the session report for which break
// failed which assertion.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { SignJWT } from "jose";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The secret every token below is signed with. Set before any product module is
// imported: lib/sales/auth.js and lib/platform/currentPlatformAdmin.js both
// resolve it per CALL rather than at module load — deliberately, see their
// headers — but setting it first keeps this script honest about what it is
// testing rather than depending on that.
process.env.PLATFORM_JWT_SECRET =
  process.env.PLATFORM_JWT_SECRET || "check-sales-auth-fixture-secret-0123456789";

// ── A scriptable stand-in for Prisma ──────────────────────────────────────
//
// lib/sales/gate.js has to be EXECUTED — a regex over it proves a guard is
// written down, not that it refuses, and passes happily against one disabled
// with `false &&`. Importing the real @/lib/db constructs a PrismaClient
// against Neon at module load, so the specifier is redirected here instead.
//
// Its own hook rather than scripts/db-stub-loader.mjs: that stub is shared by
// several checks and adding a model to it is an edit to their fixture. Same
// technique check-refusal-shape.mjs uses for next/server, and the same reason.
globalThis.__FQ_SALES_REP_ROW = null;
// Writes are RECORDED rather than swallowed, for the reason
// scripts/fixtures/dbStub.mjs gives: the gate stamps SalesRep.lastSeenAt on the
// way out, and "it wrote lastSeenAt and nothing else" is a claim about an
// argument. A stub that only answered would let the stamp widen unseen.
globalThis.__FQ_SALES_REP_WRITES = [];
const DB_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:sales-db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:sales-db")
    return { format: "module", shortCircuit: true, source:
      "export const db = { salesRep: { findUnique: async () => globalThis.__FQ_SALES_REP_ROW, updateMany: async (args) => { globalThis.__FQ_SALES_REP_WRITES.push(args); return { count: 1 }; } } };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(DB_HOOKS)}`);

const { SALES_COOKIE, SALES_SCOPE, carriesScope, signSalesToken, verifySalesToken, getCurrentSalesRep } =
  await import("@/lib/sales/auth");
const { getCurrentPlatformAdmin } = await import("@/lib/platform/currentPlatformAdmin");
const { assignedCompanyWhere, REP_COMPANY_SELECT } = await import("@/lib/sales/scope");
const {
  canAuthenticate,
  codeFromName,
  hashInviteToken,
  inviteState,
  isValidCode,
  newInviteToken,
  inviteExpiry,
  MIN_PASSWORD_LENGTH,
} = await import("@/lib/sales/invite");
const { requireSalesRep, REP_FORBIDDEN_WRITES } = await import("@/lib/sales/gate");
const { PAYOUT_WRITES_ON_SALES_REP } = await import("@/lib/sales/payoutWrite");
const { PREFERENCE_WRITES_ON_SALES_REP } = await import("@/lib/sales/preferenceWrite");
const { AUTODIAL_WRITES_ON_SALES_REP } = await import("@/lib/sales/autodialWrite");

let pass = 0;
const failures = [];
function ok(label, condition, got) {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(
      `  FAIL ${label}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`,
    );
  }
}

// ── Source helpers ────────────────────────────────────────────────────────

/** Blank out comments, preserving offsets. Same job as tenantScopeScan's. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (c === state) state = "code";
    out += c === "\n" ? "\n" : c;
    i++;
  }
  return out;
}

/**
 * The decommented body of ONE named function, by brace matching.
 *
 * This is the whole point of the "scope it to one function" rule: matching a
 * guard string against a whole file passes when the guard has been deleted and
 * the paragraph explaining it is still there, or when a sibling handler happens
 * to contain the same call. Returns "" when the function is missing, so an
 * assertion against a renamed function fails rather than silently checking
 * nothing.
 */
function namedFunctionBody(src, declaration) {
  const clean = decomment(src);
  const at = clean.indexOf(declaration);
  if (at < 0) return "";
  // Skip the parameter list before looking for the body's opening brace.
  // `function PATCH(request, { params })` destructures, so the first "{" after
  // the name is the PARAMETER's — matching from there returns "{ params }" and
  // every assertion against the handler silently passes over an empty string.
  // That is not hypothetical; it is what this helper did on its first run.
  let i = clean.indexOf("(", at + declaration.length - 1);
  if (i < 0) return "";
  let parens = 0;
  for (; i < clean.length; i++) {
    if (clean[i] === "(") parens++;
    else if (clean[i] === ")" && --parens === 0) break;
  }
  const open = clean.indexOf("{", i);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}" && --depth === 0) return clean.slice(open, i + 1);
  }
  return "";
}

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Every .js file under a directory.
 *
 * walk() below collects `route.js` ONLY, which is right for scanning routes and
 * silently wrong for scanning a library: `walk("lib/sales")` returns an empty
 * list, and a scan over an empty list passes every time. That is exactly what
 * the first version of the lib scan did — it reported no strays because it read
 * no files, and two planted violations sailed through it.
 */
function walkJs(dir, out = []) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walkJs(rel, out);
    else if (entry.endsWith(".js")) out.push(rel);
  }
  return out;
}

function walk(dir, out = []) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (entry === "route.js") out.push(rel);
  }
  return out;
}

const request = (cookies = {}, method = "GET") => ({
  method,
  cookies: {
    get: (name) =>
      cookies[name] === undefined ? undefined : { value: cookies[name] },
  },
});

console.log("\nSales rep identity — the third one\n");

// ═══════════════ 1. Mutual scope rejection, executed both ways ═════════════

console.log("1. A rep token and a platform token can never be read as each other\n");

const secret = new TextEncoder().encode(process.env.PLATFORM_JWT_SECRET);
const salesToken = await signSalesToken("rep_alpha");
const platformToken = await new SignJWT({ adminId: "admin_1", role: "superadmin" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("12h")
  .setIssuedAt()
  .sign(secret);
// A third scope nobody mints today. It must be refused by BOTH — the rule is
// "any scope is somebody else's", not a list of known ones.
const otherScopeToken = await new SignJWT({ adminId: "admin_1", role: "superadmin", scope: "future" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("12h")
  .setIssuedAt()
  .sign(secret);

// Two tokens that ISOLATE the scope check. Both carry a usable salesRepId, so
// the only thing that can refuse them is the scope claim itself.
//
// This matters more than it looks. The first version of this section used the
// platform token above, which carries adminId and no salesRepId — so deleting
// the scope check entirely still left the payload-shape guard to refuse it, and
// the mutation test passed against a verifier with no scope check at all. An
// assertion that survives the mutation it was written for is not an assertion.
const unscopedRepToken = await new SignJWT({ salesRepId: "rep_alpha" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("12h")
  .sign(secret);
const wrongScopeRepToken = await new SignJWT({ salesRepId: "rep_alpha", scope: "platform" })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("12h")
  .sign(secret);

ok("a rep token verifies as a rep", (await verifySalesToken(salesToken))?.salesRepId === "rep_alpha");
ok(
  "a PLATFORM token is refused by the sales verifier, despite a valid signature",
  (await verifySalesToken(platformToken)) === null,
);
ok(
  "a token with some other scope is refused by the sales verifier too",
  (await verifySalesToken(otherScopeToken)) === null,
);
ok(
  "an otherwise-perfect rep payload with NO scope claim is refused",
  (await verifySalesToken(unscopedRepToken)) === null,
);
ok(
  "an otherwise-perfect rep payload with the WRONG scope is refused",
  (await verifySalesToken(wrongScopeRepToken)) === null,
);
ok(
  "a SALES token is refused by getCurrentPlatformAdmin",
  (await getCurrentPlatformAdmin(request({ "platform-token": salesToken }))) === null,
);
ok(
  "...and a token with any other scope is refused there as well",
  (await getCurrentPlatformAdmin(request({ "platform-token": otherScopeToken }))) === null,
);
ok(
  "a real platform token still works — the rejection is not a blanket one",
  (await getCurrentPlatformAdmin(request({ "platform-token": platformToken })))?.role ===
    "superadmin",
);
ok(
  "a platform token planted in the SALES cookie resolves to nobody",
  (await getCurrentSalesRep(request({ [SALES_COOKIE]: platformToken }))) === null,
);
ok(
  "the two cookies are different names",
  SALES_COOKIE !== "platform-token" && SALES_COOKIE.length > 0,
);
ok("the sales scope claim is mandatory and non-empty", SALES_SCOPE === "sales");
ok(
  "carriesScope() answers on the claim's presence, not on its value",
  carriesScope({ scope: "sales" }) === true &&
    carriesScope({ scope: "future" }) === true &&
    carriesScope({ adminId: "a" }) === false &&
    carriesScope(null) === false,
);

// A forged token signed with a DIFFERENT secret must fail before scope is even
// considered — otherwise the scope check would be doing the signature's job.
{
  const forged = await new SignJWT({ salesRepId: "rep_alpha", scope: SALES_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode("a-completely-different-secret-value-here"));
  ok("a token signed with another secret is refused", (await verifySalesToken(forged)) === null);
}

// Both middleware gates, read from the body of middleware() itself.
{
  const body = namedFunctionBody(read("middleware.js"), "export async function middleware(");
  ok("middleware() was found and parsed", body.length > 500);
  ok(
    "middleware's platform gates refuse a scoped token (twice — API and pages)",
    (body.match(/carriesScope\(payload\)/g) || []).length === 2,
    (body.match(/carriesScope\(payload\)/g) || []).length,
  );
  // Matched as EXACT statements, not as loose regexes.
  //
  // `/pathname\.startsWith\("\/api\/sales"\)/` still matches
  // `if (false && pathname.startsWith("/api/sales"))` — which is a disabled
  // gate — so the mutation test for "the sales gate was switched off" passed
  // against a switched-off gate. Requiring the whole condition closes that.
  ok(
    "middleware gates /api/sales, with nothing short-circuiting the condition",
    body.includes('if (pathname.startsWith("/api/sales")) {'),
  );
  ok(
    "middleware gates the /sales pages the same way",
    body.includes('if (pathname.startsWith("/sales")) {'),
  );
  ok(
    "both sales gates actually read the cookie and verify it",
    (body.match(/const salesToken = request\.cookies\.get\(SALES_COOKIE\)\?\.value;/g) || [])
      .length === 2 &&
      (body.match(/await verifySalesToken\(salesToken\)/g) || []).length === 2,
  );
  // The exclusion list is read as its own declaration rather than searched for
  // across the whole function. A `[\s\S]*?` between the constant's name and the
  // path string matches the SALES GATE's own startsWith("/sales") two hundred
  // lines further down, so deleting the name from the list still "passed".
  {
    const at = body.indexOf("const isStaffSurface =");
    const decl = at < 0 ? "" : body.slice(at, body.indexOf(";", at) + 1);
    ok(
      "/sales and /api/sales are named in the impersonation exclusion, beside /platform",
      decl.includes('pathname.startsWith("/sales")') &&
        decl.includes('pathname.startsWith("/api/sales")') &&
        decl.includes('pathname.startsWith("/platform")') &&
        decl.includes('pathname.startsWith("/api/platform")'),
      decl,
    );
    ok(
      "...and the impersonation gate consults it",
      body.includes("if (impersonationToken && !isStaffSurface) {"),
    );
  }
  // Ordering: the subdomain rewrite has to still come first, and the sales
  // gate has to sit before the /app one. Positions inside the one function.
  // Each gate is located by the thing only IT does — reading its own cookie —
  // rather than by its path test. The path strings are the wrong marker: the
  // impersonation block's isStaffSurface list names "/api/platform" and
  // "/api/sales" before either gate runs, and its inner condition names "/app",
  // so a naive indexOf finds all three in the wrong order and this assertion
  // fails against correct code. That is what it did on its first run.
  const posSubdomain = body.indexOf("subdomainFromHost(");
  const posImpersonation = body.indexOf("verifyImpersonationToken(");
  const posPlatform = body.indexOf('request.cookies.get("platform-token")');
  const posSales = body.indexOf("request.cookies.get(SALES_COOKIE)");
  const posApp = body.indexOf("getSessionCookie(request)");
  ok(
    "order: subdomain rewrite → impersonation → platform → sales → app",
    posSubdomain >= 0 &&
      posSubdomain < posImpersonation &&
      posImpersonation < posPlatform &&
      posPlatform < posSales &&
      posSales < posApp,
    { posSubdomain, posImpersonation, posPlatform, posSales, posApp },
  );
}

// ═══════════════ 2. An invitation is single-use and expires ════════════════

console.log("\n2. An expired or already-used invitation is refused\n");

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);
const liveInvite = {
  active: true,
  endedAt: null,
  acceptedAt: null,
  inviteExpiresAt: future,
};

ok("a live invitation is accepted", inviteState(liveInvite).ok === true);
ok(
  "a token matching no row is refused as unknown",
  inviteState(null).ok === false && inviteState(null).reason === "unknown",
);
ok(
  "an ALREADY-ACCEPTED invitation is refused",
  inviteState({ ...liveInvite, acceptedAt: past }).reason === "accepted",
);
ok(
  "an EXPIRED invitation is refused",
  inviteState({ ...liveInvite, inviteExpiresAt: past }).reason === "expired",
);
ok(
  "an invitation with no expiry at all is refused, not treated as forever",
  inviteState({ ...liveInvite, inviteExpiresAt: null }).reason === "expired",
);
ok(
  "an invitation expiring at exactly now is refused (the boundary is closed)",
  (() => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    return inviteState({ ...liveInvite, inviteExpiresAt: now }, now).reason === "expired";
  })(),
);
ok(
  "a DEACTIVATED rep's invitation is refused",
  inviteState({ ...liveInvite, active: false }).reason === "inactive" &&
    inviteState({ ...liveInvite, endedAt: past }).reason === "inactive",
);
ok(
  "accepted outranks expired — a used link never reports as merely stale",
  inviteState({ ...liveInvite, acceptedAt: past, inviteExpiresAt: past }).reason === "accepted",
);

{
  const { token, hash } = newInviteToken();
  const second = newInviteToken();
  ok("the stored hash is not the token", hash !== token && token.length >= 32);
  ok("hashing is deterministic", hashInviteToken(token) === hash);
  ok("two invitations never collide", second.token !== token && second.hash !== hash);
  ok(
    "the token is URL-safe — it travels in a path segment",
    /^[A-Za-z0-9_-]+$/.test(token),
  );
  ok(
    "the default expiry is in the future and inside a fortnight",
    inviteExpiry() > new Date() &&
      inviteExpiry() < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  );
}

// The accept route must look the row up BY HASH and must clear the hash in the
// same write that stamps acceptedAt. Scoped to the POST handler only — the GET
// above it also hashes, and a whole-file match would pass on a POST that had
// stopped doing either.
{
  const src = read("app/api/sales/auth/invite/route.js");
  const post = namedFunctionBody(src, "export async function POST(");
  ok("the accept route's POST was found", post.length > 200);
  ok("POST re-evaluates inviteState on a freshly read row", /inviteState\(rep\)/.test(post));
  ok(
    "POST clears the invite token and expiry in the same write as acceptedAt",
    /acceptedAt:\s*now/.test(post) &&
      /inviteTokenHash:\s*null/.test(post) &&
      /inviteExpiresAt:\s*null/.test(post),
  );
  ok(
    "POST re-states acceptedAt: null in the WHERE, so a race updates zero rows",
    /updateMany\(\{ where: \{ id: rep\.id, acceptedAt: null \}/.test(
      post.replace(/\s+/g, " "),
    ),
  );
  ok(
    "the plaintext token is never stored — only hashInviteToken's output",
    !/inviteTokenHash:\s*token/.test(decomment(src)),
  );
  ok(
    "a short password is refused before anything is written",
    new RegExp(`password\\.length\\s*<\\s*MIN_PASSWORD_LENGTH`).test(post) &&
      MIN_PASSWORD_LENGTH >= 12,
  );
}

// ═══════════════ 3. A deactivated rep cannot authenticate ══════════════════

console.log("\n3. A deactivated rep cannot authenticate\n");

const goodRep = {
  id: "rep_alpha",
  email: "dana@fieldquo.com",
  name: "Dana",
  code: "dana",
  active: true,
  endedAt: null,
  acceptedAt: past,
  passwordHash: "$2a$10$fixture",
};

ok("an active, accepted rep may authenticate", canAuthenticate(goodRep) === true);
ok("a DEACTIVATED rep may not", canAuthenticate({ ...goodRep, active: false }) === false);
ok("a rep who has LEFT may not", canAuthenticate({ ...goodRep, endedAt: new Date() }) === false);
ok(
  "a rep who never accepted their invite may not",
  canAuthenticate({ ...goodRep, acceptedAt: null }) === false,
);
ok(
  "a rep with no password may not",
  canAuthenticate({ ...goodRep, passwordHash: null }) === false,
);
ok("nobody may authenticate as nobody", canAuthenticate(null) === false);

// Now through the real gate, with the row read from the stub. The token below
// is valid and unexpired in every case — the ONLY thing that changes is the
// row, which is the point: a twelve-hour JWT outlives a deactivation.
{
  globalThis.__FQ_SALES_REP_ROW = goodRep;
  const allowed = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }));
  ok("the gate lets an active rep through", allowed.refusal === null && allowed.rep?.id === "rep_alpha");
  ok(
    "...and never hands the password hash back to a route",
    allowed.rep && !("passwordHash" in allowed.rep),
    allowed.rep && Object.keys(allowed.rep),
  );

  globalThis.__FQ_SALES_REP_ROW = { ...goodRep, active: false };
  const deactivated = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }));
  ok(
    "the gate refuses a DEACTIVATED rep holding a still-valid token",
    deactivated.rep === null && deactivated.refusal?.status === 401,
    deactivated.refusal,
  );

  globalThis.__FQ_SALES_REP_ROW = null;
  const deleted = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }));
  ok(
    "the gate refuses a token whose rep row is gone",
    deleted.rep === null && deleted.refusal?.status === 401,
  );

  globalThis.__FQ_SALES_REP_ROW = goodRep;
  const noCookie = await requireSalesRep(request({}));
  ok("the gate refuses a request with no sales cookie", noCookie.refusal?.status === 401);

  const platformCookie = await requireSalesRep(request({ [SALES_COOKIE]: platformToken }));
  ok(
    "the gate refuses a platform admin's token presented as a rep's",
    platformCookie.refusal?.status === 401,
  );
}

// ═══════════════ 4. assignedCompanyWhere restricts to the rep's own book ═══

console.log("\n4. assignedCompanyWhere() sees attributed companies and nothing else\n");

// Prisma's `is` semantics for an optional to-one relation: a company with no
// SalesAttribution row never matches, and every named field must be equal.
function matches(company, where) {
  for (const [key, value] of Object.entries(where)) {
    if (key === "salesAttribution") {
      const attribution = company.salesAttribution;
      if (!attribution) return false;
      for (const [k, v] of Object.entries(value.is || {})) {
        if (attribution[k] !== v) return false;
      }
      continue;
    }
    if (company[key] !== value) return false;
  }
  return true;
}

const fixtureCompanies = [
  { id: "co_1", name: "Northline", salesAttribution: { salesRepId: "rep_alpha" } },
  { id: "co_2", name: "Sunset", salesAttribution: { salesRepId: "rep_alpha" } },
  { id: "co_3", name: "Rivera", salesAttribution: { salesRepId: "rep_beta" } },
  // The permanent, correct state for every company that predates the sales
  // portal. Null attribution is not a gap to fill in.
  { id: "co_4", name: "Truefinish", salesAttribution: null },
];
const seen = (repId) =>
  fixtureCompanies.filter((c) => matches(c, assignedCompanyWhere(repId))).map((c) => c.id);

ok("a rep sees exactly their own two companies", JSON.stringify(seen("rep_alpha")) === '["co_1","co_2"]', seen("rep_alpha"));
ok("another rep sees only theirs", JSON.stringify(seen("rep_beta")) === '["co_3"]', seen("rep_beta"));
ok("an unattributed company is invisible to everyone", !seen("rep_alpha").includes("co_4") && !seen("rep_beta").includes("co_4"));
ok("a rep with no attributions sees nothing", seen("rep_gamma").length === 0);

for (const hostile of [null, undefined, "", 0, {}, [], true, "__none__"]) {
  ok(
    `a scope filter that cannot identify the rep (${JSON.stringify(hostile)}) narrows to NOTHING`,
    seen(hostile).length === 0,
    seen(hostile),
  );
}
ok(
  "the fragment is never an empty object — {} would mean 'every company'",
  [null, undefined, "", "rep_alpha"].every(
    (v) => Object.keys(assignedCompanyWhere(v)).length > 0,
  ),
);
ok(
  "the fragment never carries an `id`, so spreading it cannot widen a caller's query",
  [null, "rep_alpha"].every((v) => !("id" in assignedCompanyWhere(v))),
);
{
  // Spread into a where that already names an id: the id must survive and the
  // attribution filter must still apply.
  const combined = { id: "co_3", ...assignedCompanyWhere("rep_alpha") };
  ok(
    "spread beside an id, it narrows rather than replaces",
    combined.id === "co_3" && !matches(fixtureCompanies[2], combined),
  );
}

// What a rep may READ. An allowlist, checked exactly — a column added to
// Company must not appear here by default, and one removed here must not be a
// silent widening somewhere else.
{
  const keys = Object.keys(REP_COMPANY_SELECT).sort();
  const expected = [
    "createdAt",
    "id",
    "isDemo",
    "name",
    "onboardingCompletedAt",
    "salesAttribution",
    "stripeChargesEnabled",
    "subscription",
  ];
  ok(
    "the rep's company read shape is exactly the declared allowlist",
    JSON.stringify(keys) === JSON.stringify(expected),
    keys,
  );
  for (const forbidden of [
    "quotes",
    "clients",
    "invoices",
    "jobs",
    "payments",
    "leads",
    "email",
    "phone",
    "address",
    "defaultRate",
  ]) {
    ok(`a rep cannot read Company.${forbidden}`, !(forbidden in REP_COMPANY_SELECT));
  }
  ok(
    "the subscription sub-select is status only — not the Stripe ids or the plan",
    JSON.stringify(Object.keys(REP_COMPANY_SELECT.subscription.select)) === '["status"]',
  );
}

// ═══════════════ 5. A rep has no write path, at all ════════════════════════

console.log("\n5. A rep cannot write to attribution, commission, payouts or billing\n");

ok(
  "the four the brief names are all on the forbidden list",
  ["salesAttribution", "salesCommissionEntry", "salesPayoutBatch", "subscription"].every((m) =>
    REP_FORBIDDEN_WRITES.includes(m),
  ),
  REP_FORBIDDEN_WRITES,
);
ok(
  "a rep cannot write their OWN row either — rotating a code is the same escalation",
  REP_FORBIDDEN_WRITES.includes("salesRep"),
);

// Executed: every write-shaped method is refused for a fully valid, active rep.
{
  globalThis.__FQ_SALES_REP_ROW = goodRep;
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    const result = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }, method));
    ok(
      `the gate refuses ${method} even for a perfectly valid rep`,
      result.rep === null && result.refusal?.status === 403,
      result.refusal,
    );
  }
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const result = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }, method));
    ok(`${method} still reads`, result.refusal === null);
  }
}

// ── The one column this gate writes, and when ─────────────────────────────
//
// The floor board used to print "has never signed in" for any rep with no
// SalesRepActivity row, because nothing recorded a rep merely opening the
// portal. requireSalesRep now stamps SalesRep.lastSeenAt on the way out. That
// is a write to a table on REP_FORBIDDEN_WRITES, so it is asserted here rather
// than trusted: one column, server clock, and only on a request that was
// actually served.
{
  globalThis.__FQ_SALES_REP_ROW = goodRep;

  globalThis.__FQ_SALES_REP_WRITES = [];
  const read = await requireSalesRep(request({ [SALES_COOKIE]: salesToken }, "GET"));
  const stamped = globalThis.__FQ_SALES_REP_WRITES;
  ok(
    "a rep's read stamps that they were seen in the portal",
    read.refusal === null && stamped.length === 1,
    stamped,
  );
  ok(
    "and stamps ONLY lastSeenAt, with the server's clock",
    stamped.length === 1 &&
      Object.keys(stamped[0].data || {}).join() === "lastSeenAt" &&
      stamped[0].data.lastSeenAt instanceof Date &&
      stamped[0].where?.id === goodRep.id,
    stamped[0],
  );

  globalThis.__FQ_SALES_REP_WRITES = [];
  await requireSalesRep(request({ [SALES_COOKIE]: salesToken }, "POST"));
  ok(
    "a refused write does not record the rep as present",
    globalThis.__FQ_SALES_REP_WRITES.length === 0,
    globalThis.__FQ_SALES_REP_WRITES,
  );

  globalThis.__FQ_SALES_REP_WRITES = [];
  globalThis.__FQ_SALES_REP_ROW = { ...goodRep, active: false };
  await requireSalesRep(request({ [SALES_COOKIE]: salesToken }, "GET"));
  ok(
    "a deactivated rep's request is not a sign-in either",
    globalThis.__FQ_SALES_REP_WRITES.length === 0,
    globalThis.__FQ_SALES_REP_WRITES,
  );

  globalThis.__FQ_SALES_REP_WRITES = [];
  await requireSalesRep(request({}, "GET"));
  ok(
    "no cookie, no stamp — the board cannot be filled in by a stranger",
    globalThis.__FQ_SALES_REP_WRITES.length === 0,
  );
  globalThis.__FQ_SALES_REP_ROW = goodRep;
}

// And the routes on disk. A write that never reaches the gate — a handler that
// forgot to call it — would be invisible to the assertions above.
//
// ── What this scan asserts, and what it deliberately does not ────────────
//
// It does NOT assert "no writes under /api/sales". The outreach feature
// (another change, landing beside this one) legitimately lets a rep write their
// own SalesLead / SalesThread / SalesMessage rows through
// lib/sales/outreachGate.js, whose header argues that case and names the three
// tables. Those are the rep's own notes about people who are not customers, and
// none of them decides money.
//
// What it asserts is the guarantee this file exists for: NOTHING under
// /api/sales writes to a table on REP_FORBIDDEN_WRITES. That list is the
// commission-and-attribution boundary, and it holds whatever else the portal
// grows.
//
// One write to a forbidden table is declared, by name, with the reason:
// accepting an invitation writes SalesRep, and the actor is not a signed-in rep
// at all — they have no session — but somebody holding a single-use, expiring
// token. If that declaration stops matching a real write, this check says so.
const FORBIDDEN_WRITE_BY_DESIGN = {
  "app/api/sales/auth/invite/route.js":
    "Invite acceptance. The actor is not a signed-in rep — they have no session " +
    "at all — and the write is gated on a single-use, expiring token hash. It " +
    "writes SalesRep.passwordHash/acceptedAt for the row that token names, plus " +
    "SalesRep.language when the accept screen's picker sent one, and nothing else.",
};

const WRITE_OPS = "create|createMany|update|updateMany|upsert|delete|deleteMany";
const WRITE_RE = new RegExp(`\\bdb\\.(\\w+)\\.(${WRITE_OPS})\\b`, "g");
const salesRoutes = walk("app/api/sales");
ok("there are sales API routes to check", salesRoutes.length >= 4, salesRoutes);

// ── The library, not just the routes ──────────────────────────────────────
//
// This scan used to cover app/api/sales only, and that was an escape hatch:
// moving a forbidden write out of a route and into lib/ made it pass while
// changing nothing. I did exactly that when /sales/payout turned this check
// red, and adding a fence for the one file I had moved it to left the hatch
// open for every other file in lib/sales.
//
// So the library is scanned on the same terms as the routes. Two writes to a
// forbidden table are sanctioned and both are declared by name with the reason
// — the same shape as FORBIDDEN_WRITE_BY_DESIGN above, and asserted below so a
// declaration that stops matching a real write is itself a failure.
const LIB_FORBIDDEN_WRITE_BY_DESIGN = {
  "lib/sales/gate.js":
    "stampLastSeen(). The value is the server's clock, no part of the request " +
    "can change what is written, and nothing pays out on it — the most a rep " +
    "can do by hammering the portal is be honestly recorded as present. " +
    "GATE_WRITES_ON_SALES_REP names the single column.",
  "lib/sales/demoAssign.js":
    "Claiming and releasing a demo sandbox. Writes ONLY demoCompanyId — a " +
    "pointer at a Company that isDemo, which decides nothing about what a rep " +
    "is owed, credits no company, and mints no entry. The claim is a " +
    "compare-and-set with `demoCompanyId: null` in the WHERE, so a rep cannot " +
    "take one already held. Column asserted below.",
  "lib/sales/payoutWrite.js":
    "savePayoutDestination(). Writes ONLY the payout destination columns — " +
    "PAYOUT_WRITES_ON_SALES_REP — which cannot change what is owed or who a " +
    "company is credited to. The batch and the ledger stay forbidden, every " +
    "change is audited with the handle masked, and the key set is asserted " +
    "below rather than trusted.",
  "lib/sales/attribution.js":
    "The attribution library itself, reached by the lead-link route. Declared " +
    "on 2026-09-11 when the owner reopened ONE rep-side door: a rep may claim " +
    "an UNCLAIMED company for themselves by typing the email it registered " +
    "with, from a lead created BEFORE the company signed up, source " +
    "\"lead_link\". The claim is verified inside decideAttribution() against " +
    "rows read in the same transaction; self-dealing and an existing " +
    "attribution refuse exactly as they do for \"manual\". What a rep still " +
    "cannot reach is fenced below: the route names only withUniqueRetry, the " +
    "db half calls captureAttributionWithin with the SESSION's rep id and " +
    "that one source, and nothing rep-facing touches correctAttributionWithin " +
    "— the superadmin correction that can move or delete a row.",
  "lib/sales/preferenceWrite.js":
    "saveRepLanguage(). Writes ONLY SalesRep.language — " +
    "PREFERENCE_WRITES_ON_SALES_REP — which decides which words the chrome of " +
    "the rep's own console is drawn in. It cannot change what is owed, who a " +
    "company is credited to, whether a batch pays, or whether the rep can sign " +
    "in tomorrow, and the value comes from a closed set validated against " +
    "app/i18n/languages.js. Its own file rather than a second function in " +
    "payoutWrite.js, because the payout fence below locates ONE update by " +
    "index and a second one in that file would be scanned by nothing. Column " +
    "asserted below.",
  "lib/sales/autodialWrite.js":
    "saveRepAutodial(). Writes ONLY SalesRep.autodial — " +
    "AUTODIAL_WRITES_ON_SALES_REP — the switch that makes the rep's own queue " +
    "screen count down and press Call after they log an outcome. It cannot " +
    "change what is owed, who a company is credited to, whether a batch pays, " +
    "or whether the rep can sign in tomorrow, and it authorises no call: every " +
    "autodialled dial still passes the gate in /api/sales/calls. A boolean the " +
    "writer refuses to coerce. Its own file for the reason preferenceWrite.js " +
    "gives — one writer per file, so the index-located fence sees it. Column " +
    "asserted below.",
};

const stray = [];
for (const file of salesRoutes) {
  if (FORBIDDEN_WRITE_BY_DESIGN[file]) continue;
  const src = decomment(read(file));
  for (const m of src.matchAll(WRITE_RE)) {
    if (REP_FORBIDDEN_WRITES.includes(m[1])) stray.push(`${file}: ${m[1]}.${m[2]}`);
  }
}

// Routes call `db.` directly; library modules take an injected client so a
// check can drive them, so a lib scan that only matched `db.` would miss every
// one of them — payoutWrite.js writes `client.salesRep.update`, and the first
// version of this scan waved it through. Named prefixes rather than `\w+.`,
// which would match any object property chain and cry wolf.
const LIB_WRITE_RE = new RegExp(`\\b(?:db|client|tx|prisma)\\.(\\w+)\\.(${WRITE_OPS})\\b`, "g");

// ── What the REP-FACING routes can reach, one hop out ─────────────────────
//
// A blanket scan of lib/sales was the wrong rule and briefly shipped: it
// flagged attribution.js, commission.js and payouts.js, which are the PLATFORM
// modules that actually do the paying. REP_FORBIDDEN_WRITES governs what a
// REP'S IDENTITY may write, not what the library may do on FieldQuo's behalf,
// and conflating the two would have banned the product from paying anybody.
//
// The real hole is narrower and I opened it myself: the route scan cannot see
// through a function call. When /sales/payout turned this check red I moved the
// write into lib/ and the grep went quiet — nothing about the rep's power had
// changed. So the modules a rep-facing route actually IMPORTS are scanned on
// the same terms as the route, with the sanctioned ones declared by name.
//
// One hop, not transitive: a hop is what a route author can see and reason
// about, and a full graph would drag in the platform modules again through some
// shared helper and re-create the false rule above.
const reachable = new Set();
for (const file of salesRoutes) {
  for (const m of decomment(read(file)).matchAll(/from "@\/(lib\/sales\/[\w./-]+)"/g)) {
    const rel = m[1].endsWith(".js") ? m[1] : `${m[1]}.js`;
    if (existsSync(join(ROOT, rel))) reachable.add(rel);
  }
}
ok("the reachability scan found the modules routes import", reachable.size > 5, reachable.size);

const libStray = [];
for (const file of reachable) {
  if (LIB_FORBIDDEN_WRITE_BY_DESIGN[file]) continue;
  for (const m of decomment(read(file)).matchAll(LIB_WRITE_RE)) {
    if (REP_FORBIDDEN_WRITES.includes(m[1])) libStray.push(`${file}: ${m[1]}.${m[2]}`);
  }
}
ok(
  "no module a rep-facing route imports writes a forbidden table, except the declared",
  libStray.length === 0,
  libStray,
);
// A declaration that no longer matches a real write is a stale permission, and
// stale permissions are how a rule quietly stops meaning anything.
for (const [file, why] of Object.entries(LIB_FORBIDDEN_WRITE_BY_DESIGN)) {
  const writes = [...decomment(read(file)).matchAll(LIB_WRITE_RE)].filter((m) =>
    REP_FORBIDDEN_WRITES.includes(m[1]),
  );
  ok(`${file} still makes the write it is exempted for`, writes.length > 0, why.slice(0, 40));
}

// ── The lead-link door into attribution.js, fenced ────────────────────────
//
// Declared above so the reachability scan lets attribution.js through for the
// link route. The declaration promises a SHAPE — one function, the session's
// rep, one source — and this is where the shape is checked rather than trusted.
{
  const linkRoute = decomment(read("app/api/sales/leads/[id]/link/route.js"));
  const leadLink = decomment(read("lib/sales/leadLink.js"));
  const named = [...linkRoute.matchAll(/import \{([^}]*)\} from "@\/lib\/sales\/attribution"/g)]
    .flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
  ok("the link route imports exactly one name from attribution.js", named.length === 1 && named[0] === "withUniqueRetry", named);
  ok("the link route never names a capture or correction function", !/capture\w*Attribution|correct\w*Attribution/.test(linkRoute));
  const calls = [...leadLink.matchAll(/captureAttributionWithin\(tx,\s*\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  ok("leadLink.js captures attribution in exactly one place", calls.length === 1, calls.length);
  ok("…with the session's rep id, never a body field", /salesRepId:\s*rep\.id/.test(calls[0] || ""));
  ok("…with source \"lead_link\" and nothing else", /source:\s*"lead_link"/.test(calls[0] || "") && !/source:\s*"(link|manual|admin)"/.test(leadLink));
  ok("…and passes the claim the decision verifies", /claim:\s*\{\s*email,\s*leadCreatedAt: lead\.createdAt\s*\}/.test(calls[0] || ""));
  ok("leadLink.js never reaches the superadmin correction", !/correct\w*Attribution/.test(leadLink));
  ok("leadLink.js never writes the attribution tables directly", !/\b(?:db|tx|client|prisma)\.salesAttribution\w*\.(create|update|updateMany|upsert|delete|deleteMany)/.test(leadLink));
  // Nothing ELSE rep-facing may import attribution.js on the strength of this
  // declaration. The exemption is for the link route's shape, not the file.
  const importers = salesRoutes.filter((f) => /from "@\/lib\/sales\/attribution"/.test(decomment(read(f))));
  ok("the link route is the only /api/sales route importing attribution.js", importers.length === 1 && importers[0] === "app/api/sales/leads/[id]/link/route.js", importers);
}

// ── The demo pointer, fenced the same way ─────────────────────────────────
//
// Declared above, so the reachability scan lets it through. A declaration is a
// promise about which COLUMN, and a promise nothing checks is how `active` or
// `commissionPlanId` ends up in the same update six months from now.
{
  const demoSrc = decomment(read("lib/sales/demoAssign.js"));
  const blocks = [...demoSrc.matchAll(/salesRep\.updateMany\(\{[\s\S]{0,400}?\}\)/g)].map((m) => m[0]);
  ok("the demo writer's updates were located", blocks.length >= 2, blocks.length);
  const keys = new Set();
  for (const b of blocks) {
    const at = b.indexOf("data: {");
    if (at < 0) continue;
    for (const k of b.slice(at).matchAll(/(\w+):/g)) if (k[1] !== "data") keys.add(k[1]);
  }
  ok(
    "…and they set demoCompanyId and nothing else",
    keys.size === 1 && keys.has("demoCompanyId"),
    [...keys],
  );
  // The compare-and-set that stops a rep taking a demo somebody already holds.
  ok("…and claim is a compare-and-set on an unheld demo", /demoCompanyId: null/.test(demoSrc));
}

// ── The one sanctioned rep-row write, and its fence ────────────────────────
//
// Moving a forbidden write out of a route and into lib/ would make the grep
// above pass while changing nothing — gaming this check rather than obeying it.
// So the exemption is asserted here too: lib/sales/payoutWrite.js is the ONLY
// place outside the gate that writes SalesRep, and it must touch a closed set
// of destination columns and nothing else.
//
// Same shape as GATE_WRITES_ON_SALES_REP, for the same reason: the rule has to
// be checkable, not merely written down.
{
  const payoutSrc = decomment(read("lib/sales/payoutWrite.js"));
  const columns = PAYOUT_WRITES_ON_SALES_REP;
  ok("the payout writer names its columns as data", Array.isArray(columns) && columns.length === 3, columns);
  ok(
    "…and they are destination columns, never status, code, plan or acceptance",
    columns.every((c) => /^payout/.test(c)),
    columns,
  );
  // ── What the UPDATE actually sets ───────────────────────────────────
  //
  // Read out of the update's own data block rather than tested by a regex per
  // forbidden name. The first version sliced from `data: {` to `select: {`,
  // and `select: {` appears in the findUnique ABOVE the update — so the slice
  // was empty and every assertion passed against nothing. Adding `active: true`
  // to the writer did not fail the check. Same index-ordering trap this repo
  // has now hit three times.
  //
  // So: find the update, take its data block, and compare the KEY SET. A
  // whitelist cannot be defeated by a name nobody thought to forbid.
  const upd = payoutSrc.indexOf("salesRep.update(");
  const dataAt = payoutSrc.indexOf("data: {", upd);
  const dataEnd = payoutSrc.indexOf("select: {", dataAt);
  ok("the update's data block was located", upd > 0 && dataAt > upd && dataEnd > dataAt, { upd, dataAt, dataEnd });
  const dataBlock = payoutSrc.slice(dataAt, dataEnd);
  const written = [...dataBlock.matchAll(/(\w+):/g)].map((m) => m[1]).filter((k) => k !== "data");
  ok(
    "the writer sets EXACTLY the destination columns and nothing else",
    written.length === columns.length && written.every((k) => columns.includes(k)),
    written,
  );

  ok("…and it reads the previous destination so the change can be audited", /findUnique/.test(payoutSrc));
  ok("…and records the change", /payout_destination_changed/.test(payoutSrc));
  // Asserted at the CALL SITES, not on the presence of the word: `mask(` also
  // appears in the function's own definition, so the first version passed
  // while the log wrote both handles in full.
  ok(
    "…with BOTH handles masked, not written to the log in full",
    (payoutSrc.match(/handle: mask\(/g) || []).length === 2,
    (payoutSrc.match(/handle: mask\(/g) || []).length,
  );
  ok(
    "…and takes the rep id from the caller's gate, never a request body",
    /salesRepId is required/.test(payoutSrc),
  );
}

/**
 * The top-level keys of the object literal whose opening brace is at `from`.
 *
 * Brace-matched, and tolerant of shorthand (`{ language }`) as well as explicit
 * pairs (`{ language: x }`). Conservative on purpose: a nested object's keys
 * are counted too, so a writer that grew a nested `data` FAILS the key-set
 * comparison rather than slipping past it.
 */
function objectKeys(src, from) {
  if (from < 0 || src[from] !== "{") return null;
  let depth = 0;
  let end = -1;
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = src.slice(from + 1, end);
  return [...body.matchAll(/(?:^|[,;{])\s*(\w+)/g)].map((m) => m[1]);
}

// ── The second sanctioned rep-row write: the interface language ────────────
//
// Same fence, same reason, and deliberately a DIFFERENT FILE from the payout
// writer. The block above finds its update with indexOf("salesRep.update(") —
// the first one in the file — so a second update added to payoutWrite.js would
// sit past that index and be asserted by nothing at all. That is the
// index-ordering trap this file's own comments say the repo has hit three
// times, and the cheapest way not to hit it a fourth is one writer per file.
{
  const prefSrc = decomment(read("lib/sales/preferenceWrite.js"));
  const columns = PREFERENCE_WRITES_ON_SALES_REP;
  ok(
    "the preference writer names its column as data",
    Array.isArray(columns) && columns.length === 1 && columns[0] === "language",
    columns,
  );
  // Exactly one update, so the index-based slice below cannot be walked past
  // by adding a second one under it.
  ok(
    "…and the file makes exactly one write",
    (prefSrc.match(/salesRep\.(update|updateMany|upsert|create|delete|deleteMany)\(/g) || []).length === 1,
    (prefSrc.match(/salesRep\.\w+\(/g) || []),
  );
  const upd = prefSrc.indexOf("salesRep.update(");
  const dataAt = prefSrc.indexOf("data: {", upd);
  ok("the update's data block was located", upd > 0 && dataAt > upd, { upd, dataAt });
  // Brace-matched rather than sliced to the next `select: {`, and the keys are
  // read allowing SHORTHAND. The payout block above matches `(\w+):`, which is
  // right for it — it writes three explicit pairs — but it would read
  // `data: { language }` as an EMPTY object and pass while the writer set
  // anything at all. A fence that cannot see the write it is fencing is worse
  // than no fence, so this one is written to survive either spelling.
  const written = objectKeys(prefSrc, prefSrc.indexOf("{", dataAt));
  ok(
    "the writer sets EXACTLY the language column and nothing else",
    written.length === columns.length && written.every((k) => columns.includes(k)),
    written,
  );
  ok(
    "…and takes the rep id from the caller's gate, never a request body",
    /salesRepId is required/.test(prefSrc),
  );
  // The one write a rep makes about themselves that is NOT audited, and the
  // absence is a decision — a recordError row per settings save would bury the
  // payout redirects that log exists to make findable. Asserted so the
  // decision stays a decision rather than becoming an oversight nobody can
  // date: if somebody adds logging here, they should have to say why.
  ok(
    "…and writes no audit row, unlike the payout writer",
    !/recordError/.test(prefSrc),
  );
}

// ── The autodial switch, fenced the same way as the language ───────────────
//
// Same shape as the preference block above, and a separate block because the
// writer is a separate file — by design, so each fence's index-located update
// is the only one in its file.
{
  const autoSrc = decomment(read("lib/sales/autodialWrite.js"));
  const columns = AUTODIAL_WRITES_ON_SALES_REP;
  ok(
    "the autodial writer names its column as data",
    Array.isArray(columns) && columns.length === 1 && columns[0] === "autodial",
    columns,
  );
  ok(
    "…and the file makes exactly one write",
    (autoSrc.match(/salesRep\.(update|updateMany|upsert|create|delete|deleteMany)\(/g) || []).length === 1,
    (autoSrc.match(/salesRep\.\w+\(/g) || []),
  );
  const upd = autoSrc.indexOf("salesRep.update(");
  const dataAt = autoSrc.indexOf("data: {", upd);
  ok("the update's data block was located", upd > 0 && dataAt > upd, { upd, dataAt });
  const written = objectKeys(autoSrc, autoSrc.indexOf("{", dataAt));
  ok(
    "the writer sets EXACTLY the autodial column and nothing else",
    written.length === columns.length && written.every((k) => columns.includes(k)),
    written,
  );
  ok("…and takes the rep id from the caller's gate, never a request body", /salesRepId is required/.test(autoSrc));
  ok("…and refuses anything but a boolean rather than coercing it", /typeof on !== "boolean"/.test(autoSrc));
  ok("…and writes no audit row, like the language writer", !/recordError/.test(autoSrc));
  const callsRoute = decomment(read("app/api/sales/calls/route.js"));
  ok("the calls route reaches it only through saveRepAutodial, after its own boolean check", /typeof body\.on !== "boolean"/.test(callsRoute) && /saveRepAutodial\(\{ salesRepId: rep\.id, on: body\.on \}\)/.test(callsRoute) && !/db\.salesRep\.update/.test(callsRoute));
}

ok(
  "no /api/sales route writes attribution, commission, payouts, billing or a rep row",
  stray.length === 0,
  stray,
);

for (const [file, reason] of Object.entries(FORBIDDEN_WRITE_BY_DESIGN)) {
  const src = decomment(read(file));
  const models = new Set([...src.matchAll(WRITE_RE)].map((m) => m[1]));
  ok(`${file} still exists and still writes`, models.size > 0);
  ok(`${file} gives a reason`, reason.length > 80);
  ok(
    `${file} writes ONLY salesRep — never attribution, commission or billing`,
    [...models].every((m) => m === "salesRep"),
    [...models],
  );
}

// Every authenticated sales route goes through a gate that re-reads the rep.
// Checked per exported handler rather than per file: a file with a compliant
// GET and a POST that forgot would pass a file-wide match.
//
// Three gates are accepted, and only three. requireSalesRep is the read-only
// one this change owns; requireOutreachRep is the outreach change's narrow
// exception; requireSmsRep is the texting one. Each is asserted just below to
// re-read the row and to answer through the SAME canAuthenticate — which is
// what keeps "a deactivated rep cannot authenticate" true across the whole
// portal rather than only on the routes this file wrote.
//
// This list growing is meant to be a deliberate act, and it was one: adding a
// gate had to be a visible edit here rather than a silent one over there,
// which is exactly what happened — check:sales-auth refused the SMS route
// until this line named its gate. The bar for the next entry is the one
// lib/sales/smsGate.js's header argues: a NAMED, short, explicit list of what
// that gate permits, not a mode parameter on an existing gate.
// requireQueueRep joined the list on 2026-09-02, and this comment is the
// deliberate act the paragraph above asks for. It clears the same bar the SMS
// gate did: its own file, its own header arguing why it is not a widening of
// any of the three, and a NAMED, one-model list of what it permits
// (REP_QUEUE_WRITES = ["prospect"]) which scripts/check-prospect-ui.mjs
// asserts the queue route does not exceed. What it guards is a rep CLAIMING a
// prospect before phoning them, so two reps never ring the same contractor.
const SALES_GATES = [
  "requireSalesRep",
  "requireOutreachRep",
  "requireSmsRep",
  "requireQueueRep",
  // The fifth. A call writes SalesCallAttempt, SalesRepActivity and — the
  // reason it is its own list rather than a widening of the queue's —
  // SalesSuppression, because the rep on the phone is the person who hears
  // "take me off your list". lib/sales/calls/gate.js argues it at length.
  "requireCallingRep",
  // The sixth, added with the /sales/calendar feature. A rep's own calendar
  // entry (SalesEvent) — the appointment they'll attend, the callback they
  // promised. Its own file, its own header arguing why it is not a widening of
  // any of the five, and a NAMED one-model list (REP_CALENDAR_WRITES =
  // ["salesEvent"]). It moves no milestone and contacts no one, so it is the
  // smallest exception yet.
  "requireCalendarRep",
  // The seventh, added when a rep was finally given a way to GET a demo. Its
  // own file (lib/sales/demoGate.js), its own header arguing why it is not a
  // widening of any of the six, and a NAMED list (DEMO_GATE_WRITES) of what it
  // permits.
  //
  // It is the first gate on this list that reaches SalesRep, so the bar is
  // higher and demoAssign.js's header meets it: the one column is
  // `demoCompanyId`, it can only ever point at an isDemo company, it is
  // write-once from a rep's side (the WHERE requires null), and nothing that
  // decides money reads it — lib/sales/scope.js keeps repDemoWhere() separate
  // from assignedCompanyWhere() precisely so a fixture cannot read as a sale.
  // That is the same shape as this gate's own lastSeenAt carve-out, one column
  // with the reason written beside it.
  //
  // What it fixed: POST /api/sales/demo rode requireSalesRep, which refuses
  // every write — so "Reset the data" and the trade picker had returned 403
  // for as long as they had existed, invisibly, because they only render for a
  // rep with a demo and nobody could have one.
  "requireDemoRep",
];
for (const file of salesRoutes) {
  if (file.startsWith("app/api/sales/auth/")) continue; // unauthenticated by design
  const src = read(file);
  for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
    const body = namedFunctionBody(src, `export async function ${method}(`);
    if (!body) continue;
    ok(
      `${file} ${method} resolves its rep through a declared sales gate`,
      SALES_GATES.some((g) => new RegExp(`${g}\\(request\\)`).test(body)) &&
        /if\s*\(refusal\)/.test(body),
    );
  }
}

for (const [module, fn] of [
  ["lib/sales/gate.js", "export async function requireSalesRep("],
  ["lib/sales/outreachGate.js", "export async function requireOutreachRep("],
  ["lib/sales/smsGate.js", "export async function requireSmsRep("],
  ["lib/sales/queueGate.js", "export async function requireQueueRep("],
  ["lib/sales/calls/gate.js", "export async function requireCallingRep("],
  ["lib/sales/calendar/gate.js", "export async function requireCalendarRep("],
]) {
  if (!existsSync(join(ROOT, module))) continue;
  const body = namedFunctionBody(read(module), fn);
  ok(`${module}: the gate was found`, body.length > 200);
  ok(
    `${module}: re-reads the SalesRep row rather than trusting the token`,
    /db\.salesRep\.findUnique\(/.test(body),
  );
  ok(
    `${module}: decides through the shared canAuthenticate, not its own copy`,
    /canAuthenticate\(/.test(body),
  );
  ok(
    `${module}: never returns the password hash to a route`,
    /passwordHash:\s*_passwordHash/.test(body) || !/passwordHash/.test(body),
  );
}

// The companies route must use the shared fragment rather than an inline where.
// An inline copy is the one that rots, and it is the one nothing here executes.
{
  const body = namedFunctionBody(read("app/api/sales/companies/route.js"), "export async function GET(");
  ok("the companies route's GET was found", body.length > 200);
  ok(
    "it scopes the company query with assignedCompanyWhere(rep.id)",
    /where:\s*assignedCompanyWhere\(rep\.id\)/.test(body),
  );
  ok(
    "it selects through REP_COMPANY_SELECT rather than an inline select",
    /select:\s*REP_COMPANY_SELECT/.test(body),
  );
  ok(
    "the milestone read is scoped by salesRepId as well as by company",
    /salesRepId:\s*rep\.id/.test(body),
  );
}

// The superadmin routes that DO write are superadmin-only, checked in the one
// function that decides it per file.
{
  const listRoute = read("app/api/platform/sales/reps/route.js");
  const guard = namedFunctionBody(listRoute, "async function superadminOrRefusal(");
  ok("the platform rep route has a single named superadmin guard", guard.length > 100);
  ok(
    "...and it refuses anything below superadmin",
    /admin\.role !== "superadmin"/.test(guard) && /status:\s*403/.test(guard),
  );
  for (const method of ["GET", "POST"]) {
    const body = namedFunctionBody(listRoute, `export async function ${method}(`);
    ok(`platform reps ${method} goes through that guard`, /superadminOrRefusal\(request\)/.test(body));
  }
  for (const [file, decl] of [
    ["app/api/platform/sales/reps/[id]/route.js", "export async function PATCH("],
    ["app/api/platform/sales/reps/[id]/invite/route.js", "export async function POST("],
  ]) {
    const body = namedFunctionBody(read(file), decl);
    ok(`${file} refuses anything below superadmin`, /admin\.role !== "superadmin"/.test(body));
    ok(`${file} awaits params (Next 16 makes them a Promise)`, /await params/.test(body));
  }
  // Deactivate, never delete.
  ok(
    "there is no DELETE handler for a sales rep — their ledger is history",
    !/export async function DELETE/.test(read("app/api/platform/sales/reps/[id]/route.js")),
  );
}

// ── Odds and ends the invite flow depends on ─────────────────────────────

console.log("\nInvite codes\n");
ok("a name becomes a URL-safe code", codeFromName("Dana O'Brien") === "dana-o-brien");
ok("accents are folded, not dropped into percent-encoding", codeFromName("Émile Côté") === "emile-cote");
ok("a name with nothing Latin in it still yields a code", codeFromName("привет") === "rep");
ok("an empty name still yields a code", codeFromName("") === "rep");
ok("a valid code passes", isValidCode("dana-2"));
ok("a code with an underscore, a space or a capital is refused", !isValidCode("Dana_2") && !isValidCode("dana 2") && !isValidCode("Dana"));
ok("a one-character code is refused — it is read off a card", !isValidCode("d"));
ok("a code starting with a hyphen is refused", !isValidCode("-dana"));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
