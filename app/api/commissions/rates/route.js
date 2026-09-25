// app/api/commissions/rates/route.js
//
// Team › Commission rates: each member's worked-by and sold-by percentage.
//
// GET   payroll view_all sees everyone's rate; anyone else sees their own
//       (a rate is pay — lib/commissions/access.js).
// PATCH payroll view_all only — the same gate as setting a labour rate
//       (lib/permissions/inviteGuard.js#canSetPay). One member per request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { commissionAccess } from "@/lib/commissions/access";
import { parseRateInput, pctOrNull } from "@/lib/commissions/compute";
import { recordActivity } from "@/lib/activity/log";

const row = (m) => ({
  memberId: m.id,
  name: m.user?.name || m.user?.email || null,
  active: m.active,
  workedByPct: pctOrNull(m.workedByPct),
  soldByPct: pctOrNull(m.soldByPct),
});

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const access = commissionAccess(full);
  const members = await db.member.findMany({
    where: {
      companyId: member.companyId,
      // Everyone's rates only for someone who may set them; the rest see
      // their own row and nothing else — not a list with the numbers blanked.
      ...(access.canEdit ? {} : { id: member.id }),
    },
    select: {
      id: true,
      active: true,
      workedByPct: true,
      soldByPct: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ rates: members.map(row), canEdit: access.canEdit });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  if (!commissionAccess(full).canEdit) {
    return NextResponse.json(
      { error: "You don't have permission to set commission rates." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const target = await db.member.findFirst({
    where: { id: String(body.memberId || ""), companyId: member.companyId },
    select: { id: true, workedByPct: true, soldByPct: true, user: { select: { name: true, email: true } } },
  });
  if (!target) return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });

  const data = {};
  for (const field of ["workedByPct", "soldByPct"]) {
    if (body[field] === undefined) continue;
    const parsed = parseRateInput(body[field]);
    if (!parsed.ok) {
      return NextResponse.json({ error: "A commission rate must be between 0 and 100%." }, { status: 400 });
    }
    data[field] = parsed.value;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.member.update({
    where: { id: target.id },
    data,
    select: { id: true, active: true, workedByPct: true, soldByPct: true, user: { select: { name: true, email: true } } },
  });

  const name = target.user?.name || target.user?.email || "a team member";
  const fmt = (v) => (v == null ? "none" : `${Number(v)}%`);
  await recordActivity(member, {
    action: "commissions.rate_changed",
    entityType: "member",
    entityId: target.id,
    summary: Object.keys(data)
      .map((f) => `${f === "soldByPct" ? "Sold-by" : "Worked-by"} commission for ${name}: ${fmt(target[f])} → ${fmt(data[f])}`)
      .join("; "),
    metadata: { before: { workedByPct: target.workedByPct, soldByPct: target.soldByPct }, after: data },
  });

  return NextResponse.json(row(updated));
}
