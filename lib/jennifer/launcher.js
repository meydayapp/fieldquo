// lib/jennifer/launcher.js
//
// Where the floating "Chat with Jennifer" launcher is NOT drawn.
//
// The launcher rides above every registered bottom dock (app/hooks/
// useBottomDock.js) — a page's Save / Send bar — so it never sits on a
// primary button. A chat screen is a different shape: its composer is the
// bottom of a full-height pane, not a fixed bar, and its Send button is in
// the exact bottom-right corner the launcher occupies. The live test
// (2026-10-04) found the launcher covering Send on /app/chat, on a desktop
// crew layout and on a phone.
//
// Registering the composer as a dock was considered and refused: a dock also
// pads <main> by its height (app/globals.css, "bottom dock"), and the chat
// pane already fills the viewport — the padding would push the composer up
// by its own height and leave a dead band under it. The launcher is the
// thing out of place here, so it is the thing that goes: somebody in a
// conversation with their team is not looking for the support chat, and
// every other screen still has it.
//
// Pure, no imports — scripts/check-bottom-dock.mjs runs it in bare Node.

/** Screens whose own message composer owns the bottom-right corner. */
export const LAUNCHER_HIDDEN_PREFIXES = Object.freeze([
  // The team chat (rooms, DMs) — the crew's Messages tab lands here too.
  "/app/chat",
  // Client conversations (SMS, email, WhatsApp threads) — the same composer
  // shape, the same corner.
  "/app/messages",
]);

/**
 * Should the launcher be hidden on this path? A prefix matches the path
 * itself and anything under it ("/app/chat", "/app/chat/abc"), never a
 * sibling that merely starts with the same letters ("/app/chatbot").
 */
export function launcherHiddenOn(pathname) {
  const path = typeof pathname === "string" ? pathname.split(/[?#]/)[0] : "";
  if (!path) return false;
  return LAUNCHER_HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
