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
ranked by `PRIORITY_PAGES` in `url.js` — fourteen kinds in priority order
(about, contact, services, pricing, booking, quote, payment, portal, reviews,
team, locations, faq, careers, gallery), each with the path spellings
contractors actually use (`contact_us`, `get-in-touch`, `free-estimate`,
`make-a-payment`, `my-account`…) and a pattern for the anchor text — capped at
six pages. A path is tokenised on `-`, `_`, `.` and camel/digit boundaries
before matching, and a link ranks on its path OR its label, so "Make a Payment"
routed to `/p/1187` is a payment page. Blind probing of a fixed URL list is
what fills a contractor's error log with 404s; ranking real links returns
200s. Only when the ranking is EMPTY — not merely short — does it fall back to
three blind probes (`/contact`, `/services`, `/about`); until 2026-09-13 the
threshold was "fewer than two", which on a gutter company's site threw away
twenty-six real links, probed two 404s, and never fetched `/contact_us`. The
links the ranking does not claim are the service menu and are recorded as
`nav_link` evidence with no fetch. Every `page_fetch` envelope says how the
page was reached (`via`: `start` / `nav` / `probe`) and what it was ranked as
(`navMatch`), and the crawl result carries `probed` and `probesFailed` — the
capability detector reads the first to refuse an absence claim from a guessed
crawl.

**Inline `<script>` bodies are scanned, never stored.** vcita's LiveSite, a
CallRail tag and a Duda runtime reach a page through a script the page
CREATES — `js.src = p + "d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js?"` —
and a declared-tag scan never sees them. `html.js`'s `scanInlineScript` reads
loader URLs (absolute, protocol-relative, or the quoted host-relative form)
out of a body and emits them as `script_src` rows with an `.inline` detector
suffix, plus a short allow-list of vendor init tokens (`LiveSite.init`,
`HCPWidget`…) as loose `inline_token` rows. The body is discarded; the URL is
hashed without its query, so a per-render timestamp is not a change.

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
`link`, `form`, `button`, `schema_org`, `dom_attr`, `contact`, `nav_link`,
`inline_token`. The first, plus `button`, `contact`, `dom_attr`, `nav_link`
and `inline_token`, are **not** in the schema comment's illustrative list —
named here so the next agent finds them in a document rather than in a query. `script_src`, `iframe_host`, `link` and `meta` match
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

## Directories and platform profiles

The URL on a prospect's record is not always the prospect's site. Ring A Ling
Upholstery & Carpet Cleaners (Randolph NY) listed `www.ethicalservices.com`
— a carpet-cleaner **directory**: "Find a Provider", "List Your Business",
"Register Here", "Member Login", a provider search by city, and the
directory's own `service@` in the footer. The crawler read it correctly and
every reader believed it was theirs: the rep's card said "Has a website of
their own", "No enquiry form", "No client portal" (the member login on
`/contact.php` was the directory's), and the directory's address became the
lead's email.

`lib/sales/intel/siteKind.js` now answers **whose site it is** — `own`,
`directory`, `platform_profile` or `unknown` — from the pages, the host and
how many other prospects list the same host (counted by
`countProspectsOnHost` in `lib/sales/intel/db.js`; the classifier has no
database). It is a deterministic ladder with every rung cited as a reason:

1. a host on `PLATFORM_PROFILE_HOSTS` (facebook, yelp, houzz, angi,
   thumbtack, google.com/maps, business.site, linktr.ee…) → `platform_profile`,
   with no page at all;
2. a host on `KNOWN_DIRECTORY_HOSTS` (Yellow Pages, Pages Jaunes, 411habitation,
   hub.biz, manta, contractors.com…) → `directory`, likewise — these refuse the
   crawler, so their listings never render a page to read;
3. the record's URL is a **listing path** (`/profile/…`,
   `/Contractor-SubContractor/…`) on a host ≥ 3 other prospects share →
   `directory`, even when nothing loaded;
4. the pages: **decisive** menu phrases with no innocent reading on a
   business's own site ("Claim this listing", "Add your company", "Search the
   directory"), **strong** ones a manufacturer or a union also says about
   itself ("Find a dealer", "Become a member"), **weak** ones ("Member login"),
   a GET provider-search form that asks for a city or state, a login form with
   a password field, and whether the site's own brand (the title's first
   segment, or `og:site_name`) carries the business's name. Two decisive
   phrases decide; one decides with any corroboration unless the title names
   the business; a title that names the business otherwise decides `own`.

Only same-host links are read (a fence maker's "Find a distributor" and a
footer link to trex.com's contractor finder both looked like directory menus),
a path pattern counts as the same observation as its link text, a page title
of "Home" / "Contact" / "Account Suspended" is not a brand, and a **shared
host never decides alone** — measured, the shared hosts are franchises
(key.me 3,451 prospects, minutekey.com 2,161, servpro.com 322) whose pages are
the franchisee's own presence. The classifier's header records the
2,000-prospect measurement (82% own, 14.5% unknown, 1.8% directory, 1.7%
platform profile) and every adjustment it forced.

**What a `directory` or `platform_profile` verdict does downstream**
(`lib/sales/intel/capabilityDetect.js`, detector version 3):

| Reader | Consequence |
|---|---|
| `WEBSITE` | **false**, evidence row `site_kind:<kind>:<host>` with `brand=<the site's own title>` first, the classifier's rows after it — so the screen says "Their listed website is a directory (Ethical Services), not their own site" |
| `EMAIL_CONTACT`, `PHONE_CONTACT` | kept as observed, if observed, with the listing page as `sourceUrl`; the screen says "listed on the directory, not on a site of theirs". Never false |
| every other capability | **null**, whatever the pages carried — a booking widget on a directory is the directory's. Never false |
| `Prospect.email` | not filled from the listing (the address is as likely the directory's own) |
| the trade (`inferTrade`) | not established from the listing's copy — `siteBelongsToProspect: false`, the same gate a derived site that failed corroboration goes through |
| `INFER_FROM_SITE`, `GENERATE_CALL_SCRIPT` | handed **no page excerpts** (`loadStoredSiteKind`) — a directory's "serving the community since 1994" is the directory's sentence |
| the `NO_WEBSITE` rule | fires on `WEBSITE false`; its sentence says "no website of its own — at most a listing on somebody else's", true of both cases |
| the lead score | no "has website" points exist; the listed URL is not double-counted as "source lists no website" |

`unknown` changes nothing anywhere: an unknown must not turn a real site into
"no website". A version-2 `false` written off a directory's pages is
superseded by the version-3 `null` on the next analysis (analyzeCapabilities'
rule 1 applies only within a detector version).

**https → http.** `safeCrawlUrl` defaults a schemeless address to https, and a
site that serves http only (Ethical Services refuses 443) failed the robots
fetch, retried, and was never read. `crawlProspectSite` step 7 now tries the
robots fetch once over http when https gave a **transport** failure
(`httpFallbackEligible` in `policy.js`: refused, reset, timeout, a bare
`TypeError` from a TLS failure — never a DNS failure, an unsafe URL, a
politeness refusal, or any HTTP status), and if http answers the whole crawl
runs there. A site that answered on https, with any status, is never
downgraded; a **derived** address never is (step 2b's rule about choosing
plaintext for a host nobody vouched for). Every `page_fetch` envelope carries
`scheme` (what was actually used) and `schemeFallback` (`{ from, to, error }`
or null), and the task note says "https refused (ECONNREFUSED); crawled over
http".

Executed by `scripts/check-sales-site-kind.mjs` against the directory's real
HTML (`scripts/fixtures/site-kind/`), through the same
extract → evidence → rebuild path production uses. `scripts/
find-directory-hosts.mjs` lists, read-only, the hosts most shared across
prospects so the known-directory list can be grown from data rather than
guessed.

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
