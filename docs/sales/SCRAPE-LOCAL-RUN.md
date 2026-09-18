# Google Maps, read from the Mac

`scripts/scrape/maps.mjs` is a home-machine batch tool. It opens the Mac's
own Chrome, searches Google Maps for a trade in a place the way a person
would, opens each listing, and hands what it read to the same
never-overwrite fill the paid Places check uses. It exists for the trades
being worked: the first pairs it runs are the trade × city of the leads reps
currently hold, so a rep's next dial has Google's phone, website, rating
and hours beside the register's row.

It is modelled on Apify's `compass/crawler-google-places` — the same
inputs, the same technique, the same answer to a county — and costs
nothing per place. The owner's decision, 17 September 2026: it runs on
**his Mac**, from **his home IP**, in **real Chrome**, at a **human pace**.
No proxies, no cloud, no headless farm. What it reads is what a person
sitting at that desk could read.

## Commands

All from the repo root. `.env` supplies `DATABASE_URL` (production) and
the Maps key the geocoder uses for a location's bounds.

```bash
# One trade in one place, twenty listings, the window visible
npm run scrape:maps -- --term "plumber" --location "Lakeside, CA" --country US --max-per-term 20

# The enrichment order: held leads' trade × city, most held first
npm run scrape:maps -- --from-order --pairs 20

# Print the pairs and the viewport plan, open no browser
npm run scrape:maps -- --plan --from-order --pairs 20

# Carry on from the last run (or a named one)
npm run scrape:maps -- --resume
npm run scrape:maps -- --resume 20260918-040350Z

# Parse and match, write nothing
npm run scrape:maps -- --term "roofing contractor" --location "Lockport, NY" --dry

# The checks: parser over saved panels (Chrome, headless), matcher, tiling, never-overwrite
npm run check:maps-scrape
```

Flags: `--term/--location/--country` repeat (equal lists zip, unequal
lists cross); `--max-per-term 120` caps the listings opened per (term,
location); `--headless` hides the window; `--lang en|fr|es` sets Maps'
language (hours and categories come back in it — use `fr` for Quebec);
`--zoom 14` is the tile zoom for a broad location; `--single` / `--tiles`
force one search or a grid; `--save-html DIR` keeps each detail panel for
fixtures.

## What one run does

1. **Pairs.** `--from-order` reads the open `SalesQueueClaim` rows and
   groups their prospects by trade × city, most held first, mapping the
   trade to a Maps search term (`MAPS_SEARCH_TERMS` in
   `lib/sales/intel/listings.js`: plumbing → "plumber"). This is the
   stand-in for `enrichmentOrder.js` (claimed leads, then the trades being
   worked, then next in dispatch) and is replaced by it when that lands.
2. **Bounds.** A location becomes a box: the static table for states,
   provinces and San Diego County; Google's geocoder otherwise (one
   request per location, 0.5¢, on the key `roofMeasurement.js` uses); the
   map's own `@lat,lng,zoom` if the geocoder is silent.
3. **Viewports.** Under 12 km across, the location is **one search** —
   `"plumber in Lakeside, CA"`, exactly as typed. Above it, the box is
   **tiled** at `--zoom` (14 ≈ 7 km viewports at 33°N) and each tile is
   its own search by URL: `/maps/search/plumber/@lat,lng,14z`. Google
   shows at most ~120 places per viewport however far the list scrolls;
   a tile that reaches that boundary without Google's end-of-list
   sentence is **saturated** and is split into four at the next zoom,
   down to 17z. A tile with no results is done at once. Dedupe across
   tiles and across terms is by place id.
4. **The feed.** Scrolled with the mouse wheel over the results panel,
   uneven distances, 2–4.5 s between scrolls, until the sentence
   "You've reached the end of the list." appears, the cap is reached, or
   four scrolls add nothing. Every link's place id, CID and pin are read
   from its URL.
5. **Each place.** Opened by URL, 2–6 s pause, the detail panel read by
   its stable anchors (`data-item-id="address"`, `phone:tel:`,
   `authority`, `oloc`, the rating's `aria-label`, the histogram's
   `tr[aria-label]`, the hours' `data-value`). Title, category, address,
   phone, website, plus code, rating, review count, star distribution,
   hours per day, closed banner, price bracket. **Not read:** reviews,
   reviewer names, photos — nothing the pipeline uses, and personal data
   we would then hold. `claimed` is `false` only when Google's "Own this
   business?" prompt was on the page; it is never inferred from absence
   (signed out, Maps rendered the prompt on none of the first run's 22
   panels).
6. **The write** (`lib/sales/intel/listings.js applyListing`). Candidates
   are pulled from `Prospect` by place id, phone, domain, and distinctive
   name words within the listing's city, postal code or 12 km. Each is
   scored with the **same rule as the Places check** (`scoreCandidate` in
   `places.js`: name tokens overlap ≥ 0.6 AND the address agrees), plus
   two identity signals a scrape can see — same E.164 phone or same domain
   with a distinctive word shared. A match writes through
   `planPlacesWrite`: blanks only — `googlePlaceId`, `domain`,
   `websiteUrl`, `hasWebsite`, `googleRating`, `googleReviewCount`,
   `businessStatus`, `latitude`/`longitude`, `phoneE164` when null; a
   differing phone becomes a `SalesContactNumber` labelled "Google Maps
   listing"; every field an evidence row with detector `maps.scrape:*`;
   hours in `placesResult`. A closed banner is a flag on the row, never a
   suppression. A gained website queues the crawl chain, as the Places
   path does. An unmatched listing is an `ExternalListing` row (`source`
   "google_maps", unique on the place id), a prospect-in-waiting, with the
   verdict and the top refused candidate beside it.
7. **The ledger.** The places parsed are metered onto `PlatformCostDaily`
   as `local_scrape / google-maps`, cents 0, units = places, so
   `/platform/costs` shows the volume beside what Places charges.

## Pacing

`scripts/scrape/lib/pace.mjs`: 2–6 s between page actions, jittered; wheel
scrolls of 500–1,400 px with an occasional small correction upward; the
mouse drifts between actions half the time. A pair of a few dozen listings
takes several minutes; a county takes hours. That is the design.

## What stops it

- **A challenge page** — `/sorry/`, "unusual traffic", a reCAPTCHA. The run
  stops at once (exit code 2), writes the summary, and nothing retries.
  Wait a few hours. Do not run it from a VPN or a cloud box to get round
  this: that is the thing the owner decided against.
- **The consent wall** (`consent.google.com`, some regions) is handled
  once — "Reject all" — and the profile under
  `~/Library/Application Support/fieldquo-scrape/chrome-profile`
  remembers it.
- **The cap** — `--max-per-term`, per (term, location).
- **The lid, the network, ⌃C** — the log is append-only JSONL under
  `~/Library/Application Support/fieldquo-scrape/runs/<runId>/events.jsonl`;
  `--resume` replays it, skips every place and tile already done, and
  carries the counts on.

## Reading a run

Each place prints one line: `✓` matched (with what was gained and which of
the record's values were kept over Google's), `+` no prospect row ("looks
like a new lead" when it has a phone, is not closed, and its category maps
to a trade), `~` refused with the reason and the top candidate, `!` a
conflict (the row already carries another place id, or another row carries
this one), `=` attached on an earlier run. The summary at the end, also in
`summary.json`, gives the totals: matched / refused / no row, fields
gained, conflicts kept, closed, unmatched lead-like by trade, and what was
metered.

## First live run (18 September 2026)

"plumber" in "Lakeside, CA", max 20, visible Chrome: the feed reached
Google's end-of-list sentence at 111 places; the first 20 were opened; 11
matched register rows (6 gained a website, 11 a rating and a place id, 1 a
second number), 3 refused with a reason, 5 had no row and look like new
leads, 1 was a second brand on a matched row's phone and was refused rather
than attached. AMS PLUMBING & DRAIN (8539 Amato Drive) was **not among the
111** — Google's nearest answer to its name is "AMS Plumbing and HVAC" with
a 315 number, kept as a listing, not matched.
