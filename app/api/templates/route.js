// app/api/templates/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── This route has no UI and no permission check ────────────────────────
  //
  // It reads and writes `documentTemplate` — the same rows
  // /api/settings/document-templates guards with user:manage — while requiring
  // nothing but a session. Nothing in app/, components/ or lib/ calls it: the
  // PDF Templates page uses the guarded route. So any employee could curl this
  // and destroy the company's quote and invoice templates.
  //
  // Gated rather than deleted: an orphan in this repo is not proof nothing
  // reaches it, and a 403 is safe whether or not something does. It should be
  // removed once that is confirmed.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change document templates." },
      { status: 403 },
    );
  }

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

  // ── This route has no UI and no permission check ────────────────────────
  //
  // It reads and writes `documentTemplate` — the same rows
  // /api/settings/document-templates guards with user:manage — while requiring
  // nothing but a session. Nothing in app/, components/ or lib/ calls it: the
  // PDF Templates page uses the guarded route. So any employee could curl this
  // and destroy the company's quote and invoice templates.
  //
  // Gated rather than deleted: an orphan in this repo is not proof nothing
  // reaches it, and a 403 is safe whether or not something does. It should be
  // removed once that is confirmed.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can change document templates." },
      { status: 403 },
    );
  }

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
    // Falls back to the built-in default section set for this type.
    //
    // This used to branch to a separate `email/defaultSections` module for
    // email types. That module was an EMPTY FILE, so `getDefaultSections`
    // came back undefined and creating any email template threw
    // "getDefaultSections is not a function" — a runtime failure nobody hit
    // because it only fires on the create-template path. Deleting the empty
    // file turned that latent crash into a build error, which is how it
    // surfaced.
    //
    // There was never a second module to reach: getDefaultSections below
    // already handles quote_email and invoice_email alongside the PDF types.
    // One import, no branch.
    const { getDefaultSections } = await import(
      "@/app/admin/lib/pdf/defaultSections"
    );
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
