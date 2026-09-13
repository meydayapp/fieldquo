// app/api/webhooks/inbound-sales-email/route.js
//
// A prospect replied to a rep. Their mailbox forwards a copy here.
//
// ══ Provider-agnostic, on purpose ══════════════════════════════════════════
//
// We do not know which mail provider the reps' mailboxes are with, and the
// brief that commissioned this said so plainly: do not invent vendor
// capability. So this endpoint implements no vendor's webhook format. It
// accepts a small, documented JSON (or form-encoded) body that any inbound
// parser, forwarding service, mail rule with a script behind it, or ten-line
// cron on a mailbox can produce. docs/SALES-OUTREACH.md is the contract, and it
// is the file to read before configuring anything.
//
// ══ Public, so the shared secret IS the authentication boundary ════════════
//
// Same shape and same stakes as the cron endpoints: nobody is signed in, and
// the header is the entire gate. lib/security/cronAuth.js's header records what
// happens when that check is written casually — comparing against
// `Bearer ${process.env.SECRET}` with the variable unset compares against the
// literal string "Bearer undefined", which is a fixed, publicly knowable
// password. verifyInboundSecret() mirrors requireCronSecret exactly instead:
// timing-safe, and a missing secret ALWAYS denies, loudly, rather than falling
// through.
//
// ══ Why a refusal to file is still a 2xx ═══════════════════════════════════
//
// Everything past authentication answers 200 with a reason, never 4xx. The
// caller is a mail forwarder, and a 4xx to a forwarder means a retry storm or a
// bounce back to the prospect — losing or duplicating the very message we exist
// to keep. So the outcomes ("filed", "unknown_token", "own_outbound",
// "duplicate") are in the body, where a person configuring the rule can read
// them, and the ones that indicate misconfiguration are recorded to the
// platform error log so they are visible without anyone tailing a forwarder.
// The one exception is the secret itself: a 401 must be a 401, or a
// misconfigured forwarder would look like it was working.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyInboundSecret } from "@/lib/sales/outreach";
import { ingestInboundEmail } from "@/lib/sales/inboundEmail";

// A forwarded thread with quoted history is large; a mail bomb is larger. One
// megabyte is comfortably past any real reply and far short of anything that
// can hurt the process.
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request) {
  const verdict = verifyInboundSecret(
    request.headers.get("authorization"),
    process.env.SALES_INBOUND_SECRET,
  );

  if (!verdict.ok) {
    if (verdict.reason === "unconfigured") {
      console.error(
        "[sales-inbound] SALES_INBOUND_SECRET is not set — refusing every " +
          "inbound message until it is configured.",
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { filed: false, reason: "too_large", error: "That message is too large to file." },
      { status: 413 },
    );
  }

  let payload;
  const contentType = String(request.headers.get("content-type") || "");
  try {
    if (contentType.includes("form")) {
      payload = Object.fromEntries(new URLSearchParams(raw));
    } else {
      payload = JSON.parse(raw || "{}");
    }
  } catch {
    return NextResponse.json(
      {
        filed: false,
        reason: "unparseable",
        error:
          "Body must be JSON (or form-encoded). See docs/SALES-OUTREACH.md for " +
          "the field names.",
      },
      { status: 400 },
    );
  }

  // Parse, file, and log a misconfiguration — shared with the Resend Receiving
  // door (app/api/webhooks/resend-inbound/route.js) so the two cannot answer
  // the same outcome differently. lib/sales/inboundEmail.js says why.
  const { status, body } = await ingestInboundEmail(db, payload, { source: "forwarder" });
  return NextResponse.json(body, { status });
}
