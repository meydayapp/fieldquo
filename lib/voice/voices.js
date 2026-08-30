// lib/voice/voices.js
//
// Which voice answers the phone, and which ones a company may pick from.
//
// ══ Why the list is fetched and not written down ═══════════════════════════
//
// `voice_id` is required by /create-agent, and an invalid one fails the whole
// push — the agent does not get a worse voice, it does not get provisioned. A
// curated list typed from memory is therefore a list that silently breaks
// somebody's receptionist the day a name is wrong or a voice is retired. So the
// picker is populated from the provider's own /list-voices, and a submitted id
// is accepted only if it appears there.
//
// ══ The column existed and nothing wrote it ════════════════════════════════
//
// `VoiceAgent.voice` has been read by voiceFor() since the feature shipped and
// written by nothing — half a control, pointing the other way from the usual
// one. Every contractor got the same default.

/** What answers the phone when a company has not chosen. */
export const DEFAULT_VOICE_ID = "11labs-Adrian";
export const DEFAULT_VOICE_ID_FR = "11labs-Marissa";

/**
 * Providers we offer, and what each one costs and guarantees.
 *
 * Not decoration. Retell's own comparison says its PLATFORM voices get
 * automatic TTS failover while ElevenLabs voices get manual failover only — an
 * ElevenLabs outage takes the agent mute unless a fallback was configured — and
 * platform voices cost 1.5¢/min against 4¢/min. A contractor choosing a voice is
 * choosing both, so the screen can say so.
 *
 * `costCentsPerMinute` is what RETELL charges FieldQuo, not what anybody is
 * charged. It is here so the picker can mark the cheaper option honestly, and
 * it changes no price: see lib/voice/platformEconomics.js.
 */
export const VOICE_PROVIDERS = {
  platform: { label: "Retell", costCentsPerMinute: 1.5, automaticFailover: true },
  elevenlabs: { label: "ElevenLabs", costCentsPerMinute: 4.0, automaticFailover: false },
  cartesia: { label: "Cartesia", costCentsPerMinute: 1.5, automaticFailover: false },
  openai: { label: "OpenAI", costCentsPerMinute: 1.5, automaticFailover: false },
  minimax: { label: "MiniMax", costCentsPerMinute: 1.5, automaticFailover: false },
  fish_audio: { label: "Fish Audio", costCentsPerMinute: 1.5, automaticFailover: false },
};

/** The provider half of a Retell voice id, when it carries one. */
function providerOf(voice) {
  const p = String(voice?.provider || "").toLowerCase();
  return VOICE_PROVIDERS[p] ? p : null;
}

/**
 * The provider's list, reduced to what a picker needs.
 *
 * Anything without an id or a name is dropped rather than rendered as a blank
 * row, and anything whose provider we do not recognise is dropped too — an
 * option that cannot be described is an option nobody can choose responsibly.
 *
 * Pure. Hand it the array, it answers.
 */
export function pickableVoices(raw = [], { language = "en" } = {}) {
  const seen = new Set();
  const out = [];

  for (const v of Array.isArray(raw) ? raw : []) {
    const id = String(v?.voice_id || "").trim();
    const name = String(v?.voice_name || "").trim();
    if (!id || !name || seen.has(id)) continue;
    const provider = providerOf(v);
    if (!provider) continue;
    seen.add(id);
    out.push({
      id,
      name,
      provider,
      gender: v?.gender === "female" || v?.gender === "male" ? v.gender : null,
      accent: typeof v?.accent === "string" ? v.accent.slice(0, 40) : null,
      age: typeof v?.age === "string" ? v.age.slice(0, 40) : null,
      // A bearer URL to an audio file. Passed through so the screen can play a
      // sample — nobody picks a voice from a name — and capped like every other
      // provider string. http(s) only, for the same reason safeImageUrl exists.
      previewUrl: /^https:\/\//.test(String(v?.preview_audio_url || ""))
        ? String(v.preview_audio_url).slice(0, 500)
        : null,
      cheaper: VOICE_PROVIDERS[provider].costCentsPerMinute <= 1.5,
      automaticFailover: VOICE_PROVIDERS[provider].automaticFailover,
    });
  }

  // The company's own default first, then by name. A contractor opening the
  // screen should see what they have now at the top rather than hunting for it.
  const mine = language === "fr" ? DEFAULT_VOICE_ID_FR : DEFAULT_VOICE_ID;
  return out.sort((a, b) => {
    if (a.id === mine) return -1;
    if (b.id === mine) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Is this a voice the company may actually be given?
 *
 * The whole point of the fetch. An id that is not in the provider's list would
 * fail /create-agent and leave the agent unprovisioned — a worse outcome than
 * refusing the change, because the refusal is visible and the other is not.
 *
 * Empty string clears the choice, which is a real answer: it falls back to the
 * language default in voiceFor().
 */
export function validateVoiceChoice(value, available = []) {
  if (value === null || value === undefined || value === "") {
    return { ok: true, voice: null };
  }
  const id = String(value).trim();
  if (!id) return { ok: true, voice: null };
  const hit = (Array.isArray(available) ? available : []).some((v) => v?.id === id);
  return hit
    ? { ok: true, voice: id }
    : { ok: false, error: "That voice isn't one the provider offers." };
}
