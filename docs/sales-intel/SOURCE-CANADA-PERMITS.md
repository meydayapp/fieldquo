# Canada outside Quebec — the angles that were not licence registries

Research and verification only. **No provider was written, nothing in
`lib/sales/discovery/` was touched, no account was created, no form was
submitted and nothing was purchased.** Retrieval and measurement date for
everything below: **2026-09-03**.

Third document in the series. `SOURCE-CANADA.md` surveyed provincial boards and
federal registries; `SOURCE-CANADA-PROVINCES.md` measured the municipal
business-licence layer and closed the ODBus question. Both concluded that
outside Quebec the licence-registry angle is exhausted. This document does not
re-litigate either. It answers the question they left:

> If licence registries are a dead end, do **building permits**, **corporate
> registries**, **trade associations**, **workers' compensation registries**, or
> **whatever the US permit-data companies actually do** produce a bulk,
> legally-usable, *contactable* list of Canadian contractors outside Quebec?

## How to read this document

Same three markers the previous two use, for the same reason.

- **VERIFIED** — I fetched the primary source and quote what it said.
- **MEASURED** — I computed it from the real data, on this machine, today, via
  the publisher's own aggregate API. The query and its limits are stated.
- **UNVERIFIED** — I could not establish it from a primary source. It is named
  as an open question, not answered by inference.

I am an engineer reading licence texts, not a lawyer.

---

## The one paragraph

**The answer is no, and the owner's anticipated verdict is the right one.**
Outside Quebec, Canada has **no bulk contractor source with contact details**,
and the honest options are (a) buy, (b) enrich from websites, or (c) target the
US first. But one premise in the brief turned out to be **wrong**, and it is
worth knowing: **Toronto's empty `BUILDER_NAME` is a Toronto policy, not a
Canadian one.** Calgary, Vancouver, Winnipeg, Brampton, Kitchener and Surrey all
publish contractor names in open permit data, populated, under licences that
permit commercial use. I measured every one of them live today. The problem is
not the *name* — it is that **exactly one Canadian municipality in the country
publishes a contractor phone number in its permit file, and it is Kitchener,
population 257,000, yielding about 330 contactable businesses on a three-year
window — with a fill rate that has fallen from 43% to 17% since 2022.** Every other
permit source in Canada gives you a company name with no way to reach anyone.
Against Washington L&I's 75,839 contractors at 99.97% phone coverage, refreshed
three times daily, public domain, free, **Kitchener loses by a factor of about
100 and everything else scores zero.** Corporate registries are worse than dead:
Ontario, BC and Alberta each **deliberately withhold** the contact details they
hold, sell only per-entity lookups, and two of the three carry no industry code
at all.

**Workers' compensation registries fail for a different reason and fail
completely**: WSIB and WorkSafeBC are lookup tools that require the business's
precise name or account number before they will tell you anything, and what they
return is a clearance status, not a contact. They verify a name; they cannot
produce one. **Trade associations are the one track I could not finish** — the
counts are small and skewed away from our ICP, and I did not retrieve a single
association's terms of use, so §5.2 is marked accordingly rather than guessed at.

**Recommendation, stated up front: build nothing in Canada beyond the Quebec RBQ
provider. Spend the week on Washington.** If Canada must be served sooner, the
only realistic path is commercial purchase, and the specific thing to price is
**Data Axle Canada** — with a licence question that must be answered *before*
money moves (§8.2).

---

## 1. Correction to the brief: Toronto is an outlier, not a national pattern

The brief reasoned from Toronto to Canada:

> "Toronto empties `BUILDER_NAME`; that is a Toronto policy, not a national one.
> Check Ottawa, Calgary, Edmonton…"

That instinct was right, and the measurement confirms it emphatically. I queried
each city's own aggregate API — no bulk download, no scraping, server-side
counts only.

### 1.1 The cities that DO publish contractor names — MEASURED

| City | Dataset | Rows | Contractor field | Populated | Distinct | Live to |
|---|---|---:|---|---:|---:|---|
| **Calgary** | Building Permits `c2es-76ed` | 499,088 | `contractorname` | **300,118 (60.1%)** | **12,143** | 2026-09-02 |
| **Calgary** | Electrical `vxgy-id5s` | 454,450 | `contractor` | **408,192 (89.8%)** | 1,917 | 2026-09-03 |
| **Calgary** | Gas `tg24-jt7r` | 208,811 | `contractor` | **208,741 (99.97%)** | 1,660 | 2026-09-03 |
| **Calgary** | Plumbing `5pvv-k7hn` | 152,232 | `contractor` | **131,442 (86.3%)** | 1,303 | 2026-09-03 |
| **Calgary** | HVAC `cdrc-r4u8` | 121,775 | `contractor` | **121,770 (99.996%)** | 603 | 2026-09-03 |
| **Vancouver** | `issued-building-permits` | 51,893 | `buildingcontractor` | **32,213 (62.1%)** | **4,365** | 2026-09-02 |
| **Winnipeg** | Trade Permits `urbd-qygv` | 373,620 | `applicant_business_name` | **305,011 (81.6%)** | 2,126 | 2026-08-31 |
| **Winnipeg** | Detailed BP `it4w-cpf4` | 162,558 | `applicant_business_name` | **124,803 (76.8%)** | **15,036** | 2026-08-31 |
| **Kitchener** | Building Permits | 76,054 | `CONTRACTOR` + `CONTRACTOR_CONTACT` | **38,316 (50.4%)** | 4,471 | 2026-09-03 |
| **Brampton** | Building Permits | 222,120 | `BUILDER` + `CONTRACTOR` | **78,092 (35.2%)** | 550 | — |
| **Surrey** | Issued Building Permits | 1,474 | `BuildingGeneralContractorOrganization` | 1,082 (73.4%) | — | — |

**Calgary's trade-specific permit files are the strongest scope match in the
country** — separate Electrical, Plumbing, Gas and HVAC registers, each naming
the contractor, gas and HVAC at essentially 100% fill. That is precisely
FieldQuo's ICP, identified by trade, with no guessing. It is also, as §2 shows,
completely uncontactable.

### 1.2 The cities that do not — MEASURED

| City | Finding |
|---|---|
| **Toronto** | `BUILDER_NAME` present in schema, **empty**. Confirmed independently; not re-tested per the brief. |
| **Edmonton** | **No contractor, builder or applicant column exists** in `General Building Permits` (`24uj-dj8v`). Nothing to populate. |
| **Ottawa** | Current published file `BuildingPermits2026.xlsx` has **no contractor column at all** — columns are `STREET ADDRESS, POSTAL CODE, WARD, ISSUED DATE, BUILDING TYPE, COMMUNITY, DESCRIPTION, D.U., VALUE, SQUARE METRES, PERMIT NUMBER`. See §3 — its metadata still carries the reason. |
| **Mississauga** | Two permit datasets, neither has a contractor/builder field. |
| **Hamilton** | `Building and Demolition Permits 2017 to Present` — no contractor field. |
| **Halifax** | 16 permit datasets across the PPL&C service — **none** has a contractor field. |
| **London ON** | 232 datasets, **zero** permit datasets. |
| **Markham, Saskatoon, Kelowna, Coquitlam, LIO Ontario** | No permit dataset with a name or contact field. |
| **Victoria BC** | Has `phone`, `cell`, `email` fields — but see §2.3, they are near-empty and they are not the contractor's. |

**Method note and a correction to my own work.** My first pass counted Brampton's
contractor field as **zero populated**, using `WHERE CONTRACTOR IS NOT NULL AND
CONTRACTOR <> ''`. That was wrong — Brampton's ArcGIS MapServer does not
evaluate the empty-string comparison the way the other services do, and the
correct count is **78,092**. I caught it by sampling actual rows rather than
trusting the aggregate. I then re-ran every other city with `IS NOT NULL` alone
and confirmed the figures above are unaffected (Calgary 300,118 either way;
Vancouver 32,213; Winnipeg 305,011; Kitchener 38,316 vs 38,301). **A count of
zero from a filter you have not sampled behind is not a finding.** I nearly
reported Brampton as a Toronto-style blank, which would have been false.

---

## 2. The thing that actually matters: phone numbers

Contractor *names* are abundant. Contractor *contact details* are not. This is
the whole finding.

### 2.1 Kitchener — the only Canadian permit file with phone numbers

City of Kitchener, `Building Permits`, service
`services1.arcgis.com/qAo1OsXi67t7XgmS/.../Building_Permits/FeatureServer/0`,
landing page `https://data.waterloo.ca/datasets/KitchenerGIS::building-permits`,
**modified 2026-09-03**.

It carries a field no other Canadian municipality publishes: `CONTRACTOR_CONTACT`,
which is a **full mailing address plus one or two phone numbers**. Real values,
sampled live:

```
TRIGON CONSTRUCTION          | 35 RIDGEWAY CIR WOODSTOCK ON N4V 1C9 phone 519-788-2195
FIRST ON SITE RESTORATION    | 235 ARDELT AVE KITCHENER ON N2C 2M3 phone 519-574-5578
RITZ HOMES                   | 230 THE BOARDWALK KITCHENER ON N2N 0B1 phone 519-465-6705 phone2 519-743-8140
SITTLER DEMOLITION ENVIRONMENTAL | 36 CENTENNIAL RD KITCHENER ON N2B 3G1 phone 519-581-1351 phone2 519-581-5658
FUSION HOMES                 | 500 HANLON CREEK BLVD GUELPH ON N1C 0A1 phone 519-826-6700 phone2 519-826-6701
```

**MEASURED**, on the 5,227 permit rows issued 2020 or later that carry a
populated `CONTRACTOR_CONTACT` (pulled via the service's own paged query API):

| Measure | Value |
|---|---:|
| Rows in sample | 5,227 |
| Rows where a `phone` token yields ≥10 digits | **4,490 (85.9%)** |
| Distinct contractors in sample | 746 |
| **Distinct contractors with at least one phone** | **699 (93.7%)** |
| Distinct 10-digit phone numbers | 599 |

The sample's distinct-contractor count (746) matches the server-side
`returnDistinctValues` count for the same period exactly, so the sample is the
population for 2020+, not an estimate.

Whole-file distinct contractors: **4,471** all-time (1999–2026), **746** since
2020, **332** since 2023. The all-time number is the misleading one — a 1999
permit is not a business you can sell to.

**And it is getting worse, not better.** Kitchener refreshes daily
(`EXTRACTION_DATE` max 2026-09-03T02:51Z, latest permit 2026-09-02), so this is
a live source — but the fill rate on the contact field has collapsed:

| Issue year | Permits | With `CONTRACTOR_CONTACT` | Fill |
|---|---:|---:|---:|
| 2018 | 2,876 | 1,003 | 34.9% |
| 2019 | 3,243 | 1,064 | 32.8% |
| 2020 | 2,857 | 1,232 | **43.1%** |
| 2021 | 3,349 | 1,432 | **42.8%** |
| 2022 | 3,461 | 1,005 | 29.0% |
| **2023** | 2,774 | 380 | **13.7%** |
| 2024 | 2,914 | 328 | 11.3% |
| 2025 | 2,903 | 557 | 19.2% |
| 2026 (part) | 1,719 | 293 | 17.0% |

Something changed in Kitchener's practice in **2023** and the field is now
populated on roughly one permit in six. Distinct contractors carrying a contact:
**332 since 2023, 247 since 2024, 158 since 2025.**

I have not established *why* the fill collapsed — a process change, a new permit
system, or a privacy decision are all consistent with the shape. **UNVERIFIED.**
What is certain is that the trend is downward, which makes an already-marginal
source worse and argues against building on it.

**Licence — VERIFIED, and it is clean.** Open Government Licence – The
Corporation of the City of Kitchener, v1.0, quoted verbatim from the dataset's
own `license` metadata:

> "The information provider grants you a worldwide, royalty-free, perpetual,
> non-exclusive licence to use the information, **including for commercial
> purposes**, subject to the terms below. You are free to Copy, modify, publish,
> translate, adapt, distribute or otherwise use the Information in any medium,
> mode or format for any lawful purpose."

Attribution is optional: *"No credit is required where you do any of the above."*

**But read the exemption, because it bites here specifically:**

> "Exemptions: This licence does not grant you any right to use: **Personal
> information** or records not accessible under the Municipal Freedom of
> Information and Protection of Privacy Act"

with *"'Personal information' has the meaning set out in section 2 of the
Municipal Freedom of Information and Protection of Privacy Act."* A large share
of Kitchener's `CONTRACTOR` values are individuals — `MANINDER BRAR :2629308
ONTARIO INC`, `JAMES PALMERTON :JP QUALITY CARE CONSTRUCTION` — and the attached
number is plausibly a personal mobile. **The licence grants commercial use of the
dataset and simultaneously withholds the personal information inside it.** For a
sole trader those two clauses point in opposite directions, and which wins is a
legal judgement I am not qualified to make. Flagging it rather than resolving it.

**Verdict: real, clean, decaying, and far too small.** ~700 contactable
businesses on a six-year window; **~330 on a realistic three-year one.** §7
prices it.

### 2.2 Everywhere else: names, no numbers

Not one of Calgary, Vancouver, Winnipeg, Brampton or Surrey publishes a
contractor phone or email. Vancouver is the near-miss worth naming:
`buildingcontractoraddress` is populated on **22,048 rows (42.5%)** and is a full
mailable address with postal code —

```
PTL Contracting Ltd            | 5649 ASH ST, Vancouver, BC  V5Z 3G8
Elias Tkachuk Contracting Ltd  | 1455 Rupert Street, North Vancouver, BC  V7J 1G1
Maxalan Construction Ltd       | 35637 Zanatta Pl, Abbotsford, BC  V3G 0B4
```

**Name + postal code is a materially better enrichment key than the
`nameKey|city` that `SOURCE-CANADA-PROVINCES.md` §6 measured at 8–10% match and
~7.5% net-correct yield.** That is the one genuine improvement this document
found for the enrichment path. It is still an enrichment path, it still costs a
web-crawling pass per business, and it still starts from 4,365 all-time / 1,015
last-12-month Vancouver contractors. It does not change the verdict.

### 2.3 Victoria BC — a false positive, recorded so nobody re-checks it

Victoria's `Building Permits Issued in the Last Year` layer has `ContactType`,
`Name`, `mailing_address`, `phone`, `cell`, `email`, `fax`. It looks like the
jackpot. It is not. **MEASURED**, 5,663 rows:

| Field | Populated |
|---|---:|
| `phone` | **250 (4.4%)** |
| `email` | **207 (3.7%)** |
| `cell` | 20 (0.4%) |
| `Name` | 1,664 (29.4%) |

And `ContactType` is `APPLICANT` on 1,661 rows, `PLUMBER` on **2**,
`ELECTRICIAN` on **1**, null on 3,999. The contact is the permit applicant —
frequently the homeowner — not the contractor. Victoria's business-licence
layers (37,661 past-5-years rows, 7,759 current) carry `naics_description` but
**no contact field at all**.

---

## 3. Why the field is blank where it is blank — the answer, from a primary source

The previous research flagged this as undocumented: no City of Toronto statement
explains the empty `BUILDER_NAME`, and the "privacy policy" reading was
inference. I found the rationale — not in Toronto, but in **Ottawa's own dataset
metadata**, which states it plainly. VERIFIED, quoted verbatim from the
`description` field of AGOL item `a8992582cb764c1a9edaebfb0b30e9c7`
(*Construction, Demolition, and Pool Permits 2026*, City of Ottawa):

> "**In cases where the contractor is also the property owner, the City of Ottawa
> is unable to disclose this information due to MFIPPA, therefore the phrase
> \*CONTRACTOR\*\\ is used.**"

That single sentence explains the entire national pattern, and it is a *narrow*
rule, not a blanket one:

- Ontario municipalities are governed by **MFIPPA** (Alberta: FOIP; BC: FIPPA).
  **PIPEDA is the wrong statute** — it governs commercial activity, not
  municipalities.
- A **corporate** contractor name is not "personal information" under those acts,
  so it is publishable. That is why Calgary can publish `GENESIS BUILDERS GROUP`
  and Brampton `ASHLEY FAMILY HOMES LIMITED`.
- An **individual** contractor — the sole trader who is also the owner — *is*
  personal information, and gets redacted.

**So the law requires redacting the sole traders, and Toronto redacts
everybody.** Toronto's blanket blanking is a conservative institutional choice,
not a legal requirement; Calgary and Vancouver face materially the same class of
statute and publish anyway.

Two honest caveats. First, **Ottawa's live file no longer has a contractor column
at all** — the `*CONTRACTOR*` redaction token appears nowhere in the 2026
workbook's 15,275 shared strings, and the column list (§1.2) has no contractor
field. The sentence is surviving metadata describing a field that has since been
dropped entirely. Second, this is Ottawa explaining Ottawa. **I found no City of
Toronto document stating Toronto's reason**, and I am not going to invent one.
The mechanism is now sourced; Toronto's specific motive remains UNVERIFIED.

It also means the ceiling on this whole avenue is structural: **the contractors
most likely to be redacted are sole traders — which is a large slice of
FieldQuo's 1–20-person ICP.**

---

## 4. Provincial corporate registries — worse than a dead end

Delegated and reported back with primary sources. Summary verdict: **every one
loses badly, and for a reason no price or negotiation fixes.**

| Registry | Bulk? | Price | Phone | Email | Industry code |
|---|---|---|---|---|---|
| **Ontario Business Registry** | **No bulk product exists** | $8/profile report | **No** | **Withheld** | Only for unincorporated registrations, UNVERIFIED |
| **BC Registries** | **No** | **$8.50** per search | **No** | **No** | **No** |
| **Alberta Corporate Registry** | **No** | Registry-agent fee, unpublished | **No** | **No** | **No** |

**Ontario is the decisive one, because it says out loud that it is holding the
data back.** VERIFIED, `https://www.ontario.ca/page/ontario-business-registry`:

> "Most of the information filed on the OBR, such as registered office or other
> address information, will be placed on the public record and is publicly
> available for searches under the business statutes."

> "**Administrative information such as contact information for the filing and
> the official email address is not shown on the public record.**"

Ontario *collects* an email — OBR Terms and Conditions clause 6: *"Valid email
address(es) must be provided as specified in the transaction for administrative
purposes"* — and then deliberately withholds it.

**Bulk does not exist as an approved method.** The governing instrument is
*Notice – Searching the Public Record*, SPR 33-002, effective 2026-02-01, made
"by the Director and Registrar under the Alternative Filing Methods for Business
Act, 2020". Its complete list of approved search methods is per-entity only:
free basic search, per-entity products via ServiceOntario, an intermediary, or
mail. Matching Washington's 75,839 records at $8 each is **~$607,000** — for
records with no phone number.

**There is no licence permitting reuse of Ontario registry data.** The only OBR
terms document binds *filers*, not searchers, and contains no data-use,
redistribution or resale grant at all. **That is silence, not permission.**

Two things worth recording so they are not repeated:

- A widely-cited claim that "Ontario's terms prohibit automated querying for
  commercial redistribution" traces to an SEO blog, **not** to any Ontario
  document. It should not be repeated as fact.
- **BC's OrgBook** remains the only cleanly-licensed BC option (OGL-BC: *"Copy,
  modify, publish, translate, adapt, distribute or otherwise use the Information
  in any medium, mode or format for any lawful purpose"*) and remains unusable —
  still no addresses, still no phone.

**The structural fact: Canadian provinces treat business contact details as
administrative and withhold them by policy.** Even a free, perfectly-licensed,
daily provincial dump would give names and addresses with no way to reach anyone,
and in two provinces of three no way to tell a plumber from a law firm.

---

## 5. Trade associations and workers' compensation registries

This section is **thinner than the others and I am flagging that rather than
padding it.** A delegated research pass on this track did not return before
write-up; what follows is my own verification, and the specific associations I
did not reach are named in §10.

### 5.1 Workers' compensation — structurally incapable of originating a list

Both major boards were checked. The finding is the same for each, and it is not
about terms or price: **a clearance lookup is a verification tool keyed to a
business you already know. It confirms a name; it cannot produce one.**

**WSIB (Ontario)** — `clearances.wsib.ca`. You may search by "business name,
telephone, CRA business name, address, city, and/or postal code"; the advanced
search accepts up to 1,000 account numbers; results are capped at 200 records.
There is **no browse-all and no downloadable list of registered employers**, and
the result is a clearance *status*, not a contact record.

**WorkSafeBC** — you search by "WorkSafeBC account number (a six or nine-digit
number)" or "the firm's **precise** legal or trade name", up to 150 firms at
once. The result is clearance status and the date assessments are satisfied.
**No bulk downloadable list exists.** Requiring the *precise* name is
disqualifying on its own: you cannot enumerate a registry you must already be
able to name.

Note also that WSIB accepts a **telephone number as a search input**, which means
it holds contractor phone numbers and does not publish them — the same posture as
the Ontario Business Registry (§4). This is now the third independent Canadian
institution found holding contact details and withholding them by policy.

**Verdict: zero. Not a source, at any price, under any licence.** I did not
check WCB Alberta, Manitoba, Saskatchewan, Newfoundland or Nova Scotia; given
that the two largest are structurally lookup-only and return no contact data,
the expected value of checking five smaller ones is negligible.

**One thing I will name and not recommend.** A public GitHub tool
(`cityssm/wsib-clearance-check`) exists to "programmatically scrape the clearance
certificate status from the WSIB Online Services website". It is built for
legitimate contractor verification — checking firms you already work with — not
prospecting, and it would not produce a list of businesses anyway. **I did not
review WSIB's terms of use and I am not proposing this.** Recording it only so
nobody rediscovers it and mistakes it for a discovery source.

### 5.2 Trade associations — small, and the counts do not mean what they look like

**UNVERIFIED at primary-source level; figures below are from secondary sources
and association marketing, not from a directory I enumerated.**

| Association | Claimed members |
|---|---|
| **CHBA** (national) | ~8,500–9,000 member companies |
| **Landscape Ontario** | ~3,000 members / ~2,000 member companies |
| RenoMark | Not established — count not found |
| HRAI, ECAO, CRCA, MCAC, provincial roofing/painting bodies | Not reached |

**Two reasons this track is weaker than the raw numbers suggest.**

First, **CHBA's ~9,000 is not 9,000 contractors.** Its own membership definition
spans "home builders and renovators, land developers, trade contractors, product
and material manufacturers, building product suppliers, lending institutions,
insurance providers, and service professionals". The contractor slice is
unknown and materially smaller. Even taken at face value, 9,000 against
Washington's 75,839 is an order of magnitude down — and that is *before*
establishing whether the directory exposes phone numbers or whether the terms
permit bulk use.

Second, **association membership is the wrong population.** These are the
contractors who already pay dues to a trade body — the organised, established
end of the market. FieldQuo's ICP is the 1–20-person operation run from a van,
which is the segment least likely to be a CHBA member.

**On terms — partial, and honest about it.** `robots.txt` is permissive on
`chba.ca` (`Disallow: /wp-admin/`, `Crawl-delay: 10`) and `renomark.ca`
(`Disallow:` — i.e. nothing disallowed), both with a 10-second crawl delay.
`landscapeontario.com/robots.txt` returns **404**. **But robots.txt is not a
licence.** I could not locate a terms-of-use page for Landscape Ontario
(404 on the obvious path) and did not retrieve one for CHBA or RenoMark, so
**whether any of these permits bulk collection or commercial reuse is
UNVERIFIED.** Per the brief's rule, I am not recommending collection from a
source whose terms I have not read.

**Verdict: not worth pursuing, and not because of the terms.** Even the
best case — CHBA's full 9,000 with phone numbers and a permissive licence —
is a fraction of Washington for a per-association integration, against a
membership skewed away from our ICP. If it is ever revisited, **Landscape
Ontario is the one to look at first**, because it is trade-scoped, sizeable,
and landscaping is a segment Quebec's RBQ explicitly excludes.

---

## 6. How the US permit-data companies actually source their data

This was the owner's direct question and it deserves the direct answer.

### 6.1 Shovels.ai — they say it plainly, and it does not transfer to Canada

VERIFIED, `https://docs.shovels.ai/docs/knowledge-base/data/quality/data-sources.md`:

> "Shovels collects permit data directly from city and county
> jurisdictions—we don't purchase data from third-party vendors."

The methods they name: relationships with local governments, integration with
online permitting portals, municipal open-data portals, building-department APIs,
jurisdiction-website **scraping**, formal **public records requests**, and —
offline — **phoning jurisdiction offices**. It is a hybrid of open data and
manual acquisition, and they are candid about it.

Coverage **claims**: 178M+ permits, 3.65M+ licensed contractors, 2,770+
jurisdictions. Their own docs give a lower figure — "approximately 2,000
jurisdictions representing about 85% of the US population", refreshed twice
monthly. **The homepage and the docs disagree; treat 2,770 as marketing.**

Pricing, published: Free / $0; Basic **$599**/mo; Pro **$999**/mo; Enterprise
custom, with Snowflake / BigQuery / Databricks shares or Parquet to object
storage.

**Canada: not covered.** Scope is stated as "all 50 states". No Canadian data
product exists.

**The critical detail for us.** Shovels' `primary_phone` and `primary_email`
fields are derived **from the permit records themselves** — "the most frequently
used phone number across all permits for this contractor". US permit
applications capture contractor contact details and US jurisdictions publish
them. **That is the entire basis of their contact database, and it is exactly
the field Canadian permit files do not carry.** Shovels' model cannot be ported
to Canada, because the input does not exist here. This is the single most
useful thing in this document: it explains *why* the US has BuildZoom, Shovels
and Kukun and Canada has nothing comparable, and it is a data-availability fact,
not a market-size or effort fact.

### 6.2 The others, briefly

- **BuildZoom / Gryd** — weakest disclosure of the set. Claims ~400M permits,
  6M+ contractor profiles, 2,400 jurisdictions. **They publish no sourcing
  methodology**; all figures are marketing copy, not verified against a primary
  page. No Canada.
- **Kukun** — claims 780M+ permits, 2,400+ (elsewhere "over 3,000") US
  jurisdictions. Sourcing described only as "municipal, city, and county
  databases". API is enterprise-only behind an email gate. Numbers inconsistent
  across their own pages. US only.
- **Porch Group** — **not a permit-data company.** Their data business is
  insurance underwriting risk (property condition from home inspections) plus
  V12 Data for mover marketing. Low relevance.
- **HomeStars** (Canada, Angi-owned, ~50,000 listed providers) — **closed by
  contract.** ToS §13(e), verbatim:

  > "scrape, whether by way of screen scraping or database scraping, any
  > HomeStars Property (in whole or in part) or engage in any other activity
  > intended to collect, store, reorganize, summarize, or manipulate any
  > HomeStars Property"

  explicitly covering "whether by an automatic program or a manual process".
  **Do not scrape HomeStars.** The manual-process wording closes the usual
  loophole. *Caveat: homestars.com returns 403 to automated fetches; this text
  came via a text proxy and matches an independent snippet, but was not read
  from the site directly.*
- **Yelp** — bulk use contractually dead. API Terms §5 bars caching beyond 24
  hours, bars "any scraping or 'bulk download' operations", and bars using the
  content "to update or create your own database of business listing
  information".
- **Angi/HomeAdvisor Canada** = HomeStars. **TrustedPros.ca** claims 61,380
  contractor members; **their ToS could not be located — UNVERIFIED.**

### 6.3 BuildData.ca — the Canadian analogue exists, and it is cheap

The closest Canadian equivalent to Shovels, and the most actionable thing in this
section:

- 17M+ records, **68 Canadian cities**, 4.1M+ building permits, 712K business
  licences.
- **136,000+ contractor profiles**, built by merging permits from 17 cities with
  business licences from 28 cities under one normalised contractor name. Fields
  include normalised name, municipalities, address, province, `is_licensed`,
  `licence_status`, `trade_types`, `permit_count`, `permit_value_total`,
  first/last permit date.
- **No phone or email fields** — the same gap, for the same reason (§6.1).
- Pricing from **$49 CAD/month**; REST API, Snowflake share, bulk export.

**They have already done the work this document was scoping**, across 68 cities
rather than my 11, for $49/month. That is cheaper than one engineering day.
**Their sourcing method and redistribution/commercial terms are not published —
UNVERIFIED, and that is the question to ask them before relying on it.**

---

## 7. The ranking — contactable businesses per week of engineering

"Contactable" means **the source itself carries a phone number**. A row needing
an enrichment pass is not contactable, for reasons `SOURCE-CANADA-PROVINCES.md`
§6 measured (8–10% match, ~7.5% net-correct yield).

| Rank | Source | Businesses | With phone | Weeks | **Contactable / week** |
|---:|---|---:|---:|---:|---:|
| 1 | **Washington L&I** (the bar) | 75,839 | **75,816 (99.97%)** | ~1 | **~75,800** |
| 2 | **Quebec RBQ** (already scoped) | 54,264 | 47,585 (99.99% of active) | ~1 | **~47,600** |
| 3 | **Surrey licences** (prior doc) | 6,798 | 6,798 (100%) | ~0.2 | ~6,800 |
| 4 | **Kitchener permits** (2020+ window) | 746 | **699 (93.7%)** | ~1 | **~700** |
| 5 | **Kitchener permits** (2023+ window) | 332 | **~311 (93.7%)** | ~1 | **~330** |
| — | Calgary permits (all 5 files) | ~15,000 | **0** | ~1.5 | **0** |
| — | Winnipeg permits | ~17,000 | **0** | ~1 | **0** |
| — | Vancouver permits | 4,365 | **0** | ~1 | **0** |
| — | Brampton permits | 550 | **0** | ~1 | **0** |
| — | Surrey permits | ~1,000 | **0** | ~0.5 | **0** |
| — | Victoria permits | ~1,600 | 250 (4.4%, wrong party) | ~1 | **~0** |
| — | Toronto / Edmonton / Ottawa / Mississauga / Hamilton / Halifax / London | 0 usable | **0** | — | **0** |
| — | Ontario / BC / Alberta corporate registries | — | **0** | — | **0** |
| — | WSIB / WorkSafeBC clearance lookups | — | **0** | — | **0** (cannot enumerate) |
| — | Trade associations (CHBA, Landscape Ontario…) | ~9,000 claimed | **unknown** | ≥1 each | **unknown, terms unread** |

**Kitchener, the single best untried source in this entire document, is between
0.4% and 1% of Washington, and shrinking.** The permit angle in aggregate — every populated contractor field
in Canada, roughly 40,000 distinct names across six cities — yields **zero**
contactable businesses directly, and about **3,000** after a multi-week
enrichment build at the measured 7.5% correct-yield. That is still less than 5%
of Washington, for many times the effort.

---

## 8. The verdict, and the three honest options

**Outside Quebec, Canada has no bulk contractor source with contact details.**
The permit angle was worth testing — it disproved the Toronto-is-national
assumption and it found Kitchener — but it does not change the conclusion, and
it explains *why* the conclusion holds: **Canadian permit applications do not
publish contractor contact details, so the input that built BuildZoom, Shovels
and Kukun does not exist here.**

### 8.1 (c) Target the US first — recommended

Washington alone beats every Canadian source outside Quebec combined, times ten,
for the same engineering week. The US has ~50 of these. **This is the
recommendation.** Build Quebec RBQ, build Washington, and revisit Canada when
there is a reason to.

### 8.2 (a) Buy — the only realistic Canadian path, with one question first

**Data Axle Canada** is the only Canadian source found with actual phone
coverage. NextMark datacard, VERIFIED:

- Universe **1,055,829** records, counts through 2026-04-30
- *"Our phone-verified database of the approximately 1.3 million businesses in
  Canada is widely recognized as the nation's most accurate and comprehensive
  database."*
- Base **$75.00/M** (per thousand); **Phone Number +$25.00/M**; SIC Code
  +$10.00/M; Business/Industry Type +$15.00/M. Minimum 10,000 names or $450.
- Name + address + phone + SIC ≈ **CAD $0.11/record**; 75,000 contractor records
  ≈ **$8,250**.
- **Email is not offered as a select.**

**Do not spend money until this is answered.** This is a **list-rental**
datacard — the net-name policy ("85% + $10/M RUNNING CHARGE") and 20% broker
commission are rental artefacts, and rentals are conventionally **one-time-use
with seeded records**. The card carries **no quotable usage or restrictions
clause**. Whether the data may be loaded into a CRM and used repeatedly for
prospecting is **UNVERIFIED**. A one-time-use rental is worth roughly nothing to
us. **One phone call to the listed rep answers it.**

**BuildData.ca at $49 CAD/month** (§6.3) is the cheap complement: 136,000
normalised Canadian contractor profiles with trade types and licence status, no
contacts. Buying it and measuring its overlap with Overture would cost a day and
settle the enrichment question with real data instead of estimates.

### 8.3 (b) Enrich from websites — possible, poor, and now slightly better understood

The one real improvement found: **Vancouver's `buildingcontractoraddress` gives
name + postal code on 22,048 rows**, a stronger match key than the `nameKey|city`
measured at ~7.5% net-correct. Nobody has measured the yield on a postal-code
key. If enrichment is ever built, that is the experiment to run first — but it
should not be built to serve 4,365 Vancouver contractors.

---

## 9. What I did not do, deliberately

- **I downloaded no bulk data.** Every count above is a server-side aggregate
  from the publisher's own API. The two exceptions are stated: 5,227 Kitchener
  rows pulled via the service's paged query to measure phone extraction (the
  measurement cannot be done server-side), and Ottawa's 559 KB monthly workbook,
  read for its column headers and deleted.
- **I scraped nothing, signed up for nothing, bought nothing, submitted no
  form.** HomeStars and Yelp are named as contractually closed and were not
  touched.
- **I did not attempt to bypass any bot detection.** Where a page returned 403 it
  is recorded as a gap, below. I read `robots.txt` on the association and WCB
  sites to establish posture, and collected nothing from any of them.

## 10. What I could not verify

1. **Trade association directories and terms (§5.2).** WSIB and WorkSafeBC are
   settled (lookup-only, no contact data — §5.1). The associations are not.
   Member counts for CHBA and Landscape Ontario come from **secondary sources,
   not from a directory I enumerated**; RenoMark's count was not found; HRAI,
   ECAO, CRCA, MCAC and the provincial roofing/painting bodies were **not
   reached at all**. Critically, **no association's terms of use were
   retrieved**, so whether any permits bulk collection is unknown. `robots.txt`
   permissiveness is not a licence. This is the thinnest track in the document.
2. **Vancouver's Open Government Licence text.** The portal *declares*
   "Open Government Licence – Vancouver", but both `opendata.vancouver.ca/pages/licence/`
   (SPA shell, no text in HTML) and `vancouver.ca/your-government/open-data-licence.aspx`
   (**HTTP 403**) defeated automated retrieval. **Needs a human with a browser.**
   Same gap the previous document recorded.
3. **Calgary's terms of use.** The grant — *"The City grants you a non-exclusive,
   world-wide license to use, modify, and distribute the Data"* for *"any lawful
   Use"* — was read from the **opendefinition.org mirror**, not from
   `data.calgary.ca`, which serves a JavaScript shell. Commercial use appears
   permitted. **Verify against the primary page before relying on it.**
4. **Data Axle's actual usage rights** (§8.2). The single most important open
   question in this document, and the only one gating a spend.
5. **BuildData.ca's sourcing method and redistribution terms** (§6.3).
6. **Whether Ontario's OBR carries NAICS** for unincorporated registrations. The
   primary PDFs returned HTTP 200 but are CID-font-encoded and could not be
   extracted. Moot unless bulk ever becomes available, which it is not.
7. **Alberta's Registry Agent Product Catalogue.** Returns HTTP 200 to curl but
   **520 to WebFetch**, and no PDF text extractor was available. Nothing on
   alberta.ca suggests a bulk product exists, but it was not definitively ruled
   out.
8. **Toronto's own stated reason** for blanking `BUILDER_NAME`. The MFIPPA
   *mechanism* is now sourced from Ottawa (§3); Toronto's specific motive is not.
9. **Why Kitchener's `CONTRACTOR_CONTACT` fill rate collapsed in 2023**
   (43% → 14%). A process change, a permit-system migration and a privacy
   decision are all consistent with the shape. It does not change the verdict,
   but if anyone ever revisits Kitchener this is the first thing to ask the
   city.
10. **TrustedPros.ca terms of use** — not located.
11. **HomeStars ToS** — read via a text proxy because the site 403s. The quoted
    clause matches an independent snippet but was not read from the site.
12. **My city sweep was best-effort on domain names.** I scanned 39 candidate
    portals plus an ArcGIS Online search across 351 permit services; roughly half
    the guessed municipal domains do not resolve. Smaller municipalities may
    publish contractor contacts and not have been reached. Given Kitchener — a
    city of 257,000 — is the only hit in the entire country, the expected value
    of an exhaustive sweep is low, but it is not zero.

---

## 11. Recommended order of work

1. **Build the Quebec RBQ provider.** Unchanged by everything here.
2. **Build Washington.** 75,839 contactable, public domain, three refreshes a
   day — more than every Canadian source outside Quebec combined, times ten.
3. **Make one phone call to Data Axle** and ask whether their Canadian business
   file may be purchased for repeated CRM use rather than one-time rental
   (§8.2). No engineering. It decides whether Canada-outside-Quebec is buyable
   at all.
4. **Spend $49 on BuildData.ca for one month** if Canada is a near-term target.
   136,000 normalised contractor profiles for less than one engineering hour,
   and it settles the enrichment question empirically.
5. **Build nothing else in Canada.** Kitchener is real and clean, and it is
   ~330 businesses on a three-year window with a fill rate that has fallen from
   43% to 17% since 2022. It is not worth a connector under any market
   assumption.

**The honest summary the brief asked for, stated as the brief asked for it:
outside Quebec, Canada has no bulk contractor source with contact details, and
the honest options are (a) buy, (b) enrich from websites, or (c) target the US
first.** The permit angle was the best remaining idea and it was worth an
afternoon — it corrected a false assumption about Toronto, it found the one
Canadian city that publishes contractor phone numbers, and it produced the
explanation for why this whole class of source works in the US and not here.
None of that changes the recommendation.
