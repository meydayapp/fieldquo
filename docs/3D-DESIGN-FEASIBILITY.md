# 3D room design — can FieldQuo do this, and what would it cost

Written 3 September 2026, answering the owner's question: contractors building
3D renders of rooms — room additions, bathroom renovations, basement remodels —
to show a homeowner. A button inside FieldQuo, in a costing-like setup. Possibly
AI recreating a model from a photograph that the contractor then modifies. An
external shareable link, a saved project attachable to a quote, units in cm, in,
m and ft, realistic rendering. Two demos referenced: Anthropic's Claude Fable 5.1
designing a house from a photo of a lot and rendering a cinematic walkthrough by
driving **headless Blender**, and **Seedance 2.0** for video. And: *can this be
done in a browser?*

**Nothing was built. This is a decision document.** No application code was
modified.

---

## The short answer

**Yes to 3D. No to the two codebases in `~/Downloads`. And you are much closer
than you think — but not for the reason you'd expect.**

Three findings, in order of how much they change the plan:

1. **`~/Downloads/chili3d-main` is licensed AGPL-3.0.** That is disqualifying
   for a proprietary SaaS unless you buy a commercial licence from the author.
   It is also the wrong tool — a mechanical CAD kernel, not a room designer.

2. **`~/Downloads/blender-main` is a source checkout that cannot be built as it
   sits**, and headless Blender is a *server* product. Real numbers below: a
   10-second photorealistic walkthrough costs **$3.50–$28 in GPU time per
   video**. At 50 companies × 10 renders/month that is **$3,500–$28,000/month**.
   That is not a Next.js app on Vercel any more. It is a render farm with a
   Next.js app attached.

3. **The kitchen designer already stores a complete 3D scene.** This is the
   finding that matters. `Quote.scopeDetails` holds a room with `width`,
   `depth`, `ceiling` and four walls with their own heights, and a list of
   elements each carrying `width`, `height`, `depth`, a wall, a position along
   that wall, and a height off the floor. That is not "2D data we could extend
   to 3D". **That is a 3D scene that is currently only ever drawn in 2D.**

So the smallest genuinely useful version is not a new product. It is a camera.

---

## 1. `~/Downloads/chili3d-main` — real, impressive, and unusable here

It exists and it is what the name suggests: **Chili3D**, a browser-based
parametric 3D CAD application. Version 0.7.0. TypeScript monorepo (npm
workspaces, Rspack 2), Three.js 0.184 for the viewport, and OpenCascade (OCCT)
8.0.0 compiled to WebAssembly via Emscripten for the geometry kernel.

It genuinely runs in a browser. The prebuilt kernel is committed at
`packages/wasm/lib/chili-wasm.wasm` — **10.5 MB** — plus a 114 KB JS loader and
Three.js on top.

### The licence decides this

`~/Downloads/chili3d-main/LICENSE` is the **GNU Affero General Public License
v3.0**. The C++ kernel under `cpp/` is LGPL-3.0; **all the TypeScript is
AGPL-3.0**, and `AGENTS.md:69` requires an AGPL header on every TS file.

AGPL §13 (`LICENSE:540`) is the clause that matters, and it exists precisely to
close the SaaS loophole:

> if you modify the Program, your modified version must prominently offer all
> users interacting with it remotely through a computer network … an opportunity
> to receive the Corresponding Source of your version

You would certainly modify it — a white-label room designer is not Chili3D's
office-ribbon MCAD UI. Bundling it into the Next.js app makes the served
artifact a combined work, and the safe reading is that FieldQuo's own source
becomes disclosable to every homeowner who opens a quote. Against a product
whose entire premise is that the software is invisible and proprietary, that is
not a risk worth taking on a lawyer's optimism.

**There is a documented way out.** `README.md:215`: *"For commercial licensing
options, contact xiangetg@msn.cn."* If you want Chili3D specifically, the honest
path is to buy a licence, not to reason about §13.

### Even licensed, it is the wrong tool

- **It is mechanical CAD.** Boolean solids, lofts, sweeps, fillets, chamfers,
  STEP/IGES/BREP import. There is no concept of a wall, a room, a door swing, a
  cabinet, or a finish schedule. You would be building the room designer *on
  top of* it and using perhaps 5% of a 10.5 MB kernel.
- **10.5 MB of WASM before your app loads.** `AGENTS.md` describes the
  client-facing audience as "a stranger with no account, often on a phone, on a
  bad connection, in a driveway." A 10.5 MB kernel download is that audience's
  worst case.
- **Its internal unit is millimetres** (`AGENTS.md:66`). FieldQuo is inches
  throughout. That is a conversion boundary you would own forever.
- Its UI is an Office-style ribbon in Chinese/English/Portuguese. Nothing about
  it is white-labelable without a rewrite.

**Verdict: no.** If you want a permissively-licensed starting point instead,
there are MIT-licensed browser floor-plan editors built on SvelteKit + Three.js
(the `open3dfloorplan` / `openPlan3D` family). **I have not read them** — they
are not on this machine, and I am not going to characterise code I have not
opened. They are worth an hour of evaluation *if* Stage 1 below proves
insufficient, not before.

---

## 2. `~/Downloads/blender-main` — a source tree, not a renderer

It exists and it is genuine Blender. But be clear about what is actually there:

- **Blender 5.3.0 alpha** (`source/blender/blenkernel/BKE_blender_version.h:23`).
- **347 MB of C/C++/Python source. No binary, no build.**
- **`lib/linux_x64`, `lib/macos_arm64`, `lib/windows_x64`, `lib/windows_arm64`
  are all empty directories.** `.gitmodules` marks them `update = none` — these
  are the precompiled dependency bundles (OpenImageIO, OSL, Embree, OptiX,
  Python, USD…), several GB, and they were never fetched. **This checkout
  cannot compile as it sits.**
- Licence: **GPL-3.0**, and `COPYING` is blunt: *"Apart from the GNU GPL,
  Blender is not available under other licenses."*

### What "the Blender skin to make it look realistic" would actually mean

Blender is not a skin. It is a desktop application whose renderer (Cycles, at
`intern/cycles/`) is a physically-based path tracer. "Realistic" is not a
setting — it is the act of tracing millions of light paths per frame on a GPU.

The licensing is workable but not free of consequence:

- **Invoking `blender --background --python script.py` as a separate process
  does not infect FieldQuo's code.** That is the standard arrangement every
  commercial render farm uses.
- **But the Blender Foundation's own stated position is that Python scripts
  using the `bpy` API are derivative works and must be GPL.** The scene-building
  and render script would therefore be GPL. That is a small file, not FieldQuo's
  source — annoying, publishable, survivable. Worth knowing before, not after.

### It cannot run on Vercel

Not a preference — four independent blockers, in the same spirit as the analysis
already in `lib/sales/discovery/overture/snapshot.js:5`:

1. **No GPU.** Vercel Functions are CPU-only. Cycles on CPU is roughly an order
   of magnitude slower than on a GPU.
2. **Size.** The Blender binary plus its dependency libraries is hundreds of MB
   against a serverless bundle limit measured in low hundreds of MB. Add HDRIs,
   PBR textures and furniture assets and it is not close.
3. **Time.** Vercel functions now reach 30 minutes on Pro with Fluid compute —
   enough for a still frame, nowhere near a 240-frame animation. Note also that
   **no `maxDuration` is exported anywhere in this repository**
   (`app/api/cron/sales-pipeline/route.js:39`), so today every function runs at
   whatever the dashboard says.
4. **Shape.** Rendering is a queued batch job with a progress state and an
   artifact, not a request/response. It wants a queue, a worker pool and object
   storage — which is a second piece of infrastructure, permanently.

**Verdict: Blender is a real option for photoreal output, but it is a server
product with a per-render bill, and this checkout is not a starting point — you
would install a release build in a container, not compile this.**

---

## 3. What FieldQuo already has — read this before deciding anything

The owner's instinct — *"maybe there's a simple way similar to my kitchen
designer"* — is right, and understated.

### The kitchen designer is already a room designer

| Piece | File | Size |
|---|---|---|
| Editor | `app/components/kitchen/KitchenDesigner.js` | 4,569 lines |
| Pure geometry (no React, no DOM) | `lib/kitchen/geometry.js` | 390 lines |
| Shape-list emitter | `lib/kitchen/planShapes.js` | 1,218 lines |
| Browser adapter | `app/components/kitchen/PlanSvg.js` | |
| PDF adapter | `lib/kitchen/PlanPdf.jsx` | |
| Pricing engine | `lib/kitchen/pricing.js` | 1,687 lines |
| PDF section | `lib/documentSections/KitchenPlanSection.js` | |
| Public client link | `app/design/[token]/` + `app/api/kitchen-design/[token]/route.js` | |
| Access gate | `lib/kitchen/access.js` | |

Against the owner's requirement list, this is what is **already shipped**:

| Requirement | Status today |
|---|---|
| A button inside FieldQuo | `/app/quotes/[id]/kitchen`, gated by `canUseKitchenDesigner` |
| "In a costing-like setup" | Save repriced server-side from `Company.cabinetRates`, writes one `QuoteScopeGroup`, recomputes quote totals — one button, `app/api/quotes/[id]/kitchen/route.js:94` |
| External shareable link | `/design/[shareToken]` — 32 bytes of CSPRNG, `noindex`, contractor-branded, prices stripped key-by-key |
| Saved project attached to a quote | `Quote.scopeDetails` + `Quote.quoteType = "kitchen"`; homeowner's version kept separate in `Quote.clientKitchenConfig` |
| Prints on the quote | `KitchenPlanSection` renders plan + four elevations into the PDF |
| Units cm/in/m/ft | **Missing. Inches only.** |
| Realistic rendering | **Missing. 2D SVG only.** |

Seven requirements. Five are done.

### And the saved data is already a 3D scene

`KitchenDesigner.js:766` and `fullConfig()` at `:921`:

```js
room: {
  width: 144, depth: 120, ceiling: 96,
  walls: { A:{length:144,ceiling:96}, B:{length:120,ceiling:96},
           C:{length:144,ceiling:96}, D:{length:120,ceiling:96} }
}
elements: [ { id, kind, wall:"A", pos, y, width, height, depth, config } ]
```

Every element is a **box with three dimensions**, placed against **one of four
walls**, at a **distance along that wall**, at a **height off the floor**, inside
a room with a **ceiling height**. `planRect(el, room)` (`geometry.js:330`)
already converts wall-relative placement to room-space x/y.

To draw this in 3D you need: `x` and `y` (already computed), `z` (the `y` field,
already stored), and three dimensions (already stored). **There is no missing
data.** The renderer throws the third dimension away on purpose, because
`planShapes.js` emits a flat shape list so that the on-screen SVG and the
`@react-pdf` drawing can be guaranteed to agree (`PlanPdf.jsx:11`).

That constraint is correct for the printed document and should not be touched.
A 3D view is an *additional* consumer of the same `geometry.js`, not a
replacement for the shape list.

### Where it does not yet stretch

Two real limits, and they matter to the owner's three named use cases:

- **The room is a fixed rectangle with four hardcoded walls.** `WALLS` is a
  four-element array (`geometry.js:45`); `planRect` is a `switch` over `A|B|C|D`;
  corners are the enumerated set `AD|AB|BC|CD`; the wall-length editor forcibly
  keeps opposite walls equal. **It cannot represent an L-shaped room.**
  - **Bathroom renovation: fits today.** Bathrooms are overwhelmingly
    rectangular; a vanity is a wall-hung box with a position. `ROOM_TYPES`
    (`pricing.js:481`) is *already* three rooms — kitchen, laundry, closet —
    with per-room palettes and ~15 extra element kinds. Adding bathroom is a
    palette, some kinds, and a rate slot — and the rate slot is already there:
    `lfVanity` (`pricing.js:75`) with a `VANITY_KINDS` list
    (`pricing.js:941`) that currently routes exactly one kind,
    `laundrySinkBase`. A bathroom vanity drops straight into it.
  - **Basement remodel and room addition: blocked.** L-shapes, soffits, columns,
    stairs, multiple openings. This needs the room replaced with a vertex/edge
    model (`walls: [{start:{x,y}, end:{x,y}, height}]`) and a rewrite of
    `planRect`, `cornerLegs`, `wallSpan`, `planWidth/planDepth` and every
    `["A","B","C","D"]` literal across a 138 KB component and a 47 KB shape
    module. **This is the single largest piece of work in this whole document,
    and it is not the 3D part.**

- **Inches, hardcoded, everywhere.** Covered in §6.

---

## 4. Browser or server? They are two different products

This is the question to answer first, because it determines whether you are
still running a Next.js app.

| | **Browser (WebGL)** | **Server (GPU)** |
|---|---|---|
| Technology | Three.js / WebGL2 | Blender Cycles, or a video model |
| Latency | Instant, 60fps, drag-and-see | 30 s – 20 min, queued |
| Marginal cost per view | **$0** — the homeowner's phone does the work | $0.015 – $28 |
| Infrastructure | A JS bundle on Vercel | Queue + GPU workers + object storage |
| Looks like | A clean, lit, shaded model. Convincing. Not a photograph. | A photograph |
| Works offline / on a driveway connection | Yes, after first load | No |
| Good for | **Interactive design and understanding** | **The final "wow" image** |

**Real-time editing must be in the browser. Photorealism must be on a server.
Neither can do the other's job.** Any plan that pretends otherwise is wrong.

The honest framing: the contractor and the homeowner *design* in the browser,
and then optionally *buy* a photoreal image of what they designed. The second
is a paid, queued, one-shot artifact — much closer to how the existing paid
vision pass works (`lib/ai/visionPass.js`) than to how the designer works.

Three.js in a Next.js app is unremarkable — a client component with
`ssr: false`, the same pattern `fabric` already uses for the photo annotator and
the marketing designer. Bundle cost is roughly 150 KB gzipped, against Chili3D's
10.5 MB.

---

## 5. What it costs — numbers, not adjectives

Rates read 3 September 2026. **Prices drift; re-check before committing**, the
same warning `lib/ai/imageEconomics.js:19` carries about its own table.

Baseline: RunPod serverless **L40S at $1.75/hr** (pods are cheaper per hour —
$0.99 — but bill while idle, which is worse for bursty work). Arithmetic is in
this document's working script and reproduced here.

### One still photorealistic frame, 1080p, Cycles

| Render time | GPU cost |
|---|---|
| 30 s | $0.015 |
| 1 min | $0.029 |
| 2 min | $0.058 |
| 4 min | $0.117 |
| 8 min | $0.233 |

An interior with glass, real materials and 128–256 samples plus OptiX denoising
lands around **1–4 minutes**. A four-angle package of one room: **$0.12–$0.47.**

**Stills are cheap.** This is the surprise in the numbers.

### A 10-second walkthrough at 24 fps — 240 frames

| Per-frame | GPU-hours | Cost per video |
|---|---|---|
| 30 s | 2.0 | **$3.50** |
| 1 min | 4.0 | **$7.00** |
| 2 min | 8.0 | **$14.00** |
| 4 min | 16.0 | **$28.00** |

**Animation is 240× a still.** The cinematic walkthrough is the expensive
product, and it is expensive for an unavoidable reason: every frame is a
separate render.

### Seedance 2.0 — video without modelling anything

Per output second on fal.ai (Replicate matches): 720p **$0.3034**, 720p fast
**$0.2419**, 1080p **$0.682**.

| | 5 s | 10 s |
|---|---|---|
| 720p fast | $1.21 | $2.42 |
| 720p | $1.52 | $3.03 |
| 1080p | $3.41 | $6.82 |

Cheaper and vastly simpler than Blender for video — **but it generates a video,
not a render of your model.** It does not know the cabinet is 36 inches wide.
See §7.

### gpt-image-1 — already wired into this app

`lib/ai/imageEconomics.js:107` records **~$0.06 cost per generated image, priced
at 12¢** (`IMAGE_GENERATION_CENTS`), billed against the shared AI credit wallet
with `checkAiQuota` before and `recordAiUsage` after. The metering, the wallet,
the top-up flow and the margin convention all exist today.

### Monthly, at 50 companies × 10 renders each (500 renders/month)

| Product | Monthly vendor cost |
|---|---|
| WebGL 3D view in the browser | **$0** |
| 4 photoreal stills per render, 2 min/frame | **$117** |
| 4 gpt-image-1 restyled images per render | **$120** |
| 1× 10 s Seedance 1080p per render | **$3,410** |
| 1× 10 s Blender walkthrough, 2 min/frame | **$7,000** |

Plus, for the Blender column only: a container image with Blender and assets, a
job queue, worker autoscaling, object storage, retry/timeout handling, and
someone to own it when a render hangs at 3 a.m.

**Read that table as the product decision it is.** The interactive 3D view is
free. Stills are a rounding error next to the AI spend already running. Video is
a different company.

> **Per `docs/` convention and the standing rule that cost-increasing changes
> need the owner's approval with real numbers: Stage 1 below adds $0 of vendor
> cost and needs no approval. Stages 2 and 3 do, and the numbers above are the
> ones to approve or refuse.**

---

## 6. Units — cm, in, m, ft

This is a real requirement and the classic place dimensional bugs hide. The
current state is worse than "imperial".

**There is no unit system anywhere in FieldQuo.** `unitSystem`,
`measurementSystem`, `unitPreference`, `measurementUnit` — zero hits across
`lib/`, `app/`, `prisma/`. There is no `Company` unit field, no conversion
module, no formatter.

**The unit lives in the identifier, never in the data.** Roughly 250 distinct
keys across `lib/pricing`, `lib/costing`, `lib/estimate` and `app/data` follow
the pattern `areaSqft`, `handrailFt`, `wallLengthFt`, `thicknessInches`,
`foundationInches`. Every one is a bare `Number` in JSON. The convention is
enforced by nothing but the suffix in the variable name.

Concretely, in the two files named in the brief:

- `TradeTakeoff.js` — `landingSqft` (:141), `handrailFt` (:134),
  `unit: "linear ft"` (:136) as a display-only string, English-literal labels
  like `"Floor area (sqft)"` (:729), and a unit baked into a formula:
  `const squares = num(takeoff.areaSqft) / 100;` (:1866) — a roofing "square"
  is 100 sq ft by definition.
- `PaintAreas.js` — labels *are* translated but the unit inside them is not:
  `t("app.paint.lengthFt", "Length (ft)")` (:315). The readout prints
  `{geo.wallSqft} sqft` as a literal string in JSX, outside `t()` (:355).
  `lib/pricing/paintTakeoff.js` `areaGeometry()` is unit-agnostic in its
  algebra but every key it touches is `…Ft`/`…Sqft`, and the rates it multiplies
  against are sq ft/hour and sq ft/gallon by construction.
- Kitchen: **inches by fiat.** `KitchenDesigner.js:5` — *"Phone-first. Inches
  throughout."* `geometry.js:3` — *"Where every cabinet sits, in inches."*
  `COUNTER_HEIGHT = 36`, `BASE_HEIGHT = 34.5`, `UPPER_BOTTOM = 54`, `SNAP = 2`.
  The room-dimension inputs are bare number fields labelled only **"Length"**
  and **"Height"** — **the unit is never printed next to them.** A metric user
  typing 300 would get a 300-inch wall and no warning.

**And there is already one metric→imperial boundary, copied four times.**
`SQFT_PER_M2 = 10.7639104` appears independently in
`lib/measure/roofMeasurement.js:35`, `lib/measure/lotArea.js:25`,
`lib/measure/satellite.js:54` (derived), and inline in the browser at
`app/instant-quote/[companySlug]/InstantQuoteFlow.js:218`. Google Solar returns
m²; three of those four convert to imperial and **discard the metric original**.
`lib/estimate/rewireTakeoff.js:126` pre-converts a natively-metric Canadian code
rule to `11.811` feet.

### The recommendation

**Storage unit stays inches. Units are a presentation layer, entered and
displayed, never stored.** Reasons:

- The kitchen designer already proves the pattern: it stores inches and
  displays `feetInches()` (`planShapes.js:157`) — `42 → 3'-6"`.
- `scripts/check-paint-takeoff.mjs` asserts the owner's real invoice figures to
  the cent against imperial keys. A stored-unit change breaks the one check that
  proves pricing is right.
- Retagging ~250 key names and every check fixture buys nothing a converter at
  the boundary doesn't.

So: one `lib/units.js` (parse, format, convert), a `Company.unitSystem` column
following the exact precedent of `Company.country` (`schema.prisma:1150`) and
`Company.currency` (`:1230`) — derive from country, show a picker only if they
work abroad — and **every dimension input labelled with the unit it is in**.
That last item is the one that prevents silent error, and it is missing today
even in pure-imperial use.

**Do not accept a mixed-unit design payload.** A JSON blob where some numbers
are inches and some are centimetres, distinguished by a sibling field, is the
bug this section exists to prevent.

---

## 7. Photo → 3D model. Be careful here.

The owner asked whether AI could recreate a model from a photograph that the
contractor then modifies. This deserves the most honest answer in the document,
because **this product's core rule is never to ship a control that appears to
work and doesn't** — and a render that misleads a homeowner about what they are
buying is exactly that failure, wearing a nicer suit.

**FieldQuo has already decided this question, in writing.**
`lib/ai/quoteReview.js:382`:

> Never state a measurement, a material or a brand from a photo. A photo does
> not carry a tape measure, and a wrong number quoted with confidence is worse
> than no number.

`lib/ai/visionPass.js:20` reaffirms it for the *paid* pass, deliberately:
*"a paid pass is exactly the wrong place to relax the rule against inventing a
measurement from a photograph."*

That rule is right and it settles the design.

### What current models can and cannot do

**Can, reliably:**
- Generate a beautiful image of a plausible room from a photo plus a prompt.
  `gpt-image-1` is already wired in and does this today, for ~$0.06.
- Generate a plausible video. Seedance 2.0 does this well, for $2–$7.
- Read a photo and *describe* it: "this is a galley kitchen, uppers on the left
  wall, window on the back wall, appliances appear to be on the right."
- Classify layout, style, finish, and rough element inventory.

**Cannot, reliably:**
- Recover **metric scale** from a single photograph. This is not a model-quality
  problem that the next release fixes; it is geometrically underdetermined. A
  single image has no absolute scale without a known reference. The current
  research literature on metric single-image reconstruction is explicit that
  monocular methods lack the multi-view constraints needed for real-world
  dimensions, and the 2026 work that does achieve metric indoor reconstruction
  (e.g. Argus) uses **panoramic multi-view capture**, not one snapshot.
- Produce a model a contractor can quote from. Quoting reads `width / 12` to get
  linear feet and multiplies by a rate. An AI-guessed width is an AI-guessed
  price on a document a homeowner signs.

### So: the split that keeps this honest

**AI proposes the layout. A human enters the dimensions. Nothing is priced from
a guess.**

Concretely, a defensible "AI from photo" feature looks like this:

1. Contractor photographs the room. (`Quote.clientPhotos` and the vision
   plumbing already exist.)
2. A vision pass returns a **draft layout**: room type, which wall has the
   window, roughly what is where, element kinds — via `complete()` in
   `lib/ai/provider.js` with a JSON schema, exactly as `callQuoteDraft.js` does.
3. The designer opens **pre-populated but explicitly unmeasured**. Every
   dimension field is empty and flagged. The contractor types real numbers off
   a tape.
4. **Nothing prices until the dimensions are entered.** The pricing engine
   already has the right instinct — `priceCabinet()` returns `{rateMissing:true}`
   rather than a silent `$0` (`pricing.js:1052`), and `getKitchenBreakdown()`
   keeps `unpriced` as a first-class bucket because *"a closet that totals $0
   looks like a bug or a gift"* (`pricing.js:1551`). Extend that, don't bypass it.

This is genuinely useful — it removes the blank-page problem, which is most of
the friction — and it never claims a number it does not have.

### And a warning about the demos

The Claude Fable 5.1 demo (a photo of an empty lot → a designed house →
headless Blender → a cinematic walkthrough) is real and it is impressive. It is
also **a design fiction, not a measured building.** Nothing in it was
dimensionally accountable to a lot survey, and nothing was going to be built
from it. That is fine for a capability demo. It is not fine on a document a
homeowner signs and a framer builds from.

**The line to hold: an image sold as "an artist's impression" is honest. The
same image implied to be "your room, to scale" is not.** Whatever ships, the
client-facing surface must say which one it is — and if a render was produced
from AI-guessed geometry, it should say so on the render, not in a tooltip.

---

## 8. Attaching to a quote — where this fits in the 64 models

`docs/INTERCONNECTIONS.md:25`: *"before you write a number anywhere, find who
reads it."*

### For the design payload: extend, don't invent

A room design that produces quote money belongs where the kitchen design already
sits — `Quote.scopeDetails` with a `serviceType` discriminator, saved through a
route that reprices in the same operation. That route already exists and its
header states the reason plainly: two buttons, "save design" then "update
quote", *"is how a quote goes out at a price that doesn't match the drawing"*
(`app/api/quotes/[id]/kitchen/route.js:8`).

The established shape is worth restating because it is good and it is
check-enforced: **pure geometry module → shape list → two thin adapters (SVG and
`@react-pdf`)**, with `scripts/check-kitchen-plan.mjs` asserting both adapters
cover the same shapes and `scripts/check-kitchen-pdf.jsx` rendering a real PDF
and reading the text back off the page. A 3D view becomes a **third consumer of
`geometry.js`** and changes neither of the existing two.

### A new model is warranted only for renders

Renders are not the design. They are large binary artifacts with a vendor cost,
a queue state and a provenance question. They need a row:

```
RoomRender
  id, companyId, quoteId
  designHash        -- which version of the design this depicts
  kind              -- "webgl_snapshot" | "cycles_still" | "ai_image" | "video"
  status            -- queued | rendering | ready | failed
  url, publicId     -- Cloudinary, like every other media URL here
  costCents         -- what it actually cost us
  createdById, createdAt
```

`designHash` is the load-bearing field. **A render is a photograph of a design
at a moment.** Edit the design and the render is stale — and a stale
photorealistic image attached to a live quote is precisely the "control that
appears to work and doesn't" failure. Store the hash, compare on read, and say
"this render is of an older version" rather than showing it silently.

Conventions this must follow, all already enforced:

- **`companyId` on the row**, because a render carries a cost and a URL and is
  read directly. (The counter-example, `QuoteCosting` at `schema.prisma:2953`,
  omits `companyId` *because* it is only ever reached through an already-scoped
  Quote — that reasoning does not apply to a queued job a worker picks up.)
- **`lib/tenant/ownedIds.js`** — any foreign key taken from request data must
  be registered there, or `scripts/check-tenant-scope.mjs` fails the build.
- **Never put cost or rate data on `Quote` itself.** `QuoteCosting`
  (`schema.prisma:2917`) exists because `app/api/quotes/[id]/pdf/route.js` and
  `app/api/public/quotes/[token]/route.js` both spread the quote row wholesale —
  anything on `Quote` rides along to a homeowner. `costCents` on a `Quote`
  column would leak.
- **Revisions**: copy `JobDocument.supersedesId` (`schema.prisma:9578`) rather
  than inventing a versioning scheme.
- **Metering**: renders bill against the existing shared AI credit wallet —
  `checkAiQuota` before, `recordAiUsage` after — not a second wallet.
  `lib/ai/imageEconomics.js:113` already argues this: *"a contractor who has
  paid for 'AI' and is then told this particular AI needs a different wallet
  feels cheated, and is right to."*

### Getting a render onto the PDF

`@react-pdf/renderer` cannot rasterise a WebGL canvas, and there is no
server-side canvas in this repo. The existing answer is already in the codebase:
`JobPhoto.flattenedUrl` / `flattenedPublicId` (`schema.prisma:7691`) — the
browser flattens, uploads through `/api/upload`, and the PDF embeds a plain
image URL. Do the same for a 3D snapshot: `canvas.toBlob()` on save, upload,
store the URL, embed it. Server renders arrive as URLs already.

**The 2D plan stays on the PDF regardless.** It is the drawing with dimensions
on it. A render is decoration; the plan is the document.

---

## 9. The staged path, and what I would do

### Stage 1 — A 3D view of the design you already have

**Add Three.js. Render `Quote.scopeDetails` in 3D. Change no data.**

`geometry.js` already gives you room-space x/y. The elements already carry
width, height, depth and a height off the floor. The room already carries a
ceiling. Build boxes, apply the finish colours from the existing `finish` object
and `lib/kitchen/finishes.js`, add an orbit camera and a soft three-point light
rig. Ship it as a **fourth tab** beside Plan and the four elevations, and on
`/design/[token]` so the homeowner sees it too.

- **Vendor cost: $0.** The viewer's device renders it.
- **New Prisma models: none. Schema change: none.**
- **Risk: very low.** Nothing that exists changes. If the 3D tab is removed
  tomorrow, the plan, the elevations, the PDF and the pricing are untouched.
- Add a `check:kitchen-3d` script in the house style, asserting that every kind
  in `KINDS` produces a box with non-zero dimensions — the same thing
  `check-kitchen-plan.mjs` does for shapes, and the same class of bug (a closet
  that priced and drew but was silently dropped from the PDF,
  `geometry.js:56`).

### Stage 2 — Units, and bathroom as a room type

Two independent pieces, both worth doing before any renderer.

- `lib/units.js` + `Company.unitSystem` + **every dimension input labelled with
  its unit**. Storage stays inches. This is the one item on the owner's list
  that is a correctness fix, not a feature — the room inputs are unlabelled
  today.
- Bathroom: an entry in `ROOM_TYPES`, a palette group, vanity/toilet/tub/shower
  in `ROOM_ELEMENT_KINDS`, and a `VANITY_KINDS` entry so the existing `lfVanity`
  rate applies. The laundry and closet room types are the proof this seam works.

**Vendor cost: $0.**

### Stage 3 — Photoreal stills, paid, queued *(needs approval)*

Two candidates, and I would try the cheap one first:

- **`gpt-image-1` restyle of a WebGL snapshot** — already wired, ~$0.06, already
  metered, already priced at 12¢. Send the shaded 3D snapshot as the reference
  image via the existing `images.edit` path in `lib/ai/provider.js:500`. It
  preserves layout well and produces something that reads as a photograph. **~2
  weeks, no new infrastructure.**
- **Blender Cycles on a serverless GPU** — $0.12–$0.47 for four angles, truly
  faithful to the model because it renders the actual geometry. Needs a
  container, a queue, workers and storage. **~2 months and a permanent second
  system to own.**

Start with the first. If contractors say the images are pretty but wrong, the
second is the fix, and by then you will know whether anyone is paying.

### Stage 4 — Arbitrary room shapes *(the real unlock, and the real work)*

Replace `{width, depth, walls:{A,B,C,D}}` with a vertex/edge wall model. This
is what makes **basements and room additions** possible at all, and it is a
rewrite of `planRect`, `cornerLegs`, `wallSpan`, `planWidth/planDepth` and every
hardcoded `["A","B","C","D"]` across a 138 KB component and a 47 KB shape
module — while keeping every existing kitchen design loading correctly.

Note where this sits: **the owner's two headline use cases, basements and
additions, are gated on Stage 4, not on 3D.** The geometry is the blocker, not
the renderer.

### Stage 5 — Video *(needs approval; I recommend against for now)*

$3,410–$7,000/month at 50 companies × 10/month. Seedance is cheaper and simpler
than Blender but generates a video *inspired by* the room rather than *of* it,
which walks straight into §7. If it ships at all it should be a clearly-labelled
"artist's impression", priced per render at the point of use, never bundled.

---

## Recommendation

**Build the small version. Build Stage 1 now.**

A 3D view of data FieldQuo already stores, already prices, already prints and
already shares with the homeowner costs nothing per render, needs no schema
change, adds no infrastructure, and takes the product from "here is a floor
plan" to "here is your kitchen" in about a week of work. There is no version of
this project with a better ratio.

**Then Stage 2**, because unlabelled dimension inputs are a live correctness
problem regardless of whether any of the rest happens, and bathroom is nearly
free given the laundry/closet precedent.

**Then decide on Stage 3 with real usage in hand.** Photoreal stills are $117 a
month at the volumes above, and the cheap variant reuses machinery that already
exists. That is a genuine, sellable upsell. Ask for it when there is evidence
contractors want it.

**Do not build a render farm, and do not adopt Chili3D.** The farm is a $7,000/
month answer to a question the browser answers for free, and Chili3D's licence
would put FieldQuo's source in front of every homeowner who opens a quote.

**A last word on priorities, offered because it is what I actually believe.**
The brief asked whether a 2D room plan with accurate dimensions, printed on a
quote, might be worth more to a painter than a cinematic walkthrough. It would
be — and FieldQuo already has it, for kitchens, laundries and closets. The
highest-value work in this whole document is probably not the 3D at all. It is
**Stage 4**: making that plan describe an L-shaped basement. A contractor who
can hand a homeowner a dimensioned drawing of their actual, irregular room wins
more jobs than one with a beautiful render of a rectangle nobody lives in.

---

## Sources

Local, read directly: `~/Downloads/chili3d-main` (LICENSE, README.md, AGENTS.md,
package.json, `packages/wasm/lib/`), `~/Downloads/blender-main` (COPYING,
README.md, `.gitmodules`, `lib/`, `BKE_blender_version.h`), and the FieldQuo
files cited inline.

External, read 3 September 2026:

- [Runpod GPU cloud pricing](https://www.runpod.io/pricing)
- [Seedance 2 API pricing — fal vs Replicate](https://poyo.ai/comparison/seedance-2-fal-vs-replicate-vs-poyo)
- [Seedance 2.0 pricing](https://novoads.ai/en/blog/seedance-2-0-pricing)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) and
  [functions up to 30 minutes](https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes)
- [Blender licence](https://www.blender.org/about/license)
- [Argus: metric panoramic 3D reconstruction for indoor scenes](https://arxiv.org/html/2606.30047v3)
- [Metric3D: zero-shot metric 3D prediction from a single image](https://arxiv.org/pdf/2307.10984)
- [Blender Cycles sampling — Blender manual](https://docs.blender.org/manual/en/latest/render/cycles/render_settings/sampling.html)
- [open3dfloorplan (MIT)](https://github.com/jsweat123/open3dfloorplan) — listed, **not evaluated**
