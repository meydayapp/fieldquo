// app/api/settings/notification-rules/route.js
//
// Company-level alert rules. `NotificationRule` was in the schema and read by
// app/api/cron/large-quote-check, but no route ever created one — so the cron
// looped over an empty set on every run and nobody ever got an alert.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { permissionErrorResponse } from "@/lib/permissions/enforce";

// The types the app actually acts on. Anything outside this list would be
// written to the database and then silently ignored by every cron, which is
// worse than a rejection.
export const RULE_TYPES = {
  large_quote: {
    label: "Large quote created",
    needsThreshold: true,
    description:
      "Email owners and admins when a quote is created above this amount.",
  },
  // Default ON everywhere it's read (lib/notifications/invoicePaymentNotice.js)
  // — no threshold, because "a client paid" has no dollar figure to gate on.
  // Listed here so the settings screen can offer a way to turn it OFF; a
  // company that never creates this row keeps getting notified, which is the
  // point (see that file's header for why the default has to be ON).
  invoice_paid: {
    label: "Invoice paid",
    needsThreshold: false,
    description: "Email owners and admins when a client pays an invoice.",
  },
};

// Coarse role check on purpose. The granular grid (PERMISSION_CATEGORIES) has
// no "settings" category, and hasLevel() returns true for categories it
// doesn't recognise — so routing this through requireLevel would look like a
// permission check while enforcing nothing at all.
async function requireManage(member) {
  if (!["owner", "admin"].includes(member.role)) {
    const err = new Error("Only owners and admins can change alert settings.");
    err.status = 403;
    throw err;
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const rules = await db.notificationRule.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(rules);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    await requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const { type, threshold, active } = body;

  const meta = RULE_TYPES[type];
  if (!meta) {
    return NextResponse.json(
      { error: `Unknown notification type "${type}".` },
      { status: 400 },
    );
  }

  if (meta.needsThreshold && !(Number(threshold) > 0)) {
    return NextResponse.json(
      { error: "Set an amount above zero for this alert." },
      { status: 400 },
    );
  }

  // One rule per type per company. Without this you can create three
  // large_quote rules and get three identical emails per quote.
  const existing = await db.notificationRule.findFirst({
    where: { companyId: member.companyId, type },
  });

  const data = {
    type,
    threshold: meta.needsThreshold ? Number(threshold) : null,
    active: active !== false,
  };

  const rule = existing
    ? await db.notificationRule.update({ where: { id: existing.id }, data })
    : await db.notificationRule.create({
        data: { ...data, companyId: member.companyId },
      });

  return NextResponse.json(rule, { status: existing ? 200 : 201 });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    await requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id, threshold, active } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.notificationRule.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.notificationRule.update({
    where: { id },
    data: {
      ...(threshold !== undefined && {
        threshold: threshold === null ? null : Number(threshold),
      }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    await requireManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await db.notificationRule.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.notificationRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
