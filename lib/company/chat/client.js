// lib/company/chat/client.js
//
// The browser's side of the company chat API. One function per route, so
// the screen never spells a path and scripts/check-route-callers.mjs can see
// every route is reached from here. The browser sends ids and text; the
// server decides what they mean (lib/company/chat/store.js resolves every
// id against the caller's own company).
//
// Refusal codes the routes stamp, mapped to catalogue keys so the screen can
// say the refusal in the reader's language. A code not in this table falls
// back to the route's sentence.
import { fetchJson } from "@/lib/fetchJson";

export const CHAT_REFUSAL_KEYS = Object.freeze({
  no_room: "app.companyChat.refusal.noRoom",
  read_only: "app.companyChat.refusal.readOnly",
  empty: "app.companyChat.refusal.empty",
  self: "app.companyChat.refusal.self",
  member_unknown: "app.companyChat.refusal.memberUnknown",
  nobody_named: "app.companyChat.refusal.nobodyNamed",
});

const json = (method, body) => ({ method, body });

export const chatApi = {
  /** { me, rooms } */
  list: () => fetchJson("/api/chat/rooms"),
  /** { me, people } */
  directory: (q = "") => fetchJson(`/api/chat/directory?q=${encodeURIComponent(q || "")}`),
  /** { roomId } */
  openDirect: (memberId) => fetchJson("/api/chat/rooms", json("POST", { with: memberId })),
  /** the thread */
  room: (id) => fetchJson(`/api/chat/rooms/${encodeURIComponent(id)}`),
  /** { ok, message } */
  send: (id, body) => fetchJson(`/api/chat/rooms/${encodeURIComponent(id)}`, json("POST", { body })),
  /** { room, members } */
  members: (id) => fetchJson(`/api/chat/rooms/${encodeURIComponent(id)}/members`),
};
