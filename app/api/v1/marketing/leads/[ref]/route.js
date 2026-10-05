// app/api/v1/marketing/leads/[ref]/route.js
//
// GET /api/v1/marketing/leads/{ref} — one lead's privacy-safe row, by its
// full reference (lr_…) or an unambiguous display form ("L-7F3A").
// Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { getLead } from "@/lib/agency/api";

export async function GET(request, { params }) {
  const { ref } = await params;
  return agencyResponse(request, SCOPE_READ, (ctx) => getLead({ ...ctx, ref }));
}
