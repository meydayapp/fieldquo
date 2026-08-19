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
} from "../lib/data/productUpdates.js";

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
