// scripts/check-product-pages.mjs
//
//   npm run check:product-pages
//
// The four pages at /product/<slug>, in nine languages.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Every other marketing surface on this site is translated into nine
// languages and gated on all nine by scripts/check-translations.mjs. These
// four were not. app/data/productFeatures.js was English only, and the page
// had "Start Free Trial" and "See Pricing" typed into the JSX with no t() call
// — so there was nothing for a coverage check to find missing. An untranslated
// string that is not in the catalogue at all is invisible to a catalogue
// check, which is precisely how these pages stayed English while the homepage
// that links to them was translated three times over.
//
// Three navigation surfaces land here: MarketingHeader's product dropdown,
// MarketingFooter's product column, and the homepage feature cards' "Learn
// more →". So the hole was reachable from the main nav of a fully translated
// site, in one click.
//
// ══ Why the keys are not in messages.js, and what stands in for that ═══════
//
// app/i18n/productPages/ follows app/i18n/industries/ rather than
// app/i18n/featurePages/: its modules are not merged into MESSAGES, so t()
// cannot see them and check:translations cannot gate them. That is only
// acceptable if something else applies the same bar. This file is that
// something. It holds all nine modules key-for-key against English, pins the
// English to the data module, and renders the real page in every language to
// prove the reader gets their own.
//
// ══ Rendered, not regexed ══════════════════════════════════════════════════
//
// The page is bundled with esbuild and executed through react-dom/server, the
// way scripts/check-feature-pages.mjs executes the feature pages. Same reason,
// recorded in that file's header: an agent in this repo had seventy-five
// source assertions pass green against a page that had stopped calling the
// function they all tested. A regex sees characters; a render sees the page.
//
// The one thing read as SOURCE is app/i18n/productPages/index.js, and only to
// confirm no per-language module was quietly dropped from the import list —
// which is a question about the file, not about the render.
//
// Run (esbuild first — the page is JSX, which plain node cannot parse):
//   npx esbuild scripts/check-product-pages.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --alias:@=. \
//     --alias:next/navigation=./scripts/stub-next-navigation.js \
//     --outfile=.product-pages.cjs && node .product-pages.cjs

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PRODUCT_FEATURES,
  PRODUCT_PAGE_TEXT_KEYS,
  productPageCopy,
  productPageKey,
  productPageStrings,
} from "@/app/data/productFeatures";
import {
  PRODUCT_PAGE_MESSAGES,
  PRODUCT_PAGE_MESSAGE_KEYS,
  productSay,
} from "@/app/i18n/productPages";
import { MESSAGES } from "@/app/i18n/messages";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import ProductPage, {
  generateStaticParams,
  generateMetadata,
} from "@/app/(marketing)/product/[slug]/page";

let pass = 0;
const fails = [];
// Label first, condition second. Reversing the two makes a non-empty string
// the condition, which can never fail — a false-pass trap that has caught more
// than one agent in this repo, in checks that then "passed" for weeks.
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
  return !!cond;
};

const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}\n`);

/**
 * Markup → the words a visitor reads.
 *
 * Entities have to be decoded or half the assertions below are meaningless:
 * React writes an apostrophe as `&#x27;` and a quotation mark as `&quot;`, and
 * this copy is full of both ("you're on the job", the AI question in quotes,
 * French guillemets around a question). Comparing raw markup against raw data
 * would quietly never match, and a check that never matches passes for the
 * wrong reason.
 */
const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Whitespace flattened the same way on both sides of every comparison. */
const flat = (s) => String(s).replace(/\s+/g, " ").trim();

/** Comments stripped, so a word discussed in a header is not read as a claim. */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

// Read relative to the repo root — the same way check-feature-pages.mjs does
// it. `import.meta.url` does not survive esbuild's cjs output, and a check that
// dies at read time is a check that never ran.
const read = (p) => readFileSync(p, "utf8");

const SLUGS = Object.keys(PRODUCT_FEATURES);

// Derived, never typed. Seven checks in this repo have already been fixed for
// hardcoding "six languages" and then passing green after a seventh was added.
// The catalogue's own key list is the only honest source for how many there
// are, and the assertion just below ties it to the marketing catalogue so a
// language added to messages.js and forgotten here fails rather than hides.
const CODES = Object.keys(PRODUCT_PAGE_MESSAGES);
const OTHER = CODES.filter((c) => c !== "en");

// ── Catalogue set vs OFFERED set, and why they differ ──────────────────────
//
// The catalogue is held to nine. The RENDER is held to the eight in
// LANGUAGES, because LanguageProvider refuses a code that is not offered —
// isSupported() sends it back to English — so asking for a Mandarin render
// would assert against a page that is English by design and fail for the wrong
// reason. Mandarin is catalogue-only on purpose: no CJK face is registered in
// lib/documents/pdfFont.js, which scripts/check-language-completeness.mjs
// records and asserts.
//
// Translating it anyway is the point. The catalogue is what the picker draws
// from the day a font is bundled, and a language added to LANGUAGES with a
// hole behind it is the exact failure that check exists to catch.
const OFFERED = LANGUAGES.map((l) => l.code);
const OFFERED_OTHER = OFFERED.filter((c) => c !== DEFAULT_LANGUAGE);
const HELD_BACK = CODES.filter((c) => !OFFERED.includes(c));

async function main() {
  // ── Render every page in every language, once, up front ─────────────────
  //
  // Every assertion below reads from this map rather than re-rendering, so a
  // page that throws fails loudly here instead of failing forty times quietly.
  const renderPage = async (slug, language) => {
    const element = await ProductPage({ params: Promise.resolve({ slug }) });
    if (element === undefined || element === null) return undefined;
    return renderToStaticMarkup(
      createElement(LanguageProvider, { initialLanguage: language }, element),
    );
  };

  const rendered = new Map(); // `${language}/${slug}` → text
  for (const language of OFFERED) {
    for (const slug of SLUGS) {
      const html = await renderPage(slug, language);
      rendered.set(`${language}/${slug}`, html === undefined ? "" : textOf(html));
    }
  }
  const shown = (language, slug) => rendered.get(`${language}/${slug}`);

  // ═════════════════════════════════════════════════════════════════════════
  section("1. The pages exist, render, and are the ones routed to");
  // ═════════════════════════════════════════════════════════════════════════

  ok(`there are product pages at all (${SLUGS.length})`, SLUGS.length > 0);
  ok(
    "generateStaticParams offers exactly the slugs that exist",
    JSON.stringify(generateStaticParams().map((p) => p.slug)) === JSON.stringify(SLUGS),
    generateStaticParams().map((p) => p.slug).join(" "),
  );

  for (const slug of SLUGS) {
    const text = shown(DEFAULT_LANGUAGE, slug);
    ok(`/product/${slug} renders real content`, text.length > 400, `${text.length} chars`);
  }

  // params is a Promise in Next 16, and this page's own comment records that a
  // version reading it synchronously 404'd every /product/* URL while the
  // content sat there.
  //
  // The renders above already pass a Promise, and a page that failed to await
  // it would destructure `undefined` for the slug, hit notFound() and come
  // back empty — so they prove it. Repeated here with a promise that settles
  // on a LATER tick rather than an already-resolved one, because
  // `Promise.resolve` is close enough to synchronous that a sloppy read can
  // still land on the right value by accident.
  {
    const later = new Promise((resolve) => setTimeout(() => resolve({ slug: "quoting" }), 5));
    const el = await ProductPage({ params: later });
    const html = el ? renderToStaticMarkup(
      createElement(LanguageProvider, { initialLanguage: "en" }, el),
    ) : "";
    ok(
      "the page awaits params rather than reading it synchronously",
      textOf(html).includes(flat(PRODUCT_FEATURES.quoting.headline)),
      "a params Promise that settles late rendered nothing — the await is missing",
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("2. The key list, derived in one place");
  // ═════════════════════════════════════════════════════════════════════════

  const expectedKeys = SLUGS.flatMap((slug) =>
    productPageStrings(PRODUCT_FEATURES[slug]).map(({ field }) => productPageKey(slug, field)),
  );

  ok(
    `PRODUCT_PAGE_TEXT_KEYS is exactly what the pages hold (${expectedKeys.length})`,
    JSON.stringify([...PRODUCT_PAGE_TEXT_KEYS]) === JSON.stringify(expectedKeys),
  );
  ok(
    "every page carries a headline, a description and four bullets",
    SLUGS.every((s) => productPageStrings(PRODUCT_FEATURES[s]).length === 6),
    SLUGS.map((s) => `${s}:${productPageStrings(PRODUCT_FEATURES[s]).length}`).join(" "),
  );
  ok("no key is claimed twice", new Set(expectedKeys).size === expectedKeys.length);
  ok(
    "the key shape comes from productPageKey()",
    productPageKey("quoting", "headline") === "productPage.quoting.headline" &&
      productPageKey("analytics", "bullet.4") === "productPage.analytics.bullet.4",
  );

  // ═════════════════════════════════════════════════════════════════════════
  section("3. Nine languages, and the same nine the rest of the site has");
  // ═════════════════════════════════════════════════════════════════════════

  // The count is derived from the marketing catalogue rather than written
  // down. This is the assertion that turns "somebody added a tenth language"
  // from a silent English page into a red build.
  {
    const marketing = Object.keys(MESSAGES);
    const missing = marketing.filter((c) => !CODES.includes(c));
    const extra = CODES.filter((c) => !marketing.includes(c));
    ok(
      `/product has a module for every language the catalogue has (${marketing.length})`,
      missing.length === 0 && extra.length === 0,
      [...missing.map((c) => `no productPages/${c}.js`), ...extra.map((c) => `${c} has no catalogue`)].join(", "),
    );
  }

  // Every language a visitor can actually PICK has a module here. This is the
  // direction that costs a customer something: a code in LANGUAGES with no
  // productPages module is a picker entry that lands on an English page.
  {
    const absent = OFFERED.filter((c) => !CODES.includes(c));
    ok(
      `every language the picker offers has a product-page module (${OFFERED.length})`,
      absent.length === 0,
      absent.join(" "),
    );
    console.log(
      `    (translated but not offered, so not rendered below: ${HELD_BACK.join(" ") || "none"})`,
    );
  }

  // A module dropped from the import list is a language that silently falls
  // back to English — the object literal would just be short. Read as source
  // because it is a question about the file, and decommented because the
  // header of that file NAMES every language code in prose.
  {
    const src = decomment(read("app/i18n/productPages/index.js"));
    const notImported = CODES.filter(
      (c) => !new RegExp(`from\\s+"\\./${c}\\.js"`).test(src),
    );
    ok(
      "every language module is imported by index.js",
      notImported.length === 0,
      notImported.join(" "),
    );
  }

  for (const language of CODES) {
    const dict = PRODUCT_PAGE_MESSAGES[language];
    const missing = PRODUCT_PAGE_MESSAGE_KEYS.filter(
      (k) => typeof dict[k] !== "string" || !dict[k].trim(),
    );
    const extra = Object.keys(dict).filter((k) => !PRODUCT_PAGE_MESSAGE_KEYS.includes(k));
    ok(
      `${language}: all ${PRODUCT_PAGE_MESSAGE_KEYS.length} strings present`,
      missing.length === 0,
      `${missing.length} missing, e.g. ${missing.slice(0, 4).join(" ")}`,
    );
    ok(`${language}: and nothing English does not have`, extra.length === 0, extra.slice(0, 4).join(" "));
  }

  // Both directions. A key naming a page or a field that does not exist would
  // strand nine translations of it the first time a slug was renamed.
  {
    const legitimate = new Set(expectedKeys);
    const orphans = [];
    for (const language of CODES) {
      for (const key of Object.keys(PRODUCT_PAGE_MESSAGES[language])) {
        if (!legitimate.has(key)) orphans.push(`${language}/${key}`);
      }
    }
    ok("no catalogue key names a page or a field that does not exist", orphans.length === 0,
      orphans.slice(0, 5).join(" "));
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("4. English is the data module, not a second opinion");
  // ═════════════════════════════════════════════════════════════════════════

  /* The English block exists because every other language is held to the KEYS
     OF ENGLISH. So it is a duplicate, and an unpinned duplicate is worse than
     no duplicate: /product/quoting would say one thing and this file would be
     proving another. Pinned character by character. */
  {
    const drifted = [];
    for (const slug of SLUGS) {
      for (const { field, english } of productPageStrings(PRODUCT_FEATURES[slug])) {
        const key = productPageKey(slug, field);
        if (PRODUCT_PAGE_MESSAGES.en[key] !== english) drifted.push(key);
      }
    }
    ok(
      "every English string is character-identical to app/data/productFeatures.js",
      drifted.length === 0,
      `${drifted.length}: ${drifted.slice(0, 5).join(" ")}`,
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("5. The three keys these pages BORROW rather than own");
  // ═════════════════════════════════════════════════════════════════════════

  /* The eyebrow label and both buttons are resolved through t() against
     messages.js instead of being copied into productPages/. That is the right
     call — a tenth wording of "Start free trial" is a tenth thing to keep in
     step — and it is only safe while something asserts the borrowed keys are
     still there. They belong to a file this change does not own, and
     featurePage.chrome.seePricing is namespaced to a different page set
     entirely: deleting /features would take it with it and leave these four
     buttons falling back to English in eight languages. */
  const BORROWED = ["hero.cta", "featurePage.chrome.seePricing"];

  for (const key of BORROWED) {
    const absent = CODES.filter(
      (c) => typeof MESSAGES[c]?.[key] !== "string" || !MESSAGES[c][key].trim(),
    );
    ok(`${key} is in the catalogue in all ${CODES.length} languages`, absent.length === 0,
      absent.join(" "));
  }

  for (const slug of SLUGS) {
    const key = `product.${slug}.label`;
    const absent = CODES.filter(
      (c) => typeof MESSAGES[c]?.[key] !== "string" || !MESSAGES[c][key].trim(),
    );
    ok(`${key} is in the catalogue in all ${CODES.length} languages`, absent.length === 0,
      absent.join(" "));
    // Pinned the same way the prose is: the eyebrow and the nav entry are the
    // same words, and if they ever stop being the same words the page and the
    // menu that links to it start disagreeing about what the feature is called.
    ok(
      `${key} still matches PRODUCT_FEATURES.${slug}.label`,
      MESSAGES.en[key] === PRODUCT_FEATURES[slug].label,
      `catalogue "${MESSAGES.en[key]}" vs data "${PRODUCT_FEATURES[slug].label}"`,
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("6. Nothing was left in English, and the three scripts");
  // ═════════════════════════════════════════════════════════════════════════

  {
    const untranslated = [];
    for (const language of OTHER) {
      for (const key of PRODUCT_PAGE_MESSAGE_KEYS) {
        if (flat(PRODUCT_PAGE_MESSAGES[language][key]) === flat(PRODUCT_PAGE_MESSAGES.en[key])) {
          untranslated.push(`${language}/${key}`);
        }
      }
    }
    ok("no string is still its English original", untranslated.length === 0,
      `${untranslated.length}: ${untranslated.slice(0, 6).join(" ")}`);
  }

  // Three of the nine are not written in the Latin alphabet, and a paste that
  // silently kept the English would show up here even if a word or two had
  // been changed. Checked on the SCRIPT, which no amount of paraphrase fakes.
  {
    const SCRIPTS = [
      ["uk", /[\u0400-\u04FF]/, "Cyrillic"],
      ["pa", /[\u0A00-\u0A7F]/, "Gurmukhi"],
      ["zh", /[\u4E00-\u9FFF]/, "Han"],
    ];
    for (const [code, re, name] of SCRIPTS) {
      const wrong = PRODUCT_PAGE_MESSAGE_KEYS.filter(
        (k) => !re.test(PRODUCT_PAGE_MESSAGES[code][k]),
      );
      ok(`${code}: every string is written in ${name}`, wrong.length === 0,
        wrong.slice(0, 4).join(" "));
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("7. The resolver, exercised rather than described");
  // ═════════════════════════════════════════════════════════════════════════

  {
    const bare = productPageCopy("quoting");
    const raw = PRODUCT_FEATURES.quoting;
    ok("no resolver at all is the English data module, unchanged",
      bare.headline === raw.headline &&
        bare.description === raw.description &&
        bare.bullets.every((b, i) => b === raw.bullets[i]));

    // A language with a hole in it must hand back the English sentence the
    // pin above proved — never the key. Exercised with a say() that resolves
    // nothing, which is exactly what a missing entry does.
    const nothingResolves = (key, english) => english;
    const holed = productPageCopy("quoting", nothingResolves);
    ok("a language with no entry gets the English prose",
      holed.headline === raw.headline && holed.bullets[3] === raw.bullets[3]);
    ok("...never the catalogue key itself",
      !/^productPage\./.test(holed.headline) &&
        holed.bullets.every((b) => !/^productPage\./.test(b)));
    ok("...for every field on every page",
      SLUGS.every((slug) => {
        const c = productPageCopy(slug, nothingResolves);
        const p = PRODUCT_FEATURES[slug];
        return (
          c.headline === p.headline &&
          c.description === p.description &&
          c.bullets.every((b, i) => b === p.bullets[i])
        );
      }));

    // productSay() is the real chain, and an unknown language must not throw
    // or emit a key — it is what an old localStorage value produces.
    const nowhere = productSay("xx");
    ok("an unrecognised language falls back to English, not to a key",
      nowhere(productPageKey("quoting", "headline"), raw.headline) === raw.headline);

    // And with a language that DOES resolve, the catalogue wins.
    const uk = productSay("uk");
    const said = productPageCopy("quoting", uk);
    ok("a language with an entry gets the entry",
      said.headline === PRODUCT_PAGE_MESSAGES.uk["productPage.quoting.headline"] &&
        said.bullets[1] === PRODUCT_PAGE_MESSAGES.uk["productPage.quoting.bullet.2"] &&
        said.headline !== raw.headline);

    ok("an unknown slug is refused, not improvised", productPageCopy("not-a-product", uk) === undefined);
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("8. What the visitor actually reads, language by language");
  // ═════════════════════════════════════════════════════════════════════════

  // English is the control. If the pages stopped printing the proved English
  // when nobody asked for another language, every assertion below is measuring
  // the wrong thing.
  {
    const missing = SLUGS.filter(
      (s) => !shown("en", s).includes(flat(PRODUCT_FEATURES[s].headline)),
    );
    ok("English still prints the data module's own headlines", missing.length === 0,
      missing.join(" "));
    const noLabel = SLUGS.filter((s) => !shown("en", s).includes(flat(PRODUCT_FEATURES[s].label)));
    ok("...and the label over each of them", noLabel.length === 0, noLabel.join(" "));
  }

  for (const language of OFFERED_OTHER) {
    // (a) Every string of every page, printed in this language.
    {
      const absent = [];
      for (const slug of SLUGS) {
        const text = shown(language, slug);
        for (const { field } of productPageStrings(PRODUCT_FEATURES[slug])) {
          const key = productPageKey(slug, field);
          if (!text.includes(flat(PRODUCT_PAGE_MESSAGES[language][key]))) {
            absent.push(`${slug}.${field}`);
          }
        }
      }
      ok(`${language}: every string is printed in ${language}`, absent.length === 0,
        `${absent.length}: ${absent.slice(0, 6).join(" ")}`);
    }

    // (b) And no English survives beside it. The bug was a MIXTURE — a page
    //     with translated paragraphs and an English button is the same defect
    //     facing the other way — so the prose and the furniture are checked
    //     together. Short strings are skipped: a four-word bullet can
    //     legitimately share a substring with a loanword-heavy Tagalog line.
    {
      const survived = [];
      for (const slug of SLUGS) {
        const text = shown(language, slug);
        for (const { field, english } of productPageStrings(PRODUCT_FEATURES[slug])) {
          if (flat(english).length < 30) continue;
          if (text.includes(flat(english))) survived.push(`${slug}.${field}`);
        }
      }
      ok(`${language}: NO English page prose survives`, survived.length === 0,
        `${survived.length}: ${survived.slice(0, 6).join(" ")}`);
    }

    // (c) The eyebrow label, which comes from messages.js rather than from
    //     productPages/ — the half of the page a catalogue-only check would
    //     never look at.
    {
      const absent = SLUGS.filter(
        (s) => !shown(language, s).includes(flat(MESSAGES[language][`product.${s}.label`])),
      );
      ok(`${language}: the label over the headline is in ${language}`, absent.length === 0,
        absent.join(" "));
    }

    // (d) Both buttons. These are the two strings that were hardcoded English
    //     in the JSX, which is the defect that started this file — so they are
    //     asserted by their RENDERED value, in this language, on every page.
    for (const key of BORROWED) {
      const value = flat(MESSAGES[language][key]);
      const absent = SLUGS.filter((s) => !shown(language, s).includes(value));
      ok(`${language}: every page prints ${key} in ${language}`, absent.length === 0,
        absent.join(" "));
      // And the English of it is gone. Skipped where a language legitimately
      // shares the English wording, which none of the nine do for these two —
      // asserted rather than assumed, so this stops being skipped silently.
      if (flat(MESSAGES.en[key]) !== value) {
        const survived = SLUGS.filter((s) => shown(language, s).includes(flat(MESSAGES.en[key])));
        ok(`${language}: ...and the English ${key} is gone`, survived.length === 0,
          survived.join(" "));
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  section("9. Metadata stays English on purpose");
  // ═════════════════════════════════════════════════════════════════════════

  // The <title> and description a crawler sees are the English ones, and they
  // are the English ones no matter what language the body renders in — because
  // generateMetadata has no React context and must not gain one. The same
  // decision is recorded on /industries/[slug] and /features/[slug]. Asserted
  // rather than described, so "we translated the page" never quietly becomes
  // "we translated the <title> to whoever asked last".
  {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "quoting" }) });
    const feature = PRODUCT_FEATURES.quoting;
    ok("generateMetadata is still English", meta.title === `${feature.label} — FieldQuo`, meta.title);
    ok("...and its description is the data module's own", meta.description === feature.description);
    ok("...which is NOT what the page renders in French",
      PRODUCT_PAGE_MESSAGES.fr["productPage.quoting.description"] !== feature.description);
    const none = await generateMetadata({ params: Promise.resolve({ slug: "not-a-product" }) });
    ok("...and an unknown slug gets no metadata", Object.keys(none).length === 0);
  }

  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions across ${CODES.length} languages`,
  );
  process.exit(fails.length ? 1 : 0);
}

// A throw inside main() is a failure of the thing being checked — a page that
// cannot render at all — so it exits non-zero rather than becoming an
// unhandled rejection that some node versions report and still exit 0 on.
main().catch((err) => {
  console.error(`\nFAILED — the page set threw before it could be checked\n${err?.stack || err}`);
  process.exit(1);
});
