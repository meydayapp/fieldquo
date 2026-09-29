// scripts/check-tiktok.mjs
//
// Executes the TikTok integration's decisions against hostile input — the
// parts that decide who can connect, who can read a company's unpublished
// artwork, what TikTok is told, and what a contractor is told back.
//
//   npm run check:tiktok
//
// Run with the alias loader (for `@/`) and the db stub loader (so importing
// lib/tiktok/connection.js never constructs a Prisma client); every database
// and TikTok call below goes through an injected recording fake instead.
//
// What it proves, in order:
//   1. "Coming soon" when the env is absent — the helpers AND the UI/route
//      branches that read them.
//   2. The OAuth state: tampered, expired, other member, other company, other
//      browser, cross-purpose.
//   3. The media URL: tampered, expired, other company's row, finished post,
//      edited image URL, verification file.
//   4. TikTok's webhook signature.
//   5. Privacy options and the composer's rules; the mandated defaults.
//   6. The exact request body TikTok is sent.
//   7. Status mapping and the idempotent/monotonic patch.
//   8. Error mapping — and a sentence for every code in every language.
//   9. Disconnect never deletes: every path that ends a connection, executed.
//  10. Refresh on use.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createHmac } from "node:crypto";

let checks = 0;
let failures = 0;
const ok = (name, pass, detail = "") => {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail && !pass ? `  — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(p, "utf8");

const ENV_KEYS = [
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_AUDITED",
  "TIKTOK_VERIFICATION_FILENAME",
  "TIKTOK_VERIFICATION_CONTENT",
  "META_TOKEN_ENCRYPTION_KEY",
];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
for (const k of ENV_KEYS) delete process.env[k];

const config = await import("../lib/tiktok/config.js");
const signing = await import("../lib/tiktok/signing.js");
const specs = await import("../lib/tiktok/specs.js");
const media = await import("../lib/tiktok/media.js");
const connection = await import("../lib/tiktok/connection.js");
const { encryptToken, decryptToken } = await import("../lib/meta/tokenCrypto.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");

// ══ 1 ═══════════════════════════════════════════════════════════════════════
section("1. Not configured means \"coming soon\", everywhere");

ok("nothing set → not configured", config.tiktokConfigured() === false);
ok(
  "nothing set → all three named as missing",
  JSON.stringify(config.tiktokMissingConfig()) ===
    JSON.stringify(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "META_TOKEN_ENCRYPTION_KEY"]),
  JSON.stringify(config.tiktokMissingConfig()),
);
process.env.TIKTOK_CLIENT_KEY = "ck";
process.env.TIKTOK_CLIENT_SECRET = "cs";
ok("key + secret but no encryption key → still not configured", config.tiktokConfigured() === false);
process.env.META_TOKEN_ENCRYPTION_KEY = "not-a-32-byte-key";
ok("a malformed encryption key → still not configured", config.tiktokConfigured() === false);
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
ok("all three → configured", config.tiktokConfigured() === true);
process.env.TIKTOK_CLIENT_KEY = "   ";
ok("a whitespace-only client key is not a client key", config.tiktokConfigured() === false);
process.env.TIKTOK_CLIENT_KEY = "ck";

ok("unaudited by default", config.tiktokAudited() === false);
process.env.TIKTOK_AUDITED = "true";
ok("TIKTOK_AUDITED=true is not \"1\" — stays unaudited", config.tiktokAudited() === false);
process.env.TIKTOK_AUDITED = "1";
ok("TIKTOK_AUDITED=1 → audited", config.tiktokAudited() === true);
delete process.env.TIKTOK_AUDITED;

ok("verification file: unset → null", config.tiktokVerificationFile() === null);
process.env.TIKTOK_VERIFICATION_FILENAME = "tiktokABC.txt";
ok("verification file: name without content → null", config.tiktokVerificationFile() === null);
process.env.TIKTOK_VERIFICATION_CONTENT = "tiktok-developers-site-verification=ABC";
ok(
  "verification file: both set → served as given",
  config.tiktokVerificationFile()?.filename === "tiktokABC.txt" &&
    config.tiktokVerificationFile()?.content === "tiktok-developers-site-verification=ABC",
);
process.env.TIKTOK_VERIFICATION_FILENAME = "../../etc/passwd";
ok("verification file: a name with a slash is refused", config.tiktokVerificationFile() === null);
delete process.env.TIKTOK_VERIFICATION_FILENAME;
delete process.env.TIKTOK_VERIFICATION_CONTENT;

// The branches that READ the helpers — a coming-soon helper nobody consults is
// failure class 1.
const panel = read("app/components/settings/TikTokPanel.js");
const comingSoonBlock = panel.slice(panel.indexOf("State 1"), panel.indexOf("State 2"));
ok("settings card: a coming-soon card is drawn when !configured", /status && !status\.configured/.test(comingSoonBlock) && /data-tiktok-coming-soon/.test(comingSoonBlock));
ok("settings card: the coming-soon card has no Connect link or button", !/api\/tiktok\/connect|<button/.test(comingSoonBlock));
ok("settings card: Connect is only drawn when configured", /status\?\.configured && !connection/.test(panel));
const connectRoute = read("app/api/tiktok/connect/route.js");
ok("connect route refuses when not configured, before building a URL", connectRoute.indexOf("tiktokConfigured()") < connectRoute.indexOf("TIKTOK_AUTHORIZE_URL)"));
const designerRoute = read("app/api/marketing/designer/designs/[id]/tiktok/route.js");
ok("publish route refuses when not configured", /if \(!tiktokConfigured\(\)\) return refuse\(403, "not_available"/.test(designerRoute));
const editor = read("app/components/designer/CampaignEditor.js");
ok("designer draws the TikTok button only when available AND connected", /setTiktokReady\(Boolean\(data\.available && data\.connected\)\)/.test(editor) && /\{tiktokReady && \(/.test(editor));
const publishModal = read("app/components/designer/PublishModal.js");
ok("Publish dialog offers TikTok only when connected", /!loadingConnection && !done && tiktokConnected && onChooseTikTok && \(/.test(publishModal) && /tiktokConnected=\{tiktokReady\}/.test(editor));
ok("the Publish button exists for a TikTok-only company", /\(socialVisible \|\| tiktokReady\) && \(/.test(editor));
const sidebar = read("app/components/layout/SettingsSidebar.js");
const metaRow = sidebar.indexOf('key: "app.settings.metaAds"');
const tiktokRow = sidebar.indexOf('key: "app.settings.tiktok"');
ok("Settings sidebar: a TikTok row directly under Meta Ads", metaRow > 0 && tiktokRow > metaRow && !sidebar.slice(metaRow, tiktokRow).includes("{ key:") && /href: "\/app\/settings\/tiktok"/.test(sidebar));
ok("Settings › TikTok page renders the panel behind the billing gate", /canSee\("billing"\)/.test(read("app/app/settings/tiktok/page.js")) && /<TikTokPanel \/>/.test(read("app/app/settings/tiktok/page.js")));
ok("TikTok is NOT on the Meta Ads page", !/TikTok/.test(read("app/app/settings/meta-ads/page.js")));
const cron = read("app/api/cron/tiktok-token-refresh/route.js");
ok("cron skips when not configured", /if \(!tiktokConfigured\(\)\) return NextResponse\.json\(\{ success: true, skipped: "not_configured" \}\)/.test(cron));

// ══ 2 ═══════════════════════════════════════════════════════════════════════
section("2. OAuth state is bound to this member, this company, this browser");

const rootKey = signing.signingRootKey();
const otherKey = randomBytes(32);
const now = 1_900_000_000;
const nonce = signing.newOAuthNonce();
const state = signing.makeOAuthState({ rootKey, companyId: "coA", userId: "u1", nonce, nowSeconds: now });
const verifyState = (s, over = {}) =>
  signing.verifyOAuthState(s, { rootKey, cookieNonce: nonce, companyId: "coA", userId: "u1", nowSeconds: now + 5, ...over });

ok("the state it minted verifies", verifyState(state).ok === true);
ok("another company finishing the flow → other_member", verifyState(state, { companyId: "coB" }).reason === "other_member");
ok("another member of the same company → other_member", verifyState(state, { userId: "u2" }).reason === "other_member");
ok("another browser (cookie nonce differs) → nonce_mismatch", verifyState(state, { cookieNonce: "nope" }).reason === "nonce_mismatch");
ok("no cookie at all → nonce_mismatch", verifyState(state, { cookieNonce: null }).reason === "nonce_mismatch");
ok("expired after ten minutes → expired", verifyState(state, { nowSeconds: now + signing.OAUTH_STATE_TTL_SECONDS + 1 }).reason === "expired");
ok("signed with another key → bad_signature", verifyState(state, { rootKey: otherKey }).reason === "bad_signature");
{
  const [payload, sig] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url")), c: "coB" })).toString("base64url");
  ok("payload rewritten to another company, old signature → bad_signature", verifyState(`${forged}.${sig}`, { companyId: "coB" }).reason === "bad_signature");
  ok("signature truncated → bad_signature", verifyState(`${payload}.${sig.slice(0, -2)}`).reason === "bad_signature");
}
for (const junk of [null, undefined, "", ".", "a.b.c", "x".repeat(5000), "e30.", 42, {}, "bm90anNvbg.abc"]) {
  ok(`garbage state ${JSON.stringify(junk)?.slice(0, 20)} → refused`, verifyState(junk).ok === false);
}
ok("no root key → refused", verifyState(state, { rootKey: null }).ok === false);
const mediaAsState = signing.makeMediaToken({ rootKey, publishId: "p1", companyId: "coA", nowSeconds: now });
ok("a media token is not a valid state (separate subkeys)", verifyState(mediaAsState).reason === "bad_signature");

// ══ 3 ═══════════════════════════════════════════════════════════════════════
section("3. The media URL opens one row, of one company, for one hour");

const token = signing.makeMediaToken({ rootKey, publishId: "pub_1", companyId: "coA", nowSeconds: now });
const vm = (t, over = {}) => signing.verifyMediaToken(t, { rootKey, nowSeconds: now + 10, ...over });
ok("valid token verifies and names row + company", vm(token).ok && vm(token).publishId === "pub_1" && vm(token).companyId === "coA");
ok("the .jpg the URL carries is accepted", vm(`${token}.jpg`).ok === true);
ok("mediaUrlFor builds the registered prefix", signing.mediaUrlFor("https://www.fieldquo.com/", token) === `https://www.fieldquo.com/api/tiktok/media/${token}.jpg`);
ok("expired after an hour → expired", vm(token, { nowSeconds: now + signing.MEDIA_TOKEN_TTL_SECONDS + 1 }).reason === "expired");
ok("another key → bad_signature", vm(token, { rootKey: otherKey }).reason === "bad_signature");
{
  const [payload, sig] = token.split(".");
  const p = JSON.parse(Buffer.from(payload, "base64url"));
  const swap = (o) => `${Buffer.from(JSON.stringify({ ...p, ...o })).toString("base64url")}.${sig}`;
  ok("row id swapped → bad_signature", vm(swap({ p: "pub_2" })).reason === "bad_signature");
  ok("company swapped → bad_signature", vm(swap({ c: "coB" })).reason === "bad_signature");
  ok("expiry extended → bad_signature", vm(swap({ e: p.e + 10 ** 6 })).reason === "bad_signature");
}
ok("a state value is not a media token", vm(state).reason === "bad_signature");

const rows = {
  pub_1: { companyId: "coA", status: "processing", imageUrl: "https://res.cloudinary.com/x/image/upload/a.jpg" },
  pub_done: { companyId: "coA", status: "published", imageUrl: "https://res.cloudinary.com/x/image/upload/b.jpg" },
  pub_evil: { companyId: "coA", status: "pending", imageUrl: "https://169.254.169.254/latest/meta-data" },
  pub_B: { companyId: "coB", status: "processing", imageUrl: "https://res.cloudinary.com/x/image/upload/c.jpg" },
};
const resolveSeg = (segment, over = {}) =>
  media.resolveMediaRequest({
    segment,
    rootKey,
    nowSeconds: now + 10,
    verificationFile: null,
    loadRow: async (id) => rows[id] || null,
    ...over,
  });
const tok = (publishId, companyId) => signing.makeMediaToken({ rootKey, publishId, companyId, nowSeconds: now });
ok("processing row of the token's company → image", (await resolveSeg(`${tok("pub_1", "coA")}.jpg`))?.imageUrl === rows.pub_1.imageUrl);
ok("company A's valid token naming company B's row → nothing", (await resolveSeg(tok("pub_B", "coA"))) === null);
ok("a published post is no longer pullable → nothing", (await resolveSeg(tok("pub_done", "coA"))) === null);
ok("a row whose image URL is not Cloudinary → nothing (no open proxy)", (await resolveSeg(tok("pub_evil", "coA"))) === null);
ok("a row that does not exist → nothing", (await resolveSeg(tok("pub_missing", "coA"))) === null);
ok("expired token → nothing", (await resolveSeg(tok("pub_1", "coA"), { nowSeconds: now + 3601 })) === null);
ok("no root key configured → nothing", (await resolveSeg(tok("pub_1", "coA"), { rootKey: null })) === null);
{
  const file = { filename: "tiktokXYZ.txt", content: "tiktok-developers-site-verification=XYZ" };
  const hit = await resolveSeg("tiktokXYZ.txt", { verificationFile: file });
  ok("the verification file name → the verification file", hit?.kind === "verification" && hit.file.content === file.content);
  ok("a different name with a file configured → nothing", (await resolveSeg("tiktokXYZ.txt.bak", { verificationFile: file })) === null);
}
const mediaRoute = read("app/api/tiktok/media/[token]/route.js");
ok("media route answers no-store and never redirects", /no-store/.test(mediaRoute) && !/NextResponse\.redirect|Response\.redirect|status: 30\d/.test(mediaRoute));

// ══ 4 ═══════════════════════════════════════════════════════════════════════
section("4. TikTok's webhook signature");

const secret = "client-secret-xyz";
const body = JSON.stringify({ client_key: "ck", event: "post.publish.complete", user_openid: "o1", content: "{\"publish_id\":\"p\"}" });
const sigFor = (t, b = body, s = secret) => createHmac("sha256", s).update(`${t}.${b}`).digest("hex");
const vw = (header, over = {}) => signing.verifyWebhookSignature({ header, rawBody: body, secret, nowSeconds: now, ...over });
ok("a correct signature verifies", vw(`t=${now},s=${sigFor(now)}`).ok === true);
ok("upper-case hex verifies too", vw(`t=${now},s=${sigFor(now).toUpperCase()}`).ok === true);
ok("body changed by one byte → bad_signature", vw(`t=${now},s=${sigFor(now)}`, { rawBody: body.replace("complete", "completE") }).reason === "bad_signature");
ok("signed with another secret → bad_signature", vw(`t=${now},s=${sigFor(now, body, "other")}`).reason === "bad_signature");
ok("timestamp swapped after signing → bad_signature", vw(`t=${now + 1},s=${sigFor(now)}`).reason === "bad_signature");
ok("replayed ten minutes later → stale", vw(`t=${now - 600},s=${sigFor(now - 600)}`).reason === "stale");
ok("from ten minutes in the future → stale", vw(`t=${now + 600},s=${sigFor(now + 600)}`).reason === "stale");
for (const h of [null, "", "t=,s=", `s=${sigFor(now)}`, `t=${now}`, `t=abc,s=${sigFor(now)}`, `t=${now},s=zz`]) {
  ok(`malformed header ${JSON.stringify(h)?.slice(0, 24)} → refused`, vw(h).ok === false);
}
ok("no secret configured → no_secret (the route answers 503)", vw(`t=${now},s=${sigFor(now)}`, { secret: null }).reason === "no_secret");
const webhookRoute = read("app/api/tiktok/webhook/route.js");
ok("webhook verifies BEFORE parsing the body", webhookRoute.indexOf("verifyWebhookSignature(") < webhookRoute.indexOf("JSON.parse(rawBody)"));
ok("webhook requires the row's openId to match user_openid", /row\.openId !== openId/.test(webhookRoute));

// ══ 5 ═══════════════════════════════════════════════════════════════════════
section("5. Privacy options, composer rules, mandated defaults");

const ALL = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];
ok("unaudited: only Only me survives", JSON.stringify(specs.offeredPrivacyOptions({ creatorOptions: ALL, audited: false })) === '["SELF_ONLY"]');
ok("audited: TikTok's list, as given", JSON.stringify(specs.offeredPrivacyOptions({ creatorOptions: ALL, audited: true })) === JSON.stringify(ALL));
ok("unknown values from TikTok are dropped, not shown raw", JSON.stringify(specs.offeredPrivacyOptions({ creatorOptions: ["EVERYONE_ON_MARS", "SELF_ONLY", 7, null], audited: true })) === '["SELF_ONLY"]');
ok("duplicates collapse", specs.offeredPrivacyOptions({ creatorOptions: ["SELF_ONLY", "SELF_ONLY"], audited: true }).length === 1);
ok("not an array → nothing offered", specs.offeredPrivacyOptions({ creatorOptions: "SELF_ONLY", audited: true }).length === 0);
ok("unaudited creator without Only me → nothing offered", specs.offeredPrivacyOptions({ creatorOptions: ["PUBLIC_TO_EVERYONE"], audited: false }).length === 0);

const creatorInfo = { privacyLevelOptions: ALL, commentDisabled: false };
const base = { ...specs.COMPOSER_DEFAULTS, description: "Kitchen refresh", creatorInfo, audited: true };
const v = (o) => specs.validateTikTokPost({ ...base, ...o });
ok("defaults alone cannot post: privacy_required", v({}).errors.includes("privacy_required"));
ok("a chosen, offered level posts", v({ privacyLevel: "PUBLIC_TO_EVERYONE" }).ok === true);
ok("a level TikTok did not offer → privacy_not_offered", v({ privacyLevel: "FOLLOWER_OF_CREATOR" }).errors.includes("privacy_not_offered"));
ok("unaudited + Everyone → privacy_not_offered", v({ privacyLevel: "PUBLIC_TO_EVERYONE", audited: false }).errors.includes("privacy_not_offered"));
ok("unaudited + Only me → allowed", v({ privacyLevel: "SELF_ONLY", audited: false }).ok === true);
ok("a made-up level → privacy_not_offered", v({ privacyLevel: "'; DROP TABLE" }).errors.includes("privacy_not_offered"));
ok("comment on while the creator disabled comments → refused", v({ privacyLevel: "SELF_ONLY", allowComment: true, creatorInfo: { ...creatorInfo, commentDisabled: true } }).errors.includes("comment_disabled_by_creator"));
ok("disclosure on with neither box → commercial_choice_required", v({ privacyLevel: "SELF_ONLY", commercialOn: true }).errors.includes("commercial_choice_required"));
ok("branded content + Only me → branded_content_private", v({ privacyLevel: "SELF_ONLY", commercialOn: true, brandedContent: true }).errors.includes("branded_content_private"));
ok("your brand + Only me → allowed", v({ privacyLevel: "SELF_ONLY", commercialOn: true, yourBrand: true }).ok === true);
ok("branded content + Everyone → allowed", v({ privacyLevel: "PUBLIC_TO_EVERYONE", commercialOn: true, brandedContent: true }).ok === true);
ok("4000 UTF-16 units fits", v({ privacyLevel: "SELF_ONLY", description: "a".repeat(4000) }).ok === true);
ok("4001 → description_too_long", v({ privacyLevel: "SELF_ONLY", description: "a".repeat(4001) }).errors.includes("description_too_long"));
ok("2000 emoji (4000 units) fits; 2001 does not", v({ privacyLevel: "SELF_ONLY", description: "🏠".repeat(2000) }).ok && !v({ privacyLevel: "SELF_ONLY", description: "🏠".repeat(2001) }).ok);
ok("no creator_info → cannot post", v({ privacyLevel: "SELF_ONLY", creatorInfo: null }).ok === false);
ok("Only me greyed out while branded content is ticked", specs.privacyOptionBlockedBy("SELF_ONLY", { commercialOn: true, brandedContent: true }) === "branded_content_private");
ok("Only me available otherwise", specs.privacyOptionBlockedBy("SELF_ONLY", { commercialOn: true, yourBrand: true }) === null);
ok("branded content greyed out while Only me is chosen", specs.brandedContentBlockedBy({ privacyLevel: "SELF_ONLY" }) === "branded_content_private");
ok("label: your brand → Promotional content", specs.commercialLabel({ commercialOn: true, yourBrand: true }) === "promotional");
ok("label: both → Paid partnership", specs.commercialLabel({ commercialOn: true, yourBrand: true, brandedContent: true }) === "paid_partnership");
ok("label: disclosure off → none, whatever the boxes say", specs.commercialLabel({ commercialOn: false, yourBrand: true, brandedContent: true }) === null);
ok("consent: default is Music Usage Confirmation", specs.consentLine({}) === "music");
ok("consent: branded adds the Branded Content Policy", specs.consentLine({ commercialOn: true, brandedContent: true }) === "branded_and_music");
ok("creator_info 200 + spam_risk_too_many_posts → stop", specs.creatorPostingBlock("spam_risk_too_many_posts") === "spam_risk_too_many_posts");
ok("creator_info ok → go", specs.creatorPostingBlock("ok") === null);

ok("default privacy is none (TikTok forbids a default)", specs.COMPOSER_DEFAULTS.privacyLevel === null);
ok("every toggle starts off", ["allowComment", "commercialOn", "yourBrand", "brandedContent"].every((k) => specs.COMPOSER_DEFAULTS[k] === false));
ok("the defaults cannot be mutated by a caller", Object.isFrozen(specs.COMPOSER_DEFAULTS));
const modal = read("app/components/designer/TikTokPublishModal.js");
ok("composer starts from COMPOSER_DEFAULTS and resets to it on open", (modal.match(/COMPOSER_DEFAULTS\)/g) || []).length >= 2);
ok("privacy select has a disabled empty placeholder and no pre-selected option", /<option value="" disabled>/.test(modal) && /value=\{choice\.privacyLevel \|\| ""\}/.test(modal) && !/\bselected\b/.test(modal));
ok("comment checkbox is disabled when the creator disabled comments", /disabled=\{creatorInfo\.commentDisabled\}/.test(modal));
ok("composer shows the creator's nickname", /postingAs", \{ name: creatorInfo\.nickname/.test(modal));
ok("composer states the unaudited privacy rule before posting", /!audited && \(/.test(modal) && /app\.tiktokPublish\.unauditedNotice/.test(modal));
ok("composer states the processing delay", /app\.tiktokPublish\.processingNote/.test(modal));
ok("composer fetches creator_info every time it opens", /fetchJson\("\/api\/tiktok\/creator-info"\)/.test(modal) && /\[isOpen, design\?\.id\]/.test(modal));
ok("server refetches creator_info on the POST itself", /queryCreatorInfo\(\{ accessToken: access\.accessToken \}\)/.test(designerRoute) && designerRoute.indexOf("queryCreatorInfo(") < designerRoute.indexOf("validateTikTokPost("));
ok("server requires the approval, as the Meta route does", /approvalState\(design, design\.layouts\)/.test(designerRoute.slice(designerRoute.indexOf("export async function POST"))));

// ══ 6 ═══════════════════════════════════════════════════════════════════════
section("6. What TikTok is sent");

const url = "https://www.fieldquo.com/api/tiktok/media/t.jpg";
const bodyDefault = specs.buildPhotoPostBody({ ...specs.COMPOSER_DEFAULTS, privacyLevel: "SELF_ONLY", description: "Hi", photoUrl: url });
ok("Direct Post of a PHOTO pulled from our URL", bodyDefault.media_type === "PHOTO" && bodyDefault.post_mode === "DIRECT_POST" && bodyDefault.source_info.source === "PULL_FROM_URL" && bodyDefault.source_info.photo_images[0] === url && bodyDefault.source_info.photo_cover_index === 0);
ok("comments off unless ticked (disable_comment: true)", bodyDefault.post_info.disable_comment === true);
ok("both brand toggles false by default", bodyDefault.post_info.brand_content_toggle === false && bodyDefault.post_info.brand_organic_toggle === false);
ok("no music is added that nobody chose", !("auto_add_music" in bodyDefault.post_info));
const bodyOffBoxes = specs.buildPhotoPostBody({ privacyLevel: "SELF_ONLY", commercialOn: false, yourBrand: true, brandedContent: true, photoUrl: url });
ok("disclosure off → toggles false even if stale boxes are true", bodyOffBoxes.post_info.brand_content_toggle === false && bodyOffBoxes.post_info.brand_organic_toggle === false);
const bodyTruthy = specs.buildPhotoPostBody({ privacyLevel: "SELF_ONLY", allowComment: "yes", commercialOn: 1, yourBrand: "true", photoUrl: url });
ok("truthy-but-not-true inputs are not taken as consent", bodyTruthy.post_info.disable_comment === true && bodyTruthy.post_info.brand_organic_toggle === false);
ok("photo 1080×1920 fits", specs.validateTikTokPhoto({ width: 1080, height: 1920, bytes: 900_000 }).ok);
ok("photo 1081 wide → resolution_too_large", specs.validateTikTokPhoto({ width: 1081, height: 1920 }).errors.includes("resolution_too_large"));
ok("photo with no dimensions → refused", !specs.validateTikTokPhoto({ width: NaN, height: 10 }).ok);
ok("photo over 20MB → file_too_large", specs.validateTikTokPhoto({ width: 1080, height: 1920, bytes: 21 * 1024 * 1024 }).errors.includes("file_too_large"));
ok("JPEG magic recognised; PNG refused", specs.isJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe0])) && !specs.isJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47])));

// "Send to TikTok as a draft" — MEDIA_UPLOAD, scope video.upload.
const draft = specs.buildPhotoDraftBody({ description: "Hi", photoUrl: url });
ok("draft: MEDIA_UPLOAD of a PHOTO pulled from our URL", draft.media_type === "PHOTO" && draft.post_mode === "MEDIA_UPLOAD" && draft.source_info.source === "PULL_FROM_URL" && draft.source_info.photo_images[0] === url);
ok("draft: only the description is sent (privacy/comment/brand are DIRECT_POST-only)", JSON.stringify(Object.keys(draft.post_info)) === '["description"]');
ok("draft: needs no privacy level", specs.validateTikTokDraft({ description: "Hi", creatorInfo }).ok === true);
ok("draft: still refuses a caption over 4000", specs.validateTikTokDraft({ description: "a".repeat(4001), creatorInfo }).errors.includes("description_too_long"));
ok("draft: still needs creator_info", specs.validateTikTokDraft({ description: "Hi", creatorInfo: null }).ok === false);
ok("every scope asked for is exercised: video.upload by the draft, video.publish by the post", JSON.stringify(config.TIKTOK_SCOPES) === '["user.info.basic","video.publish","video.upload"]' && /buildPhotoDraftBody/.test(designerRoute) && /buildPhotoPostBody/.test(designerRoute));
ok("draft is only sent on body.mode === \"draft\" — anything else is a Direct Post with every check", /const isDraft = body\?\.mode === "draft";/.test(designerRoute));
ok("composer: the draft is its own explicit button", /onClick=\{\(\) => handlePost\("draft"\)\}/.test(modal) && /onClick=\{\(\) => handlePost\("post"\)\}/.test(modal));
ok("app_version_check_failed (drafts need TikTok ≥ 31.8) is a known code", specs.classifyTikTokError({ status: 400, code: "app_version_check_failed" }).known);

// ══ 7 ═══════════════════════════════════════════════════════════════════════
section("7. Status: mapped, idempotent, never moves a finished post");

ok("PROCESSING_DOWNLOAD → processing", specs.mapTikTokStatus("PROCESSING_DOWNLOAD") === "processing");
ok("PUBLISH_COMPLETE → published", specs.mapTikTokStatus("PUBLISH_COMPLETE") === "published");
ok("FAILED → failed", specs.mapTikTokStatus("FAILED") === "failed");
ok("an unknown status → null (not a guess)", specs.mapTikTokStatus("SOMETHING_NEW") === null);
const t0 = new Date("2026-09-29T12:00:00Z");
ok("processing → published stamps publishedAt", specs.statusPatch({ status: "processing" }, { status: "published" }, t0)?.publishedAt === t0);
ok("a duplicate observation writes nothing", specs.statusPatch({ status: "processing" }, { status: "processing" }) === null);
ok("published is never moved back to processing", specs.statusPatch({ status: "published" }, { status: "processing" }) === null);
ok("published is never moved to failed by a late event", specs.statusPatch({ status: "published" }, { status: "failed", failReason: "x" }) === null);
ok("failed is never revived", specs.statusPatch({ status: "failed" }, { status: "published" }) === null);
ok("a public post id still lands on a published row", specs.statusPatch({ status: "published", publicPostId: null }, { status: "published", publicPostId: "123" })?.publicPostId === "123");
ok("a hostile 10k fail_reason is cut to 80", specs.statusPatch({ status: "processing" }, { status: "failed", failReason: "x".repeat(10000) })?.failReason.length === 80);
ok("webhook complete → published", specs.observationFromWebhook("post.publish.complete", {})?.status === "published");
ok("webhook failed carries reason", specs.observationFromWebhook("post.publish.failed", { reason: "photo_pull_failed" })?.failReason === "photo_pull_failed");
ok("webhook publicly_available carries post_id", specs.observationFromWebhook("post.publish.publicly_available", { post_id: 7 })?.publicPostId === "7");
ok("webhook no_longer_publicaly_available (TikTok's spelling) clears it", specs.observationFromWebhook("post.publish.no_longer_publicaly_available", {})?.publicPostId === null);
ok("an unrelated event → nothing", specs.observationFromWebhook("video.upload.failed", {}) === null);

// ══ 8 ═══════════════════════════════════════════════════════════════════════
section("8. Every known code has its own sentence, in every language");

const DOC_CODES = [
  "access_token_invalid", "scope_not_authorized", "rate_limit_exceeded", "spam_risk_too_many_posts",
  "spam_risk_user_banned_from_posting", "spam_risk_too_many_pending_share", "reached_active_user_cap",
  "unaudited_client_can_only_post_to_private_accounts", "url_ownership_unverified", "privacy_level_option_mismatch",
  "invalid_param", "file_format_check_failed", "picture_size_check_failed", "photo_pull_failed", "publish_cancelled",
  "auth_removed", "spam_risk_text", "spam_risk",
];
for (const code of DOC_CODES) {
  const c = specs.classifyTikTokError({ status: 403, code });
  ok(`${code} → known, its own code`, c.known && c.code === code, JSON.stringify(c));
}
ok("fail_reason internal → internal_error (retryable)", specs.classifyTikTokError({ code: "internal" }).code === "internal_error" && specs.classifyTikTokError({ code: "internal" }).retryable);
ok("401 with no code → reconnect", specs.classifyTikTokError({ status: 401 }).fix === "reconnect");
ok("429 with no code → rate_limit_exceeded", specs.classifyTikTokError({ status: 429 }).code === "rate_limit_exceeded");
ok("503 with no code → internal_error", specs.classifyTikTokError({ status: 503 }).code === "internal_error");
ok("an unknown code is kept, not replaced by a generic one", specs.classifyTikTokError({ status: 400, code: "brand_new_code" }).code === "brand_new_code" && specs.classifyTikTokError({ code: "brand_new_code" }).known === false);
ok("\"ok\" is not an error code", specs.classifyTikTokError({ status: 400, code: "ok" }).code === "tiktok_error");
ok("url_ownership_unverified is FieldQuo's fix, not the contractor's", specs.classifyTikTokError({ code: "url_ownership_unverified" }).fix === "fieldquo");

const localCodes = [...modal.matchAll(/^\s+"([a-z_]+)",$/gm)].map((m) => m[1]);
const everyCode = [...new Set([...Object.keys(specs.TIKTOK_ERRORS), ...localCodes, "unknown"])];
const langs = Object.keys(APP_MESSAGES);
ok(`the composer's code list was found (${localCodes.length} local codes)`, localCodes.length >= 10);
for (const lang of langs) {
  const missing = everyCode.filter((c) => typeof APP_MESSAGES[lang][`app.tiktok.error.${c}`] !== "string");
  ok(`${lang}: a sentence for every TikTok code (${everyCode.length})`, missing.length === 0, missing.join(", "));
}
const usedKeys = new Set();
for (const f of ["app/components/designer/TikTokPublishModal.js", "app/components/settings/TikTokPanel.js", "app/components/designer/CampaignEditor.js"]) {
  for (const m of read(f).matchAll(/"(app\.(?:tiktok|tiktokPublish|setTikTok)\.[A-Za-z_.]+)"/g)) usedKeys.add(m[1]);
}
for (const o of specs.PRIVACY_LEVELS) usedKeys.add(`app.tiktok.privacy.${o}`);
for (const lang of langs) {
  const missing = [...usedKeys].filter((k) => typeof APP_MESSAGES[lang][k] !== "string");
  ok(`${lang}: every literal key the TikTok screens use (${usedKeys.size})`, missing.length === 0, missing.join(", "));
}
for (const lang of langs) {
  const bad = [...usedKeys, ...everyCode.map((c) => `app.tiktok.error.${c}`)].filter((k) => {
    const en = (APP_MESSAGES.en[k] || "").match(/\{\w+\}/g) || [];
    const tr = (APP_MESSAGES[lang][k] || "").match(/\{\w+\}/g) || [];
    return en.sort().join() !== tr.sort().join();
  });
  ok(`${lang}: placeholders match English`, bad.length === 0, bad.join(", "));
}

// ══ 9 ═══════════════════════════════════════════════════════════════════════
section("9. Ending a connection never deletes it");

function recordingClient(seed = []) {
  const calls = [];
  const table = seed.map((r) => ({ ...r }));
  const match = (r, where = {}) =>
    Object.entries(where).every(([k, val]) => {
      if (k === "NOT") return !match(r, val);
      if (val && typeof val === "object" && !(val instanceof Date) && "lte" in val) return r[k] && new Date(r[k]) <= val.lte;
      return (r[k] ?? null) === (val ?? null);
    });
  const model = {
    findFirst: async ({ where }) => (calls.push(["findFirst", where]), table.find((r) => match(r, where)) || null),
    findMany: async ({ where }) => (calls.push(["findMany", where]), table.filter((r) => match(r, where))),
    updateMany: async ({ where, data }) => {
      calls.push(["updateMany", where, data]);
      let count = 0;
      for (const r of table) if (match(r, where)) (Object.assign(r, data), count++);
      return { count };
    },
    update: async ({ where, data }) => {
      calls.push(["update", where, data]);
      const r = table.find((x) => x.id === where.id);
      Object.assign(r, data);
      return { ...r };
    },
    upsert: async ({ where, create, update }) => {
      calls.push(["upsert", where]);
      const key = where.companyId_openId;
      const r = table.find((x) => x.companyId === key.companyId && x.openId === key.openId);
      if (r) return Object.assign(r, update);
      const row = { id: `row${table.length + 1}`, ...create };
      table.push(row);
      return row;
    },
    delete: async () => calls.push(["delete"]),
    deleteMany: async () => calls.push(["deleteMany"]),
  };
  return { client: { tikTokConnection: model }, calls, table };
}
const deletes = (calls) => calls.filter(([a]) => a === "delete" || a === "deleteMany").length;
const live = (id, over = {}) => ({
  id,
  companyId: "coA",
  openId: `open_${id}`,
  accessTokenEnc: encryptToken(`access_${id}`),
  refreshTokenEnc: encryptToken(`refresh_${id}`),
  accessTokenExpiresAt: new Date(Date.now() + 3600_000),
  refreshTokenExpiresAt: new Date(Date.now() + 200 * 86400_000),
  disconnectedAt: null,
  ...over,
});

{
  const { client, calls, table } = recordingClient([live("r1")]);
  const n = await connection.disconnectTikTokConnection("coA", { reason: "user", revokeError: "http_500", client });
  const r = table[0];
  ok("Disconnect: one row stamped", n === 1);
  ok("Disconnect: row kept, both tokens nulled, disconnectedAt + reason set", table.length === 1 && r.accessTokenEnc === null && r.refreshTokenEnc === null && r.disconnectedAt instanceof Date && r.disconnectReason === "user");
  ok("Disconnect: an unconfirmed revoke is recorded on the row", r.revokeError === "http_500");
  ok("Disconnect: no delete issued", deletes(calls) === 0);
  const again = await connection.disconnectTikTokConnection("coA", { client });
  ok("Disconnect twice: a harmless no-op", again === 0 && table.length === 1);
  const weird = recordingClient([live("r9")]);
  await connection.disconnectTikTokConnection("coA", { reason: "drop table", client: weird.client });
  ok("Disconnect: an unknown reason is stored as \"user\", not as given", weird.table[0].disconnectReason === "user");
}
{
  const { client, calls, table } = recordingClient([live("r1", { openId: "same" }), live("r2", { companyId: "coB", openId: "same" }), live("r3", { openId: "other" })]);
  const n = await connection.markAuthorizationRemoved("same", { client });
  ok("authorization.removed: every live row for that TikTok account stamped", n === 2 && table.filter((r) => r.disconnectReason === "authorization_removed").length === 2);
  ok("authorization.removed: another account untouched", table[2].disconnectedAt === null && table[2].accessTokenEnc !== null);
  ok("authorization.removed: no delete", deletes(calls) === 0 && table.length === 3);
  ok("authorization.removed with no open_id: nothing", (await connection.markAuthorizationRemoved(null, { client })) === 0);
}
{
  const { client, calls, table } = recordingClient([live("old", { openId: "first" })]);
  await connection.saveTikTokConnection(
    { companyId: "coA", openId: "second", accessToken: "a2", refreshToken: "r2", expiresIn: 86400, refreshExpiresIn: 31536000, scopes: "user.info.basic,video.publish" },
    { client },
  );
  ok("Connecting another account: the old row is stamped replaced, not deleted", table.find((r) => r.openId === "first")?.disconnectReason === "replaced" && deletes(calls) === 0);
  const fresh = table.find((r) => r.openId === "second");
  ok("Connecting: tokens stored encrypted, never plain", fresh.accessTokenEnc !== "a2" && decryptToken(fresh.accessTokenEnc) === "a2" && decryptToken(fresh.refreshTokenEnc) === "r2");
  ok("Connecting: 24h / 365d expiries recorded", Math.abs(fresh.accessTokenExpiresAt - Date.now() - 86400_000) < 60_000 && fresh.refreshTokenExpiresAt > new Date(Date.now() + 360 * 86400_000));
  ok("public shape carries no token", !JSON.stringify(connection.publicTikTokShape(fresh)).includes(fresh.accessTokenEnc));
  ok("missing scopes: granted list compared to asked", JSON.stringify(connection.missingTikTokScopes("user.info.basic,video.publish")) === '["video.upload"]' && connection.missingTikTokScopes(null) === null);
}
{
  const src = ["lib/tiktok", "app/api/tiktok", "app/api/cron/tiktok-token-refresh"].flatMap(function walk(p) {
    return statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(join(p, n))) : [p];
  });
  // A database delete — `db.x.delete(`, `client.x.deleteMany(` — not the
  // callback's cookieStore.delete(), which removes the one-use OAuth cookie.
  const offenders = src.filter((f) => /\b(?:db|client|tx)\s*\.\s*\w+\s*\.\s*(?:delete|deleteMany)\s*\(/.test(read(f)));
  ok("no file in the TikTok integration issues a database delete", offenders.length === 0, offenders.join(", "));
}

// ══ 10 ══════════════════════════════════════════════════════════════════════
section("10. Refresh on use; a network blip never disconnects");

function fakeApi(result) {
  const calls = [];
  return { calls, api: { refreshAccessToken: async (args) => (calls.push(args), result) } };
}
{
  const { client } = recordingClient([live("r1")]);
  const { api, calls } = fakeApi({ ok: true, data: {} });
  const a = await connection.getTikTokAccess("coA", { client, api });
  ok("fresh token: returned without a refresh call", a.connected && a.accessToken === "access_r1" && calls.length === 0);
}
{
  const { client, table } = recordingClient([live("r1", { accessTokenExpiresAt: new Date(Date.now() + 60_000) })]);
  const { api, calls } = fakeApi({ ok: true, data: { access_token: "new_access", expires_in: 86400, refresh_token: "new_refresh", refresh_expires_in: 31536000 } });
  const a = await connection.getTikTokAccess("coA", { client, api });
  ok("expiring token: refreshed with the decrypted refresh token", calls[0]?.refreshToken === "refresh_r1");
  ok("expiring token: the new pair is stored encrypted", a.accessToken === "new_access" && decryptToken(table[0].accessTokenEnc) === "new_access" && decryptToken(table[0].refreshTokenEnc) === "new_refresh");
}
{
  const { client, table } = recordingClient([live("r1", { accessTokenExpiresAt: new Date(0) })]);
  const { api } = fakeApi({ ok: false, status: 0, code: "network" });
  const a = await connection.getTikTokAccess("coA", { client, api });
  ok("refresh network failure: not connected right now, but the row is untouched", a.connected === false && a.reason === "refresh_failed" && table[0].disconnectedAt === null && table[0].refreshTokenEnc !== null);
}
{
  const { client, table } = recordingClient([live("r1", { accessTokenExpiresAt: new Date(0) })]);
  const { api } = fakeApi({ ok: false, status: 400, code: "invalid_client" });
  await connection.getTikTokAccess("coA", { client, api });
  ok("invalid_client (a deploy setting) never disconnects a company", table[0].disconnectedAt === null);
}
{
  const { client, calls, table } = recordingClient([live("r1", { accessTokenExpiresAt: new Date(0) })]);
  const { api } = fakeApi({ ok: false, status: 400, code: "invalid_grant" });
  const a = await connection.getTikTokAccess("coA", { client, api });
  ok("invalid_grant: token_expired and the row is tombstoned (kept)", a.reason === "token_expired" && table[0].disconnectReason === "refresh_failed" && table.length === 1 && deletes(calls) === 0);
}
{
  const { client, table } = recordingClient([live("r1", { accessTokenExpiresAt: new Date(0), refreshTokenExpiresAt: new Date(Date.now() - 1000) })]);
  const { api, calls } = fakeApi({ ok: true, data: { access_token: "x" } });
  const a = await connection.getTikTokAccess("coA", { client, api });
  ok("refresh token past its 365 days: no TikTok call, token_expired, row kept", a.reason === "token_expired" && calls.length === 0 && table[0].disconnectReason === "refresh_failed");
}
{
  const { client } = recordingClient([live("r1", { accessTokenEnc: "garbage-not-a-blob" })]);
  const a = await connection.getTikTokAccess("coA", { client, api: fakeApi({ ok: true, data: {} }).api });
  ok("an unreadable stored token → unreadable_token, not a 500", a.connected === false && a.reason === "unreadable_token");
}
{
  const soon = new Date(Date.now() + 10 * 86400_000);
  const { client } = recordingClient([live("due", { refreshTokenExpiresAt: soon }), live("fine", { companyId: "coB" }), live("dead", { companyId: "coC", disconnectedAt: new Date(), refreshTokenExpiresAt: soon })]);
  const { api, calls } = fakeApi({ ok: true, data: { access_token: "n", expires_in: 86400, refresh_token: "nr", refresh_expires_in: 31536000 } });
  const s = await connection.refreshDueConnections({ client, api });
  ok("cron: only live rows inside the 30-day window are refreshed", s.checked === 1 && s.refreshed === 1 && calls.length === 1 && calls[0].refreshToken === "refresh_due");
}

for (const [k, val] of Object.entries(saved)) {
  if (val === undefined) delete process.env[k];
  else process.env[k] = val;
}

console.log(
  failures
    ? `\n✗ tiktok: ${failures} of ${checks} failed\n`
    : `\n✓ tiktok: ${checks} checks — the connection, the media URL, the composer's rules and every error sentence hold\n`,
);
process.exit(failures ? 1 : 0);
