// scripts/build-sales-guide.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/build-sales-guide.mjs en          # HTML only
//   node --import ./scripts/alias-loader.mjs scripts/build-sales-guide.mjs en --pdf    # + Chrome print
//   npm run build:sales-guide                                                          # en fr es, PDFs
//
// Builds the sales reference guide as HTML, then (with --pdf) prints it through
// headless Chrome to docs/sales/guide/build/FieldQuo-Sales-Guide-<LANG>.pdf.
//
// ══ Why it is generated and not written ═══════════════════════════════════
//
// A sales guide is a promise a rep repeats on a call, so the expensive failure
// is not a typo — it is a feature described here that the product does not
// have, or a limit that has quietly stopped being true. Both happen the moment
// a document is maintained by hand beside a codebase that keeps moving.
//
// So the FEATURES come from lib/marketing/featureMatrix.js and nowhere else.
// That module is proof-carrying: every entry names the files and exports that
// must exist for it, and scripts/check-feature-matrix.mjs fails the build when
// one does not. A feature cannot appear in this PDF unless it exists in the
// code, and its "what it does not do" sentence is the product's own.
//
// The prose lives in docs/sales/guide/content.<lang>.js — sentences only, no
// markup, so a translator is handed language rather than HTML.
//
// ══ Navigable, because it is a reference ══════════════════════════════════
//
// Nobody reads this cover to cover. Every section is an anchor, the contents
// links to all of them, every feature name in a deep dive links to its row in
// the table, and each section links back. Chrome carries internal anchors into
// the PDF, so the links work in the file a rep opens on a phone in a car park.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

import { FEATURE_MATRIX, MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { FEATURE_PAGE_MESSAGES } from "@/app/i18n/featurePages/index.js";
import { MESSAGES } from "@/app/i18n/messages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { PERMISSION_PRESETS, PERMISSION_CATEGORIES, PERMISSION_TOGGLES, PRESET_TO_ROLE } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions/roleManagement";
import { navRowAllowed } from "@/lib/permissions/nav";
import { canSeeSettingsRow, SETTINGS_ROW_CAPABILITY } from "@/lib/permissions/settingsAccess";
import { SCREENS } from "../docs/screens/app-guide/harness/screens.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const wantPdf = argv.includes("--pdf");
const lang = (argv.find((a) => !a.startsWith("--")) || "en").toLowerCase();
const contentPath = join(ROOT, "docs/sales/guide", `content.${lang}.js`);
if (!existsSync(contentPath)) {
  console.error(`No content module for "${lang}" — expected docs/sales/guide/content.${lang}.js`);
  process.exit(1);
}
const { GUIDE, DEEP_DIVES, CONSOLE_SECTIONS = [], SCREENS_CHAPTER, ROLES_CHAPTER } = await import(contentPath);

// ══ A translation is the same shape as the English, or the build fails ═══
//
// The manual's builder refuses an unknown label key; this guide has no label
// keys, so the equivalent promise is structural: every key the English
// content module carries must exist in the module being built, and every
// screen in screens.js must have its paragraph. A French guide that quietly
// printed an English sentence where the French one was never written is the
// failure this guards — it was found once already, in the feature names.
if (lang !== "en") {
  const en = await import(join(ROOT, "docs/sales/guide", "content.en.js"));
  const missing = [];
  const walk = (a, b, path) => {
    if (a && typeof a === "object" && !Array.isArray(a)) {
      for (const k of Object.keys(a)) {
        if (b == null || !(k in b)) missing.push(`${path}.${k}`);
        else walk(a[k], b[k], `${path}.${k}`);
      }
    } else if (Array.isArray(a) && a.length && a[0] && typeof a[0] === "object" && !Array.isArray(a[0])) {
      // Lists of objects: matched by `id`/`key` when the items carry one
      // (deep dives, roles), so a section the translator never wrote is
      // named; the glossary is sorted per language and may carry an extra
      // local term, so it is only required not to be shorter.
      if (!Array.isArray(b)) { missing.push(`${path}[none]`); return; }
      const ident = (x) => x?.id ?? x?.key ?? null;
      if (a.every((x) => ident(x) !== null)) {
        for (const item of a) {
          const hit = b.find((y) => ident(y) === ident(item));
          if (!hit) missing.push(`${path}[${ident(item)}]`);
          else walk(item, hit, `${path}[${ident(item)}]`);
        }
      } else if (b.length < a.length) {
        missing.push(`${path}[length ${a.length} vs ${b.length}]`);
      }
    } else if (typeof a === "string" && (typeof b !== "string" || !b.trim())) {
      missing.push(path);
    }
  };
  walk(en.GUIDE, GUIDE, "GUIDE");
  walk(en.SCREENS_CHAPTER, SCREENS_CHAPTER, "SCREENS_CHAPTER");
  walk(en.ROLES_CHAPTER, ROLES_CHAPTER, "ROLES_CHAPTER");
  if (missing.length) {
    console.error(`${lang}: content.${lang}.js is missing ${missing.length} key(s) the English has — an untranslated sentence is not an omission the PDF may hide:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
}

// ══ Where the non-prose strings come from ═════════════════════════════════
//
// The group headings and each partial feature's "what it does not do" sentence
// are NOT in the content module, and deliberately so: they are pinned to
// lib/marketing/featureMatrix.js, and app/i18n/featurePages/ already carries a
// reviewed translation of both in nine languages — the same strings a French
// reader is already shown on fieldquo.com/features. Re-translating them here
// would produce a second French wording of a caveat, which is the one place a
// second wording does real damage. So this reads the shipped catalogue, and
// falls back to the matrix's English rather than inventing anything.
//
// The same is true of every feature NAME and SUMMARY: app/i18n/messages.js
// carries all 76 in nine languages, pinned character-for-character to the
// matrix in English by check:feature-pages. The first FR/ES build printed them
// in English because nobody looked — the translation was there the whole time.
const CATALOGUE = { ...(FEATURE_PAGE_MESSAGES[lang] || {}), ...(MESSAGES[lang] || {}) };
const translated = (key) => (typeof CATALOGUE[key] === "string" ? CATALOGUE[key] : null);
const nameOf = (f) => translated(`feature.${f.key}.name`) || f.name;
const summaryOf = (f) => translated(`feature.${f.key}.summary`) || f.summary;

// ══ What the PDF deliberately does NOT carry ══════════════════════════════
//
// The matrix's `readiness` and `limits` are not rendered. The owner's call,
// and a defensible one: a caveat in a sales guide is a promise to fix nothing,
// whereas a caveat in docs/OPEN-WORK-APP.md is a job. So the "what it does not
// do" sentences go to the owner as a game plan, and the guide describes the
// product as the matrix proves it to be. If a limit is real and unfixable it
// belongs in the matrix summary itself, where the public site shows it too.

/** Escape for HTML text. Every string below is authored, but none is trusted. */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const byKey = new Map(FEATURE_MATRIX.map((f) => [f.key, f]));
const partials = FEATURE_MATRIX.filter((f) => f.readiness !== "shipped");
if (partials.length) {
  console.log(
    `${lang}: ${partials.length} matrix entries are still marked partial and are rendered without a badge — ` +
      `their caveats are tracked in docs/OPEN-WORK-APP.md, not here: ${partials.map((f) => f.key).join(", ")}`,
  );
}

/** Screenshots are optional. A missing one omits its figure rather than
 *  printing a broken image — the guide has to be shippable before somebody
 *  has logged in to capture them. */
const shotsDir = join(ROOT, "docs/sales/guide/shots");
const figure = (file, caption) => {
  if (!existsSync(file)) return "";
  const b64 = readFileSync(file).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`;
};
const shot = (name, caption) => figure(join(shotsDir, `${name}.png`), caption);

// ══ The rep's own tools are a second list, not more deep dives ════════════
//
// DEEP_DIVES describe the PRODUCT — what a contractor buys — and every one
// of them is chained to the feature matrix through its `keys`. The console,
// the batch, the incoming-call drawer, Texts, Team and Pay are not features
// FieldQuo sells; they are the room the rep works in, and nothing in the
// matrix proves them. So they are a separate list with no `keys`, no chips,
// and their own heading, and their proof is a different kind: the screens
// under docs/screens/sales-console and docs/screens/sales-messages are the
// REAL components rendered against fixtures, so a section may carry one as
// its figure (`shot`, a path from the repo root). The image is the claim's
// evidence in the same way a feature key is — a paragraph that describes a
// control the frame does not show is the thing to catch in review.
const consoleSections = Array.isArray(CONSOLE_SECTIONS) ? CONSOLE_SECTIONS : [];

const featureRow = (f) => `
  <tr id="f-${esc(f.key)}">
    <td class="fname">${esc(nameOf(f))}</td>
    <td>${esc(summaryOf(f))}</td>
  </tr>`;

const sections = [
  { id: "pitch", title: GUIDE.pitchHeading },
  { id: "plans", title: GUIDE.plansHeading },
  { id: "deep", title: GUIDE.deepHeading },
  ...DEEP_DIVES.map((d) => ({ id: d.id, title: d.title, sub: true })),
  ...(consoleSections.length ? [{ id: "console", title: GUIDE.consoleHeading }] : []),
  ...consoleSections.map((d) => ({ id: d.id, title: d.title, sub: true })),
  ...(SCREENS_CHAPTER ? [
    { id: "screens", title: SCREENS_CHAPTER.heading },
    { id: "screens-rail", title: SCREENS_CHAPTER.railHeading, sub: true },
    { id: "screens-settings", title: SCREENS_CHAPTER.settingsHeading, sub: true },
  ] : []),
  ...(ROLES_CHAPTER ? [{ id: "roles", title: ROLES_CHAPTER.heading }] : []),
  { id: "reference", title: GUIDE.referenceHeading },
  { id: "glossary", title: GUIDE.glossaryHeading },
];

// ══ "Every screen": one figure per sidebar row, resolved live-first ══════
//
// The rows come from docs/screens/app-guide/harness/screens.js — the same
// list the capture harness renders, in the order the two sidebars draw them.
// Each row's TITLE is the sidebar label in the language being built, read
// from app/i18n/appMessages.js (a missing translation fails the build, the
// way the manual's label lookup does); the paragraph is the content module's.
//
// The figure is resolved in this order:
//   1. docs/screens/live/app/<lang>/<route-slug>.png — a capture of the
//      owner's real signed-in session (route-slug: the href without its
//      leading slash, "/" → "-"; /app/settings/branding → app-settings-branding);
//   2. docs/screens/app-guide/<lang>/NN-<slug>.png — the harness render of
//      the real component against the fixture company.
// So the PDFs rebuild with one command the moment live files land, and a
// screen nobody has captured live still ships as a real render. A figure
// with NEITHER fails the build: a "screenshot to follow" box in a guide the
// rep hands a contractor reads as a screen that does not exist.
const APP_CAT = APP_MESSAGES[lang] || {};
const screenTitle = (row) => {
  const v = APP_CAT[row.nav];
  if (typeof v !== "string" || !v.trim()) {
    console.error(`${lang}: sidebar label ${row.nav} has no ${lang} string in app/i18n/appMessages.js`);
    process.exit(1);
  }
  return v;
};
const routeSlug = (href) => href.replace(/^\//, "").replace(/\//g, "-");
const harnessDir = join(ROOT, "docs/screens/app-guide", lang);
const harnessFiles = existsSync(harnessDir) ? readdirSync(harnessDir) : [];
const figureFile = (row) => {
  const live = join(ROOT, "docs/screens/live/app", lang, `${routeSlug(row.href)}.png`);
  if (!row.chapter && existsSync(live)) return { file: live, source: "live" };
  const hit = harnessFiles.find((f) => /^\d+-/.test(f) && f.slice(f.indexOf("-") + 1) === `${row.slug}.png`);
  return hit ? { file: join(harnessDir, hit), source: "harness" } : null;
};
const figureSources = { live: 0, harness: 0 };
const missingFigures = [];
const screenFigure = (row, caption) => {
  const f = figureFile(row);
  if (!f) { missingFigures.push(`${row.slug} (${lang})`); return ""; }
  figureSources[f.source]++;
  return figure(f.file, caption);
};

// ══ "What opens when you press …": the Create captures ═══════════════════
//
// docs/screens/live/actions/<lang>/<route-slug>-create.png is what the
// owner's session showed after pressing a list page's primary New / Add /
// Create button. The language folder is tried first and English second —
// a real capture of the real form in English is still the form, and the
// caption says which button it is in the reader's language, looked up from
// the same catalogue as the sidebar labels.
const CREATE_BUTTON_KEY = {
  quotes: "app.quotes.new", invoices: "app.invoices.new", jobs: "app.jobs.new", tasks: "app.tasks.new",
  calendar: "app.appts.new", plans: "app.plans.new", clients: "app.clients.new", subcontractors: "app.subcontractors.add",
  fleet: "app.fleet.add", purchasing: "app.purchasing.orders.new", marketing: "app.marketing.newCampaign", funnels: "app.funnels.new",
  team: "app.setTeam.addUser", "settings-team": "app.setTeam.addUser", "settings-services": "app.setServices.addCustomType",
  "settings-products": "app.setProducts.addItem", "settings-pdf-templates": "app.pdfTemplates.newButton",
  "settings-checklists": "app.setChecklists.new", "settings-bio-link": "app.setBioLink.addCustom",
};
const createFigure = (row, title) => {
  const key = CREATE_BUTTON_KEY[row.slug];
  if (!key) return "";
  const name = `${routeSlug(row.href)}-create.png`;
  const file = [lang, "en"].map((l) => join(ROOT, "docs/screens/live/actions", l, name)).find(existsSync);
  if (!file) return "";
  const button = APP_CAT[key] || APP_MESSAGES.en[key] || key;
  const caption = (SCREENS_CHAPTER.createCaption || "{title} — {button}").replace("{title}", title).replace("{button}", button);
  figureSources.create = (figureSources.create || 0) + 1;
  return figure(file, caption);
};

function screensChapterHtml() {
  if (!SCREENS_CHAPTER) return "";
  const rows = SCREENS.filter((r) => !r.chapter);
  const part = (id, heading, list) => `
  <h3 id="${id}" class="part">${esc(heading)}</h3>
  ${list.map((row) => {
    const entry = SCREENS_CHAPTER.items[row.slug];
    if (!entry || !Array.isArray(entry.body) || !entry.body.length) {
      console.error(`${lang}: SCREENS_CHAPTER.items.${row.slug} is missing from content.${lang}.js`);
      process.exit(1);
    }
    const title = screenTitle(row);
    // A row that is the same page as an earlier row (Team appears in the
    // main rail and under Settings) still gets its own figure and its own
    // sentences: a reader arrives from the sidebar they are looking at.
    return `
  <section id="s-${esc(row.slug)}" class="screen">
    <h4>${esc(title)}<span class="path">${esc(row.href)}</span></h4>
    ${entry.body.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
    ${screenFigure(row, `${title} — ${row.href}`)}
    ${createFigure(row, title)}
  </section>`;
  }).join("\n")}`;
  return `
<section id="screens">
  <h2>${esc(SCREENS_CHAPTER.heading)}</h2>
  ${SCREENS_CHAPTER.intro.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${part("screens-rail", SCREENS_CHAPTER.railHeading, rows.filter((r) => !r.slug.startsWith("settings-")))}
  ${part("screens-settings", SCREENS_CHAPTER.settingsHeading, rows.filter((r) => r.slug.startsWith("settings-")))}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`;
}

// ══ "Roles and access": tables executed from the permission code ══════════
//
// Nothing in these tables is typed by hand. The five people a contractor can
// create are the four presets in lib/permissions.js plus the owner; each is
// run through the SAME functions the sidebar uses to hide a row
// (lib/permissions/nav.js navRowAllowed, lib/permissions/settingsAccess.js
// canSee) so a cell says what the product does, and changes when it does.
// The grid table reads PERMISSION_PRESETS directly. The category, level and
// preset labels are the product's own strings — untranslated in the product
// too (app/components/team/AccessEditor.js prints cat.label and lvl.label),
// so a French reader sees here exactly what they see on the screen.
const ROLE_MEMBERS = [
  { key: "worker", label: PERMISSION_PRESETS.worker.label, member: { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values } },
  { key: "estimator", label: PERMISSION_PRESETS.estimator.label, member: { role: PRESET_TO_ROLE.estimator, permissions: PERMISSION_PRESETS.estimator.values } },
  { key: "dispatcher", label: PERMISSION_PRESETS.dispatcher.label, member: { role: PRESET_TO_ROLE.dispatcher, permissions: PERMISSION_PRESETS.dispatcher.values } },
  { key: "manager", label: PERMISSION_PRESETS.manager.label, member: { role: PRESET_TO_ROLE.manager, permissions: PERMISSION_PRESETS.manager.values } },
  { key: "owner", label: ROLE_LABELS.owner, member: { role: "owner", permissions: null } },
];
const roleSees = (row, rm) => {
  if (row.slug.startsWith("settings-") || row.settings) {
    // A settings row is gated twice: the main rail's rule for the rows that
    // also sit there (Team, Timesheets, Expenses, Refer, Plan), and the
    // settings sidebar's capability for every settings row.
    // canSeeSettingsRow is what SettingsSidebar filters with: the role's
    // capability AND the row's grid requirement (showPricing for the price
    // book, expenses:view_record_edit_all for the roll-up). A main-rail key
    // (app.nav.team) has no settings capability, so only its nav rule applies.
    const navOk = navRowAllowed(row.nav, rm.member);
    const settingsOk = SETTINGS_ROW_CAPABILITY[row.nav]
      ? canSeeSettingsRow({ role: rm.member.role, impersonation: false }, row.nav, rm.member)
      : true;
    return navOk && settingsOk;
  }
  return navRowAllowed(row.nav, rm.member);
};

function rolesChapterHtml() {
  if (!ROLES_CHAPTER) return "";
  const R = ROLES_CHAPTER;
  const yes = `<span class="yes">${esc(R.yes)}</span>`;
  const no = `<span class="no">${esc(R.no)}</span>`;
  const rows = SCREENS.filter((r) => !r.chapter && !r.sameAs);
  const seesTable = `
  <table class="roles"><thead><tr><th>${esc(R.screenCol)}</th>${ROLE_MEMBERS.map((rm) => `<th>${esc(rm.label)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((row) => `<tr><td class="fname">${esc(screenTitle(row))}</td>${ROLE_MEMBERS.map((rm) => `<td class="c">${roleSees(row, rm) ? yes : no}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const presets = ROLE_MEMBERS.filter((rm) => rm.key !== "owner");
  const levelLabel = (catKey, value) => PERMISSION_CATEGORIES[catKey].levels.find((l) => l.value === value)?.label || value;
  const gridTable = `
  <table class="roles grid"><thead><tr><th>${esc(R.areaCol)}</th>${presets.map((rm) => `<th>${esc(rm.label)}</th>`).join("")}</tr></thead>
  <tbody>
  ${Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => `<tr><td class="fname">${esc(cat.label)}</td>${presets.map((rm) => `<td>${esc(levelLabel(catKey, rm.member.permissions[catKey]))}</td>`).join("")}</tr>`).join("")}
  ${Object.keys(PERMISSION_TOGGLES).map((tog) => `<tr><td class="fname">${esc(R.toggleNames[tog] || tog)}</td>${presets.map((rm) => `<td class="c">${rm.member.permissions[tog] ? yes : no}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
  const editorRow = SCREENS.find((r) => r.slug === "access-editor");
  const roleCards = R.roles.map((role) => {
    const rm = ROLE_MEMBERS.find((x) => x.key === role.key);
    const tier = rm.key === "owner" ? "" : ` <span class="tier">${esc(R.tierNote.replace("{tier}", ROLE_LABELS[rm.member.role]))}</span>`;
    return `<h3 id="role-${esc(role.key)}">${esc(rm.label)}${tier}</h3>${role.body.map((p) => `<p>${esc(p)}</p>`).join("")}${rm.key === "owner" ? "" : `<p class="desc">${esc(R.productSays)} “${esc(PERMISSION_PRESETS[rm.key].description)}”</p>`}`;
  }).join("\n");
  return `
<section id="roles">
  <h2>${esc(R.heading)}</h2>
  ${R.intro.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${roleCards}
  <h3 id="roles-sees">${esc(R.seesHeading)}</h3>
  ${R.seesIntro.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${seesTable}
  <h3 id="roles-grid">${esc(R.gridHeading)}</h3>
  ${R.gridIntro.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${gridTable}
  <h3 id="roles-editor">${esc(R.editorHeading)}</h3>
  ${R.editorBody.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${editorRow ? screenFigure(editorRow, R.editorCaption) : ""}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`;
}

const html = `<!doctype html>
<html lang="${esc(GUIDE.lang)}" dir="${esc(GUIDE.dir)}">
<head><meta charset="utf-8"><title>${esc(GUIDE.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.55 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1a1d23; margin: 0; }
  h1 { font-size: 30pt; line-height: 1.1; margin: 0 0 6pt; letter-spacing: -0.02em; }
  h2 { font-size: 17pt; margin: 26pt 0 8pt; letter-spacing: -0.01em; page-break-after: avoid; border-top: 2px solid #c2410c; padding-top: 9pt; }
  h3 { font-size: 12.5pt; margin: 18pt 0 5pt; page-break-after: avoid; color: #0f172a; }
  p { margin: 0 0 8pt; }
  a { color: #c2410c; text-decoration: none; }
  .cover { page-break-after: always; padding-top: 55mm; }
  .cover .sub { font-size: 13pt; color: #475569; margin-top: 4pt; }
  .cover .meta { margin-top: 26pt; font-size: 9pt; color: #64748b; }
  .rule { height: 3px; background: #c2410c; width: 64px; margin: 16pt 0; }
  .toc { page-break-after: always; }
  .toc ol { list-style: none; padding: 0; margin: 0; counter-reset: s; }
  .toc li { padding: 4pt 0; border-bottom: 1px dotted #cbd5e1; }
  .toc li.sub { padding-left: 16pt; border-bottom: none; font-size: 9.5pt; }
  .toc a { display: flex; justify-content: space-between; gap: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 9.5pt; }
  th { text-align: left; background: #f1f5f9; padding: 5pt 6pt; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
  td { padding: 5pt 6pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.fname { font-weight: 600; width: 33%; }
  .callout { border-left: 3px solid #c2410c; background: #fff7ed; padding: 9pt 11pt; margin: 10pt 0 14pt; }
  .chips a { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px; padding: 1.5pt 6pt; margin: 0 3pt 3pt 0; font-size: 8.5pt; }
  .back { font-size: 8pt; color: #94a3b8; margin-top: 4pt; }
  figure { margin: 10pt 0; page-break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; }
  figcaption { font-size: 8.5pt; color: #64748b; margin-top: 3pt; }
  section { page-break-inside: auto; }
  dt { font-weight: 600; margin-top: 8pt; }
  dd { margin: 2pt 0 0; color: #334155; }
  h3.part { font-size: 14pt; margin-top: 22pt; border-top: 1px solid #e2e8f0; padding-top: 10pt; }
  section.screen { page-break-inside: avoid; margin-top: 10pt; }
  section.screen h4 { font-size: 11.5pt; margin: 12pt 0 4pt; page-break-after: avoid; color: #0f172a; }
  section.screen h4 .path { font: 8.5pt Menlo, Consolas, monospace; color: #94a3b8; margin-left: 8pt; font-weight: normal; }
  /* Live captures are full-page and can be 2000px tall; a figure taller than
     the page overflows it. Crop to the top screenful rather than shrink to
     a postage stamp — the top is the part the caption describes. */
  section.screen figure img { width: 100%; max-height: 150mm; object-fit: cover; object-position: top; }
  table.roles { font-size: 8.5pt; }
  table.roles td.c { text-align: center; }
  table.roles.grid td { font-size: 8pt; }
  .yes { color: #15803d; font-weight: 600; }
  .no { color: #b91c1c; }
  .tier { font-size: 9pt; color: #64748b; font-weight: normal; margin-left: 6pt; }
  p.desc { color: #475569; font-style: italic; }
</style></head>
<body>

<div class="cover">
  <div class="rule"></div>
  <h1>${esc(GUIDE.title)}</h1>
  <p class="sub">${esc(GUIDE.subtitle)}</p>
  <p class="meta">${esc(
    (GUIDE.coverMeta || "{date} · {features}")
      .replace("{date}", new Date().toISOString().slice(0, 10))
      .replace("{features}", String(FEATURE_MATRIX.length)),
  )}</p>
</div>

<nav class="toc">
  <h2 id="contents">${esc(GUIDE.contentsHeading)}</h2>
  <ol>
    ${sections.map((s) => `<li class="${s.sub ? "sub" : ""}"><a href="#${esc(s.id)}"><span>${esc(s.title)}</span></a></li>`).join("\n    ")}
  </ol>
</nav>

<section id="intro">
  <h2>${esc(GUIDE.intro.heading)}</h2>
  ${GUIDE.intro.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
</section>

<section id="pitch">
  <h2>${esc(GUIDE.pitchHeading)}</h2>
  <div class="callout">${GUIDE.pitch.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
</section>

<section id="plans">
  <h2>${esc(GUIDE.plansHeading)}</h2>
  <p>${esc(GUIDE.plansIntro)}</p>
  <table><thead><tr>
    <th>${esc(GUIDE.planCols.plan)}</th><th>${esc(GUIDE.planCols.price)}</th>
    <th>${esc(GUIDE.planCols.seats)}</th><th>${esc(GUIDE.planCols.crew)}</th></tr></thead>
    <tbody>${SEAT_LADDER.map((t) => `<tr><td class="fname">${esc(t.label)}</td><td>$${t.price}</td><td>${t.seats}</td><td>${t.crewSeats}</td></tr>`).join("")}</tbody>
  </table>
  <p>${esc(GUIDE.planNote)}</p>
</section>

<section id="deep">
  <h2>${esc(GUIDE.deepHeading)}</h2>
  <p>${esc(GUIDE.deepIntro)}</p>
</section>

${DEEP_DIVES.map((d) => `
<section id="${esc(d.id)}">
  <h3>${esc(d.title)}</h3>
  ${d.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${shot(d.id, d.title)}
  <p class="chips">${d.keys.map((k) => byKey.get(k)).filter(Boolean)
      .map((f) => `<a href="#f-${esc(f.key)}">${esc(nameOf(f))}</a>`).join("")}</p>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`).join("\n")}

${consoleSections.length ? `
<section id="console">
  <h2>${esc(GUIDE.consoleHeading)}</h2>
  ${(GUIDE.consoleIntro || []).map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
</section>

${consoleSections.map((d) => `
<section id="${esc(d.id)}">
  <h3>${esc(d.title)}</h3>
  ${d.body.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  ${d.shot ? figure(join(ROOT, d.shot), d.shotCaption || d.title) : ""}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>`).join("\n")}` : ""}

${screensChapterHtml()}

${rolesChapterHtml()}

<section id="reference">
  <h2>${esc(GUIDE.referenceHeading)}</h2>
  <p>${esc(GUIDE.referenceIntro)}</p>
  ${MATRIX_GROUPS.map((g) => `
  <h3>${esc(translated(`featureGroup.${g.key}.label`) || g.label)}</h3>
  <p>${esc(translated(`featureGroup.${g.key}.blurb`) || g.blurb)}</p>
  <table><tbody>
  ${FEATURE_MATRIX.filter((f) => f.group === g.key).map(featureRow).join("")}
  </tbody></table>`).join("\n")}
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

<section id="glossary">
  <h2>${esc(GUIDE.glossaryHeading)}</h2>
  <p>${esc(GUIDE.glossaryIntro)}</p>
  <dl>${(GUIDE.glossary || []).map((g) => `<dt id="g-${esc(g.term.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(g.term)}</dt><dd>${esc(g.def)}${g.key && byKey.get(g.key) ? ` <a href="#f-${esc(g.key)}">${esc(GUIDE.seeAlso)} ${esc(nameOf(byKey.get(g.key)))}</a>` : ""}</dd>`).join("")}</dl>
  <p class="back"><a href="#contents">${esc(GUIDE.backToContents)}</a></p>
</section>

</body></html>`;

const outDir = join(ROOT, "docs/sales/guide/build");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `fieldquo-sales-guide.${lang}.html`);
writeFileSync(out, html);
const englishNames = FEATURE_MATRIX.filter((f) => lang !== "en" && nameOf(f) === f.name).map((f) => f.key);
console.log(`${lang}: ${FEATURE_MATRIX.length} features, ${DEEP_DIVES.length} deep dives, ${consoleSections.length} console sections`);
const missingShots = consoleSections.filter((d) => d.shot && !existsSync(join(ROOT, d.shot))).map((d) => d.shot);
if (missingShots.length) console.log(`${lang}: figures named but not found (omitted): ${missingShots.join(", ")}`);
if (englishNames.length) console.log(`${lang}: feature names still English: ${englishNames.join(", ")}`);
if (SCREENS_CHAPTER) console.log(`${lang}: screen figures — ${figureSources.live} live, ${figureSources.harness} harness render, ${figureSources.create || 0} create screens`);
if (missingFigures.length) {
  console.error(`${lang}: ${missingFigures.length} screen(s) have no figure at all (no live capture, no harness render): ${missingFigures.join(", ")}`);
  process.exit(1);
}
console.log(`wrote ${out}`);

// ══ PDF ═══════════════════════════════════════════════════════════════════
//
// Same Chrome invocation as scripts/build-sales-manual.mjs, same CHROME_BIN
// override. The page count is read back and printed so a rebuild that lost
// a chapter is noticed at the terminal, not by a rep.
if (wantPdf) {
  const CHROME =
    process.env.CHROME_BIN ||
    ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  if (!CHROME) { console.error("No Chrome found — set CHROME_BIN"); process.exit(1); }
  const pdf = join(outDir, `FieldQuo-Sales-Guide-${lang.toUpperCase()}.pdf`);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000",
    `--print-to-pdf=${pdf}`, `file://${out}`,
  ], { stdio: ["ignore", "ignore", "ignore"], timeout: 300000 });
  const pages = (readFileSync(pdf, "latin1").match(/\/Type\s*\/Page(?![s])/g) || []).length;
  console.log(`${lang}: printed ${pdf} — ${pages} pages`);
}
