// lib/equipment/create.js
//
// Adding a piece of equipment to a client's record — from the client page, or
// from the job it was installed on.
//
// Extracted from POST /api/clients/[id]/equipment the moment a second caller
// appeared (POST /api/jobs/[id]/equipment, the "Record what we installed"
// form). The two doors write the same row and log the same activity, and two
// copies of "a blank warranty date is null, never today" is the copy that
// rots (AGENTS.md failure class #4). Permission checks stay in the routes:
// both call requireEquipmentWrite, but the job route also has to prove the
// job is one the caller may see, and a helper that quietly enforced one set
// would be the wrong kind of shared.

import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { recordActivity } from "@/lib/activity/log";
import { EQUIPMENT_SELECT, decorateEquipment, parseEquipmentBody } from "./payload";

/**
 * @param {object} args
 * @param {object} args.db
 * @param {object} args.NextResponse  handed in so the tenant refusal keeps the
 *                                    route's own response shape
 * @param {object} args.member        from memberOrRefusal — companyId comes
 *                                    from here, never from the body
 * @param {{id:string,name:string}} args.client  already proved to be the
 *                                    company's by the caller
 * @param {object} args.body          the request body
 * @param {object} [args.fixed]       columns the CALLER decides and the body
 *                                    may not override — the job route pins
 *                                    installedByJobId to the job in the URL
 * @returns {{ created, response: null }} or {{ created: null, response }}
 */
export async function createClientEquipment({ db, NextResponse, member, client, body, fixed = {} }) {
  const parsed = parseEquipmentBody(body, { creating: true });
  if (parsed.error) {
    return { created: null, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
  }

  const data = { ...parsed.data, ...fixed };

  // The job that installed it has to be ours. Proved through the shared table
  // as `jobId` — same model, same rule, since the column holds a Job id.
  const installedByJobId = data.installedByJobId || null;
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    jobId: installedByJobId,
  });
  if (badLink) return { created: null, response: badLink };

  const created = await db.clientEquipment.create({
    data: {
      companyId: member.companyId,
      clientId: client.id,
      ...data,
      installedByJobId,
    },
    select: EQUIPMENT_SELECT,
  });

  await recordActivity(member, {
    action: "client.equipment_added",
    entityType: "client",
    entityId: client.id,
    summary: `Added equipment ${created.name} for ${client.name}`,
    metadata: {
      equipmentId: created.id,
      installedByJobId,
      // Logged as a boolean, not a date: what the trail needs to record is
      // whether anybody stated a warranty at all, since that is the fact
      // deciding whether this row is ever worth a phone call.
      warrantyRecorded: created.warrantyEndsAt !== null,
    },
  });

  return { created: decorateEquipment(created, new Date()), response: null };
}
