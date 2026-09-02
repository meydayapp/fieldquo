# Crawling a prospect's website

What `lib/sales/crawl/**` does, what it deliberately does not do, and the
decisions a later agent should not quietly reverse.

Landed 2026-09-02. `scripts/check-sales-crawl.mjs` executes all of it.

---

## The shape

```
CRAWL_WEBSITE task
      │
      ▼
handlers/crawlWebsite.js      adapter only — task in, { done, retry, reason } out
      │
      ▼
crawl/crawlSite.js            the ONE file that both queries Postgres and
      │                       opens sockets
      ├── policy.js           constants + every politeness decision (pure)
      ├── url.js              SSRF vetting, same-site, page ranking (pure)
      ├── robots.js           robots.txt parser + matcher (pure)
      ├── html.js             the lexer + §8 extraction (pure)
      ├── fingerprint.js      what "unchanged" means (pure)
      ├── evidence.js         page record → ProspectEvidence rows (pure)
      ├── fetchPage.js        GET, timeout, byte cap, manual redirects (IO)
      └── hostPolicy.js       CrawlHostPolicy read/write, compare-and-set (IO)
```

Everything except the last two is a pure function over loaded input, which is
why the check can run a 429 with an HTTP-date `Retry-After` against a host
another lambda is holding without a network or a database.

---

## The parsing choice: a lexer, not a dependency, and not a regex

The full argument is in `html.js`'s header. In one paragraph: what we need is a
fixed list of facts, never a query over a document — no selectors, no
traversal, no layout, no scripting. A regex per field gets three ordinary
documents wrong and gets them wrong by INVENTING facts (`document.write("</div>")`
inside a script, a `>` inside a quoted attribute, a commented-out `<form>`), and
a wrong fact is what a rep says out loud. jsdom builds a window and an event
loop to answer questions nobody asked and exists to execute pages, which is the
last capability a crawler pointed at strangers' HTML should have. cheerio /
parse5 is the close call and loses on two counts: what it buys is selectors and
a spec-accurate tree, neither of which changes any answer we extract from a
flat token stream, and it would be the first HTML parser in a 27-dependency
repo — a new supply-chain surface on the one path that consumes bytes from
strangers' servers.

**The honest limit:** the lexer has no tree and no implied end tags, so a
document that relies on those for STRUCTURE (an unclosed `<form>` swallowing
the page) is read differently than a browser reads it. That costs a field list,
not a wrong claim.

---

## What the content hash covers

`Prospect.contentHash` is `crawl-v1:<sha256>` over the canonicalised
EXTRACTION, never the bytes. Hashing bytes would report "changed" on every
crawl of an unchanged site — the CSRF token, the inline-script nonce, the
`?ver=` on every asset and the rotating testimonial all move — and the cost of
a false "changed" is an OpenAI call per prospect (`ANALYZE_CAPABILITIES` and
`DETECT_OPPORTUNITIES` are both `openai` in `kinds.js`).

Covered, per page, sorted: path (host and scheme dropped — http→https is not a
content change), status, title, meta `name=content` pairs minus the volatile
ones, script sources without query strings, iframe hosts, same-site link paths
without query strings, form signatures (method + action path + sorted field
names), button labels, JSON-LD, `data-*` pairs, contact methods, visible text.

Excluded: raw bytes, all response headers, inline script and style bodies,
query strings on assets and links, the order anything appeared in, and every
fact about us rather than about them.

An unchanged hash writes **no evidence rows at all** — only `lastCrawledAt`.
That is the §20 cache, applied to storage as well as to the model bill.

Bumping `CONTENT_HASH_VERSION` makes every prospect look changed once and
re-analyse once. That is correct, and it is why the version is a named constant
the check asserts rather than a silent implementation detail.

---

## Politeness, and where each rule lives

| Rule | Where |
|---|---|
| robots.txt fetched, parsed, obeyed | `robots.js`, called from `crawlSite.js` |
| `robotsAllowed` null ⇒ **not** allowed | `policy.robotsDecision` |
| `Crawl-delay` honoured, floored at 1s | `policy.clampCrawlDelay` / `effectiveDelayMs` |
| Default 3s between requests to one host | `policy.DEFAULT_CRAWL_DELAY_MS` |
| Per-host state across lambdas | `CrawlHostPolicy` + `hostPolicy.reserveHostSlot` |
| 429 / 503 ⇒ `blockedUntil`, `Retry-After` honoured | `policy.blockUntil`, `hostPolicy.blockHost` |
| Real, contactable User-Agent | `policy.USER_AGENT` |
| 15s timeout, 2 MB cap counted off the stream | `fetchPage.fetchOnce` |
| Off-host redirect recorded, never followed | `fetchPage.fetchCrawlPage` |
| Re-crawl no more than monthly | `policy.recrawlDecision` |

**The robots cache is a refusal cache, never a permission cache.**
`CrawlHostPolicy.robotsAllowed` holds one boolean per host, so it cannot hold
per-path rules and a cached `true` therefore authorises nothing. The crawler
acts on the cache only when it says `false`; every run that actually crawls
re-fetches robots.txt and asks it about each URL. One extra request per
prospect per month buys the property that a cached verdict can never permit a
path the live file forbids.

**The slot reservation is a compare-and-set**, guarded on the `lastRequestAt`
that was read — the same discipline as `claimTask` in the pipeline runner. A
read-then-write would let two overlapping invocations both conclude the gap had
elapsed and both fire, which is the exact pair the table exists to prevent.

**Which pages get fetched.** The home page, then the site's OWN internal links
ranked by the brief's slug list (`about`, `contact`, `services`, `pricing`,
`book`, `booking`, `estimate`, `quote`, `request-a-quote`, `team`, `locations`,
`careers`), capped at six pages. Blind probing of a fixed URL list is what
fills a contractor's error log with 404s; ranking real links returns 200s. Only
when the navigation yields fewer than two recognised links does it fall back to
three blind probes (`/contact`, `/services`, `/about`).

---

## The hard rules, and where they are enforced

- **Only public pages, only GET.** `fetchOnce` sends `method: "GET"`,
  `credentials: "omit"`, `redirect: "manual"`, no cookie jar. Nothing in this
  directory can POST, log in, or accept terms.
- **Only the prospect's own site.** Every URL fetched derives from
  `Prospect.websiteUrl`; a redirect that leaves the host is recorded as a
  finding and not followed, and a link to another domain is stored as evidence
  and never queued.
- **SSRF.** `safeCrawlUrl` refuses non-HTTP(S) schemes, credentials in the URL,
  ports other than 80/443, and every not-globally-reachable address in both
  families — including the IPv4-mapped IPv6 forms, which WHATWG URL rewrites
  into hex (`[::ffff:127.0.0.1]` → `[::ffff:7f00:1]`). `hostResolvesPublic`
  then checks what the name actually resolves to, **on every redirect hop**.
  *Not closed:* DNS rebinding between the lookup and the socket, which needs a
  custom agent checking the peer address after connect.
- **A demo company never crawls.** Checked inside `crawlProspectSite`, before
  the prospect row is even loaded, using the real `isDemoCompany` — which
  re-reads the company row rather than trusting a flag. **Today nothing passes
  a `companyId`**: `Prospect` and `ProspectCampaign` are FieldQuo's own tables
  and carry none. The gate is a precondition for a future tenant-scoped caller,
  not a live gate, and the code says so rather than implying otherwise.
- **A takedown stops the crawl.** A live `SalesSuppression` of kind `domain`
  refuses, on any channel. It deliberately does not call `suppressionVerdict()`
  — that function refuses any channel it does not recognise, so passing it
  "crawl" would either refuse every crawl or require lying about the channel.

---

## Where the evidence goes

`ProspectEvidence`, one row per observation, appended and never replaced.
`source` is always `"website"`; `detector` is `FieldQuoBot.extract` with a
version.

The rule that resolves the table's two value columns:

- `normalizedValue` is **always a plain matchable string** — a
  `TechnologySignature.patterns` entry runs against it, so it is never JSON.
- `rawValue` is the observation as found: a string when the observation is a
  string, a compact JSON object when it genuinely has parts (a form's method,
  action and field list; a link's href AND the text a human clicks).

Types used: `page_fetch`, `page_content`, `meta`, `script_src`, `iframe_host`,
`link`, `form`, `button`, `schema_org`, `dom_attr`, `contact`. The first, plus
`button`, `contact` and `dom_attr`, are **not** in the schema comment's
illustrative list — named here so the next agent finds them in a document
rather than in a query. `script_src`, `iframe_host`, `link` and `meta` match
`TechnologySignature.patterns`'s own vocabulary exactly.

Rows are append-only, so a reader wanting the current picture filters on
`observedAt >= prospect.lastCrawledAt` — which is why the evidence and the
prospect's own columns are written in one transaction.

`hasWebsite` is only ever written **true**. A fetch that failed is not proof of
absence, and writing false on a timeout would tell a rep "they have no website"
because a server was slow for fifteen seconds.

---

## Task outcomes

| Situation | Task ends |
|---|---|
| Crawled, changed or unchanged | `done` |
| Crawled recently | `done`, note says when it is next due |
| robots.txt disallows `/`, or the path | `abandoned`, reason recorded |
| Host blocked (429/503) | `abandoned`, reason names the time |
| URL unsafe, domain suppressed, do-not-contact | `abandoned` |
| Domain does not resolve | `abandoned` |
| Timeout, reset, 5xx, host slot held | `queued` with backoff, ceiling 5 |

A blocked host ends the task terminally rather than retrying, because
`MAX_ATTEMPTS` is five over about fifteen minutes and a one-hour block would
exhaust the ladder without ever being respected. Re-queueing after the block
expires is a scheduler's job. **Open consequence:** `enqueuePipelineTask`
dedupes on `idempotencyKey`, so a scheduler re-queueing a crawl must vary the
key (a date component) or it will find the abandoned row and return it
unchanged.

---

## Owner / follow-up work, stated rather than left implied

1. **A `/bot` page.** The User-Agent points at `https://www.fieldquo.com/contact`
   because that page exists. A page explaining who the crawler is, what it
   fetches and how to ask it to stop would be better, and is the one place
   `AUDIT-compliance.md` §10's "a URL explaining it" is only partly satisfied.
2. **No superadmin console.** STATUS.md's standing rule 1 says every rule is
   editable from the console. These are constants in `policy.js` — in ONE file
   so the screen has a single place to read from, but a screen it is not. Named
   here rather than half-built.
3. **Nothing enqueues a `CRAWL_WEBSITE` task yet.** The handler is registered
   and the runner will execute it; what does not exist is the thing that queues
   one after discovery. Until that lands, this stage is reachable only by
   inserting a task by hand.
4. **DNS rebinding is narrowed, not closed** — see above.
