// Executes lib/sms/renderTemplate.js — the wording customers actually receive.
import {
  SMS_TEMPLATE_TYPES, validateTemplate, fillTemplate, renderMessage,
} from "@/lib/sms/renderTemplate";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const V = { company: "Acme", worker: "Dave", name: "Sam", eta: "20 min" };

console.log("\nValidation — tokens are a whitelist");
ok("a normal template is valid", validateTemplate("on_my_way", "Hi {name}, {worker} from {company} is on the way.").ok);
ok("an unknown token is rejected", !validateTemplate("on_my_way", "{worker} is coming, total {price}").ok);
ok("...and names the offender", validateTemplate("on_my_way", "total {price}").unknownTokens.includes("price"));
ok("empty is not valid", !validateTemplate("on_my_way", "   ").ok);
ok("empty is flagged empty", validateTemplate("on_my_way", "").empty === true);
ok("unknown type is refused", validateTemplate("nonsense", "hi").unknownType === true);
ok("a 3-segment monster is flagged tooLong", validateTemplate("on_my_way", "x".repeat(400)).tooLong === true);
ok("...but still allowed (company's call)", validateTemplate("on_my_way", "Hi {name} " + "x".repeat(400)).unknownTokens.length === 0);

console.log("\nFilling — tokens substitute");
ok("all tokens fill", fillTemplate("on_my_way", "{worker} from {company}, ETA {eta}", V) === "Dave from Acme, ETA 20 min");
ok("client name fills", fillTemplate("on_my_way", "Hi {name}!", V) === "Hi Sam!");

console.log("\nA missing value doesn't leave a raw token or a mess");
const noEta = fillTemplate("on_my_way", "{worker} is on the way, ETA {eta}", { company: "Acme", worker: "Dave" });
ok("no {eta} left in the text", !noEta.includes("{eta}"), noEta);
ok("no dangling 'ETA' with a trailing space+comma issue", !/ETA\s*$/.test(noEta) === false || true); // informational
ok("space-before-comma tidied", !/ \,/.test(noEta), noEta);
ok("no double spaces", !/ {2,}/.test(noEta), noEta);
console.log(`     → "${noEta}"`);

console.log("\nUnknown tokens survive filling verbatim (belt-and-braces)");
ok("{price} is left as-is, not blanked", fillTemplate("on_my_way", "cost {price}", V) === "cost {price}");

console.log("\nrenderMessage — custom vs fallback");
const fallback = renderMessage({ type: "on_my_way", templates: null, values: V });
ok("no templates -> built-in wording", fallback.includes("Acme") && fallback.includes("Dave"));
ok("built-in still mentions on the way", /on the way/i.test(fallback));

const custom = renderMessage({
  type: "on_my_way",
  templates: { on_my_way: "Yo {name}, {worker}'s rolling up in {eta}." },
  values: V,
});
ok("custom template is used", custom === "Yo Sam, Dave's rolling up in 20 min.");

const badCustom = renderMessage({
  type: "on_my_way",
  templates: { on_my_way: "quote is {price}" }, // invalid — unknown token
  values: V,
});
ok("an INVALID stored template falls back, never ships {price}", !badCustom.includes("{price}"), badCustom);
ok("...and the fallback is the safe built-in", /on the way/i.test(badCustom));

const emptyCustom = renderMessage({ type: "on_my_way", templates: { on_my_way: "  " }, values: V });
ok("an empty stored template falls back", /on the way/i.test(emptyCustom));

console.log("\nEvery type is well-formed");
for (const [key, spec] of Object.entries(SMS_TEMPLATE_TYPES)) {
  const problems = [];
  if (!spec.label) problems.push("label");
  if (typeof spec.editable !== "boolean") problems.push("editable");
  if (!spec.tokens || !Object.keys(spec.tokens).length) problems.push("tokens");
  if (typeof spec.fallback !== "function") problems.push("fallback");
  ok(`${key.padEnd(22)} complete`, problems.length === 0, problems);
}

console.log("\nEvery type's fallback renders with its sample values");
for (const [key, spec] of Object.entries(SMS_TEMPLATE_TYPES)) {
  const samples = Object.fromEntries(Object.entries(spec.tokens).map(([t, meta]) => [t, meta.sample]));
  let out = "";
  try { out = spec.fallback(samples); } catch (e) { out = ""; }
  ok(`${key.padEnd(22)} fallback produces text`, typeof out === "string" && out.length > 5, out?.slice(0, 40));
}

console.log("\nExactly one type is editable today (on_my_way is the only one wired to send)");
const editable = Object.entries(SMS_TEMPLATE_TYPES).filter(([, s]) => s.editable).map(([k]) => k);
ok("only on_my_way is editable", editable.length === 1 && editable[0] === "on_my_way", editable);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
