// lib/staff/client.js
//
// The browser's side of the staff chat API. One function per route, so the
// screen never spells a path, and scripts/check-route-callers.mjs can see
// every route is reached from here.
//
// Money never travels through here — there is none in a chat — but the same
// discipline as the rest of the client: the browser sends ids and text, the
// server decides what they mean (lib/staff/store.js resolves every id against
// the live directory).
//
// Refusal codes the routes stamp, mapped to catalogue keys so the screen can
// say the refusal in the reader's language — the shape lib/sales/authRefusals
// established. A code not in this table falls back to the route's sentence.
import { fetchJson } from "@/lib/fetchJson";

export const STAFF_REFUSAL_KEYS = Object.freeze({
  no_room: "app.teamChat.refusal.noRoom",
  not_sent: "app.teamChat.refusal.notSent",
  nobody_named: "app.teamChat.refusal.nobodyNamed",
  member_unknown: "app.teamChat.refusal.memberUnknown",
  self: "app.teamChat.refusal.self",
  name_missing: "app.teamChat.refusal.nameMissing",
  name_too_long: "app.teamChat.refusal.nameTooLong",
  name_reserved: "app.teamChat.refusal.nameReserved",
  name_taken: "app.teamChat.refusal.nameTaken",
  default_room: "app.teamChat.refusal.defaultRoom",
  direct_room: "app.teamChat.refusal.directRoom",
  team_room: "app.teamChat.refusal.teamRoom",
  not_owner: "app.teamChat.refusal.notOwner",
  not_member: "app.teamChat.refusal.notMember",
});

const json = (method, body) => ({ method, body });

export const staffApi = {
  /** { me, rooms, joinable } */
  list: () => fetchJson("/api/staff/rooms"),
  /** { me, people } */
  directory: (q = "") => fetchJson(`/api/staff/directory?q=${encodeURIComponent(q || "")}`),
  /** { roomId } */
  openDirect: (person) => fetchJson("/api/staff/rooms", json("POST", { with: { kind: person.kind, id: person.id } })),
  /** { roomId } */
  createChannel: ({ name, topic, isPrivate, members }) =>
    fetchJson("/api/staff/rooms", json("POST", { kind: "channel", name, topic, private: Boolean(isPrivate), members })),
  /** the thread */
  room: (id) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}`),
  /** { ok, message } */
  send: (id, body) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}`, json("POST", { body })),
  /** { ok } */
  update: (id, { name, topic }) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}`, json("PATCH", { name, topic })),
  /** { room, canManage, canLeave, canAdd, members } */
  members: (id) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}/members`),
  /** { ok, added } */
  addMembers: (id, members) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}/members`, json("POST", { members })),
  /** { ok } — the row is closed, never deleted */
  removeMember: (id, person) =>
    fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}/members/${encodeURIComponent(`${person.kind}:${person.id}`)}`, { method: "DELETE" }),
  /** { ok } */
  leave: (id) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}/leave`, { method: "POST" }),
  /** { ok, roomId } */
  join: (id) => fetchJson(`/api/staff/rooms/${encodeURIComponent(id)}/join`, { method: "POST" }),
};
