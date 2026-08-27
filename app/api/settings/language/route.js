// app/api/settings/language/route.js
//
// GET  — the caller's own language, the company default, and supported list
// PATCH { language }         — the caller's personal preference (any member)
// PATCH { defaultLanguage }  — the company default (user:manage)
//
// The two are deliberately separate permissions, and that split is why this is
// one of the three settings screens a Crew member keeps: the personal half is
// theirs. The page renders the company half as a fact rather than as buttons
// for anyone who cannot write it — see app/app/settings/language/page.js.
//
// The header used to say "owners/admins only" of the company default and so did
// the refusal below. Both were wrong about the same gate: requirePermission
// (…, "user:manage") admits a supervisor.
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
    } catch (err) {
      // The hand-written sentence here said "Only owners/admins", which the
      // gate above does not say — supervisors hold user:manage and reach this
      // line successfully, so the message described a rule the code does not
      // enforce. PERMISSION_DENIALS is the one place that answers "who can do
      // this" per permission; using the thrown message keeps the nine routes on
      // user:manage saying one thing about one rule.
      return NextResponse.json({ error: err.message }, { status: 403 });
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
