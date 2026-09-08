// lib/messaging/composerState.js
//
// Why the reply box is off, and what the empty inbox says instead — as two
// pure functions rather than as conditions scattered through the page.
//
// ══ Why this is not inline in the page ═════════════════════════════════════
//
// Two reasons, and the first one is a bug this repo has already shipped once.
// The crew-inbox setup panel had two correct branches in different halves of a
// component that could each render the same blocker, and nothing could see
// both at once; lib/crew/panelBlocks.js exists because of it. Same shape here:
// "the composer is disabled" and "here is why it is disabled" must be ONE
// decision or they will eventually disagree, and the disagreement will be a
// disabled box with no reason on it.
//
// The second reason is that this is the claim scripts/check-messaging.mjs most
// needs to EXECUTE — "when no Page is connected, the composer is disabled AND
// a reason is shown" — and a check cannot import a .js file full of JSX.
//
// Returns i18n KEYS, not sentences: the page translates them, and
// check-translations.mjs sees them as ordinary string literals and asserts all
// nine languages carry them.

/**
 * The key for the sentence printed ON the disabled composer, or null when the
 * contractor may type.
 *
 * The order is the order of what is actually blocking. Telling somebody
 * "connect a Page" when the truth is "Meta has not approved us yet" sends them
 * looking for a button that would refuse them.
 */
export function composerBlock(connection) {
  if (!connection) return "app.messages.compose.disabled.notConnected";
  // The demo company can read a sample conversation and must not be told a
  // reply went out. Checked BEFORE `connected`, because a mock connection
  // reports itself as connected — that is what makes the demo work.
  if (connection.mock) return "app.messages.compose.disabled.demo";
  if (connection.connected) return null;
  switch (connection.reason) {
    case "awaiting_meta_approval":
      return "app.messages.compose.disabled.awaitingApproval";
    case "not_configured":
      return "app.messages.compose.disabled.notConfigured";
    case "needs_reauth":
      return "app.messages.compose.disabled.needsReauth";
    default:
      return "app.messages.compose.disabled.notConnected";
  }
}

/**
 * The key for the panel above the inbox, which says the same thing at length.
 *
 * Null for a working connection, INCLUDING a demo one — a sample inbox needs
 * no banner explaining why it is empty, because it is not empty.
 */
export function connectionBlurb(connection) {
  if (!connection || connection.connected) return null;
  switch (connection.reason) {
    case "awaiting_meta_approval":
      return "app.messages.connect.awaitingApproval";
    case "not_configured":
      return "app.messages.connect.notConfigured";
    case "needs_reauth":
      return "app.messages.connect.needsReauth";
    default:
      return "app.messages.connect.notConnected";
  }
}
