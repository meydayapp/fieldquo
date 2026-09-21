// lib/sales/calls/outcomeSettings.js
//
// The platform settings behind the call-outcome features, as a TABLE: key,
// default, bounds, and the cost each one carries — so the screen that edits
// them prints the price beside the switch, and a value outside its bounds
// falls back to the default rather than reaching a rep's queue.
//
// ══ Where the shape comes from ════════════════════════════════════════════
//
// OMniLeads (LGPL-3.0, read for design only — never copied) keeps these on
// the campaign's Queue and on the agent Grupo:
//
//   Queue.servicelevel              (ominicontacto_app/models.py ~1786) — the
//                                   seconds an inbound call may wait and
//                                   still count as "answered in time";
//                                   handed to Asterisk's queue config
//                                   (asterisk_config_generador_de_partes.py
//                                   ~303) which computes the percentage.
//   Queue.transcription_percentage  (~1805) and summarize_percentage (~1801)
//                                   — 0–100, the share of recorded calls the
//                                   model reads.
//   Queue.detectar_contestadores    (~1799) and audio_para_contestadores
//                                   (~1817) — answering-machine detection on
//                                   or off per campaign, and the audio to
//                                   play a machine.
//   AmdConf                         (configuracion_telefonia_app/models.py
//                                   ~607–627) — Asterisk's AMD thresholds:
//                                   initial_silence, greeting,
//                                   after_greeting_silence,
//                                   total_analysis_time and so on. Twilio's
//                                   equivalents are machineDetectionTimeout,
//                                   machineDetectionSpeechThreshold,
//                                   machineDetectionSpeechEndThreshold and
//                                   machineDetectionSilenceTimeout; left at
//                                   Twilio's defaults here on purpose — a
//                                   knob nobody has measured is a knob
//                                   nobody should be offered.
//   Grupo.limitar_agendas_personales / cantidad_agendas_personales /
//   limitar_agendas_personales_en_dias / tiempo_maximo_para_agendar
//                                   (~297–305), read by
//                                   AgenteProfile.permite_agenda_personal and
//                                   tiempo_maximo_para_agendar (~525–535) —
//                                   how many personal callbacks an agent may
//                                   hold open and how many days ahead.
//
// FieldQuo has one floor, not many campaigns, so these are platform-wide
// keys in PlatformSetting rather than per-queue columns. The names are the
// ones the brief fixed.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// No db. outcomeSettingsStore.js reads and writes the rows; this file
// decides what a value means and what a bad one becomes.

/** The PlatformSetting key every value below is stored under, as one JSON object. */
export const OUTCOME_SETTINGS_KEY = "sales.outcomes";

/** Twilio's published price for answering-machine detection, per call. */
export const AMD_USD_PER_CALL = 0.0075;

/**
 * The table. `kind` decides the parse: "int" (with min/max), "percent"
 * (0–100), "bool", "url". `cost` is the sentence the screen prints beside
 * the control — never a number invented here; each one names its source.
 */
export const OUTCOME_SETTINGS = Object.freeze({
  "sales.callback.graceMinutes": Object.freeze({
    kind: "int",
    default: 15,
    min: 0,
    max: 24 * 60,
    label: "Callback grace before it goes global",
    unit: "minutes",
    help:
      "A callback is personal — delivered to the rep who promised it. When that rep is off at the hour, the callback waits this long and then becomes global: the next available rep who can take the call (same language rule as the inbound line) gets it at the top of their queue.",
    cost: null,
  }),
  "sales.callback.maxOpenPerRep": Object.freeze({
    kind: "int",
    default: 25,
    min: 1,
    max: 500,
    label: "Open personal callbacks a rep may hold",
    unit: "callbacks",
    help: "The disposition sheet refuses a new callback past this. A rep with fifty open promises is a rep who is parking the pool.",
    cost: null,
  }),
  "sales.callback.maxDaysAhead": Object.freeze({
    kind: "int",
    default: 14,
    min: 1,
    max: 60,
    label: "How far ahead a callback may be booked",
    unit: "days",
    help: "The sheet refuses a later date. Sixty is the hard ceiling in code (lib/sales/calls/dispositions.js MAX_CALLBACK_DAYS); this is the floor's own, tighter number.",
    cost: null,
  }),
  "sales.inbound.serviceLevelSeconds": Object.freeze({
    kind: "int",
    default: 20,
    min: 1,
    max: 600,
    label: "Inbound service level",
    unit: "seconds",
    help: "An inbound call answered within this many seconds of arriving counts as answered in time. The performance page reports the share, the abandoned count and the waits against it.",
    cost: null,
  }),
  "sales.transcription.percent": Object.freeze({
    kind: "percent",
    default: 100,
    label: "Share of recorded calls transcribed",
    unit: "%",
    help:
      "Every recorded call is transcribed at 100. Lower it and a deterministic share is skipped — the same calls on every run (a hash of the call id), so nothing is picked twice or dropped by luck. A call a superadmin opens on the review screen is always transcribed on demand regardless.",
    cost: "Whisper is billed per audio minute (lib/sales/calls/transcribe.js TRANSCRIBE_USD_MICROS_PER_MINUTE); lowering this lowers that line in proportion.",
  }),
  "sales.aiReview.percent": Object.freeze({
    kind: "percent",
    default: 100,
    label: "Share of transcribed calls the model scores",
    unit: "%",
    help: "Same rule as transcription, applied to the scorecard. A call not in the sample is marked so on the review screen and can be scored by hand from there.",
    cost: "About a tenth of a cent a call at today's model (the review screen's own words); lowering this lowers it in proportion.",
  }),
  "sales.amd.enabled": Object.freeze({
    kind: "bool",
    default: false,
    label: "Answering-machine detection",
    unit: null,
    help:
      "When on, every browser dial asks Twilio to listen for a machine (DetectMessageEnd) and post the verdict to FieldQuo while the call is already bridged — the rep's connection is never delayed. A machine verdict files the call as voicemail in the reports even when the clock says a minute, feeds the voicemail retry rule, and tells the rep on the call card.",
    cost: `Twilio bills $${AMD_USD_PER_CALL.toFixed(4)} per call with detection on (twilio.com/en-us/voice/pricing/us, read 2026-09-21). Turning this on is the cost approval.`,
  }),
  "sales.amd.voicemailDropUrl": Object.freeze({
    kind: "url",
    default: "",
    label: "Voicemail drop to play a machine",
    unit: null,
    help:
      "Empty (the default): the rep is told \"Machine detected\" on the call card and leaves the message in their own voice, or hangs up. With a public audio URL here, a machine_end verdict plays that file to the machine and hangs up the prospect leg. NEVER played to a human — only a machine_end_* verdict triggers it.",
    cost:
      "Legal, not money: a pre-recorded message left on a machine is what Washington RCW 80.36.400 fines at $1,000 a time (lib/sales/calls/dispositions.js, the voicemail outcome). FieldQuo has refused to leave one until now. Leave this empty unless you have taken that advice.",
  }),
});

export const OUTCOME_SETTING_KEYS = Object.freeze(Object.keys(OUTCOME_SETTINGS));

/** Every default, as the object the store falls back to. */
export function outcomeDefaults() {
  const out = {};
  for (const key of OUTCOME_SETTING_KEYS) out[key] = OUTCOME_SETTINGS[key].default;
  return out;
}

function parseOne(spec, raw) {
  if (raw === undefined || raw === null) return { value: spec.default, usedDefault: true, reason: "absent" };
  if (spec.kind === "bool") {
    if (typeof raw === "boolean") return { value: raw, usedDefault: false, reason: null };
    if (raw === "true" || raw === "false") return { value: raw === "true", usedDefault: false, reason: null };
    return { value: spec.default, usedDefault: true, reason: "not_boolean" };
  }
  if (spec.kind === "url") {
    if (typeof raw !== "string") return { value: spec.default, usedDefault: true, reason: "not_string" };
    const s = raw.trim();
    if (s === "") return { value: "", usedDefault: false, reason: null };
    // https only, and only a real URL: a value Twilio cannot fetch is a
    // drop that silently never plays, which is a dead setting.
    try {
      const u = new URL(s);
      if (u.protocol !== "https:") return { value: spec.default, usedDefault: true, reason: "not_https" };
      return { value: u.toString(), usedDefault: false, reason: null };
    } catch {
      return { value: spec.default, usedDefault: true, reason: "not_url" };
    }
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isInteger(n)) return { value: spec.default, usedDefault: true, reason: "not_integer" };
  const min = spec.kind === "percent" ? 0 : spec.min;
  const max = spec.kind === "percent" ? 100 : spec.max;
  if (n < min || n > max) return { value: spec.default, usedDefault: true, reason: "out_of_range" };
  return { value: n, usedDefault: false, reason: null };
}

/**
 * The effective settings from whatever the row holds. Total: any shape in,
 * a complete object out, with `fallbacks` naming every key that did not
 * survive its bounds so the screen can say so rather than silently
 * showing the default as if it had been chosen.
 *
 * @returns {{ values: object, fallbacks: Array<{key, reason}> }}
 */
export function effectiveOutcomeSettings(stored) {
  const src = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const values = {};
  const fallbacks = [];
  for (const key of OUTCOME_SETTING_KEYS) {
    const r = parseOne(OUTCOME_SETTINGS[key], src[key]);
    values[key] = r.value;
    if (r.usedDefault && r.reason !== "absent") fallbacks.push({ key, reason: r.reason });
  }
  return { values, fallbacks };
}

/**
 * Validate a superadmin's edit BEFORE it is stored. Refuses with a plain
 * sentence per bad key rather than storing a value the reader above would
 * quietly replace — a save that "worked" and changed nothing is the dead
 * control AGENTS.md forbids.
 *
 * @returns {{ ok: true, values } | { ok: false, errors: string[] }}
 */
export function validateOutcomeSettingsEdit(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : null;
  if (!src) return { ok: false, errors: ["Send an object of settings."] };
  const errors = [];
  const values = {};
  for (const [key, raw] of Object.entries(src)) {
    const spec = OUTCOME_SETTINGS[key];
    if (!spec) {
      errors.push(`"${key}" is not a setting this build knows.`);
      continue;
    }
    const r = parseOne(spec, raw);
    if (r.usedDefault && r.reason !== "absent") {
      const range = spec.kind === "percent" ? "0 to 100" : spec.kind === "int" ? `${spec.min} to ${spec.max}` : spec.kind === "bool" ? "true or false" : "an https URL, or empty";
      errors.push(`${spec.label}: ${JSON.stringify(raw)} is not allowed — it has to be ${range}.`);
      continue;
    }
    if (r.reason === "absent") continue;
    values[key] = r.value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** The rows the platform screen draws: spec + current value + whether it is the default. */
export function outcomeSettingsTable(values = outcomeDefaults()) {
  return OUTCOME_SETTING_KEYS.map((key) => {
    const spec = OUTCOME_SETTINGS[key];
    return {
      key,
      kind: spec.kind,
      label: spec.label,
      unit: spec.unit,
      help: spec.help,
      cost: spec.cost,
      min: spec.kind === "percent" ? 0 : spec.min ?? null,
      max: spec.kind === "percent" ? 100 : spec.max ?? null,
      default: spec.default,
      value: values[key],
      isDefault: values[key] === spec.default,
    };
  });
}
