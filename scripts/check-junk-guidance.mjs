// Executes lib/junk/guidance.js — structural integrity of the default content.
import {
  JUNK_FAQ, JUNK_PRICING_GUIDE, JUNK_PROCESS_GUIDE, junkFaqBlocks,
} from "@/lib/junk/guidance";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

console.log("\nFAQ");
ok("has several entries", JUNK_FAQ.length >= 5);
ok("every entry is a non-trivial q + a", JUNK_FAQ.every((f) => f.q.length > 8 && f.a.length > 40));
ok("questions unique", new Set(JUNK_FAQ.map((f) => f.q)).size === JUNK_FAQ.length);
ok("covers the hazard boundary (what won't be taken)", JUNK_FAQ.some((f) => /won't take|hazard|propane|paint/i.test(f.q + f.a)));
ok("covers special fees (fridge/tv/mattress)", JUNK_FAQ.some((f) => /fridge|mattress|recycl|fee/i.test(f.a)));

console.log("\njunkFaqBlocks -> website FAQ block shape");
const blocks = junkFaqBlocks();
ok("maps to {question, answer}", blocks.every((b) => typeof b.question === "string" && typeof b.answer === "string"));
ok("same count as source", blocks.length === JUNK_FAQ.length);

console.log("\nPricing guide");
ok("has title + intro + points", JUNK_PRICING_GUIDE.title && JUNK_PRICING_GUIDE.intro && JUNK_PRICING_GUIDE.points.length >= 4);
ok("every point has heading + body", JUNK_PRICING_GUIDE.points.every((p) => p.heading.length > 5 && p.body.length > 40));
ok("leads with the volume lesson", /volume/i.test(JUNK_PRICING_GUIDE.points[0].heading));
ok("names the dump-cost trap", JUNK_PRICING_GUIDE.points.some((p) => /dump|depot|transfer station|tonne/i.test(p.body)));

console.log("\nProcess guide");
ok("has ordered steps", JUNK_PROCESS_GUIDE.steps.length >= 5);
ok("every step has heading + body", JUNK_PROCESS_GUIDE.steps.every((s) => s.heading.length > 3 && s.body.length > 30));
ok("steps are numbered in order", JUNK_PROCESS_GUIDE.steps.every((s, i) => s.heading.startsWith(String(i + 1))));
ok("mentions asking for photos/video (ties to media upload)", JUNK_PROCESS_GUIDE.steps.some((s) => /photo|video/i.test(s.body)));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
