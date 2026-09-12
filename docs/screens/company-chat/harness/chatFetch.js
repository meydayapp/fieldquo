// Harness stub for @/lib/fetchJson: serves a company-chat fixture by URL and
// keeps a little state so sending and opening a DM are visible. Truefinish
// Cabinets: an owner, a manager, three crew; a kitchen job in progress, a
// deck scheduled, a finished bathroom.
const now = Date.now();
const at = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const ME = { id: "m1", role: "employee", readOnly: false };

const people = [
  { id: "m0", name: "Emilio Boves", email: "emilio@truefinish.ca", role: "owner", label: "owner", isYou: false },
  { id: "m5", name: "Marie Tremblay", email: "marie@truefinish.ca", role: "supervisor", label: "supervisor", isYou: false },
  { id: "m1", name: "Luis Ortega", email: "luis@truefinish.ca", role: "employee", label: "employee", isYou: true },
  { id: "m2", name: "Sam Okafor", email: "sam@truefinish.ca", role: "employee", label: "employee", isYou: false },
  { id: "m3", name: "Priya Nair", email: "priya@truefinish.ca", role: "employee", label: "employee", isYou: false },
];
const by = (id) => people.find((p) => p.id === id);
const msg = (id, who, body, minAgo, extra = {}) => ({
  id, body, at: at(minAgo), kind: "message",
  direction: who.id === ME.id ? "out" : "in",
  who: who.name, whoKey: `member:${who.id}`, mentionsMe: false, meta: null, ...extra,
});

const rooms = {
  general: { id: "general", kind: "general", jobId: null, active: true, title: "general", titleMissing: false,
    members: ["m0", "m5", "m1", "m2", "m3"].map((id) => ({ ...by(id), label: by(id).label })),
    lastSeenAt: at(400),
    messages: [
      msg("g1", by("m0"), "Welcome to the chat. This room is everybody; each job has its own.", 3000),
      msg("g2", by("m5"), "Reminder: van keys back on the hook by 6.", 900),
      msg("g3", by("m2"), "Anyone seen the 18V charger? Not in the van.", 60),
      msg("g4", by("m3"), "It's on the bench at the shop, I used it Friday", 45),
    ] },
  j1: { id: "j1", kind: "job", jobId: "job-nguyen", active: true, title: "Nguyen kitchen — cabinet install", titleMissing: false,
    members: ["m0", "m5", "m1", "m2"].map((id) => ({ ...by(id) })),
    lastSeenAt: at(95),
    messages: [
      msg("k1", by("m5"), "Countertop template is Thursday, so uppers and lowers both need to be set by Wednesday night.", 1500),
      msg("k2", by("m2"), "Lowers are in. Two of the drawer fronts came scratched — photos in the job.", 1430),
      msg("k3", by("m1"), "I'll call the supplier in the morning", 1420),
      msg("k4", by("m5"), "@Luis Ortega can you be on site at 7:30 tomorrow? The client wants a walk-through before work starts.", 40, { mentionsMe: true }),
      msg("k5", by("m5"), "Bring the shim pack too, the floor drops 12mm at the fridge wall", 39),
      msg("k6", by("m2"), "I can do 7:30 as well if Luis can't", 12),
    ] },
  j2: { id: "j2", kind: "job", jobId: "job-deck", active: true, title: "Lachance deck refinish", titleMissing: false,
    members: ["m0", "m5", "m3"].map((id) => ({ ...by(id) })), lastSeenAt: at(1),
    messages: [msg("d1", by("m3"), "Sanding done, first coat goes on tomorrow if it stays dry", 200)] },
  j3: { id: "j3", kind: "job", jobId: "job-bath", active: false, title: "Roy bathroom vanity", titleMissing: false,
    members: ["m0", "m5", "m1"].map((id) => ({ ...by(id) })), lastSeenAt: at(1),
    messages: [msg("b1", by("m0"), "Client paid in full. Nice work on this one.", 9000)] },
  dm1: { id: "dm1", kind: "dm", jobId: null, active: true, title: "Marie Tremblay", titleMissing: false,
    members: [by("m5"), by("m1")], lastSeenAt: at(60),
    messages: [msg("p1", by("m1"), "Is Friday off still fine?", 300), msg("p2", by("m5"), "Yes — I've got Sam covering the morning.", 30)] },
  dm2: { id: "dm2", kind: "dm", jobId: null, active: true, title: "Sam Okafor", titleMissing: false,
    members: [by("m2"), by("m1")], lastSeenAt: at(1),
    messages: [msg("q1", by("m2"), "lunch?", 2000), msg("q2", by("m1"), "yes, 12:30", 1990)] },
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
    memberCount: r.members.length,
    lastBody: last?.body || null, lastAt: last?.at || null,
    lastWasMine: Boolean(last && last.direction === "out"), lastWho: last?.who || null,
    unread, mentions,
  };
}

let dmSeq = 10;
export async function fetchJson(url, options = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const method = options.method || "GET";
  const body = options.body || null;
  if (url === "/api/chat/rooms" && method === "GET") {
    return { me: ME, rooms: Object.values(rooms).map(listRow).sort((a, b) => (Boolean(a.unread) !== Boolean(b.unread) ? (a.unread ? -1 : 1) : new Date(b.lastAt || 0) - new Date(a.lastAt || 0))) };
  }
  if (url === "/api/chat/rooms" && method === "POST") {
    const other = by(body.with);
    const existing = Object.values(rooms).find((r) => r.kind === "dm" && r.members.some((m) => m.id === other.id));
    if (existing) return { roomId: existing.id };
    const id = `dm${++dmSeq}`;
    rooms[id] = { id, kind: "dm", jobId: null, active: true, title: other.name, titleMissing: false, members: [other, by(ME.id)], lastSeenAt: at(0), messages: [] };
    return { roomId: id };
  }
  if (url.startsWith("/api/chat/directory")) return { me: ME, people };
  const m = /^\/api\/chat\/rooms\/([^/]+)(\/members)?$/.exec(url);
  if (m) {
    const r = rooms[decodeURIComponent(m[1])];
    if (!r) { const e = new Error("No such conversation."); e.status = 404; e.code = "no_room"; throw e; }
    if (m[2]) return { room: { id: r.id, kind: r.kind, name: r.title, jobId: r.jobId }, members: r.members.map((p) => ({ ...p, departed: false, isYou: p.id === ME.id })) };
    if (method === "POST") {
      r.messages.push(msg(`s${Date.now()}`, by(ME.id), body.body, 0));
      return { ok: true };
    }
    const seen = r.lastSeenAt; r.lastSeenAt = at(0);
    return { id: r.id, lastSeenAt: seen, kind: r.kind, jobId: r.jobId, active: r.active, title: r.title, titleMissing: r.titleMissing, memberCount: r.members.length, readOnly: false,
      members: r.members.map((p) => ({ ...p, isYou: p.id === ME.id })), messages: r.messages };
  }
  throw new Error(`harness: no route for ${method} ${url}`);
}
export function errorText(t, err, codeKeys = null) {
  const key = err?.code && codeKeys?.[err.code];
  return key ? t(key) : err?.message || "";
}
