// app/api/meta/data-deletion/route.js
//
// Meta's "Data Deletion Request Callback". Registered in the FieldQuo app's
// settings on developers.facebook.com (see docs/META-APP-REVIEW-PROMPT.md);
// Meta POSTs here when a person removes the FieldQuo app from their Facebook
// account, with one form field:
//
//   signed_request=<signature>.<base64url payload>
//
// and expects, in return, JSON of exactly this shape:
//
//   { "url": "<where the person can check status>", "confirmation_code": "<ref>" }
//
// ── Why this exists when FieldQuo has no Facebook Login ──────────────────
//
// docs/ROADMAP.md (3 September 2026) recorded the decision NOT to build this,
// on the grounds that the callback is a Facebook-Login mechanism. The owner
// asked for it on 2026-09-08 anyway: Meta's app settings present the field
// for any app, a reviewer may expect it, and a person who authorised
// `ads_read` and later removes the app has still made a deletion request in
// the ordinary sense. So the callback does the same thing as the public form:
// it REGISTERS a request under a reference and tells FieldQuo's inbox. The
// deletion itself is manual, by the owner, exactly as for a form request —
// the payload's user_id is recorded so the owner can find which
// MetaAdConnection, if any, that person authorised.
//
// ── Verified, or refused ─────────────────────────────────────────────────
//
// The signature is checked against META_APP_SECRET (the same variable
// lib/meta/client.js uses for the token exchange) BEFORE anything is written.
// No secret means no verification is possible, and an unverifiable callback
// is refused rather than trusted — otherwise this is a public endpoint that
// files a request for any user id anybody names, and sends us an email each
// time. Refusals are a bare 400: which check failed is not something Meta
// needs, and it is a hint to anyone else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import { parseSignedRequest } from "@/lib/dataDeletion/signedRequest";
import {
  generateConfirmationCode,
  META_CALLBACK_PLACEHOLDER_EMAIL,
} from "@/lib/dataDeletion/requests";
import {
  buildDeletionNotice,
  sendDataDeletionEmail,
} from "@/lib/email/dataDeletionEmail";

const refuse = () => NextResponse.json({ error: "Bad request" }, { status: 400 });

/** Public origin for the status link handed back to Meta. */
function publicOrigin() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  return configured || "https://www.fieldquo.com";
}

/**
 * Meta sends application/x-www-form-urlencoded. Read that first; accept JSON
 * too, because Meta's own "test callback" tooling has been seen to send
 * either. Both reads are guarded: a body that is neither is a 400, not a 500.
 */
async function readSignedRequest(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return body && typeof body === "object" ? body.signed_request : null;
  }
  const form = await request.formData().catch(() => null);
  return form ? form.get("signed_request") : null;
}

export async function POST(request) {
  const limited = rateLimit(request, "meta-data-deletion", {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const raw = await readSignedRequest(request);
  const verified = parseSignedRequest(
    typeof raw === "string" ? raw : null,
    process.env.META_APP_SECRET,
  );
  if (!verified.ok) {
    console.warn(`[meta/data-deletion] refused signed_request: ${verified.reason}`);
    return refuse();
  }

  const metaUserId = String(verified.payload.user_id ?? "").trim();
  if (!metaUserId) return refuse();

  // Same one-retry-on-collision as the form route. Not shared as a helper on
  // purpose: the two routes write different columns, and a helper that took
  // "the rest of the row" as an argument would be the copy-paste it replaced.
  let row;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      row = await db.dataDeletionRequest.create({
        data: {
          confirmationCode: generateConfirmationCode(),
          email: META_CALLBACK_PLACEHOLDER_EMAIL,
          source: "meta_callback",
          metaUserId,
        },
      });
      break;
    } catch (err) {
      if (err?.code !== "P2002" || attempt === 1) throw err;
    }
  }

  // Only the internal notice — there is no address to acknowledge to. Meta's
  // response is the acknowledgement: the person sees the status URL in their
  // Facebook settings. A failed notice is logged and does not fail the
  // callback; Meta retries a non-2xx, and a retried callback is a second row
  // for one removal.
  const notice = buildDeletionNotice(row);
  const result = await sendDataDeletionEmail({ to: SUPPORT_EMAIL, ...notice });
  if (result?.error || result?.skipped) {
    console.error(
      `[meta/data-deletion] internal notice for ${row.confirmationCode} not sent: ` +
        (result?.skipped ? "RESEND_API_KEY unset" : result.error?.message || result.error),
    );
  }

  return NextResponse.json({
    url: `${publicOrigin()}/data-deletion?code=${encodeURIComponent(row.confirmationCode)}`,
    confirmation_code: row.confirmationCode,
  });
}
