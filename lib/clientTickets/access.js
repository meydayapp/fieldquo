// lib/clientTickets/access.js
//
// Who in the office may read and work client tickets — the Requests dial, the
// same one that decides who sees new enquiries (lib/notifications/catalog.js
// declares the tickets' audience on the same rung, so the people told about a
// ticket are the people these routes answer).
//
//   read      requests: view_only
//   work      requests: view_create_edit  (reply, status, priority, assign)
//   convert   jobs: view_create_edit      (the create-job path's own level)

import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { NextResponse } from "next/server";

const LEVELS = {
  read: ["requests", "view_only", "see client tickets"],
  work: ["requests", "view_create_edit", "answer client tickets"],
  convert: ["jobs", "view_create_edit", "create a job"],
};

/** @returns {{ member } | { response }} */
export async function ticketMember(request, need = "read") {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  try {
    const full = await loadEnforceableMember(db, member.id);
    const [category, level, action] = LEVELS[need] || LEVELS.read;
    requireLevel(full, category, level, action);
    if (need === "convert") requireLevel(full, ...LEVELS.work);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { response: NextResponse.json(body, { status }) };
  }
  return { member };
}
