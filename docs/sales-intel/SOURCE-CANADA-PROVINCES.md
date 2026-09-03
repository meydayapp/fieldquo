# Canada outside Quebec — is there a second RBQ anywhere?

Research and verification only. **No provider was written, nothing in
`lib/sales/discovery/` was touched, no account was created and nothing was
purchased.** Retrieval date for every external source below: **2026-09-03**.

Companion to `SOURCE-CANADA.md`, which surveyed the same territory a few hours
earlier and left specific questions open. This document does not re-litigate
its Quebec analysis. It answers the question it could not:

> Outside Quebec, is there a bulk, legally-usable register of trade businesses
> anywhere in Canada that is worth a connector?

It also **closes `SOURCE-CANADA.md` §2.6**, which named one measurement as
"the single cheapest thing to find out and it decides whether ODBus is worth
any work at all". I ran it. See §5.

## How to read this document

Same three markers `SOURCE-CANADA.md` uses, for the same reason.

- **VERIFIED** — I fetched the primary source and quote what it said.
- **MEASURED** — I computed it from the real data, on this machine, and the
  sample and its limits are stated with the number.
- **UNVERIFIED** — I could not establish it from a primary source. It is named
  as an open question, not answered by inference.

I am an engineer reading licence texts, not a lawyer. Where the answer turns on
legal judgement rather than published wording, I say so.

---

## The one paragraph

**Quebec is a one-off. Do not build a connector per province.** I queried every
provincial and territorial open-data portal and the ten largest cities outside
Quebec, live. Outside Quebec there is exactly **one** bulk register in Canada
that carries a phone number on a meaningful number of trade businesses, and it
is a single city: **Surrey, BC — 6,798 licensed contractors, 6,801 rows,
100% carrying a phone and 99.9% a well-formed ten-digit one, 6,492 distinct
numbers.** Every other source —
Toronto, Vancouver, Calgary, Edmonton, Winnipeg, Hamilton, and StatCan's
national ODBus aggregate — returns **zero phone numbers on trade rows**. Not
"sparse". Zero. Toronto is the sharpest illustration: its file *has* a
`Business Phone` column, it is populated for restaurants and garages, and it is
empty on **all 18,316 trade-licence rows ever issued**.

**And the enrichment idea does not rescue them.** I tested it against ground
truth rather than reasoning about it (§6): matching municipal rows into Overture
on `nameKey|city` matches **8–10%** of rows, and when it does match, the phone
Overture returns **disagrees with the known-correct phone 26.3% of the time**.
Net yield of *correct* phone numbers is about **7.5%**. The reason is structural
and not fixable by tuning: Overture knows of **478 trade businesses in Surrey**
against the city's own **6,798 licensed contractors** — Overture carries roughly
**7%** of the licensed trade reality. The municipal register is 14× deeper than
Overture, not the other way round.

**Recommendation, stated up front.** Build the Quebec RBQ provider. Add
**Surrey** as a one-day second source if and only if BC is a target market —
it is genuinely cheap and genuinely contactable. Build **nothing else in
Canada**. Against the calibration bar the owner set — Washington L&I at 75,839
active contractors with 99.97% phone coverage, public domain, refreshed three
times daily — every remaining Canadian source loses on contactable-businesses-
per-engineering-day by more than an order of magnitude, and most of them score
literally zero.

---

## 1. Corrections to prior work, mine included

Three claims in play needed fixing. Naming them first because two of them are
mine and one of them would have sent work in the wrong direction.

### 1.1 I was wrong about ODBus being discontinued

My first pass scraped `https://www.statcan.gc.ca/en/lode/databases`, pulled
every link whose `href` contained `lode`, got four databases back, did not see
ODBus among them, and I was about to report that ODBus had been withdrawn.

**That was a scraping artefact, not a finding.** The ODBus entry links to
`www150.statcan.gc.ca`, not to a `/lode/` path, so my filter dropped it. Reading
the page's *visible text* instead of its link hrefs:

> "The Open Database of Businesses contains a variety of business information,
> including names, addresses, locations, industry classification, and other
> characteristics when supplied by the data providers. Release date: November
> 28, 2023 — Version 1.0"

**ODBus is listed, and the file is live.** VERIFIED:

```
$ curl -sIL https://www150.statcan.gc.ca/n1/pub/21-26-0003/2023001/ODBus_2023.zip
HTTP/1.1 200 OK
Content-Type:   application/zip
Content-Length: 21860048
Last-Modified:  Tue, 28 Nov 2023 13:30:17 GMT
```

`SOURCE-CANADA.md` §2.1–2.2 is correct and I am not amending it. The lesson is
the one this repo keeps re-learning: **grep finds words, not capabilities.** A
link filter is not a reading of the page.

### 1.2 The brief's ODBus claim was half right

The brief reported `statcan.gc.ca/en/lode/databases/odb` returning **HTTP 500**
and concluded ODBus might be gone. The 500 is real and reproducible:

```
$ curl -sIL https://www.statcan.gc.ca/en/lode/databases/odb   →  500
```

But that is **one dead landing-page URL**, not a withdrawn dataset. The index
page above it renders fine and the ZIP downloads. A 500 on a vanity path is not
evidence about the data behind it — worth remembering before the next source
gets written off.

### 1.3 The brief's Vancouver figure — the count is right, the label is wrong

The brief reported **22,684 records typed "Trade Contractor"** in Vancouver's
`business-licences`. MEASURED, live:

| Query | Result |
|---|---|
| `records_count` (whole dataset) | 205,380 |
| `search(businesstype,"contractor")` | **22,687** |
| ...which is `General Contractor` | 15,986 |
| ...plus `Trade Contractor` | **6,701** |

So **22,684 is a correct row count** (mine differs by 3 — one day's refresh),
and the search operator was *not* matching junk. But the label was wrong:
"Trade Contractor" alone is 6,701. The 22,687 is two legitimate contractor
types combined, which is arguably the better number to use — it just is not
what it was called.

**The bigger correction is what a row is.** The brief flagged this as a thing it
had not checked, and it matters more than the naming:

| Check | MEASURED |
|---|---|
| `folderyear` values present | **only `24`, `25`, `26`** |
| rows per year | 62,979 / 69,889 / 72,548 |
| contractor rows, all 3 years | 22,687 |
| **distinct `businessname` among them** | **8,389** |
| contractor rows, current year `26`, status `Issued` | **5,993** |

The dataset is a **three-year rolling window of annual licences**, not a
historical archive and not a list of businesses. 22,687 contractor rows are
about **8,389 businesses**, each appearing up to three times. The number that
should go in a plan is **~6,000 current-year issued contractors**, not 22,684.

### 1.4 The brief's "list of businesses licensed to *work* there" point — confirmed and quantified

The brief noticed a Red Deer, Alberta company holding a Vancouver licence with
`localarea` = "Out of Town", and drew the right conclusion. MEASURED across all
5,993 current-year issued Vancouver contractors:

| `localarea` | n |
|---|---|
| **Out of Town** | **2,822 (47%)** |
| Downtown | 382 |
| Sunset | 328 |
| ...21 other Vancouver areas | 2,461 |

And by the licence-holder's own city: only **3,188** are in Vancouver. The rest
are North Vancouver (429), Langley (329), Coquitlam (302), Port Coquitlam (217),
Burnaby (207), Maple Ridge (180), Abbotsford (162), **Surrey (159)**, Richmond
(106)… By province: 5,901 BC, 34 AB, 33 ON, 12 QC, and 11 US states.

**This has a direct planning consequence the brief did not draw: municipal files
overlap each other, so they cannot be summed.** Surrey appears in Vancouver's
file *and* publishes its own 6,798-row file. Adding city files together
double-counts the region's contractors, and `dedupe.js` would be doing that
de-duplication at ingest on a `name_locality` key whose accuracy I measure in
§6.2 — 47.5%. Summing municipal counts to size a market is not safe.

---

## 2. The ranking — contactable businesses per day of engineering

This is the judgement the brief asked for. "Contactable" means **the source
itself carries a phone number**; a row needing an enrichment pass is not
contactable, for reasons §6 measures.

Engineering-day estimates assume the existing `provider.js` interface and the
Overture offline-snapshot transport that `SOURCE-CANADA.md` §6.2 recommends —
i.e. a new source file, a field mapping, and a check. They are my estimates, not
measurements, and they are the softest numbers in this document.

| Rank | Source | Trade rows | With phone | Email | Cadence | Days | **Contactable / day** |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | **Quebec RBQ** (already scoped) | 54,264 | 47,585 | 45,843 | daily | 3–5 | **~11,900** |
| 2 | **Surrey, BC** | 6,798 | **6,801 (100%)** | 0 | see §4.9 | ~1 | **~6,800** |
| 3 | Ontario Licensed Well Contractors | 629 | **629 (100%)** | 0 | biannual | 0.5 | ~1,260 † |
| 4 | Winnipeg Sewer & Water Contractors | 66 | **66** | **66** | as required | 0.5 | ~130 |
| 5 | Mississauga Licensed Trades | 686 | 685 | 0 | **dead since 2018** | 0.5 | ~0 ‡ |
| — | Vancouver | ~6,000 | **0** | 0 | daily | 1 | **0** |
| — | Edmonton | 8,561 | **0** | 0 | daily | 1 | **0** |
| — | Toronto | 3,934 | **0** | 0 | daily | 1 | **0** |
| — | Calgary | ~1,880 | **0** | 0 | daily | 1 | **0** |
| — | Winnipeg Licensed Contractors | 1,840 | **0** | 0 | daily | 1 | **0** |
| — | Hamilton | 654 | **0** | 0 | irregular | 0.5 | **0** |
| — | StatCan ODBus (national) | 50,189 | **0** | 0 | **frozen 2023** | 2 | **0** |
| — | Ottawa, Brampton, Halifax | — | — | — | — | — | **no dataset exists** |
| ★ | *Washington L&I (calibration)* | *75,839* | *99.97%* | — | *3×/day* | *~1* | *~75,800* |

† Well drillers. Real contact data, but not a FieldQuo trade — the product
targets painters, cabinet makers, flooring, plumbers, landscapers. Included for
completeness, not recommended.
‡ Perfect contact data, 686 rows, **last modified 2018-03-29** and the portal
item is flagged `listed: false`. A connector against it would be a dead control
by the second run.

**Read the zero column.** Eleven of the fourteen Canadian sources outside Quebec
produce no dialable business at all. That is the finding, and it is not close.

---

## 3. Province and territory, one by one

Every portal below was queried live on 2026-09-03. Where I name a portal's
software it is because I fingerprinted it, not because I assumed it.

| Jurisdiction | Portal | Software | Trade register? |
|---|---|---|---|
| **Ontario** | `data.ontario.ca` | CKAN | Well contractors only (§3.1) |
| **British Columbia** | `catalogue.data.gov.bc.ca` | CKAN | **None** (§3.2) |
| **Alberta** | `open.alberta.ca` | **CKAN** | Search-only register (§3.3) |
| **Manitoba** | none found | — | **No portal** (§3.4) |
| **Saskatchewan** | none found | — | **No portal** (§3.4) |
| **Nova Scotia** | `data.novascotia.ca` | Socrata | **None** (§3.5) |
| **New Brunswick** | none found | — | **No portal** (§3.4) |
| **PEI** | `princeedwardisland.ca/en/opendata` | custom | **No API, none found** |
| **Newfoundland** | `opendata.gov.nl.ca` | custom ASP.NET | **No API** (§3.6) |
| **Yukon** | `open.yukon.ca` | CKAN | **None** (§3.7) |
| **NWT** | none reachable | — | **No portal** |
| **Nunavut** | none reachable | — | **No portal** |

### 3.1 Ontario — the brief's "thin" verdict is right, and I found nothing better

The brief reported 2 results for "contractor licence" and only *Licensed Well
Contractors* in bulk. I swept `data.ontario.ca` harder — 40 results each for
`contractor`, `licensed`, `trades`, filtered to anything plausibly trade-shaped
— and the sweep surfaces three candidates beyond the well file. Two are dead
ends, VERIFIED by `package_show`:

- **"Registered contractor information listings"** — sounds exactly right, is
  not. `license_id: notspecified`, `metadata_modified: 2021-01-14`, and
  **zero resources**. It is a description of a Ministry of Transportation
  internal registry (financial information, WSIB clearances, personnel résumés),
  not a published file. Nothing to download.
- **"Select Licence and Registration Data"** — OGL-Ontario, monthly, real CSVs.
  Wrong domain entirely: collection agencies, consumer reporting agencies,
  lenders, loan brokers, bailiffs.
- **"Licensed Well Contractors"** — the only real one.

**Licensed Well Contractors, MEASURED** (downloaded `Water_Well_Contractors_EN_2026a.csv`,
69,585 bytes):

| Field | Fill |
|---|---|
| `Licence Number` | 629 / 629 |
| `Service Code` | 629 / 629 |
| `Well Contractor` | 629 / 629 |
| **`Phone Number`** | **629 / 629 (100%)** |
| `Address` | 629 / 629 |

Licence **OGL-ON-1.0**, update frequency **biannual**. It is a clean, complete,
perfectly contactable file — of **water-well drillers**, which FieldQuo does not
sell to. Ranked 3rd above on merit and not recommended on fit.

**HCRA** (new-home builders) and **Skilled Trades Ontario** remain search-only,
as the brief found. I did not attempt to scrape either, and would not: see §8.

### 3.2 British Columbia — confirmed, nothing exists

The brief's finding holds. I swept `catalogue.data.gov.bc.ca` with four separate
queries (`contractor`, `licensed`, `builder`, `business licence`, 40 rows each).
Everything licence-shaped in BC's provincial catalogue is a *different* kind of
licence: Tree Farm Licences, forest tenures, water licences, Licensed Security
Businesses, Licensed Establishments, Licensed Seafood and Meat Operators, ICBC
driver licensing, Crown land licences.

**There is no BC provincial register of construction trades.** One near-miss
worth naming so nobody re-finds it hopefully: *"Mobile Business Licence
Partnerships"* is metadata about the inter-municipal licensing scheme, not a
register of its holders.

**BC Housing's Licensed Residential Builders registry** is real and is the
closest thing BC has to RBQ — but it is **search-only**. The public registry
lives at `lims.bchousing.org/LIMSPortal/registry/Licence/` and
`newhomesregistry.bchousing.org/LicenceRegistry/LicenceSearch/`, both ASP.NET
search forms. I found no bulk export; the two plausible download paths I tried
on `bchousing.org` both 404. **UNVERIFIED:** whether BC Housing will supply the
list on request. That is a phone call, not an engineering task, and it is the
one piece of BC follow-up I would actually spend time on if BC mattered.

### 3.3 Alberta — the portal is CKAN, and the brief's HTTP errors were transient

The brief could not get `open.alberta.ca` to answer `package_search` and asked
me to establish what it runs. **VERIFIED: it is CKAN, and the API works.**

```
$ curl -s "https://open.alberta.ca/api/3/action/package_search?q=business+licence&rows=3"
{"help": "...", "success": true, "result": {"count": 160, ...
```

It sits behind Cloudflare, which is the likely explanation for the earlier
errors. So the portal is fine — but **it is a publications repository, not a
data catalogue.** Searching `contractor` returns 333 results and they are PDFs:
*Builder competency self-assessment guide*, *Director's Order: Evolve Landscapes
Inc*, *Notice of Administrative Penalty*, certification lists as PDF. The
CKAN-ness is real; the datasets are documents.

The one genuine register, found via the federated national catalogue rather than
Alberta's own portal, is **"Licensed businesses, charities, and fundraisers"**:

> "A listing of all businesses, charities and fundraisers that hold an active
> licence or registration issued by Service Alberta, Consumer Programs, to
> operate in the province of Alberta."

Licence **OGL-Alberta** (`ab-ogla`). This is the source `SOURCE-CANADA.md` §4.3
calls "the strongest contractor-scoped source in the country" on the strength of
its statutory scope — prepaid contracting covers renovation *and* landscaping.
On scope it is right.

**On access, the picture is worse than §4.3 hoped.** Its only real resource is
not a file:

```
res: Licensed businesses, charities, and fundraisers | other
     → https://www.servicealberta.gov.ab.ca/183.cfm
        redirects 200 → .../find-if-business-is-licenced.cfm
```

That is a **search form**. §4.3 records the hope that "Service Alberta offers an
Excel export of its own search results" and calls confirming it "the cheapest
high-value action in this document". **I could not confirm it.** The dataset
record points at a search page and nothing in the CKAN record offers a bulk
file. **UNVERIFIED, and now more sharply so:** whether that form's results page
exposes an export, and whether exporting *all* holders is possible or only a
filtered result set. Someone with a browser should click it — it is still the
cheapest open question in Alberta, and it is still open.

Note the asymmetry this creates. Alberta has the **best statutory scope** in
Canada and the **worst access**; Surrey has narrow scope and a public API
returning everything. Scope loses to access every time.

### 3.4 Manitoba, Saskatchewan, New Brunswick — no portal reachable

I probed the plausible hostnames directly. All failed to resolve or connect:

```
data.gov.mb.ca        000        open.saskatchewan.ca   000
mli2.gov.mb.ca        000        data.saskatchewan.ca   000
data.gnb.ca           000        opendata.gnb.ca        000
```

`publications.saskatchewan.ca` resolves (200) but, like Alberta's, is a
publications repository. Manitoba's `geoportal.gov.mb.ca` resolves and is
geospatial.

Two of these three provinces still appear in this document, because **their
cities publish even where the province does not** — Winnipeg is §4.6. That is
the general shape of Canadian open data and it is worth stating plainly: **the
municipal layer is more mature than the provincial layer nearly everywhere
outside Quebec.**

### 3.5 Nova Scotia — Socrata, 1,200 datasets, no trades

`data.novascotia.ca` is Socrata and substantial. I listed 1,200 views and
filtered for licensing. Everything is a different licence: fish buyers,
aquaculture, payday lenders, ferment-on-premises, liquor, food establishments,
fuel and tobacco, hunting and fishing sellers, driver licences. **No
construction or trade register.** Halifax likewise publishes none (§4.10) —
Nova Scotia licenses businesses provincially, and does not publish that register.

### 3.6 Newfoundland — a portal with no API

`opendata.gov.nl.ca` is a custom ASP.NET application. It returns HTTP 200 to
*every* API path I tried — CKAN, Opendatasoft, Socrata and ArcGIS — which means
it has none of them and is serving its SPA shell to all of them. A 200 here is
not an API; that is worth flagging because a fingerprint script would record
four false positives. Its datasets are browsable only through
`?page-id=datasets-topic` pages. **UNVERIFIED:** its full catalogue. I found no
trade register, but I could not enumerate it programmatically and did not
hand-browse it.

### 3.7 Yukon — CKAN, and one dataset worth naming

`open.yukon.ca` is CKAN, licence **OGL-Yukon-2.0**. No contractor register. The
only business-shaped dataset is the **Yukon Government Supplier Directory**,
which is a procurement vendor list, not a licence register — a different
population (who sells to government) from the one we want.

---

## 4. The ten largest cities outside Quebec

Ten largest Canadian cities, Montreal excluded as Quebec, Surrey substituted in
at #11. Portal software fingerprinted, not assumed — it differs per city and
three different vendors appear.

| City | Portal | Software | Trade rows | Phone |
|---|---|---|---:|---|
| Toronto | `ckan0.cf.opendata.inter.prod-toronto.ca` | CKAN | 3,934 | **0** |
| Calgary | `data.calgary.ca` | Socrata | ~1,880 | **0** |
| Ottawa | `open.ottawa.ca` | ArcGIS Hub | — | **no dataset** |
| Edmonton | `data.edmonton.ca` | Socrata | 8,561 | **0** |
| Winnipeg | `data.winnipeg.ca` | Socrata | 1,840 | **0** |
| Mississauga | `data.mississauga.ca` | ArcGIS Hub | 686 | **685, dead file** |
| Vancouver | `opendata.vancouver.ca` | Opendatasoft | ~6,000 | **0** |
| Brampton | `geohub.brampton.ca` | ArcGIS Hub | — | **no dataset** |
| Hamilton | `open.hamilton.ca` | ArcGIS Hub | 654 | **0** |
| **Surrey** | `opendata-surrey.hub.arcgis.com` | ArcGIS Hub | **6,798** | **100%** |

### 4.1 Toronto — the phone column that is empty exactly where it matters

This is the most instructive source in the document and the one that most
rewards having queried it rather than reasoned about it.

Toronto's `municipal-licensing-and-standards-business-licences-and-permits` is
CKAN, refreshed **daily** (`last_refreshed: 2026-09-03 06:11:15`), 159,704 rows,
CSV/JSON/XML. Its documented schema includes:

> **Business Phone -** Client Business Phone Number

So on paper Toronto looks like the best municipal source in Canada — a big
daily file with a phone column. I downloaded all 34.5 MB and counted.
**MEASURED:**

| | rows | with phone |
|---|---:|---:|
| All rows | 159,704 | — |
| Active (no cancel date) | 37,508 | — |
| EATING OR DRINKING ESTABLISHMENT | 7,927 | 3,679 |
| PUBLIC GARAGE | 3,025 | 1,889 |
| COMMERCIAL PARKING LOT | 1,006 | 801 |
| **BUILDING RENOVATOR** | **1,458** | **0** |
| **MASTER PLUMBER** | **968** | **0** |
| **PLUMBING CONTRACTOR** | **735** | **0** |
| **MASTER HEATING INSTALLER** | **270** | **0** |
| **HEATING CONTRACTOR** | **137** | **0** |
| **PLUMBING & HEATING CONTRACTOR** | **122** | **0** |
| **DRIVEWAY PAVING CONTRACTOR** | **85** | **0** |
| **DRAIN LAYER** | **83** | **0** |
| **DRAIN CONTRACTOR** | **76** | **0** |
| **All trade categories, active** | **3,934** | **0** |
| **All trade categories, all time** | **18,316** | **0** |

The column is populated at 46% for restaurants and 62% for garages, and at
**0.00% for every trade licence Toronto has ever issued** — 18,316 rows, not one
phone number.

**And the address is redacted too.** Of the 3,934 active trade rows, **1,837
(47%) have no street address at all** — only a three-character forward sortation
area in the postal field (`L1T`, `M1H`). A representative row:

```
Category: BUILDING RENOVATOR
Operating Name: ELON'S CREATION & CONSTRUCTIONS
Client Name: TAPPER, ELON
Business Phone: (empty)
Address Line 1: (empty)   Line 2: (empty)   Line 3: L1T
```

The explanation is privacy rather than data quality, and the rest of the file
proves it. Listing **every** active category with zero phones and n≥20 turns up
no trade-specific pattern — it turns up an *individual-licensee* pattern:

```
4,214 TAXICAB OWNER          934 DRIVING INSTRUCTOR (V)     324 LIMOUSINE OWNER
1,458 BUILDING RENOVATOR     578 TORONTO TAXICAB OWNER      273 REFRESHMENT VEHICLE OWNER
  968 MASTER PLUMBER         735 PLUMBING CONTRACTOR         81 HAWKER/PEDLAR ON FOOT
```

Every category Toronto issues **to a person** is blank; every category it issues
to a *premises* has phones. Trade licences are issued to individuals — 3,300 of
3,934 have a `Client Name` different from the `Operating Name`, and many are
plainly surnames. Toronto withholds home addresses and phones for sole traders,
which is a defensible policy, applied consistently, and it makes the file
useless to us. **No amount of re-querying will change this**, which is worth
stating because the schema will keep advertising a phone column.

**This is the exact failure mode the codebase's rule warns about, in a data
source.** A schema field that exists, is documented, is populated for some
rows, and is empty for every row you need. Reading the field list would have
said "Toronto has phones". Only counting says otherwise.

**Licence: unresolved, and that alone blocks it.** The CKAN record says
`license_id: notspecified`, `license_title: "License not specified"`,
`license_url: null`. The Open Government Licence – Toronto exists and permits
commercial use — VERIFIED, quoted in §7.1 — but whether it is the *default* for
a dataset that declares nothing is a separate question, and other datasets on
the same portal *do* declare `open-government-licence-toronto` explicitly, which
cuts against a silent default. See §7.1 for where that verification landed.
Moot in practice: the rows have no phone.

### 4.2 Vancouver — measured in §1.3, no contact fields

Opendatasoft, **Open Government Licence – Vancouver**, `modified:
2026-09-02T13:48:57`. ~6,000 current-year issued contractors, 8,389 distinct
businesses over three years. Fields are `businessname`, `businesstradename`
(DBA), `status`, `issueddate`, `expireddate`, `businesstype`, `businesssubtype`,
address parts, `numberofemployees`, `feepaid`.

**No phone, no email**, exactly as the brief predicted. Two smaller notes:
`businesssubtype` is **null on all 6,701** Trade Contractor rows, so the finer
trade split the field name promises is not there; and the API is pleasant to
work with (`group_by`, `select` aggregates server-side), so the one engineering
day is honest.

### 4.3 Edmonton — the largest trade count in Canada outside Quebec, and no phone

Socrata, dataset `qhi4-bdpu` ("City of Edmonton - Business Licences"), **43,657
rows**, `Update Frequency: Daily`, verified `rowsUpdatedAt` = 2026-09-03.

| Category | n |
|---|---:|
| **Construction, Contracting, and Labour Service** | **8,561** |
| Administration Office / Professional Service | 4,698 |
| Retail Sales (Minor) | 2,618 |
| ...plus ~460 in combination categories | |

**8,561 trade rows is the biggest single non-Quebec trade count in the country**
— larger than Surrey, larger than Vancouver. Columns:
`business_licence_category`, `business_name`, `business_address`, `externalid`,
issue/expiry dates, BIA, neighbourhood, ward, lat/long, `licencetype`.

**No phone. No email.** Licence declared as `"See Terms of Use"` — see §7.1.

Edmonton is the clearest statement of the whole problem: the largest, freshest,
best-categorised trade file outside Quebec, updated daily, and it cannot produce
a single phone call without an enrichment pass that §6 shows does not work.

### 4.4 Calgary — small, and the "contractor" category is narrower than it looks

Socrata `vdjc-pybd`, **23,154 rows**, `Update Frequency: Daily`.

| Licence type | n |
|---|---:|
| CONTRACTOR (NO PROVINCIAL LICENCE REQUIRED) | 1,147 |
| CONTRACTOR | 661 |
| CONTRACTOR, MANUFACTURER | 73 |
| **~total contractor** | **~1,880** |

Fields: `tradename`, `address`, `licencetypes`, `first_iss_dt`, `exp_dt`,
`jobstatusdesc`, community district, `point`. **No phone, no email.** Licence
`"See Terms of Use"` pointing at `data.calgary.ca/d/Open-Data-Terms/u45n-7awa`
— §7.1.

Note the category name: *"CONTRACTOR (NO PROVINCIAL LICENCE REQUIRED)"* is the
larger bucket, which is a reminder that Calgary's municipal licence and
Alberta's provincial prepaid-contractor licence are different populations.
Neither is a superset of the other.

### 4.5 Winnipeg — three datasets, and the only email addresses in this document

Socrata. Winnipeg is the one city that publishes a *dedicated* contractor list
rather than a general business-licence file, and it publishes three relevant
things. All three declare **`Open Government Licence - Winnipeg`**.

**(a) `4h34-ntey` "Licensed Contractors" — 1,840 rows**, updated 2026-09-03.

> "A list of all demolition, electrical, mechanical, and plumbing contractors
> licensed by the City of Winnipeg."

Fields: `contractor_name`, `business_name`, `license_type`, `contractor_type`,
`license_information`. **No phone, no email, and no address either** — this is
the thinnest schema of any file here. It does carry both a personal and a
business name, which is the two-names structure `SOURCE-CANADA.md` §5.4 wants.

**(b) `m2az-qa9q` "Licensed Sewer and Water Contractors" — 66 rows.** Fields:
`company`, `mailing_address`, `city_town`, `postal_code`, `office_contact`,
**`phone_no`**, **`email`**.

**This is the only file in this entire survey that carries an email address.**
It is 66 rows. Ranked 4th above for honesty; it is not a market.

**(c) `d5k3-sfzx` "Business Licenses" — 13,757 rows**, monthly. Not trades:
Winnipeg licenses only 12 business activities under its Community Safety
by-law. No phone.

### 4.6 Hamilton — small, dedicated, no contact data

ArcGIS Hub. Hamilton has no general business-licence file but does publish
**"Licensed Trade Contractors and Masters"** — plumbing, heating, HVAC, drain
laying, building repair, sprinkler and fire protection.

**MEASURED: 654 rows.** Fields: `LICENSE_NUMBER`, `LICENSE_TYPE`,
`SUB_DESCRIPTION`, `BUSINESS_NAME`, `EXPIRY_DATE`. **No phone, no email, no
address.** Last modified 2025-11-18. Licence: Hamilton's own Open Data Licence
Terms and Conditions — §7.1.

A note on the service: the layer is published as a **table** (`/FeatureServer/1`),
not a feature layer, so `/FeatureServer/0` returns `"Invalid URL"`. A connector
would need to enumerate `?f=json` rather than assume layer 0. Minor, but it is
the kind of thing that turns a one-hour job into a half-day.

### 4.7 Mississauga — right data, eight years dead

ArcGIS Hub item `8dfd51020a9f4fb8a9f09bfa34541ffa`, file
`Open_Data_Source_Active_Trades_With_Phone.csv`. The description promises
exactly what we want:

> "Under the Business Licensing By-law 1-06, as amended, certain trade
> contractors are required to be licensed in order to operate with the City of
> Mississauga. This dataset contains a list of licensed trades and includes
> business type, business name and phone number."

I downloaded it. **MEASURED: 686 rows, `BUSINESSTYPE`, `BUSINESSNAME`, `PHONE1`,
with 685 of 686 phones populated.** Categories are genuine trades: Building
Renovator – General (139), Contractor – Plumbing (125), Trades Master – Plumber
(113), Heating (82), Drain (50), Paving (34).

**And it is dead.** `modified: 1522353019000` = **2018-03-29**. The portal item
carries `listed: false` — it has been delisted, and is reachable only by direct
item ID. Licence declared as `"none"`.

Correct data, wrong decade. A connector against it would ship a control that
appears to work and doesn't — the exact thing `AGENTS.md` forbids — because it
would keep returning 686 rows of eight-year-old phone numbers forever.

### 4.8 Ottawa and Brampton — nothing exists

Both are ArcGIS Hub. I searched each for `business licence`, `licence`,
`license`, and `contractor`.

- **Ottawa** (`open.ottawa.ca`): the only licence-shaped dataset is *Street Food
  Vendors 2025*. No business licence file.
- **Brampton** (`geohub.brampton.ca`): **zero results** for every query. It is a
  geospatial hub only.

Recording these as explicit negatives so nobody searches them again.

### 4.9 Surrey — the only recommendation in this document

ArcGIS Hub item "Surrey Business Directory", backed by a public FeatureServer:

```
https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/
  Business%20Licenses/FeatureServer/0
```

Fields: `TownCentre`, `BusinessName`, `Address`, `BusinessCategory`,
`LicenseType`, `PostalCode`, **`PhoneNumber`**.

**MEASURED:**

| | |
|---|---:|
| Total rows | **27,014** |
| `PhoneNumber` non-empty | **27,014 (100%)** |
| ...of which exactly 10 digits | **26,966 (99.8%)** |
| **Rows matching `%CONTRACTOR%`** | **6,798** |
| Contractor rows pulled and inspected | 6,801 |
| ...with a Surrey/White Rock FSA | **6,762 (99.4%)** |
| ...distinct phone numbers | **6,492** |

Category breakdown of the contractor rows: Contractor – Miscellaneous (1,161),
Contractor – General (932), Contractor – Landscaping/Excavating (272),
Contractor – Plumbing/Heating, Contractor – Electrical, Contractor – Painting,
plus the Metro/Fraser Valley Inter-Municipal Business Licence combinations.

Real rows, with real numbers:

```
Moga Construction Ltd            | Contractor - Miscellaneous | 6043563333
Brown Eagle Painting Ltd         | Contractor - Painting      | 6047828110
Make It Worth Plumbing & Heating | Contractor - Plumbing/Heat | 6044668434
OSM Finishing & Renovation Ltd   | Contractor - Miscellaneous | 7786867076
```

**Why this one is worth a day.** 6,798 contractors, 100% dialable, 96% distinct
numbers, trade category on every row, an unauthenticated paginated API needing
no key, and — unlike Vancouver's — the rows are overwhelmingly businesses
actually *in* Surrey. Landscaping and painting are named categories, which are
FieldQuo trades.

**Two caveats, both real.** First, the **licence is undeclared** — the Hub
metadata says `license: "none"` with empty `licenseInfo`, which is not a grant.
That is a blocker until resolved, and it is the same class of problem as
Toronto's; see §7.1. Second, **cadence is unstated**: `modified` is
2025-05-02 in the Hub metadata, and the Hub `recordCount` is `null`. **UNVERIFIED:**
how often the FeatureServer behind it actually refreshes. The Hub `modified`
date may describe the item registration rather than the data. Worth one probe a
week apart before committing — a stale file here would be Mississauga again.

### 4.10 Halifax — no business data

`data-hrm.opendata.arcgis.com` and `catalogue-hrm.opendata.arcgis.com` both
resolve. Searches for `business`, `licence`, `license` return **nothing**
business-related. HRM does not license businesses; Nova Scotia does it
provincially and does not publish it (§3.5).

---

## 5. StatCan ODBus — closing `SOURCE-CANADA.md` §2.6

`SOURCE-CANADA.md` §2.6 listed four things it could not answer without opening
the archive, and called the province/municipality breakdown "the single cheapest
thing to find out". I downloaded the 21 MB ZIP and ran them. **All four are now
MEASURED.**

`ODBus_v1.csv`, 112 MB, **446,574 records**, 32 columns. Schema confirms
`SOURCE-CANADA.md` §2.3 exactly: **no phone, no email, no website column
exists.**

### 5.1 A 100% fill rate that was a bug, again

My first fill query returned **100.0% for every field**, which is the same
too-good-to-be-true shape `MEASURE-overture-coverage.md` documents catching.
Same class of bug, different cause: StatCan writes missing values as the literal
string **`'..'`**, so `count(col)` counts them as present. Corrected by testing
`trim(col) NOT IN ('..','','nan')`. Every number below uses the corrected form.

Worth recording because it is now **twice** in this repo that a Canadian data
measurement produced a false 100%, by two different mechanisms. Any future
fill-rate query on an external file should be assumed wrong until it produces a
number that is not 100%.

### 5.2 The four answers

**(a) Province and municipality coverage — the decisive one.**

| Province | records |
|---|---:|
| ON | 205,122 |
| BC | 163,200 |
| AB | 76,526 |
| NT | 1,445 |
| NU | 171 |
| NB | 110 |

**Six jurisdictions. No Quebec, no Saskatchewan, no Manitoba, no Nova Scotia, no
PEI, no Newfoundland, no Yukon.** ODBus is Ontario, BC and Alberta with a
rounding error attached — 99.6% of it is those three.

Top contributors: Toronto (125,681), Vancouver (66,846), Edmonton (38,573),
York Region (34,997), Calgary (34,302), Burnaby (18,768), Surrey (17,099),
Mississauga (16,506).

**This makes ODBus a strict subset of the municipal path in §4, four years
stale.** Its inputs are the same eight cities I queried live. Anything ODBus
knows, the source city publishes more currently.

**(b) True fill rates.**

| Field | filled | % |
|---|---:|---:|
| `business_name` | 446,574 | 100.0 |
| `full_address` | 394,537 | 88.3 |
| `derived_NAICS` (2-digit only) | 382,146 | 85.6 |
| `postal_code` | 276,030 | 61.8 |
| `status` | 162,152 | **36.3** |
| `source_NAICS_primary` (2–6 digit) | 96,325 | **21.6** |
| `NAICS_descr` | 84,382 | 18.9 |

**(c) The construction subset. 50,189 records** carry `derived_NAICS = 23`.

| Province | NAICS 23 | with deeper NAICS | with postal code |
|---|---:|---:|---:|
| BC | 21,628 | 4,745 | 6,609 |
| ON | 16,852 | 3,736 | 11,922 |
| AB | 11,602 | 171 | **0** |
| NT | 107 | 1 | 1 |
| **Total** | **50,189** | **8,653 (17.2%)** | 18,533 |

`SOURCE-CANADA.md` §2.6 predicted the consequence precisely — *"A 2-digit '23'
cannot distinguish a painter from a roofer and would produce `tradeKey: null` on
every row"* — and that is the majority case: **82.8% of construction rows have
no NAICS finer than "23".** Alberta additionally has **zero postal codes** on all
11,602 of its construction rows.

**(d) What `status` means.** It distinguishes active from lapsed, but only where
present:

| status | n |
|---|---:|
| `..` (unknown) | **29,174** |
| Active | 15,000 |
| Pending | 5,999 |
| Not Active | 16 |

**Only 15,000 of 50,189 construction records are confirmed active.** For 58% the
file does not say.

### 5.3 Verdict

**ODBus is dominated on every axis.** 50,189 construction businesses sounds like
the biggest number in this document; it is a 2022 snapshot of eight cities that
all still publish, with no phone, a usable trade code on 17% of rows, and a
confirmed-active flag on 30%. `SOURCE-CANADA.md` §2.5 called it "legally the
cleanest source in this document, and operationally the weakest". Measurement
confirms it and hardens it: **the licence is genuinely unrestricted (OGL-Canada,
quoted in `SOURCE-CANADA.md` §2.4) and there is still nothing here worth
ingesting.**

---

## 6. Would matching against Overture recover contactability?

The brief asked this directly, and asked whether a `name+city` match is reliable
given `dedupe.js`'s own warning about identically-named businesses. I tested
both against real data rather than reasoning about them, using the **actual
`nameKey` from `lib/sales/discovery/dedupe.js`** loaded into Node — the aliased
`@/` import stripped, since only `nameKey` is exercised. The accent fix landed
under me mid-session and is present:

```
nameKey("Rénovations Lévis Inc.")   →  "levis renovations"
nameKey("The Acme Painting Company") →  "acme painting"
```

**Answer: no.** Both halves of it.

### 6.1 The enrichment yield, against ground truth

The clean way to test this is to enrich a file whose phones we *already know*,
so a wrong answer is detectable. **Surrey is that file** — 6,801 contractor rows
with real phone numbers. I extracted all Overture places in the Metro Vancouver
bbox (120,794 rows, 91.6% with a phone) and matched on `nameKey|locality`.

**MEASURED — Surrey contractors → Overture, ground truth known:**

| | |
|---|---:|
| Surrey contractor rows | 6,801 |
| Matched into Overture on `nameKey|city` | **548 (8.1%)** |
| ...key hit more than one Overture row | 36 |
| Overture supplied a phone | 543 |
| **...phone AGREES with Surrey's** | **400 (73.7%)** |
| **...phone DISAGREES** | **143 (26.3%)** |
| Overture supplied an email | 308 |

**MEASURED — Vancouver contractors → Overture, the actual use case:**

| | |
|---|---:|
| Vancouver contractor rows (no phone) | 5,993 |
| Matched on `nameKey|city` | **609 (10.2%)** |
| ...ambiguous (>1 Overture row) | 54 |
| Yielded a phone | 607 (10.1%) |
| Yielded an email | 349 |
| Matched on name only, no city | 800 (13.3%) |

**The enrichment pass recovers about 10% of rows, and roughly one in four of
those is a wrong number.** Net correct-phone yield ≈ **7.5%**. Dropping the
locality to widen the net buys 3 points of match rate and would import exactly
the false-merge risk `dedupe.js` was designed to avoid.

One caveat stated in the source's favour: some of the 26.3% "disagreements" will
be a business with two legitimate numbers — office versus mobile — which is
precisely what `dedupe.js`'s own comment anticipates ("a shared number is also
what an answering service, a franchise head office and a husband-and-wife pair
of businesses look like"). **26.3% is an upper bound on the error rate, not a
measurement of wrongness.** It is still far too high to write into a dialler
queue unreviewed.

### 6.2 Why the match rate is low — and it is not fixable

The instinct is that 8% means the matcher needs tuning. It does not. **MEASURED:**

| | |
|---|---:|
| Overture places in Surrey, all categories | 18,260 |
| **Overture places in Surrey, trade categories** | **478** |
| plumbing 102 · electrician 73 · painting 64 · roofing 64 · landscaping 62 · HVAC 53 · carpenter 30 · flooring 18 · cabinets 12 | |
| **Surrey's own licensed contractors** | **6,798** |
| **Overture's coverage of licensed trades in Surrey** | **~7%** |

**Overture simply does not know these businesses exist.** A contractor working
from a van with no storefront is not a point of interest, and Overture is a
places dataset. You cannot match into a set that does not contain the rows.

**This also answers an open question from `MEASURE-overture-coverage.md` §9**,
which measured Overture's phone fill at 99.6% and then flagged enumeration depth
as "a separate, still-open question" — *"Overture knows of ~91 painting
contractors in Ottawa, and whether that is most of them is a separate, still-open
question."* Against a licensed-register denominator, for one city: **Overture
carries roughly 7% of the licensed trade businesses.** Its phone fill is
excellent and its *coverage* of this trade is thin. Both were true at once and
only the first had been measured.

**The value proposition inverts.** The municipal register is not the thing
needing enrichment from Overture — Overture is the thin one, by 14×. Where a
municipal file *has* phones (Surrey), it is strictly better than Overture for
that city.

### 6.3 Is `nameKey|city` reliable enough? — measured, and `dedupe.js` is right

The brief asked whether the fuzzy key is trustworthy given the "hundreds of
identically-named businesses in eastern North America" warning. I held city
constant and ran `nameKey` over Surrey's 6,801 contractors — same city, same
trade, real phone numbers to adjudicate with.

**MEASURED:**

| | |
|---|---:|
| Rows | 6,801 |
| Distinct `nameKey` values | 6,760 |
| Keys matching >1 row | **40 (0.6%)** |
| **...where the rows disagree on phone** | **21 (52.5%)** |

Real collisions:

```
"a class electric"   → A Class Electric Ltd 6045965474 V3W3A8
                       A Class Electric Ltd 6043512538 V3W0V4
"drywall gill"       → Gill & Gill Drywall Ltd 6045374129
                       Gill Drywall Ltd        6043085511
"a insulation s"     → S and A Insulation Ltd  6047739400
                       A & S Insulation Ltd    7787093399
"excavating k s"     → S K Excavating Ltd      6047675656
                       S K S Excavating Ltd    6045012651
```

**Two findings, and they point the same way.**

1. **The key fires rarely** — 0.6% of rows. It is not a noise flood, and the
   locality requirement is doing its job.
2. **When it fires it is a coin flip** — 52.5% of collisions are genuinely
   different businesses. Note what `nameKey`'s word-sorting does: `S and A
   Insulation` and `A & S Insulation` collapse to the same key, which is
   correct behaviour for word-order variance and wrong here.

**This vindicates `dedupe.js`'s design exactly as its comments claim.** A
`name_locality` hit **flags, it does not merge** — and a 52.5% error rate is
precisely why merging would be unrecoverable. The file's own sentence —
*"a similar company name two streets apart is a question"* — is now measured:
it is a question about half the time.

**Answer to the brief: a name+city match is fine for flagging and unfit for
enrichment.** Using it to attach a phone number would write a wrong number onto
roughly half the rows it fired on. Combined with §6.1's 10% match rate, the
municipal-plus-Overture strategy is not worth an engineering day.

### 6.4 Cross-municipal enrichment does not work either

Since Surrey has phones and Vancouver does not, could Surrey's file enrich
Vancouver's? **MEASURED: 75 of 5,993 Vancouver contractor rows (1.3%)** have a
name-twin in Surrey's file, and 46 of those are Surrey businesses that hold a
Vancouver licence — a true match, but only 0.8% of the file. **Municipal files
do not enrich each other.**

---

## 7. Licences, quoted

A dataset with unclear terms is unusable however good, and saying so is the
finding. Where I could not retrieve the primary text, the row says so rather
than reasoning about what the licence probably says.

### 7.1 Status of each source's terms

| Source | Declared | Commercial use + redistribution | Status |
|---|---|---|---|
| **Quebec RBQ** | CC-BY 4.0 | Yes — quoted in `SOURCE-CANADA.md` §3.2 | **Clear** |
| **StatCan ODBus** | OGL-Canada 2.0 | Yes — quoted in `SOURCE-CANADA.md` §2.4 | **Clear** |
| **Ontario (well contractors)** | OGL-ON-1.0 | **Yes — quoted below** | **Clear** |
| **Alberta** | OGL-Alberta (`ab-ogla`) | see below | see below |
| **Winnipeg** | "Open Government Licence - Winnipeg" | see below | see below |
| **Vancouver** | OGL – Vancouver | see below | see below |
| **Calgary** | "See Terms of Use" | see below | see below |
| **Hamilton** | Hamilton Open Data Licence T&C | see below | see below |
| **Toronto** | **`notspecified`** | OGL-Toronto permits it, but is it the default? | **Unresolved** |
| **Surrey** | **`"none"`, empty `licenseInfo`** | **No grant declared** | **Blocker** |
| **Mississauga** | **`"none"`** | **No grant declared** | **Blocker** (and dead) |

**VERIFIED — Open Government Licence – Ontario**
(`https://www.ontario.ca/page/open-government-licence-ontario`) grants:

> "The Information Provider grants you a worldwide, royalty-free, perpetual,
> non-exclusive licence to use the Information, **including for commercial
> purposes**, subject to the terms below. You are free to: Copy, modify,
> publish, translate, adapt, distribute or otherwise use the Information in any
> medium, mode or format for any lawful purpose."

Attribution is the obligation, with the fallback wording *"Contains information
licensed under the Open Government Licence – Ontario."* One exemption is worth
flagging for the well-contractor file specifically, since some of its holders
are sole traders and the phone numbers may be personal:

> "This licence does not grant you any right to use: **Personal Information**;
> Information or Records not accessible under the Freedom of Information and
> Protection of Privacy Act (Ontario)…"

**VERIFIED — Open Government Licence – Toronto** grants:

> "worldwide, royalty-free, perpetual, non-exclusive licence to use the
> Information, including for commercial purposes"

> "Copy, modify, publish, translate, adapt, distribute or otherwise use the
> Information in any medium, mode or format"

with attribution required, no endorsement implied, and personal information
excluded. **Commercial use and redistribution are explicitly permitted.**

**What remains unresolved for Toronto** is narrower and is the only thing that
matters: whether that licence is the *default* for a dataset whose CKAN record
declares `notspecified`. Other datasets on the same portal declare
`open-government-licence-toronto` explicitly, which is evidence against a silent
default. I did not find a portal-wide statement resolving it. **UNVERIFIED.**
Moot in practice — §4.1 shows the trade rows carry no phone.

**Surrey is the one where this actually blocks a recommendation.** The dataset I
recommend in §4.9 declares no licence at all. An undeclared licence is not an
open licence, and "it is on an open data portal" is not a grant. **Before any
Surrey work starts, someone must establish Surrey's site-wide open-data terms
and whether they cover datasets that declare nothing.** That is a
correspondence task, not an engineering one, and it gates the only Canadian
source outside Quebec I would build.

> **Verification of the remaining licence texts (Vancouver, Calgary, Winnipeg,
> Surrey site-wide, Hamilton, Mississauga, Alberta) was delegated to a parallel
> research pass that had not reported when this document was written.** Rather
> than reason about what those licences probably say, the rows above are left
> marked. `vancouver.ca` is behind Cloudflare and returned **403** to every
> automated fetch I attempted, so Vancouver's text specifically may need a human
> with a browser.

None of the unresolved rows change the recommendation, because none of those
sources carry a phone number. **The only licence question that gates real work
is Surrey's.**

### 7.2 CASL

**CASL governs contacting Canadian businesses**, and it is stricter than the US
equivalent in the way that matters here: it is **opt-in by default** for
commercial electronic messages, with narrow implied-consent exceptions.

Two things are true and worth separating:

- **Voice calls are not CECs.** CASL covers *electronic messages* — email, SMS,
  instant messaging. A phone call to a business is governed by the CRTC's
  Unsolicited Telecommunications Rules and the National DNCL instead, which is
  a different regime with a business-to-business exemption. **This matters
  enormously for source selection**: it means a phone number is a materially
  more usable contact channel than an email address for this product, which
  reinforces the ranking in §2.
- **Email is the constrained one.** The relevant implied-consent route is
  "conspicuous publication" — broadly, an address published without a statement
  refusing commercial messages, where the message is relevant to the person's
  business role.

**UNVERIFIED — I did not retrieve the CRTC's own wording**, and the precise
conditions of the conspicuous-publication exemption, and specifically **whether
an address obtained from a government open-data file counts as "conspicuously
published" by the business**, is exactly the kind of question that turns on
legal judgement rather than published wording. `SOURCE-CANADA.md` §7.2 already
flags CASL as needing a lawyer and I am not overriding that here.

**Practically it barely arises.** Across every non-Quebec source in this
document there are **66 email addresses** in total (Winnipeg's sewer and water
contractors). The CASL email question is a Quebec question — RBQ's 45,843
emails — and it belongs with the Quebec provider, not here.

**No source I examined declares terms restricting use for solicitation.** But
since several declare no terms at all (§7.1), that is an absence of a
restriction, not a permission.

---

## 8. What I did not do, deliberately

- **I did not scrape any search endpoint.** Alberta's Service Alberta licence
  search, BC Housing's builder registry, Ontario's HCRA and Skilled Trades
  Ontario are all search-only. Each *could* be driven programmatically. None
  publishes terms permitting it, and `AUDIT-compliance.md` §10's crawling rules
  exist for this. Where a register is search-only I have recorded it as
  search-only and stopped.
- **I did not open Newfoundland's catalogue by hand.** Its portal has no API
  (§3.6). It is a small province and the expected value is low, but the gap is
  real and I am naming it rather than implying I covered it.
- **I did not verify Surrey's refresh cadence** (§4.9), which is the one
  measurement that would change my recommendation if it came back badly.

---

## 9. What I could not verify

1. **Surrey's open-data licence.** Declared `"none"`. This gates the only build
   recommendation in this document.
2. **Surrey's refresh cadence.** Hub `modified` is 2025-05-02; whether the
   FeatureServer behind it updates more often is unknown.
3. **Whether Toronto's portal declares a default licence** for datasets marked
   `notspecified`.
4. **Vancouver, Calgary, Winnipeg, Hamilton, Mississauga and Alberta licence
   texts** — delegated, unreported at time of writing (§7.1). Vancouver's site
   returns 403 to automated fetches.
5. **Whether Service Alberta's licence search offers a bulk export.** Still the
   cheapest open question in Alberta, and still open after this pass
   (§3.3). It needs a human with a browser.
6. **Whether BC Housing will supply its residential-builder list on request**
   (§3.2). A phone call, not an engineering task.
7. **Newfoundland's full dataset catalogue** (§3.6, §8).
8. **The CRTC's exact wording** on conspicuous publication and whether open-data
   email addresses fall within it (§7.2).

---

## 10. Recommended order of work

1. **Build the Quebec RBQ provider.** Nothing found here changes that; the gap
   between it and everything else widened. 47,585 phones and 45,843 emails, CC-BY,
   daily, with an official trade codebook, against a national field where the
   next best source has 6,798 phones and no licence.
2. **Resolve Surrey's licence and cadence** (§9 items 1–2). Two questions, no
   code. If both come back clean *and BC is a target market*, build it — one
   day for 6,798 dialable contractors is the second-best ratio in Canada.
3. **Build nothing else in Canada.** Toronto, Vancouver, Edmonton, Calgary,
   Winnipeg, Hamilton and ODBus produce **zero** contactable businesses between
   them, and §6 shows the enrichment pass that would fix that recovers ~7.5% of
   rows correctly.
4. **Spend the week on Washington instead.** 75,839 active contractors, 99.97%
   phone coverage, public domain, three refreshes a day — more contactable
   businesses than every non-Quebec Canadian source in this document combined,
   times ten, for the same engineering day.

**The honest summary the brief asked for: Quebec is a one-off, and the rest of
Canada does not justify a connector each.** Canada's municipal open-data layer
is real, well-maintained and genuinely open — and it systematically withholds
the one field that makes a row worth a sales rep's time. Surrey is the single
exception, and it is one city of half a million people.
