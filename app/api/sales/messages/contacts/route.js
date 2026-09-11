// app/api/sales/messages/contacts/route.js
//
// Who a rep may start a text with: their OWN leads and claimed prospects,
// searched by name or number. Nothing they do not hold is returned, so the
// picker on the texts screen cannot be used to browse the pool.
//
// `?leadId=` resolves one of the rep's leads to the number its thread is
// keyed by, for the "open in Texts" link on the lead screen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSalesRep } from "@/lib/sales/gate";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { queueWhere } from "@/lib/sales/prospectView";

const TAKE = 20;

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (leadId) {
    const lead = await db.salesLead.findFirst({
      where: { id: leadId, salesRepId: rep.id },
      select: { id: true, businessName: true, phone: true, prospect: { select: { phoneE164: true } } },
    });
    if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const e164 = normalisePhone(lead.phone) || lead.prospect?.phoneE164 || null;
    return NextResponse.json({ leadId: lead.id, with: e164, name: lead.businessName || null });
  }

  const q = String(url.searchParams.get("q") || "").trim();
  const digits = q.replace(/\D/g, "");
  const nameWhere = q ? { businessName: { contains: q, mode: "insensitive" } } : {};
  const leadWhere = {
    salesRepId: rep.id,
    ...(q
      ? {
          OR: [
            nameWhere,
            { contactName: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits.slice(-4) } }] : []),
          ],
        }
      : {}),
  };
  const [leads, prospects] = await Promise.all([
    db.salesLead.findMany({
      where: leadWhere,
      orderBy: { updatedAt: "desc" },
      take: TAKE,
      select: { id: true, businessName: true, contactName: true, phone: true, status: true, prospectId: true },
    }),
    db.prospect.findMany({
      where: {
        ...queueWhere(rep.id),
        doNotContactAt: null,
        ...(q
          ? {
              OR: [nameWhere, ...(digits.length >= 3 ? [{ phoneE164: { contains: digits.slice(-4) } }] : [])],
            }
          : {}),
      },
      orderBy: { assignedAt: "desc" },
      take: TAKE,
      select: { id: true, businessName: true, phoneE164: true, city: true, province: true },
    }),
  ]);

  // A prospect already carried into a lead is listed once, as the lead.
  const carried = new Set(leads.map((l) => l.prospectId).filter(Boolean));
  const results = [
    ...leads
      .map((l) => ({
        kind: "lead",
        id: l.id,
        name: l.businessName || l.contactName || null,
        e164: normalisePhone(l.phone),
        status: l.status,
      }))
      .filter((l) => !digits || !l.e164 || l.e164.endsWith(digits.slice(-Math.min(digits.length, 10)))),
    ...prospects
      .filter((p) => !carried.has(p.id))
      .map((p) => ({
        kind: "prospect",
        id: p.id,
        name: p.businessName,
        e164: p.phoneE164,
        place: [p.city, p.province].filter(Boolean).join(", ") || null,
      })),
  ];
  return NextResponse.json({ results });
}
