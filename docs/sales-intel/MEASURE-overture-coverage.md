# Measuring Overture places — do the contact columns actually have data in them?

Measurement session, **2026-09-02**. No product code was changed.

This answers the one question `AUDIT-discovery-sources.md` left open, and named as
the most important thing it could not determine:

> **Actual fill rates for `phones` and `websites` in Overture places, for North
> American trade categories.** … Until that is measured, "Overture carries phone and
> website" means the columns exist, not that they are populated.

It is now measured. Every number below came out of the real dataset, on this
machine, at a cost of **$0** and about **60 seconds of query time**. The audit
estimated this would require downloading 9.76 GiB; it did not — see §1.

---

## The one sentence

**Phone fill is 99.6%, not 40%** — a 1,000-business pull from Overture yields
**~996 with a phone** and **~961 with both a phone and a full street address**.
The contact columns are not a hollow schema. **Overture is good enough to
prospect from on its own**, and the real constraint is not fill rate but
enumeration depth (§6) — Overture knows of ~91 painting contractors in Ottawa,
and whether that is most of them is a separate, still-open question (§9).

---

## 1. What I actually ran, and why it was cheap

The audit assumed measurement meant pulling the whole 9.76 GiB release. It does
not. The files are GeoParquet with per-row-group statistics, so a `bbox`
predicate prunes row groups and column projection skips `geometry` (the largest
column). One filtered scan over all 16 remote files produced a **32 MB local
file in ~60 seconds**, and every query after that was instant and offline.

### Tooling

```bash
brew install duckdb      # v1.5.5 (Variegata) d8cdaa33fd — local dev tool only,
                         # NOT a product dependency; nothing in package.json changed
```

### Confirming the current release (not assumed)

```bash
curl -s "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&delimiter=/&prefix=release/"
```
```
release/2026-07-22.0/
release/2026-08-19.0/
```

**Current release: `2026-08-19.0`**, re-verified at 2026-09-02T13:51:29Z. No
September release existed at time of measurement. Anonymous, unauthenticated,
no AWS account — exactly as the audit found.

### The extraction

```sql
INSTALL httpfs; LOAD httpfs;
SET s3_region='us-west-2';
SET threads=8;
SET preserve_insertion_order=false;

COPY (
  SELECT id, names.primary AS name,
         categories.primary AS cat_primary, categories.alternate AS cat_alternate,
         taxonomy.primary AS tax_primary, taxonomy.hierarchy AS tax_hierarchy,
         basic_category, confidence, operating_status,
         phones, websites, emails, socials, addresses, sources,
         bbox.xmin AS lon, bbox.ymin AS lat
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*.parquet')
  WHERE bbox.xmin BETWEEN -95.5 AND -71.5      -- eastern North America
    AND bbox.ymin BETWEEN  40.0 AND  57.0
    AND ( list_contains(taxonomy.hierarchy, 'home_service')
       OR categories.primary IN ('painting','plumbing','hvac_services','roofing','landscaping',
                                 'flooring_contractors','cabinet_sales_service','carpenter','electrician')
       OR list_has_any(categories.alternate,
                      ['painting','plumbing','hvac_services','roofing','landscaping',
                       'flooring_contractors','cabinet_sales_service','carpenter','electrician']) )
) TO 'trades_east_na.parquet' (FORMAT parquet, COMPRESSION zstd);
```

**Result: 278,879 rows, 32 MB.** The audit's nine category names are all real and
all present, exactly as documented.

### The schema, as it actually is

`DESCRIBE` on one part file confirms the audit's field list and adds three the
audit did not mention: **`operating_status`**, **`basic_category`**, and a
**`taxonomy`** struct (`primary`, `hierarchy[]`, `alternates[]`) alongside the
older `categories` struct.

```
id varchar | geometry | categories struct(primary, alternate[]) | confidence double
websites varchar[] | emails varchar[] | socials varchar[] | phones varchar[]
brand struct | addresses struct(freeform, locality, postcode, region, country)[]
names struct | sources struct(property, dataset, license, record_id, update_time,…)[]
operating_status varchar | basic_category varchar
taxonomy struct(primary, hierarchy varchar[], alternates varchar[])
version integer | bbox struct(xmin,xmax,ymin,ymax) | theme | type
```

### A wrong number I published to myself first, and how it was caught

My first pass reported **100.0% phone, 100.0% website, 100.0% email** for every
category. That was a bug, not a finding. `len(phones)` returns `NULL` when the
array is `NULL`, `NULL > 0` is `NULL`, and `avg()` **skips NULLs** — so I was
averaging only over rows that already had the field, which is guaranteed to
return 100%. The tell was a `NULL` in the email column for `cabinet_sales_service`
(every row null → average over zero values). Fixed by counting explicitly:

```sql
coalesce(len(phones),0) > 0 AS has_phone      -- not len(phones) > 0
count(*) FILTER (WHERE has_phone) / count(*)  -- not avg(has_phone::int)
```

Every number below uses the corrected form. Recording this because a 100% fill
rate is exactly the kind of too-good-to-be-true result that gets shipped.

### Definitions used

| Metric | Test |
|---|---|
| has phone | `coalesce(len(phones),0) > 0` |
| has website | `coalesce(len(websites),0) > 0` |
| has email | `coalesce(len(emails),0) > 0` |
| **full street address** | `addresses[1].freeform IS NOT NULL AND regexp_matches(freeform,'[0-9]')` — requires a street *number*, so a locality-only or street-name-only row fails |
| category | `categories.primary` (strict). Alternates are counted separately in §6 |

`phones` is either `NULL` or non-empty — there are no zero-length arrays, so
"non-null" and "populated" are the same thing here.

**Bias check.** A region filter silently drops rows with no address, and rows with
no address are exactly the rows likely to have no phone — which would inflate the
fill rate. It does not happen here: of 278,879 rows, **0 have no address at all**
and only 744 (0.27%) lack a `region`. The unfiltered phone rate over the whole
extract is **99.2%**, matching the per-region figures. No survivorship bias.

---

## 2. Ontario, Canada — the nine trade categories

Release 2026-08-19.0. `country='CA' AND region='ON'`.

| Category | Businesses | % phone | % website | % street addr | % email | % phone+addr | **Callable** |
|---|---:|---:|---:|---:|---:|---:|---:|
| hvac_services | 2,111 | 99.5 | 95.9 | 97.8 | 42.6 | 97.5 | 2,058 |
| landscaping | 1,971 | 99.6 | 88.7 | 93.0 | 68.3 | 92.8 | 1,829 |
| electrician | 1,571 | 99.9 | 91.9 | 98.0 | 48.2 | 98.0 | 1,539 |
| roofing | 1,523 | 99.8 | 94.1 | 97.7 | 47.9 | 97.6 | 1,487 |
| plumbing | 1,498 | 99.8 | 93.6 | 97.3 | 45.7 | 97.2 | 1,456 |
| painting | 978 | 99.1 | 90.5 | 92.1 | 49.5 | 91.5 | 895 |
| carpenter | 756 | 98.7 | 88.6 | 97.1 | 55.4 | 96.0 | 726 |
| flooring_contractors | 400 | 100.0 | 99.8 | 99.0 | 10.3 | 99.0 | 396 |
| cabinet_sales_service | 126 | 100.0 | 100.0 | 100.0 | 0.0 | 100.0 | 126 |
| **All nine** | **10,934** | **99.6** | **92.7** | **96.4** | **49.0** | **96.1** | **10,512** |

## 3. New York State, USA — the same nine

**Why New York.** It borders Ontario, it is the realistic first US market for an
Ontario-based product, and at ~19.5M people against Ontario's ~15.8M it is close
enough in scale that the counts are directly comparable rather than needing
normalisation. That comparability is the point: it turns the second region into a
cross-check on the first.

| Category | Businesses | % phone | % website | % street addr | % email | % phone+addr | **Callable** |
|---|---:|---:|---:|---:|---:|---:|---:|
| hvac_services | 2,177 | 99.8 | 95.5 | 98.9 | 43.5 | 98.6 | 2,147 |
| landscaping | 2,143 | 99.5 | 83.0 | 94.9 | 66.8 | 94.6 | 2,028 |
| electrician | 1,739 | 99.7 | 93.6 | 98.5 | 38.8 | 98.2 | 1,708 |
| plumbing | 1,564 | 99.4 | 91.7 | 98.5 | 50.6 | 98.1 | 1,534 |
| roofing | 1,419 | 99.5 | 95.3 | 98.2 | 39.8 | 97.7 | 1,387 |
| painting | 710 | 99.7 | 90.4 | 94.4 | 41.3 | 94.2 | 669 |
| carpenter | 537 | 98.7 | 87.2 | 97.6 | 65.4 | 96.6 | 519 |
| flooring_contractors | 209 | 100.0 | 100.0 | 100.0 | 20.1 | 100.0 | 209 |
| cabinet_sales_service | 90 | 100.0 | 100.0 | 98.9 | 0.0 | 98.9 | 89 |
| **All nine** | **10,588** | **99.6** | **91.4** | **97.5** | **48.1** | **97.2** | **10,290** |

**The two regions agree to within a fraction of a point on every metric** —
phone 99.6/99.6, website 92.7/91.4, street 96.4/97.5, email 49.0/48.1. Two
independent jurisdictions with different data contributors landing on the same
numbers is the strongest evidence available that these rates are a real property
of the dataset and not an artifact of one region's sourcing.

**Email is the one weak field, at ~48%** — and it is bimodal by trade, not
uniform: landscaping 67–68%, carpenter 55–65%, but flooring 10–20% and
cabinet_sales_service **0.0% in both regions**. Do not plan an email-first
campaign on this. Phone-first is what the data supports.

### The query

```sql
SELECT cat_primary AS category, count(*) AS businesses,
       round(100.0*count(*) FILTER (WHERE has_phone) /count(*),1) AS pct_phone,
       round(100.0*count(*) FILTER (WHERE has_web)   /count(*),1) AS pct_website,
       round(100.0*count(*) FILTER (WHERE has_street)/count(*),1) AS pct_street,
       round(100.0*count(*) FILTER (WHERE has_email) /count(*),1) AS pct_email,
       round(100.0*count(*) FILTER (WHERE has_phone AND has_street)/count(*),1) AS pct_phone_addr,
       count(*) FILTER (WHERE has_phone AND has_street) AS callable
FROM t WHERE country='CA' AND region='ON'      -- or country='US' AND region='NY'
  AND cat_primary IN ('painting','plumbing','hvac_services','roofing','landscaping',
                      'flooring_contractors','cabinet_sales_service','carpenter','electrician')
GROUP BY 1 ORDER BY businesses DESC;
```

---

## 4. The `confidence` field — report what it is, not what it sounds like

The brief asked to report what this actually looks like rather than assume it is
meaningful. **It is largely not meaningful for this purpose.**

Ontario + New York, nine categories, n = 21,522, **zero nulls**:

| min | p25 | median | p75 | max | mean |
|---:|---:|---:|---:|---:|---:|
| 0.0163 | 0.4996 | 0.8651 | 0.9199 | 1.0 | 0.7211 |

| Bucket | Rows | % of total | % with phone **in that bucket** |
|---|---:|---:|---:|
| < 0.2 | 2,132 | 9.9 | 98.9 |
| 0.2 – 0.4 | 2,747 | 12.8 | 98.7 |
| 0.4 – 0.6 | 826 | 3.8 | 99.4 |
| 0.6 – 0.8 | 2,167 | 10.1 | 99.4 |
| 0.8 – 0.95 | 11,018 | 51.2 | 99.9 |
| 0.95 – 1.0 | 2,632 | 12.2 | 100.0 |

**Two findings, both of which argue against filtering on it.**

**(a) It does not predict contactability.** The phone fill rate is 98.9% in the
lowest-confidence bucket and 100.0% in the highest. Discarding everything below
0.5 would throw away ~23% of the records to improve phone fill by roughly one
percentage point. That is a bad trade.

**(b) It is mostly a per-source constant, not a per-record score.** The
distribution is lumpy — one value, `0.919912`, accounts for 6,718 rows (31%),
and `0.85`, `0.77` and `0.9655` account for most of the rest. Broken out by
contributing dataset:

| Source | Rows | min | median | max | **distinct confidence values** |
|---|---:|---:|---:|---:|---:|
| meta | 11,768 | 0.0163 | 0.6840 | 1.0 | **8,213** |
| Microsoft | 7,453 | 0.85 | 0.9199 | 0.9948 | 1,596 |
| Foursquare | 2,279 | 0.77 | 0.77 | 0.9902 | **3** |
| DAC | 22 | 0.9199 | 1.0 | 1.0 | 2 |

Foursquare rows carry essentially a flat 0.77 — three distinct values across
2,279 records. Only Meta's rows have genuine per-record variation. **So
`confidence` is comparable within Meta and close to meaningless across sources.**
Treat it as a provenance tag, not an existence probability.

**`operating_status` is not a closed-business filter.** It takes exactly two
values in this slice: `open` (7,328) and `NULL` (14,194). There are **no
`closed` values at all**. Overture places has no usable equivalent of
Foursquare's `date_closed`. This is a real gap against the audit's note that
`date_closed` was a Foursquare advantage — it is, and Overture does not inherit it.

---

## 5. Spot-check: ten Ottawa painting rows, by eye

Ten highest-confidence `painting` rows in the Ottawa area, checked for whether
they look like real businesses and whether the phone is plausible for the region.

| Name | Phone | Street | Postcode | Confidence | Source | Updated |
|---|---|---|---|---:|---|---|
| WOW 1 DAY PAINTING | +18889691329 | 323 Coventry Road | K1K 3X6 | 1.000 | DAC | 2026-08-11 |
| Dulux Canada | +16137283339 | 1840 Carling Ave | K2A 1E2 | 0.996 | meta | 2026-08-10 |
| Oasis Painting | 6137956277 | 17 Aberdeen Street | K1S 3J3 | 0.975 | Microsoft | 2025-09-02 |
| Rejuvenation Renovations | 6137101979 | 20 Gore Private | K1V 0R6 | 0.974 | Microsoft | 2025-10-05 |
| Linz Painting Plus | 6138990279 | 997 Karsh Dr | K1G 4Y4 | 0.966 | Microsoft | **2017-02-08** |
| Commercial Painting & Renovations | 6137693435 | 2339 Ogilvie Road | K1J 8M6 | 0.966 | Microsoft | 2025-07-30 |
| Ottawa Painting Contractors | 6133198431 | 78 George St, Suite 204 | K1N 5W1 | 0.966 | Microsoft | 2025-09-11 |
| Painters Ottawa | 6136559995 | 1145 Carling Ave | K1Z 7K4 | 0.966 | Microsoft | **2018-10-05** |
| Eco Painting Plus | 6136272525 | A-2 36 flora | K2P 1A7 | 0.966 | Microsoft | **2015-09-08** |
| Capital Painters | +16133029295 | 700 Churchill Ave N | K1Z 5G5 | 0.902 | meta | 2026-08-10 |

**Verdict: the data is real.** These are recognisable Ottawa businesses at
addresses that exist, and the postcodes match their streets correctly — K1S 3J3
for Aberdeen St in the Glebe, K1Z for Carling Ave, K2P for Flora St in
Centretown. Nothing here looks synthesised or hallucinated.

**Four honest problems, all quantified:**

1. **Phone formats are inconsistent.** 54.2% are E.164 (`+16137283339`), 45.3%
   are bare ten-digit (`6137956277`), 0.4% absent. Meta and DAC use `+1`;
   Microsoft does not. **Normalisation is required on ingest** — this is real
   work, not a nicety, and dialling or deduplicating on the raw string will fail.

2. **Some records are genuinely stale.** "Eco Painting Plus" was last touched
   2015-09-08 — eleven years ago. Across Ontario + New York:

   | Newest source `update_time` | Rows | % |
   |---|---:|---:|
   | 2026 | 12,090 | 56.2 |
   | 2025 | 4,946 | 23.0 |
   | 2023–24 | 1,187 | 5.5 |
   | 2020–22 | 800 | 3.7 |
   | **pre-2020** | **2,499** | **11.6** |

   **79.2% refreshed within the last two years; 11.6% is pre-2020 and should be
   treated as unverified.** That stale tail is the single best argument for
   phone-verifying before a human dials.

3. **Category precision is imperfect.** `Dulux Canada` is a paint *retailer* and
   `Rejuvenation Renovations` is a general renovator; neither is a painting
   contractor. But this is anecdotal, not systemic — matching known retail chains
   (Dulux, Sherwin-Williams, Benjamin Moore, Home Depot, Rona, Lowe's, Home
   Hardware, Canadian Tire) against `cat_primary='painting'` finds **16 rows out
   of 1,688 = 0.9%**. Not a problem worth engineering around.

4. **Minor formatting junk** — `"A-2 36 flora"` has broken casing. Cosmetic.

**Area codes are plausible.** Ottawa is 613 with a 343 overlay. Across all nine
trades in the Ottawa bounding box: **613 → 791, 343 → 24** (97% correct), plus
819 → 6 (Gatineau, across the river — correct), toll-free 800/855/877/888 → 15
(franchises like WOW 1 DAY), and 647 → 4 (Toronto). Nothing implausible.

**Duplicate load is low.** In Ontario, 10,889 rows with a phone resolve to 10,522
distinct normalised numbers — **3.4% duplication**. Deduplication is a small job.

---

## 6. Ottawa specifically — the number the owner asked for

City of Ottawa (`locality='Ottawa'`), release 2026-08-19.0:

| Category | Businesses | With phone | % phone | Phone + street addr |
|---|---:|---:|---:|---:|
| landscaping | 143 | 143 | 100.0 | 133 |
| hvac_services | 99 | 99 | 100.0 | 99 |
| roofing | 98 | 97 | 99.0 | 97 |
| electrician | 78 | 78 | 100.0 | 77 |
| plumbing | 71 | 71 | 100.0 | 69 |
| **painting** | **70** | **69** | **98.6** | **66** |
| carpenter | 44 | 42 | 95.5 | 41 |
| flooring_contractors | 16 | 16 | 100.0 | 16 |
| cabinet_sales_service | 1 | 1 | 100.0 | 1 |

**The direct answer: 70 painting contractors in the City of Ottawa, 69 of them
with a phone number, 66 with both a phone and a full street address.**

Widening the definition, because how you count matters more than the fill rate
here:

| Definition (Ottawa area bbox) | Businesses | With phone |
|---|---:|---:|
| `cat_primary = 'painting'` | 75 | 74 |
| `taxonomy.hierarchy` contains `painting` | 75 | 74 |
| primary **or** alternate = `painting` | 91 | 88 |
| any painting signal (broadest) | **91** | **88** |
| name matches `%paint%` | 88 | 86 |
| `basic_category = 'painting'` | 0 | 0 |

**So: between 70 and 91 painting contractors in Ottawa, with 69–88 reachable by
phone**, depending on whether you accept alternate categories. Note
`basic_category` is **empty for painting** — do not filter on it.

**Across all home-service trades, the Ottawa area has 2,930 records, 2,901 with a
phone, and 2,802 with both phone and street address.** That is the real size of
the Ottawa prospect pool, and it is a far more useful number than the painter
count alone.

> **Two Ottawa scopes are used below, deliberately.** `locality='Ottawa'` (the
> city proper) gives 2,197 home-service records; the Ottawa-area bounding box
> (lat 45.10–45.60, lon −76.40…−75.20) gives 2,930, because it also picks up
> Nepean, Kanata, Orleans, Gloucester, Stittsville and the surrounding townships,
> which appear as separate localities despite amalgamation. Neither is wrong —
> the bbox is the right scope for a sales territory, the locality for a
> like-for-like comparison against other cities.

### Is 70–91 painters complete, or is Overture missing most of them?

I could not settle this against an external authority (§9), but I can show the
counts are **internally consistent** rather than patchy. Painting as a share of
all home-service businesses, by Ontario city:

| Locality | Painters | All home-service | Painting share |
|---|---:|---:|---:|
| Toronto | 146 | 5,073 | 2.88% |
| **Ottawa** | **70** | **2,197** | **3.19%** |
| Mississauga | 56 | 2,149 | 2.61% |
| Hamilton | 38 | 1,185 | 3.21% |
| London | 52 | 1,141 | 4.56% |
| Brampton | 28 | 1,000 | 2.80% |
| Oakville | 27 | 680 | 3.97% |
| Kitchener | 18 | 657 | 2.74% |

Painting lands at 2–4.6% of home-service in every city, with Ottawa mid-range at
3.19%. Toronto (pop ~2.79M) has 2.09× Ottawa's painters against a 2.74×
population ratio. **Coverage is uniform, not patchy** — whatever density Overture
enumerates at, it applies it evenly. Whether that density matches reality is the
open question in §9.

---

## 7. What ~$150 actually buys from a list vendor

All vendor pages read **2026-09-02**.

### The important finding: **both vendors give you counts for free. Do that first.**

The brief was right to suspect this, and it is the single most actionable item here.

**LeadsPlease** runs free counts with **no signup and no payment** — its own site
titles the tool *"Buy Mailing Lists & Email Lists — Instant Counts & Prices"*, and
you can build a selection and see the exact record count and price before paying.
It additionally offers **25 free leads, no credit card required**, plus sample
lists on request.

**Data Axle / Salesgenie**'s count tool likewise shows how many records match your
criteria and the price before you enter payment details, and there is a **3-day
free trial including 150 free leads, no credit card**.

**So the count for "painting contractors in Ottawa" — the exact number that would
justify a purchase — is obtainable from both vendors for $0.** Nobody needs to
spend $150 to find out how many records exist. Run the counts, compare them to
the 70–91 in §6, and only then decide.

### Current pricing (corrects the audit)

**LeadsPlease business *mailing* lists** — read from their own pricing page:

| Records | Price | Per record |
|---:|---:|---:|
| 500 | $124.95 | 24.99¢ |
| 1,000 | $200.00 | 20¢ |
| 10,000 | $1,100.00 | 11¢ |
| 50,000 | $4,500.00 | 9¢ |

Business **email** lists are far dearer: 500 → $299.75, 1,000 → $400,
50,000 → $12,225 (24.45¢).

> **Correction to `AUDIT-discovery-sources.md`.** The audit gave LeadsPlease as
> "$0.24–0.60/record" and "~$12,000 for 50,000". That is the **email** list
> pricing. The **mailing** list — which is the product that carries the phone
> number, and therefore the one that matters for cold calling — runs 9–25¢, and
> 50,000 records is **~$4,500, not ~$12,000**. The audit conflated the two
> products and overstated the cost of the relevant one by ~2.7×.

**Data Axle / Salesgenie** — $99/month Basic through $299/month Team.
Multiple secondary sources state all paid plans require a **12-month contract**,
making the real minimum commitment **$1,188**, not $99.
**I could not verify this first-hand** — G2 and TrustRadius both returned HTTP 403
to my fetches, and the sources that do state it (SyncGTM, LeadsPlease buying
guides) are Salesgenie's competitors and therefore not disinterested. Flagged in §9.

### So, concretely, what does $150 buy?

- **LeadsPlease: roughly 600 business mailing records** (between the 500/$124.95
  and 1,000/$200 tiers), with business name, phone, mailing address, SIC/NAICS,
  URL, employee count, annual sales, and contact name/title.
- **Data Axle/Salesgenie: nothing** — $150 does not clear the reported 12-month
  minimum commitment. It buys a 3-day trial and 150 leads, which are free anyway.

Against Overture's **10,512 callable Ontario records at $0**, ~600 purchased
records is not a discovery source. It is a *benchmark* — which is exactly the job
the audit proposed for it, and that framing survives this measurement.

### Guaranteed fields vs offered fields, and published fill rates

**Neither vendor publishes field-level fill rates.** This matters, because it
means the audit's open question about Overture cannot even be *asked* of the paid
alternatives from public information.

- **Data Axle's own quality page** gives only volume metrics — 44 million US
  businesses, 120 million businesses plus 4.9 million closed, 350 researchers,
  5,200+ Yellow and White Page directories, 3 billion records aggregated
  annually. **No percentage for phone, email or website presence anywhere on it.**
  ("5,200+ Yellow and White Page directories" is also worth noting as a
  provenance signal about how the phone numbers are compiled.)
- **LeadsPlease** claims "98% Accuracy" and "98+% deliverability rate within 30
  days". Read carefully: that is a **postal deliverability** claim about the
  addresses they do supply — it is *not* a statement that 98% of records carry a
  phone or an email. The audit's note that LeadsPlease claims "~70% of business
  records carrying an email" is the closest thing to a published fill rate from
  either vendor, and it is marketing copy, not a measurement.

Contrast with Overture, where the fill rate is not claimed by anyone — it is
**countable by you, for free, in 60 seconds**, and re-countable every month when
the release refreshes. That is a genuine structural advantage and it is the main
non-obvious conclusion of this exercise.

### A free benchmark that removes the need to buy anything

The audit recommended spending ~$150 on a small list purely to benchmark
Overture's coverage. **That benchmark is available for $0.**

**Data Axle Reference Solutions is free with a public library card.** It is the
same underlying Data Axle business database, licensed to libraries, searchable by
industry and location. Whitby Public Library (Ontario) describes it as *"A
comprehensive directory of 1.5 million Canadian companies of all sizes and
types… searchable by type of business, name, location and more"*, accessed by
signing in with a library card. Many US libraries carry the US database on the
same terms. Data Axle's own product page confirms Reference Solutions is the
library/academic channel, accessed "through your library's website".

Library pages commonly cite a **500-records-per-search download cap** — which is
ample for a benchmark, though I could not confirm that limit first-hand (§9).

**This directly answers the question the $150 was going to buy**: pull Data Axle's
Ottawa painting contractors through a library card, compare against the 70–91 in
§6, and measure both the overlap and the phone-number agreement — for nothing.
Data Axle publishes a library locator at `referenceusa.com/Static/LibraryLocator`.

---

## 8. Verdict — is Overture good enough to prospect from on its own?

**Yes, on contactability. Unambiguously.**

The audit's honest worry was that `phones` and `websites` might be mostly empty
columns. They are not:

- **Phone: 99.6%** in Ontario, **99.6%** in New York.
- **Phone + full street address — the minimum viable cold-call record: 96.1%
  (ON) / 97.2% (NY).**
- Website: 92.7% / 91.4%.
- Email: 49.0% / 48.1% — **the one field that is genuinely half-empty**, and
  effectively absent for cabinet and flooring businesses.

To answer in the brief's own terms: **it is not 40%, it is 99.6%.** A 1,000-business
pull yields **~996 with a phone**, and **~961 you could actually cold-call** with
both a number and an address. Across Ontario's nine trade categories that is
**10,512 callable businesses today, at $0**, and 10,290 more in New York.

**Buy nothing yet.** Both vendors give free counts, and a library card gives free
access to Data Axle's own database — so every question a $150 purchase would
answer can be answered for nothing first. If the free Data Axle benchmark shows
Overture missing most of the market, revisit; the ~$4,500 for 50,000 LeadsPlease
mailing records (not the $12,000 the audit feared) is then the number to weigh.

**Three caveats, none of which change the verdict:**

1. **Enumeration depth is the real open question, not fill rate.** Overture knows
   of 70–91 painters in Ottawa. Its coverage is internally consistent across
   cities (§6), but consistent is not the same as complete. **This is now the most
   important unanswered question, and §7 gives a way to answer it for $0.**
2. **~11.6% of records are pre-2020.** Phone-verify before a human dials.
3. **Phone formats need normalising on ingest** (54% E.164 / 45% bare), and
   there is no `closed` flag — `operating_status` is only ever `open` or `NULL`.

Do not filter on `confidence`. It does not predict contactability (98.9% phone
fill in the lowest bucket vs 100.0% in the highest) and is a per-source constant
for Foursquare and Microsoft rows.

---

## 9. What I could not determine

- **Whether 70–91 painters is Ottawa's true population of painting contractors.**
  I showed Overture's counts are internally consistent across Ontario cities, but
  I could not obtain an authoritative external denominator. The right source is
  **Statistics Canada, Canadian Business Counts, NAICS 238320 (Painting and wall
  covering contractors), Ottawa–Gatineau CMA** — StatCan table **33-10-0661**. I
  could not retrieve establishment-level figures for that table within this
  session. Until that comparison is run, Overture's *coverage ratio* is unknown,
  even though its *fill rate* is now firmly known.
- **Whether Salesgenie genuinely requires a 12-month contract.** Stated by
  multiple secondary sources, but G2 and TrustRadius both returned HTTP 403 to my
  fetches, and the sources that do state it are Salesgenie's competitors. The
  $1,188 minimum figure should be confirmed with Data Axle directly before it is
  relied on.
- **The 500-record-per-search download cap on Data Axle Reference Solutions.**
  Reported on several library pages; the two library pages I fetched first-hand
  (Whitby, Nashville) do not state a limit, and Data Axle's own page gives no
  quota. Confirm with the specific library before planning a benchmark around it.
- **Whether Ottawa Public Library specifically carries Data Axle Reference
  Solutions.** I confirmed an Ontario public library (Whitby) does and that a
  Canadian edition covering 1.5M companies exists, but not OPL's own holdings.
  Check the Data Axle library locator or OPL's database list.
- **Fill rates for the paid vendors.** Neither Data Axle nor LeadsPlease publishes
  field-level fill rates, so I could not compare like with like. LeadsPlease's
  "98% accuracy" is a postal-deliverability claim, not a fill rate, and I have not
  treated it as one. The free library benchmark in §7 is the only honest way to
  compare.
- **Overture places totals for all of Canada and the US.** My extract was bounded
  to an eastern-North-America bbox (lon −95.5…−71.5, lat 40…57) for speed. The
  Ontario and New York numbers are complete within that box — both regions fall
  entirely inside it — but I did not count national totals.
- **`brand` field contamination.** I omitted `brand` from the extraction and so
  measured chain/retailer contamination by name matching instead (0.9%). A
  `brand`-based measure would be more rigorous and needs a re-extract.

---

## Reproducing this

Everything above comes from two files, both re-runnable from scratch in ~2 minutes:

```bash
brew install duckdb
duckdb -c ".read extract.sql"    # ~60s, writes trades_east_na.parquet (32 MB)
duckdb -c ".read measure2.sql"   # instant, all tables in §2-§6
```

The full SQL for both is inlined in §1 and §3. Nothing requires credentials, an
AWS account, or a paid service. Re-run against a newer `release/` prefix to
refresh — Overture ships monthly.

---

## Sources

All read **2026-09-02**.

**Overture (measured directly, not cited)**
- Anonymous S3 listing of `overturemaps-us-west-2` — release enumeration, confirmed `2026-08-19.0` current
- `s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/*.parquet` — all fill-rate, confidence, staleness and Ottawa figures
- DuckDB v1.5.5 with `httpfs`

**Vendors**
- [leadsplease.com/mailing-lists/business](https://www.leadsplease.com/mailing-lists/business) — mailing-list pricing tiers, fields, 98% accuracy claim, 25 free leads
- [leadsplease.com/cgx/business_mailing_lists](https://www.leadsplease.com/cgx/business_mailing_lists) — count tool, selection criteria, free samples
- [data-axle.com/platforms-products/reference-solutions](https://www.data-axle.com/platforms-products/reference-solutions/) — Reference Solutions as the library/academic channel
- [referenceusagov.com/Static/OurQuality](https://referenceusagov.com/Static/OurQuality) — Data Axle volume metrics; **no published fill rates**
- [referenceusa.com/Static/LibraryLocator](https://referenceusa.com/Static/LibraryLocator) — library locator
- [whitbylibrary.ca/node/82](https://whitbylibrary.ca/node/82) — free library-card access, 1.5M Canadian companies
- [library.nashville.gov/research/databases/data-axle-reference-solutions](https://library.nashville.gov/research/databases/data-axle-reference-solutions) — free with library card (US)
- G2 and TrustRadius Salesgenie pricing pages — **HTTP 403, not read first-hand**

**Referenced but not re-verified here**
- `docs/sales-intel/AUDIT-discovery-sources.md` — licence analysis, taxonomy, the open question this document closes
