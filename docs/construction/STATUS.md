# Field ops & construction — status

Companion to `docs/sales-intel/STATUS.md`. Same rule: if this file disagrees
with a memory or a summary, this file wins.

Opened 2026-09-02, after the owner asked about ServiceTitan's construction
feature set.

---

## What an RFI actually is

The owner said "I don't know what RFIs are", so this is the plain answer,
because it decides whether FieldQuo should build them at all.

**A Request For Information is a formal, numbered question from a contractor to
whoever owns the drawings** — an architect, engineer, or general contractor —
raised when the plans are ambiguous, incomplete, or contradict themselves. "The
drawings show a 4-inch drain here and the spec says 6-inch. Which?"

Four things make it a document rather than a phone call:

1. **It is numbered and tracked**, so a project has RFI-014 and everyone means
   the same question.
2. **It has a response deadline.** An unanswered RFI stalls work, and the delay
   is claimable — which is the commercial point.
3. **The answer becomes part of the contract record.** If it later turns out
   the 6-inch drain was wrong, the RFI is the evidence of who said so.
4. **If the answer changes scope, it becomes a change order.** That is the
   pipeline ServiceTitan sells: RFI → answer → change order → billing.

**Whether FieldQuo needs them is a MARKET decision, not a feature decision.**
A painter doing houses never files an RFI — there are no drawings and the
homeowner is standing there. A painter subcontracting on a commercial build
files them constantly, because there is a GC who will otherwise deny ever
asking for the extra work.

So: RFIs are worth building **if and only if** FieldQuo pursues subcontractors
on commercial projects. That is a bigger question than the feature, and it is
the owner's to answer. Nothing should be built on a guess about it.

---

## The ServiceTitan list, and what it is really aimed at

The features the owner listed — fleet management, route optimisation, inventory
and purchase orders, AR/AP, AIA payment applications, progress billing, daily
construction logs, RFIs — are ServiceTitan's **commercial construction** tier.
They are sold to companies with fleets, project managers and a GC on the other
side of the table.

FieldQuo's stated customer is 1–20 people, often run from a van. Some of that
list is genuinely valuable at that size (daily logs, per-job financials,
documents). Some of it is a different company's product (multi-party commercial
billing, AIA applications, AR/AP ledgers).

**Sorting which is which is the point of the audit**, not building all of it.

---

## THE QUEUE — every requested item, with a state

Added 2026-09-02 after the owner pointed out that requested-but-unstarted work
was living in conversation instead of in a file. That is the failure this
section exists to prevent: a board that shows what shipped and what was decided
still loses the thing nobody has begun.

**Rule: an item enters here the moment it is asked for, not when it starts.**

### Running now

| # | Item | Agent |
|---|---|---|
| 1 | Sales rep admin — code field, work email, number, KPIs, leads | running |
| 2 | Platform diagnostics — "couldn't check" messages, orphan number, Twilio var | running |
| 3 | Abandoned signups — recovery email, flag for a call, stop counting | running |
| 4 | Signup gate — no dashboard until checkout completes | running |

### Ready to start — no schema needed

| # | Item | Note |
|---|---|---|
| 5 | Widen `check:mobile` to the contractor app | It walks only `/platform`, `/sales`, `/app/clock` today. I told the owner it covered "the app surfaces". It does not. |
| 6 | Receipt extraction | Unblocked: structured outputs landed. Target is `JobMaterial.actualCost`, whose schema comment already says "what the receipt said". `Expense` has no attachment column. |

### Blocked on the schema settling — NOT forgotten

`prisma/schema.prisma` has been contested all session, invalid twice, and two
commits already carry mixed authorship because agents swept each other's
models. These need columns, so they wait for one hand-written schema pass.

| # | Item | Needs |
|---|---|---|
| 7 | **Site address on Job/JobVisit** | The prerequisite for routing, arrival detection and client-site equipment. Nothing geographic is buildable without it. |
| 8 | ~~Document management~~ | **SHIPPED 2026-09-02.** `JobDocument`, `lib/jobs/documents.js`, `app/api/jobs/[id]/documents`, `JobDocuments.js` on the job page. Upload through the existing `/api/upload`; a revision supersedes rather than overwrites; contracts and invoices withheld from anyone without `showPricing`. No delete anywhere. `npm run check:daily-log`. |
| 9 | Client-site equipment + warranty history | No warranty period exists anywhere in the product. |
| 10 | Stock, purchase orders, suppliers | `Material.reorderThreshold` is written and never read. Clusters with #6. |
| 11 | ~~Daily logs~~ | **SHIPPED 2026-09-02.** `JobDailyLog`, `lib/jobs/dailyLog.js`, `app/api/jobs/[id]/daily-logs`, `DailyLog.js` on the job page. One row per job per day enforced by the unique index; the day is a calendar day the browser names, so filing yesterday at 6am lands on yesterday; autosave behind the stale-write guard; the day opens seeded from its photos and finished to-dos. `JobVisit.notes` is still a pre-visit brief with no caller — deliberately left alone rather than repurposed. |
| 12 | Fleet | A vehicle is an `Asset` with `category: "vehicle"`. No VIN, odometer or maintenance. |
| 13 | `Subscription.billingStartedAt` | The honest fix for trial state — see `docs/sales-intel/STATUS.md`. |
| 14 | BlockNote editor → JSON → Postgres, autosave | **HALF SHIPPED, and the missing half is the editor.** JSON → Postgres and autosave-behind-the-guard are done (item 11). BlockNote is NOT installed — see below. A textarea ships in its place, writing real BlockNote JSON. |

#### BlockNote could not be installed — the registry, not the code (2026-09-02)

Checked before installing, as the brief asked. Both facts the brief stated are
TRUE of `@blocknote/core@0.54.0`: `yjs` is an optional peer, and
`@blocknote/shadcn` targets `@base-ui/react`. The package still does not
install:

```
npm error Could not resolve dependency:
npm error peerOptional @y/y@"^14.0.0-rc.23" from @blocknote/core@0.54.0
```

`@y/y`'s `latest` dist-tag is **14.0.0-rc.7**, which does not satisfy the
`^14.0.0-rc.23` range BlockNote asks for. npm resolves an optional peer against
`latest`, finds nothing usable, and fails the whole tree — so `npm install`
ERESOLVEs on a clean checkout. Two ways round it, both rejected:

- `overrides: { "@y/y": "14.0.0-rc.24" }` — verified to work (56 packages, no
  yjs installed at all). It pins a **prerelease of a CRDT library this product
  deliberately does not use**, in the file every other dependency resolves
  through, to work around a vendor's mis-set dist-tag. Nobody will remember why
  in three months.
- `--legacy-peer-deps` — changes resolution for **every** package in the repo,
  and would have to be set on Vercel too.

The last version that installs unaided is **0.51.4**, and it is worse: `yjs`,
`y-prosemirror`, `y-protocols` and `lib0` are hard dependencies there (the
realtime stack `AUDIT-realtime-hosting.md` costed and rejected), and its
`@blocknote/shadcn` is the **Radix** build, which this codebase does not use.
It also drags a second `lucide-react` (0.525 against our 1.23) and a second
`tailwind-merge` (2.x against our 3.x).

**What ships instead:** a textarea. What is NOT given up is the storage format —
`lib/jobs/dailyLog.js`'s `textToBody()` writes genuine BlockNote paragraph JSON
into `JobDailyLog.body` and `bodyToText()` reads it back (including nested
children and inline links, so a real BlockNote document round-trips today). The
column holds what the schema says it holds, and dropping the editor in later is
a change to `DailyLogEditor.js` with **no data migration**. Re-try when `@y/y`
publishes a `latest` that satisfies its own consumers.

### Waiting on the owner

| # | Item |
|---|---|
| 15 | `SALES_MAILING_ADDRESS`, `SALES_REPLY_ADDRESSING`, `SALES_INBOUND_SECRET` |
| 16 | Geocoded coordinates stored indefinitely — deleting data is his call |
| 17 | Crew coordinates stored with no notice, consent or purpose — same |
| 18 | Whether RFIs are in scope (a market decision: commercial subcontractors or not) |
| 19 | Whether supervisors see the money notifications |

## Under audit now (nothing being built)

1. **What FieldQuo already has** — change orders, documents, daily logs, time
   tracking, per-job financials, crew, fleet, inventory, service agreements,
   equipment history. Each graded BUILT / PARTIAL / DEAD / ABSENT with
   evidence, because this repo has a history of tables written and never read.
2. **Routing, geolocation and fleet** — what Google's current routing products
   actually offer, **whether optimised routes may legally be stored**, and the
   make-or-break question: whether a browser can clock someone in on arrival
   when the tab is not focused. Plus the employee-monitoring obligations under
   PIPEDA and Quebec Law 25, since a location on a timesheet is surveillance.
3. **The two Downloads projects** — what is worth porting and what must not
   come across.

## First read on the two projects, before the audit lands

Both are built on stacks FieldQuo does not use, so this is a port of ideas and
UI, not of infrastructure.

- **Notion clone**: the valuable part is **BlockNote**, the block editor — that
  is portable. **Liveblocks and Yjs are a paid vendor providing realtime
  multiplayer**, and the honest question is whether a crew member writing
  today's site log needs multiplayer at all. Firebase, Clerk and Radix all
  duplicate or contradict what FieldQuo already has — Radix in particular is
  explicitly not used here.
- **Receipt tracker**: Convex, Clerk and Schematic duplicate FieldQuo's
  database, auth and plan gating. The value is the **extraction** — and it must
  be re-pointed through `lib/ai/provider.js`, which is the only file allowed to
  talk to a model vendor. Its use of **zod** is separately interesting, because
  FieldQuo has no schema-validation library at all and its structured AI output
  is currently prompted JSON plus hand-coercion.

---

## Shipped from the audit: client-site equipment, and fleet (2 September 2026)

Audit rows #10 (**ABSENT**) and #7 (**PARTIAL**). Full write-up in
`docs/ROADMAP.md`; the parts that belong in this file:

**#10 is closed.** `ClientEquipment` + `ClientEquipmentService` hold the
customer's kit and its service history, and `/app/equipment` is the call list
of warranties running out. The audit's sentence — "No warranty period exists
anywhere in the product" — is no longer true, and the `JobVisit.returnReason`
comment at `prisma/schema.prisma` that says the same thing ("grepped for one
before writing this — there isn't one") is now **stale and should be
corrected** by whoever next touches that model. It is not corrected here
because the schema was declared off-limits for this change.

**#7 is closed on the fleet questions and deliberately not on the rest.**
`VehicleDetail` hangs off `Asset` by `assetId`, so the depreciation feeding
job-costing overhead is untouched. What it answers: which van, what mileage,
when is it due, who has it, and what has been done to it. What it does not, on
purpose: telematics, live GPS, route history — `AUDIT-routing-geo.md` settled
that a browser cannot do background location, and ServiceTitan's fleet product
is aimed at a 200-truck operation, not a painter with three vans.

**The discoverability complaint in #7 is also addressed**: the asset register
was reachable only through Settings → Overhead. There is now a **Vehicles** row
in the sidebar (Money group), and a **Client equipment** row next to Clients.

### Two gates, not one

A plate, an odometer and an insurance renewal are OPERATIONS (`user:manage`).
What the van COST is the cost basis (`lib/permissions/costBasis.js`,
`fixedCosts`). A dispatcher gets the screen and not the truck loan. Asserted as
a pair in `scripts/check-equipment-fleet.mjs`, along with `write ⇒ read`.

### Known gaps, named rather than left to be found

- A van has to be an `Asset` first. A **leased** van is not a capital asset and
  has nowhere to live.
- `DELETE /api/assets/[id]` does not clear the `VehicleDetail` behind a deleted
  asset — there is no foreign key between them. Orphans are shown, flagged, and
  removable from the fleet screen rather than silently dropped, because a
  lapsed insurance date is still a real fact about a real van.
- `check:mobile` covers only `/platform`, `/sales` and `/app/clock`. Neither
  new screen is covered by it.
