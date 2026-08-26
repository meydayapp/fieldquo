// app/api/custom-fields/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

const ENTITY_TYPES = ["client", "property", "quote", "job", "invoice", "team"];
const FIELD_TYPES = ["text", "number", "date", "checkbox", "dropdown"];

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const fields = await db.customField.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(fields);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can add custom fields" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { entityType, label, fieldType, options, required } = body;

  if (!label || !ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: "label and a valid entityType are required" },
      { status: 400 },
    );
  }

  const count = await db.customField.count({
    where: { companyId: member.companyId, entityType },
  });

  const field = await db.customField.create({
    data: {
      companyId: member.companyId,
      entityType,
      label,
      fieldType: FIELD_TYPES.includes(fieldType) ? fieldType : "text",
      options: fieldType === "dropdown" ? (options ?? []) : null,
      required: !!required,
      sortOrder: count,
    },
  });

  return NextResponse.json(field, { status: 201 });
}
