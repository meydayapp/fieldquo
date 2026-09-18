// app/api/appointments/about/route.js
//
// What the "New appointment" dialog offers to link an appointment to.
//
//   GET ?clientId=…        the client's open quotes, jobs and unpaid invoices,
//                          plus which one the stage says to suggest first
//   GET ?q=…               any quote, job or invoice in the company matching
//                          a number, a title or a client's name
//
// Both may be given. Company-scoped like everything under /api/appointments;
// the caller needs the same permission the create route asks for, because
// this exists only to fill that form. See lib/schedule/appointmentAbout.js
// for why the stage picks the suggestion.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { loadEnforceableMember, assignedJobWhere } from "@/lib/permissions/enforce";
import { loadOpenRecords, searchRecords } from "@/lib/schedule/aboutRecord";
import { suggestAbout } from "@/lib/schedule/appointmentAbout";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "appointment:create");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = String(searchParams.get("clientId") || "").trim();
  const q = String(searchParams.get("q") || "").trim();

  const full = await loadEnforceableMember(db, member.id);
  const jobWhere = assignedJobWhere(full);

  // A client id from another company matches no rows here — `companyId` is
  // on every where in loadOpenRecords — so the answer is honestly empty
  // rather than a 404 that would tell a caller the id exists somewhere.
  const open = clientId
    ? await loadOpenRecords(db, member.companyId, clientId, { jobWhere })
    : { quotes: [], jobs: [], invoices: [] };
  const search = q
    ? await searchRecords(db, member.companyId, q, { jobWhere })
    : { quotes: [], jobs: [], invoices: [] };

  return NextResponse.json({
    suggested: suggestAbout(open),
    open,
    search,
  });
}
