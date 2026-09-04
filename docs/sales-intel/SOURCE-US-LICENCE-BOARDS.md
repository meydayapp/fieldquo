# US state contractor licence boards — which publish a bulk list, measured

Every number in this document came out of a file that was downloaded and
parsed on this machine. Retrieval date for every source: **2026-09-03**
(a few finished after 00:00 UTC on 2026-09-04; those are marked).

Companion to `SOURCE-CANADA-PROVINCES.md`, which asked the same question of
Canada and answered "Quebec is a one-off". This document asks it of the United
States and answers something different: **three states pan out well enough to
build, and one of them is worth more than everything FieldQuo has discovered so
far put together.**

## How to read this document

The three markers `SOURCE-CANADA.md` uses, for the same reason.

- **VERIFIED** — the primary source was fetched and what it said is quoted.
- **MEASURED** — computed from the real file, on this machine; the sample and
  its limits are stated with the number.
- **UNVERIFIED** — could not be established from a primary source. Named as an
  open question, not answered by inference.

I am an engineer reading terms-of-use pages and parsing CSV, not a lawyer.
Where the answer turns on legal judgement rather than published wording, I say
so.

---

## The one paragraph

**California, Washington and Oregon publish free bulk licence files, and all
three are now discovery providers.** Together they hold **340,655 active
licences**, 99.9% of them with a phone number, and **117,686 of them reach a
FieldQuo trade straight out of the licence classification** with no crawl and
no inference. For comparison, Quebec's RBQ — the best source FieldQuo had
before today — banks 54,264 licences of which roughly **1,100** ever reach a
rep's queue. California alone is **ninety times** that.

**No US board publishes an email address or a website.** Measured at 0.00% on
all three files; California states the statutory reason itself. So these are
phone sources, and the RBQ's derived-website route does not exist here — there
is nothing to derive a domain from.

**And the licence class is only sometimes a trade.** The RBQ finding recurs in
a different shape: two thirds of every US register holds the board's
*unrestricted* class, which permits any work and identifies nobody. Mapping it
would file 51,755 Washington businesses into one queue. It is refused, and a
check enforces the refusal.

---

## 1. The state-by-state table

Everything measured. "Rows" is what the file contains; "licences" is what it
becomes after grouping and after the board's own definition of active.

### Built — providers ship for these

| | California CSLB | Washington L&I | Oregon CCB |
|---|---:|---:|---:|
| Bulk list | **yes, free** | **yes, free** | **yes, free** |
| Route | direct CSV on CSLB's portal | Socrata `data.wa.gov` `m8qx-ubtq` | Socrata `data.oregon.gov` `g77e-6bhs` |
| Bytes | 77,462,224 | 35,382,695 | 14,622,752 |
| Rows | 242,879 | 160,923 | 56,156 |
| Rows with a bad column count | **0** | **0** | **0** |
| Licences after filtering | **219,255** (`PrimaryStatus` CLEAR) | **75,917** (`ACTIVE`) | **45,483** (file is the active list) |
| **Phone** | **99.90%** | **99.97%** | **99.97%** |
| **Email** | **0%** | **0%** | **0%** |
| Street address | 100% | 100% | 100% |
| Website | 0% | 0% | 0% |
| Coordinates | none | none | none |
| Classification codes | 98 | 90 | 18 |
| Licences holding only the unrestricted class | 80,142 | 51,755 | 39,525 |
| **Licences reaching a FieldQuo trade** | **98,566 (44.9%)** | **17,650 (23.3%)** | **1,470 (3.2%)** |
| Licence terms | public record, free | Open Data Commons PDDL 1.0 | Public Domain (US Gov Works) |
| Attribution required | no | no | no |
| Release detection | max `LastUpdate` in the file | `rowsUpdatedAt` | `rowsUpdatedAt` |
| Release measured | 2026-09-02 | 2026-09-03 | 2026-09-03 |
| Refresh | daily-ish (portal states "current as of the date below the link") | **three times a day** — 07:30, 12:15, 17:15 | daily |

### Verified, not built

| State | Bulk? | Measured | Why not built |
|---|---|---|---|
| **Tennessee** | yes, free CSV | 9,396,352 B · **33,833 records** · phone **98.2%** · **email 96.3%** · 23,263 Active | The only US board with an email. But name, street, city, `Email:` and `Phone:` are crammed into **one multi-line cell** and need a bespoke parser, the file is a Tableau crosstab export with no `Last-Modified` and no `ETag`, and its 328 classification codes include one — `AGLM` — that is not a trade at all but the licence's money limit. Does not fit the column-mapping shape; a real half-day. **Highest-value next state.** |
| **Virginia DPOR** | yes, free | 88,669 rows across 14 files · Class A (`2705a`) 4,347,119 B / 30,601 rows / **83.9% email** | **No phone at all**, by policy — "Regulant lists are provided free of charge in electronic format. Phone numbers are not included." A phone-first pipeline gets nothing dialable. Also unquoted tab-delimited: 15 of 30,601 rows carry 21 fields because of an embedded tab. |
| **Minnesota DLI** | yes, free, rebuilt nightly | residential contractors 12,180,748 B / 59,142 rows → **25,233** at `Status="Issued"` · phone **95.08%** | Fits the shape and is worth adding. Two traps measured: the `Email_Address` column is **empty in all 258,362 rows** of the full extract, and status casing is inconsistent inside one column (`EXPIRED` 26,373 *and* `Expired` 3,025) — active is spelled `Issued`, never "Active". |
| **Alabama** | yes, free | 1,645,814 B · **9,175 rows** · phone **99.92%** | Small and clean; fits the shape. Trap: phone is 100% *non-empty* and 99.92% *real* — `(   )    -` is the missing-value sentinel, so a naive fill check reports 100% and is wrong. |
| **Nevada NSCB** | directory, no export | **19,101 licences / 15,406 businesses** · phone 99.31% · 165 narrow class codes | The whole "Active Directory of Licensed Contractors" comes back from one County=All + Class=All form submission, but **there is no CSV export** — it is an HTML table, and there is no release marker at all, so change detection means hashing the body. Per the brief's rule this is recorded, not scraped. |
| **Colorado DORA** | yes, free, Socrata | 49,786 active trade licences | **No phone, no email, no street address** — city and ZIP only. Also confirmed from DORA's own 344-row licence-type dictionary: there is **no** General Contractor / Home Improvement category, because Colorado licenses contractors **municipally**, not at state level. |
| **Florida DBPR** | yes, free — but the host blocks fetching | 44,183,601 B · **246,645 rows** · **phone 0% · email 0%** · 29 class codes | Two reasons. Contact data does not exist in the file, and the live host returns HTTP 403 behind a Cloudflare managed challenge to curl, to WebFetch and to a real browser. The measurements above come from the Internet Archive's **2025-05-19** capture, which proves shape but is **not a live verification**. |
| **Texas TDLR** | yes, twice — and the good copy is robots-disallowed | Socrata mirror `7358-krk7`: 121,399,539 B · **983,494 rows** · `rowsUpdatedAt` **2026-07-16**, seven weeks stale | See §4. TDLR's own daily files carry phone and address; `robots.txt` says `Disallow: /*.csv` and they were not fetched. The Socrata mirror that *is* allowed drops five columns and has **0% address and 0% phone on all 20,323 A/C Contractor rows**. Texas also licenses no general contractors, painters or flooring installers at all. |

### Lookup-only, gated, or UNVERIFIED

| State | Finding |
|---|---|
| **Georgia** | Roster is **paid** and the contact fields are deliberately removed — "The list does not include phone numbers, e-mail addresses, or personal mailing addresses." **UNVERIFIED**: every `sos.ga.gov` URL returned HTTP 403 behind Cloudflare, the quote is second-hand via search-engine extraction, and the reported prices are unconfirmed. Its own "Active Licenses report is offline for maintenance." |
| **North Carolina NCLBGC** | Lookup only. `nclbgc.org/robots.txt` is `User-agent: * / Disallow: /`. **Nothing was fetched from the host.** A written public-records request under N.C.G.S. ch. 132 is the honest route. |
| **South Carolina LLR** | A real bulk service exists but needs a registered account, and the host's robots.txt reads `# go away` / `Disallow: /`. Not pursued. |
| **Arizona ROC** | **UNVERIFIED.** Every `roc.az.gov` path returns 403 behind a Cloudflare managed challenge — **including `/robots.txt` itself**, so what crawling is permitted cannot even be established. A real browser did not clear the challenge either. Second-hand and explicitly unverified: ROC appears to post daily CSVs at `/posting-list` with dated filenames. Row counts, columns, fill rates and terms are all unknown. Resolving it needs an ordinary interactive browser session, not code. |
| **Utah DOPL** | Lists are **paid and subscriber-only**, and the contact fields are removed by statute: "DOPL does not include telephone numbers or mailing addresses on the lists of licensees it prepares for public dissemination" — Utah Code 58-1-106(2). `opendata.utah.gov`, named in the brief, returns "This domain has been decommissioned". |
| **Michigan LARA** | **UNVERIFIED.** `data.michigan.gov/robots.txt` is `Disallow: /`; `www.michigan.gov` returns 403 even for robots.txt. Best pursued by a direct data request. |
| **Massachusetts** | **UNVERIFIED.** `mass.gov` 403s behind bot protection, `services.oca.state.ma.us` 503s, and `data.mass.gov` turned out to be a Next.js content hub rather than a Socrata portal. |
| **Louisiana LSLBC** | Lookup only, no bulk export. |
| **Maryland MHIC** | Lookup only. Worth a product decision anyway: `www.labor.maryland.gov/robots.txt` declares `Content-Signal: ai-train=no, search=yes, ai-input=no`. Maryland is explicitly signalling that its content should not be used as AI training data **or as AI input**. It does not block crawling, and Maryland is lookup-only regardless, so nothing was taken — but the signal should be honoured if Maryland ever becomes a target. |

---

## 2. The finding that shaped the design: a class is sometimes a trade

The brief asked whether US classifications are narrower than the RBQ's. They
are — and the difference is measurable rather than a matter of opinion.

**Quebec**, from `rbq/licence.js`: the median licence carries sixteen to
seventeen subcategories and 81.3% of all licence-holders are authorised for
interior finishing. The set identifies nothing.

**The United States** — MEASURED on the three files:

| | classes per licence |
|---|---|
| California | 81.3% hold exactly one; median 1, maximum 21 |
| Washington | 99.76% hold exactly one; 180 of 75,917 hold two |
| Oregon | median 1, maximum 4 |

So `categories.primary` is populated for these boards where the RBQ
deliberately leaves it null, and California's **C-33 "Painting and Decorating
Contractor"** really is one trade and nothing else — 14,631 licences of it.

### But three specific things go wrong, and all three are measured

**2.1 The unrestricted class, which identifies nobody.**

| board | the class | licences holding nothing else |
|---|---|---:|
| California | `B` General Building | **80,142** |
| Washington | `CC\|01` GENERAL | **51,755** |
| Oregon | `RGC` Residential General Contractor and friends | **39,525** |

A Washington GENERAL registration permits *every* kind of construction work; a
SPECIALTY registration permits one. A painter who also hangs drywall takes
GENERAL because it is the licence with no restriction on it. So GENERAL is the
residual — where everyone who does not fit one box ends up — and reading it as
the trade "general contracting" would file 51,755 businesses into FieldQuo's
widest queue on the strength of a box that means "unrestricted".

This is the RBQ finding in a different shape: the class held by most of the
register identifies nothing, whether it is held *alongside* sixteen others
(Quebec) or *instead of* a narrower one (Washington). `UNRESTRICTED_CLASSES` in
`lib/sales/discovery/usBoard/classes.js` declares them and
`scripts/check-us-boards.mjs` asserts none is ever mapped.

**2.2 The code that means two different things.** Washington's specialty codes
are namespaced by licence type and the file gives no hint of it. MEASURED
across the active file, six codes collide:

```
01  GENERAL under CC (construction), JOURNEY LEVEL under PC (plumbing),
    GENERAL under EC (electrical)
02  RESIDENTIAL under both PC and EC
03  PUMP & IRRIGATION under both
04  SIGN under EC, something else under PC
3A  Domestic Pump under both
SV  Scaffolding under CC, SERVICE OR MAINTENANCE under LC (elevators)
```

A map keyed on the specialty code alone would file 3,381 electrical contractors
as "general" and 1,445 plumbers as whatever `01` was declared to mean. The class
token is therefore `TYPE|CODE`, always.

A wildcard would be just as wrong in the other direction: mapping every
`EC` licence to `electrical` misfiles the 446 `EC|6A HVAC/RFRG` contractors, the
80 `EC|04 SIGN` ones and the 42 `EC|7D APPLIANCE REPAIR` ones. Only explicit
pairs are mapped.

**2.3 The class that names two trades.** `CC|SK` is "Floor Covering and Counter
Tops" (1,891 Washington licences) and `CC|SB` is "Cabinets, Millwork and Finish
Carpentry" (855). FieldQuo sells flooring and countertops separately, and
cabinets and carpentry separately. Neither is mapped. California's `C-6`, `C12`,
`C21`, `C28`, `D41` and `C38` are refused for the same reason, each with the
reason written down in `AMBIGUOUS_CLASSES`.

**The rule, stated once:** a class is mapped only when every activity it names
falls inside one FieldQuo trade. Where it does not, the row banks with
`tradeKey: null` and appears in no queue — which is the already-accepted
behaviour for an unmapped row, and is better than a rep opening a cabinet
script on a flooring installer.

### What the class mapping actually yields

MEASURED by running `scripts/us-board-snapshot.mjs` against the real files,
using the shipped `tradeForCategories` — so these are the pipeline's own
numbers, not a second estimate:

| trade | California | Washington | Oregon |
|---|---:|---:|---:|
| electrical | 23,152 | 3,947 | — |
| painting | 13,506 | 2,312 | — |
| plumbing | 13,227 | 2,065 | — |
| landscaping | 9,424 | 1,512 | — |
| hvac | 8,130 | 1,291 | — |
| masonry_concrete | 5,435 | 1,076 | — |
| flooring | 5,285 | — | — |
| roofing | 4,812 | 542 | — |
| tiling | 4,658 | 1,010 | — |
| pool_spa | 3,245 | 66 | — |
| drywall | 2,448 | 383 | — |
| tree_care | 2,224 | 595 | — |
| fencing | 1,503 | 235 | — |
| carpentry | 859 | 309 | — |
| insulation | 658 | 147 | — |
| handyman | — | 448 | — |
| excavation | — | 380 | — |
| siding | — | 352 | — |
| pressure_washing | — | 233 | — |
| paving | — | 214 | — |
| garage_door | — | 165 | — |
| gutters | — | 158 | — |
| irrigation | — | 92 | — |
| appliance_repair | — | 42 | — |
| pest_control | — | 38 | — |
| demolition | — | 38 | — |
| home_inspection | — | — | 874 |
| locksmith | — | — | 584 |
| restoration | — | — | 12 |
| **total** | **98,566** | **17,650** | **1,470** |

---

## 3. What was built

- `lib/sales/discovery/usBoard/boards.js` — one row per board. Everything that
  differs between states is here.
- `lib/sales/discovery/usBoard/classes.js` — each board's full class
  vocabulary, **read out of the real file**, plus the unrestricted and
  ambiguous declarations.
- `lib/sales/discovery/usBoard/socrata.js` — resolves a Socrata board through
  `/api/views/<id>.json` and **stops** if the dataset's licence tag changes.
- `lib/sales/discovery/usBoard/record.js` — rows into licences into
  `DiscoveredBusiness`.
- `lib/sales/discovery/usBoard/snapshot.js` — the NDJSON format, and the
  refusal that stops one state's file being ingested by another state's
  campaign.
- `lib/sales/discovery/usBoard/provider.js` — the factory that registers one
  provider per board.
- `scripts/us-board-snapshot.mjs` — the offline extractor.
- `scripts/check-us-boards.mjs` — wired into `check:all`.
- `lib/sales/discovery/trades.js` — 55 namespaced board classes added to the
  existing trade map, in the form `us_ca_cslb_c33`.

**The board's own spelling is folded, and the fold is proved lossless.**
`check-sales-discovery.mjs` holds every source category to
`/^[a-z][a-z0-9_]{2,63}$/`, because capitalisation, spaces and hyphens are the
three ways one gets mistyped — and board codes break all three (`C-8`,
`CC|01`, `EC|6A`). Loosening that rule would have thrown away what it catches
for every other source, so `slugClass` folds instead, and
`scripts/check-us-boards.mjs` asserts the fold is **injective over all 206
published classes across the three boards**. Zero collisions. The reverse
lookup scans the vocabulary rather than un-folding the string, because an
inverse computed from a lossy fold is a guess wearing a lookup's clothes.

**One shared provider family, three registered providers.** The brief asked for
a shared implementation over N copies and that is what this is: the reader is
one file and the per-state part is data. What is *not* shared is the
registration, because the discovery registry requires a licence per provider on
purpose — a campaign ticks several sources at once and each checkbox has to say
what ticking it costs. One checkbox reading "US licence boards" would stand for
three grants from three states that can diverge, and could not honestly state a
yield that ranges from 3.2% to 44.9%.

### The one place a copy was avoided by an odd import

`scripts/us-board-snapshot.mjs` imports `splitCsvLine` from
`lib/sales/discovery/rbq/licence.js`. It is an RFC 4180 splitter with nothing
Quebecois about it, and California's file needs exactly the same handling. A
second copy would be the classic failure with a specific symptom — the copy
that mishandles `""` puts a ZIP code in the phone column and nothing says so.
Hoisting it into a shared module would mean editing a shipped, checked file,
so the oddity is named rather than hidden. Worth hoisting when a third caller
appears.

---

## 4. Two policy questions for the owner

**4.1 Texas publishes files for humans and tells robots not to take them.**
`www.tdlr.texas.gov/robots.txt` contains `Disallow: /*.csv`, and TDLR's daily
bulk files live at `/dbproduction2/*.csv`. Those files carry phone and mailing
address (documented in `lrformat.txt`, which is not disallowed and *was*
fetched). **They were not downloaded.** The allowed alternative — TDLR's own
dataset on `data.texas.gov` — is seven weeks stale and has zero address and
zero phone on all 20,323 A/C Contractor rows. Asking TDLR for a feed is the
route; nothing here should be resolved by ignoring the directive.

**4.2 Florida and Arizona are blocked by bot protection, not by policy.**
Neither state's terms forbid this. Both hosts return 403 to everything,
Arizona's including its own `robots.txt`. Defeating a challenge was not
attempted and should not be. Florida is worth little anyway (0% phone, 0%
email); Arizona is unknown and could be worth a lot. Both are resolvable by a
person with an ordinary browser saving a file, or by a written request.

---

## 5. Calling-window gaps — WHAT IS MISSING FROM `callingRules.js`

Checked against `CALLING_JURISDICTIONS` on 2026-09-03. **No entry was guessed
in.** The table's own rule holds: a state with no row comes back `unknown` and
refuses, and `scripts/check-us-boards.mjs` asserts exactly that for the two new
states so it cannot silently become permissive later.

| state | in the table? | consequence today |
|---|---|---|
| **California** | **NO** | Every one of 219,255 California prospects returns `CALL_UNKNOWN` with a `jurisdiction_unread` blocker. **Nobody can call them.** |
| **Oregon** | **NO** | Same — all 45,483. |
| **Washington** | yes, `verified: true` | Callable 08:00–20:00 local under RCW 19.158.110(4) — **but** the row also carries `registration.required: true, done: false`: RCW 19.158.050 requires a commercial telephone solicitor to register with the Department of Licensing and post security **before the first call**. That is a filing and a bond, not code. |

**This is the highest-value thing the owner can unblock.** California is 98,566
trade-classified contractors with a 99.9% phone fill sitting behind one
unread statute. The other states this work touches and that are also absent:
**Tennessee, Virginia, Minnesota, Alabama, Nevada, Colorado, Georgia, North
Carolina, South Carolina, Michigan, Massachusetts, Utah** — all would refuse
today.

## 6. What the contact gate says, and the gap there

`lib/sales/contactBasis.js` was **not edited** — it is one of the files the
brief ringfences, and its entries are positive legal findings rather than
configuration. Consequence, stated rather than left to be discovered:

- The three new providers have **no entry**, so `contactBasisFor` returns
  `undetermined` for phone, email and SMS. That blocks nothing (the table is a
  deny-list, not a permission system) and the calling gate above is what
  actually decides.
- It also means `sourceLabel` is null for these providers, so the prospect
  screen's "Where this came from" row will render the raw provider key
  (`us_ca_cslb`) rather than a name. **This is a real gap and it needs a
  one-line entry per board in that table — but the entry is a legal position
  about US law, which is the owner's to state, not an agent's to invent.**
- `SOURCE_ATTRIBUTION` in `lib/sales/prospectView.js` was likewise not touched.
  Its stated rule is that only sources whose licence *demands* a credit are
  listed, and none of these three does. The source statement still travels —
  it is in every snapshot manifest and on every campaign checkbox.

## 7. i18n

**No new keys.** The campaign source screen (`app/platform/sales/campaigns/`)
renders `provider.label`, `provider.description` and `provider.licence.*`
verbatim from the registry, exactly as it does for RBQ and Overture, and
`/platform` is FieldQuo's own English-only back office. Nothing client-facing
was touched, so the white-label rule is unaffected.
