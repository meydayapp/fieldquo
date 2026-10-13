// app/api/tenders/route.js
//
// The company's tenders: every solicitation it is watching or bidding on,
// with the win/loss card computed over all of them.
//
// GET   list + summary + what this member may do (quotes ≥ view_only)
// POST  create one (quotes ≥ view_create_edit)
//
// The whole prefix sits behind the `tenders` feature (lib/features/
// registry.js, hidden by default): memberOrRefusal answers 404 for a company
// that does not have it, the same answer an unknown path gives. Permissions
// are lib/tenders/access.js — read it for why each rung.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { assertOwnedIds } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { requireTenderRead, requireTenderWrite, tenderCapabilities } from "@/lib/tenders/access";
import { parseTenderBody, finaliseTenderWrite } from "@/lib/tenders/payload";
import { hydrateTenders, TENDER_SELECT } from "@/lib/tenders/load";
import { winLossSummary } from "@/lib/tenders/summary";
import { companyTimeZone } from "@/lib/tenders/time";
import { gateMember, companyZone } from "@/lib/tenders/server";

const LIST_CAP = 1000;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderRead);
  if (gate.response) return gate.response;
  const { full } = gate;

  const rows = await db.tender.findMany({
    where: { companyId: member.companyId },
    select: TENDER_SELECT,
    orderBy: { closingAt: "desc" },
    take: LIST_CAP,
  });
  const tenders = await hydrateTenders(db, member.companyId, rows, full);
  const capabilities = tenderCapabilities(full);
  return NextResponse.json({
    tenders,
    summary: winLossSummary(tenders, { canSeeMoney: capabilities.canSeeMoney }),
    capabilities,
    companyTimeZone: companyTimeZone(await companyZone(db, member.companyId)),
    truncated: rows.length === LIST_CAP,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderWrite);
  if (gate.response) return gate.response;
  const { full } = gate;
  const capabilities = tenderCapabilities(full);

  const body = await request.json().catch(() => null);
  const parsed = parseTenderBody(body, {
    creating: true,
    canSeeContacts: capabilities.canSeeContacts,
    canSeeMoney: capabilities.canSeeMoney,
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  // The buyer must be OUR client. Proved, never trusted from the form.
  const owned = await assertOwnedIds(db, member.companyId, { clientId: parsed.data.clientId });
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const final = finaliseTenderWrite(null, parsed.data, {
    defaultTimeZone: companyTimeZone(await companyZone(db, member.companyId)),
  });
  if (!final.ok) return NextResponse.json({ error: final.error }, { status: final.status });

  const created = await db.tender.create({
    data: { ...final.data, companyId: member.companyId, createdById: member.userId || null },
    select: TENDER_SELECT,
  });

  await recordActivity(member, {
    action: "tender.created",
    entityType: "tender",
    entityId: created.id,
    summary: `Added tender ${created.solicitationNumber ? `${created.solicitationNumber} ` : ""}${created.title}`,
    metadata: { tenderId: created.id, clientId: created.clientId },
  });

  const [tender] = await hydrateTenders(db, member.companyId, [created], full);
  return NextResponse.json({ tender, capabilities }, { status: 201 });
}
