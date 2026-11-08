// scripts/check-provider-billing.mjs
//
// "I have credits but when I tried getting the phone number it said that
// error" — the owner, 2026-11-07, with a screenshot of a red banner reading
//
//     Payment overdue, service stopped.
//
// directly beneath a card reading "Balance: US$10.00".
//
// ══ Whose payment ══════════════════════════════════════════════════════════
//
// Not his. That sentence is Retell's, about FieldQuo's own account with
// Retell, returned as HTTP 402 from /create-phone-number and relayed word for
// word because lib/voice/retell.js took `parsed.message` on every non-2xx and
// app/api/settings/voice/number/route.js shows a RetellError's `message` to
// the contractor.
//
// Two things wrong with that, and the second is the worse one:
//
//   1. It accuses the reader of not paying, beside his own paid-up balance.
//   2. It tells a tenant that FieldQuo has an unpaid supplier bill. The whole
//      product is white-label; a FieldQuo fact has no business on a
//      contractor's screen, least of all that one.
//
// ══ Why this file runs the code instead of grepping it ═════════════════════
//
// A grep can see a 402 branch. Only running it can show that the sentence the
// contractor reads contains none of the provider's wording while the
// DIAGNOSTIC still does — those two have to come apart, and the easy mistake
// is to suppress both.

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// The exact body Retell returned on 2026-11-08T02:55:31Z, from the Vercel
// runtime log for POST /api/settings/voice/number. Not paraphrased: the
// envelope matters, because `status: "error"` sits beside `message` and a
// reader skimming for `error_message` would miss where the sentence lives.
const RETELL_402 = { status: "error", message: "Payment overdue, service stopped." };

// Words that are only ever about FieldQuo's own bill. If one of these reaches
// the contractor's screen, the leak is back whatever else the sentence says.
const VENDOR_WORDS = ["overdue", "payment", "unpaid", "suspend", "retell"];

function leaked(text) {
  const low = String(text || "").toLowerCase();
  return VENDOR_WORDS.filter((w) => low.includes(w));
}

let nextResponse = null;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
  const { status, payload } = nextResponse;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
};

process.env.RETELL_API_KEY = "test-key-not-a-real-one";

const { buyNumber, RETELL_ERROR_KINDS } = await import("@/lib/voice/retell.js");

async function buyAndCatch(status, payload) {
  nextResponse = { status, payload };
  try {
    await buyNumber({ phoneNumber: "+13437008994", agentId: "agent_1", nickname: "FieldQuo aey1fl" });
    return null;
  } catch (err) {
    return err;
  }
}

/* ───────────────────────────── 1. the leak ──────────────────────────────── */

section("1. Retell's 402 never reaches the contractor");

const e402 = await buyAndCatch(402, RETELL_402);
ok(Boolean(e402), "a 402 still throws — the purchase must not look like it worked");
ok(leaked(e402?.message).length === 0, "the message a contractor reads carries none of the provider's wording", {
  message: e402?.message,
  leaked: leaked(e402?.message),
});
ok(
  /nothing has been charged/i.test(e402?.message || ""),
  "and it says plainly that nothing was charged — the one thing he needs to know",
  e402?.message,
);

/* ── 2. the diagnostic survives ───────────────────────────────────────────
   Suppressing the sentence on screen and suppressing it in the logs are the
   same edit if you are careless, and the second one would have left this bug
   undiagnosable: the Vercel log is the only reason it took minutes instead of
   days. */

section("2. the provider's own words are kept where they belong");

ok(e402?.body?.message === RETELL_402.message, "err.body keeps Retell's sentence verbatim for the log", e402?.body);
ok(e402?.status === 402, "err.status is still the real HTTP status, for any caller that branches on it", e402?.status);

/* ───────────────────────── 3. the kind is honest ─────────────────────────
   402 used to fall through kindForStatus to `invalid_request`, documented in
   this very file as "our body was wrong". It wasn't — the body was perfect,
   and a reader sent to look for a malformed request would have found nothing
   and concluded the code was fine. */

section("3. a billing refusal is not a malformed request");

ok(e402?.kind === "provider_billing", "402 is kind `provider_billing`", e402?.kind);
ok(e402?.kind !== "invalid_request", "and specifically NOT `invalid_request`, which sends a reader at our own body");
ok(RETELL_ERROR_KINDS.includes("provider_billing"), "the kind is declared in RETELL_ERROR_KINDS, not invented at the throw site");

/* ── 4. nothing else changed ──────────────────────────────────────────────
   The 402 branch is a special case, and a special case that quietly swallows
   its neighbours is worse than the bug it fixes. Every other failure must
   still carry the provider's explanation, which is often the only clue. */

section("4. every other status still relays what the provider said");

const e400 = await buyAndCatch(400, { error_message: "area_code must be a number" });
ok(e400?.message === "area_code must be a number", "a 400 still shows Retell's explanation", e400?.message);
ok(e400?.kind === "invalid_request", "and is still kind `invalid_request`", e400?.kind);

const e500 = await buyAndCatch(500, { message: "internal error" });
ok(e500?.message === "internal error", "a 500 still shows Retell's explanation", e500?.message);
ok(e500?.kind === "provider_error", "and is still kind `provider_error`", e500?.kind);

const e404 = await buyAndCatch(404, {});
ok(/404/.test(e404?.message || ""), "a bodyless failure still names the status", e404?.message);

/* ── 5. the body we send is the one that was refused ──────────────────────
   Proof the 402 was not our fault, kept as an assertion so a future change to
   the request body cannot quietly make it our fault while this check still
   passes on the message alone. */

section("5. the request Retell refused was well formed");

nextResponse = { status: 402, payload: RETELL_402 };
calls.length = 0;
await buyAndCatch(402, RETELL_402);
const sent = calls.at(-1)?.body;
ok(sent?.phone_number === "+13437008994", "the named number is sent, not an area-code range", sent?.phone_number);
ok(sent?.number_provider === "twilio", "with its provider");
ok(sent?.toll_free === false, "toll_free is sent explicitly, both ways");
ok(sent?.country_code === "CA", "and the country");

console.log(fail ? `\n${fail} failed\n` : "\nAll checks passed\n");
process.exit(fail ? 1 : 0);
