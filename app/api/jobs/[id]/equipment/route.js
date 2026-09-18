// app/api/jobs/[id]/equipment/route.js
//
// The CLIENT's equipment at the address this job is at — the furnace, the
// unit, the panel — and the door for recording what this job installed.
//
// GET  → the job's client's ClientEquipment rows, split into "at this site"
//        and "elsewhere for this client", each carrying its computed warranty
//        state; plus whether the caller may write, and (for a warranty
//        callback) which row the job is about.
// POST → create a ClientEquipment row installed BY this job — the same write
//        as POST /api/clients/[id]/equipment with installedByJobId pinned to
//        the job in the URL, through lib/equipment/create.js.
//
// ── Not the asset-use route next door ──────────────────────────────────────
//
// app/api/jobs/[id]/asset-use is the COMPANY's kit on this job, for costing.
// This is the CUSTOMER's kit, for the warranty. Different tables, different
// gates: that one is "jobs at view_only" because ticking "the compressor came
// along" is a job fact; this one is lib/equipment/access.js's
// clientsProperties gate, because a client's installed base is client data
// and the crew preset sits at name_address_only. A crew member gets a 403
// here and the panel draws nothing — never an empty list that reads as "this
// house has no furnace".
//
// Both gates apply on top of each other: the job has to be one the caller may
// see (assignedJobWhere), AND the caller has to be allowed to read client
// equipment. A crew member assigned to the job still fails the second.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import {
  requireEquipmentRead,
  requireEquipmentWrite,
  canWriteEquipment,
} from "@/lib/equipment/access";
import { EQUIPMENT_SELECT, decorateEquipment } from "@/lib/equipment/payload";
import { createClientEquipment } from "@/lib/equipment/create";
import {
  partitionBySite,
  canLinkWarrantyEquipment,
} from "@/lib/equipment/installed";

const JOB_SELECT = {
  id: true,
  clientId: true,
  siteAddress: true,
  completedAt: true,
  endDate: true,
  callbackReason: true,
  warrantyEquipmentId: true,
  client: { select: { id: true, name: true } },
};

async function loadScopedJob(id, member, full) {
  return db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: JOB_SELECT,
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await loadScopedJob(id, member, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.clientEquipment.findMany({
    where: { companyId: member.companyId, clientId: job.clientId },
    select: EQUIPMENT_SELECT,
    orderBy: [{ createdAt: "desc" }],
  });

  const asOf = new Date();
  const decorated = rows.map((row) => decorateEquipment(row, asOf));
  const { here, elsewhere } = partitionBySite(decorated, job.siteAddress);

  return NextResponse.json({
    clientId: job.clientId,
    clientName: job.client?.name || null,
    siteAddress: job.siteAddress || null,
    here,
    elsewhere,
    canWrite: canWriteEquipment(full),
    // Only a warranty callback may point at a row — see
    // lib/equipment/installed.js. Sent so the panel offers the picker exactly
    // when PATCH /api/jobs/[id] would accept it.
    canLinkWarranty: canLinkWarrantyEquipment(job),
    warrantyEquipmentId: job.warrantyEquipmentId || null,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await loadScopedJob(id, member, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Pinned by the URL, not the body: this door exists to say "THIS job put it
  // in", and a body naming another job would make the panel it was submitted
  // from disagree with the row it created.
  const fixed = { installedByJobId: job.id };
  // The site is the job's, unless the form named a different spot. A blank
  // stays blank when the job has no site address either — that is "the
  // client's main address", and inventing one here is inventing one.
  if (!body?.siteAddress && job.siteAddress) fixed.siteAddress = job.siteAddress;

  const { created, response: refusal } = await createClientEquipment({
    db,
    NextResponse,
    member,
    client: { id: job.clientId, name: job.client?.name || "" },
    body,
    fixed,
  });
  if (refusal) return refusal;

  return NextResponse.json(created, { status: 201 });
}
