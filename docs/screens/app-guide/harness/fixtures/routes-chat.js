// Fixture routes for the company crew chat (/app/chat) — ported from
// docs/screens/company-chat/harness/chatFetch.js onto the fixture company.
// The owner is signed in, so `me` is Marc; #general, a room per active job,
// a finished job's room, and two direct messages.
import { PEOPLE, OWNER, JOB, day, iso } from "./company.js";

const at = (minAgo) => iso(new Date(day(0, 13).getTime() - minAgo * 60000));
const person = (id) => { const p = PEOPLE.find((x) => x.id === id); return { id: p.id, name: p.name, email: p.email, role: p.role, label: p.role, isYou: p.id === OWNER.id }; };
const ME = { id: OWNER.id, role: "owner", readOnly: false };
const msg = (id, whoId, body, minAgo, extra = {}) => ({
  id, body, at: at(minAgo), kind: "message", direction: whoId === ME.id ? "out" : "in",
  who: person(whoId).name, whoKey: `member:${whoId}`, mentionsMe: false, meta: null, ...extra,
});

const rooms = {
  general: { id: "general", kind: "general", jobId: null, active: true, title: "general", titleMissing: false,
    members: PEOPLE.map((p) => person(p.id)), lastSeenAt: at(400),
    messages: [
      msg("g1", "m_marc", "Welcome to the chat. This room is everybody; each job has its own.", 3000),
      msg("g2", "m_julie", "Reminder: van keys back on the hook by 6.", 900),
      msg("g3", "m_leo", "Anyone seen the 18V charger? Not in the van.", 60),
      msg("g4", "m_ana", "It's on the bench at the shop, I used it Friday", 45),
    ] },
  j1: { id: "j1", kind: "job", jobId: JOB.id, active: true, title: JOB.title, titleMissing: false,
    members: ["m_marc", "m_julie", "m_dan", "m_leo", "m_ana"].map(person), lastSeenAt: at(95),
    messages: [
      msg("k1", "m_dan", "Countertop template is Thursday, so uppers and lowers both need to be set by Wednesday night.", 1500),
      msg("k2", "m_leo", "Lowers are in. Two of the drawer fronts came scratched — photos in the job.", 1430),
      msg("k3", "m_marc", "I'll call the supplier in the morning", 1420),
      msg("k4", "m_dan", "@Marc Tremblay can you be on site at 7:30 tomorrow? Sophie wants a walk-through before work starts.", 40, { mentionsMe: true }),
      msg("k5", "m_dan", "Bring the shim pack too, the floor drops 12mm at the fridge wall", 39),
      msg("k6", "m_ana", "I can do 7:30 as well if Léo can't", 12),
    ] },
  j2: { id: "j2", kind: "job", jobId: "j_321", active: true, title: "Beaulieu — office built-ins", titleMissing: false,
    members: ["m_marc", "m_julie", "m_ana"].map(person), lastSeenAt: at(1),
    messages: [msg("d1", "m_ana", "Sanding done, first coat goes on tomorrow if it stays dry", 200)] },
  j3: { id: "j3", kind: "job", jobId: "j_309", active: false, title: "Nguyen — bathroom vanity", titleMissing: false,
    members: ["m_marc", "m_julie", "m_leo"].map(person), lastSeenAt: at(1),
    messages: [msg("b1", "m_marc", "Client paid in full. Nice work on this one.", 9000)] },
  dm1: { id: "dm1", kind: "dm", jobId: null, active: true, title: "Julie Gagnon", titleMissing: false,
    members: [person("m_julie"), person("m_marc")], lastSeenAt: at(60),
    messages: [msg("p1", "m_marc", "Is Friday off still fine?", 300), msg("p2", "m_julie", "Yes — I've got Sam covering the morning.", 30)] },
  dm2: { id: "dm2", kind: "dm", jobId: null, active: true, title: "Léo Bouchard", titleMissing: false,
    members: [person("m_leo"), person("m_marc")], lastSeenAt: at(1),
    messages: [msg("q1", "m_leo", "lunch?", 2000), msg("q2", "m_marc", "yes, 12:30", 1990)] },
};

function listRow(r) {
  const spoken = r.messages.filter((m) => m.kind !== "system");
  const last = spoken[spoken.length - 1] || null;
  const since = new Date(r.lastSeenAt).getTime();
  const unread = spoken.filter((m) => m.direction === "in" && new Date(m.at).getTime() > since).length;
  const mentions = spoken.filter((m) => m.mentionsMe && m.direction === "in" && new Date(m.at).getTime() > since).length;
  return {
    id: r.id, kind: r.kind, jobId: r.jobId, active: r.active, title: r.title, titleMissing: r.titleMissing,
    other: r.kind === "dm" ? r.members.find((m) => m.id !== ME.id)?.id : null,
    memberCount: r.members.length, lastBody: last?.body || null, lastAt: last?.at || null,
    lastWasMine: Boolean(last && last.direction === "out"), lastWho: last?.who || null, unread, mentions,
  };
}

export const ROUTES_CHAT = [
  { path: "/api/chat/rooms", method: "GET", reply: () => ({ me: ME, rooms: Object.values(rooms).map(listRow).sort((a, b) => (Boolean(a.unread) !== Boolean(b.unread) ? (a.unread ? -1 : 1) : new Date(b.lastAt || 0) - new Date(a.lastAt || 0))) }) },
  { path: "/api/chat/directory", reply: () => ({ me: ME, people: PEOPLE.map((p) => person(p.id)) }) },
  { path: /^\/api\/chat\/rooms\/([^/]+)\/members$/, reply: ({ params }) => { const r = rooms[decodeURIComponent(params[1])]; return { room: { id: r.id, kind: r.kind, name: r.title, jobId: r.jobId }, members: r.members.map((p) => ({ ...p, departed: false })) }; } },
  { path: /^\/api\/chat\/rooms\/([^/]+)$/, method: "GET", reply: ({ params }) => { const r = rooms[decodeURIComponent(params[1])]; const seen = r.lastSeenAt; return { id: r.id, lastSeenAt: seen, kind: r.kind, jobId: r.jobId, active: r.active, title: r.title, titleMissing: r.titleMissing, memberCount: r.members.length, readOnly: false, members: r.members, messages: r.messages }; } },
];
