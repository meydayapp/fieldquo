// scripts/check-voice-language.mjs
//
// Which language the receptionist actually speaks.
//
// ══ The gap this was written for ═══════════════════════════════════════════
//
// The provider's `language` field sets transcription and constrains the voice.
// It does NOT tell the model what to say. Every prompt in lib/voice/prompt.js
// is English and nothing in it named a language, so the receptionist answered
// in English no matter what a company was set to — including a French one,
// unless its owner happened to type a French greeting by hand. That was already
// wrong before Spanish existed; adding a Spanish VOICE without fixing it would
// have shipped an agent reading English words in a Spanish accent, which is
// failure class "a control that appears to work and doesn't" with the volume
// turned up.
//
// ══ Why both halves are asserted together ═════════════════════════════════
//
// A language is only real when it has a provider locale AND a greeting AND a
// prompt rule. Any one of the three alone is a dead control, and the three live
// in different files, which is exactly how they would drift.
//
// ══ And then the selector ═════════════════════════════════════════════════
//
// The phone used to follow the company language. Now it has its own setting
// (VoiceAgent.spokenLanguage) with three single languages and two bilingual
// pairs, and every value has to land as a locale Retell's enum actually holds
// — an array for a pair, never the deprecated `multi` — with a greeting in
// both languages, a prompt that follows the caller, a date in each locale,
// and a voice list filtered to what can pronounce it. Sections 6–10.
import {
  agentLanguage,
  VOICE_LANGUAGES,
  SPOKEN_LANGUAGE_VALUES,
  isSpokenLanguage,
  resolveSpokenLanguage,
  receptionistSpeaks,
  spokenLocales,
  retellLanguage,
  primaryLanguage,
} from "@/lib/voice/agentLanguage";
import { buildAgentPrompt, buildGreeting } from "@/lib/voice/prompt";
import { splitByLocales, voiceSupportsLocales, pickableVoices, SHORTLIST } from "@/lib/voice/voices";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const COMPANY = { name: "Peintures Boves" };
const ruleFor = (language) => {
  const lines = buildAgentPrompt({ company: COMPANY, language }).split("\n");
  const i = lines.indexOf("LANGUAGE");
  return i === -1 ? null : lines[i + 1];
};

section("1. The provider is told the right locale");

ok(agentLanguage("en") === "en-US", "English", agentLanguage("en"));
ok(agentLanguage("fr") === "fr-CA", "French is Canadian French — this product ships Quebec area codes", agentLanguage("fr"));
// es-419 over es-ES: the Spanish spoken by the crews and customers this
// product actually has.
ok(agentLanguage("es") === "es-419", "Spanish is Latin American Spanish", agentLanguage("es"));

section("2. A language with no prompt behind it stays English, and says so");

for (const unspoken of ["uk", "pa", "tl"]) {
  // Retell's enum has locales for these. The prompt does not, and setting the
  // provider's language without translating what the agent SAYS produces
  // English words in a Punjabi accent — worse than English, and much harder for
  // an owner to notice than a receptionist that plainly speaks English.
  ok(
    agentLanguage(unspoken) === "en-US",
    `${unspoken} is not claimed before lib/voice/prompt.js can hold the conversation`,
    agentLanguage(unspoken),
  );
  ok(
    !VOICE_LANGUAGES.includes(unspoken),
    `…and ${unspoken} is not listed as one the receptionist speaks`,
  );
}
ok(agentLanguage(null) === "en-US" && agentLanguage(undefined) === "en-US", "junk resolves to a locale rather than null — every caller needs one");
ok(agentLanguage("FR") === "en-US", "an unrecognised spelling is not guessed at");

section("3. The model is TOLD which language, because the locale does not tell it");

ok(/LANGUAGE/.test(buildAgentPrompt({ company: COMPANY })), "the prompt has a LANGUAGE section at all");
ok(/English/.test(ruleFor("en")), "English is stated explicitly, not left as the absence of an instruction", ruleFor("en"));
ok(/French/.test(ruleFor("fr")), "a French company's agent is told to speak French", ruleFor("fr"));
ok(/Spanish/.test(ruleFor("es")), "a Spanish company's agent is told to speak Spanish", ruleFor("es"));
ok(!/French|Spanish/.test(ruleFor("en")), "…and an English one is not told to speak either");
ok(/English/.test(ruleFor("pa")), "a language with no prompt behind it is told English, matching what its agent is set to");
// A bilingual caller is normal in Montreal and in half this product's market.
for (const l of VOICE_LANGUAGES) {
  ok(
    /switch to theirs/.test(ruleFor(l)),
    `${l}: the agent follows a caller who speaks something else — the setting is where to START, not a wall`,
  );
}

section("4. The FIRST thing a caller hears is in their language");

ok(/Thanks for calling/.test(buildGreeting({ company: COMPANY })), "English", buildGreeting({ company: COMPANY }));
ok(
  /Merci/.test(buildGreeting({ company: COMPANY, language: "fr" })),
  "French — an English 'Thanks for calling' out of a French company's phone says they reached the wrong business",
  buildGreeting({ company: COMPANY, language: "fr" }),
);
ok(
  /Gracias/.test(buildGreeting({ company: COMPANY, language: "es" })),
  "Spanish",
  buildGreeting({ company: COMPANY, language: "es" }),
);
for (const l of VOICE_LANGUAGES) {
  ok(
    buildGreeting({ company: COMPANY, language: l }).includes(COMPANY.name),
    `${l}: the company's own name is in it — white-label by default, the caller rang THEM`,
  );
}
ok(
  buildGreeting({ company: COMPANY, greeting: "Allô!", language: "es" }) === "Allô!",
  "an owner's own greeting wins over every default — they know their callers",
);
ok(
  !/FieldQuo/i.test(
    VOICE_LANGUAGES.map((l) => buildGreeting({ company: COMPANY, language: l })).join(" "),
  ),
  "and no greeting leaks FieldQuo into the first sentence a homeowner hears",
);
ok(buildGreeting().length > 0, "no arguments at all still answers the phone");

section("5. One rule, not a copy per caller");

// It was two ternaries — provision.js deciding what the agent SPEAKS and
// triggers.js deciding how it reads a date back. Teaching only the first would
// have produced an agent speaking Spanish and announcing "Tuesday, August 12"
// in the middle of it. Failure class 4 in AGENTS.md.
import { readFileSync } from "node:fs";
const sources = ["lib/voice/provision.js", "lib/voice/triggers.js"];
for (const f of sources) {
  const src = readFileSync(f, "utf8");
  ok(!/language === "fr" \? "fr-CA"/.test(src), `${f} no longer carries its own copy of the rule`);
  ok(/from "\.\/agentLanguage"/.test(src), `…and imports the shared one`);
}
// availability.js reads a slot out loud and used to do it in en-CA whatever
// the agent spoke — the third copy of the rule, hiding as a hardcoded locale.
{
  const src = readFileSync("lib/voice/availability.js", "utf8");
  ok(!/DateTimeFormat\("en-CA"/.test(src), "availability.js no longer formats a spoken slot in a fixed locale");
  ok(/from "\.\/agentLanguage"/.test(src), "…and reads the agent's own language for it");
}
// es-419 is a valid Intl locale, which is the other half of triggers.js's job.
ok(
  new Intl.DateTimeFormat(agentLanguage("es"), { month: "long" }).format(new Date("2026-08-12T12:00:00Z")) === "agosto",
  "the same locale formats a spoken date in Spanish — one value, both jobs",
);

section("6. Every selector value maps to a locale (or locales) Retell's enum holds");

// The enum, as read from https://docs.retellai.com/api-references/create-agent
// on 2026-09-17. Only the entries this product can reach are listed; the
// point is that nothing we SEND is outside it.
const RETELL_ENUM = new Set(["en-US", "en-GB", "en-AU", "en-NZ", "en-IN", "fr-FR", "fr-CA", "es-ES", "es-419", "fil-PH", "uk-UA"]);
ok(SPOKEN_LANGUAGE_VALUES.length === 5, "five values: three single, two bilingual", SPOKEN_LANGUAGE_VALUES);
for (const value of SPOKEN_LANGUAGE_VALUES) {
  for (const company of ["en", "fr", "es", "uk", "pa", "tl", "de", "it"]) {
    const locales = spokenLocales(value, company);
    ok(
      locales.length >= 1 && locales.every((l) => RETELL_ENUM.has(l)),
      `${value} for a ${company} company → ${JSON.stringify(locales)}, every one in the enum`,
    );
  }
  const sent = retellLanguage(spokenLocales(value));
  ok(
    sent !== "multi" && !(Array.isArray(sent) && sent.includes("multi")),
    `${value} never sends the deprecated "multi" scalar (it means ten fixed languages, es-ES and fr-FR among them)`,
    sent,
  );
  ok(
    value.includes("-") ? Array.isArray(sent) && sent.length === 2 : typeof sent === "string",
    `${value} is sent as ${value.includes("-") ? "an array of two locales" : "one bare locale"}`,
    sent,
  );
}
ok(retellLanguage(spokenLocales("en-fr", "fr"))[0] === "fr-CA", "a French company's bilingual agent leads with French — Retell falls back to the FIRST locale", retellLanguage(spokenLocales("en-fr", "fr")));
ok(retellLanguage(spokenLocales("en-fr", "en"))[0] === "en-US", "…and an English company's leads with English");
ok(retellLanguage(spokenLocales("en-fr", "pa"))[0] === "en-US", "…and a company on a language outside the pair leads with English");
ok(retellLanguage(spokenLocales("en-es", "es"))[0] === "es-419", "same for Spanish: es-419 first for a Spanish company");
ok(primaryLanguage("en-fr", "fr") === "fr" && primaryLanguage("en-fr", "en") === "en", "the default voice is picked for the leading language");

section("7. The stored value is gated, and absence means 'follow the company'");

for (const junk of [null, undefined, "", "multi", "fr-CA", "FR", "en-fr-es", "constructor", 42]) {
  ok(!isSpokenLanguage(junk), `${JSON.stringify(junk)} is not a selector value`);
}
ok(resolveSpokenLanguage(null, "fr") === "fr", "no choice + French company → French, exactly what the phone did before");
ok(resolveSpokenLanguage(null, "es") === "es", "no choice + Spanish company → Spanish");
ok(resolveSpokenLanguage(null, "en") === "en", "no choice + English company → English");
ok(resolveSpokenLanguage("multi", "fr") === "fr", "a value from a rolled-back release resolves to the company rule, never reaches the provider");
ok(resolveSpokenLanguage("en-es", "fr") === "en-es", "a real choice wins over the company language — that is the point of the selector");
for (const unspoken of ["uk", "pa", "tl", "de", "it"]) {
  ok(resolveSpokenLanguage(null, unspoken) === "en", `${unspoken}: no choice → English`);
  ok(!receptionistSpeaks(unspoken), `${unspoken}: receptionistSpeaks() is false — this is the flag the settings card shows the limitation sentence on`);
}
for (const l of VOICE_LANGUAGES) ok(receptionistSpeaks(l), `${l}: the receptionist speaks it, no limitation sentence`);

section("8. The limitation sentence is on the screen for uk / pa / tl, in the owner's language");

{
  const page = readFileSync("app/app/settings/voice/page.js", "utf8");
  ok(/saved && !saved\.spoken/.test(page), "the settings card renders the sentence exactly when the server says the receptionist cannot speak the company language");
  ok(/app\.setVoice\.language\.cannot/.test(page), "…under its own translation key");
  const route = readFileSync("app/api/settings/voice/route.js", "utf8");
  ok(/spoken: receptionistSpeaks\(/.test(route), "…and the server computes that flag from the shared rule, not a second list");
  ok(/spokenLanguage/.test(route) && /isSpokenLanguage\(body\.spokenLanguage\)/.test(route), "the PUT validates the selector value and refuses strangers");
  ok(/provisionAgent\(member\.companyId/.test(route), "…and the same PUT re-provisions the agent, so a language change reaches the phone the way a voice change does");
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  for (const code of Object.keys(APP_MESSAGES)) {
    const text = APP_MESSAGES[code]["app.setVoice.language.cannot"];
    ok(typeof text === "string" && text.includes("{language}"), `${code}: the limitation sentence exists and names the company language`);
  }
  for (const value of SPOKEN_LANGUAGE_VALUES) {
    ok(
      Object.keys(APP_MESSAGES).every((code) => APP_MESSAGES[code][`app.setVoice.language.${value}.label`] && APP_MESSAGES[code][`app.setVoice.language.${value}.hint`]),
      `${value}: label and hint in every catalogue language`,
    );
  }
  for (const pair of ["en-fr", "en-es"]) {
    const hint = APP_MESSAGES.en[`app.setVoice.language.${pair}.hint`];
    ok(/less accurate/.test(hint), `${pair}: the hint states the accuracy trade Retell documents for crossing language families`);
    ok(/[Cc]osts the same/.test(hint), `${pair}: …and that it costs the same, which is what the pricing page says`);
  }
}

section("9. Bilingual: the greeting has both languages, the prompt follows the caller, dates in each locale");

const bi = (spoken, language) => buildGreeting({ company: COMPANY, language, spoken });
ok(/^Bonjour, hello — /.test(bi("en-fr", "fr")), "a French company's bilingual greeting opens « Bonjour, hello »", bi("en-fr", "fr"));
ok(/^Hello, bonjour — /.test(bi("en-fr", "en")), "an English company's opens “Hello, bonjour”", bi("en-fr", "en"));
ok(/^Hello, hola — /.test(bi("en-es", "en")) && /^Hola, hello — /.test(bi("en-es", "es")), "same pattern for English–Spanish", bi("en-es", "es"));
for (const [spoken, language, a, b] of [["en-fr", "fr", /Comment puis-je vous aider\?/, /How can I help\?/], ["en-es", "en", /How can I help\?/, /¿En qué puedo ayudarle\?/]]) {
  const g = bi(spoken, language);
  ok(a.test(g) && b.test(g), `${spoken}/${language}: both languages' questions are in the one line`, g);
  ok(g.includes(COMPANY.name), `${spoken}/${language}: and the company's own name`);
  ok(g.length <= 300 && g.split(/[.?!]\s/).length <= 4, `${spoken}/${language}: one short line, not a phone menu`, g.length);
  ok((g.match(new RegExp(COMPANY.name, "g")) || []).length === 1, `${spoken}/${language}: the thank-you is said once, not once per language`);
}
ok(bi("en", "en") === buildGreeting({ company: COMPANY }), "a single language is unchanged by the selector existing");
ok(bi("fr", "en") === buildGreeting({ company: COMPANY, language: "fr" }), "…and 'fr' chosen on an English company greets exactly as a French company did");

const promptFor = (spoken, language) =>
  buildAgentPrompt({ company: COMPANY, language, spoken, timeZone: "America/Toronto" });
const langSection = (spoken, language) => {
  const lines = promptFor(spoken, language).split("\n");
  const i = lines.indexOf("LANGUAGE");
  const j = lines.indexOf("ABOUT THIS BUSINESS");
  return lines.slice(i + 1, j).join("\n");
};
{
  const r = langSection("en-fr", "fr");
  ok(/both French \(Canadian French\) and English/.test(r), "the bilingual rule names both languages", r.slice(0, 120));
  ok(/ONLY bilingual line/.test(r), "…the greeting is the only bilingual line — no phone-menu doubling");
  ok(/If they switch languages, switch with them/.test(r), "…it switches when the caller switches");
  ok(/never mix the two in one sentence/.test(r), "…and never mixes them mid-sentence");
  ok(/mardi 12 août à 14 h/.test(r) && /Tuesday, August 12 at 2:00 PM/.test(r), "…dates are demonstrated in each language, in that language");
  ok(/read only the one that matches/.test(r), "…and a tool's two-language time is read one language at a time");
  ok(/cet appel est enregistré/.test(r) && /this call's recorded/.test(r), "…the recorded-call disclosure is given in both languages");
  ok(/je suis un assistant/.test(r) && /I'm an assistant/.test(r), "…and so is the 'are you a person?' answer");
  const es = langSection("en-es", "es");
  ok(/esta llamada se graba/.test(es) && /soy un asistente/.test(es), "Spanish pair: both disclosures in Spanish too");
  const fr = langSection("fr", "fr");
  ok(/Conduct the entire call in French/.test(fr) && /cet appel est enregistré/.test(fr), "single French: the rule is unchanged and the disclosure wording is now given");
  ok(/mardi 12 août/.test(fr) && !/Tuesday/.test(fr), "…with a French date example and no English one");
  const en = langSection("en", "en");
  ok(/Conduct the entire call in English/.test(en) && !/enregistré|graba/.test(en), "single English: no foreign disclosure wording to confuse it");
}
{
  const today = (spoken, language) => promptFor(spoken, language).match(/Today is ([^.]*)\./)?.[1] || "";
  ok(/ \/ /.test(today("en-fr", "fr")) && /\d{4} \/ /.test(today("en-fr", "fr")), "a bilingual agent is told today's date in both locales", today("en-fr", "fr"));
  const fr = today("fr", "fr");
  ok(fr && !/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(fr), "a French agent's 'today' is not an English weekday", fr);
  ok(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(today("en", "en")), "an English one's is", today("en", "en"));
}

section("10. The voice picker is filtered by what a voice can pronounce, and says why");

const WIDE = [
  { voice_id: "cartesia-Andrew", voice_name: "Andrew", provider: "cartesia", gender: "male" },
  { voice_id: "cartesia-Emma", voice_name: "Emma", provider: "cartesia", gender: "female" },
  { voice_id: "cartesia-Alejandro", voice_name: "Alejandro", provider: "cartesia", gender: "male" },
  { voice_id: "fish-Willa", voice_name: "Willa", provider: "fish_audio", gender: "female" },
];
for (const value of SPOKEN_LANGUAGE_VALUES) {
  const { voices } = splitByLocales(pickableVoices(WIDE), spokenLocales(value));
  ok(
    voices.length === SHORTLIST.length,
    `${value}: every shortlisted voice survives — Cartesia covers en/fr/es on every model, so the picker is never empty`,
    voices.map((v) => v.name),
  );
}
// A documented incompatibility: Fish Audio has no Filipino on Retell's
// language-support page. Not a locale the selector can reach today, but the
// filter has to be tested against a real "no", not a table of "yes".
{
  const kept = pickableVoices(WIDE, { keep: "fish-Willa" });
  const { voices, excluded } = splitByLocales(kept, ["en-US", "fil-PH"]);
  ok(!voices.some((v) => v.id === "fish-Willa"), "a voice whose provider lacks one of the locales is not offered");
  ok(excluded.length === 1 && excluded[0].id === "fish-Willa", "…it is reported as excluded", excluded);
  ok(excluded[0].missing.join() === "fil-PH", "…with the locale it cannot pronounce, so the screen can say why", excluded[0].missing);
  ok(voices.length === SHORTLIST.length, "…and the compatible ones are untouched");
}
ok(!voiceSupportsLocales({ provider: "acme" }, ["en-US"]).ok, "an unknown provider supports nothing — a guess about somebody's business line is not a yes");
ok(voiceSupportsLocales({ provider: "cartesia" }, ["en-US", "fr-CA"]).ok, "a bilingual pair needs ONE voice that covers both, and Cartesia does");
ok(voiceSupportsLocales({ provider: "elevenlabs" }, ["en-US", "fr-CA"]).ok, "…and so does ElevenLabs, so a company still on 11labs-Adrian can go bilingual");
{
  const route = readFileSync("app/api/settings/voice/voices/route.js", "utf8");
  ok(/searchParams\.get\("language"\)/.test(route), "the voices route filters for the language the screen is SHOWING, saved or not");
  ok(/excluded:/.test(route), "…and returns the excluded ones with their reason");
  const page = readFileSync("app/app/settings/voice/page.js", "utf8");
  ok(/app\.setVoice\.voice\.excluded/.test(page), "the picker prints why a voice is missing");
  ok(/app\.setVoice\.voice\.currentCannot/.test(page), "…and warns when the voice currently chosen cannot speak the chosen language");
  const put = readFileSync("app/api/settings/voice/route.js", "utf8");
  ok(/splitByLocales\(pickableVoices\(raw/.test(put), "the PUT validates a voice against the language it will speak, not just against the provider's list");
  ok(/app\.setVoice\.language\.voiceCannot/.test(put), "…and refuses a language change the current voice cannot pronounce, by name");
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
