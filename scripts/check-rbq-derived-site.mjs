// scripts/check-rbq-derived-site.mjs
//
// A website GUESSED from a licence email, and every way that guess could
// quietly become a fact.
//
//   npm run check:rbq-derived-site
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Quebec's RBQ register publishes no website column, so `describeConfig`
// refused every campaign and 54,264 licences could never become callable —
// lib/sales/intel/tradeDetect.js is the only thing that can give a register row
// a trade and it needs a page. lib/sales/discovery/rbq/derivedSite.js derives
// a domain from `Courriel`, which unblocks the source and introduces exactly
// one new way to be badly wrong:
//
//   NOT a dead domain. A dead domain costs nothing — nothing loads, nothing
//   is inferred, the prospect is exactly where it was.
//
//   A LIVE domain belonging to somebody else. Measured on 200 derived domains
//   crawled on 2026-09-03: 166 loaded, and FOUR of those were a different
//   business — ge.com from a GE subsidiary's licence, crh.com from Oldcastle
//   Canada's, c3.farm from a CABINET MAKER's, tree9structures.com from a
//   second business the same owner runs. Each is a well-marked-up site a
//   detector reads confidently and reports the wrong trade from.
//
// So the assertions below are about four properties, and each is a decision
// that is invisible by reading:
//
//   1. a free-mail address yields NO domain — including the misspellings the
//      used-once arithmetic cannot see, which are the eleven worst cases in
//      the register (gmail.om is a live typosquat; bell.ca is Bell Canada);
//   2. a domain shared by two licences yields none for EITHER of them;
//   3. a derived domain is written as a ProspectInference and never as
//      `Prospect.websiteUrl`, `Prospect.domain` or `hasWebsite`;
//   4. an uncorroborated site cannot set `Prospect.tradeKey`.
//
// No database and no network. The write path is driven against a recording
// stub, because "it writes an inference and not a column" is a claim about a
// query and cannot be read off the source.
//
// ══ The traps this file was written around ═════════════════════════════════
//
// Three false passes were produced during this work and each is guarded now:
//
//   • Reading a source file RAW. A comment saying "must never write
//     websiteUrl" matches a grep for `websiteUrl` and passes a rule that meant
//     to find the opposite. Every positional rule here reads COMMENT-STRIPPED
//     source, via `code()`.
//   • `ok(label, condition)` — label FIRST. An assertion written the other way
//     round passes on every non-empty label for ever.
//   • `Number(null) === 0`. A confidence of null is not a confidence of zero,
//     and `0` on an inference reads as "we are certain it is wrong".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DERIVED_SITE_BASIS,
  FREE_MAIL_DOMAINS,
  countEmailDomains,
  deriveCandidateSite,
  derivedSiteEvidence,
  isFreeMailDomain,
  licenceEmailDomains,
} from "@/lib/sales/discovery/rbq/derivedSite";
import { toDiscoveredBusiness } from "@/lib/sales/discovery/rbq/licence";
import { DERIVED_SITE_INFERENCE_KIND, normaliseBusiness } from "@/lib/sales/discovery/normalise";
import { ingestPage, planIngest } from "@/lib/sales/discovery/ingest";
import { buildDedupeIndex } from "@/lib/sales/discovery/dedupe";
import { routeAfterEnrich } from "@/lib/sales/pipeline/handlers/enrichBusiness";
import { corroborateSite, nameTokens, postalCode, civicNumber } from "@/lib/sales/intel/siteIdentity";
import { inferTrade } from "@/lib/sales/intel/tradeDetect";
import { derivedSiteValue, prospectFacts } from "@/lib/sales/prospectView";
import { MATCH_THRESHOLD, FUZZY_CEILING } from "@/lib/sales/intel/confidence";
import { RBQ_YIELD_NOTE, rbqProvider } from "@/lib/sales/discovery/rbq/provider";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * The same file with every comment removed.
 *
 * The trap this exists for is specific and it fired in this session: a header
 * comment reading "must never be written to Prospect.websiteUrl" contains the
 * string `Prospect.websiteUrl`, so a rule asserting the ABSENCE of that string
 * passes or fails on the prose rather than on the code. Strings are preserved,
 * because half the assertions here are about a literal.
 */
function code(p) {
  const src = read(p);
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

let failures = 0;
let checks = 0;
/** label FIRST, condition SECOND. See the header. */
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

/** A grouped licence, in the shape licence.js produces. */
const lic = (over = {}) => ({
  licence: "1100-0001-01",
  status: "Active",
  name: "Toitures Tremblay inc.",
  phone: "4185551234",
  email: "info@toituretremblay.com",
  address: "415 RUE LINDSAY QUEBEC QC CANADA J2B 1G8",
  municipality: "Québec",
  subcategories: ["9"],
  otherNames: [],
  ...over,
});

const countsFor = (...licences) => countEmailDomains(licences);

/* ═══════════════════════════════════════════════════════════════════════════
   0. The harness itself
   ═══════════════════════════════════════════════════════════════════════════ */

section("The harness");
{
  // If `code()` is broken, every positional rule below passes vacuously — so
  // it is exercised on a fixture whose comment says the opposite of its code.
  const sample = `// never write websiteUrl here\nconst a = 1; /* websiteUrl */ const b = "websiteUrl";`;
  const tmp = path.join(ROOT, ".check-rbq-derived-site.tmp.js");
  fs.writeFileSync(tmp, sample);
  const stripped = code(".check-rbq-derived-site.tmp.js");
  fs.unlinkSync(tmp);
  ok("comment-stripping removes a line comment", !stripped.includes("never write"));
  ok("…and a block comment", !/\/\* websiteUrl \*\//.test(stripped));
  ok("…and KEEPS a string literal, which half these rules are about",
    stripped.includes('"websiteUrl"'),
    JSON.stringify(stripped));
  ok("…and keeps the code", stripped.includes("const a = 1;"));

  // ── The ok(label, condition) trap ──────────────────────────────────────
  //
  // Every assertion in this repo is `ok(label, condition)` — label FIRST — and
  // one written the other way round passes for ever on the truthiness of its
  // own label. So the harness is driven directly rather than through `ok`: a
  // deliberate failure printed as "FAIL" in the middle of a green run reads as
  // a real failure to whoever is looking at CI, which is its own kind of lie.
  const probeChecks = checks;
  const probeFailures = failures;
  // Silenced while it runs. A line reading "FAIL" in the middle of a green run
  // is read by a human as a failure however it is labelled, and a check that
  // cries wolf once is a check nobody reads twice.
  const say = console.log;
  console.log = () => {};
  ok("harness probe", false);
  console.log = say;
  const countedFailure = failures === probeFailures + 1;
  const countedCheck = checks === probeChecks + 1;
  failures = probeFailures;
  checks = probeChecks;
  ok("a false CONDITION is counted as a failure, whatever the label says", countedFailure);
  ok("…and a passing assertion is still counted as a check", countedCheck);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. A free-mail address yields no domain
   ═══════════════════════════════════════════════════════════════════════════ */

section("A free-mail address yields no domain");
{
  const gmail = lic({ email: "toituretremblay@gmail.com" });
  // gmail.com is shared by 11,258 licences in the real file. Here it is used
  // ONCE, which is the point: the assertion must hold on the arithmetic's
  // WORST case, not on its easy one.
  ok("gmail.com yields nothing even when this snapshot uses it once",
    deriveCandidateSite(gmail, countsFor(gmail)) === null);

  // The eleven measured typos and near-misses. Each is used exactly once in
  // the real register BY CONSTRUCTION — a misspelling cannot be shared — so
  // the used-once rule is blind to every one of them and the explicit list is
  // the only thing standing between the crawler and a live typosquat.
  const typos = [
    "gmail.om",
    "agmail.com",
    "homail.com",
    "outlook.ca",
    "yahoo.com.mx",
    "livel.com",
    "gmx.com",
    "topmail.com",
    "bell.ca",
    "globetrotter.com",
    "globetrotter.qc.ca",
  ];
  const missed = typos.filter((d) => {
    const l = lic({ email: `info@${d}` });
    return deriveCandidateSite(l, countsFor(l)) !== null;
  });
  ok("every measured free-mail typo in the used-once set is still refused",
    missed.length === 0,
    missed.join(", "));

  ok("a subdomain of a provider is refused too", isFreeMailDomain("tlb.sympatico.ca"));
  ok("…and so is a deeper one", isFreeMailDomain("mail.smtp.videotron.ca"));

  // The substring bug this cost a function to avoid. `bellaluminium.com` is a
  // real aluminium contractor in the register and `campbell.ca` is a plausible
  // one; a naive `includes("bell")` or `endsWith("bell.ca")` eats both.
  ok("bellaluminium.com is NOT a mailbox provider", !isFreeMailDomain("bellaluminium.com"));
  ok("campbell.ca is NOT a mailbox provider", !isFreeMailDomain("campbell.ca"));
  ok("notgmail.com is NOT a mailbox provider", !isFreeMailDomain("notgmail.com"));

  const contractor = lic({ email: "info@toituretremblay.com" });
  const derivedOk = deriveCandidateSite(contractor, countsFor(contractor));
  ok("a real business domain used once DOES derive",
    derivedOk?.domain === "toituretremblay.com",
    JSON.stringify(derivedOk));
  ok("…and it carries the address it came from, so a human can disagree",
    derivedOk?.email === "info@toituretremblay.com");
  ok("…and names its basis", derivedOk?.basis === DERIVED_SITE_BASIS);

  ok("a licence with no email derives nothing",
    deriveCandidateSite(lic({ email: "" }), countsFor(lic({ email: "" }))) === null);
  ok("a licence whose email is not an address derives nothing",
    deriveCandidateSite(lic({ email: "aucun" }), countsFor(lic({ email: "aucun" }))) === null);
  ok("null does not throw", deriveCandidateSite(null, new Map()) === null);
  ok("a missing counts map derives nothing rather than everything",
    deriveCandidateSite(contractor, null) === null,
    "a caller that forgot the histogram must get NOTHING, not an unfiltered guess");
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. A domain shared by two licences yields none for either
   ═══════════════════════════════════════════════════════════════════════════ */

section("A shared domain yields none for EITHER licence");
{
  const a = lic({ licence: "1100-0001-01", email: "a@fenplast.com" });
  const b = lic({ licence: "1100-0002-02", email: "b@fenplast.com" });
  const counts = countsFor(a, b);
  ok("the histogram counts two licences on the shared domain", counts.get("fenplast.com") === 2);
  // BOTH, not just the second. A rule that dropped only later collisions would
  // give the first licence a manufacturer's dealer portal as its website.
  ok("the first licence derives nothing", deriveCandidateSite(a, counts) === null);
  ok("the second licence derives nothing", deriveCandidateSite(b, counts) === null);

  // The intermediary case a blocklist would never contain: fenplast.com is a
  // window manufacturer used by 21 licences and ssss.gouv.qc.ca is a health
  // authority used by 18. Neither is a mailbox provider and neither is on the
  // list — the arithmetic is what removes them.
  ok("neither shared domain is on the explicit list, so ARITHMETIC removed them",
    !FREE_MAIL_DOMAINS.includes("fenplast.com") && !FREE_MAIL_DOMAINS.includes("ssss.gouv.qc.ca"));

  // The same licence appearing twice is ONE licence, not a collision. The
  // register is one row per (licence × subcategory) and a counter keyed on
  // rows rather than licence numbers would find every domain shared 17 times
  // and derive nothing at all, for anybody.
  const twice = countsFor(a, { ...a });
  ok("one licence counted twice is still one licence", twice.get("fenplast.com") === 1);
  ok("…so it still derives", deriveCandidateSite(a, twice)?.domain === "fenplast.com");

  // Two DIFFERENT domains on one licence is a choice between them, and array
  // order is not a decision — the rule tradeDetect.js's `contested` branch and
  // trades.js's primaryCategoryForInstantTrade() both hold.
  const two = lic({ email: "a@alpha-toiture.com; b@beta-toiture.com" });
  ok("two usable domains on one licence derive NEITHER",
    deriveCandidateSite(two, countsFor(two)) === null,
    JSON.stringify(licenceEmailDomains(two)));

  // …but one usable and one free-mail is not a choice, it is one candidate.
  const mixed = lic({ email: "boss@gmail.com toitures@alpha-toiture.com" });
  ok("one usable domain beside a free-mail one still derives the usable one",
    deriveCandidateSite(mixed, countsFor(mixed))?.domain === "alpha-toiture.com");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The used-once rule is counted over the WHOLE register
   ═══════════════════════════════════════════════════════════════════════════ */

section("The used-once rule is counted before the extractor's filters");
{
  const src = code("scripts/rbq-snapshot.mjs");
  const countAt = src.indexOf("noteForCounting(row[");
  const regionAt = src.indexOf("if (REGION &&");
  const muniAt = src.indexOf("if (MUNICIPALITY &&");
  ok("the extractor counts a row BEFORE the region filter",
    countAt !== -1 && regionAt !== -1 && countAt < regionAt,
    `count@${countAt} region@${regionAt}`);
  ok("…and before the municipality filter",
    countAt !== -1 && muniAt !== -1 && countAt < muniAt,
    `count@${countAt} municipality@${muniAt}`);
  ok("…and it counts from `allForCounting`, not from the kept licences",
    src.includes("countEmailDomains([...allForCounting.values()])"),
    "counting the filtered set turns a shared domain into a derivable one");

  // Executed, not just positional: a Montreal-only snapshot must not derive a
  // domain the Laval licence also uses.
  const montreal = lic({ licence: "1100-0001-01", email: "info@partagee.com" });
  const laval = lic({ licence: "1100-0002-02", email: "info@partagee.com" });
  const wholeRegister = countsFor(montreal, laval);
  const filteredOnly = countsFor(montreal);
  ok("counted over the filtered subset the shared domain would derive (the bug)",
    deriveCandidateSite(montreal, filteredOnly)?.domain === "partagee.com");
  ok("counted over the whole register it does not (the fix)",
    deriveCandidateSite(montreal, wholeRegister) === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. It is written as an inference and NEVER as a website
   ═══════════════════════════════════════════════════════════════════════════ */

section("A derived domain is an inference, never a website");
{
  const licence = lic({ candidateDomain: "toituretremblay.com", candidateEmail: "info@toituretremblay.com", candidateStatement: derivedSiteEvidence({ domain: "toituretremblay.com", email: "info@toituretremblay.com" }) });
  const business = toDiscoveredBusiness(licence, { release: "2026-09-03", sourceUrl: "https://example.test/x" });

  ok("the discovered business carries the guess", business.derivedWebsite?.domain === "toituretremblay.com");
  ok("…and its `websites` array is still EMPTY",
    Array.isArray(business.websites) && business.websites.length === 0,
    JSON.stringify(business.websites));

  const shaped = normaliseBusiness(business, { provider: "rbq", release: "2026-09-03", tradeKey: null });
  ok("normalise shapes it", shaped.ok === true, shaped.problems?.join(","));
  ok("`websiteUrl` is null on the prospect row", shaped.prospect.websiteUrl === null);
  ok("`domain` is null on the prospect row", shaped.prospect.domain === null,
    "a derived domain in this column would put the guess in every dedupe key");
  ok("`hasWebsite` is null, not true", shaped.prospect.hasWebsite === null);
  ok("the guess is returned BESIDE the prospect, not inside it",
    shaped.derivedWebsite?.domain === "toituretremblay.com" &&
      !("derivedWebsite" in shaped.prospect),
    "ingest spreads `prospect` into a row; anything inside it becomes a column");
  ok("…and it carries a statement naming the address",
    typeof shaped.derivedWebsite?.statement === "string" &&
      shaped.derivedWebsite.statement.includes("info@toituretremblay.com"));

  // Every key of the prospect row, checked as a set. A future column called
  // `site` or `guessedUrl` would be caught here rather than in production.
  const rowValues = Object.entries(shaped.prospect).filter(([, v]) => v === "toituretremblay.com");
  ok("NO column of the prospect row holds the derived domain",
    rowValues.length === 0,
    JSON.stringify(rowValues));

  const { plans } = planIngest([business], { provider: "rbq", release: "2026-09-03" }, buildDedupeIndex([]));
  const insert = plans.find((p) => p.action === "insert");
  ok("the plan is an insert", Boolean(insert), JSON.stringify(plans.map((p) => p.action)));
  ok("…and it carries the guess as a plan field", insert?.derivedWebsite?.domain === "toituretremblay.com");
  ok("…and the ROW it will write holds it in no column",
    Object.values(insert?.row || {}).every((v) => v !== "toituretremblay.com"),
    JSON.stringify(insert?.row));

  // A row with no guess must not produce an empty inference. An inference kind
  // present with a null value is a row written and never read.
  const bare = toDiscoveredBusiness(lic(), { release: "2026-09-03", sourceUrl: null });
  const barePlan = planIngest([bare], { provider: "rbq", release: "2026-09-03" }, buildDedupeIndex([]));
  ok("a licence with no candidate produces no derived-website plan",
    barePlan.plans.find((p) => p.action === "insert")?.derivedWebsite === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. …and the WRITE proves it, against a recording client
   ═══════════════════════════════════════════════════════════════════════════ */

section("The write itself: an inference row, and no website column");
{
  const writes = [];
  const record = (table, op) => (args) => {
    writes.push({ table, op, args });
    return Promise.resolve(
      op === "create" ? { id: `${table}-${writes.length}` } : op === "createMany" ? { count: 1 } : {},
    );
  };
  const tx = {
    prospect: { createMany: record("prospect", "createMany"), update: record("prospect", "update") },
    prospectEvidence: {
      createMany: record("prospectEvidence", "createMany"),
      create: record("prospectEvidence", "create"),
    },
    prospectInference: { upsert: record("prospectInference", "upsert") },
    prospectCampaign: { update: record("prospectCampaign", "update") },
  };
  const stub = {
    ...tx,
    $transaction: async (fn) => fn(tx),
  };
  stub.prospect.findMany = async () => [];

  const licence = lic({
    candidateDomain: "toituretremblay.com",
    candidateEmail: "info@toituretremblay.com",
    candidateStatement: derivedSiteEvidence({ domain: "toituretremblay.com", email: "info@toituretremblay.com" }),
  });
  const business = toDiscoveredBusiness(licence, { release: "2026-09-03", sourceUrl: "https://example.test/x" });

  await ingestPage(
    {
      campaign: null,
      businesses: [business],
      provider: "rbq",
      release: "2026-09-03",
      sourceUrl: "https://example.test/x",
      now: new Date("2026-09-03T00:00:00Z"),
    },
    { deps: { db: stub } },
  );

  const created = writes.find((w) => w.table === "prospect" && w.op === "createMany");
  const row = created?.args?.data?.[0] || {};
  ok("a prospect row was written", Boolean(created));
  ok("its websiteUrl is null", row.websiteUrl === null, JSON.stringify(row.websiteUrl));
  ok("its domain is null", row.domain === null);
  ok("its hasWebsite is null, NOT true and NOT false", row.hasWebsite === null);

  const upsert = writes.find((w) => w.table === "prospectInference" && w.op === "upsert");
  ok("a ProspectInference was upserted", Boolean(upsert));
  ok("…under the derived_site kind", upsert?.args?.create?.kind === DERIVED_SITE_INFERENCE_KIND);
  ok("…with the domain as its value", upsert?.args?.create?.value === "toituretremblay.com");
  ok("…marked `derived`, not first-party", upsert?.args?.create?.source === "derived");
  // Number(null) is 0 and 0 on an inference reads as "we are certain it is
  // wrong". The confidence must be a real number strictly between the two.
  const conf = upsert?.args?.create?.confidence;
  ok("…at a confidence that is a real number, not null and not zero",
    typeof conf === "number" && conf > 0 && conf < 1,
    JSON.stringify(conf));
  // The `update` branch runs on a re-ingest and is the one nobody exercises by
  // hand — so it is the copy that rots. Asserted to be the SAME object, which
  // is the only way one assertion can cover both.
  ok("…and the upsert's update branch is the SAME object as its create",
    upsert?.args?.update?.value === upsert?.args?.create?.value &&
      upsert?.args?.update?.confidence === upsert?.args?.create?.confidence &&
      upsert?.args?.update?.source === upsert?.args?.create?.source,
    JSON.stringify(upsert?.args?.update));
  ok("…with a real confidence on the update branch too",
    typeof upsert?.args?.update?.confidence === "number" &&
      upsert.args.update.confidence > 0 &&
      upsert.args.update.confidence < 1,
    JSON.stringify(upsert?.args?.update?.confidence));
  ok("…citing an evidence row that was actually written",
    Array.isArray(upsert?.args?.create?.evidenceIds) &&
      upsert.args.create.evidenceIds.length === 1 &&
      writes.some((w) => w.table === "prospectEvidence" && w.op === "create"));

  const ev = writes.find((w) => w.table === "prospectEvidence" && w.op === "create");
  ok("the evidence names the address the domain came from",
    String(ev?.args?.data?.rawValue || "").includes("info@toituretremblay.com"),
    String(ev?.args?.data?.rawValue || "").slice(0, 120));
  // `Number(null)` is 0 and 0 is less than 1, so the obvious spelling of this
  // — `Number(confidence) < 1` — passes when the column is written as NULL.
  // A mutation that nulled it survived until this was written the long way.
  // A null confidence is not a low confidence; it is no statement at all, and
  // an evidence row that makes no statement about its own reliability is the
  // fact/inference boundary erased in the column that records it.
  const evConf = ev?.args?.data?.confidence;
  ok("…recorded at a confidence that is a real number",
    typeof evConf === "number" && Number.isFinite(evConf),
    JSON.stringify(evConf));
  ok("…strictly below the 1.0 a published field gets",
    typeof evConf === "number" && evConf < 1,
    "a guess at the same confidence as a stated field erases the boundary");
  ok("…and strictly above zero, which would read as 'certainly wrong'",
    typeof evConf === "number" && evConf > 0);

  // Nothing anywhere in the whole write may set a website column.
  const offending = writes.filter((w) => {
    const data = w.args?.data;
    const rows = Array.isArray(data) ? data : [data, w.args?.create, w.args?.update];
    return rows.some(
      (r) => r && typeof r === "object" && (r.websiteUrl === "toituretremblay.com" || r.hasWebsite === true),
    );
  });
  ok("NO write in the whole ingest sets websiteUrl or hasWebsite",
    offending.length === 0,
    JSON.stringify(offending.map((w) => `${w.table}.${w.op}`)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Routing — and that the guess is never turned into a column on the way
   ═══════════════════════════════════════════════════════════════════════════ */

section("Routing to the crawler on a guess");
{
  ok("a listed website still routes to the crawler as `website_listed`",
    routeAfterEnrich({ websiteUrl: "https://a.example" }).reason === "website_listed");
  ok("no website and no guess still skips the crawler",
    routeAfterEnrich({ websiteUrl: null }).next === "DETECT_OPPORTUNITIES");

  const derived = routeAfterEnrich({ websiteUrl: null }, { derivedSite: "toituretremblay.com" });
  ok("a guess routes to the crawler", derived.next === "CRAWL_WEBSITE");
  ok("…and the reason says DERIVED, not listed",
    derived.reason === "website_derived",
    "the word reaches the task row a superadmin reads");
  ok("…over https, never http", derived.crawlUrl === "https://toituretremblay.com");

  // A listed website beats a guess. Re-deciding that would let an inference
  // overrule a published field.
  const both = routeAfterEnrich({ websiteUrl: "https://listed.example" }, { derivedSite: "guess.example" });
  ok("a listed website beats a guess", both.reason === "website_listed");

  ok("a blank guess is not a guess",
    routeAfterEnrich({ websiteUrl: null }, { derivedSite: "   " }).next === "DETECT_OPPORTUNITIES");

  // The handler must never write the derived URL onto the row. `repairsFor`
  // is the only thing in that file that builds a prospect update.
  const enrich = code("lib/sales/pipeline/handlers/enrichBusiness.js");
  ok("nothing in ENRICH_BUSINESS assigns websiteUrl",
    !/websiteUrl\s*[:=][^=]/.test(enrich.replace(/prospect\?\.websiteUrl|prospect\.websiteUrl|websiteUrl:\s*true/g, "")),
    "the guess is handed to the crawl, never stored as the answer");
  ok("the suppression check considers the derived domain too",
    enrich.includes("derivedSite?.domain"),
    "a domain FieldQuo is about to fetch must be on the same takedown list as any other");
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. An uncorroborated site cannot set a trade
   ═══════════════════════════════════════════════════════════════════════════ */

section("An uncorroborated site cannot set a trade");
{
  // A page that unambiguously establishes roofing: schema.org markup AND the
  // title AND a service route. Nothing about this page is weak — which is the
  // point. The refusal below must come from the IDENTITY, not from thin
  // evidence.
  const roofingPage = {
    url: "https://someone-elses-site.example/",
    finalUrl: "https://someone-elses-site.example/",
    status: 200,
    ok: true,
    // Over MIN_RENDERED_HTML (300 chars) and carrying links, because
    // `looksRendered` filters a page out below either — and a fixture that
    // fails that filter would make every assertion below pass for the wrong
    // reason, reporting `no_page_rendered` where it meant to report a trade.
    text:
      "Nous sommes couvreurs depuis 1994. Toiture résidentielle et commerciale partout dans la " +
      "région de Montréal. Réfection de toiture, membrane élastomère, bardeaux d'asphalte, " +
      "toiture plate et inspection de toiture. Nos couvreurs sont membres de l'Association des " +
      "maîtres couvreurs du Québec et détiennent une licence RBQ en règle depuis trente ans.",
    meta: { title: "Couvreur Montréal — Toitures ABC", description: "Toiture résidentielle" },
    schema: ['{"@type":"RoofingContractor"}', "RoofingContractor"],
    links: [
      { href: "https://someone-elses-site.example/services/toiture", url: "https://someone-elses-site.example/services/toiture", text: "Toiture" },
      { href: "https://someone-elses-site.example/contact", url: "https://someone-elses-site.example/contact", text: "Contact" },
    ],
  };
  const crawl = { pages: [roofingPage] };

  const trusted = inferTrade({ crawl, prospect: { tradeKey: null }, siteBelongsToProspect: true });
  ok("a trusted site with this evidence establishes roofing",
    trusted.decision === "confirmed" && trusted.tradeKey === "roofing",
    `${trusted.decision} / ${trusted.tradeKey}`);

  const untrusted = inferTrade({ crawl, prospect: { tradeKey: null }, siteBelongsToProspect: false });
  ok("the SAME evidence on an uncorroborated site does not",
    untrusted.decision === "weak" && untrusted.tradeKey === null,
    `${untrusted.decision} / ${untrusted.tradeKey}`);
  ok("…and the reason names the identity, not the evidence",
    untrusted.reason === "site_not_corroborated",
    untrusted.reason);
  ok("…but the inference IS still written, so a human can see what was found",
    untrusted.inference?.value === "roofing");
  ok("…and the evidence is kept", untrusted.evidence.length > 0);

  // The default. Every existing caller passes a site the source published, and
  // a default of false would silently stop every Overture prospect getting a
  // trade — a much larger regression than the one this guards.
  ok("the parameter defaults to TRUE, so no existing caller changes behaviour",
    inferTrade({ crawl, prospect: { tradeKey: null } }).decision === "confirmed");

  // The handler must ask the question only for a derived site.
  const analyze = code("lib/sales/pipeline/handlers/analyzeCapabilities.js");
  ok("ANALYZE_CAPABILITIES computes `wasDerived` from BOTH conditions",
    /wasDerived\s*=\s*!prospect\.websiteUrl\s*&&\s*Boolean\(derivedSite\?\.domain\)/.test(analyze),
    "a prospect with a listed website is never re-litigated");
  ok("…and passes the corroboration into inferTrade",
    analyze.includes("siteBelongsToProspect: identity.corroborated"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. What corroborates — and what deliberately does not
   ═══════════════════════════════════════════════════════════════════════════ */

section("Corroboration: deterministic only");
{
  const prospect = {
    businessName: "Toitures Tremblay inc.",
    phoneE164: "+14185551234",
    addressLine: "415 rue Lindsay",
    postalCode: "J2B 1G8",
    city: "Québec",
  };
  const page = (over = {}) => ({
    url: "https://x.example/",
    finalUrl: "https://x.example/",
    status: 200,
    ok: true,
    text: "",
    meta: {},
    schema: [],
    links: [],
    ...over,
  });

  const phone = corroborateSite({
    crawl: { pages: [page({ text: "Appelez-nous au 418 555-1234" })] },
    prospect,
  });
  ok("the register's phone on the page corroborates",
    phone.corroborated === true,
    JSON.stringify(phone.signals));
  ok("…via the deterministic signal", phone.signals.includes("identity.exact_phone"));

  // Spacing and punctuation must not matter — the same number in three
  // spellings is one number, which is the whole reason phoneE164 exists.
  for (const spelling of ["(418) 555-1234", "418.555.1234", "+1 418 555 1234", "tel:+14185551234"]) {
    ok(`…and matches "${spelling}"`,
      corroborateSite({ crawl: { pages: [page({ text: spelling })] }, prospect }).corroborated === true);
  }

  const address = corroborateSite({
    crawl: { pages: [page({ text: "415 rue Lindsay, Québec, J2B 1G8" })] },
    prospect,
  });
  ok("the register's civic number AND postal code corroborate",
    address.corroborated === true,
    JSON.stringify(address.signals));

  // Both halves. A postal code alone is one side of one block and a civic
  // number alone is on every street in Quebec.
  const postalOnly = corroborateSite({
    crawl: { pages: [page({ text: "Nous sommes situés dans le secteur J2B 1G8" })] },
    prospect,
  });
  ok("a postal code WITHOUT the civic number does not corroborate",
    postalOnly.corroborated === false,
    JSON.stringify(postalOnly.signals));

  // ── The decision this file exists to hold ──────────────────────────────
  //
  // A name match is real evidence and is never enough. 43 of 166 crawled
  // derived domains corroborate on name alone, every one inspected was right,
  // and they are still refused — because confidence.js caps a pile of
  // resemblances below MATCH_THRESHOLD so that no tuning can promote a
  // resemblance to an identity, and a second file quietly deciding otherwise
  // is that rule with a hole in it.
  const nameOnly = corroborateSite({
    crawl: { pages: [page({ meta: { title: "Toitures Tremblay — Couvreur" } })] },
    prospect,
  });
  ok("a NAME match is recorded", nameOnly.signals.includes("identity.similar_name"));
  ok("…and does NOT corroborate on its own", nameOnly.corroborated === false);
  ok("…and comes back as `review`, never `no_match`",
    nameOnly.decision === "review",
    "a resemblance is a question for a human, not a refutation");

  const nameAndCity = corroborateSite({
    crawl: { pages: [page({ meta: { title: "Toitures Tremblay" }, text: "Québec" })] },
    prospect,
  });
  ok("a PILE of resemblances still does not corroborate",
    nameAndCity.corroborated === false,
    JSON.stringify(nameAndCity.signals));
  ok("…which is confidence.js's ceiling doing the work, not a local rule",
    FUZZY_CEILING < MATCH_THRESHOLD,
    `${FUZZY_CEILING} < ${MATCH_THRESHOLD}`);

  // The measured wrong-entity cases. Each is a real, live site that loaded.
  const ge = corroborateSite({
    crawl: {
      pages: [
        page({
          meta: { title: "GE Companies: Next Generation and Future | General Electric" },
          text: "GE Aerospace GE Vernova GE HealthCare",
        }),
      ],
    },
    prospect: {
      businessName: "AP&C Revêtements & Poudres Avancées inc.",
      phoneE164: "+14504341004",
      addressLine: "1 rue industrielle",
      postalCode: "J7R 5A1",
      city: "St-Eustache",
    },
  });
  ok("ge.com does not corroborate an AP&C licence", ge.corroborated === false);

  const c3 = corroborateSite({
    crawl: { pages: [page({ meta: { title: "C3" }, text: "About Us Global Operations Brands Investors" })] },
    prospect: {
      businessName: "9250-6518 Québec inc.",
      phoneE164: "+15149470422",
      addressLine: "12 rue x",
      postalCode: "J7R 0A1",
      city: "Saint-Eustache",
    },
  });
  ok("c3.farm does not corroborate a cabinet maker's licence", c3.corroborated === false);

  // A crawl that fetched nothing is not a refutation.
  const blank = corroborateSite({ crawl: { pages: [] }, prospect });
  ok("no page rendered is `no_page_rendered`, not a refusal of the site",
    blank.corroborated === false && blank.reason === "no_page_rendered");
  ok("null crawl does not throw", corroborateSite({}).corroborated === false);

  // A numbered company yields no name tokens at all — the register has told us
  // nothing nameable, and matching on "9250" or "inc" would resemble half the
  // province.
  ok("a numbered company yields no name tokens",
    nameTokens("9250-6518 Québec inc.").length === 0,
    JSON.stringify(nameTokens("9250-6518 Québec inc.")));
  ok("…but its TRADING name does",
    nameTokens("Ébénisterie Architecturale Labelle").length >= 2);
  ok("accents fold", nameTokens("Ébénisterie").includes("ebenisterie"));

  ok("a postal code parses with or without its space",
    postalCode("J2B 1G8") === "J2B1G8" && postalCode("j2b1g8") === "J2B1G8");
  ok("a phone number is not read as a postal code", postalCode("418 555 1234") === null);
  ok("a civic number is taken from the START of the line",
    civicNumber("415 RUE LINDSAY") === "415" && civicNumber("RUE LINDSAY 415") === null);

  // Trading names are what corroborate a numbered company, so they have to
  // reach the matcher.
  const viaTrading = corroborateSite({
    crawl: { pages: [page({ meta: { title: "Ébénisterie Architecturale Labelle" } })] },
    prospect: { businessName: "9250-6518 Québec inc.", phoneE164: null, city: null },
    alsoKnownAs: ["Ébénisterie Architecturale Labelle"],
  });
  ok("a trading name reaches the name matcher",
    viaTrading.signals.includes("identity.similar_name"),
    "licence.js keeps all four `Autre nom` values so this can work");
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. hasWebsite is never claimed off a guess
   ═══════════════════════════════════════════════════════════════════════════ */

section("hasWebsite is never claimed off a guess");
{
  const crawlSrc = code("lib/sales/crawl/crawlSite.js");
  ok("writeCrawl takes a `derived` flag", /async function writeCrawl\(\{[^}]*derived\s*=\s*false/.test(crawlSrc));
  ok("…and refuses hasWebsite when it is set",
    /hadContent\s*&&\s*derived\s*!==\s*true\s*&&\s*prospect\.hasWebsite\s*!==\s*true/.test(crawlSrc),
    "a page answering at ge.com is not proof a Quebec coatings shop has a site");
  ok("the crawler reads the guess itself rather than being handed it",
    crawlSrc.includes("loadDerivedSite(prospect.id"),
    "a superadmin re-crawl enters the chain in the middle and has no payload");
  ok("…and the listed URL still wins",
    crawlSrc.indexOf("prospect.websiteUrl") < crawlSrc.indexOf("loadDerivedSite(prospect.id"));

  const analyze = code("lib/sales/pipeline/handlers/analyzeCapabilities.js");
  ok("ANALYZE_CAPABILITIES fills hasWebsite only on corroboration",
    /identity\.corroborated\s*&&\s*prospect\.hasWebsite\s*!==\s*true/.test(analyze));
  ok("…and only as a FILL, guarded on the value read",
    /where:\s*\{\s*id:\s*prospectId,\s*hasWebsite:\s*null\s*\}/.test(analyze),
    "a crawl that later proves absence must not be overruled by this write");
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. What the rep is shown
   ═══════════════════════════════════════════════════════════════════════════ */

section("What the rep is shown");
{
  const guessed = prospectFacts(
    { hasWebsite: null, websiteUrl: null },
    { derivedSite: "toituretremblay.com" },
  ).find((f) => f.key === "website");
  ok("the Website fact names the domain", guessed.text.includes("toituretremblay.com"));
  ok("…and says GUESSED", /guess/i.test(guessed.text));
  ok("…and never says the source listed it", !/listed/i.test(guessed.text));
  ok("…and is still marked UNKNOWN, so it lands in the unknowns section",
    guessed.known === false);

  const confirmed = prospectFacts(
    { hasWebsite: true, websiteUrl: null },
    { derivedSite: "toituretremblay.com" },
  ).find((f) => f.key === "website");
  ok("a corroborated guess reads as confirmed", /confirmed/i.test(confirmed.text));

  const silent = prospectFacts({ hasWebsite: null, websiteUrl: null }).find((f) => f.key === "website");
  ok("with no guess the old sentence is unchanged",
    silent.text.startsWith("The source listed no website"));

  // A domain with digits in it is the common case and must survive. This is
  // the mechanical reason the derived site is NOT rendered through
  // inferenceStatement(), which withholds any value carrying a digit.
  ok("derivedSiteValue accepts a domain with digits",
    derivedSiteValue([{ kind: DERIVED_SITE_INFERENCE_KIND, value: "plomberie2000.ca" }]) === "plomberie2000.ca");
  ok("…and refuses a hand-edited sentence",
    derivedSiteValue([{ kind: DERIVED_SITE_INFERENCE_KIND, value: "we think it is acme.com" }]) === null);
  ok("…and ignores other inference kinds",
    derivedSiteValue([{ kind: "company_scale", value: "SOLO_LIKELY" }]) === null);

  const view = code("lib/sales/prospectView.js");
  ok("the derived site is kept OUT of the generic inference list",
    view.includes(`row?.kind !== DERIVED_SITE_INFERENCE_KIND`),
    "inferenceStatement withholds any value with a digit, and most domains have one");
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. CASL is not widened by any of this
   ═══════════════════════════════════════════════════════════════════════════ */

section("A derived website is not a route around CASL");
{
  const derivedSrc = code("lib/sales/discovery/rbq/derivedSite.js");
  ok("derivedSite.js returns a domain and never an address",
    !/email:\s*email\b/.test(derivedSrc) || derivedSrc.includes("domain: usable[0].domain"));
  ok("…and nothing here touches contactBasis",
    !derivedSrc.includes("contactBasis") && !derivedSrc.includes("CONTACT_BASIS"));

  const basis = code("lib/sales/contactBasis.js");
  ok("RBQ email is still prohibited", /rbq:[\s\S]*?email:\s*\{\s*state:\s*"prohibited"/.test(basis));
  ok("RBQ sms is still prohibited", /rbq:[\s\S]*?sms:\s*\{\s*state:\s*"prohibited"/.test(basis));
  ok("RBQ phone is still permitted", /rbq:[\s\S]*?phone:\s*\{\s*state:\s*"permitted"/.test(basis));

  // The derived DOMAIN must not become a mail domain anywhere.
  const ingestSrc = code("lib/sales/discovery/ingest.js");
  ok("ingest writes the guess as an inference and to no email column",
    ingestSrc.includes("DERIVED_SITE_INFERENCE_KIND") && !/emailAddress|toEmail|mailTo/.test(ingestSrc));
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. Wiring
   ═══════════════════════════════════════════════════════════════════════════ */

section("Wiring");
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:rbq-derived-site is a script", Boolean(pkg.scripts["check:rbq-derived-site"]));
  ok("…and is wired into check:all", pkg.scripts["check:all"].includes("check:rbq-derived-site"));
  ok("…and runs with the alias loader, which it needs",
    String(pkg.scripts["check:rbq-derived-site"] || "").includes("alias-loader"));

  // Moved here from check-rbq-provider.mjs, which reads source raw: the
  // comment beside the acceptance in provider.js contains the literal
  // `ok: true`, so a count over raw text counts two. Comment-stripped, it is
  // one — and one is the property that matters, because two acceptances are
  // two paths and one of them is the one nobody reads.
  const providerCode = code("lib/sales/discovery/rbq/provider.js");
  ok("describeConfig accepts exactly once",
    (providerCode.match(/ok:\s*true/g) || []).length === 1,
    JSON.stringify(providerCode.match(/ok:\s*true/g)));
  ok("…and the raw source would have counted MORE, which is why this is stripped",
    (read("lib/sales/discovery/rbq/provider.js").match(/ok:\s*true/g) || []).length >
      (providerCode.match(/ok:\s*true/g) || []).length,
    "if this ever stops being true the stripper is no longer doing anything here");

  // The yield note is asserted in check-rbq-provider.mjs too. It is asserted
  // HERE as well because it is this feature's number: deriving a domain is
  // what makes 2% of the register callable, and a superadmin told "54,264
  // Quebec contractors" and handed 1,100 has been misled by this change
  // specifically. A mutation that dropped it survived a run of this file
  // until this was added.
  ok("the yield note reaches the description the campaign form renders",
    rbqProvider.description.includes(RBQ_YIELD_NOTE),
    "defined and never rendered is the first failure class");
  ok("…and it names the denominator, not just the win",
    /54,264/.test(RBQ_YIELD_NOTE) && /1,100/.test(RBQ_YIELD_NOTE));

  const snapshot = code("scripts/rbq-snapshot.mjs");
  ok("the extractor reports how many candidate sites it derived",
    snapshot.includes("candidate site"),
    "an operator must be able to see the number without reading the file");
  ok("…and calls it a candidate rather than a website",
    !/console\.log\(`\s*website\s/.test(snapshot));
}

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
