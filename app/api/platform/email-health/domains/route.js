// app/api/platform/email-health/domains/route.js
//
// What Resend actually reports, unedited.
//
// ── Why a raw view earns its place ──────────────────────────────────────────
//
// The health check next door decides whether email works and says so in a
// sentence. That's the right output most of the time, but when it says "no
// verified FieldQuo domain was found" there are three quite different causes
// and the sentence can't tell them apart:
//
//   * the domain was never added to Resend at all — a common mix-up, because
//     having a MAILBOX at contact@fieldquo.com is unrelated to Resend having
//     the DOMAIN fieldquo.com. Resend never sees the mailbox.
//   * it's there but still `pending`, waiting on DNS
//   * it's there and verified, but a Company row claims it, so discovery
//     correctly excluded it as a tenant's domain rather than FieldQuo's
//
// The third is the one nobody would ever guess. This endpoint shows the list
// with the claim status attached, so the answer takes a second instead of an
// afternoon.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { listDomains } from "@/lib/email/resendDomains";
import { getPlatformFrom } from "@/lib/email/platformSender";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY isn't set on this deployment." },
      { status: 503 },
    );
  }

  try {
    const domains = await listDomains();

    // Which of these belong to a tenant. Anything unclaimed and verified is a
    // candidate for FieldQuo's own sender.
    const claims = await db.company.findMany({
      where: { emailDomainId: { in: domains.map((d) => d.id) } },
      select: { emailDomainId: true, name: true },
    });
    const claimedBy = new Map(claims.map((c) => [c.emailDomainId, c.name]));

    return NextResponse.json({
      resolvedSender: await getPlatformFrom(),
      // EMAIL_FROM overrides discovery entirely, so its presence changes how
      // to read everything below.
      overriddenByEnv: Boolean(process.env.EMAIL_FROM),
      domains: domains.map((d) => ({
        name: d.name,
        status: d.status,
        region: d.region,
        createdAt: d.created_at,
        claimedBy: claimedBy.get(d.id) || null,
        usableAsPlatformSender:
          d.status === "verified" && !claimedBy.has(d.id),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Couldn't reach Resend." },
      { status: 502 },
    );
  }
}
