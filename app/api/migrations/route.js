// app/api/migrations/route.js
//
// The company's own view of the paid data-migration service.
//
//   GET   the company's migration requests, newest first
//   POST  start a new one ("we have data to bring over")
//
// Gated the same way as the sidebar row that links here (SETTINGS_ROW_CAPABILITY
// "app.settings.migration": "billing") — isBillingAdmin, because accepting this
// screen's later steps commits the company's card. A support/impersonation
// session reads it too (non-negotiable #3: view everything), same as every
// other billing-shaped screen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function requireBillingAdmin(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return {
      response: bad(
        "Only an owner or admin can request or manage a data migration.",
        403,
      ),
    };
  }
  return { member };
}

export async function GET(request) {
  const { member, response } = await requireBillingAdmin(request);
  if (response) return response;

  const rows = await db.migrationRequest.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({ requests: rows });
}

export async function POST(request) {
  const { member, response } = await requireBillingAdmin(request);
  if (response) return response;
  // A read-only support session must not be able to start a new migration
  // request on the company's behalf — same rule assertReadOnly enforces for
  // every other write, restated here because this route is reached before
  // that check would otherwise matter (impersonation waves the GET above
  // through on purpose, but never a POST).
  if (member.impersonation) {
    return bad(
      "You're viewing this account read-only. Support access can't start a migration request — ask the company to do it themselves.",
      403,
    );
  }

  const body = await request.json().catch(() => ({}));
  const sourceSystems = String(body?.sourceSystems || "").trim().slice(0, 500);
  const description = String(body?.description || "").trim().slice(0, 4000);

  if (!sourceSystems && !description) {
    return bad("Tell us a bit about what you're bringing over — even one line helps.");
  }

  // One OPEN request at a time. A second "requested" while the first is
  // still being worked would just be two conversations about the same thing —
  // the company can always ask for more once the current one is quoted,
  // declined or completed.
  const openStatuses = ["requested", "scheduled", "quoted", "accepted", "paid", "in_progress"];
  const existingOpen = await db.migrationRequest.findFirst({
    where: { companyId: member.companyId, status: { in: openStatuses } },
    select: { id: true },
  });
  if (existingOpen) {
    return bad(
      "You already have a migration request in progress. Open it below to see its status.",
      409,
    );
  }

  const created = await db.migrationRequest.create({
    data: {
      companyId: member.companyId,
      sourceSystems: sourceSystems || null,
      description: description || null,
      requestedById: member.userId || null,
    },
  });

  return NextResponse.json({ request: created }, { status: 201 });
}
