#!/usr/bin/env node
//
// scripts/check-sales-identity.mjs
//
// From and Reply-To are two different addresses, and conflating them blocked
// sending for a reason that did not exist. These assertions pin the
// distinction so it cannot be re-conflated.
import { resolveSendingIdentity } from "../lib/sales/outreachIdentity.js";

let passed = 0;
const failures = [];
const ok = (n, c, d = "") => {
  if (c) { passed++; console.log("  ✓ " + n); }
  else { failures.push(n + (d ? ` — ${d}` : "")); console.log("  ✗ " + n + (d ? ` — ${d}` : "")); }
};

const REP = { name: "Daniel Smith", email: "daniel@personal.example", workEmail: "daniel@fieldquo.com", code: "daniel7" };

console.log("\nFrom uses a verified sending domain; the mailbox need not exist there");
const r = resolveSendingIdentity(REP, "send.fieldquo.com");
ok("it sends", r.ok, r.reason || "");
ok("From is on the SENDING domain", r.from === "daniel@send.fieldquo.com", r.from);
// The whole correction: nothing about the reply mailbox's domain is verified,
// and nothing needs to be, because nothing sends from it.
ok("Reply-To is the rep's REAL mailbox", r.replyTo === "daniel@fieldquo.com", r.replyTo);
ok("From and Reply-To are different addresses", r.from !== r.replyTo);

console.log("\nAn unverified reply domain does NOT block sending");
const gmail = resolveSendingIdentity(
  { ...REP, workEmail: "daniel.smith@gmail.com" },
  "send.fieldquo.com",
);
ok("a rep on any mailbox provider can send", gmail.ok, gmail.reason || "");
ok("and replies go to that mailbox", gmail.replyTo === "daniel.smith@gmail.com", gmail.replyTo);
ok("while From stays on our verified domain", gmail.from === "daniel.smith@send.fieldquo.com", gmail.from);

console.log("\nWhat DOES block sending");
const noMailbox = resolveSendingIdentity({ ...REP, workEmail: null }, "send.fieldquo.com");
ok("no reply mailbox blocks", !noMailbox.ok);
// Blocked on the thing actually missing — somewhere for the answer to go.
ok("and the reason is the mailbox, not DNS", noMailbox.reason === "no_reply_mailbox", noMailbox.reason);
ok("the message tells the owner what to do", /assign one in the platform console/i.test(noMailbox.detail || ""));

const noDomain = resolveSendingIdentity(REP, "");
ok("no verified sending domain blocks", !noDomain.ok && noDomain.reason === "no_sending_domain", noDomain.reason);
ok("and says a send. subdomain needs no mailboxes", /needs no mailboxes/i.test(noDomain.detail || ""));

// A provider outage is not a misconfiguration and must not read as one.
const unknown = resolveSendingIdentity(REP, null);
ok("'could not ask' is its own refusal", !unknown.ok && unknown.reason === "sending_domain_unknown", unknown.reason);
ok("distinct from 'no domain'", unknown.reason !== noDomain.reason);

const bad = resolveSendingIdentity({ ...REP, workEmail: "not-an-address" }, "send.fieldquo.com");
ok("a malformed mailbox blocks", !bad.ok && bad.reason === "invalid_reply_mailbox", bad.reason);

console.log("\nThe From local part follows the rep");
// Two reps must never be indistinguishable in a prospect's inbox.
const other = resolveSendingIdentity(
  { name: "Anna Ivanova", workEmail: "anna@fieldquo.com", code: "anna3" },
  "send.fieldquo.com",
);
ok("a second rep gets a different From", other.from !== r.from, `${other.from} vs ${r.from}`);
ok("never a shared address", !/^(sales|info|contact|quotes)@/.test(other.from || ""), other.from);

const odd = resolveSendingIdentity(
  { name: "X", workEmail: "Dan.O'Brien+tag@fieldquo.com", code: "dan9" },
  "send.fieldquo.com",
);
ok("odd characters are stripped, not passed through", /^[a-z0-9.-]+@send\.fieldquo\.com$/.test(odd.from || ""), odd.from);

console.log("");
if (failures.length) {
  console.error(`FAILED — ${failures.length} of ${passed + failures.length}`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`PASSED — ${passed}/${passed} assertions`);
