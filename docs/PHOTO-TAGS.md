# Company-defined job-photo tags

The ask: let a company put its own words on a job photo — "sanding",
"priming", "top coat", "demo" — the way CompanyCam does, without those words
being able to touch the two things `JobPhoto.stage` already does that are not
negotiable: driving the before/after slider, and keeping an "issue" photo off
the public website.

## The model decision

**The four built-in stages stay a separate, protected axis. Custom tags are
layered on top, in a new table.**

`JobPhoto.stage` (`start | progress | finish | issue`) is untouched — same
column, same four values, same default. Two new, additive models sit next to
it:

```
JobPhotoTag         — a company's own label: id, companyId, name, color,
                       sortOrder, active (retire flag), createdAt
JobPhotoTagOnPhoto   — the join: which tags are on which photo
```

`JobPhoto` gained one new relation field, `tags JobPhotoTagOnPhoto[]`. No
existing column changed type, gained a constraint, or lost one. No migration
touches an existing row — this is why `prisma db push` was **not** run this
session; `npx prisma validate` confirmed the schema is well-formed, and the
change is additive enough that push is safe whenever it's next run.

### Why not widen `stage` into a free-form vocabulary instead

That was the other real option, and it was rejected because `stage` is read
by code that must not bend to what a contractor types:

- `beforeAfterPairs()` (`lib/gallery/albums.js`) pairs a job's earliest
  `start` with its latest `finish` — the single most persuasive thing a
  finish trade can put on a website.
- The privacy boundary is enforced **twice**, independently: the API refuses
  `featured: true` on a `stage === "issue"` photo
  (`app/api/jobs/[id]/photos/route.js`), and `featuredUrls()`
  (`lib/site/jobPhotos.js`) filters `stage: { not: "issue" }` again at read
  time, so a photo of hidden water damage can't reach the public gallery
  through either path.

If a company's own vocabulary lived in that same column, one of two things
would eventually go wrong: a company creates a custom value that reads like
"before" or "issue" to a human but isn't the literal string the pairing/
privacy code checks for equality, and behaves like a plain "progress" photo
by accident — or a validation layer tries to *forbid* certain custom words
("issue" is reserved!) and now the four protected values and the company's
open vocabulary are tangled in one column with one set of rules, and the next
person to touch either has to relearn which rules are about the label and
which are about the plumbing.

Keeping tags in their own table closes that off structurally, not by
convention: **a custom tag can never occupy the `stage` column**, because it
isn't stored there. `lib/gallery/albums.js`, `lib/site/jobPhotos.js`, and the
"can't feature an issue shot" guard in the API route never read
`JobPhotoTag` or `JobPhotoTagOnPhoto` at all — not "don't currently", but
structurally can't, short of someone adding a new query to a function that
has none today. That absence is the actual safety argument, and
`scripts/check-gallery.mjs` pins it with source-scan assertions so a future
edit that starts reading tags in either place fails the check.

## The sharpest case, proven

A contractor **can** name a custom tag "Issue" — nothing rejects the word.
`lib/gallery/tags.js`'s `isValidTagName`/`normaliseTagName` treat it exactly
like "Sanding": no reserved-word list exists. Two things are then true at
once, and both are tested in `scripts/check-gallery.mjs`:

- A photo with `stage: "issue"` and a tag named `"Issue"` is **still excluded**
  from `galleryStrip`/`albums`/`hasGallery` — the tag changes nothing, `stage`
  alone decided it.
- A photo with `stage: "finish"` and a tag named `"issue"` **is still public**
  — the tag's name is just a string on a chip; nothing compares it against
  the word "issue" to decide anything.

The privacy boundary is entirely a property of `stage`. A tag is decoration
next to it, in either direction.

## Retiring, not deleting

`JobPhotoTag.active` is the retire flag — the same pattern
`Worker.active`/`lib/team/workerArchive.js` uses for a person who leaves a
crew. `PATCH /api/settings/job-photo-tags/[id]` can flip it (and flip it back
— "Bring back" on the settings screen), but there is **no `DELETE` route**.

What retiring actually does:

- Drops the tag from the **picker** offered on new photos — both the GET
  `/api/jobs/[id]/photos` `tags` list (which is filtered to `active: true`)
  and the `PATCH` handler's `toAdd` computation, which refuses to newly
  attach a retired tag (`app/api/jobs/[id]/photos/route.js`).
- Does **not** touch a single `JobPhotoTagOnPhoto` row. A photo that already
  carries the tag keeps it, forever, until someone explicitly removes it —
  removal is decided only by "this tag id is missing from the request",
  never by the tag's `active` flag. That asymmetry is deliberate and is its
  own assertion in `scripts/check-gallery.mjs`: if retiring a tag is ever
  made to also delete its `JobPhotoTagOnPhoto` rows, or the removal branch
  is ever made to key off `active`, the check fails.
- Does not touch the tag's own `name`/`color`/`sortOrder`. Reactivating just
  flips the flag back; nothing is ever recreated, because nothing was ever
  destroyed.

The settings screen (`app/app/settings/job-photo-tags/page.js`) shows retired
tags in a dimmed section below the active list, so a company can see what it
retired and bring one back, rather than the tag simply vanishing from view.

## The starter set

`lib/gallery/tags.js` exports `STARTER_TAGS` — eight generic process words
(Demo, Prep, Sanding, Priming, Installing, Top coat, Punch list, Touch-up).
Deliberately **not** "before"/"after"/"issue" — those are `stage`'s job, and a
starter tag that echoed a protected stage name would blur the line this whole
design exists to keep sharp.

The settings screen's "Add starter tags" button follows the same rule
`prisma/seed-checklists.js` states for the per-trade checklist library —
*"nothing is added unless you tick it"* — via `missingStarterTags()`, which
is idempotent: it only offers what the company doesn't already have (matched
case-insensitively), so clicking it twice, or clicking it after renaming a
starter tag, never creates a duplicate.

**One deliberate deviation from the checklist library's exact mechanism**,
worth naming: checklists' shared library is a set of `companyId: null` rows,
seeded by `prisma/seed-checklists.js` and exposed to every tenant via
`GET ?includeSystem=1`. `STARTER_TAGS` here is a plain JS constant in
`lib/gallery/tags.js` instead, adopted by copying it straight into the
company's own rows. Three reasons, together:

1. This session cannot run `prisma db push` (see AGENTS.md — schema changes
   are validated, not pushed, in this workflow) or edit `package.json` to add
   a `seed:job-photo-tags` script, so a seeded system-library table would ship
   with no way to actually populate it.
2. Eight short words don't carry the weight a ~250-row, per-trade checklist
   library does — there's no real "browse and search the shared library"
   need here, just "give me something to start from."
3. The *principle* — offer, never auto-apply, copy explicitly — is what the
   ask actually named ("Nothing is added unless you tick it"), and that
   principle is preserved exactly: `POST /api/settings/job-photo-tags` with
   `{ action: "adoptStarter" }` is the one and only way a starter tag becomes
   a real row, and it never runs on its own.

If a future session wants the full shared-library mechanism (a real
`companyId: null` system table, a seed script, browsable/searchable), that's
a small follow-up on top of this — the model already has `companyId String`,
not `String?`, so widening it to nullable is the one schema change that
would be needed.

## Applying tags

- **`JobPhotoCurator`** (`app/components/jobs/JobPhotoCurator.js`): each
  photo card gained a row of tag chips below the stage dropdown. Tapping one
  toggles it via `PATCH /api/jobs/[id]/photos` with `{ photoId, tagIds }`. The
  chip list is the union of the company's active tags and whatever tags the
  photo already has — so a retired tag that's still on a photo shows up
  (italicised, with a "(retired)" tooltip) and can be knowingly removed,
  rather than silently disappearing off a photo the moment it's retired. A
  "Manage tags" link points at the settings screen.
- **The job's photo record, `JobPhotoTimeline`**
  (`app/components/jobs/JobPhotoTimeline.js`): a "Filter by tag" dropdown,
  built from tags actually worn by a photo *on this job* (not the company's
  full active list), so a retired tag stays filterable here too. Filtering
  narrows within the same unfiltered office record — issue photos stay
  visible when filtered, exactly as before tags existed.
- **Crew SMS intake, `lib/crew/inbox.js`**: a photo texted in still gets
  `stage` inferred from the message (`inferStage()`, unchanged) but lands
  with **no tags**. It shows up in `JobPhotoCurator` like any other photo, so
  it can be tagged by hand there — "wherever a photo is filed" is satisfied
  by tagging being available everywhere a photo is *listed*, not by adding
  tag-guessing to the SMS path.

### Why custom tags do NOT participate in `inferStage()`'s text inference

`inferStage()`'s word list is four fixed, product-critical outcomes, tuned
and tested against real crew phrasing
(`scripts/check-gallery.mjs`'s `inferStage` section). A company's tag
vocabulary is unbounded and company-specific — there is no equivalent list to
tune, and no way to know today whether "second coat on" should map to
"Top coat" or nothing at all. The failure modes aren't even comparable: a
wrong **stage** guess mis-files a before/after pair or, worse, could someday
mis-classify a privacy-sensitive photo; a wrong **tag** guess is just a wrong
label sitting quietly on a photo that nobody asked to have it, with no signal
that it was ever guessed rather than chosen. Tags stay an explicit, human
action everywhere a photo can be tagged, in this version.

## Filtering by tag

Implemented on `JobPhotoTimeline` (see above) — the office's own dated
record, the view most useful to narrow down for a specific kind of photo
("show me every sanding shot on this job"). `JobPhotoCurator` doesn't get a
filter of its own; it's a curation surface for a job's photo count in the
low tens, not a search surface, and duplicating the same control on both
panels seemed the more decorative choice.

## What this did not build

- **No tags on the public website gallery or the photo-report PDF.** The ask
  was about job-side organisation; the website gallery and PDF weren't
  asked to display tags, and `lib/site/jobPhotos.js` was deliberately left
  otherwise untouched (see the mutation-tested source-scan assertions in
  `scripts/check-gallery.mjs`).
- **No colour-contrast checking on tag chips.** Tag colours are decorative
  (a coloured pill with white text), not a client-facing document surface
  `lib/documents/theme.js` governs — but the eight starter colours were
  chosen dark enough for white text to read at a glance. A company-picked
  custom colour is one of eight fixed swatches on the settings screen (no
  free colour picker), which keeps this from becoming a real contrast
  surface without adding one.
- **No activity-log entries** for tag create/rename/retire, unlike
  `testimonial` mutations. Straightforward to add later; left out to keep
  this diff to tagging.
- **No `companyId: null` shared tag library / seed script** — see "The
  starter set" above for the reasoning and what a follow-up would need.
- **A field named `active` on `JobPhotoTag`, and a field named `tags` on
  `JobPhoto`** — flagged in case a parallel photo-annotation or
  photo-comments effort also wants either name on the same models; nothing
  here conflicts with `JobPhoto.caption`, `JobPhoto.featured`, or
  `JobPhoto.stage`, which this work left untouched.

## Verification

- `npx prisma validate` — schema is well-formed. `prisma db push` was **not**
  run (per instructions); every change is additive/nullable and safe to push
  whenever the environment is available.
- `scripts/check-gallery.mjs` — extended with pure-function tests for
  `lib/gallery/tags.js` (empty name, 500-char name, duplicate names
  case-insensitively, a tag literally named "issue") and integration-style
  proofs that `beforeAfterPairs`/`albums`/`galleryStrip`/`hasGallery`/
  `stageTimeline` behave identically with tags present — including a
  featured custom-tagged photo, an issue-stage photo carrying an "Issue"
  tag (stays private), a finish-stage photo carrying an "issue"-named tag
  (stays public), and a photo whose only tag was later retired (still shows
  up everywhere the office needs to see it). Two source-scan checks pin
  `featuredUrls()` and the `tagIds` sync against ever reading a tag to
  decide `stage`-driven behaviour. Every new assertion was mutation-tested
  by hand — see the commit that added them for exactly which guards were
  broken, confirmed-failing, and restored.
- `scripts/check-job-photos.mjs` — unaffected, still green; the tag work
  didn't touch anything it pins.
- `node scripts/check-translations.mjs` — all gated languages (English
  definitions, French completeness for the app catalogue) complete for every
  new `app.setJobPhotoTags.*` / `app.jobPhotoTags.*` / `app.settings.
  jobPhotoTags` key.
