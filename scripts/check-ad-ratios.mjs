// scripts/check-ad-ratios.mjs
//
// One advert, five shapes, and the reflow that has to be right for any of it
// to be worth downloading.
//
// ══ What the editor does not do ════════════════════════════════════════════
//
// The canvas editor's changeSize() sets the workspace rectangle's width and
// height and touches nothing else. Objects keep their absolute coordinates. So
// resizing a 1200x630 Facebook banner to a 1080x1080 square leaves a headline
// at x=900 outside the frame — present in the document, clipped out of the
// picture, with nothing on screen saying so.
//
// A contractor who lays out one advert and asks for it as a Story would get a
// broken Story, silently, five files at a time. That is what reflow() exists to
// prevent, and it is why these cases are EXECUTED rather than eyeballed: an
// off-by-a-half-width in the centring maths produces a layout that looks
// plausible in review and wrong on a phone.
import { readFileSync } from "node:fs";
import {
  AD_RATIOS,
  DEFAULT_RATIO,
  LEGACY_DEFAULT_RATIO,
  ratio,
  reflow,
  overflowing,
  assetFilename,
  openingRatio,
  defaultPublishShape,
} from "@/lib/marketing/ratios";
import {
  validateImageForInstagram,
  validateImageForFacebook,
  checkImageForFacebookFeed,
  classifyMetaPublishError,
  INSTAGRAM_COMPLIANT_RATIO_KEY,
} from "@/lib/social/metaSpecs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const near = (a, b, t = 0.51) => Math.abs(a - b) <= t;

const SQ = { width: 1080, height: 1080 };
const STORY = { width: 1080, height: 1920 };
const FEED = { width: 1200, height: 630 };

const doc = () => ({
  objects: [
    { name: "clip", type: "rect", width: 1080, height: 1080, left: 0, top: 0 },
    // Dead centre. Whatever else moves, this must not.
    { type: "textbox", name: "centre", width: 400, height: 100, left: 340, top: 490, scaleX: 1, scaleY: 1, fontSize: 48 },
    { type: "rect", name: "corner", width: 200, height: 200, left: 840, top: 840, scaleX: 1, scaleY: 1, strokeWidth: 6 },
  ],
});

section("1. The frames themselves");

ok(AD_RATIOS.length >= 5, "there are presets for the networks a contractor posts to", AD_RATIOS.length);
ok(AD_RATIOS.every((r) => r.width > 0 && r.height > 0), "every preset has real pixels");
ok(new Set(AD_RATIOS.map((r) => r.key)).size === AD_RATIOS.length, "no duplicate keys");
ok(new Set(AD_RATIOS.map((r) => r.file)).size === AD_RATIOS.length,
  "no two presets share a FILE name — five downloads that overwrite each other is not a set");
ok(ratio(DEFAULT_RATIO), "the default is a real preset", DEFAULT_RATIO);
ok(ratio("nope") === null, "an unknown key is null rather than a guess");

section("2. Reflow keeps the composition, and does not stretch it");

const story = reflow(doc(), SQ, STORY);
const c = story.objects.find((o) => o.name === "centre");
// 1080 -> 1080x1920: scale is min(1, 1.777) = 1. The centred object must stay
// centred in the NEW frame, which means moving down as the frame grows taller.
ok(near(c.left + (c.width * c.scaleX) / 2, STORY.width / 2), "what was centred horizontally stays centred", c.left);
ok(near(c.top + (c.height * c.scaleY) / 2, STORY.height / 2), "…and vertically, in the new frame", c.top);
ok(c.scaleX === c.scaleY, "scale is UNIFORM — a stretched logo is the thing a contractor spots instantly", [c.scaleX, c.scaleY]);

const feed = reflow(doc(), SQ, FEED);
const cf = feed.objects.find((o) => o.name === "centre");
ok(cf.scaleX === cf.scaleY, "still uniform going the other way");
// min(1200/1080, 630/1080) = 0.583 — fit INSIDE, so nothing is pushed out.
ok(near(cf.scaleX, Math.min(FEED.width / SQ.width, FEED.height / SQ.height), 0.001),
  "…and it FITS inside rather than filling, so artwork is never pushed out of frame", cf.scaleX);
ok(cf.scaleX < 1, "a square laid out for a landscape frame gets smaller, not cropped", cf.scaleX);

section("3. The frame is the frame, not artwork");

const clip = story.objects.find((o) => o.name === "clip");
ok(clip.width === STORY.width && clip.height === STORY.height, "the workspace takes the new size exactly", [clip.width, clip.height]);
ok(clip.scaleX === 1 && clip.scaleY === 1, "…and is never scaled — it IS the frame, it is not in the picture");

section("4. The details that make it look cheap if they are wrong");

const corner = story.objects.find((o) => o.name === "corner");
const cornerFeed = feed.objects.find((o) => o.name === "corner");
// Fabric draws strokeWidth in absolute pixels. Unscaled, a 6px outline on a
// shape shrunk to 58% becomes proportionally almost twice as heavy.
ok(near(cornerFeed.strokeWidth, 6 * cf.scaleX, 0.001),
  "a stroke scales with its shape — otherwise outlines get crude at the smallest ratio", cornerFeed.strokeWidth);
ok(corner.strokeWidth === 6, "…and is untouched when the scale is 1");
// fabric applies scaleX/scaleY ON TOP of fontSize. Scaling both compounds.
// Asserted on the FEED reflow, where the scale is 0.583. The story reflow has a
// scale of exactly 1, so "fontSize is unchanged" passes there even on a build
// that scales it — mutation testing caught that this assertion proved nothing
// where it originally sat.
ok(cf.fontSize === 48, "fontSize is left alone even when the scale is not 1 — scaling it AND scaleY would square the change", cf.fontSize);

section("5. It does not quietly rewrite the design being copied FROM");

const original = doc();
const before = JSON.stringify(original);
reflow(original, SQ, STORY);
ok(JSON.stringify(original) === before,
  "the input document is never mutated — the contractor is still looking at the ratio they came from");

section("6. Hostile input costs nothing");

for (const [label, args] of [
  ["no document", [null, SQ, STORY]],
  ["no objects", [{}, SQ, STORY]],
  ["objects not an array", [{ objects: "nope" }, SQ, STORY]],
  ["zero-width source", [doc(), { width: 0, height: 1080 }, STORY]],
  ["missing target", [doc(), SQ, null]],
]) {
  let threw = false;
  let out;
  try { out = reflow(...args); } catch { threw = true; }
  ok(!threw, `${label} does not throw`);
  ok(Array.isArray(out?.objects), `…and still answers with a document`, out?.objects?.length);
}
// A frame with no size cannot be reflowed INTO. Returning the layout unchanged
// beats scaling everything by NaN, which fabric renders as nothing at all and
// a contractor reads as "my advert vanished".
// Every degenerate frame, not just the zero TARGET. A zero-width SOURCE divides
// by it — the coordinates come out Infinity rather than NaN, which fabric
// renders exactly as badly and which the original assertion never reached,
// because it only tested the one case that happened to produce zeros.
for (const [label, from, to] of [
  ["zero target", SQ, { width: 0, height: 0 }],
  ["zero-width source", { width: 0, height: 1080 }, STORY],
  ["zero-height source", { width: 1080, height: 0 }, STORY],
  ["both missing", null, null],
]) {
  const out = reflow(doc(), from, to);
  ok(
    out.objects.every(
      (o) =>
        Number.isFinite(o.left ?? 0) &&
        Number.isFinite(o.top ?? 0) &&
        Number.isFinite(o.scaleX ?? 1) &&
        Number.isFinite(o.scaleY ?? 1),
    ),
    `${label}: no NaN or Infinity reaches the canvas — either renders as an empty picture, which reads as lost work`,
    out.objects.map((o) => o.left),
  );
}

section("7. Overflow is reported, not hidden");

// Reflow is a starting layout, not a guarantee. A wide object in a narrow frame
// can still hang over an edge, and the honest move is to say so before somebody
// posts it.
const wide = { objects: [
  { name: "clip", type: "rect", width: 1080, height: 1920 },
  { type: "rect", name: "banner", width: 2000, height: 100, left: 0, top: 100, scaleX: 1, scaleY: 1 },
]};
ok(overflowing(wide, STORY).includes("banner"), "artwork hanging over the edge is named", overflowing(wide, STORY));
ok(overflowing(doc(), SQ).length === 0, "a layout that fits reports nothing");
ok(!overflowing(wide, STORY).includes("clip"), "the frame is never reported as overflowing itself");
ok(overflowing(wide, null).length === 0, "no frame, no claim");

section("8. Five files a human can tell apart");

const names = AD_RATIOS.map((r) => assetFilename("Spring Promo", r.key));
console.log("         " + names.join("\n         "));
ok(new Set(names).size === names.length, "every file in the set has a distinct name");
ok(names.every((n) => /^[a-z0-9.-]+$/.test(n)), "…and no spaces or punctuation to break a download", names.find((n) => !/^[a-z0-9.-]+$/.test(n)));
ok(assetFilename("!!!", "tiktok") === "advert-tiktok.png", "a name that sanitises to nothing still gets one", assetFilename("!!!", "tiktok"));
ok(assetFilename("", "instagram_post").endsWith("-instagram-post.png"), "…and the ratio is always in it");
ok(assetFilename("x".repeat(200), "tiktok").length < 90, "a very long campaign name cannot produce an unusable filename");

section("9. Which of these crops Instagram's own feed endpoint will actually accept");

// PublishModal.js only ever offers "instagram_post" and "facebook_feed" as
// publish shapes — this is the assertion that choice is backed by Meta's
// real 4:5–1.91:1 rule (lib/social/metaSpecs.js), not a guess. If a future
// edit to either preset's width/height pushes it out of range, this is the
// check that catches it before a contractor's publish attempt does.
const igOk = (key) => {
  const r = ratio(key);
  return validateImageForInstagram({ width: r.width, height: r.height }).ok;
};

ok(igOk("instagram_post"), "the square preset (1080x1080, ratio 1.0) passes Instagram's aspect-ratio gate");
ok(igOk("facebook_feed"), "the Facebook-feed preset (1200x630, ratio ≈1.905) still just clears the 1.91:1 ceiling", ratio("facebook_feed").width / ratio("facebook_feed").height);
ok(!igOk("instagram_story"), "the 9:16 Story crop (ratio 0.5625) is correctly REJECTED for the feed image endpoint — Stories are a different Meta endpoint entirely");
ok(!igOk("tiktok"), "the TikTok crop shares the Story's 9:16 shape and is rejected the same way");
ok(INSTAGRAM_COMPLIANT_RATIO_KEY === "instagram_post" && igOk(INSTAGRAM_COMPLIANT_RATIO_KEY), "metaSpecs.js's own named default is itself compliant, not just documented as such");

// The boundary itself, not just the two presets either side of it — this is
// the case a future "round 1200x630 down to a cleaner number" edit could
// silently cross without either preset's own test moving.
ok(
  validateImageForInstagram({ width: 1910, height: 1000 }).ok,
  "exactly 1.91:1 (1910x1000) is inside the range — the ceiling is inclusive",
);
ok(
  !validateImageForInstagram({ width: 1911, height: 1000 }).ok,
  "1.911:1 — one part in a thousand over the ceiling — is rejected, not rounded away",
);
ok(
  validateImageForInstagram({ width: 800, height: 1000 }).ok,
  "exactly 4:5 (800x1000) is inside the range — the floor is inclusive",
);
ok(
  !validateImageForInstagram({ width: 799, height: 1000 }).ok,
  "a hair narrower than 4:5 is rejected",
);

for (const [label, args] of [
  ["no width", { height: 1080 }],
  ["no height", { width: 1080 }],
  ["zero width", { width: 0, height: 1080 }],
  ["negative height", { width: 1080, height: -1 }],
  ["NaN width", { width: NaN, height: 1080 }],
  ["nothing at all", undefined],
]) {
  let threw = false;
  let result;
  try {
    result = validateImageForInstagram(args);
  } catch {
    threw = true;
  }
  ok(!threw, `hostile input (${label}) does not throw`);
  ok(result?.ok === false, `…and is correctly refused, not silently accepted`, result);
}

section("10. Portrait 4:5 is the default for NEW posts; every existing design keeps its square");

// Owner, 2026-09-28: new Instagram posts are 4:5, not 1:1. Added as a NEW key
// so no saved layout (filed under its ratioKey) changes meaning.
const portrait = ratio("instagram_portrait");
ok(portrait && portrait.width === 1080 && portrait.height === 1350, "instagram_portrait is 1080x1350 — Instagram's recommended feed size", portrait);
ok(DEFAULT_RATIO === "instagram_portrait", "…and it is the default a NEW design opens on", DEFAULT_RATIO);
ok(igOk("instagram_portrait"), "…and passes Instagram's gate — it sits exactly on the 4:5 floor, which is inclusive");
ok(portrait.width >= 320 && portrait.width <= 1440, "…at a width inside Instagram's 320–1440 range, so Meta does not rescale it");
const square = ratio("instagram_post");
ok(square && square.width === 1080 && square.height === 1080 && square.file === "instagram-post",
  "the square is still instagram_post, 1080x1080, still downloading as …-instagram-post.png", square);
ok(LEGACY_DEFAULT_RATIO === "instagram_post", "the pre-2026-09-28 default is named, for the designs made on it");

// openingRatio(): the editor's first tab. For every design saved before the
// default moved, the answer must be the one the old rule gave.
const oldRule = (keys) => (keys.includes("instagram_post") ? "instagram_post" : keys[0] || "instagram_post");
for (const keys of [
  ["instagram_post"],
  ["facebook_feed", "instagram_post"],
  ["instagram_story", "tiktok", "facebook_feed", "instagram_post", "youtube_thumb"],
  ["facebook_feed"],
  ["youtube_thumb", "tiktok"],
]) {
  ok(openingRatio(keys) === oldRule(keys), `an existing design saved as [${keys.join(", ")}] opens exactly where it did (${oldRule(keys)})`, openingRatio(keys));
}
ok(openingRatio([]) === "instagram_portrait", "a design with nothing saved is new, and opens on portrait");
ok(openingRatio(["instagram_post", "instagram_portrait"]) === "instagram_portrait", "a design that HAS a portrait layout opens on it");
ok(openingRatio(undefined) === "instagram_portrait" && openingRatio([null, 7]) === "instagram_portrait",
  "hostile input (undefined, non-strings) does not throw and falls to the default");

// defaultPublishShape(): the Publish dialog's first shape. It was always the
// square; it only becomes portrait for a portrait design.
ok(defaultPublishShape({ savedKeys: ["instagram_post"], activeKey: "instagram_post" }) === "instagram_post",
  "an existing square design's Publish dialog starts on Square, as it always did");
ok(defaultPublishShape({ savedKeys: ["facebook_feed", "instagram_story"], activeKey: "facebook_feed" }) === "instagram_post",
  "…and so does one on any other tab — the dialog's old starting shape");
ok(defaultPublishShape({ savedKeys: [], activeKey: "instagram_portrait" }) === "instagram_portrait",
  "a NEW design (opened on the portrait tab) starts on Portrait");
ok(defaultPublishShape({ savedKeys: ["instagram_portrait"], activeKey: "tiktok" }) === "instagram_portrait",
  "a design with a saved portrait layout starts on Portrait whichever tab is open");
ok(defaultPublishShape() === "instagram_post" && defaultPublishShape({ savedKeys: "nope" }) === "instagram_post",
  "hostile input does not throw and starts on the square");

// The dialog offers the portrait, keeps the square, and never starts anywhere
// it does not offer.
const modal = readFileSync("app/components/designer/PublishModal.js", "utf8");
const shapeBlock = modal.slice(modal.indexOf("const SHAPES = ["), modal.indexOf("];", modal.indexOf("const SHAPES = [")));
for (const k of ["instagram_portrait", "instagram_post", "facebook_feed"]) {
  ok(shapeBlock.includes(`key: "${k}"`), `PublishModal offers ${k}`);
}
ok(!/instagram_story|tiktok/.test(shapeBlock), "…and still never a 9:16 shape Instagram's feed endpoint would refuse");
for (const k of shapeBlock.match(/key: "([a-z_]+)"/g).map((m) => m.slice(6, -1))) {
  ok(igOk(k), `…every offered shape (${k}) passes Instagram's gate`);
  ok(checkImageForFacebookFeed(ratio(k)).warnings.length === 0, `…and shows in full in Facebook's feed (${k})`);
}
ok(/initialShape/.test(modal) && /FALLBACK_SHAPE = "instagram_post"/.test(modal),
  "PublishModal starts on the caller's initialShape, falling back to the square");
const editor = readFileSync("app/components/designer/CampaignEditor.js", "utf8");
ok(/initialShape=\{defaultPublishShape\(/.test(editor), "CampaignEditor hands PublishModal defaultPublishShape()'s answer");
ok(/openingRatio\(\(design\.layouts/.test(editor), "CampaignEditor opens on openingRatio(), not DEFAULT_RATIO directly");

section("11. Facebook's pre-post check — warns about the feed crop, never refuses");

// 4:5 is the tallest shape Facebook's feed shows uncropped. The check must
// bite just below it, not at it, and must never become a refusal.
for (const [label, w, h, expectWarn] of [
  ["0.5 (1:2)", 500, 1000, true],
  ["0.79", 790, 1000, true],
  ["a hair under 0.8 (1080x1351)", 1080, 1351, true],
  ["exactly 0.8 (1080x1350)", 1080, 1350, false],
  ["exactly 0.8 (800x1000)", 800, 1000, false],
  ["1 (square)", 1080, 1080, false],
  ["1.91", 1910, 1000, false],
  ["1.92 (wider than Instagram allows)", 1920, 1000, false],
  ["9:16 Story", 1080, 1920, true],
]) {
  const r = checkImageForFacebookFeed({ width: w, height: h });
  ok(expectWarn ? r.warnings.includes("feed_crop") : r.warnings.length === 0,
    `${label}: ${expectWarn ? "warns feed_crop" : "no warning"}`, r);
  ok(!("ok" in r), `…${label} returns no \`ok\` — there is nothing for a submit gate to wire to`);
}
for (const [label, args] of [
  ["NaN width", { width: NaN, height: 1080 }],
  ["NaN height", { width: 1080, height: NaN }],
  ["zero width", { width: 0, height: 1080 }],
  ["zero height", { width: 1080, height: 0 }],
  ["zero both", { width: 0, height: 0 }],
  ["Infinity height", { width: 1080, height: Infinity }],
  ["negative", { width: -1080, height: 1350 }],
  ["strings", { width: "1080", height: "1920" }],
  ["garbage strings", { width: "wide", height: "tall" }],
  ["nothing at all", undefined],
]) {
  let threw = false;
  let r;
  try {
    r = checkImageForFacebookFeed(args);
  } catch {
    threw = true;
  }
  ok(!threw, `hostile input (${label}) does not throw`);
  if (label === "strings") {
    ok(r?.warnings.includes("feed_crop"), "…numeric strings are measured like numbers (1080x1920 warns)", r);
  } else {
    ok(Array.isArray(r?.warnings) && r.warnings.length === 0, `…and ${label} says nothing rather than inventing a crop`, r);
  }
}
// The refusal gate is untouched: a tall image is still ok for Facebook.
ok(validateImageForFacebook({ fileSizeBytes: 1000 }).ok === true && !("warnings" in validateImageForFacebook({ fileSizeBytes: 1000 })),
  "validateImageForFacebook() — the REFUSAL gate — is unchanged: same shape, no warnings key");
ok(/platforms\.facebook && facebookFeedCheck\?\.warnings\.includes\("feed_crop"\)/.test(modal),
  "PublishModal shows the feed-crop warning only when Facebook is a selected destination");
{
  const start = modal.indexOf("const canSubmit =");
  const canSubmitExpr = modal.slice(start, modal.indexOf(";", start));
  ok(start > 0 && /imageOk/.test(canSubmitExpr) && !/facebookFeedCheck|feed_crop/.test(canSubmitExpr),
    "…and the warning is NOT part of canSubmit — it never blocks the post", canSubmitExpr);
}

section("12. Meta's shape refusal gets its own sentence");

const G = (e) => classifyMetaPublishError({ name: "MetaGraphError", message: "m", ...e });
ok(G({ code: 36003, subcode: 2207009 }).code === "meta_media_shape", "36003 / 2207009 (Meta: aspect ratio cannot be published) → meta_media_shape");
ok(G({ code: 36003 }).code === "meta_media_shape", "36003 with no subcode → meta_media_shape");
ok(G({ code: 100, message: "The aspect ratio is not supported." }).code === "meta_media_shape", "a generic code whose text names the aspect ratio → meta_media_shape");
ok(G({ code: 36003, subcode: 2207009 }).retryable === false, "…and no retry is offered: the same image fails identically");
ok(G({ code: 36000, subcode: 2207004 }).code === "meta_media_rejected", "36000 / 2207004 (too large) is still meta_media_rejected");
ok(G({ code: 36001, subcode: 2207005 }).code === "meta_media_rejected", "36001 / 2207005 (format) is still meta_media_rejected");
ok(G({ code: 190, message: "aspect ratio" }).code === "meta_auth", "an auth error is never re-labelled by its text");
ok(G({ code: 4, message: "aspect ratio" }).code === "rate_limited", "…nor is a rate limit");
ok(/meta_media_shape:\s*"app\.marketingDesigner\.publishModal\.failureMediaShape"/.test(modal), "the modal translates meta_media_shape");

section("13. Every new sentence exists in every app language");

const NEW_KEYS = [
  "app.marketingDesigner.publishModal.shapePortrait",
  "app.marketingDesigner.publishModal.facebookFeedCrop",
  "app.marketingDesigner.publishModal.failureMediaShape",
];
for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  for (const k of NEW_KEYS) {
    ok(typeof dict[k] === "string" && dict[k].trim().length > 0, `${code}: ${k.split(".").pop()}`);
  }
  ok(/4:5/.test(dict["app.marketingDesigner.publishModal.shapePortrait"] || ""), `${code}: the portrait label says 4:5`);
  if (code !== "en") {
    for (const k of NEW_KEYS.slice(1)) {
      ok(dict[k] !== APP_MESSAGES.en[k], `${code}: ${k.split(".").pop()} is translated, not English copied across`);
    }
  }
}
ok(Object.keys(APP_MESSAGES).length === 9, "…across all nine app languages", Object.keys(APP_MESSAGES));

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
