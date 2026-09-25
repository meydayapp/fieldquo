// app/api/custom-fields/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { schedulePhrases, companyWritingLanguage } from "@/lib/i18n/autoTranslateSchedule";

import {
  ENTITY_TYPES as ALL_ENTITY_TYPES,
  FIELD_TYPES,
  DOCUMENT_ENTITY_TYPES,
} from "@/lib/customFields/validate";

// "property" is in the enum and has no record to land on (no Property model —
// see the settings page header). Existing definitions stay listable and
// deletable; new ones are refused so a box is never defined for nowhere.
const ENTITY_TYPES = ALL_ENTITY_TYPES.filter((e) => e !== "property");

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
  const { entityType, label, fieldType, options, required, showOnDocuments } = body;

  if (!label || typeof label !== "string" || !label.trim() || !ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: "label and a valid entityType are required" },
      { status: 400 },
    );
  }
  // A dropdown with nothing to pick is a box nobody can fill.
  const cleanOptions =
    fieldType === "dropdown"
      ? [...new Set((Array.isArray(options) ? options : []).map((o) => String(o ?? "").trim()).filter(Boolean))]
      : null;
  if (fieldType === "dropdown" && cleanOptions.length === 0) {
    return NextResponse.json({ error: "A dropdown needs at least one option" }, { status: 400 });
  }

  const count = await db.customField.count({
    where: { companyId: member.companyId, entityType },
  });

  const field = await db.customField.create({
    data: {
      companyId: member.companyId,
      entityType,
      label: label.trim().slice(0, 80),
      fieldType: FIELD_TYPES.includes(fieldType) ? fieldType : "text",
      options: cleanOptions,
      required: !!required,
      // Only a quote or invoice has a client-facing document to show it on;
      // for anything else the flag is meaningless and stays false.
      showOnDocuments: DOCUMENT_ENTITY_TYPES.includes(entityType) && showOnDocuments === true,
      sortOrder: count,
    },
  });

  // A label flagged for documents is printed on the client's PDF, email,
  // /q page and portal in the document's language — drafted now, as a
  // phrase keyed by its text (lib/i18n/phrases.js), read back by
  // loadDocumentCustomFields. A staff-only box ("Gate code") stays in the
  // office and in the company's own words: nothing to translate.
  const autoTranslate = field.showOnDocuments
    ? schedulePhrases({
        companyId: member.companyId,
        ns: "customFieldLabel",
        texts: [field.label],
        sourceLanguage: await companyWritingLanguage(member.companyId),
      })
    : null;

  // The definition as before, plus the summary for the settings banner.
  return NextResponse.json({ ...field, autoTranslate }, { status: 201 });
}
