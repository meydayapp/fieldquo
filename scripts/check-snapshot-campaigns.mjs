// scripts/check-snapshot-campaigns.mjs
//
// The campaign form asks for a region and a trade. It must never again ask for
// a URL, a country code or a coordinate — and the numbers it shows before the
// button is pressed have to be the numbers the campaign then reads.
//
//   npm run check:snapshot-campaigns
//
// ══ What this proves, and why each one is here ═════════════════════════════
//
//   1. The snapshot URL is DERIVED from the configured base plus a library
//      object key, and cannot be typed anywhere — not on the create form, not
//      on the campaign screen, not through either route. A typed URL is how a
//      campaign ends up pointed at a file that is not there, and that does not
//      fail: it runs, reads nothing, and reports itself complete.
//   2. A URL that does not resolve REFUSES THE SAVE. Every failure the probe
//      can meet is driven with a stub fetch: a 404, an index page, another
//      bucket's file, the wrong release.
//   3. A territory in a jurisdiction FieldQuo is not registered to solicit in
//      produces a campaign that CANNOT BE STARTED. Mutation-tested: the same
//      territory against a table whose `registration.done` is flipped must come
//      back startable, or the gate is not reading the flag it claims to.
//   4. The registration list is read from lib/sales/callingRules.js and is not
//      a second copy. There WAS a second copy — a hand-kept GATED_US set in the
//      creation script somebody ran from a laptop — and it had already drifted
//      from the rules: it named eight states, five of which do not require
//      registration at all, and it missed five that do.
//   5. The row count on the form is the library's own, and "not known" is never
//      printed as a zero. The RBQ register names no trade for anybody, so its
//      54,275 Quebec rows must be reported as uncounted rather than as no
//      painters.
//   6. Country and region come from the data's own coverage, so a region with
//      no file behind it can never be offered.
//
// ══ Two traps this file is written against ════════════════════════════════
//
//   `ok(label, condition)` — LABEL FIRST. Condition-first makes a non-empty
//   string the condition and every assertion in the file unfailable. Asserted
//   on `ok` itself below.
//
//   Source is read COMMENT-STRIPPED. Every file in this feature has a header
//   that describes, word for word, the behaviour being forbidden — so a raw
//   regex for "snapshotUrl" matches the paragraph explaining why nobody types
//   one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CALLING_JURISDICTIONS, jurisdictionKey } from "@/lib/sales/callingRules";
import {
  SNAPSHOT_FILES,
  SNAPSHOT_REGION_CENTRES,
  campaignNameForFile,
  normaliseSnapshotBase,
  regionCode,
  rowsByJurisdiction,
  snapshotCountries,
  snapshotFileFor,
  snapshotFileForUrl,
  snapshotProviderKeys,
  snapshotRegions,
  snapshotSelection,
  snapshotUrlFor,
  tradeRowsFor,
} from "@/lib/sales/discovery/snapshotLibrary";
import { probeSnapshot } from "@/lib/sales/discovery/snapshotProbe";
import {
  campaignCanStart,
  campaignStartBlockers,
  outstandingRegistrations,
  territoryRegistration,
} from "@/lib/sales/discovery/campaignGate";
import { probeTarget, librarySummary } from "@/lib/sales/discovery/snapshotSetting";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
let failures = 0;

function section(title) {
  console.log(`\n${title}\n`);
}

/** Label FIRST. See the header. */
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
  return pass;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(rel) {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** A Response-alike for the probe. Body is a stream, like the real one. */
function stubResponse({ status = 200, body = "" } = {}) {
  const bytes = new TextEncoder().encode(body);
  let sent = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: bytes };
          },
          async cancel() {},
        };
      },
    },
  };
}

const CREATE_ROUTE = "app/api/platform/sales/campaigns/route.js";
const DETAIL_ROUTE = "app/api/platform/sales/campaigns/[id]/route.js";
const FORM_PAGE = "app/platform/sales/campaigns/page.js";
const DETAIL_PAGE = "app/platform/sales/campaigns/[id]/page.js";
const SETTING_ROUTE = "app/api/platform/sales/snapshots/route.js";
const SETTING_PAGE = "app/platform/sales/snapshots/page.js";

/* ═══════════════════════════════════════════════════════════════════════════
   0. The harness itself
   ═══════════════════════════════════════════════════════════════════════════ */

section("The harness cannot manufacture a pass");
{
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
    const moved = { failures: failures - beforeFailures };
    checks = beforeChecks;
    failures = beforeFailures;
    return moved;
  };
  ok("a FALSE condition in the second argument fails", probe(() => ok("a non-empty label", false)).failures === 1);
  ok("...and a true one passes", probe(() => ok("a label", true)).failures === 0);
  ok(
    "source is read comment-stripped",
    !read(FORM_PAGE).includes("where the fuck do I get the snapshot URL"),
    "(the owner's words are in that file's header)",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The library is data that was measured, not typed
   ═══════════════════════════════════════════════════════════════════════════ */

section("The library describes real files");
{
  ok("there are files at all", SNAPSHOT_FILES.length > 0, `(${SNAPSHOT_FILES.length})`);

  const badRows = SNAPSHOT_FILES.filter((f) => !Number.isInteger(f.rows) || f.rows <= 0);
  ok("every file has a whole, positive row count", badRows.length === 0, badRows.map((f) => f.objectKey).join(", "));

  const badKeys = SNAPSHOT_FILES.filter((f) => !/^[a-z]+\/[A-Za-z0-9._-]+\.ndjson$/.test(f.objectKey));
  ok("every object key is prefix/file.ndjson", badKeys.length === 0, badKeys.map((f) => f.objectKey).join(", "));

  const duplicates = SNAPSHOT_FILES.map((f) => f.objectKey).filter((k, i, all) => all.indexOf(k) !== i);
  ok("no object key appears twice", duplicates.length === 0, duplicates.join(", "));

  const noProvider = SNAPSHOT_FILES.filter((f) => !f.provider || !f.country || !f.province);
  ok("every file names a provider, a country and a region", noProvider.length === 0);

  // A trade count that exceeds the file's own row count is arithmetic that
  // cannot be true, and it is exactly what a hand-edited data file would show.
  const overcounted = SNAPSHOT_FILES.filter(
    (f) => Object.values(f.trades || {}).reduce((a, b) => a + b, 0) + f.unmappedRows !== f.rows,
  );
  ok(
    "trade tallies plus unmapped rows equal the file's row count, exactly",
    overcounted.length === 0,
    overcounted.map((f) => f.objectKey).join(", "),
  );

  // Every region has a MEASURED centre. Not a capital city looked up from
  // memory — the median of that region's own rows — which is the only reason
  // the form may prefill a coordinate at all.
  const regions = [...new Set(SNAPSHOT_FILES.map((f) => regionCode(f.country, f.province)))];
  const missingCentre = regions.filter((code) => !SNAPSHOT_REGION_CENTRES[code]);
  ok("every region has a centre", missingCentre.length === 0, missingCentre.join(", "));
  const badCentre = regions.filter((code) => {
    const c = SNAPSHOT_REGION_CENTRES[code];
    return !c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon) || Math.abs(c.lat) > 90 || Math.abs(c.lon) > 180;
  });
  ok("every centre is a point on Earth", badCentre.length === 0, badCentre.join(", "));
  const noSample = regions.filter((code) => !(SNAPSHOT_REGION_CENTRES[code]?.fromRows > 0));
  ok("every centre was measured from at least one row", noSample.length === 0, noSample.join(", "));

  ok(
    "the generator that produces this data is in the repo",
    fs.existsSync(path.join(ROOT, "scripts/build-snapshot-library.mjs")),
  );
  ok(
    "…and the data file says it is generated",
    /GENERATED/.test(fs.readFileSync(path.join(ROOT, "lib/sales/discovery/snapshotLibraryData.js"), "utf8")),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. The URL is DERIVED. Nobody types one.
   ═══════════════════════════════════════════════════════════════════════════ */

section("A snapshot URL is base + object key, and nothing else builds one");
{
  const file = SNAPSHOT_FILES[0];
  ok(
    "a base and a key make one URL",
    snapshotUrlFor("https://pub-x.r2.dev", file.objectKey) === `https://pub-x.r2.dev/${file.objectKey}`,
  );
  ok(
    "a trailing slash does not double",
    snapshotUrlFor("https://pub-x.r2.dev/", file.objectKey) === `https://pub-x.r2.dev/${file.objectKey}`,
  );
  ok(
    "several trailing slashes do not double",
    snapshotUrlFor("https://pub-x.r2.dev///", file.objectKey) === `https://pub-x.r2.dev/${file.objectKey}`,
  );
  ok(
    "a base with a path keeps it",
    snapshotUrlFor("https://files.example.com/snapshots", file.objectKey) ===
      `https://files.example.com/snapshots/${file.objectKey}`,
  );
  ok("no base means no URL, never a relative one", snapshotUrlFor("", file.objectKey) === null);
  ok("no key means no URL", snapshotUrlFor("https://pub-x.r2.dev", "") === null);
  ok("an s3:// base is refused", snapshotUrlFor("s3://fieldquo-lead-storage", file.objectKey) === null);
  ok("nonsense is refused", snapshotUrlFor("not a url", file.objectKey) === null);
  ok("a signed base is refused", normaliseSnapshotBase("https://pub-x.r2.dev?sig=abc").error !== null);
  ok("a fragment is refused", normaliseSnapshotBase("https://pub-x.r2.dev#x").error !== null);
  ok("an empty base names what to paste", /paste/i.test(normaliseSnapshotBase("").error || ""));

  // Round trip: the URL a campaign stores can be matched back to the library
  // row it came from, which is what lets a base URL change be applied to a
  // campaign created before the base URL was a setting.
  const url = snapshotUrlFor("https://pub-x.r2.dev", file.objectKey);
  ok("a derived URL matches back to its library row", snapshotFileForUrl(url)?.objectKey === file.objectKey);
  ok("a URL from another bucket still matches on the key", snapshotFileForUrl(`https://other.example/${file.objectKey}`)?.objectKey === file.objectKey);
  ok("a URL for a file we do not ship matches nothing", snapshotFileForUrl("https://pub-x.r2.dev/overture/nope.ndjson") === null);
  ok("garbage matches nothing", snapshotFileForUrl("::::") === null);
  ok("a known key resolves", snapshotFileFor(file.objectKey)?.objectKey === file.objectKey);
  ok("an unknown key resolves to null", snapshotFileFor("overture/nope.ndjson") === null);
}

section("No surface accepts a typed snapshot URL");
{
  const createRoute = read(CREATE_ROUTE);
  const detailRoute = read(DETAIL_ROUTE);
  const form = read(FORM_PAGE);
  const detailPage = read(DETAIL_PAGE);

  ok(
    "the create route builds the config with snapshotUrlFor",
    /snapshotUrlFor\(\s*library\.baseUrl/.test(createRoute),
  );
  ok(
    "the create route does not read sourceConfigs off the request",
    !/body\??\.?\??\.sourceConfigs/.test(createRoute) && !/readSourceConfigs/.test(createRoute),
  );
  ok(
    "the create route refuses to build anything without the configured base",
    /library\.configured/.test(createRoute) && /platform\/sales\/snapshots/.test(createRoute),
  );
  ok(
    "the detail route refuses a typed snapshot URL rather than ignoring it",
    /providerConfig\?\.snapshotUrl/.test(detailRoute) && /not typed any more/i.test(detailRoute),
  );
  ok(
    "the detail route re-derives the URL from the library",
    /snapshotUrlFor\(\s*library\.baseUrl/.test(detailRoute),
  );

  // The forms. A `configFields` loop is what rendered the "Snapshot URL
  // (required)" box the owner hit, so its absence is the property, not the
  // absence of the word "snapshot".
  ok("the create form renders no provider config inputs", !/configFields/.test(form));
  ok("the create form has no snapshotUrl input", !/snapshotUrl/.test(form));
  ok("the campaign screen renders no provider config inputs", !/configFields/.test(detailPage));
  ok("the campaign screen has no snapshotUrl input", !/snapshotUrl/.test(detailPage));
  ok(
    "the campaign screen's configure call sends only the source key",
    /act\("configure",\s*\{\s*sourceKey:\s*source\.key\s*\}\)/.test(detailPage),
  );

  // Exactly one screen asks for a URL, and it is the setting.
  ok("the setting screen is the only place a URL is typed", /baseUrl/.test(read(SETTING_PAGE)));
  ok("the setting route normalises what it is given", /normaliseSnapshotBase/.test(read(SETTING_ROUTE)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. A URL that does not resolve refuses the save
   ═══════════════════════════════════════════════════════════════════════════ */

section("Saving refuses a URL that does not resolve");
{
  const file = SNAPSHOT_FILES.find((f) => f.provider === "overture");
  const goodHeader = JSON.stringify({ fieldquoSnapshot: 1, provider: file.provider, release: file.release, count: file.rows });

  const good = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ body: `${goodHeader}\n{"id":"1"}\n` }),
  });
  ok("a real header is accepted", good.ok === true && good.header?.provider === file.provider);

  const missing = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ status: 404, body: "not found" }),
  });
  ok("a 404 is refused", missing.ok === false && /404/.test(missing.problem));

  const indexPage = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ body: "<!doctype html><html>bucket index</html>" }),
  });
  ok("an HTML index page is refused", indexPage.ok === false && /not a snapshot header/.test(indexPage.problem));

  const otherFormat = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ body: `{"hello":"world"}\n` }),
  });
  ok("JSON that is not a snapshot header is refused", otherFormat.ok === false);

  const wrongProvider = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () =>
      stubResponse({ body: `${JSON.stringify({ fieldquoSnapshot: 1, provider: "rbq", release: file.release })}\n` }),
  });
  ok(
    "another provider's file under the right key is refused",
    wrongProvider.ok === false && /different bucket/.test(wrongProvider.problem),
  );

  const wrongRelease = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () =>
      stubResponse({ body: `${JSON.stringify({ fieldquoSnapshot: 1, provider: file.provider, release: "1999-01-01" })}\n` }),
  });
  ok("a file from a different release is refused", wrongRelease.ok === false && /release/.test(wrongRelease.problem));

  const exploded = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    },
  });
  ok("a dead host is refused, with the reason", exploded.ok === false && /ENOTFOUND/.test(exploded.problem));

  const empty = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ body: "" }),
  });
  ok("an empty body is refused", empty.ok === false);

  ok("no URL at all is refused", (await probeSnapshot("", file)).ok === false);

  // A part's header carries the whole region's count — the splitter copied it
  // verbatim — so a count comparison would fail on a file that is perfectly
  // correct. Proved, because "verify the count" is the obvious next edit.
  const partHeader = JSON.stringify({ fieldquoSnapshot: 1, provider: file.provider, release: file.release, count: 999999 });
  const partOk = await probeSnapshot("https://pub-x.r2.dev/x.ndjson", file, {
    fetchImpl: async () => stubResponse({ body: `${partHeader}\n` }),
  });
  ok("a header count that disagrees with the library does not fail the probe", partOk.ok === true);

  // The routes must actually CALL it before writing.
  const createRoute = read(CREATE_ROUTE);
  ok("the create route probes every file before the transaction", /probeSnapshot\(/.test(createRoute));
  ok(
    "…and returns without saving when one fails",
    /if\s*\(problems\.length\)[\s\S]{0,400}status:\s*400/.test(createRoute),
  );
  ok(
    "…and the probe happens before db.\\$transaction",
    createRoute.indexOf("probeSnapshot(") < createRoute.indexOf("db.$transaction"),
  );
  ok("the setting route probes before it upserts", read(SETTING_ROUTE).indexOf("probeSnapshot(") < read(SETTING_ROUTE).indexOf("upsert"));
  ok("the setting route proves against the smallest file", probeTarget().rows === Math.min(...SNAPSHOT_FILES.map((f) => f.rows)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The cannot-dial pin
   ═══════════════════════════════════════════════════════════════════════════ */

section("A territory in an unregistered jurisdiction cannot start");
{
  // Washington: RCW 19.158.050 registration, not done. The single biggest US
  // register in the bucket after California.
  const wa = { country: "US", province: "WA" };
  ok("Washington is blocked", campaignStartBlockers(wa).length === 1);
  ok("…for the registration, by code", campaignStartBlockers(wa)[0].code === "registration_outstanding");
  ok("…and campaignCanStart agrees", campaignCanStart(wa) === false);
  ok("…and the reason names the state", /Washington/.test(campaignStartBlockers(wa)[0].title));

  // Florida: read, verified, no registration required. If this were also
  // blocked the gate would be refusing everything and proving nothing.
  const fl = { country: "US", province: "FL" };
  ok("Florida is not blocked", campaignStartBlockers(fl).length === 0);
  ok("Canada is not blocked — its registration was filed", campaignStartBlockers({ country: "CA", province: "QC" }).length === 0);

  // California: 226,172 licences, and its row carries no registration
  // requirement at all. Stated because the brief for this work asserted the
  // opposite, and a gate that blocked it would strand the largest US source
  // behind a filing nobody has to make.
  ok("California is not blocked", campaignStartBlockers({ country: "US", province: "CA" }).length === 0);
  ok("…because its row requires no registration", territoryRegistration({ country: "US", province: "CA" })?.required === false);

  ok("no territory at all is blocked", campaignStartBlockers(null)[0].code === "no_territory");
  ok(
    "an unread jurisdiction is NOT blocked here — the dial gate refuses those on its own",
    campaignStartBlockers({ country: "US", province: "PR" }).length === 0 &&
      territoryRegistration({ country: "US", province: "PR" }) === null,
  );

  // ── MUTATION: flip the flag, the answer must flip ─────────────────────
  //
  // Without this the checks above pass against a gate that returns a constant.
  const flipped = {
    ...CALLING_JURISDICTIONS,
    "US-WA": {
      ...CALLING_JURISDICTIONS["US-WA"],
      registration: { ...CALLING_JURISDICTIONS["US-WA"].registration, done: true },
    },
  };
  ok(
    "with registration.done flipped to true, Washington becomes startable",
    campaignStartBlockers(wa, { jurisdictions: flipped }).length === 0,
  );
  const dropped = {
    ...CALLING_JURISDICTIONS,
    "US-WA": { ...CALLING_JURISDICTIONS["US-WA"], registration: null },
  };
  ok(
    "with the registration removed entirely, Washington becomes startable",
    campaignStartBlockers(wa, { jurisdictions: dropped }).length === 0,
  );
  const notRequired = {
    ...CALLING_JURISDICTIONS,
    "US-WA": {
      ...CALLING_JURISDICTIONS["US-WA"],
      registration: { ...CALLING_JURISDICTIONS["US-WA"].registration, required: false },
    },
  };
  ok(
    "with required flipped to false, Washington becomes startable",
    campaignStartBlockers(wa, { jurisdictions: notRequired }).length === 0,
  );
  // …and the reverse, so the gate is not simply reading `done`.
  const brokenFlorida = {
    ...CALLING_JURISDICTIONS,
    "US-FL": {
      ...CALLING_JURISDICTIONS["US-FL"],
      registration: { required: true, done: false, what: "a hypothetical filing" },
    },
  };
  ok(
    "a state that gains a registration requirement becomes blocked",
    campaignStartBlockers(fl, { jurisdictions: brokenFlorida }).length === 1,
  );
}

section("The start route is where the pin actually is");
{
  const detailRoute = read(DETAIL_ROUTE);
  // Inside the START branch specifically. The same call also appears in the
  // GET, so a file-wide regex would keep passing after the one on the button
  // was deleted — which is exactly the edit this assertion exists to catch.
  const startBranch = detailRoute.slice(
    detailRoute.indexOf('action === "start"'),
    detailRoute.indexOf('action === "pause"'),
  );
  ok("the start branch exists to look at", startBranch.length > 200);
  ok("the start branch calls the gate", /campaignStartBlockers\(campaign\.territory/.test(startBranch));
  // …with the certificates FieldQuo actually holds laid over the law file.
  // The gate defaults to the shipped table, so a start branch that called it
  // with no options would go on refusing a state we ARE registered in — and,
  // worse, the same omission on a future gate that defaulted the other way
  // would open one we are not.
  ok(
    "…against the registrations actually held, not the law file alone",
    /campaignStartBlockers\(campaign\.territory, \{ jurisdictions \}\)/.test(startBranch) &&
      /const jurisdictions = await liveJurisdictions\(\)/.test(startBranch),
  );
  ok(
    "…on the campaign's territory, loaded with it",
    /findUnique\(\{\s*where:\s*\{\s*id\s*\},\s*include:\s*\{\s*territory:\s*true\s*\}\s*\}\)/.test(detailRoute),
  );
  ok(
    "…and its blockers join the source problems rather than replacing them",
    /problems\.push\(`\$\{blocker\.title\}/.test(detailRoute),
  );
  ok("the GET surfaces the same gate, so the screen and the route agree", /startProblems:\s*\[/.test(detailRoute));
  ok("a campaign is created as a draft", /status:\s*"draft"/.test(read(CREATE_ROUTE)));
  ok("the create route never sets a campaign running", !/status:\s*"running"/.test(read(CREATE_ROUTE)));
  ok("the form states the registration position on the region", /registration outstanding/.test(read(FORM_PAGE)));
  // The campaign screen READS what the route returns. A field a route sends and
  // no screen renders is AGENTS.md's first failure class, and this one is the
  // difference between a draft nobody started and a draft that cannot be.
  ok("the campaign screen renders the registration the route returns", /data\.registration/.test(read(DETAIL_PAGE)));
  ok("…including the unread-jurisdiction case, which is not the same as \"registered\"",
    /telephone solicitation law/.test(read(DETAIL_PAGE)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The registration list is the calling rules, not a copy of them
   ═══════════════════════════════════════════════════════════════════════════ */

section("The registration backlog is read from callingRules");
{
  const rows = rowsByJurisdiction(jurisdictionKey);
  const backlog = outstandingRegistrations({ rowsByRegion: rows });

  const expected = Object.entries(CALLING_JURISDICTIONS)
    .filter(([, j]) => j.registration?.required === true && j.registration.done !== true)
    .map(([code]) => code)
    .sort();
  ok(
    "the list is exactly the jurisdictions whose registration is required and not done",
    JSON.stringify(backlog.map((r) => r.code).sort()) === JSON.stringify(expected),
    `(${expected.length})`,
  );
  ok("…and there is at least one, or this proves nothing", expected.length > 0);

  // Ordered by what each unlocks. That is the only question worth asking of
  // such a list, and an alphabetical one answers a different one.
  const sorted = [...backlog].every((row, i) => i === 0 || backlog[i - 1].rows >= row.rows);
  ok("the list is ordered by rows unlocked, biggest first", sorted);

  // Every count comes from the library. Never invented, and a jurisdiction the
  // bucket holds nothing for is listed with a zero rather than omitted.
  const wrong = backlog.filter((r) => r.rows !== (rows[r.code] || 0));
  ok("every row count is the library's own", wrong.length === 0);

  // Canada is federal — one row for thirteen provinces — so the arithmetic has
  // to fold every Canadian region into one key. Proved rather than assumed.
  const canadaRows = SNAPSHOT_FILES.filter((f) => f.country === "CA").reduce((a, f) => a + f.rows, 0);
  ok("Canada's rows fold into one federal key", rows.CA === canadaRows, `(${canadaRows})`);
  const waRows = SNAPSHOT_FILES.filter((f) => f.country === "US" && f.province === "WA").reduce((a, f) => a + f.rows, 0);
  ok("a US state keeps its own key", rows["US-WA"] === waRows, `(${waRows})`);

  // MUTATION: the list must follow the table.
  const allDone = Object.fromEntries(
    Object.entries(CALLING_JURISDICTIONS).map(([code, j]) => [
      code,
      j.registration ? { ...j, registration: { ...j.registration, done: true } } : j,
    ]),
  );
  ok(
    "with every registration marked done, the list empties",
    outstandingRegistrations({ jurisdictions: allDone, rowsByRegion: rows }).length === 0,
  );

  // No second copy anywhere. A hand-kept set of state codes is what had
  // already drifted from the rules in the creation script.
  for (const rel of [FORM_PAGE, CREATE_ROUTE, DETAIL_ROUTE, SETTING_PAGE, SETTING_ROUTE]) {
    const src = read(rel);
    const hardCoded = /(new\s+Set\(\s*)?\[\s*"[A-Z]{2}"\s*,\s*"[A-Z]{2}"\s*,\s*"[A-Z]{2}"/.test(src);
    ok(`${rel} keeps no hand-written list of state codes`, !hardCoded);
  }
  ok("the form reads the backlog from the gate", /outstandingRegistrations\(/.test(read(FORM_PAGE)));
  ok("the gate imports the real table", /from "@\/lib\/sales\/callingRules"/.test(read("lib/sales/discovery/campaignGate.js")));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The number shown is the number read
   ═══════════════════════════════════════════════════════════════════════════ */

section("The row count on the form is the library's own");
{
  const providers = snapshotProviderKeys();
  ok("the library ships several providers", providers.length >= 2, providers.join(", "));

  // Every region, every provider: the selection's total must equal the sum of
  // the files it names. Driven across the whole library rather than on one
  // example, because an off-by-one in the filter would only show on the
  // regions two sources both cover.
  let mismatches = 0;
  for (const region of snapshotRegions()) {
    const selection = snapshotSelection({ providers, country: region.country, province: region.province });
    const expected = SNAPSHOT_FILES.filter(
      (f) => f.country === region.country && f.province === region.province && providers.includes(f.provider),
    ).reduce((a, f) => a + f.rows, 0);
    if (selection.rows !== expected || selection.rows !== region.rows) mismatches++;
  }
  ok("every region's total equals the sum of its files", mismatches === 0);

  // A trade count is the sum of that trade's tallies, and never includes a
  // file that names no trade.
  const qc = snapshotSelection({ providers, country: "CA", province: "QC", tradeKey: "painting" });
  const qcOverture = SNAPSHOT_FILES.filter((f) => f.country === "CA" && f.province === "QC" && f.tradesKnown).reduce(
    (a, f) => a + (f.trades.painting || 0),
    0,
  );
  ok("Quebec's painting count is the sum of the files that name a trade", qc.tradeRows === qcOverture, `(${qc.tradeRows})`);

  // ── "Not known" is not zero ──────────────────────────────────────────
  const qcUnknown = SNAPSHOT_FILES.filter((f) => f.country === "CA" && f.province === "QC" && !f.tradesKnown).reduce(
    (a, f) => a + f.rows,
    0,
  );
  ok("the RBQ register names no trade for anybody", qcUnknown > 0, `(${qcUnknown} rows)`);
  ok("…so its rows are reported as not-known, separately", qc.tradeUnknownRows === qcUnknown);
  ok("…and are NOT counted into the trade total", qc.tradeRows < qc.rows);
  // Every row is accounted for: the files that name a trade, plus the files
  // that name none. A row that fell out of both would be a row the form
  // promises and the campaign never reads.
  const qcKnownRows = SNAPSHOT_FILES.filter((f) => f.country === "CA" && f.province === "QC" && f.tradesKnown).reduce(
    (a, f) => a + f.rows,
    0,
  );
  ok("…and are not silently dropped from the row total", qc.rows === qcKnownRows + qc.tradeUnknownRows);
  ok("…and the unmapped count only ever covers files that do name trades", qc.unmappedRows <= qcKnownRows);
  ok("the form prints them as not known rather than as zero", /trade is not known/.test(read(FORM_PAGE)));

  ok("asking about no trade gives null, not zero", snapshotSelection({ providers, country: "CA", province: "QC" }).tradeRows === null);

  // The form must compute its number with the same function the route builds
  // URLs with, or the two can disagree.
  const form = read(FORM_PAGE);
  ok("the form's count comes from snapshotSelection", /snapshotSelection\(/.test(form));
  ok("the form's trade menu counts come from tradeRowsFor", /tradeRowsFor\(/.test(form));
  ok("the create route selects files with the same function", /snapshotSelection\(/.test(read(CREATE_ROUTE)));

  const tally = tradeRowsFor({ providers, country: "US", province: "CA" });
  ok("California has painters and they were counted", tally.tally.painting > 0, `(${tally.tally.painting})`);
  ok("…and the tally never exceeds the region", Object.values(tally.tally).every((n) => n <= tally.rows));

  // Hostile input: none of these may throw or invent a number.
  ok("no providers gives a problem, not a count", snapshotSelection({}).problems.length > 0);
  ok("an unknown region gives a problem", snapshotSelection({ providers, country: "US", province: "ZZ" }).problems.length > 0);
  ok("an unknown region counts nothing", snapshotSelection({ providers, country: "US", province: "ZZ" }).rows === 0);
  ok("a null trade key does not throw", snapshotSelection({ providers, country: "US", province: "CA", tradeKey: null }).tradeRows === null);
  ok("an unknown trade counts zero, not everything", snapshotSelection({ providers, country: "US", province: "CA", tradeKey: "unicorns" }).tradeRows === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. Country and region are chosen from the data's own coverage
   ═══════════════════════════════════════════════════════════════════════════ */

section("Country and region come from what the files actually cover");
{
  const countries = snapshotCountries();
  const inFiles = [...new Set(SNAPSHOT_FILES.map((f) => f.country))].sort();
  ok("the country list is exactly the countries in the files", JSON.stringify(countries.map((c) => c.code)) === JSON.stringify(inFiles), inFiles.join(", "));
  ok("each country's row total is its files'", countries.every((c) => c.rows === SNAPSHOT_FILES.filter((f) => f.country === c.code).reduce((a, f) => a + f.rows, 0)));

  // Per source. A region a source does not cover must be ABSENT, not offered
  // with a zero — the owner asked "I pick trade painting, then it's all the
  // companies that do painting", and a menu entry that yields nothing is the
  // opposite of that.
  for (const provider of snapshotProviderKeys()) {
    const regions = snapshotRegions({ providers: [provider] });
    const expected = [...new Set(SNAPSHOT_FILES.filter((f) => f.provider === provider).map((f) => regionCode(f.country, f.province)))].sort();
    ok(`${provider} offers exactly the regions it has files for`, JSON.stringify(regions.map((r) => r.code).sort()) === JSON.stringify(expected), `(${expected.length})`);
    ok(`${provider} offers no empty region`, regions.every((r) => r.rows > 0));
  }
  ok("an unticked source narrows nothing away by accident", snapshotRegions({ providers: [] }).length === snapshotRegions().length);
  ok("a country filter narrows", snapshotRegions({ country: "CA" }).every((r) => r.country === "CA"));
  ok("an unknown source covers no region", snapshotRegions({ providers: ["nope"] }).length === 0);

  // The form uses selects, not free text, for both.
  const form = read(FORM_PAGE);
  ok("the country is a select", /<select[\s\S]{0,200}id="t-country"/.test(form));
  ok("the region is a select", /<select[\s\S]{0,200}id="t-province"/.test(form));
  ok("the country select is filled from snapshotCountries", /snapshotCountries\(/.test(form));
  ok("the region select is filled from snapshotRegions", /snapshotRegions\(/.test(form));
  ok("there is no free-text country box", !/id="t-country"[\s\S]{0,200}<input/.test(form) && !/placeholder="CA"/.test(form));
  // ── Picking a region must mean the region, and nothing else ──────────
  //
  // chooseRegion() used to fill the centre from the region's median the moment
  // a region was selected, which made "pick New York, press Create" fail with
  // "a centre without a radius matches nothing" — about a circle nobody had
  // asked for, from a form whose own helper text promised the opposite. The
  // assertion is scoped to the two functions by brace matching, because a
  // whole-file match passes the moment `centre.lat` appears ANYWHERE, which is
  // exactly how the old version of this line went on passing after the
  // behaviour it described had been inverted.
  const fnBody = (name) => {
    const at = form.indexOf(`function ${name}(`);
    if (at < 0) return "";
    const open = form.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < form.length; i++) {
      if (form[i] === "{") depth++;
      else if (form[i] === "}" && --depth === 0) return form.slice(open, i + 1);
    }
    return "";
  };
  const chooseRegionBody = fnBody("chooseRegion");
  const setRadiusBody = fnBody("setRadius");
  ok("chooseRegion() was found and parsed", chooseRegionBody.length > 60, chooseRegionBody.length);
  ok(
    "choosing a region does NOT touch the circle",
    !/centerLat|centerLng|centre\./.test(chooseRegionBody),
    chooseRegionBody.slice(0, 220),
  );
  ok("setRadius() was found and parsed", setRadiusBody.length > 60, setRadiusBody.length);
  ok(
    "the centre is filled from the region's measured median when a radius is typed",
    /centre\.lat/.test(setRadiusBody) && /centre\.lon/.test(setRadiusBody),
  );
  ok(
    "…and only when the centre is empty, so a hand-typed one is never overwritten",
    /current\.centerLat \|\| current\.centerLng/.test(setRadiusBody),
  );
  ok("the radius input goes through setRadius rather than setting the draft raw", /onChange=\{\(e\) => setRadius\(/.test(form));
  ok(
    "the helper text no longer claims the centre was already filled in",
    !/The centre above was filled/.test(form),
  );
  ok("the region is cleared when a source that covered it is unticked", /stillCovered/.test(form));

  // The route requires a region, because a territory without one names no file.
  ok("the create route refuses a territory with no region", /A territory needs a region/.test(read(CREATE_ROUTE)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. One submission, several files
   ═══════════════════════════════════════════════════════════════════════════ */

section("A region split across several files creates one campaign per file");
{
  const split = SNAPSHOT_FILES.filter((f) => f.part !== null);
  ok("the library holds split files at all", split.length > 0, `(${split.length})`);

  const file = split[0];
  ok("a single file keeps the name as typed", campaignNameForFile("Quebec painters", file, 1) === "Quebec painters");
  const many = campaignNameForFile("Quebec painters", file, 3);
  ok("several files name the source and the part", many.includes(file.provider) && many.includes(`part ${file.part}`));
  ok("the name is bounded", campaignNameForFile("x".repeat(400), file, 3, 120).length <= 120);

  const createRoute = read(CREATE_ROUTE);
  ok("the route loops the files", /for\s*\(const plan of plans\)/.test(createRoute));
  ok("each campaign names exactly the one source its file belongs to", /discoverySources:\s*\[plan\.file\.provider\]/.test(createRoute));
  ok("each campaign remembers which library row it came from", /snapshotFile:\s*plan\.file\.objectKey/.test(createRoute));
  ok("the form says how many campaigns the button will create", /Create \$\{fileCount\} campaigns/.test(read(FORM_PAGE)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. The setting itself
   ═══════════════════════════════════════════════════════════════════════════ */

section("The base URL is configured in exactly one place");
{
  const summary = librarySummary();
  ok("the summary counts every file", summary.files === SNAPSHOT_FILES.length);
  ok("the summary's rows are the files' rows", summary.rows === SNAPSHOT_FILES.reduce((a, f) => a + f.rows, 0));
  ok("the summary says when it was measured", Boolean(summary.measuredAt));

  ok("there is a screen for it", fs.existsSync(path.join(ROOT, SETTING_PAGE)));
  ok("there is a route for it", fs.existsSync(path.join(ROOT, SETTING_ROUTE)));
  ok("the route is superadmin only", /superadminOrRefusal/.test(read(SETTING_ROUTE)));
  ok("the setting is stored, not held in an env var", /platformSnapshotLibrary/.test(read(SETTING_ROUTE)));
  ok(
    "the schema carries the singleton",
    /model PlatformSnapshotLibrary/.test(fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8")),
  );
  ok("the sidebar links to it", /platform\/sales\/snapshots/.test(read("app/components/platform/PlatformSidebar.js")));
  ok(
    "the campaign form points at it when nothing is configured",
    /Snapshots are not configured yet/.test(read(FORM_PAGE)) && /platform\/sales\/snapshots/.test(read(FORM_PAGE)),
  );
  ok("…and refuses to render the form until it is", /adding && library\.configured/.test(read(FORM_PAGE)));

  // The credentials stay in the environment. A read URL is not a secret and a
  // secret is not a setting; a screen that rendered one would put it on a
  // screen.
  ok("no credential is read by the setting route", !/Cloudfare_Secret|Cloudfare_Access|Cloudfare_Token/.test(read(SETTING_ROUTE)));
  ok("no credential is read by the form", !/Cloudfare/.test(read(FORM_PAGE)));
}

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
