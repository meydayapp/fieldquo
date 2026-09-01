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
import { AD_RATIOS, DEFAULT_RATIO, ratio, reflow, overflowing, assetFilename } from "@/lib/marketing/ratios";
import { validateImageForInstagram, INSTAGRAM_COMPLIANT_RATIO_KEY } from "@/lib/social/metaSpecs";

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

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
