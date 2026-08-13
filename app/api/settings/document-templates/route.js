// app/api/settings/document-templates/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import {
  defaultSubjectFor,
} from "@/app/data/emailTemplateBlocks";
import { starterSectionsFor, isPdfTemplate } from "@/lib/documents/templateKind";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db.documentTemplate.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(templates);
}

// POST { type, name } → creates a new template pre-seeded with a starter
// layout for that type (see defaultSectionsFor). Not made active
// automatically — the company picks that explicitly.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage email templates" },
      { status: 403 },
    );
  }

  const { type, name } = await request.json();
  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  // starterSectionsFor, not defaultSectionsFor: the latter only knows the email
  // block vocabulary and falls through to [heading, text] for anything else, so
  // creating a PDF layout used to produce a template the PDF renderer couldn't
  // read — "Unknown section type: heading" on the next download. See
  // lib/documents/templateKind.js.
  const created = await db.documentTemplate.create({
    data: {
      companyId: member.companyId,
      type,
      name: name?.trim() || "Untitled template",
      subject: isPdfTemplate(type) ? null : defaultSubjectFor(type),
      sections: starterSectionsFor(type),
    },
  });

  return NextResponse.json(created, { status: 201 });
}
