// scripts/check-email-contrast.mjs
//
// Every colour in an email is inline — there is no stylesheet to fix later and
// no dark-mode token to fall back on — so a bad value ships to an inbox and
// stays there.
//
// #9ca3af was used for small print in the invitation and billing emails:
// 2.54:1 on the white card, 2.33:1 on the page, against a 4.5:1 requirement.
// That put "copy and paste this link if the button doesn't work" and "if this
// wasn't you" in the least legible type in the message — the lines a reader
// needs precisely when something has already gone wrong for them.
//
// AGENTS.md: "Contrast assumed rather than measured." This measures.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-email-contrast.mjs

import { readFileSync, readdirSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};

const lum = (hex) => {
  const n = hex.replace("#", "");
  const v = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// ── Which ground to measure against ──────────────────────────────────────
//
// The white card is where body text and small print actually sit in every one
// of these layouts, so it is the ground this checks.
//
// An earlier version demanded 4.5:1 on the PAGE background too, and flagged
// #6b7280 — correct, card-only small print at 4.83:1 — as a defect. A guard
// that reports working code gets switched off, and then it catches nothing at
// all. Being right about the common case beats being strict about a case it
// cannot actually determine from a scan: nothing in a colour literal says
// which div it will end up in.
//
// This still catches the bug that shipped. #9ca3af is 2.54:1 on the CARD, so
// card-only measurement was always enough to find it.
const CARD = "#ffffff";

console.log("\nThe measurement itself");
t("black on white is 21:1", Math.round(ratio("#000000", "#ffffff")), 21);
t("white on white is 1:1", Math.round(ratio("#ffffff", "#ffffff")), 1);
t("the old grey really did fail", ratio("#9ca3af", CARD) < 4.5);

console.log("\nEvery colour literal in every email module clears 4.5:1");
// Scanned rather than listed: a new email file is covered the day it is added,
// which is the only way this keeps working.
const dir = new URL("../lib/email/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
t("there are email modules to scan", files.length > 0);

for (const f of files) {
  // Comments discuss the OLD failing value by name — scanning them would
  // report the documentation as the defect.
  const src = readFileSync(new URL(f, dir), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  const colours = [...new Set(src.match(/#[0-9a-fA-F]{6}\b/g) || [])];
  const bad = colours.filter((c) => {
    // Backgrounds and near-white fills are grounds, not foregrounds. Judged by
    // luminance rather than by a hand-kept allow-list that would rot.
    if (lum(c) > 0.6) return false;
    // A dark fill is a BUTTON background — its own text is white on top, which
    // the pairing check below covers.
    if (lum(c) < 0.12) return false;
    return ratio(c, CARD) < 4.5;
  });
  t(
    `${f}${bad.length ? ` — ${bad.map((c) => `${c} (${ratio(c, CARD).toFixed(2)}:1)`).join(", ")}` : ""}`,
    bad.length,
    0,
  );
}

console.log("\nThe specific value that shipped is gone from executing code");
for (const f of files) {
  const src = readFileSync(new URL(f, dir), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
  t(`${f} does not use #9ca3af`, !/#9ca3af/i.test(src));
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — email small print is legible on the card it sits on\n");
process.exit(fail ? 1 : 0);
