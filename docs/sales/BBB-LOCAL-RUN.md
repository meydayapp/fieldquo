# Reading BBB profiles from your own Mac

`scripts/bbb-principal.mjs` opens bbb.org in a real Chrome window on your
machine, at a human pace, for the leads reps are working, and records who
to ask for — the principal contact, their title, years in business, the
BBB rating, accreditation, the entity type — on each lead.

It exists because bbb.org answers **403 with a Cloudflare challenge** to
every request that is not a browser (measured 2026-09-17: a plain fetch, a
fetch with a full Chrome header set — both). Its robots.txt allows the
profile pages; only a browser can read them. So this is not a scraper on a
server. It is a batch tool for **worked leads**, run from a home connection,
one search and one profile every three to five seconds, that stops the
moment BBB challenges it. Never the pool.

## The command

```bash
cd ~/StudioProjects/fieldquo
npm run bbb:principal -- --claimed            # every open claim, all reps
npm run bbb:principal -- --next 60            # …then the trades being worked, in dispatch order
npm run bbb:principal -- --next 60 --state NY,FL,CA   # only those states (repeatable; --province QC the same)
npm run bbb:principal -- --plan --claimed     # print the order; open nothing
npm run bbb:principal -- --claimed --resume   # continue an interrupted run
npm run bbb:principal -- --ids <prospectId>   # one lead
```

`--state NY,FL,CA` is the same regional pass `scripts/scrape/maps.mjs`
takes (`lib/sales/intel/enrichmentOrder.js`, "A regional pass"): the batch
is the enrichment order with every prospect outside those states removed
before it is ranked — held leads there, then next-in-dispatch there, nothing
from anywhere else — and the first line printed says how many were skipped.
`--ids` ignores it: a person naming a row gets that row. The profile parser
reads "Number of Employees" (the <dl> and the JSON-LD `numberOfEmployees`),
"Business Incorporated" and "Years in Business" when the page carries them;
BBB shows the employee count on a minority of profiles (one of the 54
matched in production; two of three opened by hand on 2026-09-21 had none),
so `Prospect.employeeRange` fills where BBB says and stays null where it
does not.

`npm run bbb:principal` is
`node --experimental-websocket --env-file-if-exists=.env --import ./scripts/alias-loader.mjs scripts/bbb-principal.mjs`
— the WebSocket flag is for Node 20, the rest is how every `scripts/check-*.mjs`
runs. `.env` carries `DATABASE_URL`, so the script reads the batch straight
through `lib/sales/intel/enrichmentOrder.js` and writes each result through
`lib/sales/intel/bbbApply.js` — the same server-side re-match and the same
never-overwrite path as the upload route. No token, no cookie, no password.

About 3–4 seconds a lead when the search misses, 8–10 when a profile is
opened. 119 claimed leads is roughly ten to fifteen minutes.

### Flags

| Flag | What it does |
|---|---|
| `--claimed` | Every prospect with an open claim (tier 1 of the enrichment order). The default. |
| `--next N` | Tier 1, then up to N rows of the trades being worked, in the order the dispatcher would hand them out (`lib/sales/intel/enrichmentOrder.js`). |
| `--ids a,b,c` | Specific prospects, whatever their state. |
| `--plan` | Print who it would visit and in what order, with the search URL. Opens nothing, writes nothing. |
| `--headless` | No window. Use only after a visible run has passed the challenge once — the profile directory keeps the cookies. |
| `--resume` | Skip prospects already in the output file. |
| `--out FILE` | The JSON-lines file (default `./bbb-principal-YYYY-MM-DD.jsonl`, appended). |
| `--no-db --batch FILE` | No database on this machine: read the batch from the JSON a superadmin saved from `GET /api/platform/sales/prospects/bbb-batch?scope=claimed`, write the JSONL only, then upload it on `/platform/sales/prospects → Upload BBB results`. |

Rows checked in the last 180 days are left out of `--claimed` and `--next`
(`Prospect.bbbCheckedAt`); `--ids` ignores the stamp.

## What it does per lead

1. Opens `bbb.org/search?find_text=<name>&find_loc=<city, ST>`.
2. Reads the search page's JSON-LD list (every result with city and phone)
   and picks the one profile that **is** this business by the same rule the
   Google Places check uses (`lib/sales/intel/listingMatch.js`): name tokens
   overlap **and** the city, postal code or phone agrees. No confident
   match — the top candidate is recorded on the lead's evidence and refused.
   Ads on the page are not in the JSON-LD and are never opened.
3. Opens the profile, parses it (`lib/sales/intel/bbbProfile.js`: the
   schema.org block first, the Business Details list second).
4. Writes: `ProspectPerson` rows (source `bbb`, one per name, never
   overwritten), the profile URL, rating, accreditation, started year,
   employee band, entity type — blank-only; a website the register did not
   have (and queues the crawl); a phone that differs as a second
   `SalesContactNumber`, never over the record's. Every fact has a
   `ProspectEvidence` row citing the profile URL.
5. Appends one JSON line to the output file. Waits 3–5 s. Next.

The per-run summary at the end:
`N visited, N matched, N no match, N refused by the server's re-match, N already known, N people added`.

## When BBB challenges

The script prints which lead it was on, says how many it did, writes
nothing more and exits with code 3. Pass the challenge in the Chrome window
(it is a real window; click through), then run again with `--resume`. The
profile lives in `~/Library/Application Support/fieldquo-bbb-profile`
(`BBB_PROFILE_DIR` to move it), so a challenge passed once stays passed.
Do not add retries, proxies or a headless-first run: a person reading BBB
is the whole basis for this tool.

## The rep card

The lead's card leads with the best name (`lib/sales/intel/people.js`:
what a rep typed beats BBB, BBB beats a register's officer list), names its
source and date, and lists the others under "Also listed". The "BBB" row
prints the facts in one line — `in business since 2009 · A+ accredited ·
corporation` — with a link to the profile, or a BBB search by name and
city when nothing matched, for the rep to open by hand.

## Proof it ran

AMS PLUMBING & DRAIN, Lakeside CA (the lead that started this): search
found the profile among 9 results (position 7, behind two ads), the
server's re-match accepted it on name + postal code + phone, and the lead
gained Alexander Singer (Owner) and Monica Williams (Director) from BBB
beside Alexander Matthew Singer (RMO/CEO/President) and Monica Macera
Williams (Officer) from the CSLB personnel file, plus the website
`amsplumbinganddrain.com`, rating A+, not accredited, started 2021,
Corporation. A second run: `already_known`, nothing written.
