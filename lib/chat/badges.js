// lib/chat/badges.js
//
// "The unread digits changed" — said by a chat screen, heard by the chrome
// around it.
//
// The Team badge in the /sales sidebar (app/sales/SalesShell.js) re-reads
// /api/sales/badges on its own ten-second clock, and the chat's own room
// list polls at fifteen. Opening a room marks it seen on the server at once,
// but nothing told either poller, so the digit sat there for up to a poll
// after the room was plainly open — long enough that the owner reported
// unread counts that "don't clear". One window event closes the gap: the
// chat dispatches it after anything that moves lastSeenAt (an open, a send,
// a return to the tab) and the shell re-reads on it instead of waiting.
//
// A DOM event rather than a store or context because the two parties are in
// different trees — the shell is a layout, the chat is a page inside it —
// and window is the one thing both have. The /app chrome's Chat digit (the
// phone tab bars, the rail row, the crew's big Chat button) listens through
// app/hooks/useChatUnread.js, which re-reads /api/chat/unread on it — so a
// room opened on /app/chat clears the tab's number at once.
export const BADGES_EVENT = "fieldquo:badges";

/** Tell the chrome the digits are stale. A no-op on the server. */
export function announceBadgesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BADGES_EVENT));
}

/** Re-read on the announcement. Returns the unsubscribe. */
export function onBadgesChanged(fn) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(BADGES_EVENT, fn);
  return () => window.removeEventListener(BADGES_EVENT, fn);
}
