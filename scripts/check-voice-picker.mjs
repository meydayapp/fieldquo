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

const RAW = [
  { voice_id: "11labs-Adrian", voice_name: "Adrian", provider: "elevenlabs", gender: "male", accent: "British", preview_audio_url: "https://cdn/x.mp3" },
  { voice_id: "retell-Nova", voice_name: "Nova", provider: "platform", gender: "female" },
  { voice_id: "cartesia-Sam", voice_name: "Sam", provider: "cartesia", gender: "male" },
];

section("1. The list is the provider's, reduced to what a picker needs");

{
  const list = pickableVoices(RAW);
  ok(list.length === 3, "every usable voice survives", list.length);
  ok(list[0].id === DEFAULT_VOICE_ID, "the one answering today sorts first, so nobody hunts for it", list[0].id);
  // With the French default actually present, it is the one that sorts first —
  // a French company opening this screen sees what is answering their phone,
  // not whatever is alphabetically first.
  const withFr = [
    ...RAW,
    { voice_id: DEFAULT_VOICE_ID_FR, voice_name: "Marissa", provider: "elevenlabs", gender: "female" },
  ];
  ok(
    pickableVoices(withFr, { language: "fr" })[0].id === DEFAULT_VOICE_ID_FR,
    "and in French it is the French default that sorts first",
    pickableVoices(withFr, { language: "fr" })[0].id,
  );
  ok(
    pickableVoices(withFr, { language: "en" })[0].id === DEFAULT_VOICE_ID,
    "…while the same list in English puts the English one there",
  );
  ok(
    list.find((v) => v.id === "11labs-Adrian")?.previewUrl === "https://cdn/x.mp3",
    "a preview is carried — nobody picks a voice from a name",
  );
}

section("2. Rows nobody could choose responsibly are dropped");

{
  const list = pickableVoices([
    ...RAW,
    { voice_id: "no-name", voice_name: "", provider: "platform" },
    { voice_id: "", voice_name: "Nameless", provider: "platform" },
    { voice_id: "mystery", voice_name: "Mystery", provider: "some_new_vendor" },
    { voice_id: "11labs-Adrian", voice_name: "Adrian again", provider: "elevenlabs" },
  ]);
  ok(list.length === 3, "blank names, blank ids, unknown providers and duplicates all dropped", list.map((v) => v.id));
  ok(!list.some((v) => v.id === "mystery"), "…an option we cannot describe is not an option");
}
{
  const list = pickableVoices([
    { voice_id: "x", voice_name: "X", provider: "platform", preview_audio_url: "javascript:alert(1)" },
    { voice_id: "y", voice_name: "Y", provider: "platform", preview_audio_url: "http://cdn/insecure.mp3" },
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
  ok(validateVoiceChoice("cartesia-Sam", list).voice === "cartesia-Sam", "a real id is accepted");
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
    pickableVoices(RAW).find((v) => v.provider === "platform")?.automaticFailover === true,
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
    pickableVoices([{ voice_id: "a", voice_name: "A", provider: "platform", gender: "alien" }])[0].gender === null,
    "an unrecognised gender is absent rather than passed through",
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
