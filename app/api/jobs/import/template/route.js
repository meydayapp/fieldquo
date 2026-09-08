// app/api/jobs/import/template/route.js
//
// GET — the CSV template for past jobs: the header row and one example row,
// built from the same PAST_JOB_COLUMNS the parser reads, so the file a
// company downloads and the file the importer accepts cannot drift apart.
//
// Gated like the import itself: the template names nothing sensitive, but a
// member who cannot enter a past job has no use for it, and a public file
// would be a public description of a private screen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { pastJobsCsvTemplate } from "@/lib/jobs/pastJobImport";
import { pastJobsGate } from "@/lib/jobs/pastJobsGate";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await pastJobsGate(member);
  if (denied) return denied;

  return new NextResponse(pastJobsCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="past-jobs-template.csv"',
    },
  });
}
