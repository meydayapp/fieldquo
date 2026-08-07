// app/api/funnels/public/[companySlug]/[funnelSlug]/event/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";

// Public, fire-and-forget — one row per step the visitor reached (and one on
// completion), tagged with an anonymous session id so drop-off between steps can
// be computed ("60% quit at the budget question"). No PII: a sessionId is a
// random client string, never tied to a person.
const KINDS = new Set(["view", "complete"]);

export async function POST(request, { params }) {
  const { companySlug, funnelSlug } = await params;
  const body = await request.json().catch(() => ({}));

  const kind = KINDS.has(body.kind) ? body.kind : null;
  const stepId = typeof body.stepId === "string" ? body.stepId.slice(0, 40) : null;
  if (!kind || !stepId)
    return NextResponse.json({ ok: false }, { status: 400 });

  const company = await findBookingCompany(companySlug, { id: true });
  if (!company) return NextResponse.json({ ok: false }, { status: 404 });

  const funnel = await db.funnel.findFirst({
    where: { companyId: company.id, slug: funnelSlug, status: "published" },
    select: { id: true },
  });
  if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });

  await db.funnelEvent
    .create({
      data: {
        funnelId: funnel.id,
        stepId,
        kind,
        sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
