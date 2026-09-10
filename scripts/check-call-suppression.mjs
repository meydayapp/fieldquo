// scripts/check-call-suppression.mjs
//
//   npm run check:call-suppression
//
// The dialler did not read the do-not-contact list.
//
// ══ How this was found ════════════════════════════════════════════════════
//
// The owner read page 2 of the rep SOP — "an opt-out is final; once somebody
// says stop, only a superadmin can lift it, with a written reason" — and said:
// "for the sales rep who are on the phone there is nothing in the code that
// stops the call."
//
// He was right, and only half the sentence was wrong. The LIFT half is real:
// app/api/platform/suppressions refuses anybody who is not a superadmin, and
// unsuppress() demands an admin id and a reason. What was missing was the
// enforcement on the one channel with the worst exposure.
//
// A contractor who replies STOP to one of our texts is written to the
// suppression list across ALL_CHANNELS — lib/sales/salesSms.js does exactly
// that, and it covers voice. Outbound EMAIL checked that list. Outbound SMS
// checked it. An INBOUND call checked it. app/api/sales/calls — the route that
// places an outbound call — read only the prospect's own `doNotContactAt`
// column and never consulted the list at all.
//
// So somebody who said stop by text stayed dialable, the screen offered the
// button, and the rep placing that call had no way to know. That is a
// regulatory problem rather than an inconvenience, which is why it gets its
// own check rather than a line in an existing one.
//
// ══ Executed against a stub, because the table is empty ═══════════════════
//
// Nobody has said STOP yet, so there is no live row to assert against. The
// real checkSuppression() runs here over a fake `db` that returns the rows a
// real STOP would have written — the function under test is the shipped one,
// only the storage is faked.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { checkSuppression } from "@/lib/sales/suppression";

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

const STOPPED = "+16135550142";
/** What lib/sales/salesSms.js writes when a contractor texts STOP. */
const stopRow = {
  kind: "phone",
  value: STOPPED,
  channels: ["email", "phone", "sms"],
  removedAt: null,
  reason: "STOP",
  createdAt: new Date("2026-09-01"),
};
const fakeDb = (rows) => ({ salesSuppression: { findMany: async () => rows } });

// ═══════════════════════════════════════════════════════════════════════════
section("1. A texted STOP suppresses the PHONE, not only texts");
// ═══════════════════════════════════════════════════════════════════════════

{
  const v = await checkSuppression(fakeDb([stopRow]), { channel: "phone", phone: STOPPED });
  ok("a STOP blocks the voice channel", v.suppressed === true, v);
  ok("…with a reason a rep can read", typeof v.reason === "string" && v.reason.length > 0, v.reason);

  const sms = await checkSuppression(fakeDb([stopRow]), { channel: "sms", phone: STOPPED });
  ok("…and still blocks sms", sms.suppressed === true);
  const email = await checkSuppression(fakeDb([stopRow]), { channel: "email", phone: STOPPED });
  ok("…and email", email.suppressed === true);

  const clean = await checkSuppression(fakeDb([]), { channel: "phone", phone: "+15005550006" });
  ok("a number nobody suppressed is callable", clean.suppressed === false);

  // A lifted suppression must actually lift, or a superadmin's written
  // decision would mean nothing.
  const lifted = await checkSuppression(
    fakeDb([{ ...stopRow, removedAt: new Date("2026-09-05") }]),
    { channel: "phone", phone: STOPPED },
  );
  ok("a lifted suppression no longer blocks", lifted.suppressed === false, lifted);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The dialler reads it, in the request that dials");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = decomment(read("app/api/sales/calls/route.js"));
  ok("the outbound call route checks suppression", /checkSuppression\(db, \{/.test(route),
    "app/api/sales/calls/route.js does not call checkSuppression");
  ok("…on the phone channel", /channel: "phone"/.test(route));
  ok("…for the number it is about to dial", /phone: target\.phoneE164/.test(route));
  ok("…and refuses when suppressed", /suppression\?\.suppressed/.test(route));
  ok("…with 409, the same status the other channels refuse with", /status: 409/.test(route));

  // Fail CLOSED. "We could not read the list" is not permission to ring.
  ok("a list that cannot be read refuses the call rather than risking it",
    /suppressed: true, reason: `The do-not-contact list could not be read/.test(read("app/api/sales/calls/route.js")));

  // The original check must survive alongside it — they are different facts.
  ok("the do-not-contact flag is still refused", /target\.doNotContactAt/.test(route));
  ok("…and the calling window still applies", /salesCallReadiness\(/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every outbound channel now agrees");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The gap was that three of four consulted the list. A future channel that
  // forgets is the same bug wearing different clothes.
  for (const [what, file] of [
    ["outbound email", "lib/sales/outreachSender.js"],
    ["outbound sms", "lib/sales/salesSms.js"],
    ["inbound calls", "app/api/rep-dial/inbound/route.js"],
    ["outbound calls", "app/api/sales/calls/route.js"],
  ]) {
    ok(`${what} consults the suppression list`, /checkSuppression\(/.test(decomment(read(file))));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The half of the SOP that was already true");
// ═══════════════════════════════════════════════════════════════════════════

{
  const admin = decomment(read("app/api/platform/suppressions/route.js"));
  ok("lifting is superadmin-only", /admin\.role !== "superadmin"/.test(admin));
  const lib = read("lib/sales/suppression.js");
  ok("unsuppress takes an admin and a reason", /export async function unsuppress\(db, \{ kind, value, adminId, reason \}/.test(lib));
  // Said in the refusal itself, so a rep is never left guessing who to ask.
  ok("the refusal tells the rep who can lift it",
    /Only a superadmin can lift a do-not-contact/.test(read("app/api/sales/calls/route.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:call-suppression is a script", typeof pkg.scripts?.["check:call-suppression"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:call-suppression"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
