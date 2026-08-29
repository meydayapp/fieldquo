// lib/voice/agentTuning.js
//
// How the receptionist SOUNDS — the four things a contractor has an opinion
// about, and the eighteen they don't.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// provisionAgent used to send the prompt, the voice, the language, the call
// ceiling and the webhook, and nothing else. Every remaining knob — how easily
// the agent could be talked over, whether it filtered a job-site background,
// how long it sat on a silent line, which model it ran, how much that model
// improvised — was whatever Retell shipped that week.
//
// That is a bad place for a white-label product to stand. A provider changing
// one default silently changes how every customer's phone sounds, and nobody
// here would know until a contractor said "it keeps cutting me off". So every
// field below is stated, including the ones where our answer happens to match
// Retell's answer today. An inherited default is not a decision; it is the
// absence of one.
//
// ══ What is NOT a setting, and why that is the harder half ═════════════════
//
// A one-van painter cannot evaluate "interruption sensitivity 0.7", and cannot
// choose between Deepgram and Soniox on any basis at all. A screen of provider
// jargon is a screen nobody touches — or worse, one somebody breaks their own
// receptionist with, then rings us about. AGENTS.md names feature flags for
// features that don't exist as a failure class; a slider whose effect the owner
// cannot perceive is the same defect wearing a number.
//
// So the test applied to every knob Retell offers was: CAN A CONTRACTOR HEAR
// THE DIFFERENCE, AND DO THEY HAVE AN OPINION ABOUT IT? Four passed:
//
//   interruptions — may a caller talk over it, or does it finish its sentence
//   background    — a quiet kitchen, a van on the highway, a crowded yard
//   pace          — does it reply the instant you stop, or leave you a beat
//   manner        — brisk and businesslike, or warm and chatty
//
// Everything else is ours, set here with the reasoning attached. Where a knob
// trades latency against quality — and three of the four do — the trade is
// stated in the WORDS of the option, because the owner cares about both and
// cannot see either from a number.
//
// ══ Sources ═══════════════════════════════════════════════════════════════
//
// Field names, ranges, enums and provider defaults read on 29/08/2026 from:
//
//   https://docs.retellai.com/api-references/create-agent
//   https://docs.retellai.com/api-references/create-retell-llm
//   https://docs.retellai.com/build/transcription-mode
//   https://docs.retellai.com/build/asr-providers
//   https://docs.retellai.com/build/handle-background-noise
//   https://docs.retellai.com/build/conversational-mode
//   https://docs.retellai.com/build/llm-options
//   https://docs.retellai.com/build/agent-handbook
//
// ══ No imports ════════════════════════════════════════════════════════════
//
// Same rule as lib/voice/quoteCallScope.js: the settings card is a client
// component and needs the option list and the English copy. Importing anything
// that reaches Prisma from here would drag pg — then node's `dns` — into the
// browser bundle. So this file imports nothing, and the server re-exports what
// it needs.

/* ───────────────────────── the four the owner chooses ──────────────────── */

/**
 * Every setting, its options in render order, and which one a company that has
 * never opened the screen gets.
 *
 * One table rather than four pairs of constants, because the validator, the
 * normaliser, the payload builder and the settings card all walk it — and the
 * fifth copy of a list like this is the one that goes stale when a fifth
 * setting is added (AGENTS.md failure class #4).
 */
export const TUNING_SETTINGS = {
  interruptions: { values: ["easy", "balanced", "patient"], default: "balanced" },
  background: { values: ["quiet", "normal", "crowded"], default: "normal" },
  pace: { values: ["quick", "unhurried"], default: "quick" },
  manner: { values: ["professional", "warm"], default: "professional" },
};

/** The four field names, in the order the card renders them. */
export const TUNING_FIELDS = Object.keys(TUNING_SETTINGS);

/** What a company that has never touched the screen gets. */
export const TUNING_DEFAULTS = Object.fromEntries(
  TUNING_FIELDS.map((field) => [field, TUNING_SETTINGS[field].default]),
);

/** The i18n key for one setting's heading. */
export const tuningTitleKey = (field) => `app.setVoice.tune.${field}.title`;
/** The i18n key for one option's short name. */
export const tuningLabelKey = (field, value) => `app.setVoice.tune.${field}.${value}.label`;
/** The i18n key for what choosing that option actually does. */
export const tuningHintKey = (field, value) => `app.setVoice.tune.${field}.${value}.hint`;

/**
 * The ENGLISH FALLBACK for every heading. app/i18n/appMessages.js carries the
 * real catalogue under the same keys.
 *
 * Written as a question the contractor can answer from their own experience of
 * their own callers, not as the name of a provider field. "Background noise" is
 * a setting; "where your callers ring from" is something they know.
 */
export const TUNING_TITLE_TEXT = {
  "app.setVoice.tune.interruptions.title": "If a caller talks while it's talking",
  "app.setVoice.tune.background.title": "Where your callers usually ring from",
  "app.setVoice.tune.pace.title": "How quickly it answers",
  "app.setVoice.tune.manner.title": "How it comes across",
};

/**
 * One short name per option, and one sentence saying what it costs.
 *
 * ── The trade has to be in the words ──────────────────────────────────────
 *
 * Three of these four buy quality with latency or latency with quality, and the
 * owner asked for both at once. A contractor picking "there are usually other
 * people talking nearby" is buying a cleaner line and paying a fraction of a
 * second and half a cent a minute for it; picking "it finishes its sentence" is
 * buying a receptionist that doesn't get derailed by a passing truck and paying
 * for it with a caller who has to wait to be heard. Neither is a number they
 * could weigh. Both are sentences they can.
 */
export const TUNING_LABEL_TEXT = {
  "app.setVoice.tune.interruptions.easy.label": "It stops immediately",
  "app.setVoice.tune.interruptions.balanced.label": "It stops when they mean it",
  "app.setVoice.tune.interruptions.patient.label": "It finishes its sentence",

  "app.setVoice.tune.background.quiet.label": "Somewhere quiet",
  "app.setVoice.tune.background.normal.label": "A van, a street, a car",
  "app.setVoice.tune.background.crowded.label": "A site with people talking",

  "app.setVoice.tune.pace.quick.label": "Straight away",
  "app.setVoice.tune.pace.unhurried.label": "Leaves them a beat",

  "app.setVoice.tune.manner.professional.label": "Brisk and businesslike",
  "app.setVoice.tune.manner.warm.label": "Warm and chatty",
};

export const TUNING_HINT_TEXT = {
  "app.setVoice.tune.interruptions.easy.hint":
    "The moment it hears a voice it stops. Most like a real person — but a dog, a TV or a passing truck can stop it too, and then it has lost its place.",
  "app.setVoice.tune.interruptions.balanced.hint":
    "Stops for someone actually speaking to it, and carries on through background noise. What most people want.",
  "app.setVoice.tune.interruptions.patient.hint":
    "It gets to the end of what it was saying first. Nothing derails it, but a caller in a hurry has to wait to be heard.",

  "app.setVoice.tune.background.quiet.hint":
    "Callers ring from a kitchen or an office. Nothing is filtered, so it hears them a fraction faster and quiet voices don't get scrubbed away.",
  "app.setVoice.tune.background.normal.hint":
    "Engine noise, wind and traffic are filtered out. The safe choice, and what it does now.",
  "app.setVoice.tune.background.crowded.hint":
    "Also filters out other people's voices near the caller. Clearest on a busy site — costs half a cent a minute more and adds a fraction of a second before it replies.",

  "app.setVoice.tune.pace.quick.hint":
    "Replies the instant they stop. Fastest, and it sounds sharp — but it can jump in on someone who was only pausing to think.",
  "app.setVoice.tune.pace.unhurried.hint":
    "Waits a moment in case they were mid-thought. Fewer callers talked over, and every reply lands a little later.",

  "app.setVoice.tune.manner.professional.hint":
    "Short, polite, gets to the point. Least to say, so it starts speaking soonest.",
  "app.setVoice.tune.manner.warm.hint":
    "Chattier, says \"mm-hm\" while they talk, and softens bad news. Sounds most human, and is a shade slower off the mark.",
};

/* ──────────────────────────── validation ──────────────────────────────── */

/**
 * Is this a value we recognise for this field?
 *
 * Exported because the PUT route refuses on it, and refusing is the point.
 * Storing an unrecognised string would show the owner a choice that is not
 * being applied — a dead control with extra steps, which is the same argument
 * `outboundQuoteCallScope` is validated on rather than trimmed.
 */
export function isTuningValue(field, value) {
  // OWN property, not a lookup. `TUNING_SETTINGS` is a plain object literal, so
  // `TUNING_SETTINGS["constructor"]` is Object and `.values` on it is
  // Object.values — a function, which has no `.includes`. The obvious
  // `TUNING_SETTINGS[field]?.values.includes(value)` therefore THREW on a field
  // named `constructor`, `__proto__` or `toString` rather than returning false,
  // and a thrown validator inside a PUT handler is a 500 where a 400 belongs.
  // Found by scripts/check-voice-tuning.mjs, which posts those four names at it.
  if (!Object.prototype.hasOwnProperty.call(TUNING_SETTINGS, field)) return false;
  return TUNING_SETTINGS[field].values.includes(value);
}

/**
 * Pick the tuning fields out of a request body and say what's wrong with them.
 *
 * @returns { values, invalid } — `values` holds only recognised fields, so a
 *          caller that ignores `invalid` still cannot write a bad column;
 *          `invalid` is [{ field, value }] for the route to 400 on.
 */
export function validateTuning(body = {}) {
  const values = {};
  const invalid = [];
  for (const field of TUNING_FIELDS) {
    if (!(field in body) || body[field] === undefined) continue;
    const value = body[field];
    if (isTuningValue(field, value)) values[field] = value;
    else invalid.push({ field, value });
  }
  return { values, invalid };
}

/**
 * A stored row — or null, or a column written before this existed, or a value
 * from a release that was rolled back — as four values we recognise.
 *
 * Never throws and never passes a stranger through. The provider payload is
 * built from the OUTPUT of this function and nothing else, so an unknown string
 * cannot reach Retell however it got into the database. A company that has
 * never opened the screen gets the defaults rather than nulls, and so does a
 * company with no VoiceAgent row at all.
 */
export function normaliseTuning(agent) {
  const out = {};
  for (const field of TUNING_FIELDS) {
    const stored = agent?.[tuningColumn(field)];
    out[field] = isTuningValue(field, stored) ? stored : TUNING_DEFAULTS[field];
  }
  return out;
}

/**
 * The Prisma column one setting lives in.
 *
 * Prefixed rather than bare because `background` and `pace` are words this
 * schema will want again, and a column called `manner` on VoiceAgent tells the
 * next reader nothing about which screen writes it.
 */
export function tuningColumn(field) {
  return `tune${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

/** The four columns, for a Prisma `select`. */
export const TUNING_COLUMNS = Object.fromEntries(
  TUNING_FIELDS.map((field) => [tuningColumn(field), true]),
);

/* ─────────────────── what each choice means at the provider ─────────────── */

/**
 * `interruption_sensitivity`, [0,1], provider default 1.
 *
 * Higher means easier to interrupt. Retell's own background-noise guidance says
 * to "set it lower if you want the agent to be more resilient to background
 * speech", which is why this setting and `background` below are two halves of
 * one problem and are still two settings: filtering is about the audio, and
 * this is about what the agent does when a sound gets through anyway.
 *
 * 0.7 rather than the provider's 1 as our middle. At 1 a bark or a car horn
 * takes the floor, and an agent that has been derailed mid-question asks it
 * again — which is the single most robotic thing a phone agent does.
 */
const INTERRUPTION_SENSITIVITY = { easy: 1, balanced: 0.7, patient: 0.3 };

/**
 * `denoising_mode`, provider default `noise-cancellation`.
 *
 * `noise-and-background-speech-cancellation` carries a documented $0.005/min
 * surcharge "due to the additional processing required" — which is why the
 * option says so in money and in delay rather than being offered as free.
 */
const DENOISING_MODE = {
  quiet: "no-denoise",
  normal: "noise-cancellation",
  crowded: "noise-and-background-speech-cancellation",
};

/**
 * `responsiveness`, [0,1], provider default 1.
 *
 * How fast it comes back once the caller stops. 1 is the provider's own default
 * and is genuinely the low-latency answer; 0.6 buys the caller who pauses
 * mid-sentence the room to finish, at the cost of a beat on every reply.
 */
const RESPONSIVENESS = { quick: 1, unhurried: 0.6 };

/* ───────────────── what we chose, and did not put on the screen ────────── */

/**
 * The knobs a contractor has no opinion about, stated anyway.
 *
 * ── stt_mode: "fast" ──────────────────────────────────────────────────────
 *
 * Retell's transcription modes are "optimize for speed" and "optimize for
 * accuracy", and the accuracy mode's gain is on hard vocabulary — Retell's own
 * companion setting for it is `vocab_specialization: "medical"`. A receptionist
 * taking a name, a phone number and a street does not have hard vocabulary; it
 * has a caller in a driveway who notices every pause. `fast` matches the
 * provider's current default and is pinned so it stays ours if that moves.
 *
 * Not exposed, because "optimise for speed or accuracy" is a question that
 * sounds answerable and isn't: everyone picks accuracy, and what they get is a
 * slower phone for a benefit they will never hear. The two accuracy features
 * that DO matter on this call — reading a number back, and tolerating a
 * mangled name — are switched on unconditionally in `handbook_config` below.
 *
 * ── no custom_stt_config, and that is also a decision ─────────────────────
 *
 * `custom_stt_config` would pin one ASR vendor (azure / deepgram / soniox /
 * assemblyai). We deliberately send nothing: Retell's ASR page states it "picks
 * a speech recognition provider based on the languages your agent is configured
 * for. You don't need to choose one manually", and this product ships fr-CA
 * agents. Pinning a vendor here would freeze French routing onto whichever one
 * happened to be right the day it was written, and no contractor could ever
 * diagnose that. The one field where inheriting the provider's behaviour is the
 * better engineering answer, recorded so it reads as a choice.
 *
 * ── vocab_specialization: "general" ───────────────────────────────────────
 *
 * The only alternative is `medical`. Stated so a future default cannot move it.
 *
 * ── ambient_sound: null ───────────────────────────────────────────────────
 *
 * Retell will play a coffee shop, a convention hall or a call centre behind the
 * agent. Never. This is a white-label product: fake background noise is the
 * software telling a homeowner something untrue about where the person they are
 * speaking to is sitting. Sent explicitly as null so an account-level default
 * cannot introduce it.
 *
 * ── enable_dynamic_responsiveness / enable_dynamic_voice_speed: false ─────
 *
 * Both let Retell vary, per turn, the two things the owner just chose on the
 * screen. Leaving them on would make "Leaves them a beat" a suggestion rather
 * than a setting, which is the dead-control failure this codebase is swept for.
 *
 * ── enable_expressive_mode: false ─────────────────────────────────────────
 *
 * Emotion tags — sighs, throat-clearing, emphasis. It is voice-model specific
 * and nobody here has heard it on the two voices we ship. Shipping a
 * personality nobody has listened to onto a stranger's business line is not a
 * default, it is a guess. Off until someone makes a real call and decides.
 *
 * ── voice_speed / volume: 1 ───────────────────────────────────────────────
 *
 * Pinned at neutral. These are the two fields most likely to be nudged by a
 * provider tuning its own defaults, and a receptionist that starts talking
 * faster one Tuesday is a support ticket nobody can reproduce.
 *
 * ── end_call_after_silence_ms: 60000 ──────────────────────────────────────
 *
 * The provider default is 600000 — TEN MINUTES of dead air before it hangs up.
 * This is a prepaid product: lib/voice/credits.js bills every one of those
 * minutes to the contractor for a caller who put the phone down in a pocket.
 * One minute is long enough for "hang on, let me get the address" and short
 * enough that a dropped handset costs a minute rather than ten.
 *
 * ── reminder_trigger_ms / reminder_max_count: 10000 / 1 ───────────────────
 *
 * "Still there?" after ten seconds, once. Both are the provider's own values
 * and both are pinned rather than adopted. A second nudge would only fill the
 * silence the field above already ends.
 *
 * ── allow_dtmf_interruption: false ────────────────────────────────────────
 *
 * A caller pressing a key should not stop the receptionist talking. There is no
 * menu here to escape from.
 */
export const PROVIDER_CHOICES = {
  stt_mode: "fast",
  vocab_specialization: "general",
  ambient_sound: null,
  enable_dynamic_responsiveness: false,
  enable_dynamic_voice_speed: false,
  enable_expressive_mode: false,
  voice_speed: 1,
  volume: 1,
  end_call_after_silence_ms: 60000,
  reminder_trigger_ms: 10000,
  reminder_max_count: 1,
  allow_dtmf_interruption: false,
};

/**
 * The Agent Handbook toggles that are on for everybody, whatever they picked.
 *
 * Retell's handbook is a set of prompt presets it prepends, each with a token
 * cost — so every one of these is paid for in time-to-first-word, and the four
 * chosen are the four that earn it.
 *
 *   echo_verification (~190 tokens) — reads names and numbers back. AGENTS.md's
 *     own line: a lead with no phone number is not a lead. This is the single
 *     highest-value 190 tokens on the call.
 *   smart_matching (~110) — tolerates speech-recognition variants of a name, so
 *     "Siobhan" heard four ways is still one person.
 *   ai_disclosure (~30) — it says it is an assistant when asked. Rule 4 of
 *     SYSTEM_RULES already requires this; the preset is belt and braces on a
 *     rule that is illegal to break in several jurisdictions.
 *   scope_boundaries (~60) — answers only from the prompt and the knowledge we
 *     gave it. Reinforces rule 6, and is the closest thing Retell ships to the
 *     price refusal.
 *
 * And the two that are deliberately OFF:
 *
 *   speech_normalization (~910) — reads numbers and dates naturally. Skipped
 *     not because it is wrong but because SYSTEM_RULES already instructs it
 *     ("repeat the phone number back once, digit by digit"), and 910 tokens for
 *     a second copy of an instruction we already give is latency for nothing.
 *   nato_phonetic_alphabet (~190) — "Alpha Bravo Charlie" at a homeowner who
 *     rang about a kitchen. Wrong register for this product entirely.
 *
 * ── None of these can weaken the price refusal ────────────────────────────
 *
 * The handbook is TONE and FORMAT. Not one of the presets grants permission to
 * say anything; the two that touch content — ai_disclosure and scope_boundaries
 * — both narrow what may be said. SYSTEM_RULES stays first in the prompt and
 * untouched by this file, which sends no prompt text at all.
 */
const HANDBOOK_ALWAYS = {
  echo_verification: true,
  smart_matching: true,
  ai_disclosure: true,
  scope_boundaries: true,
  speech_normalization: false,
  nato_phonetic_alphabet: false,
};

/** What `manner` changes in the handbook. */
const HANDBOOK_BY_MANNER = {
  professional: {
    default_personality: true,
    conversational_personality: false,
    natural_filler_words: false,
    high_empathy: false,
  },
  // "Professional + Conversational" replaces the default tone rather than
  // stacking on it — Retell documents them as two variants of one preset — so
  // default_personality goes off when this goes on.
  warm: {
    default_personality: false,
    conversational_personality: true,
    natural_filler_words: true,
    high_empathy: true,
  },
};

/* ────────────────────────── the payloads ───────────────────────────────── */

/**
 * Everything this file contributes to `/create-agent` and `/update-agent`.
 *
 * Built from `normaliseTuning`'s output, so it is total: every input produces a
 * complete payload, and no caller can hand it a string that reaches Retell
 * unrecognised.
 *
 * Every field is ALWAYS sent, including the ones whose value happens to equal
 * the provider's current default. Sending only what differs is how an agent
 * provisioned last year stays on a default that has since moved, and how a
 * re-provision can raise a setting but never lower it — the same argument the
 * `max_call_duration_ms` comment in provision.js makes.
 */
export function agentTuningPayload(tuning) {
  const t = normaliseTuning(asRow(tuning));
  return {
    ...PROVIDER_CHOICES,
    interruption_sensitivity: INTERRUPTION_SENSITIVITY[t.interruptions],
    denoising_mode: DENOISING_MODE[t.background],
    responsiveness: RESPONSIVENESS[t.pace],
    // The "mm-hm" while the caller is still talking. Off for the brisk manner
    // on purpose: backchannel over a short businesslike turn reads as
    // interrupting rather than as listening.
    enable_backchannel: t.manner === "warm",
    backchannel_frequency: t.manner === "warm" ? 0.8 : 0,
    handbook_config: { ...HANDBOOK_ALWAYS, ...HANDBOOK_BY_MANNER[t.manner] },
  };
}

/**
 * Everything this file contributes to the Retell LLM (the response engine).
 *
 * ── model: "gpt-4.1" ──────────────────────────────────────────────────────
 *
 * Pinned to the provider's current default rather than moved. The enum offers
 * two dozen models and several are plainly faster, but "faster" is a claim
 * nobody here has measured on a real call — there is no RETELL_API_KEY in local
 * dev and this has never run against the live API. Pinning it is the whole
 * point: the receptionist that answered two real calls correctly answers the
 * next one on the same model, whatever Retell promotes next month. Moving it is
 * a change somebody has to LISTEN to.
 *
 * ── model_temperature: 0 ──────────────────────────────────────────────────
 *
 * The provider default, and it stays. Retell's own guidance suggests 0.4–0.7
 * for customer service and it is probably right about warmth — but the price
 * refusal in SYSTEM_RULES held under direct pressure on two real calls AT THIS
 * VALUE, and raising temperature is raising the variance of the one behaviour
 * that is not allowed to vary. Warmth is bought in `manner` instead, where it
 * costs prompt tokens rather than determinism.
 *
 * ── model_high_priority: false ────────────────────────────────────────────
 *
 * Retell's Fast Tier documents "50% reduction in latency variance" and "25%
 * improvement in average response time" at 1.5x the per-minute price. That is
 * exactly the trade the owner asked about — and it is a PRICING decision, not a
 * tuning one: lib/voice/credits.js charges one flat rate per minute, so
 * switching this on spends FieldQuo's margin on every tenant's call. Off, and
 * flagged here rather than buried, because it is the one setting on this screen
 * that would need a rate change beside it.
 *
 * ── tool_call_strict_mode: true ───────────────────────────────────────────
 *
 * The tools on this agent save a caller as a lead and book a visit. A malformed
 * call loses the lead silently — the caller hangs up happy and nothing was
 * written. Structured Output costs nothing at call time.
 */
export function llmTuningPayload() {
  return {
    model: "gpt-4.1",
    model_temperature: 0,
    model_high_priority: false,
    tool_call_strict_mode: true,
  };
}

/**
 * Accept either a VoiceAgent row or a plain `{ interruptions, ... }` object.
 *
 * The row is what provision.js has; the plain shape is what a check script or a
 * preview would build. Without this the payload builder would take one and
 * silently default the other to our defaults — a builder that accepts the wrong
 * shape and returns a plausible answer is worse than one that refuses.
 */
function asRow(input) {
  if (!input) return null;
  const looksLikeRow = TUNING_FIELDS.some((f) => tuningColumn(f) in input);
  if (looksLikeRow) return input;
  const row = {};
  for (const field of TUNING_FIELDS) row[tuningColumn(field)] = input[field];
  return row;
}
