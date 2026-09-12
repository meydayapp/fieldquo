You are writing articles for FieldQuo's public help centre (help.fieldquo.com), in /Users/emilioboves/StudioProjects/fieldquo (Next.js 16). You own EXACTLY the three part files named below (en, fr, es) and nothing else.

HARD RULES
- Never run any git command. Never edit any file other than your three part files. Never touch lib/help/tree.js, the composer files (content/help/<lang>/<category>.js), other parts, or app code. If you think the tree is wrong, say so in your final report; do not change it.
- Every sentence must be true of the code TODAY. Read the page module (app/app/**/page.js), the API it calls, and the lib/** rule before you describe a control. Do not describe features that do not exist. "FieldQuo does not do X" is a good sentence. A feature marked `partial` in lib/marketing/featureMatrix.js must carry its `limits` caveat.
- Use only figure references that exist. List them with:
  node -e 'import("./scripts/help-figure-sources.mjs").then(m=>console.log(m.availableFigures().join("\n")))'
  (live:<route-slug>, create:<route-slug>-create, harness:<slug>). Do not invent a figure. A screen with no capture gets no figure.
- The words on the screen come from app/i18n/appMessages.js (the `en`, `fr`, `es` blocks) — grep the catalogue for the label; the French label of a button is the catalogue's French string, not your own.
- No HTML, no markdown links, no URLs. Only **bold** and [[slug|text]] (slug must exist in lib/help/tree.js).

FIRST, read these in full: content/help/WRITING.md (the shape, the anatomy, the language register, the check), then content/help/en/invoices-and-payments-2.js (the model article — match its depth, tone and structure), then lib/help/tree.js (the meta of your slugs: screen, feature, only, related), then docs/sales/guide/content.en.js SCREENS_CHAPTER.items + ROLES_CHAPTER (fact source, EN/FR/ES versions exist in content.fr.js / content.es.js — reuse the facts and screen vocabulary, rewrite for the contractor reading it, never copy the sales-rep phrasing like "say that on every call").

THE ARTICLE (per slug): title, summary (one sentence), updated: "2026-09-12", intro (1–2 paragraphs), 3–7 sections with lowercase-hyphen ids (never "faq"), blocks {p} {steps} {bullets} {note} {tip} {warning} {figure, caption} {table}, and a faq (2–4 q/a) on the substantial ones. Aim for 350–700 words in English per article: an Overview, what is on the screen (the real words), how-to steps with a figure when a capture exists, what each control/toggle changes (every toggle has a consequence — say it), who can see it (the access level from lib/permissions.js / lib/permissions/nav.js / lib/permissions/settingsAccess.js), FAQ. Mark "Only in FieldQuo" articles by saying, factually, what the product does that the other tools do not — from lib/marketing/featureMatrix.js and lib/marketing/parity.js (neverListed), never by assertion.

THREE LANGUAGES, ONE STRUCTURE: write the English first, then the French (Quebec register, vous, soumission/chantier/courriel/texto, « guillemets », labels from the fr catalogue block) and the Spanish (neutral Latin-American, usted, presupuesto/trabajo/factura/cuadrilla, labels from the es block). French and Spanish must mirror the English EXACTLY in structure: same slugs, same section ids in order, same block kinds in order, same figure refs, same counts of steps/bullets/table rows/FAQ entries. Content is a real translation of the same facts, not a word-for-word one. Numbers and product names identical.

FILE SHAPE: each part file is
  // content/help/<lang>/<file>
  // (a short header comment)
  export const ARTICLES = { "slug": { ... }, ... };
Write ALL the slugs assigned to you, in the tree's order, in all three files.

CHECK before you finish (run from the repo root; it takes ~20 s):
  npm run check:help-centre -- --only=<category>
Section 3 must show your slugs as written in en/fr/es (other parts of the same category may still be unwritten — that is fine, but YOUR slugs must not be in the "missing" list), "fr and es mirror the English structure" must be ok, and "no English prose in the French or Spanish modules" must be ok. Section 4 "every figure reference is answered" must be ok. Fix until they pass. Also run `node --check content/help/en/<file>` (and fr, es) to be sure the modules parse.

FINAL REPORT (keep it short): the slugs written, any figure you wished existed (name the screen), any fact you could not establish from the code and therefore left out, and anything in the tree you believe is wrong.
