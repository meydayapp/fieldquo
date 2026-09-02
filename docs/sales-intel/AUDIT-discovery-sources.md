# Phase 2 audit — where the prospect list actually comes from

Read-only audit. No product code was changed by the session that wrote this.

**All sources read 2026-09-01.** Every URL below was fetched on that date. Licences
and prices change; nothing here is answered from memory. Where I could not verify
something I have said so under *What I could not determine* rather than guessing.

Companion to `AUDIT-compliance.md`, which ruled out Google Places on terms. This
document does not re-litigate that. It answers the question that follows from it:
**what replaces it.**

I am an engineer reading licence texts and vendor pricing pages, not a lawyer.
Where the answer turns on legal judgement rather than on published wording, I say
so.

---

## The one sentence

**The Overture rejection is based on a misunderstanding.** The membership tiers the
owner priced ($3,000,000 / $300,000 / $3,000 / $0) buy a seat in the *governance* of
the foundation — steering committee votes, working-group influence. They do not buy
the data and are not required to use it. The places data is a set of public
Parquet files in an unauthenticated S3 bucket, licensed CDLA-Permissive-2.0 (plus
Apache-2.0 and CC0 for some sources), with **no share-alike and no obligation of any
kind unless you redistribute the data itself.** I listed the bucket anonymously
during this audit, with no AWS account and no credentials:

```
$ aws s3 ls --no-sign-request s3://overturemaps-us-west-2/release/
                           PRE 2026-07-22.0/
                           PRE 2026-08-19.0/
```

The places theme of the current release is **16 Parquet files, 9.76 GiB**, and costs
**$0** to download. Cost for 1,000 businesses and cost for 50,000 businesses are the
same number, because it is a file, not a query.

Everything below is the evidence for that, and the comparison against the
alternatives.

---

## The finding that outranks the licence question

The coordinator asked whether Google is *structurally* capable of enumerating a
city's contractors, separately from whether the terms allow it. It is not, and this
matters more than the licence, because it means the Google approach was never going
to work even in a world where the ToS said nothing.

### The per-query ceiling, on the current API

I read the **Places API (New)** documentation, not the legacy Places API.

**Text Search (New)** —
[developers.google.com/maps/documentation/places/web-service/text-search](https://developers.google.com/maps/documentation/places/web-service/text-search),
read 2026-09-01:

> "the API will return no more than 20 results per page"

> "Text Search (New) returns a maximum of 60 results across all pages, although this
> limit is subject to change."

**Nearby Search (New)** —
[developers.google.com/maps/documentation/places/web-service/nearby-search](https://developers.google.com/maps/documentation/places/web-service/nearby-search),
read 2026-09-01. `maxResultCount`:

> "Must be between 1 and 20 (default) inclusive."

and there is **no `nextPageToken` and no pagination at all** in the New Nearby
Search. It is worse than the coordinator's estimate: Nearby Search caps at **20 per
query, full stop**; Text Search caps at **60 across three pages**.

There is no parameter, no tier, and no price that lifts this. "Return every painter
in Ottawa" is not an available call.

### Is there any Google product that returns bulk listings for an area?

The closest thing is the **Places Aggregate API** (renamed from Places Insights
effective 24 March) —
[developers.google.com/maps/documentation/places-aggregate/overview](https://developers.google.com/maps/documentation/places-aggregate/overview)
and
[developers.google.com/maps/documentation/placesinsights/about-data](https://developers.google.com/maps/documentation/placesinsights/about-data),
both read 2026-09-01. It has two modes, `INSIGHTS_COUNT` and `INSIGHTS_PLACES`, and:

> "Place IDs are returned only if the count is 100 or lower. Specifying
> INSIGHTS_PLACES restricts the search to areas small enough to return up to 100
> place IDs."

So the one Google product designed to answer "what is in this area" caps at **100
place IDs**, and returns *only* IDs. To turn an ID into a name, address and phone you
must call Place Details — and then you are back inside §3.2.3(a)(iii), which is the
clause that forbids saving the name and address. Google will sell you the count of
painters in Ottawa. It will not sell you the painters.

### What full coverage of one city and trade would actually cost

Ottawa is roughly 2,790 km². With Nearby Search capped at 20 results and no
pagination, enumerating a dense trade means grid-searching at a cell size small
enough that no cell holds more than 20 matches, then deduplicating.

Google's current published rate for Text Search and Nearby Search is **$32.00 per
1,000 requests** up to 100,000 requests/month, with 10,000 free on the Essentials
tier
([developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
read 2026-09-01). A 1 km grid over Ottawa is ~2,790 requests per trade — about **$89
per trade per city**, before the second and third pages and before any radius or
keyword variation. Five trades across fifty North American cities is on the order of
**$22,000** in requests, produces a knowingly incomplete list, and is precisely the
systematic extraction the terms describe.

**The technical ceiling and the legal ceiling point the same way.** This is the
cleanest possible outcome for the decision: there is no version of the Google path
worth arguing about.

The alternatives are assessed against this bar too, because the coordinator is right
that a legally clean source with a 60-result ceiling solves nothing. Bulk file
downloads — Overture, Foursquare, OSM extracts, purchased lists — have **no query
ceiling at all**; you receive the whole set and filter locally. That distinction is
the single most important difference between the options.

---

# Part 1 — Overture Maps, properly verified

## 1.1 Membership is governance, not access

The membership page
([overturemaps.org/become-a-member](https://overturemaps.org/become-a-member/), read
2026-09-01) describes what membership buys in terms of *influence* — "prioritization
and decision-making around data investments, technical innovation, and timing" — and
notes that "participation in working groups is open". **Data access is not listed as
a member benefit anywhere on that page.** Membership additionally requires Linux
Foundation Silver membership ($5,000/yr for 1–99 employees, scaling to $20,000 for
5,000+).

The FAQ ([overturemaps.org/about/faq](https://overturemaps.org/about/faq/), read
2026-09-01) states the project's output plainly:

> "all resulting data products will be licensed under open licenses and made
> publicly available"

The FAQ mentions no cost for data access at all.

**I verified this empirically rather than trusting the marketing copy.** Anonymous,
unauthenticated HTTP against the bucket succeeded:

```
$ curl -s "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&delimiter=/&prefix=release/"
release/2026-07-22.0/
release/2026-08-19.0/
```

The AWS Registry of Open Data entry
([registry.opendata.aws/overture](https://registry.opendata.aws/overture/), read
2026-09-01) gives the bucket as `arn:aws:s3:::overturemaps-us-west-2/release/`, region
us-west-2, cost **"Free (no AWS account required)"**, with the documented access
command:

> `aws s3 ls --no-sign-request s3://overturemaps-us-west-2/release/`

`--no-sign-request` is the operative detail. It means no credentials, no account, no
membership, no bill.

## 1.2 The exact licence of the *places* theme

This is where the themes genuinely differ, and it is the part most worth getting
right. From
[docs.overturemaps.org/attribution](https://docs.overturemaps.org/attribution/), read
2026-09-01:

| Source of the row | Licence |
|---|---|
| Meta, Microsoft, PinMeTo, Krick, RenderSEO, DAC, BrightQuery | **CDLA-Permissive-2.0** |
| Foursquare | **Apache-2.0** — "Copyright 2024 Foursquare Labs, Inc. All rights reserved. Available under Apache 2.0." |
| AllThePlaces | **CC0 1.0** |

**ODbL applies to Base, Buildings, Division and Transportation — not to Places.**
The places theme contains no OpenStreetMap data, which is exactly why it escapes
ODbL. The places guide
([docs.overturemaps.org/guides/places](https://docs.overturemaps.org/guides/places/),
read 2026-09-01) states the dataset "explicitly excludes OpenStreetMap data".

The one ODbL trap to be aware of: if you *join* Overture places against an OSM-derived
dataset, the result may become an ODbL derivative database. **Do not join this data
against OSM.** As long as places is used alone, no ODbL obligation exists.

## 1.3 What CDLA-Permissive-2.0 actually obliges

From the licence text at [cdla.dev/permissive-2-0](https://cdla.dev/permissive-2-0/),
read 2026-09-01. Grant:

> "A Data Recipient may use, modify, and share the Data made available by Data
> Provider(s) under this agreement if that Data Recipient follows the terms of this
> agreement."

The *only* obligation, and it attaches to sharing:

> "A Data Recipient may share Data, with or without modifications, so long as the
> Data Recipient makes available the text of this agreement with the shared Data."

And the clause that settles the AI question, which is the mirror image of Google's
§3.2.3(c)(vii):

> "'Results' means any outcome obtained by computational analysis of Data, including
> for example machine learning models and models' insights."

> "This agreement does not impose any restriction or obligations with respect to the
> use, modification, or sharing of Results."

Point by point against the brief:

- **Commercial use** — permitted. The grant is unconditional as to purpose; there is
  no non-commercial clause.
- **Redistribution** — permitted, on the single condition that you ship the licence
  text alongside.
- **Derived databases** — permitted. There is **no share-alike**. Nothing requires
  publishing a derived database, ever. This was the owner's stated deal-breaker and
  it simply is not present in this licence.
- **Attribution** — the obligation triggers on *sharing*, not on holding. A private
  prospect database that never leaves FieldQuo carries **no attribution obligation
  under CDLA at all**. The Apache-2.0 rows (Foursquare-sourced) require carrying the
  NOTICE file on redistribution; likewise not triggered by internal use. Keeping the
  licence texts and NOTICE alongside the ingested data in the repo is cheap
  insurance and I would do it anyway.
- **AI analysis** — explicitly out of scope of the agreement. Running the prospect
  rows through OpenAI produces "Results", and the licence disclaims any restriction
  on them. This is the exact activity Google's terms forbid.

**Verdict: PERMITTED.** Deciding clause: CDLA-Permissive-2.0 §"Results" — *"This
agreement does not impose any restriction or obligations with respect to the use,
modification, or sharing of Results."*

## 1.4 How the data is obtained, and what it really costs

Format is GeoParquet on S3, mirrored to Azure and Source Cooperative, with a STAC
catalogue at `https://stac.overturemaps.org/catalog.json`
([docs.overturemaps.org/getting-data](https://docs.overturemaps.org/getting-data/),
read 2026-09-01). Current release path:

```
s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*
```

I measured the release directly rather than repeating a documented figure:

| Measured, 2026-09-01 | Value |
|---|---|
| Files in `theme=places/type=place/` | 16 |
| Total size | 10,480,684,059 bytes = **9.76 GiB** |
| Largest part | 673 MiB |
| Auth required | **none** (`--no-sign-request`) |

Real cost to acquire and process:

- **Download: $0.** Egress is sponsored under the AWS Open Data programme; the
  registry entry states "Free (no AWS account required)". There is no
  requester-pays flag on this bucket.
- **Compute:** 9.76 GiB of zstd Parquet is a laptop-scale job with DuckDB or PyArrow.
  Predicate pushdown on `country` and the category column means you never
  materialise the whole thing. If run on an EC2 instance in us-west-2 it is
  intra-region and free; a few hours of a small instance is single-digit dollars.
  Realistically this is **an afternoon of engineering and effectively no data cost**.
- **Refresh:** monthly releases. Re-running the extract is the same job again.
- **Cost for 1,000 businesses: $0. Cost for 50,000 businesses: $0.** There is no
  per-record price and no query ceiling. This is the structural difference from every
  API-based option.

## 1.5 Does it actually carry what a sales pipeline needs?

The places schema
([docs.overturemaps.org/guides/places](https://docs.overturemaps.org/guides/places/),
read 2026-09-01) includes `names`, `addresses` (freeform, locality, postcode, region,
country), **`phones`**, **`websites`**, `emails`, `socials`, `brand`, `sources`, a
`taxonomy` category system, a simplified `basic_category` set of ~280 labels, and a
`confidence` score (0–1) for existence likelihood. Roughly **74 million POIs** as of
August 2026, Meta contributing ~58 million.

**No rating or review count.** That is the one item from the brief's wish-list that
Overture does not carry, and it was listed as "ideally" rather than required.

I checked the category taxonomy for trade coverage specifically, by downloading
`overture_categories.csv` from the schema repo (2,118 categories) and grepping. The
trades FieldQuo sells to are first-class categories under a `home_service` branch:

```
painting;                          [home_service,painting]
plumbing;                          [home_service,plumbing]
hvac_services;                     [home_service,hvac_services]
roofing;                           [home_service,ceiling_and_roofing_repair_and_service,roofing]
landscaping;                       [home_service,landscaping]
flooring_contractors;              [home_service,contractor,flooring_contractors]
cabinet_sales_service;             [home_service,cabinet_sales_service]
carpenter;                         [home_service,carpenter]
electrician;                       [home_service,electrician]
lawn_service;                      [home_service,landscaping,lawn_service]
tree_services;                     [home_service,landscaping,tree_services]
```

That is a near-exact match for FieldQuo's target market — painters, cabinet makers,
flooring installers, plumbers, landscapers — down to `cabinet_sales_service`. The
taxonomy was clearly built with home-service businesses in mind, and the filter for a
prospecting query is a category list plus a `country`/`region` predicate, which is a
single SQL `WHERE`.

---

# Part 2 — The alternatives

## 2.1 Foursquare Open Source Places

**Licence: Apache-2.0.** "Copyright 2024 Foursquare Labs, Inc. All rights reserved."
Commercial use, redistribution and modification permitted; the obligation is to
retain the licence notice and NOTICE file on redistribution. There is no share-alike
and no restriction on AI use.
([docs.foursquare.com/data-products/docs/fsq-places-open-source](https://docs.foursquare.com/data-products/docs/fsq-places-open-source),
read 2026-09-01.)

**Availability has changed, and the brief's assumption is now out of date.** As of
October 2025 FSQ OS Places moved off the public S3 bucket to a portal:

> "Create an account on the Places Portal" … "Generate an access token to connect
> programmatically or via your preferred data tool" … "an Iceberg-based data catalog
> instead of the legacy public S3 bucket"

([docs.foursquare.com/data-products/docs/access-fsq-os-places](https://docs.foursquare.com/data-products/docs/access-fsq-os-places),
read 2026-09-01.) The data is still free and still Apache-2.0; you now need a
registered account and a token. Vector tiles remain on a plain S3 path
(`s3://fsq-os-places-us-east-1/release/vector-tiles/latest/fsq-os-places.pmtiles`) but
tiles are not a usable prospect source.

**Schema** — 26 columns, verified at
[docs.foursquare.com/data-products/docs/places-os-data-schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema),
read 2026-09-01: `fsq_place_id`, `name`, `latitude`, `longitude`, `address`,
`locality`, `region`, `postcode`, `admin_region`, `post_town`, `po_box`, `country`,
`date_created`, `date_refreshed`, `date_closed`, **`tel`**, **`website`**, `email`,
`facebook_id`, `instagram`, `twitter`, `fsq_category_ids`, `fsq_category_labels`,
`placemaker_url`, `unresolved_flags`, `geom`, `bbox`. 100M+ places, 1,000+ categories.
**No rating and no popularity** — those are Pro/Premium only.

`date_closed` is genuinely useful here: it lets you drop businesses that have shut,
which a stale purchased list will not tell you.

**Cost:** $0 for both 1,000 and 50,000. No query ceiling — bulk catalogue.

**Verdict: PERMITTED.** Deciding clause: Apache-2.0 §2 grant of a "perpetual,
worldwide, non-exclusive, no-charge, royalty-free" licence to reproduce and prepare
derivative works, with no field-of-use restriction.

Note the overlap: **Foursquare data is already inside Overture places** as one of its
sources. Taking Overture gets you the Foursquare rows plus Meta's 58M, without a
second account. Going direct to Foursquare is only worth it if you want the `tel`
and `date_closed` fields at Foursquare's own refresh cadence rather than Overture's
monthly release.

## 2.2 OpenStreetMap

Free, ODbL 1.0. The share-alike question is the crux, and the answer is more
favourable than feared — but the data is the problem, not the licence.

**On share-alike.** From the ODbL 1.0 text
([opendatacommons.org/licenses/odbl/1-0](https://www.opendatacommons.org/licenses/odbl/1.0/),
read 2026-09-01), share-alike triggers on *public* use:

> §4.4(a): "Any Derivative Database that You Publicly Use must be only under the
> terms of: This License; A later version of this License similar in spirit to this
> License; or A compatible license."

and "Publicly" is defined as:

> "Persons other than You or under Your control by either more than 50% ownership or
> by the power to direct their activities (such as contracting with an independent
> consultant)."

§4.5(c) covers internal use, and §4.6 (Access to Derivative Databases) only bites
when you publicly use one. **A private prospect database that FieldQuo holds
internally and never distributes is not "Publicly Used", so ODbL §4.4 share-alike
does not require publishing it.** The owner's fear — that ODbL would force FieldQuo to
open its prospect database — is not borne out for a purely internal database.

Two live caveats, and they are not trivial:
- If any OSM-derived field surfaces on a **client-facing** page, that is arguably
  public use of a Produced Work and attribution under §4.3 applies ("Contains
  information from DATABASE NAME, which is made available here under the Open Database
  License (ODbL)").
- The boundary between "internal prospect database" and "public use" is a legal
  judgement, not a settled reading, and it would need answering again if the data ever
  fed something customer-visible. This is the sort of ongoing question that a
  permissive licence makes disappear entirely.

**The real disqualifier is coverage.** I queried OSM taginfo directly (read
2026-09-01) for **worldwide** counts:

| Tag | Objects, entire planet |
|---|---|
| `craft=carpenter` | 20,853 |
| `craft=electrician` | 14,677 |
| `craft=hvac` | 12,493 |
| `craft=plumber` | 12,092 |
| `craft=gardener` | 7,477 |
| `craft=painter` | **6,400** |
| `craft=roofer` | 5,988 |
| all `craft=*` | 383,886 |

Six thousand four hundred painters **on Earth**. Overture holds 74 million POIs;
`craft=*` in its entirety is 384k objects globally, and the tag is well known to be
heavily Europe-weighted. OSM does not know where the painters in Ottawa are, because
almost nobody has mapped a painting contractor's office anywhere. Phone and website
tags on those objects are optional and sparsely filled.

**Verdict: RESTRICTED (usable but not worth it).** Deciding clause: ODbL §4.4(a) makes
share-alike contingent on public use, so a private database is compliant — but the
dataset is empirically far too thin for this purpose.

## 2.3 Commercial list vendors

This is the "no ToS acrobatics" option and it deserves to be taken seriously.

**Data Axle / Salesgenie** — self-serve subscriptions from **$99/month** rising to
$299/month on a 12-month contract, and published bulk per-record pricing of **$0.13
at 2,500 records, $0.11 at 5,000, $0.10 at 10,000, $0.075 at 50,000, $0.065 at
100,000**. Data Axle claims specific strength in exactly the segment that matters —
"U.S. SMBs, freelancers, contractors, and home-based businesses". Filterable by SIC
and NAICS.
([g2.com/products/salesgenie-by-data-axle/pricing](https://www.g2.com/products/salesgenie-by-data-axle/pricing),
[bookyourdata.com/blog/data-axle-pricing](https://www.bookyourdata.com/blog/data-axle-pricing),
read 2026-09-01.)

- ~1,000 businesses: a month or two of the entry subscription, roughly **$99–$200**.
- ~50,000 businesses: **~$3,750** at the published $0.075 tier.

**LeadsPlease** — business lists start at **$124.95 for 500 records**; per-record
runs from **$0.60 at the smallest tier down to $0.24 at 50,000**. Filters include SIC
and NAICS, employee count, revenue, years in business. Construction specialty
contractors are SIC 17. Claims 90%+ postal accuracy, 80%+ email accuracy, ~70% of
business records carrying an email.
([leadsplease.com/buying-guides/email-list-pricing-explained](https://www.leadsplease.com/buying-guides/email-list-pricing-explained),
[leadsplease.com/mailing-lists/business/sic](https://www.leadsplease.com/mailing-lists/business/sic),
read 2026-09-01.)

- ~1,000 businesses: on the order of **$250–$350**.
- ~50,000 businesses: **~$12,000** at $0.24.

**Apollo.io** — $0/$49/$79/$119 per user per month on annual billing ($65/$99/$149
monthly), with 1,000 / 4,000 / 6,000 credits per month; credits are consumed by
search, phone reveal *and* export.
([saleshandy.com/blog/apolloio-pricing](https://www.saleshandy.com/blog/apolloio-pricing/),
read 2026-09-01.) **UpLead** — $99/month for 170 credits, $0.60/credit for top-ups
([hackingdemand.com/blog/uplead-pricing-2026](https://hackingdemand.com/blog/uplead-pricing-2026),
read 2026-09-01).

I would not pick either for this. Both are B2B *contact* databases built around
named decision-makers at companies with org charts. A three-person painting outfit
run from a van has no org chart, and UpLead's 170 credits/month is arithmetically
incapable of 50,000 records at any sane price.

**Verdict: PERMITTED**, and the cleanest legally. Deciding factor: a purchased list
comes with a licence to use it, which is the whole point of buying it. The two
things to check before signing, which I could not verify from public pages, are
(a) whether the licence is single-use/limited-term or perpetual multi-use, and
(b) whether it permits AI processing — vendors increasingly add clauses on this.
**Ask both questions in writing before purchase.**

Caveat on quality: compiled lists are exactly as stale as their last compile, and
carry no `date_closed` equivalent. Data Axle's contractor claim is a marketing
claim I could not independently test.

## 2.4 Business registries

Authoritative on legal existence, close to useless for sales contact.

**Canada — Statistics Canada Open Database of Businesses (ODBus).** Open Government
Licence – Canada. Fields, quoted from
[www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm](https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm),
read 2026-09-01:

> "Name, Business Sector, Business ID number, Licence Number, Licence Type, NAICS
> (North American Industry Classification System) Code, Number of Employees, Status,
> Address, Municipality Name, Province, Postal Code, Census Subdivision Name,
> Longitude, Latitude"

**No phone. No website. No email.** ~450,000 records, and the underlying datasets
were "collected from May 2022 to December 2022" — nearly four years stale. StatCan
states outright: "The ODBus does not contain all businesses within Canada".

**Canada — Corporations Canada.** ISED publishes the federal register as a free bulk
download on open.canada.ca and offers an API for status, registered office address
and directors
([ised-isde.canada.ca/site/corporations-canada/en/data-services](https://ised-isde.canada.ca/site/corporations-canada/en/data-services),
read 2026-09-01). Federal incorporations only; most small trades are provincially
incorporated or sole proprietors, spread across 13 separate provincial and
territorial registries. Registered office address is frequently the accountant's
office, not the business.

**US — Secretary of State registries.** Fifty separate systems. Basic search is free
everywhere; bulk downloads generally cost money (North Carolina's Data Subscription
Service is typical). NAICS is **not** universally captured. Content is legal
formation records, standing, registered agent, and in some states officers.
([llcuniversity.com/50-secretary-of-state-sos-business-entity-search](https://www.llcuniversity.com/50-secretary-of-state-sos-business-entity-search/),
read 2026-09-01.)

**Verdict: PERMITTED but not fit for purpose.** Deciding factor: no phone, no
website, no reliable trade category, no way to distinguish an active painting
business from a dormant numbered company. Genuinely valuable as a *verification*
layer later — confirming a prospect is a real registered entity — never as the
discovery source.

## 2.5 Yellow Pages, Yelp and industry directories

**Yelp — PROHIBITED.** Three separate clauses each independently kill it. From the
Yelp API Terms of Use
([terms.yelp.com/developers/api_terms/20250113_en_us](https://terms.yelp.com/developers/api_terms/20250113_en_us/),
read 2026-09-01):

> §5(a): "cache, record, pre-fetch, or otherwise store any portion of the Yelp
> Content for a period longer than twenty-four (24) hours from receipt"

> §5(b): "modify the Yelp Content, or use it to update or create your own database of
> business listing information, unless such modification is for non-commercial
> analysis"

> §9: "Use, copy, process, modify, reverse engineer, or create derivative works based
> on the Yelp Content for the purpose of training, developing, enhancing, or
> fine-tuning any Generative AI Models without Yelp's prior written approval"

§9.4 goes further and forbids submitting Yelp Content "into any Generative AI Model
(e.g., prompts that contain any Yelp Content into ChatGPT or other such models)".
Only Yelp business IDs may be stored, "solely for back-end matching purposes". This
is structurally identical to the Google position and fails for the same reasons — and
§9.4 additionally forbids the AI-analysis step of the pipeline outright, which Google
at least only restricts to model *training*.

**Yellow Pages — PROHIBITED.** yellowpages.com's Terms of Service and Use forbid
using "bots, scrapers, crawlers, spiders, or any similar methods to 'data mine' or
otherwise gather or extract data" from the sites, and separately forbid using the
sites "to compile information for competitive listing products or services". I was
served HTTP 403 when fetching the terms page directly on 2026-09-01, so I am relying
on secondary reporting of the clause wording rather than a first-hand read — see
*What I could not determine*. The prohibition itself is not in doubt; the exact
section numbering is.

**Verdict for the category: PROHIBITED.** Deciding clause for Yelp: API Terms §5(b),
which names creating your own business-listing database as the forbidden act.

## 2.6 Others worth naming

**AllThePlaces** ([alltheplaces.xyz](https://www.alltheplaces.xyz/)) — CC0 1.0, i.e.
public domain, no obligations whatsoever. It scrapes chain and franchise store
locators, so it is excellent for brands and largely irrelevant for independent
single-van contractors. Already included as a source inside Overture places.

**Google-derived scraper APIs** (Outscraper, Apify, SerpApi, ScrapingBee et al.) —
these resell Google Maps content. Buying it through a middleman does not change
whose content it is; the §3.2.3 prohibitions in `AUDIT-compliance.md` attach to the
content, and the vendor is in no position to grant rights it does not hold.
**PROHIBITED, for the same reasons and with the added risk of relying on someone
else's ToS breach.**

**The contractors' own websites.** Once a business is discovered from a permissive
source, crawling that business's own public website for services offered, service
area and quality signals is a separate activity from listing discovery, and the
Overture/Foursquare licences say nothing against it. This is where the AI analysis
should get its depth — the licensed dataset gives you the *who*, the crawl gives you
the *what*. `AUDIT-compliance.md` covers the crawling side.

---

# Recommendation

## Ranked by legal safety

1. **Purchased list (Data Axle)** — you hold a contract that says you may use it.
2. **Overture places** — CDLA-Permissive/Apache/CC0, no share-alike, "Results"
   explicitly unrestricted.
3. **Foursquare OS Places** — Apache-2.0, equally clean; one account required.
4. **AllThePlaces** — CC0, no obligations at all, but wrong shape of data.
5. **Registries** — open licences, no restriction, no useful content.
6. **OSM** — compliant for internal use, but leaves a live judgement call if
   anything ever surfaces publicly.
7. **Google / Yelp / Yellow Pages / Google-derived scrapers** — prohibited.

## Ranked by cost

1. **Overture — $0**, at 1,000 records and at 50,000 alike.
2. **Foursquare — $0**, plus an account.
3. **OSM / registries — $0**, and worth what you pay.
4. **Data Axle — ~$99–200** for 1,000, **~$3,750** for 50,000.
5. **LeadsPlease — ~$250–350** for 1,000, **~$12,000** for 50,000.
6. **Google — ~$22,000** for a partial, prohibited crawl of five trades across fifty
   cities.

## Ranked by data completeness for trade businesses

1. **Data Axle** — purpose-built for SMB contractors, SIC/NAICS filtering, phone
   included, human-verified. Best raw fit, if the marketing claim holds.
2. **Overture** — phone, website, email, socials, address, confidence score, and a
   `home_service` taxonomy that names `painting`, `plumbing`, `hvac_services`,
   `roofing`, `landscaping`, `flooring_contractors`, `cabinet_sales_service`
   individually. No rating/review count.
3. **Foursquare** — near-identical fields plus `date_closed`, minus rating.
4. **Registries** — name and address only.
5. **OSM** — 6,400 painters worldwide.

## If I had to start Monday

**Overture places.**

The reason is not that it is free, though it is. It is that **it is the only option
with no ceiling and no counterparty.** You download a 9.76 GiB file with no account,
filter it in SQL, and you have every home-service business in the Overture corpus
for every city in Canada and the US in one pass — 1,000 or 50,000 or all of them, at
the same cost and on the same afternoon. There is no 20-result cap, no 60-result cap,
no 100-place-ID cap, no per-record meter, no monthly credit budget, no vendor who can
change terms, and no clause anywhere requiring FieldQuo to publish its prospect
database. The licence explicitly says the AI analysis step is unrestricted. The
category taxonomy reads like it was written for FieldQuo's customer list.

The owner's overnight-background-job constraint makes this even more clearly correct:
the whole objection to a bulk file — that it is a big lump of work up front — is
irrelevant when throughput is not a constraint. Volume is a number in the admin UI
and the job runs while everyone sleeps. A bulk file is the *ideal* shape for that.

**I would spend the money anyway, on a small Data Axle list, but for a different
job.** Buy ~1,000 records for two or three target cities, ~$99–200, and use it as a
*benchmark* — measure what fraction of Data Axle's painters appear in Overture, and
how often Overture's phone number matches. That answers the one question this audit
could not answer from documents (see below) for the price of a couple of hours of
engineering time, and it tells you whether to keep buying lists or stop. If Overture
turns out to cover 80% of a paid list, the paid list never needs buying again. If it
covers 30%, you have learned that cheaply and you buy lists instead.

What I would not do is build anything on Google. It is prohibited *and* it cannot do
the job. Those two facts are independent, and either alone is sufficient.

---

# What I could not determine

- **Actual fill rates for `phones` and `websites` in Overture places, for North
  American trade categories.** This is the single most important open question and I
  could not answer it honestly from documentation. Answering it properly means
  downloading the 9.76 GiB release and counting; this machine has neither DuckDB nor
  PyArrow installed, and installing packages and pulling ~10 GiB was outside the
  read-only remit of this audit. Overture's own docs acknowledge the issue in general
  terms — records missing phone and website "are harder to deduplicate and more likely
  to persist as duplicates" — without publishing a rate. **Recommended first
  implementation step: pull one release, count non-null `phones` and `websites` for
  `home_service` categories in Ontario and a US state, and put the numbers in
  `docs/ROADMAP.md`.** Until that is measured, "Overture carries phone and website"
  means the columns exist, not that they are populated.
- **Overture record counts for Canada and the US specifically**, and for the
  `home_service` branch specifically. I verified the taxonomy contains the categories
  and that the global corpus is ~74M; I did not verify how many Canadian plumbers are
  in it. Same measurement, same first step.
- **The exact section numbering of the yellowpages.com Terms of Service.** The terms
  page returned HTTP 403 to my fetch on 2026-09-01; the prohibition wording is
  consistently reported across sources but I did not read it first-hand.
- **Whether Data Axle's and LeadsPlease's list licences permit AI processing and
  perpetual re-use**, versus single-campaign use. Not published on their pricing
  pages. Must be asked in writing before purchase — this is the clause that would
  make a purchased list useless for this pipeline.
- **Whether Data Axle's claimed contractor coverage is real.** Vendor marketing;
  untested. The benchmark purchase above is how to find out.
- **Whether Foursquare's Places Portal imposes rate limits or per-account quotas.**
  None are documented on the access page; absence of documentation is not absence of
  limits.
- **Current Overture membership tier prices.** The become-a-member page rendered its
  tier tables as encoded markup my fetch could not read, so I could not confirm the
  $3,000,000 / $300,000 / $3,000 / $0 figures the owner cited. This does not affect
  the conclusion in the slightest — the tiers are governance either way, and the data
  is free either way — but I did not verify those specific numbers.

---

# Sources

All read 2026-09-01.

**Overture**
- [docs.overturemaps.org/attribution](https://docs.overturemaps.org/attribution/) — per-theme licences
- [docs.overturemaps.org/guides/places](https://docs.overturemaps.org/guides/places/) — places schema and sources
- [docs.overturemaps.org/getting-data](https://docs.overturemaps.org/getting-data/) — bucket paths, formats, tooling
- [overturemaps.org/about/faq](https://overturemaps.org/about/faq/) — open licensing statement
- [overturemaps.org/become-a-member](https://overturemaps.org/become-a-member/) — membership benefits
- [registry.opendata.aws/overture](https://registry.opendata.aws/overture/) — bucket ARN, free access
- [cdla.dev/permissive-2-0](https://cdla.dev/permissive-2-0/) — licence text
- `overture_categories.csv` from the OvertureMaps/schema repo — category taxonomy
- Direct anonymous S3 listing of `overturemaps-us-west-2` — size and file count

**Foursquare**
- [docs.foursquare.com/data-products/docs/fsq-places-open-source](https://docs.foursquare.com/data-products/docs/fsq-places-open-source)
- [docs.foursquare.com/data-products/docs/access-fsq-os-places](https://docs.foursquare.com/data-products/docs/access-fsq-os-places)
- [docs.foursquare.com/data-products/docs/places-os-data-schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema)

**Google**
- [Places API (New) Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Places API (New) Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Places Aggregate API overview](https://developers.google.com/maps/documentation/places-aggregate/overview)
- [About Places Insights data and queries](https://developers.google.com/maps/documentation/placesinsights/about-data)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

**OpenStreetMap**
- [ODbL 1.0 full text](https://www.opendatacommons.org/licenses/odbl/1.0/)
- [OSMF Licence and Legal FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)
- OSM taginfo API, `craft=*` tag statistics

**Vendors**
- [Salesgenie by Data Axle pricing (G2)](https://www.g2.com/products/salesgenie-by-data-axle/pricing)
- [Data Axle pricing analysis](https://www.bookyourdata.com/blog/data-axle-pricing)
- [LeadsPlease email list pricing](https://www.leadsplease.com/buying-guides/email-list-pricing-explained)
- [LeadsPlease SIC code lists](https://www.leadsplease.com/mailing-lists/business/sic)
- [Apollo.io pricing 2026](https://www.saleshandy.com/blog/apolloio-pricing/)
- [UpLead pricing 2026](https://hackingdemand.com/blog/uplead-pricing-2026)

**Directories and registries**
- [Yelp API Terms of Use](https://terms.yelp.com/developers/api_terms/20250113_en_us/)
- [StatCan Open Database of Businesses](https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm)
- [Corporations Canada data services](https://ised-isde.canada.ca/site/corporations-canada/en/data-services)
- [Secretary of State business entity search, all 50 states](https://www.llcuniversity.com/50-secretary-of-state-sos-business-entity-search/)
