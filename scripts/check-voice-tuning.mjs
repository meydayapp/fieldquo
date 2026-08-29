// scripts/check-voice-tuning.mjs
//
// How the receptionist sounds, executed rather than read.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// provisionAgent sent the prompt, the voice, the language, the call ceiling and
// the webhook. Everything else about how the phone SOUNDED — how easily it
// could be talked over, whether it filtered a job-site background, how long it
// sat on a silent line, which model it ran, how much that model improvised —
// was whatever Retell shipped that week. Twenty-odd knobs, none of them ours,
// on a white-label product where the voice IS the contractor's business.
//
// Retell moving one default would have changed how every customer's phone
// sounded, and nobody here would have known until a contractor rang up to say
// "it keeps cutting me off".
//
// ══ Why THESE assertions ═══════════════════════════════════════════════════
//
// Five failure modes, and only one of them is visible by reading:
//
//   1. A SETTING SAVED TO THE DATABASE THAT NEVER REACHES THE PROVIDER. The
//      dead control this codebase is swept for, and the exact shape of the
//      `sitePublished` toggle and the three Send buttons that emailed nobody.
//      Asserted by BUILDING the payload and looking in it — not by grepping for
//      a field name, which passes just as happily when the field is written
//      into a variable nobody sends.
//
//   2. A SAVED VALUE LOST ON RE-PROVISION. Every push rebuilds the payload from
//      scratch, so a builder that reads the wrong column, or reads it once and
//      caches, gives the contractor a setting that works until the next
//      unrelated save. Asserted by building twice and comparing.
//
//   3. AN UNKNOWN VALUE PASSED THROUGH. A column written before these existed,
//      a rolled-back release, a hand-written POST. Two layers have to hold: the
//      route REFUSES it, and the payload builder still cannot emit it.
//
//   4. A DEFAULT LEFT TO THE PROVIDER. Every field we care about must be
//      PRESENT in the payload, including the ones whose value happens to equal
//      Retell's today — an inherited default is not a decision.
//
//   5. THE PRICE REFUSAL WEAKENED. SYSTEM_RULES puts "never give a price, not
//      even a range" above anything a company types, and it held under direct
//      pressure on two real calls. No tuning field may touch the prompt, and
//      the tuning payload must contain no prompt text at all.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-voice-tuning.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TUNING_SETTINGS,
  TUNING_FIELDS,
  TUNING_DEFAULTS,
  TUNING_COLUMNS,
  TUNING_TITLE_TEXT,
  TUNING_LABEL_TEXT,
  TUNING_HINT_TEXT,
  PROVIDER_CHOICES,
  tuningColumn,
  tuningTitleKey,
  tuningLabelKey,
  tuningHintKey,
  isTuningValue,
  validateTuning,
  normaliseTuning,
  agentTuningPayload,
  llmTuningPayload,
} from "@/lib/voice/agentTuning";
import { buildAgentPrompt } from "@/lib/voice/prompt";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * A file with its comments removed.
 *
 * Needed because several assertions below are of the form "this provider field
 * name appears nowhere in this file" — and the comments in these files DISCUSS
 * the provider field names at length, which is the point of them. Testing the
 * raw text would make writing down why a value is not stored the thing that
 * fails the check for storing it.
 */
const code = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\/\/)/.test(line))
    .map((line) => line.replace(/\s\/\/[^"'`]*$/, ""))
    .join("\n");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

/** A VoiceAgent row, as Prisma would hand one back. */
const row = (over = {}) => ({
  id: "va_1",
  companyId: "co_1",
  greeting: null,
  instructions: null,
  tuneInterruptions: "balanced",
  tuneBackground: "normal",
  tunePace: "quick",
  tuneManner: "professional",
  ...over,
});

/* ══════════════════════════════════════════════════════════════════════════
   1. A company that has never opened the screen
   ══════════════════════════════════════════════════════════════════════════
   The first thing that goes wrong with a settings table is that the people who
   never touched it get nulls. A null interruption sensitivity is not "leave it
   alone" at a provider — it is a 400, or worse, a silent revert to whatever the
   vendor ships. So absence has to resolve to our four defaults everywhere:
   with no row at all, with a row whose columns predate the feature, and with a
   row somebody wrote garbage into. */
console.log("\nA company that has never touched the screen");
ok("no VoiceAgent row at all still resolves to four values",
  Object.keys(normaliseTuning(null)).length === TUNING_FIELDS.length);
ok("...and they are the defaults, not nulls",
  JSON.stringify(normaliseTuning(null)) === JSON.stringify(TUNING_DEFAULTS),
  normaliseTuning(null));
ok("...an empty row is the same", JSON.stringify(normaliseTuning({})) === JSON.stringify(TUNING_DEFAULTS));
ok("...and so is a row with nulls in the new columns",
  JSON.stringify(normaliseTuning(row({ tuneManner: null, tunePace: null }))) ===
    JSON.stringify(TUNING_DEFAULTS));
for (const field of TUNING_FIELDS) {
  ok(`${field}'s default is one of its own options`,
    TUNING_SETTINGS[field].values.includes(TUNING_DEFAULTS[field]));
}
// Nulls must not reach the provider either. The payload is built from
// normaliseTuning's output and nothing else, so this is the end-to-end version
// of the assertion above.
{
  const p = agentTuningPayload(null);
  ok("the payload for a company with no row carries no nulls in the tuned fields",
    [p.interruption_sensitivity, p.denoising_mode, p.responsiveness].every(
      (v) => v !== null && v !== undefined,
    ),
    p);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Every exposed setting reaches the provider payload
   ══════════════════════════════════════════════════════════════════════════
   THE assertion. A setting that is stored, shown on screen, and never sent is
   the dead control — the contractor changes it, the screen says Saved, and the
   phone does exactly what it did before. Nobody finds out.

   Executed, not grepped: every option of every setting is built into a real
   payload and the payload is compared against the option beside it. A field
   name appearing in the source proves nothing; two different choices producing
   two different payloads proves it. */
console.log("\nEvery choice changes what the provider is sent");
for (const field of TUNING_FIELDS) {
  const seen = new Map();
  for (const value of TUNING_SETTINGS[field].values) {
    const payload = agentTuningPayload({ ...TUNING_DEFAULTS, [field]: value });
    seen.set(value, JSON.stringify(payload));
  }
  const distinct = new Set(seen.values());
  ok(`${field}: all ${seen.size} choices produce ${seen.size} different payloads`,
    distinct.size === seen.size,
    [...seen.keys()]);
}

// And the specific fields, named, because "different" is not "correct". These
// are the Retell parameter names read from the create-agent reference on
// 29/08/2026; if any is renamed by the vendor, this is where it shows.
console.log("\n...through the Retell field the docs name");
{
  const easy = agentTuningPayload({ ...TUNING_DEFAULTS, interruptions: "easy" });
  const patient = agentTuningPayload({ ...TUNING_DEFAULTS, interruptions: "patient" });
  ok("interruptions rides interruption_sensitivity",
    easy.interruption_sensitivity > patient.interruption_sensitivity,
    [easy.interruption_sensitivity, patient.interruption_sensitivity]);
  ok("...within Retell's documented [0,1]",
    [easy, patient].every((p) => p.interruption_sensitivity >= 0 && p.interruption_sensitivity <= 1));

  const quiet = agentTuningPayload({ ...TUNING_DEFAULTS, background: "quiet" });
  const crowded = agentTuningPayload({ ...TUNING_DEFAULTS, background: "crowded" });
  ok("background rides denoising_mode", quiet.denoising_mode === "no-denoise", quiet.denoising_mode);
  ok("...and the crowded option is the one with the surcharge",
    crowded.denoising_mode === "noise-and-background-speech-cancellation",
    crowded.denoising_mode);
  ok("...all three are values the docs list",
    ["no-denoise", "noise-cancellation", "noise-and-background-speech-cancellation"].includes(
      agentTuningPayload({ ...TUNING_DEFAULTS, background: "normal" }).denoising_mode,
    ));

  const quick = agentTuningPayload({ ...TUNING_DEFAULTS, pace: "quick" });
  const unhurried = agentTuningPayload({ ...TUNING_DEFAULTS, pace: "unhurried" });
  ok("pace rides responsiveness", quick.responsiveness > unhurried.responsiveness,
    [quick.responsiveness, unhurried.responsiveness]);
  ok("...within Retell's documented [0,1]",
    [quick, unhurried].every((p) => p.responsiveness >= 0 && p.responsiveness <= 1));

  const brisk = agentTuningPayload({ ...TUNING_DEFAULTS, manner: "professional" });
  const warm = agentTuningPayload({ ...TUNING_DEFAULTS, manner: "warm" });
  ok("manner rides the handbook and the backchannel",
    warm.enable_backchannel === true && brisk.enable_backchannel === false);
  ok("...warm is the conversational handbook preset",
    warm.handbook_config.conversational_personality === true &&
      brisk.handbook_config.conversational_personality === false);
  // The two handbook presets are variants of one setting, not a stack. Both on
  // would be two tone instructions arguing in the same prompt.
  ok("...and the two tone presets are never both on",
    !(warm.handbook_config.default_personality && warm.handbook_config.conversational_personality));
  ok("...filler words come with it", warm.handbook_config.natural_filler_words === true);
  // Backchannel frequency is meaningless with backchannel off, and a leftover
  // 0.8 sitting beside `enable_backchannel: false` is the kind of contradiction
  // a vendor is free to resolve either way.
  ok("...and the brisk manner sends no backchannel frequency to contradict it",
    brisk.backchannel_frequency === 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   3. A saved value survives a re-provision
   ══════════════════════════════════════════════════════════════════════════
   Every push rebuilds the payload from scratch — deliberately, so a deleted
   note is really deleted. That makes the reverse the risk: a builder that reads
   the wrong column, or reads the request instead of the row, gives a setting
   that works once and reverts on the next unrelated save. The contractor then
   has a phone that changed by itself. */
console.log("\nA saved value survives being pushed again");
{
  const saved = row({
    tuneInterruptions: "patient",
    tuneBackground: "crowded",
    tunePace: "unhurried",
    tuneManner: "warm",
  });
  const first = agentTuningPayload(saved);
  const second = agentTuningPayload(saved);
  ok("two pushes of the same row produce the identical payload",
    JSON.stringify(first) === JSON.stringify(second));
  ok("...and it is the SAVED value, not the default",
    first.interruption_sensitivity !==
      agentTuningPayload(row()).interruption_sensitivity);
  ok("...on every one of the four",
    first.denoising_mode === "noise-and-background-speech-cancellation" &&
      first.responsiveness < 1 &&
      first.enable_backchannel === true,
    first);
  // The row shape and the plain shape must agree. provision.js hands it a
  // Prisma row; a check or a preview hands it { manner: "warm" }. A builder
  // that quietly defaults the shape it didn't expect is worse than one that
  // refuses, because it returns something plausible.
  ok("a plain { field: value } object gives the same payload as the row",
    JSON.stringify(agentTuningPayload({
      interruptions: "patient", background: "crowded", pace: "unhurried", manner: "warm",
    })) === JSON.stringify(first));
}

/* ══════════════════════════════════════════════════════════════════════════
   4. An unknown or out-of-range value is refused, not forwarded
   ══════════════════════════════════════════════════════════════════════════
   Two layers, because they fail differently. The ROUTE refuses, so a saved
   value is always one the phone is applying — storing a string that normalises
   away at read time shows the owner a choice nothing honours, which is a dead
   control with extra steps. The BUILDER refuses independently, because a column
   can be written by a path that is not the route: a rolled-back release, a
   migration, a hand-run query. */
console.log("\nAn unknown value never reaches Retell");
const HOSTILE = [
  "aggressive", "EASY", " easy", "easy ", "0.7", "", "  ",
  0, 1, -1, 0.7, null, undefined, true, false, NaN, Infinity,
  [], {}, ["easy"], { toString: () => "easy" },
  "no-denoise", "noise-cancellation", // the PROVIDER's vocabulary, not ours
  "__proto__", "constructor", "toString", "hasOwnProperty",
];
for (const bad of HOSTILE) {
  const label = typeof bad === "object" && bad !== null ? JSON.stringify(bad) : String(bad);
  ok(`interruptions rejects ${label || "(empty)"}`, isTuningValue("interruptions", bad) === false);
}
ok("an unknown FIELD is rejected too", isTuningValue("nonsense", "easy") === false);
// Prototype keys are on the hostile list because TUNING_SETTINGS is a plain
// object literal: `TUNING_SETTINGS["constructor"]` is truthy, and a membership
// test written as `TUNING_SETTINGS[field] && ...` would have walked into it.
ok("...including a prototype key that exists on every object",
  isTuningValue("constructor", "easy") === false && isTuningValue("__proto__", "easy") === false);

console.log("\n...and the builder refuses it a second time, independently");
{
  // The three numbers this field is ever allowed to carry. Asserting membership
  // rather than "!== the input" on purpose: our balanced value IS 0.7, so a
  // hostile input of 0.7 would pass an inequality test by coincidence and tell
  // us nothing about whether it was mapped or forwarded.
  const ALLOWED = new Set(
    TUNING_SETTINGS.interruptions.values.map(
      (v) => agentTuningPayload({ ...TUNING_DEFAULTS, interruptions: v }).interruption_sensitivity,
    ),
  );
  for (const bad of ["aggressive", "0.7", 0.7, null, "", "no-denoise", "constructor"]) {
    const payload = agentTuningPayload({ ...TUNING_DEFAULTS, interruptions: bad });
    ok(`a column holding ${JSON.stringify(bad)} still sends the default`,
      payload.interruption_sensitivity ===
        agentTuningPayload(TUNING_DEFAULTS).interruption_sensitivity,
      payload.interruption_sensitivity);
    ok(`...and only ever one of our three mapped numbers`,
      ALLOWED.has(payload.interruption_sensitivity), payload.interruption_sensitivity);
  }
}
{
  // Every provider field this builder emits must be a value Retell's reference
  // documents — a string enum or a number in range. A raw code leaking through
  // ("crowded" where "noise-and-background-speech-cancellation" belongs) is a
  // 400 on every provision, which reads to the contractor as "the phone broke".
  const OURS = new Set([...TUNING_FIELDS, ...Object.values(TUNING_DEFAULTS)]);
  for (const field of TUNING_FIELDS) {
    for (const value of TUNING_SETTINGS[field].values) OURS.add(value);
  }
  let leaked = null;
  for (const field of TUNING_FIELDS) {
    for (const value of TUNING_SETTINGS[field].values) {
      const p = agentTuningPayload({ ...TUNING_DEFAULTS, [field]: value });
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === "string" && OURS.has(v)) leaked = `${k}=${v}`;
      }
    }
  }
  ok("no payload field carries one of OUR codes instead of Retell's", leaked === null, leaked);
}

console.log("\nThe route refuses it rather than storing it");
{
  const good = validateTuning({ interruptions: "patient", manner: "warm" });
  ok("a valid body validates clean", good.invalid.length === 0);
  ok("...and only the fields that were sent", Object.keys(good.values).length === 2, good.values);
  const bad = validateTuning({ interruptions: "aggressive", manner: "warm" });
  ok("one bad field is reported", bad.invalid.length === 1 && bad.invalid[0].field === "interruptions");
  ok("...and is NOT in the values to store", !("interruptions" in bad.values));
  ok("...while the good one beside it still is", bad.values.manner === "warm");
  ok("a body with no tuning at all is clean and empty",
    validateTuning({ greeting: "hello" }).invalid.length === 0 &&
      Object.keys(validateTuning({ greeting: "hello" }).values).length === 0);
  // Absent is not the same as null. The card posts one setting at a time; a
  // field left out must not collapse the other three to defaults.
  ok("an absent field is untouched, not defaulted",
    !("manner" in validateTuning({ interruptions: "easy" }).values));
  ok("an explicit undefined is treated as absent",
    Object.keys(validateTuning({ manner: undefined }).values).length === 0);
  ok("an explicit null is REFUSED, not treated as absent",
    validateTuning({ manner: null }).invalid.length === 1);
}
{
  const src = read("app/api/settings/voice/route.js");
  ok("the PUT route validates before it writes", /validateTuning\(body\)/.test(src));
  ok("...and 400s on an unrecognised value",
    /tuning\.invalid\.length[\s\S]{0,400}status:\s*400/.test(src));
  ok("...writing through tuningColumn rather than a hand-typed column name",
    /data\[tuningColumn\(field\)\]\s*=\s*value/.test(src));
  ok("...and the GET normalises rather than returning the raw row",
    /normaliseTuning\(agent\)/.test(src));
}

/* ══════════════════════════════════════════════════════════════════════════
   5. The settings actually reach the provider — the wiring, not the shape
   ══════════════════════════════════════════════════════════════════════════
   Everything above proves the BUILDER is right. This proves somebody calls it.
   A perfect payload builder nothing invokes is the failure this whole script is
   named after: the value is in the database, the screen shows it, and Retell
   never hears about it.

   provisionAgent itself cannot be executed here — it opens a Prisma client and
   POSTs to a provider — so the wiring is asserted at the two places it can
   break: the payload builder is spread into the object that is handed to
   createAgent/updateAgent, and the save path calls provisionAgent at all. */
console.log("\nSomebody actually sends it");
{
  const prov = read("lib/voice/provision.js");
  ok("provision.js imports the payload builders",
    /import\s*\{\s*agentTuningPayload,\s*llmTuningPayload\s*\}\s*from\s*"\.\/agentTuning"/.test(prov));
  ok("...and spreads the agent tuning into agentPayload",
    /const agentPayload = \{[\s\S]*?\.\.\.agentTuningPayload\(agent\)[\s\S]*?\n  \};/.test(prov));
  ok("...reading the agent ROW, not the request body",
    /\.\.\.agentTuningPayload\(agent\)/.test(prov) && !/agentTuningPayload\(body/.test(prov));
  ok("...and the model choices into the response engine",
    /const llmPayload = \{[\s\S]*?\.\.\.llmTuningPayload\(\)[\s\S]*?\n  \};/.test(prov));
  // The outbound agent is the same company's voice on the same client's phone.
  // Tuning only the inbound half gives one business two receptionists that
  // sound different, and the person answering has no idea why.
  ok("...the outbound agent is tuned the same way",
    /const outboundPayload = \{[\s\S]*?\.\.\.agentTuningPayload\(agent\)[\s\S]*?\n      \};/.test(prov));
  ok("...and runs the same model",
    /const outboundLlmPayload = \{[\s\S]*?\.\.\.llmTuningPayload\(\)[\s\S]*?\n    \};/.test(prov));
  // The payload builder must not be able to overwrite the prompt. Spread LAST
  // in llmPayload means anything it emitted with the key `general_prompt` would
  // win — so the guarantee is that it emits no such key at all, asserted below
  // under the price refusal.
  ok("agentPayload still sends the webhook and the ceiling",
    /max_call_duration_ms: maxCallMs/.test(prov) && /webhook_url: webhookUrl/.test(prov));
}
{
  const src = read("app/api/settings/voice/route.js");
  ok("saving the settings re-provisions the agent", /pushed = await provisionAgent\(/.test(src));
  ok("...and the tuning columns are written in the same `data` the upsert takes",
    /db\.voiceAgent\.upsert\([\s\S]{0,200}update: data/.test(src));
}
{
  // The resync path exists for the case where a push failed halfway, and it is
  // the same function — so a contractor whose tuning did not land has a button.
  const repair = read("app/api/settings/voice/number/repair/route.js");
  ok("the resync repair re-pushes through the same provisionAgent",
    /body\?\.fix === "resync"/.test(repair) && /provisionAgent\(member\.companyId, origin\)/.test(repair));
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Our defaults are stated, not inherited
   ══════════════════════════════════════════════════════════════════════════
   AGENTS.md's rule about padding absent data applies to outbound requests too:
   a field we leave out is not "no opinion", it is the vendor's opinion, applied
   to a contractor's business line, changeable without notice. Every field must
   be PRESENT — including the several where our answer is currently the same as
   Retell's, which is exactly where the temptation to omit is strongest. */
console.log("\nEvery default is stated rather than inherited");
{
  const p = agentTuningPayload(row());
  const MUST_BE_PRESENT = [
    // Set by us, never on screen. See PROVIDER_CHOICES for the reasoning.
    "stt_mode", "vocab_specialization", "ambient_sound",
    "enable_dynamic_responsiveness", "enable_dynamic_voice_speed", "enable_expressive_mode",
    "voice_speed", "volume", "end_call_after_silence_ms",
    "reminder_trigger_ms", "reminder_max_count", "allow_dtmf_interruption",
    // Chosen by the owner.
    "interruption_sensitivity", "denoising_mode", "responsiveness",
    "enable_backchannel", "backchannel_frequency", "handbook_config",
  ];
  for (const key of MUST_BE_PRESENT) {
    ok(`${key} is sent`, key in p, Object.keys(p));
  }
  // `null` is a stated value here and the only one that could be mistaken for
  // an omission. Retell will play a coffee shop behind the agent; sending null
  // is how we say never, rather than how we say nothing.
  ok("ambient_sound is explicitly null, not missing", p.ambient_sound === null);
  ok("...which is a different thing from absent", "ambient_sound" in p);
  // Ten minutes of dead air, billed to a prepaid contractor, was the vendor's
  // default. This is the one PROVIDER_CHOICES entry that is about money.
  ok("silence hangs up in a minute, not the provider's ten",
    p.end_call_after_silence_ms === 60000 && p.end_call_after_silence_ms < 600000,
    p.end_call_after_silence_ms);
  ok("...and stays above Retell's documented 10s floor", p.end_call_after_silence_ms >= 10000);
  // Retell's own default is `fast`; pinning it is the point. The assertion is
  // that we STATE it, so a vendor default moving to `accurate` cannot silently
  // slow every customer's phone down.
  ok("the transcription mode is pinned to the low-latency one", p.stt_mode === "fast");
  ok("...and is one of the three the reference lists",
    ["fast", "accurate", "custom"].includes(p.stt_mode));
  // The ASR vendor is the ONE field we deliberately do not pin: Retell routes
  // by language, and this product ships fr-CA agents. Freezing a vendor would
  // freeze French onto whichever was right the day it was written.
  ok("no ASR vendor is pinned — Retell routes fr-CA by language", !("custom_stt_config" in p));
  ok("...and PROVIDER_CHOICES says so in the same breath",
    !("custom_stt_config" in PROVIDER_CHOICES));
  // Dynamic responsiveness would let Retell vary, per turn, the thing the owner
  // just chose. That makes an exposed setting a suggestion.
  ok("nothing is allowed to vary the pace the owner picked",
    p.enable_dynamic_responsiveness === false && p.enable_dynamic_voice_speed === false);
}
{
  const l = llmTuningPayload();
  ok("the model is pinned rather than left to the provider", typeof l.model === "string" && l.model.length > 0);
  ok("...temperature is stated", typeof l.model_temperature === "number");
  // The price refusal was verified at temperature 0 on two real calls. Raising
  // it raises the variance of the one behaviour that is not allowed to vary.
  ok("...and it is 0, which is where the price refusal was verified",
    l.model_temperature === 0, l.model_temperature);
  // Fast Tier is 1.5x the per-minute price against a flat rate card. That is a
  // pricing decision, and nobody has made it.
  ok("the 1.5x priority tier is off", l.model_high_priority === false);
  ok("...and strict tool calls are on, because a malformed one loses the lead",
    l.tool_call_strict_mode === true);
}

/* ══════════════════════════════════════════════════════════════════════════
   7. The price refusal is untouched
   ══════════════════════════════════════════════════════════════════════════
   Non-negotiable. SYSTEM_RULES puts "NEVER give a price" above anything a
   company types, and it held under direct pressure on two real calls. This file
   is allowed to change how the receptionist SOUNDS and nothing about what it is
   permitted to SAY — so the tuning payload must contain no prompt text at all,
   and the built prompt must be byte-identical whatever anybody picks. */
console.log("\nThe price refusal is untouched by any of this");
{
  const PROMPT_KEYS = ["general_prompt", "begin_message", "general_tools", "prompt", "instructions"];
  let touched = null;
  for (const field of TUNING_FIELDS) {
    for (const value of TUNING_SETTINGS[field].values) {
      const p = agentTuningPayload({ ...TUNING_DEFAULTS, [field]: value });
      for (const key of PROMPT_KEYS) if (key in p) touched = `${field}=${value} → ${key}`;
    }
  }
  ok("no tuning choice emits a prompt field", touched === null, touched);
  ok("...and neither does the LLM payload",
    PROMPT_KEYS.every((k) => !(k in llmTuningPayload())));

  // The prompt itself, built for the same company under every combination.
  // buildAgentPrompt takes no tuning argument at all — which is the guarantee —
  // so this asserts the thing that would break if somebody later threaded one
  // through it.
  const facts = {
    company: { name: "Big painter Inc", phone: "+16135550123", city: "Gatineau" },
    services: ["Interior painting"],
    areas: ["Gatineau"],
    hours: "Mon–Fri 8:00–17:00",
    notes: "We don't do commercial work.",
    canBook: true,
    visit: { canBook: true, bookableModes: ["onsite"] },
    canTransfer: false,
    quoteTopics: [],
    upsells: [],
    photosTo: "hello@bigpainter.example",
  };
  const base = buildAgentPrompt(facts);
  ok("the built prompt still carries the absolute price rule",
    base.includes("NEVER give a price"));
  ok("...and still says not even a range",
    /not a range|not a figure/.test(base));
  ok("...above the owner's own note",
    base.indexOf("NEVER give a price") < base.indexOf("We don't do commercial work."));
  // One destructured options object and nothing beside it. `.length` is 0
  // because every key in that object has a default — what matters is that there
  // is no SECOND parameter for a tuning bundle to arrive through.
  ok("buildAgentPrompt takes no second argument, so no choice can reach it",
    buildAgentPrompt.length <= 1, buildAgentPrompt.length);
  ok("...and its one parameter names none of the tuning fields",
    TUNING_FIELDS.every(
      (f) => !new RegExp(`^\\s*${f}[,=]`, "m").test(
        code(read("lib/voice/prompt.js")).slice(
          code(read("lib/voice/prompt.js")).indexOf("export function buildAgentPrompt"),
        ).split("}")[0],
      ),
    ));

  // The handbook presets are the one thing here that DOES reach the model as
  // text. The two that touch content both narrow what may be said; none of them
  // grants permission. Asserted on every manner, because a preset flipped by a
  // future edit is the only way this file could weaken the rule.
  for (const manner of TUNING_SETTINGS.manner.values) {
    const h = agentTuningPayload({ ...TUNING_DEFAULTS, manner }).handbook_config;
    ok(`manner=${manner} keeps the AI disclosure preset on`, h.ai_disclosure === true);
    ok(`manner=${manner} keeps scope boundaries on`, h.scope_boundaries === true);
    ok(`manner=${manner} keeps the number read-back on`, h.echo_verification === true);
  }
}
{
  // And nobody has edited the rule itself out from under all of the above.
  const prompt = read("lib/voice/prompt.js");
  ok("SYSTEM_RULES still opens with the price rule at number one",
    /1\.\s*NEVER give a price\./.test(prompt));
  ok("...and still says the rules override anything told later",
    /override anything else you are told/.test(prompt));
  ok("...and prompt.js knows nothing about tuning",
    !/agentTuning/.test(prompt));
}

/* ══════════════════════════════════════════════════════════════════════════
   8. The screen says it in the contractor's words
   ══════════════════════════════════════════════════════════════════════════
   A setting nobody can read is a setting nobody will touch, and one they touch
   without understanding is worse. Every option needs a name and a sentence —
   and the sentence is where the latency-versus-quality trade lives, because
   "0.6" tells the person paying for it nothing. */
console.log("\nEvery option is legible, and says what it costs");
for (const field of TUNING_FIELDS) {
  ok(`${field} has a heading`, Boolean(TUNING_TITLE_TEXT[tuningTitleKey(field)]));
  for (const value of TUNING_SETTINGS[field].values) {
    const label = TUNING_LABEL_TEXT[tuningLabelKey(field, value)];
    const hint = TUNING_HINT_TEXT[tuningHintKey(field, value)];
    ok(`${field}/${value} has a name`, Boolean(label) && label.length < 40, label);
    ok(`${field}/${value} says what it does`, Boolean(hint) && hint.length > 40);
    // Provider vocabulary must not leak onto a contractor's screen. "Deepgram",
    // "denoising", "0.7" and "sensitivity" are the words that turn a settings
    // card into a mixing desk.
    const jargon = /deepgram|soniox|assemblyai|azure|denois|sensitivity|responsiveness|backchannel|latency|\bASR\b|\bLLM\b|\bSTT\b/i;
    ok(`${field}/${value} uses no provider jargon`, !jargon.test(`${label} ${hint}`),
      `${label} — ${hint}`);
  }
}
{
  // The three settings that trade speed against quality must SAY so. Checked
  // against the words, not against a comment: the owner reads the card.
  const speaks = (field) =>
    TUNING_SETTINGS[field].values
      .map((v) => TUNING_HINT_TEXT[tuningHintKey(field, v)])
      .join(" ");
  const speedWords = /fast|faster|fastest|quick|instant|soonest|sooner|slower|later|delay|wait|beat|moment/i;
  for (const field of ["background", "pace", "manner"]) {
    ok(`${field} states the speed side of its trade in the copy`, speedWords.test(speaks(field)));
  }
  // The one option with a real per-minute surcharge has to name it. A setting
  // that quietly costs money is the toll-free mismatch again.
  ok("the crowded-site option names its surcharge",
    /cent|¢|\$/i.test(TUNING_HINT_TEXT[tuningHintKey("background", "crowded")]));
}
{
  const page = read("app/app/settings/voice/page.js");
  ok("the settings card renders the picker", /<SoundPicker\b/.test(page));
  ok("...off the server's option list, not a list typed into the page",
    /settings=\{data\?\.tuning\?\.settings\}/.test(page) && /fields=\{data\?\.tuning\?\.fields\}/.test(page));
  // Comments stripped: the ones in this file discuss the provider names in
  // order to explain why they are not here. It is the CODE that must not
  // contain them, because a browser posting a provider value would be a browser
  // deciding a provider setting.
  ok("...and posts CODES, never provider values",
    !/interruption_sensitivity|denoising_mode|responsiveness/.test(code(page)));
  ok("...the four values are loaded from the normalised server payload",
    /\.\.\.\(d\.tuning\?\.values \|\| \{\}\)/.test(page));
  ok("...and committed by the same Save that pushes the greeting",
    /onClick=\{\(\) => save\(form\)\}/.test(page));
  ok("...with the price refusal restated where somebody is changing behaviour",
    /app\.setVoice\.tune\.unchanged/.test(page));
}

/* ══════════════════════════════════════════════════════════════════════════
   9. The column names, once
   ══════════════════════════════════════════════════════════════════════════
   Four codes, four columns, and three files that need the mapping. A second
   hand-typed copy is the one that rots (AGENTS.md failure class #4) — so the
   schema is asserted against the generated names rather than against a list
   written out here. */
console.log("\nThe schema matches the columns the code derives");
{
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model VoiceAgent {"));
  const body = model.slice(0, model.indexOf("\n}"));
  for (const field of TUNING_FIELDS) {
    const col = tuningColumn(field);
    ok(`${col} exists on VoiceAgent`, new RegExp(`\\b${col}\\s+String`).test(body));
    ok(`...with the same default the code uses`,
      new RegExp(`\\b${col}\\s+String\\s+@default\\("${TUNING_DEFAULTS[field]}"\\)`).test(body),
      body.match(new RegExp(`\\b${col}[^\\n]*`))?.[0]);
  }
  ok("TUNING_COLUMNS covers all four", Object.keys(TUNING_COLUMNS).length === TUNING_FIELDS.length);
  // Provider numbers in the database would tie every existing row to one
  // vendor's scale — a data migration instead of a change to one file. The `///`
  // doc comments on these columns explain that, so they are stripped first.
  ok("no provider value is stored in the schema",
    !/interruption_sensitivity|denoising_mode|no-denoise/.test(code(body)));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
