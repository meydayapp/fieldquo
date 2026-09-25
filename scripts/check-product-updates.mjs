// scripts/check-product-updates.mjs
//
// The changelog is hand-edited data, so the things that break are the things a
// human gets wrong: a slug typed twice, a "Read the full update" link pointing
// at a post that was never written, a date that doesn't parse.
//
//   node scripts/check-product-updates.mjs

import {
  PRODUCT_UPDATES,
  hasPost,
  findProductUpdate,
  localizedUpdate,
  translationComplete,
} from "../lib/data/productUpdates.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let failures = 0;
function fail(msg) {
  failures++;
  console.log(`FAIL  ${msg}`);
}

if (!Array.isArray(PRODUCT_UPDATES) || PRODUCT_UPDATES.length === 0) {
  fail("PRODUCT_UPDATES is empty");
}

const seen = new Set();
let previousDate = null;

for (const [i, u] of PRODUCT_UPDATES.entries()) {
  const where = `entry ${i} (${u.title || "untitled"})`;

  if (!u.title?.trim()) fail(`${where}: missing title`);
  if (!u.body?.trim()) fail(`${where}: missing body — the summary always renders`);

  const time = Date.parse(`${u.date}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(u.date || "") || Number.isNaN(time)) {
    fail(`${where}: date "${u.date}" is not an ISO day`);
  } else {
    // The page prints the array order and calls it a timeline.
    if (previousDate !== null && time > previousDate) {
      fail(`${where}: dated after the entry above it — the list is not sorted`);
    }
    previousDate = time;
  }

  // slug and post are a pair: one without the other is a dead link or a page
  // nothing reaches.
  if (u.slug && !u.post?.length) fail(`${where}: has a slug but no post`);
  if (u.post?.length && !u.slug) fail(`${where}: has a post but no slug to reach it`);

  if (u.slug) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(u.slug)) {
      fail(`${where}: slug "${u.slug}" is not url-safe kebab-case`);
    }
    if (seen.has(u.slug)) fail(`${where}: duplicate slug "${u.slug}"`);
    seen.add(u.slug);
    if (findProductUpdate(u.slug) !== u) {
      fail(`${where}: findProductUpdate("${u.slug}") resolves to a different entry`);
    }
  }

  if (u.post?.length && u.post.some((p) => typeof p !== "string" || !p.trim())) {
    fail(`${where}: post contains an empty paragraph`);
  }

  // Every linked entry must render something. This is the assertion that keeps
  // the "Read the full update" link honest.
  if (hasPost(u) && !(u.post.join("").length > 40)) {
    fail(`${where}: linked post is effectively empty`);
  }
}

// ── Translations: whole or not at all ─────────────────────────────────────
//
// localizedUpdate() falls back to English for an incomplete translation, so a
// broken one would never show a mixed page — it would silently show English
// to the reader it was written for. That is the failure this catches.
const APP_LANGS = Object.keys(APP_MESSAGES);
for (const [i, u] of PRODUCT_UPDATES.entries()) {
  if (!u.translations) continue;
  const where = `entry ${i} (${u.title})`;
  for (const [lang, tr] of Object.entries(u.translations)) {
    if (!APP_LANGS.includes(lang)) fail(`${where}: translation "${lang}" is not an app language`);
    if (lang === "en") fail(`${where}: English is the entry itself, not a translation`);
    if (!translationComplete(u, tr)) fail(`${where}: the "${lang}" translation is incomplete (title, body, and a post with ${u.post?.length || 0} paragraphs)`);
    const shown = localizedUpdate(u, lang);
    if (shown.title !== tr.title || shown.body !== tr.body) fail(`${where}: localizedUpdate("${lang}") does not show the translation`);
    if (hasPost(u) && shown.post !== tr.post) fail(`${where}: localizedUpdate("${lang}") does not show the translated post`);
    if (shown.slug !== u.slug || shown.date !== u.date) fail(`${where}: a translation must not move the slug or date`);
  }
}
// The newest entry is the one the owner asked for "in the language of the
// user": every app language, not whichever ones someone remembered.
{
  const newest = PRODUCT_UPDATES[0];
  const missing = APP_LANGS.filter((l) => l !== "en" && !translationComplete(newest, newest.translations?.[l]));
  if (missing.length) fail(`newest entry (${newest.title}): no complete translation for ${missing.join(", ")}`);
}
{
  const u = PRODUCT_UPDATES.find((x) => x.translations && hasPost(x));
  if (u) {
    for (const bad of [undefined, null, "", "xx", "__proto__", "constructor", 42]) {
      const shown = localizedUpdate(u, bad);
      if (shown.title !== u.title || shown.post !== u.post) fail(`localizedUpdate(${JSON.stringify(bad)}) should read English`);
    }
    if (localizedUpdate(u, "FR").title !== u.translations.fr.title) fail("localizedUpdate should not care about the case of the language code");
    // Half a translation reads English whole, never a French title over English paragraphs.
    const half = { ...u, translations: { fr: { ...u.translations.fr, post: u.translations.fr.post.slice(1) } } };
    if (localizedUpdate(half, "fr").title !== u.title) fail("a translation missing a paragraph must fall back to English whole");
    const noBody = { ...u, translations: { fr: { ...u.translations.fr, body: " " } } };
    if (localizedUpdate(noBody, "fr").title !== u.title) fail("a translation with a blank body must fall back to English whole");
  }
  const english = PRODUCT_UPDATES.find((x) => !x.translations);
  if (english && localizedUpdate(english, "fr") !== english) fail("an English-only entry reads English in every language");
  if (localizedUpdate(null, "fr") !== null) fail("localizedUpdate(null) should be null — the post page's not-found state");
}

// Lookup edge cases the route will hit from a hand-typed URL.
for (const bad of [undefined, null, "", "does-not-exist", "../../etc/passwd", "__proto__"]) {
  if (findProductUpdate(bad) !== null) fail(`findProductUpdate(${JSON.stringify(bad)}) should be null`);
}

const linked = PRODUCT_UPDATES.filter(hasPost).length;
console.log(
  failures === 0
    ? `ok    ${PRODUCT_UPDATES.length} updates, ${linked} with a full post — all checks passed.`
    : `\n${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
