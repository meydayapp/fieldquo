// app/api/settings/field-work/route.js
//
// GET / PATCH the three company-level switches behind the field screens:
//
//   offlineCachingEnabled  public/sw.js's app-shell cache (default on)
//   labourSellRate         the hourly rate a clocked-hours invoice line bills
//   performancePayRule     the daily-sheet bonus rule (default none)
//
// Owner/admin only: all three decide money or what a phone stores.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { normalisePayRule } from "@/lib/dailySheets/bonus";
import { labourRateOptions } from "@/lib/invoices/labourRates";

const ownerOrAdmin = (m) => m.role === "owner" || m.role === "admin";

async function payload(companyId) {
  const [company, rates] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { offlineCachingEnabled: true, labourSellRate: true, performancePayRule: true, currency: true },
    }),
    labourRateOptions(db, companyId),
  ]);
  return {
    offlineCachingEnabled: company?.offlineCachingEnabled !== false,
    labourSellRate: company?.labourSellRate == null ? null : Number(company.labourSellRate),
    performancePayRule: normalisePayRule(company?.performancePayRule),
    currency: company?.currency || null,
    // Every rate the invoice offer can pick from, so the page can say "your
    // Painting service is also priced by the hour and will be offered".
    rateOptions: rates,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A read-only support session (non-negotiable #3: the console views
  // everything) reads; anyone else needs to be an owner or admin. PATCH
  // below has no such carve-out.
  if (!member.impersonation && !ownerOrAdmin(member)) {
    return NextResponse.json({ error: "Only an owner or admin can see these settings." }, { status: 403 });
  }
  return NextResponse.json(await payload(member.companyId));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!ownerOrAdmin(member)) return NextResponse.json({ error: "Only an owner or admin can change these settings." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.offlineCachingEnabled === "boolean") data.offlineCachingEnabled = body.offlineCachingEnabled;
  if ("labourSellRate" in body) {
    if (body.labourSellRate === null || body.labourSellRate === "") data.labourSellRate = null;
    else {
      const n = Number(body.labourSellRate);
      if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: "The hourly rate must be a number between 0 and 100,000." }, { status: 400 });
      data.labourSellRate = n > 0 ? Math.round(n * 100) / 100 : null;
    }
  }
  if ("performancePayRule" in body) {
    // null, or a rule that pays something. An all-zero rule is stored as
    // null — see normalisePayRule — so the column never holds "a rule that
    // is not a rule".
    data.performancePayRule = normalisePayRule(body.performancePayRule);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  await db.company.update({ where: { id: member.companyId }, data });
  return NextResponse.json(await payload(member.companyId));
}
