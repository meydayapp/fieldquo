// app/api/me/home/route.js — the worker's Home. See lib/me/home.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { workerHome } from "@/lib/me/home";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await workerHome(member, new Date()));
}
