// app/api/leads/public/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — the embeddable "request a quote" form submits here.
// companySlug identifies which company's form this is, since the form is embedded
// on THEIR website, not accessed through FieldQuo's own auth.
export async function POST(request) {
  const body = await request.json();
  const { companySlug, name, email, phone, categoryId, message, source } = body;

  if (!companySlug || !name) {
    return NextResponse.json(
      { error: "companySlug and name are required" },
      { status: 400 },
    );
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Provide at least an email or phone number" },
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
      message: message || null,
      source: source || "embed_form",
    },
  });

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
