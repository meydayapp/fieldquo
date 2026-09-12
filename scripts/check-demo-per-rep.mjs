// scripts/check-demo-per-rep.mjs
//
//   npm run check:demo-per-rep
//
// "Make sure that each sales rep gets a unique demo account." (owner,
// 2026-09-12)
//
// ══ What was wrong ════════════════════════════════════════════════════════
//
// The ten seeded fixtures were handed out one per rep, and on paper that was
// unique already. Measured on the live database the day this was built: one
// of the ten had a login, none had the Organization row /app resolves a
// company through, two reps held demos and everybody who actually demoed
// signed in as demo1@fieldquo.com. Two reps in the same hour saw each other's
// quotes. A rep who changed a price left it changed for the next call.
//
// ══ What this file EXECUTES ═══════════════════════════════════════════════
//
// lib/sales/repDemo.js takes an injected Prisma-shaped client and an injected
// `dress` (the seeding function), so the whole orchestration — seed, settle
// the pointer, mint the login, open, reset — runs here against an in-memory
// store that enforces the same unique constraints Postgres does (P2002 on
// slug and on demoRepSlot). Every claim below is a call with an asserted
// answer:
//
//   §1  pure helpers: slot, slug, name, address, default trade
//   §2  seeding is idempotent — twice in a row, and two tabs racing
//   §3  two reps' demos are separate: rows read through the store, scoped by
//       companyId, never cross
//   §4  a reset deletes nothing — the old company and its rows are still
//       there, retired; the fresh one has the slot; the pointer moved
//   §5  the login: minted through demoLogin.js's primitives, memberships
//       active on exactly one company, replacement moves them
//   §6  exclusion parity — a per-rep demo is isDemo like the pool, and no
//       reader detects a demo by its slug
//   §7  the platform's pool is still the shared ten and excludes owned demos
//   §8  the route and the invite flow are wired; the check is in check:all
//
// Source assertions run on DECOMMENTED source: this repo's headers explain at
// length what a file must not do, and a regex over prose is how a check ends
// up satisfied by a sentence about the rule.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  repDemoSlot,
  repDemoSlug,
  repDemoName,
  repDemoLoginEmail,
  defaultTradeFor,
  isOwnLiveDemo,
  ensureRepDemo,
  ensureRepDemoLogin,
  openRepDemo,
  resetRepDemo,
  repDemoState,
  listRepDemos,
  MAX_GENERATIONS,
} from "@/lib/sales/repDemo";
import { INDUSTRIES, INDUSTRY_KEYS, demoAccounts, DEMO_COUNT } from "@/lib/demo/industries";
import { demoPoolCounts } from "@/lib/sales/demoAssign";
import { DEMO_GATE_WRITES } from "@/lib/sales/demoGate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Comments blanked, string literals kept. Same job as check-demo-assignment's. */
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

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// An in-memory Prisma. Enough of the query language for repDemo.js, and the
// two unique constraints that make its idempotency real.
// ═══════════════════════════════════════════════════════════════════════════

function matches(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") { if (!v.some((w) => matches(row, w))) return false; continue; }
    if (k === "NOT") { if (matches(row, v)) return false; continue; }
    const actual = row[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v && !v.in.includes(actual)) return false;
      if ("notIn" in v && v.notIn.includes(actual)) return false;
      if ("not" in v) {
        if (v.not === null ? actual === null || actual === undefined : actual === v.not) return false;
      }
      if ("equals" in v && actual !== v.equals) return false;
      continue;
    }
    if (v === null) { if (actual !== null && actual !== undefined) return false; continue; }
    if (actual !== v) return false;
  }
  return true;
}

function makeStore() {
  const tables = { company: [], member: [], user: [], salesRep: [], quote: [], client: [], organization: [] };
  const uniques = {
    company: ["id", "slug", "demoRepSlot", "bookingSlug", "authOrgId"],
    member: ["id"],
    user: ["id", "email"],
    salesRep: ["id", "demoCompanyId"],
    organization: ["id", "slug"],
  };
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  const log = [];
  const clock = () => new Date(2026, 8, 12, 9, 0, 0, seq);

  const assertUnique = (table, data, exceptId = null) => {
    for (const col of uniques[table] || []) {
      if (data[col] === null || data[col] === undefined) continue;
      const clash = tables[table].find((r) => r.id !== exceptId && r[col] === data[col]);
      if (clash) {
        const err = new Error(`Unique constraint failed on ${table}.${col}`);
        err.code = "P2002";
        err.meta = { target: [col] };
        throw err;
      }
    }
  };
  const select = (row, sel) => {
    if (!row) return null;
    if (!sel) return { ...row };
    const out = {};
    for (const [k, v] of Object.entries(sel)) {
      if (!v) continue;
      if (k === "user") { out.user = select(tables.user.find((u) => u.id === row.userId), v.select); continue; }
      if (k === "demoOwnerRep") { out.demoOwnerRep = select(tables.salesRep.find((u) => u.id === row.demoOwnerRepId), v.select); continue; }
      if (k === "_count") {
        out._count = {};
        for (const t of Object.keys(v.select)) out._count[t] = (tables[t] || []).filter((r) => r.companyId === row.id).length;
        continue;
      }
      out[k] = row[k];
    }
    return out;
  };
  const sortBy = (rows, orderBy) => {
    const specs = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    return [...rows].sort((a, b) => {
      for (const s of specs) {
        const [k, dir] = Object.entries(s)[0];
        const av = a[k] ?? null, bv = b[k] ?? null;
        if (av === bv) continue;
        // nulls first for asc, mirroring Postgres' NULLS FIRST on DESC? Prisma
        // sorts nulls first on asc; that is all this file relies on.
        if (av === null) return dir === "asc" ? -1 : 1;
        if (bv === null) return dir === "asc" ? 1 : -1;
        return (av > bv ? 1 : -1) * (dir === "asc" ? 1 : -1);
      }
      return 0;
    });
  };
  const uniqueKey = (table, where) => {
    if (where.userId_companyId) {
      return tables[table].find((r) => r.userId === where.userId_companyId.userId && r.companyId === where.userId_companyId.companyId) || null;
    }
    return tables[table].find((r) => matches(r, where)) || null;
  };

  const model = (table) => ({
    async findUnique({ where, select: sel }) { return select(uniqueKey(table, where), sel); },
    async findFirst({ where, select: sel, orderBy }) { return select(sortBy(tables[table].filter((r) => matches(r, where)), orderBy)[0] || null, sel); },
    async findMany({ where, select: sel, orderBy } = {}) { return sortBy(tables[table].filter((r) => matches(r, where)), orderBy).map((r) => select(r, sel)); },
    async count({ where } = {}) { return tables[table].filter((r) => matches(r, where)).length; },
    async create({ data, select: sel }) {
      const row = { id: id(table), createdAt: clock(), ...data };
      assertUnique(table, row);
      tables[table].push(row);
      log.push({ op: "create", table, id: row.id });
      return select(row, sel);
    },
    async update({ where, data, select: sel }) {
      const row = uniqueKey(table, where);
      if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
      assertUnique(table, { ...row, ...data }, row.id);
      Object.assign(row, data);
      log.push({ op: "update", table, id: row.id, data });
      return select(row, sel);
    },
    async updateMany({ where, data }) {
      const rows = tables[table].filter((r) => matches(r, where));
      for (const r of rows) { assertUnique(table, { ...r, ...data }, r.id); Object.assign(r, data); }
      log.push({ op: "updateMany", table, count: rows.length, data });
      return { count: rows.length };
    },
    async upsert({ where, update, create, select: sel }) {
      const row = uniqueKey(table, where);
      if (row) { Object.assign(row, update); log.push({ op: "upsert:update", table, id: row.id }); return select(row, sel); }
      const created = { id: id(table), createdAt: clock(), ...create };
      assertUnique(table, created);
      tables[table].push(created);
      log.push({ op: "upsert:create", table, id: created.id });
      return select(created, sel);
    },
    async delete() { log.push({ op: "delete", table }); throw new Error(`delete on ${table} — this check forbids it`); },
    async deleteMany() { log.push({ op: "deleteMany", table }); throw new Error(`deleteMany on ${table} — this check forbids it`); },
  });

  const client = {};
  for (const t of Object.keys(tables)) client[t] = model(t);
  client.tables = tables;
  client.log = log;

  // The injected seams: what applyIndustry and Better Auth do in production.
  client.dress = async (companyId, trade) => {
    const co = tables.company.find((c) => c.id === companyId);
    if (!co?.isDemo) throw new Error("dress refused: not a demo");
    co.name = INDUSTRIES[trade].company;
    co.demoIndustry = trade;
    for (let i = 0; i < 2; i++) {
      const cl = { id: id("client"), companyId, name: `${trade} client ${i}` };
      tables.client.push(cl);
      tables.quote.push({ id: id("quote"), companyId, clientId: cl.id, quoteNumber: `Q-${trade}-${i}`, status: "draft" });
    }
    log.push({ op: "dress", table: "company", id: companyId, trade });
  };
  client.signUp = async ({ email, name, password }) => {
    if (!password || password.length < 12) throw new Error("weak password reached sign-up");
    const row = { id: id("user"), email, name, createdAt: clock() };
    assertUnique("user", row);
    tables.user.push(row);
    log.push({ op: "signUp", table: "user", id: row.id, email });
    return { user: row };
  };
  client.createOrg = async ({ name, slug, userId }) => {
    if (!userId) throw new Error("createOrganization without a userId");
    const row = { id: id("org"), name, slug, createdAt: clock() };
    assertUnique("organization", row);
    tables.organization.push(row);
    log.push({ op: "createOrg", table: "organization", id: row.id, userId });
    return row;
  };
  return client;
}

const rep = (client, { id, name, code, demoCompanyId = null }) => {
  const row = { id, name, code, email: `${code}@example.com`, demoCompanyId, active: true, endedAt: null, createdAt: new Date() };
  client.tables.salesRep.push(row);
  return row;
};
const freshRep = (client, id) => ({ ...client.tables.salesRep.find((r) => r.id === id) });
const deps = (client) => ({ client, dress: client.dress, createOrg: client.createOrg, signUp: client.signUp });

// ═══════════════════════════════════════════════════════════════════════════
section("1. The pure helpers");
// ═══════════════════════════════════════════════════════════════════════════

ok("the slot is rep:trade", repDemoSlot("rep_1", "painting") === "rep_1:painting");
ok("...and null when either half is missing", repDemoSlot("", "painting") === null && repDemoSlot("rep_1", "") === null);
ok("the slug starts with demo- and names the trade", repDemoSlug("jay-mark", "painting") === "demo-jay-mark-painting");
ok("...generation 2 gets a suffix, generation 1 does not", repDemoSlug("jay", "roofing", 2) === "demo-jay-roofing-2" && repDemoSlug("jay", "roofing", 1) === "demo-jay-roofing");
ok("...it can never be one of the pool's slugs", !demoAccounts().some((a) => a.slug === repDemoSlug("", "painting")));
ok("...and it is a valid DNS label under hostile input", /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(repDemoSlug("Émile O'Brien!!", "HVAC & more", 3)) && repDemoSlug("x".repeat(80), "painting").length <= 63);
ok("the name is '<Trade> Demo — <First name>'", repDemoName("cabinets", "Jay Mark Balverde") === "Cabinet refinishing Demo — Jay");
ok("...and survives a blank name", repDemoName("painting", "") === "Painting Demo — Rep");
ok("the address is demo-<code>@fieldquo.com", repDemoLoginEmail("jay-mark") === "demo-jay-mark@fieldquo.com");
ok("...replacement N gets -N", repDemoLoginEmail("jay", 2) === "demo-jay-2@fieldquo.com");
ok("...and strips anything that is not a code character", repDemoLoginEmail("Jay Mark") === "demo-jaymark@fieldquo.com");
ok("...null for an empty code rather than 'demo-@'", repDemoLoginEmail("") === null);
ok("the default trade is the held pool demo's", defaultTradeFor({ demoIndustry: "flooring" }) === "flooring");
ok("...and the first preset when there is none", defaultTradeFor(null) === INDUSTRY_KEYS[0] && defaultTradeFor({ demoIndustry: "nope" }) === INDUSTRY_KEYS[0]);
ok("isOwnLiveDemo needs isDemo, the owner, and no retirement", isOwnLiveDemo({ isDemo: true, demoOwnerRepId: "r", demoRetiredAt: null }, "r") && !isOwnLiveDemo({ isDemo: true, demoOwnerRepId: "r", demoRetiredAt: new Date() }, "r") && !isOwnLiveDemo({ isDemo: true, demoOwnerRepId: "other", demoRetiredAt: null }, "r") && !isOwnLiveDemo({ isDemo: false, demoOwnerRepId: "r", demoRetiredAt: null }, "r"));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Seeding is idempotent");
// ═══════════════════════════════════════════════════════════════════════════

{
  const client = makeStore();
  rep(client, { id: "rep_a", name: "Ana Lima", code: "ana" });

  const first = await ensureRepDemo({ rep: freshRep(client, "rep_a"), ...deps(client) });
  ok("first open creates a company", first.created === true && client.tables.company.length === 1, client.tables.company.length);
  ok("...isDemo, owned by the rep, on the default trade, with the slot", first.company.isDemo === true && first.company.demoOwnerRepId === "rep_a" && first.company.demoIndustry === INDUSTRY_KEYS[0] && first.company.demoRepSlot === "rep_a:painting");
  ok("...named '<Trade> Demo — <First name>' AFTER dressing renamed it", first.company.name === "Painting Demo — Ana", first.company.name);
  ok("...with the demo- slug", first.company.slug === "demo-ana-painting", first.company.slug);
  ok("...dressed through the injected seeder", client.log.some((l) => l.op === "dress" && l.id === first.company.id));
  ok("...and the rep is pointed at it", freshRep(client, "rep_a").demoCompanyId === first.company.id);

  const second = await ensureRepDemo({ rep: freshRep(client, "rep_a"), ...deps(client) });
  ok("second open creates nothing", second.created === false && client.tables.company.length === 1);
  ok("...and returns the same company", second.company.id === first.company.id);
  ok("...dressing ran once", client.log.filter((l) => l.op === "dress").length === 1);

  // Two tabs: both read "no demo", both create. The store's unique on
  // demoRepSlot refuses the second the way Postgres would.
  const client2 = makeStore();
  rep(client2, { id: "rep_b", name: "Bo", code: "bo" });
  const [x, y] = await Promise.all([
    ensureRepDemo({ rep: freshRep(client2, "rep_b"), trade: "roofing", ...deps(client2) }),
    ensureRepDemo({ rep: freshRep(client2, "rep_b"), trade: "roofing", ...deps(client2) }),
  ]);
  ok("two tabs racing produce ONE company", client2.tables.company.length === 1, client2.tables.company.length);
  ok("...both tabs are handed the same one", x.company.id === y.company.id);
  ok("...exactly one of them created it", [x.created, y.created].filter(Boolean).length === 1, [x.created, y.created]);

  // A second trade is a second company, and the pointer stays where it was.
  const roofing = await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "roofing", ...deps(client) });
  ok("another trade is another company", roofing.created && client.tables.company.length === 2);
  ok("...the current demo keeps the pointer", freshRep(client, "rep_a").demoCompanyId === first.company.id);
  ok("an unknown trade is refused", await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "blacksmith", ...deps(client) }).then(() => false, (e) => e.status === 400));
  ok("no rep, no demo", await ensureRepDemo({ rep: null, ...deps(client) }).then(() => false, (e) => e.status === 401));

  // A rep coming off the pool keeps the pool demo's trade and is moved.
  const client3 = makeStore();
  client3.tables.company.push({ id: "pool_3", slug: "demo3", name: "Cedar & Co. Flooring", isDemo: true, demoIndustry: "flooring", demoOwnerRepId: null, demoRepSlot: null, demoRetiredAt: null, createdAt: new Date() });
  rep(client3, { id: "rep_c", name: "Cy", code: "cy", demoCompanyId: "pool_3" });
  const moved = await ensureRepDemo({ rep: freshRep(client3, "rep_c"), ...deps(client3) });
  ok("a rep holding demo3 (flooring) gets their own flooring demo", moved.created && moved.company.demoIndustry === "flooring");
  ok("...and is pointed at it, releasing the pool demo", freshRep(client3, "rep_c").demoCompanyId === moved.company.id);
  ok("...the pool demo itself is untouched", client3.tables.company.find((c) => c.id === "pool_3").demoOwnerRepId === null && !client3.log.some((l) => l.id === "pool_3"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Two reps, two demos, no crossing");
// ═══════════════════════════════════════════════════════════════════════════

{
  const client = makeStore();
  rep(client, { id: "rep_a", name: "Ana", code: "ana" });
  rep(client, { id: "rep_b", name: "Ben", code: "ben" });
  const a = await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "painting", ...deps(client) });
  const b = await ensureRepDemo({ rep: freshRep(client, "rep_b"), trade: "painting", ...deps(client) });
  ok("the same trade for two reps is two companies", a.company.id !== b.company.id && client.tables.company.length === 2);
  ok("...with different slots", a.company.demoRepSlot === "rep_a:painting" && b.company.demoRepSlot === "rep_b:painting");
  ok("...and different slugs", a.company.slug !== b.company.slug);

  // The isolation claim, read through the store the way every /app route
  // reads: scoped by companyId.
  const aQuotes = await client.quote.findMany({ where: { companyId: a.company.id } });
  const bQuotes = await client.quote.findMany({ where: { companyId: b.company.id } });
  ok("each demo has its own fixture rows", aQuotes.length === 2 && bQuotes.length === 2);
  ok("...and a query scoped to one never returns the other's", !aQuotes.some((q) => bQuotes.some((x) => x.id === q.id)));
  ok("each rep is pointed at their own", freshRep(client, "rep_a").demoCompanyId === a.company.id && freshRep(client, "rep_b").demoCompanyId === b.company.id);
  ok("rep A's list holds only A's", (await listRepDemos("rep_a", client)).every((d) => d.demoOwnerRepId === "rep_a"));

  // A rep cannot open, reset or point at a colleague's demo.
  const openOther = await openRepDemo({ rep: freshRep(client, "rep_a"), companyId: b.company.id, ...deps(client) });
  ok("open on a colleague's demo is refused", openOther.ok === false && openOther.status === 404, openOther);
  const resetOther = await resetRepDemo({ rep: freshRep(client, "rep_a"), companyId: b.company.id, ...deps(client) });
  ok("reset on a colleague's demo is refused", resetOther.ok === false && resetOther.status === 404, resetOther);
  ok("...and nothing changed", freshRep(client, "rep_b").demoCompanyId === b.company.id && !client.tables.company.find((c) => c.id === b.company.id).demoRetiredAt);
  client.tables.company.push({ id: "real_co", slug: "northline", name: "Northline", isDemo: false, demoOwnerRepId: "rep_a", demoRepSlot: null, demoRetiredAt: null, createdAt: new Date() });
  const openReal = await openRepDemo({ rep: freshRep(client, "rep_a"), companyId: "real_co", ...deps(client) });
  ok("a real tenant is refused even with the rep's id on it (isDemo re-read)", openReal.ok === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. A reset deletes nothing");
// ═══════════════════════════════════════════════════════════════════════════

{
  const client = makeStore();
  rep(client, { id: "rep_a", name: "Ana", code: "ana" });
  const first = await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "plumbing", ...deps(client) });
  await ensureRepDemoLogin({ rep: freshRep(client, "rep_a"), password: "correct-horse-battery", ...deps(client) });
  // The rep "used" it: an extra quote.
  client.tables.quote.push({ id: "q_used", companyId: first.company.id, quoteNumber: "Q-USED", status: "sent" });
  const rowsBefore = client.tables.quote.filter((q) => q.companyId === first.company.id).length;

  const result = await resetRepDemo({ rep: freshRep(client, "rep_a"), companyId: first.company.id, ...deps(client) });
  ok("reset succeeds", result.ok === true, result);
  ok("...no delete of any kind was attempted", !client.log.some((l) => l.op === "delete" || l.op === "deleteMany"));
  const old = client.tables.company.find((c) => c.id === first.company.id);
  ok("the old company is still there, retired", old && old.demoRetiredAt instanceof Date && old.demoRepSlot === null);
  ok("...still isDemo, still owned (so every exclusion still applies)", old.isDemo === true && old.demoOwnerRepId === "rep_a");
  ok("...with every row it had", client.tables.quote.filter((q) => q.companyId === old.id).length === rowsBefore && client.tables.quote.some((q) => q.id === "q_used"));
  ok("the fresh company holds the slot", result.company.id !== old.id && result.company.demoRepSlot === "rep_a:plumbing");
  ok("...with the next generation's slug", result.company.slug === "demo-ana-plumbing-2", result.company.slug);
  ok("...freshly dressed", client.tables.quote.filter((q) => q.companyId === result.company.id).length === 2);
  ok("the pointer moved", freshRep(client, "rep_a").demoCompanyId === result.company.id);
  const memOld = client.tables.member.find((m) => m.companyId === old.id);
  const memNew = client.tables.member.find((m) => m.companyId === result.company.id);
  ok("the login's membership on the old copy is inactive, not deleted", memOld && memOld.active === false);
  ok("...and active on the fresh one", memNew && memNew.active === true && memNew.role === "owner");
  ok("the fresh one got an organization", Boolean(result.company.authOrgId) && client.tables.organization.some((o) => o.id === result.company.authOrgId));
  ok("the retired copy is not in the rep's live list", !(await listRepDemos("rep_a", client)).some((d) => d.id === old.id));
  const again = await resetRepDemo({ rep: freshRep(client, "rep_a"), companyId: old.id, ...deps(client) });
  ok("resetting the retired copy is refused", again.ok === false);
  const twice = await resetRepDemo({ rep: freshRep(client, "rep_a"), companyId: result.company.id, ...deps(client) });
  ok("a second reset makes generation 3, keeps both older copies", twice.ok && twice.company.slug === "demo-ana-plumbing-3" && client.tables.company.filter((c) => c.demoOwnerRepId === "rep_a").length === 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The login — the pool's mechanism, one per rep");
// ═══════════════════════════════════════════════════════════════════════════

{
  const client = makeStore();
  rep(client, { id: "rep_a", name: "Ana Lima", code: "ana" });
  const noDemo = await ensureRepDemoLogin({ rep: freshRep(client, "rep_a"), password: "correct-horse-battery", ...deps(client) });
  ok("no login before a demo exists", noDemo.ok === false && noDemo.status === 409);

  const painting = await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "painting", ...deps(client) });
  const state0 = await repDemoState(freshRep(client, "rep_a"), client);
  ok("state before the login: exists false, the planned address named", state0.login.exists === false && state0.login.plannedEmail === "demo-ana@fieldquo.com", state0.login);
  ok("...and no demo reads as ready", state0.demos.every((d) => d.loginReady === false));

  const weak = await ensureRepDemoLogin({ rep: freshRep(client, "rep_a"), password: "short", ...deps(client) });
  ok("a short password is refused before sign-up", weak.ok === false && weak.status === 400 && !client.log.some((l) => l.op === "signUp"));

  const minted = await ensureRepDemoLogin({ rep: freshRep(client, "rep_a"), password: "correct-horse-battery", ...deps(client) });
  ok("the login is minted at demo-<code>@fieldquo.com", minted.ok && minted.email === "demo-ana@fieldquo.com" && minted.replaced === false, minted);
  ok("...through sign-up (the user row exists with the rep's name)", client.tables.user.some((u) => u.email === "demo-ana@fieldquo.com" && u.name === "Ana Lima"));
  ok("...with an owner membership on the demo", client.tables.member.some((m) => m.companyId === painting.company.id && m.role === "owner" && m.active));
  ok("...and an organization on the company", Boolean(client.tables.company.find((c) => c.id === painting.company.id).authOrgId));
  const state1 = await repDemoState(freshRep(client, "rep_a"), client);
  ok("state after: exists, the address, the demo ready and current", state1.login.exists && state1.login.email === "demo-ana@fieldquo.com" && state1.demos[0].loginReady && state1.demos[0].current);

  // A second trade after the login exists: attached inactive, current unchanged.
  const roofing = await ensureRepDemo({ rep: freshRep(client, "rep_a"), trade: "roofing", ...deps(client) });
  const memR = client.tables.member.find((m) => m.companyId === roofing.company.id);
  ok("a later trade gets a membership too, inactive until opened", memR && memR.active === false);
  ok("...and an organization straight away", Boolean(client.tables.company.find((c) => c.id === roofing.company.id).authOrgId));
  const state2 = await repDemoState(freshRep(client, "rep_a"), client);
  ok("...so it reads not-ready while painting stays current", state2.demos.find((d) => d.id === roofing.company.id).loginReady === false && state2.current === painting.company.id);

  // Open switches the active membership — exactly one active at a time.
  const opened = await openRepDemo({ rep: freshRep(client, "rep_a"), companyId: roofing.company.id, ...deps(client) });
  ok("open succeeds", opened.ok === true);
  const active = client.tables.member.filter((m) => m.active);
  ok("exactly one membership is active, and it is roofing's", active.length === 1 && active[0].companyId === roofing.company.id, active.map((m) => m.companyId));
  ok("the pointer followed", freshRep(client, "rep_a").demoCompanyId === roofing.company.id);

  // Replacement: a rep who lost the password.
  const replaced = await ensureRepDemoLogin({ rep: freshRep(client, "rep_a"), password: "another-long-password", ...deps(client) });
  ok("a second login is a replacement at -2", replaced.ok && replaced.email === "demo-ana-2@fieldquo.com" && replaced.replaced === true, replaced);
  const oldUser = client.tables.user.find((u) => u.email === "demo-ana@fieldquo.com");
  const newUser = client.tables.user.find((u) => u.email === "demo-ana-2@fieldquo.com");
  ok("the old user still exists (nothing deleted) with every membership inactive", oldUser && client.tables.member.filter((m) => m.userId === oldUser.id).every((m) => !m.active));
  const newActive = client.tables.member.filter((m) => m.userId === newUser.id && m.active);
  ok("the new user is active on exactly the current demo", newActive.length === 1 && newActive[0].companyId === roofing.company.id);
  ok("...and has a row on every live demo", client.tables.member.filter((m) => m.userId === newUser.id).length === 2);
  const state3 = await repDemoState(freshRep(client, "rep_a"), client);
  ok("the state names the replacement address", state3.login.email === "demo-ana-2@fieldquo.com");
  ok("MAX_GENERATIONS bounds the address search", Number.isInteger(MAX_GENERATIONS) && MAX_GENERATIONS >= 5);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Exclusion parity with the pool");
// ═══════════════════════════════════════════════════════════════════════════

{
  // A per-rep demo is isDemo: every exclusion that keys on the boolean keys on
  // it. That is only parity if nothing detects a demo some OTHER way — by the
  // pool's slug pattern, by demoAccounts(), by an email prefix.
  const { execSync } = await import("node:child_process");
  const files = execSync("git ls-files lib app middleware.js", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(js|mjs)$/.test(f) && !f.startsWith("lib/demo/"));
  const offenders = [];
  for (const f of files) {
    const src = decomment(read(f));
    if (/demoAccounts\(/.test(src)) offenders.push(`${f}: demoAccounts()`);
    if (/slug[^\n]{0,40}\/\^demo|\/\^demo\\d|startsWith\("demo\d/.test(src)) offenders.push(`${f}: slug pattern`);
    if (/@fieldquo\.com[^\n]{0,20}isDemo|isDemo[^\n]{0,20}@fieldquo\.com/.test(src)) offenders.push(`${f}: email-as-demo`);
  }
  ok("no reader outside lib/demo detects a demo by slug, address or the pool list", offenders.length === 0, offenders);
  const isDemoReaders = files.filter((f) => /\bisDemo\b/.test(decomment(read(f)))).length;
  ok("...and the isDemo readers are numerous (the exclusions exist)", isDemoReaders >= 40, isDemoReaders);

  const client = makeStore();
  rep(client, { id: "rep_a", name: "Ana", code: "ana" });
  const own = await ensureRepDemo({ rep: freshRep(client, "rep_a"), ...deps(client) });
  ok("a per-rep demo is created with isDemo true, never defaulted later", client.log.find((l) => l.op === "create" && l.table === "company") && own.company.isDemo === true);
  const src = decomment(read("lib/sales/repDemo.js"));
  ok("repDemo.js writes isDemo: true on create", /isDemo: true/.test(src));
  ok("...and never sets it false", !/isDemo: false/.test(src));
  ok("...and never deletes", !/\.delete\(|deleteMany/.test(src));
  ok("...and never writes SalesRep itself (demoAssign.js is the declared writer)", !/salesRep\.(update|updateMany|create|upsert|delete)/.test(src) && /pointRepAtOwnDemo\(/.test(src));
  ok("...re-reads ownership from the row on every action", (src.match(/isOwnLiveDemo\(/g) || []).length >= 4);
  ok("...mints the login through demoLogin.js, not its own sign-up", /mintDemoUser\(/.test(src) && /ensureDemoOrg\(/.test(src) && !/signUpEmail/.test(src));
  const assign = decomment(read("lib/sales/demoAssign.js"));
  ok("pointRepAtOwnDemo re-reads isDemo, the owner and retirement", /company\.isDemo !== true \|\| company\.demoOwnerRepId !== repId \|\| company\.demoRetiredAt/.test(assign));
  ok("the demo gate names the new writes", DEMO_GATE_WRITES.some((w) => /demoOwnerRepId/.test(w)) && DEMO_GATE_WRITES.some((w) => /mintDemoUser/.test(w)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The platform's pool is still the shared ten");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("demoAccounts() still describes ten demoN fixtures", DEMO_COUNT === 10 && demoAccounts().length === 10 && demoAccounts().every((a, i) => a.slug === `demo${i + 1}`));
  const seed = decomment(read("lib/demo/seedDemo.js"));
  ok("listDemos() lists only unowned demos", /where: \{ isDemo: true, demoOwnerRepId: null \}/.test(seed));
  const assign = decomment(read("lib/sales/demoAssign.js"));
  ok("the claim pool reads only unowned demos", /where: \{ isDemo: true, demoOwnerRepId: null \}/.test(assign));

  // Executed: a per-rep demo does not change the pool's counts.
  const client = makeStore();
  for (const a of demoAccounts()) client.tables.company.push({ id: `pool_${a.slug}`, slug: a.slug, name: a.slug, isDemo: true, demoIndustry: a.industry, demoOwnerRepId: null, demoRepSlot: null, demoRetiredAt: null, createdAt: new Date() });
  rep(client, { id: "rep_a", name: "Ana", code: "ana" });
  const before = await demoPoolCounts(client);
  await ensureRepDemo({ rep: freshRep(client, "rep_a"), ...deps(client) });
  const after = await demoPoolCounts(client);
  ok("seeding a rep's demo leaves the pool at ten", before.total === 10 && after.total === 10, after);
  ok("...all free (the rep holds their own, not one of these)", after.free === 10, after);

  const platformRoute = decomment(read("app/api/platform/demo/route.js"));
  ok("the console lists the pool through listDemos()", /listDemos\(\)/.test(platformRoute));
  ok("...and the reps' demos separately, read-only", /listAllRepDemos\(\)/.test(platformRoute) && /repDemos/.test(platformRoute));
  const platformPage = decomment(read("app/platform/demo/page.js"));
  ok("...which the page renders without Reset/Assign on them", /repDemos/.test(platformPage) && /Run the demo/.test(platformPage));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = decomment(read("app/api/sales/demo/route.js"));
  const getBody = (route.split("export async function GET")[1] || "").split("export async function POST")[0];
  const postBody = route.split("export async function POST")[1] || "";
  ok("GET rides requireSalesRep", /requireSalesRep\(request\)/.test(getBody));
  ok("...and seeds on first open through ensureRepDemo", /ensureRepDemo\(/.test(getBody));
  ok("POST rides requireDemoRep, not the read-only gate", /requireDemoRep\(request\)/.test(postBody) && !/requireSalesRep\(/.test(postBody));
  for (const a of ["create", "open", "reset", "login"]) ok(`...the "${a}" action exists`, new RegExp(`action === "${a}"`).test(postBody));
  ok("...the trade comes from INDUSTRIES, never trusted", /INDUSTRIES\[trade\]/.test(postBody));
  ok("...no 'claim' from the pool any more", !/action === "claim"/.test(route));
  ok("...no in-place re-dress of a rep's demo", !/applyIndustry|resetDemo\(/.test(route));
  ok("the rep row is re-read with code and name for every derivation", /select: \{ id: true, name: true, code: true, demoCompanyId: true \}/.test(route));

  const page = decomment(read("app/sales/demo/page.js"));
  ok("the page has no Claim", !/claim/i.test(page));
  ok("...opens through the 'open' action before pointing the tab at /app", /action: "open"/.test(page) && /window\.open\(""/.test(page));
  ok("...offers the sign-in control only once a login exists", /loginExists \?/.test(page) && /demoOpenNeedsLogin/.test(page));
  ok("...resets by company id, two presses", /action: "reset", companyId/.test(page) && /demoResetConfirm/.test(page));
  ok("...never says 'cannot be undone' about a reset that retires", !/cannot be undone/i.test(page));
  ok("every response is error-handled — fetchJson, never a bare res.ok", /fetchJson\(/.test(page) && !/if \(res\.ok\)/.test(page));

  const invite = decomment(read("app/api/sales/auth/invite/route.js"));
  ok("accepting an invite seeds the demo after the response", /after\(async \(\) =>/.test(invite) && /ensureRepDemo\(/.test(invite));
  ok("...and mints the login with the password just chosen", /ensureRepDemoLogin\(\{ rep: fresh, password \}\)/.test(invite));
  ok("...without letting a failure touch the accept", /catch \(err\)[\s\S]{0,200}demo not seeded on accept/.test(invite));

  const schema = read("prisma/schema.prisma");
  ok("Company carries demoOwnerRepId, demoRepSlot (@unique) and demoRetiredAt", /demoOwnerRepId String\?/.test(schema) && /demoRepSlot\s+String\?\s+@unique/.test(schema) && /demoRetiredAt\s+DateTime\?/.test(schema));
  ok("...indexed by owner", /@@index\(\[demoOwnerRepId\]\)/.test(schema));

  const login = decomment(read("lib/demo/demoLogin.js"));
  ok("demoLogin.js exports the two primitives", /export async function mintDemoUser/.test(login) && /export async function ensureDemoOrg/.test(login));
  ok("...and demoLoginReady now requires the organization", /Boolean\(member\?\.active\) && Boolean\(company\?\.authOrgId\)/.test(login));
  ok("...createOrganization is server-side, with the creator's userId", /createOrganization\(\{ body \}\)/.test(login) && /slug: company\.id, userId/.test(login));

  const pkg = JSON.parse(read("package.json"));
  ok("check:demo-per-rep is a script", typeof pkg.scripts?.["check:demo-per-rep"] === "string");
  ok("...and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:demo-per-rep"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
process.exit(0);
