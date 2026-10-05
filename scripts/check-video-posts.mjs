// scripts/check-video-posts.mjs
//
// npm run check:video-posts
//
// Executes the video-post rules (lib/marketing/videoPost.js), the Meta Reel
// glue (lib/social/publishVideo.js) and the TikTok additions against hostile
// input, and pins that the PHOTO publish payloads are byte-for-byte what they
// were before video existed. Sections:
//
//   1. Per-platform limits on hostile lengths, sizes and captions
//   2. 9:16 is enforced — never sent in a shape nobody chose
//   3. Cloudinary URLs: the rendition, the frame, hostile ids
//   4. What each platform is sent, against its own docs' example
//   5. Status mapping: Instagram containers, Facebook phases, TikTok fail_reasons
//   6. The poll: publish exactly once, a failed read is not a failed post
//   7. TikTok: duet/stitch, creator max duration, the media URL serves MP4
//   8. Photo payloads unchanged (md5 against origin/main at the time of writing)
//   9. The routes keep their gates; every code has a sentence in every language
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let checks = 0;
let failures = 0;
const ok = (name, pass, detail = "") => {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail && !pass ? `  — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(p, "utf8");
const md5 = (x) => createHash("md5").update(JSON.stringify(x)).digest("hex");

const vp = await import("../lib/marketing/videoPost.js");
const pv = await import("../lib/social/publishVideo.js");
const specs = await import("../lib/tiktok/specs.js");
const signing = await import("../lib/tiktok/signing.js");
const media = await import("../lib/tiktok/media.js");
const graph = await import("../lib/social/metaGraphClient.js");
const mock = await import("../lib/social/mockMetaGraphClient.js");
const direct = await import("../lib/media/directUpload.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");

const vertical = { width: 1080, height: 1920, durationSec: 30, fit: "original", caption: "New deck #stain", coverMode: "frame", coverOffsetMs: 1000, coverImageUrl: null };
const landscape = { ...vertical, width: 1920, height: 1080 };

// ══ 1 ═══════════════════════════════════════════════════════════════════════
section("1. Per-platform limits on hostile input");

const cases = [
  ["instagram", 2.999, "too_short"], ["instagram", 3, null], ["instagram", 900, null], ["instagram", 900.01, "too_long"],
  ["facebook", 2.9, "too_short"], ["facebook", 3, null], ["facebook", 90, null], ["facebook", 90.5, "too_long"],
  ["tiktok", 600, null], ["tiktok", 600.1, "too_long"],
];
for (const [platform, d, want] of cases) {
  const r = vp.checkForPlatform(platform, { ...vertical, durationSec: d, coverOffsetMs: 0 });
  ok(`${platform} ${d}s → ${want || "ok"}`, want ? r.errors.includes(want) : r.ok, JSON.stringify(r.errors));
}
for (const bad of [NaN, -1, 0, "abc", Infinity, null, undefined]) {
  const r = vp.checkForPlatform("instagram", { ...vertical, durationSec: bad });
  ok(`duration ${String(bad)} → no_duration, never "ok"`, !r.ok && r.errors.includes("no_duration"));
}
ok("no dimensions → refused on every platform", ["instagram", "facebook", "tiktok"].every((p) => vp.checkForPlatform(p, { ...vertical, width: 0 }).errors.includes("no_dimensions")));
ok("unknown platform → refused", !vp.checkForPlatform("myspace", vertical).ok);
ok("a 720x1280 original is small for nothing; 360x640 is too small for Facebook Reels", vp.checkForPlatform("facebook", { ...vertical, width: 720, height: 1280 }).ok && vp.checkForPlatform("facebook", { ...vertical, width: 360, height: 640 }).errors.includes("too_small"));
ok("…and Fit/Crop make it 1080x1920, so Facebook takes it", vp.checkForPlatform("facebook", { ...vertical, width: 640, height: 360, fit: "pad" }).ok);
ok("TikTok min side 360: 180x320 refused", vp.checkForPlatform("tiktok", { ...vertical, width: 180, height: 320 }).errors.includes("video_size_check_failed"));
ok("Instagram needs a caption; Facebook and TikTok do not", vp.checkForPlatform("instagram", { ...vertical, caption: "" }).errors.includes("caption_empty") && vp.checkForPlatform("facebook", { ...vertical, caption: "" }).ok && vp.checkForPlatform("tiktok", { ...vertical, caption: "" }).ok);
ok("caption of 2200 code points passes; 2201 fails", vp.checkForPlatform("instagram", { ...vertical, caption: "é".repeat(2200) }).ok && vp.checkForPlatform("instagram", { ...vertical, caption: "é".repeat(2201) }).errors.includes("caption_too_long"));
ok("31 hashtags / 21 mentions refused for Instagram", vp.checkForPlatform("instagram", { ...vertical, caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ") }).errors.includes("too_many_hashtags") && vp.checkForPlatform("instagram", { ...vertical, caption: Array.from({ length: 21 }, (_, i) => `@u${i}`).join(" ") }).errors.includes("too_many_mentions"));
ok("TikTok caption counts UTF-16 units (emoji = 2)", vp.checkForPlatform("tiktok", { ...vertical, caption: "😀".repeat(1100) }).ok && vp.checkForPlatform("tiktok", { ...vertical, caption: "😀".repeat(1101) }).errors.includes("caption_too_long"));
ok("cover frame at/after the end refused (IG 2207057's rule)", vp.checkForPlatform("instagram", { ...vertical, coverOffsetMs: 30000 }).errors.includes("cover_offset_out_of_range") && vp.checkForPlatform("instagram", { ...vertical, coverOffsetMs: 29999 }).ok);
ok("cover frame negative / fractional / string refused", [-1, 1.5, "10"].every((ms) => vp.checkForPlatform("tiktok", { ...vertical, coverOffsetMs: ms }).errors.includes("cover_offset_out_of_range")));
ok("uploaded cover with no picture refused for Instagram", vp.checkForPlatform("instagram", { ...vertical, coverMode: "image", coverImageUrl: null }).errors.includes("cover_image_missing"));
ok("uploaded cover as javascript: URL refused", vp.checkForPlatform("instagram", { ...vertical, coverMode: "image", coverImageUrl: "javascript:alert(1)" }).errors.includes("cover_image_missing"));

const upload = (f) => vp.checkUploadedVideo(f);
ok("created: 3 s – 2:30, real video only", upload({ resourceType: "video", width: 1, height: 1, durationSec: 3 }).ok && upload({ resourceType: "video", width: 1, height: 1, durationSec: 150 }).ok && !upload({ resourceType: "video", width: 1, height: 1, durationSec: 151 }).ok && !upload({ resourceType: "image", width: 1, height: 1, durationSec: 5 }).ok && !upload(null).ok);
ok("created: over 2 GB refused, 900 MB accepted", upload({ resourceType: "video", width: 1, height: 1, durationSec: 5, bytes: 900 * 1024 * 1024 }).ok && upload({ resourceType: "video", width: 1, height: 1, durationSec: 5, bytes: 2049 * 1024 * 1024 }).errors.includes("file_too_large"));
const facts = vp.readVideoFacts({ resource_type: "video", width: 1080, height: 1920, duration: "12.5", bytes: 5000, format: "MOV", frame_rate: 29.97 });
ok("readVideoFacts reads Cloudinary's explicit() answer", facts.durationSec === 12.5 && facts.format === "mov" && facts.frameRate === 29.97);
const mm = vp.readVideoFacts({ resource_type: "video", video_metadata: { format: { duration: "7.2" }, streams: [{ codec_type: "audio" }, { codec_type: "video", width: 720, height: 1280, avg_frame_rate: "30000/1001" }] } });
ok("…and the media_metadata shape (duration, stream size, fractional fps)", mm.durationSec === 7.2 && mm.width === 720 && Math.abs(mm.frameRate - 29.97) < 0.01);
ok("readVideoFacts: absent is null, never a default", vp.readVideoFacts({ resource_type: "video" }).durationSec === null && vp.readVideoFacts("x") === null);

// ══ 2 ═══════════════════════════════════════════════════════════════════════
section("2. 9:16 is enforced");

ok("1080x1920, 720x1280, 2160x3840 are 9:16", [[1080, 1920], [720, 1280], [2160, 3840]].every(([w, h]) => vp.isNineBySixteen(w, h)));
ok("1080x1350, 1920x1080, 1080x1080, 1080x1940 are not", [[1080, 1350], [1920, 1080], [1080, 1080], [1080, 1940]].every(([w, h]) => !vp.isNineBySixteen(w, h)));
ok("hostile sizes are not 9:16", [[0, 0], [-9, -16], [NaN, 16], ["9", "16x"], [Infinity, Infinity]].every(([w, h]) => !vp.isNineBySixteen(w, h)));
for (const p of vp.PLATFORMS) ok(`${p}: landscape clip on "original" → not_vertical`, vp.checkForPlatform(p, landscape).errors.includes("not_vertical"));
for (const fit of ["pad", "crop"]) ok(`landscape + ${fit} → 1080x1920 and allowed`, vp.fitAllowed(fit, landscape) && JSON.stringify(vp.renditionSize(fit, landscape)) === '{"width":1080,"height":1920}');
ok("an unknown fit is refused, not treated as original", !vp.fitAllowed("stretch", vertical) && vp.checkForPlatform("tiktok", { ...vertical, fit: "stretch" }).errors.includes("bad_fit"));
ok("original is scaled DOWN only (4K vertical → 1080x1920; 720x1280 stays)", JSON.stringify(vp.renditionSize("original", { width: 2160, height: 3840 })) === '{"width":1080,"height":1920}' && JSON.stringify(vp.renditionSize("original", { width: 720, height: 1280 })) === '{"width":720,"height":1280}');

const publishRoute = read("app/api/marketing/video-posts/[id]/publish/route.js");
const tiktokRoute = read("app/api/marketing/video-posts/[id]/tiktok/route.js");
const itemRoute = read("app/api/marketing/video-posts/[id]/route.js");
ok("publish route refuses a shape nobody chose before any Meta call", publishRoute.indexOf("fitAllowed(post.fit, post)") > 0 && publishRoute.indexOf("fitAllowed(post.fit, post)") < publishRoute.indexOf("startInstagramReel({"));
ok("…and waits for the rendition to exist", publishRoute.indexOf('state !== "ready"') > 0 && publishRoute.indexOf('state !== "ready"') < publishRoute.indexOf("startInstagramReel({"));
ok("TikTok route: same two gates before init", tiktokRoute.indexOf("fitAllowed(post.fit, post)") < tiktokRoute.indexOf("initVideoPost({") && tiktokRoute.indexOf('state !== "ready"') < tiktokRoute.indexOf("initVideoPost({"));
ok("PATCH refuses 'original' for a clip that isn't 9:16", /if \(!fitAllowed\(body\.fit, post\)\) return refuse\(400, "not_vertical"/.test(itemRoute));
ok("nothing FieldQuo-branded is added: no overlay/text/watermark transform", !/l_|overlay|watermark|co_|l_text/.test(vp.renditionTransformation("pad") + vp.renditionTransformation("crop") + vp.renditionTransformation("original")));

// ══ 3 ═══════════════════════════════════════════════════════════════════════
section("3. Cloudinary URLs");

const pid = "fieldquo/companies/co_1/video/0f8fad5b-d9cb-469f-a165-70867728950e";
ok("rendition URL (pad)", vp.renditionUrl({ cloudName: "demo", publicId: pid, fit: "pad" }) === `https://res.cloudinary.com/demo/video/upload/c_pad,w_1080,h_1920,b_black/ac_aac,fps_24-60,vc_h264:high:auto/${pid}.mp4`);
ok("rendition URL (crop) is a centred fill", vp.renditionUrl({ cloudName: "demo", publicId: pid, fit: "crop" }).includes("/c_fill,w_1080,h_1920,g_center/"));
ok("frame URL at 1.5 s", vp.frameUrl({ cloudName: "demo", publicId: pid, fit: "original", offsetMs: 1500 }) === `https://res.cloudinary.com/demo/video/upload/so_1.5,c_limit,w_1080,h_1920/${pid}.jpg`);
ok("frame at 0 → so_0; hostile offset → so_0", vp.frameUrl({ cloudName: "demo", publicId: pid, fit: "pad", offsetMs: 0 }).includes("/so_0,") && vp.frameUrl({ cloudName: "demo", publicId: pid, fit: "pad", offsetMs: "x" }).includes("/so_0,"));
ok("hostile ids/cloud names → null, never a URL", [
  { cloudName: "demo", publicId: "../x", fit: "pad" },
  { cloudName: "demo", publicId: "a?b=c", fit: "pad" },
  { cloudName: "ev il", publicId: pid, fit: "pad" },
  { cloudName: "demo", publicId: pid, fit: "nope" },
  { cloudName: "demo", publicId: "a/../../b", fit: "pad" },
].every((a) => vp.renditionUrl(a) === null));
ok("derived match ignores the version segment", vp.sameDerived(`https://res.cloudinary.com/demo/video/upload/v17/c_pad,w_1080/${pid}.mp4`.replace("/v17/c_pad,w_1080/", "/c_pad,w_1080/v17/"), `https://res.cloudinary.com/demo/video/upload/c_pad,w_1080/${pid}.mp4`));
ok("derived match is exact otherwise", !vp.sameDerived(`https://res.cloudinary.com/demo/video/upload/c_fill,w_1080/${pid}.mp4`, `https://res.cloudinary.com/demo/video/upload/c_pad,w_1080/${pid}.mp4`) && !vp.sameDerived("", "x"));
const scope = direct.uploadScope("member", { companyId: "co_1", purpose: "video" });
ok("\"video\" is a staff upload purpose with its own folder", scope.folder === "fieldquo/companies/co_1/video" && scope.deliveryType === "upload");
ok("a clip id from another company or purpose is not ours", direct.isOwnPublicId(pid, scope, "video") && !direct.isOwnPublicId(pid.replace("co_1", "co_2"), scope, "video") && !direct.isOwnPublicId(pid.replace("/video/", "/jobs/"), scope, "video"));

// ══ 4 ═══════════════════════════════════════════════════════════════════════
section("4. What each platform is sent");

// TikTok's own example (content-posting-api-reference-direct-post), as inputs.
const tt = vp.buildTikTokVideoPostBody({
  title: "this will be a funny #cat video on your @tiktok #fyp",
  privacyLevel: "MUTUAL_FOLLOW_FRIENDS",
  allowDuet: true, allowComment: false, allowStitch: true,
  coverTimestampMs: 1000, videoUrl: "[URL]",
});
const ttDocs = { post_info: { title: "this will be a funny #cat video on your @tiktok #fyp", privacy_level: "MUTUAL_FOLLOW_FRIENDS", disable_duet: false, disable_comment: true, disable_stitch: false, video_cover_timestamp_ms: 1000 }, source_info: { source: "PULL_FROM_URL", video_url: "[URL]" } };
const project = (body, docs) => ({ post_info: Object.fromEntries(Object.keys(docs.post_info).map((k) => [k, body.post_info[k]])), source_info: body.source_info });
ok("TikTok video body = the docs' example on every field it shows (md5)", md5(project(tt, ttDocs)) === md5(ttDocs), JSON.stringify(project(tt, ttDocs)));
ok("…plus only the two disclosure toggles, false unless chosen", JSON.stringify(Object.keys(tt.post_info).filter((k) => !(k in ttDocs.post_info))) === '["brand_content_toggle","brand_organic_toggle"]' && tt.post_info.brand_content_toggle === false && tt.post_info.brand_organic_toggle === false);
const ttDefault = vp.buildTikTokVideoPostBody({ ...specs.COMPOSER_DEFAULTS, privacyLevel: "SELF_ONLY", title: "", videoUrl: "u" });
ok("defaults: comment, duet and stitch all OFF (disable_* true)", ttDefault.post_info.disable_comment && ttDefault.post_info.disable_duet && ttDefault.post_info.disable_stitch);
ok("truthy-but-not-true is not consent", vp.buildTikTokVideoPostBody({ privacyLevel: "SELF_ONLY", allowDuet: "yes", allowStitch: 1, commercialOn: "true", yourBrand: true, videoUrl: "u" }).post_info.disable_duet === true && vp.buildTikTokVideoPostBody({ privacyLevel: "SELF_ONLY", allowStitch: 1, videoUrl: "u" }).post_info.disable_stitch === true);
ok("no music, no AIGC flag, nobody else's choices", !("auto_add_music" in tt.post_info) && !("is_aigc" in tt.post_info));
ok("TikTok inbox draft = the docs' example exactly (md5)", md5(vp.buildTikTokVideoDraftBody({ videoUrl: "https://example.verified.domain.com/example_video.mp4" })) === md5({ source_info: { source: "PULL_FROM_URL", video_url: "https://example.verified.domain.com/example_video.mp4" } }));

const ig = vp.buildInstagramReelParams({ videoUrl: "V", caption: "C", coverMode: "frame", coverOffsetMs: 1500 });
ok("Instagram Reel container params (md5)", md5(ig) === md5({ media_type: "REELS", video_url: "V", caption: "C", share_to_feed: "true", thumb_offset: "1500" }), JSON.stringify(ig));
const igCover = vp.buildInstagramReelParams({ videoUrl: "V", caption: "C", coverMode: "image", coverImageUrl: "https://x/c.jpg", coverOffsetMs: 1500 });
ok("uploaded cover → cover_url and NO thumb_offset", igCover.cover_url === "https://x/c.jpg" && !("thumb_offset" in igCover));
ok("Facebook Reel start = { upload_phase: start }", md5(vp.buildFacebookReelStartParams()) === md5({ upload_phase: "start" }));
ok("Facebook Reel finish = the docs' curl fields (md5)", md5(vp.buildFacebookReelFinishParams({ videoId: 42, caption: "What a beautiful day! #sunnyand72" })) === md5({ video_id: "42", upload_phase: "finish", video_state: "PUBLISHED", description: "What a beautiful day! #sunnyand72" }));

// The real Graph client, fetch stubbed: the Reel calls hit the documented endpoints.
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || "GET", headers: init.headers || {} });
  return new Response(JSON.stringify({ id: "c1", video_id: "v1", success: true, status_code: "FINISHED", status: { video_status: "ready" } }), { status: 200 });
};
await graph.createInstagramReelContainer({ igUserId: "ig1", accessToken: "tok", params: ig });
await graph.startFacebookReel({ pageId: "p1", pageAccessToken: "tok", params: vp.buildFacebookReelStartParams() });
await graph.uploadFacebookReelFromUrl({ videoId: "v1", pageAccessToken: "tok", fileUrl: "https://res.cloudinary.com/demo/video/upload/x.mp4" });
await graph.finishFacebookReel({ pageId: "p1", pageAccessToken: "tok", params: vp.buildFacebookReelFinishParams({ videoId: "v1", caption: "c" }) });
await graph.getFacebookVideoStatus({ videoId: "v1", accessToken: "tok" });
const u = calls.map((c) => new URL(c.url));
ok("IG: POST /ig1/media with media_type=REELS", calls[0].method === "POST" && u[0].pathname.endsWith("/ig1/media") && u[0].searchParams.get("media_type") === "REELS");
ok("FB start: POST /p1/video_reels upload_phase=start", u[1].pathname.endsWith("/p1/video_reels") && u[1].searchParams.get("upload_phase") === "start");
ok("FB upload: rupload.facebook.com/video-upload/<ver>/v1, token in the Authorization header, file_url header", u[2].host === "rupload.facebook.com" && u[2].pathname === `/video-upload/${graph.GRAPH_API_VERSION}/v1` && calls[2].headers.Authorization === "OAuth tok" && calls[2].headers.file_url.endsWith("x.mp4") && !calls[2].url.includes("tok"));
ok("FB finish: video_state=PUBLISHED", u[3].searchParams.get("upload_phase") === "finish" && u[3].searchParams.get("video_state") === "PUBLISHED");
ok("FB status: GET /v1?fields=status,post_id", calls[4].method === "GET" && u[4].searchParams.get("fields") === "status,post_id");
globalThis.fetch = realFetch;

// ══ 5 ═══════════════════════════════════════════════════════════════════════
section("5. Status mapping");

ok("IG IN_PROGRESS → processing; FINISHED → publish; PUBLISHED → published", vp.instagramReelStep("IN_PROGRESS").state === "processing" && vp.instagramReelStep("FINISHED").state === "publish" && vp.instagramReelStep("PUBLISHED").state === "published");
ok("IG ERROR → failed; EXPIRED → container_expired; unknown → unknown (not a guess)", vp.instagramReelStep("ERROR").state === "failed" && vp.instagramReelStep("EXPIRED").code === "container_expired" && vp.instagramReelStep("NEW_THING").state === "unknown" && vp.instagramReelStep(undefined).state === "unknown");
ok("IG ERROR text with 2207026 → meta_video_format", vp.classifyInstagramContainerError("Error: The video format is not supported. (2207026)") === "meta_video_format");
ok("IG ERROR text with 2207057 → cover_offset_out_of_range; 2207052 → meta_media_unreachable", vp.classifyInstagramContainerError("x 2207057") === "cover_offset_out_of_range" && vp.classifyInstagramContainerError("2207052") === "meta_media_unreachable");
ok("IG ERROR with no subcode (or hostile) → container_error, never 'something went wrong'", ["", null, 42, "Error: 99999999"].every((x) => vp.classifyInstagramContainerError(x) === "container_error"));
const docSample = { video_status: "processing", uploading_phase: { status: "complete" }, processing_phase: { status: "not_started" }, publishing_phase: { status: "not_started" } };
ok("FB docs' sample → processing (stage processing)", JSON.stringify(vp.facebookReelStep(docSample)) === '{"state":"processing","stage":"processing"}');
ok("FB uploading → stage uploading", vp.facebookReelStep({ video_status: "uploading", uploading_phase: { status: "in_progress" } }).stage === "uploading");
ok("FB published", vp.facebookReelStep({ video_status: "ready", uploading_phase: { status: "complete" }, processing_phase: { status: "complete" }, publishing_phase: { status: "complete", publish_status: "published" } }).state === "published");
const fbErr = vp.facebookReelStep({ video_status: "error", processing_phase: { status: "error", errors: [{ code: 1363008, message: "Video too long" }] } });
ok("FB processing error → failed with Meta's message and the phase", fbErr.state === "failed" && fbErr.code === "facebook_reel_failed" && fbErr.phase === "processing_phase" && fbErr.message === "Video too long");
ok("FB upload_failed / expired → failed", vp.facebookReelStep({ video_status: "upload_failed" }).state === "failed" && vp.facebookReelStep({ video_status: "expired" }).code === "container_expired");
ok("FB hostile status → unknown", [null, "x", 5].every((x) => vp.facebookReelStep(x).state === "unknown"));
ok("stored code round-trips; hostile code → unexpected", vp.codeFromMessage(vp.withCode("meta_video_format", "Instagram container ERROR")) === "meta_video_format" && vp.codeFromMessage(vp.withCode("<script>", "x")) === "unexpected" && vp.codeFromMessage("Meta refused at container: code=9004") === null);
ok("TikTok video fail_reasons are known codes", ["video_pull_failed", "duration_check_failed", "frame_rate_check_failed"].every((c) => specs.classifyTikTokError({ code: c }).known) && specs.classifyTikTokError({ code: "video_pull_failed" }).retryable);

// ══ 6 ═══════════════════════════════════════════════════════════════════════
section("6. The poll: publish exactly once; a failed read is not a failed post");

const conn = { connected: true, instagramUserId: "ig1", pageId: "p1", pageAccessToken: "tok" };
function fakeClient(over = {}) {
  const log = [];
  return {
    log,
    getInstagramContainerDetail: async () => (log.push("detail"), { statusCode: "FINISHED", status: "Finished" }),
    publishInstagramContainer: async () => (log.push("publish"), "media_1"),
    getFacebookVideoStatus: async () => (log.push("fbstatus"), { status: docSample, postId: null }),
    ...over,
  };
}
let c = fakeClient();
let r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => false });
ok("FINISHED but the claim was lost → no media_publish", r.state === "claimed_elsewhere" && !c.log.includes("publish"));
c = fakeClient();
r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => true });
ok("FINISHED and claimed → exactly one media_publish", r.state === "published" && r.postId === "media_1" && c.log.filter((x) => x === "publish").length === 1);
c = fakeClient({ getInstagramContainerDetail: async () => ({ statusCode: "IN_PROGRESS" }) });
let claimed = false;
r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => (claimed = true) });
ok("IN_PROGRESS → processing, and nothing is claimed", r.state === "processing" && !claimed);
const graphErr = (code, subcode) => Object.assign(new Error("x"), { name: "MetaGraphError", code, subcode, status: 400 });
c = fakeClient({ getInstagramContainerDetail: async () => { throw graphErr(2, null); } });
r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => true });
ok("a status READ that Meta refused → unreadable, not failed", r.state === "unreadable");
c = fakeClient({ publishInstagramContainer: async () => { throw graphErr(9007, 2207027); } });
r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => true });
ok("9007/2207027 'not ready' at publish → handed back to the poll", r.state === "not_ready");
c = fakeClient({ getInstagramContainerDetail: async () => ({ statusCode: "ERROR", status: "Error: (2207026)" }) });
r = await pv.advanceInstagramReel({ connection: conn, containerId: "c1", client: c, claim: async () => true });
ok("ERROR → failed with the mapped code and Meta's text kept", r.state === "failed" && r.code === "meta_video_format" && /2207026/.test(r.detail));
c = fakeClient({ getFacebookVideoStatus: async () => { throw graphErr(190, null); } });
r = await pv.advanceFacebookReel({ connection: conn, videoId: "v1", client: c });
ok("Facebook status read refused → unreadable (the Reel may still be live)", r.state === "unreadable" && r.code === "meta_auth");

// start*: refusals before anything is sent
const noCalls = { getInstagramPublishingLimit: async () => { throw new Error("should not be called"); }, createInstagramReelContainer: async () => { throw new Error("should not be called"); } };
let refusal = null;
try { await pv.startInstagramReel({ connection: conn, post: landscape, videoUrl: "u", client: noCalls }); } catch (e) { refusal = e; }
ok("startInstagramReel refuses a landscape 'original' before calling Meta", refusal?.code === "not_vertical");
refusal = null;
try { await pv.startFacebookReel({ connection: conn, post: { ...vertical, durationSec: 120 }, videoUrl: "u", client: {} }); } catch (e) { refusal = e; }
ok("startFacebookReel refuses 120 s before calling Meta", refusal?.code === "too_long");
refusal = null;
try { await pv.startInstagramReel({ connection: { ...conn, instagramUserId: null }, post: vertical, videoUrl: "u", client: {} }); } catch (e) { refusal = e; }
ok("no linked Instagram account → named refusal", refusal?.code === "no_instagram_account");
const atCap = { getInstagramPublishingLimit: async () => ({ quota_usage: 50, config: { quota_total: 50 } }), createInstagramReelContainer: async () => { throw new Error("should not be called"); } };
refusal = null;
try { await pv.startInstagramReel({ connection: conn, post: vertical, videoUrl: "u", client: atCap }); } catch (e) { refusal = e; }
ok("Instagram quota at cap → rate_limited, no container", refusal?.code === "rate_limited");

// The demo client runs the same glue end to end.
const demo = await pv.startFacebookReel({ connection: conn, post: vertical, videoUrl: "https://x/y.mp4", client: mock });
ok("demo: Facebook Reel starts through the mock", typeof demo.videoId === "string" && demo.videoId.startsWith("mock_fbv_"));
const fnNames = (m) => Object.keys(m).filter((k) => typeof m[k] === "function" && k !== "MetaGraphError").sort();
ok("the mock client has every function the real one exports", fnNames(graph).every((k) => typeof mock[k] === "function"), fnNames(graph).filter((k) => typeof mock[k] !== "function").join(","));

const pollRoute = read("app/api/marketing/video-posts/publishes/[publishId]/route.js");
ok("poll: claim is a compare-and-set on status container_created", /where: \{ id: row\.id, status: "container_created" \}/.test(pollRoute) && /won\.count === 1/.test(pollRoute));
ok("poll: a read-only support session never claims, publishes or writes", /if \(readOnly\) return false;/.test(pollRoute) && /if \(readOnly\) return NextResponse\.json/.test(pollRoute));
ok("poll: an unreadable status writes nothing", pollRoute.indexOf('result.state === "unreadable"') < pollRoute.indexOf("db.socialPublish.updateMany({\n    where: { id: row.id, status: { in:"));

// ══ 7 ═══════════════════════════════════════════════════════════════════════
section("7. TikTok");

const info = { privacyLevelOptions: ["SELF_ONLY"], duetDisabled: true, stitchDisabled: false, commentDisabled: false, maxVideoPostDurationSec: 180 };
const base = { privacyLevel: "SELF_ONLY", description: "hi", creatorInfo: info, audited: false, mediaKind: "video" };
ok("duet ticked when the creator disabled it → refused", specs.validateTikTokPost({ ...base, allowDuet: true }).errors.includes("duet_disabled_by_creator"));
ok("stitch allowed when the creator allows it", specs.validateTikTokPost({ ...base, allowStitch: true }).ok);
ok("a stray duet tick on a PHOTO is ignored (photo has no duet)", specs.validateTikTokPost({ ...base, mediaKind: "photo", allowDuet: true }).ok);
ok("video caption limit is 2200, photo stays 4000", !specs.validateTikTokPost({ ...base, description: "a".repeat(2201) }).ok && specs.validateTikTokPost({ ...base, mediaKind: "photo", description: "a".repeat(2201) }).ok);
ok("video draft carries no caption, so none is length-checked", specs.validateTikTokDraft({ description: "a".repeat(5000), creatorInfo: info, mediaKind: "video" }).ok);
ok("creator max 180 s: 181 s → too_long_for_creator; 180 s ok", vp.checkForPlatform("tiktok", { ...vertical, durationSec: 181 }, info).errors.includes("too_long_for_creator") && vp.checkForPlatform("tiktok", { ...vertical, durationSec: 180 }, info).ok);
ok("creator max missing/hostile → the API's 600 s ceiling, not 'unlimited'", vp.checkForPlatform("tiktok", { ...vertical, durationSec: 601 }, { maxVideoPostDurationSec: "lots" }).errors.includes("too_long") && vp.checkForPlatform("tiktok", { ...vertical, durationSec: 601 }, { maxVideoPostDurationSec: 99999 }).errors.includes("too_long"));
ok("TikTok route checks the creator's max from creator_info fetched on THIS request", tiktokRoute.indexOf("queryCreatorInfo(") < tiktokRoute.indexOf('checkForPlatform("tiktok", post, { maxVideoPostDurationSec: info.data.maxVideoPostDurationSec })'));
ok("TikTok route: the inbox draft goes to the inbox VIDEO endpoint", /isDraft\s*\n?\s*\? await initVideoDraft/.test(tiktokRoute));
ok("client: video endpoints are the documented ones", /"\/v2\/post\/publish\/video\/init\/"/.test(read("lib/tiktok/client.js")) && /"\/v2\/post\/publish\/inbox\/video\/init\/"/.test(read("lib/tiktok/client.js")));

const rootKey = Buffer.alloc(32, 7);
const tok = signing.makeMediaToken({ rootKey, publishId: "p1", companyId: "c1", nowSeconds: 1000 });
ok("an .mp4 media URL verifies like a .jpg one", signing.verifyMediaToken(`${tok}.mp4`, { rootKey, nowSeconds: 1001 }).ok && signing.mediaUrlFor("https://www.fieldquo.com/", tok, "mp4").endsWith(`/api/tiktok/media/${tok}.mp4`));
ok("…and anything but mp4 falls back to .jpg", signing.mediaUrlFor("https://a", tok, "exe").endsWith(".jpg"));
const rows = {
  p1: { companyId: "c1", status: "processing", imageUrl: "https://res.cloudinary.com/demo/video/upload/so_0/x.jpg", mediaType: "VIDEO", videoUrl: "https://res.cloudinary.com/demo/video/upload/c_pad/x.mp4" },
};
const resolve = (seg, row) => media.resolveMediaRequest({ segment: seg, rootKey, nowSeconds: 1001, verificationFile: null, loadRow: async () => row });
ok("VIDEO row → serves the MP4, never the cover frame", JSON.stringify(await resolve(`${tok}.mp4`, rows.p1)) === JSON.stringify({ kind: "video", videoUrl: rows.p1.videoUrl }));
ok("VIDEO row with a non-Cloudinary videoUrl → nothing (no fetch-anything proxy)", (await resolve(tok, { ...rows.p1, videoUrl: "https://evil.example/x.mp4" })) === null);
ok("VIDEO row already published → nothing", (await resolve(tok, { ...rows.p1, status: "published" })) === null);
ok("PHOTO row unchanged → image", (await resolve(tok, { companyId: "c1", status: "pending", imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg" }))?.kind === "image");
ok("another company's row → nothing", (await resolve(tok, { ...rows.p1, companyId: "c2" })) === null);
const mediaRoute = read("app/api/tiktok/media/[token]/route.js");
ok("media route streams video as video/mp4, passes Range, no redirect", /"Content-Type": "video\/mp4"/.test(mediaRoute) && /Range: range/.test(mediaRoute) && !/Response\.redirect|status: 30[12378]/.test(mediaRoute));

// ══ 8 ═══════════════════════════════════════════════════════════════════════
section("8. Photo publish payloads unchanged");

// Captured with the same inputs against origin/main's lib/social/metaGraphClient.js
// and lib/tiktok/specs.js before any video code existed (2026-09-29).
const PINNED = { meta: "dc915fd9c5b90749a0cf270b8c8cca3a", tiktokPhoto: "e31ee94d1c4245dbe4381c41462ecbd9" };
const photoCalls = [];
globalThis.fetch = async (url, init = {}) => {
  photoCalls.push({ url: String(url), method: init.method || "GET" });
  return new Response(JSON.stringify({ id: "1", post_id: "2", status_code: "FINISHED", data: [{ quota_usage: 1, config: { quota_total: 50 } }] }), { status: 200 });
};
await graph.createInstagramContainer({ igUserId: "ig1", accessToken: "tok", imageUrl: "https://res.cloudinary.com/c/image/upload/a.jpg", caption: "Hi #x" });
await graph.getInstagramContainerStatus({ containerId: "c1", accessToken: "tok" });
await graph.publishInstagramContainer({ igUserId: "ig1", accessToken: "tok", containerId: "c1" });
await graph.getInstagramPublishingLimit({ igUserId: "ig1", accessToken: "tok" });
await graph.publishFacebookPhoto({ pageId: "p1", pageAccessToken: "tok", imageUrl: "https://res.cloudinary.com/c/image/upload/a.jpg", caption: "Hi" });
await graph.publishFacebookPhoto({ pageId: "p1", pageAccessToken: "tok", imageUrl: "https://res.cloudinary.com/c/image/upload/a.jpg", caption: "Hi", scheduledPublishTime: new Date("2026-10-01T12:00:00Z") });
globalThis.fetch = realFetch;
ok("Facebook + Instagram photo requests: md5 identical to origin/main", md5(photoCalls) === PINNED.meta, md5(photoCalls));
const tUrl = "https://www.fieldquo.com/api/tiktok/media/t.jpg";
const photoBodies = [
  specs.buildPhotoPostBody({ privacyLevel: "SELF_ONLY", allowComment: true, commercialOn: true, yourBrand: true, brandedContent: false, description: "Hi", photoUrl: tUrl }),
  specs.buildPhotoPostBody({ ...specs.COMPOSER_DEFAULTS, privacyLevel: "SELF_ONLY", description: "Hi", photoUrl: tUrl }),
  specs.buildPhotoDraftBody({ description: "Hi", photoUrl: tUrl }),
];
ok("TikTok photo bodies (even fed the new duet/stitch defaults): md5 identical", md5(photoBodies) === PINNED.tiktokPhoto, md5(photoBodies));
ok("a design's photo URL still ends .jpg", signing.mediaUrlFor("https://a", tok).endsWith(".jpg"));

// ══ 9 ═══════════════════════════════════════════════════════════════════════
section("9. Gates and sentences");

for (const [name, src] of [["publish", publishRoute], ["tiktok", tiktokRoute]]) {
  ok(`${name}: user:manage + paid plan before anything`, /requirePermission\(member\.role, "user:manage"\)/.test(src) && /planOrRefusal\(member,/.test(src));
}
ok("create: the clip id is minted by US in this company's \"video\" folder — the browser never names it", /uploadScope\("member", \{ companyId: member\.companyId, purpose: VIDEO_PURPOSE \}\)/.test(read("app/api/marketing/video-posts/route.js")) && !/body\?\.publicId/.test(read("app/api/marketing/video-posts/route.js")));
ok("create: the campaign must be this company's", /ownedIdsRefusal\(NextResponse, db, member\.companyId, \{ campaignId \}\)/.test(read("app/api/marketing/video-posts/route.js")));
ok("the composer is ONE component (TikTokPublishModal takes a video, no copy)", /video=\{tiktokVideo\}/.test(read("app/app/marketing/designer/video/[id]/page.js")) && !/content-sharing-guidelines/.test(read("app/app/marketing/designer/video/[id]/page.js")));
const modal = read("app/components/designer/TikTokPublishModal.js");
ok("composer: duet/stitch disabled when creator_info says so, unchecked by default", /disabled=\{creatorInfo\.duetDisabled\}/.test(modal) && /disabled=\{creatorInfo\.stitchDisabled\}/.test(modal) && specs.COMPOSER_DEFAULTS.allowDuet === false && specs.COMPOSER_DEFAULTS.allowStitch === false);

// Every code checkForPlatform / the routes can produce has a sentence.
const produced = new Set();
const hostile = [0, 1, 3, 90.5, 700, 901, NaN];
for (const p of [...vp.PLATFORMS, "x"]) for (const d of hostile) for (const post of [vertical, landscape, { ...vertical, width: 100, height: 178 }, { ...vertical, fit: "zzz" }, { ...vertical, caption: "" }, { ...vertical, coverMode: "image" }, { ...vertical, coverOffsetMs: -1 }, { ...vertical, caption: "#a ".repeat(40) + "@b ".repeat(30) + "x".repeat(2300) }, { ...vertical, width: 5000, height: 8889 }]) {
  for (const e of vp.checkForPlatform(p, { ...post, durationSec: d }, { maxVideoPostDurationSec: 60 }).errors) produced.add(e);
}
for (const e of ["not_vertical", "rendition_not_ready", "reel_daily_limit", "container_error", "container_expired", "meta_video_format", "facebook_reel_failed", "unexpected", "not_ours", "campaign_required", "cloudinary_unavailable", "not_a_video", "no_duration", "file_too_large", "too_short", "too_long", "not_approved", "approval_stale", "changed_since_review", "upload_not_ready", "shape_fixed_on_upload", "upload_failed", "upload_never_arrived", "cloudinary_failed", "allowance_used", "choose_fit", "too_long_clip"]) produced.add(e);
produced.delete("unknown_platform"); // never reaches a screen: platforms are a closed set in every route
const langs = Object.keys(APP_MESSAGES);
for (const lang of langs) {
  const missing = [...produced].filter((code) => typeof APP_MESSAGES[lang][`app.videoPost.error.${code}`] !== "string" && typeof APP_MESSAGES[lang][`app.tiktok.error.${code}`] !== "string");
  ok(`${lang}: a sentence for every video code (${produced.size})`, missing.length === 0, missing.join(", "));
}
for (const lang of langs) {
  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.videoPost."));
  const bad = keys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || ((APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join() !== (APP_MESSAGES[lang][k].match(/\{\w+\}/g) || []).sort().join()));
  ok(`${lang}: every app.videoPost string present with English's placeholders (${keys.length})`, bad.length === 0, bad.slice(0, 5).join(", "));
}

// ══ 10 ══════════════════════════════════════════════════════════════════════
section("10. The monthly allowance and the video pack (owner, 2026-09-29)");

const al = await import("../lib/marketing/videoAllowance.js");
ok("constants: 5 included, pack 90 videos at 7700 cents USD monthly, clips up to 150 s", al.INCLUDED_VIDEOS_PER_MONTH === 5 && al.VIDEO_PACK.videos === 90 && al.VIDEO_PACK.priceCents === 7700 && al.VIDEO_PACK.currency === "USD" && al.VIDEO_PACK.interval === "month" && al.VIDEO_MAX_SECONDS === 150);
ok("the constants file carries the worked example and the owner's pricing rationale", (() => {
  const src = read("lib/marketing/videoAllowance.js");
  return /95 videos made this month: 5 included \+ 90 from the pack/.test(src) && /96th is refused/.test(src) && /WORST case/.test(src) && /90 videos × 2\.5 min × US\$0\.17/.test(src) && /buffer/.test(src) && /90 × 1 min ≈ US\$15/.test(src);
})());
ok("one video counts once whatever its length", [3, 45, 90, 150].every((s) => al.videosFor({ durationSec: s }) === 1));
ok("the price is formatted from the constant ($77), the length as 2:30", al.formatPackPrice() === "$77" && al.formatClipLength() === "2:30" && al.formatPackPrice(7750) === "$77.50");

const future = new Date(Date.now() + 10 * 86400e3);
const past = new Date(Date.now() - 86400e3);
const onePack = [{ paidThrough: future }];
const allow1 = al.allowanceFor(onePack);
ok("worked example: 1 pack → 95 a month", allow1.total === 95 && allow1.included === 5 && allow1.fromPacks === 90);
let blockedAt = null;
for (let n = 0; n <= 100; n++) {
  if (!al.decideNewVideo({ used: n, reserved: 0, allowance: allow1 }).ok) { blockedAt = n; break; }
}
ok("worked example: 95 videos go through, the 96th is refused (allowance_used)", blockedAt === 95 && al.decideNewVideo({ used: 95, allowance: allow1 }).code === "allowance_used");
ok("…and 95 clips of 2:30 are still 95 (length changes nothing)", Array.from({ length: 95 }, () => al.videosFor({ durationSec: 150 })).reduce((a, b) => a + b, 0) === 95);
ok("no pack: the 6th is refused", al.decideNewVideo({ used: 5, allowance: al.allowanceFor([]) }).ok === false && al.decideNewVideo({ used: 4, allowance: al.allowanceFor([]) }).ok);
ok("a clip on its way in holds its slot (4 used + 1 uploading → the next is refused)", !al.decideNewVideo({ used: 4, reserved: 1, allowance: al.allowanceFor([]) }).ok);
ok("two packs stack to 185", al.allowanceFor([{ paidThrough: future }, { paidThrough: future }]).total === 185);
ok("a pack counts only while a PAID period covers today", al.allowanceFor([{ paidThrough: past }]).total === 5 && al.allowanceFor([{ paidThrough: null, status: "active" }]).total === 5 && al.allowanceFor([{ paidThrough: "junk" }]).total === 5);
ok("a pack set to stop renewing keeps counting until its paid month ends", al.allowanceFor([{ paidThrough: future, cancelAtPeriodEnd: true, status: "active" }]).total === 95);
ok("hostile counts never go negative or grant more", al.decideNewVideo({ used: -50, reserved: -3, allowance: { total: 5 } }).remaining === 5 && !al.decideNewVideo({ used: 0, allowance: null }).ok);

const tor = (iso) => al.monthWindow(new Date(iso), "America/Toronto").label;
ok("the month is the company's own: 2026-10-01 03:00 UTC is still September in Toronto", tor("2026-10-01T03:00:00Z") === "2026-09" && tor("2026-10-01T05:00:00Z") === "2026-10");
ok("…and already October in Sydney", al.monthWindow(new Date("2026-09-30T15:00:00Z"), "Australia/Sydney").label === "2026-10");
const nov = al.monthWindow(new Date("2026-11-15T12:00:00Z"), "America/Toronto");
ok("a month across the DST change still starts and ends at local midnight", nov.start.toISOString() === "2026-11-01T04:00:00.000Z" && nov.end.toISOString() === "2026-12-01T05:00:00.000Z");
ok("an unknown time zone falls back to the schema default, not UTC", al.monthWindow(new Date("2026-10-01T03:00:00Z"), "Mars/Olympus").timeZone === "America/Toronto");
const dec = al.monthWindow(new Date("2026-12-31T12:00:00Z"), "America/Toronto");
ok("December rolls into January", dec.end.toISOString() === "2027-01-01T05:00:00.000Z");

// The pack's billing: two doors, one settlement, nothing doubled.
const packLib = await import("../lib/marketing/videoPack.js");
function packWorld() {
  const rows = new Map();
  const activity = [];
  const prisma = {
    videoPack: {
      findUnique: async ({ where }) => (where.stripeSubscriptionId ? [...rows.values()].find((r) => r.stripeSubscriptionId === where.stripeSubscriptionId) : rows.get(where.id)) || null,
      upsert: async ({ where, create, update }) => {
        const found = [...rows.values()].find((r) => r.stripeSubscriptionId === where.stripeSubscriptionId);
        if (found) { Object.assign(found, update); return found; }
        const row = { id: `vp_${rows.size + 1}`, paidThrough: null, lastPaidInvoiceId: null, ...create };
        rows.set(row.id, row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const r = rows.get(where.id);
        const same = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
        if (!r || !same(r.paidThrough, where.paidThrough)) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => Object.assign(rows.get(where.id), data),
    },
  };
  const subs = {
    sub_pack: { id: "sub_pack", status: "active", customer: "cus_1", metadata: { companyId: "co_1", kind: packLib.VIDEO_PACK_KIND, packKey: "video_pack_90" } },
    sub_plan: { id: "sub_plan", status: "active", customer: "cus_1", metadata: { companyId: "co_1", planId: "p1" } },
  };
  const deps = {
    db: prisma,
    stripe: { subscriptions: { retrieve: async (id) => subs[id] || null } },
    recordActivity: async (_m, a) => activity.push(a),
  };
  return { rows, activity, deps };
}
const inv = (sub, endIso, id = `in_${endIso}`) => ({ id, status: "paid", subscription: sub, lines: { data: [{ period: { start: 0, end: Math.floor(new Date(endIso).getTime() / 1000) } }] } });
{
  const w = packWorld();
  const r1 = await packLib.settleVideoPackInvoice(inv("sub_pack", "2026-11-01T00:00:00Z"), { deps: w.deps });
  const r2 = await packLib.settleVideoPackInvoice(inv("sub_pack", "2026-11-01T00:00:00Z"), { deps: w.deps });
  const row = [...w.rows.values()][0];
  ok("a pack's first paid invoice sets paidThrough to the period end", r1.handled && r1.settled && row.paidThrough.toISOString() === "2026-11-01T00:00:00.000Z");
  ok("the same invoice settled twice (webhook + browser return) changes nothing and logs once", r2.handled && r2.moved === false && w.activity.length === 1 && w.rows.size === 1);
  await packLib.settleVideoPackInvoice(inv("sub_pack", "2026-12-01T00:00:00Z"), { deps: w.deps });
  await packLib.settleVideoPackInvoice(inv("sub_pack", "2026-11-01T00:00:00Z", "in_late"), { deps: w.deps });
  ok("a renewal moves it forward; a late replay of an older invoice never pulls it back", row.paidThrough.toISOString() === "2026-12-01T00:00:00.000Z");
  const notOurs = await packLib.settleVideoPackInvoice(inv("sub_plan", "2026-11-01T00:00:00Z"), { deps: w.deps });
  ok("the company's own plan invoice is NOT a pack (falls through to the plan handler)", notOurs.handled === false);
  const unpaid = await packLib.settleVideoPackInvoice({ ...inv("sub_pack", "2027-01-01T00:00:00Z"), status: "open" }, { deps: w.deps });
  ok("an unpaid pack invoice grants nothing", unpaid.handled && unpaid.settled === false && row.paidThrough.toISOString() === "2026-12-01T00:00:00.000Z");
  ok("laterOf ignores junk and keeps the later date", packLib.laterOf("junk", "2026-01-01").toISOString().startsWith("2026-01-01") && packLib.laterOf("2027-01-01", "2026-01-01").toISOString().startsWith("2027"));
}
// ── Sold to every company, billed in US dollars (owner, 2026-10-04) ─────
// It was refused to CAD/AUD companies. Now every company may buy it, always in
// USD (the owner's add-ons-are-USD rule), a non-USD company on a SEPARATE
// Stripe customer so its plan's currency is never touched, and told so beside
// the price (UsdBillingNote).
ok("every company may buy a pack — USD, CAD, AUD, anything", ["USD", "CAD", "AUD", "GBP", null].every((c) => packLib.packAvailability(c).ok && packLib.packAvailability(c).currency === "USD"));
ok("…and a non-USD company is flagged for the USD note; a USD one is not", packLib.packAvailability("CAD").usdNote === true && packLib.packAvailability("USD").usdNote === false);
ok("a USD company's pack goes on its plan customer; any other on its USD add-on customer", packLib.packCustomerKind("USD") === "plan" && packLib.packCustomerKind("CAD") === "usd_add_ons" && packLib.packCustomerKind("aud") === "usd_add_ons");
{
  const sessions = [];
  const used = [];
  const fakeStripe = { checkout: { sessions: { create: async (args) => { sessions.push(args); return { url: "https://checkout.test/s" }; } } } };
  const deps = { stripe: fakeStripe, getOrCreateStripeCustomer: async () => { used.push("plan"); return "cus_plan"; }, getOrCreateUsdAddOnCustomer: async () => { used.push("usd"); return "cus_usd"; } };
  const cad = await packLib.createVideoPackCheckoutSession({ company: { id: "co_ca", currency: "CAD" }, successUrl: "s", cancelUrl: "c", deps });
  ok("a CAD company's pack: USD, 7,700 cents, on the USD add-on customer — never its CAD plan customer", cad.ok && sessions[0].line_items[0].price_data.currency === "usd" && sessions[0].line_items[0].price_data.unit_amount === 7700 && sessions[0].customer === "cus_usd" && used[0] === "usd" && sessions[0].metadata.currency === "USD");
  const usd = await packLib.createVideoPackCheckoutSession({ company: { id: "co_us", currency: "USD" }, successUrl: "s", cancelUrl: "c", deps });
  ok("a USD company's pack: USD on its one customer, as before", usd.ok && sessions[1].customer === "cus_plan" && sessions[1].line_items[0].price_data.currency === "usd");
}
{
  const billing = read("lib/platform/stripeBilling.js");
  ok("the USD add-on customer is tagged usdAddOnsFor — NOT companyId, which finds the plan's customer", /metadata: \{ usdAddOnsFor: company\.id, purpose: "usd_add_ons" \}/.test(billing) && /metadata\['usdAddOnsFor'\]/.test(billing));
  const server = read("lib/marketing/videoPostServer.js");
  ok("allowanceBody names USD, and flags the note for a non-USD company", /packCurrency: VIDEO_PACK\.currency/.test(server) && /usdNote: String\(a\.currency/.test(server));
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  const keys = ["app.videoAllowance.addPack", "app.videoAllowance.addAnotherPack", "app.videoAllowance.explain", "app.videoAllowance.packLine"];
  ok("every language's pack sentences carry {currency} (USD)", Object.values(APP_MESSAGES).every((m) => keys.every((k) => String(m[k] || "").includes("{currency}"))));
  const card = read("app/components/designer/VideoAllowance.js");
  ok("…every place that prints them passes it", (card.match(/currency: (a|allowance)\.packCurrency/g) || []).length === 4);
  ok("the pack card and the used-up refusal both carry the USD note", (card.match(/<UsdBillingNote cents=\{(a|allowance)\.packPriceCents\} \/>/g) || []).length === 2);
  ok("/pricing names USD beside the pack's price", /\$\{VIDEO_PACK\.currency\}/.test(read("app/(marketing)/pricing/PricingPlans.js")));
}
// ── The ONE limit that waits on Cloudinary Plus: the size of a single upload ──
{
  const route = read("app/api/marketing/video-pack/route.js");
  ok("the pack card is told today's per-upload size, from the plan reading the upload is signed against", /videoUploadCap\(await planLimits\(\)/.test(route) && /uploadMaxLabel: megabytes\(uploadMaxBytes\)/.test(route));
  ok("…and says it, in every language", /app\.videoAllowance\.uploadLimit/.test(read("app/components/designer/VideoAllowance.js")));
  const vu2 = await import("../lib/marketing/videoUpload.js");
  ok("on Cloudinary Free (100 MB) that figure is 100 MB; on a bigger plan our own ceiling binds", vu2.videoUploadCap({ video_max_size_bytes: 100 * 1024 * 1024 }) === 100 * 1024 * 1024 && vu2.videoUploadCap({ video_max_size_bytes: 1e13 }) < 1e13);
}
const webhook = read("app/api/platform/billing/webhook/route.js");
ok("webhook: pack invoices are intercepted BEFORE the company-plan handler", webhook.indexOf("settleVideoPackInvoice(invoice)") > 0 && webhook.indexOf("settleVideoPackInvoice(invoice)") < webhook.indexOf("await syncSubscriptionFromStripeEvent(event)"));
ok("webhook: a pack's subscription.deleted never reaches the churn handler", webhook.indexOf("event.data.object?.metadata?.kind === VIDEO_PACK_KIND") > 0 && webhook.indexOf("event.data.object?.metadata?.kind === VIDEO_PACK_KIND") < webhook.indexOf("await syncSubscriptionFromStripeEvent(event)"));
ok("checkout return: a pack session is settled, not filed as a failed plan checkout", /kind === VIDEO_PACK_KIND/.test(read("lib/stripe/settleCheckoutSession.js")));
const packRoute = read("app/api/marketing/video-pack/route.js");
ok("buying or cancelling a pack is owner/admin only (isBillingAdmin)", (packRoute.match(/if \(!isBillingAdmin\(member\.role\)\)/g) || []).length === 2);
ok("the checkout price comes from VIDEO_PACK, never the request", /unit_amount: VIDEO_PACK\.priceCents/.test(read("lib/marketing/videoPack.js")) && !/priceCents|amount/.test(packRoute.slice(packRoute.indexOf("export async function POST"), packRoute.indexOf("export async function DELETE")).replace(/createVideoPackCheckoutSession/g, "")));
const createRoute = read("app/api/marketing/video-posts/route.js");
ok("the upload is refused on the allowance BEFORE it is signed", createRoute.indexOf("allowance.decision.ok") > 0 && createRoute.indexOf("allowance.decision.ok") < createRoute.indexOf("planVideoUpload("));
ok("counted once, when it arrives (a conditional update on a still-pending post)", /countedAt: now/.test(read("lib/marketing/videoPostServer.js")) && /uploadState: \{ in: \["uploading", "processing"\] \}/.test(read("lib/marketing/videoPostServer.js")));

// ══ 11 ══════════════════════════════════════════════════════════════════════
section("11. 1080p on arrival, in one pass; large uploads");

const vu = await import("../lib/marketing/videoUpload.js");
const vscope = direct.uploadScope("member", { companyId: "co_1", purpose: "video" });
const fixedId = () => "0f8fad5b-d9cb-469f-a165-70867728950e";
const plan4k = vu.planVideoUpload({ type: "video/quicktime", size: 900 * 1024 * 1024, width: 3840, height: 2160, durationSec: 150 }, vscope, { fit: "crop", randomId: fixedId, now: 0, planLimits: { video_max_size_bytes: 4 * 1024 ** 3 } });
ok("a 2:30 4K landscape clip of 900 MB is accepted", plan4k.ok, JSON.stringify(plan4k));
ok("…and the crop to 9:16 rides in the SAME incoming transformation as the 1080p conversion", plan4k.params.transformation === "eo_150/c_fill,w_1080,h_1920,g_center/ac_aac,fps_24-60,vc_h264:high:auto");
ok("stored as MP4, converted in the background, public_id minted by us", plan4k.params.format === "mp4" && plan4k.params.async === "true" && plan4k.params.public_id === `${vscope.folder}/${fixedId()}` && plan4k.params.overwrite === "false");
const planV = vu.planVideoUpload({ type: "video/mp4", size: 5e6, width: 2160, height: 3840, durationSec: 20 }, vscope, { randomId: fixedId, now: 0 });
ok("a vertical 4K clip is scaled DOWN to 1080x1920 (c_limit), no choice asked", planV.ok && planV.preparedAs === "vertical" && planV.params.transformation.includes("/c_limit,w_1080,h_1920/"));
const planU = vu.planVideoUpload({ type: "video/quicktime", size: 5e6 }, vscope, { randomId: fixedId, now: 0 });
ok("a clip the browser couldn't read is capped at 1920 a side and still trimmed at 2:30", planU.ok && planU.preparedAs === "limit" && planU.params.transformation.startsWith("eo_150/c_limit,w_1920,h_1920/"));
ok("a known non-9:16 clip with no Fit/Crop chosen is refused before upload (choose_fit)", vu.planVideoUpload({ type: "video/mp4", size: 5e6, width: 1920, height: 1080, durationSec: 10 }, vscope, {}).code === "choose_fit");
ok("a declared 2:31 clip is refused before upload; 2:30 is not", vu.planVideoUpload({ type: "video/mp4", size: 5e6, width: 1080, height: 1920, durationSec: 151 }, vscope, {}).code === "too_long" && vu.planVideoUpload({ type: "video/mp4", size: 5e6, width: 1080, height: 1920, durationSec: 150 }, vscope, {}).ok);
ok("the Cloudinary plan's own ceiling binds (Free 100 MB → a 900 MB clip is refused with the number)", (() => {
  const r = vu.planVideoUpload({ type: "video/mp4", size: 900e6, width: 1080, height: 1920, durationSec: 60 }, vscope, { planLimits: { video_max_size_bytes: 100 * 1024 * 1024 } });
  return r.code === "file_too_large" && r.maxBytes === 100 * 1024 * 1024;
})());
ok("not a video / empty / hostile type → refused", ["image/jpeg", "", null, "video/x-evil"].every((type) => !vu.planVideoUpload({ type, size: 10 }, vscope, {}).ok) && !vu.planVideoUpload({ type: "video/mp4", size: 0 }, vscope, {}).ok);
ok("a notification_url that isn't https is never signed", !("notification_url" in vu.planVideoUpload({ type: "video/mp4", size: 5e6, width: 1080, height: 1920, durationSec: 5 }, vscope, { notificationUrl: "http://localhost:3000/x" }).params));
const signedFields = vu.signedUploadFields(plan4k.params, { apiKey: "k", secret: "s" });
ok("the incoming transformation is INSIDE the signature (the browser cannot drop it to store 4K)", signedFields.signature === direct.cloudinarySignature(plan4k.params, "s") && signedFields.signature !== direct.cloudinarySignature({ ...plan4k.params, transformation: "" }, "s"));
ok("chunks are 20 MB (Cloudinary's floor is 5 MB; one request over 100 MB is refused)", vu.CHUNK_BYTES === 20 * 1024 * 1024);
const chunkSrc = read("lib/media/chunkedUpload.js");
ok("the chunked uploader sends X-Unique-Upload-Id and Content-Range, retries a dropped chunk", /X-Unique-Upload-Id/.test(chunkSrc) && /bytes \$\{start\}-\$\{end - 1\}\/\$\{total\}/.test(chunkSrc) && /RETRIES/.test(chunkSrc));

// Notification signature
const body = JSON.stringify({ notification_type: "upload", public_id: "x" });
const ts = 1_800_000_000;
const sig1 = createHash("sha1").update(body + ts + "secret").digest("hex");
const sig256 = createHash("sha256").update(body + ts + "secret").digest("hex");
ok("notification: SHA-1 and SHA-256 signatures verify", vu.verifyNotification({ body, timestamp: String(ts), signature: sig1, secret: "secret", nowSeconds: ts + 5 }) && vu.verifyNotification({ body, timestamp: String(ts), signature: sig256, secret: "secret", nowSeconds: ts + 5 }));
ok("notification: a tampered body, a wrong secret, a stale or missing timestamp are refused", !vu.verifyNotification({ body: body + " ", timestamp: String(ts), signature: sig1, secret: "secret", nowSeconds: ts }) && !vu.verifyNotification({ body, timestamp: String(ts), signature: sig1, secret: "other", nowSeconds: ts }) && !vu.verifyNotification({ body, timestamp: String(ts), signature: sig1, secret: "secret", nowSeconds: ts + 3 * 3600 }) && !vu.verifyNotification({ body, timestamp: null, signature: sig1, secret: "secret", nowSeconds: ts }));

// Arrival
const pendingPost = { videoPublicId: `${vscope.folder}/${fixedId()}` };
const arrived = { public_id: pendingPost.videoPublicId, resource_type: "video", width: 1080, height: 1920, duration: 149.97, bytes: 60e6, format: "mp4", secure_url: `https://res.cloudinary.com/demo/video/upload/v1/${pendingPost.videoPublicId}.mp4` };
ok("arrival: Cloudinary's own facts are stored (1080x1920, 149.97 s)", (() => { const j = vu.judgeArrival({ post: pendingPost, asset: arrived, cloudName: "demo" }); return j.ok && j.facts.width === 1080 && j.facts.durationSec === 149.97; })());
ok("arrival: another id, another cloud, a 2 s clip → refused", vu.judgeArrival({ post: pendingPost, asset: { ...arrived, public_id: "x" }, cloudName: "demo" }).code === "not_ours" && vu.judgeArrival({ post: pendingPost, asset: arrived, cloudName: "evil" }).code === "not_ours" && vu.judgeArrival({ post: pendingPost, asset: { ...arrived, duration: 2 }, cloudName: "demo" }).code === "too_short");
const preparedPost = { videoPublicId: pendingPost.videoPublicId, preparedAs: "crop", fit: "original" };
ok("a clip prepared on arrival is SENT AS STORED — no derived rendition, no second transcode", vp.sendUrl(preparedPost, "demo") === `https://res.cloudinary.com/demo/video/upload/${pendingPost.videoPublicId}.mp4`);
ok("…a legacy row (no preparedAs) still sends the derived rendition", vp.sendUrl({ ...preparedPost, preparedAs: null, fit: "pad" }, "demo").includes("/c_pad,"));
const itemRoute2 = read("app/api/marketing/video-posts/[id]/route.js");
ok("a clip made 9:16 on arrival cannot be re-shaped (the original is gone — said, not faked)", /shape_fixed_on_upload/.test(itemRoute2));
ok("the notify route verifies the signature before reading anything", (() => { const s = read("app/api/marketing/video-posts/cloudinary-notify/route.js"); return s.indexOf("verifyNotification(") < s.indexOf("JSON.parse(raw)"); })());

// ══ 12 ══════════════════════════════════════════════════════════════════════
section("12. Tick boxes and the approval gate");

const long = { ...vertical, durationSec: 120 };
const dFb = vp.destinationState(vp.checkForPlatform("facebook", long));
const dIg = vp.destinationState(vp.checkForPlatform("instagram", long));
const dTt = vp.destinationState(vp.checkForPlatform("tiktok", long));
ok("a 2:00 clip: Facebook greyed out (too_long, max 90); Instagram and TikTok available", !dFb.available && dFb.reason === "too_long" && dFb.limits.maxSeconds === 90 && dIg.available && dTt.available);
ok("…the sentence says so, in every language", langs.every((l) => typeof APP_MESSAGES[l]["app.videoPost.limit.facebook.too_long"] === "string" && APP_MESSAGES[l]["app.videoPost.limit.facebook.too_long"].includes("{max}")) && APP_MESSAGES.en["app.videoPost.limit.facebook.too_long"].replace("{max}", "90") === "Too long for a Facebook Reel (max 90 seconds)");
ok("a missing caption does NOT grey Instagram out (it's fixed on this screen)", vp.destinationState(vp.checkForPlatform("instagram", { ...vertical, caption: "" })).available);
const limitPairs = [];
for (const p of vp.PLATFORMS) for (const post of [long, { ...vertical, durationSec: 1 }, { ...vertical, width: 100, height: 178 }, { ...vertical, width: 5000, height: 8889 }, { ...vertical, durationSec: 0 }, { ...vertical, width: 0 }, { ...vertical, durationSec: 700 }]) {
  const d = vp.destinationState(vp.checkForPlatform(p, post));
  if (d.reason) limitPairs.push(`app.videoPost.limit.${p}.${d.reason}`);
}
for (const lang of langs) {
  const missing = [...new Set(limitPairs)].filter((k) => typeof APP_MESSAGES[lang][k] !== "string");
  ok(`${lang}: a greyed-out reason for every platform limit (${new Set(limitPairs).size})`, missing.length === 0, missing.join(", "));
}

const af = await import("../lib/marketing/approvalFingerprint.js");
const approvedPost = { videoPublicId: "a/b", fit: "original", coverMode: "frame", coverOffsetMs: 1000, coverImageUrl: null, caption: "Hi" };
const fp = af.videoFingerprint(approvedPost);
const withApproval = { ...approvedPost, approvedAt: new Date(), approvedFingerprint: fp };
ok("approved for exactly what it shows", af.videoApprovalState(withApproval).state === "approved");
ok("a changed caption, cover frame, cover mode, shape or clip → stale", ["caption", "coverOffsetMs", "coverMode", "fit", "videoPublicId"].every((k) => af.videoApprovalState({ ...withApproval, [k]: k === "coverOffsetMs" ? 2000 : k === "coverMode" ? "image" : `${withApproval[k]}x` }).state === "stale"));
ok("renaming it does not (the name isn't the post)", af.videoApprovalState({ ...withApproval, name: "renamed" }).state === "approved");
ok("the frame offset is irrelevant when an uploaded picture is the cover", af.videoFingerprint({ ...approvedPost, coverMode: "image", coverImageUrl: "u", coverOffsetMs: 1 }) === af.videoFingerprint({ ...approvedPost, coverMode: "image", coverImageUrl: "u", coverOffsetMs: 9 }));
ok("never approved → not_approved", af.videoApprovalState(approvedPost).state === "not_approved" && af.videoApprovalState(null).state === "not_approved");
const pub = read("app/api/marketing/video-posts/[id]/publish/route.js");
const tik = read("app/api/marketing/video-posts/[id]/tiktok/route.js");
ok("Instagram/Facebook publish refuses without a live approval, before any Meta call", pub.indexOf("videoApprovalState(post)") > 0 && pub.indexOf("videoApprovalState(post)") < pub.indexOf("startInstagramReel({"));
ok("TikTok refuses without a live approval, before init", tik.indexOf("const approval = videoApprovalState(post)") > 0 && tik.indexOf("const approval = videoApprovalState(post)") < tik.indexOf("initVideoPost({"));
ok("the composer reads the REAL approval (no more notRequired)", !/notRequired: true/.test(tik));
ok("PATCH withdraws a standing approval when caption/cover/shape change", /const APPROVED_FIELDS = \["caption", "fit", "coverMode", "coverOffsetMs", "coverImageUrl"\]/.test(itemRoute2) && /approvedAt: null, approvedById: null, approvedFingerprint: null/.test(itemRoute2));
ok("approve uses the same permission as a design's (user:manage) and the fingerprint guard", (() => { const s = read("app/api/marketing/video-posts/[id]/approval/route.js"); return /requirePermission\(member\.role, "user:manage"\)/.test(s) && /changed_since_review/.test(s); })());
ok("a support session's GET never writes (arrival check skipped when read-only)", /if \(member\.impersonationMode !== "read_only"\) post = /.test(itemRoute2));

// ══ 13 ══════════════════════════════════════════════════════════════════════
section("13. Shown wherever add-ons are sold or explained");

const pricingSrc = read("app/(marketing)/pricing/PricingPlans.js");
ok("/pricing names the pack from the constants, never a typed price", /pricingPage\.videoPosts/.test(pricingSrc) && /VIDEO_PACK\.priceCents/.test(pricingSrc) && !/\b77\b/.test(pricingSrc));
const { MESSAGES } = await import("../app/i18n/messages.js");
ok("/pricing sentence in every marketing language, with its four numbers as placeholders", Object.keys(MESSAGES).every((l) => ["{included}", "{price}", "{videos}", "{length}"].every((ph) => String(MESSAGES[l]["pricingPage.videoPosts"] || "").includes(ph))));
ok("Account & Billing shows the pack card (usage + Add video pack)", /<VideoPackCard/.test(read("app/app/settings/account-billing/page.js")));
ok("the video screen shows 'X of Y videos used this month'", /<VideoAllowanceLine/.test(read("app/app/marketing/designer/video/[id]/page.js")));
const helpTree = read("lib/help/tree.js");
ok("a help article exists in en, fr and es", /A\("video-posts"/.test(helpTree) && ["en", "fr", "es"].every((l) => /"video-posts":/.test(read(`content/help/${l}/marketing-and-website-2.js`))));
ok("…and it names the allowance, the pack, the 2:30 limit, Facebook's 90 s, 1080p and the approval", (() => {
  const s = read("content/help/en/marketing-and-website-2.js");
  const a = s.slice(s.indexOf('"video-posts":'));
  return /5 videos a month/.test(a) && /US\$77\/month/.test(a) && /2:30/.test(a) && /3 – 90 seconds/.test(a) && /1080/.test(a) && /Approve/.test(a);
})());

console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
