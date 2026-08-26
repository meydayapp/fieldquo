// app/api/leads/assignees/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

// The company's people, for the "assign lead" dropdown. Deliberately lighter
// than /api/settings/members (which is admin-gated and returns roles/seats):
// picking who chases a lead isn't a management action, so any member can read
// the names — just id + name, nothing sensitive.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const members = await db.member.findMany({
    where: { companyId: member.companyId },
    include: { user: { select: { id: true, name: true } } },
  });

  const assignees = members
    .map((m) => m.user)
    .filter((u) => u && u.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(assignees);
}
