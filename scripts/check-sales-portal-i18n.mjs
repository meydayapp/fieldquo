// scripts/check-sales-portal-i18n.mjs
//
//   npm run check:sales-portal-i18n
//
// The sales portal, held to the rep's own language.
//
// ══ What went wrong, and why a check is the fix ═══════════════════════════
//
// The owner opened /sales with his Spanish rep account and read this tab bar:
//
//     Today | Cola | Playbook | Mis prospectos | Conversaciones | Texts | …
//
// Five words in Spanish, seven in English, side by side in one row. And the
// tour — which WAS fully keyed — rendered a button reading "Abrir Today",
// because SalesTour interpolates the tab's rendered label into a translated
// sentence, and the label the shell really drew was the English literal.
//
// Nothing was broken in the ordinary sense. Every one of those literals was a
// deliberate, documented decision: the screen behind an English tab was
// English, and SalesShell's own comment argued — correctly — that a translated
// tab opening an English page is the worse inconsistency. The decision was
// right and it rotted, because nothing tied "this tab may be a literal" to
// "this screen is still English". When the screens were translated, nobody was
// told the tabs could move.
//
// So this file ties the two together, in that order:
//
//   §2  a FINISHED screen's tab must carry a t() key
//   §3  a FINISHED screen must hold no bare English literal
//   §4  a screen NOT on the finished list must keep its English tab
//
// §4 is the half that stops the next agent doing the cheap version — renaming
// twelve tabs and leaving the pages alone, which is exactly the state the owner
// complained about, only with the ratio reversed.
//
// ══ Judged by exit code, and read with comments stripped ══════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed. Do
// not read a run by grepping for FAIL. And every source read is decommented
// first: this repository explains at length, in prose, what each file must not
// do, and checks here have been satisfied by a comment ABOUT the rule instead
// of by the rule — including this file's own header, which is full of the
// English literals §3 exists to forbid.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { SALES_TOUR_STEPS } from "@/app/sales/tourSteps";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Source with every comment removed — see the header. */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (heading) => console.log(`\n${heading}\n`);

const LANGS = Object.keys(APP_MESSAGES);

// ═══════════════════════════════════════════════════════════════════════════
// The screens, and what each one is made of.
// ═══════════════════════════════════════════════════════════════════════════
//
// `route` is the href SalesShell links, so the tab and the screen are named by
// the same string and there is no second vocabulary to keep in step. A screen
// that is finished lists every file that renders part of it — a keyed page in
// front of an English component is the same half-translated surface as an
// English page, and only listing the page would miss it.
const FINISHED = [
  { route: "/sales", files: ["app/sales/page.js", "app/sales/nextAction.js"] },
  {
    route: "/sales/queue",
    files: [
      "app/sales/queue/page.js",
      "app/components/sales/QueueLeadEditor.js",
      "app/components/sales/StageBoard.js",
      "app/components/sales/CallPanel.js",
      "app/components/sales/CallPlaybook.js",
      "app/components/sales/CallConsolePreview.js",
      "app/components/sales/ContactNumbers.js",
      "app/components/sales/DialRegion.js",
      "app/components/sales/TransferControl.js",
    ],
  },
  {
    route: "/sales/playbook",
    files: ["app/sales/playbook/PlaybookView.js", "app/sales/playbook/PlaybookSearch.js"],
  },
  {
    route: "/sales/leads",
    files: [
      "app/sales/leads/page.js",
      "app/sales/leads/[id]/page.js",
      "app/sales/leads/OutreachNotice.js",
      "app/sales/leads/SignupLinkSms.js",
    ],
  },
  { route: "/sales/threads", files: ["app/sales/threads/page.js", "app/sales/threads/[id]/page.js"] },
  {
    route: "/sales/messages",
    files: [
      "app/sales/messages/page.js",
      "app/sales/messages/MessageThread.js",
      "app/sales/messages/CheckInDraft.js",
      "app/sales/messages/useThreadRefresh.js",
      // The kit the screen is drawn with. scripts/check-chat-kit.mjs holds
      // it to the same rule on its own; listed here too so the KEYS it asks
      // for are checked against all nine languages alongside the screen's.
      "app/components/chat/ChatLayout.js",
      "app/components/chat/RoomList.js",
      "app/components/chat/Thread.js",
      "app/components/chat/Composer.js",
      "app/components/chat/ContextBar.js",
      "app/components/chat/Avatar.js",
    ],
  },
  { route: "/sales/team", files: ["app/sales/team/page.js"] },
  {
    route: "/sales/notes",
    files: [
      "app/sales/notes/page.js",
      "app/sales/notes/[id]/page.js",
      "app/components/sales/RepNoteEditor.js",
      "app/components/sales/RepNoteConflict.js",
      "app/components/sales/RepNoteUnavailable.js",
      "app/components/sales/RepNoteVisibilityNotice.js",
    ],
  },
  { route: "/sales/calendar", files: ["app/sales/calendar/page.js", "app/sales/calendar/EventModal.js"] },
  { route: "/sales/companies", files: ["app/sales/companies/page.js"] },
  { route: "/sales/demo", files: ["app/sales/demo/page.js"] },
  { route: "/sales/support", files: ["app/sales/support/page.js"] },
  { route: "/sales/voicemail", files: ["app/sales/voicemail/page.js", "app/components/sales/IncomingCallDock.js"] },
  {
    route: "/sales/pay",
    files: [
      "app/sales/pay/page.js",
      "app/components/sales/EarningsPanel.js",
      "app/components/sales/PayoutDestinationForm.js",
      "app/components/sales/RepLanguageChoice.js",
    ],
  },
];

// Reached without a session, so the shell draws no tab for them — but a rep
// still reads them, and they are translated.
const NO_TAB = [
  "app/sales/login/page.js",
  "app/sales/invite/[token]/page.js",
  "app/sales/welcome/page.js",
  "app/sales/SalesShell.js",
];

// ── What a bare literal is, and what it is not ────────────────────────────
//
// Text between > and < that begins with a letter and contains no JSX
// expression. `{t("…")}` and `{variable}` never match, because `{` is not in
// the character class. Lifted in shape from check-sales-tour.mjs's section 4,
// which has caught this exact class of regression already.
const TEXT_NODE = />\s*([A-Za-z][A-Za-z0-9 ,.'’!?;:—–…-]{2,})\s*</g;

// The attributes a person actually reads or hears. className, href, type, id,
// name and the data-* family are deliberately absent: they are not language.
const ATTR = /\b(aria-label|title|placeholder|alt)=("([^"]*)")/g;

// Words that are the same in every language this portal ships in, so a literal
// one is not a missing translation. Kept to proper nouns and protocol names —
// if this list needs a heading it has stopped being a list of names.
// "STOP" is the carrier keyword a contact texts to opt out — the inbound
// handler listens for that exact English token, so the red tag on
// /sales/messages prints it verbatim, the way the CASL footer note does.
const NEUTRAL = new Set(["FieldQuo", "Stripe", "Wise", "Twilio", "Retell", "SMS", "URL", "UTC", "STOP"]);

const isNeutral = (value) =>
  value
    .split(/[\s,.;:—–…-]+/)
    .filter(Boolean)
    .every((word) => NEUTRAL.has(word));

// ── The three English strings that are RIGHT ──────────────────────────────
//
// A check with no escape hatch gets one added carelessly the first time it is
// inconvenient. This one is written down instead, per file, with the reason —
// and it is three entries, not a category. Each of them is English because
// translating it would produce a control that appears to work and doesn't:
//
//   · The two objection-search placeholders are an EXAMPLE of what to type,
//     and the matcher behind the box (lib/sales/playbook/objections.js) is a
//     lower-cased English substring list with no stemming. A French example
//     would invite a rep to type French and match nothing. The label and the
//     hint above each box ARE translated, which is what makes the English read
//     as the contractor's own words rather than as a missed string.
//
//   · "Assign" on the demo screen is quoted inside a request a rep sends to a
//     superadmin, and it is the literal label of a button on /platform — a
//     console that is English for everybody. Translating the quotation would
//     send the rep asking for a control that does not exist under that name.
//
// Anything not on this list is a failure. Adding to it needs the same kind of
// sentence: not "this one is awkward", but "the translated version would be
// wrong on screen".
const ALLOWED = new Map([
  ["app/components/sales/CallPlaybook.js", new Set(['placeholder="we already use jobber"'])],
  ["app/sales/playbook/PlaybookSearch.js", new Set(['placeholder="we already use jobber"'])],
  ["app/sales/demo/page.js", new Set(["Assign"])],
]);

/** Every bare user-facing English literal in one file. */
function bareLiterals(path) {
  const code = decomment(read(path));
  const allowed = ALLOWED.get(path) ?? new Set();
  const found = [];
  for (const m of code.matchAll(TEXT_NODE)) {
    const value = m[1].trim();
    if (!isNeutral(value) && !allowed.has(value)) found.push(value);
  }
  for (const m of code.matchAll(ATTR)) {
    const value = m[3].trim();
    const printed = `${m[1]}="${value}"`;
    if (value && /\p{L}{2}/u.test(value) && !isNeutral(value) && !allowed.has(printed)) {
      found.push(printed);
    }
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The shell's tabs were parsed");
// ═══════════════════════════════════════════════════════════════════════════

const shellCode = decomment(read("app/sales/SalesShell.js"));

const shellTabs = [
  ...shellCode.matchAll(/\{\s*href:\s*"([^"]+)"\s*,\s*label:\s*(?:t\("([^"]+)"\)|"([^"]+)")\s*\}/g),
].map((m) => ({ href: m[1], labelKey: m[2] || null, labelLiteral: m[3] || null }));

// Without this the whole file passes vacuously against an empty list, which is
// the shape of failure that makes a check reassuring and useless.
ok("the tab list was parsed", shellTabs.length >= 10, shellTabs.length);
ok(
  "…and every FINISHED route is one of its tabs",
  FINISHED.every((s) => shellTabs.some((tab) => tab.href === s.route)),
  FINISHED.filter((s) => !shellTabs.some((tab) => tab.href === s.route)).map((s) => s.route),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. A finished screen's tab carries a key");
// ═══════════════════════════════════════════════════════════════════════════

for (const screen of FINISHED) {
  const tab = shellTabs.find((entry) => entry.href === screen.route);
  if (!tab) continue;
  ok(`${screen.route} is labelled by a t() key, not an English literal`, Boolean(tab.labelKey), {
    literal: tab.labelLiteral,
  });
  if (!tab.labelKey) continue;
  for (const lang of LANGS) {
    ok(`…and "${tab.labelKey}" has a ${lang} value`, Boolean(APP_MESSAGES[lang]?.[tab.labelKey]));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. A finished screen holds no bare English literal");
// ═══════════════════════════════════════════════════════════════════════════

for (const path of [...FINISHED.flatMap((s) => s.files), ...NO_TAB]) {
  const found = bareLiterals(path);
  ok(`${path} renders nothing in hardcoded English`, found.length === 0, found.slice(0, 8));
}

// An exemption may not outlive the thing it exempts. Without this, a string
// that later gets keyed leaves its ALLOWED entry behind, quietly widening the
// hole for whatever English lands on that line next.
for (const [path, values] of ALLOWED) {
  const code = decomment(read(path));
  for (const value of values) {
    // Both shapes appear verbatim in the source: an attribute exemption is
    // written the way ATTR prints it, a text one is the text itself.
    ok(`the exemption for ${JSON.stringify(value)} in ${path} is still needed`, code.includes(value));
  }
}

// Every key those files ask for has to exist, in every language. A typo in a
// key renders the key itself on screen, which is worse than English.
{
  const missing = [];
  for (const path of [...FINISHED.flatMap((s) => s.files), ...NO_TAB]) {
    const code = decomment(read(path));
    for (const m of code.matchAll(/\bt\(\s*"(app\.[A-Za-z0-9.]+)"/g)) {
      const key = m[1];
      for (const lang of LANGS) {
        if (APP_MESSAGES[lang]?.[key] === undefined) missing.push(`${key} (${lang})`);
      }
    }
  }
  ok("every key these screens ask for exists in all nine languages", missing.length === 0, [
    ...new Set(missing),
  ].slice(0, 12));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. A screen that is NOT finished keeps its English tab");
// ═══════════════════════════════════════════════════════════════════════════
//
// The order of the work, asserted. Translating a tab whose screen is still
// English recreates the bar the owner complained about, and it is the cheap
// half of this job — so it fails here rather than shipping.

for (const tab of shellTabs) {
  if (FINISHED.some((s) => s.route === tab.href)) continue;
  ok(
    `${tab.href} has no translated screen, so its tab stays an English literal`,
    Boolean(tab.labelLiteral),
    { key: tab.labelKey },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. \"Abrir Today\" — the tour reads the tab through the same key");
// ═══════════════════════════════════════════════════════════════════════════

for (const step of SALES_TOUR_STEPS) {
  const tab = shellTabs.find((entry) => entry.href === step.href);
  if (!tab?.labelKey) continue;
  ok(
    `tour step "${step.key}" names ${step.href} by key, not by the English word`,
    step.tabLabelKey === tab.labelKey && !step.tabLabel,
    { step: step.tabLabelKey || step.tabLabel, shell: tab.labelKey },
  );
}

// The sentence the button is built from. A translation that lost {tab} renders
// the verb with nothing after it, which is how this bug hides.
ok(
  "the goTo sentence keeps its {tab} placeholder in every language",
  LANGS.every((lang) => String(APP_MESSAGES[lang]["app.salesTour.goTo"]).includes("{tab}")),
  LANGS.filter((lang) => !String(APP_MESSAGES[lang]["app.salesTour.goTo"]).includes("{tab}")),
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Phrases another check looks for in a file they have left");
// ═══════════════════════════════════════════════════════════════════════════
//
// scripts/check-sales-home.mjs asserts the UTC day boundary is stated on screen
// by matching "today (UTC)" in app/sales/page.js — a rule lib/sales/repStats.js
// asks for, and a good one. The phrase is now a catalogue entry, so that match
// would be satisfied by this repository's habit of explaining itself in a
// comment. It is asserted HERE against the catalogue instead, where the words
// actually live, and in every language rather than only in English.

for (const lang of LANGS) {
  const value = String(APP_MESSAGES[lang]?.["app.salesToday.signupsToday"] ?? "");
  ok(`the "signed up today" figure names UTC in ${lang}`, value.includes("UTC"), value);
}
{
  const en = String(APP_MESSAGES.en["app.salesToday.signupsToday"] ?? "");
  ok('…and English still reads "today (UTC)"', /today \(UTC\)/.test(en), en);
}

// The same trade, made seven more times. Each of these sentences was asserted
// by a neighbouring check against the SCREEN's source; the screen now renders a
// key, so those checks match the key and the words are held here. Every one of
// them is a claim about what a rep is told, not decoration:
//
//   · a zero-second voicemail means somebody heard the beep and hung up,
//     which is different from a message that failed to record;
//   · the do-not-contact note names the ONE disposition that binds every rep
//     and every channel, so a rep does not read it as covering all of them;
//   · declining an inbound call passes it on rather than hanging up on a
//     contractor, and the rep has to know that before they press it;
//   · a transfer picker with nobody in it says so instead of looking empty;
//   · a suppressed conversation says why it cannot be written to;
//   · the manual follow-up control and the draft's send button exist by name.
for (const [key, phrase] of [
  ["app.salesDial.silentVoicemail", "heard the beep and hung up"],
  ["app.salesQueue.dncScopeNote", "Asked not to be called again"],
  ["app.salesQueue.dncScopeNote", "binds every rep and every channel"],
  ["app.salesDial.decliningNotice", "passes them to the next person on the ring plan"],
  ["app.salesDial.nobodyElseFree", "Nobody else is free right now"],
  ["app.salesText.suppressedBody", "Nothing can be sent"],
  ["app.salesText.parkOpen", "Park a follow-up"],
  ["app.salesText.sendNow", "Send it now"],
]) {
  const en = String(APP_MESSAGES.en[key] ?? "");
  ok(`${key} still says "${phrase}" in English`, en.includes(phrase), en);
  for (const lang of LANGS) {
    ok(`…and ${key} has a ${lang} value`, Boolean(APP_MESSAGES[lang]?.[key]));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. A tour paragraph quotes the button a rep will actually see");
// ═══════════════════════════════════════════════════════════════════════════
//
// Three tour bodies tell a rep to press a named button. Translating the SCREENS
// on 2026-09-10 (cf099363) translated those buttons and left the quotations
// behind, so in seven languages the tour named a phrase that is nowhere on
// screen. app/sales/tourSteps.js's own header calls that the worst form of this
// bug — "a step that names a tab the portal does not have sends a new hire
// hunting for a screen that is not there, on their first morning" — and a
// quoted button is the same failure one level down.
//
// `zh` was wrong for a second reason worth recording: its quotations had been
// TRANSLATED rather than TAKEN. Someone (me) rendered the phrase independently,
// so the tour said 我已经和他们谈过 while the button says 我跟他们谈过了. Both are
// good Chinese and they are not the same words, which is exactly as useless to
// somebody scanning a screen for the one they were told to press.
//
// The assertion is containment against the catalogue's OWN button value, not a
// literal, so a future rename of either side fails here rather than drifting.
// Same trade as section 6: the words are asserted where they live.

const QUOTED_BUTTONS = [
  ["app.salesTour.queueBody", "app.salesQueue.markWorked"],
  ["app.salesTour.workAsLeadBody", "app.salesQueue.carryToLeadButton"],
  ["app.salesTour.notesBody", "app.salesNotes.newNote"],
];

for (const [bodyKey, buttonKey] of QUOTED_BUTTONS) {
  for (const lang of LANGS) {
    const body = String(APP_MESSAGES[lang]?.[bodyKey] ?? "");
    const button = String(APP_MESSAGES[lang]?.[buttonKey] ?? "");
    // An empty button would make `includes` trivially true and assert nothing.
    ok(`${lang}: ${buttonKey} has a value to quote`, button.length > 0, button);
    ok(
      `${lang}: ${bodyKey} quotes it verbatim`,
      button.length > 0 && body.includes(button),
      { body: body.slice(0, 90), button },
    );
  }
}

// And the other direction: no translated body may still carry the English
// phrase. Containment alone would pass a body that quoted BOTH.
{
  const ENGLISH_QUOTES = QUOTED_BUTTONS.map(([, k]) => String(APP_MESSAGES.en?.[k] ?? ""));
  for (const [bodyKey] of QUOTED_BUTTONS) {
    for (const lang of LANGS) {
      if (lang === "en") continue;
      const body = String(APP_MESSAGES[lang]?.[bodyKey] ?? "");
      const stowaway = ENGLISH_QUOTES.find((q) => q.length > 0 && body.includes(q));
      ok(`${lang}: ${bodyKey} carries no English button label`, !stowaway, stowaway);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. A rep reads \"lead\", never \"prospect\"");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner, 2026-09-11: every rep-facing string in the portal says "lead".
// "Prospect" is the MODEL's name (Prospect, prospectId, the /platform
// console) and stays there; on a rep's screen the queue holds leads to call
// and My leads holds their own. Checked across all nine languages with the
// Latin noun — `prospect`, `prospects`, and Spanish `prospecto(s)` — because
// fr/tl/es carried the English word too. "prospection" (French for
// prospecting, the activity) is a different word and is not matched.
//
// The per-language nouns that replaced it (лід, ਲੀਡ, 线索, Lead) are what
// the rest of the catalogue already used for SalesLead, so the two stay one
// word. Exceptions: none today; add a key here WITH its reason if one is
// ever needed, never by loosening the pattern.
{
  const PREFIXES = ["app.salesQueue.", "app.salesCall.", "app.salesLeads.", "app.salesDial.", "app.salesTour.", "app.salesAutodial.", "app.salesText.", "app.salesNotes."];
  const EXCEPTIONS = new Map([]);
  const NOUN = /\bprospects?\b|\bprospectos?\b/i;
  const src = readFileSync(join(ROOT, "app/i18n/appMessages.js"), "utf8");
  for (const lang of LANGS) {
    const hits = Object.entries(APP_MESSAGES[lang])
      .filter(([k]) => PREFIXES.some((p) => k.startsWith(p)) && !EXCEPTIONS.has(k))
      .filter(([, v]) => typeof v === "string" && NOUN.test(v))
      .map(([k]) => k);
    ok(`${lang}: no rep-facing key says "prospect"`, hits.length === 0, hits.slice(0, 8));
  }
  // The counted nouns are functions, so the source is read for their forms.
  const counted = [...src.matchAll(/"app\.sales[^"]+": countedNoun\("(\w+)", (\{[^}]*\})\)/g)]
    .filter((m) => NOUN.test(m[2]))
    .map((m) => `${m[1]}: ${m[2]}`);
  ok("no counted noun in any language is \"prospect\"", counted.length === 0, counted);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const name of failures) console.log(`  · ${name}`);
  process.exit(1);
}
