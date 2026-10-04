// app/api/platform/companies/[id]/test-company/route.js
//
// POST { isTest: boolean, reason } — the "Test company" switch on
// /platform/companies/[id] (owner, 2026-10-03).
//
// A company marked test is left out of every /platform number — revenue and
// MRR, paying and trialing counts, signups, funnels, cohorts, cost per signup
// — through lib/platform/metricsScope.js and the "test" bucket in
// lib/platform/trialCounting.js. Nothing else changes: the company keeps
// working, billing and emailing exactly as before.
//
// ── Why this is not "editing the company's data" ───────────────────────────
//
// Non-negotiable #3: the console edits nothing on a company's data. These
// three columns are FieldQuo's own label ABOUT the company — like the
// quote-builder rollout flag or the cancel panel's ending — never read by
// anything the company sees, and never written by the company.
//
// ── Gates ──────────────────────────────────────────────────────────────────
//
// "company:mark_test" — SUPERADMIN_ONLY_PERMISSIONS, because the switch moves
// a company in or out of the revenue numbers the owner runs the business on.
// Refused from inside a support session (middleware's read-only gate does not
// cover /api/platform — app/api/platform/errors/like says why). A reason is
// required: the audit row (test_company_marked / test_company_unmarked) is
// what answers "why is this company missing from MRR". A demo is refused —
// it is already out of every number, and a second label would only blur
// which rule left it out.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from "@/lib/platform/impersonationToken";

export async function POST(request, { params }) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:mark_test");
  } catch (err) {
    return NextResponse.json({ error: "Only a superadmin can mark a company as a test." }, { status: err.status || 403 });
  }
  const support = await verifyImpersonationToken(request.cookies?.get?.(IMPERSONATION_COOKIE)?.value);
  if (support) {
    return NextResponse.json({ error: "End the support session (View as company) before changing this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.isTest !== "boolean") {
    return NextResponse.json({ error: "Say whether this is a test company (isTest: true or false)." }, { status: 400 });
  }
  const isTest = body.isTest;
  const reason = String(body?.reason || "").trim();
  if (reason.length < 3) {
    return NextResponse.json({ error: "Say why — it goes in the audit log." }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id },
    select: { id: true, isDemo: true, isTestCompany: true, testMarkedAt: true, testMarkedBy: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (company.isDemo) {
    return NextResponse.json({ error: "This is a FieldQuo demo — already left out of every number." }, { status: 409 });
  }
  if (company.isTestCompany === isTest) {
    return NextResponse.json({ error: isTest ? "Already marked as a test company." : "Not marked as a test company." }, { status: 409 });
  }

  const now = new Date();
  const data = isTest
    ? { isTestCompany: true, testMarkedAt: now, testMarkedBy: admin.id }
    : { isTestCompany: false, testMarkedAt: null, testMarkedBy: null };

  await db.$transaction([
    db.company.update({ where: { id }, data }),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: isTest ? "test_company_marked" : "test_company_unmarked",
        targetCompanyId: id,
        details: {
          reason,
          previous: {
            isTestCompany: company.isTestCompany,
            testMarkedAt: company.testMarkedAt ? new Date(company.testMarkedAt).toISOString() : null,
            testMarkedBy: company.testMarkedBy || null,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, isTestCompany: isTest, testMarkedAt: data.testMarkedAt, testMarkedBy: data.testMarkedBy });
}
