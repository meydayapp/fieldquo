// app/api/client-tickets/[id]/convert/route.js
//
// POST — turn a repair / warranty ticket into a job through the existing
// create-job path (lib/jobs/createJob.js), prefilled from the ticket and the
// original job, linked as a callback when there is one. Once per ticket; a
// second press answers with the job it already became. Nothing is priced or
// scheduled — the job arrives "unscheduled", for the office to plan.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ticketMember } from "@/lib/clientTickets/access";
import { convertToJob } from "@/lib/clientTickets/service";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await ticketMember(request, "convert");
  if (response) return response;
  const result = await convertToJob({ member, ticketId: id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ jobId: result.jobId, already: Boolean(result.already) }, { status: result.already ? 200 : 201 });
}
