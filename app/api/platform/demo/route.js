// app/api/platform/demo/route.js
//
// Superadmin-only management of the sales demo accounts.
//
// Every write funnels through lib/demo/seedDemo.js, which re-reads the company
// and refuses anything without isDemo — so a hand-crafted request naming a real
// tenant's id gets a 403, not a wiped customer. This route deliberately does no
// safety checking of its own beyond auth: one guard, in one place, that
// everything must pass.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { listDemos, applyIndustry, resetDemo } from "@/lib/demo/seedDemo";
import { INDUSTRIES } from "@/lib/demo/industries";
import { listAllRepDemos } from "@/lib/sales/repDemo";

async function requireAdmin(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return admin;
}

function fail(err) {
  const status = err?.status || 500;
  if (status === 500) console.error("[platform/demo]", err);
  return NextResponse.json({ error: err?.message || "Something went wrong." }, { status });
}

/**
 * Which rep holds each demo, keyed by companyId.
 *
 * Read here rather than added to listDemos()' select, deliberately: listDemos
 * is also what scripts/seed-demos.mjs and the reset paths read, and none of
 * them care who a demo is assigned to. One extra query on one console screen
 * is cheaper than widening a shared select for a single caller.
 */
async function holdersByCompany() {
  const rows = await db.salesRep.findMany({
    where: { demoCompanyId: { not: null } },
    select: { id: true, name: true, email: true, demoCompanyId: true },
  });
  return new Map(rows.map((r) => [r.demoCompanyId, { id: r.id, name: r.name, email: r.email }]));
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const [demos, holders, repDemos] = await Promise.all([
      listDemos(),
      holdersByCompany(),
      // The reps' own demos, read-only on the console. listDemos() is the
      // POOL only, on purpose — see its header — so these come separately.
      listAllRepDemos(),
    ]);
    return NextResponse.json({
      repDemos,
      // `salesRepDemo` is the relation's own name on Company, used here so the
      // page reads the same field it would have got from an include — a null
      // means nobody holds it, which is the free state Claim draws from.
      demos: demos.map((d) => ({ ...d, salesRepDemo: holders.get(d.id) || null })),
      industries: Object.entries(INDUSTRIES).map(([key, v]) => ({
        key,
        label: v.label,
        company: v.company,
        brandColor: v.brandColor,
        categories: v.categories.length,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * PATCH — re-dress a demo as a different trade.
 * POST  — reset it to a clean state on the trade it's already on.
 *
 * Two verbs because they're two different intentions, and a sales agent
 * pressing "Reset" between calls must not have to re-pick their industry.
 */
export async function PATCH(request) {
  try {
    await requireAdmin(request);
    const { companyId, industry } = await request.json();
    if (!companyId || !industry) {
      return NextResponse.json({ error: "companyId and industry are required." }, { status: 400 });
    }
    return NextResponse.json(await applyIndustry(companyId, industry));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const { companyId } = await request.json();
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required." }, { status: 400 });
    }
    return NextResponse.json(await resetDemo(companyId));
  } catch (err) {
    return fail(err);
  }
}
