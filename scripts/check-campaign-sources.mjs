// scripts/check-campaign-sources.mjs
//
// A campaign draws from SEVERAL discovery sources at once. Prove that it
// actually runs all of them, that a source which cannot run is never quietly
// ticked, that two sources' settings cannot collide, that a campaign created
// before this change still works, and that a failing source is never dropped
// in silence.
//
//   npm run check:campaign-sources
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// "It iterates the sources" is a claim. Two stub providers, a fake database,
// and the SHIPPED `runDiscoverBusinesses` writing two cursors and two sets of
// counters is a measurement. Everything here that decides anything is driven
// for real: the handler against a store, the pure readers against hostile
// rows, the registration against a provider with no licence.
//
// The three positional rules at the end are on comment-STRIPPED source, and
// they exist for the edits an execution test cannot see — a `<select>` put
// back, a licence line deleted from the form, `describeConfig` called instead
// of `startProblems` on the start path.
//
// ══ The traps this file is written against ════════════════════════════════
//
//   1. Reading a source file RAW instead of comment-stripped. Every file in
//      this feature has a header that describes the behaviour being forbidden,
//      word for word — so a raw regex for "discoveryProvider" matches the
//      comment explaining why it is no longer written. `read()` strips.
//   2. `ok(label, condition)` — LABEL FIRST. Condition-first makes a non-empty
//      string the condition, which can never fail. Asserted below, on ok
//      itself, because that is a mistake that hides every other mistake.
//   3. `Number(null)` is 0 and 0 is finite. `sourceState.failures` comes out
//      of a JSON column, so null, "" and undefined all reach it, and a plain
//      Number() check reads a missing count as a real zero — the same trap
//      that made a coordinate-less row get measured from (0, 0) in
//      overture/provider.js. Driven directly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  __resetDiscoveryProvidersForTests,
  discoveryProviders,
  getDiscoveryProvider,
  registerDiscoveryProvider,
} from "@/lib/sales/discovery/provider";
import {
  EMPTY_SOURCE_STATE,
  MAX_SOURCE_FAILURES,
  allSourcesFinished,
  blockedSources,
  campaignSourceKeys,
  configForSource,
  cursorFingerprint,
  describeSources,
  mergeSourceState,
  readSourceConfigs,
  readSourceSelection,
  sourceIsOpen,
  sourceStateFor,
  startProblems,
  unavailableReasonOf,
} from "@/lib/sales/discovery/sources";
import { runDiscoverBusinesses } from "@/lib/sales/pipeline/handlers/discoverBusinesses";
import { funnelRows } from "@/lib/sales/discovery/funnel";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// The two REAL sources, captured before anything resets the registry.
// Importing the handler above pulls in providers.js for its side effect, so
// they are already registered here — and a later `await import` of the same
// module would be a cache hit that registers nothing. Held by reference so the
// sections that need the shipped licences and the shipped refusal can put them
// back rather than testing a stub that resembles them.
const SHIPPED = {
  overture: getDiscoveryProvider("overture"),
  rbq: getDiscoveryProvider("rbq"),
};

let checks = 0;
let failures = 0;

function section(title) {
  console.log(`\n${title}\n`);
}

/** Label FIRST. See trap 2 in the header. */
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
  return pass;
}

/** A source file with its comments removed. See trap 1 in the header. */
function read(rel) {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function raw(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/* ═══════════════════════════════════════════════════════════════════════════
   0. The harness itself
   ═══════════════════════════════════════════════════════════════════════════ */

section("The harness cannot manufacture a pass");
{
  // ok(label, condition). Called the other way round, a non-empty label lands
  // in `pass` and every assertion in the file becomes unfailable. Driven, with
  // the console silenced so the probe's own FAIL line does not read as a real
  // one — and the counters restored afterwards.
  const probe = (fn) => {
    const beforeChecks = checks;
    const beforeFailures = failures;
    const log = console.log;
    console.log = () => {};
    try {
      fn();
    } finally {
      console.log = log;
    }
    const moved = { checks: checks - beforeChecks, failures: failures - beforeFailures };
    checks = beforeChecks;
    failures = beforeFailures;
    return moved;
  };

  ok("a FALSE condition in the second argument fails",
    probe(() => ok("a label that is a non-empty string", false)).failures === 1);
  ok("...and a true one passes, so the harness is not simply always failing",
    probe(() => ok("a label", true)).failures === 0);

  // Comment stripping, proved on this feature's own file: the handler's header
  // contains the sentence describing the behaviour it no longer has.
  const header = raw("lib/sales/pipeline/handlers/discoverBusinesses.js");
  ok("the shipped handler's COMMENT mentions the single-cursor design it replaced",
    /single cursor|one cursor/i.test(header));
  ok("...and read() strips it, so a comment cannot satisfy a code rule",
    !/one cursor/i.test(read("lib/sales/pipeline/handlers/discoverBusinesses.js")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. A source must state its licence, and one that cannot run must say so
   ═══════════════════════════════════════════════════════════════════════════ */

section("Registration: choosing a source is choosing a licence, so a source states one");
{
  __resetDiscoveryProvidersForTests();

  const skeleton = {
    key: "lic_test",
    label: "Licence test",
    description: "test only",
    configFields: [],
    describeConfig: () => ({ ok: true, problems: [], summary: "x" }),
    fetchPage: async () => ({ release: null, businesses: [], nextCursor: null }),
  };

  const refuses = (provider) => {
    try {
      registerDiscoveryProvider(provider);
      return false;
    } catch {
      return true;
    }
  };

  ok("a source with NO licence is refused at registration", refuses({ ...skeleton }));
  ok("...and so is one whose licence has no name",
    refuses({ ...skeleton, licence: { url: "https://x.test", obligation: "y" } }));
  ok("...and one whose licence states no obligation",
    refuses({ ...skeleton, licence: { name: "CC0", url: "https://x.test", obligation: "  " }}));
  ok("...and one whose licence is an array pretending to be an object",
    refuses({ ...skeleton, licence: ["CC0"] }));
  ok("a source that states one registers",
    Boolean(
      registerDiscoveryProvider({
        ...skeleton,
        licence: { name: "CC0", url: "https://x.test", obligation: "none" },
      }),
    ));
  ok("unavailableReason must be a function when present",
    refuses({ ...skeleton, key: "lic_test2", licence: { name: "a", url: "b", obligation: "c" }, unavailableReason: "no" }));

  const listed = discoveryProviders().find((p) => p.key === "lic_test");
  ok("the form payload carries the licence, not just the key",
    listed?.licence?.name === "CC0" && listed.licence.obligation === "none");
  ok("...and resolves `unavailable` for the form, rather than leaving it to remember to ask",
    Object.prototype.hasOwnProperty.call(listed || {}, "unavailable") && listed.unavailable === null);
}

section("A source that cannot run says so, and says the SAME thing twice");
{
  __resetDiscoveryProvidersForTests();
  registerDiscoveryProvider(SHIPPED.overture);
  registerDiscoveryProvider(SHIPPED.rbq);

  const shipped = discoveryProviders();
  ok("this build ships both real sources",
    shipped.some((p) => p.key === "overture") && shipped.some((p) => p.key === "rbq"),
    shipped.map((p) => p.key).join(", "));
  ok("every shipped source states a licence",
    shipped.every((p) => p.licence?.name && p.licence?.obligation));
  ok("the RBQ's licence says attribution is a CONDITION, and carries the notice",
    /condition/i.test(shipped.find((p) => p.key === "rbq")?.licence?.obligation || "") &&
      /CC BY 4\.0/.test(shipped.find((p) => p.key === "rbq")?.licence?.attribution || ""));
  ok("Overture's licence names CDLA-Permissive and does NOT claim attribution is required",
    /CDLA-Permissive/.test(shipped.find((p) => p.key === "overture")?.licence?.name || "") &&
      /No attribution is required/i.test(shipped.find((p) => p.key === "overture")?.licence?.obligation || ""));

  // Both shipped sources can run as of 2026-09-03. The RBQ reported itself
  // unavailable until lib/sales/discovery/rbq/derivedSite.js gave the crawler
  // a domain to fetch; scripts/check-rbq-derived-site.mjs is where that is
  // proved, and this file's job is the INVARIANT below rather than the verdict.
  ok("neither shipped source reports itself unavailable",
    shipped.every((p) => p.unavailable === null),
    shipped.filter((p) => p.unavailable).map((p) => p.key).join(", "));
  // The hook survives with nobody using it, deliberately: it is the only way
  // to grey a checkbox out before there is any config to judge, and the next
  // source that genuinely cannot run needs somewhere to say so. Asserted so
  // that "unused" cannot quietly become "deleted".
  ok("...but the hook is still THERE, for the next source that cannot",
    typeof getDiscoveryProvider("rbq")?.unavailableReason === "function");

  // The invariant that keeps the two statements from drifting: a source that
  // reports itself unavailable must ALSO refuse a perfect config. If somebody
  // lifts one and not the other, a start route that only asks describeConfig
  // would run a source the form disabled — or the reverse.
  for (const listed of shipped) {
    const provider = getDiscoveryProvider(listed.key);
    if (!unavailableReasonOf(provider)) continue;
    const perfect = {};
    for (const field of provider.configFields || []) perfect[field.name] = "https://example.test/snapshot.ndjson";
    ok(`${listed.key}: reporting itself unavailable also refuses a PERFECT config`,
      provider.describeConfig(perfect).ok === false);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Reading a campaign's sources, against hostile rows
   ═══════════════════════════════════════════════════════════════════════════ */

section("campaignSourceKeys: the set, the legacy fallback, and the rubbish in between");
{
  ok("the plural field wins", campaignSourceKeys({ discoverySources: ["a", "b"] }).join() === "a,b");
  ok("order is preserved, because it is the order the pipeline ingests in",
    campaignSourceKeys({ discoverySources: ["z", "a"] }).join() === "z,a");
  ok("a repeated key is counted ONCE — twice would double every counter it produced",
    campaignSourceKeys({ discoverySources: ["a", "a", " a "] }).join() === "a");
  ok("blank and non-string entries are dropped",
    campaignSourceKeys({ discoverySources: ["a", "", null, 7, { key: "b" }] }).join() === "a");
  ok("an EXISTING single-source campaign still names its source",
    campaignSourceKeys({ discoveryProvider: "overture" }).join() === "overture");
  ok("...and the plural field takes precedence once it is filled in",
    campaignSourceKeys({ discoverySources: ["rbq"], discoveryProvider: "overture" }).join() === "rbq");
  ok("a campaign that has chosen nothing names nothing — there is no default",
    campaignSourceKeys({}).length === 0 &&
      campaignSourceKeys({ discoverySources: [] }).length === 0 &&
      campaignSourceKeys(null).length === 0);
}

section("configForSource: two sources' settings CANNOT collide");
{
  // The collision this keying exists for: both shipped sources have a config
  // field called `snapshotUrl`.
  const campaign = {
    discoverySources: ["overture", "rbq"],
    sourceConfigs: {
      overture: { snapshotUrl: "https://a.test/overture.ndjson" },
      rbq: { snapshotUrl: "https://b.test/rbq.ndjson" },
    },
  };
  ok("each source reads its OWN snapshot URL",
    configForSource(campaign, "overture").snapshotUrl === "https://a.test/overture.ndjson" &&
      configForSource(campaign, "rbq").snapshotUrl === "https://b.test/rbq.ndjson");
  ok("...and they are different strings, so the test could actually fail",
    configForSource(campaign, "overture").snapshotUrl !== configForSource(campaign, "rbq").snapshotUrl);
  ok("a source with no entry gets NOTHING, not its neighbour's file",
    Object.keys(configForSource({ ...campaign, discoverySources: ["overture", "rbq", "third"] }, "third")).length === 0);

  const legacy = {
    discoveryProvider: "overture",
    providerConfig: { snapshotUrl: "https://old.test/f.ndjson" },
  };
  ok("an existing campaign's single blob is still read, for the source it belongs to",
    configForSource(legacy, "overture").snapshotUrl === "https://old.test/f.ndjson");
  ok("...and is NOT handed to any other source — that is the collision, dressed up as a default",
    Object.keys(configForSource(legacy, "rbq")).length === 0);
  ok("an entry present but empty is a statement, not a licence to fall back",
    Object.keys(configForSource({ ...legacy, sourceConfigs: { overture: {} } }, "overture")).length === 0);
  ok("an array in the JSON column is not an object", Object.keys(configForSource({ sourceConfigs: ["x"] }, "a")).length === 0);
}

section("sourceStateFor: Number(null) is 0, and 0 is finite");
{
  const at = (state) => sourceStateFor({ discoverySources: ["s"], sourceState: { s: state } }, "s");

  ok("a missing state is the empty state, fully stated",
    JSON.stringify(sourceStateFor({ discoverySources: ["s"] }, "s")) === JSON.stringify(EMPTY_SOURCE_STATE));
  ok("failures: null reads as 0, not as a number", at({ failures: null }).failures === 0);
  ok("failures: \"3\" reads as 0 — a string is not a count", at({ failures: "3" }).failures === 0);
  ok("failures: 1.5 reads as 0 — a fraction is not a count", at({ failures: 1.5 }).failures === 0);
  ok("failures: -2 reads as 0", at({ failures: -2 }).failures === 0);
  ok("failures: 3 reads as 3, so the guard above is not just returning 0", at({ failures: 3 }).failures === 3);
  ok("ended is only true when it is literally true", at({ ended: "yes" }).ended === false && at({ ended: true }).ended === true);
  ok("a blank blocked string is not a block", at({ blocked: "   " }).blocked === null);
  ok("a real blocked string survives", at({ blocked: "the host is gone" }).blocked === "the host is gone");
  ok("an existing campaign's single cursor is not lost",
    sourceStateFor({ discoveryProvider: "overture", discoveryCursor: "4200" }, "overture").cursor === "4200");
  ok("...and belongs to that source alone",
    sourceStateFor({ discoveryProvider: "overture", discoveryCursor: "4200" }, "rbq").cursor === null);

  ok("an open source is open", sourceIsOpen({ ended: false, blocked: null }) === true);
  ok("an ended one is not", sourceIsOpen({ ended: true, blocked: null }) === false);
  ok("a blocked one is not", sourceIsOpen({ ended: false, blocked: "why" }) === false);
}

section("mergeSourceState and cursorFingerprint");
{
  const campaign = {
    discoverySources: ["a", "b"],
    sourceState: { a: { cursor: "10", ended: false, blocked: null, failures: 0, lastError: null, lastErrorAt: null } },
  };
  const merged = mergeSourceState(campaign, { b: { cursor: "5" } });
  ok("a patch to one source does not erase another's cursor", merged.a.cursor === "10" && merged.b.cursor === "5");
  ok("a de-selected source is dropped rather than resumed months later",
    Object.keys(mergeSourceState({ discoverySources: ["a"], sourceState: campaign.sourceState }, {})).join() === "a");

  ok("the fingerprint names where every source is",
    cursorFingerprint({ ...campaign, sourceState: merged }) === "a@10+b@5");
  ok("...and changes when one source moves",
    cursorFingerprint({ ...campaign, sourceState: { ...merged, b: { ...merged.b, cursor: "6" } } }) === "a@10+b@6");
  ok("...and distinguishes ended from blocked from unread",
    cursorFingerprint({
      discoverySources: ["a", "b", "c"],
      sourceState: { a: { ended: true }, b: { blocked: "x" }, c: {} },
    }) === "a@end+b@blocked+c@0");

  ok("a campaign is finished only when every source is",
    allSourcesFinished({ discoverySources: ["a", "b"], sourceState: { a: { ended: true }, b: {} } }) === false &&
      allSourcesFinished({ discoverySources: ["a", "b"], sourceState: { a: { ended: true }, b: { blocked: "x" } } }) === true);
  ok("...and a campaign with no sources is never 'finished'", allSourcesFinished({}) === false);
  ok("a blocked source is reported by name, so 'completed' cannot hide it",
    blockedSources({ discoverySources: ["a", "b"], sourceState: { b: { blocked: "the host is gone" } } })
      .map((s) => s.key).join() === "b");
}

section("readSourceSelection / readSourceConfigs: what a request may ask for");
{
  ok("no source named is refused, with the licence sentence",
    /no default/.test(readSourceSelection({}).error || ""));
  ok("an empty array is refused too", Boolean(readSourceSelection({ discoverySources: [] }).error));
  ok("two sources are accepted", readSourceSelection({ discoverySources: ["a", "b"] }).keys.join() === "a,b");
  ok("an existing single-source caller still works",
    readSourceSelection({ discoveryProvider: "overture" }).keys.join() === "overture");

  const configs = readSourceConfigs(
    { sourceConfigs: { a: { snapshotUrl: "A" }, b: { snapshotUrl: "B" }, c: { snapshotUrl: "C" } } },
    ["a", "b"],
  );
  ok("settings are kept per source", configs.a.snapshotUrl === "A" && configs.b.snapshotUrl === "B");
  ok("settings for a source that was NOT ticked are dropped, not stored",
    !Object.prototype.hasOwnProperty.call(configs, "c"));
  ok("one ticked source and a legacy body: the single blob is honoured",
    readSourceConfigs({ providerConfig: { snapshotUrl: "OLD" } }, ["a"]).a.snapshotUrl === "OLD");
  ok("TWO ticked sources and a legacy body: the blob is refused rather than spread across both",
    Object.keys(readSourceConfigs({ providerConfig: { snapshotUrl: "OLD" } }, ["a", "b"]).a).length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. An unrunnable source cannot be started with it ticked
   ═══════════════════════════════════════════════════════════════════════════ */

section("A source that cannot run stops the campaign starting");
{
  // The SHIPPED sources, not stubs: this section is about the RBQ's real
  // refusal reaching a real superadmin.
  __resetDiscoveryProvidersForTests();
  registerDiscoveryProvider(SHIPPED.overture);
  registerDiscoveryProvider(SHIPPED.rbq);
  const getProvider = getDiscoveryProvider;

  const bothTicked = {
    discoverySources: ["overture", "rbq"],
    sourceConfigs: {
      overture: { snapshotUrl: "https://a.test/f.ndjson" },
      rbq: { snapshotUrl: "https://b.test/f.ndjson" },
    },
  };
  const problems = startProblems(bothTicked, { getProvider });
  // This read "a campaign with the RBQ ticked cannot start" until 2026-09-03.
  // It can now, and the branch that used to make it impossible has to be
  // exercised on something real or the whole section passes vacuously — so the
  // RBQ's own snapshot URL is removed below and the refusal is asserted there.
  ok("a campaign with both sources properly configured can start", problems.length === 0,
    problems.join(" | ").slice(0, 120));

  const rbqUnconfigured = startProblems(
    { discoverySources: ["overture", "rbq"], sourceConfigs: { overture: { snapshotUrl: "https://a.test/f.ndjson" } } },
    { getProvider },
  );
  ok("an RBQ with no snapshot URL still stops the campaign", rbqUnconfigured.length > 0);
  ok("...and the reason names the SOURCE, not just 'a source'",
    rbqUnconfigured.some((p) => p.startsWith("RBQ")), rbqUnconfigured[0]?.slice(0, 60));
  ok("...and it is the provider's own sentence, not a made-up one",
    rbqUnconfigured.some((p) => /snapshot URL/.test(p)));

  ok("the same campaign WITHOUT the RBQ can start",
    startProblems({ discoverySources: ["overture"], sourceConfigs: bothTicked.sourceConfigs }, { getProvider }).length === 0);
  ok("a source with no settings is refused, and named",
    startProblems({ discoverySources: ["overture"], sourceConfigs: { overture: {} } }, { getProvider })
      .some((p) => /Overture/.test(p) && /snapshot/i.test(p)));
  ok("a campaign that names nothing is refused with the no-default sentence",
    /no default/.test(startProblems({}, { getProvider }).join(" ")));
  ok("a source this build does not ship is refused by name",
    startProblems({ discoverySources: ["google"] }, { getProvider }).some((p) => /"google"/.test(p)));

  // Pinned on `unavailable` specifically, with a deliberately inconsistent
  // stub: a source that reports itself unavailable AND whose describeConfig
  // says the settings are fine. The shipped RBQ refuses on both paths, so a
  // mutation that deleted the unavailable branch was invisible — the config
  // refusal covered for it, and the day somebody lifted only the config
  // refusal the form would have gone on disabling a box the start route was
  // happy to run. The invariant asserted above is what keeps a REAL source
  // from looking like this one.
  {
    __resetDiscoveryProvidersForTests();
    registerDiscoveryProvider({
      key: "two_faced",
      label: "Two faced",
      description: "stub",
      configFields: [],
      licence: { name: "x", url: "https://x.test", obligation: "x" },
      unavailableReason: () => "this source cannot run, whatever you configure",
      describeConfig: () => ({ ok: true, problems: [], summary: "fine" }),
      fetchPage: async () => ({ release: null, businesses: [], nextCursor: null }),
    });
    ok("a source whose settings are FINE is still refused when it reports itself unavailable",
      startProblems({ discoverySources: ["two_faced"] }, { getProvider: getDiscoveryProvider })
        .some((p) => /whatever you configure/.test(p)));
    ok("...and describeSources marks it not-ok despite its own ok:true",
      describeSources({ discoverySources: ["two_faced"] }, { getProvider: getDiscoveryProvider })[0].configOk === false);
    __resetDiscoveryProvidersForTests();
    registerDiscoveryProvider(SHIPPED.overture);
    registerDiscoveryProvider(SHIPPED.rbq);
  }

  const described = describeSources(bothTicked, { getProvider });
  ok("describeSources hands the screen one entry per source, in order",
    described.map((s) => s.key).join() === "overture,rbq");
  ok("...each with its own licence, so a checkbox can render its own terms",
    described.every((s) => s.licence?.name));
  // This read "...and the unrunnable one is marked" until 2026-09-03, and the
  // unrunnable one was the RBQ. It is runnable now — a domain derived from the
  // licence email gives the crawler a page, and tradeDetect.js can establish a
  // trade from it — so the assertion is updated DELIBERATELY rather than left
  // to fall green as a side effect of the flip.
  //
  // The marking MECHANISM is what mattered here and it is still proved, on the
  // `two_faced` stub twenty lines above: a source reporting itself unavailable
  // is forced to configOk:false despite its own ok:true. That stub exists
  // precisely so the property does not depend on a shipped source happening to
  // be broken — which was always the fragile part of testing it this way.
  ok("...and both shipped sources are runnable, so neither is marked",
    described.every((s) => s.unavailable === null && s.configOk === true),
    described.map((s) => `${s.key}: unavailable=${s.unavailable} ok=${s.configOk}`).join(" | "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The pipeline, executed
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A fake database, big enough for runDiscoverBusinesses and ingestPage.
 *
 * Only the queries those two actually make. A generic Prisma emulator would be
 * a second product; this is a store that answers exactly what the shipped code
 * asks and records what it wrote, which is what makes the assertions below
 * about REAL behaviour rather than about a mock's own logic.
 */
function makeStore(campaign) {
  const campaigns = [{ ...campaign }];
  const prospects = [];
  const evidence = [];
  const tasks = [];
  let seq = 0;

  const inList = (value, cond) => (cond?.in ? cond.in.includes(value) : value === cond);

  const prospectMatches = (row, where) => {
    if (where.OR) return where.OR.some((clause) => prospectMatches(row, clause));
    for (const [field, cond] of Object.entries(where)) {
      if (cond === null) {
        if (row[field] != null) return false;
      } else if (cond && typeof cond === "object" && "not" in cond) {
        if (row[field] === cond.not) return false;
      } else if (!inList(row[field], cond)) {
        return false;
      }
    }
    return true;
  };

  const applyIncrements = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in value) row[key] = (row[key] || 0) + value.increment;
      else row[key] = value;
    }
  };

  const db = {
    prospectCampaign: {
      async findUnique({ where }) {
        const found = campaigns.find((c) => c.id === where.id);
        return found ? { ...found } : null;
      },
      async update({ where, data }) {
        const found = campaigns.find((c) => c.id === where.id);
        if (!found) throw new Error("no such campaign");
        applyIncrements(found, data);
        return { ...found };
      },
    },
    prospect: {
      async findMany({ where = {}, take }) {
        const out = prospects.filter((p) => prospectMatches(p, where));
        return (take ? out.slice(0, take) : out).map((p) => ({ ...p }));
      },
      async createMany({ data }) {
        for (const row of data) {
          if (prospects.some((p) => p.sourceProvider === row.sourceProvider && p.sourceRecordId === row.sourceRecordId)) {
            const err = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
          }
          prospects.push({ createdAt: new Date(Date.now() + ++seq), doNotContactAt: null, ...row });
        }
        return { count: data.length };
      },
      async update({ where, data }) {
        const found = prospects.find((p) => p.id === where.id);
        if (found) Object.assign(found, data);
        return found ? { ...found } : null;
      },
    },
    prospectEvidence: {
      async createMany({ data }) {
        evidence.push(...data);
        return { count: data.length };
      },
    },
    salesPipelineTask: {
      async findMany({ where = {} }) {
        return tasks
          .filter((t) => (where.kind ? t.kind === where.kind : true))
          .filter((t) => (where.prospectId?.in ? where.prospectId.in.includes(t.prospectId) : true))
          .map((t) => ({ ...t }));
      },
      // How much of the campaign's research budget has been spent. Answered by
      // the store because the shipped handler asks it — a stub that answered
      // undefined here would make an unbounded promotion pass.
      async count({ where = {} } = {}) {
        return tasks.filter(
          (t) =>
            (where.kind ? t.kind === where.kind : true) &&
            (where.campaignId ? t.campaignId === where.campaignId : true),
        ).length;
      },
      async findUnique({ where }) {
        const found = tasks.find((t) => t.idempotencyKey && t.idempotencyKey === where.idempotencyKey);
        return found ? { ...found } : null;
      },
      async create({ data }) {
        if (data.idempotencyKey && tasks.some((t) => t.idempotencyKey === data.idempotencyKey)) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `task${++seq}`, status: "queued", prospectId: null, ...data };
        tasks.push(row);
        return { ...row };
      },
    },
    // Not a real transaction: the point of these tests is what gets written,
    // not what happens on a rollback, and pretending otherwise would be a mock
    // asserting about itself.
    async $transaction(fn) {
      return fn(db);
    },
  };

  return { db, campaigns, prospects, evidence, tasks, campaign: () => campaigns[0] };
}

/** A DiscoveredBusiness a real provider could have emitted. */
function business(id, over = {}) {
  return {
    sourceRecordId: id,
    // A name the classifier calls a CONTRACTOR, so these rows travel the
    // accepted path rather than piling into needs_review — which would have
    // let every counter assertion below pass for the wrong reason.
    name: "Rivard Painting Ltd",
    categories: { primary: "painting", alternate: [] },
    taxonomyHierarchy: [],
    phones: ["(613) 795-6277"],
    websites: ["https://rivard.example"],
    emails: [],
    address: { line: "12 rue Principale", city: "Ottawa", province: "ON", postalCode: "K1A0B1", country: "CA" },
    latitude: 45.4,
    longitude: -75.7,
    operatingStatus: null,
    sourceConfidence: null,
    sourceDataset: "fixture",
    sourceUpdatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

/** A stub source. Records every call, so "it ran both" is measured. */
function stubSource(key, pages, { licence = { name: "Test", url: "https://x.test", obligation: "none" } } = {}) {
  const calls = [];
  return {
    calls,
    provider: {
      key,
      label: key.toUpperCase(),
      description: "stub",
      configFields: [{ name: "snapshotUrl", label: "Snapshot URL", required: true }],
      licence,
      describeConfig(config = {}) {
        return config?.snapshotUrl
          ? { ok: true, problems: [], summary: String(config.snapshotUrl) }
          : { ok: false, problems: [`${key} has no snapshot URL.`], summary: "No snapshot" };
      },
      async fetchPage({ cursor, config }) {
        calls.push({ cursor, snapshotUrl: config?.snapshotUrl ?? null });
        const page = pages[calls.length - 1];
        if (!page) return { release: "r1", businesses: [], nextCursor: null };
        return { release: "r1", ...page };
      },
    },
  };
}

function campaignRow(over = {}) {
  return {
    id: "camp1",
    name: "Ottawa painters",
    status: "running",
    tradeKey: "painting",
    territoryId: null,
    territory: null,
    targetCount: 500,
    foundCount: 0,
    unmappedCount: 0,
    duplicateCount: 0,
    rejectedCount: 0,
    needsReviewCount: 0,
    acceptedCount: 0,
    readyCount: 0,
    noWebsiteCount: 0,
    bankedCount: 0,
    discoverySources: [],
    sourceConfigs: null,
    sourceState: null,
    discoveryProvider: null,
    providerConfig: null,
    discoveryCursor: null,
    ...over,
  };
}

const NOW = new Date("2026-09-03T12:00:00Z");
const runTask = (store) =>
  runDiscoverBusinesses({ task: { campaignId: "camp1" }, payload: {}, now: NOW, db: store.db });

section("Two sources: BOTH run, in one task, in order");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1"), business("a2", { phones: ["613 555 0101"], websites: ["https://two.example"] })], nextCursor: "100" }]);
  const b = stubSource("beta", [{ businesses: [business("b1", { phones: ["613 555 0202"], websites: ["https://three.example"] })], nextCursor: "50" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a.ndjson" }, beta: { snapshotUrl: "https://b.test/b.ndjson" } },
    }),
  );
  const result = await runTask(store);

  ok("the task completed", result.done === true, result.reason || "");
  ok("BOTH sources were fetched — one page each", a.calls.length === 1 && b.calls.length === 1,
    `alpha ${a.calls.length}, beta ${b.calls.length}`);
  // Optional chaining, so a source that was never called FAILS this rather
  // than throwing and taking the remaining hundred assertions with it.
  ok("each was handed ITS OWN snapshot URL, not the other's",
    a.calls[0]?.snapshotUrl === "https://a.test/a.ndjson" && b.calls[0]?.snapshotUrl === "https://b.test/b.ndjson");
  ok("rows from both sources were written", store.prospects.length === 3, `${store.prospects.length} prospects`);
  ok("...and are attributed to the source they came from",
    store.prospects.filter((p) => p.sourceProvider === "alpha").length === 2 &&
      store.prospects.filter((p) => p.sourceProvider === "beta").length === 1);
  ok("the campaign's counters cover both sources", store.campaign().foundCount === 3,
    `found ${store.campaign().foundCount}`);
  ok("...and they reached the ACCEPTED line, not a review bin that would pass this for the wrong reason",
    store.campaign().acceptedCount === 3, `accepted ${store.campaign().acceptedCount}`);
  ok("each source's cursor advanced independently",
    sourceStateFor(store.campaign(), "alpha").cursor === "100" &&
      sourceStateFor(store.campaign(), "beta").cursor === "50");
  ok("ONE next task was queued for the campaign, not one per source",
    store.tasks.filter((t) => t.kind === "DISCOVER_BUSINESSES").length === 1);
  ok("...keyed on where BOTH sources got to",
    store.tasks.find((t) => t.kind === "DISCOVER_BUSINESSES")?.idempotencyKey === "discover:camp1:alpha@100+beta@50");
  ok("the note names both sources' outcomes", /alpha:/.test(result.note) && /beta:/.test(result.note), result.note);
  ok("the discovery task no longer names one vendor for its rate-limit budget",
    store.tasks.find((t) => t.kind === "DISCOVER_BUSINESSES")?.payload?.provider === undefined);

  // Re-running the same task queues the same next task once, because the
  // fingerprint is the key.
  const before = store.tasks.length;
  await runTask(store);
  ok("a second identical page does not queue a second next task",
    store.tasks.filter((t) => t.kind === "DISCOVER_BUSINESSES").length <= before);
}

section("The same business from two sources: FLAGGED, never merged");
{
  __resetDiscoveryProvidersForTests();
  // One painter, one phone number, spelled differently, two record ids, two
  // sources. `matchExisting` keys on (provider, recordId) first, which cannot
  // match across sources — so this is the fuzzy tail, and the fuzzy tail
  // flags.
  const a = stubSource("alpha", [{ businesses: [business("a1", { phones: ["(613) 795-6277"] })], nextCursor: null }]);
  const b = stubSource("beta", [{ businesses: [business("b1", { phones: ["6137956277"], websites: [] })], nextCursor: null }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: { snapshotUrl: "https://b.test/b" } },
    }),
  );
  await runTask(store);

  ok("both rows are written — merging destroys provenance and cannot be undone",
    store.prospects.length === 2, `${store.prospects.length} prospects`);
  const second = store.prospects.find((p) => p.sourceProvider === "beta");
  const first = store.prospects.find((p) => p.sourceProvider === "alpha");
  ok("the second source's row is FLAGGED as a possible duplicate of the first",
    second?.possibleDuplicateOfId === first?.id, String(second?.possibleDuplicateOfId));
  ok("...which is only possible because the sources ran one after another — the flag is a DB lookup",
    first?.id !== undefined && second?.possibleDuplicateOfId !== null);
  ok("foundCount counts SOURCE ROWS: one business listed twice is two rows",
    store.campaign().foundCount === 2, `found ${store.campaign().foundCount}`);
  ok("...and the funnel row says so in words, so the number is not read as businesses",
    /two sources is two rows/.test(funnelRows(store.campaign()).find((r) => r.key === "found").note));
  ok("neither row was counted as a removed duplicate — that line means the same record twice",
    store.campaign().duplicateCount === 0);
}

section("One source fails: the other CONTINUES, and nothing is silent");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1")], nextCursor: "100" }]);
  const b = stubSource("beta", [{ businesses: [], nextCursor: null, error: "the snapshot URL answered 502" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: { snapshotUrl: "https://b.test/b" } },
    }),
  );
  const result = await runTask(store);

  ok("the healthy source still ingested its page", store.prospects.length === 1);
  ok("the healthy source's cursor advanced", sourceStateFor(store.campaign(), "alpha").cursor === "100");
  const beta = sourceStateFor(store.campaign(), "beta");
  ok("the failing source's cursor did NOT advance, so its page is not lost", beta.cursor === null);
  ok("...its failure was counted", beta.failures === 1);
  ok("...and the reason was recorded on the campaign, where a human reads it",
    beta.lastError === "the snapshot URL answered 502" && Boolean(beta.lastErrorAt));
  ok("...and it is NOT blocked after one failure", beta.blocked === null);
  ok("the task reports done, so one flaky host does not burn the healthy source's retry ladder",
    result.done === true);
  ok("...and the note names the failure, which the runner writes into the task's lastError",
    /FAILED beta/.test(result.note), result.note);
  ok("the campaign is still running — a source in trouble cannot let it report itself finished",
    store.campaign().status === "running");
}

section("Every source fails: the whole page is retryable, exactly as with one source");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [], nextCursor: null, error: "alpha host down" }]);
  const b = stubSource("beta", [{ businesses: [], nextCursor: null, error: "beta host down" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: { snapshotUrl: "https://b.test/b" } },
    }),
  );
  const result = await runTask(store);
  ok("nothing ran, so the task asks to be retried", result.done === false && result.retry === true);
  ok("...and the reason names both sources", /alpha host down/.test(result.reason) && /beta host down/.test(result.reason));
  ok("both failures were recorded on the campaign anyway",
    sourceStateFor(store.campaign(), "alpha").failures === 1 && sourceStateFor(store.campaign(), "beta").failures === 1);
  ok("no next task was queued for a page that did nothing",
    store.tasks.filter((t) => t.kind === "DISCOVER_BUSINESSES").length === 0);
}

section("A source that keeps failing is BLOCKED, and a blocked source is not an ending");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1")], nextCursor: null }]);
  const b = stubSource("beta", [{ businesses: [], nextCursor: null, error: "gone for good" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: { snapshotUrl: "https://b.test/b" } },
      sourceState: { beta: { ...EMPTY_SOURCE_STATE, failures: MAX_SOURCE_FAILURES - 1 } },
    }),
  );
  await runTask(store);

  const beta = sourceStateFor(store.campaign(), "beta");
  ok(`the ${MAX_SOURCE_FAILURES}th consecutive failure blocks the source`, Boolean(beta.blocked), String(beta.blocked));
  ok("...with the transport error in the sentence, not a generic one", /gone for good/.test(beta.blocked || ""));
  ok("a blocked source is reported by name so 'completed' cannot hide it",
    blockedSources(store.campaign()).map((s) => s.key).join() === "beta");
  ok("the campaign may now finish, because a blocked source will not be attempted again",
    store.campaign().status === "completed", store.campaign().status);
  ok("...and the alpha source is recorded as having ENDED, which is a different state",
    sourceStateFor(store.campaign(), "alpha").ended === true &&
      sourceStateFor(store.campaign(), "alpha").blocked === null);

  // And it is not attempted again.
  const callsBefore = b.calls.length;
  store.campaign().status = "running";
  await runTask(store);
  ok("a blocked source is not fetched again", b.calls.length === callsBefore);
}

section("A source whose settings are broken is blocked at once, not after five identical failures");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1")], nextCursor: "10" }]);
  const b = stubSource("beta", [{ businesses: [business("b1")], nextCursor: "10" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      // beta has no snapshotUrl at all.
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: {} },
    }),
  );
  await runTask(store);

  const beta = sourceStateFor(store.campaign(), "beta");
  ok("the misconfigured source is blocked on the FIRST page", Boolean(beta.blocked));
  ok("...with its own describeConfig sentence", /no snapshot URL/.test(beta.blocked || ""));
  ok("...and was never fetched", b.calls.length === 0);
  ok("...while its failure counter was not run up to five for a problem time cannot fix", beta.failures === 0);
  ok("the other source ran normally", store.prospects.length === 1);
}

section("A source this build no longer ships is blocked by NAME");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1")], nextCursor: "10" }]);
  registerDiscoveryProvider(a.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "vanished"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" } },
    }),
  );
  await runTask(store);
  ok("the missing source is blocked, naming the key the campaign actually holds",
    /"vanished"/.test(sourceStateFor(store.campaign(), "vanished").blocked || ""));
  ok("the source that does exist still ran", store.prospects.length === 1);
}

section("An existing SINGLE-source campaign still works after the schema change");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("overture_like", [{ businesses: [business("o1")], nextCursor: "1300" }]);
  registerDiscoveryProvider(a.provider);

  // Exactly the row shape a campaign created before this change has: the
  // plural columns are empty, the singular three carry everything.
  const store = makeStore(
    campaignRow({
      discoverySources: [],
      sourceConfigs: null,
      sourceState: null,
      discoveryProvider: "overture_like",
      providerConfig: { snapshotUrl: "https://old.test/f.ndjson" },
      discoveryCursor: "1200",
    }),
  );
  const result = await runTask(store);

  ok("it ran", result.done === true, result.reason || "");
  ok("the legacy source was fetched", a.calls.length === 1);
  ok("...from where it had got to, not from the beginning", a.calls[0].cursor === "1200");
  ok("...with the legacy config blob", a.calls[0].snapshotUrl === "https://old.test/f.ndjson");
  ok("its page was ingested", store.prospects.length === 1);
  ok("the new per-source state was written for that source",
    sourceStateFor(store.campaign(), "overture_like").cursor === "1300");
  ok("the legacy columns were not overwritten — nothing writes them any more",
    store.campaign().discoveryProvider === "overture_like" &&
      store.campaign().providerConfig?.snapshotUrl === "https://old.test/f.ndjson" &&
      store.campaign().discoveryCursor === "1200");
}

section("A campaign that names nothing refuses to run, rather than discovering a default");
{
  __resetDiscoveryProvidersForTests();
  const store = makeStore(campaignRow({ discoverySources: [] }));
  const result = await runTask(store);
  ok("it does not run", result.done === false);
  ok("...and it is TERMINAL, because no amount of waiting picks a source", result.retry === false);
  ok("...and the sentence says there is deliberately no default", /no default/.test(result.reason));
}

section("Every source ending finishes the campaign; one still open does not");
{
  __resetDiscoveryProvidersForTests();
  const a = stubSource("alpha", [{ businesses: [business("a1")], nextCursor: null }]);
  const b = stubSource("beta", [{ businesses: [business("b1", { phones: ["613 555 9999"], websites: [] })], nextCursor: "20" }]);
  registerDiscoveryProvider(a.provider);
  registerDiscoveryProvider(b.provider);

  const store = makeStore(
    campaignRow({
      discoverySources: ["alpha", "beta"],
      sourceConfigs: { alpha: { snapshotUrl: "https://a.test/a" }, beta: { snapshotUrl: "https://b.test/b" } },
    }),
  );
  await runTask(store);
  ok("one source running out does NOT complete the campaign — the other is still reading",
    store.campaign().status === "running" && sourceStateFor(store.campaign(), "alpha").ended === true);
  ok("...and the next task is queued, so the surviving source keeps going",
    store.tasks.filter((t) => t.kind === "DISCOVER_BUSINESSES").length === 1);

  const callsBefore = a.calls.length;
  await runTask(store);
  ok("the ended source is not fetched again", a.calls.length === callsBefore);
  ok("...and once the last source ends, the campaign completes", store.campaign().status === "completed");
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. What the screens render, on comment-stripped source
   ═══════════════════════════════════════════════════════════════════════════ */

section("The create form: checkboxes, no default, every licence on screen");
{
  const list = read("app/platform/sales/campaigns/page.js");

  ok("the source control is a set of CHECKBOXES", /type="checkbox"/.test(list));
  ok("...and not the single-select it replaced",
    !/id="c-provider"/.test(list) && !/draft\.discoveryProvider/.test(list));
  ok("nothing is ticked by default — choosing a source is choosing a licence",
    /discoverySources: \[\]/.test(list) && !/defaultChecked/.test(list));
  // `\s+` between the words: this is JSX prose, wrapped by the formatter, so a
  // rule written against one line would start failing the day the sentence
  // moved a word — and would be "fixed" by deleting the rule.
  ok("the no-default reasoning survived the change, in the words the owner gave it",
    /Choosing\s+a\s+source\s+is\s+choosing\s+a\s+licence/.test(list) &&
      /forbid\s+this\s+exact\s+use/.test(list));
  ok("EVERY checkbox renders its licence name and its obligation",
    /licence\.name/.test(list) && /licence\.obligation/.test(list));
  ok("...and the attribution notice when the licence requires one",
    /licence\.attribution/.test(list));
  ok("a source that cannot run is DISABLED, not tickable",
    /disabled=\{blocked\}/.test(list));
  ok("...with the reason rendered beside it", /\{p\.unavailable\}/.test(list));
  // The field is READ from its own source's slot, not from a flat object. A
  // flat read renders — and then submits — one source's snapshot URL under
  // every source's name, which is the exact collision the keying exists for
  // and is invisible on screen because both fields are called "Snapshot URL".
  ok("settings are held per source, so two `snapshotUrl` fields cannot collide",
    /sourceConfigs/.test(list) && !/providerConfig:/.test(list));
  ok("...and each field READS its own source's slot",
    /draft\.sourceConfigs\?\.\[p\.key\]\?\.\[field\.name\]/.test(list));
  ok("...and WRITES back into its own source's slot",
    /\[p\.key\]: \{ \.\.\.\(draft\.sourceConfigs\?\.\[p\.key\] \|\| \{\}\), \[field\.name\]:/.test(list));
  ok("the config fields appear only for a source that is ticked",
    /ticked && !blocked &&/.test(list));
  ok("the checkbox row meets the 44px touch floor this file is held to",
    /min-h-\[44px\]/.test(list));
}

section("The campaign screen and its routes speak per source");
{
  const detail = read("app/platform/sales/campaigns/[id]/page.js");
  const listRoute = read("app/api/platform/sales/campaigns/route.js");
  const detailRoute = read("app/api/platform/sales/campaigns/[id]/route.js");

  ok("the detail screen renders one card per source", /sources\.map\(\(source\)/.test(detail));
  ok("...each with that source's own licence", /source\.licence/.test(detail));
  ok("...each with that source's own position, distinguishing blocked from ended",
    /state\.blocked/.test(detail) && /state\.ended/.test(detail));
  ok("saving settings names WHICH source", /sourceKey: source\.key/.test(detail));
  ok("Start is hidden when any source cannot run", /startProblems\.length \? null : \(/.test(detail));

  ok("the create route refuses a campaign with no source", /readSourceSelection/.test(listRoute));
  ok("...refuses one whose source cannot run at all", /unavailableReasonOf/.test(listRoute));
  ok("...and stores the sources and their per-source settings",
    /discoverySources: selection\.keys/.test(listRoute) && /sourceConfigs,/.test(listRoute));
  ok("...and records which LICENCES were accepted, at the moment they were",
    /licences:/.test(listRoute));
  ok("the create route no longer writes the single-source columns",
    !/discoveryProvider: /.test(listRoute) && !/providerConfig,/.test(listRoute));

  ok("the start action asks about every source, not one", /startProblems\(campaign/.test(detailRoute));
  ok("configure names the source it is configuring", /body\?\.sourceKey/.test(detailRoute));
  ok("...and refuses a source this campaign does not draw from",
    /campaignSourceKeys\(campaign\)\.includes\(sourceKey\)/.test(detailRoute));
  ok("...and clears a block, because fixing the settings is the only thing that can",
    /blocked: null/.test(detailRoute));
  ok("the detail route never returns a source's stored settings",
    /sourceConfigs: undefined/.test(detailRoute) && /providerConfig: undefined/.test(detailRoute));
}

section("The schema carries the set, and keeps what the old rows hold");
{
  const schema = raw("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model ProspectCampaign"), schema.indexOf("model SalesPipelineTask"));

  ok("discoverySources is a list with an EMPTY default, not a chosen one",
    /discoverySources\s+String\[\]\s+@default\(\[\]\)/.test(model));
  ok("sourceConfigs is a JSON column", /sourceConfigs\s+Json\?/.test(model));
  ok("sourceState is a JSON column", /sourceState\s+Json\?/.test(model));
  ok("the three single-source columns are KEPT, so existing rows keep their source",
    /discoveryProvider\s+String\?/.test(model) &&
      /providerConfig\s+Json\?/.test(model) &&
      /discoveryCursor\s+String\?/.test(model));
  ok("no discovery source has a default anywhere in the model", !/discoverySources[^\n]*@default\(\["/.test(model));

  // Written and read, in more than one place. AGENTS.md's first recurring
  // failure class, applied to the columns this change adds.
  const files = walk(path.join(ROOT, "lib")).concat(walk(path.join(ROOT, "app"))).concat(walk(path.join(ROOT, "scripts")));
  const readers = files
    .filter((f) => !f.endsWith("schema.prisma"))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  for (const field of ["discoverySources", "sourceConfigs", "sourceState"]) {
    const uses = (readers.match(new RegExp(`\\b${field}\\b`, "g")) || []).length;
    ok(`${field} is used in more than one place`, uses >= 2, `${uses} use(s)`);
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

__resetDiscoveryProvidersForTests();

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
