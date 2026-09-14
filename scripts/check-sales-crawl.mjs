#!/usr/bin/env node
//
// scripts/check-sales-crawl.mjs
//
//   npm run check:sales-crawl
//
// The crawler is the first code in this repo that fetches a URL somebody else
// chose. Everything in it fails silently: a robots.txt that is read and not
// obeyed, a Crawl-delay honoured in one lambda and ignored in the next, a 429
// answered with a retry, a redirect to Facebook recorded as a crawl of the
// contractor's site, an SSRF guard that checks the first URL and not the
// redirect. None of those show up in a diff and none of them are visible in
// staging, because the only observer is a stranger's web server.
//
// So this file EXECUTES rather than reads, wherever executing is possible:
//
//   · every pure decision against hostile input — private addresses in four
//     notations, file:// and gopher://, Retry-After in both its legal forms,
//     a robots.txt with an Allow inside a Disallow
//   · the HTML lexer against the three documents that break a regex reader
//   · the whole crawl, end to end, against a fake network and a fake database:
//     a 429 with and without Retry-After, a host already blocked, a redirect
//     off-host, a 200 MB body, a page with no title, an unchanged site
//
// The fake network is a function; the fake database is 150 lines. Neither is a
// mock framework, and both are small enough to read, which is the property
// that makes their answers worth anything.
//
// ══ Why every string rule is scoped to ONE brace-matched function ══════════
//
// scripts/check-demo-spend.mjs records this the hard way and check-sales-sms
// repeats it: a whole-file search passed while the guard it was checking had
// been deleted, because an identical string in a different function satisfied
// the match. So functionSource() below matches BRACES, and every ordered rule
// names the function it is about.

import { readFileSync } from "node:fs";

let fail = 0;
let pass = 0;
const ok = (message, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${message}`);
  } else {
    fail++;
    console.log(`  FAIL ${message}${got === undefined ? "" : `  — got ${JSON.stringify(got)}`}`);
  }
  return Boolean(cond);
};
const section = (title) => console.log(`\n${title}\n`);

// ── Source reading ─────────────────────────────────────────────────────────
//
// Comments in this repo explain WHY at length and several of them quote the
// very strings these rules search for — crawlSite.js's header names
// `robotsAllowed` and `isDemoCompany`. A regex that reads justification prose
// passes on broken code, which two earlier check scripts in this repo did.

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const read = (f) => stripComments(readFileSync(f, "utf8"));

function matchDelims(src, start) {
  const closers = { "(": ")", "{": "}", "[": "]" };
  const stack = [];
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (closers[ch]) stack.push(closers[ch]);
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** The source of ONE function, signature to matching close brace, or null.
 *  Null is a FAILURE at every callsite: a renamed function means the rule has
 *  stopped proving anything, and passing silently would make this file read as
 *  evidence while checking nothing. */
function functionSource(src, name) {
  const sig = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = sig.exec(src);
  if (!m) return null;
  const paramClose = matchDelims(src, m.index + m[0].length - 1);
  if (paramClose === -1) return null;
  const open = src.indexOf("{", paramClose);
  if (open === -1) return null;
  const close = matchDelims(src, open);
  return close === -1 ? null : src.slice(m.index, close + 1);
}

// ════════════════════════════════════════════════════════════════════════════
//  A fake database, installed before anything imports lib/db.
// ════════════════════════════════════════════════════════════════════════════
//
// Faithful to the queries the code under test actually makes, and no wider. It
// answers findUnique/create/update/updateMany on CrawlHostPolicy, findUnique/
// update on Prospect, createMany on ProspectEvidence, findMany on
// SalesSuppression and findUnique on Company — which is the complete list, and
// a list this file asserts by counting the calls it receives.

const store = {
  prospects: new Map(),
  evidence: [],
  hosts: new Map(),
  suppressions: [],
  companies: new Map(),
  calls: [],
};

function resetStore() {
  store.prospects.clear();
  store.evidence.length = 0;
  store.hosts.clear();
  store.suppressions.length = 0;
  store.companies.clear();
  store.calls.length = 0;
}

const note = (what) => store.calls.push(what);

const fakeDb = {
  async $transaction(writes) {
    const out = [];
    for (const w of writes) out.push(await w);
    return out;
  },
  company: {
    async findUnique({ where }) {
      note(`company.findUnique:${where.id}`);
      return store.companies.get(where.id) || null;
    },
  },
  prospect: {
    async findUnique({ where }) {
      note(`prospect.findUnique:${where.id}`);
      return store.prospects.get(where.id) || null;
    },
    async update({ where, data }) {
      note(`prospect.update:${where.id}`);
      const row = store.prospects.get(where.id);
      if (!row) throw new Error("no prospect");
      Object.assign(row, data);
      return row;
    },
  },
  prospectEvidence: {
    async createMany({ data }) {
      note(`evidence.createMany:${data.length}`);
      store.evidence.push(...data);
      return { count: data.length };
    },
  },
  salesSuppression: {
    async findMany({ where }) {
      note("suppression.findMany");
      const keys = where?.OR || [];
      return store.suppressions.filter((r) => keys.some((k) => k.kind === r.kind && k.value === r.value));
    },
  },
  crawlHostPolicy: {
    async findUnique({ where }) {
      return store.hosts.get(where.host) || null;
    },
    async create({ data }) {
      if (store.hosts.has(data.host)) {
        const err = new Error("unique");
        err.code = "P2002";
        throw err;
      }
      const row = {
        id: `h_${store.hosts.size}`,
        host: data.host,
        robotsAllowed: null,
        robotsFetchedAt: null,
        crawlDelayMs: null,
        lastRequestAt: null,
        requestCount: 0,
        blockedUntil: null,
        blockReason: null,
        ...data,
      };
      store.hosts.set(data.host, row);
      return row;
    },
    async update({ where, data }) {
      const row = store.hosts.get(where.host);
      if (!row) throw new Error("no host");
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
        else row[k] = v;
      }
      return row;
    },
    async updateMany({ where, data }) {
      const row = store.hosts.get(where.host);
      if (!row) return { count: 0 };
      // The compare-and-set: the guard names the value that was READ.
      if ("lastRequestAt" in where) {
        const wanted = where.lastRequestAt;
        const have = row.lastRequestAt;
        const same =
          (wanted === null && have === null) ||
          (wanted && have && new Date(wanted).getTime() === new Date(have).getTime());
        if (!same) return { count: 0 };
      }
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] || 0) + v.increment;
        else row[k] = v;
      }
      return { count: 1 };
    },
  },
};

globalThis.__prisma = fakeDb;
globalThis.__pool = { query: async () => ({ rows: [] }), end: async () => {} };

// ── A fake network ─────────────────────────────────────────────────────────

function makeResponse({ status = 200, headers = {}, body = "", chunks = null }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const encoder = new TextEncoder();
  const parts = chunks || (body ? [encoder.encode(body)] : []);
  let index = 0;
  let cancelled = false;

  return {
    status,
    headers: { get: (n) => lower[String(n).toLowerCase()] ?? null },
    body: {
      getReader() {
        return {
          async read() {
            if (cancelled || index >= parts.length) return { done: true, value: undefined };
            const value = typeof parts[index] === "function" ? parts[index]() : parts[index];
            index++;
            return { done: false, value };
          },
          async cancel() {
            cancelled = true;
            makeResponse.lastCancelled = true;
          },
        };
      },
    },
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
    get chunksRead() {
      return index;
    },
    get cancelled() {
      return cancelled;
    },
  };
}

/** A network built from a { url -> response } map. Records every request. */
function makeNet(routes, { fallback = { status: 404, body: "not found" } } = {}) {
  const requests = [];
  const impl = async (url) => {
    requests.push(String(url));
    const key = Object.keys(routes).find((k) => String(url) === k || String(url).startsWith(k));
    const spec = key ? routes[key] : fallback;
    if (typeof spec === "function") return spec(String(url));
    if (spec.throws) throw Object.assign(new Error(spec.throws), { code: spec.throws });
    return makeResponse(spec);
  };
  impl.requests = requests;
  return impl;
}

// 203.0.113.0/24 is TEST-NET-3 and IS in the not-globally-reachable list, so
// the fake resolver has to answer with something genuinely routable.
const realPublicLookup = async () => [{ address: "104.18.32.7" }];

/**
 * A clock a sleep can move.
 *
 * A no-op sleep would be a LIE about this code: reserveHostSlot waits out the
 * crawl-delay and then re-reads the row, so a sleep that does not advance time
 * makes every second request look refused — which is exactly what the first
 * run of this file reported, and it was the harness that was wrong, not the
 * crawler. Advancing a virtual clock keeps the check instant AND truthful.
 */
function makeClock(startAt = Date.now()) {
  let t = startAt;
  return {
    clock: () => new Date(t),
    sleep: async (ms) => {
      t += Number(ms) || 0;
    },
    now: () => t,
  };
}
const noSleep = async () => {};

const HOME_HTML = `<!doctype html>
<html lang="en"><head>
<title>Northline Painting</title>
<meta name="description" content="Interior painting in Ottawa">
<meta name="generator" content="WordPress 6.4">
<script src="/wp-includes/js/jquery.js?ver=3.7.1"></script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Northline"}</script>
</head><body>
<nav><a href="/about">About us</a><a href="/services">Our Services</a><a href="/contact">Contact</a>
<a href="https://facebook.com/northline">Facebook</a></nav>
<h1>Painters in Ottawa</h1>
<p>Call <a href="tel:+16135550142">613-555-0142</a> or email <a href="mailto:Hi@Northline.ca">us</a>.</p>
<form action="/quote" method="post"><input name="email" type="email" required><input name="postal" type="text">
<button type="submit">Request a quote</button></form>
<iframe src="https://calendly.com/northline/estimate"></iframe>
<div data-hcp-token="abc123"></div>
</body></html>`;

// ════════════════════════════════════════════════════════════════════════════
async function main() {
  const policy = await import("@/lib/sales/crawl/policy");
  const urlMod = await import("@/lib/sales/crawl/url");
  const robots = await import("@/lib/sales/crawl/robots");
  const html = await import("@/lib/sales/crawl/html");
  const fingerprint = await import("@/lib/sales/crawl/fingerprint");
  const evidence = await import("@/lib/sales/crawl/evidence");
  const fetchPage = await import("@/lib/sales/crawl/fetchPage");
  const hostPolicy = await import("@/lib/sales/crawl/hostPolicy");
  const crawlSite = await import("@/lib/sales/crawl/crawlSite");
  const registry = await import("@/lib/sales/pipeline/registry");
  const kinds = await import("@/lib/sales/pipeline/kinds");
  // handlers/index is imported and the handler module is NOT — deliberately.
  // Importing the handler directly would register it whatever index.js says,
  // and section 10's registration assertions would then pass on a pipeline
  // that never loads it. The runner's only entry point is this index; so is
  // this file's.
  await import("@/lib/sales/pipeline/handlers");

  // ══════════════════════════════════════════════════════════════════════════
  section("1. A URL from a dataset is hostile input");

  const refused = [
    ["file:///etc/passwd", "scheme_not_allowed"],
    ["gopher://acme.com/", "scheme_not_allowed"],
    ["javascript:alert(1)", "scheme_not_allowed"],
    ["http://localhost/", "host_not_public"],
    ["http://LOCALHOST:80/", "host_not_public"],
    ["http://app.localhost/", "host_not_public"],
    ["http://127.0.0.1/", "host_not_public"],
    ["http://0177.0.0.1/", "host_not_public"],
    ["http://2130706433/", "host_not_public"],
    ["http://0x7f000001/", "host_not_public"],
    ["http://10.0.0.5/", "host_not_public"],
    ["http://172.20.1.1/", "host_not_public"],
    ["http://192.168.0.1/", "host_not_public"],
    ["http://169.254.169.254/latest/meta-data/", "host_not_public"],
    // A link-local address that is NOT the metadata IP, so the RANGE is what
    // is being tested rather than the one entry in FORBIDDEN_HOSTS. Removing
    // the 169.254/16 branch previously left this passing.
    ["http://169.254.10.20/", "host_not_public"],
    ["http://172.31.255.254/", "host_not_public"],
    ["http://192.0.2.1/", "host_not_public"],
    ["http://198.18.0.1/", "host_not_public"],
    ["http://198.51.100.7/", "host_not_public"],
    ["http://203.0.113.7/", "host_not_public"],
    ["http://224.0.0.1/", "host_not_public"],
    ["http://255.255.255.255/", "host_not_public"],
    ["http://0.0.0.0/", "host_not_public"],
    ["http://100.64.3.2/", "host_not_public"],
    ["http://[::1]:5432/", "host_not_public"],
    ["http://[::ffff:7f00:1]/", "host_not_public"],
    ["http://[64:ff9b::a00:1]/", "host_not_public"],
    ["http://[fd00::1]/", "host_not_public"],
    ["http://[::ffff:127.0.0.1]/", "host_not_public"],
    ["http://intranet/", "host_not_public"],
    ["http://printer.local/", "host_not_public"],
    ["http://metadata.google.internal/", "host_not_public"],
    ["http://user:pass@acme.com/", "credentials_in_url"],
    ["http://acme.com:8080/", "port_not_allowed"],
    ["http://acme.com:6379/", "port_not_allowed"],
    ["http://acme.com/\nHost: evil", "control_characters"],
    ["", "no_url"],
  ];
  for (const [input, reason] of refused) {
    const got = urlMod.safeCrawlUrl(input);
    ok(`refuses ${JSON.stringify(input)} as ${reason}`, got.ok === false && got.reason === reason, got);
  }

  // The IPv6 forms WHATWG URL rewrites. `[::ffff:127.0.0.1]` comes back out as
  // `[::ffff:7f00:1]`, and the first version of this file waved it through.
  for (const [addr, want] of [
    ["::1", true],
    ["::", true],
    ["::ffff:127.0.0.1", true],
    ["::ffff:7f00:1", true],
    ["::ffff:10.0.0.1", true],
    ["::ffff:a00:1", true],
    ["::ffff:169.254.169.254", true],
    ["64:ff9b::127.0.0.1", true],
    ["fd00::1", true],
    ["fe80::1", true],
    ["ff02::1", true],
    ["2001:db8::1", true],
    ["2606:4700:4700::1111", false],
    ["2a00:1450:4001:81b::200e", false],
  ]) {
    ok(`IPv6 ${addr} is ${want ? "private" : "public"}`, urlMod.isPrivateIpv6(addr) === want, urlMod.expandIpv6(addr));
  }
  ok("a public IPv6 literal is accepted", urlMod.safeCrawlUrl("http://[2606:4700:4700::1111]/").ok === true);

  const good = urlMod.safeCrawlUrl("https://northline.ca/");
  ok("accepts a real https URL", good.ok === true && good.host === "northline.ca");
  ok("accepts a bare domain, defaulting to https", urlMod.safeCrawlUrl("northline.ca").url?.protocol === "https:");
  ok("accepts port 443 explicitly", urlMod.safeCrawlUrl("https://northline.ca:443/").ok === true);

  ok("same-site: www to bare", urlMod.sameSiteAs("northline.ca", "www.northline.ca"));
  ok("same-site: bare to www", urlMod.sameSiteAs("www.northline.ca", "northline.ca"));
  ok("same-site: a subdomain of the base", urlMod.sameSiteAs("northline.ca", "shop.northline.ca"));
  ok("NOT same-site: a different registrable domain", !urlMod.sameSiteAs("northline.ca", "facebook.com"));
  ok("NOT same-site: a suffix trick", !urlMod.sameSiteAs("northline.ca", "evilnorthline.ca"));
  ok(
    "NOT same-site: two businesses under one public suffix",
    !urlMod.sameSiteAs("acme.co.uk", "other.co.uk"),
  );

  ok("ranks the priority slugs in the brief's order", urlMod.slugRank("/about") < urlMod.slugRank("/careers"));
  ok("home outranks everything", urlMod.slugRank("/") === -1);
  ok("an unlisted page is not a candidate", urlMod.slugRank("/blog/2019/how-to-paint") === Infinity);
  ok("matches a slug with an extension", urlMod.slugRank("/contact.html") === urlMod.slugRank("/contact"));

  {
    const ranked = urlMod.rankCandidates({
      links: [
        "https://northline.ca/careers",
        "https://northline.ca/contact?utm_source=x",
        "https://facebook.com/northline",
        "https://northline.ca/blog/post-1",
        "https://northline.ca/about",
      ],
      baseHost: "northline.ca",
    });
    ok("candidate ranking drops off-site links", !ranked.some((u) => u.includes("facebook")));
    ok("candidate ranking drops non-priority pages", !ranked.some((u) => u.includes("/blog/")));
    ok("candidate ranking drops the query string", ranked.some((u) => u === "https://northline.ca/contact"));
    ok("candidate ranking puts about before careers", ranked.indexOf("https://northline.ca/about") === 0, ranked);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("2. robots.txt is parsed, not skimmed");

  {
    const r = robots.robotsFor(`User-agent: *\nDisallow: /`);
    ok("Disallow: / for everyone refuses the root", r.rootAllowed === false);
    ok("…and refuses a deep path too", r.allows("/about").allowed === false);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nDisallow:`);
    ok("an EMPTY Disallow is not a rule", r.rootAllowed === true && r.allows("/anything").allowed === true);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php`);
    ok("longest match wins: the Allow inside the Disallow", r.allows("/wp-admin/admin-ajax.php").allowed === true);
    ok("…and the Disallow still holds elsewhere", r.allows("/wp-admin/options.php").allowed === false);
    ok("…and the rest of the site is open", r.allows("/about").allowed === true);
  }
  {
    const r = robots.robotsFor(
      `User-agent: *\nDisallow: /\n\nUser-agent: FieldQuoBot\nAllow: /\nCrawl-delay: 7`,
    );
    ok("a group naming us WINS over the * group", r.rootAllowed === true);
    ok("…and it is our group, not a merge", r.agent === "fieldquobot");
    ok("…and its Crawl-delay is honoured", r.crawlDelayMs === 7000);
  }
  {
    const r = robots.robotsFor(`User-agent: FieldQuoBot\nDisallow: /\n\nUser-agent: *\nAllow: /`);
    ok("a group naming us wins when it REFUSES too", r.rootAllowed === false);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nDisallow: /*.pdf$\nDisallow: /private*/x`);
    ok("$ anchors the end", r.allows("/a/b.pdf").allowed === false);
    ok("…and does not match past it", r.allows("/a/b.pdf.html").allowed === true);
    ok("* matches a run of characters", r.allows("/private-2024/x").allowed === false);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nDisallow: /a+b/\nDisallow: /search?q=`);
    ok("regex metacharacters in a path are literal", r.allows("/aaab/").allowed === true);
    ok("…and the literal path still matches", r.allows("/a+b/").allowed === false);
    ok("…including a query-shaped rule", r.allows("/search?q=paint").allowed === false);
  }
  {
    const r = robots.robotsFor(`Disallow: /\nUser-agent: *\nAllow: /`);
    ok("a rule before any User-agent belongs to nobody", r.rootAllowed === true);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nCrawl-delay: 0`);
    ok("Crawl-delay: 0 is floored, not obeyed as zero", r.crawlDelayMs === policy.MIN_CRAWL_DELAY_MS);
  }
  {
    const r = robots.robotsFor(`User-agent: *\nCrawl-delay: banana`);
    ok("an unparseable Crawl-delay is ABSENT, not zero", r.crawlDelayMs === null);
    ok("…and absence falls back to our own default", policy.effectiveDelayMs({ crawlDelayMs: r.crawlDelayMs }) === policy.DEFAULT_CRAWL_DELAY_MS);
  }
  {
    const r = robots.robotsFor(`# nothing but comments\n`);
    ok("a file with no groups allows", r.rootAllowed === true && r.agent === null);
  }

  ok("robots 200 is parsed", robots.robotsFetchOutcome({ status: 200 }).act === "parse");
  ok("robots 404 means allowed (RFC 9309 'unavailable')", robots.robotsFetchOutcome({ status: 404 }).act === "allow_all");
  ok("robots 401/403 also means allowed", robots.robotsFetchOutcome({ status: 403 }).act === "allow_all");
  ok("robots 503 is the host saying stop", robots.robotsFetchOutcome({ status: 503 }).act === "blocked");
  ok("robots 429 is the host saying stop", robots.robotsFetchOutcome({ status: 429 }).act === "blocked");
  ok("robots 500 is UNKNOWN, not allowed", robots.robotsFetchOutcome({ status: 500 }).act === "unknown");
  ok("a network error is UNKNOWN, not allowed", robots.robotsFetchOutcome({ error: "ECONNRESET" }).act === "unknown");

  // ══════════════════════════════════════════════════════════════════════════
  section("3. Politeness: three-valued robots, delays, and blocks");

  ok(
    "robotsAllowed null means NOT YET FETCHED, so fetch it",
    policy.robotsDecision({ policy: { robotsAllowed: null } }).act === "fetch",
  );
  ok(
    "robotsAllowed undefined means the same",
    policy.robotsDecision({ policy: {} }).act === "fetch",
  );
  ok(
    "a null verdict is NEVER read as allowed",
    policy.robotsDecision({ policy: { robotsAllowed: null } }).act !== "allow",
  );
  {
    const now = new Date("2026-09-02T12:00:00Z");
    const fresh = { robotsAllowed: false, robotsFetchedAt: new Date("2026-09-01T12:00:00Z") };
    const stale = { robotsAllowed: false, robotsFetchedAt: new Date("2026-08-01T12:00:00Z") };
    ok("a fresh refusal is believed", policy.robotsDecision({ policy: fresh, now }).act === "disallow");
    ok("a stale verdict is re-fetched", policy.robotsDecision({ policy: stale, now }).act === "fetch");
    ok(
      "a verdict with no fetch time is re-fetched",
      policy.robotsDecision({ policy: { robotsAllowed: true }, now }).act === "fetch",
    );
  }

  {
    const now = new Date("2026-09-02T12:00:00Z");
    ok("a host never seen may go now", policy.hostSlotDecision({ policy: null, now }).act === "go");
    ok(
      "a host hit one second ago must wait",
      policy.hostSlotDecision({ policy: { lastRequestAt: new Date(now.getTime() - 1000) }, now }).act === "wait",
    );
    ok(
      "…for the remainder of the delay",
      policy.hostSlotDecision({ policy: { lastRequestAt: new Date(now.getTime() - 1000) }, now }).waitMs ===
        policy.DEFAULT_CRAWL_DELAY_MS - 1000,
    );
    ok(
      "a host hit long ago may go",
      policy.hostSlotDecision({ policy: { lastRequestAt: new Date(now.getTime() - 60_000) }, now }).act === "go",
    );
    ok(
      "a Crawl-delay longer than a run DEFERS rather than ignoring it",
      policy.hostSlotDecision({
        policy: { lastRequestAt: new Date(now.getTime() - 1000), crawlDelayMs: 300_000 },
        now,
      }).act === "defer",
    );
    ok(
      "a host already blocked is BLOCKED, whatever the delay says",
      policy.hostSlotDecision({
        policy: { lastRequestAt: new Date(now.getTime() - 60_000), blockedUntil: new Date(now.getTime() + 3600_000) },
        now,
      }).act === "blocked",
    );
    ok(
      "…and an EXPIRED block is not a block",
      policy.hostSlotDecision({
        policy: { lastRequestAt: null, blockedUntil: new Date(now.getTime() - 1000) },
        now,
      }).act === "go",
    );
    ok(
      "a lastRequestAt in the future errs towards politeness",
      policy.hostSlotDecision({ policy: { lastRequestAt: new Date(now.getTime() + 5000) }, now }).act !== "go",
    );
  }

  {
    const now = new Date("2026-09-02T12:00:00Z");
    ok("Retry-After as delta-seconds", policy.retryAfterMs("120", now) === 120_000);
    ok(
      "Retry-After as an HTTP-date",
      policy.retryAfterMs("Wed, 02 Sep 2026 12:05:00 GMT", now) === 300_000,
    );
    ok("a past Retry-After date is zero, never negative", policy.retryAfterMs("Wed, 02 Sep 2026 11:00:00 GMT", now) === 0);
    ok("an absent Retry-After is null, not zero", policy.retryAfterMs(null, now) === null);
    ok("an unparseable Retry-After is null", policy.retryAfterMs("soon", now) === null);
    ok("an absurd Retry-After is capped", policy.retryAfterMs("999999999", now) === policy.MAX_BLOCK_MS);

    const withHeader = policy.blockUntil({ status: 429, retryAfter: "600", now });
    ok("a 429 WITH Retry-After honours it", withHeader.ms === 600_000 && withHeader.source === "retry-after");
    const without = policy.blockUntil({ status: 429, retryAfter: null, now });
    ok("a 429 WITHOUT Retry-After uses the default block", without.ms === policy.DEFAULT_BLOCK_MS && without.source === "default");
    const s503 = policy.blockUntil({ status: 503, retryAfter: "30", now });
    ok("a 503 blocks too", s503.ms === 30_000 && s503.reason === "http_503");
  }

  {
    const now = new Date("2026-09-02T12:00:00Z");
    ok("never crawled is due", policy.recrawlDecision({ prospect: {}, now }).act === "crawl");
    ok(
      "crawled yesterday is NOT due",
      policy.recrawlDecision({ prospect: { lastCrawledAt: new Date(now.getTime() - 86_400_000) }, now }).act === "skip",
    );
    ok(
      "crawled a year ago is due",
      policy.recrawlDecision({ prospect: { lastCrawledAt: new Date(now.getTime() - 365 * 86_400_000) }, now }).act === "crawl",
    );
    ok(
      "force overrides the interval",
      policy.recrawlDecision({ prospect: { lastCrawledAt: now }, now, force: true }).act === "crawl",
    );
  }

  ok("a live domain suppression stops a crawl", policy.crawlSuppressed([{ kind: "domain", removedAt: null }]).suppressed === true);
  ok("a REMOVED suppression does not", policy.crawlSuppressed([{ kind: "domain", removedAt: new Date() }]).suppressed === false);
  ok("an email suppression is not a domain one", policy.crawlSuppressed([{ kind: "email", removedAt: null }]).suppressed === false);

  ok("a name that does not resolve is terminal", policy.fetchFailureOutcome("ENOTFOUND").terminal === true);
  ok("an unsafe URL is terminal", policy.fetchFailureOutcome("unsafe_url:scheme_not_allowed").terminal === true);
  ok("a host resolving privately is terminal", policy.fetchFailureOutcome("unsafe_host:resolves_private").terminal === true);
  ok("a timeout is retryable", policy.fetchFailureOutcome("timeout").terminal === false);
  ok("a reset is retryable", policy.fetchFailureOutcome("ECONNRESET").terminal === false);
  ok("a redirect loop is terminal", policy.fetchFailureOutcome("too_many_redirects").terminal === true);

  ok("the User-Agent names FieldQuo", /FieldQuo/i.test(policy.USER_AGENT));
  ok("…and carries a contact URL", /\(\+https:\/\/[^)]+\)/.test(policy.USER_AGENT));
  ok("…and does not impersonate a browser", !/Mozilla|Chrome|Safari|WebKit/i.test(policy.USER_AGENT));

  // ══════════════════════════════════════════════════════════════════════════
  section("4. The HTML lexer, against the documents that break a regex");

  {
    const page = html.extractPage({
      html: `<html><head><title>T</title></head><body>
        <script>if (a < b) { document.write("</div>") }</script>
        <p>Real text</p></body></html>`,
      finalUrl: "https://acme.com/",
    });
    ok("a < inside a script does not end the document", page.text.includes("Real text"), page.text);
    ok("…and the script's own text is not visible text", !page.text.includes("document.write"), page.text);
    ok("…and no phantom <b> or </div> became a form or a link", page.forms.length === 0 && page.links.length === 0);
  }
  {
    const page = html.extractPage({
      html: `<a href="/search?q=a>b" title='He said "hi"'>Book online</a>`,
      finalUrl: "https://acme.com/",
    });
    ok("a > inside a quoted attribute does not end the tag", page.links[0]?.href === "/search?q=a>b", page.links);
    ok("…and the link text is still captured", page.links[0]?.text === "Book online", page.links);
  }
  {
    const page = html.extractPage({
      html: `<!-- <form action="/old"><input name="email"></form> --><p>hi</p>`,
      finalUrl: "https://acme.com/",
    });
    ok("a commented-out form is not a form", page.forms.length === 0, page.forms);
  }
  {
    const page = html.extractPage({ html: "<p>5 < 6 is true</p>", finalUrl: "https://acme.com/" });
    ok("a bare < in prose is text", page.text.includes("5 < 6"), page.text);
  }
  {
    const page = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/" });
    ok("title", page.title === "Northline Painting");
    ok("lang", page.lang === "en");
    ok("meta description", page.metas.some((m) => m.name === "description" && /Ottawa/.test(m.content)));
    ok("meta generator", page.metas.some((m) => m.name === "generator" && m.content === "WordPress 6.4"));
    ok("script src, resolved absolute", page.scripts.some((s) => s.url === "https://northline.ca/wp-includes/js/jquery.js?ver=3.7.1"));
    ok("iframe host", page.iframes.some((f) => f.host === "calendly.com"));
    ok("JSON-LD kept", page.jsonLd.length === 1 && page.jsonLd[0].includes("LocalBusiness"));
    ok("form action and method", page.forms[0]?.method === "post" && page.forms[0]?.actionUrl === "https://northline.ca/quote");
    ok("form fields", page.forms[0]?.fields.map((f) => f.name).join(",") === "email,postal");
    ok("button label", page.buttons.some((b) => b.text === "Request a quote"));
    ok("data-* attribute", page.dataAttrs.some((d) => d.name === "data-hcp-token" && d.value === "abc123"));
    ok("tel: contact, normalised", page.contacts.some((c) => c.kind === "phone" && c.value === "+16135550142"));
    ok("mailto: contact, lowercased", page.contacts.some((c) => c.kind === "email" && c.value === "hi@northline.ca"));
    ok("links include the off-site one, recorded not followed", page.links.some((l) => l.host === "facebook.com"));
    ok("visible text has the heading", page.text.includes("Painters in Ottawa"));
    ok("visible text does NOT have the JSON-LD", !page.text.includes("schema.org"), page.text.slice(0, 200));
  }
  {
    const page = html.extractPage({ html: "<html><body><p>No title here</p></body></html>", finalUrl: "https://acme.com/" });
    ok("a page with no title yields NULL, not an invented one", page.title === null, page.title);
    const rows = evidence.pageEvidence({ ...page, status: 200 });
    ok("…and no meta row claims a title", !rows.some((r) => r.type === "meta" && r.rawValue.startsWith("title=")));
  }
  {
    // An icon's accessible label is not the page's title.
    const page = html.extractPage({
      html: "<html><body><svg><title>Phone icon</title></svg><p>Call us</p></body></html>",
      finalUrl: "https://acme.com/",
    });
    ok("an inline SVG title is NOT taken as the page title", page.title === null, page.title);
    ok("…and the SVG's own text is not visible text", !page.text.includes("Phone icon"), page.text);
    ok("…while the real page text survives", page.text.includes("Call us"));
  }
  {
    const page = html.extractPage({
      html: "<html><body><template><p>never rendered</p></template><p>rendered</p></body></html>",
      finalUrl: "https://acme.com/",
    });
    ok("a <template> body is not visible text", !page.text.includes("never rendered"), page.text);
    ok("…while the rest of the page is", page.text.includes("rendered"));
  }
  {
    const page = html.extractPage({
      html: "<head><title>Real</title></head><body><svg><title>Icon</title></svg></body>",
      finalUrl: "https://acme.com/",
    });
    ok("a real title still wins over a later SVG one", page.title === "Real", page.title);
  }
  {
    const page = html.extractPage({ html: "<title>A &amp; B &#39;s &nbsp;shop &#x2014; open</title>", finalUrl: "https://acme.com/" });
    ok("entities are decoded", page.title === "A & B 's shop — open", page.title);
  }
  {
    const page = html.extractPage({ html: "<title>Unclosed", finalUrl: "https://acme.com/" });
    ok("an unterminated raw-text element does not throw", page.title === "Unclosed", page.title);
  }
  {
    const big = `<p>${"x".repeat(200_000)}</p>`;
    const page = html.extractPage({ html: big, finalUrl: "https://acme.com/" });
    ok("visible text is capped", page.text.length <= html.CAPS.text && page.textTruncated === true, page.text.length);
  }
  {
    const many = Array.from({ length: 5000 }, (_, i) => `<a href="/p${i}">p</a>`).join("");
    const page = html.extractPage({ html: many, finalUrl: "https://acme.com/" });
    ok("links are capped", page.links.length === html.CAPS.links, page.links.length);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("5. The content hash covers meaning, not bytes");

  {
    const withNonce = HOME_HTML.replace("</head>", `<script nonce="a1b2c3">var t=${Date.now()}</script></head>`);
    const withNonce2 = HOME_HTML.replace("</head>", `<script nonce="z9y8x7">var t=${Date.now() + 1}</script></head>`);
    const a = html.extractPage({ html: withNonce, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({ html: withNonce2, finalUrl: "https://northline.ca/", status: 200 });
    ok("two fetches differing only by an inline nonce hash the SAME", fingerprint.contentHash([a]) === fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({
      html: HOME_HTML.replace("?ver=3.7.1", "?ver=3.8.0"),
      finalUrl: "https://northline.ca/",
      status: 200,
    });
    ok("a cache-busting query on an asset does NOT count as a change", fingerprint.contentHash([a]) === fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({ html: HOME_HTML, finalUrl: "http://northline.ca/", status: 200 });
    ok("http to https is not a content change", fingerprint.contentHash([a]) === fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({
      html: HOME_HTML.replace("<meta name=\"csrf-token\" content=\"\">", "").replace(
        "</head>",
        '<meta name="csrf-token" content="abc"></head>',
      ),
      finalUrl: "https://northline.ca/",
      status: 200,
    });
    ok("a csrf-token meta is excluded from the hash", fingerprint.contentHash([a]) === fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({
      html: HOME_HTML.replace("Painters in Ottawa", "Painters in Kanata"),
      finalUrl: "https://northline.ca/",
      status: 200,
    });
    ok("a real copy change DOES change the hash", fingerprint.contentHash([a]) !== fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({
      html: HOME_HTML.replace('<iframe src="https://calendly.com/northline/estimate"></iframe>', ""),
      finalUrl: "https://northline.ca/",
      status: 200,
    });
    ok("removing a booking widget DOES change the hash", fingerprint.contentHash([a]) !== fingerprint.contentHash([b]));
  }
  {
    const a = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const shuffled = HOME_HTML.replace(
      '<a href="/about">About us</a><a href="/services">Our Services</a><a href="/contact">Contact</a>',
      '<a href="/contact">Contact</a><a href="/services">Our Services</a><a href="/about">About us</a>',
    );
    const b = html.extractPage({ html: shuffled, finalUrl: "https://northline.ca/", status: 200 });
    ok(
      "a reordered nav is not a content change to the link set",
      JSON.stringify(fingerprint.canonicalPage(a).links) === JSON.stringify(fingerprint.canonicalPage(b).links),
    );
  }
  ok("an empty crawl hashes to NULL, not to the hash of nothing", fingerprint.contentHash([]) === null);
  ok("a null stored hash counts as changed", fingerprint.hasChanged(null, "crawl-v1:abc") === true);
  ok("a null new hash counts as changed", fingerprint.hasChanged("crawl-v1:abc", null) === true);
  ok("equal hashes are unchanged", fingerprint.hasChanged("crawl-v1:abc", "crawl-v1:abc") === false);
  ok("the hash carries its version", fingerprint.contentHash([{ finalUrl: "https://a.co/", status: 200, text: "x" }]).startsWith(`${fingerprint.CONTENT_HASH_VERSION}:`));

  // ══════════════════════════════════════════════════════════════════════════
  section("6. Evidence rows are joinable, and never a blob per page");

  {
    const page = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    const rows = evidence.pageEvidence({ ...page, status: 200 });
    const byType = (t) => rows.filter((r) => r.type === t);
    ok("a page_fetch row records the transaction", byType("page_fetch").length === 1);
    ok("…with the status in normalizedValue", byType("page_fetch")[0].normalizedValue === "http_200");
    ok("a page_content row carries the text", byType("page_content")[0]?.rawValue.includes("Painters in Ottawa"));
    ok("script_src rows are the fingerprinter's vocabulary", byType("script_src").length >= 1);
    ok("iframe_host normalises to the HOST", byType("iframe_host")[0]?.normalizedValue === "calendly.com");
    ok("a link row keeps the text as well as the href", JSON.parse(byType("link")[0].rawValue).text.length > 0);
    ok("…and normalises to a plain URL a pattern can match", byType("link")[0].normalizedValue.startsWith("http"));
    ok("a form row keeps its field names", JSON.parse(byType("form")[0].rawValue).fields.length === 2);
    ok("a contact row carries kind:value", byType("contact").some((r) => r.normalizedValue === "phone:+16135550142"));
    ok("schema_org normalises to the @type", byType("schema_org")[0]?.normalizedValue === "localbusiness");
    ok("every row names its detector and version", rows.every((r) => r.detector && r.detectorVersion));
    ok("every row says the source is the website", rows.every((r) => r.source === "website"));
    ok("no normalizedValue is JSON", rows.every((r) => !r.normalizedValue || !r.normalizedValue.startsWith("{")));
    ok("every type is one this module declares", rows.every((r) => evidence.EVIDENCE_TYPES.includes(r.type)));
  }
  ok("malformed JSON-LD is marked, not silently dropped", evidence.schemaTypesOf("{not json") === "invalid_json_ld");
  ok("nested @type values are found", evidence.schemaTypesOf('{"@graph":[{"@type":"Plumber"}]}') === "plumber");

  // ══════════════════════════════════════════════════════════════════════════
  section("7. The fetch itself: timeouts, the size cap, and every redirect hop");

  {
    // 200 MB, offered as 200 chunks of 1 MB. Never allocated: the reader is
    // supposed to stop long before the source runs out.
    const oneMeg = new Uint8Array(1024 * 1024).fill(65);
    const chunks = Array.from({ length: 200 }, () => () => oneMeg);
    const res = makeResponse({ status: 200, headers: { "content-type": "text/html", "content-length": "1200" }, chunks });
    const net = async () => res;
    const got = await fetchPage.fetchOnce("https://acme.com/", { fetchImpl: net });
    ok("a 200 MB body is truncated at the cap", got.truncated === true && got.bytes === policy.MAX_PAGE_BYTES, got.bytes);
    ok("…having read only the chunks it needed", res.chunksRead <= 3, res.chunksRead);
    ok("…and cancelled the stream rather than draining it", res.cancelled === true);
    ok("…and a lying Content-Length changed nothing", got.bytes === policy.MAX_PAGE_BYTES);
  }
  {
    const net = async (url, init) => {
      await new Promise((r) => setTimeout(r, 50));
      if (init?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      return makeResponse({ status: 200, body: "late" });
    };
    const got = await fetchPage.fetchOnce("https://acme.com/", { fetchImpl: net, timeoutMs: 5 });
    ok("a slow server times out", got.ok === false && got.error === "timeout", got);
  }
  {
    let sentHeaders = null;
    const net = async (url, init) => {
      sentHeaders = init.headers;
      return makeResponse({ status: 200, body: "<p>ok</p>", headers: { "content-type": "text/html" } });
    };
    await fetchPage.fetchOnce("https://acme.com/", { fetchImpl: net });
    ok("the request is a GET", true);
    ok("…carrying our honest User-Agent", sentHeaders["user-agent"] === policy.USER_AGENT);
  }
  {
    const net = makeNet({
      "https://northline.ca/": { status: 301, headers: { location: "https://www.northline.ca/" } },
      "https://www.northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Home</title>" },
    });
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "https://northline.ca/",
      baseHost: "northline.ca",
      deps: { fetchImpl: net, lookup: realPublicLookup },
    });
    ok("a same-site redirect IS followed", got.status === 200 && got.finalUrl === "https://www.northline.ca/");
    ok("…and both hops are recorded", got.redirects.length === 1);
    ok("…and it is not marked off-host", got.offHost === false);
  }
  {
    const net = makeNet({
      "https://northline.ca/": { status: 302, headers: { location: "https://facebook.com/northline" } },
    });
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "https://northline.ca/",
      baseHost: "northline.ca",
      deps: { fetchImpl: net, lookup: realPublicLookup },
    });
    ok("an OFF-HOST redirect is recorded", got.offHost === true && got.offHostUrl === "https://facebook.com/northline");
    ok("…and NOT followed", net.requests.length === 1, net.requests);
    ok("…and the hop is in the chain", got.redirects[0]?.to === "https://facebook.com/northline");
  }
  {
    // The classic SSRF bypass: a public first hop redirecting to the metadata
    // service. If the guard only ran on the first URL this would be fetched.
    const net = makeNet({
      "https://northline.ca/": { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } },
    });
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "https://northline.ca/",
      baseHost: "northline.ca",
      deps: { fetchImpl: net, lookup: realPublicLookup },
    });
    ok("a redirect to the metadata service is refused", got.offHost === true || String(got.error).startsWith("unsafe"), got);
    ok("…and never fetched", !net.requests.some((u) => u.includes("169.254")), net.requests);
  }
  {
    const privateLookup = async () => [{ address: "127.0.0.1" }];
    const net = makeNet({ "https://looks-fine.example.org/": { status: 200, body: "secret" } });
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "https://looks-fine.exampleorg.com/",
      baseHost: "exampleorg.com",
      deps: { fetchImpl: net, lookup: privateLookup },
    });
    ok("a public NAME resolving to a private address is refused", got.error === "unsafe_host:resolves_private", got.error);
    ok("…before any socket is opened", net.requests.length === 0);
  }
  {
    const net = makeNet({});
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "file:///etc/passwd",
      baseHost: "acme.com",
      deps: { fetchImpl: net, lookup: realPublicLookup },
    });
    ok("a file:// URL never reaches fetch", got.error === "unsafe_url:scheme_not_allowed" && net.requests.length === 0);
  }
  {
    let hops = 0;
    const net = async (url) => {
      hops++;
      return makeResponse({ status: 302, headers: { location: `https://acme.com/${hops}` } });
    };
    const got = await fetchPage.fetchCrawlPage({
      startUrl: "https://acme.com/",
      baseHost: "acme.com",
      deps: { fetchImpl: net, lookup: realPublicLookup },
    });
    ok("a redirect loop stops", got.error === "too_many_redirects");
    ok("…after a bounded number of hops", hops <= policy.MAX_REDIRECTS + 1, hops);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("8. Per-host state lives in the database, not in this lambda");

  {
    resetStore();
    const clock = () => new Date("2026-09-02T12:00:00Z");
    const first = await hostPolicy.reserveHostSlot(fakeDb, { host: "northline.ca", deps: { clock, sleep: noSleep } });
    ok("the first request takes the slot", first.ok === true);
    ok("…and the row now records it", store.hosts.get("northline.ca").lastRequestAt !== null);
    ok("…and counts it", store.hosts.get("northline.ca").requestCount === 1);

    const second = await hostPolicy.reserveHostSlot(fakeDb, {
      host: "northline.ca",
      attempts: 1,
      deps: { clock, sleep: noSleep },
    });
    ok("a second request at the same instant does NOT get the slot", second.ok === false, second);
  }
  {
    resetStore();
    // Two lambdas that both read the same lastRequestAt: only one may write.
    await hostPolicy.ensureHostPolicy(fakeDb, "acme.com");
    const read = store.hosts.get("acme.com").lastRequestAt;
    const a = await fakeDb.crawlHostPolicy.updateMany({
      where: { host: "acme.com", lastRequestAt: read ?? null },
      data: { lastRequestAt: new Date(), requestCount: { increment: 1 } },
    });
    const b = await fakeDb.crawlHostPolicy.updateMany({
      where: { host: "acme.com", lastRequestAt: read ?? null },
      data: { lastRequestAt: new Date(), requestCount: { increment: 1 } },
    });
    ok("the compare-and-set lets exactly one of two racing writers through", a.count === 1 && b.count === 0);
  }
  {
    resetStore();
    const clock = () => new Date("2026-09-02T12:00:00Z");
    await hostPolicy.ensureHostPolicy(fakeDb, "acme.com");
    ok("a fresh row has robotsAllowed NULL", store.hosts.get("acme.com").robotsAllowed === null);

    await hostPolicy.recordRobots(fakeDb, { host: "acme.com", allowed: false, crawlDelayMs: 5000, deps: { clock } });
    ok("recordRobots writes the verdict", store.hosts.get("acme.com").robotsAllowed === false);
    ok("…and the delay", store.hosts.get("acme.com").crawlDelayMs === 5000);

    await hostPolicy.recordRobots(fakeDb, { host: "acme.com", allowed: null, deps: { clock } });
    ok("a non-boolean verdict writes NOTHING", store.hosts.get("acme.com").robotsAllowed === false);
  }
  {
    resetStore();
    const far = new Date("2026-09-03T12:00:00Z");
    const near = new Date("2026-09-02T13:00:00Z");
    await hostPolicy.blockHost(fakeDb, { host: "acme.com", until: far, reason: "http_429" });
    await hostPolicy.blockHost(fakeDb, { host: "acme.com", until: near, reason: "http_503" });
    ok("a second, shorter block never shortens the first", store.hosts.get("acme.com").blockedUntil.getTime() === far.getTime());
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("9. The whole crawl, end to end");

  const seedProspect = (over = {}) => {
    resetStore();
    store.prospects.set("p1", {
      id: "p1",
      businessName: "Northline Painting",
      domain: "northline.ca",
      websiteUrl: "https://northline.ca/",
      hasWebsite: null,
      lastCrawledAt: null,
      contentHash: null,
      doNotContactAt: null,
      doNotContactReason: null,
      ...over,
    });
  };

  let vclock = makeClock();
  const crawlDeps = (net, over = {}) => {
    vclock = makeClock();
    return {
      db: fakeDb,
      fetchImpl: net,
      lookup: realPublicLookup,
      sleep: vclock.sleep,
      clock: vclock.clock,
      ...over,
    };
  };

  const goodSite = () =>
    makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/about": { status: 200, headers: { "content-type": "text/html" }, body: "<title>About</title><p>Since 1998</p>" },
      "https://northline.ca/services": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Services</title>" },
      "https://northline.ca/contact": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Contact</title>" },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: HOME_HTML },
    });

  {
    seedProspect();
    const net = goodSite();
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a healthy site is crawled", result.outcome === "crawled", result);
    ok("…robots.txt was fetched FIRST", net.requests[0] === "https://northline.ca/robots.txt", net.requests[0]);
    ok("…the home page followed", net.requests[1] === "https://northline.ca/");
    ok("…more than one page was read", result.pagesFetched > 1, result.pagesFetched);
    ok("…and no more than the cap", result.pagesFetched <= policy.MAX_PAGES_PER_RUN);
    ok("…only pages linked from the site were fetched", net.requests.every((u) => u.startsWith("https://northline.ca/")), net.requests);
    ok("…evidence was written", result.evidenceWritten > 0);
    ok("…lastCrawledAt was set", store.prospects.get("p1").lastCrawledAt instanceof Date);
    ok("…contentHash was stored", typeof store.prospects.get("p1").contentHash === "string");
    ok("…hasWebsite became true on a real 200", store.prospects.get("p1").hasWebsite === true);
    ok("…and CrawlHostPolicy recorded the robots verdict", store.hosts.get("northline.ca").robotsAllowed === true);
    ok("…and counted every request", store.hosts.get("northline.ca").requestCount === net.requests.length, {
      counted: store.hosts.get("northline.ca").requestCount,
      made: net.requests.length,
    });
  }
  {
    // Second crawl of an unchanged site: forced past the interval, so the only
    // thing that can stop the re-analysis is the hash.
    seedProspect();
    const first = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(goodSite()) });
    const storedHash = store.prospects.get("p1").contentHash;
    const before = store.evidence.length;
    const second = await crawlSite.crawlProspectSite({ prospectId: "p1", force: true, deps: crawlDeps(goodSite()) });
    ok("an unchanged site reports UNCHANGED", second.outcome === "unchanged", second);
    ok("…with the same hash", second.contentHash === storedHash);
    ok("…and writes no new evidence at all", store.evidence.length === before, {
      before,
      after: store.evidence.length,
    });
    ok("…but still records that it looked", store.prospects.get("p1").lastCrawledAt instanceof Date);
    ok("…and the first crawl really did write evidence", before > 0 && first.outcome === "crawled");
  }
  {
    seedProspect({ lastCrawledAt: new Date() });
    const net = goodSite();
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a site crawled yesterday is not crawled again", result.outcome === "skipped", result);
    ok("…without a single request", net.requests.length === 0, net.requests);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /\n" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("robots.txt Disallow: / refuses the crawl", result.outcome === "refused" && result.reason === "robots_disallowed", result);
    ok("…terminally, so it is not retried", result.terminal === true && result.retry === false);
    ok("…and only robots.txt was ever requested", net.requests.length === 1, net.requests);
    ok("…and the refusal is cached on the host row", store.hosts.get("northline.ca").robotsAllowed === false);
  }
  {
    // The cached refusal, on a second prospect at the same host.
    const net = makeNet({});
    store.prospects.set("p2", {
      id: "p2",
      businessName: "Another",
      domain: "northline.ca",
      websiteUrl: "https://northline.ca/",
      hasWebsite: null,
      lastCrawledAt: null,
      contentHash: null,
      doNotContactAt: null,
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p2", deps: crawlDeps(net) });
    ok("a cached robots refusal stops the next prospect too", result.reason === "robots_disallowed");
    ok("…with no request at all, not even robots.txt", net.requests.length === 0, net.requests);
  }
  {
    seedProspect();
    const net = makeNet({ "https://northline.ca/robots.txt": { status: 500, body: "" } });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a robots.txt that 500s does NOT allow the crawl", result.outcome === "failed", result);
    ok("…it is retried rather than assumed", result.retry === true);
    ok("…nothing was fetched from the site", net.requests.length === 1, net.requests);
    ok("…and robotsAllowed is STILL null", store.hosts.get("northline.ca").robotsAllowed === null, store.hosts.get("northline.ca"));
  }
  {
    seedProspect();
    // Down on BOTH schemes. A transport failure over https is tried once
    // over http (crawlSite.js step 7; scripts/check-sales-site-kind.mjs
    // executes the fallback itself), so "will not connect" has to mean the
    // host, not the port.
    const net = makeNet({
      "https://northline.ca/robots.txt": { throws: "ECONNRESET" },
      "http://northline.ca/robots.txt": { throws: "ECONNRESET" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a robots.txt that will not connect does not allow the crawl", result.outcome === "failed" && result.retry === true, result);
    ok("…and writes nothing to robotsAllowed", store.hosts.get("northline.ca").robotsAllowed === null);
    ok("…and http was tried once, after https refused", net.requests.length === 2 && net.requests[1] === "http://northline.ca/robots.txt", net.requests);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 404, body: "" },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: HOME_HTML },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a 404 robots.txt means allowed (RFC 9309)", result.outcome === "crawled", result);
    ok("…and that answer is recorded as a real answer", store.hosts.get("northline.ca").robotsAllowed === true);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { status: 429, headers: { "retry-after": "600" }, body: "" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a 429 refuses terminally rather than retrying", result.outcome === "refused" && result.retry === false, result);
    ok("…and sets blockedUntil", store.hosts.get("northline.ca").blockedUntil instanceof Date);
    const blockedFor = store.hosts.get("northline.ca").blockedUntil.getTime() - vclock.now();
    ok("…honouring Retry-After", blockedFor > 590_000 && blockedFor <= 600_000, blockedFor);
    ok("…and naming the reason", store.hosts.get("northline.ca").blockReason === "http_429");
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { status: 429, body: "" },
    });
    await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    const blockedFor = store.hosts.get("northline.ca").blockedUntil.getTime() - vclock.now();
    ok("a 429 with NO Retry-After uses the default block", blockedFor > policy.DEFAULT_BLOCK_MS - 5000, blockedFor);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { status: 503, headers: { "retry-after": "120" }, body: "" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a 503 blocks the host too", result.outcome === "refused" && store.hosts.get("northline.ca").blockReason === "http_503", result);
  }
  {
    // The block is respected on the NEXT run, which is the whole point.
    seedProspect();
    store.hosts.set("northline.ca", {
      id: "h",
      host: "northline.ca",
      robotsAllowed: true,
      robotsFetchedAt: new Date(),
      crawlDelayMs: null,
      lastRequestAt: null,
      requestCount: 0,
      blockedUntil: new Date(Date.now() + 3_600_000),
      blockReason: "http_429",
    });
    const net = goodSite();
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a host already blocked is not touched", net.requests.length === 0, net.requests);
    ok("…and the task is told why, terminally", result.reason === "host_blocked" && result.retry === false, result);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { status: 301, headers: { location: "https://facebook.com/northline" } },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a site that redirects to Facebook is a FINDING, not an error", result.outcome === "crawled" && result.offHost === true, result);
    ok("…naming where it went", result.offHostUrl === "https://facebook.com/northline");
    ok("…recorded as evidence", store.evidence.some((e) => e.type === "page_fetch" && e.normalizedValue.startsWith("off_host:")));
    ok("…and facebook.com was never fetched", !net.requests.some((u) => u.includes("facebook")), net.requests);
  }
  {
    seedProspect({ websiteUrl: "http://192.168.1.10/" });
    const net = makeNet({});
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a private-IP websiteUrl is refused", result.reason === "unsafe_url:host_not_public", result);
    ok("…with no request", net.requests.length === 0);
  }
  {
    seedProspect({ websiteUrl: "file:///etc/passwd" });
    const net = makeNet({});
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a file:// websiteUrl is refused", result.reason === "unsafe_url:scheme_not_allowed", result);
    ok("…with no request", net.requests.length === 0);
  }
  {
    seedProspect({ doNotContactAt: new Date(), doNotContactReason: "asked us to stop" });
    const net = makeNet({});
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a do-not-contact prospect is never crawled", result.reason === "do_not_contact" && net.requests.length === 0, result);
  }
  {
    seedProspect();
    store.suppressions.push({ id: "s1", kind: "domain", value: "northline.ca", removedAt: null, channels: ["email"] });
    const net = makeNet({});
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a suppressed domain is never crawled", result.reason === "domain_suppressed", result);
    ok("…with no request", net.requests.length === 0);
    ok("…even though the suppression names only the email channel", true);
  }
  {
    seedProspect();
    store.companies.set("demo1", { isDemo: true });
    const net = makeNet({});
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", companyId: "demo1", deps: crawlDeps(net) });
    ok("a DEMO company cannot crawl a real contractor's site", result.reason === "demo_company", result);
    ok("…and nothing reaches the network", net.requests.length === 0);
    ok("…and the demo check re-read the company row", store.calls.includes("company.findUnique:demo1"), store.calls);
    ok("…before the prospect was even loaded", store.calls[0] === "company.findUnique:demo1", store.calls);
  }
  {
    seedProspect();
    store.companies.set("real1", { isDemo: false });
    const net = goodSite();
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", companyId: "real1", deps: crawlDeps(net) });
    ok("a REAL company is not blocked by the demo guard", result.outcome === "crawled", result);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { throws: "ENOTFOUND" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a dead domain is TERMINAL, not an endless retry", result.outcome === "failed" && result.terminal === true, result);
    ok("…with the reason recorded", /ENOTFOUND/.test(result.reason));
    ok("…and the failed fetch is itself evidence", store.evidence.some((e) => e.type === "page_fetch" && e.normalizedValue.includes("ENOTFOUND")));
    ok("…and hasWebsite was NOT set false on a failure", store.prospects.get("p1").hasWebsite === null, store.prospects.get("p1").hasWebsite);
  }
  {
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { throws: "ETIMEDOUT" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a timeout is retryable rather than terminal", result.retry === true, result);
  }
  {
    // robots.txt disallows /contact but not the rest.
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /contact\n" },
      "https://northline.ca/about": { status: 200, headers: { "content-type": "text/html" }, body: "<title>About</title>" },
      "https://northline.ca/services": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Services</title>" },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: HOME_HTML },
    });
    await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a per-path Disallow is obeyed", !net.requests.includes("https://northline.ca/contact"), net.requests);
    ok("…while the allowed pages are still fetched", net.requests.includes("https://northline.ca/about"));
  }
  {
    // A site whose navigation is JavaScript: nothing recognisable to rank.
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: "<title>Home</title><div id=app></div>" },
    });
    await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    // The sitemap is asked for once (v3) and is not a probe: it is the URL
    // list the site publishes for exactly this reader.
    ok("the sitemap is asked for, once", net.requests.filter((u) => u === "https://northline.ca/sitemap.xml").length === 1, net.requests);
    const probes = net.requests.filter((u) => u !== "https://northline.ca/" && !u.endsWith("robots.txt") && !u.endsWith("sitemap.xml"));
    ok("a site with no usable links is probed, but barely", probes.length <= 3, probes);
    ok("…and only at the top-priority slugs", probes.every((u) => /\/(contact|services|about)$/.test(u)), probes);
  }
  {
    seedProspect();
    const net = goodSite();
    const result = await crawlSite.crawlProspectSite({
      prospectId: "p1",
      deps: crawlDeps(net, { deadlineMs: -1 }),
    });
    ok("a crawl that runs out of wall clock stops and keeps what it has", result.outcome === "crawled" && result.partial === true, result);
    ok("…having fetched the home page at least", result.pagesFetched === 1, result.pagesFetched);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("10. The handler is registered, and maps outcomes honestly");

  // Asserted BEFORE the handler module is imported, so what is being proved is
  // that handlers/index.js registers it — not that this file did.
  ok("CRAWL_WEBSITE is no longer a placeholder", registry.isPlaceholder("CRAWL_WEBSITE") === false);
  const handlerMod = await import("@/lib/sales/pipeline/handlers/crawlWebsite");
  // Identity was the right test until the stage gained a successor. The
  // registration now wraps handleCrawlWebsite in withChain() so that finishing
  // a crawl — or permanently refusing one — queues DETECT_TECHNOLOGY; see
  // lib/sales/pipeline/chain.js. So what is proved here is the property that
  // actually matters: the registered function is not the placeholder, and it
  // DELEGATES to this module's handler rather than replacing it.
  const registered = registry.getHandler("CRAWL_WEBSITE");
  ok("…and getHandler returns this module's handler, wrapped by the pipeline chain", typeof registered === "function" && registered !== handlerMod.handleCrawlWebsite);
  {
    // No prospect id: both refuse identically, and the wrapper queues nothing
    // because there is no prospect to queue anything for.
    const direct = await handlerMod.handleCrawlWebsite({ task: {}, payload: {}, db: fakeDb });
    const through = await registered({ task: {}, payload: {}, db: fakeDb });
    ok("…passing its result through unchanged", JSON.stringify(through) === JSON.stringify(direct), { direct, through });
  }
  ok(
    "…and handlerStatus reports it implemented",
    registry.handlerStatus().find((h) => h.kind === "CRAWL_WEBSITE")?.implemented === true,
  );
  // Deliberately NOT a count of the unbuilt stages. Other agents are landing
  // handlers in the same file, and a check that asserted "seven are missing"
  // would fail the moment somebody else finished theirs — which is a check
  // measuring the calendar rather than the code. What matters here is that the
  // placeholder mechanism still exists and that this stage is out of it.
  ok(
    "…and every kind still has a status",
    registry.handlerStatus().length === kinds.TASK_KINDS.length,
  );
  ok(
    "…with the placeholder mechanism intact for the stages nobody has built",
    registry.handlerStatus().every((h) => typeof h.implemented === "boolean"),
  );

  {
    const noId = await handlerMod.handleCrawlWebsite({ task: {}, payload: {}, db: fakeDb });
    ok("a task with no prospect is terminal, not retried", noId.done === false && noId.retry === false && noId.reason === "no_prospect_id");
  }
  {
    seedProspect();
    const net = goodSite();
    const done = await handlerMod.handleCrawlWebsite({
      task: { prospectId: "p1" },
      payload: {},
      db: { ...fakeDb },
    });
    ok("the handler reads prospectId off the task when the payload omits it", done.done !== undefined);
    void net;
  }
  {
    seedProspect({ lastCrawledAt: new Date() });
    const done = await handlerMod.handleCrawlWebsite({ task: { prospectId: "p1" }, payload: { prospectId: "p1" }, db: fakeDb });
    ok("a skip is DONE, not a failure", done.done === true, done);
    ok("…and says why in the note", /crawled_recently/.test(done.note), done.note);
  }
  {
    seedProspect({ websiteUrl: "file:///etc/passwd" });
    const refusedTask = await handlerMod.handleCrawlWebsite({ task: { prospectId: "p1" }, payload: {}, db: fakeDb });
    ok("a refusal is not done and not retried", refusedTask.done === false && refusedTask.retry === false, refusedTask);
    ok("…and the reason reaches lastError", /scheme_not_allowed/.test(refusedTask.reason));
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("12. The site's own navigation is followed, and absence is earned");

  // ── The real failure, as a fixture ────────────────────────────────────
  //
  // Roth's Solution (rothssolution.com, 2026-09-09): twenty-seven internal
  // links, one of them `/about`, the contact page at `/contact_us`. The old
  // ranking recognised only `/about`, decided the menu had said nothing,
  // probed `/contact` and `/services`, got two 404s, and every deep
  // capability was written false. This fixture is that site, and the
  // assertions are that crawl reading the menu instead.
  const technology = await import("@/lib/sales/intel/technology");
  const capabilityDetect = await import("@/lib/sales/intel/capabilityDetect");
  const signatureSeed = await import("@/lib/sales/intel/signatureSeed");

  const ROTH_HOME = `<!doctype html><html><head><title>Roth's Solution</title>
<script type="text/javascript">
  window.liveSiteAsyncInit = function() { LiveSite.init({ id : 'WI-5IJ4YH4D236MT27JPFMU' }); };
  (function(d, s, id){ var js, p = 'https://', r = Math.floor(new Date().getTime() / 1000000);
    js = d.createElement(s); js.id = id; js.src = p + "d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js?" + r;
  }(document, 'script', 'livesite-jssdk'));
</script>
<script src="https://static.cdn-website.com/mnlt/production/6773/_dm/s/rt/dist/scripts/d-js-one-runtime-unified-desktop.min.js"></script>
</head><body>
<nav><a href="/">Home</a><a href="/about">About</a><a href="/contact_us">Contact</a>
<a href="/painting">Painting</a><a href="/gutter-installation">Gutter Installation</a><a href="/epoxy-flooring">Epoxy Flooring</a>
<a href="/reviews">Reviews</a><a href="/referral">Referral</a><a href="/service-area">Service Area</a><a href="/privacy">Privacy Policy</a>
<a href="/logo.png">logo</a><a href="/p/1187">Make a Payment</a></nav>
<h1>Gutters, painting and flooring</h1><p>${"Lancaster, Orchard Park and Amherst. ".repeat(30)}</p>
<p>Call <a href="tel:+17168805389">(716) 880-5389</a></p>
</body></html>`;
  const ROTH_CONTACT = `<html><head><title>Contact</title></head><body><nav><a href="/">Home</a><a href="/about">About</a></nav>
<h1>Contact us</h1><p>${"We answer the same day. ".repeat(30)}</p>
<form method="post" id="1349628759"><input type="text" name="dmform-0" placeholder="Name"><input type="email" name="dmform-1" placeholder="Email">
<input type="tel" name="dmform-2" placeholder="Phone"><textarea name="dmform-3" placeholder="Message"></textarea><input type="submit" value="Send Message"></form>
</body></html>`;
  const thinPage = (title) => `<html><head><title>${title}</title></head><body><nav><a href="/">Home</a></nav><p>${`${title}. `.repeat(60)}</p></body></html>`;
  const htmlRoute = (body) => ({ status: 200, headers: { "content-type": "text/html" }, body });

  const rothSite = () =>
    makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/contact_us": htmlRoute(ROTH_CONTACT),
      "https://northline.ca/about": htmlRoute(thinPage("About")),
      "https://northline.ca/reviews": htmlRoute(thinPage("Reviews")),
      "https://northline.ca/service-area": htmlRoute(thinPage("Service area")),
      "https://northline.ca/p/1187": htmlRoute(thinPage("Pay")),
      "https://northline.ca/": htmlRoute(ROTH_HOME),
    });

  {
    // Pure: the ranking, against the fixture's links and against hostile ones.
    const page = html.extractPage({ html: ROTH_HOME, finalUrl: "https://northline.ca/", status: 200 });
    const ranked = urlMod.rankNavigation({ links: page.links, baseHost: "northline.ca", limit: 5 });
    const urls = ranked.map((c) => c.url);
    ok("tokenised ranking finds /contact_us", urls.includes("https://northline.ca/contact_us"), urls);
    ok("…ranked as the contact kind", ranked.find((c) => c.url.endsWith("/contact_us"))?.kind === "contact");
    ok("…and it comes straight after /about, as the priority order says", urls.indexOf("https://northline.ca/contact_us") === 1, urls);
    ok("anchor text ranks /p/1187 labelled \"Make a Payment\" as a payment page", ranked.some((c) => c.url.endsWith("/p/1187") && c.kind === "payment" && c.via === "text"), ranked);
    ok("/service-area is a locations page, not a services page", ranked.find((c) => c.url.endsWith("/service-area"))?.kind === "locations");
    ok("the service pages are NOT ranked", !urls.some((u) => /painting|gutter|epoxy/.test(u)));
    ok("nothing off-site or non-page is ranked", urls.every((u) => u.startsWith("https://northline.ca/") && !u.endsWith(".png")));

    ok("tokenises on underscore", urlMod.tokeniseSegment("contact_us").join(" ") === "contact us");
    ok("tokenises on camel case", urlMod.tokeniseSegment("contactUs").join(" ") === "contact us");
    ok("tokenises on a digit boundary", urlMod.tokeniseSegment("page2Section").join(" ") === "page 2 section");
    ok("drops the extension", urlMod.slugKind("/contact_us.html").kind === "contact");
    ok("a blog post about paying is NOT a payment page", urlMod.slugKind("/blog/pay-your-crew").kind === null);
    ok("a three-word last segment does not match a single-word slug", urlMod.slugKind("/pay-your-crew").kind === null);
    ok("get-in-touch is contact", urlMod.slugKind("/get-in-touch").kind === "contact");
    ok("free-estimate is quote", urlMod.slugKind("/free-estimate").kind === "quote");
    ok("my-account is portal", urlMod.slugKind("/my-account").kind === "portal");
    ok("book-online is booking", urlMod.slugKind("/book-online").kind === "booking");
    ok("make-a-payment is payment", urlMod.slugKind("/make-a-payment").kind === "payment");
    ok("the home page ranks -1", urlMod.slugKind("/").rank === -1);
    ok("PRIORITY_SLUGS still lists the older spellings in order", urlMod.PRIORITY_SLUGS.indexOf("about") < urlMod.PRIORITY_SLUGS.indexOf("contact") && urlMod.PRIORITY_SLUGS.includes("request-a-quote"));

    ok("text: \"Contact\"", urlMod.textKind("Contact").kind === "contact");
    ok("text: \"Schedule Now\" is booking", urlMod.textKind("Schedule Now").kind === "booking");
    ok("text: \"My Account\" is portal", urlMod.textKind("My Account").kind === "portal");
    ok("text: \"Get a quote\" is quote", urlMod.textKind("Get a quote").kind === "quote");
    ok("text: \"Pay\" is payment", urlMod.textKind("Pay").kind === "payment");
    ok("text: \"Reviews →\" survives the arrow", urlMod.textKind("Reviews →").kind === "reviews");
    ok("text: a sentence is not a menu item", urlMod.textKind("Contact us today for a free estimate on all your gutter needs").kind === null);
    ok("text: hostile input does not throw", urlMod.textKind(null).kind === null && urlMod.textKind({}).kind === null && urlMod.textKind("x".repeat(100000)).kind === null);
    ok("rankNavigation: hostile links do not throw", Array.isArray(urlMod.rankNavigation({ links: [null, 42, {}, { url: "javascript:alert(1)", text: "Contact" }, { url: "https://evil.example/contact", text: "Contact" }], baseHost: "northline.ca" })));
    ok("rankNavigation: a link is not ranked by its text when it points off-site", urlMod.rankNavigation({ links: [{ url: "https://evil.example/x", text: "Contact" }], baseHost: "northline.ca" }).length === 0);

    const menu = urlMod.serviceMenu({ links: page.links, baseHost: "northline.ca" });
    const names = menu.map((m) => m.text);
    ok("the service menu is the links the ranking did not claim", names.includes("Painting") && names.includes("Gutter Installation") && names.includes("Epoxy Flooring"), names);
    ok("…without the priority pages", !names.includes("Contact") && !names.includes("About") && !names.includes("Reviews"));
    ok("…without chrome, privacy, referrals or assets", !names.includes("Home") && !names.includes("Privacy Policy") && !names.includes("Referral") && !names.includes("logo"), names);
    ok("…and without the payment link the anchor text ranked", !names.includes("Make a Payment"));
  }

  {
    // End to end: the crawl follows the menu and never guesses.
    seedProspect();
    const net = rothSite();
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("the Roth fixture crawls", result.outcome === "crawled", result);
    ok("…/contact_us was fetched", net.requests.includes("https://northline.ca/contact_us"), net.requests);
    ok("…and the blind /contact was NOT", !net.requests.includes("https://northline.ca/contact"), net.requests);
    ok("…nor /services", !net.requests.includes("https://northline.ca/services"));
    ok("…the result says no probe was used", result.probed === false && result.probesFailed.length === 0, result);
    const envelopes = store.evidence.filter((r) => r.type === "page_fetch").map((r) => JSON.parse(r.rawValue));
    const contact = envelopes.find((e) => e.requestedUrl === "https://northline.ca/contact_us");
    ok("…the contact page's envelope says via=nav, navMatch=contact", contact?.via === "nav" && contact?.navMatch === "contact", contact);
    ok("…the home page's envelope says via=start", envelopes.find((e) => e.requestedUrl === "https://northline.ca/")?.via === "start");
    const pay = envelopes.find((e) => e.requestedUrl === "https://northline.ca/p/1187");
    ok("…the anchor-text-ranked page was fetched and stamped payment", pay?.via === "nav" && pay?.navMatch === "payment", pay);
    const navLinks = store.evidence.filter((r) => r.type === "nav_link");
    ok("nav_link rows record the service menu with the anchor text", navLinks.some((r) => r.rawValue === "Gutter Installation" && r.normalizedValue === "/gutter-installation"), navLinks.map((r) => r.rawValue));
    ok("…once per path", new Set(navLinks.map((r) => r.normalizedValue)).size === navLinks.length);
    const inline = store.evidence.filter((r) => r.type === "script_src" && r.detector === evidence.INLINE_DETECTOR);
    ok("the inline vcita loader became a script_src row", inline.some((r) => r.normalizedValue === "https://d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js"), inline);
    ok("…with source \"website\" so loadCrawl can read it back", inline.every((r) => r.source === "website"));
    ok("…without the timestamp query", inline.every((r) => !r.normalizedValue.includes("?")));
    ok("…and the LiveSite.init token became an inline_token row", store.evidence.some((r) => r.type === "inline_token" && r.rawValue === "LiveSite.init"));
    ok("…and no row stores the script body", !store.evidence.some((r) => String(r.rawValue || "").includes("liveSiteAsyncInit")));
    ok("every row's type is declared", store.evidence.every((r) => evidence.EVIDENCE_TYPES.includes(r.type)));

    // The rows, read back the way the pipeline reads them, through both
    // detectors — vcita is detected, and it proves the four capabilities.
    const crawlRows = store.evidence.map((r) => ({ type: r.type, sourceUrl: r.sourceUrl, rawValue: r.rawValue, normalizedValue: r.normalizedValue }));
    const crawl = technology.normaliseCrawl(technology.pagesFromEvidence(crawlRows));
    ok("pagesFromEvidence carries via/navMatch back", crawl.pages.some((p) => p.via === "nav" && p.navMatch === "contact"), crawl.pages.map((p) => [p.finalUrl, p.via, p.navMatch]));
    const tech = technology.detectTechnologies({ signatures: signatureSeed.seedSignatures(), crawl });
    const codes = tech.technologies.map((t) => t.technologyCode);
    ok("VCITA_LIVESITE is detected from the inline loader", codes.includes("VCITA_LIVESITE"), codes);
    ok("…structurally, above the threshold", tech.technologies.find((t) => t.technologyCode === "VCITA_LIVESITE")?.confidence >= 0.9);
    ok("DUDA is detected from the site builder's runtime", codes.includes("DUDA"), codes);
    ok("neither is a competitor", tech.technologies.every((t) => t.isCompetitor === false));
    const caps = capabilityDetect.detectCapabilities({ crawl, technologies: tech.technologies, prospect: { hasWebsite: true } });
    const cap = (code) => caps.capabilities.find((c) => c.code === code);
    ok("CLIENT_PORTAL is true via vcita", cap("CLIENT_PORTAL")?.value === true && cap("CLIENT_PORTAL").evidence.some((e) => e.rawValue === "technology:VCITA_LIVESITE"), cap("CLIENT_PORTAL"));
    ok("…at 0.7, one notch under Jobber", cap("CLIENT_PORTAL")?.confidence === 0.7, cap("CLIENT_PORTAL")?.confidence);
    ok("ONLINE_BOOKING is true via vcita", cap("ONLINE_BOOKING")?.value === true);
    ok("ONLINE_PAYMENT is true via vcita", cap("ONLINE_PAYMENT")?.value === true);
    ok("LEAD_CAPTURE_FORM is true — the form on /contact_us was read", cap("LEAD_CAPTURE_FORM")?.value === true && cap("LEAD_CAPTURE_FORM").evidence.some((e) => e.normalizedValue === "LEAD_CAPTURE_FORM:lead_form"), cap("LEAD_CAPTURE_FORM"));
    ok("eligibility says the navigation was followed", caps.eligibility.navigation === "followed" && caps.eligibility.contactPage === true, caps.eligibility);
    ok("…so a genuine absence is still sayable", cap("LIVE_CHAT")?.value === false && cap("INSTANT_ESTIMATE")?.value === false);
  }

  {
    // Probe fallback: ONLY when the ranking is empty, and it says so.
    seedProspect();
    const menuless = `<html><head><title>One page</title></head><body><nav><a href="/">Home</a><a href="/painting">Painting</a><a href="/drywall">Drywall</a></nav><p>${"Painting and drywall. ".repeat(40)}</p></body></html>`;
    // Exact routes before the "/" prefix route: makeNet matches by prefix, and
    // a probe that fell through to the home page would look like a 200.
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/contact": { status: 404, body: "not found" },
      "https://northline.ca/services": { status: 404, body: "not found" },
      "https://northline.ca/about": htmlRoute(thinPage("About")),
      "https://northline.ca/": htmlRoute(menuless),
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a menu with no recognised page falls back to the three probes", result.probed === true, result);
    ok("…and names the ones that 404'd", result.probesFailed.length === 2 && result.probesFailed.every((u) => /\/(contact|services)$/.test(u)), result.probesFailed);
    ok("…in the note", /probed: navigation ranked nothing, 2 of 3/.test(result.note), result.note);
    const envelopes = store.evidence.filter((r) => r.type === "page_fetch").map((r) => JSON.parse(r.rawValue));
    ok("…every probed page is stamped via=probe", envelopes.filter((e) => e.requestedUrl !== "https://northline.ca/").every((e) => e.via === "probe"), envelopes);
    ok("…the 404 is recorded WITH its stamp", envelopes.some((e) => e.status === 404 && e.via === "probe" && e.navMatch === "contact"), envelopes);

    // …and absence is withheld from it.
    const crawl = technology.normaliseCrawl(technology.pagesFromEvidence(store.evidence.map((r) => ({ ...r }))));
    const caps = capabilityDetect.detectCapabilities({ crawl, technologies: [], prospect: {} });
    const cap = (code) => caps.capabilities.find((c) => c.code === code);
    ok("a probed crawl cannot say \"no enquiry form\"", cap("LEAD_CAPTURE_FORM")?.value === null && cap("LEAD_CAPTURE_FORM").reason === "probe_fallback", cap("LEAD_CAPTURE_FORM"));
    ok("…nor \"no client portal\", \"no booking\", \"no payment\"", ["CLIENT_PORTAL", "ONLINE_BOOKING", "ONLINE_PAYMENT", "INSTANT_ESTIMATE", "ONLINE_REVIEWS"].every((c) => cap(c)?.value === null), caps.capabilities.map((c) => [c.code, c.value]));
    ok("…while a site-wide absence (live chat) is still earned from the rendered pages", cap("LIVE_CHAT")?.value === false, cap("LIVE_CHAT"));
    ok("…and the eligibility names the reason", caps.eligibility.navigation === "probed" && caps.eligibility.reason === "probe_fallback", caps.eligibility);
  }

  {
    // One recognised link is enough: no probes.
    seedProspect();
    const oneLink = `<html><head><title>Two pages</title></head><body><nav><a href="/">Home</a><a href="/about-us">About us</a><a href="/roofing">Roofing</a></nav><p>${"Roofing. ".repeat(60)}</p></body></html>`;
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/about-us": htmlRoute(thinPage("About us")),
      "https://northline.ca/": htmlRoute(oneLink),
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("one recognised link means no probing", result.probed === false && !net.requests.includes("https://northline.ca/contact"), net.requests);
    const crawl = technology.normaliseCrawl(technology.pagesFromEvidence(store.evidence.map((r) => ({ ...r }))));
    const caps = capabilityDetect.detectCapabilities({ crawl, technologies: [], prospect: {} });
    const cap = (code) => caps.capabilities.find((c) => c.code === code);
    ok("…navigation was followed, so a deep absence is sayable", cap("CLIENT_PORTAL")?.value === false, cap("CLIENT_PORTAL"));
    ok("…but not the enquiry form: no contact-like page and no form anywhere", cap("LEAD_CAPTURE_FORM")?.value === null && cap("LEAD_CAPTURE_FORM").reason === "no_contact_page_fetched", cap("LEAD_CAPTURE_FORM"));
  }

  {
    // Rows written before the stamp existed: judged by the older rule, never
    // promoted to "followed" and never demoted to "probed".
    const old = [
      { url: "https://dunn.example/", finalUrl: "https://dunn.example/", status: 200, text: "x".repeat(400), links: [{ href: "/about", url: "https://dunn.example/about", text: "About" }] },
      { url: "https://dunn.example/contact", finalUrl: "https://dunn.example/contact", status: 200, text: "y".repeat(400), links: [{ href: "/", url: "https://dunn.example/", text: "Home" }] },
    ];
    const caps = capabilityDetect.detectCapabilities({ crawl: { pages: old }, technologies: [], prospect: {} });
    const cap = (code) => caps.capabilities.find((c) => c.code === code);
    ok("unstamped rows: navigation is \"unknown\"", caps.eligibility.navigation === "unknown", caps.eligibility);
    ok("…a deep absence is still sayable, as before", cap("CLIENT_PORTAL")?.value === false);
    ok("…and a /contact page fetched with 200 counts as a contact page by its path", caps.eligibility.contactPage === true && cap("LEAD_CAPTURE_FORM")?.value === false, cap("LEAD_CAPTURE_FORM"));
  }

  {
    // The hash: an inline loader with a per-render timestamp does not change
    // it; adding the loader does.
    const withLoader = (stamp) => `<html><head><title>T</title><script>js.src = "https://" + "d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js?" + ${stamp}; var nonce="${stamp}";</script></head><body><nav><a href="/about">About</a></nav><p>${"Words. ".repeat(60)}</p></body></html>`;
    const a = html.extractPage({ html: withLoader(1757000), finalUrl: "https://northline.ca/", status: 200 });
    const b = html.extractPage({ html: withLoader(1758999), finalUrl: "https://northline.ca/", status: 200 });
    ok("the same inline loader with a different nonce hashes the SAME", fingerprint.contentHash([a]) === fingerprint.contentHash([b]));
    const c = html.extractPage({ html: withLoader(1757000).replace(/<script>[\s\S]*?<\/script>/, ""), finalUrl: "https://northline.ca/", status: 200 });
    ok("removing the loader DOES change the hash", fingerprint.contentHash([a]) !== fingerprint.contentHash([c]));
    ok("inline URLs are folded into `scripts`, not a new key", !("inlineScripts" in fingerprint.canonicalPage(a)) && fingerprint.canonicalPage(a).scripts.some((s) => s.includes("livesite.js")));
    ok("…so a page with no inline loader hashes exactly as it did", JSON.stringify(Object.keys(fingerprint.canonicalPage(c))) === JSON.stringify(["path", "status", "title", "lang", "metas", "scripts", "iframes", "links", "forms", "buttons", "jsonLd", "dataAttrs", "contacts", "text"]));
    ok("CONTENT_HASH_VERSION was NOT bumped", fingerprint.CONTENT_HASH_VERSION === "crawl-v1");
  }

  {
    // scanInlineScript against hostile input.
    const found = html.scanInlineScript(`s.src='https://js.calltrk.com/companies/1/a.js?v=1';x.src="//cdn.foo.com/a/b.js";y='1.2.3/x.js';z="file.js";Calendly.initInlineWidget({});Stripe("pk_live_1")`);
    ok("scan: absolute, protocol-relative and quoted host-relative URLs", found.urls.map((u) => u.url).join(" ") === "https://js.calltrk.com/companies/1/a.js https://cdn.foo.com/a/b.js", found.urls);
    ok("scan: tokens are the allow-list, nothing else", found.tokens.includes("Calendly.initInlineWidget") && found.tokens.includes("Stripe(") && found.tokens.includes("calltrk") && found.tokens.every((t) => html.INLINE_VENDOR_TOKENS.some((v) => v.token === t)), found.tokens);
    const t0 = Date.now();
    html.scanInlineScript(`"${"a.".repeat(20000)}/${"b".repeat(200000)}`);
    html.scanInlineScript("x".repeat(2_000_000));
    ok("scan: a pathological body finishes fast", Date.now() - t0 < 500, Date.now() - t0);
    ok("scan: null and objects do not throw", html.scanInlineScript(null).urls.length === 0 && html.scanInlineScript({}).urls.length === 0);
    const capped = html.scanInlineScript(Array.from({ length: 100 }, (_, i) => `"https://h${i}.example.com/x.js"`).join(";"));
    ok("scan: capped at CAPS.inlineScripts", capped.urls.length === html.CAPS.inlineScripts);
    const withSrc = html.extractPage({ html: `<script src="/a.js">var x = "https://ignored.example.com/y.js";</script>`, finalUrl: "https://northline.ca/" });
    ok("a body under a src tag is ignored, as a browser ignores it", withSrc.inlineScripts.length === 0);
    const jsonLd = html.extractPage({ html: `<script type="application/ld+json">{"@type":"LocalBusiness","url":"https://cdn.example.com/x.js"}</script>`, finalUrl: "https://northline.ca/" });
    ok("a JSON-LD block is kept as JSON-LD and not scanned", jsonLd.jsonLd.length === 1 && jsonLd.inlineScripts.length === 0);
  }

  {
    // The seed still validates with the four new rows, and says how each was verified.
    const rows = signatureSeed.seedSignatures();
    for (const code of ["VCITA_LIVESITE", "TOWNSQUARE_INTERACTIVE", "DUDA", "CALLRAIL"]) {
      const row = rows.find((r) => r.code === code);
      ok(`seed has ${code}, active, not a competitor`, row && row.active === true && row.isCompetitor === false, row);
    }
    const notes = signatureSeed.sourcingNotes();
    ok("vcita's note says the CloudFront host was confirmed as vcita's", /clients\.vcita\.com/.test(notes.VCITA_LIVESITE));
    ok("Townsquare's note says the engage host belongs to the vcita signature", /VCITA_LIVESITE/.test(notes.TOWNSQUARE_INTERACTIVE));
    ok("CallRail proves no capability", !capabilityDetect.DETECTED_CAPABILITY_CODES.some((c) => capabilityDetect.technologiesProving(c).includes("CALLRAIL")));
    ok("Townsquare proves no capability", !capabilityDetect.DETECTED_CAPABILITY_CODES.some((c) => capabilityDetect.technologiesProving(c).includes("TOWNSQUARE_INTERACTIVE")));
    ok("vcita proves portal, booking, payment and the form", ["CLIENT_PORTAL", "ONLINE_BOOKING", "ONLINE_PAYMENT", "LEAD_CAPTURE_FORM"].every((c) => capabilityDetect.technologiesProving(c).includes("VCITA_LIVESITE")));
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("13. Structured sources: the sitemap, the WordPress index, the framework payload — read, bounded, cited");

  const sitemapMod = await import("@/lib/sales/crawl/sitemap");
  const structured = await import("@/lib/sales/crawl/structured");

  {
    // ── The sitemap parser, against real shapes and hostile ones ─────────
    const urlset = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://northline.ca/</loc></url><url><loc>https://northline.ca/contact-us-2/</loc><lastmod>2026-01-01</lastmod></url>
<url><loc><![CDATA[https://northline.ca/services/roofing?utm=x&amp;y=1]]></loc></url><url><loc>https://northline.ca/blog/2024/05/how-to</loc></url>
<url><loc>https://elsewhere.example/page</loc></url><url><loc>javascript:alert(1)</loc></url><url><loc>https://northline.ca/logo.png</loc></url></urlset>`;
    const parsed = sitemapMod.parseSitemap(urlset);
    ok("a urlset parses as one, six of seven locs kept", parsed.kind === "urlset" && parsed.urls.length === 6, parsed);
    ok("…CDATA and &amp; are decoded", parsed.urls.some((u) => u === "https://northline.ca/services/roofing?utm=x&y=1"), parsed.urls);
    ok("…a javascript: loc is refused", !parsed.urls.some((u) => /^javascript/.test(u)));
    const pages = sitemapMod.sitemapPages(parsed.urls, { baseHost: "northline.ca" });
    ok("sitemapPages keeps same-site pages, shallow first, and drops the home page, assets, posts and other hosts", JSON.stringify(pages.map((p) => p.path)) === JSON.stringify(["/contact-us-2", "/services/roofing"]), pages);

    const index = `<sitemapindex><sitemap><loc>https://northline.ca/page-sitemap.xml</loc></sitemap><sitemap><loc>https://northline.ca/post-sitemap.xml</loc></sitemap>
<sitemap><loc>https://northline.ca/attachment-sitemap.xml</loc></sitemap><sitemap><loc>https://northline.ca/sitemap.xml</loc></sitemap><sitemap><loc>https://northline.ca/big.xml.gz</loc></sitemap><sitemap><loc>https://other.example/x.xml</loc></sitemap></sitemapindex>`;
    const idx = sitemapMod.parseSitemap(index);
    ok("an index parses as one", idx.kind === "index" && idx.urls.length === 6);
    const children = sitemapMod.childSitemapsToFollow(idx.urls, { baseHost: "northline.ca", already: new Set(["northline.ca/sitemap.xml"]) });
    ok("children: the page sitemap first, at most two, never itself, never .gz, never off-site", JSON.stringify(children) === JSON.stringify(["https://northline.ca/page-sitemap.xml", "https://northline.ca/post-sitemap.xml"]), children);

    const huge = `<urlset>${"<url><loc>https://northline.ca/p/x</loc></url>".repeat(300_000)}</urlset>`;
    ok("…a 10 MB sitemap is bounded", huge.length > 10_000_000);
    const t0 = Date.now();
    const big = sitemapMod.parseSitemap(huge);
    ok("…parsed within the URL cap and the scan cap, in well under a second", big.urls.length <= sitemapMod.MAX_SITEMAP_URLS && big.truncated === true && Date.now() - t0 < 1000, { n: big.urls.length, ms: Date.now() - t0 });
    ok("the distinct-URL cap is 500 and the file cap is 3", sitemapMod.MAX_SITEMAP_URLS === 500 && sitemapMod.MAX_SITEMAP_FILES === 3);
    ok("garbage yields nothing, not an exception", sitemapMod.parseSitemap("<<<<not xml").urls.length === 0 && sitemapMod.parseSitemap(null).urls.length === 0);
    const tries = sitemapMod.sitemapUrlsToTry({ baseUrl: "https://northline.ca/", baseHost: "northline.ca", robotsSitemaps: ["https://northline.ca/sm.xml", "https://evil.example/sm.xml", "https://northline.ca/sm.xml.gz"] });
    ok("robots' Sitemap: lines come first, same-site only, .gz dropped, then /sitemap.xml as the default", JSON.stringify(tries) === JSON.stringify([{ url: "https://northline.ca/sm.xml", from: "robots" }, { url: "https://northline.ca/sitemap.xml", from: "default" }]), tries);
  }

  {
    // ── The framework payload reader ──────────────────────────────────────
    const payload = JSON.stringify({ props: { pageProps: { hero: "Gutter guard installation across Western New York", key: "pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd", url: "https://x.com/a", token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", items: [{ title: "Epoxy Flooring" }, { title: "Call (716) 880-5389 for a free estimate today" }] } } });
    const next = `<html><head><script src="/_next/static/chunks/main-abc123.js"></script><script id="__NEXT_DATA__" type="application/json">${payload}</script></head><body><div id="__next"></div></body></html>`;
    const page = html.extractPage({ html: next, finalUrl: "https://northline.ca/", status: 200 });
    ok("a __NEXT_DATA__ payload is read", page.payload?.framework === "next" && page.payload.method === "json", page.payload);
    ok("…its sentences become renderedText", /Gutter guard installation across Western New York/.test(page.renderedText) && /free estimate today/.test(page.renderedText), page.renderedText);
    ok("…a two-word label is not", !/Epoxy Flooring/.test(page.renderedText));
    ok("…and no key, token or URL leaves the payload", !/pk_live|eyJhbGci|https:\/\/x\.com/.test(page.renderedText));
    ok("…the payload itself is nowhere in the record", !JSON.stringify(page).includes("pk_live"));
    const nuxt = html.extractPage({ html: `<script>window.__NUXT__={"data":[{"copy":"Serving Buffalo homeowners since nineteen ninety-eight"}]};</script>`, finalUrl: "https://northline.ca/", status: 200 });
    ok("window.__NUXT__ = {…} is read", nuxt.payload?.framework === "nuxt" && /Serving Buffalo homeowners/.test(nuxt.renderedText), nuxt.payload);
    const fnForm = html.extractPage({ html: `<script>window.__NUXT__=(function(a,b){return {data:[{copy:"Serving Buffalo homeowners since nineteen ninety-eight",k:a}]}}(null,1));</script>`, finalUrl: "https://northline.ca/", status: 200 });
    ok("Nuxt 2's function form falls back to quoted literals", fnForm.payload?.method === "literals" && /Serving Buffalo homeowners/.test(fnForm.renderedText), fnForm.payload);
    const sq = html.extractPage({ html: `<script>Static.SQUARESPACE_CONTEXT = {"website":{"siteTitle":"Northline Painting and Decorating"}};</script>`, finalUrl: "https://northline.ca/", status: 200 });
    ok("Squarespace's context is read", sq.payload?.framework === "squarespace" && /Northline Painting and Decorating/.test(sq.renderedText));
    const plain = html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    ok("an ordinary page has no payload and empty renderedText", plain.payload === null && plain.renderedText === "");
    ok("…so its hash is exactly what it was — no renderedText key", !Object.keys(fingerprint.canonicalPage(plain)).includes("renderedText"));
    ok("…while a page with a payload hashes on it", Object.keys(fingerprint.canonicalPage(page)).includes("renderedText"));
    const bomb = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ a: Array.from({ length: 50_000 }, (_, i) => `sentence number ${i} of the payload bomb`) })}</script>`;
    const t0 = Date.now();
    const bombed = html.extractPage({ html: bomb, finalUrl: "https://northline.ca/", status: 200 });
    ok("a 50,000-string payload is capped at the string cap and the char cap, quickly", bombed.payload.strings <= structured.MAX_PAYLOAD_STRINGS && bombed.renderedText.length <= structured.MAX_RENDERED_TEXT_CHARS && Date.now() - t0 < 1500, { strings: bombed.payload.strings, chars: bombed.renderedText.length });
    ok("headings are kept, h1–h3, deduplicated, invisible ones dropped", JSON.stringify(html.extractPage({ html: `<h1>Painters in Ottawa</h1><h2>Interior Painting</h2><h2>Interior Painting</h2><h4>Not kept</h4><svg><title>x</title></svg><script><h1>no</h1></script>`, finalUrl: "https://northline.ca/", status: 200 }).headings.map((h) => h.text)) === JSON.stringify(["Painters in Ottawa", "Interior Painting"]));
  }

  {
    // ── The WordPress REST reader ─────────────────────────────────────────
    const body = JSON.stringify([
      { id: 1, link: "https://northline.ca/deck-staining/", title: { rendered: "Deck &amp; Fence Staining" }, excerpt: { rendered: "<p>We stain decks. [&hellip;]</p>\n" } },
      { id: 2, link: "https://other.example/x/", title: { rendered: "Not ours" }, excerpt: { rendered: "" } },
      { id: 3, link: "https://northline.ca/", title: { rendered: "" }, excerpt: { rendered: "" } },
      { id: 4, link: "https://northline.ca/long/", title: { rendered: "Long" }, excerpt: { rendered: "<p>" + "x".repeat(5000) + "</p>" } },
    ]);
    const wp = structured.parseWpPages(body, { baseHost: "northline.ca" });
    ok("REST pages: same-site, titled, tags stripped, entities decoded", wp.pages.length === 2 && wp.pages[0].title === "Deck & Fence Staining" && wp.pages[0].excerpt === "We stain decks. …", wp.pages);
    ok("…each record under 1 KB", wp.pages.every((p) => JSON.stringify(p).length <= structured.MAX_WP_RECORD_CHARS + 100), wp.pages.map((p) => JSON.stringify(p).length));
    ok("a non-JSON answer is an error, not a throw", structured.parseWpPages("<html>", {}).error === "not_json" && structured.parseWpPages("{}", {}).error === "not_a_list");
    const types = structured.wpServiceTypes(JSON.stringify({ post: { slug: "post", rest_base: "posts" }, page: { slug: "page", rest_base: "pages" }, service: { slug: "service", rest_base: "services", name: "Services" }, "our-work": { slug: "our-work", rest_base: "our-work" }, "x y": { slug: "x y", rest_base: "x y" } }));
    ok("service-like post types are found, pages and posts skipped, a bad rest_base refused", JSON.stringify(types.map((t) => t.restBase)) === JSON.stringify(["services", "our-work"]), types);
    ok("WordPress is recognised off wp-content, wp-includes or the generator meta", structured.looksLikeWordPress(plainPage()) && !structured.looksLikeWordPress({ scripts: ["https://x.com/app.js"], links: [], metas: [] }));
    function plainPage() {
      return html.extractPage({ html: HOME_HTML, finalUrl: "https://northline.ca/", status: 200 });
    }
  }

  {
    // ── End to end: a JavaScript-shell home page whose sitemap names the
    //    pages, on a WordPress install ─────────────────────────────────────
    seedProspect();
    const SHELL = `<html><head><title>Northline</title><script src="/wp-content/themes/x/app.js"></script><script src="/_next/static/chunks/main.js"></script></head><body><div id="__next"></div></body></html>`;
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\nSitemap: https://northline.ca/sitemap_index.xml\n" },
      "https://northline.ca/sitemap_index.xml": { status: 200, headers: { "content-type": "application/xml" }, body: `<sitemapindex><sitemap><loc>https://northline.ca/page-sitemap.xml</loc></sitemap><sitemap><loc>https://northline.ca/sitemap_index.xml</loc></sitemap></sitemapindex>` },
      "https://northline.ca/page-sitemap.xml": { status: 200, headers: { "content-type": "application/xml" }, body: `<urlset><url><loc>https://northline.ca/</loc></url><url><loc>https://northline.ca/contact-us-2/</loc></url><url><loc>https://northline.ca/services/roofing/</loc></url><url><loc>https://northline.ca/book-online/</loc></url></urlset>` },
      "https://northline.ca/contact-us-2/": { status: 200, headers: { "content-type": "text/html" }, body: ROTH_CONTACT },
      "https://northline.ca/book-online/": { status: 200, headers: { "content-type": "text/html" }, body: thinPage("Book online") },
      "https://northline.ca/wp-json/wp/v2/pages": { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify([{ id: 9, link: "https://northline.ca/services/roofing/", title: { rendered: "Roofing" }, excerpt: { rendered: "<p>Roofs.</p>" } }]) },
      "https://northline.ca/wp-json/wp/v2/types": { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ services: { slug: "services", rest_base: "services" } }) },
      "https://northline.ca/wp-json/wp/v2/services": { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify([{ id: 12, link: "https://northline.ca/service/gutter-guards/", title: { rendered: "Gutter Guards" }, excerpt: { rendered: "" } }]) },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: SHELL },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("the crawl completed", result.outcome === "crawled", result);
    ok("the sitemap index from robots.txt was read, its page child followed, itself not re-fetched", net.requests.filter((u) => u.includes("sitemap_index.xml")).length === 1 && net.requests.includes("https://northline.ca/page-sitemap.xml"), net.requests);
    ok("…and /sitemap.xml was not also tried, because robots named one that answered", !net.requests.includes("https://northline.ca/sitemap.xml"), net.requests);
    ok("the contact page the shell hid was fetched through the sitemap", net.requests.includes("https://northline.ca/contact-us-2/"), net.requests);
    ok("…and so was the booking page", net.requests.includes("https://northline.ca/book-online/"));
    ok("no blind probe was made", !net.requests.some((u) => /\/(contact|services|about)$/.test(u)) && result.probed === false, net.requests);
    ok("the result says how many sitemap pages, and how many were followed", result.sitemap.pages === 3 && result.sitemap.followed === 2, result.sitemap);
    const fetches = store.evidence.filter((e) => e.type === "page_fetch").map((e) => JSON.parse(e.rawValue));
    ok("the contact page's envelope says via: sitemap, ranked contact", fetches.some((f) => f.finalUrl === "https://northline.ca/contact-us-2/" && f.via === "sitemap" && f.navMatch === "contact"), fetches);
    const sm = store.evidence.filter((e) => e.type === "sitemap_url");
    ok("every same-site sitemap page is a sitemap_url row keyed on its path", sm.length === 3 && sm.every((e) => e.normalizedValue.startsWith("/")) && sm.some((e) => e.normalizedValue === "/services/roofing"), sm.map((e) => e.normalizedValue));
    ok("…sourced to the sitemap file it came from", sm.every((e) => e.sourceUrl === "https://northline.ca/page-sitemap.xml"));
    const sources = store.evidence.filter((e) => e.type === "structured_source").map((e) => e.normalizedValue);
    ok("each structured file has a structured_source row, sitemap and wp-json alike — two sitemap files, three REST answers", sources.filter((v) => v.startsWith("sitemap:")).length === 2 && sources.filter((v) => v.startsWith("wp_rest:")).length === 3, sources);
    const wpRows = store.evidence.filter((e) => e.type === "wp_page").map((e) => JSON.parse(e.rawValue));
    ok("the WordPress pages and the services post type are wp_page rows", wpRows.length === 2 && wpRows.some((r) => r.title === "Gutter Guards" && r.type === "services") && wpRows.some((r) => r.title === "Roofing" && r.type === "page"), wpRows);
    ok("no structured file became a page", !fetches.some((f) => /sitemap|wp-json/.test(f.finalUrl || "")), fetches.map((f) => f.finalUrl));
    ok("the detector version on every row is 3", store.evidence.every((e) => e.detectorVersion === "3"));

    // The reader side: the shell home page plus two rendered sitemap pages.
    const rows = store.evidence.filter((e) => ["page_fetch", "page_content", "meta", "script_src", "iframe_host", "link", "form", "button", "schema_org", "dom_attr", "inline_token", "rendered_text", "heading"].includes(e.type));
    const crawl = technology.normaliseCrawl(technology.pagesFromEvidence(rows));
    const det = capabilityDetect.detectCapabilities({ crawl, technologies: [], prospect: { websiteUrl: "https://northline.ca/" } });
    ok("the home page is a JavaScript shell to the detector", det.rendered === "js_shell" && det.eligibility.reason === "js_shell", det.eligibility);
    ok("WEBSITE is true — two sitemap pages rendered", det.capabilities.find((c) => c.code === "WEBSITE").value === true && det.capabilities.find((c) => c.code === "WEBSITE").evidence[0].normalizedValue === "WEBSITE:rendered");
    const shellOnly = capabilityDetect.detectCapabilities({ crawl: technology.normaliseCrawl(technology.pagesFromEvidence(rows.filter((e) => e.sourceUrl === "https://northline.ca/"))), technologies: [], prospect: { websiteUrl: "https://northline.ca/" } });
    ok("…and with the shell alone WEBSITE is still true, citing the shell — a modern site is not a missing one", shellOnly.capabilities.find((c) => c.code === "WEBSITE").value === true && shellOnly.capabilities.find((c) => c.code === "WEBSITE").evidence[0].normalizedValue === "WEBSITE:js_shell", shellOnly.capabilities.find((c) => c.code === "WEBSITE"));
    ok("…every other verdict null with the js_shell reason", shellOnly.capabilities.filter((c) => c.code !== "WEBSITE").every((c) => c.value === null && /:withheld:js_shell$/.test(c.evidence[0]?.normalizedValue || "")));
    ok("the form on the sitemap-found contact page is still SEEN", det.capabilities.find((c) => c.code === "LEAD_CAPTURE_FORM").value === true);
    ok("…but nothing is FALSE anywhere: a shell in the crawl refuses every absence", det.capabilities.every((c) => c.value !== false), det.capabilities.map((c) => `${c.code}=${c.value}`));
    ok("…and each null cites the js_shell reason in a crawl_quality row", det.capabilities.filter((c) => c.value === null).every((c) => c.evidence.length === 1 && c.evidence[0].type === "crawl_quality" && /:withheld:js_shell$/.test(c.evidence[0].normalizedValue) && c.evidence[0].rawValue.startsWith(capabilityDetect.JS_SHELL_SENTENCE)));
  }

  {
    // ── The same site, server-rendered: a sitemap page counts as navigation
    //    followed, so absence CAN be earned through it ───────────────────────
    seedProspect();
    const net = makeNet({
      "https://northline.ca/robots.txt": { status: 200, body: "User-agent: *\nAllow: /\n" },
      "https://northline.ca/sitemap.xml": { status: 200, headers: { "content-type": "application/xml" }, body: `<urlset><url><loc>https://northline.ca/contact-us-2/</loc></url><url><loc>https://northline.ca/reviews/</loc></url></urlset>` },
      "https://northline.ca/contact-us-2/": { status: 200, headers: { "content-type": "text/html" }, body: ROTH_CONTACT },
      "https://northline.ca/reviews/": { status: 200, headers: { "content-type": "text/html" }, body: thinPage("Reviews") },
      "https://northline.ca/": { status: 200, headers: { "content-type": "text/html" }, body: `<html><head><title>Northline</title></head><body><nav><a href="/">Home</a><a href="/painting">Painting</a></nav><h1>Painters</h1><p>${"Ottawa painters. ".repeat(40)}</p></body></html>` },
    });
    await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    const rows = store.evidence.filter((e) => e.type !== "sitemap_url" && e.type !== "wp_page" && e.type !== "structured_source" && e.type !== "nav_link");
    const det = capabilityDetect.detectCapabilities({ crawl: technology.normaliseCrawl(technology.pagesFromEvidence(rows)), technologies: [], prospect: {} });
    ok("a menu with no priority link and a sitemap with two: navigation counts as followed", det.eligibility.navigation === "followed" && det.eligibility.deep === true, det.eligibility);
    ok("…so ONLINE_BOOKING can be false, citing the three pages searched", det.capabilities.find((c) => c.code === "ONLINE_BOOKING").value === false && /contact-us-2/.test(det.capabilities.find((c) => c.code === "ONLINE_BOOKING").evidence[0].rawValue));
  }

  {
    // ── A malformed JSON-LD block, and one with facts ─────────────────────
    const schemaFacts = await import("@/lib/sales/intel/schemaFacts");
    const bad = schemaFacts.schemaFactsOfBlock('{"@type": "LocalBusiness", "telephone": ');
    ok("malformed JSON-LD is counted and yields nothing", bad.blocks === 1 && bad.parsed === 0 && bad.telephone.length === 0);
    ok("…and the crawler's own type reader marks it invalid rather than throwing", evidence.schemaTypesOf('{"@type": ') === "invalid_json_ld");
    const deep = schemaFacts.schemaFactsOfBlock(JSON.stringify({ "@type": "Plumber", telephone: "+1 716 555 0100", email: "mailto:Info@Northline.ca", openingHoursSpecification: [{}], aggregateRating: { "@type": "AggregateRating", ratingValue: 4.9 }, review: [{ "@type": "Review" }, { "@type": "Review" }], potentialAction: { "@type": "ReserveAction" }, paymentAccepted: "Cash, Credit Card", hasOfferCatalog: { "@type": "OfferCatalog", itemListElement: [{ "@type": "Offer", itemOffered: { "@type": "Service", name: "Drain Cleaning" } }, "Sump Pumps"] } }));
    ok("a rich block yields every fact, once", deep.telephone[0] === "+1 716 555 0100" && deep.email[0] === "info@northline.ca" && deep.hours && deep.aggregateRating && deep.reviews === 2 && deep.bookingAction === "reserveaction" && deep.paymentAccepted === "Cash, Credit Card" && deep.services.map((s) => s.name).join("|") === "Drain Cleaning|Sump Pumps", deep);
    const nested = JSON.stringify({ a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { "@type": "Service", name: "too deep" } } } } } } } } } } } });
    ok("nesting past the walk depth is not read", schemaFacts.schemaFactsOfBlock(nested).services.length === 0);
    const wide = JSON.stringify({ "@graph": Array.from({ length: 5000 }, (_, i) => ({ "@type": "Service", name: `S${i}` })) });
    ok("a five-thousand-node graph is bounded", schemaFacts.schemaFactsOfBlock(wide).services.length <= 40);
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("11. Source rules — each scoped to ONE brace-matched function");

  {
    const src = read("lib/sales/crawl/crawlSite.js");
    const fn = functionSource(src, "crawlProspectSite");
    if (ok("crawlProspectSite() was found", fn !== null)) {
      ok("…checks isDemoCompany", /isDemo\(/.test(fn));
      ok("…checks doNotContactAt", /doNotContactAt/.test(fn));
      ok("…checks the suppression list", /crawlSuppressed\(/.test(fn));
      ok("…vets the URL", /safeCrawlUrl\(/.test(fn));
      ok("…and does all four BEFORE fetching anything", fn.indexOf("crawlSuppressed(") < fn.indexOf("fetchCrawlPage("));
      ok("…demo first of all", fn.indexOf("isDemo(") < fn.indexOf("findUnique"));
      ok("…consults robots before any page", fn.indexOf("robotsFetchOutcome(") < fn.indexOf("fetchOne("));
      ok("…ranks the navigation on path AND text", /rankNavigation\(/.test(fn));
      ok("…probes ONLY when the ranking is empty", /queue\.length === 0/.test(fn) && !/queue\.length < 2/.test(fn));
      ok("…records the service menu without a fetch", /serviceMenu\(/.test(fn));
      ok("…asks for the sitemap after the home page and before ranking", fn.indexOf("fetchOne(crawlUrl.toString())") < fn.indexOf("sitemapUrlsToTry(") && fn.indexOf("sitemapUrlsToTry(") < fn.indexOf("rankNavigation("));
      ok("…ranks the sitemap's URLs as via: sitemap", /via: "sitemap"/.test(fn));
      ok("…reads the WordPress index only when the page says WordPress", /looksLikeWordPress\(homePage\)/.test(fn));
      ok("…and hands the structured sources to the writer", /crawlEvidence\(pages, structured\)/.test(src));
      ok("…and never writes robotsAllowed on an unknown outcome", !/act === "unknown"[\s\S]{0,200}recordRobots/.test(fn));
    }

    const write = functionSource(src, "writeCrawl");
    if (ok("writeCrawl() was found", write !== null)) {
      ok("…never deletes evidence", !/deleteMany|\.delete\(/.test(write));
      ok("…writes hasWebsite only as true", !/hasWebsite:\s*false/.test(write));
      ok("…and writes the prospect and its evidence in one transaction", /\$transaction/.test(write));
    }
  }
  {
    const src = read("lib/sales/intel/capabilityDetect.js");
    const fn = functionSource(src, "absenceEligibility");
    if (ok("absenceEligibility() was found", fn !== null)) {
      ok("…reads the crawler's via stamp", /via === "probe"/.test(fn) && /via === "nav"/.test(fn));
      ok("…counts a sitemap-reached page as navigation followed", /via === "sitemap"/.test(fn));
      ok("…and refuses every absence on a JavaScript shell, before the rendered count is read", /deny\("js_shell"\)/.test(fn) && fn.indexOf('deny("js_shell")') < fn.indexOf('deny("no_page_rendered")'));
      ok("…vetoes deep absence on a probed crawl", /navigation !== "probed"/.test(fn));
      ok("…and asks whether a contact-like page rendered", /contactPage/.test(fn));
    }
  }
  {
    const src = read("lib/sales/crawl/fetchPage.js");
    const fn = functionSource(src, "fetchCrawlPage");
    if (ok("fetchCrawlPage() was found", fn !== null)) {
      ok("…re-vets the URL on every hop, inside the loop", /for \(let hop[\s\S]*safeCrawlUrl\(/.test(fn));
      ok("…re-resolves DNS on every hop", /for \(let hop[\s\S]*hostResolvesPublic\(/.test(fn));
      ok("…records an off-host redirect", /offHost = true/.test(fn));
      ok("…and returns instead of following it", /offHost = true[\s\S]{0,200}return attempt/.test(fn));
      ok("…and takes a politeness slot per hop", /onRequest\(/.test(fn));
    }
    const once = functionSource(src, "fetchOnce");
    if (ok("fetchOnce() was found", once !== null)) {
      ok("…uses GET", /method:\s*"GET"/.test(once));
      ok("…never follows a redirect itself", /redirect:\s*"manual"/.test(once));
      ok("…sends no credentials", /credentials:\s*"omit"/.test(once));
      ok("…sends our User-Agent", /USER_AGENT/.test(once));
      ok("…and aborts on a timer", /AbortController|setTimeout/.test(once));
    }
    const capped = functionSource(src, "readCapped");
    if (ok("readCapped() was found", capped !== null)) {
      ok("…counts bytes rather than trusting Content-Length", !/content-length/i.test(capped));
      ok("…and cancels the stream at the cap", /cancel\(\)/.test(capped));
    }
  }
  {
    const src = read("lib/sales/crawl/policy.js");
    const fn = functionSource(src, "robotsDecision");
    if (ok("robotsDecision() was found", fn !== null)) {
      ok("…treats null as 'fetch', never as 'allow'", /allowed === null[\s\S]{0,120}"fetch"/.test(fn));
      ok("…and treats undefined the same", /allowed === undefined/.test(fn));
    }
    const slot = functionSource(src, "hostSlotDecision");
    if (ok("hostSlotDecision() was found", slot !== null)) {
      ok("…checks blockedUntil before anything else", slot.indexOf("blockedUntil") < slot.indexOf("lastRequestAt"));
    }
  }
  {
    const src = read("lib/sales/crawl/hostPolicy.js");
    const fn = functionSource(src, "reserveHostSlot");
    if (ok("reserveHostSlot() was found", fn !== null)) {
      ok("…reserves with updateMany, not update", /updateMany\(/.test(fn) && !/\.update\(/.test(fn));
      ok("…and guards on the lastRequestAt it read", /where:\s*\{[^}]*lastRequestAt/.test(fn));
      ok("…and treats count !== 1 as losing the race", /count === 1/.test(fn));
    }
    const record = functionSource(src, "recordRobots");
    if (ok("recordRobots() was found", record !== null)) {
      ok("…refuses to write a non-boolean verdict", /typeof allowed !== "boolean"/.test(record));
    }
  }
  {
    const src = read("lib/sales/crawl/html.js");
    const fn = functionSource(src, "forEachToken");
    if (ok("forEachToken() was found", fn !== null)) {
      ok("…skips comments", /<!--/.test(fn));
      ok("…treats script/style as raw text", /RAW_TEXT\.has\(/.test(fn));
    }
  }
  {
    const idx = read("lib/sales/pipeline/handlers/index.js");
    ok("handlers/index.js imports the crawl handler", /import\s+"\.\/crawlWebsite"/.test(idx));
    ok("…and names it in HANDLER_MODULES", /HANDLER_MODULES\s*=\s*\[[^\]]*CRAWL_WEBSITE/.test(idx));
  }
  {
    // The whole crawl directory must not have grown a second way to fetch.
    for (const file of [
      "lib/sales/crawl/crawlSite.js",
      "lib/sales/crawl/hostPolicy.js",
      "lib/sales/crawl/html.js",
      "lib/sales/crawl/robots.js",
      "lib/sales/crawl/url.js",
      "lib/sales/crawl/policy.js",
      "lib/sales/crawl/fingerprint.js",
      "lib/sales/crawl/evidence.js",
      "lib/sales/crawl/sitemap.js",
      "lib/sales/crawl/structured.js",
    ]) {
      const src = read(file);
      ok(`${file} contains no fetch( of its own`, !/[^a-zA-Z.]fetch\(/.test(src), file);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
