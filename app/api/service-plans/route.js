// app/api/service-plans/route.js
//
// List and create service plans — recurring work sold as a package.
//
// Creating one is a money act: it commits a client to a series of invoices, and
// (on the automatic tier) is the thing an authorisation will be taken against.
// So it needs invoice edit rights AND the `payments` toggle, the same pair the
// rest of the payment-collection surface requires.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { validatePlanInput } from "@/lib/servicePlans/validate";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { summarisePlan } from "@/lib/servicePlans/summary";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_only", "see service plans");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const plans = await db.servicePlan.findMany({
    where: { companyId: member.companyId },
    include: {
      client: { select: { id: true, name: true, email: true, language: true } },
      authorisation: true,
      occurrences: { orderBy: { seq: "asc" } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  // summarisePlan strips the authorisation's Stripe ids and returns the state
  // as a NAMED reason, so no screen has to reassemble "is there a mandate" from
  // nullable columns of its own.
  return NextResponse.json(plans.map(summarisePlan));
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "create a service plan");
    requireToggle(full, "payments", "set up recurring payments");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));

  const client = await db.client.findFirst({
    where: { id: String(body?.clientId || ""), companyId: member.companyId },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, defaultLanguage: true },
  });

  // Fixed at creation, exactly like Quote.language. Everything the client is
  // later shown about this plan — the authorisation terms they tick, the
  // invoices it raises — is written in it.
  const language = resolveClientLanguage({ client, company });

  const result = validatePlanInput({ ...body, clientId: client.id }, { language });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const plan = await db.servicePlan.create({
    data: {
      ...result.plan,
      companyId: member.companyId,
      createdById: member.userId || null,
    },
    include: {
      client: { select: { id: true, name: true, email: true, language: true } },
      authorisation: true,
      occurrences: true,
    },
  });

  return NextResponse.json(summarisePlan(plan), { status: 201 });
}
