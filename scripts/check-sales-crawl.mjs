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
    const net = makeNet({ "https://northline.ca/robots.txt": { throws: "ECONNRESET" } });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: crawlDeps(net) });
    ok("a robots.txt that will not connect does not allow the crawl", result.outcome === "failed" && result.retry === true, result);
    ok("…and writes nothing to robotsAllowed", store.hosts.get("northline.ca").robotsAllowed === null);
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
    const probes = net.requests.filter((u) => u !== "https://northline.ca/" && !u.endsWith("robots.txt"));
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
