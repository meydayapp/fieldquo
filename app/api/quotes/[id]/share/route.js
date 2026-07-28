// app/api/quotes/[id]/share/route.js
//
// Mints the public share token for a quote.
//
// This closes a real hole: `Quote.shareToken` was in the schema and read by
// app/api/cron/follow-ups (which emails clients a `/q/<token>` link) but
// nothing ever wrote it. Every follow-up email therefore linked to
// `/q/undefined`. Nothing surfaced the bug because the cron doesn't check.
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { getAppOrigin } from "@/lib/appUrl";

function publicUrl(token, request) {
  return `${getAppOrigin(request)}/q/${token}`;
}

// GET returns the existing link without creating one, so a read-only viewer
// can see whether a quote has been shared without minting a token as a
// side effect of looking.
export async function GET(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { shareToken: true, sentAt: true, status: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    shareToken: quote.shareToken,
    url: quote.shareToken ? publicUrl(quote.shareToken, request) : null,
    sentAt: quote.sentAt,
    status: quote.status,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Creating a share link publishes pricing to anyone holding the URL, so it
  // sits at the same level as editing the quote — not plain view access.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "share quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, shareToken: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { rotate } = await request.json().catch(() => ({}));

  // Reuse the existing token unless rotation was asked for explicitly.
  // Regenerating on every call would silently break links already sitting in
  // a client's inbox.
  if (quote.shareToken && !rotate) {
    return NextResponse.json({
      shareToken: quote.shareToken,
      url: publicUrl(quote.shareToken, request),
      created: false,
    });
  }

  // 32 bytes of CSPRNG output, base64url. The token is the only thing standing
  // between a stranger and this client's pricing, so it needs to be
  // unguessable — cuid (sequential, timestamp-prefixed) would not be.
  const token = randomBytes(32).toString("base64url");

  await db.quote.update({
    where: { id: quote.id },
    data: { shareToken: token },
  });

  return NextResponse.json({
    shareToken: token,
    url: publicUrl(token, request),
    created: true,
    rotated: Boolean(quote.shareToken && rotate),
  });
}
