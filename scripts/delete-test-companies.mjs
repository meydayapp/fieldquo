// scripts/delete-test-companies.mjs
//
// One-off, run by the owner on 2026-09-12 to clear the sandbox-era test
// companies before the first live signup. Dry by default — it only reads and
// writes a backup; `--yes` is the only thing that deletes.
//
//   node scripts/delete-test-companies.mjs          # backup + report, no change
//   node scripts/delete-test-companies.mjs --yes    # backup, then delete
//
// What goes: every Company with isDemo = false, and everything under it (the
// database cascades company-owned rows). What stays: the ten demo companies,
// every PlatformAdmin, every SalesRep, and the owner's own logins. A User row
// left with no membership afterwards is removed too — a "josef test" login
// that lands on "you have no company" is not a state anyone wants — unless it
// is a platform admin, a sales rep, or one of the owner's addresses.
//
// A backup of every row in every table carrying a companyId is written first,
// as JSON, one file per table. Neon's point-in-time recovery is the second
// safety net; this file is the first.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const KEEP_EMAILS = new Set(["emilio.boves@gmail.com", "meydayapplication@gmail.com"]);
const YES = process.argv.includes("--yes");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(process.cwd(), "scratch", `deletion-backup-${stamp}`);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run from the repo root with the .env loaded, e.g.\n  export DATABASE_URL=\"$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"')\"");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params) => pool.query(sql, params);

const companies = (await q(`select id, name, "createdAt" from "Company" where "isDemo" = false order by "createdAt"`)).rows;
const ids = companies.map((c) => c.id);
console.log(`\n${companies.length} non-demo companies:`);
for (const c of companies) console.log(`  ${c.createdAt.toISOString().slice(0, 10)}  ${c.name}`);
const demos = (await q(`select count(*)::int as n from "Company" where "isDemo" = true`)).rows[0].n;
console.log(`${demos} demo companies stay.\n`);

// ── Backup ─────────────────────────────────────────────────────────────────
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, "Company.json"), JSON.stringify((await q(`select * from "Company" where id = any($1)`, [ids])).rows));
const tables = (await q(`select table_name from information_schema.columns where column_name = 'companyId' and table_schema = 'public' order by table_name`)).rows.map((r) => r.table_name);
let backedUp = 0;
const counts = {};
for (const t of tables) {
  const rows = (await q(`select * from "${t}" where "companyId" = any($1)`, [ids])).rows;
  if (!rows.length) continue;
  fs.writeFileSync(path.join(backupDir, `${t}.json`), JSON.stringify(rows));
  counts[t] = rows.length;
  backedUp += rows.length;
}
console.log(`Backup: ${backedUp} rows across ${Object.keys(counts).length} tables → ${backupDir}`);
for (const [t, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${t}`);

// ── Anything that would block a cascade? ───────────────────────────────────
const blockers = (await q(`
  select tc.table_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc on tc.constraint_name = rc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'Company' and rc.delete_rule not in ('CASCADE', 'SET NULL')`)).rows;
if (blockers.length) {
  console.log("\nForeign keys to Company that neither cascade nor null — the delete would be refused for these:");
  for (const b of blockers) console.log(`  ${b.table_name} (${b.delete_rule})`);
}

// ── Users that would be left with no company ───────────────────────────────
const orphans = (await q(`
  select u.id, u.email from "User" u
  where not exists (select 1 from "Member" m where m."userId" = u.id and m."companyId" <> all($1))
    and exists (select 1 from "Member" m where m."userId" = u.id and m."companyId" = any($1))
    and not exists (select 1 from "PlatformAdmin" pa where lower(pa.email) = lower(u.email))
    and not exists (select 1 from "SalesRep" sr where lower(sr.email) = lower(u.email))`, [ids])).rows
  .filter((u) => !KEEP_EMAILS.has(String(u.email).toLowerCase()));
console.log(`\n${orphans.length} user logins would be left with no company and go too:`);
for (const u of orphans) console.log(`  ${u.email}`);

if (!YES) {
  console.log("\nDry run — nothing changed. Re-run with --yes to delete.");
  await pool.end();
  process.exit(0);
}
if (blockers.length) {
  console.log("\nRefusing: the foreign keys above would make the delete fail half-way. Fix the schema first.");
  await pool.end();
  process.exit(1);
}

// ── Delete, one transaction ────────────────────────────────────────────────
//
// Nine foreign keys inside a company's own data are RESTRICT (Quote.clientId,
// Job.clientId, QuoteScopeGroup.categoryId, PayRunLine.workerId, …). Postgres
// checks RESTRICT the moment the referenced row goes, before the same
// statement's cascade reaches the referencing row — so "delete the company"
// alone is refused by its own quote. Those children are removed first, in one
// generic pass: every row whose RESTRICT target belongs to a company on the
// list. A row in another tenant referencing this tenant's client would be a
// bug, not data to keep; none exists (checked before the first run).
const restrictFks = (await q(`
  select tc.table_name as child, kcu.column_name as col, ccu.table_name as ref
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  where tc.constraint_type = 'FOREIGN KEY' and rc.delete_rule in ('RESTRICT', 'NO ACTION')
    and ccu.table_name in (select table_name from information_schema.columns where column_name = 'companyId' and table_schema = 'public')`)).rows;
const client = await pool.connect();
try {
  await client.query("begin");
  for (const fk of restrictFks) {
    const n = (await client.query(`delete from "${fk.child}" where "${fk.col}" in (select id from "${fk.ref}" where "companyId" = any($1))`, [ids])).rowCount;
    if (n) console.log(`  cleared ${n} ${fk.child} row(s) held by ${fk.ref}.${fk.col}`);
  }
  const deletedCompanies = (await client.query(`delete from "Company" where id = any($1)`, [ids])).rowCount;
  const deletedUsers = orphans.length ? (await client.query(`delete from "User" where id = any($1)`, [orphans.map((u) => u.id)])).rowCount : 0;
  await client.query("commit");
  console.log(`\nDeleted ${deletedCompanies} companies (children cascaded) and ${deletedUsers} orphaned user logins.`);
  const left = (await q(`select count(*)::int as n from "Company"`)).rows[0].n;
  console.log(`${left} companies remain (all demo).`);
} catch (err) {
  await client.query("rollback");
  console.error("\nRolled back — nothing changed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
