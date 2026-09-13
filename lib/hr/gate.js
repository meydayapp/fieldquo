// lib/hr/gate.js
//
// The two openings of every /api/hr route, as two lines each.
//
//   const { member, response } = await hrManagerOrRefusal(request);   // manager side
//   const { member, worker, response } = await hrSelfOrRefusal(request); // "me" side
//
// Both go through memberOrRefusal (the billing / impersonation / feature
// gates) and then lib/hr/access.js. The "me" side answers 404 with a plain
// sentence when the caller has no Worker row — an office admin with no crew
// record has no HR file, and the screen says so instead of inventing one.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireHrManage, myWorker } from "@/lib/hr/access";

export const NO_WORKER_MESSAGE = "You don't have a crew record in this company yet, so there is no HR file to show.";

export async function hrManagerOrRefusal(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  try {
    requireHrManage(member);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { response: NextResponse.json(body, { status }) };
  }
  return { member };
}

export async function hrSelfOrRefusal(request, { client = db } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  const worker = await myWorker(client, member);
  if (!worker) return { member, response: NextResponse.json({ error: NO_WORKER_MESSAGE, noWorker: true }, { status: 404 }) };
  return { member, worker };
}
