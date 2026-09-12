// scripts/check-help-centre.mjs
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-help-centre.mjs
//   npm run check:help-centre
//
// The public help centre (help.fieldquo.com, /help/*), held to its promises:
//
//   1. The tree (lib/help/tree.js) is sound: unique slugs, known categories,
//      `related` and `screen` resolve, `feature` names a real inventory key,
//      `only` is backed by an inventory key or by proof files that exist.
//   2. Coverage: every feature in lib/features/registry.js and
//      lib/marketing/featureMatrix.js has an article; every sidebar row of
//      the harness's screens.js has one; every sidebar row in
//      AdminSidebar / SettingsSidebar carries a helpArticle that resolves.
//   3. Content parity: every tree slug is written in en, fr AND es; no module
//      carries a slug the tree does not; French and Spanish mirror the English
//      STRUCTURE exactly (section ids, block kinds, figure refs, FAQ count)
//      and carry no English prose (a word-frequency heuristic, the same
//      family check:marketing-i18n uses).
//   4. Every figure reference is answered by a capture set, and the build
//      script's index has an entry per written article.
//   5. Chrome: every language carries every key, placeholders intact.
//   6. Routing: `help` is reserved; isHelpHost executed; the middleware's
//      help block precedes the impersonation gate and the /app session gate
//      (asserted from the SOURCE order); the sitemap is in the matcher; the
//      theme allow-lists include /help.
//   7. The feedback endpoint is EXECUTED through the db stub: rate-limited,
//      refuses a slug the tree does not know, and writes slug/lang/helpful
//      and nothing else; the Prisma model has no PII column.
//   8. Fallback language and video rendering: loadArticle("uk") serves the
//      English body and says so; videoEmbed handles the URL shapes the owner
//      will use; the page source renders the notice on the right condition.
//   9. Pure helpers executed: pickHelpLang, helpPath/helpCanonical,
//      swapLang, parseFigureRef.
//  10. The fees article's numbers are the constants in
//      lib/stripe/processingFee.js and lib/stripe/disputeRecovery.js.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HELP_LANGS, HELP_TREE, HELP_ARTICLES, HELP_CATEGORIES, REAL_CATEGORY_KEYS, articleMeta, articleForScreen, categoryOf } from "@/lib/help/tree";
import { HELP_CHROME, HELP_CHROME_LANGS, HELP_CHROME_KEYS, helpT } from "@/lib/help/chrome";
import { isHelpHost } from "@/lib/help/host";
import { helpPath, helpCanonical, figureSrc } from "@/lib/help/urls";
import { parseFigureRef } from "@/lib/help/figures";
import { pickHelpLang } from "@/lib/help/lang";
import { RESERVED_SUBDOMAINS, subdomainFromHost, validateSubdomain } from "@/lib/site/subdomain";
import { FEATURE_MATRIX } from "@/lib/marketing/featureMatrix";
import { FEATURE_KEYS } from "@/lib/features/registry";
import { SCREENS } from "../docs/screens/app-guide/harness/screens.js";
import { PROCESSING_RATES, INSTANT_PAYOUT_RATE, CARD_SURCHARGES, processingFeeCents, formatFeeCents } from "@/lib/stripe/processingFee";
import { DISPUTE_FEE_CENTS } from "@/lib/stripe/disputeRecovery";
import { resolveFigure } from "./help-figure-sources.mjs";
import { rows, writes, resetDbStub as reset } from "./fixtures/dbStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ONLY=<category> narrows the content sections (3, 4) to one category and
// skips the build run — for a writer checking their own module while the
// other categories are still being written. The full run is what gates.
const ONLY = process.env.ONLY || null;
const ARTS = ONLY ? HELP_ARTICLES.filter((a) => a.category === ONLY) : HELP_ARTICLES;
if (ONLY && !REAL_CATEGORY_KEYS.includes(ONLY)) {
  console.error(`ONLY=${ONLY} is not a category`);
  process.exit(1);
}

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? `  ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

// ── 1. The tree ────────────────────────────────────────────────────────────
section("1. The tree");
{
  const slugs = HELP_ARTICLES.map((a) => a.slug);
  ok("slugs are unique across categories", new Set(slugs).size === slugs.length);
  ok("every slug is url-safe", slugs.every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)));
  ok("every category in HELP_TREE is declared in HELP_CATEGORIES", Object.keys(HELP_TREE).every((k) => REAL_CATEGORY_KEYS.includes(k)));
  ok("every real category has articles", REAL_CATEGORY_KEYS.every((k) => (HELP_TREE[k] || []).length > 0));
  const badRelated = HELP_ARTICLES.flatMap((a) => (a.related || []).filter((r) => !articleMeta(r)).map((r) => `${a.slug} → ${r}`));
  ok("every `related` slug exists", badRelated.length === 0, badRelated.join(", "));
  const screenSlugs = new Set(SCREENS.filter((s) => !s.chapter).map((s) => s.slug));
  const badScreens = HELP_ARTICLES.filter((a) => a.screen && !screenSlugs.has(a.screen)).map((a) => `${a.slug}: ${a.screen}`);
  ok("every `screen` names a sidebar row in harness/screens.js", badScreens.length === 0, badScreens.join(", "));
  const inventory = new Set([...FEATURE_MATRIX.map((f) => f.key), ...FEATURE_KEYS]);
  const badFeatures = HELP_ARTICLES.filter((a) => a.feature && !inventory.has(a.feature)).map((a) => `${a.slug}: ${a.feature}`);
  ok("every `feature` is a featureMatrix or registry key", badFeatures.length === 0, badFeatures.join(", "));
  const badOnly = HELP_ARTICLES.filter((a) => a.only && !(a.feature && inventory.has(a.feature)) && !(Array.isArray(a.proof) && a.proof.length));
  ok("`only: true` is backed by an inventory key or proof files", badOnly.length === 0, badOnly.map((a) => a.slug).join(", "));
  const badProof = HELP_ARTICLES.flatMap((a) => (a.proof || []).filter((p) => !existsSync(join(ROOT, p))).map((p) => `${a.slug}: ${p}`));
  ok("every proof file exists", badProof.length === 0, badProof.join(", "));
  ok("virtual categories own no articles", !("only-in-fieldquo" in HELP_TREE) && !("videos" in HELP_TREE));
  ok(`the tree is in Jobber's range (${HELP_ARTICLES.length} articles, ≥ 300)`, HELP_ARTICLES.length >= 300);
}

// ── 2. Coverage ────────────────────────────────────────────────────────────
section("2. Coverage of the product");
{
  const used = new Set(HELP_ARTICLES.map((a) => a.feature).filter(Boolean));
  const uncoveredMatrix = FEATURE_MATRIX.map((f) => f.key).filter((k) => !used.has(k));
  ok("every featureMatrix entry has an article", uncoveredMatrix.length === 0, uncoveredMatrix.join(", "));
  const uncoveredRegistry = FEATURE_KEYS.filter((k) => !used.has(k));
  ok("every lib/features/registry.js feature has an article", uncoveredRegistry.length === 0, uncoveredRegistry.join(", "));
  const noArticle = SCREENS.filter((s) => !s.chapter).filter((s) => !articleForScreen(s.slug)).map((s) => s.slug);
  ok("every sidebar screen (harness/screens.js) has an article", noArticle.length === 0, noArticle.join(", "));

  const rowsOf = (file) => {
    const src = read(file);
    const out = [];
    for (const line of src.split("\n")) {
      const m = /\{ key: "(app\.(?:nav|settings)\.[A-Za-z]+)", href: "([^"]+)"(.*)\}/.exec(line);
      if (!m || /\.group\./.test(m[1])) continue;
      const h = /helpArticle: "([a-z0-9-]+)"/.exec(m[3]);
      out.push({ key: m[1], href: m[2], helpArticle: h ? h[1] : null });
    }
    return out;
  };
  const navRows = [...rowsOf("app/components/layout/AdminSidebar.js"), ...rowsOf("app/components/layout/SettingsSidebar.js")];
  ok(`the two sidebars were parsed (${navRows.length} rows)`, navRows.length >= 70);
  const noKey = navRows.filter((r) => !r.helpArticle).map((r) => r.key);
  ok("every sidebar row carries helpArticle", noKey.length === 0, noKey.join(", "));
  const dangling = navRows.filter((r) => r.helpArticle && !articleForScreen(r.helpArticle)).map((r) => `${r.key}: ${r.helpArticle}`);
  ok("every helpArticle resolves to an article", dangling.length === 0, dangling.join(", "));
  const guides = read("app/components/help/ScreenGuides.js");
  ok("/app/help renders the per-screen links from the sidebars' own arrays", guides.includes("articleForScreen(item.helpArticle)") && guides.includes("NAV_GROUPS") && guides.includes("SETTINGS_GROUPS"));
  ok("/app/help mounts ScreenGuides", read("app/app/help/page.js").includes("<ScreenGuides />"));
  ok("the marketing footer links the help centre", /href: "\/help"/.test(read("app/components/marketing/MarketingFooter.js")));
}

// ── 3. Content parity ──────────────────────────────────────────────────────
section("3. Content: every article in en, fr and es, same structure, no English leaking");
const modules = {};
for (const lang of HELP_LANGS) {
  modules[lang] = {};
  for (const category of REAL_CATEGORY_KEYS) {
    const mod = await import(join(ROOT, "content/help", lang, `${category}.js`));
    modules[lang][category] = mod.ARTICLES || {};
  }
}
const written = (lang, a) => modules[lang][a.category][a.slug];
{
  for (const lang of HELP_LANGS) {
    const missing = ARTS.filter((a) => !written(lang, a)).map((a) => a.slug);
    ok(`${lang}: every tree slug is written (${ARTS.length - missing.length}/${ARTS.length})`, missing.length === 0, missing.length > 12 ? `${missing.length} missing, e.g. ${missing.slice(0, 12).join(", ")}…` : missing.join(", "));
    const extra = REAL_CATEGORY_KEYS.flatMap((c) => Object.keys(modules[lang][c]).filter((s) => categoryOf(s) !== c).map((s) => `${c}/${s}`));
    ok(`${lang}: no module carries a slug the tree does not list there`, extra.length === 0, extra.join(", "));
  }

  const KINDS = ["p", "steps", "bullets", "note", "tip", "warning", "figure", "table"];
  const kindOf = (b) => KINDS.find((k) => k in (b || {})) || "?";
  const shape = (a) => ({
    sections: (a.sections || []).map((s) => ({ id: s.id, kinds: (s.blocks || []).map(kindOf), figures: (s.blocks || []).filter((b) => b.figure).map((b) => b.figure), steps: (s.blocks || []).map((b) => (b.steps || b.bullets || []).length), rows: (s.blocks || []).map((b) => (b.table?.rows || []).length) })),
    faq: (a.faq || []).length,
    intro: (a.intro || []).length,
  });
  const shapeProblems = [];
  const nonEmptyProblems = [];
  const strings = (a) => {
    const out = [a.title, a.summary, ...(a.intro || [])];
    for (const s of a.sections || []) {
      out.push(s.heading);
      for (const b of s.blocks || []) {
        for (const k of ["p", "note", "tip", "warning", "caption"]) if (typeof b[k] === "string") out.push(b[k]);
        for (const k of ["steps", "bullets"]) if (Array.isArray(b[k])) out.push(...b[k]);
        if (b.table) out.push(...(b.table.head || []), ...(b.table.rows || []).flat());
      }
    }
    for (const f of a.faq || []) out.push(f.q, f.a);
    return out;
  };
  for (const a of ARTS) {
    const en = written("en", a);
    if (!en) continue;
    if (!en.title || !en.summary || !/^\d{4}-\d{2}-\d{2}$/.test(en.updated || "") || !(en.sections || []).length) nonEmptyProblems.push(`en/${a.slug}: title, summary, updated (ISO) and sections are required`);
    const ids = (en.sections || []).map((s) => s.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => !/^[a-z0-9-]+$/.test(id) || id === "faq")) nonEmptyProblems.push(`en/${a.slug}: section ids must be unique, url-safe and not "faq"`);
    if (strings(en).some((s) => typeof s !== "string" || !s.trim())) nonEmptyProblems.push(`en/${a.slug}: an empty string`);
    for (const lang of ["fr", "es"]) {
      const x = written(lang, a);
      if (!x) continue;
      if (JSON.stringify(shape(x)) !== JSON.stringify(shape(en))) shapeProblems.push(`${lang}/${a.slug}`);
      if (strings(x).some((s) => typeof s !== "string" || !s.trim())) nonEmptyProblems.push(`${lang}/${a.slug}: an empty string`);
    }
  }
  ok("every written article has title, summary, ISO updated date, unique section ids and no empty strings", nonEmptyProblems.length === 0, nonEmptyProblems.slice(0, 8).join("; "));
  ok("fr and es mirror the English structure (section ids, block kinds, figures, list and table lengths, FAQ count)", shapeProblems.length === 0, shapeProblems.slice(0, 12).join(", "));

  // English-leak heuristic: the share of function words that are English.
  // A French or Spanish paragraph legitimately carries product names and the
  // words on the screen ("Settings → Payments" is quoted as the screen shows
  // it), so a sentence is flagged only when ENGLISH function words outnumber
  // the target language's own by a margin — the same idea as
  // check-marketing-i18n's word scan, tuned for prose.
  const EN = new Set(["the", "and", "with", "your", "you", "this", "that", "from", "for", "are", "is", "was", "were", "have", "has", "will", "when", "what", "which", "into", "than", "then", "there", "their", "they", "not", "but", "can", "does", "each", "every", "before", "after", "about"]);
  const OWN = {
    fr: new Set(["le", "la", "les", "des", "une", "un", "et", "est", "sont", "vous", "votre", "vos", "dans", "pour", "sur", "avec", "que", "qui", "pas", "ne", "ce", "cette", "ces", "au", "aux", "du", "en", "par", "plus", "chaque", "avant", "après"]),
    es: new Set(["el", "la", "los", "las", "un", "una", "y", "es", "son", "usted", "su", "sus", "en", "para", "con", "que", "no", "se", "al", "del", "por", "más", "cada", "antes", "después", "o", "como", "este", "esta", "esto"]),
  };
  const leaks = [];
  for (const lang of ["fr", "es"]) {
    for (const a of ARTS) {
      const x = written(lang, a);
      if (!x) continue;
      for (const s of strings(x)) {
        const words = s.toLowerCase().replace(/\[\[[a-z0-9-]+\|/g, " ").split(/[^a-zà-ÿ']+/).filter(Boolean);
        if (words.length < 8) continue;
        const enCount = words.filter((w) => EN.has(w)).length;
        const ownCount = words.filter((w) => OWN[lang].has(w)).length;
        if (enCount >= 3 && enCount > ownCount) leaks.push(`${lang}/${a.slug}: “${s.slice(0, 70)}…”`);
      }
      // Identical to English is the laziest leak of all.
      const en = written("en", a);
      if (en && x.title === en.title && x.summary === en.summary) leaks.push(`${lang}/${a.slug}: title and summary are the English`);
    }
  }
  ok("no English prose in the French or Spanish modules", leaks.length === 0, leaks.slice(0, 10).join("\n       "));
}

// ── 4. Figures and the build ───────────────────────────────────────────────
section("4. Figures and the generated index");
{
  ok("parseFigureRef accepts the three kinds and refuses the rest",
    parseFigureRef("live:app-quotes")?.publicName === "live-app-quotes" &&
    parseFigureRef("create:app-quotes-create")?.kind === "create" &&
    parseFigureRef("harness:settings-branding")?.kind === "harness" &&
    parseFigureRef("file:../etc/passwd") === null && parseFigureRef("live:App Quotes") === null && parseFigureRef("") === null);
  const bad = [];
  let count = 0;
  for (const lang of HELP_LANGS) for (const a of ARTS) {
    const x = written(lang, a);
    if (!x) continue;
    for (const s of x.sections || []) for (const b of s.blocks || []) if (b.figure) {
      count++;
      if (!resolveFigure(b.figure, lang)) bad.push(`${lang}/${a.slug}: ${b.figure}`);
    }
  }
  ok(`every figure reference is answered by a capture set (${count} references)`, bad.length === 0, bad.slice(0, 10).join(", "));
  ok("figureSrc points inside public/help/figures", figureSrc("fr", "live-app-quotes") === "/help/figures/fr/live-app-quotes.png");

  // Run the build once; it is what `npm run build` runs first.
  let built = true;
  if (!ONLY) {
    try {
      execFileSync("node", ["scripts/build-help-content.mjs"], { cwd: ROOT, stdio: "pipe" });
    } catch (e) {
      built = false;
      console.log(String(e.stdout || "") + String(e.stderr || ""));
    }
    ok("scripts/build-help-content.mjs runs clean", built);
  }
  const enIndexPath = join(ROOT, "public/help/search/en.json");
  const index = existsSync(enIndexPath) ? JSON.parse(readFileSync(enIndexPath, "utf8")) : [];
  const writtenEn = ARTS.filter((a) => written("en", a)).length;
  if (!ONLY) {
    ok(`the search index has one entry per written English article (${index.length})`, index.length === writtenEn && index.every((e) => e.slug && e.category && e.title && Array.isArray(e.headings)));
    for (const lang of HELP_CHROME_LANGS) ok(`search index exists for ${lang}`, existsSync(join(ROOT, "public/help/search", `${lang}.json`)));
  }
  const { FIGURE_SOURCES: figMap } = await import("../content/help/figures.generated.js");
  ok("figures.generated.js records a source language per copied figure", HELP_LANGS.every((l) => figMap[l] && Object.values(figMap[l]).every((v) => HELP_LANGS.includes(v))));
  ok("public/help is gitignored (figures are copies of docs/screens)", /^public\/help\/$/m.test(read(".gitignore")));
  ok("the loader index lists every language × category", HELP_LANGS.every((l) => REAL_CATEGORY_KEYS.every((c) => read("content/help/index.js").includes(`"${c}": () => ${"import"}("./${l}/${c}.js")`))));
}

// ── 5. Chrome ──────────────────────────────────────────────────────────────
section("5. Chrome in every language");
{
  for (const lang of HELP_CHROME_LANGS) {
    const dict = HELP_CHROME[lang];
    const missing = HELP_CHROME_KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
    ok(`${lang}: every chrome key`, missing.length === 0, missing.join(", "));
    const extra = Object.keys(dict).filter((k) => !HELP_CHROME_KEYS.includes(k));
    ok(`${lang}: no key English lacks`, extra.length === 0, extra.join(", "));
    const badVars = HELP_CHROME_KEYS.filter((k) => {
      const v = (HELP_CHROME.en[k].match(/\{[a-z]+\}/g) || []).sort().join();
      return v !== (String(dict[k] || "").match(/\{[a-z]+\}/g) || []).sort().join();
    });
    ok(`${lang}: placeholders preserved`, badVars.length === 0, badVars.join(", "));
    if (lang !== "en") {
      const same = HELP_CHROME_KEYS.filter((k) => k !== "nav.website" && dict[k] === HELP_CHROME.en[k] && HELP_CHROME.en[k].length > 12);
      ok(`${lang}: long strings are not the English`, same.length === 0, same.join(", "));
    }
  }
  ok("every category has a label and a blurb key", HELP_CATEGORIES.every((c) => HELP_CHROME_KEYS.includes(`category.${c.key}`) && HELP_CHROME_KEYS.includes(`blurb.${c.key}`)));
  const t = helpT("fr");
  ok("helpT substitutes placeholders", t("home.count", { n: 7 }) === "7 articles" && t("search.none", { q: "x" }).includes("« x »"));
  ok("helpT falls back to English for an unknown language", helpT("xx")("title") === "Help Centre");
}

// ── 6. Routing ─────────────────────────────────────────────────────────────
section("6. Routing: reserved host, middleware order, theme");
{
  ok("`help` is a reserved subdomain", RESERVED_SUBDOMAINS.has("help") && validateSubdomain("help").ok === false);
  ok("subdomainFromHost never treats the help host as a tenant", subdomainFromHost("help.fieldquo.com") === null && subdomainFromHost("help.localhost:3000") === null);
  ok("isHelpHost: the two platform spellings only",
    isHelpHost("help.fieldquo.com") && isHelpHost("HELP.fieldquo.com:443") && isHelpHost("help.localhost:3000") &&
    !isHelpHost("www.fieldquo.com") && !isHelpHost("help.sunset.fieldquo.com") && !isHelpHost("helpfieldquo.com") && !isHelpHost("") && !isHelpHost(null));
  const mw = read("middleware.js");
  const iHelp = mw.indexOf("if (isHelpHost(request.headers.get(\"host\")))");
  const iTenant = mw.indexOf("const subdomain = subdomainFromHost(");
  const iImp = mw.indexOf("const impersonationToken = request.cookies.get(IMPERSONATION_COOKIE)");
  const iApp = mw.indexOf("const sessionCookie = getSessionCookie(request);");
  ok("middleware: the help block exists", iHelp > 0);
  ok("middleware: the help block runs before the tenant rewrite", iHelp > 0 && iHelp < iTenant);
  ok("middleware: the help block runs before the impersonation gate", iHelp > 0 && iHelp < iImp);
  ok("middleware: the help block runs before the /app session gate", iHelp > 0 && iHelp < iApp);
  const helpBlock = mw.slice(iHelp, iTenant);
  ok("middleware: the help block rewrites to /help and lets /api and /_next through", helpBlock.includes("url.pathname = `/help${pathname === \"/\" ? \"\" : pathname}`") && helpBlock.includes("NextResponse.rewrite(url)") && helpBlock.includes("pathname.startsWith(\"/api\") || pathname.startsWith(\"/_next\")"));
  ok("middleware: a /help path on the help host redirects to its short spelling (308)", helpBlock.includes("pathname.slice(\"/help\".length) || \"/\"") && helpBlock.includes("NextResponse.redirect(url, 308)"));
  ok("middleware: no cookie is read inside the help block", !/cookies\.get/.test(helpBlock));
  ok("middleware: /sitemap.xml is in the matcher", /"\/sitemap\.xml",/.test(mw));
  ok("app/layout.js pre-paint script themes /help and the help host", /p === "\/help" \|\| p\.indexOf\("\/help\/"\) === 0/.test(read("app/layout.js")) && read("app/layout.js").includes('window.location.hostname.indexOf("help.") === 0'));
  ok("ThemeProvider themes /help and the help host", read("app/providers/ThemeProvider.js").includes('["/app", "/platform", "/help"]') && read("app/providers/ThemeProvider.js").includes('String(hostname).startsWith("help.")'));
  ok("helpPath / helpCanonical", helpPath("fr", "settings", "settings-branding") === "/help/fr/settings/settings-branding" && helpCanonical("fr", "settings", "settings-branding") === "https://help.fieldquo.com/fr/settings/settings-branding" && helpCanonical("en") === "https://help.fieldquo.com/en");
  const { swapLang } = await import("../app/components/help-centre/HelpChromeControls.js").catch(() => ({}));
  if (swapLang) {
    ok("swapLang keeps the article on both hosts", swapLang("/help/en/settings/settings-branding", "fr") === "/help/fr/settings/settings-branding" && swapLang("/en/settings/settings-branding", "es") === "/es/settings/settings-branding" && swapLang("/help", "fr") === "/help/fr" && swapLang("/", "fr") === "/fr");
  } else {
    // A client component imports next/navigation, which bare node cannot
    // resolve; the function is then asserted from source.
    const src = read("app/components/help-centre/HelpChromeControls.js");
    ok("swapLang handles both the /help-prefixed and the short pathname", src.includes('const i = parts[1] === "help" ? 2 : 1;'));
  }
  ok("pickHelpLang: q-values, regions, junk, default",
    pickHelpLang("fr-CA,fr;q=0.9,en;q=0.8") === "fr" && pickHelpLang("es-MX") === "es" && pickHelpLang("de-DE,uk;q=0.7,en;q=0.3") === "en" &&
    pickHelpLang("en;q=0.2, fr;q=0.9") === "fr" && pickHelpLang("") === "en" && pickHelpLang(null) === "en" && pickHelpLang("*;q=0, ;;;") === "en");
}

// ── 7. The feedback endpoint, executed ─────────────────────────────────────
section("7. Feedback endpoint: rate-limited, validated, no PII");
{
  const src = read("app/api/help/feedback/route.js");
  ok("the route rate-limits at the door", /rateLimit\(request, "help-feedback"/.test(src));
  ok("the route writes slug, lang and helpful only", src.includes("db.helpFeedback.create({ data: { slug, lang, helpful } })"));
  ok("the route reads no ip, user agent or session", !/clientIp|user-agent|getCurrentMember|getSessionCookie|x-forwarded-for/.test(src.replace(/\/\/.*$/gm, "")));
  const model = /model HelpFeedback \{([\s\S]*?)\n\}/.exec(read("prisma/schema.prisma"))?.[1] || "";
  const fields = model.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("///") && !l.startsWith("@@")).map((l) => l.split(/\s+/)[0]);
  ok("HelpFeedback has exactly id, slug, lang, helpful, createdAt", JSON.stringify(fields) === JSON.stringify(["id", "slug", "lang", "helpful", "createdAt"]), fields.join(","));

  const { POST } = await import("../app/api/help/feedback/route.js");
  const req = (body, ip = "203.0.113.5") => new Request("https://help.fieldquo.com/api/help/feedback", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
  reset();
  const good = await POST(req({ slug: "build-a-quote", lang: "fr", helpful: true }));
  ok("a valid vote is accepted", good.status === 200 && writes.length === 1 && JSON.stringify(writes[0].data) === JSON.stringify({ slug: "build-a-quote", lang: "fr", helpful: true }));
  reset();
  const unknown = await POST(req({ slug: "not-an-article", lang: "en", helpful: false }));
  ok("an unknown slug is refused (400) and nothing is written", unknown.status === 400 && writes.length === 0);
  const badLang = await POST(req({ slug: "build-a-quote", lang: "xx", helpful: false }));
  ok("an unknown language is refused", badLang.status === 400 && writes.length === 0);
  const badBool = await POST(req({ slug: "build-a-quote", lang: "en", helpful: "yes" }));
  ok("helpful must be a boolean", badBool.status === 400 && writes.length === 0);
  const junk = await POST(new Request("https://help.fieldquo.com/api/help/feedback", { method: "POST", headers: { "x-forwarded-for": "203.0.113.5" }, body: "not json" }));
  ok("a non-JSON body is refused", junk.status === 400);
  reset();
  let last = null;
  for (let i = 0; i < 31; i++) last = await POST(req({ slug: "build-a-quote", lang: "en", helpful: true }, "198.51.100.9"));
  ok("the 31st vote in ten minutes from one IP is throttled (429) with retry-after", last.status === 429 && last.headers.get("retry-after") && writes.length === 30);
  ok("a vote from another IP still lands", (await POST(req({ slug: "build-a-quote", lang: "en", helpful: false }, "198.51.100.10"))).status === 200);
  ok("nothing personal reaches the row", writes.every((w) => Object.keys(w.data).sort().join() === "helpful,lang,slug"));
  ok("rows for the model exist in the db stub", Array.isArray(rows.helpFeedback));
}

// ── 8. Language fallback and video ─────────────────────────────────────────
section("8. Other languages get the English body with a notice; videos embed");
{
  const { loadArticle, videoEmbed, bodyLang } = await import("../lib/help/content.js");
  ok("bodyLang: en, fr, es serve themselves; everything else serves English", bodyLang("fr") === "fr" && bodyLang("es") === "es" && bodyLang("uk") === "en" && bodyLang("zh") === "en" && bodyLang("xx") === "en");
  const sample = HELP_ARTICLES.find((a) => written("en", a));
  if (sample) {
    const uk = await loadArticle("uk", sample.category, sample.slug);
    ok("loadArticle('uk') serves the English body and flags the fallback", uk && uk.langUsed === "en" && uk.fallback === true && uk.article.title === written("en", sample).title);
    const en = await loadArticle("en", sample.category, sample.slug);
    ok("loadArticle('en') is not a fallback", en && en.fallback === false);
    const wrong = await loadArticle("en", "settings", sample.category === "settings" ? "no-such-slug" : sample.slug);
    ok("an article is only served from its home category", wrong === null);
  }
  const page = read("app/help/[lang]/[category]/[article]/page.js");
  ok("the article page renders the language notice only on fallback", /\{fallback && \([\s\S]*?data-help-lang-notice/.test(page));
  for (const lang of HELP_CHROME_LANGS) ok(`${lang}: article.englishOnly is a sentence`, HELP_CHROME[lang]["article.englishOnly"].length > (lang === "zh" ? 12 : 30));
  ok("videoEmbed: youtu.be, watch?v=, embed/, shorts/ → nocookie iframe",
    videoEmbed("https://youtu.be/dQw4w9WgXcQ")?.src === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" &&
    videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")?.kind === "youtube" &&
    videoEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ")?.kind === "youtube" &&
    videoEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.kind === "youtube");
  ok("videoEmbed: a Cloudinary mp4 → <video>", videoEmbed("https://res.cloudinary.com/fieldquo/video/upload/v1/help/build-a-quote.mp4")?.kind === "file");
  ok("videoEmbed: anything else is refused", videoEmbed("https://example.com/page") === null && videoEmbed("javascript:alert(1)") === null && videoEmbed("") === null);
  ok("the page shows the video-language notice only when the article's language differs", /const foreign = video\.lang && video\.lang !== lang;/.test(page) && /\{foreign && \([\s\S]*?data-help-video-notice/.test(page));
  ok("the page embeds under the intro, above the outline", page.indexOf("{video && <Video") < page.indexOf("data-help-outline") && page.indexOf("{video && <Video") > page.indexOf("data-help-lang-notice"));
  const videos = JSON.parse(read("content/help/videos.json"));
  const badVideos = Object.entries(videos).filter(([slug, v]) => !slug.startsWith("_") && (!articleMeta(slug) || !videoEmbed(v?.url) || !["en", "fr", "es"].includes(v?.lang)));
  ok("content/help/videos.json: every entry names a real article, an embeddable URL and a language", badVideos.length === 0, badVideos.map(([s]) => s).join(", "));
  const vc = HELP_CATEGORIES.find((c) => c.key === "videos");
  ok("the Videos category is virtual and lists articles with a video", vc?.virtual === "video");
}

// ── 9. The sitemap and static params ───────────────────────────────────────
section("9. Static generation");
{
  const article = read("app/help/[lang]/[category]/[article]/page.js");
  ok("article pages: dynamicParams = false, params from writtenArticles()", article.includes("export const dynamicParams = false;") && article.includes("writtenArticles()"));
  ok("category and language pages are static too", read("app/help/[lang]/[category]/page.js").includes("export const dynamicParams = false;") && read("app/help/[lang]/layout.js").includes("export const dynamicParams = false;"));
  ok("article metadata carries a help.fieldquo.com canonical and hreflang alternates", article.includes("canonical: helpCanonical(lang, category, slug)") && article.includes("languages: Object.fromEntries(HELP_CHROME_LANGS"));
  ok("the sitemap route is force-static and emits hreflang", read("app/help/sitemap.xml/route.js").includes('export const dynamic = "force-static"') && read("app/help/sitemap.xml/route.js").includes('hreflang="${l}"'));
  ok("/help redirects by Accept-Language", read("app/help/page.js").includes("pickHelpLang(h.get(\"accept-language\"))"));
  ok("every article page has an outline, related block and feedback", article.includes("data-help-outline") && article.includes("data-help-related") && article.includes("<HelpFeedback"));
}

// ── 10. The fees article says what the code charges ────────────────────────
section("10. The fees article and the fee constants");
{
  const a = modules.en["invoices-and-payments"]["payment-processing-fees-and-payouts"];
  const text = a ? JSON.stringify(a) : "";
  ok("the fees article is written in English", Boolean(a));
  if (a) {
    const card = PROCESSING_RATES.card;
    const pad = PROCESSING_RATES.acss_debit;
    ok(`card rate ${card.basisPoints / 100}% + ${card.fixedCents}¢ appears`, text.includes(`${card.basisPoints / 100}% + $0.${card.fixedCents}`));
    ok(`bank debit ${pad.basisPoints / 100}% + ${pad.fixedCents}¢ capped at $${pad.capCents / 100} appears`, text.includes(`${pad.basisPoints / 100}% + $0.${pad.fixedCents}`) && text.includes(`$${(pad.capCents / 100).toFixed(2)}`));
    ok(`instant payout ${INSTANT_PAYOUT_RATE.formula} and minimum ${INSTANT_PAYOUT_RATE.minimumCents}¢ appear`, text.includes(`**${INSTANT_PAYOUT_RATE.formula}**`) && text.includes(`minimum ${formatFeeCents(INSTANT_PAYOUT_RATE.minimumCents)}`));
    ok(`dispute fee $${DISPUTE_FEE_CENTS / 100} appears`, text.includes(`$${DISPUTE_FEE_CENTS / 100}`));
    const ex = processingFeeCents({ amountCents: 226000, currency: "cad", method: "card" });
    ok(`the worked example is the real function's answer (${formatFeeCents(ex)} on $2,260)`, text.includes(formatFeeCents(ex)) && text.includes("$2,191.90") && 226000 - ex === 219190);
    const big = processingFeeCents({ amountCents: 500000, currency: "cad", method: "acss_debit" });
    ok(`a $5,000 bank debit costs the cap (${formatFeeCents(big)})`, big === pad.capCents && text.includes("$5,000 invoice paid by bank debit costs $5"));
    const bigCard = processingFeeCents({ amountCents: 500000, currency: "cad", method: "card" });
    ok(`the same by card is ${formatFeeCents(bigCard)}`, text.includes(formatFeeCents(bigCard)));
    ok("the surcharges match CARD_SURCHARGES.ca", text.includes(`**${CARD_SURCHARGES.ca.international.formula}**`) && text.includes(`**${CARD_SURCHARGES.ca.conversion.formula}**`));
    const ids = a.sections.map((s) => s.id);
    ok("the outline mirrors the model article", JSON.stringify(ids) === JSON.stringify(["overview", "settings", "payouts", "payments", "instant-payouts", "fees", "refunds", "disputes", "negative-balances", "errors", "accounting-export"]), ids.join(","));
    ok("Tips and Capital are named as not applicable rather than omitted silently", /no tipping and no capital/i.test(text));
    const cols = read("lib/export/accountingExport.js");
    ok("the export columns named in the article exist in the export", ["Processing fee", "Net deposited", "Fee rate"].every((c) => cols.includes(`"${c}"`) && text.includes(c)));
  }
}

// ── Done ───────────────────────────────────────────────────────────────────
console.log(`\n${pass} ok, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
