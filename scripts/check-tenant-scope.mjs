// scripts/check-tenant-scope.mjs
//
//   npm run check:tenant-scope
//
// The tenant boundary, enumerated from the filesystem rather than from a list
// somebody has to remember to update.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// An `admin` holds ["*"] inside their own company. The only thing between them
// and another company's data is that every query is scoped by companyId. One
// route that forgets is a multi-tenant breach, and it is the most serious class
// of bug this product can have.
//
// A sweep of all API routes found the READ side in good order — the
// `findFirst({ where: { id, companyId } })` habit is near-universal — and the
// WRITE side wide open in nine places. A route that correctly refuses to LOAD
// another tenant's row would happily STORE a foreign key pointing at one:
//
//     POST /api/quotes   { clientId: <another company's client> }
//     POST /api/invoices { clientId: <another company's client> }
//     POST /api/jobs     { clientId: … }   ← returned the whole Client row,
//                                            including its portalToken
//     POST /api/time-entries { jobId: … }  ← writes hours into THEIR costing
//     POST /api/appointments { assignedToId: … }
//     POST /api/jobs/[id]/visits { assignedToId: … }
//     POST /api/shifts, PATCH /api/shifts/[id] { jobId: … }
//     PATCH /api/tasks/[id] { assignedToId, workAreaId }
//     POST /api/salaries { workerId }, POST+PATCH /api/event-types { userId }
//     marketing campaigns + stops { assignedToId, templateId }
//     settings/follow-up-rules { templateId }
//
// The reason it hid so well: those routes DO check things. They check the
// permission, and they scope the record they load. The id they don't check is
// three lines further down inside a `data:` object, and reviewing the handler
// top to bottom reads as careful throughout.
//
// ══ What is asserted ═══════════════════════════════════════════════════════
//
//   1. EXHAUSTIVE. Every app/api/**/route.js is read off disk. A route added
//      tomorrow is covered the same day, with no list to update.
//   2. Which models are tenant data is read from schema.prisma — every model
//      with a companyId column. A model added tomorrow is covered too.
//   3. Every single-record lookup keyed by an id, on a tenant model, must be
//      company-scoped, or provably derived from something that was.
//   4. Every foreign key in OWNED_ID_FIELDS written from request data must be
//      proved to belong to the caller's company.
//   5. Where a route is legitimately global, it DECLARES so below by name and
//      with a reason — and a declaration that has stopped matching anything is
//      itself a failure, so the list cannot quietly accumulate.
//   6. The platform console writes nothing a customer owns (non-negotiable #3).
//   7. Impersonation is refused in BOTH places it is supposed to be.
//
// And assertOwnedIds is EXECUTED against a fake client, including the inputs
// that would make a lazy implementation wave things through.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  routeFiles,
  decomment,
  tenantDelegates,
  unscopedLookups,
  unprovenForeignKeys,
} from "./tenantScopeScan.mjs";
import { assertOwnedIds, OWNED_ID_FIELDS } from "@/lib/tenant/ownedIds";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

// ───────────────────────────────────────────────────────────────────────────
// DECLARED GLOBAL — the exceptions, by name, each with the reason it is one.
//
// Keyed `route file` → `prisma delegate` → why. A finding is allowed only if
// its file AND model are both named here. Anything else fails, which is the
// point: adding an unscoped lookup requires writing down why, in a file that
// gets read in review, rather than it passing silently.
// ───────────────────────────────────────────────────────────────────────────
const GLOBAL_BY_DESIGN = {
  "app/api/cron/appointment-reminders/route.js": {
    appointment:
      "A cron sweeps every tenant by design — it is authenticated by CRON_SECRET, " +
      "has no member and no company. The row comes from its own findMany.",
  },
  "app/api/cron/voice-outbound/route.js": {
    voiceCallTask:
      "Same: a cron over the whole queue. Each task is a row this run just " +
      "selected, and marking it done is not a lookup by a caller-supplied id.",
  },
  "app/api/cron/renewal-reminders/route.js": {
    subscription:
      "Same shape again: a cron over every FieldQuo subscription, authenticated " +
      "by CRON_SECRET, no member and no company to scope by — FieldQuo IS the " +
      "tenant here, billing its own customers. Both updates key off sub.id from " +
      "this run's own findMany, and the second is a REVERT to the row's own " +
      "prior values (not a foreign key from a caller) when a send didn't happen.",
  },
  "app/api/instant-quote/[companySlug]/request/route.js": {
    leadRequest:
      "Public intake. The lead was created moments earlier by createScoredLead " +
      "with this company's id; the id never came from the request.",
  },
  "app/api/invoices/[id]/credit-visit-fee/route.js": {
    invoice:
      "recomputeInvoice() is a private helper reached only after loadInvoice() " +
      "has already matched { id, companyId }. It recomputes a balance from the " +
      "invoice's own payments and returns nothing to the caller.",
  },
  "app/api/kitchen-design/[token]/route.js": {
    quote:
      "Token route. The share token IS the credential — a homeowner has no " +
      "session and no company, so there is nothing to scope by. Scoping this " +
      "would break the link the contractor sent.",
  },
  "app/api/portal/[token]/pay/route.js": {
    invoice:
      "Token route. Scoped to the client the portal token resolves to " +
      "(clientId: client.id), which is narrower than the company, plus a " +
      "'must have been sent' filter so a draft can't be paid.",
  },
  "app/api/quotes/[id]/email-sections/route.js": {
    quote:
      "The quote was loaded by a company-scoped helper at the top of the " +
      "handler; only its id reaches the update.",
  },
  "app/api/visit/[token]/route.js": {
    appointment:
      "Token route. The appointment is the one this booking points at, and the " +
      "booking was resolved from the manage token in the client's own email.",
  },
  "app/api/unsubscribe/[token]/route.js": {
    marketingSubscriber:
      "Token route. The subscriber was loaded by findUnique({ where: { " +
      "unsubscribeToken: token } }) — the token IS the credential, unguessable " +
      "and unique per row, so it already resolves to exactly one company's " +
      "subscriber before the id ever reaches the update.",
  },
  "app/api/visit/[token]/reschedule/route.js": {
    appointment:
      "Same manage-token route, the reschedule half. The appointment is reached " +
      "through the booking the token resolved to, never by an id in the request.",
  },
  "app/api/voice/tools/[tool]/route.js": {
    leadRequest:
      "Called by Retell mid-call, authenticated by the call context rather than " +
      "a session. The lead is one this call created or was already bound to; " +
      "ctx.companyId comes from the verified call, never from the tool payload.",
  },
};

// ═══════════════ 1. The sweep ══════════════════════════════════════════════

const files = routeFiles();
console.log(`\nEnumerated ${files.length} API routes from the filesystem`);
ok("the route list is read off disk, not hand-kept", files.length > 200, files.length);

const delegates = tenantDelegates();
ok("tenant models are derived from schema.prisma", delegates.size > 30, delegates.size);
for (const must of ["quote", "invoice", "job", "client", "task", "shift", "workArea"])
  ok(`${must} is recognised as tenant data`, delegates.has(must));

console.log("\nEvery by-id lookup on a tenant model is company-scoped");

const lookups = [];
const fks = [];
for (const f of files) {
  lookups.push(...unscopedLookups(f));
  fks.push(...unprovenForeignKeys(f, OWNED_ID_FIELDS));
}

const undeclared = lookups.filter(
  (l) => !GLOBAL_BY_DESIGN[l.file]?.[l.model],
);
ok(
  `no undeclared unscoped lookup (${lookups.length} found, ${lookups.length - undeclared.length} declared)`,
  undeclared.length === 0,
  undeclared.map((l) => `${l.file}:${l.line} db.${l.model}.${l.op}(id=${l.idExpr})`),
);

// The declarations have to stay true. One that matches nothing is either a
// route that got fixed (delete the entry) or a route that got deleted — and
// either way it is a line claiming something about code that isn't there.
const matched = new Set(lookups.map((l) => `${l.file}::${l.model}`));
const stale = [];
for (const [file, models] of Object.entries(GLOBAL_BY_DESIGN))
  for (const model of Object.keys(models))
    if (!matched.has(`${file}::${model}`)) stale.push(`${file} :: ${model}`);
ok("no declaration has gone stale", stale.length === 0, stale);

for (const [file, models] of Object.entries(GLOBAL_BY_DESIGN)) {
  for (const [model, reason] of Object.entries(models)) {
    ok(
      `${file} :: ${model} gives a reason`,
      typeof reason === "string" && reason.length > 60,
    );
  }
}

console.log("\nEvery foreign key written from request data is proved to be ours");
ok(
  `no unproven foreign key (${fks.length})`,
  fks.length === 0,
  fks.map((x) => `${x.file}:${x.line} db.${x.model}.${x.op} ${x.field} <- ${x.source}`),
);

// ═══════════════ 2. The ownership table itself ═════════════════════════════

console.log("\nThe ownership table names real, tenant-scoped models");
const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
for (const [field, spec] of Object.entries(OWNED_ID_FIELDS)) {
  const model = spec.model[0].toUpperCase() + spec.model.slice(1);
  ok(`${field} → model ${model} exists`, new RegExp(`^model\\s+${model}\\s*\\{`, "m").test(schema));
  // Member is the exception: it is how a USER id is proved, and the check is
  // on { userId, companyId } rather than on the row's own id.
  if (spec.model !== "member")
    ok(`${field} → ${model} is tenant data`, delegates.has(spec.model));
}

// ═══════════════ 3. assertOwnedIds, executed ═══════════════════════════════

console.log("\nassertOwnedIds — run against a fake client, hostile input included");

const calls = [];
// A two-row store: one record belongs to us, one belongs to somebody else. The
// fake answers the way Prisma would — a row comes back only when BOTH halves of
// the where match, which is the whole property being tested.
const STORE = [
  { id: "ours", userId: "u1", companyId: "us" },
  { id: "theirs", userId: "u2", companyId: "them" },
];
const fakeDb = new Proxy(
  {},
  {
    get: (_t, model) => ({
      findFirst: async ({ where }) => {
        calls.push({ model, where });
        return (
          STORE.find((r) =>
            Object.entries(where).every(([k, v]) => r[k] === v),
          ) || null
        );
      },
    }),
  },
);

const reset = () => (calls.length = 0);

{
  reset();
  const r = await assertOwnedIds(fakeDb, "us", { clientId: "ours" });
  ok("our own client passes", r.ok === true, r);
  ok("...and it really did query, scoped", calls.length === 1 && calls[0].where.companyId === "us", calls);
}
{
  const r = await assertOwnedIds(fakeDb, "us", { clientId: "theirs" });
  ok("another tenant's id is refused", r.ok === false && r.status === 400, r);
  ok("...with a message that doesn't confirm the id exists", !/theirs/.test(r.error), r.error);
}
{
  const r = await assertOwnedIds(fakeDb, "us", { clientId: "no-such-row" });
  ok("an id that exists nowhere is refused the same way", r.ok === false);
}
{
  reset();
  const r = await assertOwnedIds(fakeDb, "us", { clientId: null, jobId: undefined, quoteId: "" });
  ok("absent links pass — 'not linked' is a legitimate value", r.ok === true);
  ok("...and no query is made for them", calls.length === 0, calls);
}
{
  const r = await assertOwnedIds(fakeDb, null, { clientId: "ours" });
  ok("no company means refuse, never wave through", r.ok === false);
}
{
  const r = await assertOwnedIds(fakeDb, "", { clientId: "ours" });
  ok("an empty company id is not a company", r.ok === false);
}
{
  const r = await assertOwnedIds(fakeDb, "us", { clientId: "ours", jobId: "theirs" });
  ok("one bad id among good ones still refuses", r.ok === false, r);
}
{
  let threw = false;
  try {
    await assertOwnedIds(fakeDb, "us", { clinetId: "typo" });
  } catch {
    threw = true;
  }
  ok("an unknown field name throws rather than being skipped", threw);
}
{
  reset();
  const r = await assertOwnedIds(fakeDb, "us", { assignedToId: "u1" });
  ok("a teammate's user id passes", r.ok === true, r);
  const other = await assertOwnedIds(fakeDb, "us", { assignedToId: "u2" });
  ok("a user id from another company does not", other.ok === false);
  ok("...and says so in words a person can act on", /team/i.test(other.error), other.error);
  ok(
    "assignedToId is proved by team membership, not by a row id",
    calls[0]?.model === "member" && calls[0]?.where.userId === "u1" && calls[0]?.where.companyId === "us",
    calls[0],
  );
}
{
  // The shape a caller would use to smuggle the company in from the request.
  const r = await assertOwnedIds(fakeDb, "us", { clientId: { companyId: "them" } });
  ok("an object where an id belongs cannot forge a match", r.ok === false);
}

// ═══════════════ 4. Non-negotiable #3 — the platform console edits nothing ══

console.log("\nThe platform console views everything and edits nothing (#3)");

// The console's own surface. Everything named here is ACCOUNT ADMINISTRATION —
// FieldQuo suspending a company, extending its trial, capping its AI spend,
// answering a support ticket. Everything NOT named here is the customer's own
// work: a quote, an invoice, a job, a client. The list carries a reason each,
// so widening it is a decision somebody wrote down rather than a line that
// slipped through.
const PLATFORM_MAY_WRITE = {
  company:
    "onboardingStatus, name, trialEndsAt, aiMonthlyTokenCap — the account, not the work.",
  companyFeatureOverride: "Which features an account has. FieldQuo's to set.",
  subscription: "Billing state, which is the platform's own ledger.",
  member:
    "The demo-sandbox login only, and only into a Company whose isDemo is true.",
  demoHostAvailability: "A platform admin's own demo calendar.",
  feedback: "Answering a support message the customer sent us.",
  platformErrorLog:
    "FieldQuo's own error log. It carries a companyId to say where an error came " +
    "from, which is why it looks like tenant data and is not.",
  serviceCategory:
    "The shared service catalogue — rows with companyId null, seeded by us. The " +
    "console creates system categories; a company's OWN custom categories are " +
    "created by that company.",
};

const platformWrites = [];
for (const f of files) {
  if (!f.startsWith("app/api/platform/")) continue;
  const src = decomment(readFileSync(join(ROOT, f), "utf8"));
  const re =
    /\b(?:db|tx|prisma)\s*\.\s*([A-Za-z0-9_]+)\s*\.\s*(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    if (!delegates.has(m[1])) continue;      // platform-owned table, not tenant data
    if (PLATFORM_MAY_WRITE[m[1]]) continue;
    platformWrites.push(`${f}: db.${m[1]}.${m[2]}`);
  }
}
ok("no /api/platform route writes a customer's own records", platformWrites.length === 0, platformWrites);

// Named tables have to be real, and each has to say why it is an exception.
for (const [model, reason] of Object.entries(PLATFORM_MAY_WRITE)) {
  const Model = model[0].toUpperCase() + model.slice(1);
  ok(`${model} is a real model`, new RegExp(`^model\\s+${Model}\\s*\\{`, "m").test(schema));
  ok(`${model} says why the console may write it`, reason.length > 30);
}

// The four the product owner named explicitly. Asserted by value, not by
// absence from a list, so renaming the list can never quietly admit them.
for (const forbidden of ["quote", "invoice", "job", "client"])
  ok(`the console may never write a ${forbidden}`, !PLATFORM_MAY_WRITE[forbidden]);

// ═══════════════ 5. Non-negotiable #2 — impersonation, twice ═══════════════

console.log("\nImpersonation is read-only, enforced in both places (#2)");
const mw = readFileSync(join(ROOT, "middleware.js"), "utf8");
const cm = readFileSync(join(ROOT, "lib/currentMember.js"), "utf8");
ok(
  "middleware refuses a non-read method under an impersonation cookie",
  /allowsWrites\(claims\.mode\)/.test(mw) && /isReadOnlyMethod\(request\.method\)/.test(mw),
);
ok("...and the matcher covers every API route", /"\/api\/:path\*"/.test(mw));
ok(
  "lib/currentMember.js refuses again, from the verified claims",
  /function assertReadOnly/.test(cm) && /member\.impersonationMode === "demo_sandbox"/.test(cm),
);
ok(
  "...and the second check re-derives the mode rather than trusting the header",
  !/x-impersonation-mode/.test(decomment(cm)),
);
ok(
  "every authenticated request goes through it",
  /assertReadOnly\(impersonated, request\)/.test(cm),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
