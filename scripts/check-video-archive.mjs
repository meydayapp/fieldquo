// scripts/check-video-archive.mjs
//
// npm run check:video-archive
//
// Executes the video archive (lib/marketing/videoArchive.js and
// lib/marketing/videoArchiveServer.js) against hostile cases. The one rule it
// exists to hold: NOTHING is removed from Cloudinary without a verified copy
// in R2. Every failure case below asserts that destroy was never called.
//
//   1. Eligibility — partial destinations, open/failed/canceled rows, the
//      30-day clock, restores, hostile input
//   2. The R2 key — ids that would become paths
//   3. verifyCopy / canRemoveOriginal — every mismatch refuses
//   4. archiveOne with fakes — copy fails, short reads, size mismatch, bad
//      ETag, HEAD failures, destroy failures, a Post pressed mid-copy
//   5. Claims — already archived, two runs at once, stale claims
//   6. Not configured — the run touches nothing, not even a read
//   7. The real wire: aws4fetch + Node's fetch against a local S3-shaped
//      server — streaming, Content-Length enforcement, ETag verification
//   8. Restore — refusals, the claim, a Cloudinary failure leaves it archived
//   9. Wiring — cron, gates on every publish route, strings in every language
//  10. "Test the connection" (lib/media/r2ConnectionTest.js) — every R2
//      answer and hostile ones classified, no value ever echoed, and every
//      request it makes is a GET
//
// Runs with @/lib/db stubbed (db-stub-loader): nothing here can reach a
// database, and every store is an in-memory fake.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";

let checks = 0;
let failures = 0;
const ok = (name, pass, detail = "") => {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail && !pass ? `  — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(p, "utf8");
const md5 = (b) => createHash("md5").update(b).digest("hex");
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

const va = await import("../lib/marketing/videoArchive.js");
const vas = await import("../lib/marketing/videoArchiveServer.js");
const r2 = await import("../lib/media/r2.js");

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-15T12:00:00Z");
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const basePost = { id: "post1", companyId: "co1", videoPublicId: "fieldquo/co1/video/abc", uploadState: "ready", archivedAt: null, archiveRestoredAt: null, archiveClaimedAt: null };
const ig = (status, days, extra = {}) => ({ platform: "instagram", status, createdAt: ago(days + 0.01), publishedAt: status === "published" ? ago(days) : null, updatedAt: ago(days), ...extra });
const fb = (status, days, extra = {}) => ({ ...ig(status, days, extra), platform: "facebook" });
const tt = (status, days, extra = {}) => ({ status, createdAt: ago(days + 0.01), publishedAt: status === "published" ? ago(days) : null, updatedAt: ago(days), ...extra });
const elig = (post, socialPublishes = [], tiktokPublishes = []) => va.archiveEligibility({ post, socialPublishes, tiktokPublishes, now: NOW });

// ══ 1 ═══════════════════════════════════════════════════════════════════════
section("1. Eligibility");

ok("never posted → not eligible", elig(basePost).reason === "never_posted");
ok("only Instagram, published 31 days ago → eligible (all three are NOT required)", elig(basePost, [ig("published", 31)]).eligible);
ok("only Instagram, published 29 days ago → too_recent", elig(basePost, [ig("published", 29)]).reason === "too_recent");
ok("exactly 30 days → eligible (the boundary is inclusive)", elig(basePost, [ig("published", 30)]).eligible);
ok("eligibleAt is finishedAt + 30 days", elig(basePost, [ig("published", 10)]).eligibleAt?.getTime() === ago(10).getTime() + 30 * DAY);
ok("Instagram published, Facebook's last attempt FAILED → awaiting_retry", elig(basePost, [ig("published", 60), fb("failed", 59)]).reason === "awaiting_retry");
ok("Facebook rate_limited last → awaiting_retry", elig(basePost, [ig("published", 60), fb("rate_limited", 59)]).reason === "awaiting_retry");
ok("Facebook failed, then a later Facebook published → eligible", elig(basePost, [ig("published", 60), fb("failed", 58), fb("published", 50)]).eligible);
ok("Facebook published, then a later Facebook attempt failed → awaiting_retry (the retry needs the file)", elig(basePost, [fb("published", 60), fb("failed", 40)]).reason === "awaiting_retry");
for (const s of ["pending", "scheduled", "container_created", "publishing"]) {
  ok(`any SocialPublish ${s} → open_publish`, elig(basePost, [ig("published", 90), fb(s, 1)]).reason === "open_publish");
}
for (const s of ["pending", "processing"]) {
  ok(`TikTok ${s} (TikTok may still be pulling) → open_publish`, elig(basePost, [ig("published", 90)], [tt(s, 45)]).reason === "open_publish");
}
ok("TikTok inbox_delivered (TikTok already has the file) counts as finished", elig(basePost, [], [tt("inbox_delivered", 31)]).eligible);
ok("TikTok failed last → awaiting_retry", elig(basePost, [ig("published", 60)], [tt("failed", 50)]).reason === "awaiting_retry");
ok("an unknown status is treated as open, never as finished", elig(basePost, [ig("published", 60), fb("weird_new_status", 50)]).reason === "open_publish");
ok("a canceled row alone → never_posted", elig(basePost, [fb("canceled", 60)]).reason === "never_posted");
ok("a canceled row does not block a published one", elig(basePost, [ig("published", 40), fb("canceled", 5)]).eligible);
ok("the clock is the LAST destination to finish", elig(basePost, [ig("published", 60), fb("published", 20)]).reason === "too_recent");
ok("a published row with no time at all → no_finish_time (never assumed)", elig(basePost, [{ platform: "instagram", status: "published", createdAt: null, publishedAt: null, updatedAt: null }]).reason === "no_finish_time");
ok("already archived → already_archived", elig({ ...basePost, archivedAt: ago(1) }, [ig("published", 90)]).reason === "already_archived");
ok("mid-upload or mid-restore (processing) → not_ready", elig({ ...basePost, uploadState: "processing" }, [ig("published", 90)]).reason === "not_ready");
ok("failed upload → not_ready", elig({ ...basePost, uploadState: "failed" }, [ig("published", 90)]).reason === "not_ready");
ok("restored 10 days ago, published 90 days ago → too_recent (30 days from the restore)", elig({ ...basePost, archiveRestoredAt: ago(10) }, [ig("published", 90)]).reason === "too_recent");
ok("restored 31 days ago → eligible again", elig({ ...basePost, archiveRestoredAt: ago(31) }, [ig("published", 90)]).eligible);
for (const bad of [null, undefined, 42, "post"]) {
  ok(`post ${JSON.stringify(bad)} → not eligible`, va.archiveEligibility({ post: bad, socialPublishes: [ig("published", 90)], now: NOW }).eligible === false);
}
ok("publishes that are not arrays are ignored, not crashed on", elig(basePost, "nope", { length: 3 }).reason === "never_posted");
ok("a garbage `now` is never eligible", va.archiveEligibility({ post: basePost, socialPublishes: [ig("published", 90)], now: "not a date" }).eligible === false);

// ══ 2 ═══════════════════════════════════════════════════════════════════════
section("2. The R2 key");

ok("plain ids → video-posts/<company>/<post>.<format>", va.archiveKeyFor({ companyId: "co1", id: "post1", format: "MP4" }) === "video-posts/co1/post1.mp4");
for (const [label, args] of [
  ["../ in company", { companyId: "../x", id: "p", format: "mp4" }],
  ["slash in id", { companyId: "c", id: "a/b", format: "mp4" }],
  ["empty id", { companyId: "c", id: "", format: "mp4" }],
  ["format with ;", { companyId: "c", id: "p", format: "mp4;rm" }],
  ["format with /", { companyId: "c", id: "p", format: "../x" }],
  ["no format", { companyId: "c", id: "p", format: null }],
]) {
  ok(`${label} → null`, va.archiveKeyFor(args) === null);
}

// ══ 3 ═══════════════════════════════════════════════════════════════════════
section("3. verifyCopy / canRemoveOriginal");

const data = Buffer.from("x".repeat(5000) + "the clip");
const good = { sourceBytes: data.length, streamedBytes: data.length, headExists: true, headBytes: data.length, md5: md5(data), sha256: sha256(data), headEtag: `"${md5(data)}"`, sourceEtag: md5(data) };
ok("everything agrees → ok", va.verifyCopy(good).ok === true);
ok("no Cloudinary etag is fine (R2's is still required)", va.verifyCopy({ ...good, sourceEtag: null }).ok === true);
ok("weak ETag W/\"md5\" is read", va.verifyCopy({ ...good, headEtag: `W/"${md5(data)}"` }).ok === true);
const refusals = [
  ["no source size", { sourceBytes: 0 }, "no_source_size"],
  ["nothing streamed", { streamedBytes: 0 }, "nothing_streamed"],
  ["short read (streamed ≠ stored)", { streamedBytes: data.length - 1, headBytes: data.length - 1 }, "short_read"],
  ["R2 object missing", { headExists: false }, "copy_missing"],
  ["R2 size differs", { headBytes: data.length - 1 }, "size_mismatch"],
  ["R2 size null", { headBytes: null }, "size_mismatch"],
  ["no MD5 computed", { md5: null }, "no_checksum"],
  ["no SHA-256 computed", { sha256: "abc" }, "no_checksum"],
  ["no ETag", { headEtag: null }, "no_etag"],
  ["multipart ETag (not an MD5)", { headEtag: `"${md5(data)}-2"` }, "no_etag"],
  ["ETag of other bytes", { headEtag: `"${md5("other")}"` }, "checksum_mismatch"],
  ["Cloudinary's MD5 differs (we copied a CDN variant)", { sourceEtag: md5("variant") }, "source_checksum_mismatch"],
  ["size as a string", { headBytes: String(data.length) }, "size_mismatch"],
];
for (const [label, patch, code] of refusals) {
  const v = va.verifyCopy({ ...good, ...patch });
  ok(`${label} → ${code}`, v.ok === false && v.code === code, JSON.stringify(v));
}
ok("verifyCopy() with nothing → refuses", va.verifyCopy().ok === false);
const vOk = { ok: true };
ok("canRemoveOriginal: all three → true", va.canRemoveOriginal({ verification: vOk, copyRecorded: true, stillEligible: true }) === true);
ok("canRemoveOriginal: unverified → false", va.canRemoveOriginal({ verification: { ok: false }, copyRecorded: true, stillEligible: true }) === false);
ok("canRemoveOriginal: copy not recorded → false", va.canRemoveOriginal({ verification: vOk, copyRecorded: false, stillEligible: true }) === false);
ok("canRemoveOriginal: no longer eligible → false", va.canRemoveOriginal({ verification: vOk, copyRecorded: true, stillEligible: false }) === false);
ok("canRemoveOriginal: truthy-but-not-true values → false", va.canRemoveOriginal({ verification: { ok: 1 }, copyRecorded: 1, stillEligible: "yes" }) === false);
ok("canRemoveOriginal() → false", va.canRemoveOriginal({}) === false);

// ══ 4 ═══════════════════════════════════════════════════════════════════════
section("4. archiveOne against fakes — nothing removed unless verified");

/** An in-memory store with the same compare-and-set semantics as prismaArchiveStore. */
function fakeStore(post, { socialPublishes = [ig("published", 45)], tiktokPublishes = [], onSecondLoad = null } = {}) {
  const row = { ...basePost, archiveKey: null, archiveBytes: null, archiveSha256: null, archiveError: null, ...post };
  let loads = 0;
  const calls = [];
  const store = {
    row,
    calls,
    async candidates({ now }) {
      calls.push("candidates");
      row.archiveCheckedAt = now;
      return [{ post: { ...row }, socialPublishes, tiktokPublishes }];
    },
    async load(id) {
      loads++;
      calls.push("load");
      if (loads === 2 && onSecondLoad) onSecondLoad({ socialPublishes, tiktokPublishes, row });
      return id === row.id ? { post: { ...row }, socialPublishes: [...socialPublishes], tiktokPublishes: [...tiktokPublishes] } : null;
    },
    async claim(id, now) {
      calls.push("claim");
      const stale = row.archiveClaimedAt && now - row.archiveClaimedAt >= va.ARCHIVE_CLAIM_STALE_MS;
      if (id !== row.id || row.archivedAt || (row.archiveClaimedAt && !stale)) return false;
      row.archiveClaimedAt = now;
      return true;
    },
    async recordCopy(id, claimedAt, c) {
      calls.push("recordCopy");
      if (row.archiveClaimedAt?.getTime?.() !== claimedAt.getTime()) return false;
      Object.assign(row, { archiveKey: c.key, archiveBytes: c.bytes, archiveSha256: c.sha256 });
      return true;
    },
    async markArchived(id, claimedAt, now) {
      calls.push("markArchived");
      if (row.archiveClaimedAt?.getTime?.() !== claimedAt.getTime()) return;
      Object.assign(row, { archivedAt: now, archiveError: null, archiveClaimedAt: null });
    },
    async fail(id, claimedAt, message) {
      calls.push("fail");
      if (row.archiveClaimedAt?.getTime?.() !== claimedAt.getTime()) return;
      Object.assign(row, { archiveError: message, archiveClaimedAt: null });
    },
    async release(id, claimedAt) {
      calls.push("release");
      if (row.archiveClaimedAt?.getTime?.() === claimedAt.getTime()) row.archiveClaimedAt = null;
    },
  };
  return store;
}

function fakeSource({ bytes = data.length, etag = md5(data), missing = false, destroyResult = "ok", describeThrows = false } = {}) {
  const destroyed = [];
  return {
    destroyed,
    async describe() {
      if (describeThrows) throw new Error("Cloudinary Admin API 420");
      return missing ? { missing: true } : { missing: false, bytes, url: "https://res.cloudinary.com/demo/video/upload/v1/fieldquo/co1/video/abc.mp4", format: "mp4", etag };
    },
    async destroy(publicId) {
      destroyed.push(publicId);
      return destroyResult;
    },
    async restoreFromUrl() {
      throw new Error("not in this section");
    },
  };
}

/** R2 as a Map. `strict` refuses a body whose length is not the declared one, as undici does. */
function fakeR2({ strict = true, truncate = false, badEtag = false, putStatus = 200, headThrows = false, headMissing = false } = {}) {
  const objects = new Map();
  return {
    objects,
    async put(key, body, { bytes }) {
      const buf = Buffer.from(await new Response(body).arrayBuffer());
      if (strict && buf.length !== bytes) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_REQ_CONTENT_LENGTH_MISMATCH" } });
      if (putStatus !== 200) return { ok: false, status: putStatus, etag: null, error: `R2 PUT ${putStatus}` };
      const stored = truncate ? buf.subarray(0, buf.length - 1) : buf;
      objects.set(key, stored);
      return { ok: true, status: 200, etag: `"${md5(stored)}"` };
    },
    async head(key) {
      if (headThrows) throw new Error("R2 HEAD 503");
      const o = objects.get(key);
      if (!o || headMissing) return { exists: false, bytes: null, etag: null, status: 404 };
      return { exists: true, bytes: o.length, etag: badEtag ? `"${"0".repeat(32)}"` : `"${md5(o)}"`, status: 200 };
    },
    async presign(key) {
      return `https://acct.r2.cloudflarestorage.com/bucket/${key}?X-Amz-Signature=sig`;
    },
  };
}

function fetchServing(buf, { status = 200, contentLength = buf.length, throws = false } = {}) {
  return async () => {
    if (throws) throw new TypeError("fetch failed");
    const headers = new Headers();
    if (contentLength !== null) headers.set("content-length", String(contentLength));
    return new Response(status === 200 ? buf : "nope", { status, headers });
  };
}

async function run({ store = fakeStore(), source = fakeSource(), r2x = fakeR2(), fetchImpl = fetchServing(data) } = {}) {
  const result = await vas.archiveOne(store.row.id, { configured: true, store, source, r2: r2x, fetchImpl }, { now: NOW });
  return { result, store, source, r2x };
}

{
  const { result, store, source, r2x } = await run();
  ok("happy path → archived", result.outcome === "archived", JSON.stringify(result));
  ok("…destroy called exactly once, for this clip", source.destroyed.length === 1 && source.destroyed[0] === basePost.videoPublicId);
  const stored = r2x.objects.get("video-posts/co1/post1.mp4");
  ok("…R2 holds the exact bytes", Boolean(stored) && stored.equals(data));
  ok("…archiveKey, archiveBytes, archiveSha256 recorded (SHA-256 of the real bytes)", store.row.archiveKey === "video-posts/co1/post1.mp4" && store.row.archiveBytes === data.length && store.row.archiveSha256 === sha256(data));
  ok("…archivedAt set, error cleared, claim released", Boolean(store.row.archivedAt) && store.row.archiveError === null && store.row.archiveClaimedAt === null);
  ok("…the copy was recorded BEFORE the original was removed", store.calls.indexOf("recordCopy") < store.calls.indexOf("markArchived"));
}

const failCases = [
  ["download throws", { fetchImpl: fetchServing(data, { throws: true }) }, /copy_failed: download_failed/],
  ["download HTTP 500", { fetchImpl: fetchServing(data, { status: 500 }) }, /copy_failed: download_failed/],
  ["CDN Content-Length ≠ stored size", { fetchImpl: fetchServing(data, { contentLength: data.length + 10 }) }, /source_size_mismatch/],
  ["short read, runtime enforces Content-Length", { fetchImpl: fetchServing(data.subarray(0, 100), { contentLength: null }) }, /copy_failed: upload_failed: UND_ERR_REQ_CONTENT_LENGTH_MISMATCH/],
  ["short read, lenient store", { fetchImpl: fetchServing(data.subarray(0, 100), { contentLength: null }), r2x: fakeR2({ strict: false }) }, /verify_failed: short_read/],
  ["R2 PUT 500", { r2x: fakeR2({ putStatus: 500 }) }, /copy_failed: upload_failed/],
  ["R2 stored one byte short", { r2x: fakeR2({ truncate: true }) }, /verify_failed: size_mismatch/],
  ["R2 ETag is not our MD5", { r2x: fakeR2({ badEtag: true }) }, /verify_failed: checksum_mismatch/],
  ["R2 HEAD throws", { r2x: fakeR2({ headThrows: true }) }, /verify_failed: R2 HEAD 503/],
  ["R2 HEAD says missing", { r2x: fakeR2({ headMissing: true }) }, /verify_failed: copy_missing/],
  ["Cloudinary's MD5 is of other bytes", { source: fakeSource({ etag: md5("something else") }) }, /source_checksum_mismatch/],
  ["Cloudinary no longer has it (404)", { source: fakeSource({ missing: true }) }, /source_missing/],
  ["Cloudinary Admin API throws", { source: fakeSource({ describeThrows: true }) }, /unexpected: Cloudinary Admin API 420/],
  ["stored size > Postgres INTEGER", { source: fakeSource({ bytes: 3_000_000_000 }) }, /too_large_to_record/],
  ["stored size missing", { source: fakeSource({ bytes: NaN }) }, /no_source_size/],
];
for (const [label, opts, pattern] of failCases) {
  const { result, store, source } = await run(opts);
  ok(`${label} → failed, NOTHING removed, error kept, claim released`,
    result.outcome === "failed" && pattern.test(result.reason) && source.destroyed.length === 0 && pattern.test(store.row.archiveError || "") && store.row.archivedAt === null && store.row.archiveClaimedAt === null,
    `${JSON.stringify(result)} destroyed=${source.destroyed.length} err=${store.row.archiveError}`);
}

{
  const { result, store, source } = await run({ source: fakeSource({ destroyResult: "error" }) });
  ok("destroy answers 'error' → failed, not archived, copy kept on record", result.outcome === "failed" && /remove_failed: error/.test(result.reason) && store.row.archivedAt === null && store.row.archiveKey === "video-posts/co1/post1.mp4" && source.destroyed.length === 1);
}
{
  const { result, store } = await run({ source: fakeSource({ destroyResult: "not found" }) });
  ok("destroy answers 'not found' (already gone) with a verified copy → archived", result.outcome === "archived" && Boolean(store.row.archivedAt));
}
{
  // Someone presses Post while the copy is streaming: the second read shows an open row.
  const store = fakeStore({}, { onSecondLoad: ({ socialPublishes }) => socialPublishes.push(fb("pending", 0)) });
  const { result, source } = await run({ store });
  ok("a Post pressed mid-copy → kept: copy stays, original stays, nothing removed", result.outcome === "kept" && result.reason === "became_ineligible" && source.destroyed.length === 0 && store.row.archivedAt === null && store.row.archiveClaimedAt === null);
}
{
  const store = fakeStore({}, { socialPublishes: [ig("published", 10)] });
  const { result, source } = await run({ store });
  ok("not yet due at claim time → skipped, claim released, nothing fetched or removed", result.outcome === "skipped" && result.reason === "too_recent" && source.destroyed.length === 0 && store.row.archiveClaimedAt === null);
}

// ══ 5 ═══════════════════════════════════════════════════════════════════════
section("5. Claims");

{
  const store = fakeStore({ archivedAt: ago(3) });
  const { result, source } = await run({ store });
  ok("already archived → claim refused, nothing read or removed", result.outcome === "claimed_elsewhere" && source.destroyed.length === 0 && !store.calls.includes("load"));
}
{
  const store = fakeStore();
  const source = fakeSource();
  const r2x = fakeR2();
  const deps = { configured: true, store, source, r2: r2x, fetchImpl: fetchServing(data) };
  const [a, b] = await Promise.all([vas.archiveOne("post1", deps, { now: NOW }), vas.archiveOne("post1", deps, { now: NOW })]);
  const outcomes = [a.outcome, b.outcome].sort().join(",");
  ok("two runs at once on one clip → one archives, one is refused; destroy exactly once", outcomes === "archived,claimed_elsewhere" && source.destroyed.length === 1, outcomes);
}
{
  const store = fakeStore({ archiveClaimedAt: new Date(NOW.getTime() - 60 * 1000) });
  const { result } = await run({ store });
  ok("a live claim (1 minute old) is respected", result.outcome === "claimed_elsewhere");
}
{
  const store = fakeStore({ archiveClaimedAt: new Date(NOW.getTime() - 20 * 60 * 1000) });
  const { result } = await run({ store });
  ok("a stale claim (20 minutes, past maxDuration) is taken over", result.outcome === "archived");
}
ok("claimHeld: fresh claim held, stale claim not, none not", va.claimHeld({ archiveClaimedAt: NOW }, NOW) && !va.claimHeld({ archiveClaimedAt: ago(1) }, NOW) && !va.claimHeld({}, NOW));
const storeSrc = read("lib/marketing/videoArchiveServer.js");
ok("prisma store's claim is a compare-and-set on archivedAt null + free/stale claim", /updateMany\(\{\s*where: \{ id, archivedAt: null, OR: \[\{ archiveClaimedAt: null \}, \{ archiveClaimedAt: \{ lt: staleClaim \} \}\] \}/.test(storeSrc));
ok("prisma store's writes after the claim are conditional on holding it", (storeSrc.match(/archiveClaimedAt: claimedAt/g) || []).length >= 4);

// ══ 6 ═══════════════════════════════════════════════════════════════════════
section("6. Not configured = do nothing");

const fullEnv = { R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "fieldquo-video-archive" };
ok("all four set → configured", r2.r2Config(fullEnv).ok === true);
for (const name of r2.R2_ENV_VARS) {
  const env = { ...fullEnv, [name]: "" };
  const c = r2.r2Config(env);
  ok(`${name} empty → not configured, and named`, c.ok === false && c.missing.includes(name));
  const d = vas.archiveDeps(env);
  ok(`${name} empty → archiveDeps not configured (no store, no client)`, d.configured === false && !d.store && d.missing.includes(name));
}
ok("whitespace-only counts as missing", r2.r2Config({ ...fullEnv, R2_BUCKET: "   " }).ok === false);
ok("an account id that is not 32 hex (would become a hostname) is refused", r2.r2Config({ ...fullEnv, R2_ACCOUNT_ID: "evil.com/x" }).ok === false);
ok("a bucket name with a slash is refused", r2.r2Config({ ...fullEnv, R2_BUCKET: "a/../b" }).ok === false);
ok("nothing set → all four named", r2.r2Config({}).missing.length === 4);
{
  const touched = [];
  const trap = new Proxy({}, { get: (_, k) => () => { touched.push(String(k)); throw new Error(`touched ${String(k)}`); } });
  const r = await vas.runArchiveBatch({ configured: false, missing: ["R2_BUCKET"], store: trap, source: trap, r2: trap });
  ok("runArchiveBatch not configured → returns, touching no store, source or R2", r.configured === false && touched.length === 0 && r.missing[0] === "R2_BUCKET");
}
const cron = read("app/api/cron/video-archive/route.js");
ok("the cron checks configuration before anything else runs", cron.indexOf("if (!deps.configured)") > 0 && cron.indexOf("if (!deps.configured)") < cron.indexOf("runArchiveBatch(deps)"));
{
  const store = fakeStore();
  let clockNow = 0;
  const deps = { configured: true, store, source: fakeSource(), r2: fakeR2(), fetchImpl: fetchServing(data) };
  const r = await vas.runArchiveBatch(deps, { now: NOW, clock: () => (clockNow += 200_000) });
  ok("the time budget stops a run before starting a clip past it", r.results.length === 0 && r.due === 1);
  const r2run = await vas.runArchiveBatch({ ...deps, store: fakeStore() }, { now: NOW });
  ok("a configured run archives the due clip", r2run.results[0]?.outcome === "archived");
}

// ══ 7 ═══════════════════════════════════════════════════════════════════════
section("7. The real wire: aws4fetch + fetch against a local S3-shaped server");

{
  const bucket = new Map();
  const seen = [];
  const clip = Buffer.alloc(3 * 1024 * 1024 + 7, 7); // a few MB, odd length
  clip.write("real clip bytes", 100);
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization || "", sha: req.headers["x-amz-content-sha256"] || "", length: req.headers["content-length"] });
    if (req.url.startsWith("/src/")) {
      const body = req.url === "/src/short" ? clip.subarray(0, 1000) : clip;
      // /src/short sends 1000 bytes with no length — a CDN connection that dropped.
      if (req.url !== "/src/short") res.setHeader("content-length", String(body.length));
      res.end(body);
      return;
    }
    const key = req.url.split("?")[0];
    if (req.method === "PUT") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const buf = Buffer.concat(chunks);
        bucket.set(key, buf);
        res.setHeader("etag", `"${md5(buf)}"`);
        res.end();
      });
      req.on("error", () => {});
      return;
    }
    if (req.method === "HEAD") {
      const o = bucket.get(key);
      if (!o) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader("content-length", String(o.length));
      res.setHeader("etag", `"${md5(o)}"`);
      res.end();
      return;
    }
    res.statusCode = 400;
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { ok: true, accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret", bucket: "archive", endpoint: base };
  const realR2 = vas.r2Store(config);
  const source = {
    destroyed: [],
    async describe() {
      return { missing: false, bytes: clip.length, url: `${base}/src/clip`, format: "mp4", etag: md5(clip) };
    },
    async destroy(id) {
      this.destroyed.push(id);
      return "ok";
    },
  };
  const store = fakeStore();
  const result = await vas.archiveOne("post1", { configured: true, store, source, r2: realR2, fetchImpl: fetch }, { now: NOW });
  const put = seen.find((s) => s.method === "PUT");
  ok("streamed Cloudinary → R2 and archived", result.outcome === "archived", JSON.stringify(result));
  ok("the PUT was SigV4-signed (AWS4-HMAC-SHA256, region auto, service s3)", /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request/.test(put?.auth || ""));
  ok("…with UNSIGNED-PAYLOAD (a stream's hash is not known up front) and an exact Content-Length", put?.sha === "UNSIGNED-PAYLOAD" && put?.length === String(clip.length));
  ok("…to /<bucket>/<key>", put?.url === "/archive/video-posts/co1/post1.mp4");
  ok("the bucket holds the exact bytes; SHA-256 recorded matches them", bucket.get("/archive/video-posts/co1/post1.mp4")?.equals(clip) && store.row.archiveSha256 === sha256(clip));
  ok("destroy ran once, after the HEAD", source.destroyed.length === 1 && seen.findIndex((s) => s.method === "HEAD") > seen.findIndex((s) => s.method === "PUT"));

  // A source that ends early: the runtime itself refuses the PUT.
  const shortSource = { ...source, destroyed: [], async describe() { return { missing: false, bytes: clip.length, url: `${base}/src/short`, format: "mp4", etag: null }; } };
  const store2 = fakeStore({ id: "post2" });
  const r2res = await vas.archiveOne("post2", { configured: true, store: store2, source: shortSource, r2: realR2, fetchImpl: fetch }, { now: NOW });
  ok("a source that ends early → the PUT is refused by the runtime, nothing removed", r2res.outcome === "failed" && /copy_failed/.test(r2res.reason) && shortSource.destroyed.length === 0, JSON.stringify(r2res));
  ok("…and no partial object was accepted as a copy", store2.row.archiveKey === null);

  const head = await r2.headObject(config, "video-posts/none.mp4");
  ok("HEAD of a missing object → exists:false, not a throw", head.exists === false);

  const presigned = new URL(await r2.presignGetUrl({ ...config, endpoint: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com" }, "video-posts/co1/post1.mp4", { now: NOW }));
  ok("presigned GET: signed query, 6-hour expiry, the object path", presigned.searchParams.get("X-Amz-Expires") === "21600" && /^[a-f0-9]{64}$/.test(presigned.searchParams.get("X-Amz-Signature") || "") && presigned.pathname === "/archive/video-posts/co1/post1.mp4" && presigned.searchParams.get("X-Amz-Date") === "20261115T120000Z");
  server.close();
}

// ══ 8 ═══════════════════════════════════════════════════════════════════════
section("8. Restore");

function fakePrisma(row) {
  const updates = [];
  return {
    updates,
    videoPost: {
      async updateMany({ where, data: d }) {
        updates.push({ where, data: d });
        const matches = where.id === row.id
          && (where.archivedAt?.not === undefined || row.archivedAt !== null)
          && (where.uploadState === undefined || row.uploadState === where.uploadState);
        if (matches) Object.assign(row, d);
        return { count: matches ? 1 : 0 };
      },
    },
  };
}
const archivedRow = () => ({ ...basePost, archivedAt: ago(5), archiveKey: "video-posts/co1/post1.mp4", archiveBytes: data.length, uploadState: "ready" });
function restoreDeps({ headResult = { exists: true, bytes: data.length }, restoreThrows = false } = {}) {
  const calls = [];
  return {
    calls,
    configured: true,
    r2: {
      async head(key) {
        calls.push(["head", key]);
        return headResult;
      },
      async presign(key) {
        calls.push(["presign", key]);
        return `https://acct.r2.cloudflarestorage.com/b/${key}?X-Amz-Signature=s`;
      },
    },
    source: {
      async restoreFromUrl(url, publicId, opts) {
        calls.push(["restore", url, publicId, opts?.notificationUrl]);
        if (restoreThrows) throw new Error("Cloudinary 500");
        return { status: "pending" };
      },
    },
  };
}
{
  const row = { ...basePost };
  const r = await vas.restoreFromArchive(row, restoreDeps(), { prisma: fakePrisma(row), now: NOW });
  ok("not archived → 409 not_archived", r.ok === false && r.code === "not_archived");
}
{
  const row = archivedRow();
  const r = await vas.restoreFromArchive(row, { configured: false, missing: ["R2_BUCKET"] }, { prisma: fakePrisma(row), now: NOW });
  ok("archive not configured → 503 archive_unavailable, row untouched", r.code === "archive_unavailable" && row.uploadState === "ready");
}
{
  const row = archivedRow();
  const deps = restoreDeps({ headResult: { exists: false, bytes: null } });
  const p = fakePrisma(row);
  const r = await vas.restoreFromArchive(row, deps, { prisma: p, now: NOW });
  ok("R2 copy missing → 409 archive_copy_missing; never handed to Cloudinary; still archived", r.code === "archive_copy_missing" && !deps.calls.some((c) => c[0] === "restore") && row.uploadState === "ready" && Boolean(row.archivedAt));
}
{
  const row = archivedRow();
  const deps = restoreDeps({ headResult: { exists: true, bytes: data.length - 5 } });
  const r = await vas.restoreFromArchive(row, deps, { prisma: fakePrisma(row), now: NOW });
  ok("R2 copy's size changed → refused, never handed to Cloudinary", r.code === "archive_copy_missing" && !deps.calls.some((c) => c[0] === "restore"));
}
{
  const row = archivedRow();
  const deps = restoreDeps();
  const r = await vas.restoreFromArchive(row, deps, { prisma: fakePrisma(row), now: NOW, notificationUrl: "https://www.fieldquo.com/api/marketing/video-posts/cloudinary-notify" });
  const call = deps.calls.find((c) => c[0] === "restore");
  ok("happy restore → ok; post processing; restoredAt stamped; still archived until it arrives", r.ok === true && row.uploadState === "processing" && row.archiveRestoredAt === NOW && Boolean(row.archivedAt));
  ok("…Cloudinary is handed the presigned R2 URL, into the SAME public id, with the notify URL", call && /X-Amz-Signature/.test(call[1]) && call[2] === basePost.videoPublicId && /cloudinary-notify$/.test(call[3]));
}
{
  const row = { ...archivedRow(), uploadState: "processing" };
  const deps = restoreDeps();
  const r = await vas.restoreFromArchive(row, deps, { prisma: fakePrisma(row), now: NOW });
  ok("already restoring → 409, Cloudinary not asked twice", r.code === "already_restoring" && deps.calls.length === 0);
}
{
  const row = archivedRow();
  const p = fakePrisma(row);
  // A second request won the claim between our read and our update.
  p.videoPost.updateMany = async ({ where, data: d }) => ({ count: where.uploadState === "ready" && d.uploadState === "processing" ? 0 : 1 });
  const deps = restoreDeps();
  const r = await vas.restoreFromArchive(row, deps, { prisma: p, now: NOW });
  ok("lost the restore claim → 409 already_restoring, Cloudinary not asked", r.code === "already_restoring" && !deps.calls.some((c) => c[0] === "restore"));
}
{
  const row = archivedRow();
  const deps = restoreDeps({ restoreThrows: true });
  const r = await vas.restoreFromArchive(row, deps, { prisma: fakePrisma(row), now: NOW });
  ok("Cloudinary refuses → 503; post back to archived + ready, with the reason (the button works again)", r.code === "cloudinary_unavailable" && row.uploadState === "ready" && Boolean(row.archivedAt) && /restore_failed/.test(row.archiveError));
}
ok("arrivalFailurePatch: a failed RESTORE stays archived and ready", JSON.stringify(va.arrivalFailurePatch({ archivedAt: NOW }, "cloudinary_failed")) === JSON.stringify({ uploadState: "ready", archiveError: "restore_failed: cloudinary_failed" }));
ok("arrivalFailurePatch: a failed new upload fails as before", JSON.stringify(va.arrivalFailurePatch({ archivedAt: null }, "upload_never_arrived")) === JSON.stringify({ uploadState: "failed", uploadError: "upload_never_arrived" }));
ok("arrivalClockStart: a restore is timed from the restore, a new upload from creation", va.arrivalClockStart({ archivedAt: NOW, archiveRestoredAt: ago(1), createdAt: ago(200) }).getTime() === ago(1).getTime() && va.arrivalClockStart({ archivedAt: null, createdAt: ago(2) }).getTime() === ago(2).getTime());

// ══ 9 ═══════════════════════════════════════════════════════════════════════
section("9. Wiring");

const vercel = JSON.parse(read("vercel.json"));
ok("the cron is declared in vercel.json", vercel.crons.some((c) => c.path === "/api/cron/video-archive"));
ok("the cron is authenticated like every other (requireCronSecret)", /const denied = requireCronSecret\(request\);\s*if \(denied\) return denied;/.test(cron));
const vps = read("lib/marketing/videoPostServer.js");
ok("settleArrival clears archivedAt when a clip (a restore) arrives", /countedAt: now,[\s\S]{0,300}archivedAt: null/.test(vps));
ok("settleArrival and checkArrival route failures through arrivalFailurePatch", (vps.match(/arrivalFailurePatch\(post,/g) || []).length === 2);
ok("renditionState answers 'archived' without asking Cloudinary", /if \(post\.archivedAt\) return "archived";/.test(vps));
ok("cloudinary-notify: a failed restore stays archived", /arrivalFailurePatch\(post, "cloudinary_failed"\)/.test(read("app/api/marketing/video-posts/cloudinary-notify/route.js")));
for (const route of ["app/api/marketing/video-posts/[id]/publish/route.js", "app/api/marketing/video-posts/[id]/tiktok/route.js"]) {
  const src = read(route);
  ok(`${route.split("/").slice(-2, -1)[0]} refuses an archived clip and one being archived`, /if \(post\.archivedAt\) return refuse\(409, "archived"/.test(src) && /if \(claimHeld\(post\)\) return refuse\(409, "archiving"/.test(src));
}
ok("PATCH refuses anything but a rename while archived", /post\.archivedAt && Object\.keys\(body \|\| \{\}\)\.some\(\(k\) => k !== "name"\)/.test(read("app/api/marketing/video-posts/[id]/route.js")));
ok("approval refuses an archived clip", /if \(post\.archivedAt\)/.test(read("app/api/marketing/video-posts/[id]/approval/route.js")));
{
  // The shape every route answers with, executed: an archived post must not
  // hand the screen a single Cloudinary URL (the file and every derived
  // version of it are gone), and says whether a restore can run.
  const { shapeVideoPost } = await import("../lib/marketing/videoPostServer.js");
  const prev = { ...process.env };
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: "demo" });
  const row = {
    ...basePost, campaignId: "c1", name: "Deck", videoUrl: "https://res.cloudinary.com/demo/video/upload/v1/fieldquo/co1/video/abc.mp4",
    width: 1080, height: 1920, durationSec: 30, bytes: 1000, frameRate: 30, fit: "original", preparedAs: "vertical", coverMode: "frame", coverOffsetMs: 0,
    coverImageUrl: null, caption: "hi", approvedAt: null, archivedAt: ago(2), archiveBytes: 1000, archiveSha256: "a".repeat(64), archiveError: null, createdAt: ago(90), updatedAt: ago(2),
  };
  for (const k of r2.R2_ENV_VARS) delete process.env[k];
  const shaped = shapeVideoPost(row);
  ok("archived shape carries no Cloudinary URL at all", !JSON.stringify(shaped).includes("res.cloudinary.com"), JSON.stringify(shaped).slice(0, 200));
  ok("…and says it is archived, not restorable while R2 is unset", shaped.archive?.archivedAt && shaped.archive.restorable === false && shaped.archive.bytes === 1000);
  Object.assign(process.env, fullEnv);
  ok("…restorable once all four R2 variables are set", shapeVideoPost(row).archive.restorable === true);
  ok("…mid-restore (processing) says restoring", shapeVideoPost({ ...row, uploadState: "processing" }).archive.restoring === true);
  ok("a live post's shape is unchanged: archive null, URLs present", shapeVideoPost({ ...row, archivedAt: null }).archive === null && JSON.stringify(shapeVideoPost({ ...row, archivedAt: null })).includes("res.cloudinary.com"));
  for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
  Object.assign(process.env, prev);
}

const restoreRoute = read("app/api/marketing/video-posts/[id]/restore/route.js");
ok("restore checks the month's allowance before anything is fetched", restoreRoute.indexOf("allowance.decision.ok") > 0 && restoreRoute.indexOf("allowance.decision.ok") < restoreRoute.indexOf("restoreFromArchive("));
ok("restore gates on user:manage", /requirePermission\(member\.role, "user:manage"\)/.test(restoreRoute));
const page = read("app/app/marketing/designer/video/[id]/page.js");
ok("the Restore button renders only when restoring can run (archive.restorable)", /post\.archive\.restorable \? \(/.test(page) && /data-video-restore/.test(page));
ok("the archived view says what a restore costs before it is pressed", page.indexOf("app.videoPost.archive.restoreNote") > 0 && page.indexOf("app.videoPost.archive.restoreNote") < page.indexOf("data-video-restore"));

const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
const newKeys = Object.keys(APP_MESSAGES.en).filter((k) => /^app\.videoPost\.(archive\.|listArchived|listRestoring|tiktok$|status\.(processing|inbox_delivered)|error\.(archived|archiving|not_archived|already_restoring|archive_unavailable|archive_copy_missing))/.test(k));
ok("19 archive strings in English", newKeys.length === 19, String(newKeys.length));
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = newKeys.filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k]);
  ok(`${lang}: every archive string present`, missing.length === 0, missing.join(", "));
}
const pageCodes = page.match(/"(archived|archiving|not_archived|already_restoring|archive_unavailable|archive_copy_missing)"/g) || [];
ok("every restore/archive refusal code has a sentence on the video screen", ["archived", "archiving", "not_archived", "already_restoring", "archive_unavailable", "archive_copy_missing"].every((c) => pageCodes.includes(`"${c}"`) && APP_MESSAGES.en[`app.videoPost.error.${c}`]));

const vercelDoc = read("docs/VERCEL.md");
ok("docs/VERCEL.md names all four R2 variables", r2.R2_ENV_VARS.every((v) => vercelDoc.includes(v)));
const pkg = JSON.parse(read("package.json"));
ok("aws4fetch is a dependency (not the AWS SDK)", Boolean(pkg.dependencies.aws4fetch) && !Object.keys(pkg.dependencies).some((d) => d.startsWith("@aws-sdk/")));
for (const lang of ["en", "fr", "es"]) {
  ok(`help article archived-videos exists in ${lang}`, read(`content/help/${lang}/marketing-and-website-2.js`).includes('"archived-videos"'));
}
ok("the help tree lists the article", /A\("archived-videos"/.test(read("lib/help/tree.js")));
ok("/platform/costs prints the archive line, 'not configured' with the names", /data-video-archive-status/.test(read("app/platform/costs/page.js")) && /videoArchiveStatus\(\)/.test(read("app/api/platform/costs/route.js")));

// ══ 10 ══════════════════════════════════════════════════════════════════════
section("10. Test the connection — classification, no echo, GET only");
{
  const ct = await import("../lib/media/r2ConnectionTest.js");
  const { canPlatform, SUPERADMIN_ONLY_PERMISSIONS } = await import("../lib/platform/permissions.js");
  const xmlErr = (code, message = "x") => `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;
  const listing = (n) => `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>fieldquo-video-archive</Name><KeyCount>${n}</KeyCount><MaxKeys>1</MaxKeys>${n ? "<Contents><Key>video-posts/co1/p.mp4</Key></Contents>" : ""}</ListBucketResult>`;
  const c = (o) => ct.classifyR2Probe(o);

  // The answers R2 gives.
  ok("200 + ListBucketResult, KeyCount 0 → connected, empty", c({ status: 200, body: listing(0) }).result === "connected" && c({ status: 200, body: listing(0) }).objects === "none");
  ok("200 + ListBucketResult, KeyCount 1 → connected, has objects", c({ status: 200, body: listing(1) }).objects === "some");
  ok("200 + ListBucketResult with no KeyCount → connected, objects unknown (null, not 'none')", c({ status: 200, body: "<ListBucketResult></ListBucketResult>" }).objects === null);
  ok("403 InvalidAccessKeyId → keys_rejected, R2_ACCESS_KEY_ID", (({ result, likely }) => result === "keys_rejected" && likely === "R2_ACCESS_KEY_ID")(c({ status: 403, body: xmlErr("InvalidAccessKeyId") })));
  ok("403 SignatureDoesNotMatch → keys_rejected, R2_SECRET_ACCESS_KEY", (({ result, likely }) => result === "keys_rejected" && likely === "R2_SECRET_ACCESS_KEY")(c({ status: 403, body: xmlErr("SignatureDoesNotMatch") })));
  ok("401 Unauthorized → keys_rejected, which value not claimed", (({ result, likely }) => result === "keys_rejected" && likely === null)(c({ status: 401, body: xmlErr("Unauthorized") })));
  ok("400 InvalidArgument 'Credential access key has length 20' → keys_rejected, R2_ACCESS_KEY_ID", c({ status: 400, body: xmlErr("InvalidArgument", "Credential access key has length 20, should be 32") }).likely === "R2_ACCESS_KEY_ID");
  ok("400 InvalidArgument about anything else → unexpected", c({ status: 400, body: xmlErr("InvalidArgument", "max-keys must be positive") }).result === "unexpected");
  ok("403 AccessDenied → access_denied (keys fine, token not on this bucket)", c({ status: 403, body: xmlErr("AccessDenied") }).result === "access_denied");
  ok("404 NoSuchBucket → bucket_not_found, R2_BUCKET", (({ result, likely }) => result === "bucket_not_found" && likely === "R2_BUCKET")(c({ status: 404, body: xmlErr("NoSuchBucket") })));

  // Hostile and unrecognised answers: never "connected", never a guessed cause.
  const hostile = [
    ["403 with an empty body", { status: 403, body: "" }],
    ["404 with an empty body (no code — not assumed to be the bucket)", { status: 404, body: "" }],
    ["403 Cloudflare HTML error page", { status: 403, body: "<!DOCTYPE html><html><head><title>Attention Required!</title></head><body><Code>InvalidAccessKeyId</Code></body></html>" }],
    ["200 HTML (a captive portal)", { status: 200, body: "<html><body>Welcome to the hotel wifi</body></html>" }],
    ["200 with an empty body", { status: 200, body: "" }],
    ["500 InternalError", { status: 500, body: xmlErr("InternalError") }],
    ["an unknown code", { status: 403, body: xmlErr("SomethingNew") }],
    ["a code that is markup", { status: 403, body: "<Error><Code><img src=x onerror=alert(1)></Code></Error>" }],
    ["a 70-character code", { status: 403, body: xmlErr("A".repeat(70)) }],
    ["body null", { status: 403, body: null }],
    ["body a number", { status: 403, body: 42 }],
    ["status missing", { body: "" }],
    ["status a string", { status: "200", body: listing(0) }],
    ["301 redirect (not followed)", { status: 301, body: "" }],
    ["nothing at all", undefined],
  ];
  for (const [name, input] of hostile) {
    const r = c(input);
    ok(`${name} → unexpected, likely null`, r.result === "unexpected" && r.likely === null, JSON.stringify(r));
  }
  ok("a code that is markup is not carried (code null)", c({ status: 403, body: "<Error><Code><b>x</b></Code></Error>" }).code === null);
  ok("an over-long code is not carried", c({ status: 403, body: xmlErr("A".repeat(70)) }).code === null);
  ok("the HTML page's <Code> is ignored (not an <Error> document)", c(hostile[2][1]).code === null);

  // Network failures, in the shapes undici actually throws.
  const fetchFailed = (code) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`getaddrinfo ${code}`), { code }) });
  ok("ENOTFOUND → account_not_found, R2_ACCOUNT_ID", (({ result, likely }) => result === "account_not_found" && likely === "R2_ACCOUNT_ID")(c({ error: fetchFailed("ENOTFOUND") })));
  ok("EAI_AGAIN → account_not_found (and the sentence says try again)", c({ error: fetchFailed("EAI_AGAIN") }).result === "account_not_found" && /try again/.test(ct.describeR2Test(c({ error: fetchFailed("EAI_AGAIN") }))));
  ok("ECONNRESET → unreachable", c({ error: fetchFailed("ECONNRESET") }).result === "unreachable");
  ok("TimeoutError → timeout", c({ error: new DOMException("timed out", "TimeoutError") }).result === "timeout");
  ok("a thrown string → unreachable, no code", (({ result, code }) => result === "unreachable" && code === null)(c({ error: "boom" })));
  ok("a hostile network code is not carried", c({ error: fetchFailed("rm -rf /; <script>") }).code === null);

  // Every result has its own sentence, and only "connected" says connected.
  for (const result of ct.R2_TEST_RESULTS) {
    const msg = ct.describeR2Test({ result, likely: null, code: null, status: null, missing: ["R2_BUCKET"], malformed: [] });
    ok(`"${result}" has a sentence`, typeof msg === "string" && msg.length > 20);
    if (result !== "connected") ok(`"${result}" never says Connected`, !/^Connected/.test(msg));
  }

  // The real wire: the probe against a local S3-shaped server, every method recorded.
  const methods = [];
  let reply = { status: 200, body: listing(0) };
  const server = http.createServer((req, res) => {
    methods.push({ method: req.method, url: req.url, auth: req.headers.authorization || "" });
    if (reply.hang) return; // never answers — the timeout case
    res.statusCode = reply.status;
    res.end(reply.body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { ok: true, accessKeyId: "AKIDPROBE", secretAccessKey: "probe-secret", bucket: "archive", endpoint: base };
  const scenarios = [
    [{ status: 200, body: listing(0) }, "connected"],
    [{ status: 200, body: listing(1) }, "connected"],
    [{ status: 403, body: xmlErr("InvalidAccessKeyId") }, "keys_rejected"],
    [{ status: 403, body: xmlErr("SignatureDoesNotMatch") + "<AWSAccessKeyId>AKIDPROBE</AWSAccessKeyId>" }, "keys_rejected"],
    [{ status: 403, body: xmlErr("AccessDenied") }, "access_denied"],
    [{ status: 404, body: xmlErr("NoSuchBucket") }, "bucket_not_found"],
    [{ status: 403, body: "<html>nope</html>" }, "unexpected"],
    [{ status: 500, body: "" }, "unexpected"],
  ];
  for (const [answer, expected] of scenarios) {
    reply = answer;
    const got = c(await r2.listObjectsProbe(config));
    ok(`wire: HTTP ${answer.status} ${ct.s3ErrorCode(answer.body) || "(no code)"} → ${expected}`, got.result === expected, JSON.stringify(got));
  }
  reply = { hang: true };
  {
    let got;
    try {
      got = c(await r2.listObjectsProbe(config, { timeoutMs: 200 }));
    } catch (error) {
      got = c({ error });
    }
    ok("wire: a server that never answers → timeout", got.result === "timeout", JSON.stringify(got));
  }
  ok("wire: every request the probe made was a GET", methods.length === scenarios.length + 1 && methods.every((m) => m.method === "GET"), JSON.stringify(methods.map((m) => m.method)));
  ok("wire: …for ONE key of the bucket: /archive?list-type=2&max-keys=1", methods.every((m) => m.url === "/archive?list-type=2&max-keys=1"), methods[0]?.url);
  ok("wire: …SigV4-signed, region auto, service s3", methods.every((m) => /^AWS4-HMAC-SHA256 Credential=AKIDPROBE\/\d{8}\/auto\/s3\/aws4_request/.test(m.auth)));
  server.closeAllConnections?.();
  server.close();

  // A host that cannot resolve (.invalid never does): the error undici really throws.
  {
    let got;
    try {
      got = c(await r2.listObjectsProbe({ ...config, endpoint: "http://0123456789abcdef0123456789abcdef.r2.invalid" }, { timeoutMs: 10_000 }));
    } catch (error) {
      got = c({ error });
    }
    ok("wire: an unresolvable account host → account_not_found (real DNS failure shape)", got.result === "account_not_found", JSON.stringify(got));
  }

  // testR2Connection end to end with a spying fetch: the method of every call,
  // and no value of any variable anywhere in what the route would send.
  const secretEnv = { R2_ACCOUNT_ID: "fedcba9876543210fedcba9876543210", R2_ACCESS_KEY_ID: "ACCESSKEYIDVALUE0123456789abcdef", R2_SECRET_ACCESS_KEY: "SECRETVALUE-do-not-print-9f8e7d", R2_BUCKET: "fieldquo-video-archive" };
  const spyCalls = [];
  const spyFetch = (body, status) => async (url, init) => {
    spyCalls.push({ url: String(url), method: init?.method });
    return new Response(body, { status });
  };
  const leaky = xmlErr("SignatureDoesNotMatch", `The request signature we calculated does not match. AWSAccessKeyId ${secretEnv.R2_ACCESS_KEY_ID} secret ${secretEnv.R2_SECRET_ACCESS_KEY}`) + `<AWSAccessKeyId>${secretEnv.R2_ACCESS_KEY_ID}</AWSAccessKeyId><StringToSign>${secretEnv.R2_ACCOUNT_ID}</StringToSign>`;
  const runs = [
    [listing(0), 200],
    [leaky, 403],
    [xmlErr("InvalidAccessKeyId", secretEnv.R2_ACCESS_KEY_ID), 403],
    [xmlErr("NoSuchBucket", secretEnv.R2_BUCKET), 404],
    [`<html>${secretEnv.R2_SECRET_ACCESS_KEY}</html>`, 502],
  ];
  for (const [body, status] of runs) {
    const out = await ct.testR2Connection({ env: secretEnv, fetchImpl: spyFetch(body, status) });
    const json = JSON.stringify(out);
    const leaked = Object.entries(secretEnv).filter(([, v]) => json.includes(v)).map(([k]) => k);
    ok(`end to end HTTP ${status} ${out.result}: no variable's value in the answer`, leaked.length === 0, leaked.join(", "));
    ok(`…message present, ok ${out.ok}`, typeof out.message === "string" && out.ok === (out.result === "connected") && typeof out.checkedAt === "string");
  }
  {
    const out = await ct.testR2Connection({ env: secretEnv, fetchImpl: async () => { throw fetchFailed("ENOTFOUND"); } });
    ok("end to end: fetch throws ENOTFOUND → account_not_found, no value echoed", out.result === "account_not_found" && !Object.values(secretEnv).some((v) => JSON.stringify(out).includes(v)));
  }
  ok("end to end: every call testR2Connection made was a GET to the bucket listing", spyCalls.length === runs.length && spyCalls.every((x) => x.method === "GET" && x.url === `https://${secretEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${secretEnv.R2_BUCKET}?list-type=2&max-keys=1`), JSON.stringify(spyCalls.map((x) => x.method)));

  // Not configured: names only, and nothing is sent.
  spyCalls.length = 0;
  const partial = await ct.testR2Connection({ env: { R2_ACCOUNT_ID: "not-hex", R2_ACCESS_KEY_ID: "  ", R2_BUCKET: "fieldquo-video-archive" }, fetchImpl: spyFetch(listing(0), 200) });
  ok("not configured → no request at all", spyCalls.length === 0 && partial.result === "not_configured" && partial.ok === false);
  ok("…blank and absent are 'missing'; set-but-wrong-shape is 'malformed'", JSON.stringify(partial.missing) === JSON.stringify(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) && JSON.stringify(partial.malformed) === JSON.stringify(["R2_ACCOUNT_ID"]), JSON.stringify(partial));
  ok("…the sentence names the variables, not the malformed value", /R2_ACCOUNT_ID/.test(partial.message) && !partial.message.includes("not-hex"));
  {
    const both = await ct.testR2Connection({ env: { ...secretEnv, R2_ACCOUNT_ID: "my-account", R2_BUCKET: "Video_Archive" }, fetchImpl: spyFetch(listing(0), 200) });
    ok("all four set, account id AND bucket in the wrong shape → both named malformed (r2Config stops at the first), nothing sent", spyCalls.length === 0 && both.missing.length === 0 && JSON.stringify(both.malformed) === JSON.stringify(["R2_ACCOUNT_ID", "R2_BUCKET"]), JSON.stringify(both));
    ok("…and no value in the answer", !["my-account", "Video_Archive", secretEnv.R2_ACCESS_KEY_ID, secretEnv.R2_SECRET_ACCESS_KEY].some((v) => JSON.stringify(both).includes(v)));
  }
  ok("nothing set → all four missing", (await ct.testR2Connection({ env: {}, fetchImpl: spyFetch("", 200) })).missing.length === 4 && spyCalls.length === 0);

  // Read-only by construction — the source, not just the behaviour.
  const ctSrc = read("lib/media/r2ConnectionTest.js").replace(/^\s*\/\/.*$/gm, "");
  ok("r2ConnectionTest imports nothing that writes (no putObjectStream, no r2Store)", !/putObjectStream|r2Store|videoArchiveServer/.test(ctSrc));
  ok("r2ConnectionTest names no write method", !/["'](PUT|POST|DELETE|PATCH)["']/.test(ctSrc));
  const r2Src = read("lib/media/r2.js");
  const probeSrc = r2Src.slice(r2Src.indexOf("export async function listObjectsProbe"), r2Src.indexOf("export async function presignGetUrl"));
  ok("listObjectsProbe hard-codes GET (signed and sent) and nothing else", (probeSrc.match(/method: "GET"/g) || []).length === 2 && !/method: "(PUT|POST|DELETE|PATCH|HEAD)"/.test(probeSrc) && !/method[,:]\s*[a-z]/i.test(probeSrc.replace(/method: "GET"/g, "")));
  ok("listObjectsProbe does not follow redirects", /redirect: "manual"/.test(probeSrc));

  // The route: the gate is on the server.
  const route = read("app/api/platform/costs/r2-test/route.js");
  ok("route exports POST only", /export async function POST/.test(route) && !/export async function (GET|PUT|PATCH|DELETE)/.test(route));
  ok("route: platform admin, then requirePlatformPermission(…, \"storage:test\"), then the support-session refusal, then the test", (() => {
    const a = route.indexOf("getCurrentPlatformAdmin(request)"), b = route.indexOf('requirePlatformPermission(admin.role, "storage:test")'), i = route.indexOf("verifyImpersonationToken(request.cookies.get(IMPERSONATION_COOKIE)"), t = route.indexOf("await testR2Connection()");
    return a > 0 && a < b && b < i && i < t;
  })());
  ok("route never returns an error's own message", !/err(or)?\??\.message/.test(route.replace(/^\s*\/\/.*$/gm, "")));
  ok("storage:test is superadmin-only, declared", SUPERADMIN_ONLY_PERMISSIONS.includes("storage:test") && canPlatform("superadmin", "storage:test") && !canPlatform("admin", "storage:test") && !canPlatform("support", "storage:test"));
  ok("/platform/team describes storage:test in words", /"storage:test":/.test(read("app/platform/team/page.js")));

  // The button: fetchJson, a catch that says the test did not run, the result inline.
  const costsPage = read("app/platform/costs/page.js");
  ok("the button posts to the route through fetchJson", /fetchJson\("\/api\/platform\/costs\/r2-test", \{ method: "POST" \}\)/.test(costsPage) && /data-r2-test\b/.test(costsPage));
  ok("…a failed request is shown, not swallowed (catch → requestFailed)", /catch \(err\) \{\s*setR2Test\(\{ ok: false, requestFailed: true/.test(costsPage));
  ok("…the result renders inline", /data-r2-test-result=/.test(costsPage) && /\{r2Test\.message\}/.test(costsPage));
  ok("docs/VERCEL.md's R2 row mentions the button", /Test the connection/.test(vercelDoc));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
