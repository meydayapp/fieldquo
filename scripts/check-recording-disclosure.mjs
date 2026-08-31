// scripts/check-recording-disclosure.mjs
//
// The caller is told the call is recorded.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// Every call to a contractor's FieldQuo number is recorded and transcribed —
// VoiceCall.recordingUrl and VoiceCall.transcript, both retained with no expiry
// path anywhere in the product — and the receptionist prompt never mentioned
// it. A grep for "record" across all 877 lines of lib/voice/prompt.js returned
// zero.
//
// FieldQuo's OWN sales line has disclosed it all along
// (lib/platform/salesPrompt.js). That made the gap harder to defend rather than
// easier: the sentence had been written, and put on the wrong phone.
//
// ══ Why it is separate from the AI disclosure ══════════════════════════════
//
// Rule 4 discloses being an AI ON REQUEST, and the greeting's own comment
// explains why — announcing it unprompted "makes a small business sound like a
// call centre, which is the opposite of what they're buying". Recording cannot
// work that way. A caller cannot ask about something they do not know is
// happening, so it has to be volunteered.
//
// ══ What this check does NOT claim ═════════════════════════════════════════
//
// That consent is settled. Canadian requirements vary by province, and the
// contractor — not FieldQuo — is the party recording. This asserts the floor:
// the caller is told. lib/voice/callConsent is a different question entirely
// (consent to be CONTACTED, for outbound), and conflating the two is how a
// product ends up believing it has permission it never asked for.
import { buildAgentPrompt } from "@/lib/voice/prompt";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Built, not read: the assertion must survive someone moving the sentence.
const PROMPT = buildAgentPrompt({ company: { name: "Acme Painting" }, language: "en" });

section("1. Every receptionist tells the caller");

ok(/recorded/i.test(PROMPT), "the prompt an agent actually runs mentions recording");
ok(/4b\./.test(PROMPT), "…as its own numbered rule, not buried in prose");
for (const lang of ["en", "fr", "es", "pa"]) {
  const p = buildAgentPrompt({ company: { name: "Acme" }, language: lang });
  // Including languages the receptionist does not speak yet, which still run in
  // English — a caller reaching one of those is recorded exactly the same.
  ok(/recorded/i.test(p), `${lang}: the disclosure is not lost for this language`);
}

section("2. Said once, briefly, and not performed");

ok(/once, early/.test(PROMPT), "the rule says once and early");
ok(/never repeat it/i.test(PROMPT), "…and explicitly not repeated");
ok(/do not read a legal notice/i.test(PROMPT), "…and not read as a legal notice, which would wreck the call");
// The objection path matters more than the disclosure: a caller who says no
// must get somewhere, not be argued with by a machine.
ok(/cannot turn it off/i.test(PROMPT), "a caller who objects is told plainly it cannot be switched off here");
ok(/put them through|message/i.test(PROMPT), "…and offered a person or a message instead");

section("3. It did not weaken the rules it sits between");

for (const [rule, phrase] of [
  ["never a price", "NEVER give a price"],
  ["never an unchecked time", "NEVER promise a date or time"],
  ["AI disclosed on request", "whether you are a person, an AI"],
  ["emergencies", "call the relevant emergency number"],
  ["no card details", "Do not take payment details"],
]) {
  ok(PROMPT.includes(phrase), `${rule} survives`);
}

section("4. The two consent questions stay separate");

const SRC = strip(readFileSync("lib/voice/prompt.js", "utf8"));
// CallConsent is consent to be CONTACTED, recorded per lead at intake. It is
// not consent to be RECORDED on an inbound call, and a future reader must not
// take one for the other.
ok(
  !/callConsent|recordConsent/.test(SRC),
  "the prompt does not reach for the outbound-contact consent model to answer a recording question",
);
ok(
  /salesPrompt/.test(readFileSync("lib/voice/prompt.js", "utf8")),
  "the comment names where the sentence already existed, so the history is not lost",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
