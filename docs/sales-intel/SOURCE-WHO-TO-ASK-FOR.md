# Who to ask for — the named person on a lead

*Built 2026-09-17/18. The rep card for a register-sourced lead showed no
person's name; a rep dialling "AMS PLUMBING & DRAIN" had nobody to ask for.
This records which sources carry a name, which of them can be read by a
machine, and what was measured.*

## Fetchability, measured

| Source | What it carries | Fetchable? | Status codes seen |
|---|---|---|---|
| **CSLB personnel file** (Data Portal, `DownLoadFile.ashx?fName=PersonnelData&type=C`) | licence no., person, titles, classes, association dates — 406,161 rows, 244,300 licences, 85.8 MB | **Yes**, bulk, free, public record. The edge closes the stream at ~90 s regardless of client: three downloads returned 85.8 MB, 55.0 MB and 13.9 MB. The loader refuses a cut file (no trailing newline / short last line / < 200,000 licences). | 200 |
| CSLB per-licence detail page (`CheckLicenseII/LicenseDetail.aspx?LicNum=`) | the same, one licence at a time | **No.** GET → 302 to the search form (a session from the form is required); the form's POST → 503 "The requested URL was rejected" from the F5 edge, with a bot UA, a Chrome UA and a seeded session alike. Not built. | 302, 503 |
| Washington L&I master file | `PrimaryPrincipalName` per row | Yes — already ingested; the name was read and dropped until now | 200 |
| Oregon CCB master file | `rmi_name` (responsible managing individual) | Yes — same | 200 |
| Quebec RBQ open dataset | licence, business, address, phone, email, NEQ, categories — **24 columns, no répondant/dirigeant** (read 2026-09-17) | The dataset carries nobody. The RBQ's lookup page shows répondants but is a page, not the dataset; not scraped. | 200 |
| **bbb.org profile** | Principal Contacts (name + title), Business Started, Type of Entity, Years in Business, employees, rating, accreditation, phone, website | **Browser only.** robots.txt allows `/us/*/*/profile/*/*`; the Cloudflare edge answers 403 `cf-mitigated: challenge` to a plain fetch and to a fetch with a full Chrome header set. The built-in browser read the page fine. | 403 |
| Apify `jungle_synthesizer/bbb-scraper` | the BBB fields above per (keyword, location), `principal_name`/`principal_title` with `enrichWithDetails` | Yes, paid: US$0.10 a start + US$0.002 a record (pay-per-event, read from the actor's pricing on 2026-09-17) | — |
| Apify `compass/crawler-google-places` | what a Places lookup gives, in bulk per (keyword, location) | Yes, paid: "from $1.50 / 1,000 scraped places", tiered; the run's own `usageTotalUsd` is what gets metered | — |

## Where the licence number is

`Prospect.licenceNumber` is written by the RBQ ingest only. The US boards
put the licence number in `sourceRecordId`. Measured: 217,927 `us_ca_cslb`
rows, every `licenceNumber` null, every `sourceRecordId` set. The lookup
key is `licenceNumber ?? sourceRecordId` (`registerLicenceNumber()` in
`lib/sales/intel/registerPeople.js`).

## What was built

- `ProspectPerson` — one row per (prospect, source, name), **never
  overwritten**; the card's lead is chosen at read time: typed › BBB ›
  register, then by role (owner, sole owner, president/CEO … officer …
  responsible managing *employee* last), then newest. `lib/sales/intel/people.js`.
- `RegisterPersonnel` — the CSLB personnel file, loaded whole by
  `npm run cslb:personnel` (28 s for 334,374 current people; a person with
  every stint ended is dropped at parse). Looked up per prospect by
  `lookupRegisterPeople()`, stamped `principalCheckedAt`, re-asked after 180 days.
- WA/OR: `principal` now travels from `usBoard/record.js` through
  `normalise.js` (beside the prospect, never inside it, like
  `derivedWebsite`) to `ingest.js`, which records it as a ProspectPerson
  after the row is written.
- BBB: `lib/sales/intel/bbbProfile.js` (parser, JSON-LD first), the local
  browser script (`docs/sales/BBB-LOCAL-RUN.md`), the upload route, and the
  Apify actor — all through `lib/sales/intel/bbbApply.js` /
  `listingMatch.js`, one server-side re-match (the Places rule, with a
  phone-agreement signal added to `placeAgreement`) and one never-overwrite
  write.
- Google Maps in bulk: `lib/sales/intel/apifyRuns.js` (`google_maps`),
  written through `planPlacesWrite` with `origin: maps.apify` so a matched
  lead is indistinguishable on the card from a Places-API lead and the
  per-claim Places call skips it.
- `ExternalListing` keeps every unmatched vendor row (one table, a source
  column) for a later ingest; `ApifyRun` is each pair's life and cost;
  spend is metered into `PlatformCostDaily` (`apify` / actor category).
- Order: `lib/sales/intel/enrichmentOrder.js` — open claims (all reps, queue
  order), then the trades being worked in dispatch order (researched first,
  `createdAt asc`, round-robin across trades), never the rest of the pool.
  The Places sweep, the register lookup, the BBB batch and the vendor pairs
  all read it. `/platform/sales/prospects` prints, per trade, how far ahead
  of the dispatcher each pass is.
- Surfaces: rep card "Who to ask for" (name, role, source, "Also listed",
  a BBB link, a typed field → `POST /api/sales/queue/people`, scoped by
  `queueWhere`), a "BBB" fact line; the script prompt gets `Ask for: <first
  name> (<role>)` (`directoryFacts.askFor`) and the full citation in WHAT WE
  KNOW via `brief.known`; the platform prospect page lists every person
  with its source.

## Measured on the claimed batch, 2026-09-18

138 open claims (27 `us_ca_cslb`, 102 Overture NY, 8 Overture QC, 1
Overture FL). Register lookup: **27 of 138 gained a name** — every CSLB
row, 32 people — and 111 are Overture rows with no register to ask.
AMS PLUMBING & DRAIN (licence 1090449): Alexander Matthew Singer, RMO/CEO/
President, C36; Monica Macera Williams, Officer. The BBB script, run once
from this Mac on that lead: search found the profile at position 7 of 9,
the re-match accepted it, 2 people added, website + rating + started year +
entity type gained; a second run wrote nothing (`already_known`).

## Not done, said plainly

- Apify runs were **not** exercised for real: `APIFY_TOKEN` is not in the
  local `.env`. Set it in Vercel; the first cron tick starts a BBB pair for
  the most-worked (trade, city). The token-less path was executed.
- The tier-2 (ahead-of-dispatcher) **Google Places** lookups are gated by
  `sales.places.aheadPerHour`, default 0, because each is a paid request
  the owner has not sized; the register lookup walks tier 2 freely.
- RBQ rows get a name only from BBB (Canada is supported by the actor:
  `country: "CAN"`) or from the rep.
