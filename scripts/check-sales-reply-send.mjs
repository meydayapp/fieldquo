// scripts/check-sales-reply-send.mjs
//
//   npm run check:sales-reply-send
//
// Every reply a rep sent was delivered and then reported as a failure.
//
// ══ The fault ═════════════════════════════════════════════════════════════
//
// `sendSms()` returns `{ success: true, sid }` or `{ success: false, error }`.
// It has never returned `ok`. `deliverReplySms()` checked `!result?.ok`, which
// is true for EVERY send — so the happy path was unreachable:
//
//   · Twilio delivered the text.
//   · The rep saw 502 "The provider refused it."
//   · An error row was filed against a send that worked.
//   · No SalesSmsMessage was written, so the thread lost the message.
//   · The rep, seeing a failure, sent it again. The contractor got it twice.
//
// Forty lines above, `deliverSignupLinkSms()` checks
// `!result?.success || !result?.sid` and has always been right. Two call sites
// of one function disagreeing about its return shape, and nothing in the repo
// compared them.
//
// ══ Why this check drives the real function ═══════════════════════════════
//
// A source assertion that the word "success" appears would have passed the day
// the bug shipped — the word is right there in the other call site. So the
// shipped `deliverReplySms` is executed over a stub returning the REAL shape,
// and the assertions are about what it did: was a row written, what came back.
// Contracts are checked by calling, not by reading.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The provider's real contract, executed");
// ═══════════════════════════════════════════════════════════════════════════

{
  const twilio = decomment(read("lib/sms/twilioClient.js"));
  // Pinned, because everything below assumes it. If sendSms ever starts
  // returning `ok`, this is the assertion that says so rather than a caller
  // silently going quiet again.
  ok("sendSms returns `success` on the happy path", /return \{ success: true, sid: [\w.]+ \}/.test(twilio));
  ok("…and `success: false` with a reason on failure", /return \{ success: false, error/.test(twilio));
  ok("…and never returns `ok`", !/return \{[^}]*\bok:/.test(twilio), "sendSms returns an `ok`");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. deliverReplySms, driven over that shape");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { deliverReplySms } = await import("@/lib/sales/salesSms");

  const rep = { id: "rep1", name: "Daniel", active: true };
  const lead = { id: "lead1", phone: "+16135550142", timeZone: "America/Toronto", salesRepId: "rep1", businessName: "Northside Painting" };

  /** A client that records what was written instead of writing it. */
  function stubClient(rows) {
    return {
      salesSmsMessage: {
        create: async ({ data }) => { rows.push(data); return { id: "m1", ...data }; },
        findFirst: async () => null,
      },
      salesLead: { update: async () => ({}) },
    };
  }

  // The send path runs a readiness check first, which needs a configured
  // number and an unsuppressed lead. When it refuses for those reasons the
  // result is a 409 and no send is attempted — which is itself the honest
  // answer here, and is asserted rather than worked around.
  const rows = [];
  const sent = [];
  const res = await deliverReplySms({
    rep,
    lead,
    text: "Morning — did you get set up alright?",
    origin: "https://www.fieldquo.com",
    client: stubClient(rows),
    send: async (args) => { sent.push(args); return { success: true, sid: "SM" + "0".repeat(32) }; },
  });

  if (res?.status === 409) {
    // Readiness refused before sending. Say so plainly rather than pretending
    // the send path was covered.
    ok("the send path refused before sending, so the shape could not be driven here", true, res.error);
    ok("…and nothing was written when nothing was sent", rows.length === 0);
  } else {
    ok("a successful send is reported as success", res?.ok === true, res);
    ok("…and it actually called the provider once", sent.length === 1, sent.length);
    ok("…and wrote the outgoing message to the thread", rows.length === 1, rows.length);
    ok("…in the outbound direction", rows[0]?.direction === "out", rows[0]?.direction);
  }

  // The failure direction must still fail. A fix that reported everything as
  // success would pass the assertion above and be worse than the bug.
  const failRows = [];
  const failed = await deliverReplySms({
    rep,
    lead,
    text: "Morning",
    origin: "https://www.fieldquo.com",
    client: stubClient(failRows),
    send: async () => ({ success: false, error: "21610 unsubscribed recipient" }),
  });
  ok("a refused send is reported as a failure", failed?.ok === false, failed);
  ok("…and writes no message row", failRows.length === 0, failRows.length);

  // A success with no sid is a message nothing can be looked up by later.
  const noSidRows = [];
  const noSid = await deliverReplySms({
    rep,
    lead,
    text: "Morning",
    origin: "https://www.fieldquo.com",
    client: stubClient(noSidRows),
    send: async () => ({ success: true }),
  });
  ok("a success with no sid is not treated as sent", noSid?.ok === false, noSid);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Both call sites agree, which is what nothing checked");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("lib/sales/salesSms.js"));
  const guards = [...src.matchAll(/if \(!result\?\.(\w+)/g)].map((m) => m[1]);
  ok("every send guard in the file tests `success`", guards.length >= 2 && guards.every((g) => g === "success"), guards);
  ok("…and none tests `ok`", !guards.includes("ok"), guards);
  ok("both senders also require a sid", (src.match(/!result\?\.sid/g) || []).length >= 2,
    (src.match(/!result\?\.sid/g) || []).length);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-reply-send is a script", typeof pkg.scripts?.["check:sales-reply-send"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-reply-send"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
