// scripts/check-voice-answer.jsx
//
// The receptionist's on/off switch, rendered in every state it can be in.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// This is the control behind the most expensive feature in the product: it
// decides whether an AI picks up a contractor's business line. It lived at line
// 1813 of a 3,570-line page, below three configuration cards, and nothing on
// the screen above it said whether the phone was currently answering. An owner
// wanting to know had to scroll past the greeting editor; an owner wanting it
// OFF had to scroll there to do it.
//
// It now renders twice — a status bar at the top of the page and step 4, where
// the explanation belongs. That is the arrangement this file exists to keep
// honest, because two copies of one button is how a disabled rule drifts.
//
// ── What is actually asserted ──────────────────────────────────────────────
//
// The state that matters most is the third one. A company with no number or no
// credit CANNOT turn this on, and the status bar must not offer a switch that
// does nothing — a disabled toggle in a status bar reads as "it's off" when the
// truth is "it can't be turned on yet". Those are different problems with
// different fixes, and AGENTS.md's first rule is about exactly this.
//
// Run: npm run check:voice-answer

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnswerSwitch,
  VoiceStatusBar,
} from "../app/app/settings/voice/AnswerSwitch.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) console.log(`pass  ${name}`);
  else {
    fail++;
    console.log(`FAIL  ${name}${extra ? "\n      " + extra : ""}`);
  }
};

// The real catalogue's English, so the assertions below are about the words a
// contractor actually reads rather than about placeholder text.
const t = (key, fallback) => (typeof fallback === "string" ? fallback : key);
const ON = "It's answering — turn off";
const OFF = "Start answering calls";
const NUMBER = { display: "+1 613 555 0142" };
const NOT_READY = "Add credit before the receptionist can answer.";

// renderToStaticMarkup escapes the apostrophe in "It's" to &#x27;, so a naive
// includes() on the catalogue string fails against markup that is perfectly
// correct. Decode the four entities React emits before asserting on words.
const decode = (h) =>
  h
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const html = (node) => decode(renderToStaticMarkup(node));
const pressed = (h) => /aria-pressed="true"/.test(h);
const disabled = (h) => /disabled=""/.test(h);
const buttons = (h) => (h.match(/<button/g) || []).length;

console.log("\nThe switch itself");
{
  const live = html(
    <AnswerSwitch enabled canEnable busy={false} t={t} onToggle={() => {}} />,
  );
  ok("answering: says so in WORDS, not only in colour", live.includes(ON), live.slice(0, 160));
  ok("answering: reads as a pressed toggle", pressed(live));
  ok("answering: can always be turned OFF", !disabled(live),
    "an owner must never be locked out of switching off their own phone");

  const off = html(
    <AnswerSwitch enabled={false} canEnable busy={false} t={t} onToggle={() => {}} />,
  );
  ok("set up but off: offers to start", off.includes(OFF));
  ok("set up but off: is pressable", !disabled(off));
  ok("set up but off: reads as an unpressed toggle", !pressed(off));

  const blocked = html(
    <AnswerSwitch enabled={false} canEnable={false} busy={false} t={t} onToggle={() => {}} />,
  );
  ok("not set up: the control is DISABLED, not merely styled as off", disabled(blocked),
    "the PUT refuses this too — the button and the route must agree");

  const busy = html(
    <AnswerSwitch enabled canEnable busy t={t} onToggle={() => {}} />,
  );
  ok("mid-save: disabled, so one tap cannot become two", disabled(busy));

  // The whole reason these left page.js: one definition, so the two render
  // sites cannot drift. Same props in, byte-identical markup out.
  const a = html(<AnswerSwitch enabled canEnable busy={false} t={t} onToggle={() => {}} />);
  const b = html(<AnswerSwitch enabled canEnable busy={false} t={t} onToggle={() => {}} />);
  ok("one definition — identical markup for identical state", a === b);
}

console.log("\nThe status bar, above everything else on the page");
{
  const live = html(
    <VoiceStatusBar
      enabled
      canEnable
      number={NUMBER}
      readyMessage={null}
      busy={false}
      t={t}
      onToggle={() => {}}
    />,
  );
  ok("answering: the number is on screen", live.includes(NUMBER.display));
  ok("answering: the state is a WORD, not just a green dot", live.includes(ON));
  ok("answering: turning it off is one tap from the top of the page",
    buttons(live) === 1 && !disabled(live));

  const off = html(
    <VoiceStatusBar
      enabled={false}
      canEnable
      number={NUMBER}
      readyMessage={null}
      busy={false}
      t={t}
      onToggle={() => {}}
    />,
  );
  ok("set up but off: offers the switch", off.includes(OFF) && buttons(off) === 1);

  // The one that matters.
  const blocked = html(
    <VoiceStatusBar
      enabled={false}
      canEnable={false}
      number={null}
      readyMessage={NOT_READY}
      busy={false}
      t={t}
      onToggle={() => {}}
    />,
  );
  ok("not set up: NO switch is offered at all", buttons(blocked) === 0,
    "a disabled toggle here reads as 'it's off', which is a different and untrue statement");
  ok("not set up: says what is missing instead", blocked.includes(NOT_READY),
    "the server's own sentence, naming the one thing still needed");

  // Absence of a number is absence, not a placeholder.
  ok("no number yet: nothing is invented in its place",
    !/\+1|555|—/.test(blocked.replace(NOT_READY, "")),
    blocked.slice(0, 200));

  // A company that is live but whose readiness has since lapsed (credit ran
  // out) must still be able to switch OFF. This is the state where hiding the
  // control would trap an AI on someone's business line.
  const lapsed = html(
    <VoiceStatusBar
      enabled
      canEnable={false}
      number={NUMBER}
      readyMessage={NOT_READY}
      busy={false}
      t={t}
      onToggle={() => {}}
    />,
  );
  ok("live but no longer fundable: the OFF switch is still there",
    buttons(lapsed) === 1 && lapsed.includes(ON) && !disabled(lapsed),
    "credit running out must not strand a contractor with an AI they can't switch off");
}

console.log("\nStacking, so the bar cannot cover the navigation");
{
  const bar = html(
    <VoiceStatusBar
      enabled
      canEnable
      number={NUMBER}
      readyMessage={null}
      busy={false}
      t={t}
      onToggle={() => {}}
    />,
  );
  // Below lg there are already two stacked sticky bars — AdminSidebar at top-0
  // h-14, SettingsSidebar at top-14 whose height is a chip scroller and not a
  // fixed number. A third sticky element there would need an offset no single
  // value can be right about, so this one is sticky from lg only.
  ok("sticky only from lg up", /lg:sticky/.test(bar) && !/(^|\s)sticky/.test(bar),
    bar.match(/class="[^"]*"/)?.[0]?.slice(0, 220));
  ok("...and sits below both nav bars in the stack (z-20 < z-30 < z-40)",
    /z-20/.test(bar) && !/z-3\d|z-4\d|z-50/.test(bar));
}

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — the switch says what it is doing, and is only offered when it works\n",
);
process.exit(fail ? 1 : 0);
