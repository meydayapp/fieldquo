// scripts/check-visit-copy.mjs
//
// The wording decisions on /visit/[token], run against every reason key the
// policy can emit and a few it can't, in all six languages.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-visit-copy.mjs
//
// The one that matters is refundLine. It is the difference between telling a
// homeowner their deposit is on its way back and telling them it isn't, on a
// public link, about money that has already left their account. Reading it is
// not enough: the failure mode is a reason key nobody thought of falling
// through to the optimistic branch, and that is invisible until it happens to
// somebody.

import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import {
  changeRefusal,
  refundLine,
  actionErrorText,
  exactWhen,
} from "@/lib/booking/visitCopy";

const LANGS = ["en", "fr", "es", "uk", "pa", "tl"];
const money = (c) => `$${(c / 100).toFixed(2)}`;

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};

// ── Nothing may promise a refund except an explicit willRefund: true ────────
//
// Every reason changePolicy.refundOnCancel can return, plus keys the route
// adds (no_payment_intent), plus shapes that should never arrive at all.
const REFUND_CASES = [
  { willRefund: false, reason: "nothing_paid", amountCents: 0 },
  { willRefund: false, reason: "policy_off", amountCents: 5000 },
  { willRefund: false, reason: "already_refunded", amountCents: 5000 },
  { willRefund: false, reason: "inside_cutoff", amountCents: 5000 },
  { willRefund: false, reason: "already_happened", amountCents: 5000 },
  { willRefund: false, reason: "no_payment_intent", amountCents: 5000 },
  { willRefund: false, reason: "a_key_invented_next_year", amountCents: 5000 },
  { willRefund: true, reason: "ok", amountCents: 5000 },
  // Hostile / mangled verdicts. None of these is an explicit yes.
  { reason: "ok", amountCents: 5000 },
  { willRefund: "true", reason: "ok", amountCents: 5000 },
  { willRefund: 1, reason: "ok", amountCents: 5000 },
  { willRefund: {}, reason: "ok", amountCents: 5000 },
  { willRefund: true, reason: "ok", amountCents: "5000" },
  { willRefund: true, reason: "ok", amountCents: null },
  { willRefund: true, reason: "ok", amountCents: -5000 },
  { willRefund: true, reason: "ok" },
  {},
  null,
  undefined,
];

console.log("\nrefundLine — a promise only on an explicit yes");
for (const lang of LANGS) {
  const copy = clientDocCopy(lang).visit;
  const yes = copy.refundYes(money(5000));

  for (const v of REFUND_CASES) {
    const line = refundLine(v, copy, money);
    const shouldPromise = v?.willRefund === true && Number(v?.amountCents) > 0;
    const promises = line === yes;
    ok(
      `${lang}: ${JSON.stringify(v)} promises=${shouldPromise}`,
      promises === shouldPromise,
      line,
    );
  }

  // Nothing taken means nothing to say — not "your fee is not returned".
  ok(
    `${lang}: nothing paid says nothing`,
    refundLine({ willRefund: false, reason: "nothing_paid", amountCents: 0 }, copy, money) === null,
  );
  ok(
    `${lang}: a negative amount says nothing rather than a negative refund`,
    refundLine({ willRefund: true, reason: "ok", amountCents: -1 }, copy, money) === null,
  );
  // Already refunded is its own sentence: past tense, not a fresh promise.
  const already = refundLine(
    { willRefund: false, reason: "already_refunded", amountCents: 5000 },
    copy,
    money,
  );
  ok(`${lang}: already refunded is distinct`, already === copy.refundAlready(money(5000)), already);
  ok(`${lang}: already refunded is not the promise`, already !== yes);
  // The non-refund line must never read as "non-refundable" — the contractor
  // may still hand it back. It has to point somewhere.
  const no = refundLine({ willRefund: false, reason: "policy_off", amountCents: 5000 }, copy, money);
  ok(`${lang}: the non-refund line names the amount`, no.includes(money(5000)), no);
  ok(`${lang}: the non-refund line is not the promise`, no !== yes);
}

// ── A refusal never invents a notice period ────────────────────────────────
console.log("\nchangeRefusal — a number the company actually set, or none");
for (const lang of LANGS) {
  const copy = clientDocCopy(lang).visit;
  const vague = copy.cannotTooLateNoNotice("Acme");

  for (const bad of [undefined, null, "", 0, -5, NaN, Infinity, "soon", {}]) {
    const r = changeRefusal({ reason: "too_late", noticeHours: bad }, copy, "Acme");
    ok(`${lang}: too_late with noticeHours=${String(bad)} stays vague`, r.text === vague, r.text);
  }
  for (const n of [1, 2, 24, 48, 72]) {
    const r = changeRefusal({ reason: "too_late", noticeHours: n }, copy, "Acme");
    ok(`${lang}: too_late with ${n}h names ${n}`, r.text.includes(String(n)), r.text);
    ok(`${lang}: too_late with ${n}h is not the vague line`, r.text !== vague);
    ok(`${lang}: too_late with ${n}h offers the phone`, r.callable === true);
  }
  // A company on 48 must never be reported as 24 — changePolicy's default.
  const at48 = changeRefusal({ reason: "too_late", noticeHours: 48 }, copy, "Acme");
  ok(`${lang}: 48 is not reported as 24`, !/\b24\b/.test(at48.text), at48.text);

  // Terminal states get the neutral line, not "they can still move it".
  for (const reason of ["already_cancelled", "already_happened", "awaiting_payment", "not_found"]) {
    const r = changeRefusal({ reason }, copy, "Acme");
    ok(`${lang}: ${reason} has a sentence`, typeof r.text === "string" && r.text.length > 0);
    ok(`${lang}: ${reason} does not offer to move it`, r.callable === false);
  }
  // An unknown reason explains nothing rather than explaining wrongly.
  for (const reason of [undefined, null, "ok", "teapot"]) {
    const r = changeRefusal({ reason }, copy, "Acme");
    ok(`${lang}: unknown reason "${String(reason)}" invents nothing`, r.text === null, r.text);
  }
  ok(`${lang}: a missing verdict object doesn't throw`, changeRefusal(null, copy, "Acme").text === null);
}

// ── Errors land in the reader's language where we have one ─────────────────
console.log("\nactionErrorText — translated where we can, accurate where we can't");
for (const lang of LANGS) {
  const copy = clientDocCopy(lang).visit;
  const en = clientDocCopy("en").visit;

  ok(
    `${lang}: slot_unavailable is translated`,
    actionErrorText({ data: { reason: "slot_unavailable" }, message: "eng" }, copy, "Acme") ===
      copy.slotTaken,
  );
  ok(
    `${lang}: too_soon is translated`,
    actionErrorText({ data: { reason: "too_soon" }, message: "eng" }, copy, "Acme") === copy.tooSoon,
  );
  ok(
    `${lang}: refund_failed is translated`,
    actionErrorText({ data: { reason: "refund_failed" }, message: "eng" }, copy, "Acme") ===
      copy.refundFailed,
  );
  ok(
    `${lang}: already_cancelled reuses the refusal sentence`,
    actionErrorText({ data: { reason: "already_cancelled" } }, copy, "Acme") === copy.cannotCancelled,
  );
  // Unknown: the server's own wording, which is accurate even if English.
  ok(
    `${lang}: an unknown reason keeps the server's message`,
    actionErrorText({ data: { reason: "teapot" }, message: "Server said no." }, copy, "Acme") ===
      "Server said no.",
  );
  ok(
    `${lang}: nothing at all still says something`,
    actionErrorText(undefined, copy, "Acme") === copy.loadFailed,
  );
  if (lang !== "en") {
    ok(
      `${lang}: the translated lines are not the English ones`,
      copy.slotTaken !== en.slotTaken && copy.refundFailed !== en.refundFailed,
    );
  }
}

// ── The time never renders blank ───────────────────────────────────────────
console.log("\nexactWhen — a bad zone must not blank the one line that says when");
ok("valid zone renders", /2:00/.test(exactWhen("2026-08-11T18:00:00Z", "America/Toronto", "en-CA")));
ok("no zone still renders", exactWhen("2026-08-11T18:00:00Z", null, "en-CA").length > 0);
ok(
  "bad zone falls back rather than throwing",
  exactWhen("2026-08-11T18:00:00Z", "Mars/Olympus", "en-CA").length > 0,
);
ok("bad locale falls back", exactWhen("2026-08-11T18:00:00Z", "UTC", "not-a-locale").length > 0);
ok("garbage date still returns a string", typeof exactWhen("nope", "UTC", "en-CA") === "string");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
