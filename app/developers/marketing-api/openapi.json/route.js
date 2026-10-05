// app/developers/marketing-api/openapi.json/route.js
//
// GET /developers/marketing-api/openapi.json — the marketing-agency API's
// OpenAPI 3.1 description, built from the code it describes
// (lib/agency/openapi.js). Public: it describes the API and holds no data.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/agency/openapi";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  return NextResponse.json(buildOpenApi({ baseUrl: getAppOrigin(request) }), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
