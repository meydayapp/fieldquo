// scripts/check-contract-templates.mjs
//
// "Start from a trade template" offered one button per trade and APPENDED on
// every press. Pressing Painting twice put the painting terms into every quote
// that company sent, twice — and with a 14-row textarea the second copy was
// below the fold, so nothing on screen said it had happened.
//
// Appending was deliberate: overwriting terms somebody had already written by
// hand is the destructive-operation-labelled-as-cosmetic failure. But "never
// overwrite" and "append blindly" are not the same thing. The button is a
// toggle now, and this executes the property that matters — a contractor's own
// words survive every press, in both directions.

import {
  contractTemplateList,
  templateApplied,
  toggleTemplate,
  unfilledPlaceholders,
} from "../lib/documents/contractTerms.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};

const list = contractTemplateList();
ok("there are templates to test", list.length >= 2, String(list.length));
const [a, b] = list;

// ── The reported bug ──────────────────────────────────────────────────────
{
  let notes = "";
  notes = toggleTemplate(notes, a.body);
  const once = notes;
  notes = toggleTemplate(notes, a.body);   // press it again
  ok("pressing the same template twice does not stack it",
     !notes.includes(`${a.body.trim()}\n\n${a.body.trim()}`));
  ok("pressing twice removes it", notes.trim() === "");
  ok("pressing a third time puts it back", toggleTemplate(notes, a.body) === once);
  // Ten presses must land somewhere sane, not ten copies.
  let spam = "";
  for (let i = 0; i < 10; i++) spam = toggleTemplate(spam, a.body);
  ok("ten presses leave nothing (even count)", spam.trim() === "");
  ok("the body never appears twice at any point",
     (once.split(a.body.trim()).length - 1) === 1);
}

// ── Two different trades still both apply ─────────────────────────────────
//
// A company that paints AND roofs wants both. The fix must not turn the
// buttons into a single-choice radio.
{
  let notes = toggleTemplate(toggleTemplate("", a.body), b.body);
  ok("two different templates coexist",
     templateApplied(notes, a.body) && templateApplied(notes, b.body));
  const removedFirst = toggleTemplate(notes, a.body);
  ok("removing one leaves the other",
     !templateApplied(removedFirst, a.body) && templateApplied(removedFirst, b.body));
  ok("removing a middle block leaves no three-line gap", !/\n{3,}/.test(removedFirst));
}

// ── The property the original append was protecting ───────────────────────
//
// Nothing the contractor typed may ever be lost, in either direction.
{
  const mine = "We never work weekends.\nDeposit is due before we order material.";
  let notes = toggleTemplate(mine, a.body);
  ok("their own text survives adding", notes.includes(mine));
  notes = toggleTemplate(notes, a.body);
  ok("their own text survives removing", notes.includes(mine));
  ok("and removing leaves ONLY their text", notes.trim() === mine.trim());

  // Once they edit the inserted text it is theirs. The button must stop
  // claiming to have added it — and must never delete a rewritten version on
  // the strength of a fuzzy match.
  const edited = toggleTemplate("", a.body).replace(/\ba\b/, "the");
  const changed = edited !== toggleTemplate("", a.body);
  ok("an edited template no longer reads as applied",
     !changed || templateApplied(edited, a.body) === false);
  if (changed) {
    ok("and pressing the button adds a fresh copy rather than deleting their edit",
       toggleTemplate(edited, a.body).includes(edited));
  }
}

// ── Placeholders still print as written ──────────────────────────────────
//
// Every template deliberately leaves the figures a contractor must own in
// [brackets], so an unedited one is visibly unfinished rather than quietly
// promising a warranty nobody agreed to.
for (const tpl of list) {
  const holes = unfilledPlaceholders(tpl.body);
  ok(`${tpl.label} leaves its decisions in brackets`, holes.length > 0, String(holes.length));
}
{
  const two = toggleTemplate(toggleTemplate("", a.body), b.body);
  const combined = unfilledPlaceholders(two);
  ok("placeholders from both templates are counted",
     unfilledPlaceholders(a.body).every((h) => combined.includes(h)) &&
     unfilledPlaceholders(b.body).every((h) => combined.includes(h)));
}

// ── Hostile input ─────────────────────────────────────────────────────────
for (const junk of [null, undefined, "", "   ", 0, 42, {}, []]) {
  ok(`toggle survives junk notes: ${JSON.stringify(junk)}`,
     typeof toggleTemplate(junk, a.body) === "string");
  ok(`toggle survives junk template: ${JSON.stringify(junk)}`,
     typeof toggleTemplate("keep me", junk) === "string");
  ok(`junk template never destroys notes: ${JSON.stringify(junk)}`,
     toggleTemplate("keep me", junk).includes("keep me"));
  ok(`templateApplied never throws: ${JSON.stringify(junk)}`,
     typeof templateApplied(junk, junk) === "boolean");
}
ok("an empty template is never 'applied'", templateApplied("anything", "") === false);
ok("an empty template is never 'applied' to empty", templateApplied("", "") === false);

console.log(fail === 0 ? "\nALL PASS — the button toggles, and nothing a contractor typed is ever lost" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
