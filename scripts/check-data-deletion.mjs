// scripts/check-data-deletion.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-data-deletion.mjs
//
// The data-deletion request flow, executed rather than read.
//
// ══ What is at stake ═══════════════════════════════════════════════════════
//
// /data-deletion is the URL FieldQuo gave Meta as its data deletion
// instructions, and /api/meta/data-deletion is the callback Meta POSTs to
// when a person removes the app. Between them they make three promises to
// strangers: we recorded your request, we emailed you a receipt, and a
// six-character reference tells you a status and nothing about who asked.
// Each of those is a property of a route's BEHAVIOUR under a stubbed database
// and mail provider, so each is executed here: the real handlers are imported
// and called with real Request objects, with "@/lib/db", "@/lib/email/resend",
// "@/lib/email/platformSender", "@/lib/rateLimit",
// "@/lib/platform/currentPlatformAdmin" and "next/server" swapped for stubs
// through a resolve hook (the technique of scripts/check-accounting-route.mjs).
//
// The signed_request verifier is executed with a signature produced by the
// same HMAC primitive Meta uses, then with the payload tampered, then with no
// secret at all — the last is the one that matters most, because an unset
// secret that SKIPPED verification would be a public endpoint that files a
// request for any user id and mails us each time.
//
// ══ What is scanned rather than executed ═══════════════════════════════════
//
// The page is JSX and nothing in an alias-loader run can parse it, so the
// words it must keep saying are matched as text — but the number is not: the
// page renders `{DELETION_BUSINESS_DAYS} business days`, so the check imports
// the constant, asserts it is 30, and asserts the page interpolates THAT
// constant beside those words. A literal "30 business days" typed into the
// prose would pass a naive grep and drift from the constant the emails use.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
// Stubs
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  rows: [],
  writes: [],
  reads: [],
  emails: [],
  rateLimitCalls: [],
  rateLimited: false,
  emailResult: null, // null → { id } success; else returned as-is
  failCreateTimes: 0,
  admin: null,
  from: "FieldQuo <quotes@send.fieldquo.com>",
};
globalThis.__FQ = state;

function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

globalThis.__FQ_DB = new Proxy(
  {
    dataDeletionRequest: {
      async create({ data }) {
        if (state.failCreateTimes > 0) {
          state.failCreateTimes--;
          const err = new Error("unique");
          err.code = "P2002";
          throw err;
        }
        const row = {
          id: `ddr_${state.rows.length + 1}`,
          status: "received",
          receivedAt: new Date("2026-09-08T14:00:00Z"),
          acknowledgedAt: null,
          completedAt: null,
          completedById: null,
          name: null,
          companyName: null,
          message: null,
          metaUserId: null,
          ...data,
        };
        state.rows.push(row);
        state.writes.push({ action: "create", data });
        return row;
      },
      async findUnique(args) {
        state.reads.push({ action: "findUnique", args });
        return state.rows.find((r) => matches(r, args.where)) || null;
      },
      async findMany(args) {
        state.reads.push({ action: "findMany", args });
        return state.rows.filter((r) => matches(r, args.where || {}));
      },
      async groupBy() {
        const counts = {};
        for (const r of state.rows) counts[r.status] = (counts[r.status] || 0) + 1;
        return Object.entries(counts).map(([status, n]) => ({ status, _count: n }));
      },
      async update({ where, data }) {
        state.writes.push({ action: "update", where, data });
        const row = state.rows.find((r) => matches(r, where));
        if (row) Object.assign(row, data);
        return row;
      },
      async updateMany({ where, data }) {
        state.writes.push({ action: "updateMany", where, data });
        const hits = state.rows.filter((r) => matches(r, where));
        for (const r of hits) Object.assign(r, data);
        return { count: hits.length };
      },
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/email/resend": "fq-stub:resend",
  "@/lib/email/platformSender": "fq-stub:sender",
  "@/lib/rateLimit": "fq-stub:ratelimit",
  "@/lib/platform/currentPlatformAdmin": "fq-stub:admin",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
const SOURCES = {
  "fq-stub:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq-stub:resend": \`export async function sendEmail(args) {
    globalThis.__FQ.emails.push(args);
    return globalThis.__FQ.emailResult ?? { id: "em_" + globalThis.__FQ.emails.length };
  }\`,
  "fq-stub:sender": "export async function getPlatformFrom() { return globalThis.__FQ.from; }",
  "fq-stub:ratelimit": \`import { NextResponse } from "next/server";
  export function rateLimit(request, route, opts = {}) {
    globalThis.__FQ.rateLimitCalls.push({ route, ...opts });
    if (!globalThis.__FQ.rateLimited) return null;
    return NextResponse.json({ error: opts.message || "Too many requests" }, { status: 429 });
  }\`,
  "fq-stub:admin": "export async function getCurrentPlatformAdmin() { return globalThis.__FQ.admin; }",
  "fq-stub:next": \`export class NextResponse {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    static json(body, init) {
      const r = new NextResponse(body, init);
      r.json = async () => body;
      return r;
    }
  }\`,
};
export async function load(url, context, nextLoad) {
  if (SOURCES[url]) return { format: "module", shortCircuit: true, source: SOURCES[url] };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { parseSignedRequest, buildSignedRequest } = await import("@/lib/dataDeletion/signedRequest.js");
const constants = await import("@/lib/dataDeletion/constants.js");
const requests = await import("@/lib/dataDeletion/requests.js");
const emails = await import("@/lib/email/dataDeletionEmail.js");
const { SUPPORT_EMAIL } = await import("@/lib/supportContact.js");
const { canPlatform, SUPERADMIN_ONLY_PERMISSIONS } = await import("@/lib/platform/permissions.js");
const publicRoute = await import("@/app/api/data-deletion/route.js");
const statusRoute = await import("@/app/api/data-deletion/status/route.js");
const metaRoute = await import("@/app/api/meta/data-deletion/route.js");
const platformList = await import("@/app/api/platform/data-deletion/route.js");
const platformComplete = await import("@/app/api/platform/data-deletion/[id]/complete/route.js");

const {
  DELETION_BUSINESS_DAYS,
  HONEYPOT_FIELD,
  META_CALLBACK_PLACEHOLDER_EMAIL,
  normaliseConfirmationCode,
  isPlausibleEmail,
  publicStatus,
} = constants;

function reset() {
  state.rows = [];
  state.writes = [];
  state.reads = [];
  state.emails = [];
  state.rateLimitCalls = [];
  state.rateLimited = false;
  state.emailResult = null;
  state.failCreateTimes = 0;
  state.admin = null;
}

const jsonPost = (url, body, headers = {}) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// ═══════════════════════════════════════════════════════════════════════════
section("1. The pure helpers");
// ═══════════════════════════════════════════════════════════════════════════

ok("DELETION_BUSINESS_DAYS is 30, the number the owner gave", DELETION_BUSINESS_DAYS === 30, DELETION_BUSINESS_DAYS);

const code = requests.generateConfirmationCode();
ok("a generated code is FQ-DEL- plus six unambiguous characters", /^FQ-DEL-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(code), code);
const codes = new Set(Array.from({ length: 2000 }, () => requests.generateConfirmationCode()));
ok("2000 generated codes are 2000 distinct codes", codes.size === 2000, codes.size);

ok("normalise: lower-case, spaces and a missing prefix all resolve", normaliseConfirmationCode(" fq-del-7k3m 9q ") === "FQ-DEL-7K3M9Q" && normaliseConfirmationCode("7k3m9q") === "FQ-DEL-7K3M9Q");
ok("normalise: an ambiguous character (0/O/1/I/L) is refused", normaliseConfirmationCode("FQ-DEL-7K3M90") === null && normaliseConfirmationCode("FQ-DEL-7K3M9I") === null);
ok("normalise: wrong length and SQL-ish garbage are refused", normaliseConfirmationCode("FQ-DEL-7K3M9") === null && normaliseConfirmationCode("' OR 1=1 --") === null && normaliseConfirmationCode("") === null);

ok("email: a real address passes", isPlausibleEmail("jordan@example.com"));
ok("email: a phone number, a sentence, and 300 characters are refused", !isPlausibleEmail("514-555-0100") && !isPlausibleEmail("email me please") && !isPlausibleEmail(`${"a".repeat(250)}@x.co`));

const projected = publicStatus({ status: "received", receivedAt: "2026-09-08", completedAt: null, email: "x@y.z", name: "N", message: "M", metaUserId: "1" });
ok("publicStatus projects to status + two dates and nothing else", Object.keys(projected).sort().join(",") === "completedAt,receivedAt,status", Object.keys(projected));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The signed_request verifier");
// ═══════════════════════════════════════════════════════════════════════════

const SECRET = "test-app-secret-0123456789";
const payload = { algorithm: "HMAC-SHA256", issued_at: 1757340000, user_id: "10224455667788990" };
const valid = buildSignedRequest(payload, SECRET);

const v = parseSignedRequest(valid, SECRET);
ok("a validly signed request verifies and yields the payload", v.ok && v.payload.user_id === payload.user_id, v);

// Tamper with the payload but keep the signature: a different user id.
const [sig] = valid.split(".");
const forgedPayload = Buffer.from(JSON.stringify({ ...payload, user_id: "1" })).toString("base64url");
const forged = parseSignedRequest(`${sig}.${forgedPayload}`, SECRET);
ok("a forged payload under the real signature is refused", !forged.ok && forged.reason === "bad_signature", forged);

const wrongKey = parseSignedRequest(buildSignedRequest(payload, "someone-elses-secret"), SECRET);
ok("a request signed with another app's secret is refused", !wrongKey.ok && wrongKey.reason === "bad_signature", wrongKey);

const unset = parseSignedRequest(valid, undefined);
ok("with NO secret configured, even a valid request is refused (fail closed)", !unset.ok && unset.reason === "secret_unset", unset);
const empty = parseSignedRequest(valid, "");
ok("an empty-string secret is 'unset', not a key", !empty.ok && empty.reason === "secret_unset", empty);

const noneAlg = parseSignedRequest(buildSignedRequest({ ...payload, algorithm: "none" }, SECRET), SECRET);
ok("algorithm 'none' is refused even when the HMAC matches", !noneAlg.ok && noneAlg.reason === "unexpected_algorithm", noneAlg);

for (const bad of [null, undefined, 42, "", "nodot", ".", "a.", ".b", "a.!!!", `${sig}.${Buffer.from("not json").toString("base64url")}`]) {
  const r = parseSignedRequest(bad, SECRET);
  if (r.ok) fails.push(`malformed input ${JSON.stringify(bad)} verified`);
}
ok("malformed inputs never verify and never throw", true);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The emails, executed");
// ═══════════════════════════════════════════════════════════════════════════

const hostile = {
  confirmationCode: "FQ-DEL-7K3M9Q",
  email: "jordan@example.com",
  name: '<a href="https://evil.example">Click to view the full enquiry</a>',
  companyName: "TrueFinish Cabinets",
  message: "<script>alert(1)</script> delete everything",
  receivedAt: new Date("2026-09-08T14:00:00Z"),
  completedAt: new Date("2026-09-15T09:30:00Z"),
  source: "form",
};

const ack = emails.buildDeletionAcknowledgement(hostile);
ok("acknowledgement names the date, the reference and '30 business days'", ack.html.includes("September 8, 2026") && ack.html.includes("FQ-DEL-7K3M9Q") && ack.html.includes("30 business days") && ack.text.includes("30 business days"), ack.subject);
ok("acknowledgement says the deletion is done manually by the owner", /owner will delete the data manually/.test(ack.html) && /manually/.test(ack.text));
ok("acknowledgement escapes a name typed as markup", !ack.html.includes('<a href="https://evil.example">') && ack.html.includes("&lt;a href="));

const notice = emails.buildDeletionNotice(hostile);
ok("internal notice carries who, what and the reference, escaped", notice.html.includes("jordan@example.com") && notice.html.includes("FQ-DEL-7K3M9Q") && !notice.html.includes("<script>") && notice.html.includes("&lt;script&gt;"));

const done = emails.buildDeletionCompleted(hostile);
ok("completion says 'deleted on {date}, reference {code}'", /deleted on <strong>September 15, 2026<\/strong>, reference <strong>FQ-DEL-7K3M9Q/.test(done.html) && done.text.includes("deleted on September 15, 2026, reference FQ-DEL-7K3M9Q"));

// ═══════════════════════════════════════════════════════════════════════════
section("4. POST /api/data-deletion, executed");
// ═══════════════════════════════════════════════════════════════════════════

const URL_PUBLIC = "https://www.fieldquo.com/api/data-deletion";

reset();
let res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com", name: "Jordan Reyes", companyName: "TrueFinish Cabinets", message: "Please delete my quote and my address." }));
let body = await res.json();
ok("a good request answers 201 with ok and a confirmation code", res.status === 201 && body.ok === true && /^FQ-DEL-/.test(body.confirmationCode), { status: res.status, body });
ok("one row was created, source 'form', with the email and message", state.rows.length === 1 && state.rows[0].source === "form" && state.rows[0].email === "jordan@example.com" && state.rows[0].message === "Please delete my quote and my address.", state.rows[0]);
ok("two emails went out: the requester's receipt, then the support inbox", state.emails.length === 2 && state.emails[0].to === "jordan@example.com" && state.emails[1].to === SUPPORT_EMAIL, state.emails.map((e) => e.to));
ok("both are FieldQuo's platform mail: platform From, no companyId, reply-to support", state.emails.every((e) => e.from === state.from && e.companyId === undefined && e.replyTo === SUPPORT_EMAIL));
ok("the receipt carries the reference and the business-day promise", state.emails[0].subject.includes(body.confirmationCode) && state.emails[0].html.includes("30 business days"));
ok("acknowledgedAt was stamped once the receipt was accepted", state.rows[0].acknowledgedAt instanceof Date && body.acknowledgementSent === true);
ok("the rate limiter was consulted at 5 per hour", state.rateLimitCalls.length === 1 && state.rateLimitCalls[0].limit === 5 && state.rateLimitCalls[0].windowMs === 3600000, state.rateLimitCalls[0]);

reset();
state.rateLimited = true;
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com" }));
ok("a rate-limited connection gets the 429 and nothing is written or sent", res.status === 429 && state.rows.length === 0 && state.emails.length === 0, res.status);

reset();
res = await publicRoute.POST(jsonPost(URL_PUBLIC, '{"email": "jordan@exam'));
ok("a truncated JSON body is a 400, not a 500", res.status === 400 && state.rows.length === 0, res.status);
res = await publicRoute.POST(new Request(URL_PUBLIC, { method: "POST", headers: { "content-type": "application/json" }, body: "[]" }));
ok("a non-object body is a 400", res.status === 400, res.status);

reset();
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com", [HONEYPOT_FIELD]: "https://spam.example" }));
body = await res.json();
ok("a filled honeypot is answered 200 with no code, and writes and sends nothing", res.status === 200 && body.confirmationCode === null && state.rows.length === 0 && state.emails.length === 0, { status: res.status, body });

reset();
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "514-555-0100" }));
ok("an implausible email is a 400 and no row", res.status === 400 && state.rows.length === 0, res.status);

reset();
state.emailResult = { error: { message: "Domain not verified" } };
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com" }));
body = await res.json();
ok("when Resend refuses, the row still exists and the response carries the code", res.status === 201 && state.rows.length === 1 && /^FQ-DEL-/.test(body.confirmationCode));
ok("...and says the receipt did not go out — never a silent success", body.acknowledgementSent === false && typeof body.warning === "string" && body.warning.includes("could not be sent") && body.warning.includes(SUPPORT_EMAIL), body);
ok("...and acknowledgedAt is NOT stamped", state.rows[0].acknowledgedAt === null && !state.writes.some((w) => w.action === "update"));

reset();
state.emailResult = { skipped: true };
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com" }));
body = await res.json();
ok("with no RESEND_API_KEY ({ skipped }) the same honesty applies", body.acknowledgementSent === false && /not configured/.test(body.warning), body);

reset();
state.failCreateTimes = 1;
res = await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com" }));
ok("a confirmation-code collision (P2002) is retried once and succeeds", res.status === 201 && state.rows.length === 1);
reset();
state.failCreateTimes = 2;
let threw = false;
try {
  await publicRoute.POST(jsonPost(URL_PUBLIC, { email: "jordan@example.com" }));
} catch {
  threw = true;
}
ok("two collisions in a row surface as an error rather than a fake reference", threw && state.rows.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("5. POST /api/meta/data-deletion, executed");
// ═══════════════════════════════════════════════════════════════════════════

const URL_META = "https://www.fieldquo.com/api/meta/data-deletion";
const formPost = (signed) =>
  new Request(URL_META, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ signed_request: signed }).toString(),
  });

const savedSecret = process.env.META_APP_SECRET;
const savedOrigin = process.env.NEXT_PUBLIC_APP_URL;
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";

delete process.env.META_APP_SECRET;
reset();
res = await metaRoute.POST(formPost(valid));
ok("with META_APP_SECRET unset, a valid callback is refused (400) and no row is written", res.status === 400 && state.rows.length === 0 && state.emails.length === 0, res.status);

process.env.META_APP_SECRET = SECRET;
reset();
res = await metaRoute.POST(formPost(`${sig}.${forgedPayload}`));
ok("a forged signed_request is refused and no row is written", res.status === 400 && state.rows.length === 0, res.status);

reset();
res = await metaRoute.POST(formPost(valid));
body = await res.json();
ok("a valid signed_request answers 200 with { url, confirmation_code }", res.status === 200 && /^FQ-DEL-/.test(body.confirmation_code) && body.url === `https://www.fieldquo.com/data-deletion?code=${body.confirmation_code}`, body);
ok("a row was created: source meta_callback, the user id recorded, the placeholder address", state.rows.length === 1 && state.rows[0].source === "meta_callback" && state.rows[0].metaUserId === payload.user_id && state.rows[0].email === META_CALLBACK_PLACEHOLDER_EMAIL, state.rows[0]);
ok("only the support inbox was emailed — there is no address to acknowledge to", state.emails.length === 1 && state.emails[0].to === SUPPORT_EMAIL, state.emails.map((e) => e.to));
ok("the placeholder is under a reserved TLD so it can never be delivered", /\.invalid$/.test(META_CALLBACK_PLACEHOLDER_EMAIL));

reset();
res = await metaRoute.POST(jsonPost(URL_META, { signed_request: valid }));
ok("a JSON-bodied callback (Meta's test tool) is accepted too", res.status === 200 && state.rows.length === 1, res.status);

reset();
res = await metaRoute.POST(new Request(URL_META, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" }));
ok("a bad JSON body is a 400, not a 500", res.status === 400, res.status);
res = await metaRoute.POST(new Request(URL_META, { method: "POST", body: "" }));
ok("an empty body is a 400, not a 500", res.status === 400, res.status);

if (savedSecret === undefined) delete process.env.META_APP_SECRET;
else process.env.META_APP_SECRET = savedSecret;
if (savedOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
else process.env.NEXT_PUBLIC_APP_URL = savedOrigin;

// ═══════════════════════════════════════════════════════════════════════════
section("6. GET /api/data-deletion/status leaks nothing");
// ═══════════════════════════════════════════════════════════════════════════

reset();
state.rows.push({
  id: "ddr_1", confirmationCode: "FQ-DEL-7K3M9Q", email: "jordan@example.com", name: "Jordan Reyes",
  companyName: "TrueFinish", message: "secret message", source: "form", metaUserId: null,
  status: "received", receivedAt: new Date("2026-09-08T14:00:00Z"), acknowledgedAt: new Date(), completedAt: null, completedById: null,
});
res = await statusRoute.GET(new Request("https://www.fieldquo.com/api/data-deletion/status?code=fq-del-7k3m9q"));
body = await res.json();
ok("a known code (any case) answers 200", res.status === 200, res.status);
ok("the response is exactly confirmationCode + status + receivedAt + completedAt", Object.keys(body).sort().join(",") === "completedAt,confirmationCode,receivedAt,status", Object.keys(body));
const serialised = JSON.stringify(body);
ok("no email, name, company or message anywhere in the response", !/jordan|Jordan|TrueFinish|secret message/.test(serialised), serialised);
const q = state.reads.find((r) => r.action === "findUnique");
ok("the Prisma query itself selects only status and the two dates — the row's email never leaves the database", q && q.args.select && Object.keys(q.args.select).sort().join(",") === "completedAt,receivedAt,status", q?.args?.select);

res = await statusRoute.GET(new Request("https://www.fieldquo.com/api/data-deletion/status?code=FQ-DEL-ZZZZZZ"));
ok("an unknown code is a 404", res.status === 404, res.status);
res = await statusRoute.GET(new Request("https://www.fieldquo.com/api/data-deletion/status?code=%27%20OR%201%3D1"));
ok("garbage is a 400 before any query", res.status === 400 && state.reads.filter((r) => r.action === "findUnique").length === 2, res.status);
ok("the status route is rate-limited", state.rateLimitCalls.length >= 1 && state.rateLimitCalls[0].route === "data-deletion-status");

// ═══════════════════════════════════════════════════════════════════════════
section("7. The platform routes: superadmin only, one write, no deletion");
// ═══════════════════════════════════════════════════════════════════════════

ok("data_deletion:manage is superadmin-only in the permission table", SUPERADMIN_ONLY_PERMISSIONS.includes("data_deletion:manage") && canPlatform("superadmin", "data_deletion:manage") && !canPlatform("admin", "data_deletion:manage") && !canPlatform("support", "data_deletion:manage"));

const URL_LIST = "https://www.fieldquo.com/api/platform/data-deletion?status=received";
reset();
state.rows.push({ id: "ddr_1", confirmationCode: "FQ-DEL-7K3M9Q", email: "jordan@example.com", status: "received", receivedAt: new Date("2026-09-01T14:00:00Z"), source: "form" });

state.admin = null;
res = await platformList.GET(new Request(URL_LIST));
ok("list: no platform session → 401", res.status === 401, res.status);
state.admin = { id: "pa_support", role: "support" };
res = await platformList.GET(new Request(URL_LIST));
ok("list: support → 403", res.status === 403, res.status);
state.admin = { id: "pa_admin", role: "admin" };
res = await platformList.GET(new Request(URL_LIST));
ok("list: admin → 403 (not superadmin)", res.status === 403, res.status);
state.admin = { id: "pa_owner", role: "superadmin" };
res = await platformList.GET(new Request(URL_LIST));
body = await res.json();
ok("list: superadmin → 200 with the rows and counts", res.status === 200 && body.rows.length === 1 && body.counts.received === 1, { status: res.status, body });
res = await platformList.GET(new Request("https://www.fieldquo.com/api/platform/data-deletion?status=deleted"));
ok("list: an unknown status filter is a 400", res.status === 400, res.status);

const completeReq = () => new Request("https://www.fieldquo.com/api/platform/data-deletion/ddr_1/complete", { method: "POST" });
const params = { params: Promise.resolve({ id: "ddr_1" }) };

state.admin = null;
res = await platformComplete.POST(completeReq(), params);
ok("complete: no session → 401, nothing stamped", res.status === 401 && state.rows[0].status === "received", res.status);
state.admin = { id: "pa_support", role: "support" };
res = await platformComplete.POST(completeReq(), params);
ok("complete: support → 403, nothing stamped", res.status === 403 && state.rows[0].status === "received", res.status);

state.admin = { id: "pa_owner", role: "superadmin" };
state.emails = [];
res = await platformComplete.POST(completeReq(), params);
body = await res.json();
ok("complete: superadmin → 200, emailSent true", res.status === 200 && body.ok === true && body.emailSent === true, { status: res.status, body });
ok("the row is completed, stamped with the date and the admin's id", state.rows[0].status === "completed" && state.rows[0].completedAt instanceof Date && state.rows[0].completedById === "pa_owner", state.rows[0]);
ok("the stamp is guarded on status 'received' (two clicks cannot both complete)", state.writes.some((w) => w.action === "updateMany" && w.where.status === "received"));
ok("the requester was emailed 'your data was deleted on {date}, reference {code}'", state.emails.length === 1 && state.emails[0].to === "jordan@example.com" && /deleted on <strong>[A-Z][a-z]+ \d+, \d{4}<\/strong>, reference <strong>FQ-DEL-7K3M9Q/.test(state.emails[0].html), state.emails[0]?.subject);

res = await platformComplete.POST(completeReq(), params);
ok("completing again is a 409, and no second email", res.status === 409 && state.emails.length === 1, res.status);

res = await platformComplete.POST(completeReq(), { params: Promise.resolve({ id: "nope" }) });
ok("an unknown id is a 404", res.status === 404, res.status);

state.rows.push({ id: "ddr_2", confirmationCode: "FQ-DEL-AAAAAA", email: META_CALLBACK_PLACEHOLDER_EMAIL, status: "received", receivedAt: new Date(), source: "meta_callback", metaUserId: "1" });
state.emails = [];
res = await platformComplete.POST(new Request("https://x/api/platform/data-deletion/ddr_2/complete", { method: "POST" }), { params: Promise.resolve({ id: "ddr_2" }) });
body = await res.json();
ok("completing a Meta-callback row stamps it and sends NOTHING to the placeholder address", res.status === 200 && body.noAddress === true && state.emails.length === 0 && state.rows[1].status === "completed", body);

state.rows.push({ id: "ddr_3", confirmationCode: "FQ-DEL-BBBBBB", email: "sam@example.com", status: "received", receivedAt: new Date(), source: "form" });
state.emails = [];
state.emailResult = { error: { message: "Domain not verified" } };
res = await platformComplete.POST(new Request("https://x/api/platform/data-deletion/ddr_3/complete", { method: "POST" }), { params: Promise.resolve({ id: "ddr_3" }) });
body = await res.json();
ok("when the completion email is refused, the stamp stands and the response says the person was NOT told", res.status === 200 && body.emailSent === false && /could not be sent/.test(body.warning) && state.rows[2].status === "completed", body);
state.emailResult = null;

// No route in this feature deletes anything from any table.
const ROUTE_FILES = [
  "app/api/data-deletion/route.js",
  "app/api/data-deletion/status/route.js",
  "app/api/meta/data-deletion/route.js",
  "app/api/platform/data-deletion/route.js",
  "app/api/platform/data-deletion/[id]/complete/route.js",
];
const deleting = ROUTE_FILES.filter((f) => /\.\s*(delete|deleteMany)\s*\(/.test(stripComments(read(f))));
ok("no route in the feature calls delete/deleteMany on anything — deletion is the owner's manual act", deleting.length === 0, deleting);
const tenantWrites = ROUTE_FILES.filter((f) => /\bdb\s*\.\s*(?!dataDeletionRequest\b)[a-zA-Z]+\s*\.\s*(create|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(stripComments(read(f))));
ok("every write in the feature is to dataDeletionRequest — never a company's table", tenantWrites.length === 0, tenantWrites);
for (const f of ROUTE_FILES) {
  const src = stripComments(read(f));
  const isPublic = !f.includes("/platform/");
  if (isPublic && !src.includes("rateLimit(")) fails.push(`${f}: public route without rateLimit()`);
  if (isPublic && /request\.json\(\)(?!\s*\.catch)/.test(src)) fails.push(`${f}: request.json() unguarded`);
  if (!isPublic && !src.includes('requirePlatformPermission(admin.role, "data_deletion:manage")')) fails.push(`${f}: platform route not gated on data_deletion:manage`);
}
ok("public routes are rate-limited and guard request.json(); platform routes gate on data_deletion:manage", true);

// ═══════════════════════════════════════════════════════════════════════════
section("8. The page, the console and the review prompt say the right words");
// ═══════════════════════════════════════════════════════════════════════════

const page = read("app/(marketing)/data-deletion/page.js");
const pageCode = stripComments(page);
ok("the page renders {DELETION_BUSINESS_DAYS} business days (which section 1 proved is 30)", (pageCode.match(/\{DELETION_BUSINESS_DAYS\}\s*business days/g) || []).length >= 2 && pageCode.includes('from "@/lib/dataDeletion/constants"'));
ok("the page does not hard-code the number beside the words", !/\b30 business days/.test(pageCode));
ok("the page says the deletion is carried out manually by FieldQuo's owner", /carried out manually by FieldQuo&apos;s owner/.test(pageCode) && /owner deletes the data manually/.test(pageCode));
ok("the page tells people to email SUPPORT_EMAIL with the subject 'Data deletion request'", pageCode.includes("SUPPORT_EMAIL") && /mailto:\$\{SUPPORT_EMAIL\}/.test(pageCode) && /<strong>Data deletion request<\/strong>/.test(pageCode));
ok("the page says we confirm receipt by email and confirm again when it is done", /confirm by email that we have received it/.test(pageCode) && /We confirm when it is done/.test(pageCode));
ok("the page renders the form and the status box", pageCode.includes("<DeletionRequestForm />") && pageCode.includes("<DeletionStatus initialCode={code} />"));
ok("the page reads ?code= from the searchParams PROMISE (Next 16)", /await searchParams/.test(pageCode));
ok("the page no longer claims there is no request form", !/there is\s+no self-service deletion request form/.test(pageCode));
ok("the page mentions the Meta callback path in plain words", /remove the FieldQuo app from your Facebook settings/.test(pageCode));
ok("the page is indexable, with a title and description", /marketingMetadata\(\{/.test(pageCode) && /title: "Data Deletion — FieldQuo"/.test(pageCode) && !/noindex/.test(pageCode));

const form = stripComments(read("app/(marketing)/data-deletion/DeletionRequestForm.js"));
ok("the form posts to /api/data-deletion and sends the honeypot under the shared name", form.includes('"/api/data-deletion"') && form.includes("[HONEYPOT_FIELD]: honeypot"));
ok("the form's success state shows the reference AND the receipt warning path", form.includes("result.confirmationCode") && form.includes("result.acknowledgementSent") && form.includes("result.warning"));
ok("the form's success state says nothing has been deleted yet", /Nothing has been deleted yet/.test(form));

const statusBox = stripComments(read("app/(marketing)/data-deletion/DeletionStatus.js"));
ok("the status box fetches /api/data-deletion/status?code=", statusBox.includes("/api/data-deletion/status?code="));

const sidebar = stripComments(read("app/components/platform/PlatformSidebar.js"));
ok("the platform sidebar links to /platform/data-deletion", sidebar.includes('href: "/platform/data-deletion"'));
const consolePage = stripComments(read("app/platform/data-deletion/page.js"));
ok("the console page has ONE action, Mark completed, calling the complete route", (consolePage.match(/Mark completed/g) || []).length >= 1 && consolePage.includes("/complete`") && !/\/api\/platform\/data-deletion\/\$\{[^}]+\}(?!\/complete)/.test(consolePage));
ok("the console page says nothing on it deletes data", /Nothing on this page deletes data/.test(consolePage));
ok("the console page is gated with PlatformWriteGate on isSuperadmin", consolePage.includes("<PlatformWriteGate") && consolePage.includes("allowed={isSuperadmin}"));

const prompt = read("docs/META-APP-REVIEW-PROMPT.md");
ok("the review prompt names the callback URL beside the instructions URL", prompt.includes("https://www.fieldquo.com/api/meta/data-deletion") && prompt.includes("https://www.fieldquo.com/data-deletion"));

const schema = read("prisma/schema.prisma");
// The model body on its own — a lazy [\s\S]*? over the whole file walks past
// this model's closing brace into the next model's companyId.
const modelBody = (schema.match(/^model DataDeletionRequest \{([\s\S]*?)^\}/m) || [])[1] || "";
ok("DataDeletionRequest exists, code unique, no companyId (platform-scoped)", /confirmationCode\s+String\s+@unique/.test(modelBody) && !/\bcompanyId\b/.test(modelBody), modelBody.slice(0, 80));
ok("the schema says the deletion is manual by design", /^model DataDeletionRequest[\s\S]{0,3000}manual/m.test(schema) || /done BY HAND[\s\S]{0,1500}model DataDeletionRequest/.test(schema));

const pkg = read("package.json");
ok("check:data-deletion is registered and in check:all", /"check:data-deletion":/.test(pkg) && /"check:all": "[^"]*npm run check:data-deletion/.test(pkg));

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
