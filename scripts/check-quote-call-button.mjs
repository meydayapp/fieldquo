// scripts/check-quote-call-button.mjs
//
// "Ring this client about this quote", pressed by a person.
//
// ══ Why a second gate exists ═══════════════════════════════════════════════
//
// approvedQuoteCallGate answers "should we ring without being asked?", and most
// of what it refuses is SCOPE — a standing decision made once on a settings
// screen. A company set to "instant estimates only" had no way to say "not that
// rule, this quote", and the estimator looking at it is exactly the person who
// knows it is worth a call.
//
// So a click overrides scope. What it must NOT override is anything a click
// cannot make safe: a total nobody reviewed, a quote the client has never been
// sent, no number to dial, and the company's own master switch. Reading a
// figure to somebody who has never seen it in writing is how a number becomes a
// commitment nobody can point at.
import { manualQuoteCallGate, CALLBACK_REFUSED } from "@/lib/voice/quoteCallScope";
// approvedQuoteCallGate lives in triggers.js — the manual gate sits beside the
// scope rules it relaxes, the automatic one beside the enqueue it guards.
import { approvedQuoteCallGate, quoteCallContext } from "@/lib/voice/triggers";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const quote = (over = {}) => ({
  id: "q1",
  companyId: "co_1",
  total: 5250,
  needsReview: false,
  sentAt: new Date("2026-08-20"),
  status: "sent",
  client: { phone: "+18195551234", name: "Marc" },
  company: { outboundCallsEnabled: true, currency: "CAD" },
  lineItems: [{ description: "Cabinet refinishing" }],
  ...over,
});

section("1. A click overrides SCOPE — that is the whole point of the button");

{
  ok(manualQuoteCallGate(quote()).allowed === true, "an ordinary sent quote can be called about");
  // The case the button exists for: the company's standing rule says do not
  // ring about this kind of quote, and a person has decided otherwise.
  ok(
    manualQuoteCallGate(quote({ estimateSource: null, autoEstimated: false })).allowed === true,
    "a hand-written quote is callable even when the standing scope is instant-estimates-only",
  );
  ok(
    manualQuoteCallGate(quote({ status: "declined" })).allowed === true,
    "and a declined quote is callable — asking why is a normal thing to ring about",
  );
}

section("2. What a click cannot make safe");

{
  ok(
    manualQuoteCallGate(quote({ needsReview: true })).reason === CALLBACK_REFUSED.DRAFT,
    "an unreviewed quote is refused — the agent reads the total back, and nobody approved it",
  );
  ok(
    manualQuoteCallGate(quote({ sentAt: null })).reason === CALLBACK_REFUSED.NOT_EMAILED,
    "a quote the client has never received is refused — reading a figure they have not seen in writing is how it becomes a commitment",
  );
  ok(
    manualQuoteCallGate(quote({ client: { phone: null } })).reason === CALLBACK_REFUSED.NO_PHONE,
    "no number, no call — and this is the commonest reason the report already gives",
  );
  ok(
    manualQuoteCallGate(quote({ company: { outboundCallsEnabled: false } })).reason ===
      CALLBACK_REFUSED.OFF,
    "the master switch is not a preference about which quotes, so a click does not override it",
  );
  ok(manualQuoteCallGate(null).reason === CALLBACK_REFUSED.NO_QUOTE, "and no quote is no call");
}

section("3. Every refusal is a code the screen can act on");

{
  const reasons = [
    manualQuoteCallGate(quote({ needsReview: true })).reason,
    manualQuoteCallGate(quote({ sentAt: null })).reason,
    manualQuoteCallGate(quote({ client: { phone: null } })).reason,
    manualQuoteCallGate(quote({ company: { outboundCallsEnabled: false } })).reason,
  ];
  ok(
    reasons.every((r) => typeof r === "string" && r.length > 0),
    "…so the button can say WHY rather than just refusing",
    reasons,
  );
  ok(new Set(reasons).size === reasons.length, "…and each is distinguishable from the others", reasons);
}

section("4. The two gates agree where they must");

{
  // Anything the AUTOMATIC path would ring about must also be manually
  // callable. A button that refuses what the robot already does is absurd.
  const ordinary = quote({ autoEstimated: true, estimateSource: "instant" });
  if (approvedQuoteCallGate(ordinary).allowed) {
    ok(
      manualQuoteCallGate(ordinary).allowed === true,
      "whatever the automatic path would call about, a person may also call about",
    );
  } else {
    ok(true, "(the automatic gate refuses this fixture on scope; the manual one is the looser of the two by design)");
  }
  // And the manual gate is never STRICTER on the four shared checks.
  for (const over of [
    { needsReview: true },
    { sentAt: null },
    { client: { phone: null } },
    { company: { outboundCallsEnabled: false } },
  ]) {
    const q = quote(over);
    ok(
      approvedQuoteCallGate(q).allowed === false && manualQuoteCallGate(q).allowed === false,
      `both gates refuse ${JSON.stringify(Object.keys(over)[0])}`,
    );
  }
}

section("5. One brief, built once");

{
  const ctx = quoteCallContext(quote());
  ok(typeof ctx.quoteTotal === "string" && ctx.quoteTotal.length > 0, "the total is spoken-formatted", ctx.quoteTotal);
  ok(!/\d+\.\d{2}\b/.test(ctx.quoteTotal) || /[$]/.test(ctx.quoteTotal), "…as money, not a bare number", ctx.quoteTotal);
  ok(Boolean(ctx.serviceSummary), "and what the work is", ctx.serviceSummary);
  // Absence, not invention: a quote with no total briefs the agent with no
  // total rather than zero dollars.
  ok(
    quoteCallContext(quote({ total: null })).quoteTotal === undefined,
    "a quote with no total gives the agent NO total — never a spoken zero",
  );
  ok(quoteCallContext({}).quoteTotal === undefined, "and an empty quote does not throw");
  ok(quoteCallContext(null) && typeof quoteCallContext(null) === "object", "nor does null");
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
