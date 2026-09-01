# Photo annotation — Apple Markup, on a job photo

Written 1 September 2026, answering the owner's request: *"The image
should also be editable — kinda like Apple. They can highlight, draw, add
text and shapes (arrow to point at something), highlight something in
different colors, etc. Pen, marker, pencil — identical to Apple, and Canva
in the way for shapes and items."*

A contractor can now open any job photo, mark it up with a pencil, pen,
marker, or highlighter in any of eight colours, add text, an arrow, a
rectangle, or an ellipse, and save it — all client-side, all undo/redo-able,
all non-destructive.

---

## Reuse vs. separate — and why

**Decision: a separate, small Fabric surface. Not a reuse of
`app/components/designer/Editor.js`.**

`Editor.js` is the marketing designer's canvas — 14 tool sidebars (shapes,
fill, stroke colour, stroke width, opacity, text, font, images, templates,
filters, AI generation, background removal, freehand draw, settings), a
ratio-switching system (`changeRatio`/`reflow`) built around the idea that
the "workspace" is an artboard whose aspect ratio a person picks and
changes, AI image generation billed against a spend gate, and a left-rail
desktop chrome with a 360px slide-out panel per tool.

None of that describes a job photo. A job photo has exactly **one** aspect
ratio, forever — its own. There is no ratio to switch, no template to pick,
no reason to spend real money generating a background, and no reason for
"remove background" to exist on a photo of a client's actual kitchen. The
UX brief itself asks for something else entirely: Apple Markup's shape —
draw, done — not a design tool's shape of pick-a-tool-open-a-360px-panel.

Bending `Editor.js` to fit would have meant:

- Hiding ten of its fourteen sidebars (fill colour, opacity, font, images,
  templates, filters, AI, remove-bg, settings, and the ratio tab bar its
  *parent* component owns).
- Rewriting its rail-plus-panel chrome into Apple Markup's top-toolbar +
  bottom-toolbar shape, which is a different layout, not a CSS tweak.
- Disabling `changeRatio`/`getRatioWarning`, which read the canvas's own
  `"clip"` workspace rect — a concept a photo annotator doesn't have.
- Carrying AI image generation's spend-gate plumbing (`checkAiQuota` /
  `recordAiUsage`) into a feature that never spends AI credit.

That's more subtraction than the shared surface (the `fabric` dependency
itself, the `ssr:false` pattern, `lib/brand/colour.js`'s contrast maths) was
worth. So the annotator is its own tree:

```
lib/jobs/photoAnnotation.js        displayPhotoUrl(), sanitiseAnnotationJson() — pure, no fabric
lib/photoAnnotator/
  constants.js                     tools, brush presets, colours — pure, no fabric
  arrowGeometry.js                 buildArrowPath() — pure SVG path math, no fabric
  contrast.js                      haloColorFor() — pure, reuses lib/brand/colour.js
app/components/photoAnnotator/
  PhotoAnnotatorLoader.js          the ssr:false boundary — mirrors DesignerLoader.js's PATTERN,
                                    routes through NOTHING under app/components/designer/
  PhotoAnnotatorEditor.js          the canvas — imports "fabric" directly
  hooks/
    useAnnotatorHistory.js         undo/redo for the annotation layer only
    useFitZoom.js                  keeps the photo fitted to its container (reuses
                                    fabric.util.findScaleToFit, the same utility
                                    the designer's useAutoResize.js calls)
    useAnnotatorHotkeys.js         desktop keyboard shortcuts (secondary — see Touch below)
```

Nine tools instead of fourteen sidebars: select, pencil, pen, marker,
highlighter, text, arrow, rectangle, ellipse. No layers panel (every
annotation is a single flat list — `canvas.getObjects()` — with no
reordering UI, matching Markup, not Canva's layer stack). No templates. No
ratio picker.

What **is** reused, deliberately, rather than re-derived:

- **The `fabric` dependency** (`5.3.0-browser`, already pinned for the
  designer) — no new package.
- **The `ssr:false` chain pattern** — a loader component wraps a
  `next/dynamic(..., { ssr: false })` import of the real editor, because
  Fabric touches `window`/`document` at import time and a server-rendered
  page crashes trying to evaluate it (`Can't resolve 'jsdom'` at real
  `next build` time — this repo deliberately doesn't install jsdom). The
  annotator's chain (`JobPhotoCurator.js` → `PhotoAnnotatorLoader.js` →
  `PhotoAnnotatorEditor.js`) is **independent** of the designer's
  (`page.js` → `CampaignEditorLoader.js` → `CampaignEditor.js` →
  `DesignerLoader.js`) on purpose — `scripts/check-designer-reach.mjs`
  section 8 asserts the annotator's loader never routes through anything
  under `app/components/designer/`, so this feature's reachability doesn't
  depend on the designer's files staying in place.
- **`lib/brand/colour.js`'s `readableForeground()`** — the halo-colour logic
  below is a direct reuse, not a second contrast implementation.
- **`fabric.util.findScaleToFit`** — the same generic Fabric utility the
  designer's `useAutoResize.js` uses to fit a workspace into its container.

---

## The original is never touched

`JobPhoto.url` — the column every existing surface (the public gallery, the
crew-SMS intake, the curator, the timeline) already reads — is **never
written to** by anything in this feature. Four new, nullable columns carry
the markup instead:

```prisma
annotationJson      String?    // Fabric's canvas.getObjects(), serialised — NEVER the photo
annotationWidth     Int?       // the canvas pixel size the coordinates are relative to
annotationHeight    Int?
annotationUpdatedAt DateTime?
flattenedUrl        String?    // a SECOND Cloudinary asset — photo + markup, baked in
flattenedPublicId   String?    // for deleting a superseded flattened asset
```

`annotationJson` is deliberately **objects-only** — the photo is set on the
canvas via `canvas.setBackgroundImage()`, never `canvas.add()`, which keeps
it permanently outside `canvas.getObjects()`. That's not a serialisation
trick layered on afterward; it's a structural guarantee: the background
can't be selected, dragged, resized, or deleted by a stray tap, and
undo/redo (`useAnnotatorHistory.js`) and the saved JSON can't accidentally
include it even if someone tried.

Removing markup (the "Marked up · Remove" quick action on the photo card,
or clearing every object inside the editor and hitting Done) sets all five
annotation columns back to `null` and deletes the flattened Cloudinary
asset — `url` is completely unaffected either way. The original photo a
crew member took is the one thing this feature is structurally incapable of
losing.

---

## Where the flattened image comes from

**Rendered client-side, once, at save time — uploaded as a second Cloudinary
asset. Not rendered on demand.**

This wasn't a style preference; it's close to the only option available.
Fabric cannot run server-side in this repo: `fabric@5.3.0-browser` touches
`window`/`document` at import time, and this codebase deliberately doesn't
install `jsdom` (see the Next.js banner at the top of `AGENTS.md`, and
`DesignerLoader.js`'s own header, which documents the exact `next build`
failure). There is no route this repo could add — today — that imports
Fabric and rasterises a canvas on the server. So a PDF report or an email
can't ask for "the flattened version of photo X" and get one generated on
the fly; whatever gets shown has to already exist as a plain image URL.

So: the moment someone taps **Done** in the editor,
`PhotoAnnotatorEditor.js#handleSave` does what the designer's own
`savePng()` does (`useEditor.js`) — resets the viewport transform to
identity and calls `canvas.toDataURL({ left: 0, top: 0, width, height })`,
which rasterises the background image **and** every annotation object
together at the canvas's native resolution. That PNG is converted to a
`Blob` and uploaded through the existing `/api/upload` route (the same
signed, authenticated endpoint every other photo in this product already
goes through — no new upload path, no new signing rule to keep in sync).
The response's `url` becomes `flattenedUrl`; its `publicId` becomes
`flattenedPublicId`.

`lib/jobs/photoAnnotation.js#displayPhotoUrl(photo)` — `flattenedUrl ||
url` — is the one function every reader calls to decide what to show:

| Surface | Reads through `displayPhotoUrl`? | What it shows |
|---|---|---|
| `JobPhotoCurator.js` thumbnail | Yes | Flattened preview if annotated, original otherwise — staff see what a client/report would see |
| Public gallery (`lib/site/jobPhotos.js` — `featuredUrls`, `jobPhotoPairs`) | Yes | Same — but **only** for photos that were already public (see below) |
| Photo report PDF (`lib/jobs/photoReport.js`) | Yes | Flattened preview — the report is evidence handed to a client or insurer, and markup drawn on it (an arrow at hidden damage) is exactly the point |

A save that replaces an existing `flattenedUrl`, or a clear, deletes the
**superseded** Cloudinary asset (`deleteAsset(oldFlattenedPublicId)`, in the
PATCH route, best-effort and *after* the database write succeeds — a
Cloudinary hiccup must never roll back an otherwise-successful save). So
storage stays bounded at one flattened asset per photo, not one per edit.

### The `issue` stage still never reaches the public gallery

Annotating an `issue`-staged photo does **not** create a new way for it to
leak onto the public site. The exclusion was never a URL-shape rule — it's
`stage: { not: "issue" }` in `featuredUrls()`'s own Prisma `where` clause,
and (independently) `beforeAfterPairs()` → `lib/gallery/albums.js`'s
`publishable()` filter for `jobPhotoPairs()`. Both are completely
untouched by this feature; `displayPhotoUrl()` only decides *which asset* a
photo that was **already going to be shown** uses, never *whether* it's
shown. `scripts/check-gallery.mjs` asserts both filters are still present,
source-level, and `scripts/check-job-photo-report.mjs` section 2
(pre-existing, unmodified) already executes the proof that an issue photo —
featured or not — never reaches `albums()`/`beforeAfterPairs()`.

The photo report PDF is the one surface that **does** show issue photos,
annotated or not — by design, unchanged by this feature (see its own
module header: "Deliberately unfiltered… a staff member looking at their
own company's own job is not that stranger"). An annotated issue photo's
arrow pointing at pre-existing water damage is exactly the evidence that
document exists to carry.

---

## Colour contrast — the halo

*"A fixed red is invisible on a red brick wall… consider an outline or
shadow so any colour reads on any photo."*

There's no way to measure contrast against the actual photo pixels under a
hand-drawn stroke — a single stroke can cross brick, sky, and a white door
trim in three inches, and by the time you'd know what colour was under a
given point you'd have already rendered it. So instead, **every annotation
object gets a halo**: a slightly wider copy of itself, drawn immediately
behind it, in whichever of near-white (`#ffffff`) or near-black (`#111111`)
contrasts more against the ink colour itself —
`lib/photoAnnotator/contrast.js#haloColorFor()`, which reuses
`lib/brand/colour.js#readableForeground()` rather than a second, cruder
light/dark rule. That guarantees a hard edge between the ink and
*something*, regardless of what's under it — the same trick a road atlas
uses to case a route line in white so it reads over both dark forest green
and light desert tan.

Measured, not eyeballed — `scripts/check-job-photos.mjs` section 8 executes
`haloColorFor`/`haloContrast` against every colour in the toolbar's palette
and asserts **≥ 4.5:1** for each. Worst case is `#0a84ff` (the toolbar's
blue) against its halo, at **5.18:1**; `#ffffff` and `#111111` against each
other come out at 18.88:1. Every pairing clears the floor with room to
spare, including under hostile input (`null`, `"not a colour"`, `"#GGGGGG"`,
`42`, `{}` — all resolve to a real, legible halo rather than `NaN`).

Freehand strokes (pen/pencil/marker/highlighter) get a `fabric.Path`
built from the *same path-command array* PencilBrush just drew, with a
wider `strokeWidth` and the halo colour — reconstructed synchronously
rather than via Fabric's own `clone()`, which is callback-based (async for
resource-loading object types) and this needed both objects to exist in the
same tick so they land in one `fabric.Group` together. Shapes and the arrow
get a genuinely larger halo copy (padded geometry, not just a wider
stroke), grouped the same way. Text gets its own native `stroke` +
`paintFirst: "stroke"` — no duplicate object needed, since Fabric's
Textbox already supports an outlined-text render directly.

The highlighter's halo is deliberately thin (`haloExtra: 2` vs. 3–5 for the
others) — a thick opaque outline around a translucent highlight band would
read as a solid box, defeating the point of a highlighter. It also uses
`globalCompositeOperation: "multiply"` at low opacity, so it darkens
whatever's under it (like a real felt-tip) instead of painting an opaque
band over it.

---

## Touch

**Verified, from source, without a physical device:** `fabric@5.3.0-browser`
binds `touchstart`/`touchmove`/`touchend` unconditionally in its internal
event pipeline (`node_modules/fabric/dist/fabric.js` — `_onTouchStart` /
`_onTouchEnd`, wired the same way `mousedown`/`mousemove`/`mouseup` are,
not behind an opt-in flag). Drawing a freehand stroke, dragging an object,
and resizing via a corner handle all route through the same internal
handlers mouse input uses — this is the identical mechanism the marketing
designer's canvas already relies on in production, so there's no reason to
expect it behaves differently here. `useAnnotatorHotkeys.js` is explicitly
secondary — every action it provides (undo, redo, delete, escape) also has
an on-canvas button, because the primary user has no keyboard.

**Could not verify without a device — and structurally cannot be added
without one:** pinch-to-zoom / two-finger rotate. This exact fabric build's
own header comment states how it was compiled:
`build: node build.js modules=ALL exclude=gestures,accessors,erasing` — the
`gestures` module (Fabric's `touch:gesture` event, the thing pinch-zoom
would be built on) was excluded from the bundle, before this feature
existed. Re-including it is a build/vendoring change to a shared dependency
— out of this task's scope, and it would affect the marketing designer's
canvas too, not just this one. So zoom here is explicit `+`/`−` buttons
(touch-sized tap targets, bottom-right of the canvas), the same shape as
the designer's own `Footer.js` zoom controls — a pre-existing constraint of
the vendored build, not a regression this feature introduced.

**Genuinely unverified, and worth a real-device pass before this ships
wide:** the *feel* of drawing with a finger specifically (as opposed to a
mouse or a stylus) — line smoothing, palm-rejection (none is implemented;
Fabric has no built-in palm-rejection and this doesn't add one), and
whether the on-screen brush width presets (3–24px in canvas units) read as
sensible physical widths on an actual phone screen at whatever zoom level
`useFitZoom.js` settles on. None of that can be assessed by reading source.

---

## Undo/redo

Non-negotiable per the brief, and implemented as a plain snapshot stack
(`app/components/photoAnnotator/hooks/useAnnotatorHistory.js`) —
`canvas.getObjects().map(o => o.toObject())` on every discrete action
(a stroke finishes, a shape/arrow/text is added, a delete, a
move/resize/text-edit is committed), pushed explicitly rather than wired to
Fabric's generic `object:added` event (a single freehand stroke arrives as
two `canvas.add()` calls — halo, then ink — before being grouped into one;
wiring the generic event would double- or triple-count one user action into
several undo steps).

**A real bug, found and fixed during this build:** the first version kept
the current history index in React state and had `push()`/`undo()`/`redo()`
close over it directly — the same shape the designer's own
`useHistory.js#save()` uses for its `historyIndex`. But
`PhotoAnnotatorEditor.js` wires `history.push()` into several `useEffect`
subscriptions (`path:created`, `object:modified`, …) whose *own* dependency
arrays deliberately don't include the whole `history` object, to avoid
re-subscribing those listeners on every keystroke. A handler captured on
an early render would keep closing over an old `index` value forever, and
this hook's redo-branch truncation (`historyRef.current.slice(0, index +
1)`) — a thing the designer's own `save()` doesn't even attempt — would
silently start corrupting history against a stale index the moment that
happened. Fixed by moving the index into a `ref` that every function reads
live, with `index` state kept only so the Undo/Redo buttons re-render
correctly. See the hook's own header comment for the full account.

---

## What was not built

Scoped out deliberately, not forgotten:

- **Recolouring an existing object.** Colour is chosen *before* drawing/
  adding, the same as Apple Markup; there's no "select a stroke, change its
  colour" path. Delete and redraw instead. (A first design considered
  storing a live `recolor()` closure on each object's Fabric `.data`, but
  that closure doesn't survive a `toObject()`/`loadFromJSON()` round-trip —
  i.e. it would silently stop working the moment you reopened a saved
  annotation or hit undo — which is a worse failure mode than not having
  the feature at all.)
- **Click-drag to draw a shape at an arbitrary size in one gesture.**
  Tapping Rectangle/Ellipse/Arrow inserts a default-sized instance,
  centred and already selected, which you then drag/resize/rotate via
  handles — the exact interaction the marketing designer's own
  `ShapeSidebar.js` already uses (`addRectangle()`/`addCircle()` etc.), not
  a regression from some richer interaction this feature was supposed to
  have.
- **Multi-object select, copy/paste, layer reordering.** A flat
  `canvas.getObjects()` list with no explicit z-order UI — Markup's shape,
  not Canva's.
- **Pinch-to-zoom / two-finger rotate.** Covered under Touch above — this
  fabric build has the `gestures` module excluded.
- **A dedicated `/app` route or nav entry.** The editor opens as a
  full-screen overlay from `JobPhotoCurator.js`, the one place job photos
  are already curated — no new page, no new nav row, no new feature flag
  (annotating uses the same `jobs`/`view_create_edit` permission level
  curating already required).
- **A real-device touch QA pass.** See Touch above.

## Fields another sibling agent may also want

This session's brief named two others working in parallel on this same
model — one adding company-defined **tags**, one adding **comments and
mentions** — and asked me to name any field I needed that they might also
add, rather than adding it myself. I didn't need anything from either: the
annotation columns (`annotationJson`, `annotationWidth`, `annotationHeight`,
`annotationUpdatedAt`, `flattenedUrl`, `flattenedPublicId`) are self-
contained and don't overlap a tag or a comment field. Worth flagging the
reverse, though: if either of them adds a `JobPhoto.updatedAt` (this model
currently has none — only `createdAt`), I'd want to know, since
`annotationUpdatedAt` is a narrower, annotation-specific timestamp that a
generic `updatedAt` wouldn't replace.

---

## Verification

- `npx prisma validate` — clean (additive, nullable columns only; `prisma
  db push` was **not** run, per the task brief).
- `npm run build` — exits 0. This is the check that would have caught a
  Fabric import reachable from a server-rendered path; it compiled clean,
  including the annotator's own `ssr:false` chain.
- `npm run check:all` (~200 scripts) — exits 0. One **pre-existing** check
  (`check-ai-images.mjs`) broke as a side effect of extracting
  `resizedUrl()` out of `lib/cloudinary.js` into
  `lib/media/cloudinaryUrl.js` (necessary so the annotator's "use client"
  code could resize an image URL without pulling the Cloudinary Node SDK
  into a browser bundle) — its "the transform never upscales" assertion
  read `lib/cloudinary.js`'s own source text for a literal that had moved.
  Fixed by repointing it at the new file; see that commit.
- Every new assertion across four check scripts
  (`check-designer-reach.mjs`, `check-job-photos.mjs`, `check-gallery.mjs`,
  `check-job-photo-report.mjs`) was **mutation-tested by hand** — the
  guarded behaviour was actually broken, the check was confirmed to fail,
  then the code was restored and confirmed clean via `git diff --stat`.
  No new `package.json` script entries were needed; all four files were
  already wired into `check:all`.
- `sanitiseAnnotationJson`, `displayPhotoUrl`, `haloColorFor`/`haloContrast`,
  and `buildArrowPath` are all pure functions, executed directly against
  hostile input (wrong types, malformed JSON, disallowed nested object
  types, oversized payloads, zero/negative/absurd geometry) rather than
  only read.
