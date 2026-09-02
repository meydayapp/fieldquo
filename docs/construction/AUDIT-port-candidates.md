# The two Downloads projects — what is worth porting

Companion to `docs/construction/STATUS.md`, item 3 of its audit list. Written
2026-09-02. **Research only — nothing in this document has been built.**

Both projects are course-project scaffolds, not products. Both are built on
stacks FieldQuo does not use. Neither can be "ported" in the sense of copying
files across; the honest question for each is *which idea survives being
rewritten against Better Auth, Neon/Prisma, `@base-ui/react` and
`lib/ai/provider.js`*.

Read alongside AGENTS.md. Four of its rules decide most of what follows:

- `lib/ai/provider.js` is the **only** file permitted to talk to a model vendor.
- `@base-ui/react`, and explicitly **never Radix**.
- Better Auth, and Neon + Prisma. A port that drags in a second auth system or
  a second database is not a port.
- Never ship a control that appears to work and doesn't.

---

## Table of contents

- [A. Notion clone — what it actually contains](#a-notion-clone)
- [The editor question: does FieldQuo need multiplayer?](#the-editor-question)
- [B. Receipt tracker — what the extraction actually does](#b-receipt-tracker)
- [The zod question](#the-zod-question)
- [Cost summary — every paid vendor named](#cost-summary)
- [Port plan, ranked by value-per-effort](#port-plan)
- [What I did not verify](#what-i-did-not-verify)

---

<a name="a-notion-clone"></a>

## A. Notion clone

`~/Downloads/notion-clone-cloudflare-workers-liveblocks-realtime-collab-nextjs-tailwind-typescript-firebase-main-2`

55 source files. Next 14, React 18, Clerk, Firestore, Liveblocks, BlockNote.

### The shape of it, before the file list

One "document" in this project lives in **two databases at once**. The
**title** is a Firestore field (`documents/{id}.title`, written by
`components/Document.tsx`). The **body** is a Yjs `XmlFragment` inside a
Liveblocks room (`components/Editor.tsx`). Membership is a third structure —
a Firestore collection group `users/{email}/rooms/{roomId}` holding
`{userId, role}`.

Neither store is Postgres, and the split is not incidental: it is what
Liveblocks-as-the-body forces. Any port replaces all three with Prisma rows,
at which point almost nothing in this repo is reusable code.

### 1. What is genuinely valuable, and which files carry it

| Value | File | Honest size of the transferable part |
|---|---|---|
| BlockNote wiring | `components/Editor.tsx` | ~6 lines. `useCreateBlockNote()` + `<BlockNoteView editor theme>`. The other ~90 lines are Liveblocks/Yjs provider lifecycle. |
| "Mine / Shared with me" list grouping | `components/Sidebar.tsx` | A UI idea, ~20 lines of reduce. Applies to any list in `/app`. |
| Per-document ACL as an owner/editor pair | `actions/actions.ts`, `lib/useOwner.ts`, `components/ManageUsers.tsx` | Idea only. FieldQuo already has `Member` + `lib/permissions/enforce.js` with per-resource levels, which is strictly richer. |
| "Ask this document a question" dialog | `components/ChatToDocument.tsx` | The **UX pattern**. See the warning below. |
| Deterministic per-user colour | `lib/stringToColor.ts` | 8 lines. Only needed for multiplayer cursors, so it dies with them. |

**The AI in project A is not in project A.** Both `ChatToDocument.tsx` and
`TranslateDocument.tsx` POST to `${NEXT_PUBLIC_BASE_URL}/chatToDocument` and
`/translateDocument`, and `.env.example` sets that base URL to
`https://n-clone-cloudflare-workers.papafam.workers.dev` — a Cloudflare Worker
that was never downloaded. There is **no prompt, no model call, and no parsing
code** to read. What exists is two dialogs and a `fetch`. Anyone told "port the
document chat" should know there is nothing behind it.

Both dialogs also contain the exact failure AGENTS.md lists as recurring class
#2 — `if (res.ok) { ... }` with no `else`. A failed call leaves the spinner
state cleared and the panel blank, with no error shown. Do not carry that
shape across; `reportResponseError` / `fetchJson` exist.

### 2. What must not come across, and why

**Clerk** — `middleware.ts`, and `auth().protect()` in `actions/actions.ts`,
`app/auth-endpoint/route.ts`, `app/doc/[id]/layout.tsx`. A second auth system.
FieldQuo is Better Auth, with organisations as companies.

**Firebase + firebase-admin** — `firebase.ts`, `firebase-admin.ts`,
`actions/actions.ts`, `lib/useOwner.ts`, `components/Sidebar.tsx`,
`components/Document.tsx`, `components/ManageUsers.tsx`. A second database,
and `react-firebase-hooks` on top of it. Every one of these files is a
client-side live query against Firestore — there is no server data layer to
adapt.

**Radix** — five `@radix-ui/*` packages are direct dependencies
(`avatar`, `dialog`, `select`, `slot`, `tooltip`). Worse, `@blocknote/shadcn`
**hard-depends** (not peer-depends) on seven more:
`react-dropdown-menu`, `react-label`, `react-popover`, `react-select`,
`react-slot`, `react-tabs`, `react-toggle`, `react-tooltip` — verified from
this project's own `package-lock.json`. Choosing that BlockNote UI package
brings Radix into FieldQuo through the back door regardless of what the app
code imports.

**`deleteDocument` in `actions/actions.ts`** — hard-deletes the Firestore
document, batch-deletes every membership row via a collection-group query, and
calls `liveblocks.deleteRoom()`. Three irrecoverable deletes in one function
with no confirmation beyond a button. Against the owner's standing rule on data
deletion and against this repo's own convention (`Job.archivedAt`,
`JobPhoto.taskId` `onDelete: SetNull` so "evidence outlives the record that
asked for it").

**Next 14 synchronous `params`** — `app/doc/[id]/page.tsx` and
`app/doc/[id]/layout.tsx` both destructure `{ params: { id } }` in the
signature. In Next 16 `params` is a Promise. AGENTS.md failure class #3.

**Tutorial scaffolding left in the provider** — `components/RoomProvider.tsx`
ships `initialStorage: { people: new LiveList([new LiveObject({ name: "Marie", age: 30 })]) }`
to every room, against a `Storage` type in `liveblocks.config.ts` that declares
no such field (it is entirely commented out). A field written and never read,
failure class #1, present in the source material.

**`TranslateDocument.tsx`** — beyond having no backend, do not reproduce it on
any client-facing surface. Non-negotiable #6: a document keeps the language it
was created in, and nothing is machine-translated at send time.

---

<a name="the-editor-question"></a>

## The editor question

### Does FieldQuo need multiplayer? No.

The three surfaces the owner named:

- **A daily site log inside a job.** One crew member, one phone, one day, often
  standing up. Today this is `JobVisit.notes` — a single nullable `String`.
- **Call notes in the sales rep portal.** One rep who just hung up. Today this
  is `SalesLead.notes` — a single nullable `String`.
- **Notes in the platform console.** Superadmin, and non-negotiable #3 means
  the console can view everything and edit nothing on a company's data — so
  anything editable there is FieldQuo's own note *about* a company, not a
  shared artefact anyone else is typing into.

Every one of these is a single author. There is no scenario in the stated
product where two people type into the same paragraph at the same second.

This repo has already reasoned about its real concurrency shape, and reached
the opposite conclusion from a CRDT. `JobMaterial`'s schema comment:

> A Json blob read-modify-written by two phones in a supply yard loses one of
> the ticks, and the person who lost it has no way to know.

The fix chosen there was **one row per line**, not a merge algorithm. That is
the house pattern, it is cheaper, and it is legible in `psql`.

### What is actually lost by dropping Liveblocks and Yjs

Four things are on the table. Only one of them is real, and porting this
project would not deliver it anyway.

1. **Live cursors and presence avatars.** `LiveCursorProvider.tsx`,
   `Avatars.tsx`, `ui/following-pointer.tsx`. Worth nothing to a single author.
   Lost with no regret.

2. **Conflict-free merge when the same note is open on two devices.** Real, but
   rare, and the mitigation is ordinary: last-write-wins guarded by an
   `updatedAt` check that *refuses* a stale overwrite and says so. That is
   honest, it is one `if`, and it costs nothing. Silently merging two people's
   half-sentences is arguably worse for a legal-ish record like a site log than
   refusing the second save.

3. **Offline editing.** This is the one that genuinely matters — a contractor
   in a basement with no signal. **But this project does not have it.** Yjs
   gives you offline persistence via `y-indexeddb`, which is not a dependency
   here; Liveblocks' provider gives you *resync*, not local durability. Porting
   project A as-is buys zero offline capability. Offline for FieldQuo is a
   service-worker / IndexedDB draft-queue problem across the whole app — every
   form, not just an editor — and belongs with `docs/MOBILE-*.md`, not here.

4. **Version history and comments-anchored-to-text.** Liveblocks sells both.
   This project uses neither. Nothing to lose that it ever had.

**Verdict: Liveblocks is a recurring bill and a large dependency for a feature
none of the three named surfaces needs.** Say no now; the door is not closed —
if a genuinely multi-author surface ever appears, this decision gets revisited
against that surface rather than pre-paid against a hypothetical one.

### Is BlockNote itself portable? Yes — but "portable" is doing a lot of work

The engine ports. The chrome does not. From this project's lockfile
(BlockNote 0.14.5/0.14.6):

- **`@blocknote/core`** hard-deps on 20 `@tiptap/extension-*` packages,
  `@tiptap/core`, `@tiptap/pm`, six `prosemirror-*` packages, the entire
  unified/remark/rehype chain (`unified`, `remark-gfm`, `remark-parse`,
  `remark-rehype`, `remark-stringify`, `rehype-format`, `rehype-parse`,
  `rehype-remark`, `rehype-stringify`, `hast-util-from-dom`), `uuid`, and —
  note this — **`yjs`, `y-prosemirror` and `y-protocols`**.

  So **dropping Liveblocks does not drop Yjs from the tree.** It drops the
  *vendor* and the *bill*, which is the part that costs money. Yjs arrives
  either way as a transitive dependency of the editor core.

- **The UI layer forces a choice, and both options are wrong for this repo.**
  `@blocknote/mantine` pulls `@mantine/core` + `@mantine/hooks` + `@mantine/utils`
  — a second complete design system alongside Tailwind v4 and `@base-ui/react`.
  `@blocknote/shadcn` pulls the seven Radix packages listed above, plus
  `react-hook-form`, `zod`, `tailwindcss` (v3), `tailwindcss-animate`,
  `autoprefixer` and `postcss` as **hard** dependencies. There is no
  `@blocknote/base-ui` package. `@blocknote/react` on its own still ships
  `@floating-ui/react` and `react-icons` and its own default menus.

  The only clean path is a custom UI built against `@blocknote/react`'s
  headless hooks. That is not a port; that is a project.

- This project pins React 18 and BlockNote 0.14 (mid-2024). FieldQuo is React
  19.2 / Next 16 / Tailwind v4. Current BlockNote supports React 19, but every
  dependency fact above is from the 0.14 lockfile and must be re-checked
  against whatever version is actually installed before any decision.

### What the surfaces actually need instead

A daily log entry is: a date, a few paragraphs, a photo strip, who was on site,
and what stopped the work. That is a `<textarea>`, the existing
`app/components/MediaUploader.js`, and the existing `JobPhoto` model with its
`stage` / tags / comments / annotation layer already built.

**Do not ship a Notion editor to hold three sentences typed with gloves on.**
If real formatting is wanted later — headings in a scope document, a table in a
handover pack — that is a different requirement, on a different surface, and it
should be argued on its own then.

---

<a name="b-receipt-tracker"></a>

## B. Receipt tracker

`~/Downloads/receipt-tracker-saas-ai-agent-nextjs-15-schematic-stripe-clerk-main`

Next 15, React 19, Clerk, Convex, Inngest + `@inngest/agent-kit`, Schematic.

### What the extraction actually does — precisely

Three agents, two stages, **four model IDs across two vendors** for one receipt.

**Stage 1 — `inngest/agents/receiptScanningAgent.ts`.**
The agent's own model is `openai("gpt-4o-mini")`, but the extraction happens
inside its `parse-pdf` tool, which calls
**`anthropic("claude-3-5-sonnet-20241022")`**, `max_tokens: 3094`, using
Anthropic's native `{ type: "document", source: { type: "url", url } }` content
block — i.e. the vendor fetches and reads the PDF itself.

The prompt is a **literal JSON example pasted into the user message** (not a
schema, not `response_format`), asking for:

```
merchant     { name, address, contact }
transaction  { date (YYYY-MM-DD), receipt_number, payment_method }
items[]      { name, quantity, unit_price, total_price }
totals       { subtotal, tax, total, currency }
```

(The example has a stray trailing comma before its closing brace.)

The system prompt additionally asks the model to correct OCR errors, normalise
dates and currency, and *"return a structured response indicating incomplete
data"* when fields are missing — **nothing anywhere checks for that response,
so that instruction is decoration.**

**Stage 2 — `inngest/agents/databaseAgent.ts`.**
`gpt-4o-mini`. This is where zod actually appears: the `save-to-database`
tool's `parameters` is a zod object, so the **tool-call schema is the
validation**. Its fields:

`fileDisplayName`, `receiptId`, `merchantName`, `merchantAddress`,
`merchantContact`, `transactionDate` *(string)*, `transactionAmount`
**(string)**, `receiptSummary`, `currency`, `items[] { name, quantity: number,
unitPrice: number, totalPrice: number }`.

**Stage 3 — `inngest/agents/supervisorRoutingAgent.ts`.**
`claude-3-5-haiku`, routes between the other two. **It is not wired in.**
`inngest/agent.ts` imports it commented out and uses `getDefaultRoutingAgent()`
instead — while the run prompt still ends *"Start with the Supervisor agent."*
A live instruction naming an agent that is not in the network. The network's
`defaultModel` is a fourth ID, `claude-3-5-sonnet-latest`.

### What its "validation" is actually worth

The zod schema is a **shape** check, not a **truth** check, and the design
around it is worse than the absence of one would be:

- `transactionAmount` is a **string**. Nothing parses it to a number, nothing
  checks `currency` is a real ISO code, nothing checks `transactionDate` is a
  date.
- **Nothing checks that the line items sum to the total.** Stage 1 extracts
  `subtotal`, `tax` and `total`; stage 2 asks a *second* model to produce one
  `transactionAmount` described as *"summing all the items on the receipt"*.
  **The arithmetic passes through an LLM twice.** That is the single worst
  decision in the project, and it is the exact inverse of this repo's rule —
  `lib/ai/expenseSummary.js`: *"Every figure is computed above and passed in.
  The model writes prose around numbers it was handed — it never calculates."*
- No `response_format` / structured outputs anywhere. Stage 1 returns free text
  that stage 2's model reads as prose.
- The tool handler swallows its own error and returns `{ addedToDb: "Failed" }`.
  The outer function still returns `state.kv.get("receipt")` (undefined), and
  `actions/uploadPDF.ts` has **already returned `success: true`** to the
  browser. A failed scan therefore looks like a successful upload, leaves the
  row at `status: "pending"` forever, and tells nobody. There is no timeout
  sweep over `pending`.

### What must not come across, and why

**Convex** (`convex/*`, `lib/convexClient.ts`) — a second database.
**Clerk** (`middleware.ts`, `currentUser()`, `actions/getTemporaryAccessToken.ts`)
— a second auth system.

**Schematic** (`lib/schematic.ts`, `components/schematic/*`) — a paid
entitlement vendor duplicating `lib/features/registry.js`,
`lib/features/gate.js` and `app/components/FeatureGate.js`, which FieldQuo
already has and which is mechanically checked by
`scripts/check-feature-flags.mjs`.

Note *how* it gates, too: `components/PDFDropzone.tsx` calls
`useSchematicEntitlement("scan-receipt")` and renders `disabled={!isFeatureEnabled}`
on the button — and the server action `uploadPDF` **never re-checks it**. A
client-side-only paywall. `lib/expenses/csvImport.js`'s own header already
names this as bug #3 of a reference implementation it deliberately refused to
repeat. Do not reintroduce it.

**`@inngest/agent-kit`** — disqualifying, on its own. Every agent constructs
its own vendor client (`openai(...)`, `anthropic(...)`) inside its own file.
That directly violates the rule that `lib/ai/provider.js` is the only file that
talks to a model vendor, and — concretely — it would bypass `checkAiQuota()`
before and `recordAiUsage()` after, so receipt scans would be **invisible in
`/platform/ai-usage` and uncapped against FieldQuo's card**. This is the same
class of problem as the recent *"Every agent shipped on the priciest voice"*
commit. Anything ported must run through `complete()` or `runToolLoop()`.

**Inngest** — the queue is not needed. A receipt scan is one vision call, in
the order of 5–15 seconds, which fits inline in a route. FieldQuo already runs
21 Vercel crons (`vercel.json`); if backgrounding is ever wanted, a
`scanStatus` column plus a cron sweep in the existing style costs $0.

**`components/PDFDropzone.tsx` wholesale** — `app/components/MediaUploader.js`
already does this and does it better: photos, video *and* PDF, HEIC/HEIF and
`.mov` accepted, per-kind size caps, one control shared between the
authenticated route and the public self-quote route, real error text. Porting a
second dropzone is failure class #4 (the copy is the one that rots).

Its `DndContext` from `@dnd-kit/core` is also decorative — the actual drop is
handled by native `onDragOver`/`onDrop`; the DnD context wraps it and does
nothing.

### What is genuinely worth taking

Four things, and they are all text rather than code:

1. **The field list.** merchant name / address / contact, transaction date,
   receipt number, payment method, line items with qty + unit + total, subtotal,
   tax, total, currency. It is a well-chosen set and it is the real product of
   the project.
2. **`fileDisplayName`** — *"if the file name is not human readable, use this
   to give a more readable name."* `IMG_4471.HEIC` → "Home Depot, 14 Aug". Cheap,
   and the difference between a usable expense list and a list of camera
   filenames.
3. **`receiptSummary`** — one human sentence per receipt. Maps cleanly onto
   FieldQuo's existing habit in `lib/ai/expenseSummary.js`.
4. **Tool-call parameters *as* the schema**, rather than prompting for JSON and
   parsing the reply. This is the one genuinely better idea in the project —
   see [The zod question](#the-zod-question), where the conclusion is to adopt
   the idea and not the library.

### What parsing would add to FieldQuo — precisely

`model Expense` (`prisma/schema.prisma:4905`) today holds: `category` (free
string), `amount`, `date`, `notes`, `projectId`, `isOverhead`, `recurring`,
`frequency`, `materialId`, `createdById`, `dueDate`, `paidAt`, and the import
provenance trio `importSource` / `importBatchId` / `externalId`.

**There is no image, file, attachment or receipt URL on `Expense` at all.**
So the work is two things, not one:

- **(a) Attach the receipt.** Schema field + upload. `/api/upload` and
  `MediaUploader` already cover the upload half; what is missing is somewhere
  to put the URL and a decision about whether FieldQuo stores the image at all
  (a receipt photo is customer financial data on a CDN — worth a deliberate
  answer, not a default).
- **(b) Prefill from it.** category, amount, date, notes, and a supplier name.

**The second, better target is `JobMaterial`** (`prisma/schema.prisma:3654`).
Its own schema comment already states the requirement:

> `actualCost` is what the receipt said […] Not a per-unit figure: a receipt is
> a total, and asking someone standing at a till to divide it by 17 bags is
> asking for a wrong number.

`actualCost`, `supplier` and `purchasedAt` all exist and are all hand-entered
today. A photographed till receipt filling those three is the closest thing to
a stated requirement anywhere in the schema, and it needs **no new columns**.

**Dedupe already exists and must be reused, not reinvented.** `naturalKey()` in
`lib/expenses/csvImport.js` keys on date + amount + normalised description and
is *deliberately source-blind* — its header explains that this is what stops a
later bank-feed delivery from double-booking rows a contractor already entered.
A scanned receipt and the same transaction arriving later on a CSV would
collide correctly, for free, if the scan writes through the same helper.

**The review step already exists too.** `app/app/settings/expense-tracking/import/`
is a preview-then-commit screen with an idempotency key. A scan should land in
the same "here is what we read, confirm it" shape rather than writing an
Expense straight from a model's output.

### The PDF problem — this would bite on day one

Project B reads PDFs through Anthropic's `document` content block.
`lib/ai/provider.js` speaks OpenAI chat completions, and its `userContent()`
emits only `{ type: "image_url" }`. **An OpenAI chat completion cannot read a
PDF that way.** Separately, `/api/upload` stores a PDF as Cloudinary
`resource_type: "raw"` (see `lib/media/validate.js`), and a raw asset is not
transformable.

Two honest options:

- **Photos only for v1.** Which is what a contractor at a till actually does —
  they photograph the receipt. State it as a limit in the UI rather than
  accepting a PDF and silently failing.
- Or store receipt PDFs as `resource_type: "image"` so Cloudinary's page-render
  transformation (`pg_1`, `f_jpg`) can produce an image URL for the model. That
  is a real change to the upload path and should not be smuggled in.

Photos-only is the recommendation. A dropzone that accepts a PDF and returns
nothing is the dead-control failure.

### What the scan costs, using FieldQuo's own numbers

`lib/ai/imageEconomics.js` already prices exactly this shape of work:
`photoTokens()` / `photoCostDollars()`, `VISION_PASS_CENTS = 25` for up to
`VISION_MAX_PHOTOS = 8` photos at detail `"high"`, and a credit wallet at
`COST_PER_CREDIT_DOLLARS = 0.005`.

A receipt is **fine text**, so it needs `imageDetail: "high"`. The free
always-on `"low"` pass exists precisely because it is too coarse to resolve a
hairline crack, and it will be too coarse for a dollar figure and a date.

Two consequences:

- A receipt scan is a **paid-credit action**, not a free always-on one, and it
  should be priced through the **existing** credit wallet rather than inventing
  a second meter.
- It is **one** photo at high, not eight, so it is materially cheaper than a
  vision pass. Set the per-scan credit price from `photoCostDollars()` on a
  representative receipt photo — do not guess it, and do not copy the 25¢
  vision figure, which is priced for eight.

---

<a name="the-zod-question"></a>

## The zod question

FieldQuo has **no schema-validation library at all**. Structured AI output today
is prompted JSON plus hand-coercion: `stripJsonFence()` in `provider.js`, then
`JSON.parse` in a `try`, then per-field coercion — see `lib/ai/visionPass.js`,
which is the cleanest example of the pattern.

**Should FieldQuo adopt zod? For this feature — no.**

**1. The benefit project B gets from zod is available with zero dependencies.**
What zod does there is describe a *tool-call parameter schema*. OpenAI's
function calling takes plain JSON Schema, and FieldQuo already has a
vendor-neutral convention for it — `COPILOT_TOOL_DEFINITIONS` in
`lib/ai/copilotTools.js` uses `input_schema`, translated to OpenAI's wrapper by
`toOpenAiTools()` in `provider.js`, with a comment saying exactly why. A
hand-written JSON Schema literal gets the same "model fills a validated shape"
result today.

**2. The stronger version of the idea is structured outputs, not zod.**
OpenAI's `response_format: { type: "json_schema", json_schema: { …, strict: true } }`
enforces the shape **at the vendor**, before the bytes are sent — which is
strictly better than parsing the reply and hoping. zod validates *after* the
money is spent; `strict: true` means the malformed reply is never generated.

**3. Adopting zod properly is a repo-wide refactor, not a feature.** Its real
value is validating untrusted input at API boundaries, and FieldQuo has 167
routes doing that by hand. Adding zod for one feature means 167 routes with two
conventions — failure class #4 written across the entire API surface. That is a
product-scale decision and belongs to the owner, separately from receipts.

**Cost of adopting zod**, for completeness: it is free and MIT-licensed;
zod v3 is roughly 57 KB min+gzip if it ever reaches the browser, and nothing if
kept server-side. The cost is not bytes. The cost is convention drift.

### What to adopt instead

**Add a schema mode to `complete()` in `lib/ai/provider.js`.** One file, no new
dependency, and it retires `stripJsonFence` + `try/JSON.parse` + hand-coercion
for **six existing callers**: `quoteReview.js`, `visionPass.js`,
`callQuoteDraft.js`, `callTranscriptDigest.js`, `lib/site/generateSite.js`,
`lib/funnels/generate.js`. That is a bigger win than receipts, and receipts
then arrive as one more caller of a mechanism that already works.

**One thing to fix first.** `complete()` currently catches every vendor error,
logs it, and returns `""`. A schema rejection would be indistinguishable from
"the model had nothing to say" — which is the same shape of bug the file's own
comment warns about for retired model IDs (*"a retired model therefore looks
exactly like a model with nothing to say"*). Distinguish those two before
turning schema mode on, or the first malformed schema will look like a quiet
feature outage.

**Also confirm** that `gpt-5-mini` (and whatever `OPENAI_WRITING_MODEL` is set
to) supports strict structured outputs on this account before relying on it —
`scripts/check-ai-model.mjs` is the right place for that check.

---

<a name="cost-summary"></a>

## Cost summary — every paid vendor named

Cost-increasing changes need the owner's approval before they ship. Prices read
from vendor pages on 2026-09-02 and **will** drift.

| Vendor | Project | Free tier | Paid entry | Recommendation |
|---|---|---|---|---|
| **Liveblocks** | A | 3,000 collaboration-minutes/mo, 200 comments, 1 GB realtime storage, 512 MB files, **10 projects**, 3 dashboard seats — hard caps; the feature *pauses* when a meter is exceeded | **Pro $30/mo** ($25 annual) incl. $30 credits; realtime metered at **$0.002 per collaboration-minute** (a minute with 2+ users in one room). Team $600–$3,750/mo | **No.** See below. |
| **Inngest** | B | 50k executions/mo, 5 concurrent steps | **Pro from $99/mo** (1M executions); +$25 per 25 concurrent steps, $0.50/1M events | **No.** Vercel crons + inline call. |
| **Convex** | B | — | — | **No.** Second database. |
| **Schematic** | B | — | — | **No.** Duplicates `lib/features/*`. |
| **Clerk** | A + B | — | — | **No.** Second auth system. |
| **Firebase** | A | — | — | **No.** Second database. |
| **OpenAI (existing)** | — | n/a | already integrated | Receipt scan priced through the **existing** credit wallet — see above. |

**The Liveblocks pricing detail that settles it.** Its headline meter is
*collaboration minutes* — minutes during which **two or more users are in the
same room**. FieldQuo's authors are single authors, so that meter would read
near zero. You would be paying $30/month for the meter you don't use, in order
to get the editor plumbing you do — against a product that charges CAD$45/month
per company and does not bill AI through. That is a straight margin hit for
zero delivered capability.

And the free tier is not a fallback: **10 projects** is a Liveblocks-account
concept, so a multi-tenant SaaS either blows through it or puts every tenant's
rooms in one shared namespace. Neither is acceptable.

---

<a name="port-plan"></a>

## Port plan, ranked by value-per-effort

### Take the code

Almost nothing, and that is the honest finding.

- **From project A: nothing.** Every file that carries value is either
  Liveblocks lifecycle, a Firestore query, or a Radix component.
- **From project B: the field list and two prompt descriptions** — the zod
  object in `inngest/agents/databaseAgent.ts`, and specifically the wording for
  `fileDisplayName` and `receiptSummary`. Roughly 40 lines of prompt text,
  transcribed by hand into a JSON Schema literal, not imported. That is the
  entire transferable asset of the project.

### Take the idea and rewrite

Ranked by value per unit of effort. Each names its entry point, because
`docs/` already records three features that shipped unreachable.

1. **Structured outputs in `lib/ai/provider.js`.** Highest value, smallest
   diff, no new vendor, benefits six existing callers immediately. Do it first
   and independently of receipts. Entry point: `complete()`, called by files
   that already exist. Fix the error-swallow first.

2. **Receipt scan → Expense prefill.** Photos only for v1. One photo at
   `imageDetail: "high"` through `complete()`; quota-checked with
   `checkAiQuota()` and metered with `recordAiUsage()` like everything else;
   priced on the existing credit wallet from `photoCostDollars()`; deduped
   through `naturalKey()`; landing on a confirm-before-commit screen in the
   shape `app/app/settings/expense-tracking/import/` already uses. Needs a
   decision on whether an `Expense` stores the receipt image at all.
   Entry point: a button on `app/app/settings/expense-tracking/page.js`.

3. **Receipt → `JobMaterial.actualCost` / `supplier` / `purchasedAt`.** Smaller
   than #2 because the columns already exist and the schema comment already
   asks for it. Entry point: the material tick-off control on the job page.

4. **Daily job log.** A real, confirmed gap — `JobVisit.notes` is one nullable
   string, `Job` has no notes field at all, and there is **no per-job document
   or file storage anywhere in the schema**. Build it as a Prisma model + a
   textarea + the existing `JobPhoto` / `MediaUploader`. **Not** a block editor.
   The daily "recap" is the one AI piece, and it should follow the
   `monthlyDigest.js` / `expenseSummary.js` pattern — numbers and facts computed
   in code, model writes the prose. Entry point:
   `app/app/jobs/[id]/JobDetail.js`, next to the visits section.

5. **"Ask this document a question" as a pattern, not a dialog.** FieldQuo
   already has the copilot and non-negotiable #8 already scopes it to the
   company's own data. The honest version is a new tool in
   `lib/ai/copilotTools.js` that reads job logs — not a second chat UI.

6. **"Mine / Shared with me" list grouping** from `Sidebar.tsx`. Ten minutes,
   applies to several lists in `/app`. Cosmetic, listed last for that reason.

### Leave behind

Everything else. Named explicitly so nobody re-litigates it in six months:

- Liveblocks, the Liveblocks Yjs provider, live cursors, presence avatars,
  `LiveCursorProvider.tsx`, `Avatars.tsx`, `ui/following-pointer.tsx`,
  `stringToColor.ts`, room ACLs, `app/auth-endpoint/route.ts`.
- **BlockNote — not now.** If it is ever adopted, it must be with a custom UI on
  `@blocknote/react`'s headless hooks. Never `@blocknote/shadcn` (seven Radix
  hard-deps) and never `@blocknote/mantine` (a second design system).
- Firebase, `firebase-admin`, `react-firebase-hooks`, Clerk, Convex, Schematic,
  Inngest, `@inngest/agent-kit`, `react-markdown`, `sonner`, `vaul`,
  `framer-motion`, every `@radix-ui/*`.
- `PDFDropzone.tsx`, `actions/uploadPDF.ts`, `actions/actions.ts`'s
  `deleteDocument`, `supervisorRoutingAgent.ts`, the Inngest agent network.
- `TranslateDocument.tsx` — and, specifically, machine translation of a stored
  document on any client-facing surface. Non-negotiable #6.
- The two-models-do-the-arithmetic pattern, in any form.

### The one-line answer

**Project A's real contribution is a decision, not code: don't buy multiplayer.**
**Project B's real contribution is a field list and one better habit — let the
model fill a schema instead of writing JSON at it — and that habit belongs in
`provider.js`, where it improves six features that already exist.**

---

<a name="what-i-did-not-verify"></a>

## What I did not verify

Stated plainly so nothing here reads as more settled than it is.

- **Nothing was installed or executed.** Every dependency claim about BlockNote
  comes from project A's own `package-lock.json` at versions 0.14.5/0.14.6
  (mid-2024). Current BlockNote may have different UI packaging and different
  peer/hard-dep splits. **Re-check against the version you would actually
  install** before any adoption decision.
- **No compatibility test** of BlockNote against React 19.2 / Next 16 /
  Tailwind v4 was run.
- **Vendor pricing** was read on 2026-09-02 and drifts — `lib/ai/usage.js`'s own
  header makes this point about OpenAI prices, and it applies to all of the
  above.
- **Cloudinary's PDF page-render transformation** on `resource_type: "image"`
  was reasoned from `lib/media/validate.js` and `lib/cloudinary.js`, not tested
  against the account. Confirm before relying on it — and note the
  recommendation is photos-only precisely so nothing depends on it.
- **No per-scan cost figure is quoted**, deliberately. `photoCostDollars()`
  needs a real receipt photo's dimensions to produce a real number, and a
  guessed price would end up in a pricing conversation.
