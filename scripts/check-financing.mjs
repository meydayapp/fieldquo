// Executes lib/estimate/financing.js — the honest financing model.
import { financingOffer, financingCtaLabel, normaliseFinancing } from "@/lib/estimate/financing";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

console.log("\nOff by default");
ok("null -> no offer", financingOffer(null) === null);
ok("not enabled -> no offer", financingOffer({ enabled: false, note: "x" }) === null);
ok("empty object -> no offer", financingOffer({}) === null);
ok("non-object -> no offer", financingOffer("yes") === null);

console.log("\nThe core guarantee: NO monthly figure, APR or term, ever");
const cases = [
  financingOffer({ enabled: true }),
  financingOffer({ enabled: true, note: "0% for 12 months on approved credit" }),
  financingOffer({ enabled: true, url: "https://affirm.com/apply", note: "Pay over time" }),
];
for (const c of cases) {
  const json = JSON.stringify(c);
  ok(`offer has no month/APR/payment key: ${json.slice(0, 40)}…`,
    !/monthly|payment|apr|perMonth|\/mo\b|installment/i.test(Object.keys(c).join(",")));
  // The company's own note may legitimately mention months (their terms) — but
  // WE never inject a computed figure. The shape only ever has mode/note/url.
  ok("shape is exactly mode/note/url", Object.keys(c).sort().join() === "mode,note,url");
}

console.log("\ncontact mode — company's own words, no link");
const contact = financingOffer({ enabled: true, note: "We offer in-house financing — ask us." });
ok("mode is contact", contact.mode === "contact");
ok("carries the note", contact.note === "We offer in-house financing — ask us.");
ok("no url", contact.url === null);

console.log("\nprovider mode — a real hand-off link");
const prov = financingOffer({ enabled: true, url: "https://shop.app/pay", note: "Shop Pay Installments" });
ok("mode is provider", prov.mode === "provider");
ok("keeps the https link", prov.url === "https://shop.app/pay");

console.log("\nA bad link degrades to contact, never a dead/dangerous button");
ok("javascript: url dropped -> contact", financingOffer({ enabled: true, url: "javascript:alert(1)" }).mode === "contact");
ok("data: url dropped", financingOffer({ enabled: true, url: "data:text/html,x" }).url === null);
ok("garbage url dropped", financingOffer({ enabled: true, url: "not a url" }).url === null);
ok("empty url -> contact", financingOffer({ enabled: true, url: "" }).mode === "contact");

console.log("\nNever blank — enabled with no note gets a true, term-free sentence");
const bare = financingOffer({ enabled: true });
ok("has a fallback note", typeof bare.note === "string" && bare.note.length > 10);
ok("fallback promises no terms (no %/month/$ figure)", !/\d\s*%|\$\s*\d|\d+\s*months?/i.test(bare.note), bare.note);
ok("fr fallback differs", financingOffer({ enabled: true }, { language: "fr" }).note !== bare.note);

console.log("\nnote is clamped, not trusted");
const long = financingOffer({ enabled: true, note: "x".repeat(1000) });
ok("note capped at 400", long.note.length === 400);

console.log("\nnormaliseFinancing — safe storage");
ok("coerces enabled to boolean", normaliseFinancing({ enabled: 1 }).enabled === true);
ok("drops a javascript: url on save", normaliseFinancing({ enabled: true, url: "javascript:x" }).url === null);
ok("keeps a good url", normaliseFinancing({ enabled: true, url: "https://x.com" }).url === "https://x.com/");
ok("clamps note on save", normaliseFinancing({ enabled: true, note: "y".repeat(999) }).note.length === 400);
ok("null in -> disabled", normaliseFinancing(null).enabled === false);

console.log("\nCTA label");
ok("en label", /financing/i.test(financingCtaLabel("en")));
ok("fr label differs", financingCtaLabel("fr") !== financingCtaLabel("en"));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
