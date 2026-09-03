# Discovering contractor websites by keyword — is there a tractable path?

Research and design only. **No code was written, no dataset was downloaded, no
API was signed up for, and nothing was purchased by the session that wrote
this.** All external sources read **2026-09-03** unless stated otherwise.

Companion to `AUDIT-discovery-sources.md` (which chose Overture over Google on
terms and on structure) and `AUDIT-compliance.md` §10 (which set the crawling
rules this codebase implements). This document does not re-litigate either. It
answers one question those two left open:

> Every discovery path in this repo needs a website **already in hand**. Nothing
> here discovers a URL. Can we find contractor websites by keyword instead?

I am an engineer reading licence texts and vendor documentation, not a lawyer.
Where the answer turns on legal judgement rather than published wording, I say
so. Where I could not verify a claim from a primary source, it is listed in
*What I could not verify* rather than reasoned about.

---

## The one paragraph

**The gap is real, the owner's caveat is also right, and neither leads where it
looks like it leads.** Common Crawl is free, legally usable for the narrow thing
we would use it for, and the DuckDB remote-Parquet technique this repo already
uses for Overture reads it fine. But the index is **sorted by reversed domain**,
so a trade-token keyword (`%plumb%`) has a leading wildcard and **cannot prune**:
the sweep must read all 300 warc-subset files, **~157 GB per monthly crawl**.
Measured, not estimated. And the index carries **no page text and no
geography** — it will hand you 33.1 million registered domains and tell you
nothing about whether any of them is a plumber, or in Ontario. Turning a
candidate domain into a business means crawling it, and this pipeline can crawl
at most **2,880 domains a day** while doing nothing else.

**Recommendation, stated up front: do not build keyword web discovery.** Per
week of engineering it is beaten, badly, by importing another licence register
— Washington L&I alone is 75,839 active contractors with 99.97% phone coverage,
public domain, refreshed three times daily.

**But one thing in this brief is worth building, and it is not the thing that
was asked for.** `NO_WEBSITE` is the highest-priority non-competitor
opportunity rule in the system and **it can never fire**, because nothing in
the codebase can write `hasWebsite: false` — while the platform console renders
a filter reading *"Has none — we looked"* that always returns zero rows.
Proving absence needs a name-keyed web search, which is the one job Common
Crawl cannot do and a search API can. Part 4 sets that out; it is a small,
bounded feature and it fixes a live dead control.

---

# Part 0 — What the repo actually has, and where the gap is

Read before the external research, because the shape of the gap determines
which external source could fill it.

## The three files that need a URL already

| File | What it needs | Where the URL comes from |
|---|---|---|
| `lib/sales/crawl/crawlSite.js` | `prospectId` → `Prospect.websiteUrl` | Overture's `websites` column |
| `lib/sales/pipeline/handlers/crawlWebsite.js` | a `Prospect` row | same |
| `lib/sales/pipeline/handlers/enrichBusiness.js` | `routeAfterEnrich` branches on `prospect.websiteUrl` | same |

`crawlProspectSite({ prospectId })` is an **enricher of a known business**. Its
first argument is a database id. There is no entry point anywhere in
`lib/sales/` that takes a bare hostname.

The crawl machinery itself is good and is not the problem — robots.txt fetched
and obeyed per path (a cached `true` authorises nothing, only a cached `false`
acts), 3 s default per-host delay floored at 1 s and ceilinged at 30 s of
in-invocation wait, `Retry-After` parsed in both delta-seconds and HTTP-date
forms, compare-and-set host slot reservation across lambdas, SSRF refusal
including the IPv4-mapped IPv6 forms WHATWG URL rewrites into hex. None of that
needs changing for web discovery. It is the input that does not exist.

## The pipeline throughput ceiling — the number that decides this

From the repo, not estimated:

| Constant | Value | Where |
|---|---:|---|
| Cron schedule | `3-59/10 * * * *` → 144 ticks/day | `vercel.json` |
| Tasks per tick | `BATCH = 25` | `app/api/cron/sales-pipeline/route.js` |
| Crawl tasks per tick | `http_crawl: { maxPerRun: 20 }` | `lib/sales/pipeline/limits.js` |
| Discovery tasks per tick | `discovery: { maxPerRun: 10 }` | same |
| Businesses per discovery task | `PAGE_SIZE = 100` | `lib/sales/discovery/overture/provider.js` |
| Pages fetched per site | `MAX_PAGES_PER_RUN = 6` | `lib/sales/crawl/policy.js` |

So:

- **Total pipeline: 3,600 tasks/day.**
- **Listing-first discovery (Overture): up to 144,000 businesses/day** — 10
  discovery tasks per tick × 100 rows × 144 ticks. Each arrives with a name, a
  phone, an address, coordinates and a category.
- **URL-first discovery: at most 2,880 domains/day**, and only if crawling is
  the *only* thing the pipeline does, because a candidate domain is worthless
  until it has been crawled.

**A URL-first source is ~50× more expensive per business than a listing-first
source, in the currency the pipeline is actually short of.** And that is the
optimistic reading: a listing row is a business, whereas a crawled candidate
domain is a coin toss that may turn out to be a directory, a supplier or a
franchise landing page.

## The ingest path rejects a URL-only record three times over

I traced a hypothetical `DiscoveredBusiness` carrying nothing but
`{ sourceRecordId: "acmeplumbing.ca", websites: ["https://acmeplumbing.ca"] }`
through `planIngest` in `lib/sales/discovery/ingest.js`. It dies at the first
gate and would die at two more:

1. **`tradeForCategories(business.categories)`** runs before anything else and
   is category-driven. No categories → `tradeKey` null → `unmappedCount++`,
   `reason: "no_trade"`, row discarded. `lib/sales/discovery/trades.js` exports
   only `tradeForCategories`; **there is no text- or domain-name-based trade
   mapper in this repo.**
2. **`classifyBusiness`** (if it were reached) takes `name` + `categories` +
   `taxonomyHierarchy`. With none of them, tier C pushes `"no_name"` and it
   returns `needs_review` — for *every* row. A URL-first campaign would send
   100% of its output to a superadmin's manual review screen.
3. **`normaliseBusiness`** pushes `"no_name"` and returns `ok: false`, because
   `Prospect.businessName` is `String` and non-nullable. There is no way to
   write a prospect that has a domain and no name.

This is not a defect. Every one of those gates has a comment explaining why it
refuses to guess, and they are right. It does mean **a URL-first record cannot
enter the existing pipeline at all** — the seam it would need is not the
provider interface, it is upstream of it.

## The identity problem, against `dedupe.js` as written

`dedupeKeys` produces, strongest first: `source_record`
(`provider:sourceRecordId`), `phone`, `domain`, `name_locality`. A
domain-discovered record can supply exactly two of those — a `source_record`
key (use the registrable domain as the id; it is stable, which is what the
interface asks for) and a `domain` key.

`normaliseDomain` in `lib/sales/suppressionRules.js` strips scheme, `www.`,
port, path and trailing dot, so `https://www.acme.ca/contact` and `acme.ca`
produce the same key. Matching would work.

**But the domain key `flag`s, it does not `update`.** `matchExisting` returns
`{ action: "flag", via: "domain" }`, and `ingest.js` then writes a *second*
Prospect row with `possibleDuplicateOfId` set, because `dedupe.js`'s header is
explicit that merging destroys provenance and a wrong merge is unrecoverable.

That is correct behaviour and it is also the operational trap here. **92.7% of
Overture's rows already carry a website** (`MEASURE-overture-coverage.md`), so a
web sweep over a territory Overture already covers would generate mostly
duplicate flags — each one four seconds of a superadmin's attention, on a screen
that exists to catch genuine ambiguity and would instead be full of noise.

The fix is structural, not a tuning change: **a web provider must exclude
already-known domains before it emits a row**, inside `fetchPage`, for exactly
the reason the Overture provider gives for filtering territory there rather
than at ingest — "filtering afterwards would make '250 per task' mean
'somewhere between 0 and 250'".

## Territory cannot be applied to a domain

`SalesTerritory` is `country` / `province` / `city` / a lat-lng-radius, and
`inTerritory` in the Overture provider **excludes a row with no coordinates**
when a radius territory is set — deliberately, so a rep is not sent driving to
a business of unknown location.

A domain has no coordinates, no city and no country. A `.ca` TLD is a weak hint
and `.com` is none at all. So a web-discovered candidate **cannot be assigned to
a territory until it has been crawled**, which means the crawl budget is spent
*before* the geographic filter can run, not after. For a product whose
campaigns are defined as "1,000 painting contractors in Ottawa", this inverts
the cost structure completely.

## One dead column, found on the way

`ProspectCampaign.keywords String[] @default([])` — **nothing writes it and
nothing reads it.** `app/api/platform/sales/campaigns/route.js` does not accept
a `keywords` field on create, and a repo-wide grep for the identifier outside
`prisma/schema.prisma` returns only unrelated matches (SMS opt-out keywords, AI
JSON-schema keywords, marketing metadata).

That is `AGENTS.md` failure class 1, sitting in the schema waiting for exactly
this feature. Named here rather than quietly used: if web discovery is ever
built, this is the column it wants, and **if it is not built, the honest move is
to delete the column** rather than leave a field that looks like a shipped
capability. The trap to avoid is the one `AGENTS.md` names first — rendering a
"keywords" input on the campaign form that writes a column nothing reads.

---

# Part 1 — Common Crawl

All figures from Common Crawl's own blog, docs and the AWS Open Data registry.

## 1.1 What one monthly crawl actually is

**CC-MAIN-2026-34**, the August 2026 crawl
([announcement](https://commoncrawl.org/blog/august-2026-crawl-archive-now-available)):

| | |
|---|---:|
| Pages | 2.14 billion |
| Uncompressed content | 360 TiB |
| Unique hosts | 40.2 million |
| **Registered domains** | **33.1 million** |
| WARC, compressed | 84.78 TiB (100,000 files) |
| WAT, compressed | 13.92 TiB |
| WET, compressed | 5.84 TiB |
| Crawl window | 7–20 Aug 2026 |

Cross-checked against CC-MAIN-2025-33 (Aug 2025): 2.44 B pages, 47.5 M hosts,
38.5 M registered domains, 88.24 TiB WARC. **The trend across the year is
slightly down, not up.** Cadence is monthly, confirmed on the
[AWS Open Data registry entry](https://registry.opendata.aws/commoncrawl/).

Depth per host is **not published**. Dividing gives ~53 pages/host for Aug
2026, but that is a mean over a certainly heavy-tailed distribution — a handful
of giant sites hold millions of pages. **Do not assume a small contractor's
site is represented by ~50 pages; single digits, possibly one, is the realistic
figure for the long tail**, and CCBot is deliberately polite (honours
`Crawl-delay`, backs off on 429/5xx), which is itself why per-host depth is
shallow. This matters: if CC holds only a contractor's homepage, the "about"
and "contact" pages that carry the address are not in the corpus.

## 1.2 Index versus WARC — the decisive structural fact

The **columnar (Parquet) URL index**, documented at
[commoncrawl.org/columnar-index](https://commoncrawl.org/columnar-index), has
exactly these columns (from the published `CREATE EXTERNAL TABLE`):

```
url_surtkey                url_query                  content_mime_type
url                        fetch_time                 content_mime_detected
url_host_name              fetch_status               content_charset
url_host_tld               fetch_redirect             content_languages
url_host_2nd_last_part     content_digest             content_truncated
url_host_3rd_last_part     warc_filename              warc_record_offset
url_host_4th_last_part     warc_record_length         warc_segment
url_host_5th_last_part     url_protocol
url_host_registry_suffix   url_port
url_host_registered_domain url_path
url_host_private_suffix    crawl    (partition)
url_host_private_domain    subset   (partition)
url_host_name_reversed
```

**There is no page text and no geography.** `content_*` columns are descriptors
*about* content — digest, MIME type, charset, language, truncation — never the
content itself. The `warc_filename` / `warc_record_offset` /
`warc_record_length` triple exists precisely so you go elsewhere for the bytes,
and the arithmetic settles it: ~300 GB of index against ~85 TiB of WARC.

*(Common Crawl nowhere states "the index contains no text" in one sentence;
this is an inference from an exhaustive schema, and a sound one, but it is an
inference.)*

- **WARC** — the raw HTTP responses.
- **WAT** — metadata as JSON: HTTP headers and the links on each page.
- **WET** — **yes, this is the extracted plaintext.**

So the query the brief asks about — *"every domain whose homepage mentions
plumbing and an Ontario city"* — **cannot be answered from the index.** The
index knows hostnames; the words are in the WARC/WET.

## 1.3 Licence and terms — the honest answer is "it does not say"

[commoncrawl.org/terms-of-use](https://commoncrawl.org/terms-of-use), last
updated **7 March 2024**. Seventeen sections.

**This is a site/service terms-of-use, not a data licence.** There is no CC-BY,
no ODbL, no grant of rights in the crawled data. That distinction drives
everything.

The grant, §1, verbatim:

> "CC grants you a limited, non-assignable, non-transferable,
> non-sublicensable, non-exclusive, limited license to access and use the
> Service subject to the terms and conditions of these ToU."

That is access to *the Service*. **Commercial use of the data is not addressed
— neither permitted nor prohibited.** The word "commercial" appears once on the
page and refers to something else entirely (do not use their contact forms for
commercial solicitation).

§2, the pass-through, verbatim:

> "You also acknowledge and agree that all information, data, text, scripts,
> web pages, web sites, software, html page links, open data APIs, metadata or
> other materials contained in, or otherwise made accessible to you in, the
> Service (collectively the 'Crawled Content') may be subject to separate terms
> of use or terms of service from the owners of such Crawled Content."

§3, the operative obligation, capitalised in the original:

> "BY USING THE CRAWLED CONTENT, YOU AGREE TO RESPECT THE COPYRIGHTS AND OTHER
> APPLICABLE RIGHTS OF THIRD PARTIES IN AND TO THE MATERIAL CONTAINED THEREIN."

§3 also disclaims ownership outright:

> "You understand and agree that the Crawled Content made available through the
> Service is the sole responsibility of the individual or entity from which
> such Crawled Content originated."

§4 claims proprietary rights only in "The Site and the Service", not in the
data. The AWS registry entry simply defers: "This data is available for anyone
to use under the Common Crawl Terms of Use."

**What this means for us, stated as an engineer's reading and not as advice.**
Common Crawl is not a source that grants rights; it is a mirror that passes
them through. The question "may FieldQuo use this commercially" therefore has no
answer from Common Crawl and reduces to "may FieldQuo use *this page*". That is
a strictly worse position than Overture, whose CDLA-Permissive-2.0 grant is
explicit and whose "Results" are expressly unrestricted.

**But it is much better than it sounds for the narrow use we would make of it.**
The only thing we would take out of Common Crawl is a *list of hostnames* — and
a hostname is a fact, not a creative work. We would not store crawled page
content from CC, would not redistribute anything, and would fetch the actual
pages ourselves from the contractor's own live server under the §10 rules
`AUDIT-compliance.md` already sets. CC is being used as an *address book*, which
is the least rights-entangled possible use of it. **If web discovery were built,
using CC only for hostname enumeration and never for content is the design that
keeps it defensible, and that constraint should be written into the provider
rather than left to discipline.**

Three further points, flagged by confidence:

- **§9 (Indemnification)** reportedly requires the user to indemnify Common
  Crawl against claims arising from use of Crawled Content "in connection with
  artificial intelligence, machine learning, or other similar technologies", or
  from creating "Generated Content". **NOT VERIFIED VERBATIM** — this came from
  a summarising fetch, not a clean read. Given this pipeline's AI analysis
  stage, **somebody should open that section before anything is built.**
- Liability is reportedly capped at **$100 USD**, with binding JAMS arbitration
  and a class-action waiver. Same confidence caveat.
- **No redistribution clause was found.** Silence, not permission.

**Opt-out and takedown exist**: a DMCA agent under §5, an
[opt-out registry](https://commoncrawl.org/blog/common-crawl-foundation-opt-out-registry),
and [CCBot](https://commoncrawl.org/ccbot) honours robots.txt. Consequence for
us: **a contractor whose site blocks crawlers, or who opted out, is absent from
Common Crawl entirely** — and those are disproportionately the sites run by
whoever built them a template site with a restrictive default robots.txt.

## 1.4 Querying it — MEASURED, and the pruning does not go our way

The Overture technique transfers in shape: `scripts/overture-snapshot.mjs`
shells out to the `duckdb` CLI, `INSTALL httpfs`, `read_parquet(...)` with a
predicate that prunes row groups, and writes a small local file. Its header
records the payoff — *"without it this scans 9.76 GiB instead of 32 MB."*

**The owner ran this against Common Crawl directly rather than assuming, and
the result is the single most important finding in this document.** Measured
2026-09-03:

- Latest crawl **CC-MAIN-2026-34**; 127 collections listed at
  `index.commoncrawl.org/collinfo.json`.
- **Anonymous S3 access FAILS — it needs credentials.** This is a real
  difference from Overture, where `aws s3 ls --no-sign-request` works. The
  columnar index is reachable over plain HTTPS at `data.commoncrawl.org`
  instead, and the file list comes from
  `crawl-data/CC-MAIN-2026-34/cc-index-table.paths.gz` — **901 paths, of which
  300 are `subset=warc/`**. *(Published documentation describes the S3 bucket as
  openly accessible; the measurement says otherwise. Trust the measurement, and
  plan on HTTPS.)*
- DuckDB reads those Parquet files remotely with no auth. `count(*)` is
  instant — Parquet keeps it in file metadata.
- **The index is sorted by reversed domain, and that is what decides this.**
  `part-00000` holds **6,457,614 rows and exactly one distinct domain,
  `blogspot.com`** — min equals max for the whole file.
- Therefore `LIKE '%plumb%'` returned **0 rows in 0.9 s**. Not a failure: the
  row-group statistics correctly skipped everything, because a **leading
  wildcard cannot prune a sorted index.**
- `content-range` on one file gives **524,471,127 bytes**, so the warc-subset
  index is **~157 GB compressed per monthly crawl**, and a keyword sweep must
  read all 300 files.

**So the honest framing is not "$1.50 for a query".** Common Crawl is:

| Operation | Cost | Verdict |
|---|---|---|
| "Does this domain exist in the corpus?" | prunes perfectly, instant | excellent |
| "Fetch this one page" (`warc_filename` + offset + length, byte-range) | one request | excellent |
| **"Find domains matching a keyword"** | **157 GB read, all 300 files** | **a one-time bulk pass, not a query** |

Common Crawl's own docs put the *Athena* upper bound at *"about 300GB of
data… (about $ 1.50 USD as of September 2025)"* for a full scan, and their
example queries that scan kilobytes are all **prefix**-shaped — filtering by
TLD or by a known domain, which the sort order serves. A trade-token sweep is
the one shape the sort order cannot help.

157 GB over the public HTTPS endpoint, at the rate limits in §1.5, is hours of
sustained transfer on a workstation for a result that must then be repeated
next month. That is not a query in a cron job. It is a data-engineering
project.

Official tooling worth knowing exists: **`CCIndexWarcExport`** in
[cc-index-table](https://github.com/commoncrawl/cc-index-table) takes a SQL
result set and emits a WARC containing only the matching records. That is
precisely the "fetch the pages for my filtered list" operation, and it is built
to run in-region against S3.

## 1.5 Getting page text for a filtered set — and the rate limit that bites

Range requests are supported and officially documented
([cdxj-index](https://commoncrawl.org/cdxj-index)):

```bash
curl -s -r$OFFSET-$(($OFFSET+$LENGTH-1)) "https://data.commoncrawl.org/$FILENAME" > out.warc.gz
```

Each WARC record is independently gzipped, so a range slice decompresses
standalone. You get the raw HTTP response, not WET plaintext; you extract text
yourself.

**The rate limit is the real constraint, not money.** From Common Crawl's
[Oct/Nov 2023 performance post](https://commoncrawl.org/blog/oct-nov-2023-performance-issues):

> "you'll want to stay below 10 per second, or if things someday become better,
> perhaps 100 per second."

> "Whenever you get a 503 error, you should not retry in less than a second,
> and you should back off to at least 10 seconds per retry."

And the warning that lands squarely on this use case:

> "This retry technique does not work well enough for partial file downloads,
> such as index lookups and downloading individual webpage captures within a
> WARC file."

Their own [cc-downloader](https://github.com/commoncrawl/cc-downloader)
defaults to 10 threads and warns that too many requests produce `403` errors
that are **"unrecoverable and cannot be retried"**.

**Concretely: 200,000 range requests at a polite 10/s is ~5.5 hours of
continuous fetching, against an access pattern CC explicitly says its retry
guidance does not cover.** The supported path at that scale is
`CCIndexWarcExport` running in us-east-1 against S3 directly. Range requests
are for prototyping and for hundreds to low thousands of records.

## 1.6 WET cannot be filtered by domain

**5.84 TiB compressed, 100,000 files, no index.** The columnar index lives under
`.../cc-index/table/cc-main/warc/` and its `subset` partition admits only
`warc`, `crawldiagnostics`, `robotstxt` — **there is no WET subset and no WET
index**, and the `warc_record_offset` values are meaningless against a WET file
because WET drops non-HTML records entirely. The question has been open and
unanswered on Common Crawl's own tracker since 2016
([commoncrawl#11](https://github.com/commoncrawl/commoncrawl/issues/11)).

*(This is established by the schema and the unanswered issue, not by a positive
statement from Common Crawl. It is strong, not quoted.)*

So "keyword over page text" costs either 5.84 TiB of WET or a WARC export of a
pre-filtered set. **Which means the keyword must be applied to something in the
index — and the only keyword-shaped thing in the index is the hostname.**

## 1.7 What this actually buys, and the two ways to use it

### The query: keyword on the domain name — sound, but a bulk pass

From `url_host_registered_domain` over one monthly crawl you can extract every
registered domain matching a trade token — `%plumb%`, `%paint%`, `%roofing%`,
`%hvac%` and so on across the 39 keys in
`DISCOVERY_TRADES` (painting, cabinets, flooring, countertops, roofing,
plumbing, electrical, hvac, landscaping, carpentry, drywall, tiling, siding,
gutters, fencing, masonry_concrete, paving, insulation, restoration, chimney,
pressure_washing, junk_removal, house_cleaning, carpet_cleaning,
window_cleaning, handyman, excavation, demolition, garage_door, locksmith,
appliance_repair, pest_control, tree_care, pool_spa, irrigation, snow_removal,
home_inspection, remodeling, general_contracting).

This works, and it is the only version of "keyword discovery" Common Crawl can
serve without touching content. But per §1.4 it is a **157 GB bulk read, every
month, that no row-group statistic can shorten** — an offline data-engineering
job, not something a cron tick does.

### Why it does not become a campaign

**Geography.** The index has none. `url_host_tld = 'ca'` does not mean Canada
in any useful sense (most Canadian contractors are on `.com`) and `.com` means
nothing at all. There is no province, no city, no coordinate. So a sweep
returns global candidates and **the only way to find the Ontario ones is to
crawl them** — spending the scarce resource before the filter that would have
made it worth spending.

**Precision.** A domain containing `plumb` matches suppliers
(`fergusonplumbingsupply.com`), directories (`plumbersnearme.net`), forums,
national franchises, listicles, parked domains, and every plumber in Ohio,
Queensland and Yorkshire. `classify.js` cannot help: it takes `name`,
`categories` and `taxonomyHierarchy`, and a bare domain has none of the three.
A domain-name-only classifier would be a new file, and it would be guessing
from ~15 characters.

**Recall.** It only finds contractors who put the trade in the domain name.
"Superior Coatings", "MacDonald & Sons", "613 Pro Services" — invisible. There
is no published measurement of what fraction of contractor domains contain a
trade token, and **I did not attempt to measure it, because measuring it means
querying Common Crawl, which this brief excluded.**

### The arithmetic that ends it

Suppose the sweep is generous and yields 100,000 candidate domains for North
America across all 39 trades. Every one needs a crawl before it is anything.

| | |
|---|---:|
| Candidate domains | 100,000 |
| Pipeline crawl capacity | 2,880/day |
| **Days of pipeline, doing nothing else** | **~35** |
| Contractors found, at an optimistic 20% precision | 20,000 |
| Of which already in the prospect bank (Overture website fill is 92.7%) | unknown, plausibly most |

Against which: **Overture ingests up to 144,000 businesses/day** on the same
pipeline, each already carrying a name, phone, address, coordinates and
category, at $0.

**That is the finding. Common Crawl is affordable and legal enough; it is the
crawl budget that makes it unaffordable.**

---

# Part 2 — Search APIs

The question that decides a search API is not price. It is **whether the terms
let you keep the results.** A search API that forbids retention is an enricher,
not a discovery source — structurally identical to the position
`AUDIT-compliance.md` already put Google Places in, and for the same reason.

## 2.1 Bing Web Search API — RETIRED. Do not plan around it.

The brief was right to flag this. Microsoft's own lifecycle announcement
([learn.microsoft.com/lifecycle/announcements/bing-search-api-retirement](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement)),
verbatim:

> "Bing Search APIs will be retired on August 11, 2025. Any existing instances
> of Bing Search APIs will be decommissioned completely, and the product will no
> longer be available to be used or new customer signup."

> "Customers are encouraged to migrate to Grounding with Bing Search as part of
> Azure AI Agents."

**Retired 11 August 2025.** The replacement, *Grounding with Bing Search* in
Azure AI Agent Service, is not a drop-in: it feeds web context into an agent
that generates a response. It does not hand you a structured list of URLs to
keep.

It would not have served anyway. The (now archived) Use and Display
Requirements said, verbatim, under "Do not":

> "Copy, store, or cache any data from responses (except retention to the extent
> permitted by continuity of service)."

> "Use data received from the Search APIs as part of any machine learning or
> similar algorithmic activity."

The continuity-of-service carve-out capped retention at **21 days**, per user,
displayable only as that user's own search history. There was a narrow
"Non-display URL discovery" allowance permitting URLs to be copied *into a
report for the customer who asked that query* — followed immediately by "Do not
cache, copy, or store any data or content from, or derived from, the search
response, other than the limited URL copying described previously." A permanent
prospect database was never inside it.

**VERDICT: dead, and had storage been the only obstacle it would still have
been forbidden.**

## 2.2 Brave Search API — the only one that sells storage rights

**Pricing** ([brave.com/search/api](https://brave.com/search/api/)): Search at
**"$5 per 1,000 requests"**, `$5` in free monthly credits, 50 queries/second.
An Enterprise tier exists with custom agreements.

The **standard** Terms of Service
([api-dashboard.search.brave.com/documentation/resources/terms-of-service](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service))
§3(b) forbids precisely our use case, verbatim — you shall not:

> 3(b)(i): "store, cache, or create a database of Search Results, in whole or in
> part, other than transient storage required for operation of Customer
> Applications"

> 3(b)(xiii): "use the Search Results to create, evaluate, train, re-train,
> fine-tune, benchmark or otherwise improve artificial intelligence models"

**But Brave is genuinely unusual, and the brief's hunch was correct.** Brave's
own pricing copy, verbatim:

> "If you would like to store the API results in part or whole (for example, to
> train or tune an LLM), you will need to subscribe to a plan that explicitly
> grants storage rights."

> "Plans with storage rights grant special permissions which are not covered in
> our general Terms of Service."

The plan is listed on Brave's AWS Marketplace entry
([aws.amazon.com/marketplace/pp/prodview-qjlabherxghtq](https://aws.amazon.com/marketplace/pp/prodview-qjlabherxghtq))
as **"Data for AI" — $0.005 per request (~$5 per 1,000)**, unlimited monthly
queries, granting "storage rights for retrieved results".

**NOT VERIFIED:** the storage-rights plan's own terms are behind authentication
at `api-dashboard.search.brave.com/app/plans?tab=storage`, and the session that
wrote this did not create an account. **The actual contract text has not been
read by anyone here.** Before a line of code is written against it, somebody
must get that text from `searchapi-support@brave.com` in writing. A plan
description on a marketplace listing is not a licence.

**VERDICT: STORAGE PERMITTED on a storage-rights plan, FORBIDDEN on the
standard plan — subject to reading the contract nobody has read.**

## 2.3 SerpAPI and DataForSEO — excluded on terms, not on price

Both resell Google SERP content obtained by automated querying of Google.

**SerpAPI** ([serpapi.com/pricing](https://serpapi.com/pricing)): $25/1,000 at
Starter down to ~$5.50/1,000 at $2,750/mo. Its legal page offers a "U.S. Legal
Shield" of up to $2 M — but only from the **Production** tier ($150/mo) upward,
and it is carefully bounded, verbatim:

> "SerpApi assumes liability for the lawful collection of public search data
> (scraping, parsing, and related actions), but not for how that data is
> ultimately used."

**On whether *you* may store the results, SerpAPI's terms say nothing at all.**
`serpapi.com/terms` and `serpapi.com/legal/terms-of-service` both 404; every
retention statement on the live legal page concerns SerpAPI's own systems.

**DataForSEO** ([dataforseo.com/pricing/google-serp/google-organic-serp-api](https://dataforseo.com/pricing/google-serp/google-organic-serp-api))
is the cheapest option found anywhere: **$0.60 per 1,000 SERPs** on the regular
standard queue (~5 min), $1.20 priority, $2.00 live. It too has no clause
governing your storage — and it pushes the risk the other way, verbatim:

> "You agree to indemnify, defend, and hold harmless DataForSEO from any and all
> claims, damages and losses arising from or relating to Your violation of
> Section 7.1, including any use of SERP data that violates the terms of service
> or legal rights of the search engine providers."

### The clause that excludes both

Google's spam policies
([developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies))
define "machine-generated traffic" as "the practice of sending automated queries
to Google", covering "scraping results for rank-checking purposes or other types
of automated access to Google Search conducted without express permission",
which Google states "violate our spam policies and the Google Terms of Service."

*(The frequently-quoted older sentence "You may not send automated queries of
any sort to Google's system without express permission in advance from Google"
could not be confirmed verbatim on a current live Google page. The current
[policies.google.com/terms](https://policies.google.com/terms) instead forbids
"using automated means to access content from any of our services in violation
of the machine-readable instructions on our web pages". The prohibition is not
in doubt; its exact current wording is.)*

**This is settled repo policy already.** `AUDIT-discovery-sources.md` §2.6 ruled
out "Google-derived scraper APIs (Outscraper, Apify, SerpApi, ScrapingBee et
al.)" with the reasoning that applies verbatim here: *"Buying it through a
middleman does not change whose content it is… the vendor is in no position to
grant rights it does not hold."* And `AUDIT-compliance.md` §10 lists under **Not
defensible**: *"Crawling directories and aggregators rather than the
contractor's own site — those have enforceable terms of service and an active
interest in enforcing them, and that is precisely the Google problem again in a
different costume."*

**VERDICT for both: TERMS BREACH by the vendor on our behalf. EXCLUDED, and not
recommended however effective.** Note that this is a statement about scraping
Google, not about search APIs generally — Brave runs its own index, which is
exactly why it is in a position to sell storage rights and Google's resellers
are not.

## 2.4 The two others worth naming, briefly

**Google Custom Search JSON API** — 100 queries/day free, then "$5 per 1000
queries, up to 10k queries per day", and, verbatim from
[developers.google.com/custom-search/v1/overview](https://developers.google.com/custom-search/v1/overview):

> "The following pricing applies only to existing Custom Search JSON API
> customers until the service discontinuation on January 1, 2027. This API is
> not available for new customers."

Closed to new customers and dying. The Google APIs ToS §5.e.1 forbids it anyway
— you may not "Scrape, build databases, or otherwise create permanent copies of
such content". **Excluded twice over.**

**Exa** ([exa.ai/pricing](https://exa.ai/pricing)) — "$7 / 1k requests" for
Search, "$1 / 1k pages" for Contents. Markets itself as the search API for AI,
but §5.2(a) of its Terms of Service forbids, verbatim, to

> "download, modify, copy, distribute, transmit, display, perform, reproduce,
> duplicate, publish, license, create derivative works from, or offer for sale
> any information contained on, or obtained from or through, the Services,
> except for temporary files that are automatically cached by your web browser"

Exa's heavily-marketed "Zero Data Retention" is about **Exa** not retaining
**your queries** — the opposite of a grant for you to retain their results, and
the marketing invites that confusion. **STORAGE FORBIDDEN as written.** Worth a
direct question to their sales team, since it reads like boilerplate at odds
with the positioning, but not on the face of the contract.

## 2.5 What a Brave sweep would actually return — and why it still fails

Suppose the Brave storage-rights contract checks out. Cost is not the obstacle:
39 trades × 5 query phrasings × 50 cities is 9,750 queries ≈ **$49**. That is
nothing.

Three structural problems remain, and they are the same three that killed
Google Places as a census in `AUDIT-discovery-sources.md`:

1. **A results ceiling.** A SERP is ~10–20 results. Enumerating a city's 70–91
   painters from a surface designed to answer "who should I call" rather than
   "list everyone" means paging, and paging runs out. This is the 20-and-60
   ceiling in a different costume.
2. **Directories dominate the results, by design.** The first page of "plumber
   Ottawa" is HomeStars, Yelp, Yellow Pages, Angi, Houzz, Bark, three listicles
   and a maps pack. Those are aggregators with enforceable terms, and
   `AUDIT-compliance.md` §10 already forbids crawling them. A search API
   optimised for user intent surfaces exactly the pages we may not use, and
   buries the single-van contractor we want.
3. **The same crawl budget problem as Part 1.** Every URL returned is still just
   a URL, and still costs a crawl task to become a business. Brave changes the
   legality and the price; it does not change the 2,880/day ceiling.

**So Brave is the only legally clean search API, and it is still not a
discovery source for this product.** It is, however, a legitimate *enrichment*
tool — "find this named business's website" for a prospect that has a name and
no URL — and that is a real gap worth remembering: Overture's website fill is
92.7%, so roughly 7 in 100 discovered businesses have no URL to crawl and
`routeAfterEnrich` sends them straight past the crawl stage. A single
storage-rights Brave query on `"<businessName>" <city>` would fill some of
those. That is a small, bounded, obviously-useful feature. It is not what was
asked for and it is not this document's recommendation, but it is the one place
a search API earns its keep here.

---

# Part 3 — Non-crawl domain sources

Assessed briefly, as the brief asked. **One is excluded on terms, one is a
genuine improvement on Common Crawl, one is too small to build for, and one
looks like the winner until you read the compliance rule this repo already
has.**

## 3.1 DNS zone files — EXCLUDED on terms

ICANN's Centralized Zone Data Service ([czds.icann.org](https://czds.icann.org/))
covers gTLDs bound by the base Registry Agreement, and **.com is included** —
the [.com Registry Agreement Appendix 3A](https://itp.cdn.icann.org/en/files/registry-agreements/com/com-appx-03a-pdf-27mar20-en.pdf)
names the "CZDS User" and grants a copy of the zone file "no more than once per
24 hour period using SFTP".

The operative use restriction, from that appendix:

> "Registry Operator will permit user to use the zone file for lawful purposes;
> provided that (a) user takes all reasonable steps to protect against
> unauthorized access to, use of, and disclosure of the data and (b) under no
> circumstances will Registry Operator be… permitted to allow user to use the
> data to (i) allow, enable or otherwise support any marketing activities to
> entities other than the user's own existing customers, regardless of the
> medium used…"

**SOURCING CAVEAT, stated because it matters:** the CZDS Terms and Conditions
page is a JavaScript application that could not be fetched. The wording above
was reconstructed from the .com Appendix 3A PDF, whose embedded text uses a
subset font encoding, **so treat it as near-verbatim rather than verbatim.** It
matches the standard Specification 4 language. Anyone relying on this should
read the live T&C in a browser.

Even discounted for that, the clause is unambiguous in substance: **using zone
data to support marketing to entities that are not already your customers is
precisely what a prospecting sweep is.** That is a terms breach, and per the
brief it is therefore excluded regardless of effectiveness.

It would be a poor source anyway. A zone file is `<domain> <TTL> <class> <type>
<RDATA>` — delegated names with NS/DS records and glue, **no registrant, no
subdomains, no indication the name hosts anything at all**. The .com zone passed
**160,009,277 domains** in February 2026. That is Common Crawl's problem without
Common Crawl's one advantage (CC at least only lists domains that actually
served a page).

**.ca appears to have no equivalent.** It is a ccTLD, outside CZDS, and no
public CIRA zone-file programme was found. That is an **unverified negative** —
worth one email to CIRA rather than an assumption — but it means the TLD that
matters most for a Canadian sales territory is the one with no zone access.

## 3.2 Certificate Transparency — better than Common Crawl at the same job

CT is the one source that genuinely beats Common Crawl on its own terms, and it
should be recorded as such even though the recommendation does not build it.

- **Free, public by design, real-time.** Certificates are logged as they are
  issued, so a new contractor's site appears within hours instead of waiting a
  month for the next crawl.
- **Access**, cheapest first: crt.sh's public Postgres endpoint
  (`psql -h crt.sh -p 5432 -U guest certwatch`, announced by Sectigo's Rob
  Stradling at [groups.google.com/g/crtsh/c/sUmV0mBz8bQ](https://groups.google.com/g/crtsh/c/sUmV0mBz8bQ));
  Certstream's websocket firehose; or raw RFC 6962 `get-entries` against each
  log, which is the only option with no third-party dependency.
- **No licence restriction was located** on CT-derived hostnames. State that as
  "none found", **not** as "permitted" — no primary licence statement was found
  either way. Equally, **no acceptable-use policy for crt.sh was found**, which
  cuts both ways: nothing forbids a bulk pull and nothing entitles you to one.
  It is one company's free service, Stradling notes "a fairly short timeout for
  inactive sessions", and long queries get killed by replication conflicts.
  Hammering it would be taking goodwill.
- **Volume: roughly 10 M certificates/day across all logs by late 2025.
  UNVERIFIED** — Let's Encrypt's stats page renders its chart in JavaScript with
  no text figures. Unique *hostnames* per day is far lower: Chrome policy
  requires submission to ≥2 logs, and DV certificates renew every 60–90 days.
  Deduplication is mandatory, not optional.

**And it has exactly the same fatal flaw as Common Crawl: no business signal.**
A DV certificate carries SAN hostnames, validity and issuer — nothing else.
OV/EV certificates *do* carry Subject `O`/`L`/`ST`, i.e. legal name and city,
which would be a real signal; but small contractors are almost universally on
Let's Encrypt or host-issued DV, so in practice **you get the hostname string
and nothing more.** No name, no address, no trade, no geography.

**Verdict: if keyword-on-hostname discovery were ever built, CT is the source to
build it on, not Common Crawl** — fresher, free, streaming, and with no 157 GB
monthly pass. It does not change the recommendation, because the hostname is
still all you get and the crawl budget in Part 0 is still what has to pay for
turning it into a business.

## 3.3 Trade associations — real quality, no volume

- **NRCA** — "more than 3,600" members ([nrca.net/about](https://www.nrca.net/about)), public directory.
- **PHCC** — public zip-code [Find a Contractor](https://www.phccweb.org/tools-resources/find-a-contractor/); the page template carries a member website field. No published member count.
- **Landscape Ontario** — "more than 3,000 professional members", public company finder.
- **PCA** — its "more than 300,000 contractors" is an **industry representation
  claim, not membership**. Actual dues-paying membership is low thousands. Worth
  flagging because that number would otherwise look like the best source in this
  document.
- **CFIB** — ~100k members, **no public member directory**. Useless here.

All of them together are perhaps **10–15k member records**, against ~120k US
plumbing establishments alone, and each needs a bespoke parser. **Do three or
four by hand once if a specific territory needs topping up. Build no
infrastructure.**

## 3.4 Chamber of Commerce directories — the tempting one, and why not

On the face of it this is the best source in Part 3, and the only one anywhere
in this document that yields **trade category, city, and website URL together**
— the exact triple that Part 0 shows a bare domain cannot supply and that
`planIngest` needs to accept a row.

It is also platform-concentrated, which is where the leverage claim comes from:
ChamberMaster/GrowthZone serves thousands of chambers on uniform URL patterns
(`<chamber>.chambermaster.com/list`, `business.<chamber>.org/memberdirectory`),
with Weblink a distant third. San Antonio's is public, "Powered By GrowthZone",
with 200+ categories including Construction. One parser, thousands of sites.

**Two things kill it.**

1. **Scale.** A mid-size city chamber has 800–2,000 members (unverified), of
   which field-service trades are plausibly 5–10% — chambers skew to
   professional services, restaurants and retail. That is **~50–150 candidates
   per chamber**. To match Washington L&I's 75,839 you would need to parse on
   the order of a thousand chambers.
2. **The compliance rule this repo already wrote.** `AUDIT-compliance.md` §10
   lists under **Not defensible**: *"Crawling directories and aggregators rather
   than the contractor's own site — those have enforceable terms of service and
   an active interest in enforcing them."* A chamber member directory is a
   directory. And **the binding terms are each chamber's own, not the
   platform's** — GrowthZone's own terms could not even be located.

Those two combine into the actual finding: **the leverage claim and the
compliance requirement are mutually exclusive.** "One parser covers a thousand
chambers" is only cheap if you do not read a thousand sets of terms and a
thousand `robots.txt` files. Read them, and the per-chamber cost is back, for
50–150 candidates each. Skip them, and it is the Yellow Pages problem in a
friendlier costume.

That existing Apify GrowthZone scrapers exist proves it is technically trivial.
It does not make it permitted, and technically-trivial-but-unpermitted is the
exact shape of every source this programme has already rejected.

**Verdict: not recommended. If the owner wants it anyway, it must be
opt-in per chamber** — read that chamber's terms, honour its robots.txt, record
which chamber and when — which is a hand-curated source, not a sweep.

## 3.5 Ranked

| Source | Yield | Business signal | Terms | Verdict |
|---|---|---|---|---|
| Chamber directories | ~50–150 per chamber | **category + city + URL** | each chamber's own; unverified | not recommended; hand-curated only |
| Certificate Transparency | very high, real-time | **hostname only** | none found (either way) | best *hostname* source if ever needed |
| Trade associations | ~10–15k total | good | public directories | do 3–4 by hand, build nothing |
| DNS zone files | 160 M .com names | **none** | **forbids marketing to non-customers** | **EXCLUDED on terms** |

**None of the four beats importing a licence register**, and the reason is the
same one as Part 1: three of them yield hostnames rather than businesses, and
the fourth yields businesses in batches of a hundred behind a thousand separate
terms-of-service reads.

---

# Part 4 — The one thing only web search can do: prove a business has NO website

This is the strongest argument in favour of anything in this brief, and it
arrives from an unexpected direction. It is also a live defect.

## 4.1 `hasWebsite` can never be written `false`

Traced through every writer in the repo:

| Writer | What it writes |
|---|---|
| `lib/sales/discovery/normalise.js:261` | `hasWebsite: websiteUrl ? true : null` |
| `lib/sales/crawl/crawlSite.js:490` | `...(hadContent && prospect.hasWebsite !== true ? { hasWebsite: true } : {})` |

**That is the complete set. Nothing writes `false`.** And both refusals are
deliberate and correct — `normalise.js`'s header says a source with no website
column is a gap in the directory, and `crawlSite.js`'s says a failed fetch is
not proof of absence. `enrichBusiness.js` states the consequence outright:

> "Only a crawl may make that claim, and today nothing does."

Except a crawl cannot make it either. A crawl needs a `websiteUrl` to fetch; a
prospect with no URL never reaches the crawl stage at all —
`routeAfterEnrich()` sends it to `DETECT_OPPORTUNITIES` with the reason
`no_website_to_crawl`. **There is no code path in this system that can observe
the absence of a website.**

## 4.2 What that breaks, downstream

Three shipped things depend on a value nothing can produce:

1. **`NO_WEBSITE` in `lib/sales/intel/rules.js:90`** — `priority: 90`, the
   highest-priority non-competitor opportunity rule there is. Its condition is
   `{ kind: "capability", code: "WEBSITE", is: false }`. **It can never fire.**
2. **`capabilityDetect.js:721`** — `if (prospect?.hasWebsite === false && !url)`
   is a dead branch. Every prospect without a URL falls through to
   `value: null, confidence: 0, reason: "not_looked"`.
3. **A dead control in the platform console.** `app/platform/sales/prospects/page.js`
   renders a Website filter with the option **`"Has none — we looked"`**, and
   `app/api/platform/sales/prospects/route.js:80` maps it to
   `where.hasWebsite = false`. **That filter always returns zero rows.** The
   list row's pill `"No website — we looked"` (line 487) never renders either.

That last one is `AGENTS.md`'s cardinal rule — *"Never ship a control that
appears to work and doesn't"* — sitting in the sales console today. It is not
caused by this brief and it is not fixed by it, but this is the document that
found it, so it is named here. **It should be raised as its own piece of work
regardless of what is decided about web discovery.** The honest interim fix is
to remove the option and the pill until something can write the value; the real
fix is below.

## 4.3 Only a name-keyed search can prove absence

To say "this business has no website" you must look for one and fail. That
requires searching by **business name**, which is exactly the axis Common Crawl
cannot serve — its index is keyed on hostname and holds no page text, so there
is no way to ask it "is there a site belonging to Superior Coatings of Ottawa".

A search API can. One query per prospect, `"<businessName>" <city>`, and a
result set containing no plausible own-domain match is real evidence of absence
— far better evidence than the empty directory column that is refused today.

The shape this should take, so it does not become another over-claiming field:

- **A third value, not a boolean flip.** The observation is "we searched and
  found nothing", which is stronger than "not looked" and weaker than proof.
  Write `hasWebsite: false` only on a clean negative, record the query and the
  date as `ProspectEvidence` (`source: "search"`, a new value alongside
  `google` / `website` / `bbb` / `registry` / `call`), and leave `null` when the
  search itself failed. The distinction `crawlSite.js` already draws between
  "did not load" and "does not exist" is the same distinction.
- **Bounded by construction.** This runs once per prospect at the enrich stage,
  only for prospects with no `websiteUrl` — roughly 7% of Overture rows, since
  website fill is 92.7%. It is not a sweep.
- **Only on a licence that permits retention.** Per Part 2 that means Brave's
  storage-rights plan, whose contract nobody here has read, or nothing.
  A negative result stored indefinitely is retention, and the standard Brave
  ToS §3(b)(i) forbids it in terms.

**Cost, for the whole prospect bank at Overture scale:** 775,628 businesses ×
~7.3% with no listed website ≈ 57,000 queries. At Brave's ~$5/1,000 that is
about **$285, once**, and a few dollars a month thereafter for new discoveries.
For comparison, that is less than the ~$4,500 a 50,000-record LeadsPlease
mailing list would cost, and it activates the highest-priority sales rule in
the product.

**This is a real feature with a real price and a bounded blast radius, and it
is the only part of "search the web" that this product actually needs.**

---

# Part 5 — What it would take to build keyword discovery, if it were built anyway

Written out because "we decided not to" is only credible if the alternative was
costed. This is the honest shape, not a sketch.

## 5.1 The provider interface fits — that is not the problem

`registerDiscoveryProvider` in `lib/sales/discovery/provider.js` needs
`describeConfig` and `fetchPage`, and its header is explicit that a provider
emits a **`DiscoveredBusiness`, never Prospect columns**. A web provider would
be a new file plus one line in `lib/sales/discovery/providers.js`, exactly as
the header promises. Nothing in `lib/sales/pipeline/` changes.

The snapshot pattern transfers too: DuckDB cannot run in a Vercel function (see
`lib/sales/discovery/overture/snapshot.js`), so a `scripts/cc-domains.mjs`
would run on a workstation, query the Common Crawl columnar index the way
`scripts/overture-snapshot.mjs` queries Overture, and write an NDJSON snapshot
with a manifest naming the crawl (`CC-MAIN-2026-34`) instead of the Overture
release. `ProspectCampaign.providerConfig` already carries a per-campaign
`snapshotUrl` with no schema change.

**The interface is fine. What does not fit is the payload.**

## 5.2 The `DiscoveredBusiness` a web provider can honestly emit

```
{
  sourceRecordId: "acmeplumbing.ca",     // the registrable domain — stable ✓
  name: null,                            // ✗ unknown until crawled
  categories: { primary: null, alternate: [] },   // ✗ unknown
  taxonomyHierarchy: [],                 // ✗ none
  phones: [], emails: [],                // ✗ unknown
  websites: ["https://acmeplumbing.ca"], // ✓
  address: {},                           // ✗ unknown
  latitude: null, longitude: null,       // ✗ unknown
  operatingStatus: null,                 // ✓ honestly null
  sourceConfidence: null,
  sourceDataset: "CC-MAIN-2026-34",      // ✓
  sourceUpdatedAt: "2026-08-20T…"        // ✓ the crawl's fetch_time
}
```

`shapeProblems()` passes this — it only requires `sourceRecordId`. **Then
`planIngest` throws it away at the first gate** (`tradeForCategories` → no
categories → `no_trade`), as traced in Part 0. Two more gates would reject it
after that.

So building this means changing the ingest contract, and that is where the real
cost is.

## 5.3 The schema that is missing

`Prospect` cannot hold a URL-only record: `businessName` is `String`,
non-nullable, and its own comment says an empty string there would be "a
required column holding a lie". Making it nullable is the wrong fix — dozens of
readers, the rep queue, the dedupe fuzzy key and every screen assume a name.

`ProspectEvidence` cannot help either: it requires a `prospectId`, so a
candidate has nowhere to record what was observed about it.

**The right shape is a staging table in front of the bank, not a weaker
Prospect.** Sketch:

```prisma
/// A candidate website with no business attached to it yet.
///
/// Deliberately NOT a Prospect with null columns: Prospect.businessName is
/// required because every screen and the fuzzy dedupe key assume it, and a
/// nullable name would put "" in a rep's queue. A candidate is a different
/// kind of thing — an address to investigate, not a business — and it earns
/// promotion by being crawled, or it is discarded.
model DiscoveredDomain {
  id       String @id @default(cuid())
  /// Registrable domain, via normaliseDomain. The dedupe key AND the id.
  domain   String @unique
  url      String

  sourceProvider String   // "commoncrawl"
  sourceRelease  String?  // "CC-MAIN-2026-34"
  matchedToken   String?  // which trade token the hostname matched
  discoveredAt   DateTime @default(now())

  /// pending | crawled | promoted | rejected | unreachable
  status         String   @default("pending")
  /// Why it was rejected, in a sentence. Stored, not recomputed, for the same
  /// reason classificationReason is.
  rejectedReason String?

  /// Set when a crawl produced enough identity to write a real Prospect.
  promotedProspectId String?

  campaignId String?
  @@index([status, discoveredAt])
}
```

And the pieces that do not exist and would have to be written:

| Missing piece | Why the existing one cannot serve |
|---|---|
| `tradeForText(title, text)` | `trades.js` exports only `tradeForCategories`; a crawled page has no categories |
| A text-based classifier tier | `classify.js` reads `name` + `categories` + `taxonomyHierarchy`; on a bare domain every row returns `needs_review` via `no_name` |
| A geography extractor | `SalesTerritory` needs city/province or coordinates; nothing extracts an address from crawled HTML today (`extractPage` gives `jsonLd`, `microdata`, `contacts` — the raw material, not the extraction) |
| A known-domain exclusion set inside `fetchPage` | otherwise 92.7% of hits collide with Overture rows and land as `possibleDuplicateOfId` flags on a review screen |
| A `CRAWL_DOMAIN` task kind and handler | `crawlProspectSite` takes a `prospectId`; a candidate has none |
| Promotion rules | when does a crawled candidate become a Prospect, and who decides |

That is **five or six new pure modules plus a schema change plus a task kind
plus a review screen**, each of which needs the same measured-against-hostile-
input treatment `scripts/check-sales-discovery.mjs` gives the existing ones.
Realistically two to three weeks, and the geography extractor alone is the kind
of thing that is 80% done in a day and never finished.

## 5.4 What Common Crawl IS worth keeping in mind for

Two operations prune perfectly against the reversed-domain sort order, and both
are genuinely useful later even though neither is discovery:

1. **"Does this domain exist, and when was it last seen?"** A prefix match on
   `url_host_registered_domain` hits one row group. That is a **free liveness
   check on a prospect's website that does not touch the contractor's server** —
   worth remembering when the re-crawl interval (`MIN_RECRAWL_MS`, 30 days)
   comes up for tuning, and as a cheap pre-filter before spending a crawl task
   on a domain that may be parked or dead.
2. **"Fetch this one page."** `warc_filename` + `warc_record_offset` +
   `warc_record_length` give a byte-range fetch of a specific capture. Useful
   for a one-off audit — *what did this contractor's site look like in August?*
   — and not for volume, given the ~10 requests/second guidance in §1.5.

**Neither is a discovery provider and neither should be built speculatively.**
They are recorded so that a later agent reaching for "we need to check a
website cheaply" finds the option in a document instead of rediscovering the
corpus from scratch.

What is **not** worth doing, and is worth saying plainly so nobody re-proposes
it: a monthly 157 GB trade-token sweep to produce candidate domains. The scan
cost is the smallest part of it. The crawl budget behind it is the real price,
and Part 0 prices that at ~35 days of the entire pipeline for 100,000
candidates.

---

# Recommendation

## The straight answer on the question that was asked

**No. Common Crawl plus a classifier would add far fewer businesses per week of
engineering than importing another licence register, and it is not close.**

The brief asked for this to be said plainly rather than softened, so:

| | Keyword web discovery | One more licence register |
|---|---|---|
| Businesses it yields | unmeasured; optimistically ~20,000 from 100,000 candidates at 20% precision | **Washington L&I: 75,839 active contractors.** Quebec RBQ: 54,264 |
| Phone coverage on arrival | **0%** — a domain has no phone | **99.97%** (WA L&I); RBQ also carries 45,843 emails |
| Identity on arrival | none. No name, no address, no trade | legal name, address, official trade class from a codebook, licence status and expiry |
| Licence | Common Crawl grants nothing; rights pass through to each page's owner (§1.3) | **PDDL public-domain dedication** (WA L&I) |
| Freshness | monthly crawl, shallow per host | **three times daily** (WA L&I) |
| Engineering | 2–3 weeks: new staging table, text trade-mapper, text classifier, geography extractor, `CRAWL_DOMAIN` kind, review screen | days: one `fetchPage` against the existing provider interface |
| Pipeline cost to make it usable | ~35 days of the **entire** crawl budget per 100,000 candidates | none at ingest |
| Classifier load | **100% `needs_review`** (no name, no categories) | trade class comes from the register; today's classifier baseline is 5.6% review |

The engineering ratio alone is roughly **10:1 against**, and every other row
compounds it.

**And the deeper reason is structural, not arithmetic.** Look at what each
source can match on in `dedupe.js`:

- A **register row** has a name and a city, so it produces a `name_locality`
  fuzzy key. It can therefore both *add* businesses Overture never saw **and
  verify** ones it did. That is the government-known vs discoverable-online gap
  `STATUS.md` measures at 19.2% — the register is the denominator, and it is the
  only source shaped to close it. *(The `nameKey` accent fix committed in
  `6167a22` is what makes this work for Quebec at all: before it, `"Québec"`
  folded to `"bec qu"` and no French business matched its own duplicate.)*
- A **discovered domain** produces only a `domain` key, and can therefore only
  collide with the **92.7% of Overture rows that already carry a website**. It
  is structurally biased toward rediscovering businesses we already hold, and
  the ones it does find fresh are — by construction — businesses that invested
  in a website, which is the *opposite* of the segment `STATUS.md` says Overture
  misses (no storefront, no findable POI, often no site either).

**Keyword web discovery is lowest-yield precisely where the gap is largest.**
That is the finding, and it would not have changed if Common Crawl had been
free and instantly queryable.

## What is a terms breach and is excluded

Recommended against, and not to be reopened on effectiveness grounds:

- **SerpAPI, DataForSEO, and every other Google-SERP reseller.** They obtain
  results by automated querying of Google, which Google's spam policies name as
  prohibited "machine-generated traffic"; DataForSEO's own terms push that
  liability onto the customer in §7.1. This is already settled repo policy —
  `AUDIT-discovery-sources.md` §2.6, *"the vendor is in no position to grant
  rights it does not hold."*
- **Google Custom Search JSON API.** Closed to new customers, discontinued
  1 January 2027, and the Google APIs ToS forbids building databases from it.
- **Scraping Google or Bing result pages directly.** Not investigated as an
  option because it is not one.
- **Crawling directories and aggregators** (Yelp, Yellow Pages, HomeStars,
  Angi) — `AUDIT-compliance.md` §10 already lists this under *Not defensible*,
  and note that a search API pointed at "plumber Ottawa" returns mostly these.
- **DNS zone files via ICANN CZDS.** The use restriction forbids using the data
  to "support any marketing activities to entities other than the user's own
  existing customers" — which is the definition of a prospecting sweep (Part
  3.1, with a sourcing caveat on the exact wording).
- **Chamber of Commerce directory sweeps.** Not a clear breach, but the terms
  are each chamber's own and none were verified, and §10's *Not defensible*
  bullet covers directory crawling. Permitted only opt-in, per chamber, having
  read that chamber's terms — which removes the only reason to want it.
- **Bing Web Search API** — retired 11 August 2025. Not a choice.

## What to do instead, in order

1. **Import Washington L&I, then Quebec RBQ.** Highest yield per week of
   engineering of anything assessed in this document or its companions. This is
   the parallel research's territory and its numbers, not mine; I am confirming
   its priority from the other side.

2. **Fix the dead `hasWebsite: false` control.** Independent of everything
   else, and it is a live instance of the rule `AGENTS.md` puts first. Either
   remove the `"Has none — we looked"` filter option and the matching pill
   until something can write the value, or build (3). Today the console offers a
   filter that always returns zero rows.

3. **Build name-keyed absence search — the one part of this brief worth
   building.** Part 4 sets out the shape: one query per prospect that has no
   `websiteUrl`, at the enrich stage, writing `hasWebsite: false` only on a
   clean negative and recording the query and date as evidence. ~57,000 queries
   for the whole bank at Overture scale, about **$285 once**. It activates
   `NO_WEBSITE`, the highest-priority non-competitor opportunity rule in the
   product, which today can never fire.

   **Blocked on one thing:** it requires a search licence that permits storing
   results. Per Part 2 the only candidate is **Brave's storage-rights plan**,
   and *nobody here has read that contract* — its terms sit behind
   authentication and the standard Brave ToS §3(b)(i) forbids retention in
   terms. **Owner action: get the storage-rights plan terms in writing from
   `searchapi-support@brave.com` before any code is written.** If they do not
   permit indefinite retention of a negative result, do (2) and stop.

4. **Delete `ProspectCampaign.keywords`** if web discovery is not being built.
   Nothing writes it and nothing reads it (Part 0). Leaving it is failure
   class 1; rendering a keywords input against it would be the failure
   `AGENTS.md` names first.

5. **Do not build a Common Crawl discovery provider.** Keep §5.4's two prunable
   operations in mind for cheap website liveness checks later.

6. **If keyword-on-hostname discovery is ever revisited, build it on
   Certificate Transparency, not Common Crawl.** Fresher (hours, not a month),
   free, streaming, no 157 GB monthly pass, and no licence restriction was
   found. It does not change today's answer — a hostname is still all you get,
   and Part 0's crawl budget is still what pays to turn it into a business — but
   it is the right substrate, and recording that saves the next agent the
   Common Crawl detour.

## Suggested commit message

```
git commit -m "Keyword web discovery is the lowest-yield source, and NO_WEBSITE never fires"
```

---

# What I could not verify

- **Common Crawl ToU §9 (indemnification) and the $100 liability cap.** Reported
  by a summarising fetch, not read verbatim. §9 reportedly requires the user to
  indemnify Common Crawl against claims arising from use of Crawled Content "in
  connection with artificial intelligence, machine learning, or other similar
  technologies". **Given this pipeline's AI analysis stage, somebody must open
  that section before any Common Crawl work is authorised.**
- **Brave's storage-rights plan terms.** Behind authentication at
  `api-dashboard.search.brave.com/app/plans?tab=storage`; no account was
  created. The $5/1,000 "Data for AI" price and the storage grant come from
  Brave's public pricing copy and its AWS Marketplace listing. **A marketplace
  listing is not a licence.** This is the single blocking unknown for
  recommendation (3).
- **Anonymous S3 access to `s3://commoncrawl`.** Published documentation
  describes it as openly accessible; the measurement on 2026-09-03 found it
  requires credentials and that HTTPS via `data.commoncrawl.org` is the working
  path. The discrepancy is unexplained — possibly a client configuration
  difference. It does not change any conclusion, but it means the S3-based
  tutorials in Common Crawl's docs should not be trusted to work as written.
- **Whether the columnar index carries no page text.** Established by an
  exhaustive read of the published `CREATE EXTERNAL TABLE` schema, not by a
  positive statement from Common Crawl. Strong, but an inference.
- **That WET files cannot be filtered by domain.** Established by the absence of
  a WET subset in the index partitioning plus an unanswered issue open on
  Common Crawl's own tracker since 2016. Also an inference.
- **Google's exact current wording prohibiting automated queries.** The
  frequently-quoted older sentence could not be confirmed on a live Google page;
  the current spam policies and `policies.google.com/terms` prohibit it in
  different words. The prohibition is not in doubt; the citation is imprecise.
- **What fraction of contractor domains contain a trade token.** The recall
  ceiling of the whole keyword-on-hostname approach, and unmeasured. Measuring
  it means the 157 GB pass, which this brief excluded — and which the
  recommendation says is not worth running.
- **Overture's true enumeration depth.** Still the open question `STATUS.md`
  names. Nothing in this document closes it; the registers in the parallel
  research are the source that can.
- **Exa's §5.2(a) versus its marketing.** The terms forbid copying results; the
  positioning implies otherwise. Worth one email if Brave falls through, but not
  recommended on the face of the contract.
- **The CZDS Terms and Conditions verbatim.** The live page is a JavaScript
  application that could not be fetched; the clause in Part 3.1 was
  reconstructed from the .com Registry Agreement Appendix 3A PDF, whose text
  uses a subset font encoding. **Near-verbatim, not verbatim.** The substance
  matches standard Specification 4 language, and the exclusion does not turn on
  fine wording — but read the live T&C in a browser before relying on it.
- **Whether CIRA publishes a .ca zone file.** No public programme was found.
  **This is an unverified negative** — one email to CIRA settles it, and it
  matters because .ca is the TLD a Canadian territory cares about most.
- **Certificate volume in CT logs.** ~10 M certificates/day by late 2025 is
  secondary reporting; Let's Encrypt's own stats page renders its figures in
  JavaScript with no text. Unique hostnames per day is materially lower and was
  not established.
- **Whether crt.sh has an acceptable-use policy.** None was found — on the
  homepage or in the announcement thread. Absence of a located policy is not
  permission for bulk pulls.
- **GrowthZone / ChamberMaster scraping terms**, and typical chamber membership
  size. Neither verified. The binding terms are each chamber's own in any case,
  which is the point Part 3.4 turns on.
- **PHCC, ACCA and NARI member counts.** Not published where I could find them.
  Note that PCA's "more than 300,000 contractors" is an industry-representation
  claim and **not** a membership figure.

---

# Sources

All read 2026-09-03 unless noted.

**Common Crawl**
- [commoncrawl.org/terms-of-use](https://commoncrawl.org/terms-of-use) — ToU, last updated 7 March 2024
- [commoncrawl.org/columnar-index](https://commoncrawl.org/columnar-index) — index schema, partitioning, scan costs
- [commoncrawl.org/cdxj-index](https://commoncrawl.org/cdxj-index) — byte-range fetch documentation
- [commoncrawl.org/blog/august-2026-crawl-archive-now-available](https://commoncrawl.org/blog/august-2026-crawl-archive-now-available) — CC-MAIN-2026-34 statistics
- [commoncrawl.org/blog/oct-nov-2023-performance-issues](https://commoncrawl.org/blog/oct-nov-2023-performance-issues) — rate-limit guidance
- [commoncrawl.org/ccbot](https://commoncrawl.org/ccbot) and the [opt-out registry](https://commoncrawl.org/blog/common-crawl-foundation-opt-out-registry)
- [registry.opendata.aws/commoncrawl](https://registry.opendata.aws/commoncrawl/)
- [github.com/commoncrawl/cc-index-table](https://github.com/commoncrawl/cc-index-table) — `CCIndexWarcExport`
- [github.com/commoncrawl/cc-downloader](https://github.com/commoncrawl/cc-downloader)
- [commoncrawl#11](https://github.com/commoncrawl/commoncrawl/issues/11) — WET filtering, open since 2016
- Direct measurement of `collinfo.json`, `cc-index-table.paths.gz`, and DuckDB over `data.commoncrawl.org` (owner, 2026-09-03)

**Search APIs**
- [learn.microsoft.com/lifecycle/announcements/bing-search-api-retirement](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement)
- [brave.com/search/api](https://brave.com/search/api/) — pricing and the storage-rights statement
- [api-dashboard.search.brave.com/documentation/resources/terms-of-service](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service) — §3(b)
- [aws.amazon.com/marketplace/pp/prodview-qjlabherxghtq](https://aws.amazon.com/marketplace/pp/prodview-qjlabherxghtq) — "Data for AI" listing
- [serpapi.com/pricing](https://serpapi.com/pricing) and its legal page
- [dataforseo.com/pricing/google-serp/google-organic-serp-api](https://dataforseo.com/pricing/google-serp/google-organic-serp-api)
- [developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies) and [policies.google.com/terms](https://policies.google.com/terms)
- [developers.google.com/custom-search/v1/overview](https://developers.google.com/custom-search/v1/overview)
- [exa.ai/pricing](https://exa.ai/pricing) and Exa Terms of Service §5.2(a)

**Non-crawl domain sources**
- [czds.icann.org](https://czds.icann.org/) and the [.com Registry Agreement Appendix 3A](https://itp.cdn.icann.org/en/files/registry-agreements/com/com-appx-03a-pdf-27mar20-en.pdf)
- [crt.sh public Postgres announcement](https://groups.google.com/g/crtsh/c/sUmV0mBz8bQ); [RFC 6962 §4.6](https://www.rfc-editor.org/rfc/rfc6962.html)
- [nrca.net/about](https://www.nrca.net/about), [phccweb.org Find a Contractor](https://www.phccweb.org/tools-resources/find-a-contractor/), [landscapeontario.com](https://landscapeontario.com/)
- [business.sachamber.org/memberdirectory](https://business.sachamber.org/memberdirectory) — a representative GrowthZone-hosted chamber directory

**This repo**
- `lib/sales/discovery/{provider,ingest,normalise,classify,dedupe,trades,funnel}.js`
- `lib/sales/discovery/overture/provider.js`, `scripts/overture-snapshot.mjs`
- `lib/sales/crawl/{crawlSite,policy,robots,hostPolicy,url,html,evidence}.js`
- `lib/sales/pipeline/{limits}.js`, `lib/sales/pipeline/handlers/{discoverBusinesses,enrichBusiness}.js`
- `lib/sales/intel/{rules,capabilityDetect}.js`
- `app/platform/sales/prospects/page.js`, `app/api/platform/sales/prospects/route.js`
- `prisma/schema.prisma` — `Prospect`, `ProspectCampaign`, `ProspectEvidence`, `SalesTerritory`
- `vercel.json`, `app/api/cron/sales-pipeline/route.js`
- `docs/sales-intel/{STATUS,AUDIT-compliance,AUDIT-discovery-sources,MEASURE-overture-coverage,CRAWLING}.md`
