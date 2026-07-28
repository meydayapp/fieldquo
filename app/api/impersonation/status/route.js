// app/api/impersonation/status/route.js
//
// "Am I in a read-only support session, and if so whose?"
//
// The cookie is httpOnly, so the banner can't read it directly — that's
// deliberate, an XSS shouldn't be able to lift a token that crosses tenants.
// This endpoint answers the question without handing the token over.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
} from "@/lib/platform/impersonate";

export async function GET(request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(
    new RegExp(`(?:^|;\\s*)${IMPERSONATION_COOKIE}=([^;]+)`),
  );
  if (!match) return NextResponse.json({ active: false });

  const claims = await verifyImpersonationToken(decodeURIComponent(match[1]));
  if (!claims) return NextResponse.json({ active: false });

  const [company, admin] = await Promise.all([
    db.company.findUnique({
      where: { id: claims.companyId },
      select: { id: true, name: true },
    }),
    db.platformAdmin.findUnique({
      where: { id: claims.platformAdminId },
      select: { email: true },
    }),
  ]);

  if (!company) return NextResponse.json({ active: false });

  return NextResponse.json({
    active: true,
    mode: claims.mode,
    companyId: company.id,
    companyName: company.name,
    adminEmail: admin?.email || null,
    // Approximate: the banner counts down from here rather than decoding the
    // JWT's exp, which it can't see. The countdown is a courtesy — expiry is
    // enforced by jose at verification time, not by this number.
    expiresInSeconds: 30 * 60,
  });
}
