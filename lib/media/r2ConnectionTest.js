// lib/media/r2ConnectionTest.js
//
// "Test the connection" on /platform/costs — proof that the four R2_*
// variables actually open the video-archive bucket, today, instead of on the
// day the first video post turns 30 days old.
//
// ══ Why this exists ══════════════════════════════════════════════════════
//
// r2Config() only knows the four values are PRESENT. The values are Sensitive
// in Vercel, so nobody can read them back or try them locally, and the first
// real request the archive makes is a PUT about a month after the first video
// post — a mistyped secret would sit unnoticed until then and surface as a
// cron error. One signed read now says which value is wrong while the person
// who pasted it still remembers doing so.
//
// ══ Read-only, by construction ═══════════════════════════════════════════
//
// The only request is listObjectsProbe() in lib/media/r2.js: a GET for at
// most one key, its method hard-coded there. Nothing in this file can PUT,
// DELETE or POST, and scripts/check-video-archive.mjs asserts the method of
// every request it sees. The archive's own write path (putObjectStream) is not
// imported here.
//
// ══ It never repeats a value ═════════════════════════════════════════════
//
// The answer names VARIABLES, never their contents. R2's own error message is
// not passed through either: S3-shaped error documents can carry the access
// key id (AWS's SignatureDoesNotMatch includes <AWSAccessKeyId> and the
// string it signed). Only the error CODE travels, and only when it looks like
// one — a short run of letters — so an HTML page or a hostile body can never
// smuggle text onto the screen through it.
//
// ══ Classified from what R2 says, never guessed ══════════════════════════
//
// A 403 with no S3 error code (a proxy's HTML page) is "unexpected", not
// "keys rejected": the test reports what it learned and nothing more. And
// where one answer has two possible causes, the sentence says both — R2
// refuses an access key from another Cloudflare account exactly as it refuses
// a mistyped one, so "R2_ACCESS_KEY_ID is probably wrong" is followed by
// "if it is right, check R2_ACCOUNT_ID".

import { r2Config, listObjectsProbe, R2_ENV_VARS, R2_VALUE_SHAPES } from "@/lib/media/r2";
import { ARCHIVE_AFTER_DAYS } from "@/lib/marketing/videoArchive";

export const R2_TEST_RESULTS = Object.freeze([
  "connected",
  "not_configured",
  "keys_rejected",
  "access_denied",
  "bucket_not_found",
  "account_not_found",
  "timeout",
  "unreachable",
  "unexpected",
]);

/**
 * Which variables are absent and which are set but fail r2Config()'s shape
 * rule (R2_VALUE_SHAPES — an account id that is not 32 hex characters, a
 * bucket name that is not one). r2Config() reports both as "missing", and
 * stops at the first; the test names every one and says the difference,
 * because "it is set — I pasted it" is the first answer anyone gives to
 * "missing". Read with r2Config()'s own trimming, so the two cannot disagree
 * about what "set" means.
 */
export function r2ConfigProblems(env = process.env) {
  const config = r2Config(env);
  if (config.ok) return { ok: true, config, missing: [], malformed: [] };
  const read = (name) => (typeof env?.[name] === "string" ? env[name].trim() : "");
  const missing = R2_ENV_VARS.filter((name) => !read(name));
  const malformed = R2_ENV_VARS.filter((name) => read(name) && R2_VALUE_SHAPES[name] && !R2_VALUE_SHAPES[name].test(read(name)));
  // Belt and braces: if r2Config() refused for a reason neither list explains
  // (a rule added there and not here), its own names are reported rather than
  // an empty "not configured — ".
  return { ok: false, config: null, missing: missing.length || malformed.length ? missing : config.missing, malformed };
}

/** The S3 error code in an error document, or null. Never the message. */
export function s3ErrorCode(body) {
  if (typeof body !== "string" || !/<Error[\s>]/.test(body)) return null;
  const m = body.match(/<Code>\s*([A-Za-z][A-Za-z0-9.]{0,63})\s*<\/Code>/);
  return m ? m[1] : null;
}

/** Read only to TELL two InvalidArgument causes apart; never returned. */
function s3ErrorMessage(body) {
  if (typeof body !== "string") return "";
  const m = body.match(/<Message>([\s\S]{0,500}?)<\/Message>/);
  return m ? m[1] : "";
}

const NETWORK_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;
// The host is <R2_ACCOUNT_ID>.r2.cloudflarestorage.com, so a name that does
// not resolve points at the account id. EAI_AGAIN is a resolver that did not
// answer in time — still the host, so it is reported the same way, and the
// sentence says to try again before believing it.
const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_NONAME", "EAI_NODATA"]);

function networkCode(error) {
  const candidates = [error?.cause?.code, error?.code, error?.cause?.cause?.code];
  return candidates.find((c) => typeof c === "string" && NETWORK_CODE.test(c)) || null;
}

function isTimeout(error) {
  const names = [error?.name, error?.cause?.name];
  return names.includes("TimeoutError") || names.includes("AbortError") || networkCode(error) === "UND_ERR_CONNECT_TIMEOUT";
}

/**
 * Map one probe outcome to a result. Pure: takes what the wire produced
 * (`{ status, body }`) or what fetch threw (`{ error }`), returns the shape
 * the route sends. Every branch that is not a recognised answer falls to
 * "unexpected" — never to "connected".
 */
export function classifyR2Probe({ status, body, error } = {}) {
  if (error !== undefined && error !== null) {
    if (isTimeout(error)) return { result: "timeout", likely: null, code: null, status: null };
    const code = networkCode(error);
    if (code && DNS_CODES.has(code)) return { result: "account_not_found", likely: "R2_ACCOUNT_ID", code, status: null };
    return { result: "unreachable", likely: null, code, status: null };
  }
  const httpStatus = Number.isInteger(status) ? status : null;
  const code = s3ErrorCode(body);

  if (httpStatus === 200) {
    // A 200 is only "connected" if it IS a bucket listing. A captive portal or
    // a misrouted request can answer 200 with HTML.
    if (typeof body === "string" && /<ListBucketResult[\s>]/.test(body)) {
      const keyCount = body.match(/<KeyCount>\s*(\d{1,9})\s*<\/KeyCount>/);
      const hasContents = /<Contents[\s>]/.test(body);
      const objects = keyCount ? (Number(keyCount[1]) > 0 ? "some" : "none") : hasContents ? "some" : null;
      return { result: "connected", likely: null, code: null, status: 200, objects };
    }
    return { result: "unexpected", likely: null, code, status: 200 };
  }

  switch (code) {
    case "InvalidAccessKeyId":
      return { result: "keys_rejected", likely: "R2_ACCESS_KEY_ID", code, status: httpStatus };
    case "SignatureDoesNotMatch":
      return { result: "keys_rejected", likely: "R2_SECRET_ACCESS_KEY", code, status: httpStatus };
    case "Unauthorized":
      // R2's 401: the credentials are not valid, without saying which half.
      return { result: "keys_rejected", likely: null, code, status: httpStatus };
    case "InvalidArgument":
      // R2 answers a malformed access key id ("Credential access key has
      // length 20, should be 32") with InvalidArgument. Nothing else in this
      // fixed request can be an invalid argument, but only the credential
      // case is named; anything else stays unexpected.
      return /access key/i.test(s3ErrorMessage(body))
        ? { result: "keys_rejected", likely: "R2_ACCESS_KEY_ID", code, status: httpStatus }
        : { result: "unexpected", likely: null, code, status: httpStatus };
    case "AccessDenied":
      return { result: "access_denied", likely: "R2_BUCKET", code, status: httpStatus };
    case "NoSuchBucket":
    case "InvalidBucketName":
      return { result: "bucket_not_found", likely: "R2_BUCKET", code, status: httpStatus };
    default:
      return { result: "unexpected", likely: null, code, status: httpStatus };
  }
}

/**
 * The sentence the owner reads. English, like the rest of /platform/costs.
 * Built only from the result, the variable names and the code — no value.
 */
export function describeR2Test(r) {
  const codeNote = r.code ? ` (${r.code})` : "";
  switch (r.result) {
    case "connected":
      return (
        "Connected — R2 accepted the keys and the bucket answered a read. " +
        (r.objects === "none"
          ? `It is empty so far, as expected: the first copy is made ${ARCHIVE_AFTER_DAYS} days after a video post finishes posting.`
          : r.objects === "some"
            ? "It already holds at least one file."
            : "")
      ).trim();
    case "not_configured": {
      const parts = [];
      if (r.missing?.length) parts.push(`missing: ${r.missing.join(", ")}`);
      if (r.malformed?.length) {
        parts.push(
          `set but not in the expected shape: ${r.malformed.join(", ")} (an account id is 32 hex characters; a bucket name is 3–63 lowercase letters, digits and hyphens)`,
        );
      }
      return `Not configured — ${parts.join("; ") || "the R2 variables are not set"}. Nothing was sent to R2.`;
    }
    case "keys_rejected":
      if (r.likely === "R2_SECRET_ACCESS_KEY") {
        return `R2 knows the access key but the signature did not match${codeNote}. R2_SECRET_ACCESS_KEY is probably wrong — re-paste the token's Secret Access Key (a stray space or a truncated copy does this).`;
      }
      if (r.likely === "R2_ACCESS_KEY_ID") {
        return `R2 rejected the access key${codeNote}. R2_ACCESS_KEY_ID is probably wrong — it is the token's Access Key ID (32 characters), not the token value. If it is right, check R2_ACCOUNT_ID: a key from a different Cloudflare account is refused the same way.`;
      }
      return `R2 rejected the credentials${codeNote} without saying which value. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are the same token's pair, and R2_ACCOUNT_ID is the account that token belongs to.`;
    case "access_denied":
      return `R2 accepted the keys but refused to list the bucket${codeNote}. The token is probably scoped to a different bucket than R2_BUCKET, or lacks Object Read & Write on it.`;
    case "bucket_not_found":
      return `R2 accepted the keys but has no bucket named in R2_BUCKET on this account${codeNote}. Check R2_BUCKET, then R2_ACCOUNT_ID.`;
    case "account_not_found":
      return `The R2 address built from R2_ACCOUNT_ID did not resolve${codeNote}. R2_ACCOUNT_ID is probably wrong (it is the 32-character id on R2 → Overview). If it is right, try again — a DNS hiccup looks the same once.`;
    case "timeout":
      return "R2 did not answer within 15 seconds. This says nothing about the keys — try again.";
    case "unreachable":
      return `Could not reach R2${codeNote}. This says nothing about the keys — try again.`;
    default:
      return `R2 answered${r.status ? ` HTTP ${r.status}` : ""}${codeNote}, which this test does not recognise, so it says nothing about whether the keys work.`;
  }
}

/**
 * Run the test. One GET at most; none at all when not configured.
 *
 * @returns {Promise<{ ok: boolean, result: string, likely: string|null, code: string|null,
 *   status: number|null, objects?: "none"|"some"|null, missing?: string[], malformed?: string[],
 *   message: string, checkedAt: string }>}
 */
export async function testR2Connection({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const problems = r2ConfigProblems(env);
  let r;
  if (!problems.ok) {
    r = { result: "not_configured", likely: null, code: null, status: null, missing: problems.missing, malformed: problems.malformed };
  } else {
    try {
      r = classifyR2Probe(await listObjectsProbe(problems.config, { fetchImpl }));
    } catch (error) {
      r = classifyR2Probe({ error });
    }
  }
  return { ok: r.result === "connected", ...r, message: describeR2Test(r), checkedAt: now().toISOString() };
}
