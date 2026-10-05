// lib/company/chat/client.js
//
// The browser's side of the company chat API. One function per route, so
// the screen never spells a path and scripts/check-route-callers.mjs can see
// every route is reached from here. The browser sends ids and text; the
// server decides what they mean (lib/company/chat/store.js resolves every
// id against the caller's own company, and decides every permission again).
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
  not_allowed: "app.companyChat.refusal.notAllowed",
  fixed_room: "app.companyChat.refusal.fixedRoom",
  archived: "app.companyChat.refusal.archived",
  office_only: "app.companyChat.refusal.officeOnly",
  auto_join: "app.companyChat.refusal.autoJoin",
  not_member: "app.companyChat.refusal.notMember",
  bad_setting: "app.companyChat.refusal.badSetting",
  name_missing: "app.companyChat.refusal.nameMissing",
  name_too_long: "app.companyChat.refusal.nameTooLong",
  name_reserved: "app.companyChat.refusal.nameReserved",
  name_taken: "app.companyChat.refusal.nameTaken",
  // Phase 3–4: files, cards, replies, edit, remove, pin, save to job.
  bad_attachment: "app.companyChat.refusal.badAttachment",
  bad_card: "app.companyChat.refusal.badCard",
  bad_reply: "app.companyChat.refusal.badReply",
  no_message: "app.companyChat.refusal.noMessage",
  not_author: "app.companyChat.refusal.notAuthor",
  too_late: "app.companyChat.refusal.tooLate",
  too_many_pins: "app.companyChat.refusal.tooManyPins",
  not_photo: "app.companyChat.refusal.notPhoto",
  no_job: "app.companyChat.refusal.noJob",
  file_unreadable: "app.companyChat.refusal.fileUnreadable",
  copy_failed: "app.companyChat.refusal.copyFailed",
  unavailable: "app.companyChat.refusal.unavailable",
});

const json = (method, body) => ({ method, body });
const room = (id) => `/api/chat/rooms/${encodeURIComponent(id)}`;
const query = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const chatApi = {
  /** { me, rooms, joinable } — `sync` seeds #general / job rooms first (on open, not on every poll) */
  list: ({ sync = false } = {}) => fetchJson(`/api/chat/rooms${sync ? "?sync=1" : ""}`),
  /** { me, people } */
  directory: (q = "") => fetchJson(`/api/chat/directory?q=${encodeURIComponent(q || "")}`),
  /** { roomId } */
  openDirect: (memberId) => fetchJson("/api/chat/rooms", json("POST", { with: memberId })),
  /** { roomId, kind } — one person picked opens their DM */
  createGroup: (memberIds, name = "") => fetchJson("/api/chat/rooms", json("POST", { kind: "group", members: memberIds, name })),
  /** { roomId, kind } — the office only */
  createChannel: ({ name, topic = "", isPrivate = false, postingPolicy = "everyone", autoJoin = false, members = [] }) =>
    fetchJson("/api/chat/rooms", json("POST", { kind: "channel", name, topic, private: isPrivate, postingPolicy, autoJoin, members })),
  /** the thread; `after` (an ISO time) makes it a delta of what is new, and
   *  `changed` (the last payload's changesCursor) adds what was edited or
   *  removed since */
  room: (id, { after = null, changed = null } = {}) => fetchJson(`${room(id)}${query({ after, changed })}`),
  /** { ok, message } — `payload` is the words, or { body, attachments, card,
   *  replyToId }; `offlineKey` makes a replay of the same send one message */
  send: (id, payload, { offlineKey = null } = {}) =>
    fetchJson(room(id), {
      method: "POST",
      body: typeof payload === "string" ? { body: payload } : payload,
      ...(offlineKey ? { headers: { "X-Offline-Key": offlineKey } } : {}),
    }),
  /** { ok, message } — your own message, inside 15 minutes */
  editMessage: (messageId, body) => fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}`, json("PATCH", { body })),
  /** { ok } — soft: the words are gone for everybody */
  removeMessage: (messageId) => fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}`, json("DELETE")),
  /** { ok } */
  pin: (messageId) => fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}/pin`, json("POST")),
  /** { ok } */
  unpin: (messageId) => fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}/pin`, json("DELETE")),
  /** { ok, jobId, photoId, already } */
  saveToJob: (messageId, index, jobId = null) =>
    fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}/save-to-job`, json("POST", { index, ...(jobId ? { jobId } : {}) })),
  /** { q, results } — one room, or every room you can read */
  search: (q, { room: roomId = null } = {}) => fetchJson(`/api/chat/search${query({ q, room: roomId })}`),
  /** { jobs } — the jobs you can see, to save a photo to or share */
  jobs: (q = "") => fetchJson(`/api/chat/jobs${query({ q })}`),
  /** { ok } — { name?, topic?, postingPolicy?, private?, autoJoin? } */
  update: (id, patch) => fetchJson(room(id), json("PATCH", patch)),
  /** { ok } */
  archive: (id) => fetchJson(`${room(id)}/archive`, json("POST")),
  /** { ok } */
  unarchive: (id) => fetchJson(`${room(id)}/archive`, json("DELETE")),
  /** { ok, roomId } */
  join: (id) => fetchJson(`${room(id)}/join`, json("POST")),
  /** { ok } */
  leave: (id) => fetchJson(`${room(id)}/leave`, json("POST")),
  /** { unread, mentions } — the Chat tab's digit */
  unread: () => fetchJson("/api/chat/unread"),
  /** { room, members, total, nextCursor, can } — one page */
  members: (id, { q = "", cursor = null } = {}) => fetchJson(`${room(id)}/members${query({ q, cursor })}`),
  /** { ok, added } */
  addMembers: (id, memberIds) => fetchJson(`${room(id)}/members`, json("POST", { members: memberIds })),
  /** { ok } */
  removeMember: (id, memberId) => fetchJson(`${room(id)}/members/${encodeURIComponent(memberId)}`, json("DELETE")),
  /** { ok } — your own notify / mutedUntil / hidden / starred */
  updateMine: (id, patch) => fetchJson(`${room(id)}/me`, json("PATCH", patch)),
  /** { count, people, nextCursor } */
  seenBy: (id, messageId, { cursor = null } = {}) => fetchJson(`${room(id)}/seen${query({ message: messageId, cursor })}`),
  /** { roomId, messageId } — where a bell row's message lives */
  locate: (messageId) => fetchJson(`/api/chat/messages/${encodeURIComponent(messageId)}`),
};
