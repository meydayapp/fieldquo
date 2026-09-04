// app/api/settings/document-templates/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  defaultSubjectFor,
} from "@/app/data/emailTemplateBlocks";
import { starterSectionsFor, isPdfTemplate } from "@/lib/documents/templateKind";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const templates = await db.documentTemplate.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(templates);
}

// POST { type, name, duplicateFromId? } → creates a new template. With no
// duplicateFromId it is pre-seeded with the starter layout for that type; with
// one, it is a real copy of that template.
//
// `duplicateFromId` was accepted by two callers and read by neither — this
// route destructured only { type, name }, so "Copy the current one" on the PDF
// templates screen and "Duplicate" on the email templates screen both handed
// back the STOCK starter layout wearing a "(copy)" name. A contractor who had
// customised a layout, copied it, and then edited "the copy" was editing
// something they had never made. Copying here rather than in the caller is what
// makes the copy complete: the email screen's follow-up PATCH could only carry
// `sections`, so its duplicates silently lost `subject` and `theme` as well.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage email templates" },
      { status: 403 },
    );
  }

  const { type, name, duplicateFromId } = await request.json();
  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  // Tenant-scoped by companyId in the same query, not checked afterwards: a
  // findUnique on a guessed id followed by an ownership `if` is one edit away
  // from copying another company's layout.
  let source = null;
  if (duplicateFromId) {
    source = await db.documentTemplate.findFirst({
      where: { id: String(duplicateFromId), companyId: member.companyId },
    });
    if (!source) {
      return NextResponse.json(
        { error: "That template no longer exists." },
        { status: 404 },
      );
    }
    // Copying across kinds would hand the PDF renderer email blocks (and the
    // reverse), which is the "Unknown section type" crash the starter-sections
    // comment below describes. Refuse rather than produce a broken copy.
    if (source.type !== type) {
      return NextResponse.json(
        { error: "A layout can only be copied to the same document type." },
        { status: 400 },
      );
    }
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
      subject: source
        ? source.subject
        : isPdfTemplate(type)
          ? null
          : defaultSubjectFor(type),
      sections: source ? source.sections : starterSectionsFor(type),
      // A copy is never active. `isDefault` stays false so copying the live
      // layout cannot swap what clients receive as a side effect of pressing
      // Copy — the company activates it explicitly, as it does for any other
      // new template.
      ...(source?.theme !== undefined && source?.theme !== null
        ? { theme: source.theme }
        : {}),
    },
  });

  return NextResponse.json(created, { status: 201 });
}
