// app/api/hr/policies/templates/route.js — the starter policies, in the
// language asked for (?lang=fr), for "Start from a template".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { policyTemplates } from "@/lib/hr/policyTemplates";

export async function GET(request) {
  const { response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const lang = new URL(request.url).searchParams.get("lang") || "en";
  return NextResponse.json({ templates: policyTemplates(lang) });
}
