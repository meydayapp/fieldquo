// lib/messaging/inboxPoll.js
//
// What one tick of /app/messages' poll does — as a pure function, so the
// check script can execute every case instead of reading a React effect.
//
// The screen re-reads the list and the open conversation every POLL_MS while
// the tab is visible (app/app/messages/page.js). Three decisions hide in that
// sentence, and each has a way to be wrong that looks fine in a demo:
//
//   hidden tab      ask nothing. A background tab polling all day is load for
//                   nobody, and the tab catches up the moment it is visible.
//   open thread     re-read it too. Polling only the list is how a reply sat
//                   unseen in the conversation the owner had open
//                   (2026-09-28): the list row moved, the bubbles did not.
//   mark read       only when the conversation is IN FRONT of the reader —
//                   always from lg up (list and thread side by side), and on
//                   a phone only on the thread pane. Marking read while a
//                   phone shows the list would clear the one badge telling
//                   them a homeowner wrote.

/** 15s: the slowest cadence that still reads as a live chat. */
export const INBOX_POLL_MS = 15 * 1000;

/**
 * @param {{ hidden: boolean, activeId: string|null, wide: boolean, threadPaneShown: boolean }} s
 * @returns {{ list: boolean, thread: boolean, markRead: boolean }}
 */
export function inboxPollPlan({ hidden, activeId, wide, threadPaneShown } = {}) {
  if (hidden) return { list: false, thread: false, markRead: false };
  const thread = Boolean(activeId);
  return { list: true, thread, markRead: thread && Boolean(wide || threadPaneShown) };
}
