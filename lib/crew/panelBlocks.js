// lib/crew/panelBlocks.js
//
// What the crew-inbox setup panel shows, decided once, as data.
//
// ══ Why this isn't just JSX ════════════════════════════════════════════════
//
// Because the bug was a duplicate, and a duplicate is invisible to every kind
// of checking this repo does. The blocker sentence rendered twice, verbatim, on
// the owner's screen: once as `capability.message`, and once again from a
// second `!signatureConfigured` branch fifteen lines below it that had been
// added later by someone who did not notice the first. Both were correct on
// their own. Nothing could see them together — not a build, not a lint, not a
// reader, because the two conditions sit in different parts of a 200-line
// component and only coincide at runtime.
//
// So the panel's choice of blocks is a pure function over the server's answer,
// and scripts/check-crew-inbox.mjs runs it through every state a contractor can
// be in and asserts the list has no repeats. A third copy of the blocker cannot
// be added without this returning it twice, and the check failing.
//
// ══ It also enforces the other half of the rule ════════════════════════════
//
// "Never ship a control that appears to work and doesn't." An action is in the
// returned list only when pressing it would do something: a claim needs a
// number that exists AND credit AND a deployment that can verify the reply. The
// old panel rendered "Once a texting number is added to it, it appears here to
// switch on" in a state where the switch was gated on something else entirely,
// and would never have appeared.
//
// Client-safe on purpose: no Prisma, no env, no imports at all. It runs in the
// browser bundle and in a bare node check, which is what makes it checkable.

/**
 * @param {object|null} deployment  { available } — can FieldQuo run the feature
 *        at all on this deployment. One boolean, because that is all a tenant
 *        route is allowed to say; what is missing when it can't is FieldQuo's,
 *        and lives on /platform/crew-lines.
 * @param {object|null} capability  the tenant half of crewInboxCapability()
 * @param {object|null} line        the company's CrewInboxNumber, or null
 * @param {Array}  owned            SMS-capable numbers available to claim
 * @param {object|null} provider    { sms, mms } as Twilio reports them
 * @param {object|null} spend       { canReceive, ... } from crewSpendVerdict
 * @param {object|null} test        { to } — the admin's own mobile, or none
 *
 * @returns {{ blocks: string[], actions: string[], tone: "ready"|"blocked" }}
 */
export function crewPanelBlocks({
  deployment = null,
  capability = null,
  line = null,
  owned = [],
  provider = null,
  spend = null,
  test = null,
} = {}) {
  const ready = Boolean(capability?.ready);
  const numbers = Array.isArray(owned) ? owned : [];

  // ── FieldQuo can't run it: one sentence, and stop ────────────────────────
  //
  // Not a shortened panel. The number list, the rate card and the claim button
  // are all statements about something that cannot happen here, and rendering
  // any of them is the dead-control failure. The credit line goes too: nothing
  // is being spent, so quoting a price advertises a meter that isn't running.
  if (deployment && !deployment.available) {
    return { blocks: ["blocker"], actions: [], tone: "blocked" };
  }

  const blocks = [];
  const actions = [];

  // Exactly one of these two. `number` is the ready state — here is the number,
  // copy it; `status` is every other state, said in the contractor's words.
  blocks.push(ready && line ? "number" : "status");

  if (ready && line?.expiresAt) blocks.push("expires");

  // ── Buying their own, and why it is not gated on the loan pool ───────────
  //
  // `owned` is what FieldQuo has spare to LEND. An empty pool says nothing
  // about whether a number can be BOUGHT — the inventory a purchase spends
  // against is the phone company's, not this list — so the two are separate
  // offers and the buy one survives an empty pool.
  //
  // Affordability is deliberately not decided here. The price and the balance
  // arrive together on one search response, and quoting either from a panel
  // load that happened minutes earlier is how the figure on screen and the
  // figure charged come apart. The picker states both from that one response
  // and withholds the buy button itself when the credit won't cover the first
  // month, which is the only place both numbers are known to agree.
  //
  // `=== true` rather than a truthiness test: an older cached payload with no
  // `deployment` at all must not be read as permission to spend money.
  //
  // The capability is asked AS WELL, not instead. Today the two cannot
  // disagree — the route derives `available` and this verdict from the same
  // crewSignatureConfigured() — so this line changes no behaviour. It is here
  // because that agreement lives in the CALLER, and the one thing this function
  // must never do is offer to spend money into a deployment that will refuse
  // the purchase with a 503. Executed against the inconsistent payload in
  // check:crew-line-purchase, which is the only place it can be reached.
  const canBuy =
    !line &&
    deployment?.available === true &&
    capability?.reason !== "not_configured";

  // No number to lend, AND nothing they can do about it. The second half is why
  // this is suppressed once buying is on offer: the sentence ends "there's
  // nothing for you to do", and printing that directly above a button that buys
  // a number is the dead-control failure with the polarity reversed — true copy
  // made false by what sits next to it. It still renders in the state it was
  // written for, where the loan pool is the only source of a number.
  //
  // The sentence itself is already the second attempt. It used to promise that
  // a number added to our account "appears here to switch on", which was false
  // in the state the owner was actually in, because the switch is gated on the
  // deployment too — and that state returns above and never reaches this line.
  if (!line && numbers.length === 0 && !canBuy) blocks.push("noNumbers");

  // A line that takes texts but not photos silently drops the entire point of
  // the feature. A property of the number they hold, so it is theirs to know.
  if (line && provider && provider.sms && !provider.mms) blocks.push("noMms");

  // More than one to choose from: pick, don't guess.
  if (!line && numbers.length > 1) blocks.push("pickNumber");

  // The one thing that is genuinely the contractor's to do.
  if (test && !test.to) blocks.push("addPhone");

  if (spend && !spend.canReceive) blocks.push("paused");
  if (spend) blocks.push("credit");

  // ── Actions, offered only when they would work ───────────────────────────
  const claimable = line ? [line.e164] : numbers.map((n) => n.e164);
  const canClaim = (spend ? spend.canReceive : true) && claimable.length > 0;
  if (!ready && canClaim && (line || numbers.length === 1)) actions.push("claim");
  if (canBuy) actions.push("buy");
  if (ready && test?.to) actions.push("test");
  if (line) actions.push("off");

  return { blocks, actions, tone: ready ? "ready" : "blocked" };
}
