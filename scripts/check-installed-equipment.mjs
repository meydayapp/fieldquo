// scripts/check-installed-equipment.mjs
//
//   npm run check:installed-equipment
//
// The job page's "Installed at this site" panel, executed.
//
// ══ What this guards ═══════════════════════════════════════════════════════
//
// Two panels on the job page hold the word "equipment": the company's own kit
// for costing (AssetUseLog) and the CLIENT's installed furnace with its
// warranty (ClientEquipment). The owner confused them once — that is why the
// second panel exists — and the decisions below are what keep the second one
// honest:
//
//   1. A warranty LENGTH the person chose becomes a date counted from the
//      install date they typed. "Don't know" becomes null. A length with no
//      install date is an error, never a date counted from today.
//   2. The install date starts as the job's completion date, then its end
//      date, then BLANK — never today.
//   3. Rows are split by site without reading a blank address as "elsewhere".
//   4. Only a warranty callback may point at equipment, and only the same
//      client's.
//   5. The write path pins installedByJobId to the job in the URL.
//
// Everything below runs the SHIPPED modules. The two source assertions at the
// end are scoped to one file each and exist only where behaviour cannot reach
// (JSX cannot be executed in this run).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  WARRANTY_LENGTH_OPTIONS,
  isWarrantyLength,
  addYears,
  warrantyEndFrom,
  defaultInstalledAt,
  normaliseAddress,
  partitionBySite,
  canLinkWarrantyEquipment,
  warrantyLinkVerdict,
  dateInputValue,
} from "@/lib/equipment/installed";
import { warrantyState, EXPIRY_STATES } from "@/lib/equipment/warranty";
import { parseEquipmentBody } from "@/lib/equipment/payload";
import { createClientEquipment } from "@/lib/equipment/create";
import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { countSeats } from "@/lib/pricing/ladder";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);

const NOW = new Date("2026-09-17T12:00:00Z");

// ═══════════════════════════════════════════════════════════════════════════
section("1. A warranty length is a choice, and only a choice makes a date");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "the options are unknown, 1, 2, 5, 10 years and custom, in that order",
  WARRANTY_LENGTH_OPTIONS.map((o) => o.key).join(",") === "unknown,1y,2y,5y,10y,custom",
  WARRANTY_LENGTH_OPTIONS,
);
ok("unknown offers no year count", WARRANTY_LENGTH_OPTIONS[0].years === null);
for (const bad of ["3y", "", null, undefined, "1", 1, {}]) {
  ok(`${JSON.stringify(bad)} is not a length`, !isWarrantyLength(bad));
}

const installed = "2026-03-15";
for (const [key, years] of [["1y", 1], ["2y", 2], ["5y", 5], ["10y", 10]]) {
  const r = warrantyEndFrom({ installedAt: installed, length: key });
  ok(
    `${key} counts ${years} year(s) from the install date`,
    r.warrantyEndsAt instanceof Date && dateInputValue(r.warrantyEndsAt) === `${2026 + years}-03-15`,
    r,
  );
}
{
  const r = warrantyEndFrom({ installedAt: installed, length: "unknown" });
  ok("'don't know' is null, not an error and not a date", r.warrantyEndsAt === null && !r.error, r);
  ok(
    "…and that null is rendered as UNKNOWN by the shared warranty rule",
    warrantyState({ warrantyEndsAt: r.warrantyEndsAt }, { asOf: NOW }).state === EXPIRY_STATES.UNKNOWN,
  );
}
{
  // THE assertion: a years choice with no install date must not count from today.
  const r = warrantyEndFrom({ installedAt: "", length: "5y" });
  ok("a years choice with a blank install date is an error, not today + 5", !!r.error && !r.warrantyEndsAt, r);
  const r2 = warrantyEndFrom({ installedAt: "not a date", length: "1y" });
  ok("…and an unparseable install date is an error too", !!r2.error, r2);
}
{
  const r = warrantyEndFrom({ installedAt: "", length: "custom", customEndsAt: "2031-01-02" });
  ok("custom takes its own date and needs no install date", dateInputValue(r.warrantyEndsAt) === "2031-01-02", r);
  const blank = warrantyEndFrom({ installedAt: installed, length: "custom", customEndsAt: "" });
  ok("custom with no date is an error, not unknown", !!blank.error, blank);
  const junk = warrantyEndFrom({ installedAt: installed, length: "custom", customEndsAt: "soon" });
  ok("custom with junk is an error", !!junk.error, junk);
}
{
  const r = warrantyEndFrom({ installedAt: installed, length: "3y" });
  ok("an unknown length key is an error", !!r.error, r);
  const none = warrantyEndFrom();
  ok("no arguments at all is an error, not a throw", !!none.error, none);
}
{
  // Leap day rolls to 1 March — one day generous, never one day short.
  const leap = addYears(new Date("2028-02-29T00:00:00Z"), 1);
  ok("29 Feb + 1 year lands on 1 March", dateInputValue(leap) === "2029-03-01", leap);
  const leap4 = addYears(new Date("2028-02-29T00:00:00Z"), 4);
  ok("29 Feb + 4 years stays 29 Feb", dateInputValue(leap4) === "2032-02-29", leap4);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The install date starts as the job's completion — never today");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "completedAt wins",
  defaultInstalledAt({ completedAt: "2026-08-01T15:00:00Z", endDate: "2026-07-30T00:00:00Z" }) === "2026-08-01",
);
ok("endDate is the fallback", defaultInstalledAt({ completedAt: null, endDate: "2026-07-30T00:00:00Z" }) === "2026-07-30");
ok("a job with neither starts BLANK", defaultInstalledAt({ completedAt: null, endDate: null }) === "");
ok("no job at all is blank, not a throw", defaultInstalledAt(null) === "" && defaultInstalledAt(undefined) === "");
ok("an unparseable completedAt is blank", defaultInstalledAt({ completedAt: "yesterday" }) === "");
ok("the default is never today's date", defaultInstalledAt({}) !== dateInputValue(new Date()));

// ═══════════════════════════════════════════════════════════════════════════
section("3. Split by site without reading a blank as 'elsewhere'");
// ═══════════════════════════════════════════════════════════════════════════

ok("addresses compare without case, punctuation or spacing", normaliseAddress("  14 Rue Principale, ") === normaliseAddress("14 rue principale"));
ok("a non-string is an empty address", normaliseAddress(null) === "" && normaliseAddress(42) === "");

const rows = [
  { id: "a", siteAddress: null },
  { id: "b", siteAddress: "14 Rue Principale" },
  { id: "c", siteAddress: "9 Other St" },
  null,
];
{
  const p = partitionBySite(rows, "14 rue principale,");
  ok("the job's site matches its own rows and the unaddressed ones", p.here.map((r) => r.id).join() === "a,b", p);
  ok("a different site is reported separately, not dropped", p.elsewhere.map((r) => r.id).join() === "c", p);
}
{
  const p = partitionBySite(rows, null);
  ok("a job with no site address sees everything as here", p.here.length === 3 && p.elsewhere.length === 0, p);
}
{
  const p = partitionBySite("nope", "x");
  ok("junk rows partition to nothing, not a throw", p.here.length === 0 && p.elsewhere.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Only a warranty callback links to equipment, and only its client's");
// ═══════════════════════════════════════════════════════════════════════════

ok("a warranty callback may link", canLinkWarrantyEquipment({ callbackReason: "warranty" }));
for (const reason of ["rework", "not_our_fault", null, undefined, ""]) {
  ok(`${JSON.stringify(reason)} may not`, !canLinkWarrantyEquipment({ callbackReason: reason }));
}
ok("no job may not", !canLinkWarrantyEquipment(null));

const warrantyJob = { clientId: "smith", callbackReason: "warranty" };
{
  const v = warrantyLinkVerdict({ job: warrantyJob, equipment: { id: "e1", clientId: "smith" } });
  ok("same client, warranty reason: allowed", v.ok === true, v);
}
{
  const v = warrantyLinkVerdict({ job: warrantyJob, equipment: { id: "e2", clientId: "jones" } });
  ok("the Joneses' furnace on the Smiths' callback is refused (400)", v.ok === false && v.status === 400, v);
}
{
  const v = warrantyLinkVerdict({ job: { ...warrantyJob, callbackReason: "rework" }, equipment: { id: "e1", clientId: "smith" } });
  ok("a rework job is refused even for the same client", v.ok === false && v.status === 400, v);
}
{
  const v = warrantyLinkVerdict({ job: warrantyJob, equipment: null });
  ok("a missing row is a 404", v.ok === false && v.status === 404, v);
}
{
  const v = warrantyLinkVerdict({});
  ok("no arguments is a refusal, not a throw", v.ok === false, v);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The write path: the URL's job is pinned, the tenant is proved");
// ═══════════════════════════════════════════════════════════════════════════

// A fake db with two companies' jobs, and a NextResponse-shaped refusal.
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };
const writes = [];
const fakeDb = {
  job: {
    findFirst: async ({ where }) =>
      [{ id: "job-ours", companyId: "co1" }, { id: "job-theirs", companyId: "co2" }].find(
        (j) => j.id === where.id && j.companyId === where.companyId,
      ) || null,
  },
  clientEquipment: {
    create: async ({ data }) => {
      writes.push(data);
      return { id: "eq1", ...data, services: [], createdAt: NOW, updatedAt: NOW };
    },
  },
};
const member = { id: "m1", companyId: "co1", userId: "u1", role: "owner" };
{
  writes.length = 0;
  const r = await createClientEquipment({
    db: fakeDb,
    NextResponse,
    member,
    client: { id: "smith", name: "Smith" },
    body: { name: "Furnace", installedByJobId: "job-theirs", warrantyEndsAt: "" },
    fixed: { installedByJobId: "job-ours" },
  });
  ok("`fixed` overrides a body naming another job", r.response === null && writes[0]?.installedByJobId === "job-ours", r.response || writes[0]);
  ok("a blank warranty date is written as null", writes[0]?.warrantyEndsAt === null, writes[0]);
  ok("the row is the member's company, not the body's", writes[0]?.companyId === "co1");
  ok("the decorated row says the warranty is unknown", r.created?.warranty?.state === EXPIRY_STATES.UNKNOWN, r.created?.warranty);
}
{
  writes.length = 0;
  const r = await createClientEquipment({
    db: fakeDb,
    NextResponse,
    member,
    client: { id: "smith", name: "Smith" },
    body: { name: "Furnace", installedByJobId: "job-theirs" },
  });
  ok("without `fixed`, another tenant's job id is refused before any write", r.response && r.response.status >= 400 && writes.length === 0, r.response);
}
{
  const r = await createClientEquipment({
    db: fakeDb,
    NextResponse,
    member,
    client: { id: "smith", name: "Smith" },
    body: { installedByJobId: "job-ours" },
    fixed: { installedByJobId: "job-ours" },
  });
  ok("a nameless row is refused (400)", r.response?.status === 400, r.response);
}
{
  // The job route's own foreign key is in the shared tenant table.
  const owned = await assertOwnedIds(
    {
      clientEquipment: {
        findFirst: async ({ where }) => (where.id === "eq-ours" && where.companyId === "co1" ? { id: "eq-ours" } : null),
      },
    },
    "co1",
    { clientEquipmentId: "eq-theirs" },
  );
  ok("clientEquipmentId is proved through lib/tenant/ownedIds.js and a foreign one is refused", owned.ok === false, owned);
}
ok("parseEquipmentBody still reads a present-and-blank installedAt as null", parseEquipmentBody({ name: "x", installedAt: "" }, { creating: true }).data.installedAt === null);

// ═══════════════════════════════════════════════════════════════════════════
section("6. The two panels cannot be read as one (source, scoped)");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = read("app/components/jobs/EquipmentUseLog.js");
  ok(
    "the company panel's title fallback says 'Company equipment used'",
    /t\("app\.jobEquipment\.title",\s*"Company equipment used"\)/.test(src),
  );
  const i18n = read("app/i18n/appMessages.js");
  const enBlock = i18n.slice(i18n.indexOf("\nconst en = {"), i18n.indexOf("\n};\n", i18n.indexOf("\nconst en = {")));
  ok(
    "…and so does the English catalogue",
    /"app\.jobEquipment\.title": "Company equipment used"/.test(enBlock),
  );
  const panel = read("app/components/jobs/InstalledEquipment.js");
  ok("the installed panel renders nothing on a refused read (403), never an empty list", /LOAD_ERROR_KEYS\.forbidden\)\s*return null/.test(panel));
  ok(
    "the installed panel derives the warranty date from the shared rule, not its own arithmetic",
    /warrantyEndFrom\(/.test(panel) && !/setFullYear|\* 365/.test(panel),
  );
  const rowStart = panel.indexOf("function Row(");
  const rowBody = panel.slice(rowStart);
  ok(
    "Row has a distinct branch for an unknown warranty and never falls into the expired copy",
    rowBody.indexOf('warranty.state === "unknown"') >= 0 &&
      rowBody.indexOf('warranty.state === "unknown"') < rowBody.indexOf("app.equipment.badgeExpired"),
  );
  const detail = read("app/app/jobs/[id]/JobDetail.js");
  ok("the job page renders both panels", /<EquipmentUseLog jobId=/.test(detail) && /<InstalledEquipment job=/.test(detail));
  ok("the callback banner reads the SERVER's warranty state for the linked equipment", /job\.warrantyEquipment\.warranty\?\.state === "unknown"/.test(detail));
}
{
  // The seat maths is untouched by anything here — recorded so a future edit
  // that makes a ClientEquipment row look like a member is caught.
  const roster = [{ role: "owner", active: true }];
  ok("a client's equipment row is not a seat", countSeats([...roster, { name: "Furnace" }]).seats === 1);
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
