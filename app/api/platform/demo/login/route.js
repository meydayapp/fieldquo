// app/api/platform/demo/login/route.js
//
// POST — give a demo company a real login.
//
// The argument for why this is allowed to create a user when nothing else is,
// and the four guards that keep it narrow, now live beside the code that
// enforces them in lib/demo/demoLogin.js. They moved because
// /api/platform/demo/assign mints a login too — "Assign + create login" in one
// press, which is what /sales/demo has always promised a rep — and two routes
// each re-stating four guards from memory is how one of them ends up weaker.
//
// What stays here is the door: a superadmin, read from the database. The
// helper re-checks the role itself, deliberately, the same way
// lib/currentMember.js re-checks impersonation after middleware already has.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { createDemoLogin } from "@/lib/demo/demoLogin";

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, password } = await request.json().catch(() => ({}));

  try {
    const result = await createDemoLogin({ admin, companyId, password });
    if (!result.ok) {
      const { ok: _ok, status, ...body } = result;
      return NextResponse.json(body, { status });
    }
    return NextResponse.json({ email: result.email, created: true });
  } catch (err) {
    console.error("[platform/demo/login]", err);
    return NextResponse.json(
      { error: err?.message || "Couldn't create that login." },
      { status: 500 },
    );
  }
}
