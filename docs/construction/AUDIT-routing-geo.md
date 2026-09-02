# Audit — routing, geolocation and fleet

Companion to `docs/construction/STATUS.md` §2, and the routing sibling of
`docs/sales-intel/AUDIT-compliance.md` §6. Same rule as both: if this file
disagrees with a memory or a summary, this file wins.

Written 2026-09-02. **Research only — no product code was changed.**

**Sourcing.** Every external claim below was read from the primary source on
2026-09-02 and the URL is cited inline. Where a page defeated automated
fetching I say so rather than filling the gap from memory. Google's own terms
pages carry a "last modified" date and I quote it, because the whole point of
§6 of the compliance audit is that these documents move.

---

## The short version

| Question | Answer |
|---|---|
| Does Google still sell Directions / Distance Matrix? | **Legacy since 1 March 2025.** Not available in new Cloud projects. FieldQuo calls one of them today. |
| Is there a real multi-stop optimiser? | **Yes** — Route Optimization API, a genuine vehicle-routing solver. Also `optimizeWaypointOrder` on Routes API for the single-van case. |
| **May an optimised route be stored?** | **No.** Latitude and longitude only, 30 days. Not the stop order, not the leg durations, not the ETAs. This is the finding that decides the design. |
| Can a browser clock someone in when they arrive? | **No.** Not on iOS, not on Android, not in any browser — and not because of a vendor's choice but because the Geolocation spec forbids it. |
| Is there a cheap 80% of route optimisation? | **Yes, and it is already written** — `lib/marketing/routeOrder.js`, pure, offline, free, and it persists nothing Google owns. |
| Does FieldQuo already hold employee location data? | **Yes**, on `CrewInboundMessage`, indefinitely, with no notice, no consent and no retention rule. |
| Is FieldQuo currently inside Google's caching terms? | **Probably not.** Geocoded lat/lng is stored indefinitely on five models; §6.3.1 caps it at 30 days. Detail in §2.4 — this predates the fleet question and is worth fixing regardless of whether any of this gets built. |

---

# PART 1 — What exists here already

## 1.1 How Google Maps is used today

Six call sites, all on the same key pair (`GOOGLE_MAPS_SERVER_KEY` falling back
to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — `lib/measure/roofMeasurement.js:49`).

| What | Where | Google product | Status |
|---|---|---|---|
| Address autocomplete | `app/components/AddressAutocomplete.js:74` | Maps JavaScript API + Places | live |
| Static mini-map | `app/components/MiniMap.js:36-43` | Maps Static API | live |
| Static map on the marketing designer | `app/app/marketing/[id]/page.js:54,74` | Maps Static API | live |
| Static map block on tenant websites | `app/site/[subdomain]/SiteBlocks.js:1103-1106` | Maps Static API | live |
| Geocoding a free-text address | `lib/measure/roofMeasurement.js:58-62` | Geocoding API | live |
| Roof measurement | `lib/measure/roofMeasurement.js:91` | **Solar API** | live |
| Lot/roof drawing in the instant quote | `app/instant-quote/[companySlug]/InstantQuoteFlow.js:166,236` | Maps JS API `drawing`, `geometry`, `Geocoder` | live |
| **Driving time between two points** | **`lib/booking/travel.js:126-134`** | **Distance Matrix API (Legacy)** | **live, and on a legacy endpoint** |

### `lib/booking/travel.js` is not what the brief assumed

The brief says travel.js is "pure, no API key". Half true, and the half that
isn't matters. The file exports two layers:

- **Pure, offline, free:** `hasPoint` (`:61`), `haversineKm` (`:75`),
  `estimateTravel` (`:91`), `reachable` (`:172`), `travelLegs` (`:205`),
  `describeTravel` (`:245`). `travelLegs` is deliberately offline — its own
  comment explains that paying Distance Matrix per element to render a
  schedule that re-renders on every page open would be "a bill with nothing to
  show for it."
- **Networked:** `travelMinutes` (`:126`) hits
  `https://maps.googleapis.com/maps/api/distancematrix/json` (`:134`) when a
  key is passed, and falls back to `estimateTravel` on any failure.

It is called with a key from exactly one place:
`lib/booking/computeAvailability.js:65`, keyed by `serverMapsKey()` at `:55`.
So the public booking page filters slots on **real** driving time; the
back-office schedule (`app/app/appointments/page.js:125`) uses the free
estimate. Every result carries `source: "driving" | "estimate"` and
`describeTravel` renders "25 min drive" vs "about 25 min" so a straight-line
guess can never be presented as a measurement. That discipline is worth
keeping; it is the model for everything below.

**The finding:** the one networked routing call in the product is on a Legacy
endpoint (§2.1). It works, it is fully supported for the existing project, and
it is feature-frozen and not available if the Cloud project is ever recreated.

## 1.2 Where coordinates are stored, and which are real

Seven `Decimal(9, 6)` lat/lng pairs in `prisma/schema.prisma`. Nullable
everywhere, correctly — `hasPoint` (`lib/booking/travel.js:61`) rejects
`(0,0)` explicitly because it is "the classic value for the geocode failed and
something wrote zeroes."

| Model | Line | Written by | Read by | Verdict |
|---|---|---|---|---|
| `Company` | 1104 | `app/api/settings/business-info/route.js:41,318` — geocoded on read and on save | MiniMap; pamphlet route seed (`app/api/marketing/campaigns/[id]/stops/route.js:29`) | **populated, read** |
| `Appointment` | 3089 | `app/api/booking/[companySlug]/confirm/route.js:310`; `lib/voice/availability.js:543` (voice booking) | `computeAvailability` travel filter (`:59`); `travelLegs` on the calendar; read back in `lib/booking/manageVisit.js:113` | **populated, read** |
| `Booking` | 4730 | `app/api/booking/[companySlug]/confirm/route.js:251,336`; `lib/voice/availability.js:573`; `lib/booking/settleBookingFee.js:102` | same | **populated, read** |
| `PamphletStop` | 4250 | `app/api/marketing/campaigns/[id]/stops/route.js` (typed or autocompleted) | `nearestNeighborOrder` | **populated, read** |
| `CrewInboundMessage` | 7359 | `lib/crew/inbox.js:468` from Twilio's `Latitude`/`Longitude` webhook params (`lib/crew/inboundParse.js:126`) | `attributeMessage` → `gpsMatch`, and the crew-inbox list | **populated (rarely), and the GPS read is dead — see §1.6** |
| `Prospect` | 8344 | `lib/sales/discovery/ingest.js:336` (Overture, not Google) | sales console | populated, out of scope here |
| `SalesTerritory` (`centerLat/Lng`) | 8785 | platform sales | sales console | out of scope |

**What has no coordinates, and this is the load-bearing gap:**

- **`Job`** (schema `:3427`) — no address at all. The site address is reached
  through `Job → Client → address`.
- **`JobVisit`** (schema `:3707`) — `scheduledAt`, `assignedToId`, `status`,
  `checklistItems`, `photos`, `notes`. **No coordinates, no address, no
  duration.** `lib/schedule/jobVisits.js:81` sets `latitude: null,
  longitude: null` explicitly with a comment saying a visit "has no location
  column of its own — it happens at the client's address."
- **`Client`** — an address string, no lat/lng.
- **`TimeEntry`** (schema `:4825`) — `workerId`, `jobId?`, `clockIn`,
  `clockOut`, `hours`, `approvedById`, `status`. **No location of any kind.**

So: **the two records a fleet/geo feature would have to hang off — the visit
and the timesheet — are exactly the two with no geography.** Everything
geocoded today belongs to the *booking* half of the product, not the *job*
half.

## 1.3 The time clock

Two paths into the same `TimeEntry` table.

**Self-serve** — `app/app/clock/page.js`, `app/api/time-clock/route.js`. One
big button. `POST {action:"in"|"out"}`. The worker is resolved from the session
(`myWorker`, `route.js:17-22`), never from a client-supplied id, so nobody can
punch a coworker in. Clock-in writes `{ workerId, clockIn: new Date(), status:
"pending" }` (`:88`). Clock-out computes `hours` server-side (`:98`). One open
entry at a time (`:81`). No IP, no device, no location, no `jobId`.

**Manager** — `app/app/settings/team/timesheets/page.js` →
`/api/time-entries` (POST, accepts `workerId`, `jobId`, `clockIn`) and
`/api/time-entries/[id]` (PATCH, sets `clockOut` and recomputes `hours`).

**Two things worth naming, both true today:**

1. **The self-serve clock never sets `jobId`.** `app/api/time-clock/route.js:88`
   writes no job. Job costing reads `db.timeEntry.findMany` filtered by job
   (`app/api/jobs/[id]/costing/route.js:73`), so hours punched on the phone are
   invisible to job costing. They still reach payroll, which groups by worker
   (`lib/payroll/buildPayRun.js:150,159,187`) and by approval status. This is
   not a bug in the sense AGENTS.md means — nothing claims otherwise — but it
   is the single biggest thing a "clock in on arrival" feature would fix,
   because arriving *somewhere* is precisely what tells you *which job*.
2. **Nothing about a `TimeEntry` records where it happened.** There is no
   column to add a coordinate to, and no consumer that would read one.

## 1.4 How a visit gets a time and an assignee

`POST /api/jobs/[id]/visits` (`app/api/jobs/[id]/visits/route.js:51`). A person
picks a date-time and optionally an assignee; the row is created; the first
visit flips `Job.status` from `unscheduled` to `scheduled`. Permission is
`jobs:view_only` plus the schedule category and `job:assign`, with an explicit
comment (`:71-79`) explaining why the scoped `assignedJobWhere` matters on the
POST.

There is **no assignment engine**. Nothing considers who is nearest, who is
free, or what else is on their day. `AvailabilitySchedule` and `WorkingHours`
exist but drive the *public booking* page, not job visits — and
`lib/company/businessHours.js` is deliberately a third, separate thing
(AGENTS.md is explicit that conflating them publishes an estimator's day off as
a company closure).

The calendar reads three sources and unions them at read time —
`JobVisit`, `Appointment`, `Booking` — normalised in `lib/schedule/jobVisits.js`
with a `kind` discriminator. That file's header explains why a visit does not
get a backing Appointment row: "A calendar showing a visit that no longer
exists is worse than one missing it." Any routing feature must respect that
union; there is no single table of "stops".

## 1.5 Route ordering already exists, and it is the right shape

`lib/marketing/routeOrder.js:27` — `nearestNeighborOrder(stops, start)`. Greedy
nearest-neighbour over lat/lng, squared planar distance with a `cos(lat)`
correction for longitude convergence, O(n²), stops without coordinates appended
in original order rather than being placed at a guessed point. Its own header
is honest that this "is NOT the optimal travelling-salesman solution."

Its caller — `app/api/marketing/campaigns/[id]/stops/route.js:20-45` — seeds
from the company's own coordinates and persists **only `sortOrder`, an integer
on FieldQuo's own `PamphletStop` rows**, inside a transaction.

Hold on to that shape. §2.3 will show it is the only shape that is
unambiguously allowed to be written to disk.

## 1.6 Crew GPS: a live employee-location record, and a dead read

This is the part that surprised me, and it changes the Part 3 answer.

**Written.** `lib/crew/inbox.js:468` stores `latitude`/`longitude` on every
`CrewInboundMessage` when the inbound MMS carried them.
`lib/crew/inboundParse.js:126` reads Twilio's `Latitude`/`Longitude` webhook
params; its comment notes these are "absent far more often than present
(WhatsApp strips EXIF, most carriers never send it)". Rare, but real, and the
row is kept forever — there is no retention sweep for `CrewInboundMessage`
anywhere in `lib/`.

**Read — and it cannot fire.** `lib/crew/attribution.js:99` `gpsMatch` ranks
candidate jobs by `haversineKm` to `{lat: c.lat, lng: c.lng}`. The candidates
are built in `lib/crew/inbox.js:155-165`, which returns `lat: undefined, lng:
undefined` on every one, with a comment explaining why: the previous version
selected a `Job → appointments` relation that has never existed, every inbound
message threw, and rather than inventing a point from the client's *billing*
address (an office, not a site) the coordinates were dropped.

Trace it: `haversineKm` returns `null` when either end fails `hasPoint`
(`travel.js:76`) → `.filter(r => r.km != null)` empties the list →
`if (!ranked.length) return null`. **`method: "gps"` can never be assigned.**
The schema documents it (`prisma/schema.prisma:7371-7374`), the header documents it
(`attribution.js:22`), and the code degrades honestly to text matching — but
the branch is unreachable, and it is unreachable for exactly the reason §1.2
identified: **no job and no visit has a coordinate.**

This is not a dead button — nothing is rendered claiming it works. But it is a
schema field written and effectively never read, which is AGENTS.md recurring
failure class #1, and it is the same missing fact that blocks everything else.

---

# PART 2 — The external constraints

## 2.1 The current routing products, and what the legacy names map to

Source: [Legacy products and features — Google Maps
Platform](https://developers.google.com/maps/legacy), read 2026-09-02 (page
last updated 2026-09-01).

| Legacy service | Legacy since | Replacement |
|---|---|---|
| Directions API | 1 March 2025 | **Routes API** (`computeRoutes`) |
| Distance Matrix API | 1 March 2025 | **Routes API** (`computeRouteMatrix`) |
| JavaScript Directions Service | 1 March 2025 | `Route` class |
| JavaScript Distance Matrix Service | 1 March 2025 | `RouteMatrix` class |
| Places API (original) | 1 March 2025 | Places API (New) |

Google's own wording, quoted from that page: legacy services are "not available
in new Cloud projects but remain fully supported for existing projects", they
are "officially feature frozen, and new feature requests will only be
considered for updated non-Legacy services", and while decommissioning is
planned "there is no date yet for when this will happen", with "at least a
12-month notice prior to the decommission."

Separately, `google.maps.DistanceMatrixService` (the JS one, which FieldQuo does
*not* use) was marked deprecated 25 February 2026 —
[reference](https://developers.google.com/maps/documentation/javascript/reference/distance-matrix),
read 2026-09-02.

**Migration shape** ([Migrate from Directions API (Legacy) or Distance Matrix
API (Legacy)](https://developers.google.com/maps/documentation/routes/migrate-routes),
read 2026-09-02): endpoints move to `https://routes.googleapis.com/`, GET with
query parameters becomes **POST with a JSON body**, and a field mask is
required. `optimize=true` on waypoints becomes `"optimizeWaypointOrder": true`.

**Limits** ([Routes API usage and
billing](https://developers.google.com/maps/documentation/routes/usage-and-billing),
read 2026-09-02):

- `computeRoutes`: **maximum 25 intermediate waypoints.** Google's own cost
  advice on that page is to "Limit user entries in a query to a maximum of 10
  waypoints. Requests containing more than 10 waypoints are billed at a higher
  rate."
- `computeRouteMatrix`: **max 50 origins, 50 destinations, 625 elements per
  request** — dropping to 100 elements for `TRAFFIC_AWARE_OPTIMAL` and for
  transit.

**What this means for FieldQuo:** `travel.js:134` should move to
`computeRouteMatrix`. It is a contained change — one URL, GET→POST, a field
mask, and a different response shape — and `travelMinutes` already funnels
every failure into `estimateTravel`, so a bad migration degrades to the offline
estimate rather than breaking the booking page. Not urgent. Not optional
forever.

## 2.2 Route optimisation: what Google actually sells

**Two different products, and the distinction is the whole design decision.**

### (a) Waypoint ordering on one route — Routes API

`computeRoutes` with `"optimizeWaypointOrder": true` reorders up to 25
intermediate waypoints on **a single route, one vehicle, fixed origin and
destination**. It is a travelling-salesman reordering, not an assignment
engine. It cannot split work across two vans, cannot respect a time window,
cannot honour a capacity or a skill.

### (b) A real vehicle-routing solver — Route Optimization API

[What is the Route Optimization
API](https://developers.google.com/maps/documentation/route-optimization/overview),
read 2026-09-02. This is a genuine VRP solver: a list of **shipments**, a list
of **vehicles**, and a **model** of constraints — pickup/delivery pairs, time
windows, `loadDemands`/`loadLimits`, driver breaks, vehicle start/end
locations, penalty costs for leaving a shipment undone. It returns the
assignment of work to drivers and the sequence each drives.

It is not listed as Legacy or scheduled for Legacy status. It is **excluded
from the Maps Platform SLA** (Service Specific Terms §18.4 — quoted in §2.3).

**Documented limits** ([usage and
billing](https://developers.google.com/maps/documentation/route-optimization/usage-and-billing)
and [Configure timeouts and
deadlines](https://developers.google.com/maps/documentation/route-optimization/timeouts),
both read 2026-09-02):

| | |
|---|---|
| `optimizeTours` (synchronous) | 60 QPM; max request 100 MB |
| `batchOptimizeTours` (long-running) | 60 QPM; 100 requests per batch; 100 MB combined |
| Default REST deadline | 60 s, raisable to 1800 s, or 3600 s with `allowLargeDeadlineDespiteInterruptionRisk` |
| Published capability datapoint | "a 2,000 shipment / 10 vehicle vehicle routing problem in under 30 seconds" |

I did **not** find a documented hard maximum on shipments or vehicles per
request. The constraint in practice is the 100 MB request size and the deadline.
For a 1–20 person contractor this is not a limit anybody will ever touch.

### Pricing — with the arithmetic done

[Google Maps Platform core services pricing
list](https://developers.google.com/maps/billing-and-pricing/pricing), read
2026-09-02 (page last updated 2026-09-01). Prices are **per 1,000 events**, USD.
The "Free Usage Cap" is a **monthly cap per SKU, aggregated across all projects
on the billing account** — so it is FieldQuo's cap in total, *not* per tenant.
The old $200 monthly credit ended 28 February 2025 and is gone.

| SKU | Free cap/mo | Cap–100k | 100k–500k | 500k–1M |
|---|---|---|---|---|
| Routes: Compute Routes **Essentials** | 10,000 | $5.00 | $4.00 | $3.00 |
| Routes: Compute Route Matrix **Essentials** | 10,000 | $5.00 | $4.00 | $3.00 |
| Routes: Compute Routes **Pro** | 5,000 | $10.00 | $8.00 | $6.00 |
| RouteOptimization – **SingleVehicleRouting** (Pro) | 5,000 | $10.00 | $4.00 | $2.00 |
| RouteOptimization – **FleetRouting** (Enterprise) | 1,000 | $30.00 | $14.00 | $6.00 |

**`optimizeWaypointOrder` forces the Pro SKU.** From [SKU
details](https://developers.google.com/maps/billing-and-pricing/sku-details),
read 2026-09-02, the Compute Routes Pro triggers are: 11–25 intermediate
waypoints, `"optimizeWaypointOrder": "true"`, `routingPreference` of
`TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL`, or location modifiers. Route
Optimization bills **per shipment**, and **two or more vehicles in one request
moves it from SingleVehicleRouting to FleetRouting** — a 3× jump at the first
tier and a 5× smaller free cap.

Now the numbers that matter. Assume a working month of 22 days, a company with
3 crews, and 8 stops in a crew's day.

| Approach | Units/month/company | Cost at 100 companies | Cost at 500 companies |
|---|---|---|---|
| `nearestNeighborOrder` (already written, offline) | 0 | **$0** | **$0** |
| Compute Routes Pro, `optimizeWaypointOrder`, one call per crew-day | 66 requests | ~**$16/mo** | ~**$280/mo** |
| Route Optimization, SingleVehicleRouting, one call per crew-day | 528 shipments | ~**$478/mo** | ~**$1,600/mo** |
| Route Optimization, FleetRouting (assign across crews) | 528 shipments | ~**$1,554/mo** | ~**$5,270/mo** |
| Compute Route Matrix Essentials to feed a self-hosted solver | 5,346 elements (9×9 per crew-day) | ~**$2,150/mo** | ~**$6,060/mo** |

Three things fall out of that table:

1. **Waypoint ordering is nearly free.** $280/month serves 500 companies.
2. **Per-shipment billing scales with your customers' *stops*, not their
   count.** A busy contractor costs more than a quiet one, which is the wrong
   shape for a flat SaaS seat price and needs a plan-tier answer before it
   ships, not after.
3. **"Self-hosted solver, Google's matrix" is the worst option on the
   board** — the most expensive line in the table, and it inherits the storage
   restriction anyway. If you self-host, you must self-host the matrix too.

## 2.3 THE CRITICAL QUESTION — what may be stored

This is where the compliance audit's §6 warning turns out to apply exactly as
it feared, and the answer is more restrictive than the routing chapter of any
competitor's marketing would lead you to expect.

**Sources, read directly on 2026-09-02:**

- [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms)
  — **last modified 26 August 2026**
- [Google Maps Platform Service Specific
  Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) —
  **last modified 10 June 2026**

Both dates match what `docs/sales-intel/AUDIT-compliance.md` §6 recorded on
2026-09-01. Nothing moved under us.

### The definition that decides it

Main ToS, Definitions:

> **"Google Maps Content"** means any content provided through the Services
> (whether created by Google or its third-party licensors), including map and
> terrain data, imagery, traffic data, and places data (including business
> listings).

**"Any content provided through the Services."** Not "map data". A stop order
computed by the Route Optimization API and returned to you is content provided
through the Service. So are the leg durations, the distances, the ETAs and the
encoded polyline. There is no reading of that definition on which an optimised
route falls outside it.

### The prohibitions

Main ToS §3.2.3:

> **(a) No Scraping.** Customer will not export, extract, or otherwise scrape
> Google Maps Content for use outside the Services. For example, Customer will
> not: (i) pre-fetch, index, **store**, reshare, or rehost Google Maps Content
> outside the services; (ii) bulk download Google Maps tiles, Street View
> images, geocodes, **directions, distance matrix results**, roads information,
> places information, elevation values, and time zone details; …

> **(b) No Caching.** Customer will not cache Google Maps Content **except as
> expressly permitted under the Maps Service Specific Terms.**

"Directions" and "distance matrix results" are named. §3.2.3(b) is a default
deny: anything not expressly permitted in the Service Specific Terms is
forbidden.

### What is expressly permitted

Every relevant permission, quoted verbatim from the Service Specific Terms:

> **§18.3 (Route Optimization API) Caching.** Customer may temporarily cache
> latitude (lat) and longitude (lng) values from the Route Optimization API for
> up to 30 consecutive calendar days, after which Customer must delete the
> cached latitude and longitude values.

> **§19.3 (Routes API) Caching.** Customer may temporarily cache latitude (lat)
> and longitude (lng) values from the Routes API for up to 30 consecutive
> calendar days, after which Customer must delete the cached latitude and
> longitude values.

> **§4.3 (Directions API) Caching.** Customer may temporarily cache latitude
> and longitude values from the Directions API for up to 30 consecutive
> calendar days, after which Customer must delete the cached latitude and
> longitude values.

> **§5 (Distance Matrix API).** §5.1 Use without a Google Map. §5.2 No use with
> a non-Google map.

Read §5 twice. **The Distance Matrix API section contains no caching clause at
all.** There is no §5.3. Under §3.2.3(b)'s default deny, *nothing* returned by
the endpoint `travel.js:134` currently calls may be persisted — not the
duration, not the distance.

And from Section A (General Service Terms) §3:

> **Google ID Caching.** Customer may cache the Google ID values from the
> Services that return such field and allow caching, in accordance with its
> Documentation. For example, Customer may cache (a) `place_id` from Places API,
> Directions API, Geolocation API and Routes API …

`place_id` is cacheable indefinitely. That is the only durable thing on offer.

There is exactly one place in the whole document where durations and ETAs may
be cached, and it is not a product FieldQuo can use:

> **§11.8 (Navigation Connect API) Caching.** Customer may temporarily cache
> latitude (lat), longitude (lng), **distance, duration, time, and estimated
> time of arrival** values for up to 30 consecutive calendar days, after which
> Customer must delete the cached values.

Navigation Connect is a driver-app integration with identity verification, a
US-data regime tied to 28 C.F.R. § 202, and — see §3.1 below — a flat
contractual ban on using its data for employment decisions.

### Plainly

| Thing you might want to store | Verdict |
|---|---|
| `place_id` for a job site | **Permitted, indefinitely** (General Terms A.3) |
| lat/lng of a stop, from Routes / Route Optimization / Directions / Geocoding | **30 consecutive calendar days**, then delete |
| The optimised **stop order** returned by the API | **Prohibited** — Google Maps Content, no permission granted |
| Leg **durations** and **distances** | **Prohibited** — named in §3.2.3(a)(ii); no permission except §11.8 |
| **ETAs** shown to a client ("your painter arrives 10:40") | **Prohibited to store**; computable and displayable live |
| The route **polyline** | **Prohibited to store** |
| Anything from **Distance Matrix API (Legacy)** | **Prohibited to store** — §5 grants nothing |
| An **integer `sequence`** you assign to your own `JobVisit` rows after a human accepts a proposed order | **My reading: permitted** — see below |

### Does that kill the feature? No — but it dictates the architecture

The distinction I would build on, stated plainly so it can be argued with:

**A number that Google returned is Google Maps Content. A decision your user
made is your data.** If the optimised order is displayed transiently, a
dispatcher looks at it and presses Accept, and what you then write is
`JobVisit.sequence = 1..8` on your own rows, you have persisted a human's
scheduling decision, not a cached API response. This is the same shape
`app/api/marketing/campaigns/[id]/stops/route.js:37-44` already uses — it
writes `sortOrder`, an integer, and nothing else.

**I am not certain of this**, and I would rather say so than sell it. The
counter-argument is that the ordering *is* the content and a human clicking
Accept is laundering. Two things make me think the distinction holds: the
ordering of the customer's own stops is not "map and terrain data, imagery,
traffic data, or places data", and the plain purpose of §3.2.3 is to stop
Google's corpus being rebuilt outside it, which a per-tenant list of eight
house numbers plainly is not. Two things make me hesitant: the definition is
"any content provided through the Services", which is broader than its
examples, and §5.2(d) of the main ToS permits **immediate suspension** for a
§3.2 breach.

**What must never be written, on any reading:** durations, distances, ETAs,
polylines. Those are unambiguously the Content, they are named in §3.2.3(a)(ii),
and they are the exact values a naive implementation would cache "so the
schedule loads fast."

**Consequence for the design.** A "today's route" screen must recompute on
open, or show only the accepted sequence with no times attached. It cannot
store an ETA on a `JobVisit` and email it to a homeowner tomorrow. If the
product needs durable, quotable arrival windows — and a client-facing arrival
window is one of the most valuable things a contractor can offer — Google
cannot supply them, and that alone is the argument for §2.5's self-hosted
option.

## 2.4 An existing exposure, found while checking the above

FieldQuo geocodes addresses with the Geocoding API
(`lib/measure/roofMeasurement.js:58-62`) and stores the resulting lat/lng
**indefinitely** on `Company`, `Appointment`, `Booking` and (via the browser)
`PamphletStop`. There is no expiry, no sweep, no `geocodedAt` column.

The two clauses:

> **§6.3.1** Customer may temporarily cache latitude (lat) and longitude (lng)
> values from the Geocoding API for up to 30 consecutive calendar days, after
> which Customer must delete the cached latitude and longitude values.

> **§6.3.2** Customer may **indefinitely** cache latitude (lat), longitude
> (lng), formatted_address, and the structured address values from the
> Geocoding API **solely to support the direct, End User facing functionality of
> the Customer Application that initiated the request** (e.g., displaying the
> address of a location in a weather application, associating location data
> with a photograph), **only where the cache is not used as a replacement for
> making an additional call to the Services**. Cached data must be **logically
> isolated to the specific End User** it is associated with and must not be used
> across multiple End Users.

§6.3.2 is an escape hatch the compliance audit did not have in front of it, and
it is worth knowing about. But **I do not think FieldQuo currently fits inside
it**, on two of its three conditions:

- *"not used as a replacement for making an additional call"* — the stored
  coordinates are precisely a replacement. `computeAvailability.js:59` reads
  `b.point` off stored `Appointment.latitude` rather than re-geocoding.
- *"logically isolated to the specific End User"* — a stored client coordinate
  is read by the availability engine on behalf of whichever stranger is looking
  at the booking page, and by the whole back office. It is shared across users
  by design.

So §6.3.1's 30-day cap is the operative rule, and FieldQuo is outside it.
**This is live today and has nothing to do with fleet management.** The fix is
small and worth doing on its own: stamp a `geocodedAt` alongside each pair, and
either re-geocode past 30 days or null the coordinates (which every consumer
already handles — `hasPoint` returns false and `travelMinutes` returns null,
and "unknown never filters", which is the behaviour `travel.js` was built
around from the start). I flag it here rather than fixing it because the brief
is research-only.

Adjacent and, I think, **fine**: `Quote.estimateData` (schema `:2126`) stores
Solar-derived roof measurements permanently. §20.2 caps Solar Data at 30 days
but says "The deletion obligation does not apply to Solar Data incorporated
into fixed media (e.g. energy system design, feasibility study, **commercial
proposal**, marketing materials) for use in a Downstream Transaction." A
delivered quote is a commercial proposal. That reads as covered.

## 2.5 Alternatives

Licences verified against each repository's GitHub API metadata on 2026-09-02.

### Solvers

| Project | Licence | Notes |
|---|---|---|
| [google/or-tools](https://github.com/google/or-tools) | **Apache-2.0** | The CP-SAT / routing library. Same company, no terms attached — it is a library, not a service. Very capable, and the most code to write. |
| [VROOM-Project/vroom](https://github.com/VROOM-Project/vroom) | **BSD-2-Clause** | C++ VRP engine with an HTTP API. Purpose-built for exactly this: jobs, vehicles, skills, time windows, capacities. Needs a routing engine underneath it. |

### Routing engines (the travel-time matrix)

| Project | Licence | Notes |
|---|---|---|
| [Project-OSRM/osrm-backend](https://github.com/Project-OSRM/osrm-backend) | **BSD-2-Clause** | Fastest. Memory-hungry on a big extract. VROOM's default. |
| [valhalla/valhalla](https://github.com/valhalla/valhalla) | MIT (GitHub's detector reports NOASSERTION; the repo's LICENSE.md is MIT) | Tiled, far lighter on RAM, time-of-day costing. |
| [GIScience/openrouteservice](https://github.com/GIScience/openrouteservice) | **GPL-3.0** | Copyleft. Running it as a separate network service is the normal way to avoid the licence reaching your code, but it is the one on this list that needs a lawyer's glance. |
| [graphhopper/graphhopper](https://github.com/graphhopper/graphhopper) | **Apache-2.0** | Also sells a hosted product. |

All four consume **OpenStreetMap** data, which is **ODbL 1.0**: attribution
required, and share-alike on a *Derivative Database*. A route handed to a
driver is a Produced Work, not a database, so share-alike does not reach it —
but I would want that confirmed before storing large volumes of OSM-derived
travel times, because a big enough table of them starts to look like a derived
database rather than a produced work.

**The decisive property: a self-hosted stack has no storage restriction.** You
may keep the optimised order, the durations, the ETAs, forever, and email them
to a homeowner. That is not a cost argument, it is a *capability* argument, and
it is the only reason to consider it — because on cost alone Google wins
comfortably (§2.2: $280/month serves 500 companies).

**Is it realistic here? Not today, and I would not pretend otherwise.**
FieldQuo runs on Vercel and Neon. There is no container platform, no persistent
VM, no ops surface at all. OSRM or Valhalla on a Quebec+Ontario extract is a
stateful server with several GB of RAM, a data-refresh pipeline, and a new
class of on-call. That is a genuinely new piece of company infrastructure to
serve a feature nobody has yet asked to pay for. It becomes realistic if and
only if durable, client-facing arrival windows become a product commitment.

### Commercial routing APIs

Prices below are from vendor and comparison pages read 2026-09-02 and should be
re-checked before anyone quotes them; none were read from a contract.

- **Mapbox Optimization API v2** — usage-based, per-API free monthly allowance.
  Mapbox's own terms carry caching restrictions of their own; swapping vendors
  does not automatically buy storage rights, and that must be checked clause by
  clause before it is treated as an escape.
- **Routific** — free to 100 orders/month; from ~$150/month for 101–1,000.
- **OptimoRoute** — from ~$39 per driver per month.
- **HERE Tour Planning**, **NextBillion.ai** — enterprise, quote-based.

Per-driver commercial pricing is the wrong shape for FieldQuo: a $39/driver/month
line item under a product whose own seat price is lower than that inverts the
margin. Rebilling it as an add-on is possible but it is a pricing decision, not
an engineering one.

## 2.6 Geofencing on mobile web — the make-or-break question

**The answer is no, and it is not close.**

The owner's phrase was "maybe they can start [the time clock] once they arrive
at their location." In a browser, including an installed PWA, that cannot be
built. Not on iOS, not on Android, not in Chrome. Here is the evidence rather
than the folklore.

### 1. The Geofencing API is retired

The W3C Geofencing API — the spec that would have done exactly this, built on
Service Workers — carries this notice on its
[Editor's Draft dated 11 May 2016](https://w3c.github.io/geofencing-api/), read
2026-09-02:

> **Obsoletion Notice.** This specification is not being actively maintained,
> and should not be used as a guide for implementations. It may be revived in
> the future, but for now should be considered obsolete.

Its [publication history](https://www.w3.org/standards/history/geofencing/)
(read 2026-09-02) records: First Public Working Draft 4 June 2015, **Retired 30
May 2017**. No browser ever shipped it.

### 2. The Geolocation spec *forbids* background position updates

This is the part people get wrong by assuming it is an Apple restriction. It is
normative, in the spec, for every browser.

From the [Geolocation spec, W3C Editor's Draft 7 April
2026](https://w3c.github.io/geolocation/), read 2026-09-02. In the
`watchPosition` algorithm:

> If *document* is not fully active or visibility state is not "visible", go
> back to the previous step and again wait for a significant change of
> geographic position.
>
> **Note: Position updates are exclusively for fully-active visible documents.**
> The desired effect here being that position updates are exclusively delivered
> to fully active documents that are visible; Otherwise the updates get
> silently "dropped on the floor". Only once a document again becomes fully
> active and visible … do the position updates once again start getting
> delivered.

And `getCurrentPosition` does not merely fail when hidden — it *blocks*:

> If *document*'s visibility state is "hidden", wait for the following page
> visibility change steps to run: Assert: document's visibility state is
> "visible". Continue to the next steps below.

So a backgrounded tab or a minimised PWA gets nothing, and a location request
made while hidden hangs until the user looks at the screen. The phone in a
crew member's pocket is a hidden document.

### 3. A Service Worker cannot read location at all

The spec's WebIDL extends `Navigator`:

```
partial interface Navigator {
  [SameObject] readonly attribute Geolocation geolocation;
};
```

`Navigator` is the Window object's navigator. Workers get `WorkerNavigator`,
which the Geolocation spec does not extend. There is no `navigator.geolocation`
inside a Service Worker, in any browser, by design. Whatever wakes a Service
Worker up, it cannot ask where the phone is.

### 4. The one background wake-up that exists cannot help

Web Periodic Background Synchronization ([MDN, Web Periodic Background
Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API),
read 2026-09-02): Chromium only — **not supported in Safari or Firefox on any
platform**. Requires an installed PWA launched as a separate app, a granted
`periodic-background-sync` permission, and Chrome gates frequency on the site's
engagement score with a default minimum interval of **12 hours**. It fires in a
Service Worker, so per point 3 it cannot read location anyway. Twelve-hour
granularity would be useless for a 9 a.m. arrival even if it could.

### 5. What iOS actually permits

Every browser on iOS uses WebKit. With the spec above, the behaviour is the
same everywhere: `watchPosition` delivers while the web app is on screen and
stops the moment it is backgrounded or the screen locks. There is no
"significant location change" equivalent, no background location entitlement,
no way to ask for one.

The one genuinely useful iOS capability that *does* exist: **Web Push for
Home Screen web apps**, since iOS/iPadOS 16.4 ([WebKit, "Web Push for Web Apps
on iOS and iPadOS"](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
read 2026-09-02). It requires the user to Add to Home Screen and open the web
app at least once. It is server-initiated and time-based — it can say "you're
due at the Tremblay job at 9:00, tap to clock in." It cannot know they have
arrived.

Note also that `app/manifest.js` currently returns `null` on any tenant
subdomain, deliberately, to protect white-labelling. Push and installability
therefore work on `app.fieldquo.com` and nowhere else — which is fine, because
this is a staff surface, but it means "install FieldQuo" is a FieldQuo-branded
act for a contractor's own crew. That is a product decision the owner should
make knowingly.

### What IS possible, honestly stated

Ranked by how much of the original wish each delivers:

1. **Location-stamped manual clock-in.** The worker opens the app and taps
   Clock In; the page calls `getCurrentPosition()` at that moment and posts the
   coordinate with the punch. Foreground, one prompt, high accuracy (GPS,
   typically 5–20 m outdoors), negligible battery. This is what almost every
   small-contractor time app actually does, including several that market
   themselves as "GPS time clock".
2. **Arrival *suggestion*, not detection.** Server-side: the visit is scheduled
   for 9:00 at a known site. At 8:55 send a Web Push — "Clock in at the
   Tremblay job?" — with the job pre-selected. One tap. The location is
   captured on the tap and compared to the site; if it is 4 km away, say so
   instead of silently accepting. This is the closest honest approximation of
   "clocks in when they arrive", and it fixes the `jobId` gap from §1.3 as a
   side effect.
3. **Foreground confirmation while the app is open.** If a crew member has the
   job screen open, `watchPosition` can notice they are now within 150 m and
   surface a banner. Real, but it only helps someone already staring at the
   phone — which is nobody, driving.
4. **A native wrapper.** Capacitor or React Native around the existing web app,
   using the platform geofence APIs (iOS `CLCircularRegion`, Android
   `GeofencingApi`), which *do* wake a backgrounded app on region entry. This
   is the only thing that delivers the literal request. It is a second
   deployment target, an App Store review process, an Apple developer
   programme, and — because a background-location entitlement is exactly what
   Apple scrutinises hardest — a real review risk. **It is a company decision,
   not a sprint.**

**Say this to the owner in these words:** a website cannot watch where a phone
is when nobody is looking at it. That is not a gap in our implementation and
not an Apple quirk we can route around; it is what the standard says, in the
paragraph quoted above. What we can build is a clock-in that *knows where it
happened* and a reminder that arrives *when they are due* — and if literal
auto-clock-in on arrival is required, that means shipping a native app.

---

# PART 3 — The design questions

## 3.1 A location on a timesheet is employee monitoring

### Who is actually on the hook

This gets stated wrongly a lot, so: **FieldQuo is not the employer.** The
tenant company is. Under Quebec's *Act respecting the protection of personal
information in the private sector* (CQLR c. P-39.1, "Law 25"), the contractor
is the "person carrying on an enterprise" and FieldQuo is a service provider
under **s. 18.3** — "may, without the consent of the person concerned,
communicate personal information to any person or body if the information is
necessary for carrying out a mandate or performing a contract of enterprise or
for services entrusted to that person or body." That is the clause that lets
the contractor's crew data sit in FieldQuo's database at all.

So FieldQuo's obligation is **to make compliance possible and to make
non-compliance hard.** If we ship an always-on location tracker with no notice
and no switch, we have handed every Quebec customer a violation with our name
on the invoice.

### Which law applies where — and PIPEDA mostly does not

The nuance that matters, and that most vendors get wrong:

- **PIPEDA covers employee personal information only at federally regulated
  employers** — banks, airlines, telecoms, interprovincial transport. Sources:
  [OPC, Questions and Answers regarding the application of PIPEDA, Alberta and
  British Columbia's PIPAs](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/02_05_d_26/),
  read 2026-09-02.
- A painting contractor in Ontario is provincially regulated, and Ontario has
  no private-sector employee privacy statute. **PIPEDA does not govern their
  handling of their own crew's data.** (Ontario's *Working for Workers Act*
  electronic-monitoring policy requirement applies at 25+ employees — above
  FieldQuo's stated customer size, and worth a separate look if that changes.)
- **Alberta and British Columbia** PIPAs *do* cover employee information, and
  both permit collection/use/disclosure for managing the employment
  relationship **without consent, provided notice is given**.
- **Quebec's Law 25 is the strict one**, and it is FieldQuo's home market.

So the design target is Quebec. Meeting Law 25 meets everything else.

### What Law 25 actually requires

Statutory text read on 2026-09-02 from
[LégisQuébec, CQLR c. P-39.1](https://www.legisquebec.gouv.qc.ca/en/ShowDoc/cs/P-39.1).

**s. 8.1 — the clause written for exactly this feature:**

> In addition to the information that must be provided in accordance with
> section 8, any person who collects personal information from the person
> concerned **using technology that includes functions allowing the person
> concerned to be identified, located or profiled** must first inform the
> person (1) of the use of such technology; and (2) **of the means available to
> activate the functions** that allow a person to be identified, located or
> profiled.
>
> "**Profiling**" means the collection and use of personal information to
> assess certain characteristics of a natural person, in particular for the
> purpose of **analyzing that person's work performance**, economic situation,
> health, personal preferences, interests or behaviour.

Two things. First, "located" is named outright. Second, the definition of
profiling names work-performance analysis — so using arrival times to judge
whether someone is slow is not a grey area, it is the statute's own example.

The wording is "the means available to **activate**", not deactivate. Read with
**s. 9.1** — "must ensure that those settings provide the highest level of
confidentiality **by default**, without any intervention by the person
concerned" — the settled reading is that these functions must be **off until
switched on**.

**s. 8** requires, at collection: the purposes, the means of collection, the
rights of access and rectification, and the right to withdraw consent; on
request, the retention period and the contact details of the person in charge.

**s. 9**, on necessity, ends with the line to hang the whole feature on:

> **In case of doubt, personal information is deemed to be non-necessary.**

**s. 12** limits use to the purpose collected for, and requires **express**
consent where the information is sensitive — sensitive being defined in the
same section as information which "due to its nature … or **the context of its
use or communication**, entails a high level of reasonable expectation of
privacy." Continuous location of an identified employee, in an employment
context where it can affect pay, is a strong candidate.

**s. 12.1** — if a decision is made about someone by **exclusively automated**
processing, they must be told, told what information and what factors drove it,
and given a chance to make representations to a human. **An automatic clock-out
triggered by leaving a geofence, with the hours it produces flowing into
payroll, is an automated decision about a person's pay.** If auto-clock-out is
ever built, it needs a human in the loop or an s. 12.1 disclosure path.

**s. 23** — destroy or anonymise when the purpose is achieved.

**s. 3.2** — governance policies framing "the keeping and destruction" of the
information, approved by the person in charge.

### And the federal test, which is good design guidance regardless

The OPC's four-part test, from [PIPEDA Case Summary #2009-011 (27 May 2009),
"Transit driver objects to use of technology (MDT and GPS) on company
vehicle"](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2009/PIPEDA-2009-011/),
read 2026-09-02: *Is the measure demonstrably necessary to meet a specific
need? Is it likely to be effective? Is the loss of privacy proportional to the
benefit? Is there a less privacy-invasive way of achieving the same end?* The
complaint was dismissed partly because the organisation used the data for
dispatch and safety and there was "no evidence … that the personal information
collected through MDT/GPS is used for employee management."

The companion finding, [PIPEDA Case Summary #2006-351](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2006/pipeda-2006-351/)
(read 2026-09-02), and the Commissioner's accompanying statement, warn about
**function creep** — data gathered for dispatch quietly becoming a performance
record. Employers "do not have carte blanche to use GPS to constantly monitor
their workforce."

Worth noting the same logic now appears in Google's *own contract*: Service
Specific Terms **§11.4.2**, for the Navigation Connect API —

> Customer may not use Google Maps Content collected via the Navigation Connect
> API as a basis for adverse employment actions. This data shall not be used to
> monitor individual employee productivity for the purpose of disciplinary
> action, performance reviews, or termination.

That is only binding on that one product. But when the vendor writes the
restriction into the licence, the norm is not in dispute.

### What FieldQuo would have to add

`lib/legal/` already has the right bones — `privacyOfficer.js` (a real named
person and contact since 2026-09-01), `processors.js` (a per-vendor list with a
`verify` regex that a script checks against the actual code), and
`effectiveDates.js`. The additions:

1. **A per-company switch, off by default**, gating location capture on the
   time clock. `Company`-level, with the "highest level of confidentiality by
   default" reading of s. 9.1 baked in — not a settings row that defaults true
   for existing tenants.
2. **A per-worker consent record**, not a company-wide toggle. s. 8.1 informs
   *the person concerned*, and s. 14 requires consent that is "clear, free and
   informed and … given for specific purposes", "requested for each such
   purpose", and — if written — "presented separately from any other
   information". A `WorkerLocationConsent` row with a timestamp, the text
   version shown, and a withdrawal timestamp. The precedent is `CallConsent`
   (schema `:7149`), which already does this shape for call recording.
3. **A notice at the point of collection**, in French and English, driven by
   `lib/i18n/clientLanguage.js`. Not buried in a policy page — s. 8 says "when
   the information is collected".
4. **A retention rule with a sweep that actually runs.** Nothing in `lib/`
   sweeps anything on a schedule today except the sales-suppression window
   (`lib/sales/suppressionRules.js:343`). A location column with no sweep is a
   s. 23 problem and, separately, a Google §6.3.1 problem. One sweep can serve
   both.
5. **Purpose limitation enforced in code, not in prose.** The stated purpose is
   "confirm which job these hours belong to". That means the coordinate is used
   to pick a `jobId` and to flag an implausible punch — and is *not* exposed as
   a per-worker location history screen, a map of where everyone is now, or an
   input to any analytics. Building the map is what turns a defensible
   collection into surveillance, and it is one afternoon's work away at all
   times, which is precisely why the restraint should be written down.
6. **`processors.js` needs updating** if location ever reaches Google. Today
   the `google-maps` entry says only "An address as a homeowner or contractor
   types it, for autocomplete, and the address on a job for map display." A
   crew member's coordinate is a different sentence and a different data
   subject.
7. **Add employee/crew location to the privacy policy.** `app/(marketing)/privacy/page.js`
   currently says nothing about it — I grepped; the word "location" does not
   appear in the staff context.
8. **Deal with `CrewInboundMessage`.** Per §1.6, FieldQuo already stores crew
   coordinates, indefinitely, with none of the above. It is rare data and a
   small table, and it was collected for photo attribution, which is a
   legitimate and proportionate purpose. But it has no notice, no consent, no
   retention limit, and — because `gpsMatch` is unreachable — **it currently
   serves no purpose at all**, which under s. 9's "in case of doubt … deemed to
   be non-necessary" is the weakest possible position. Either wire the
   coordinates into attribution properly (which needs §1.2's missing site
   coordinate) with notice attached, or stop writing them. Doing neither is the
   worst of the three.

## 3.2 "Fleet management" is four different products

Splitting the phrase by who actually needs each piece.

### What a 1–20 person contractor genuinely needs

| Need | Why it is real for a van | Effort |
|---|---|---|
| **Which job do these hours belong to** | The self-serve clock writes no `jobId` (§1.3), so phone-punched hours never reach job costing. This is a costing hole, not a fleet feature, and it is the highest-value item in this whole document. | Small |
| **A sensible order for today's stops** | Five stops in a day, and the difference between a good order and a bad one is 40 minutes of unpaid driving. `nearestNeighborOrder` already computes this. | Small |
| **"Am I going to make it?"** | `reachable()` and `travelLegs()` already answer this for appointments; visits are excluded only because they have no coordinates. | Small |
| **Vehicle cost per job** | `Asset` + `AssetUseLog` (schema `:5470`, `:5558`) already model this, including the depreciation/loan double-count guard. A truck is `category: "vehicle"`. | **Already built** |
| **When is the truck due for service** | The genuinely missing fleet feature at this size, and the cheapest: a date, a reminder, a log. No GPS involved. | Small |
| **Mileage for tax** | A real contractor pain. Needs start/end odometer readings typed by a human — *not* GPS-derived, which would be both a storage problem (§2.3) and a monitoring problem (§3.1). | Small |

### What ServiceTitan sells a 200-truck operation, and FieldQuo should not build

- **Live vehicle telematics** — an OBD-II dongle or a hardware tracker per
  truck, streaming position, speed, harsh-braking and idle time. Hardware
  logistics, a device fleet, a support burden, and the purest form of the
  surveillance problem in §3.1.
- **Multi-vehicle dynamic dispatch** — reassigning the day in real time as
  calls come in. Needs the FleetRouting SKU (§2.2: ~$5,270/month at 500
  companies), a dispatcher sitting at a screen, and enough trucks for the
  reassignment to be worth anything. A three-van shop does this by phone in
  eleven seconds.
- **Driver scorecards and safety leaderboards** — the exact "analyzing that
  person's work performance" that Law 25 s. 8.1 defines as profiling and that
  Google's own §11.4.2 forbids for its driver data.
- **Fuel-card integration, DVIRs, DOT hours-of-service** — a different
  regulatory universe, aimed at commercial motor carriers.
- **Client-facing live "your technician is 12 minutes away"** — this is the one
  that *looks* like a small-contractor feature and is not, for a reason
  specific to FieldQuo: it requires continuous background location (§2.6 —
  impossible in a browser) **and** storing ETAs (§2.3 — prohibited). Two
  independent blockers. It is a native-app feature with a non-Google routing
  stack, or it is nothing.

### The honest line

At 1–20 people, "fleet management" means **knowing what the truck costs and
what order to drive in**. It does not mean knowing where the truck is. The
first is mostly built or cheap to build; the second is expensive, legally
loaded, and — in a browser — impossible.

---

# Recommendation, ranked by value per effort

**1. Give a job site a coordinate.** (Small; unblocks four other things.)
Nothing else in this document is possible without it. A nullable
`Decimal(9,6)` pair on `JobVisit`, geocoded from the client address at
scheduling time — with a `geocodedAt` stamp so §2.4's 30-day rule can be
honoured from day one rather than retrofitted. This alone: makes `gpsMatch`
reachable (§1.6), lets visits participate in `travelLegs` on the calendar
(§1.4), and gives a clock-in something to compare against. Note that
`lib/crew/inbox.js:143` explicitly rejected inventing a point from the client's
*billing* address — so the coordinate must come from the site address on the
visit, and be null when there isn't one. Absence over invention.

**2. Set `jobId` on the self-serve time clock.** (Small; pure costing win, zero
legal surface.) The clock screen already knows the worker; the worker's visits
for today are one query away. Offer them, default to the only one if there is
only one. Hours punched on a phone start reaching job costing. **This delivers
most of what the owner wants from "clock in at the location" and needs no
geolocation at all** — and it should ship before anything with a coordinate in
it, so that the location work is an accuracy improvement on a working feature
rather than the thing holding it up.

**3. Order today's visits with the code we already have.** (Small; $0; no
terms exposure.) `nearestNeighborOrder` on the day's visits, seeded from the
company address, presented as a suggestion, persisting only an integer
`sequence` on our own rows — the identical pattern
`app/api/marketing/campaigns/[id]/stops/route.js` already ships. Pair it with
`travelLegs`, which already labels its output "about 25 min" so nobody mistakes
a straight-line estimate for a measurement. Free, offline, and immune to §2.3.

**4. Location-stamped manual clock-in, off by default.** (Medium; carries the
whole Part 3 checklist.) `getCurrentPosition()` at the moment of the tap,
posted with the punch, compared to the visit's coordinate, used to pick the
`jobId` and to flag an implausible punch — and used for nothing else. Requires
items 1–6 of §3.1 before a single line of it ships. **Do not build this before
items 1–3**, which deliver most of the value with none of the obligations.

**5. Vehicle service reminders and typed mileage.** (Small; genuinely wanted;
no GPS.) Hangs off `Asset` where `category` contains "vehicle". The most
"fleet management" a van-sized company will ever need.

**6. Migrate `travel.js` off the legacy Distance Matrix endpoint.** (Small;
maintenance.) `computeRouteMatrix` on `routes.googleapis.com`, POST with a
field mask. Not urgent — legacy is fully supported with 12 months' notice
promised — but do it before the next thing depends on it, and note that the
Legacy section grants **no** caching right at all (§2.3), so anything built on
the current call must stay live-computed regardless.

**7. Fix the geocode retention (§2.4).** (Small; independent of everything
above.) A `geocodedAt` stamp and a sweep that nulls or refreshes past 30 days.
Every consumer already treats a missing coordinate correctly, because
`travel.js` was written around "unknown never filters" from the start. This is
worth doing whether or not any fleet feature is ever built.

**Not now, and say why out loud:** Route Optimization API (§2.2 — per-shipment
billing that scales with customers' busyness, and multi-vehicle assignment that
a three-van shop does by phone); self-hosted OSRM/VROOM (§2.5 — a new class of
infrastructure, justified only if durable client-facing arrival windows become
a commitment); a native wrapper (§2.6 — a company decision, not a sprint).

---

# Things that sound achievable and are not

Stated bluntly, because each of these will be proposed again by someone who
has read a competitor's feature list.

1. **"Clock them in automatically when they arrive."** Not possible in a
   browser or an installed PWA, on any platform. The Geolocation spec delivers
   position updates "exclusively to fully active documents that are visible"
   and drops the rest "on the floor" (§2.6). Service Workers have no
   `navigator.geolocation` at all. The Geofencing API was **retired in 2017**
   and never shipped. Periodic Background Sync is Chromium-only, minimum ~12
   hours, and runs where location is unreachable. This requires a native app.
2. **"Cache the optimised route so the schedule loads fast."** Prohibited.
   Google Maps Content is "any content provided through the Services"; the
   Route Optimization and Routes API terms permit caching **latitude and
   longitude only, for 30 days** (§2.3). The Distance Matrix API section grants
   nothing at all. §3.2.3(a)(ii) names "directions, distance matrix results"
   explicitly, and a §3.2 breach permits immediate suspension — which would
   take address autocomplete and the roofing self-quote down with it.
3. **"Store the ETA and text it to the homeowner tomorrow."** Same clause. ETAs
   may be computed and shown live; they may not be persisted. The only Google
   product that permits caching durations and ETAs is Navigation Connect
   (§11.8), which is a verified-identity driver-app product that also
   contractually forbids using its data for employment decisions.
4. **"Use a self-hosted solver so we don't pay Google."** Cost is not the
   reason to self-host — Google's waypoint ordering is ~$280/month at 500
   companies (§2.2). *Storage rights* are the reason. And self-hosting the
   solver while buying the travel-time matrix from Google is the most expensive
   line in the pricing table **and** keeps the storage restriction: it is
   strictly worse than either pure option.
5. **"We already do GPS job attribution."** The code exists and cannot fire.
   `lib/crew/inbox.js:163` hands `lat: undefined` to every candidate, so
   `gpsMatch` returns null on every message ever sent (§1.6). Fixing it is item
   1 on the recommendation list; claiming it works is not.
6. **"The lat/lng we already store is fine."** Probably not. §6.3.1 caps
   Geocoding coordinates at 30 days, and FieldQuo's use fails two of the three
   conditions of the §6.3.2 indefinite-caching exception (§2.4). Live today,
   unrelated to fleet, and cheap to fix.
7. **"PIPEDA covers this."** For most FieldQuo customers it does not — PIPEDA
   reaches employee data only at federally regulated employers (§3.1). The
   binding law for a Quebec contractor is Law 25, which is stricter, names
   "located" in s. 8.1, defines work-performance analysis as profiling, and
   requires the function to be **off by default**.

---

# Where I am unsure, and said so rather than guessing

- **Whether persisting an accepted stop *order* as an integer on our own rows
  is inside Google's terms** (§2.3). I have argued yes and given the
  counter-argument. The durations, distances, ETAs and polylines are
  unambiguous — those may not be stored — and a design that only ever writes
  the integer is safe under either reading, which is why I recommended it that
  way. If the owner wants certainty rather than a defensible reading, this is a
  question for a Google Maps Platform representative, and it is a short one.
- **Whether §6.3.2's indefinite-caching exception could be *made* to fit**
  (§2.4) by narrowing what the stored coordinate is used for. I concluded no on
  the "not a replacement for an additional call" and "logically isolated to the
  specific End User" conditions, but I read those conditions strictly and
  someone could reasonably read them less so.
- **Whether ODbL share-alike reaches a large stored table of OSM-derived travel
  times** (§2.5). A route given to a driver is clearly a Produced Work; a
  million cached durations start to resemble a Derivative Database. I did not
  resolve this, and it only matters if the self-hosted path is taken.
- **Whether continuous employee location counts as "sensitive" under Law 25
  s. 12**, which would make express consent mandatory rather than advisable. I
  think the "context of its use" limb points that way in an employment setting
  where the data affects pay, but I found no CAI decision on point and did not
  invent one. Building for express consent costs little and settles it.
- **Ontario's *Working for Workers* electronic-monitoring policy duty.** It
  bites at 25+ employees, above FieldQuo's stated 1–20 customer, so I did not
  research it properly. If the product moves upmarket, it needs its own look.
- **`crtc.gc.ca`-style access problems did not recur here**, but
  `legisquebec.gouv.qc.ca` refused normal fetching and I retrieved the statute
  through its `ShowDoc` endpoint instead. The text quoted in §3.1 is the
  official consolidated English version; I did not verify it against the French,
  which is authoritative.
- **I did not price Mapbox, HERE or NextBillion from contracts**, only from
  public pages, and I did not read Mapbox's caching terms clause by clause.
  Before any of them is treated as an escape from §2.3, someone has to do to
  their terms what §2.3 does to Google's.
