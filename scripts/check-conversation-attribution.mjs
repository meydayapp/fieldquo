// scripts/check-conversation-attribution.mjs
//
//   npm run check:conversation-attribution
//
// A homeowner messages a contractor's Facebook Page in March. In April the
// contractor wonders whether that conversation ever became money. Answering
// it means matching a stranger's name, email, phone or address to a client,
// then to the quote that followed, then to the job.
//
// Every step of that is a place to be wrong in a way nobody notices. Two
// homeowners called "J. Smith" in one city is the ordinary case, not the edge
// case, and silently merging them puts one person's conversation against
// another person's invoice. A quote written the week BEFORE the conversation
// did not come from it. And a conversation nobody could match is not a
// conversation that was lost — reporting it as lost invents a failure.
//
// So this file executes the three pure modules against exactly those shapes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contactKeys,
  nameKey,
  addressKey,
  scoreCandidate,
  confidenceFor,
  meetsConfidence,
  matchContactAgainst,
  CONTACT_CONFIDENCE,
} from "../lib/contacts/matchContact.js";
import {
  conversationOutcome,
  ATTRIBUTION_OUTCOMES,
  ATTRIBUTION_WINDOW_DAYS,
} from "../lib/attribution/conversationOutcome.js";
import { monthlyConversations, wonRateOf } from "../lib/attribution/monthlyConversations.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 220));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");

const CO = "co_1";
const day = (d) => new Date(`2026-03-${String(d).padStart(2, "0")}T12:00:00Z`);

// ── Normalising: the same person written five ways ─────────────────────────
ok("a name folds case, accents, punctuation and order",
  nameKey("Tremblay, Marie") === nameKey("  marie   TREMBLAY ") &&
  nameKey("Marie Tremblay") === nameKey("Marié Tremblay"),
  [nameKey("Tremblay, Marie"), nameKey("marie TREMBLAY"), nameKey("Marié Tremblay")]);
ok("an empty name is not a key", !nameKey("") && !nameKey(null));

{
  // A phone is the strongest signal a homeowner gives; five spellings of one
  // number must not read as five people.
  const forms = ["613-555-0142", "(613) 555-0142", "+1 613 555 0142", "6135550142", "1-613-555-0142"];
  const keys = forms.map((p) => contactKeys({ phone: p }).phone);
  ok("every spelling of one phone number normalises the same", new Set(keys).size === 1, keys);
  ok("...and it is not empty", Boolean(keys[0]));
}
{
  const a = contactKeys({ email: "  Marie@Example.COM " }).email;
  const b = contactKeys({ email: "marie@example.com" }).email;
  ok("an email folds case and trims", a === b && a === "marie@example.com", [a, b]);
}
ok("an address reduces to something comparable", Boolean(addressKey("12 Elm St, Ottawa, K1A 0B1")));
ok("a contact with nothing on it is empty", contactKeys({}).isEmpty === true);
ok("...and one with only a name is not", contactKeys({ name: "Marie" }).isEmpty === false);

// ── The rule that matters most: a name alone never auto-links ──────────────
{
  const clients = [
    { id: "c1", companyId: CO, name: "J. Smith", email: "jsmith@example.com", phone: null, address: null },
    { id: "c2", companyId: CO, name: "J. Smith", email: "other@example.com", phone: null, address: null },
  ];
  const byName = matchContactAgainst({ clients, companyId: CO, contact: { name: "J. Smith" } });
  ok("two clients with the same name do not produce a confident match",
    byName.confidence !== "certain", byName.confidence);
  ok("...and the tie is reported rather than guessed",
    byName.client === null || byName.ambiguous === true || (byName.alternatives || []).length > 0,
    { client: byName.client?.id, ambiguous: byName.ambiguous, alts: (byName.alternatives || []).length });

  const single = matchContactAgainst({
    clients: [clients[0]], companyId: CO, contact: { name: "J. Smith" },
  });
  ok("even a UNIQUE name alone is never 'certain'", single.confidence !== "certain", single.confidence);
}

// Email and phone are the two that may link on their own.
{
  const clients = [{ id: "c1", companyId: CO, name: "Marie Tremblay", email: "marie@example.com", phone: "613-555-0142", address: null }];
  const byEmail = matchContactAgainst({ clients, companyId: CO, contact: { email: "MARIE@example.com" } });
  ok("an exact email match is certain", byEmail.confidence === "certain" && byEmail.client?.id === "c1", byEmail.confidence);
  ok("...and says why", (byEmail.reasons || []).includes("email"), byEmail.reasons);

  const byPhone = matchContactAgainst({ clients, companyId: CO, contact: { phone: "+1 (613) 555-0142" } });
  ok("an exact phone match is certain", byPhone.confidence === "certain" && byPhone.client?.id === "c1", byPhone.confidence);
  ok("...and says why", (byPhone.reasons || []).includes("phone"), byPhone.reasons);

  const nobody = matchContactAgainst({ clients, companyId: CO, contact: { email: "someone@else.com" } });
  ok("a stranger matches nobody", nobody.client === null && nobody.confidence === "none", nobody.confidence);

  // The row carries its own companyId and the matcher checks it, so a client
  // belonging to another contractor can never be returned even if a caller
  // hands one over by mistake.
  let crossTenant = false;
  try {
    const r = matchContactAgainst({
      clients: [{ ...clients[0], companyId: "co_OTHER" }],
      companyId: CO, contact: { email: "marie@example.com" },
    });
    crossTenant = r.client === null;
  } catch { crossTenant = true; }
  ok("a client from another company is never matched", crossTenant);
}

ok("every confidence the scorer can return is a declared one",
  CONTACT_CONFIDENCE.includes(confidenceFor([])) && CONTACT_CONFIDENCE.includes(confidenceFor(["email"])));
ok("the confidence floor orders correctly",
  meetsConfidence("certain", "likely") && !meetsConfidence("possible", "likely") && meetsConfidence("likely", "likely"));
ok("scoring a client returns reasons, not a bare number", (() => {
  const s = scoreCandidate(contactKeys({ email: "marie@example.com" }), { id: "c1", email: "marie@example.com" });
  return s && Array.isArray(s.reasons);
})());

// Tenant scoping is not optional, and the module refuses rather than assuming.
{
  let threw = false;
  try { matchContactAgainst({ clients: [], contact: { email: "a@b.com" } }); } catch { threw = true; }
  ok("a match without a company is refused, never guessed", threw);
}
ok("the async matcher scopes its query to the company",
  /where:\s*\{[^}]*companyId/.test(code("lib/contacts/matchContact.js")));

// ── The outcome, every branch ──────────────────────────────────────────────
const MATCH = { client: { id: "c1" }, confidence: "certain", reasons: ["email"] };
const conv = { id: "t1", source: "meta_messenger", startedAt: day(1) };

{
  const r = conversationOutcome({ conversation: conv, match: null, quotes: [], jobs: [] });
  ok("no client matched reads as unmatched", r.outcome === "unmatched", r.outcome);
  ok("...and unmatched is never lost", r.outcome !== "lost");
}
{
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes: [], jobs: [] });
  ok("matched with no quote reads as no_quote", r.outcome === "no_quote", r.outcome);
}
{
  const quotes = [{ id: "q1", clientId: "c1", status: "sent", createdAt: day(3), total: 3200 }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs: [] });
  ok("a quote that is still out reads as quoted, not lost", r.outcome === "quoted", r.outcome);
  ok("...and carries the quote", r.quoteId === "q1", r.quoteId);
}
{
  const quotes = [{ id: "q1", clientId: "c1", status: "declined", createdAt: day(3), total: 3200 }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs: [] });
  ok("a declined quote reads as lost", r.outcome === "lost", r.outcome);
}
{
  const quotes = [{ id: "q1", clientId: "c1", status: "accepted", createdAt: day(3), total: 3200, acceptedAt: day(5) }];
  const jobs = [{ id: "j1", quoteId: "q1", clientId: "c1" }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs });
  ok("an accepted quote with a job reads as won", r.outcome === "won", r.outcome);
  ok("...and carries the job", r.jobId === "j1", r.jobId);
}
{
  // The one that would be wrong silently: a quote that predates the message.
  const quotes = [{ id: "q0", clientId: "c1", status: "accepted", createdAt: new Date("2026-02-01T12:00:00Z"), total: 9000 }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs: [] });
  ok("a quote written BEFORE the conversation is never attributed to it",
    r.quoteId !== "q0" && r.outcome === "no_quote", { outcome: r.outcome, quoteId: r.quoteId });
}
{
  // Outside the window, by one day.
  const late = new Date(day(1).getTime() + (ATTRIBUTION_WINDOW_DAYS + 1) * 86400000);
  const quotes = [{ id: "qLate", clientId: "c1", status: "accepted", createdAt: late, total: 1000 }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs: [] });
  ok("a quote past the attribution window is not attributed", r.quoteId !== "qLate", r.quoteId);
}
{
  // Another client's quote must never be borrowed.
  const quotes = [{ id: "qX", clientId: "OTHER", status: "accepted", createdAt: day(3), total: 5000 }];
  const r = conversationOutcome({ conversation: conv, match: MATCH, quotes, jobs: [] });
  ok("another client's quote is never attributed", r.quoteId !== "qX", r.quoteId);
}
ok("every outcome it can return is a declared one", (() => {
  const outs = [
    conversationOutcome({ conversation: conv, match: null }),
    conversationOutcome({ conversation: conv, match: MATCH }),
  ].map((r) => r.outcome);
  return outs.every((o) => ATTRIBUTION_OUTCOMES.includes(o));
})());

// ── The month ──────────────────────────────────────────────────────────────
// `answered` is separate from `firstReplyMinutes` on purpose: a row that
// reports neither is UNKNOWN, not unanswered. A Lead Ad submission has no
// thread to reply on, and counting it as "we never got back to them" would
// invent a failure. So the fixtures say which they are.
const row = (id, outcome, minutes, startedAt = day(4)) => ({
  id, startedAt, answered: minutes !== null, firstReplyMinutes: minutes,
  outcome: { outcome, startedAt },
});
const unknownReply = (id, outcome, startedAt = day(4)) => ({
  id, startedAt, outcome: { outcome, startedAt },
});
{
  const m = monthlyConversations({ year: 2026, month: 3, conversations: [] });
  ok("an empty month is not an error", m.ok !== false, m.reason);
  // Null, never 0: a month with nothing to score has no rate, and 0% reads as
  // a failure that did not happen.
  ok("...and has no won rate rather than a zero one", m.wonRate.rate === null, m.wonRate);
}
ok("a nonsense month is refused", monthlyConversations({ year: 2026, month: 13, conversations: [] }).ok === false);
{
  const m = monthlyConversations({
    year: 2026, month: 3,
    conversations: [
      row("a", "won", 20), row("b", "won", 35), row("c", "lost", 400),
      row("d", "no_quote", 90), row("e", "unmatched", 10), row("f", "quoted", 55),
    ],
  });
  ok("counts every outcome it was given", m.total === 6, m.total);
  // A bare rate has to be labelled by whoever prints it, and the label is the
  // part that gets it wrong — so the denominator travels with the number.
  ok("the won rate carries its own denominator and a label for it",
    Number.isFinite(m.wonRate.denominator) && Boolean(m.wonRate.denominatorLabel), m.wonRate);
  // Five were matchable; one was not. 2 won of 5 = 40%, never 2 of 6 = 33%.
  ok("...and that denominator excludes the unmatchable",
    m.wonRate.denominator === 5 && m.wonRate.unmatched === 1, m.wonRate);
  ok("...so the rate is over the five, not the six", Math.abs(m.wonRate.rate - 0.4) < 1e-9, m.wonRate.rate);
}
{
  // A conversation nobody answered has NO response time. Counting it as zero
  // would make the slowest month look like the fastest.
  const m = monthlyConversations({
    year: 2026, month: 3,
    conversations: [row("a", "won", 10), row("b", "no_quote", null), row("c", "lost", 50)],
  });
  // The unanswered ones are listed, not just counted — they are the only
  // actionable thing on the screen.
  ok("an unanswered conversation is listed as unanswered", m.unanswered.length === 1, m.unanswered);
  ok("...and is not folded into the median as a zero",
    m.reply.medianMinutes === 30, m.reply);
  ok("...and the two that were answered are the only ones in the median",
    m.reply.answered === 2 && m.reply.unanswered === 1, m.reply);
}
{
  const m = monthlyConversations({
    year: 2026, month: 3,
    conversations: [row("in", "won", 10), row("out", "won", 10, new Date("2026-04-02T12:00:00Z"))],
  });
  ok("a conversation from another month is not counted", m.total === 1, m.total);
}
{
  // A Lead Ad form has no thread, so there is nothing to have replied to.
  // "We do not know" must not become "we ignored them".
  const m = monthlyConversations({
    year: 2026, month: 3,
    conversations: [unknownReply("lead", "won"), row("msg", "won", 15)],
  });
  ok("a conversation with no reply record is unknown, not unanswered",
    m.reply.unknown === 1 && m.reply.unanswered === 0, m.reply);
  ok("...and is not listed among the unanswered to chase", m.unanswered.length === 0, m.unanswered);
}
ok("a month where nothing matched reports no won rate, not zero", (() => {
  const m = monthlyConversations({
    year: 2026, month: 3,
    conversations: [row("a", "unmatched", 10), row("b", "unmatched", 20)],
  });
  return m.wonRate.denominator === 0 && m.wonRate.rate === null && m.wonRate.unmatched === 2;
})());
ok("wonRateOf refuses to divide by nothing", wonRateOf([]).rate === null);
// Revenue has the same discipline: won but not yet invoiced is not zero money.
ok("a won conversation with no invoice yet reports null revenue, not zero", (() => {
  const m = monthlyConversations({ year: 2026, month: 3, conversations: [row("a", "won", 10)] });
  return m.revenue.total === null && m.revenue.notInvoicedYet === 1;
})());
ok("...while a month that won nothing really is zero", (() => {
  const m = monthlyConversations({ year: 2026, month: 3, conversations: [row("a", "lost", 10)] });
  return m.revenue.total === 0;
})());

// ── The shared matcher really is shared ────────────────────────────────────
ok("the past-jobs import uses the shared matcher rather than its own",
  /from "@\/lib\/contacts\/matchContact"/.test(code("lib/jobs/importPastJob.js")),
  "importPastJob.js should import the shared matcher");

console.log(`\ncheck-conversation-attribution: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
