# Merging company-defined job-photo tags into main, after the fact

`worktree-agent-a0b22dc8949b8b8cf` built company-defined job-photo tags and
was reported as landed. It was never merged. In the time it sat unmerged, two
other agents shipped photo annotation and photo comments/mentions on the
exact same files. This document is the record of reconciling the six-commit-
stale branch into that rewritten component: `git merge
worktree-agent-a0b22dc8949b8b8cf`, twelve conflicts across five files,
resolved by hand rather than a blind union.

## Why not a union resolver

A generic union resolve was tried on this exact pair of features once already
tonight (see `745aacd`'s own commit message, and the annotation+comments
merge it describes) and it duplicated a `readFileSync` import and a
`PATCH_AT` declaration in `check-job-photos.mjs` — `check:all` failed on main
with a `SyntaxError` until that was fixed by hand. The same failure mode was
waiting in this merge: `scripts/check-gallery.mjs`'s two conflicting halves
each declared `const stripComments` and re-read `lib/site/jobPhotos.js` into
their own local variable. A union would have kept both declarations and
thrown `SyntaxError: Identifier 'stripComments' has already been declared`
the first time the script ran. Caught before it shipped, not after.

## The five files, conflict by conflict

### `prisma/schema.prisma` (1 conflict)

Exactly the clean union it was expected to be: `JobPhoto` gained both a
`comments` relation (main) and a `tags` relation (the branch) as sibling
fields. `JobPhotoTag` and `JobPhotoTagOnPhoto` themselves auto-merged with no
conflict — they don't exist on main at all, so git placed them without
needing a decision. `npx prisma validate` passes. `prisma db push` was **not**
run, per instruction — the owner pushes after review.

### `scripts/check-gallery.mjs` (2 conflicts)

**Import conflict:** a plain union of the two import blocks (main's
`displayPhotoUrl` + the branch's `lib/gallery/tags` exports, both alongside
the shared `stages`/`albums` imports) — these are genuinely independent, and
`stageTimeline` was already exported from `lib/gallery/albums.js` on main
(added by an unrelated earlier pass), so no new export was needed to satisfy
the branch's import.

**The 180-line body conflict:** NOT a union. Both halves declared
`const stripComments = (s) => ...` and independently read
`lib/site/jobPhotos.js` into a local source string to regex-check it — same
purpose, different variable names (`JOB_PHOTOS_SRC` vs `jobPhotosSrc`),
which would have been a duplicate `const stripComments` SyntaxError if kept
both. Resolved by keeping main's `stripComments`/`JOB_PHOTOS_SRC` declaration
as the only one, folding the branch's one genuinely new assertion on that
same source ("`featuredUrls()` does not reference a tag table or field")
into the existing `featuredUrlsBody` check, and dropping the branch's
duplicate re-read and re-declaration entirely. Everything else in the
branch's half — the tag-vocabulary hostile-input tests, the privacy-boundary-
survives-tags tests, and the new source-scan of the API route's `tagIds`
sync block — is genuinely independent test content and was kept as a
straight append, reusing the one `stripComments`/`readFileSync` already in
scope. Result: 94/94 assertions pass (`npm run check:gallery`).

### `app/api/jobs/[id]/photos/route.js` (5 conflicts)

Rewritten by hand rather than patched conflict-by-conflict, because the two
sides don't just add independent code — they both touch `PHOTO_SELECT`,
`GET`'s response shape, and `PATCH`'s `data` object.

- **`PHOTO_SELECT` / `flattenTags`:** the branch's `PHOTO_SELECT` constant and
  `flattenTags()` helper (added so `GET`/`POST`/`PATCH` can never disagree
  about a photo's shape) is the base; main's annotation fields
  (`annotationJson`, `annotationWidth`, `annotationHeight`, `flattenedUrl`,
  `annotationUpdatedAt`) were added into that same constant rather than kept
  as a second, competing select object.
- **`GET`:** kept the branch's shape (`PHOTO_SELECT` + `flattenTags` + the
  company's active-tag list returned as `tags`), now also carrying the
  annotation fields through the same select.
- **`POST`:** kept main's fix — `jobs:view_only` with `assignedJobWhere(full)`
  scoping — over the branch's stale `view_create_edit`, since main's version
  is the one that closed the actual crew-upload gap
  (`745aacd`'s own note references the earlier `36d5b3c`, "Crew could not
  upload a photo, and a check was enforcing that they could not"). The
  branch predates that fix and never saw it. `scripts/check-job-photos.mjs`
  still asserts `assignedJobWhere(full)` runs before `createMany` and that
  `view_only` (not `view_create_edit`) gates POST — both still pass.
- **`PATCH`:** the scalar `data` object (featured/stage/caption) is shared
  ground. Annotation's save/clear block (main) and the `tagIds` diff-sync
  block (the branch) are two independent axes into the same `data`/response
  cycle — merged as: build `data`, compute `wantsTagChange`, run the
  annotation block (which can also add to `data`), check "nothing to
  change" against `data` **or** `wantsTagChange` (the branch's guard,
  widened), the existing `issue`-stage refusal, write `data` if non-empty,
  run the Cloudinary cleanup for a superseded flattened asset, run the tag
  sync, then a single final `PHOTO_SELECT` fetch for the response. The tag
  sync block was deliberately placed immediately before that final fetch
  (matching where the branch originally had it) because `check-gallery.mjs`'s
  new source-scan locates the block by searching for the literal string
  `"if (wantsTagChange)"` followed by `"\n  }\n\n  const updated"` — moving it
  would have silently broken that assertion's `indexOf` search rather than
  failing loudly, which is worse.

### `app/components/jobs/JobPhotoCurator.js` (4 conflicts)

Also rewritten whole rather than patched. The header comment, imports,
`canCurate` gate, and the `PhotoCard` prop list all needed a genuine union of
both features' additions (`MessageCircle`/`PenLine` for comments/annotation,
`Settings2`/`Link` for the tags-settings link), plus one real design
decision — see below.

### `docs/ROADMAP.md` (1 conflict)

Appended both entries, in commit order (payment schedule + social scheduling
first, since that's what's already on main; the job-photo-tags entry after).
The tags entry itself was updated in place: its old "flagged for whichever
parallel effort needs it" paragraph about the `active`/`tags` field names was
written before annotation or comments existed to actually collide with —
replaced with a short note that they didn't collide, plus the `canCurate`
decision below.

## The decision: does applying a tag require `canCurate`?

**Yes.** Gated identically to annotation and featuring.

The reasoning: `PATCH /api/jobs/[id]/photos` requires `jobs:view_create_edit`
as a single level check that gates the entire handler — every write it can
make, including a tag-only request (`{ photoId, tagIds }` with no scalar
field). Nothing in the route admits `view_only` for the `tagIds` path
specifically; `wantsTagChange` only affects whether the "nothing to change"
guard fires, not what level is required to get past `levelOrRefusal` in the
first place. So a crew member (`jobs:view_only`) already gets a 403 from the
server on any tag change, regardless of what the UI does.

That makes an ungated tag-toggle button the exact dead-control failure
AGENTS.md names and this panel has already shipped twice: the crew-upload
button that always 403'd before `36d5b3c`, and annotation's markup/remove
controls before the earlier merge gated them on `canCurate`
(`745aacd`). `JobPhotoCurator.js`'s tag picker is now behind the same
`canCurate` check as the star and the markup pen.

One difference from how annotation handled this: a non-curator doesn't just
lose the control outright. The stage `<select>` already had a precedent for
this — it falls back to a plain read-only `<p>` of the current stage rather
than disappearing. Tags now do the same: a non-curator sees whatever tags are
already on the photo as plain, non-interactive chips (reading `photo.tags`
directly, not the full company vocabulary `pickable` builds for the
toggle UI), and sees nothing at all if the photo has none. This shows real
information without offering a control that would fail.

## Verified

- `npx prisma validate` — passes.
- `npm run check:gallery` — 94/94 assertions pass, including the merged
  source-scan blocks described above.
- `npm run check:job-photos` — passes in full, including the `POST` gate
  assertions (`view_only`, `assignedJobWhere(full)` before `createMany`,
  `view_create_edit` unchanged on `PATCH`) and the annotation/comments
  suites (markup save/clear, mention resolution, notification fallback).
- `npm run check:designer` — passes, including its own assertion that a
  custom company-defined tag flows through the AI social-post photo context
  as itself, not relabelled.
- `npm run check:translations` — passes (gated languages at 100%).
- `npm run check:all` — exits 0, full chain, no failures.
- `npm run build` — exits 0. `/api/settings/job-photo-tags`,
  `/api/settings/job-photo-tags/[id]` and `/app/settings/job-photo-tags` all
  appear in the route output.
- `lib/site/jobPhotos.js`'s `stage: { not: "issue" }` filter — read directly,
  untouched by this merge, and independently pinned by
  `check-gallery.mjs`'s source-scan.
- `grep -rn "^<<<<<<<\|^=======\|^>>>>>>>" app lib scripts prisma docs` —
  empty, confirmed before commit.

## Not verified

Nothing from the original branch's own "unverified" list
(`docs/PHOTO-TAGS.md`) got newly verified by this merge — it was a
reconciliation pass, not further feature work. Specifically still unverified
by an actual click-through, same as before the merge: the Settings screen's
create/rename/reorder/retire flow and the "Add starter tags" button, both
only exercised through source-level checks, never a live browser session
against a real database (this session did not run `prisma db push` and was
told not to). The read-only tag-chip fallback for non-curators, added fresh
in this merge, is likewise unverified visually — it type-checks and builds,
but nobody has looked at it rendered.
