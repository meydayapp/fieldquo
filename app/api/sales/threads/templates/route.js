// app/api/sales/threads/templates/route.js
//
// The starting points the compose box offers for one lead:
// `?leadId=` → lib/sales/emailTemplates.js's list, in the prospect's
// language, with the rep's own signup link and the engine's open check-in
// drafts for that lead. Nothing is sent or marked by reading this.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { leadWhere } from "@/lib/sales/outreach";
import { emailTemplatesFor } from "@/lib/sales/emailTemplates";
import { ensureReferralToken } from "@/lib/sales/repLink";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, url.searchParams.get("leadId")),
    select: { id: true, contactName: true, businessName: true, province: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [linkCode, checkIns] = await Promise.all([
    // The opaque token the link is built from, minted on first use — never
    // the legacy name slug (lib/sales/repLink.js).
    ensureReferralToken(rep),
    db.salesCheckIn.findMany({
      where: { salesRepId: rep.id, leadId: lead.id, status: "draft" },
      orderBy: { scheduledFor: "asc" },
      take: 3,
      select: { id: true, draftText: true, scheduledFor: true },
    }),
  ]);

  return NextResponse.json(
    emailTemplatesFor({ rep: { name: rep.name, workName: rep.workName, linkCode }, lead, origin: getAppOrigin(request), checkIns }),
  );
}
