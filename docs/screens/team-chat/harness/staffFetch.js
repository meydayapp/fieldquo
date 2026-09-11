// Harness stub for @/lib/fetchJson: serves the team-chat fixture by URL and
// keeps a little state so sending, creating and joining are visible.
const now = Date.now();
const at = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const ME = { kind: "rep", id: "r1", name: "Daniel Roy", email: "daniel@fieldquo.com" };

const people = [
  { kind: "user", id: "a1", name: "support@fieldquo.com", email: "support@fieldquo.com", role: "support", label: "staff", engagement: null, presence: { source: "chat", online: true, state: "online", stale: false, lastSeenAt: at(1) } },
  { kind: "user", id: "a2", name: "emilio@fieldquo.com", email: "emilio@fieldquo.com", role: "superadmin", label: "superadmin", engagement: null, presence: { source: "chat", online: false, state: "away", stale: false, lastSeenAt: at(130) } },
  { kind: "rep", id: "r1", name: "Daniel Roy", email: "daniel@fieldquo.com", role: "rep", label: "rep", engagement: "freelancer", presence: { source: "floor", online: true, state: "available", stale: false, lastSeenAt: at(0) } },
  { kind: "rep", id: "r2", name: "Jesus Gandara", email: "jesus@fieldquo.com", role: "rep", label: "rep", engagement: "freelancer", presence: { source: "floor", online: true, state: "on_call", stale: false, lastSeenAt: at(2) } },
  { kind: "rep", id: "r3", name: "Maria Lopez", email: "maria@fieldquo.com", role: "rep", label: "rep", engagement: "employee", presence: { source: "floor", online: false, state: "paused", pauseReason: "lunch", stale: false, lastSeenAt: at(20) } },
  { kind: "rep", id: "r4", name: "Sam Okafor", email: "sam@fieldquo.com", role: "rep", label: "rep", engagement: "freelancer", presence: { source: "floor", online: null, state: null, stale: false, lastSeenAt: null } },
];
const byKey = (k, id) => people.find((p) => p.kind === k && p.id === id);

const msg = (id, who, body, minAgo, extra = {}) => ({
  id, body, at: at(minAgo), kind: "message",
  direction: who.id === ME.id && who.kind === ME.kind ? "out" : "in",
  who: who.name, whoKey: `${who.kind}:${who.id}`, mentionsMe: false, meta: null, ...extra,
});
const sys = (id, who, meta, minAgo) => ({ id, body: "", at: at(minAgo), kind: "system", direction: "in", who: who.name, whoKey: `${who.kind}:${who.id}`, meta });

const rooms = {
  fq: { id: "fq", kind: "channel", teamKey: "fieldquo", isDefault: true, private: false, slug: "fieldquo", title: "fieldquo", topic: null, canManage: false, canLeave: false,
    members: ["a1", "a2"].map((id) => byKey("user", id)).concat(["r1", "r2", "r3", "r4"].map((id) => byKey("rep", id))),
    lastSeenAt: at(300),
    messages: [
      msg("f1", byKey("user", "a2"), "Welcome everybody. This is the one room nobody can leave.", 2900),
      msg("f2", byKey("rep", "r2"), "Morning all", 1500),
      msg("f3", byKey("user", "a1"), "Reminder: the sales guide is in the portal now, three languages.", 700),
    ] },
  sales: { id: "sales", kind: "channel", teamKey: "sales", isDefault: false, private: false, slug: "sales", title: "sales", topic: null, canManage: false, canLeave: true,
    members: [byKey("user", "a1"), byKey("user", "a2"), byKey("rep", "r1"), byKey("rep", "r2"), byKey("rep", "r3")],
    lastSeenAt: at(95),
    messages: [
      msg("s1", byKey("rep", "r2"), "Anyone tried the new callback window yet?", 1560),
      msg("s2", byKey("rep", "r2"), "It moved the 514 leads to after 5pm for me", 1559),
      msg("s3", byKey("rep", "r1"), "Yes — mine too. It follows the prospect's zone, not ours.", 1530),
      sys("s4", byKey("rep", "r2"), { system: "added", names: ["Maria Lopez"] }, 1400),
      msg("s5", byKey("rep", "r3"), "Hi everyone, first day on the floor", 1390),
      msg("s6", byKey("user", "a1"), "Welcome Maria. If a prospect asks about invoicing, hand it to #support.", 1380),
      msg("s7", byKey("rep", "r2"), "@Daniel Roy can you take the Toitures Ouellet callback? I'm on a call until 3", 40, { mentionsMe: true }),
      msg("s8", byKey("rep", "r2"), "It's the one with the roof measurement attached", 39),
      msg("s9", byKey("rep", "r3"), "I can take it if Daniel can't", 12),
    ] },
  support: { id: "support", kind: "channel", teamKey: "support", isDefault: false, private: false, slug: "support", title: "support", topic: null, canManage: false, canLeave: true,
    members: [byKey("user", "a1"), byKey("user", "a2"), byKey("rep", "r1")], lastSeenAt: at(2000),
    messages: [msg("t1", byKey("user", "a1"), "Ticket #418 closed — the Stripe payout was a bank holiday.", 2200)] },
  west: { id: "west", kind: "channel", teamKey: null, isDefault: false, private: true, slug: "sales-west", title: "Sales West", topic: "Ontario and west of it", canManage: true, canLeave: true,
    members: [byKey("rep", "r1"), byKey("rep", "r3")], lastSeenAt: at(1),
    messages: [sys("w0", byKey("rep", "r1"), { system: "created", name: "Sales West" }, 4000), msg("w1", byKey("rep", "r3"), "Calgary list is ready", 3000)] },
  qc: { id: "qc", kind: "channel", teamKey: null, isDefault: false, private: false, slug: "quebec-launch", title: "Quebec launch", topic: "French-first prospects", canManage: false, canLeave: true,
    members: [byKey("user", "a2"), byKey("rep", "r1"), byKey("rep", "r2")], lastSeenAt: at(1),
    messages: [msg("q1", byKey("user", "a2"), "Only reps who sell in French get Quebec leads from today.", 5000)] },
  dm1: { id: "dm1", kind: "direct", teamKey: null, isDefault: false, private: false, slug: null, title: "support@fieldquo.com", topic: null, canManage: false, canLeave: false,
    members: [byKey("user", "a1"), byKey("rep", "r1")], lastSeenAt: at(60),
    messages: [msg("d1", byKey("rep", "r1"), "Is the demo tenant reset on a schedule?", 200), msg("d2", byKey("user", "a1"), "Every night at 3am Eastern. You can reset it yourself from the demo tab too.", 30)] },
  dm2: { id: "dm2", kind: "direct", teamKey: null, isDefault: false, private: false, slug: null, title: "Jesus Gandara", topic: null, canManage: false, canLeave: false,
    members: [byKey("rep", "r2"), byKey("rep", "r1")], lastSeenAt: at(1),
    messages: [msg("e1", byKey("rep", "r2"), "can you take the 514 one?", 4300), msg("e2", byKey("rep", "r1"), "Merci, oui", 4290)] },
};
const joinable = [
  { id: "tips", kind: "channel", teamKey: null, slug: "estimating-tips", title: "Estimating tips", topic: "What worked on a quote, for the next rep", memberCount: 4 },
  { id: "hiring", kind: "channel", teamKey: null, slug: "hiring", title: "Hiring", topic: null, memberCount: 2 },
];

function listRow(r) {
  const spoken = r.messages.filter((m) => m.kind !== "system");
  const last = spoken[spoken.length - 1] || null;
  const seen = r.lastSeenAt ? Date.parse(r.lastSeenAt) : 0;
  const unread = spoken.filter((m) => m.direction === "in" && Date.parse(m.at) > seen).length;
  const mentions = spoken.filter((m) => m.direction === "in" && m.mentionsMe && Date.parse(m.at) > seen).length;
  const other = r.kind === "direct" ? r.members.find((m) => !(m.kind === ME.kind && m.id === ME.id)) : null;
  return {
    id: r.id, kind: r.kind, teamKey: r.teamKey, isDefault: r.isDefault, private: r.private, slug: r.slug,
    title: r.title, topic: r.topic, memberCount: r.members.length, isOwner: r.canManage,
    lastBody: last?.body || null, lastAt: last?.at || null, lastWasMine: last?.direction === "out", lastWho: last?.who || null,
    unread, mentions, other: other ? { kind: other.kind, id: other.id } : null, presence: other?.presence || null,
  };
}

let counter = 100;
export async function fetchJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : null;
  const u = new URL(url, "http://harness");
  const path = u.pathname;
  await new Promise((r) => setTimeout(r, 60));

  if (path === "/api/staff/rooms" && method === "GET") {
    return { me: ME, rooms: Object.values(rooms).map(listRow).sort((a, b) => (Boolean(a.unread) !== Boolean(b.unread) ? (a.unread ? -1 : 1) : Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0))), joinable };
  }
  if (path === "/api/staff/directory") {
    const q = (u.searchParams.get("q") || "").toLowerCase();
    return { me: ME, people: people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) };
  }
  if (path === "/api/staff/rooms" && method === "POST") {
    if (body?.kind === "channel") {
      const id = `g${++counter}`;
      const members = [byKey(ME.kind, ME.id), ...(body.members || []).map((m) => byKey(m.kind, m.id)).filter(Boolean)];
      rooms[id] = { id, kind: "channel", teamKey: null, isDefault: false, private: Boolean(body.private), slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: body.name, topic: body.topic || null, canManage: true, canLeave: true, members, lastSeenAt: null,
        messages: [sys(`${id}-0`, ME, { system: "created", name: body.name, names: members.slice(1).map((m) => m.name) }, 0)] };
      return { roomId: id };
    }
    const other = byKey(body.with.kind, body.with.id);
    const existing = Object.values(rooms).find((r) => r.kind === "direct" && r.members.some((m) => m.kind === other.kind && m.id === other.id));
    if (existing) return { roomId: existing.id };
    const id = `d${++counter}`;
    rooms[id] = { id, kind: "direct", teamKey: null, isDefault: false, private: false, slug: null, title: other.name, topic: null, canManage: false, canLeave: false, members: [other, byKey(ME.kind, ME.id)], lastSeenAt: null, messages: [] };
    return { roomId: id };
  }
  const m = /^\/api\/staff\/rooms\/([^/]+)(?:\/(members|leave|join)(?:\/(.+))?)?$/.exec(path);
  if (m) {
    const [, id, sub, memberKey] = m;
    if (sub === "join") {
      const j = joinable.find((r) => r.id === id);
      if (!j) { const e = new Error("No such conversation."); e.status = 404; e.code = "no_room"; throw e; }
      joinable.splice(joinable.indexOf(j), 1);
      rooms[id] = { ...j, isDefault: false, private: false, canManage: false, canLeave: true, members: [byKey("user", "a1"), byKey(ME.kind, ME.id)], lastSeenAt: null, messages: [sys(`${id}-j`, ME, { system: "joined" }, 0)] };
      return { ok: true, roomId: id };
    }
    const r = rooms[id];
    if (!r) { const e = new Error("No such conversation."); e.status = 404; e.code = "no_room"; throw e; }
    if (sub === "leave") {
      if (r.isDefault) { const e = new Error("Everybody is in this channel. It is the one you cannot leave."); e.status = 400; e.code = "default_room"; throw e; }
      delete rooms[id];
      return { ok: true };
    }
    if (sub === "members" && method === "GET") {
      return { room: { id: r.id, kind: r.kind, name: r.title, slug: r.slug, teamKey: r.teamKey, isDefault: r.isDefault, private: r.private }, canManage: r.canManage, canLeave: r.canLeave, canAdd: r.kind !== "direct",
        members: r.members.map((p) => ({ ...p, isYou: p.kind === ME.kind && p.id === ME.id, isOwner: r.canManage && p.id === ME.id, departed: false, canRemove: r.canManage && !r.isDefault && !(p.kind === ME.kind && p.id === ME.id) })) };
    }
    if (sub === "members" && method === "POST") {
      const added = (body.members || []).map((x) => byKey(x.kind, x.id)).filter(Boolean);
      r.members.push(...added);
      r.messages.push(sys(`${id}-a${++counter}`, ME, { system: "added", names: added.map((p) => p.name) }, 0));
      return { ok: true, added };
    }
    if (sub === "members" && method === "DELETE") {
      const [kind, pid] = decodeURIComponent(memberKey).split(":");
      const gone = r.members.find((p) => p.kind === kind && p.id === pid);
      r.members = r.members.filter((p) => p !== gone);
      r.messages.push(sys(`${id}-r${++counter}`, ME, { system: "removed", names: [gone?.name || "?"] }, 0));
      return { ok: true };
    }
    if (method === "GET") {
      const out = { ...r, memberCount: r.members.length, members: r.members.map((p) => ({ kind: p.kind, id: p.id, name: p.name, email: p.email, presence: p.presence })) };
      const seen = r.lastSeenAt; r.lastSeenAt = new Date().toISOString();
      return { ...out, lastSeenAt: seen };
    }
    if (method === "POST") {
      const mm = msg(`${id}-m${++counter}`, ME, body.body, 0);
      r.messages.push(mm);
      return { ok: true, message: mm };
    }
    if (method === "PATCH") {
      if (body.name) { r.title = body.name; r.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); r.messages.push(sys(`${id}-n${++counter}`, ME, { system: "renamed", to: r.slug }, 0)); }
      if (typeof body.topic === "string") { r.topic = body.topic; r.messages.push(sys(`${id}-t${++counter}`, ME, { system: "topic", to: body.topic }, 0)); }
      return { ok: true };
    }
  }
  throw new Error(`harness: no route for ${method} ${path}`);
}

export const FETCH_ERROR_KEYS = Object.freeze({});
export function errorText(t, err, codeKeys = null) {
  if (!err) return "";
  const mapped = err.code && codeKeys ? codeKeys[err.code] : null;
  const key = mapped || err.i18nKey || null;
  if (!key) return err.message || "";
  return t(key, err.message);
}
