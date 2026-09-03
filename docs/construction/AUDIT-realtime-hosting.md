# Can Vercel host a Hocuspocus server?

Research only. Nothing was installed, nothing was built, no product code changed.

Opened 2026-09-02, after the owner asked whether self-hosted Hocuspocus could
replace Liveblocks and keep realtime collaborative editing without the vendor
bill.

Every URL below was read on **2026-09-02**. Dates in brackets are the
`last_updated` field the page itself reports, where it has one.

---

## The one-sentence answer

**Yes — Vercel Functions have served WebSockets since 22 June 2026, and a
Hocuspocus server can run on Pro, but only as many short-lived instances that
share state through Redis, never as the one long-lived process Hocuspocus was
designed to be.**

The second half of that sentence is where the work is. Read on before costing
anything.

### The stale answer, and why it is everywhere

Searching this question returns the 2023–2025 answer with total confidence:
"Vercel serverless functions can't host WebSockets because each invocation
terminates after it responds." Ably's SEO pages, old Stack Overflow answers and
several `vercel/community` discussion threads all still say it, and a web search
run during this audit confidently synthesised exactly that — including the flatly
false claim that "WebSocket connections are not supported even with Fluid Compute
enabled."

Vercel's own knowledge-base article that used to say this has been rewritten. It
now opens: *"Vercel Functions natively support WebSocket connections for realtime
features such as interactive AI streaming, chat, and collaborative apps."*
([vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections),
page reports last updated 2026-06-22, read 2026-09-02)

Treat any answer to this question that does not cite a post-June-2026 source as
wrong. That includes the answer a model gives from memory.

---

## 1. Vercel's compute primitives, and which of them hold a socket open

| Primitive | Long-lived bidirectional WebSocket? |
|---|---|
| **Vercel Functions on Fluid compute** (Node.js, Bun, Python, Go) | **Yes**, since 2026-06-22. Capped by max duration. |
| **Edge runtime** | **No.** Must begin responding within 25s; may stream for up to 300s. One-directional streaming, not a socket. |
| **Legacy Serverless Functions** (fluid disabled) | **No.** WebSockets *require* Fluid compute. |
| **Vercel Workflows** | Not a socket. Pitched for "workloads that require unlimited execution time" — pause/resume/durable state, not connections. |

Fluid compute is the current model and is the default for projects created on or
after 2025-04-23. FieldQuo's project predates that date; whether fluid is enabled
on it has **not** been verified in this audit and must be checked in project
settings before anything is planned on top of it.
([/docs/functions](https://vercel.com/docs/functions) [2026-07-15],
[/docs/functions/websockets](https://vercel.com/docs/functions/websockets) [2026-08-10],
[/docs/functions/limitations](https://vercel.com/docs/functions/limitations) [2026-08-24])

### What the WebSockets doc actually promises

Verbatim, from [/docs/functions/websockets](https://vercel.com/docs/functions/websockets) [2026-08-10]:

> "A single WebSocket connection is pinned to one Vercel Function instance.
> Messages sent over that connection reach the same function instance for the
> lifetime of the connection, and Fluid compute allows a single function instance
> to handle multiple WebSocket connections."

> "WebSocket connections close when a Vercel Function reaches its maximum
> duration."

> "New WebSocket connections are not guaranteed to reach the same Vercel Function
> instance. If a client reconnects, it may connect to a different instance. After
> a new deployment, new connections may reach the new deployment while existing
> connections remain on the previous deployment until they close."

> "Store durable state, presence, counters, rooms, and pub/sub coordination in an
> external data store instead of relying on in-memory variables."

Those four paragraphs are the whole answer to this audit. Hold onto the last two.

### The duration ceiling

From [/docs/functions/limitations](https://vercel.com/docs/functions/limitations) [2026-08-24], Node.js runtime, fluid enabled:

| Plan | Default | Maximum | Extended maximum |
|---|---|---|---|
| Hobby | 300s | 300s | — |
| **Pro** | **300s (5 min)** | **800s** | **1800s (30 min)** |

The 800s maximum is GA for Pro. The 1800s extended maximum is **in beta**,
requires function-level configuration, and only works on specific Node.js/Bun/
Python runtime versions.

So on Pro, out of the box, **every editing session's socket is severed after 5
minutes**, and at best after 30 minutes on a beta setting. A crew member writing
a site log for twenty minutes gets disconnected up to four times.

That is survivable — Yjs providers reconnect and resync by design, and Vercel
publishes reconnect-with-backoff client code — but it is churn that a dedicated
server does not have, and it interacts badly with the state problem below.

### Next.js has no WebSocket API

> "Next.js does not expose an API for handling WebSocket upgrades. As a
> workaround, you can use the `experimental_upgradeWebSocket()` API."

The escape hatch is `experimental_upgradeWebSocket()` from `@vercel/functions`.
It requires the `ws` package (not currently a FieldQuo dependency), defaults
`maxPayload` to 256 KiB, and carries two warnings worth quoting
([/docs/functions/functions-api-reference/vercel-functions-package](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) [2026-08-19]):

> "this API only works on the Vercel platform and gives you less control over the
> request lifecycle; when possible, you should handle WebSocket connections using
> native Node.js APIs instead."

> "When developing a Next.js app that uses `experimental_upgradeWebSocket()`
> locally, you must run the development server using `vc dev` with Vercel CLI
> 54.14.2 or above instead of `next dev`."

**That second one is a real, recurring cost paid by every developer on the
project, every day.** Adopting this means FieldQuo's local dev command stops
being `next dev`. And the API is `experimental_` prefixed on a feature that is
itself in public beta — two layers of instability under a core editing surface.

---

## 2. What Hocuspocus actually requires

`@hocuspocus/server` is at **4.6.0, published 2026-08-10** (npm registry, read
2026-09-02). Hocuspocus 4 is a stable release and it changed the relevant facts.

### It is a server that listens on a port

The configuration reference documents a `port` setting — "The port the server
should listen on" (default 80) — and an `address` setting binding the interface.
That is the built-in `Server` class, and it is a long-running process.
([tiptap.dev/docs/hocuspocus/server/configuration](https://tiptap.dev/docs/hocuspocus/server/configuration))

### But v4 no longer *requires* that shape

From [RELEASE_NOTES_V4.md](https://github.com/ueberdosis/hocuspocus/blob/main/RELEASE_NOTES_V4.md) (raw, read 2026-09-02):

> "Hocuspocus is no longer tied to the Node.js `ws` library. The server now uses
> crossws, a universal WebSocket adapter, enabling Hocuspocus to run on: Node.js
> (with `ws` or `uWebSockets.js`), Bun, Deno, Cloudflare Workers."

`handleConnection()` now accepts "any `WebSocketLike` object and a web-standard
`Request`." Confirmed in the dependency tree: `@hocuspocus/server@4.6.0` depends
on `crossws@^0.4.4` — the same abstraction Vercel's own Nitro and h3 WebSocket
examples are built on.

**This is the one genuinely encouraging finding for the Hocuspocus-on-Vercel
path.** `experimental_upgradeWebSocket()` hands you a `ws` WebSocket; `handleConnection()`
accepts a `WebSocketLike`. The shapes line up. Nobody has published a working
Hocuspocus-on-Vercel adapter as far as this audit could find, so it would be
novel integration work, but it is not obviously blocked.

Note: **v4 requires Node.js 22 or later.** This machine is on Node v20.19.0 and
`package.json` declares no `engines` field. Vercel's Node runtime offers 22, so
this is a local-toolchain and CI concern, not a hosting blocker.

### It holds Yjs documents in memory. That is the whole design.

A Hocuspocus instance loads a `Y.Doc` into memory when the first client opens it,
applies every client's updates to that in-memory doc, broadcasts the result, and
persists via `onStoreDocument` — debounced, controlled by the `debounce` and
`maxDebounce` settings. The in-memory document is the authority between saves.

This is the crux. **Vercel says new connections are not guaranteed to reach the
same instance.** Two people opening the same site log can therefore land on two
different instances, each with its own in-memory copy of the same `Y.Doc`, each
broadcasting to its own half of the room. Without coordination they diverge, and
the debounced writes race each other into the database.

### What Redis does, and what it does not

From the Hocuspocus scalability and Redis pages
([guides/scalability](https://tiptap.dev/docs/hocuspocus/guides/scalability),
[server/extensions/redis](https://tiptap.dev/docs/hocuspocus/server/extensions/redis), read 2026-09-02):

- **What it does:** syncs changes and awareness state between instances, and
  "propagate[s] all received updates to all other instances." It is the piece
  that makes multiple instances behave as one room.
- **What it does not do:** *"The Redis extension does not persist data; it only
  syncs data between instances."* Long-term storage is a separate Database
  extension.
- **It does not remove statefulness.** Redis lets several stateful processes
  share state. It does not make any one of them stateless. Every instance still
  holds the full `Y.Doc` in memory.
- **It costs more CPU, not less:** *"all messages will be handled on all
  instances,"* so Redis across multiple servers will not reduce CPU load — it
  increases it.
- It requires unique server names per instance and assumes a load balancer.

Also worth noting for honesty: the scalability guide contains a **"TODO" marker**
and is visibly incomplete. Tiptap's own recommendation there is not "scale one
deployment" but *"deploy multiple independent Hocuspocus instances and split
users by a document identifier"* — i.e. shard by hand. That is the opposite of
what Vercel's autoscaler does.

### So: does Redis make it work on Vercel?

Mechanically, probably yes. Architecturally it means:

- Redis is **mandatory**, not optional, from the very first day and the very
  first two concurrent users — because Vercel gives no instance affinity.
- Every instance handles every message for every document in the fleet.
- Redis becomes a hard dependency of the editor. Redis down = editing down.
- Two of Vercel's stated behaviours are actively hostile: instance-per-connection
  is not stable across reconnects, and **during a deploy, old and new
  deployments serve the same room simultaneously** until the old sockets time out.

You are paying the full cost of a distributed stateful system to run something a
single $7/month box does natively. That is the honest shape of it.

---

## 3. The verdict, and what hosting actually costs

**Technically possible on Vercel Pro. Architecturally a poor fit.** Hocuspocus
assumes a stable process holding documents in memory; Vercel guarantees the
opposite and hands you Redis to paper over it.

### If it ran on Vercel (Pro, `iad1`, rates from [/docs/functions/usage-and-pricing](https://vercel.com/docs/functions/usage-and-pricing) [2026-06-16])

Active CPU $0.128/hr; Provisioned Memory $0.0106/GB-hr; Invocations $0.60/million.

The billing subtlety that matters: Vercel's changelog says you pay "only for time
spent processing messages, not idle connection time." **That is true of Active
CPU only.** The pricing doc is explicit that Provisioned Memory is "billed for
the entire instance lifetime in GB-hours" and "billing continues until the last
in-flight request completes." An open WebSocket is an in-flight request. So an
idle socket bills memory.

At a 2 GB default instance:

| Instance alive | Memory cost/mo |
|---|---|
| 2 h/day (60 h) | **$1.27** |
| 6 h/day (180 h) | **$3.82** |
| 24/7 (730 h) | **$15.48** |

Add maybe $0.13–$0.64 of Active CPU and negligible invocations. Pro includes a
**$20/month credit**, so at FieldQuo's scale this is very likely **$0 marginal
cash cost**, absorbed by credit already being paid for. Plus a Redis bill.

The cost is not the money. It is the `experimental_` API, the `vc dev`
requirement, the 5-minute socket, the mandatory Redis, and the deploy-time
split-brain.

### If it ran on a real always-on process

| Option | Cost for a small always-on Node service | Notes |
|---|---|---|
| **Fly.io** | `shared-cpu-1x` 256 MB ≈ **$2.02/mo**; RAM ≈ **$5/GB/30 days**; so 512 MB ≈ **$3.30/mo**. Egress $0.02/GB (NA/EU). | No general free compute tier. Community support free; paid support $29/$199/$2,500 per month. ([fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/)) |
| **Render** | Free = $0 but **spins down after 15 min idle** with a ~1 min cold start — fatal for a socket server. Starter (0.5 CPU/512 MB) **$7/mo**; Standard (1 CPU/2 GB) **$25/mo**. Hobby workspace has no monthly fee. | Simplest mental model of the three. ([render.com/pricing](https://render.com/pricing) and [/docs/free](https://render.com/docs/free), [/docs/compute-plans](https://render.com/docs/compute-plans)) |
| **Railway** | Hobby **$5/mo** incl. $5 credit; Pro $20/mo incl. $20 credit. Memory ≈ **$10/GB/mo**, CPU ≈ **$20/vCPU/mo**, egress $0.05/GB, per-second billing. A near-idle 512 MB service ≈ **$5–8/mo**. | Highest egress price of the three. ([railway.com/pricing](https://railway.com/pricing)) |
| **Small VM** (Hetzner/DO/Lightsail) | **$4–6/mo** | Cheapest cash, most operational work: you own the OS, TLS, patching, restarts. |

**Realistic all-in for self-hosted Hocuspocus: $7–15/month** for the process plus
a managed Redis if you ever run more than one instance (at 1–20-person
contractors, you would not need to for a very long time).

### The operational cost, which is the real number

An always-on server is not a line item, it is a thing that can be down while the
rest of the app is up. Concretely, adopting one means FieldQuo acquires:

1. **A second deploy target.** Vercel deploys on push; this does not. Two
   pipelines, two rollback stories, and a version-skew window where the Next app
   and the collab server disagree about a document's shape.
2. **A new independent failure mode.** Today FieldQuo is up iff Vercel and Neon
   are up. This adds a third. And it fails *partially* — the app loads, the page
   renders, the editor just silently stops syncing. That is precisely the failure
   the house rule forbids: **a control that appears to work and doesn't.** Any
   adoption must ship a visible disconnected state, not a spinner.
3. **Monitoring FieldQuo does not have.** Nothing in this repo watches an
   external process. Uptime checks, alerting and an on-call expectation are all
   new.
4. **A memory ceiling nobody is watching.** Documents accumulate in RAM. 512 MB
   is fine until it isn't, and the symptom is an OOM restart that drops every
   open editor at once.
5. **Auth duplication.** The collab server must independently authenticate the
   member and authorise the tenant. Better Auth sessions and `lib/currentMember.js`
   live in the Next app. Getting this wrong is cross-tenant document access — and
   FieldQuo's non-negotiables treat tenant isolation as a security boundary.

Point 5 alone is more work than the entire editor swap.

---

## 4. BlockNote with no Yjs provider — confirmed, and better than the last audit thought

**It works standalone, and as of 0.54.0 Yjs is genuinely optional at *install*
time, not merely at runtime.** The previous audit's finding here is now out of
date.

From the npm registry (`@blocknote/core@0.54.0`, published 2026-08-13, read
2026-09-02), `yjs`, `y-prosemirror`, `y-protocols`, `@y/y`, `@y/prosemirror` and
`@y/protocols` are all **peer dependencies marked `"optional": true`** in
`peerDependenciesMeta`. Collaboration is also behind separate subpath exports
(`@blocknote/core/yjs`, `@blocknote/core/y`), so it is tree-shakeable.

The previous audit stated, of BlockNote 0.14.5: *"dropping Liveblocks does not
drop Yjs from the tree."* Against 0.54.0 that is **no longer true**. Skip the
provider and Yjs does not get installed at all.

**Document format:** a JSON array of blocks.
([blocknotejs.org/docs/foundations/document-structure](https://www.blocknotejs.org/docs/foundations/document-structure))

```ts
type Block = {
  id: string;
  type: string;
  props: Record<string, boolean | number | string>;
  content: InlineContent[] | TableContent | undefined;
  children: Block[];
};
```

Read it with `editor.document`, seed it with `initialContent`, persist it with an
`onChange` handler. That maps onto a Prisma `Json` column with no translation
layer. This is exactly the owner's fallback and it is well supported.

---

## 5. BlockNote's UI packages — the Radix finding is now WRONG

The previous audit flagged this as needing verification before any decision. It
has now been verified, and **it does not hold.**

Dependencies of `@blocknote/shadcn@0.54.0`, straight from the npm registry
(read 2026-09-02):

```
@base-ui/react ^1.6.0
class-variance-authority ^0.7.1
clsx ^2.1.1
lucide-react ^0.525.0
tailwind-merge ^2.6.0
peer: tailwindcss ^4.1.12, react ^18 || ^19
```

**There is not a single `@radix-ui/*` package.** BlockNote's shadcn integration
migrated to Base UI. The "seven Radix hard-deps" conclusion was true of the
mid-2024 lockfile (0.14.5, published 2024-07-03) and is false today.

And `@base-ui/react ^1.6.0` is **the exact dependency FieldQuo already declares**
in its own `package.json`. Same major, same range. The package that was
previously the disqualifying option is now the closest match to FieldQuo's stack
of any of them.

Full current picture:

| Package | Brings | Verdict for FieldQuo |
|---|---|---|
| `@blocknote/shadcn` | `@base-ui/react`, cva, clsx, tailwind-merge, lucide-react | **Best fit.** Matches the existing UI library and Tailwind v4. |
| `@blocknote/mantine` | peer `@mantine/core` + `@mantine/hooks` (8.x or 9.x) | Still a second design system. Still no. It is BlockNote's own "recommended for new projects", which is irrelevant to a project that already has a design system. |
| `@blocknote/ariakit` | `@ariakit/react ^0.4.19` | A third component library. No. |
| `@blocknote/react` alone | `@floating-ui/react`, tiptap, emoji-mart | The headless path. |

**Is there a headless path?** Yes, but it is not a packaged one. BlockNote's
getting-started page offers only the three styled options and does not document
an unstyled build. `@blocknote/react` on its own exposes the hooks and the
editor; the toolbars, slash menu and side menu are what the UI packages provide,
and building those by hand is real work. **The pragmatic answer has changed: take
`@blocknote/shadcn` and restyle it, rather than build headless from scratch.**

**One genuine conflict to resolve before installing:** `@blocknote/shadcn`
depends on `lucide-react ^0.525.0`; FieldQuo declares `lucide-react ^1.23.0`.
Those ranges do not overlap, so npm would install a nested second copy of the
icon library. Not fatal, but it is bundle weight and it should be checked and
named rather than discovered later.

Nothing here was installed or built. **These are registry-metadata facts, not a
compatibility test.** A real `npm install` against React 19.2 / Next 16 /
Tailwind v4 remains the gate before adoption.

---

## 6. Offline — the basement question

**Plain JSON save, no Yjs.** The crew member types. `onChange` fires and updates
React state, so the text is on screen. The `fetch` to save it fails. Unless
something catches that failure and says so, they walk out of the basement
believing the log is saved and it is gone. Note the repo's own recurring failure
class #2: `if (res.ok) { ... }` with no `else`. **Whichever architecture is
chosen, this is the bug to prevent.** A local draft in `localStorage` keyed by
record id, plus a visible "not saved yet" state, fixes 90% of it for a day's
work and needs no CRDT at all.

**Yjs + a network provider, no local persistence.** Better but not solved. The
edits live in the in-memory `Y.Doc` and merge cleanly on reconnect — but only if
the tab survives. Close it, lose signal and background it long enough for iOS to
evict it, or crash the browser, and the memory goes with it. A network provider
gives you *resync*, not *durability*. The previous audit made this point and it
is correct.

**Yjs + `y-indexeddb`.** This is the piece that actually gives offline. From the
Yjs docs ([docs.yjs.dev/ecosystem/database-provider/y-indexeddb](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb)):
`new IndexeddbPersistence(docName, ydoc)` persists every change to the browser's
IndexedDB, reloads the document on the next visit, fires a `synced` event when
loading completes, and composes with a network provider — you can run both at
once. Close the tab in the basement, reopen it in the van, and the edits are
still there and merge on reconnect.

Two things to weigh:

- `y-indexeddb` is at **9.0.12, last published 2023-11-02** — nearly three years
  without a release (npm registry, read 2026-09-02). Yjs itself is actively
  maintained (13.6.32, 2026-08-04). Stable-and-finished is a reasonable reading
  of a small adapter, but it is a dependency nobody is patching.
- IndexedDB is per-browser and per-device. It is a crash guard, not a backup.

**Important:** `y-indexeddb` needs Yjs. It does **not** need Hocuspocus,
Liveblocks, or any server. If offline durability is the actual goal, it is
achievable with `yjs` + `y-indexeddb` + ordinary HTTP saves and **no realtime
server at all**. That is a genuinely available middle path that the framing of
this question hides.

---

## 7. Testing the "nobody needs multiplayer" argument

The previous audit concluded that FieldQuo's document surfaces are single-author.
Rather than repeat it, here is what the schema and the trades actually say.

### Where two people plausibly collide

1. **Two crew on today's log at end of shift.** Real but rare, and the right fix
   is schema, not CRDT: give each crew member their own log-entry row. One shared
   prose blob that two people co-edit is a design choice, not a requirement.
2. **An estimator and the owner on the same quote.** **This one is real and it
   happens.** The estimator builds the quote in a driveway; the owner reviews the
   pricing before it goes out. If the owner opens it while the estimator is still
   editing, one of them loses work. This is the strongest counter-example and it
   deserves the weight.
3. **Office and field on a callback.** `JobVisit.returnNotes` gets written on
   site while the office is on the phone with the same client. Two devices, one
   moment, one short text field.
4. **Two admins on a company note.** Rare, low stakes.

### But look at what case 2 actually is

A FieldQuo quote is **not prose**. It is line items, scope groups, add-ons and
pricing — the `PATCH` handler at `app/api/quotes/[id]/route.js` reasons about
`lineItems`, `scopeGroups`, costing rows and status transitions. A CRDT rich-text
editor does nothing for a line-item table. Making case 2 safe with Yjs would mean
modelling the entire quote as Yjs shared types, which is an enormously larger
change than swapping in a block editor, and it is not what
"BlockNote + Hocuspocus" buys you.

**So the argument survives contact, but with its conclusion changed.** The claim
"nobody edits the same thing at the same time" is too strong — they do. The claim
that survives is sharper and more useful:

> Concurrent editing in FieldQuo happens on **structured records**, not on prose
> documents. Realtime collaborative text editing would be deployed on the
> surfaces where collisions are rarest, and would not touch the one surface where
> collisions genuinely occur.

### And here is the finding that matters more than any of this

FieldQuo has **99 `PATCH`/`PUT` route files** and, on inspection, **no optimistic
concurrency control anywhere** — no `If-Match`, no version column compared on
write, no `updatedAt` precondition. Every one of those routes is last-write-wins.
`app/api/quotes/[id]/route.js` even documents the choice at line 113:

```js
// Quotes are edited directly, not versioned — unlike invoices, there's no signed
// commitment yet before acceptance, so a straight PATCH is the right model.
```

That reasoning is about *versioning history*, which is fair. It is silent on
*concurrent writers*, which is the different problem. Today, if the owner saves a
quote three seconds after the estimator does, the estimator's work vanishes with
no error, no warning and no trace.

**The owner's instinct is right, and it is cheaper than he thinks.** He said he
wants "notifying when a document has been updated by someone else in the team" —
a banner. A stale-write guard *is* that banner, and it is the correct fix for the
real collision case:

- add `updatedAt` (already present on most models) to the PATCH payload;
- reject the write when the stored `updatedAt` is newer;
- return 409 and show "Sarah changed this quote 2 minutes ago — reload to see her
  changes."

That is a few dozen lines, no new dependency, no new server, no monthly bill, and
it protects the quote — the document that is worth actual money — which no amount
of Hocuspocus would have protected.

---

## 8. Recommendation

| Path | Cash/month | Operational burden | Protects the real collision? |
|---|---|---|---|
| **A. BlockNote → JSON → Postgres, no Yjs** | **$0** | None. One more Prisma column. | No, on its own |
| **A+. Same, plus a stale-write guard** | **$0** | ~a day's work, no new infra | **Yes** |
| **B. + `yjs` + `y-indexeddb`, no server** | **$0** | Small. One unmaintained-since-2023 dep. | No, but survives the basement |
| **C. Hocuspocus on Vercel WebSockets** | ~$0–16, likely inside the $20 Pro credit, + Redis | High: `experimental_` API on a public beta, `vc dev` replaces `next dev` for everyone, 5-min socket, mandatory Redis, deploy split-brain, novel unproven adapter | No — wrong surface |
| **D. Hocuspocus on Fly/Render/Railway** | **$7–15** + Redis if scaled | High: second deploy target, third failure mode, new monitoring, memory ceiling, duplicated tenant auth | No — wrong surface |
| **E. Stay on Liveblocks** | $30/mo Pro + $0.002/collaboration-minute | Low | No — wrong surface |

**I would choose A+, and add B only if the basement scenario is real.**

Reasons, in order:

1. **The expensive options do not solve the problem that actually exists.**
   C, D and E all deliver collaborative editing of *prose*. FieldQuo's one real
   concurrent-edit risk is a *quote*, and none of them touch it. Paying $7–30 a
   month and taking on a second deploy target to protect the wrong document is
   the worst available trade.
2. **The stale-write guard is the owner's own idea, correctly aimed.** He asked
   for a "someone else updated this" banner. That is optimistic concurrency. It
   costs a day and zero dollars, and it plugs a silent data-loss hole across 99
   routes.
3. **BlockNote is now a much cleaner port than the last audit found.** Yjs is an
   optional peer dependency, and `@blocknote/shadcn` sits on `@base-ui/react
   ^1.6.0` — the exact library FieldQuo already uses. The two findings that made
   it look expensive in the previous audit have both expired. Verify with a real
   install; resolve the `lucide-react` range conflict.
4. **Vercel WebSockets are a genuine change and worth banking, but not spending
   yet.** The right conclusion is not "Hocuspocus is impossible" — it is that
   FieldQuo no longer needs to stand up a server *if it ever wants realtime*.
   Presence and "Sarah is viewing this" become a modest feature on infrastructure
   already paid for, rather than a new box. That option is now open. It should
   stay unexercised until a customer asks.

**What I would not do:** adopt path C to save the $7 of path D. Choosing an
`experimental_`-prefixed API on a public-beta platform feature, and making every
developer swap `next dev` for `vc dev`, to avoid a Fly.io bill smaller than one
coffee, is optimising the wrong variable.

---

## What was not established

Named plainly, so nobody treats this as settled:

- **Nothing was installed, built or executed.** Every BlockNote and Hocuspocus
  dependency claim is npm registry metadata read on 2026-09-02, not a resolved
  tree. `npm install` against React 19.2 / Next 16 / Tailwind v4 is still the gate.
- **Whether Fluid compute is enabled on FieldQuo's Vercel project is unverified.**
  The project predates the 2025-04-23 default. WebSockets require it.
- **No Hocuspocus-on-Vercel adapter was found in the wild.** The crossws/
  `WebSocketLike` shapes line up on paper. That is an argument, not a
  demonstration.
- **Redis pricing was not costed**, because path C/D were not recommended. It
  would need adding to either.
- **Render's workspace-plan fee** could not be read from Render's own docs pages;
  only the instance prices ($0 / $7 / $25) were confirmed from `render.com/pricing`.
- **The quote-collision scenario is inferred** from the schema and the `PATCH`
  handler, not from production telemetry. Nothing measures how often it happens.
  If it happens never, A+ is cheap insurance; if it happens weekly, A+ is urgent.
