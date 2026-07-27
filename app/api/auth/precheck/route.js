// app/api/auth/precheck/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cleanupOrphanedUser } from "@/lib/auth-cleanup";

export async function POST(request) {
  const { email } = await request.json();
  if (!email)
    return NextResponse.json({ error: "email required" }, { status: 400 });

  const cleaned = await cleanupOrphanedUser(email);
  return NextResponse.json({ cleaned });
}
