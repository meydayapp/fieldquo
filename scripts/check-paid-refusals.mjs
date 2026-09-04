// scripts/check-paid-refusals.mjs
//
//   npm run check:paid-refusals
//
// Every paid AI surface refuses the same way, and no refusal is a dead end.
//
// ══ What this is guarding ══════════════════════════════════════════════════
//
// Three separate screens spend the AI wallet: the designer's image generator,
// the designer's background removal, and the quote's deep photo read. All
// three can refuse for want of credit, and the failure this file exists to
// prevent is not the refusal — it is the SHAPE of it:
//
//   1. A reason floating above a separately greyed-out control reads as "the
//      feature is gone". The same reason inside one bordered block, directly
//      above the control it explains, reads as "here is the control, here is
//      why it is off". AiSidebar.js was fixed for exactly this and
//      RemoveBgSidebar.js kept the loose shape for a day — the copy nobody
//      looked at, which is the AGENTS.md duplication class working as
//      advertised.
//   2. A refusal that names the shortfall to the cent and offers no way to pay
//      it is a control that appears to work and doesn't. All three surfaces now
//      open app/components/ai/AiCreditTopupDialog.js on a 402 carrying an
//      offer.
//   3. A price learned AFTER the click is a price nobody agreed to. Each
//      surface names it before.
//
// ══ Executed vs. read ══════════════════════════════════════════════════════
//
// EXECUTED: disabledReasonText() against every reason in its closed list and
// against null, with a recording t-stub — which is how this file proves the
// refusal sentence and the top-up dialog quote the SAME two catalogue strings
// rather than two English templates that drifted. Also publicTopupOffer()
// against the real deep-read price on an empty wallet, because "the offer
// covers the shortfall" is an off-by-one away from "the offer exists".
//
// READ: the JSX shape of the two sidebars and the quote panel, and the 402
// body of the vision route. There is no function to call for "is the reason in
// the same box as the button" — the same reason scripts/check-designer.mjs
// reads its own form isolation rather than rendering it.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-paid-refusals.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { disabledReasonText, centsToDollars } from "@/app/components/designer/hooks/useAiImageStatus";
import { publicTopupOffer, tierCentsFor } from "@/lib/ai/topupOffer";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { VISION_PASS_CENTS, IMAGE_GENERATION_CENTS } from "@/lib/ai/imageEconomics";
import { MESSAGES } from "@/app/i18n/messages";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
/**
 * `ok(condition, label)` — and it THROWS if those are the wrong way round.
 *
 * A swapped call passes forever: a non-empty label is truthy, so `ok("the
 * reason is translated", false)` prints a tick and asserts nothing. That
 * happened elsewhere in this session, so the shape is made impossible here
 * rather than watched for.
 */
const ok = (cond, label, detail) => {
  if (typeof cond === "string") {
    throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  }
  if (typeof label !== "string") {
    throw new TypeError("ok() needs a string label as its second argument");
  }
  console.log(
    (cond ? "  ok   " : "  FAIL ") +
      label +
      (cond || detail === undefined ? "" : `  — got ${JSON.stringify(detail)}`),
  );
  if (!cond) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// Comments in these files QUOTE the broken shapes they were fixed out of —
// RemoveBgSidebar.js's header names "a bare line of grey text" in prose. A raw
// scan reads that as the bug still being present, which is the false-pass this
// whole file would otherwise be built on. Same reason check-designer.mjs and
// check-imports.mjs strip first.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const AI_SIDEBAR = "app/components/designer/AiSidebar.js";
const REMOVE_BG = "app/components/designer/RemoveBgSidebar.js";
const SUGGEST = "app/components/quotes/SuggestAddOns.js";
const VISION_ROUTE = "app/api/quotes/[id]/vision/route.js";

// ═════════════════════════════════════════════════════════════════════════
section("1. The refusal sentence — executed, and quoting the catalogue");
// ═════════════════════════════════════════════════════════════════════════

// A recording stub, not a translator: what matters is WHICH keys are asked
// for. Rendering the English template proves nothing about whether the dialog
// one click later will say the same thing.
function recordingT(asked) {
  return (key, fallback, values) => {
    asked.push(key);
    const template =
      MESSAGES.en?.[key] !== undefined ? MESSAGES.en[key] : String(fallback ?? key);
    return String(template).replace(/\{(\w+)\}/g, (m, name) =>
      values && values[name] !== undefined ? String(values[name]) : m,
    );
  };
}

const broke = {
  reason: "insufficient_balance",
  allowed: false,
  priceCents: IMAGE_GENERATION_CENTS,
  balanceCents: 4,
  shortfallCents: IMAGE_GENERATION_CENTS - 4,
};

{
  const asked = [];
  const sentence = disabledReasonText(broke, recordingT(asked));

  ok(
    asked.includes("app.aiTopup.cost") && asked.includes("app.aiTopup.short"),
    "the money refusal is built from the SAME two catalogue strings the top-up dialog renders",
    asked,
  );
  ok(
    sentence.includes(centsToDollars(broke.priceCents)),
    "…and states the price",
    sentence,
  );
  ok(
    sentence.includes(centsToDollars(broke.balanceCents)),
    "…and the balance",
    sentence,
  );
  ok(
    sentence.includes(centsToDollars(broke.shortfallCents)),
    "…and the exact shortfall",
    sentence,
  );
  ok(
    !/\{\w+\}/.test(sentence),
    "…with every placeholder filled — a raw {price} on screen is the catalogue leaking",
    sentence,
  );
  ok(
    !/app\.aiTopup/.test(sentence),
    "…and never renders a bare key, which is what a missing string looks like",
    sentence,
  );
}

// The AI wallet is USD because the vendors bill FieldQuo in USD — see
// lib/voice/creditCurrency.js. A refusal that quoted the company's own
// currency would understate what the card is about to be charged by the FX
// spread, which is the bug that put this formatter here in the first place.
// Every production company is CAD, so the string has to say WHICH dollars: a
// bare "$0.12" is the failure, not the formatting.
ok(
  centsToDollars(12) === formatAppMoney(0.12, CREDIT_CURRENCY, "en"),
  "the amounts are the wallet's own currency, not the company's",
  centsToDollars(12),
);
ok(
  !/^\$/.test(centsToDollars(12)),
  "…and say which dollars they are, rather than a bare $ on a Canadian account",
  centsToDollars(12),
);

// The dialog one click later quotes the same three numbers. Two formatters
// would print "US$0.12" in the refusal and "$0.12" in the dialog, on the one
// screen where the person is checking that the amount they are about to pay is
// the amount they were told they were short.
{
  const dialog = stripComments(read("app/components/ai/AiCreditTopupDialog.js"));
  ok(
    /formatAppMoney\([\s\S]{0,80}CREDIT_CURRENCY, "en"\)/.test(dialog),
    "the top-up dialog formats its figures the same way the refusal does",
  );
  ok(
    !/`\$\$\{/.test(dialog) && !/=> `\$\$?\{/.test(dialog),
    "…and no longer builds an amount by pasting a $ in front of a number",
  );
}

// The coupling the mutation test above cannot see: t() falls back to English
// on a missing key, so renaming a catalogue entry leaves the refusal rendering
// the hardcoded fallback while the dialog renders something else. Both keys
// must exist, in both gated languages, carrying the placeholders this call
// site fills.
for (const lang of ["en", "fr"]) {
  const dict = MESSAGES[lang] || {};
  ok(
    typeof dict["app.aiTopup.cost"] === "string" &&
      dict["app.aiTopup.cost"].includes("{price}") &&
      dict["app.aiTopup.cost"].includes("{balance}"),
    `app.aiTopup.cost exists in ${lang} and takes {price} and {balance}`,
    dict["app.aiTopup.cost"],
  );
  ok(
    typeof dict["app.aiTopup.short"] === "string" &&
      dict["app.aiTopup.short"].includes("{shortfall}"),
    `app.aiTopup.short exists in ${lang} and takes {shortfall}`,
    dict["app.aiTopup.short"],
  );
}

// Without a translator — a caller that has not got one, or a future non-React
// consumer — the sentence is still a sentence with all three numbers in it,
// never an empty box under a disabled button.
{
  const english = disabledReasonText(broke);
  ok(
    english.includes(centsToDollars(broke.priceCents)) &&
      english.includes(centsToDollars(broke.balanceCents)) &&
      english.includes(centsToDollars(broke.shortfallCents)),
    "with no t() at all it still names price, balance and shortfall",
    english,
  );
  ok(!/\{\w+\}/.test(english), "…and still fills its own placeholders", english);
}

// Every other reason: a sentence, never blank, never "something went wrong",
// and never the reason code itself leaking to screen.
for (const reason of [
  "feature_unavailable",
  "vendor_unavailable",
  "unavailable",
  "a_reason_nobody_has_written_yet",
]) {
  const text = disabledReasonText({ reason, allowed: false });
  ok(
    typeof text === "string" && text.trim().length > 10 && !text.includes(reason),
    `"${reason}" renders a real sentence rather than the code`,
    text,
  );
}

// Absence of a status is not a refusal. Null means "not asked yet" and the
// honest render is nothing at all — inventing a reason here would put a
// permanent explanation under a button that is only briefly disabled.
ok(disabledReasonText(null) === "", "an unknown status produces no sentence at all");

// ═════════════════════════════════════════════════════════════════════════
section("2. One block, not two things — the shape both sidebars must share");
// ═════════════════════════════════════════════════════════════════════════

for (const [name, rel] of [["AiSidebar", AI_SIDEBAR], ["RemoveBgSidebar", REMOVE_BG]]) {
  const code = stripComments(read(rel));

  // The refusal block: from the `!status?.allowed &&` guard to the reason.
  const blockStart = code.indexOf("!status?.allowed &&");
  const reasonAt = code.indexOf("disabledReasonText(status");
  ok(blockStart > -1, `${name}: the refusal block can be isolated`);
  ok(reasonAt > blockStart, `${name}: …and the reason is inside it`);

  // Wide enough to reach the top-up button that follows the sentence in the
  // same block, and no wider — a window that ran to the end of the file would
  // "find" the button anywhere on the panel, which is the arrangement this
  // section exists to rule out.
  const block = blockStart > -1 ? code.slice(blockStart, reasonAt + 800) : "";

  ok(
    /rounded-lg border/.test(block),
    `${name}: the reason sits in a bordered block, not as a loose line of grey text above a dead control`,
  );
  ok(
    /<AlertTriangle/.test(block),
    `${name}: …carrying the same warning mark as the other panel`,
  );
  ok(
    /status\?\.topup && \(/.test(block),
    `${name}: …and the way out is in the SAME block as the reason, gated on the offer being there`,
  );
  ok(
    /t\("app\.aiTopup\.buyCredit"/.test(block),
    `${name}: …labelled from the catalogue`,
  );
  ok(
    /disabledReasonText\(status, t\)/.test(code),
    `${name}: the reason is translated, not an English template built at the call site`,
  );

  // The control is still THERE. Gating its existence on `allowed` is the
  // regression: a panel that renders nothing but a message reads as a
  // withdrawn feature, which is what the owner reported.
  ok(
    !/status\?\.allowed && </.test(code) && !/status\?\.allowed \? </.test(code),
    `${name}: the action control is never hidden behind the refusal — only disabled`,
  );
  ok(
    /disabled=\{!status\?\.allowed/.test(code),
    `${name}: …and it IS disabled, so nothing clickable fails after the fact`,
  );

  // Price before the click, from the live status rather than a constant typed
  // into the copy — a hardcoded price in a description is the next thing to
  // go stale when lib/ai/imageEconomics.js moves.
  ok(
    /centsToDollars\(status\.priceCents\)/.test(code),
    `${name}: the price is named in the panel header, before anything is pressed`,
  );
}

// ═════════════════════════════════════════════════════════════════════════
section("3. The deep photo read — the same refusal, the same way out");
// ═════════════════════════════════════════════════════════════════════════

const visionSrc = stripComments(read(VISION_ROUTE));

ok(
  /status: 402/.test(visionSrc),
  "the credit refusal is a 402 — 'you may, you just have not paid' — not a 403",
);
ok(
  /topup: publicTopupOffer\(reserved\.shortfallCents, can\(member\.role, "user:manage"\)\)/.test(
    visionSrc,
  ),
  "…and it carries the closed tier list, priced off the shortfall the same route just computed",
);
ok(
  /shortfallCents: reserved\.shortfallCents/.test(visionSrc),
  "…alongside the three numbers the sentence is built from",
);
// canBuy is a different question from "may you run a deep read". Hard-coding
// it true would render a purchase button that 403s for an estimator.
ok(
  !/publicTopupOffer\([^)]*,\s*true\)/.test(visionSrc),
  "…and never assumes the person looking at the refusal is allowed to buy",
);

const suggest = stripComments(read(SUGGEST));

ok(
  /err\.status === 402 && err\.data\?\.topup/.test(suggest),
  "SuggestAddOns opens the dialog on a 402 that carries an offer",
);
ok(
  /topup\.open\(err\.data\)/.test(suggest),
  "…handing it the whole refusal body, so the dialog quotes the server's own numbers",
);
{
  const openAt = suggest.indexOf("topup.open(err.data)");
  const setErrAt = suggest.indexOf("setVisionError(err.message)");
  ok(
    openAt > -1 && setErrAt > openAt,
    "…and returns before falling through to the plain sentence, so a payable refusal is never shown as a dead one",
  );
}
ok(
  /useAiCreditTopup\(\{[\s\S]{0,200}pendingKey: "quote\.vision"/.test(suggest),
  "…under its own pending key, so it cannot restore the designer's typed prompt",
);
// Nothing is re-run on the way back from Stripe. A deep read costs money and
// the press has to stay the person's — the dialog's own rule 3.
ok(
  !/onResume/.test(suggest) && !/capturePending/.test(suggest),
  "…and nothing is resumed by spending: coming back does not re-run the paid read",
);
ok(
  /<AiCreditTopupDialog[\s\S]{0,240}<\/Panel>/.test(suggest),
  "the dialog mounts at the panel root, not inside the deep-read block that a read-only quote hides",
);
// The price, before the click, in the wallet's currency and not a bare "$".
ok(
  /formatAppMoney\(VISION_PASS_CENTS \/ 100, CREDIT_CURRENCY, "en"\)/.test(suggest),
  "the deep read names its price up front, formatted as the USD credit it spends",
);
ok(
  !/\$\{?\(?VISION_PASS_CENTS/.test(suggest),
  "…and not by pasting a currency symbol in front of the constant",
);

// ═════════════════════════════════════════════════════════════════════════
section("4. The offer itself — executed against the real prices");
// ═════════════════════════════════════════════════════════════════════════

// An empty wallet, both paid actions. "The offer exists" is not the assertion;
// "the offer is never less than enough" is, because a payment that leaves the
// button still disabled reads as the top-up having failed.
// The third case is the one that BITES. Both real prices are cents, so every
// tier covers them and "the smallest tier" and "the smallest tier that covers"
// are the same answer — an assertion that cannot fail is the false pass this
// file's own ok() guard exists to prevent, and a mutation run proved it. A
// shortfall past the smallest tier separates the two. The exhaustive sweep
// across every shortfall lives in scripts/check-ai-topup-inline.mjs and is not
// copied here; this is the arithmetic tying THESE two prices to that offer.
for (const [label, price] of [
  ["a deep photo read", VISION_PASS_CENTS],
  ["an AI image", IMAGE_GENERATION_CENTS],
  ["a bulk run past the smallest tier", VISION_PASS_CENTS * 300],
]) {
  const offer = publicTopupOffer(price, true);
  const recommended = offer.tiers.find((t) => t.id === offer.recommendedId);
  ok(!!recommended, `${label}: the recommended tier is one of the offered tiers`);
  ok(
    recommended?.covers === true,
    `${label}: …and it covers the shortfall on its own`,
    recommended,
  );
  ok(
    tierCentsFor(offer.recommendedId) >= price,
    `${label}: …priced, server-side, at no less than what is owed`,
    tierCentsFor(offer.recommendedId),
  );
  // AGENTS.md non-negotiable #5. The browser is handed ids and labels; the
  // only thing that turns an id into money runs on the server.
  const serialised = JSON.stringify(offer);
  ok(
    !/"cents"|"amount"|"unit_amount"|"priceCents"/.test(serialised),
    `${label}: …and the browser is never handed an amount it could send back`,
    serialised,
  );
}

// A member who cannot buy is told so rather than shown a button that 403s.
ok(
  publicTopupOffer(VISION_PASS_CENTS, false).canBuy === false,
  "an estimator who cannot buy credit gets an offer marked unbuyable, not a hidden one",
);

console.log(fail === 0 ? "\nALL PASS\n" : `\n${fail} FAILURE(S)\n`);
process.exit(fail === 0 ? 0 : 1);
