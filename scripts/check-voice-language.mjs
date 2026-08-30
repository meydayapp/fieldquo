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
import { agentLanguage, VOICE_LANGUAGES } from "@/lib/voice/agentLanguage";
import { buildAgentPrompt, buildGreeting } from "@/lib/voice/prompt";

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
  ok(/agentLanguage\(/.test(src), `…and calls the shared one`);
}
// es-419 is a valid Intl locale, which is the other half of triggers.js's job.
ok(
  new Intl.DateTimeFormat(agentLanguage("es"), { month: "long" }).format(new Date("2026-08-12T12:00:00Z")) === "agosto",
  "the same locale formats a spoken date in Spanish — one value, both jobs",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
