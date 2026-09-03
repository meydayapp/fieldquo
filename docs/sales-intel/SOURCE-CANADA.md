# Canadian government business data as a second discovery source

Research and design. **No provider was written, no bulk file was ingested, and
nothing was signed up for.** Retrieval date for everything below: **2026-09-03**.

Read `lib/sales/discovery/provider.js` first. This document is written against
that interface and adds nothing to it.

## How to read this document

Three kinds of statement appear here and they are marked apart deliberately,
because the owner's standing rule is that an assumption presented as a finding
is worse than an admitted gap.

- **VERIFIED** — I fetched the primary source, or ran the code, and quote what
  it said. HTTP headers are reproduced where they are the evidence.
- **MEASURED** — I computed it from real data, and the sample and its limits are
  stated with the number.
- **UNVERIFIED** — I could not establish it from a primary source. It is named
  as a question, not answered by inference.

---

## 1. Why a second source at all

`docs/sales-intel/STATUS.md` sets out the gap: Overture found **79,736** Canadian
field-service businesses against **415,406** StatCan construction establishments
— 19.2%, and structurally so. A contractor working from a van with no storefront
is registered with a government and invisible to a map.

The rest of this document is about whether the governments that know them will
let us have them, and whether what they hold is usable once we do.

**The short answer, stated up front because it inverts STATUS.md's stated next
step.** STATUS.md says: *"Highest-yield next step is licence bulk files — Quebec
RBQ, California CSLB… They add firms that never appear as a clean POI, and they
carry trade class from an official codebook rather than from Overture's
taxonomy."*

The first half of that is right. **The second half is measured wrong for RBQ**
(§3.6). An RBQ licence's subcategory list is an *authorisation set*, not a trade:
the median holder is authorised for 16–18 subclasses, 83% of them carry "interior
finishing" and 79% carry "cabinets and countertops". It says what a firm *may*
do, not what it *does*. For trade segmentation — which is the spine of a
`ProspectCampaign` — it is considerably worse than an Overture category, not
better.

That does not make RBQ worthless. It makes it a different thing than the plan
assumed, and §8 recommends the order of work that follows from what it actually
is.

**And the source with the best scope fit in the country turns out not to be
Quebec.** Alberta's prepaid contracting licence covers renovation *and*
landscaping by statute (§4.3), and Service Alberta offers an Excel export of its
own search results — no scraping question at all. Whether that export carries
addresses and phones is one click away from being known and nobody has taken it.
That click is the cheapest high-value action in this document.

---

## 2. StatCan Open Database of Businesses (ODBus)

### 2.1 Is it still published, and at what cadence

**VERIFIED — it is published, and it is frozen.**

The LODE index at `https://www.statcan.gc.ca/en/lode/databases` lists twelve open
databases. Nine of them have been revised since ODBus was released. ODBus is
listed as:

> The Open Database of Businesses — Version 1.0 (November 28, 2023)

The publication page gives its cadence as:

> Frequency: Occasional

And the file itself has not moved since the day it was published:

```
$ curl -sIL https://www150.statcan.gc.ca/pub/21-26-0003/2023001/ODBus_2023.zip
HTTP/1.1 301 Moved Permanently
Location: https://www150.statcan.gc.ca/n1/pub/21-26-0003/2023001/ODBus_2023.zip
HTTP/1.1 200 OK
Content-Type:   application/zip
Content-Length: 21860048
Last-Modified:  Tue, 28 Nov 2023 13:30:17 GMT
```

**That `Last-Modified` is the whole verdict on cadence.** "Occasional" has meant
"once, so far, in nearly three years". Any design that assumes a refresh must say
what it does when the refresh never comes.

### 2.2 The download URL

`https://www150.statcan.gc.ca/n1/pub/21-26-0003/2023001/ODBus_2023.zip`
— 21,860,048 bytes, `application/zip`. **VERIFIED by HEAD request only. I did not
open it**, so everything in §2.3 about the *contents* is what StatCan says about
the file, not what I read out of it.

### 2.3 What a record carries

**VERIFIED** — quoted from the publication page
(`https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm`):

> "Name, Business Sector, Business ID number, Licence Number, Licence Type, NAICS
> (North American Industry Classification System) Code, Number of Employees,
> Status, Address, Municipality Name, Province, Postal Code, Census Subdivision
> Name, Longitude, Latitude"

**No phone. No website. No email.** ~450,000 records. The underlying datasets were
> "collected from May 2022 to December 2022"

and the page is explicit about what the file is not:

> "The ODBus does not contain all businesses within Canada and is separate from
> the Statistics Canada Business Register."

> "The inputs for the ODBus are primarily datasets provided by municipal,
> regional, or provincial sources available to the public through open government
> portals"

That last sentence is the one that matters for planning: ODBus is a *harmonised
re-publication of municipal open data*, not a census. Its coverage is the union of
whichever municipalities happened to publish a business-licence list before
December 2022 — which is a different and unknown shape from "Canadian businesses".

### 2.4 The licence, with the clause quoted

**Open Government Licence – Canada, version 2.0**
(`https://open.canada.ca/en/open-government-licence-canada`).

The rights-granting clause, quoted:

> "Copy, modify, publish, translate, adapt, distribute or otherwise use the
> Information in any medium, mode or format for any lawful purpose."

That is the clause that permits both commercial use and redistribution inside a
product: the grant is by *purpose* ("any lawful purpose"), not by medium or by
non-commercial restriction, and "distribute" is named explicitly. There is no
non-commercial carve-out, no share-alike, and no field-of-use limit anywhere in
the licence.

The obligation is attribution:

> "Acknowledge the source of the Information by including any attribution
> statement specified by the Information Provider(s) and, where possible, provide
> a link to this licence."

with the fallback wording, where the provider specifies none:

> "Contains information licensed under the Open Government Licence – Canada."

Two clauses that constrain how we may *present* it:

> "This licence does not grant you any right to use the Information in a way that
> suggests any official status or that the Information Provider endorses you or
> your use of the Information."

> "The Information is licensed 'as is', and the Information Provider excludes all
> representations, warranties, obligations, and liabilities, whether express or
> implied, to the maximum extent permitted by law."

**Product consequence of the no-endorsement clause.** A rep screen may say "listed
in the StatCan Open Database of Businesses". It may not say anything that reads as
"verified by Statistics Canada". That is a real constraint on the wording of a
provenance badge, and it should be written into the badge rather than left to
whoever styles the screen.

### 2.5 Verdict

**Legally the cleanest source in this document, and operationally the weakest.**

- Licence: unrestricted for our purpose, attribution only. No obstacle.
- Contact data: none at all. Every record needs a phone number from somewhere
  else before a rep can do anything with it.
- Freshness: a 2022 snapshot, unmoved since 2023. `Prospect.sourceUpdatedAt` would
  carry a date nearly four years old, and `stalenessOf()` in `normalise.js` would
  correctly render every single row as `stale` — which is the honest outcome and
  also the reason a rep would never work the queue.
- Trade: NAICS is present, which is a real advantage over ODBus's reputation. But
  see §2.6.

### 2.6 UNVERIFIED about ODBus, and worth knowing before any work starts

I did not open the archive, so all of the following are open questions and none
of them should be guessed at:

- **NAICS fill rate.** The field is listed. How often it is populated, and at what
  digit depth (2-digit sector vs 6-digit industry), is unknown. A 2-digit "23"
  cannot distinguish a painter from a roofer and would produce `tradeKey: null` on
  every row.
- **Province and municipality coverage.** Which municipalities contributed is not
  stated on the publication page. It is plausible that Quebec is barely present
  and that Ontario is dominated by a handful of large cities; it is equally
  plausible the reverse. **This is the single cheapest thing to find out and it
  decides whether ODBus is worth any work at all** — one `unzip` and one
  `GROUP BY province, municipality`.
- **How many records fall in NAICS 23 / 5617.** ~450,000 is all sectors. The
  field-service subset could be 30,000 or 200,000.
- **What "Status" means** and whether it distinguishes an active business from a
  lapsed municipal licence.

---

## 3. Quebec — Régie du bâtiment du Québec (RBQ)

This is the source that repays the most investigation, and the one where the
plan's assumptions came apart under measurement.

### 3.1 It exists, and the daily cadence is real

**VERIFIED, empirically rather than from a claim.** Dataset
`755b45d6-7aee-46df-a216-748a0191c79f`, *"Liste des licences actives de la Régie
du bâtiment du Québec"*, on Données Québec, mirrored on open.canada.ca.

```
$ curl -sIL .../rdl01_extractiondonneesouvertes.zip
HTTP/2 200
content-type:   text/csv
content-length: 11368534
last-modified:  Thu, 03 Sep 2026 07:00:18 GMT     # ← today, 07:00 UTC
```

The JSON resource carries a `last-modified` of the same morning, 07:05:13 GMT, and
CKAN's `package_show` reports `metadata_modified: 2026-09-03T07:13:04`. **Both
files were rebuilt this morning.** open.canada.ca's mirror states the frequency as
"Daily"; the headers are what actually prove it.

Contrast that with ODBus's `Last-Modified: 2023`. On freshness these two sources
are not in the same category of thing.

**Implementation gotcha, VERIFIED.** The CSV resource is served with
`Content-Type: text/csv` and a `.zip` extension, and it is genuinely a **ZIP
archive** — the first bytes are `PK\x03\x04` and the member is
`rdl01_ExtractionDonneesOuvertes.csv`. A client that trusts the content type gets
binary garbage. Node has no ZIP reader in its standard library, which is one of
the reasons §6 recommends the offline-snapshot pattern rather than fetching in a
function.

### 3.2 The licence, with the clause quoted — and it is NOT the OGL

STATUS.md's plan table implies the Canadian government sources are OGL. **RBQ is
not.** CKAN reports `license_id: cc-by`, `license_title: "Attribution (CC-BY
4.0)"`, `license_url: https://www.donneesquebec.ca/licence/#cc-by`.

The portal's own description of that variant, quoted from
`https://www.donneesquebec.ca/licence/`:

> "Cette licence permet à d'autres personnes de distribuer, remixer, arranger et
> adapter votre œuvre, **même à des fins commerciales**, tant qu'on vous attribue
> le crédit de la création originale en citant votre nom. C'est le contrat le plus
> souple proposé."

(Emphasis mine. "This licence lets others distribute, remix, adapt and build upon
your work, **even commercially**, as long as they credit you for the original
creation. It is the most accommodating of the licences offered.")

The portal frames CC BY as its default and as deliberately permissive:

> "cette variante est utilisée par défaut pour chaque jeu de données"

**Commercial use and redistribution-in-product are permitted.** The obligation is
attribution, and under CC BY 4.0 attribution is a *condition of the licence* —
failing it terminates the grant — where under the OGL it is a covenant. Practical
difference: OGL attribution can live in a footer; CC BY attribution should be
attached to the data, which here means a visible source credit on any screen that
shows an RBQ-derived record, plus the licence link.

**UNVERIFIED, and worth one email to the RBQ before launch.** I read the licence
on the open-data portal. I did **not** find or read a separate terms-of-use for
the RBQ's own *Registre des détenteurs de licence* web search tool, and I did not
look for one that governs use of licence-holder contact details specifically. The
open-data grant is unambiguous on its own terms; whether the RBQ takes a different
view of bulk commercial solicitation of its licensees is a question about their
posture, not about the licence, and the answer is worth having in writing.

### 3.3 The fields a record carries

**VERIFIED by reading actual records out of the live JSON resource** (a 1,800-byte
range read of the head, plus the sample described in §3.5), cross-checked against
the RBQ's own *fiche descriptive* PDF, "Version du 2 décembre 2022".

| Field (as spelled in the file) | RBQ's own definition (quoted from the fiche) | Example from the live file |
|---|---|---|
| `Numéro de licence` | "numéro de la licence de l'entrepreneur" | `1100-3571-01` |
| `Statut de la licence` | "statut de la licence" | `Active` |
| `Type de licence` | "type de licence, Constructeur-propriétaire ou entrepreneur" | `Entrepreneur` |
| `Date de délivrance` | "date de délivrance initiale de la licence" | `2025-05-28` |
| `Restriction` | "si la licence fait l'objet d'une restriction (oui/non)" | `Non` |
| `Date de début de la restriction` | | `""` |
| `Date de fin de la restriction` | | `""` |
| `Association ou compagnie fournissant le cautionnement` | | `null` |
| `Montant de la caution` | | `null` |
| `Date du paiement annuel` | "date du prochain paiement des droits d'exercice" | `2027-05-28` |
| `Mandataire` | "organisation qui a délivré la licence à savoir : la Régie du bâtiment du Québec (Regie), la Corporation des maîtres électriciens du Québec (CMEQ), ou la Corporation des maîtres mécaniciens en tuyauterie du Québec (CMMTQ)" | `Regie` |
| `Courriel` | "courriel de l'intervenant" | `travauxpublics@drummondville.ca` |
| `Adresse` | "adresse complète de l'intervenant" | `415 RUE LINDSAY DRUMMONDVILLE QC CANADA J2B 1G8` |
| `NEQ` | "Numéro d'entreprise du Québec (NEQ) de l'intervenant" | `8831857857` |
| `Nom de l'intervenant` | "nom de l'intervenant propriétaire de la licence" | `Ville De Drummondville` |
| `Numéro de téléphone` | | `8194186550` |
| `Municipalité` | | `Drummondville` |
| `Statut juridique` | | `Autorite publique` |
| `Code de région administrative` | | `17` |
| `Région administrative` | | `Centre-du-Québec` |
| `Nombre de sous-catégorie autorisées` | | `3` |
| `Catégories et sous-catégories` | | `[{"Categorie":"Specialisee","Sous-catégories":"16"},{"Sous-catégories":"GPC"},{"Sous-catégories":"SEC"}]` |
| `Autre nom` | | `null` |

**It carries a phone number and an email address.** That corrects
`AUDIT-discovery-sources.md`'s and STATUS.md's shared conclusion — *"Registries —
unfit. StatCan ODBus has no phone, no website, no email"* — which is true of ODBus
and **false of RBQ**. The audit only examined ODBus and Corporations Canada and
generalised from them. Named plainly here so the generalisation stops travelling.

Four field-level facts that will bite an implementation:

1. **`Adresse` is one unparsed blob.** Street, city, province, country and postal
   code run together in a single uppercase string. `normalise.js` expects
   `{line, city, province, postalCode, country}`. Splitting it is a parser, and a
   parser is exactly the kind of thing AGENTS.md says to execute against hostile
   input rather than read. `Municipalité` gives the city for free, which makes
   `fuzzyKey()` usable without the parser — see §5.
2. **No latitude or longitude.** A radius territory excludes every RBQ row, by
   design: `inTerritory()` returns `false` for a coordinate-less row under a
   radius filter, and its comment explains why that is the conservative direction.
   RBQ campaigns must therefore be province- or city-scoped, or somebody must
   geocode — which sends homeowner-adjacent addresses to Google and is a decision,
   not a detail.
3. **No website.** `hasWebsite` stays `null`, which `normalise.js` is already
   careful to distinguish from `false`. The crawler is what turns it into a real
   answer.
4. **`Date du paiement annuel` is not an expiry.** The RBQ's own definition is
   "date du prochain paiement des droits d'exercice" — the next annual fee date.
   Storing it in a field called `licenceExpiresAt` would be a lie of exactly the
   kind AGENTS.md's failure class 5 describes.

### 3.4 How many, and what the file does *not* contain

The RBQ's own press page (`rbq.gouv.qc.ca/salle-de-presse/la-rbq-en-bref/`) gives,
for 2024–2025: **45,816** entrepreneurs and owner-builders licensed by the Régie,
**6,531** issued by the corporations (CMEQ/CMMTQ), for **53,662** active licences
in total. That corroborates the "~54k" in STATUS.md from a primary source.

**The file holds only ACTIVE licences.** In the sample of §3.5, `Statut de la
licence` was `Active` on 1,232 of 1,232 records — it is a constant, and storing it
as `Prospect.businessStatus` would put a column in the database that carries no
information. More importantly: **there is no revocation signal.** A licence that
lapses simply stops appearing in tomorrow's file. Detecting that requires
diffing yesterday's ingest against today's, which nothing in
`lib/sales/discovery/` does today and which §6 treats as a first-class design
question rather than an optimisation.

**Whole trades are outside the RBQ regime entirely.** The Building Act licenses
construction work. Landscaping, lawn care, house cleaning, carpet cleaning,
window cleaning, pressure washing, junk removal, snow removal, pest control and
tree care — ten of the 38 keys in `DISCOVERY_TRADES` — do not need an RBQ licence
and are not in this file. RBQ is not a Quebec business census; it is a
construction-licence register.

### 3.5 MEASURED — fill rates

Sample: **1,232 records**, parsed out of three 900 KB byte-range reads of the live
JSON resource at offsets 5 MB, 30 MB and 60 MB of 87,523,004 bytes, taken
2026-09-03.

**Sample limits, stated because they matter.** This is not a random sample. The
file appears to be ordered by licence number, which correlates with licence type
and vintage — the very first records in the file are `1100-…` owner-builder
licences held by municipalities. Records straddling a range boundary were dropped
by the parser. Treat these as indicative of the middle of the file, not as
population figures. Re-run them against the whole file before anyone plans on
them.

| Field | Populated | % |
|---|---:|---:|
| `Municipalité` | 1,231 | **99.9** |
| `NEQ` | 1,221 | **99.1** |
| `Adresse` | 1,168 | **94.8** |
| `Numéro de téléphone` | 1,167 | **94.7** |
| `Courriel` | 1,092 | **88.6** |
| `Autre nom` | 323 | 26.2 |

| `Type de licence` | Records | % |
|---|---:|---:|
| `Entrepreneur` | 1,213 | 98.5 |
| `Constructeur-proprietaire` | 19 | 1.5 |

**Read against `isCallReady()`** — which requires a phone *and* a street address —
roughly 90% of these records would qualify, without a crawl, without a purchase
and without touching Google. That is a genuinely good number for a source that
costs nothing and refreshes daily, and it is the strongest argument in this
document for doing the work.

**`Constructeur-propriétaire` is a deterministic reject.** An owner-builder is a
party licensed to build for *themselves* — the two examples at the head of the
file are the cities of Drummondville and Trois-Rivières. They are not
field-service contractors and never will be. `classify.js` currently reasons about
retailers from names and taxonomy; here the source states the answer outright.
1.5% of rows, rejected on a field rather than a heuristic.

### 3.6 MEASURED — the codebook does not identify a trade

This is the finding that reorders the plan.

The RBQ subclass codebook is real and official —
`rbq.gouv.qc.ca/en/licence/determining-your-licence-subclasses/`, Schedules II and
III, e.g.:

> 2.5 – Excavation and earthwork · 3.2 – Small concrete works ·
> 4.2 – Non-structural masonry, marble and ceramics ·
> 7.0 – Insulation, waterproofing, roofing and siding · 8.0 – Doors and windows ·
> 9.0 – Interior finishing · 12.0 – Manufactured cabinets and counter tops ·
> 15.5 – Plumbing · 16.0 – Electrical

Two problems, and the second is fatal to the "trade class from an official
codebook" premise.

**Problem one — the codebook is coarser than `DISCOVERY_TRADES` exactly where
FieldQuo sells.** `trades.js` builds `BY_SOURCE_CATEGORY` as a Map from one source
category to **one** trade, and `duplicateSourceCategories()` exists specifically so
the build fails if a category is claimed twice. So a source string can belong to at
most one trade — and:

| RBQ subclass | FieldQuo trades it covers |
|---|---|
| 9.0 Interior finishing | `painting`, `drywall`, `flooring`, arguably `tiling` |
| 7.0 Insulation, waterproofing, roofing and siding | `roofing`, `siding`, `insulation` |
| 12.0 Manufactured cabinets and counter tops | `cabinets`, `countertops` |
| 4.2 Non-structural masonry, marble and ceramics | `masonry_concrete`, `tiling` |
| 2.7 Sitework | `landscaping`, `paving`, `excavation` |

**There is no painting subclass at all.** FieldQuo's flagship trade is invisible in
the RBQ codebook, folded into "interior finishing" with drywall and flooring.

A handful do map one-to-one and would be safe: 15.5 → `plumbing`, 16.0 →
`electrical`, 2.5 → `excavation`, 3.1/3.2/4.1 → `masonry_concrete`, and the
15.1/15.2/15.3/15.4/15.7/15.8 heating-and-ventilation cluster → `hvac`
(many-to-one is fine; one-to-many is what breaks).

**Problem two — the subcategory list is an authorisation set, not a trade.**
Measured on the same 1,232 records:

| Distinct subcategories on one licence | Records |
|---|---:|
| 16 | 257 |
| 17 | 218 |
| 18 | 169 |
| 19 | 85 |
| 4 | 56 |

The median licence is authorised for **16 to 18 subclasses**. Share of records
carrying each:

| Subcategory | Share |
|---|---:|
| GPC / SEC / ADM (management, safety, administration qualifications — not trades) | 97.7–99.4% |
| 9 — Interior finishing | **83.0%** |
| 7 — Insulation, waterproofing, roofing and siding | **82.0%** |
| 8 — Doors and windows | 80.9% |
| 5.2 — Metal fabrication | 80.9% |
| 12 — Manufactured cabinets and counter tops | **78.9%** |
| 4.2 — Non-structural masonry, marble and ceramics | 77.2% |
| 1.3 — General contractor, all buildings | 43.8% |
| 15.7 — Residential ventilation | 14.6% |
| 16 — Electrical | 12.4% |
| 15.5 — Plumbing | 7.1% |

**Four in five licence holders are authorised for interior finishing. Four in five
are authorised for cabinets and countertops.** A campaign that selected
`Sous-catégories = "9"` as "painters" would return four fifths of every licensed
contractor in Quebec, and a rep would open a painting script on a roofer. That is
the trade-mixing failure `trades.js`'s header was written to prevent, arriving
through a field that looks authoritative.

Only **17 of 1,232 records (1.4%)** carry electrical (16) as their *only* trade
subclass. The narrow-specialist path exists but it is thin.

**Conclusion.** For trade segmentation, an RBQ licence is worse than an Overture
category, not better. STATUS.md's "often better than a map pin" is right about
licence *status* and legal *identity* and wrong about *trade*, and the correction
belongs in STATUS.md when this work is done.

---

## 4. The other provincial and territorial boards

Gathered in a parallel pass under the same rule as the rest of this document:
fetch the page, quote it, and say "could not fetch" rather than infer. Where a
page could not be retrieved that is stated, and it happened four times.

**The headline: only two of these give bulk data, and neither identifies a trade.
Ontario has no registry of general contractors or trades at all.** Three
registries carry explicit clauses barring automated access.

### 4.1 Ontario

**HCRA / Ontario Builder Directory — wrong scope, and adverse terms.** The
scope suspicion in the brief is confirmed from the directory's own page
(`obd.hcraontario.ca`):

> "As Ontario's home builder regulator, the HCRA provides access to a searchable
> database with information about Ontario's approximately 5,000 licensed home
> builders and vendors"

and `hcraontario.ca/resources/ontario-builder-directory/`:

> "In Ontario, all new home builders and sellers must be licensed by the Home
> Construction Regulatory Authority (HCRA)."

**~5,000 new-home builders and vendors. No painters, plumbers, roofers, HVAC,
cabinet makers, flooring installers or landscapers.** That is not the population
this product sells to, and no amount of access would change it.

**Bulk download: no.** Search-only client-side app; no API, CSV or open-data
resource found.

Terms — the directory's own `/terms-of-use` is a JavaScript app and returns no
readable text to a fetch, so **that page is unverified**. The HCRA builder
portal's terms (`builderportal.hcraontario.ca/en-US/terms-of-use/`) were retrieved
and say:

> "Commercial or for-profit reproduction of the content of the website, in whole
> or in part, is not permitted except with the written consent of HCRA."

`obd.hcraontario.ca/robots.txt` is `User-agent: * / Disallow:` — permissive — and
there is no anti-bot clause in the text above. **But `robots.txt` is not a
licence.** A clause forbidding commercial reproduction of website content, read
against a commercial prospecting database built from that content, is adverse on
its face. **Sweeping it would breach those terms**, and the scope makes the point
moot anyway.

**Skilled Trades Ontario** (`skilledtradesontario.ca/public-register/`) — search
by person name or ID. Bulk: no. **It registers individual tradespeople, not
businesses** — the wrong entity type for a `Prospect`. No terms text found on the
page: **unverified**.

**ESA / ECRA electrical contractors** (`findacontractor.esasafe.com`) —
**returned HTTP 503 on two attempts; could not fetch.** The parent site's terms
(`esasafe.com/terms-of-use/`) contain no automated-access clause; copyright is
limited to "personal, non-commercial, or educational use requiring written
permission otherwise". A linked full-disclaimer PDF was not retrieved:
**unverified**.

**TSSA fuels contractors** — searchable; shows company name, authorization
number, city, province, postal code. Bulk: no on the live directory, though TSSA
has posted point-in-time PDF directory snapshots. Scope is gas, propane and oil
heating only. Its own disclaimer: *"Information in this registry does not
constitute an endorsement or referral by TSSA."*

**data.ontario.ca** — three datasets match "contractor", all under Open
Government Licence – Ontario, all irrelevant: licensed *well* contractors, tile
drainage contractors, and agricultural soil-erosion contractors. Ontario's
*Select Licence and Registration Data* covers collection agencies, bailiffs and
lenders. **No construction trades in Ontario open data.**

**Ontario Business Registry** — free public search, $8 per profile report. **No
bulk product on the official page.** A search snippet claimed one exists; it could
not be confirmed on ontario.ca. **Unverified.**

### 4.2 British Columbia

**BC Housing Licensed Residential Builders** — page served, and its HTML contains
no export, download, CSV or Excel control. **Bulk: no.** Scope is residential
builders and building-envelope renovators. Its disclaimer is liability-only —
*"Any persons or business entities using any of the information or documents
provided on the Web site do so at their own risk"* — with **no scraping clause**;
`/terms-of-use`, `/legal-notice` and `/copyright` all 404.

**Technical Safety BC** — gas, electrical, boiler, refrigeration and elevating
contractors, with contact details and enforcement actions since 2022. Bulk: no.
Terms, quoted:

> "The Content may not be otherwise used, reproduced, broadcast, published or
> retransmitted without the prior written permission of Technical Safety BC."

and its `robots.txt` carries `Disallow: /api/*` and `Disallow: /search`. **The
search endpoint is explicitly off-limits to crawlers. Sweeping it would breach
both the terms and the stated crawl policy.** Say no.

**OrgBook BC — the best-licensed thing here, and it was tested live.** Open API,
no key, at `orgbook.gov.bc.ca/api/v4/`. Data under the **Open Government Licence
– British Columbia**: *"a worldwide, royalty-free, perpetual, non-exclusive
licence to use the Information, including for commercial purposes."* API terms
add *"You will only access (or attempt to access) the API by the means described
in the applicable API documentation"* and reserve the right to impose rate limits.

**Two live calls disqualify it:**

1. `GET /api/v4/issuer` returns **six** issuers — the BC Corporate Registry,
   Liquor & Cannabis, Energy/Mines, Investment Agriculture, Environment, and the
   Chief Permitting Officer. **No contractor or trade licensing body
   participates.** Not BC Housing, not Technical Safety BC.
2. `GET /api/v4/search/topic?q=plumbing` returns 5,624 matches, and across 25
   inspected records **the `addresses` array was empty on every one**. Available
   attributes: registration date, entity status, entity type, home jurisdiction.

**OrgBook publishes no addresses.** Name and status, nothing to contact. Excellent
licence, no usable payload.

### 4.3 Alberta — the strongest contractor-scoped source in the country

The Alberta **prepaid contracting licence** scope is a near-exact match for
FieldQuo's ICP. From `alberta.ca/prepaid-contracting-licence`:

> "construction, maintenance, repairing, altering, adding to or improving private
> dwellings, or real property used in conjunction with a private dwelling such as
> landscaping services"

**Landscaping is named explicitly** — which RBQ's construction-licence regime
excludes entirely (§3.4).

**Bulk: effectively yes, and sanctioned.** The Service Alberta search tool
(`servicealberta.gov.ab.ca/find-if-business-is-licenced.cfm`) states:

> "The results of your licence search can be downloaded in Excel format."

The licence-type dropdown carries **"Prepaid Contractor"** and an **"All"**
option; search is by business name, licence type or municipality. Because the
export is offered by the operator, **no scraping is involved and no
automated-access question arises.** Disclaimer:

> "This information only includes active licences and registrations in Alberta.
> Licensing and registration don't represent an endorsement of the company or
> charitable organization, nor do they guarantee the quality of goods or services
> offered."

Open-data listing: *"Licensed businesses, charities, and fundraisers"*, Government
of Alberta, **Open Government Licence – Alberta**, updated **Daily**
(`open.canada.ca/data/en/dataset/1b6cb20b-5d1d-443d-8e04-28558e9277f3`).

**Caveats, both real.** The open-data resource is a `LINK` back to the `.cfm`
search page, **not a hosted CSV** — so the "dataset" is the search tool.
`open.alberta.ca` returned HTTP 520 on three attempts, so the listing was read
from the open.canada.ca mirror. **Crucially: whether the Excel export carries
addresses, phones or trade detail is UNVERIFIED** — nobody has run the export.
That is one click, and it decides whether Alberta is the best source in this
document or another name-and-status list like OrgBook.

### 4.4 Manitoba, Saskatchewan, and the Atlantic provinces

**None publishes a bulk list of licensed contractors.** Three carry explicit
anti-scraping clauses, quoted here because the brief asked for honesty about where
sweeping would breach terms:

**Saskatchewan (ISC)**, `saskregistries.ca/about/legal` §3.4:

> "Use of automated scripting search tools to access registry data in registries
> available through ISC's Website is strictly prohibited and may result in being
> permanently banned from any further access to the registries."

**New Brunswick**, Service New Brunswick corporate registry:

> "Users of the service may not use automated tools to copy a group of search
> results. Anyone using automated tools to search for, or retrieve data from, this
> site may be denied access to this service without notice."

(Access is $3.00 per search or $50.00 per month. No open dataset.)

**Nova Scotia RJSC** — the primary page returned **HTTP 403; could not fetch.**
Secondary reporting says RJSC changed its terms in late 2015 to prevent bulk use.
**Unverified — do not rely on it either way.**

**Manitoba** publishes a weekly *"Listing of Recent Companies Office Filings"* as
**PDF only**, warning that *"The information in the notices being published is
limited"* and that it *"IS NOT an official transcript"*. New filings, not a
registry.

**Newfoundland (CADO)** and **PEI (OCBR)** — search-only; PEI redirected to a
maintenance host. **Terms unverified — neither disclaimer page could be fetched.**

**Verdict for all five: sweep nothing.** Two forbid it in writing, one is
unverifiable, and the two that do not forbid it publish nothing worth having.

### 4.5 Corporations Canada (federal)

**Bulk: yes, free, no registration.** *"Federal Corporations"*,
`open.canada.ca/data/en/dataset/0032ce54-c5dd-4b66-99a0-320a7b5e99f2`, licence
`ca-ogl-lgo` — **Open Government Licence – Canada**, the same grant quoted in
§2.4, explicitly excluding Personal Information. Eight CSVs (four subsets × two
languages), updated **daily**.

Header of the live active-CBCA file (103.5 MB, `last-modified` 2026-09-03),
**verified by reading it**:

```
Corporation number, Business number (BN), Corporate name - form 1,
Corporate name - form 2, Governing legislation, Status, Status Detail,
Anniversary date, Year of last annual filing, Date of last annual meeting,
Street, Street 2, City/town, Province/territory, Country, Postal code,
Minimum number of directors, Maximum number of directors
```

**Addresses are present and populated.** That is better than the earlier audit
implied. Two hard limits remain:

1. **No industry classification, no NAICS, no phone, no email.** It cannot be
   filtered to painters or plumbers except by name-string heuristics, which is
   exactly the guessing `trades.js` forbids.
2. **Federal CBCA incorporations only** — provincially incorporated companies and
   sole proprietors are excluded, and that is where nearly all 1–20-person
   field-service contractors are. And, as the earlier audit noted, a registered
   office address is frequently the accountant's.

The ISED API adds directors but requires an account and is capped at 60 hits per
minute. Not a discovery source.

### 4.6 The provincial picture in one table

| Source | Scope fits FieldQuo? | Bulk? | Licence / terms | Sweep-safe? |
|---|---|---|---|---|
| **Quebec RBQ** | Construction trades only | **Yes, daily** | CC BY 4.0 | n/a — bulk file |
| **Alberta prepaid contractor** | **Yes, incl. landscaping** | **Yes, operator-provided Excel** | OGL – Alberta | n/a — export is offered |
| Corporations Canada | All sectors, no trade field | Yes, daily | OGL – Canada | n/a — bulk file |
| StatCan ODBus | All sectors, NAICS | Yes, frozen at 2022 | OGL – Canada | n/a — bulk file |
| OrgBook BC | All BC entities | Yes, open API | OGL – BC | Yes, but **no addresses** |
| Ontario HCRA | ~5,000 new-home builders | No | Commercial reproduction barred | **No** |
| Technical Safety BC | Gas/electrical/boiler | No | Written permission required; `Disallow: /search` | **No** |
| Saskatchewan ISC | Corporate registry | No | Automated tools "strictly prohibited" | **No** |
| Service New Brunswick | Corporate registry | No | Automated tools barred; paid | **No** |
| Skilled Trades Ontario | Individuals, not firms | No | Unverified | Wrong entity |
| ESA/ECRA, TSSA, BC Housing, MB, NL, PEI, NS | Partial | No | Mostly unverified | Not worth it |

---

## 5. The identity problem

A licence record carries a **legal** name. The van says something else. This
section says what `dedupe.js` would actually do with that, and it is not good
news.

### 5.1 What `dedupe.js` keys on

Four keys, strongest first, and only the first removes anything:

1. `sourceProvider:sourceRecordId` → **the same record**. Update in place.
2. Normalised **E.164 phone** → flag.
3. Registrable **domain** → flag.
4. `nameKey(businessName) | lowercased city` → flag.

Steps 2–4 set `possibleDuplicateOfId` and write the row anyway. The schema
comment is emphatic about why: *"Merging destroys provenance, and a wrong merge is
unrecoverable."*

### 5.2 What works

**Phone is the workable key, and it is the only strong one.** RBQ phones are bare
ten digits (`8194186550`). `normalisePhone()` → `toE164()` maps a 10-digit string
to `+1` + digits, giving `+18194186550`, and Overture's mixed bare-digit/E.164
spellings normalise to the same thing. **94.7% of the sample carries a phone.** So
a large majority of RBQ rows would land on the same key as their Overture twin and
flag correctly.

`sourceRecordId` is trivially available and stable: the licence number. Because
`Prospect`'s unique index is `(sourceProvider, sourceRecordId)`, an RBQ row and an
Overture row for the same firm **coexist as two rows, one flagging the other** —
which is precisely the owner's "one canonical business with source rows beneath
it", except for the part where there is no canonical business (see §6.4).

### 5.3 What does not work — EXECUTED, not reasoned

`nameKey()` lowercases and then does `.replace(/[^a-z0-9]+/g, " ")`. **Accented
characters are not in `[a-z0-9]`, so they are replaced with a space**, shattering
the word. Run against realistic Quebec name pairs:

```
MISS  "Rénovations Éclair inc."      -> "clair novations r"
      "RENOVATIONS ECLAIR INC."      -> "eclair renovations"

MISS  "Peinture Bélanger"            -> "b langer peinture"
      "PEINTURE BELANGER"            -> "belanger peinture"

MISS  "Céramique Côté enr."          -> "c enr ramique t"
      "Ceramique Cote"               -> "ceramique cote"

MISS  "Plomberie L'Éclair ltée"      -> "clair e l lt plomberie"
      "Plomberie Leclair Ltee"       -> "leclair ltee plomberie"

MISS  "Les Constructions Jean Tremblay inc."  -> "constructions jean les tremblay"
      "Construction Jean Tremblay"            -> "construction jean tremblay"

MATCH "Acme Painting Inc."           -> "acme painting"
      "The Acme Painting Company"    -> "acme painting"
```

```
"Québec"  -> "bec qu"      "Éclair"  -> "clair"     "Bélanger" -> "b langer"
"Côté"    -> "c t"         "Rénovation" -> "novation r"
```

**Three separate defects, all of which only show up on French data:**

1. **No accent folding.** `"Québec"` becomes the tokens `bec` and `qu`. Every
   accented Quebec business name produces a garbage key, and the fragments are
   short enough to collide across unrelated businesses.
2. **`NOISE_WORDS` is English-only.** It has `inc`, `ltd`, `co`, `the`, `and`. It
   does not have `ltée`, `enr`, `cie`, `les`, `le`, `la`, `des`, `du`, `et`. "Les
   Constructions Jean Tremblay" and "Construction Jean Tremblay" are different
   keys because of `les`, and separately because of the plural `s`.
3. **The city key is not folded either.** `fuzzyKey()` does
   `.trim().toLowerCase()` and nothing else, so `"Trois-Rivières"` and
   `"Trois-Rivieres"` are two different localities.

**This is a pre-existing bug that Quebec data merely reveals.** It is already wrong
for the accented Franco-Ontarian names in the current Overture ingest — nobody has
had a reason to look. Fixing it is a `String.prototype.normalize("NFD")` plus a
combining-mark strip in `nameKey()` and in `fuzzyKey()`'s city, plus French noise
words, and it is a change to a pure function with an existing check script
(`scripts/check-sales-discovery.mjs`) to drive it. **It must land before any RBQ
ingest, not after** — every row written under the broken key is a flag that was
never raised, and re-running dedupe over existing rows is not something the ingest
path does.

### 5.4 The two-names problem, and what RBQ gives us for it

RBQ carries **`Nom de l'intervenant`** (the legal name) and **`Autre nom`** (the
other name — the trade name, the name on the van). `Autre nom` is populated on
**26.2%** of the sample.

That is a genuine gift and the current shape cannot hold it. `DiscoveredBusiness`
has one `name`. `Prospect` has `businessName` and `rawName`, and `rawName`'s
schema comment defines it as *"what the source called it, before normalisation"* —
it is the pre-normalisation spelling of the *same* name, not a second name. There
is nowhere to put an alias, and `dedupe.js` has no notion of trying more than one.

The cheap, honest move for a first version: when `Autre nom` is present, emit it as
`name` (the van name is what a rep should read aloud and what Overture is most
likely to hold) and record the legal name as a `ProspectEvidence` fact. When it is
absent, emit the legal name. **Say so in the provider's header**, because it is a
decision that changes what a rep sees.

The right move, later, is §6.4.

### 5.5 A key `dedupe.js` does not have

RBQ carries an **email address on 88.6%** of records, and a **NEQ on 99.1%**.

- **Email** is a deterministic identifier as strong as a phone, and `dedupe.js`
  has no email key at all — because Overture's email fill is ~49% and nothing
  needed it. `suppressionRules.js` already has `normaliseEmail()` and
  `emailLookupKeys()`, so the normaliser exists; what is missing is
  `Prospect.email` (there is no such column) and a fifth entry in `dedupeKeys()`.
- **NEQ** is the Quebec enterprise number: a stable government identifier that
  survives a rename, which is the exact thing name matching cannot do. It has no
  home in the schema at all, and it is the single most valuable field in the file
  for a multi-source registry.

---

## 6. Implementation shape, against the interface that exists

### 6.1 What is genuinely just a new file

Per `provider.js`'s header: *"Adding a second provider… is a new file that calls
registerDiscoveryProvider and an entry in providers/index.js."* That holds.

- `lib/sales/discovery/rbq/provider.js` — `key: "rbq_qc"`, label
  *"Quebec RBQ licence register"*, description naming the source **and its
  licence**, because `provider.js` says a superadmin choosing a source is choosing
  a licence.
- `lib/sales/discovery/rbq/snapshot.js` — the reader and `toDiscoveredBusiness()`.
- `import "./rbq/provider";` in `lib/sales/discovery/providers.js`.
- Additions to `trades.js` `sourceCategories`, narrow ones only (§6.3).

Nothing in `lib/sales/pipeline/` changes. Nothing in `ingest.js`, `normalise.js`,
`funnel.js` or `classify.js` changes to make a first version run.

### 6.2 Transport: reuse Overture's offline-snapshot pattern

Not because the file is big — 11 MB compressed is nothing next to Overture's
9.76 GiB — but for three reasons that are about correctness:

1. **It is a ZIP, and Node cannot read one.** The alternative is the 87.5 MB
   uncompressed JSON on every run.
2. **The `release` concept has to carry the retrieval date.** Overture has a named
   release; RBQ has only "whatever was on the server this morning". The snapshot
   manifest is where that date is recorded, and the owner's plan requires
   *"source, licence, retrieval time and confidence"* per source row. A provider
   that fetched live would stamp today's date on a run that read yesterday's cache.
3. **Yesterday's file is the only revocation signal there is** (§3.4). Keeping
   snapshots keeps the diff possible. A live fetch throws it away.

So: `scripts/rbq-snapshot.mjs`, producing the same NDJSON-with-a-manifest-on-line-1
format `snapshot.js` already defines, with `release` set to the file's
`Last-Modified` (e.g. `2026-09-03T07:00:18Z`). `providerConfig.snapshotUrl`, same
field, same `describeConfig` validation, same honest refusal when it is absent.

`currentRelease()` is a plain `HEAD` against the Données Québec URL reading
`Last-Modified` — which gives the campaign screen the same "your snapshot is N days
behind" it has for Overture, and it is cheaper here than there.

### 6.3 The `DiscoveredBusiness` mapping

| `DiscoveredBusiness` | From | Notes |
|---|---|---|
| `sourceRecordId` | `Numéro de licence` | stable; drives the update-in-place path |
| `name` | `Autre nom` ?? `Nom de l'intervenant` | §5.4 — a decision, documented in the header |
| `categories.primary` | `"rbq:" + subclass` | **only where one-to-one** — §6.3.1 |
| `categories.alternate` | the remaining subclasses | stored on `sourceCategories`, unmapped |
| `taxonomyHierarchy` | `[]` | RBQ has no hierarchy. `[]`, per the interface. |
| `phones` | `[Numéro de téléphone]` | bare 10 digits; `normalisePhone` handles it |
| `websites` | `[]` | RBQ has none. `hasWebsite` stays `null`. |
| `emails` | `[Courriel]` | 88.6% — but see §7 before anything is sent to one |
| `address.city` | `Municipalité` | clean, do **not** parse it out of `Adresse` |
| `address.province` | `"QC"` | constant, and honest |
| `address.country` | `"CA"` | constant |
| `address.line` / `postalCode` | parsed from `Adresse` | a parser; drive it with the check script |
| `latitude` / `longitude` | `null` | none in the source. Radius territories exclude these rows. |
| `operatingStatus` | `null` | **not** `"Active"` — it is a constant and carries nothing |
| `sourceConfidence` | `null` | RBQ states none, and inventing 1.0 would be padding |
| `sourceDataset` | `Mandataire` | `Regie` / `CMEQ` / `CMMTQ` — the field is exactly what `sourceDataset` means |
| `sourceUpdatedAt` | the file's `Last-Modified` | the same for every row, and true |

**With no home in `DiscoveredBusiness` or `Prospect`:** `Numéro de licence` as a
licence (as opposed to a record id), `Statut de la licence`, `Date de délivrance`,
`Date du paiement annuel`, `Restriction` + its two dates, `Montant de la caution`
and its provider, `NEQ`, `Statut juridique`, `Type de licence`,
`Région administrative`, `Nom de l'intervenant` when `Autre nom` won, and the
subclass list itself.

`ProspectEvidence` will hold every one of them today — `type: "registry_field"`,
`source: "registry"` (already a documented value in the schema comment),
`sourceUrl` the Données Québec resource, `detector: "rbq"`, `detectorVersion` the
snapshot release. That is not a workaround; it is what the evidence table is for,
and it means a first version ships without a migration. What it does not give is a
queryable "licence active" — you cannot filter a queue on evidence rows sanely —
which §6.4 addresses.

#### 6.3.1 Trade mapping: start narrow and say so

Given §3.6, the honest first version maps **only the subclasses that identify one
trade**: `15.5 → plumbing`, `16.0 → electrical`, the 15.x heating/ventilation
cluster `→ hvac`, `2.5 → excavation`, `3.1/3.2/4.1 → masonry_concrete`. Everything
else emits `categories.primary: null` and lands in `unmappedCount`.

That is a small yield, and the campaign funnel will say so out loud —
`unmappedCount`'s schema comment exists precisely so *"a gap in the trade map shows
up as a number instead of as a quietly smaller campaign"*. **Do not widen it by
mapping 9.0 to `painting`.** Four in five Quebec contractors carry 9.0.

### 6.4 What is actually missing from the schema

The owner's plan is *"one canonical business with source rows beneath it, each
with source, licence, retrieval time and confidence"*. `Prospect` is not that
shape. It is one row per `(sourceProvider, sourceRecordId)` with the provenance
fields **on** the row, and cross-source relationships expressed as a nullable
`possibleDuplicateOfId` flag for a human.

That design is right for one source and it starts to strain at two. Concretely
missing:

1. **A canonical business.** Two source rows for one firm are two `Prospect`s. A
   rep sees both. Nothing stops two reps claiming one from each.
   `possibleDuplicateOfId` flags it; nothing resolves it.
2. **Per-field provenance.** `sourceProvider` is per *row*. The plan says per
   *field* — "never let a website overwrite a government record". Today an RBQ row
   and an Overture row simply do not interact, which is safe but is not the plan.
3. **`Prospect.email`.** No such column. RBQ hands us one on 88.6% of records and
   there is nowhere to put it except evidence, where nothing can dedupe on it or
   suppress against it.
4. **A licence layer.** Number, status, issue date, restriction, issuing body,
   trade classes. Queryable, or "verified active" in STATUS.md's five-count
   framing is unimplementable.
5. **A stable external identifier.** NEQ here; a BN elsewhere. The thing that
   survives a rename.
6. **A retirement signal.** RBQ says nothing about a licence that lapses; it just
   stops appearing. Nothing today diffs one snapshot against the last.

**None of these should be built speculatively.** They are listed so the first
version is understood as deliberately narrower than the plan, rather than as the
plan half-done. The order in §8 defers all six until a source is actually
ingested and the shape is felt rather than predicted.

---

## 7. Licence terms and CASL — what may be stored, shown, and contacted

### 7.1 The compliance table

| | ODBus | RBQ | Alberta prepaid | Corporations Canada |
|---|---|---|---|---|
| Licence | OGL – Canada 2.0 | CC BY 4.0 (Données Québec) | OGL – Alberta | OGL – Canada 2.0 |
| May we store it? | Yes — "distribute or otherwise use… for any lawful purpose" | Yes — "distribuer, remixer, arranger et adapter… même à des fins commerciales" | Yes (OGL) | Yes, same clause |
| For how long? | No time limit | No time limit | No time limit | No time limit |
| Commercial use? | Yes, unrestricted | Yes, explicitly | Yes (OGL) | Yes, unrestricted |
| Redistribute inside a product? | Yes, with attribution | Yes, with attribution **as a licence condition** | Yes, with attribution | Yes, with attribution |
| Shown to a rep? | Yes, credited, **no implication of official status or endorsement** | Yes, source and licence credited | Yes — and the disclaimer that a licence "doesn't represent an endorsement" should be shown with it | Yes, credited |
| **May the businesses be contacted?** | **The licence does not answer this. CASL does.** | **Same.** | **Same.** | **Same.** |

The three sources that are *not* in this table — Ontario HCRA, Technical Safety
BC, Saskatchewan ISC and Service New Brunswick — are absent because there is
nothing to put in the "may we store it" row. Their terms bar the acquisition, so
the downstream questions never arise. **A source we cannot legally prospect from
is worthless here however complete it is**, and that applies to the acquisition
step as much as the contact step.

That last row is the one that matters and it is the one the owner's constraint is
pointing at. **An open-data licence grants copyright permissions. It does not
grant permission to solicit the people in the file, and nothing in either licence
purports to.**

### 7.2 CASL, and the question that needs a lawyer

CASL (S.C. 2010, c. 23) makes it an offence to send a commercial electronic
message without consent. Implied consent by conspicuous publication, quoted from
s. 10(9)(b) at `laws-lois.justice.gc.ca/eng/acts/E-1.6/`:

> "the person to whom the message is sent **has conspicuously published, or has
> caused to be conspicuously published**, the electronic address to which the
> message is sent, the publication is not accompanied by a statement that the
> person does not wish to receive unsolicited commercial electronic messages at
> the electronic address and the message is relevant to the person's business,
> role, functions or duties in a business or official capacity"

(Emphasis mine.)

**Here is the problem, stated as a question rather than answered.** The RBQ file's
88.6% email fill is published by *the Régie*, as a statutory register. The
licensee supplied the address to the RBQ as a condition of holding a licence. Did
that licensee thereby *"cause it to be conspicuously published"*?

**I do not know, and I am not going to reason my way to a comfortable answer.** The
arguments run both ways: it is undeniably public, permanently, at the licensee's
own initiative in supplying it — and it is equally arguable that supplying an
address to a regulator under compulsion is not "causing publication" in the sense
s. 10(9)(b) means. The CRTC's own guidance
(`crtc.gc.ca/eng/com500/guide.htm` — I was served HTTP 403 fetching it directly on
2026-09-03 and am relying on the ISED and CRTC summaries) is emphatic that
conspicuous publication is a **higher standard than mere public availability** and
does not license contacting any address found online, and that **the sender bears
the onus of proving consent**.

**This is a product decision requiring counsel, not an engineering decision.** Per
AGENTS.md, saying so rather than picking one. Three consequences for the design,
which hold whichever way it is answered:

1. **Store the email; gate the sending.** Ingesting the address is a copyright
   question and both licences answer it yes. Sending to it is a CASL question. The
   two must not be conflated in one boolean.
2. **The evidence has to be recorded at ingest.** Under CASL the sender proves
   consent. If the eventual basis is conspicuous publication, the proof is *"this
   address appeared in the RBQ open-data file of 2026-09-03 at this URL, under this
   licence"* — which is exactly a `ProspectEvidence` row with a `sourceUrl` and an
   `observedAt`, and `AUDIT-compliance.md` already identifies the recorded source
   URL as the CASL evidence. **It cannot be reconstructed later**; the file changes
   daily and yesterday's is gone.
3. **`AUDIT-compliance.md` already flags that consent basis is not recorded per
   lead.** A second source with a different and arguable basis makes that gap
   materially worse. A per-prospect consent basis should land with, or before, the
   first source whose basis is not "we found their website".

Phone is a different regime — the CRTC's National DNCL and its internal-DNC
obligations, not CASL — and `lib/sales/callingWindow.js` and `smsWindow.js`
already exist. Nothing about RBQ changes that analysis. Note only that a *business*
number is generally outside the National DNCL, which is why the internal list is
the one that does the work.

### 7.3 How a new source feeds the suppression machinery

`lib/sales/suppressionRules.js` is pure and provider-neutral. Nothing in it needs
to change, and that is the point of it. Three things a new source must do:

1. **Normalise through the same functions.** `normalisePhone` and `normaliseEmail`
   from `suppressionRules.js`, not a local copy. `normalise.js`'s header spells out
   the consequence of a second normaliser: *"a business that told FieldQuo to stop
   would be dialled again"*. RBQ's bare-10-digit phones go through `toE164`
   unchanged, so this is free.
2. **Check before the queue, not at ingest.** A `SalesSuppression` row is keyed on
   `email` / `phone` / `domain` and scoped to nothing — not a rep, not a campaign,
   not a source. So a contractor who told us to stop after an Overture-sourced call
   in March must not surface as a "new" prospect in September because RBQ supplied
   the same number under a different `sourceRecordId`. **The unique index makes the
   second row a legitimate insert.** The suppression check therefore has to live
   between the prospect and the rep — where `outreachReadiness.js` and the queue
   gate are — and adding a second source is the event that makes that
   non-theoretical. **Verify it is there before ingesting; do not assume it.**
3. **Feed the list from the source.** RBQ's `Restriction` field is a regulator
   saying something is wrong with a licence. It is not a do-not-contact request and
   must not be written as one — `SUPPRESSION_SOURCES` has `regulator` for actual
   DNC lists, and stretching it here would put a row in the list that nobody asked
   for and that no one could explain to the person it silences. Record the
   restriction as evidence; leave suppression to requests.

---

## 8. Recommended order of work, and why this order

Ordered by "what would we regret not knowing", not by size.

**1. Fold accents in `dedupe.js`. Pure functions, no source needed.**
`nameKey()` and `fuzzyKey()`'s city both need NFD normalisation plus a
combining-mark strip, and `NOISE_WORDS` needs the French corporate suffixes. Drive
it from `scripts/check-sales-discovery.mjs` with the pairs in §5.3. **First,
because it is already wrong today** for accented names in the current Overture
data, and because every RBQ row written before the fix is a duplicate flag that was
never raised and will not be re-raised.

**2. Run the Alberta prepaid-contractor export. Ten minutes, no code.**
`servicealberta.gov.ab.ca/find-if-business-is-licenced.cfm`, licence type
"Prepaid Contractor", download the Excel. **Look at the columns.** If it carries
addresses and phones, Alberta is the best-scoped, best-licensed contractor source
in Canada and it outranks everything else in this list — its statutory scope
includes landscaping, which RBQ's does not, and the export is offered by the
operator so no terms question arises. If it is name-and-status only, it is OrgBook
with a better scope and the question closes. **Cheapest decisive action in this
document, and nothing depends on it being done later.**

**3. Unzip ODBus and answer four questions. One afternoon, no code.**
Province and municipality coverage; NAICS fill and digit depth; how many rows fall
in NAICS 23 and 5617; what `Status` means. §2.6. **Cheap and decisive** — if
Quebec and Ontario are thin, ODBus is not worth a provider and the question closes
permanently rather than being re-asked every quarter.

**4. Put the CASL question to counsel, in writing.** §7.2. Ask specifically
whether a business email published by a provincial regulator in a statutory
register constitutes the licensee having "caused it to be conspicuously published"
under s. 10(9)(b). **Before** an email column exists, so the answer shapes the
schema rather than being retrofitted onto data already collected. And ask the RBQ
directly whether it objects to bulk commercial solicitation of its licensees
(§3.2) — the licence permits it; their posture is a separate and cheaper thing to
learn now than after the first complaint.

**5. Confirm the suppression check sits between the prospect and the rep.**
§7.3(2). A read, not a change, unless it is missing. Second source, second row for
one business, one opt-out that has to bind both.

**6. Build the first non-Overture provider — RBQ, narrow.** `scripts/rbq-snapshot.mjs` plus
`lib/sales/discovery/rbq/`. Trade mapping restricted to the one-to-one subclasses
of §6.3.1. Emails stored, **sending gated on step 3**. Accept a small
`acceptedCount` and a large `unmappedCount` — the funnel is built to show exactly
that, and a small honest number is the point.

Expected shape from §3.5, on a sample that is not random: roughly 90% of ingested
rows call-ready with no crawl and no purchase, daily freshness, at zero cost. The
narrow trade map is what limits the yield, not the data.

**RBQ rather than Alberta, unless step 2 says otherwise.** RBQ is verified in
detail here — fields, fill rates, cadence, licence — and Alberta is not. If step 2
shows the Alberta export carrying contact data, reverse them: better scope, no
codebook problem, and no accented-name problem either.

**7. Measure the overlap before building anything else.** With the first source ingested,
count how many rows flag against an existing Overture prospect by phone. **That
number is the answer to the question this whole document is about** — whether
government data reaches the 81% of Quebec contractors Overture misses, or merely
re-finds the 19% it already has. Everything in §6.4 should wait for it. A canonical
business layer built before that number is known is a guess about a shape nobody
has seen.

**8. Then, and only then, the schema work of §6.4** — in the order the overlap
measurement argues for.

**Explicitly not recommended, with the reason:**

- **A Corporations Canada provider.** Federal CBCA only, no trade field of any
  kind, registered office frequently the accountant's. It is a *verification*
  layer — "is this a real registered entity" — not discovery. §4.5.
- **OrgBook BC.** Best licence in the survey, no addresses. §4.2.
- **Any sweep of Ontario HCRA, Technical Safety BC, Saskatchewan ISC or Service
  New Brunswick.** Their terms bar it in writing, quoted in §4. This is not a
  risk assessment; it is a rule.
- **Geocoding RBQ addresses through Google.** RBQ has no coordinates, so radius
  territories exclude every row. Fixing that means sending Canadian business
  addresses to a third party under the same key that powers address autocomplete
  and Solar roof measurement in the live contractor product. **That is a product
  decision, not an enrichment step**, and it needs the owner. Province- and
  city-scoped territories work today without it.

---

## 9. Everything in here I could not verify

Listed together so it cannot be skimmed past.

- **ODBus contents.** I did not open the 21.9 MB archive. Field fill rates,
  province coverage, NAICS depth, the meaning of `Status`, and the NAICS-23 subset
  size are all unknown. §2.6.
- **RBQ record count in the file.** 53,662 is the RBQ's own published figure for
  2024–2025 (entrepreneurs + corporation-issued), not a count of the file. I did
  not count the file.
- **RBQ fill rates are from a non-random 1,232-record sample** taken from three
  byte offsets of a file that appears to be ordered by licence number. §3.5.
- **Whether `Statut de la licence` ever holds a value other than `Active`.**
  Constant across 1,232 records; the dataset is titled "licences actives", so
  probably by construction — but "probably" is not verified.
- **The RBQ's own terms of use for its web register**, as distinct from the
  open-data licence. Not found, not read. §3.2.
- **CRTC guidance page `crtc.gc.ca/eng/com500/guide.htm`** returned HTTP 403 on
  direct fetch on 2026-09-03. The s. 10(9)(b) text is quoted from the statute
  itself (`laws-lois.justice.gc.ca`), which I did read; the CRTC's *interpretation*
  of it is from ISED and CRTC summary pages, not the guidance document.
- **Whether a regulator-published business email supports CASL implied consent.**
  Open legal question. §7.2.
- **What the Alberta prepaid-contractor Excel export actually contains.** Nobody
  has run it. Whether it carries addresses, phones or trade detail is the single
  most consequential unknown in this document, and it is ten minutes' work. §4.3.
- **Ontario Builder Directory terms of use** — JavaScript-only page, no text
  returned to a fetch. §4.1.
- **Nova Scotia RJSC bulk-use restriction** — primary page returned HTTP 403.
  Secondary reporting says the terms changed in 2015; unconfirmed. §4.4.
- **ESA/ECRA contractor finder** — HTTP 503 on two attempts. Its full-disclaimer
  PDF was not retrieved. §4.1.
- **Ontario Business Registry bulk product** — a search snippet claimed one
  exists; not found on ontario.ca. §4.1.
- **Skilled Trades Ontario, Newfoundland CADO, PEI OCBR terms** — not found or
  not fetchable. §4.1, §4.4.
- **`open.alberta.ca`** — HTTP 520 on three attempts; the Alberta open-data
  listing was read from the open.canada.ca mirror instead. §4.3.

---

*Sources, all retrieved 2026-09-03:*
*[StatCan ODBus](https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm) ·*
*[StatCan LODE index](https://www.statcan.gc.ca/en/lode/databases) ·*
*[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada) ·*
*[RBQ active licences, Données Québec](https://www.donneesquebec.ca/recherche/dataset/licencesactives) ·*
*[same dataset on open.canada.ca](https://open.canada.ca/data/en/dataset/755b45d6-7aee-46df-a216-748a0191c79f) ·*
*[Données Québec licence page](https://www.donneesquebec.ca/licence/) ·*
*[RBQ en bref](https://www.rbq.gouv.qc.ca/salle-de-presse/la-rbq-en-bref/) ·*
*[RBQ specialized contractor subclasses](https://www.rbq.gouv.qc.ca/en/licence/determining-your-licence-subclasses/specialized-contractor/specialized-contractors-licence-subclasses/) ·*
*[CASL, S.C. 2010, c. 23](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/) ·*
*[CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm) ·*
*[Ontario Builder Directory](https://obd.hcraontario.ca/) ·*
*[HCRA builder portal terms](https://builderportal.hcraontario.ca/en-US/terms-of-use/) ·*
*[Technical Safety BC licensed contractors](https://www.technicalsafetybc.ca/regulatory-resources/licensed-contractor-guide) ·*
*[OrgBook BC API](https://orgbook.gov.bc.ca/api/v4/) ·*
*[Alberta prepaid contracting licence](https://www.alberta.ca/prepaid-contracting-licence) ·*
*[Service Alberta licence search](https://www.servicealberta.gov.ab.ca/find-if-business-is-licenced.cfm) ·*
*[Alberta licensed businesses dataset](https://open.canada.ca/data/en/dataset/1b6cb20b-5d1d-443d-8e04-28558e9277f3) ·*
*[ISC Saskatchewan legal terms](https://www.saskregistries.ca/about/legal) ·*
*[Service New Brunswick corporate registry](https://www2.snb.ca/content/snb/en/sites/corporate-registry/registry.html) ·*
*[Corporations Canada federal corporations dataset](https://open.canada.ca/data/en/dataset/0032ce54-c5dd-4b66-99a0-320a7b5e99f2)*
