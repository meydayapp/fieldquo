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

/**
 * The providers worth offering, best first.
 *
 * ── Why not all six ────────────────────────────────────────────────────────
 *
 * Retell's own comparison, quoted, because these are its words and not ours:
 *
 *   cartesia   "natural-sounding voices", "stronger spelling accuracy than
 *              ElevenLabs", "among the lowest synthesis latency of any provider
 *              in published benchmarks"
 *   platform   "fine-tuned for conversational AI over the phone: natural
 *              fillers, pacing, and clarity" — and the ONLY provider with
 *              automatic TTS failover, so an outage does not leave the agent
 *              mute mid-call
 *   fish_audio its s2-pro is "the highest-ranked open-weight model in the
 *              Artificial Analysis Speech Arena"
 *
 * Left out: minimax, which Retell says "can sound somewhat more robotic"; and
 * openai, about which it makes no quality claim at all.
 *
 * ElevenLabs is left out for two reasons at once. It costs $0.040/min against
 * $0.015 for everything else — 2.7x, on the one component a contractor's own
 * margin is measured against — and Retell says "exact spelling is less reliable
 * and you may notice occasional pacing or tone quirks". Spelling is not a
 * detail on this product: the receptionist reads phone numbers back digit by
 * digit and spells email addresses aloud, and both have been got wrong on real
 * calls. Every agent shipped on 11labs-Adrian until now, which was the most
 * expensive option and the one its own vendor warns about.
 *
 * Order is preference order — see pickDefaultVoice.
 */
export const CURATED_PROVIDERS = ["cartesia", "platform", "fish_audio"];

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
export function pickableVoices(raw = [], { language = "en", keep = null } = {}) {
  const seen = new Set();
  const out = [];

  for (const v of Array.isArray(raw) ? raw : []) {
    const id = String(v?.voice_id || "").trim();
    const name = String(v?.voice_name || "").trim();
    if (!id || !name || seen.has(id)) continue;
    const provider = providerOf(v);
    if (!provider) continue;
    // ── Curated, EXCEPT whatever is answering the phone today ────────────
    //
    // A company already on an ElevenLabs voice must still see it in the list.
    // Filtering out the voice currently in use would show them a picker in
    // which nothing is selected, about a phone that is very definitely saying
    // something — and the first save would silently change how their business
    // sounds. `keep` is that one id.
    if (!CURATED_PROVIDERS.includes(provider) && id !== keep) continue;
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

  // ── What is answering TODAY sorts first ─────────────────────────────────
  //
  // This pinned the language default — a constant — to the top. That constant
  // is no longer what answers: the default is resolved from the provider's own
  // list now, and a company that has chosen a voice is not on the default at
  // all. Sorting by a constant meant a contractor opening the screen saw
  // something arbitrary at the top and had to hunt for their own.
  //
  // `keep` is the voice actually in use, so it leads. Everything else by name.
  return out.sort((a, b) => {
    if (keep) {
      if (a.id === keep) return -1;
      if (b.id === keep) return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Which voice answers when a company has never chosen one.
 *
 * ── Resolved from the live list, never written down ───────────────────────
 *
 * The temptation is a constant — "cartesia-Sam" — and it is the same trap the
 * whole picker was built to avoid: `voice_id` is required by /create-agent and
 * an unknown one fails the entire push, so the company does not get a worse
 * voice, their receptionist is left unprovisioned. A default typed from memory
 * breaks every new agent the day that voice is retired.
 *
 * So the default is the first voice from the most-preferred provider that has
 * one, and `fallback` is the known-good id we have been shipping — used when
 * the provider cannot be reached at all, because a working agent on a pricier
 * voice beats no agent.
 *
 * Language is a preference, not a filter: a French company should get a French
 * voice if the provider offers one, and an English one rather than nothing if
 * it does not.
 */
export function pickDefaultVoice(voices = [], { language = "en", fallback = null } = {}) {
  const list = Array.isArray(voices) ? voices : [];
  if (!list.length) return fallback;

  const wantsFrench = language === "fr";
  const speaksFrench = (v) => /fr|french|canad/i.test(`${v.accent || ""} ${v.name || ""}`);

  for (const provider of CURATED_PROVIDERS) {
    const mine = list.filter((v) => v.provider === provider);
    if (!mine.length) continue;
    // Symmetric, and it has to be: preferring French for a French company while
    // taking whatever sorts first for an English one handed an English business
    // a French-accented receptionist, because "Chloé" comes before "Sam".
    const matched = wantsFrench
      ? mine.find(speaksFrench)
      : mine.find((v) => !speaksFrench(v));
    return (matched || mine[0]).id;
  }
  return fallback;
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
