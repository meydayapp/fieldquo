// app/components/chat/index.js
//
// The shared chat kit: the pieces a chat client is made of, drawn once.
//
// /sales/messages (texts with a prospect) and the team chat both render
// these. Two screens that should feel the same are not styled the same
// twice; they are rendered by the same components. The arithmetic behind
// the Thread lives in lib/chat/threadLayout.js and is executed by
// scripts/check-chat-kit.mjs.
export { default as ChatLayout, PANE_LIST, PANE_THREAD, PANE_CONTEXT } from "./ChatLayout";
export { default as RoomList, RoomListGroup, RoomListItem, UnreadBadge, roomTimeLabel } from "./RoomList";
export { default as Thread, DayBubble, dayLabel } from "./Thread";
export { default as Composer } from "./Composer";
export { default as ContextBar } from "./ContextBar";
export { default as Avatar, initialsOf, CHANNEL_ICONS } from "./Avatar";
