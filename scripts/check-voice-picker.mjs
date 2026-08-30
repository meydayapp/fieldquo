// scripts/check-voice-picker.mjs
//
// Which voice answers the phone, and why the list is fetched rather than typed.
//
// ══ The half-control ═══════════════════════════════════════════════════════
//
// `VoiceAgent.voice` has been READ by voiceFor() since the receptionist
// shipped, and written by nothing. Every contractor got 11labs-Adrian — or
// 11labs-Marissa in French — and no screen offered a choice. Failure class 1 in
// AGENTS.md, pointing the other way from the usual one: a field read and never
// written is as dead as a field written and never read.
//
// ══ Why the catalogue is not in this file ══════════════════════════════════
//
// `voice_id` is REQUIRED by /create-agent and an unknown one fails the whole
// push — the company does not get a worse voice, their receptionist is left
// unprovisioned. A curated list in code is therefore a list that silently
// breaks somebody's phone the day a voice is retired or a name is mistyped. So
// the options come from the provider's own /list-voices and a submitted id is
// only accepted if it is in that answer.
import {
  pickableVoices,
  validateVoiceChoice,
  pickDefaultVoice,
  CURATED_PROVIDERS,
  SHORTLIST,
  VOICE_PROVIDERS,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_ID_FR,
} from "@/lib/voice/voices";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// The three shortlisted voices as the provider returns them. Everything else
// the provider offers has its own case in section 6.
//
// Names, not ids, on purpose — an id typed here would be a list in code, which
// is the thing this file exists to argue against.
const RAW = [
  { voice_id: "cartesia-Andrew", voice_name: "Andrew", provider: "cartesia", gender: "male", accent: "American", preview_audio_url: "https://cdn/x.mp3" },
  { voice_id: "cartesia-Emma", voice_name: "Emma", provider: "cartesia", gender: "female", accent: "French" },
  { voice_id: "cartesia-Alejandro", voice_name: "Alejandro", provider: "cartesia", gender: "male", accent: "Spanish" },
];

section("1. The list is the provider's, reduced to what a picker needs");

{
  const list = pickableVoices(RAW);
  ok(list.length === 3, "every shortlisted voice survives", list.length);
  ok(
    pickableVoices(RAW, { keep: "cartesia-Emma" })[0].id === "cartesia-Emma",
    "the voice answering TODAY sorts first, so nobody hunts for their own",
    pickableVoices(RAW, { keep: "cartesia-Emma" })[0].id,
  );
  ok(
    list[0].name === "Andrew",
    "…and with nothing chosen, the voice for the company's own language leads",
    list[0].name,
  );
  ok(
    pickableVoices(RAW, { language: "es" })[0].name === "Alejandro",
    "…which is a different voice for a Spanish company, not a fixed order",
    pickableVoices(RAW, { language: "es" })[0].name,
  );
  // This assertion read `ok("a preview is carried…")` — the message passed as
  // the condition, so a non-empty string was the test. It passed on every
  // broken build for as long as it existed. Same shape as the eight in
  // check-call-to-client.mjs.
  ok(
    list[0].previewUrl === "https://cdn/x.mp3",
    "a preview is carried — nobody picks a voice from a name",
    list[0].previewUrl,
  );
}

section("2. Rows nobody could choose responsibly are dropped");

{
  const list = pickableVoices([
    ...RAW,
    { voice_id: "no-name", voice_name: "", provider: "cartesia" },
    { voice_id: "", voice_name: "Andrew", provider: "cartesia" },
    { voice_id: "mystery", voice_name: "Andrew", provider: "some_new_vendor" },
    { voice_id: "cartesia-Andrew", voice_name: "Andrew", provider: "cartesia" },
  ]);
  ok(list.length === 3, "blank names, blank ids, unknown providers and duplicates all dropped", list.map((v) => v.id));
  ok(!list.some((v) => v.id === "mystery"), "…an option we cannot describe is not an option");
  // The exact confusion that prompted the shortlist: two voices called Willa,
  // from different vendors, sounding nothing like each other.
  const willas = pickableVoices([
    ...RAW,
    { voice_id: "retell-Willa", voice_name: "Willa", provider: "platform" },
    { voice_id: "fish-Willa", voice_name: "Willa", provider: "fish_audio" },
  ]);
  ok(
    !willas.some((v) => v.name === "Willa"),
    "two different vendors' Willa are not both offered — a choice nobody could describe afterwards",
    willas.map((v) => v.name),
  );
}
{
  const list = pickableVoices([
    { voice_id: "x", voice_name: "Andrew", provider: "cartesia", preview_audio_url: "javascript:alert(1)" },
    { voice_id: "y", voice_name: "Emma", provider: "cartesia", preview_audio_url: "http://cdn/insecure.mp3" },
  ]);
  ok(
    list.every((v) => v.previewUrl === null),
    "a preview URL that is not https is refused — it is fetched by the browser",
    list.map((v) => v.previewUrl),
  );
}

section("3. Nothing may be saved that the provider does not know");

{
  const list = pickableVoices(RAW);
  ok(validateVoiceChoice("cartesia-Andrew", list).voice === "cartesia-Andrew", "a real id is accepted");
  ok(validateVoiceChoice("made-up", list).ok === false, "an invented id is REFUSED, not stored");
  ok(
    validateVoiceChoice("", list).ok === true && validateVoiceChoice("", list).voice === null,
    "clearing is a real answer — it falls back to the language default",
  );
  ok(validateVoiceChoice(null, list).voice === null, "and so is null");
  // The case that matters when the provider is down: we cannot tell a real id
  // from a typo, and guessing wrong costs them their phone.
  ok(
    validateVoiceChoice("11labs-Adrian", []).ok === false,
    "with no list reachable, SETTING a voice is refused rather than stored unchecked",
  );
  ok(
    validateVoiceChoice("", []).ok === true,
    "…while clearing still works, because the default needs no validation",
  );
}

section("4. The trade-off the screen is allowed to state");

{
  ok(
    VOICE_PROVIDERS.platform.automaticFailover === true &&
      VOICE_PROVIDERS.elevenlabs.automaticFailover === false,
    "platform voices fail over automatically and ElevenLabs voices do not — Retell's own documented difference",
  );
  ok(
    pickableVoices([{ voice_id: "retell-X", voice_name: "X", provider: "platform" }], {
      keep: "retell-X",
    })[0]?.automaticFailover === true,
    "…and it reaches the picker, so the choice can be made knowingly",
  );
  // Money is FieldQuo's cost, not the contractor's. It informs which option is
  // marked as the safer default; it must never appear on their screen.
  ok(
    pickableVoices(RAW).every((v) => !("costCentsPerMinute" in v)),
    "the per-minute cost does NOT travel to the client — it is our cost, not theirs",
  );
}

section("5. Hostile and empty input");

{
  ok(pickableVoices().length === 0, "no argument does not throw");
  ok(pickableVoices(null).length === 0, "null does not throw");
  ok(pickableVoices([null, {}, 7, "x"]).length === 0, "junk rows contribute nothing");
  ok(
    pickableVoices([{ voice_id: "a", voice_name: "Andrew", provider: "cartesia", gender: "alien" }])[0].gender === null,
    "an unrecognised gender is absent rather than passed through",
  );
}

section("6. Three voices, and the default is resolved rather than typed");

// Everything the provider actually returns, shortlist and catalogue together.
const WIDE = [
  ...RAW,
  { voice_id: "11labs-Adrian", voice_name: "Adrian", provider: "elevenlabs", gender: "male" },
  { voice_id: "cartesia-Victory", voice_name: "Victory", provider: "cartesia", gender: "female" },
  { voice_id: "retell-Willa", voice_name: "Willa", provider: "platform", gender: "female" },
  { voice_id: "fish-Willa", voice_name: "Willa", provider: "fish_audio", gender: "female" },
  { voice_id: "minimax-Bot", voice_name: "Bot", provider: "minimax", gender: "male" },
  { voice_id: "openai-Alloy", voice_name: "Alloy", provider: "openai", gender: "female" },
];

{
  const shown = pickableVoices(WIDE);
  // The complaint that produced this: "there are like 30 different voices the
  // company can pick". Narrowing to three PROVIDERS did not narrow the screen,
  // because one provider ships twenty voices on its own.
  ok(shown.length === SHORTLIST.length, "the picker offers the shortlist and nothing else", shown.map((v) => v.name));
  ok(
    shown.every((v) => v.provider === "cartesia"),
    "…all Cartesia: 'stronger spelling accuracy than ElevenLabs', on a job that spells emails aloud",
    [...new Set(shown.map((v) => v.provider))],
  );
  ok(
    !shown.some((v) => v.name === "Victory"),
    "a curated PROVIDER is not a curated list — its other voices stay off the screen",
  );
  ok(!shown.some((v) => v.name === "Willa"), "…and neither Willa is offered");
  // Mutation testing found the Willa case above proves less than it looks:
  // matching on NAME alone still drops both, because neither is called Andrew.
  // The provider half of the match only earns its keep when another vendor
  // ships the same name — which is exactly how two Willas got on screen. An
  // ElevenLabs "Andrew" is a different voice at 2.7x the price.
  ok(
    !pickableVoices([
      ...WIDE,
      { voice_id: "11labs-Andrew", voice_name: "Andrew", provider: "elevenlabs", gender: "male" },
    ]).some((v) => v.id === "11labs-Andrew"),
    "another vendor's voice of the same name is NOT the shortlisted one",
  );
  ok(!shown.some((v) => v.provider === "elevenlabs"), "…nor the one that costs 2.7x and spells worse");
  ok(!shown.some((v) => v.provider === "minimax"), "…nor the one Retell documents as robotic");

  // A company already ON something else must still see what answers their
  // phone. Two separate failures otherwise: a picker with nothing selected,
  // and — because the save route validates against this same list — a refusal
  // of their own voice on a save where they only edited the greeting.
  const kept = pickableVoices(WIDE, { keep: "11labs-Adrian" });
  ok(
    kept.some((v) => v.id === "11labs-Adrian"),
    "a company already on a de-curated voice still sees it",
  );
  ok(kept[0].id === "11labs-Adrian", "…and it sorts first, because it is the one selected", kept[0].id);
  ok(
    validateVoiceChoice("11labs-Adrian", kept).ok === true,
    "…and saving without touching it is not refused as 'not one the provider offers'",
  );
  ok(
    !kept.some((v) => v.id === "minimax-Bot"),
    "…while keeping theirs does not re-admit everything else",
  );
  ok(
    validateVoiceChoice("cartesia-Victory", pickableVoices(WIDE)).ok === false,
    "a voice the provider HAS but we do not offer cannot be set through the API either",
  );
}

{
  const list = pickableVoices(WIDE);
  ok(
    pickDefaultVoice(list, { language: "en", fallback: "11labs-Adrian" }) === "cartesia-Andrew",
    "an English company gets Andrew",
    pickDefaultVoice(list, { language: "en", fallback: "11labs-Adrian" }),
  );
  ok(
    pickDefaultVoice(list, { language: "fr", fallback: "11labs-Marissa" }) === "cartesia-Emma",
    "a French company gets Emma",
    pickDefaultVoice(list, { language: "fr" }),
  );
  ok(
    pickDefaultVoice(list, { language: "es" }) === "cartesia-Alejandro",
    "a Spanish company gets Alejandro",
    pickDefaultVoice(list, { language: "es" }),
  );
  // The bug caught in review before the shortlist existed: preferring French
  // for fr while taking whatever sorted first for en handed an English business
  // a French accent, because "Chloé" came before "Sam".
  ok(
    pickDefaultVoice(list, { language: "en" }) !== "cartesia-Emma",
    "…and an English company does NOT get the French one just because it sorts first",
  );
  // uk, pa and tl reach the phone as en-US — see lib/voice/agentLanguage.js.
  // The default must match the language the agent is actually provisioned in,
  // not an accent picked by sort order.
  ok(
    pickDefaultVoice(list, { language: "pa" }) === "cartesia-Andrew",
    "a language the receptionist cannot speak yet falls to English, which is what its agent is set to",
    pickDefaultVoice(list, { language: "pa" }),
  );
  ok(
    pickDefaultVoice(pickableVoices([WIDE[1]]), { language: "en" }) === "cartesia-Emma",
    "with the English voice retired it offers what is left rather than nothing",
  );
  ok(
    pickDefaultVoice([], { fallback: "11labs-Adrian" }) === "11labs-Adrian",
    "and an unreachable provider keeps the id we already ship — a working agent on a pricier voice beats no agent",
  );
  ok(
    pickDefaultVoice([], {}) === null,
    "…with no fallback offered, it says so rather than inventing an id that would fail create-agent",
  );
  ok(
    CURATED_PROVIDERS.includes("cartesia"),
    "the provider table still backs the shortlist, so the screen can state the failover trade-off",
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
