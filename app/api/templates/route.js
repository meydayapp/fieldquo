// app/api/templates/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const templates = await db.documentTemplate.findMany({
    where: { companyId: member.companyId, ...(type && { type }) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

// Creates a new template — either blank or duplicated from an existing one (e.g. the
// seeded default), so a company can start from the original layout and customize it.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, name, duplicateFromId } = body;

  if (!type || !name) {
    return NextResponse.json(
      { error: "type and name are required" },
      { status: 400 },
    );
  }

  let sections = [];

  if (duplicateFromId) {
    const source = await db.documentTemplate.findFirst({
      where: { id: duplicateFromId, companyId: member.companyId },
    });
    if (!source)
      return NextResponse.json(
        { error: "Source template not found" },
        { status: 404 },
      );
    sections = source.sections;
  } else {
    // Falls back to the built-in default section set for this type
    const { getDefaultSections } = type.includes("email")
      ? await import("@/app/admin/lib/email/defaultSections")
      : await import("@/app/admin/lib/pdf/defaultSections");
    sections = getDefaultSections(type);
  }

  const template = await db.documentTemplate.create({
    data: {
      companyId: member.companyId,
      type,
      name,
      sections,
      isDefault: false,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
