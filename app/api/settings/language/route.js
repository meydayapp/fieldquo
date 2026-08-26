// app/api/settings/language/route.js
//
// GET  — the caller's own language, the company default, and supported list
// PATCH { language }         — the caller's personal preference (any member)
// PATCH { defaultLanguage }  — the company default (owners/admins only)
//
// The two are deliberately separate permissions. Anyone should be able to
// change the language they personally read the app in; only an admin should
// change the default everyone else inherits.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { LANGUAGES, isSupported } from "@/app/i18n/languages";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const [user, company] = await Promise.all([
    db.user.findUnique({
      where: { id: member.userId },
      select: { language: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true },
    }),
  ]);

  return NextResponse.json({
    // null is meaningful here — it's "inherit", not "unset". The UI shows it
    // as an explicit "Match company default" option.
    language: user?.language ?? null,
    defaultLanguage: company?.defaultLanguage || "en",
    supported: LANGUAGES,
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const { language, defaultLanguage } = body;

  // ── Personal preference — any member ────────────────────────────────
  if (language !== undefined) {
    if (language !== null && !isSupported(language)) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 },
      );
    }
    await db.user.update({
      where: { id: member.userId },
      data: { language }, // null = inherit the company default
    });
  }

  // ── Company default — owners/admins only ────────────────────────────
  if (defaultLanguage !== undefined) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only owners/admins can change the company default language" },
        { status: 403 },
      );
    }
    if (!isSupported(defaultLanguage)) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 },
      );
    }
    await db.company.update({
      where: { id: member.companyId },
      data: { defaultLanguage },
    });
  }

  const [user, company] = await Promise.all([
    db.user.findUnique({
      where: { id: member.userId },
      select: { language: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true },
    }),
  ]);

  return NextResponse.json({
    language: user?.language ?? null,
    defaultLanguage: company?.defaultLanguage || "en",
  });
}
