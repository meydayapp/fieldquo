// app/api/marketing/campaigns/[id]/stops/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { nearestNeighborOrder } from "@/lib/marketing/routeOrder";

async function loadOwned(companyId, id) {
  const campaign = await db.marketingCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.companyId !== companyId) return null;
  return campaign;
}

// Re-derive sortOrder for every stop in a campaign using nearest-neighbor from
// the company's own location, then persist. Called after any add so the route
// stays coherent. Kept here (not in the helper) because it's the DB-writing
// half — the helper is pure ordering.
async function reorderCampaign(companyId, campaignId) {
  const [company, stops] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { latitude: true, longitude: true },
    }),
    db.pamphletStop.findMany({ where: { campaignId } }),
  ]);

  const start =
    company?.latitude != null && company?.longitude != null
      ? { lat: Number(company.latitude), lng: Number(company.longitude) }
      : undefined;

  const ordered = nearestNeighborOrder(stops, start);

  await db.$transaction(
    ordered.map((s, i) =>
      db.pamphletStop.update({
        where: { id: s.id },
        data: { sortOrder: i },
      }),
    ),
  );
}

// Add one or more stops. Accepts either a single { address, latitude,
// longitude } or { stops: [...] } for bulk paste. Coordinates are optional —
// a stop without them still lists, it just sorts to the end of the route.
export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const campaign = await loadOwned(member.companyId, params.id);
  if (!campaign)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const incoming = Array.isArray(body.stops)
    ? body.stops
    : body.address
      ? [body]
      : [];

  const clean = incoming
    .filter((s) => s.address?.trim())
    .map((s) => ({
      campaignId: params.id,
      address: s.address.trim(),
      latitude: s.latitude != null ? Number(s.latitude) : null,
      longitude: s.longitude != null ? Number(s.longitude) : null,
    }));

  if (clean.length === 0) {
    return NextResponse.json(
      { error: "At least one address is required" },
      { status: 400 },
    );
  }

  await db.pamphletStop.createMany({ data: clean });
  await reorderCampaign(member.companyId, params.id);

  const stops = await db.pamphletStop.findMany({
    where: { campaignId: params.id },
    orderBy: { sortOrder: "asc" },
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(stops, { status: 201 });
}
