# Photo-required tasks, and feeding a job's scope of work to the Marketing Designer's AI

Two connected features, built together because the second only exists once
the first gives it something to read: a task's photos land on the job as
`JobPhoto` rows, tagged and traceable back to the job's own quote, and that's
the exact chain the AI bridge walks in reverse to find out what a photo is
evidence *of*.

---

## Part one — tasks that require photos

### Why `JobTasks.js` was read-only, and what changed

The component's own header explained the original decision: creating a task
needs `task:create`, which field roles don't hold, so no compose form was
rendered — a form that ends in a refusal costs someone their typing, which is
exactly the failure AGENTS.md is swept for. That reasoning still holds; task
creation (with or without a photo requirement) stays on the company-wide
Tasks page (`app/app/tasks/page.js`), which already checks `task:create`
before showing the form.

The **tick**, though, was withheld on a claim that had gone stale. The
original comment said: *"a task's PATCH is scoped to 'yours or claimable', so
a tick here would work for some rows and 403 on others in the same list."*
That would only be true if `GET /api/tasks?jobId=X` could return a row the
viewer isn't allowed to `PATCH`. Reading `app/api/tasks/route.js`'s `GET`
handler shows it can't: for anyone without `task:assign`, the read is scoped
to `assignedToId: me OR createdById: me OR assignedToId: null` — the *exact*
set `PATCH /api/tasks/[id]` already allows via its `mine || claimable` rule.
For anyone *with* `task:assign` (supervisor and up), the read is unscoped
(the whole company's to-dos for that job) and so is the write (`task:create`
implies the same tier). Every row this panel can show is a row the viewer can
already act on — the read/write mismatch the original comment described was
real, but it had already been fixed on the read side by the time this session
started. Per AGENTS.md ("if a comment is wrong, fix the comment too"), the
header now explains this instead of the stale claim, and the tick is real.

### What "requires photos" actually means

- `Task.requiredPhotoCount` (`Int?`) — `null` means no requirement. Set via
  `POST /api/tasks` or `PATCH /api/tasks/[id]`, both funnelled through
  `lib/tasks/completion.js`'s `normaliseRequiredPhotoCount()`, which collapses
  omitted/blank/`0` to the single `null` shape and caps the value at 20.
- `Task.requiresComment` (`Boolean`) — independent of the photo count. A
  manager can ask for either, both, or neither.
- `Task.completionComment` (`String?`) — what the assignee actually wrote,
  captured at completion. Not a thread; one comment, matching what a
  completion requirement is really asking ("what am I looking at").
- `JobPhoto.taskId` (`String?`, `onDelete: SetNull`) — set only by the new
  `POST /api/tasks/[id]/photos`. The photo is a completely ordinary
  `JobPhoto` row otherwise: same table, same stage field, same curator, same
  photo report. It just happens to know which to-do it was filed for.

**A requirement with nowhere for the photo to land is refused at creation,
not silently accepted.** `requiredPhotoCount > 0` with no `jobId` is a 400 on
both `POST /api/tasks` and `PATCH /api/tasks/[id]` — the alternative is a
checkbox that saves, and a to-do nobody can ever complete, which a manager
would only discover the day someone tries.

### The enforcement, server-side

`lib/tasks/completion.js`'s `completionGate()` is a pure function:

```js
completionGate(
  { requiredPhotoCount, requiresComment },
  { photoCount, completionComment },
) // => { ok: boolean, missing: [{ code, message }] }
```

`PATCH /api/tasks/[id]` calls it — with a **live** `db.jobPhoto.count()`, not
a cached flag — only when the request is actually trying to move status to
`"done"`. That single design choice answers three of the coordinator's
"decide each" questions at once:

- **Requirement reduced after partial completion?** The next completion
  attempt checks the current photo count against the *current* requirement.
  2 of a newly-lowered requirement-of-2 passes; no special-case code needed.
- **Task reassigned?** Photos already filed stay filed (`taskId` doesn't
  change on reassignment); the new assignee inherits whatever progress
  exists. No special handling.
- **A required photo deleted?** There is no `DELETE` endpoint for `JobPhoto`
  anywhere in this codebase (checked — grepped for `jobPhoto.delete` across
  `app/` and `lib/`, nothing). If one is added later, the live-count check
  means an open, not-yet-done to-do would honestly report itself short again.
  An **already-done** to-do is never re-evaluated — `completionGate()` only
  runs on the transition into `"done"` — so evidence disappearing after the
  fact does not retroactively flip history. That's deliberate: "done" is a
  record of what was true at the moment someone completed it, and silently
  rewriting it because something was removed later is a worse surprise than
  leaving the record as it was made.

### Who can mark it done

The existing rule, not a new one: `assignedToId === you`, `createdById ===
you`, an unassigned (claimable) to-do, or anyone holding `task:create`
(supervisor/admin/owner). Setting/changing `requiredPhotoCount`,
`requiresComment` or `jobId` itself is held to the stricter `task:create`
bar — an assignee stuck on "2 of 3 photos" cannot simply PATCH the
requirement down to 2 and tick it. `completionComment` is *not* restricted
that way; it's the assignee's own content.

### What the assignee sees on a phone

`JobTasks.js` on the job page: a plain to-do keeps the one-tap tick it always
had. A photo/comment-required one gets an inline panel instead — thumbnails
of what's already filed, a camera-ready upload button (`MediaUploader`,
posting through the same `/api/upload` → `POST /api/tasks/[id]/photos` path
`JobPhotoCurator.js` already established for job-level photos, filtered to
`kind === "photo"` so a PDF plan can't masquerade as a required photo), the
comment box if one's required, and a **Mark done** button that only enables
once the local copy of the requirement reads satisfied — the server
re-checks via `completionGate()` regardless, so the button being enabled is a
convenience, not the actual gate.

### Verified

Real inputs/outputs, executed directly (`lib/tasks/completion.js` is pure):

```
completionGate({requiredPhotoCount:2, requiresComment:false}, {photoCount:0, completionComment:null})
  => {"ok":false,"missing":[{"code":"photos","message":"Needs 2 photos before it can be marked done."}]}

completionGate({requiredPhotoCount:2, requiresComment:false}, {photoCount:1, completionComment:null})
  => {"ok":false,"missing":[{"code":"photos","message":"Needs 1 more photo before it can be marked done (1 of 2 attached)."}]}

completionGate({requiredPhotoCount:2, requiresComment:false}, {photoCount:2, completionComment:null})
  => {"ok":true,"missing":[]}

completionGate({requiredPhotoCount:2, requiresComment:false}, {photoCount:3, completionComment:null})
  => {"ok":true,"missing":[]}   // requirement lowered after 2 were already filed — honest, no special case

completionGate({requiredPhotoCount:2, requiresComment:true}, {photoCount:0, completionComment:null})
  => {"ok":false,"missing":[{"code":"photos", ...}, {"code":"comment", ...}]}   // both codes, not just the first
```

`normaliseRequiredPhotoCount()` against hostile input caught two real bugs
before shipping (see the two "Fix two hostile-input bugs" / "AI bridge"
commits for the full before/after):

1. A negative `photoCount` produced *"Needs 7 more photos"* against a
   requirement of 2 — `have`/`required` are now clamped at 0.
2. `requiredPhotoCount: [3]` and `requiredPhotoCount: true` were silently
   accepted as `3` and `1` respectively (`Number([3]) === 3`,
   `Number(true) === 1` — real JS coercion quirks). The function now rejects
   any input that isn't already a `number` or `string` before calling
   `Number()` on it.

57 assertions live in `scripts/check-task-suggestions.mjs` (run: `npm run
check:task-suggestions`), covering the scenarios above plus `canEditTask()`'s
ownership rule. Mutation-tested by hand: flipped `have < required` to `<=`
(2 previously-passing checks failed, as expected) and `mine || claimable` to
`&&` (3 failed) — both reverted after confirming the check caught them.

---

## Part two — the AI context bridge

### What reaches the model

`lib/marketing/jobPhotoContext.js` resolves the photo URLs currently on a
Marketing Designer canvas back to their `JobPhoto` rows (scoped to the
caller's own `companyId` — a URL is not proof of ownership, a matching row
in this company's table is), then builds:

- **`photos`** — for each usable photo, its **tag** (`stage`, whatever
  string is actually stored there — `start`/`progress`/`finish`/`issue`
  today, or a company-defined custom tag once `docs/PHOTO-TAGS.md` lands; see
  "Custom tags" below), its **caption**, and its **related task**
  (`Task.completionComment` or `Task.title`, if the photo was filed through
  part one's `POST /api/tasks/[id]/photos` — this is where "we painted the
  cabinets, changed the handles" written as a task completion comment
  reaches the AI directly).
- **`scope`** — the job's own quote, via `Job.quoteId → Quote.scopeGroups`:
  each group's **category label** and each line item's **description/detail
  only**. `scopeOfWorkFacts()` never reads `amount`, `unitPrice` or any other
  money field off a line item — verified: a real scope group with
  `amount: 4200` and `unitPrice: 113.5` produces a facts object that contains
  neither figure anywhere in its `JSON.stringify()`.
- **`beforeAfterAvailable`** — a single pre-computed boolean, `true` only
  when the photo set contains both a `start`-tagged and a `finish`-tagged
  photo. This is the direct answer to the coordinator's own example: two
  photos both tagged `finish` and none tagged `start` produce
  `beforeAfterAvailable: false`, and the system prompt is told explicitly not
  to describe a before/after unless this is `true` — the decision isn't left
  to the model reading tag strings itself.

### What is deliberately withheld

- **Prices, ever.** `scopeOfWorkFacts()` extracts `description`/`detail`
  only, at the source — there's no code path that could leak an `amount`
  even by accident, because the field is never read off the line item in the
  first place.
- **The client's name, address or phone.** `Job.title` is never selected or
  sent. I checked `lib/jobs/createJobFromQuote.js` — every job's title is
  auto-generated as `` `${type}${client.name} (${quoteNumber})` ``, which
  means it embeds the client's name in **every single job this product
  creates**. That's a materially different risk from a scope group's
  `label` field (a contractor-typed service name — "Cabinet Refinishing",
  "Subcontracted work" — the same free text `lib/ai/quoteReview.js` already
  sends to a model today), so title is excluded outright rather than trusted
  the same way. `Job.client` is never selected into any query this bridge
  runs.
- **Issue photos, unconditionally.** `buildPhotoContext()` drops an
  `issue`-tagged photo before it can appear in either the images sent to the
  vendor or the text describing the photo set — verified directly: given one
  issue photo and one finish photo from the same job, the issue photo's URL
  is absent from both `images` and `photos`, and shows up only in
  `excludedIssue`. Given a set that's entirely issue photos, `images.length
  === 0` and `generateMarketingCopy()` returns early (`photosUsed: 0`)
  without ever calling the vendor.
- **A second job's photos, when two are mixed on one canvas.** If photos on
  the canvas resolve to more than one `Job`, only the most-represented job's
  photos are kept; the rest are reported as `excludedOtherJob` and dropped
  from both text and images. Verified: 2 photos from job A + 1 from job B →
  job A wins, job B's photo is in neither `images` nor `photos`.

### How the AI is stopped from claiming work that wasn't done

Three layers, not one:

1. **What reaches the model is already filtered** (above) — an issue photo
   or a mismatched job's photo is never available to describe in the first
   place, regardless of what the model would have said about it.
2. **The system prompt in `lib/ai/marketingCopy.js`** is explicit and
   repeated: describe *only* `scope.groups` items; when `scope.hasScope` is
   `false`, don't describe any specific work at all — write generic,
   work-agnostic copy instead of guessing from the photos; only describe a
   before/after when the pre-computed `beforeAfterAvailable` says so; never
   include a client-identifying detail even if one appears in a caption or
   comment it was handed; never invent a price, discount or timeframe.
3. **Nothing downstream trusts the reply as fact.** `parseModelJson()`
   extracts exactly two fields — `caption`, `hashtags` — both free text, both
   sanitised (caption capped at Instagram's 2200 chars, hashtags normalised
   to `#word`, deduplicated case-insensitively, capped at 30) and both
   degrading to empty on any malformed/fenced/wrong-shaped reply rather than
   throwing. There is no field the model fills in that any UI later renders
   as a database-backed claim (a price, a service name, a date) — the same
   "the model writes sentences, the database supplies the facts" split
   `lib/site/generateSite.js` already established for this product, applied
   to captions instead of a website.

A caption grounded in real scope is one thing this **doesn't** try to
guarantee word-for-word: a model told "only describe X" can still describe X
badly, or add unhelpful flourish within the bounds of what's true. What it
cannot do, by construction, is describe work that isn't in `scope.groups`,
describe a before/after that doesn't exist, name a price, or repeat a
client's identifying detail — those are structural, not requested-nicely.

### Custom tags

`lib/gallery/stages.js`'s `stageLabel()` falls back to `"In progress"` for
*any* unknown key — correct for its own callers, wrong for this bridge:
calling it unconditionally would silently mislabel every company-defined
custom tag (`docs/PHOTO-TAGS.md`, being built in a parallel worktree) as "in
progress". `buildPhotoContext()` gates the call with `isStage()` and falls
back to the **raw tag string itself** for anything not in the four known
keys — verified: a photo tagged `"warranty-visit"` reaches the model with
`tagLabel: "warranty-visit"`, not `"In progress"`. If the parallel pass adds
a distinct field (e.g. a `tagId` alongside `stage`) rather than writing
custom tags through `stage` itself, this bridge will need a small follow-up
to read that field — it currently reads whatever string is stored in
`JobPhoto.stage`, which is already a free-text column, not a Postgres enum.

### Where the "job photos" actually come from, and how a caption gets used

Before this session there was no way to place an *existing* `JobPhoto` onto
the canvas at all — `ImageSidebar.js`'s Upload tab posts a fresh file to
Cloudinary, its Stock tab proxies Unsplash, and neither produces a URL that
would ever match a `JobPhoto` row. A new **Job photos** tab (pick a job, see
its photos, tap one to add it) closes that gap, reusing
`GET /api/jobs/[id]/photos` — the same endpoint `JobPhotoCurator.js` already
calls — rather than a second "list this job's photos" implementation.
Issue-tagged photos are filtered out of the picker itself, not merely left
clickable: enforcing the rule at the one place offering the photo in the
first place, in addition to the pipeline dropping it again downstream.

`PublishModal.js` gets a **Generate with AI** button beside the caption
field, reading whatever photos are actually on the live canvas
(`CampaignEditor.js`'s `getCanvasPhotoUrls()`, called at the moment the
button is pressed) and posting them to the new `POST /api/designer/copy`.
The result fills the caption + hashtags, and a status line says plainly
whether the copy is grounded in real scope-of-work data (`grounded: true`)
or is generic because none was found — visible, not just internally logged,
so the person posting under their own brand can see for themselves before
they publish.

### Metering and gating

`POST /api/designer/copy` is a `complete()` call — text plus up to 4 photos
read at the existing free/low-cost "read for what's in them" detail level
every vision read in this product already uses — metered through
`lib/ai/usage.js`'s `checkAiQuota()`/`recordAiUsage()`, the company's normal
monthly AI allowance, the same as `POST /api/quotes/[id]/review`. It does
**not** go through `lib/designer/aiImageAdapter.js`'s per-image spend
wallet — that wallet is specifically for `gpt-image-1` generation/edit calls,
a different cost class; treating a caption request the same way would be
inventing a third price nobody could later explain the reasoning for, which
is exactly what that file's own header warns against.

The route is listed explicitly in `lib/features/registry.js`'s
`marketing_designer.apiPrefixes` — that array is matched by **exact prefix**,
not a `/api/designer` wildcard (confirmed by reading `featureForApiPath()`
and the existing entry's own comment on why `/api/designer/templates` and
`/unsplash` are deliberately *not* gated), so a new route under
`/api/designer/*` is not automatically covered by the feature flag. Without
this addition, the route would have run ungated even while
`marketing_designer` is hidden or locked for a company — the exact
"billable route ungated" failure the existing comment on that array already
names for the two AI-image routes.

### Verified

Real inputs/outputs, executed directly against `buildPhotoContext()`,
`scopeOfWorkFacts()` and `parseModelJson()` (all pure):

```
// Two "finish" tags, none "start" — the coordinator's own scenario
buildPhotoContext(["a","b"], [{url:"a",stage:"finish",jobId:"job1"},{url:"b",stage:"finish",jobId:"job1"}])
  .beforeAfterAvailable => false

// An issue photo passed in deliberately, alongside a legitimate one
buildPhotoContext(["issue.jpg","finish.jpg"], [
  {url:"issue.jpg", stage:"issue",  caption:"water damage behind cabinet", jobId:"job1"},
  {url:"finish.jpg", stage:"finish", caption:null, jobId:"job1"},
])
  => images: ["finish.jpg"]              // issue photo never reaches the vendor
     photos: [{ url:"finish.jpg", ... }] // and never reaches the text either
     excludedIssue: ["issue.jpg"]        // reported, not silently dropped

// Two different jobs' photos on one canvas
buildPhotoContext(["a","b","c"], [
  {url:"a", stage:"start",  jobId:"job1"},
  {url:"b", stage:"finish", jobId:"job1"},
  {url:"c", stage:"finish", jobId:"job2"},
])
  => jobId: "job1"                 // 2 photos beats 1
     excludedOtherJob: ["c"]       // job2's photo excluded from both images and text

// A scope with no line items, and a job with no quote behind it
scopeOfWorkFacts([{ label:"Cabinet Refinishing", lineItems:[], category:{name:"Cabinets"} }])
  => { hasScope:false, groups:[] }
scopeOfWorkFacts(null)   // what loadJobPhotoContext() hands through for a job with quoteId: null
  => { hasScope:false, groups:[] }
```

35 assertions live in `scripts/check-designer.mjs` section 15 (run: `npm run
check:designer`), covering the scenarios above plus hostile JSON/hashtag
input to `parseModelJson()` (a `__proto__` key doesn't pollute
`Object.prototype`, 500 hashtags cap at 30, a duplicated hashtag in different
case dedupes, a non-JSON reply degrades to empty rather than throwing).
Mutation-tested by hand: flipped `beforeAfterAvailable`'s `&&` to `||` (the
coordinator's own scenario check failed, as expected) and typo'd the
`"issue"` stage string being matched (4 checks failed) — both reverted after
confirming the failures.

---

## What I did not build

- **A chat-style "ask for an asset" flow.** The coordinator's example ("if
  the person asks for an asset to be generated using two pictures...")
  describes a conversational request. What's built is the concrete mechanism
  behind that request — pick job photos, press Generate, get a grounded
  caption — not a natural-language front end that parses "use the before and
  after shots from the kitchen job" into a photo selection. The photo
  selection is a deliberate, visible action (the Job photos tab, then
  whichever thumbnails end up on the canvas), not inferred from a sentence.
- **An "image ad" as a distinct structured output.** The system prompt
  produces one grounded caption + hashtags — read as an owner's "image ad"
  text for a Facebook/Instagram image post, the actual audience this feature
  serves via `PublishModal`. I considered also generating a separate ad
  headline/body pair to insert as text LAYERS on the canvas
  (`editor.addText()` already exists), but cut it: it's a second, differently
  -wired surface with no consumer beyond itself, and AGENTS.md is explicit
  that an unfinished half-feature shouldn't render. The caption is the one
  thing this ships that's fully wired end to end.
- **A JobPhoto delete endpoint.** None exists anywhere in this codebase
  today (verified by grep), and none was added — not needed for either
  feature, and adding one would have been unrelated scope. The "required
  photo deleted" scenario is handled by construction (live-count check) for
  when one is eventually added, not by a delete route built here.
- **Retrofitting `app/components/designer/*` to `t()`.** `ImageSidebar.js`,
  `AiSidebar.js` and the other designer sidebars predate this session with
  hardcoded English strings throughout — an established (if inconsistent
  with the rest of `/app`) convention in that specific ported-editor tree.
  `PublishModal.js` was already held to the `t()` standard before this
  session touched it, so the new caption-generator strings there follow suit
  (EN+FR, matching that file's own existing convention — unlike
  `app.tasks.*`/`app.job.*`, which are EN+FR+ES+UK+PA+TL). The new **Job
  photos** tab I added to `ImageSidebar.js` uses `t()` for its own strings
  without retrofitting the rest of that file — matching the non-negotiable
  for new work without expanding into an unrelated, unbounded cleanup of
  legacy code nobody asked to touch.
- **A `docs/PHOTO-TAGS.md`-aware tag picker.** That file didn't exist yet by
  the time this session ran (checked at the start and again before writing
  this doc). The bridge reads whatever string is stored in `JobPhoto.stage`
  generically — a free-text column already, not a Postgres enum — so a
  custom tag written through that same field flows through today with no
  further change. If the parallel pass instead adds a *separate* field for
  custom tags, `lib/marketing/jobPhotoContext.js` will need a small,
  contained follow-up to read it too.

## Fields a parallel worktree may also touch

Three agents were reported working on `JobPhoto` concurrently (tags,
annotation, comments) at the start of this session. This work adds exactly
one field to that model — `JobPhoto.taskId` (nullable, `SetNull`) — and reads
the existing `stage`/`caption` fields without assuming their final shape
beyond "a string". If the tags pass adds a distinct tag column, or the
comments pass adds a genuine JobPhoto-level comment thread separate from
`Task.completionComment`, `loadJobPhotoContext()`'s `select` clause is the
one place to extend to pick them up.
