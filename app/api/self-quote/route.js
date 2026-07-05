// app/api/self-quote/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — a website visitor requesting a quote through an embeddable widget,
// identified by companySlug. This is functionally very close to /api/leads/public
// (both create a LeadRequest); the distinction from TrueFinish is that self-quote
// captures more structured intake (service category + rough details) meant to feed
// straight into building a draft Quote, vs. leads/public being a lighter "call me back"
// form. If your actual usage ends up identical, these two should probably merge —
// worth revisiting once you see which one companies actually embed on their sites.
export async function POST(request) {
  const body = await request.json();
  const { companySlug, name, email, phone, address, categoryId, description } =
    body;

  if (!companySlug || !name || (!email && !phone)) {
    return NextResponse.json(
      {
        error:
          "companySlug, name, and at least one of email/phone are required",
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { slug: companySlug } });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await db.leadRequest.create({
    data: {
      companyId: company.id,
      name,
      email: email || null,
      phone: phone || null,
      categoryId: categoryId || null,
      message: [address, description].filter(Boolean).join("\n\n") || null,
      source: "self_quote",
    },
  });

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  casa;
}
