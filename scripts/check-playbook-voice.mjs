// scripts/check-playbook-voice.mjs
//
//   npm run check:playbook-voice
//
// The owner read the first AI call script and the rules playbook for a real
// prospect (South County Electric, LLC) and sent back six corrections. This
// file holds the ones that live in the RULES and the SCREEN; the call-script
// prompt's half is scripts/check-call-script.mjs section 7.
//
//   1. The stage copy is not for the rep. "Establish relevance — One sentence
//      that could only have been said to this business…" is an author's note.
//      On the rep's screen a stage shows a two-word name and the lines, and
//      the note is collapsed, off by default. Nine languages for the names.
//   2. Reps are not tech support. "I'll put that button on the site you
//      already have" and every "I'll build / set it up" is gone from the
//      rules, the objection library, the battlecards and the prompt; the
//      next step everywhere is a fifteen-minute demo.
//   3. No hard-coded times in the close. "Thursday at eight then" is a rule
//      line a rep reads out on a Tuesday. No weekday name and no clock time
//      in any close.
//   4. The email the crawler read off their site reaches the lead:
//      Prospect.email from the strongest EMAIL_CONTACT evidence, junk refused,
//      copied onto a lead only when the lead has none.
//   5. Three distinct next steps — demo, sent to sign up, walkthrough with a
//      specialist — with their kinds, their lengths, where each books, and
//      the onboarding gate on the walkthrough.
//
// ══ Executed, not only read ═══════════════════════════════════════════════
//
// The seeds are built with the real seed functions and swept sentence by
// sentence. The email rule runs against fixture evidence. The walkthrough
// gate runs its four branches. hostsFreeFor is driven with a host who is
// free for one slot and not two. Source is read, with comments stripped,
// only for the properties that ARE source properties: which component
// renders what, and behind which element.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Six assertions were each broken on disk with a one-line edit, confirmed to
// fail here by exit code, and restored from a `cp` backup — never
// `git checkout`. The list is in the commit that added this file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { STAGES, STAGE_KEYS } from "@/lib/sales/playbook/stages";
import { seedPlaybooks, NEXT_STEP_OFFER, CLOSE_ASK } from "@/lib/sales/playbook/defaults";
import { seedObjections } from "@/lib/sales/playbook/objections";
import { battlecards } from "@/lib/sales/playbook/battlecards";
import { playbookMoments } from "@/lib/sales/playbook/moments";
import { buildCallScript } from "@/lib/sales/playbook/script";
import { CALL_SCRIPT_SYSTEM, CALL_SCRIPT_STYLE_RULES, callScriptInputs, callScriptPrompt } from "@/lib/sales/intel/callScript";
import { TALKING_POINT_SYSTEM } from "@/lib/sales/playbook/generate";
import { emailFromEvidence, normaliseEmailEvidence } from "@/lib/sales/intel/prospectEmail";
import { prospectView } from "@/lib/sales/prospectView";
import {
  NEXT_STEP_KINDS,
  NEXT_STEP_MINUTES,
  SIGNUP_SENT_STATUS,
  WALKTHROUGH_SOURCE,
  endOf,
  onboardingProgress,
  walkthroughGate,
} from "@/lib/sales/nextSteps";
import { LEAD_STATUSES } from "@/lib/sales/outreachPipeline";
import { EVENT_TYPES } from "@/lib/sales/calendar/event";
import { REP_CALENDAR_WRITES } from "@/lib/sales/calendar/gate";
import { REP_OUTREACH_WRITES } from "@/lib/sales/outreachGate";
import { DEMO_TZ, SLOT_MINUTES, assembleHosts, availableSlotsByDayFor, hostsFreeAt, hostsFreeFor } from "@/lib/demo/slots";
import { bookingSpan } from "@/lib/demo/bookingSpan";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)?.slice(0, 400)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

const catalogue = read("app/i18n/appMessages.js");
const timesInCatalogue = (key) => (catalogue.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) || []).length;
const NINE = LANGUAGE_CODES.length + 1; // the eight in languages.js plus zh, which the catalogue carries

// ═══════════════════════════════════════════════════════════════════════════
section("1. The rep's screen shows a two-word stage name and the lines — the author's note is collapsed");
// ═══════════════════════════════════════════════════════════════════════════

{
  const wanted = {
    open: "Open",
    relevance: "Why them",
    discovery: "Ask",
    current_process: "How it works today",
    pain: "What it costs them",
    fit: "What we do",
    objections: "If they push back",
    next_step: "Next step",
    close: "Wrap up",
  };
  ok("there are nine stages, in call order", STAGE_KEYS.join(",") === Object.keys(wanted).join(","), STAGE_KEYS);
  for (const s of STAGES) {
    ok(`${s.key}: is named "${wanted[s.key]}"`, s.name === wanted[s.key], s.name);
    ok(`${s.key}: the name is four words or fewer`, s.name.split(/\s+/).length <= 4);
    ok(`${s.key}: carries the catalogue key for it`, s.nameKey === `app.salesCall.stage.${s.key}`, s.nameKey);
    ok(`${s.key}: …which is in the catalogue nine times`, timesInCatalogue(s.nameKey) === 9, timesInCatalogue(s.nameKey));
    ok(`${s.key}: the author's note is still there for the author`, typeof s.purpose === "string" && s.purpose.length > 30);
  }
  ok("(the catalogue carries nine languages)", NINE === 9);

  // The built script hands both to the screen.
  const built = buildCallScript({ playbook: { stages: seedPlaybooks()[0].stages }, prospect: { businessName: "Acme" }, rep: { name: "Dana" } });
  ok("buildCallScript passes nameKey and purpose on every stage", built.stages.every((st) => st.nameKey === `app.salesCall.stage.${st.stageKey}` && typeof st.purpose === "string"));

  const screen = decomment(read("app/components/sales/CallPlaybook.js"));
  ok("the screen prints the stage name through the catalogue key", /\{stage\.nameKey \? t\(stage\.nameKey, stage\.name\) : stage\.name\}/.test(screen));
  ok("…and the jump list too", /\{s\.nameKey \? t\(s\.nameKey, s\.name\) : s\.name\}/.test(screen));
  // The note may appear in exactly one place: inside a <details> with no
  // `open` attribute. A <p> printing it outside one is the regression.
  const purposeUses = [...screen.matchAll(/stage\.purpose\}/g)].length;
  ok("the author's note is printed exactly once", purposeUses === 1, purposeUses);
  const detailsBlock = screen.match(/<details[^>]*data-testid="stage-purpose"[^>]*>[\s\S]*?<\/details>/)?.[0] || "";
  ok("…inside a <details> element", /\{stage\.purpose\}/.test(detailsBlock));
  ok("…that is closed by default — no `open`", !/<details[^>]*\bopen\b/.test(detailsBlock), detailsBlock.slice(0, 80));
  ok("…under a summary that says why the stage exists", /app\.salesCall\.whyStage/.test(detailsBlock) && timesInCatalogue("app.salesCall.whyStage") === 9);
  ok("…and never as a bare paragraph above the line", !/<p[^>]*>\{stage\.purpose\}<\/p>/.test(screen.replace(detailsBlock, "")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Reps are not tech support: no 'I'll put / build / set up … on your site' anywhere");
// ═══════════════════════════════════════════════════════════════════════════

// The sentences that were retired, and the pattern that catches them and
// their spellings. Fired at each retired sentence first, so a detector that
// stopped recognising the thing it was built for fails loudly.
const RETIRED_PROMISES = [
  "Fifteen minutes and I'll put that button on the site you already have, with the hours you're willing to accept and nothing outside them.",
  "give me your logo and the colour you use, and I'll build one real quote with your name on it and send it over.",
  "Tell me the four things you always end up asking and I'll build the form round them — your questions, not ours — on the site you already have.",
  "Give me your logo and your colour and I will build one real quote with your name on it, review and all",
  "Tell me the hours you would genuinely accept and I will set it up inside those",
  "give me one job you have already done and I will set it up the way it would really run",
  "It's an afternoon, and the afternoon is mine.",
  "I'll have something with your name on it to show you by Thursday.",
];
// "put" is a promise only when it is a thing on their site — "I will put you
// on the do-not-call list" is a switch, and "I'll put it in for the second
// week" is a diary entry; both are the rep's own job.
const TECH_SUPPORT =
  /\b(?:i(?:'ll| will) (?:put (?:that|the|a|one) (?:button|form|link|page|quote|site)\b|put \w+ on (?:the|your) (?:site|website)|build|install|set (?:it |that |one |them )?up|have (?:something|it|one) (?:with your name on it )?(?:ready|to show you))\b|the afternoon is mine|put that button on)/i;
const WEEKDAY = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
// "at nine at night" is the hour a homeowner browses a website, said in four
// of the scripts as a fact about their week; it is not an appointment. The
// lookahead keeps it, and "Thursday at eight then" still fails.
const CLOCK =
  /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|(?:half|quarter) (?:past|to) \w+|half (?:seven|eight|nine|ten|eleven|twelve|one|two|three|four|five|six)\b|at (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midday|midnight)\b(?! at night| in the morning| in the evening)|o'clock)/i;

{
  for (const s of RETIRED_PROMISES) ok(`the detector still catches "${s.slice(0, 44)}…"`, TECH_SUPPORT.test(s));
  ok("…and lets the demo offer through", !TECH_SUPPORT.test(NEXT_STEP_OFFER) && !TECH_SUPPORT.test("Give me fifteen minutes and I'll show you how it works for a business like yours."));

  const lines = [];
  for (const p of seedPlaybooks()) {
    for (const st of p.stages) {
      if (st.say) lines.push({ where: `${p.key}/${st.stageKey}`, text: st.say });
      st.prompts.forEach((q, i) => lines.push({ where: `${p.key}/${st.stageKey}/prompt[${i}]`, text: q }));
    }
  }
  for (const o of seedObjections()) lines.push({ where: `objection/${o.code}`, text: o.response });
  for (const b of battlecards()) for (const l of b.lines || []) lines.push({ where: `battlecard/${b.id || b.competitorId || "?"}/${l.beat}`, text: l.text });
  for (const m of playbookMoments()) for (const l of m.lines) lines.push({ where: `moment/${m.key}/${l.label}`, text: l.text });
  lines.push({ where: "prompt/callScript/system", text: CALL_SCRIPT_SYSTEM });
  lines.push({ where: "prompt/callScript/rules", text: CALL_SCRIPT_STYLE_RULES.join(" ") });
  lines.push({ where: "prompt/talkingPoints", text: TALKING_POINT_SYSTEM });
  ok("the sweep read the rules, the objections, the battlecards, the moments and the prompts", lines.length > 80, lines.length);
  const hits = lines.filter((l) => TECH_SUPPORT.test(l.text));
  ok("no line anywhere promises to put, build, install or set anything up for them", hits.length === 0, hits.map((h) => `${h.where}: ${h.text.match(TECH_SUPPORT)?.[0]}`));

  ok("every playbook's next step is the demo, in the one sentence", seedPlaybooks().every((p) => p.stages.find((s) => s.stageKey === "next_step").say.includes(NEXT_STEP_OFFER)));
  ok("…and every objection ends in something the prospect can do that is not a job for the rep",
    seedObjections().every((o) => /\b(?:tell me|send me|give me|show you|i will (?:send|show|do|say|ring|work|leave|tell|put you)|put it next to|look at it|stop it|mornings or afternoons)\b/i.test(o.response)),
    seedObjections().filter((o) => !/\b(?:tell me|send me|give me|show you|i will (?:send|show|do|say|ring|work|leave|tell|put you)|put it next to|look at it|stop it|mornings or afternoons)\b/i.test(o.response)).map((o) => o.code));
  ok("the call-script prompt says the rep is not tech support, by name", /The rep is not tech support/.test(CALL_SCRIPT_STYLE_RULES.join(" ")));
  ok("…and states the demo as the only next step", CALL_SCRIPT_STYLE_RULES.some((r) => /fifteen-minute demo/.test(r) && /how it works for a business like yours/.test(r)));
  const prompt = callScriptPrompt(callScriptInputs({}));
  ok("…in the assembled prompt too", /fifteen-minute demo/.test(prompt) && !TECH_SUPPORT.test(prompt));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. No weekday and no clock time in any close");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the weekday detector fires on the retired close", WEEKDAY.test("Thursday at eight then, before you're out."));
  ok("the clock detector fires on the retired closes", CLOCK.test("Thursday at half seven then") && CLOCK.test("Thursday at eight then") && CLOCK.test("first thing at 7:30am") && CLOCK.test("8 pm"));
  ok("…and not on the new one", !WEEKDAY.test(CLOSE_ASK) && !CLOCK.test(CLOSE_ASK));
  ok("…nor on 'nine at night', which is the hour a homeowner browses, not an appointment", !CLOCK.test("somebody's on your site at nine at night"));
  for (const p of seedPlaybooks()) {
    const close = p.stages.find((s) => s.stageKey === "close").say;
    const next = p.stages.find((s) => s.stageKey === "next_step").say;
    ok(`${p.key}: the close names no weekday`, !WEEKDAY.test(close), close.match(WEEKDAY)?.[0]);
    ok(`${p.key}: the close names no clock time`, !CLOCK.test(close), close.match(CLOCK)?.[0]);
    ok(`${p.key}: the close proposes the booking as mornings or afternoons`, close.startsWith(CLOSE_ASK), close.slice(0, 60));
    ok(`${p.key}: the next step names no weekday either`, !WEEKDAY.test(next), next.match(WEEKDAY)?.[0]);
  }
  for (const o of seedObjections()) {
    ok(`objection ${o.code}: names no weekday`, !WEEKDAY.test(o.response), o.response.match(WEEKDAY)?.[0]);
  }
  for (const m of playbookMoments()) {
    for (const l of m.lines) ok(`moment ${m.key}/${l.label}: names no weekday`, !WEEKDAY.test(l.text), l.text.match(WEEKDAY)?.[0]);
  }
  ok("the prompt forbids a day or a time", CALL_SCRIPT_STYLE_RULES.some((r) => /No day of the week and no clock time/.test(r)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The email the crawler read reaches the lead");
// ═══════════════════════════════════════════════════════════════════════════

{
  const rows = [
    { type: "page_content", rawValue: "info@example.com", confidence: 0.55, observedAt: "2026-09-01" },
    { type: "page_content", rawValue: "office@southcounty.com", confidence: 0.55, observedAt: "2026-09-01" },
    { type: "link", rawValue: "mailto:Sales@SouthCounty.com?subject=Quote", confidence: 0.9, observedAt: "2026-09-02" },
    { type: "link", rawValue: JSON.stringify({ href: "mailto:x@y.com", text: "" }), confidence: 0.5 },
    { type: "page_content", rawValue: "logo@2x.png", confidence: 0.55 },
  ];
  const found = emailFromEvidence(rows);
  ok("the strongest evidence wins — the mailto: over the in-text match", found?.email === "sales@southcounty.com" && found.emailSource === "mailto", found);
  ok("…stripped of mailto: and its ?subject tail, lower-cased", normaliseEmailEvidence("mailto:Sales@SouthCounty.com?subject=Quote") === "sales@southcounty.com");
  ok("with only text matches, the earliest usable one", emailFromEvidence(rows.slice(0, 2))?.email === "office@southcounty.com");
  for (const junk of ["example@example.com", "email@domain.com", "yourname@yourdomain.com", "logo@2x.png", "hero@3x.jpg", "a@sentry.io", "noreply@x.com", "bob@x", "info@domain.com", "mailto:", "", null]) {
    ok(`junk is refused: ${JSON.stringify(junk)}`, normaliseEmailEvidence(junk) === null);
  }
  ok("no usable evidence is null, never a guess", emailFromEvidence([]) === null && emailFromEvidence(null) === null && emailFromEvidence([{ type: "page_content", rawValue: "x@2x.png" }]) === null);
  ok("a crawl-extractor link row (JSON) is not an address", emailFromEvidence([rows[3]]) === null);

  const handler = decomment(read("lib/sales/pipeline/handlers/analyzeCapabilities.js"));
  ok("ANALYZE_CAPABILITIES writes Prospect.email from the EMAIL_CONTACT evidence, in the evidence transaction",
    /capability\.code === "EMAIL_CONTACT" && capability\.value === true/.test(handler) && /emailFromEvidence\(capability\.evidence\)/.test(handler) && /tx\.prospect\.updateMany\(\{\s*where: \{ id: prospectId \},\s*data: \{ email: found\.email, emailSource: found\.emailSource \}/.test(handler));
  ok("…and never clears it", !/email: null/.test(handler));

  const leads = decomment(read("app/api/sales/leads/route.js"));
  ok("the lead-from-prospect path reads the prospect's email", /email: true,/.test(leads.slice(leads.indexOf("db.prospect.findUnique"), leads.indexOf("db.prospect.findUnique") + 600)));
  ok("…copies it only when the rep typed none", /email: email \|\| source\?\.email \|\| null/.test(leads));
  ok("…and fills an existing lead only where email is null — a typed address is never overwritten", /where: \{ id: existing\.id, salesRepId: rep\.id, email: null \}/.test(leads));

  const view = prospectView({
    prospect: { id: "p", businessName: "South County Electric", email: "emma@scountyelectric.com", emailSource: "mailto" },
    capabilities: [{ code: "EMAIL_CONTACT", value: true, evidenceIds: [] }, { code: "ONLINE_BOOKING", value: false, evidenceIds: [] }],
  });
  const row = view.capabilities.find((c) => c.code === "EMAIL_CONTACT");
  ok("the prospect view shows the address beside 'Publishes an email address'", row?.text === "Publishes an email address" && row.detail === "emma@scountyelectric.com" && row.email === "emma@scountyelectric.com", row);
  ok("…and on the view itself, null when none", view.email === "emma@scountyelectric.com" && prospectView({ prospect: { id: "p" } }).email === null);
  const panel = decomment(read("app/components/sales/CallPanel.js"));
  ok("the call panel renders the copy control, from the playbook read", /<PublishedEmail email=\{playbook\?\.prospect\?\.email \|\| null\}/.test(panel));
  const route = decomment(read("app/api/sales/playbook/route.js"));
  ok("…which the playbook route returns, null when none", /email: mine\.email \|\| null/.test(route));
  const copyBtn = decomment(read("app/components/sales/PublishedEmail.js"));
  ok("…and the control renders nothing for no address", /if \(!email\) return null;/.test(copyBtn) && /navigator\.clipboard\.writeText\(email\)/.test(copyBtn));
  for (const k of ["emailFromSiteLink", "emailFromSiteText", "copyEmail", "copy", "copied"]) ok(`app.salesCall.${k} is in the catalogue nine times`, timesInCatalogue(`app.salesCall.${k}`) === 9);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Three next steps — demo, sent to sign up, walkthrough — and the gate on the third");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the three kinds, in the order the form offers them", NEXT_STEP_KINDS.join(",") === "demo,signup,walkthrough");
  ok("a demo is thirty minutes and a walkthrough an hour", NEXT_STEP_MINUTES.demo === 30 && NEXT_STEP_MINUTES.walkthrough === 60);
  ok("both calendar kinds are SalesEvent types the route accepts", EVENT_TYPES.includes("demo") && EVENT_TYPES.includes("walkthrough") && EVENT_TYPES.includes("callback"));
  const start = new Date("2026-09-14T14:00:00Z");
  ok("endOf spans the kind's length", endOf("demo", start).getTime() === start.getTime() + 30 * 60_000 && endOf("walkthrough", start).getTime() === start.getTime() + 60 * 60_000);
  ok("…and refuses a kind with no span, or no date", endOf("callback", start) === null && endOf("demo", "tomorrow") === null);
  ok("'sent to sign up' moves the lead to a status the pipeline already has", LEAD_STATUSES.includes(SIGNUP_SENT_STATUS) && SIGNUP_SENT_STATUS === "demoed");
  ok("…the one between contacted and signed", LEAD_STATUSES.indexOf(SIGNUP_SENT_STATUS) === LEAD_STATUSES.indexOf("contacted") + 1 && LEAD_STATUSES.indexOf(SIGNUP_SENT_STATUS) === LEAD_STATUSES.indexOf("signed") - 1);

  // The gate, executed on its four branches.
  const steps = (done) => ({ steps: [{ key: "logo", done: done > 0 }, { key: "pricing", done: done > 1 }, { key: "payments", done: done > 2 }], complete: done === 3 });
  ok("no lead: refused", walkthroughGate({}).allowed === false && walkthroughGate({}).reasonKey === "app.salesCall.walkthroughRefusal.no_lead");
  ok("a lead not linked to a company: refused", walkthroughGate({ lead: { id: "l" } }).reasonKey === "app.salesCall.walkthroughRefusal.not_linked");
  ok("linked, one of three steps done: refused, with the count", (() => { const g = walkthroughGate({ lead: { id: "l", convertedCompanyId: "c" }, onboarding: steps(1) }); return !g.allowed && g.reasonKey === "app.salesCall.walkthroughRefusal.onboarding_incomplete" && g.done === 1 && g.total === 3; })());
  ok("linked and complete: allowed", walkthroughGate({ lead: { id: "l", convertedCompanyId: "c" }, onboarding: steps(3) }).allowed === true);
  ok("onboardingProgress counts, and names the open steps", (() => { const p = onboardingProgress(steps(1)); return p.done === 1 && p.total === 3 && p.complete === false && p.open.join(",") === "pricing,payments"; })());
  ok("…and is null with nothing to count, never 0 of 0", onboardingProgress(null) === null);
  for (const k of ["no_lead", "not_linked", "onboarding_incomplete", "no_email", "no_slot"]) ok(`the refusal ${k} is in the catalogue nine times`, timesInCatalogue(`app.salesCall.walkthroughRefusal.${k}`) === 9);

  // The specialist's hour: two consecutive slots on one host.
  const win = (dayOfWeek, startTime, endTime) => ({ adminId: "a", dayOfWeek, startTime, endTime, timezone: DEMO_TZ });
  const SUN = new Date("2026-06-07T12:00:00Z");
  const hosts = assembleHosts([win(1, "09:00", "10:00")], []); // Monday 9–10 Eastern: two slots
  const nine = new Date("2026-06-08T13:00:00Z"); // 9:00 Eastern
  const half = new Date("2026-06-08T13:30:00Z");
  ok("a host with a one-hour window is free for the hour at nine", hostsFreeFor(hosts, nine.toISOString(), 60, SUN).length === 1);
  ok("…and free for a half hour at half past, but not for an hour", hostsFreeAt(hosts, half.toISOString(), SUN).length === 1 && hostsFreeFor(hosts, half.toISOString(), 60, SUN).length === 0);
  // Two Mondays fall inside the fourteen-day window, so the counts are per day.
  ok("an hour-long picker offers only the nine o'clock", availableSlotsByDayFor(hosts, 60, SUN).every((d) => d.slots.length === 1 && /9:00/.test(d.slots[0].label)) && availableSlotsByDayFor(hosts, SLOT_MINUTES, SUN).every((d) => d.slots.length === 2));
  const withWalk = assembleHosts([win(1, "09:00", "11:00")], [bookingSpan({ hostAdminId: "a", scheduledAt: nine, source: WALKTHROUGH_SOURCE })]);
  ok("a booked walkthrough blocks BOTH of its half hours", hostsFreeAt(withWalk, nine.toISOString(), SUN).length === 0 && hostsFreeAt(withWalk, half.toISOString(), SUN).length === 0);
  const withDemo = assembleHosts([win(1, "09:00", "11:00")], [bookingSpan({ hostAdminId: "a", scheduledAt: nine, source: "hero" })]);
  ok("…while a homepage demo blocks one, as before", hostsFreeAt(withDemo, nine.toISOString(), SUN).length === 0 && hostsFreeAt(withDemo, half.toISOString(), SUN).length === 1);
  ok("bookingSpan derives the hour from the source and one slot from anything else", bookingSpan({ source: WALKTHROUGH_SOURCE }).minutes === 60 && bookingSpan({ source: "hero" }).minutes === SLOT_MINUTES && bookingSpan({}).minutes === SLOT_MINUTES);
  for (const f of ["lib/demo/hosts.js", "lib/migrations/hosts.js"]) ok(`${f} maps bookings through bookingSpan`, /\.then\(\(rows\) => rows\.map\(bookingSpan\)\)/.test(decomment(read(f))) && /source: true/.test(read(f)));

  // Where each books, in source.
  const events = decomment(read("app/api/sales/events/route.js"));
  ok("the events route re-asks the walkthrough gate from a fresh read of the lead and the company", /walkthroughGate\(\{ lead, onboarding \}\)/.test(events) && /getOnboardingStatus\(lead\.convertedCompanyId\)/.test(events));
  ok("…refuses before any write when it says no", events.indexOf("if (!gate.allowed)") < events.indexOf("tx.demoBooking.create"));
  ok("…books the specialist for the full hour on the staff calendar", /hostsFreeFor\(hosts, startAt\.toISOString\(\), NEXT_STEP_MINUTES\.walkthrough, now\)/.test(events) && /loadMigrationHosts\(now\)/.test(events));
  ok("…writes the DemoBooking and the SalesEvent in one transaction, the booking filed as a walkthrough", /db\.\$transaction\(async \(tx\) => \{[\s\S]*tx\.demoBooking\.create\([\s\S]*source: WALKTHROUGH_SOURCE[\s\S]*tx\.salesEvent\.create\(/.test(events));
  ok("…tells the specialist and the superadmins, with the .ics", /sendHostHeadsUp\(created\.booking, host\.email, \{\s*kind: "walkthrough"/.test(events));
  ok("…fills a demo's end from its kind when the browser sent none", /const spanEnd = endAt \|\| endOf\(type, startAt\);/.test(events));
  ok("…and offers only hour-long slots", /availableSlotsByDayFor\(hosts, NEXT_STEP_MINUTES\.walkthrough, now\)/.test(events));
  ok("the calendar gate declares the booking write, by name", REP_CALENDAR_WRITES.includes("demoBooking") && REP_CALENDAR_WRITES.includes("salesEvent"));
  ok("…and nothing that pays anybody", !REP_CALENDAR_WRITES.some((m) => ["salesAttribution", "salesCommissionEntry", "salesPayoutBatch", "salesRep", "subscription", "payment"].includes(m)));

  const invite = decomment(read("app/api/sales/events/[id]/invite/route.js"));
  ok("the invite goes from the rep's mailbox through deliverOutreach, on the outreach gate", /requireOutreachRep\(request\)/.test(invite) && /deliverOutreach\(\{/.test(invite) && REP_OUTREACH_WRITES.includes("salesThread"));
  ok("…with the .ics built server-side from the event", /buildIcs\(\{/.test(invite) && /attachments: \[\{ filename: `fieldquo-\$\{noun\}\.ics`/.test(invite));
  ok("…only for a demo or a walkthrough", /INVITABLE = new Set\(\["demo", "walkthrough"\]\)/.test(invite));
  ok("…and refuses, saying so, when the lead has no email", /noEmail: true/.test(invite));
  ok("deliverOutreach carries the attachment into the send and nowhere else", /\.\.\.\(Array\.isArray\(attachments\) && attachments\.length \? \{ attachments \} : \{\}\)/.test(decomment(read("lib/sales/outreachSender.js"))));

  const lead = decomment(read("app/api/sales/leads/[id]/route.js"));
  ok("the lead route puts the company's onboarding progress and the gate on linkedCompany", /onboarding: onboardingProgress\(onboarding\)/.test(lead) && /walkthrough: \{ allowed: walkthrough\.allowed/.test(lead));
  ok("…read through assignedCompanyWhere, so a company not in the rep's book answers null", lead.indexOf("assignedCompanyWhere(rep.id)") < lead.indexOf("getOnboardingStatus(company.id)") && /if \(company\) \{/.test(lead));

  const form = decomment(read("app/components/sales/NextSteps.js"));
  ok("the form offers the three, each by data-testid", ["next-step-demo", "next-step-signup", "next-step-walkthrough"].every((id) => form.includes(`data-testid="${id}"`)));
  ok("…and the walkthrough button only when the server said allowed", /\{gate\?\.allowed \? \([\s\S]*data-testid="next-step-walkthrough"/.test(form));
  ok("…otherwise the reason and the count, never a dead button", /walkthroughAfterSetup", \{ done: progress\.done, total: progress\.total \}/.test(form));
  ok("…'sent to sign up' writes the one status", /status: SIGNUP_SENT_STATUS/.test(form));
  ok("…the demo opens the calendar's own editor typed demo", /type: modal,/.test(form) && /setModal\("demo"\)/.test(form));
  ok("…and both bookings send the invite for the saved event", (form.match(/sendInvite\(/g) || []).length >= 3);
  ok("the call panel renders it in place of the lone call-back button", /<NextSteps prospectId=\{prospectId\} leadId=\{leadId\}/.test(decomment(read("app/components/sales/CallPanel.js"))) && !/setShowCallbackEvent/.test(read("app/components/sales/CallPanel.js")));
  ok("the lead card prints the setup count", /data-testid="lead-onboarding-progress"/.test(read("app/sales/leads/[id]/page.js")) && /onboardingProgress", \{ done: data\.linkedCompany\.onboarding\.done/.test(read("app/sales/leads/[id]/page.js")));
  ok("the calendar names the kind on the chip", /app\.salesCal\.demo/.test(read("app/sales/calendar/page.js")) && /app\.salesCal\.walkthrough/.test(read("app/sales/calendar/page.js")));
  for (const k of ["nextStepHeading", "bookDemo", "sentToSignup", "signupSentAlready", "signupSentDone", "bookWalkthrough", "walkthroughAfterSetup", "walkthroughAvailable", "walkthroughPick", "walkthroughNoSlots", "walkthroughConfirm", "walkthroughBooked", "demoBooked", "inviteSent", "inviteNotSent", "nextStepNeedsLead", "onboardingProgress", "onboardingComplete", "onboardingOpenSteps"]) {
    ok(`app.salesCall.${k} is in the catalogue nine times`, timesInCatalogue(`app.salesCall.${k}`) === 9, timesInCatalogue(`app.salesCall.${k}`));
  }
  for (const k of ["demo", "walkthrough", "titlePlaceholderDemo"]) ok(`app.salesCal.${k} is in the catalogue nine times`, timesInCatalogue(`app.salesCal.${k}`) === 9);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:playbook-voice is a script", typeof pkg.scripts?.["check:playbook-voice"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:playbook-voice"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
