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
