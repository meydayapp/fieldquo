// app/api/settings/client-po-format/route.js
//
// The shape of the reference the client-PO "Generate" button suggests —
// Company.clientPoPrefix / clientPoIncludeYear / clientPoDigits
// (lib/documents/clientPo.js). Settings → Company, beside the payment
// schedule.
//
//   GET    the format (defaults when never set) and what the next reference
//          would be, so the settings card can preview the real next value
//   PATCH  { prefix?, includeYear?, digits? } — owners/admins, as the payment
//          schedule beside it
//
// Saving never touches a reference already on a document: the sequence is
// re-counted among values of the new shape the next time Generate is pressed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { allocateGeneratedClientPo, readClientPoFormat, validateClientPoFormat } from "@/lib/documents/clientPo";

const SELECT = { clientPoPrefix: true, clientPoIncludeYear: true, clientPoDigits: true };

async function answer(companyId) {
  const row = await db.company.findUnique({ where: { id: companyId }, select: SELECT });
  const format = readClientPoFormat(row);
  const next = await allocateGeneratedClientPo(db, { companyId, format });
  return { format, next };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await answer(member.companyId));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can change the PO reference format." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send the prefix, whether to include the year, and the digit count." }, { status: 400 });
  }
  const current = await db.company.findUnique({ where: { id: member.companyId }, select: SELECT });
  const verdict = validateClientPoFormat(body, readClientPoFormat(current));
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

  const { prefix, includeYear, digits } = verdict.format;
  await db.company.update({
    where: { id: member.companyId },
    data: { clientPoPrefix: prefix, clientPoIncludeYear: includeYear, clientPoDigits: digits },
  });
  await recordActivity(member, {
    action: "settings.client_po_format",
    entityType: "company",
    entityId: member.companyId,
    summary: `Changed the PO reference format to "${prefix}${includeYear ? "<year>-" : ""}${"0".repeat(digits)}"`,
    metadata: { prefix, includeYear, digits },
  });
  return NextResponse.json(await answer(member.companyId));
}
