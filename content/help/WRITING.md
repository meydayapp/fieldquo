# Writing a help-centre article

Read this before touching `content/help/<lang>/<category>.js`. The check
(`npm run check:help-centre -- --only=<category>`) enforces most of it; the rest
is what makes the article worth reading.

## Who reads it

A contractor — a painter, a roofer, a cabinet maker — often on a phone, often
in a driveway, usually mid-task. They want the answer, the screen, and the
next click. Not marketing. The reader is **you** (second person), the company
is **your company**, the homeowner is **the client**. The product is
**FieldQuo** in every language (never translated).

## Where the facts come from

Every sentence must be true of the running code today. Sources, in order:

1. The screen itself: `docs/screens/live/app/<lang>/*.png` (74 real
   captures per language) and `docs/screens/live/actions/en/*.png` (what
   opens on New / Add). Quote the words on the screen, in the reader's
   language, from `app/i18n/appMessages.js` — the French label of a button is
   the French string in that catalogue, not your translation of the English.
2. The page module under `app/app/**/page.js` and the API it calls — for what
   a toggle does, what a button sends, who may press it.
3. `lib/**` for the rules: money (`lib/stripe/processingFee.js`,
   `lib/pricing/ladder.js`), permissions (`lib/permissions.js`,
   `lib/permissions/nav.js`), schedules (`lib/servicePlans/`,
   `lib/paymentSchedule/`), automations (`app/api/cron/*`).
4. The sales guide (`docs/sales/guide/content.{en,fr,es}.js`, chapters
   SCREENS_CHAPTER and ROLES_CHAPTER) — already in three languages and
   already checked against the screens, but written for a sales rep. Reuse
   its FACTS and its screen vocabulary; rewrite the sentences for the
   contractor.
5. `lib/marketing/featureMatrix.js` — a feature marked `partial` carries a
   `limits` sentence. Say the limit. Never promise what the matrix hedges.

If you cannot find it in the code, it is not in the article. "Not yet" and
"FieldQuo does not do X" are good sentences; an invented feature is a bug
report from a customer.

## The shape

```js
export const ARTICLES = {
  "the-slug-from-lib-help-tree": {
    title: "…",
    summary: "One sentence. Shown on cards, in search, as the meta description.",
    updated: "2026-09-12",
    intro: ["One or two paragraphs: what this is and why it matters."],
    sections: [
      { id: "overview", heading: "Overview", blocks: [ { p: "…" } ] },
      { id: "steps",    heading: "How to …", blocks: [
          { steps: ["Open **Settings → Payments**.", "Press **Connect with Stripe**."] },
          { figure: "live:app-settings-payments", caption: "Settings → Payments — …" },
          { note: "…" },
      ] },
      { id: "what-it-changes", heading: "What each setting changes", blocks: [
          { table: { head: ["Setting", "What it does"], rows: [["…", "…"]] } },
      ] },
    ],
    faq: [{ q: "…", a: "…" }],   // 2–4 questions on the main articles; optional on small ones
  },
};
```

Blocks: `{ p }`, `{ steps: [] }`, `{ bullets: [] }`, `{ note }`, `{ tip }`,
`{ warning }`, `{ figure, caption }`, `{ table: { head, rows } }`.
Inline: `**bold**` for the words on the screen; `[[slug|text]]` to link
another article (the slug must exist in `lib/help/tree.js`). Nothing else —
no HTML, no markdown links, no URLs to fieldquo.com.

Section ids: lowercase, hyphenated, unique in the article, never `faq`.
Every article: `intro` (≥ 1 paragraph), ≥ 3 sections, a figure wherever a
capture of that screen exists, `updated: "2026-09-12"`.

Anatomy to aim for on a screen article: Overview (what the screen is for,
in one paragraph) · What is on the screen (the real words, top to bottom) ·
How to … (numbered steps, one figure) · What each control changes (bullets or
a table — every toggle has a consequence; say it) · Who can see it (the
access level, from `lib/permissions`) · FAQ.

## Figures

Only these references exist; the build refuses any other:

- `live:<route-slug>` — `docs/screens/live/app/en/<route-slug>.png` (French
  and Spanish captures exist for all 74 and are picked automatically).
- `create:<route-slug>-create` — the New/Add screens, English only.
- `harness:<slug>` — the harness render, e.g. `harness:access-editor`.

The full list: `node -e 'import("./scripts/help-figure-sources.mjs").then(m=>console.log(m.availableFigures().join("\n")))'`.
Give every figure a caption that says what the reader is looking at
("Settings → Branding — the logo card and the two brand colours"). A caption
is not the article title.

## Three languages, one structure

French and Spanish are **written, not translated word for word**, but they
must carry the same slugs, the same section ids in the same order, the same
block kinds in the same order, the same figure references, the same number
of steps/bullets/rows and the same number of FAQ entries as the English.
The check diffs the structure. It also flags a French or Spanish paragraph
whose function words are English.

- French: Quebec register, the one `app/i18n/appMessages.js` uses —
  *soumission* (not devis), *chantier* for a job, *courriel*, *facture*,
  *encaissement*, *texto*, *clavardage*; « guillemets »; tu/vous → **vous**.
  Screen words come from the `fr` block of the catalogue.
- Spanish: neutral Latin-American, **usted**; *presupuesto*, *trabajo*,
  *factura*, *cliente*, *cuadrilla* for crew; screen words from the `es`
  block of the catalogue.
- Numbers, money and product names are identical in all three.

## Videos

Do not add videos in the module. `content/help/videos.json`, keyed by slug,
is the owner's file; the build merges it.

## Check your work

```sh
npm run check:help-centre -- --only=<category>     # your category only
npm run build:help                             # copies figures, rebuilds the index and TREE.md
```

The full `npm run check:help-centre` (no `--only`) is what gates the build; it
fails until every category is written in all three languages.
