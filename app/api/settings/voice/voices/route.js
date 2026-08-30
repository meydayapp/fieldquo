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
import {
  pickableVoices,
  pickDefaultVoice,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_ID_FR,
} from "@/lib/voice/voices";

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

  const [company, agent] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { defaultLanguage: true },
    }),
    // What is answering the phone TODAY. The shortlist is three voices, so a
    // company that chose something else before it existed would open a picker
    // with nothing selected, about a phone that is very definitely saying
    // something — and the first save would silently change how their business
    // sounds. pickableVoices takes `keep` for exactly this, and until now
    // nothing passed it.
    db.voiceAgent.findUnique({
      where: { companyId: member.companyId },
      select: { voice: true },
    }),
  ]);
  // Spanish is a language a company can actually be set to, and the shortlist
  // has a voice for it — so this is no longer a French-or-English question.
  const language = ["fr", "es"].includes(company?.defaultLanguage)
    ? company.defaultLanguage
    : "en";

  let raw = null;
  try {
    raw = await listVoices();
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) {
    return NextResponse.json({ voices: [], reason: "unavailable" });
  }

  const voices = pickableVoices(raw, { language, keep: agent?.voice || null });

  return NextResponse.json({
    voices,
    // What answers the phone when nothing is chosen, so the screen can label it
    // rather than showing a blank select and leaving the reader to guess.
    //
    // Resolved from the SAME list the picker shows, and by the same function
    // voiceFor() provisions with, because the screen renders this by looking
    // the id up among those voices: a constant that is no longer in the list
    // came out the other side as the raw string "11labs-Adrian", printed to a
    // contractor as the name of their standard voice.
    defaultVoiceId: pickDefaultVoice(voices, {
      language,
      fallback: language === "fr" ? DEFAULT_VOICE_ID_FR : DEFAULT_VOICE_ID,
    }),
  });
}
