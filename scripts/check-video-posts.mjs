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
ok("created: 3 s – 600 s, real video only", upload({ resourceType: "video", width: 1, height: 1, durationSec: 3 }).ok && !upload({ resourceType: "video", width: 1, height: 1, durationSec: 601 }).ok && !upload({ resourceType: "image", width: 1, height: 1, durationSec: 5 }).ok && !upload(null).ok);
ok("created: over 100 MB refused", upload({ resourceType: "video", width: 1, height: 1, durationSec: 5, bytes: 101 * 1024 * 1024 }).errors.includes("file_too_large"));
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
ok("create: the clip must be this company's 'video' upload", /isOwnVideoId\(member\.companyId, publicId\)/.test(read("app/api/marketing/video-posts/route.js")));
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
for (const e of ["not_vertical", "rendition_not_ready", "reel_daily_limit", "container_error", "container_expired", "meta_video_format", "facebook_reel_failed", "unexpected", "not_ours", "campaign_required", "cloudinary_unavailable", "not_a_video", "no_duration", "file_too_large", "too_short", "too_long"]) produced.add(e);
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

console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
