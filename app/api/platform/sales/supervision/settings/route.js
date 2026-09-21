// app/api/platform/sales/supervision/settings/route.js
//
// The one switch that costs money, and the two beside it.
//
//   enabled          every outbound prospect call runs in a per-attempt
//                    conference so a superadmin can listen, whisper, barge
//                    or take it, and the rep can put the prospect on hold.
//                    Twilio bills conference minutes on top of each leg —
//                    lib/sales/calls/supervision.js prints the figures —
//                    which is why this is OFF until the owner flips it.
//   tellRepOnListen  whether a rep's console says a supervisor is
//                    listening or whispering (barge and take are always
//                    said). The owner decides; the default is yes.
//   holdMusicUrl     what the prospect hears on hold. Null is Twilio's own
//                    music, which cannot be broken by a missing file.
//
// Superadmin to write, any platform admin to read (the floor board reads
// it to say why its buttons are absent). Every change is audited.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { normaliseSupervisionSettings } from "@/lib/sales/calls/supervision";
import { loadSupervisionSettings, saveSupervisionSettings } from "@/lib/sales/calls/supervisionStore";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json({ settings: await loadSupervisionSettings(), serverNow: new Date().toISOString() });
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Send { enabled, tellRepOnListen, holdMusicUrl }.");
  for (const key of ["enabled", "tellRepOnListen"]) {
    if (key in body && typeof body[key] !== "boolean") return bad(`${key} must be true or false.`);
  }
  if ("holdMusicUrl" in body && body.holdMusicUrl !== null && typeof body.holdMusicUrl !== "string") {
    return bad("holdMusicUrl must be an https URL or null.");
  }
  if (typeof body.holdMusicUrl === "string" && body.holdMusicUrl.trim() && !normaliseSupervisionSettings(body).holdMusicUrl) {
    // Refused rather than silently dropped to Twilio's default: a URL the
    // owner typed that plays nothing is a control that appears to work.
    return bad("holdMusicUrl must be an https:// URL (or empty for Twilio's own hold music).");
  }

  const before = await loadSupervisionSettings();
  const after = await saveSupervisionSettings({ value: { ...before, ...body } });

  await db.platformAuditLog.create({
    data: { platformAdminId: admin.id, action: "sales_supervision_settings_updated", details: { before, after } },
  });

  return NextResponse.json({ settings: after, serverNow: new Date().toISOString() });
}
