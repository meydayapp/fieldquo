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

  // No number to lend. Says what is true and stops — it used to promise that a
  // number added to our account "appears here to switch on", which was false in
  // the state the owner was actually in, because the switch is gated on the
  // deployment too. That state now returns above and never reaches this line.
  if (!line && numbers.length === 0) blocks.push("noNumbers");

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
  if (ready && test?.to) actions.push("test");
  if (line) actions.push("off");

  return { blocks, actions, tone: ready ? "ready" : "blocked" };
}
