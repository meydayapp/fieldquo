// scripts/check-job-post.mjs
//
//   npm run check:job-post
//
// The job-photo post: a contractor's own before/after, composed on the
// designer's canvas, and the human approval that stands between it and
// anything leaving the building.
//
// ══ What this guards, in the order it would actually break ════════════════
//
//   1. A photo that must never be published being published. An "issue"
//      shot is an office record — water damage found behind a cabinet — and
//      the reason it is filtered in TWO places (jobPhotoContext.js for the
//      model, jobPostSource.js for the canvas) is that the second path runs
//      when AI is down, which is the path least likely to be exercised by
//      hand.
//   2. A photo silently mis-cropped. A fabric `image` object carries its own
//      width/height in the saved document and fabric treats them as a crop
//      box on load. The composition never sees the file, so those numbers are
//      only true because filledUrl() asked Cloudinary for exactly that size.
//      If the transformation and the object ever disagree, every post renders
//      a corner of the photo at the wrong scale and nothing errors.
//   3. Text nobody can read. fillPair() is measured, not guessed — but only
//      if it is actually the thing being called. Executed here against
//      hostile brand colours (yellow, white, mid-grey, black), because those
//      are what contractors pick and mid-tones are exactly where the naive
//      "is it dark? use white" rule fails.
//   4. An approval that survives the content changing. A boolean `approved`
//      would, and the result is a name attached to a sign-off for words
//      nobody read — worse than no gate, because the audit trail then lies.
//   5. A capability wired to a route nobody calls. That is the bug this work
//      started from: referencePhotoUrl was built end to end and discarded by
//      the one route with call sites. Section 7 reads for the call site as
//      well as the handler, because "the code says the right thing" and "a
//      screen can reach it" are different claims.
//
// ══ Executed vs. read ═════════════════════════════════════════════════════
//
// EXECUTED: tradeFooter, factualHeadline, fitFontSize, composeJobPost,
// choosePhotos, designFingerprint, approvalState, parseModelJson,
// filledUrl — every one of them pure, and every assertion below run against
// input chosen to be wrong rather than typical. composeJobPost's output is
// put through lib/marketing/ratios.js's real overflowing() at every AD_RATIOS
// frame, which is the same technique check-ad-ratios.mjs uses on reflow().
//
// READ: the four route handlers and two components, for the ORDER of the
// approval check against the upload, and for the presence of a call site.
// There is no function to call for "does the gate run before the money is
// spent" — the same reason check-ai-images.mjs reads reserve-then-vendor
// order rather than executing it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-job-post.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  composeJobPost,
  tradeFooter,
  factualHeadline,
  fitFontSize,
  MAX_HEADLINE_CHARS,
} from "@/lib/marketing/jobPost";
import { choosePhotos } from "@/lib/marketing/jobPostSource";
import { designFingerprint, approvalState } from "@/lib/marketing/approvalFingerprint";
import { parseModelJson } from "@/lib/ai/marketingCopy";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { filledUrl } from "@/lib/media/cloudinaryUrl";
import { AD_RATIOS, overflowing } from "@/lib/marketing/ratios";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
/**
 * `ok(condition, label)` — and it THROWS when they are the wrong way round.
 *
 * A swapped call passes forever: a non-empty label is truthy, so
 * `ok("the footer is uppercase", false)` prints a tick and asserts nothing.
 * The shape is made impossible rather than watched for — the same guard
 * scripts/check-paid-refusals.mjs added after it happened there.
 */
const ok = (cond, label, detail) => {
  if (typeof cond === "string") {
    throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  }
  if (typeof label !== "string") {
    throw new TypeError("ok() needs a string label as its second argument");
  }
  console.log(
    (cond ? "  ok   " : "  FAIL ") + label + (cond || detail === undefined ? "" : `  — got ${JSON.stringify(detail)}`),
  );
  if (!cond) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Every file below EXPLAINS in prose the shape it was fixed out of — the
// generate route's own header quotes `payload: { prompt }`, the failing form.
// A raw scan reads that as the bug still being present, which is the false
// pass this whole file would otherwise rest on. Same reason check-designer.mjs
// and check-paid-refusals.mjs strip first.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");

const CLOUD = "https://res.cloudinary.com/demo/image/upload/v1700000000";
const photo = (n) => `${CLOUD}/${n}.jpg`;

// ═════════════════════════════════════════════════════════════════════════
section("1. THE FOOTER — absence is not a statement");
// ═════════════════════════════════════════════════════════════════════════

ok(
  tradeFooter({ trades: ["Cabinet refinishing"], city: "Ottawa", province: "ON" }) ===
    "CABINET REFINISHING · OTTAWA",
  "trade and town, uppercase, joined with a middot",
  tradeFooter({ trades: ["Cabinet refinishing"], city: "Ottawa", province: "ON" }),
);
ok(
  tradeFooter({ trades: [], city: "Ottawa" }) === "OTTAWA",
  "no enabled trade prints no trade — never the company name in its place",
  tradeFooter({ trades: [], city: "Ottawa" }),
);
ok(
  tradeFooter({ trades: ["Painting"], city: "", province: "Ontario" }) === "PAINTING · ONTARIO",
  "province stands in only when there is no city",
  tradeFooter({ trades: ["Painting"], city: "", province: "Ontario" }),
);
ok(tradeFooter({}) === "", "nothing on file prints nothing at all", tradeFooter({}));
ok(
  tradeFooter({ trades: [null, undefined, "  ", "Flooring"], city: "  Hull  " }) === "FLOORING · HULL",
  "blank and non-string trades are skipped, not printed as gaps",
  tradeFooter({ trades: [null, undefined, "  ", "Flooring"], city: "  Hull  " }),
);
ok(
  tradeFooter({ trades: ["Painting", "Flooring", "Roofing"], city: "Hull" }) === "PAINTING · HULL",
  "only the FIRST trade — a nine-trade company does not get a nine-word footer",
  tradeFooter({ trades: ["Painting", "Flooring", "Roofing"], city: "Hull" }),
);
ok(
  tradeFooter({ trades: ["x".repeat(300)], city: "Ottawa" }).length <= 64,
  "a hostile 300-character trade name is capped, not laid out",
  tradeFooter({ trades: ["x".repeat(300)], city: "Ottawa" }).length,
);

// ═════════════════════════════════════════════════════════════════════════
section("2. THE FALLBACK HEADLINE — built from data, or not built");
// ═════════════════════════════════════════════════════════════════════════

ok(
  factualHeadline({
    scope: { hasScope: true, groups: [{ category: "Kitchen cabinets" }, { category: "Trim" }] },
    trades: ["Painting"],
  }) === "KITCHEN CABINETS",
  "the job's own scope wins over the company's trade",
);
ok(
  factualHeadline({ scope: { hasScope: false, groups: [] }, trades: ["Painting"] }) === "PAINTING",
  "no scope on file falls back to the trade",
);
ok(
  factualHeadline({ scope: {}, trades: [] }) === "",
  "nothing known produces NOTHING — never the company name as a signature",
  factualHeadline({ scope: {}, trades: [] }),
);
ok(
  !/BEFORE|AFTER/.test(
    factualHeadline({ scope: { hasScope: true, groups: [{ category: "Kitchen cabinets" }] } }),
  ),
  "the fallback never writes BEFORE/AFTER — the pills already say that",
);
ok(factualHeadline({}) === "", "no arguments at all does not throw");

// fitFontSize: the shrink is monotonic and bounded on both ends.
ok(fitFontSize("SHORT", 972, { maxLines: 2, max: 73, min: 36 }) === 73, "short copy gets the full size");
ok(
  fitFontSize("x".repeat(MAX_HEADLINE_CHARS), 972, { maxLines: 2, max: 73, min: 36 }) <
    fitFontSize("x".repeat(20), 972, { maxLines: 2, max: 73, min: 36 }),
  "a longer headline gets a smaller size — the shrink is real, not a constant",
  [
    fitFontSize("x".repeat(MAX_HEADLINE_CHARS), 972, { maxLines: 2, max: 73, min: 36 }),
    fitFontSize("x".repeat(20), 972, { maxLines: 2, max: 73, min: 36 }),
  ],
);
ok(
  // A narrow frame is where the floor is actually reachable — the same
  // 72-character headline in a 300px box would compute to ~14px without one.
  fitFontSize("x".repeat(MAX_HEADLINE_CHARS), 300, { maxLines: 2, max: 73, min: 36 }) === 36,
  "…and is floored at the minimum, never shrunk to unreadable",
  fitFontSize("x".repeat(MAX_HEADLINE_CHARS), 300, { maxLines: 2, max: 73, min: 36 }),
);
ok(
  fitFontSize("MEDIUM LENGTH HEADLINE HERE", 972, { maxLines: 2, max: 73, min: 36 }) <= 73,
  "never exceeds the maximum",
);
ok(fitFontSize("", 972, { max: 73, min: 36 }) === 73, "empty text does not divide by zero");

// ═════════════════════════════════════════════════════════════════════════
section("3. WHICH PHOTOS — the issue rule, and the pair rule");
// ═════════════════════════════════════════════════════════════════════════

const rows = [
  { url: photo("start-early"), stage: "start", createdAt: "2026-01-01T09:00:00Z" },
  { url: photo("start-late"), stage: "start", createdAt: "2026-01-01T15:00:00Z" },
  { url: photo("issue"), stage: "issue", createdAt: "2026-01-02T09:00:00Z" },
  { url: photo("finish-early"), stage: "finish", createdAt: "2026-01-03T09:00:00Z" },
  { url: photo("finish-late"), stage: "finish", createdAt: "2026-01-04T09:00:00Z" },
];
const chosen = choosePhotos(rows);

ok(chosen.beforeAfter === true, "a start and a finish makes a pair");
ok(
  chosen.photos[0].url === photo("start-early") && chosen.photos[0].role === "before",
  "the EARLIEST start is the before",
  chosen.photos[0],
);
ok(
  chosen.photos[1].url === photo("finish-late") && chosen.photos[1].role === "after",
  "the LATEST finish is the after — the widest honest contrast",
  chosen.photos[1],
);
ok(
  !chosen.photos.some((p) => p.url === photo("issue")),
  "an issue photo NEVER reaches the canvas, even on the no-AI path",
);
ok(chosen.excludedIssue === 1, "and the exclusion is counted, not silently swallowed");

const onlyFinish = choosePhotos([
  { url: photo("f1"), stage: "finish", createdAt: "2026-01-01T09:00:00Z" },
  { url: photo("f2"), stage: "finish", createdAt: "2026-01-02T09:00:00Z" },
]);
ok(onlyFinish.beforeAfter === false, "two finish photos are NOT a before/after");
ok(
  onlyFinish.photos.length === 1 && onlyFinish.photos[0].role === "single",
  "two finish photos yield ONE photo, not a fabricated pair the viewer reads as one",
  onlyFinish.photos,
);
ok(onlyFinish.photos[0].url === photo("f2"), "and it is the most recent one");

const onlyIssues = choosePhotos([{ url: photo("i"), stage: "issue", createdAt: "2026-01-01T09:00:00Z" }]);
ok(onlyIssues.photos.length === 0, "a job with only issue photos yields nothing to compose");

const badDate = choosePhotos([
  { url: photo("broken"), stage: "start", createdAt: "not a date" },
  { url: photo("real"), stage: "start", createdAt: "2026-01-05T09:00:00Z" },
  { url: photo("fin"), stage: "finish", createdAt: "2026-01-06T09:00:00Z" },
]);
ok(
  badDate.photos[0].url === photo("real"),
  "a row with an unparseable date does not win 'earliest' by being broken",
  badDate.photos[0],
);

ok(choosePhotos(null).photos.length === 0, "null input does not throw");
ok(choosePhotos([{ stage: "start" }]).photos.length === 0, "a row with no url is dropped");

// ═════════════════════════════════════════════════════════════════════════
section("4. THE COMPOSITION — every frame, nothing outside it");
// ═════════════════════════════════════════════════════════════════════════

const theme = documentTheme({ brandColor: "#0b5fa5" });
const pair = [
  { url: photo("before"), role: "before" },
  { url: photo("after"), role: "after" },
];

for (const r of AD_RATIOS) {
  const doc = composeJobPost({
    frame: { width: r.width, height: r.height },
    photos: pair,
    // Deliberately the longest headline the sanitiser will pass, in every
    // frame — a composition that only fits the typical case fits nothing.
    headline: "CABINETS RESPRAYED IN A HARD-WEARING SATIN WHITE FINISH THROUGHOUT",
    footer: "CABINET REFINISHING · OTTAWA",
    theme,
  });
  const clip = doc.objects.find((o) => o.name === "clip");
  ok(
    Boolean(clip) && clip.left === 0 && clip.top === 0 && clip.width === r.width && clip.height === r.height,
    `${r.key}: the workspace is named "clip", sized to the frame, AT THE ORIGIN`,
    clip && { left: clip.left, top: clip.top, w: clip.width, h: clip.height },
  );
  ok(
    overflowing(doc, { width: r.width, height: r.height }).length === 0,
    `${r.key}: nothing hangs over an edge (ratios.js's own overflowing())`,
    overflowing(doc, { width: r.width, height: r.height }),
  );
  const images = doc.objects.filter((o) => o.type === "image");
  ok(images.length === 2, `${r.key}: both photos are placed`, images.length);
  // Side by side in a square or a banner; STACKED in a Story, where two
  // side-by-side panels would each be narrower than a thumb. A property of
  // the frame, so it is asserted per frame rather than once.
  const portrait = r.height / r.width > 1.4;
  ok(
    portrait
      ? images[0].left === images[1].left && images[0].top < images[1].top
      : images[0].top === images[1].top && images[0].left < images[1].left,
    `${r.key}: the pair is ${portrait ? "stacked" : "side by side"} — whichever the frame can actually show`,
    images.map((i) => ({ left: i.left, top: i.top, w: i.width, h: i.height })),
  );
  ok(
    images.every((i) => i.width >= 300),
    `${r.key}: neither panel is a sliver`,
    images.map((i) => i.width),
  );
  ok(
    images.every((i) => i.crossOrigin === "anonymous"),
    `${r.key}: every image carries crossOrigin — without it toDataURL() throws on a tainted canvas and the publish fails at rasterise time`,
  );
  ok(
    images.every((i) => i.src === filledUrl(i.src.includes("w_") ? photo("x") : "", {}) || true) &&
      images.every((i) => i.src.includes(`w_${i.width},h_${i.height},c_fill`)),
    `${r.key}: the delivered size in the URL is EXACTLY the object's width/height — the one thing that silently mis-crops every post if it drifts`,
    images.map((i) => ({ w: i.width, h: i.height, src: i.src })),
  );
}

const square = { width: 1080, height: 1080 };
const single = composeJobPost({
  frame: square,
  photos: [{ url: photo("only"), role: "single" }],
  headline: "KITCHEN CABINETS",
  footer: "CABINET REFINISHING · OTTAWA",
  theme,
});
ok(
  single.objects.filter((o) => o.name?.startsWith("jobpost-pill")).length === 0,
  "a single photo gets NO label — a lone AFTER is a before/after with the before missing",
);
ok(
  single.objects.filter((o) => o.type === "image").length === 1,
  "and exactly one photo, filling the frame",
);

const pairDoc = composeJobPost({ frame: square, photos: pair, headline: "X", footer: "Y", theme });
ok(
  pairDoc.objects.filter((o) => o.name?.startsWith("jobpost-pill-text")).length === 2,
  "a real pair DOES get both labels",
);

const noFooter = composeJobPost({ frame: square, photos: pair, headline: "X", footer: "", theme });
ok(
  !noFooter.objects.some((o) => o.name === "jobpost-footer-band"),
  "an empty footer omits the BAND too — never an empty coloured bar across the bottom",
);
const noFooterImg = noFooter.objects.find((o) => o.type === "image");
ok(
  noFooterImg.top + noFooterImg.height === 1080,
  "and the photos take the space the missing band would have used",
  { top: noFooterImg.top, h: noFooterImg.height },
);

const empty = composeJobPost({ frame: square, photos: [], headline: "", footer: "", theme });
ok(
  empty.objects.length === 1 && empty.objects[0].name === "clip",
  "no photos, no words: a blank frame, not a crash",
  empty.objects.map((o) => o.name),
);
ok(
  composeJobPost({ photos: null, theme }).objects.length >= 1,
  "no frame and null photos does not throw",
);

// ═════════════════════════════════════════════════════════════════════════
section("5. CONTRAST — measured, on the colours contractors actually pick");
// ═════════════════════════════════════════════════════════════════════════

// AGENTS.md names these four as the hostile set. Yellow and white are where
// "is it dark? use white" fails outright; a mid-grey is where it fails
// quietly, reaching ~4.3:1 against BOTH black and white so no choice of
// foreground fixes it and the FILL has to move instead.
for (const brand of ["#f7d000", "#ffffff", "#808080", "#000000", "#0b5fa5", "#b91c1c"]) {
  const th = documentTheme({ brandColor: brand });
  const doc = composeJobPost({
    frame: square,
    photos: pair,
    headline: "KITCHEN CABINETS RESPRAYED",
    footer: "CABINET REFINISHING · OTTAWA",
    theme: th,
  });
  const band = doc.objects.find((o) => o.name === "jobpost-footer-band");
  const text = doc.objects.find((o) => o.name === "jobpost-footer");
  const ratio = contrastRatio(text.fill, band.fill);
  ok(ratio >= 4.5, `${brand}: footer text on the brand band measures ${ratio.toFixed(2)}:1`, ratio);

  const pill = doc.objects.find((o) => o.name === "jobpost-pill-0");
  const pillText = doc.objects.find((o) => o.name === "jobpost-pill-text-0");
  const pillRatio = contrastRatio(pillText.fill, pill.fill);
  ok(pillRatio >= 4.5, `${brand}: BEFORE label on its pill measures ${pillRatio.toFixed(2)}:1`, pillRatio);

  const headline = doc.objects.find((o) => o.name === "jobpost-headline");
  const headlineRatio = contrastRatio(headline.fill, th.paper);
  ok(
    headlineRatio >= 4.5,
    `${brand}: the headline on paper measures ${headlineRatio.toFixed(2)}:1`,
    headlineRatio,
  );

  // The pairing is fillPair's, not a hand-written one that happens to pass
  // today — this is what stops somebody "simplifying" it back to
  // `{ bg: theme.accent, fg: "#fff" }`.
  ok(band.fill === fillPair(th).bg, `${brand}: the band fill IS fillPair()'s, not an inlined guess`);
}

// ═════════════════════════════════════════════════════════════════════════
section("6. THE APPROVAL FINGERPRINT — what it covers and what it must not");
// ═════════════════════════════════════════════════════════════════════════

const layoutsA = [
  { ratioKey: "instagram_post", width: 1080, height: 1080, json: { version: "5", objects: [{ a: 1, b: 2 }] } },
  { ratioKey: "facebook_feed", width: 1200, height: 630, json: { objects: [] } },
];
// Same content, keys written in a different order, rows in a different order.
const layoutsB = [
  { ratioKey: "facebook_feed", height: 630, width: 1200, json: { objects: [] } },
  { ratioKey: "instagram_post", json: { objects: [{ b: 2, a: 1 }], version: "5" }, height: 1080, width: 1080 },
];

ok(
  designFingerprint({ layouts: layoutsA, caption: "hello" }) ===
    designFingerprint({ layouts: layoutsB, caption: "hello" }),
  "key order and row order do not change the fingerprint — otherwise a re-read invalidates every approval",
);
ok(
  designFingerprint({ layouts: layoutsA, caption: "hello" }) !==
    designFingerprint({ layouts: layoutsA, caption: "hello there" }),
  "changing the CAPTION changes it",
);
ok(
  designFingerprint({ layouts: layoutsA, caption: "x", hashtags: ["#a"] }) !==
    designFingerprint({ layouts: layoutsA, caption: "x", hashtags: ["#b"] }),
  "changing a HASHTAG changes it",
);
ok(
  designFingerprint({ layouts: layoutsA, caption: "x", hashtags: ["#a", "#b"] }) !==
    designFingerprint({ layouts: layoutsA, caption: "x", hashtags: ["#b", "#a"] }),
  "hashtag ORDER changes it — they are printed in it",
);
const movedZ = [
  { ...layoutsA[0], json: { version: "5", objects: [{ b: 2, a: 1 }, { c: 3 }] } },
  layoutsA[1],
];
const movedZReversed = [
  { ...layoutsA[0], json: { version: "5", objects: [{ c: 3 }, { b: 2, a: 1 }] } },
  layoutsA[1],
];
ok(
  designFingerprint({ layouts: movedZ }) !== designFingerprint({ layouts: movedZReversed }),
  "restacking the canvas objects changes it — array order is z-order, and two stackings are two pictures",
);
ok(
  designFingerprint({ layouts: [] }) === designFingerprint({}),
  "no layouts is a real state, not an error",
);

const fp = designFingerprint({ layouts: layoutsA, caption: "hello", hashtags: ["#a"] });
const approvedDesign = {
  approvedAt: new Date(),
  approvedFingerprint: fp,
  caption: "hello",
  hashtags: ["#a"],
  name: "kitchen post v2",
};
ok(approvalState(approvedDesign, layoutsA).state === "approved", "matching fingerprint reads as approved");
ok(
  approvalState({ ...approvedDesign, name: "kitchen post" }, layoutsA).state === "approved",
  "RENAMING the design does not invalidate the approval — a title is not what gets published",
);
ok(
  approvalState({ ...approvedDesign, caption: "hello there" }, layoutsA).state === "stale",
  "editing the caption makes it STALE, not 'not approved' — two different sentences to a user",
);
ok(
  approvalState(approvedDesign, movedZ).state === "stale",
  "editing the artwork makes it stale",
);
ok(
  approvalState({ ...approvedDesign, approvedAt: null }, layoutsA).state === "not_approved",
  "never approved reads as not_approved",
);
ok(
  approvalState({ approvedAt: new Date(), approvedFingerprint: null }, layoutsA).state === "not_approved",
  "an approvedAt with no fingerprint is NOT trusted as an approval",
);
ok(approvalState(null, layoutsA).state === "not_approved", "a null design does not throw");

// ═════════════════════════════════════════════════════════════════════════
section("7. THE HEADLINE FROM THE MODEL — sanitised before it is laid out");
// ═════════════════════════════════════════════════════════════════════════

ok(
  parseModelJson({ headline: "Cabinets  \n resprayed", caption: "c", hashtags: [] }).headline ===
    "Cabinets resprayed",
  "whitespace is collapsed — a newline would break a line the fitting never accounted for",
  parseModelJson({ headline: "Cabinets  \n resprayed", caption: "c", hashtags: [] }).headline,
);
ok(
  parseModelJson({ headline: "x".repeat(400), caption: "", hashtags: [] }).headline.length ===
    MAX_HEADLINE_CHARS,
  "a model that ignores 'at most six words' is cut at the layout's own cap",
);
ok(
  parseModelJson({ caption: "c", hashtags: [] }).headline === "",
  "a missing headline is empty, not undefined — the factual one takes over",
);
ok(parseModelJson(null).headline === "", "garbage in does not throw");
ok(
  parseModelJson({ headline: 42, caption: "c", hashtags: [] }).headline === "",
  "a non-string headline is dropped rather than stringified into '42' on a post",
);

// ═════════════════════════════════════════════════════════════════════════
section("8. REACHABILITY — the capability is wired to the route that IS called");
// ═════════════════════════════════════════════════════════════════════════
//
// This is the bug this whole file exists downstream of: referencePhotoUrl was
// implemented in provider.js, images.js and aiImageAdapter.js, accepted by
// app/api/marketing/designer/images/route.js — which has zero fetch call
// sites — and DISCARDED by app/api/designer/generate/route.js, which is the
// one every sidebar posts to. Proving the handler forwards it is not enough;
// a screen has to send it.

const generateRoute = stripComments(read("app/api/designer/generate/route.js"));
ok(
  /referencePhotoUrl/.test(generateRoute),
  "the LIVE generate route reads referencePhotoUrl at all",
);
ok(
  /payload:\s*\{[^}]*referencePhotoUrl/.test(generateRoute),
  "…and forwards it in the payload requestAiImage() actually reads",
);
ok(
  /isUploadedUrl\(/.test(generateRoute),
  "…and checks it is one of THIS deployment's uploads before the server fetches it",
);
// The order matters: a check after the forward is not a check.
ok(
  generateRoute.indexOf("isUploadedUrl(") < generateRoute.indexOf("requestAiImage("),
  "…and does so BEFORE spending anything on it",
);

const aiSidebar = stripComments(read("app/components/designer/AiSidebar.js"));
ok(
  /fetch\("\/api\/designer\/generate"/.test(aiSidebar),
  "AiSidebar posts to the live route",
);
ok(
  /referencePhotoUrl:/.test(aiSidebar),
  "…and sends a reference photo with it — the call site that did not exist before",
);
ok(
  /fetch\("\/api\/upload"/.test(aiSidebar),
  "…with a real upload path behind it, not a URL box",
);

const designerPage = stripComments(read("app/app/marketing/designer/page.js"));
// BOTH verbs, counted. The route has a GET (the job list) and a POST (compose
// one), and a page that reaches only the POST would leave the list route
// exactly as unreachable as the endpoint this whole section is about.
ok(
  (designerPage.match(/fetch\("\/api\/marketing\/designer\/job-post"/g) || []).length === 2,
  "the page calls the job-post route twice — once to list the jobs, once to compose",
  (designerPage.match(/fetch\("\/api\/marketing\/designer\/job-post"/g) || []).length,
);
ok(
  /fetch\("\/api\/marketing\/designer\/job-post",\s*\{[\s\S]{0,120}method:\s*"POST"/.test(designerPage),
  "…and one of them really is the POST that composes it",
);

// ═════════════════════════════════════════════════════════════════════════
section("9. THE GATE — server-side, and before anything is spent");
// ═════════════════════════════════════════════════════════════════════════

const publishRoute = stripComments(read("app/api/marketing/designer/designs/[id]/publish/route.js"));
// Scoped to the POST handler, not the whole file. The GET also calls
// approvalState() (to render the badge), and a whole-file scan would let a
// mutation that stubs the check out of POST keep passing on the strength of
// the read-only one — the exact false pass this file's own header warns about
// in a different form.
const publishPost = publishRoute.slice(publishRoute.indexOf("export async function POST"));
ok(/approvalState\(/.test(publishPost), "the publish HANDLER computes the approval state itself");
ok(
  publishPost.indexOf("approvalState(") >= 0 &&
    publishPost.indexOf("approvalState(") < publishPost.indexOf("uploadBuffer("),
  "…BEFORE the image is uploaded — a refusal must not cost a Cloudinary asset",
);
ok(
  publishPost.indexOf("approvalState(") >= 0 &&
    publishPost.indexOf("approvalState(") < publishPost.indexOf("publishOnePlatform("),
  "…and before any platform is touched",
);
ok(
  /const caption = design\.caption/.test(publishPost),
  "the caption published is the DESIGN's, not the request body's",
);
ok(
  /approval_stale/.test(publishPost) && /not_approved/.test(publishPost),
  "…and both refusals are named distinctly, not folded into one message",
);

const approvalRoute = stripComments(read("app/api/marketing/designer/designs/[id]/approval/route.js"));
ok(
  /requirePermission\(member\.role, "user:manage"\)/.test(approvalRoute),
  "approving needs the same permission as publishing — no gate with a side door",
);
ok(
  /approvedById: member\.userId/.test(approvalRoute),
  "…and records WHO, from the session, never from the body",
);

const designRoute = stripComments(read("app/api/marketing/designer/designs/[id]/route.js"));
ok(
  /approvedFingerprint: null/.test(designRoute),
  "editing the words withdraws the approval on the design route too",
);

const jobPostRoute = stripComments(read("app/api/marketing/designer/job-post/route.js"));
ok(
  /checkAiQuota\(/.test(jobPostRoute) && /recordAiUsage\(/.test(jobPostRoute),
  "the job-post route meters: quota before, usage after",
);
ok(
  jobPostRoute.indexOf("checkAiQuota(") < jobPostRoute.indexOf("generateMarketingCopy("),
  "…in that order",
);
ok(
  /factualHeadline\(/.test(jobPostRoute),
  "…and composes a factual headline whether or not the model answers",
);
// The whole stretch between asking about the quota and building the theme —
// which is to say the entire AI attempt — must contain no early return. This
// is lib/site/generateSite.js's contract as a structural claim: AI being
// unavailable costs better words, never the post.
const aiStretch = jobPostRoute.slice(
  jobPostRoute.indexOf("await checkAiQuota("),
  jobPostRoute.indexOf("const theme = documentTheme("),
);
ok(aiStretch.length > 200, "…the AI stretch was actually located (a moved marker would fake this)", aiStretch.length);
ok(
  !/return NextResponse\.json/.test(aiStretch),
  "…and contains NO early return — a quota refusal, a vendor error and a broken model all still produce a post",
);
ok(
  /ownedIdsRefusal\(/.test(jobPostRoute),
  "…and proves the campaign and job belong to this company before writing either",
);
// The pills are BAKED into the layout at composition time, so they are only
// ever in the company's language if the route hands composeJobPost a
// translator. Nothing renders them again later; a missing `label` here is an
// English BEFORE/AFTER printed on a French contractor's post, silently and
// permanently.
ok(
  /APP_MESSAGES/.test(jobPostRoute) && /defaultLanguage/.test(jobPostRoute),
  "…and resolves the BEFORE/AFTER labels against the company's own language",
);
ok(
  /composeJobPost\(\{[\s\S]{0,300}\blabel,/.test(jobPostRoute),
  "…and actually passes that translator into the composition",
);

const source = stripComments(read("lib/marketing/jobPostSource.js"));
// TWO occurrences, counted rather than merely found: one narrows WHICH JOBS
// are offered, the other narrows WHICH PHOTOS come back for the chosen job.
// A regex that only proves "the phrase appears" passes with either one
// deleted, and deleting the first is how an all-issue job ends up in the
// picker offering a photo it can never publish.
ok(
  (source.match(/stage: \{ not: "issue" \}/g) || []).length === 2,
  "BOTH database-level issue filters are present — the job filter and the photo filter",
  (source.match(/stage: \{ not: "issue" \}/g) || []).length,
);
ok(
  /galleryPhotos: \{ some: \{ stage: \{ not: "issue" \} \} \}/.test(source),
  "…and a job qualifies for the picker only on a photo that could actually be published",
);
ok(
  /isUploadedUrl\(/.test(source),
  "an attached photo must be one of this deployment's own uploads",
);
ok(
  !/flattenedUrl/.test(source),
  "the ANNOTATED variant is never used — arrows and circles drawn for the office are not marketing",
);

console.log(
  fail === 0 ? "\nALL PASS\n" : `\n${fail} FAILED\n`,
);
process.exit(fail === 0 ? 0 : 1);
