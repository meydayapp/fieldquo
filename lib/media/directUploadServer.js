// lib/media/directUploadServer.js
//
// The two server halves of a direct-to-Cloudinary upload — sign before,
// verify after — shared by the three routes that offer one:
//
//   /api/upload/{sign,verify}                     signed-in staff
//   /api/portal/[token]/upload/{sign,verify}      a client with a portal link
//   /api/self-quote/[companySlug]/upload/{sign,verify}  a stranger on a public form
//
// Each route resolves WHO is asking and which company that makes it (session,
// portal token, company slug) into a scope from lib/media/directUpload.js,
// then hands it here. Nothing below reads a company id, a folder or a purpose
// from the request body — the scope is the route's to decide.
//
// The rules themselves live in lib/media/directUpload.js, which is pure; this
// file is only the part that needs the SDK and the secret.

import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import {
  planUpload,
  readClaim,
  responseSignatureValid,
  judgeUploadedAsset,
  isOwnPublicId,
  cloudinarySignature,
} from "@/lib/media/directUpload";

export function uploadsConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );
}

// ── The plan's own ceilings, cached per server instance ─────────────────────
//
// One Admin API call an hour per warm instance, not one per upload: the Free
// plan allows 500 Admin API calls an hour across the whole account, and verify
// already spends one per upload. A failed lookup is remembered for five
// minutes so an outage does not turn every sign into a second failing call —
// and while it is unknown, our own caps stand (Cloudinary's refusal is then the
// backstop, and the client helper surfaces it with its numbers).
let planCache = { value: null, at: 0, ttl: 0 };
async function planLimits() {
  const now = Date.now();
  if (now - planCache.at < planCache.ttl) return planCache.value;
  try {
    const usage = await cloudinary.api.usage();
    planCache = { value: usage?.media_limits || null, at: now, ttl: 60 * 60 * 1000 };
  } catch (err) {
    console.error("[upload/sign] plan limits lookup failed:", err?.error?.message || err?.message);
    planCache = { value: null, at: now, ttl: 5 * 60 * 1000 };
  }
  return planCache.value;
}

/**
 * Sign one upload for `scope`. The body is the browser's declaration of the
 * file: { type, size, name }.
 */
export async function signResponse(scope, body) {
  if (!uploadsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image uploads aren't configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, then redeploy.",
      },
      { status: 503 },
    );
  }
  const file = { type: body?.type, size: body?.size };
  const plan = planUpload(file, scope, { planLimits: await planLimits() });
  if (!plan.ok) {
    return NextResponse.json(
      { error: plan.error, code: plan.code, ...(plan.maxBytes ? { maxBytes: plan.maxBytes } : {}) },
      { status: plan.code === "too_large" ? 413 : 400 },
    );
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const signature = cloudinarySignature(plan.params, process.env.CLOUDINARY_API_SECRET);
  return NextResponse.json({
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${plan.resourceType}/upload`,
    // Exactly the fields the browser posts alongside the file. Anything it
    // adds or changes breaks the signature and Cloudinary refuses the upload.
    fields: { ...plan.params, api_key: process.env.CLOUDINARY_API_KEY, signature },
    kind: plan.kind,
    resourceType: plan.resourceType,
    maxBytes: plan.maxBytes,
  });
}

/**
 * Verify one finished upload for `scope`. The body is what Cloudinary told the
 * browser — { publicId, version, signature, resourceType } — plus the display
 * filename. Answers the entry every caller stores: { url, publicId, kind,
 * filename, bytes, … }, the same shape /api/upload always answered.
 */
export async function verifyResponse(scope, body) {
  if (!uploadsConfigured()) {
    return NextResponse.json({ error: "Uploads aren't available right now." }, { status: 503 });
  }
  const read = readClaim(body);
  if (!read.ok) return NextResponse.json({ error: read.error, code: "bad_claim" }, { status: 400 });
  const { claim } = read;

  // Cheapest refusals first, and neither costs an Admin API call: a public_id
  // outside this scope's folder, and a signature we did not produce. One
  // sentence for both — telling a caller WHICH test failed is telling them how
  // to pass the next one.
  const unconfirmed = "That upload could not be confirmed. Upload the file again.";
  if (!isOwnPublicId(claim.publicId, scope, claim.resourceType)) {
    return NextResponse.json({ error: unconfirmed, code: "not_ours" }, { status: 403 });
  }
  if (!responseSignatureValid(claim, process.env.CLOUDINARY_API_SECRET)) {
    return NextResponse.json({ error: unconfirmed, code: "bad_signature" }, { status: 403 });
  }

  let asset;
  try {
    asset = await cloudinary.api.resource(claim.publicId, { resource_type: claim.resourceType, type: "upload" });
  } catch (err) {
    const code = err?.error?.http_code || err?.http_code;
    if (code === 404) return NextResponse.json({ error: unconfirmed, code: "not_found" }, { status: 404 });
    // Rate-limited (420) or unreachable. Fail CLOSED — an unverified file is
    // never saved — but say it is temporary, because it is.
    console.error("[upload/verify] Admin API lookup failed:", code, err?.error?.message || err?.message);
    return NextResponse.json(
      { error: "The upload finished but couldn't be confirmed just now. Wait a minute and upload it again.", code: "lookup_failed" },
      { status: 503 },
    );
  }

  const verdict = judgeUploadedAsset({
    claim,
    asset,
    scope,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    filename: body?.filename,
  });
  if (!verdict.ok) {
    if (verdict.code === "too_large" || verdict.code === "wrong_format") {
      // Logged with the public_id so the orphan can be found: it is left in
      // Cloudinary, in the company's own folder, not deleted here.
      console.warn("[upload/verify] refused", verdict.code, claim.publicId);
    }
    return NextResponse.json(
      { error: verdict.error, code: verdict.code },
      { status: verdict.code === "too_large" ? 413 : verdict.code === "wrong_format" ? 400 : 403 },
    );
  }
  return NextResponse.json(verdict.entry);
}

/** A JSON body, or {} — a malformed body is refused by the shape checks. */
export async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
