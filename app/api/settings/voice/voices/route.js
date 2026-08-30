// app/api/settings/voice/voices/route.js
//
// The voices a company may choose from, live from the provider.
//
// ── Its own endpoint, not part of the settings GET ────────────────────────
//
// The settings screen loads on every visit and this list changes about never,
// so folding it into that GET would add a provider round trip to every page
// load to answer a question almost nobody is asking. The picker fetches it when
// it opens.
//
// ── And never a hardcoded list ────────────────────────────────────────────
//
// `voice_id` is required by /create-agent and an invalid one fails the entire
// push — the agent is not given a worse voice, it is left unprovisioned. A list
// typed from memory breaks somebody's receptionist the day a voice is retired.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { voiceConfigured, listVoices } from "@/lib/voice/retell";
import { pickableVoices, DEFAULT_VOICE_ID, DEFAULT_VOICE_ID_FR } from "@/lib/voice/voices";

export async function GET(request) {
  // memberOrRefusalPlain returns a PLAIN object, not a Response — the "plain"
  // in its name. Returning it straight hands Next something it cannot send,
  // which is a 500 where a clean 401 belongs. The sibling GET on
  // /api/settings/voice wraps it the same way.
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) {
    return NextResponse.json(
      { error: refusal.error || "Unauthorized" },
      { status: refusal.status || 401 },
    );
  }
  // Same gate as the screen this feeds — changing how the business answers its
  // phone is an owner's decision, and a list of options is only useful to
  // somebody allowed to pick one.
  // Non-negotiable #3: the platform console views everything and edits nothing.
  // A support session holds no coarse permission, so requirePermission denies
  // it — correctly, for a write. This is a READ, and blinding support to the
  // list of voices on the screen a contractor is ringing about helps nobody.
  // There is no write on this route to protect.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only an owner or admin can change the receptionist." },
        { status: 403 },
      );
    }
  }

  if (!voiceConfigured()) {
    // Not an error: it is the normal state of a deployment with no key. An
    // empty list with a reason lets the screen say "we can't reach the
    // provider" rather than "there are no voices", which are different.
    return NextResponse.json({ voices: [], reason: "not_configured" });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { defaultLanguage: true },
  });
  const language = company?.defaultLanguage === "fr" ? "fr" : "en";

  let raw = null;
  try {
    raw = await listVoices();
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) {
    return NextResponse.json({ voices: [], reason: "unavailable" });
  }

  return NextResponse.json({
    voices: pickableVoices(raw, { language }),
    // What answers the phone when nothing is chosen, so the screen can label it
    // rather than showing a blank select and leaving the reader to guess.
    defaultVoiceId: language === "fr" ? DEFAULT_VOICE_ID_FR : DEFAULT_VOICE_ID,
  });
}
