// Fixtures for the /app/messages harness. Three scenarios, chosen by
// ?scenario= — a real connected company with Facebook, Instagram and
// WhatsApp threads; a real company with nothing connected (the blocked
// card); the demo company, whose threads come from the REAL
// lib/messaging/demoThreads.js so the mock on screen is the shipped one.
import { demoThreads, demoThreadSummaries } from "@/lib/messaging/demoThreads";
import { scoreConversation, storableScore } from "@/lib/messaging/conversationScore";
import { serviceWindowNotice } from "@/lib/messaging/serviceWindow";
import { responseStamps } from "@/lib/messaging/waiting";
import { readStatus } from "@/lib/messaging/outcomes";

const now = Date.now();
const at = (minAgo) => new Date(now - minAgo * 60000);
const note = { bg: "#fff4d6", fg: "#3a2a00", border: "#e0b84a" };

let seq = 0;
const msg = (direction, body, minAgo, extra = {}) => ({
  id: `m${++seq}`,
  direction,
  private: direction === "note",
  activity: null,
  body,
  attachments: null,
  sentAt: at(minAgo),
  deliveredAt: direction === "out" ? at(minAgo - 0.5) : null,
  readAt: direction === "out" && !extra.failedReason ? at(minAgo - 1) : null,
  failedReason: null,
  sentByUserId: null,
  ...extra,
});
const activity = (data, minAgo) => msg("activity", "", minAgo, { activity: data });
const noteRow = (body, minAgo) => msg("note", body, minAgo);

function stamps(messages) {
  let thread = { firstInboundAt: null, firstReplyAt: null, waitingSince: null };
  for (const m of [...messages].sort((a, b) => a.sentAt - b.sentAt)) {
    thread = { ...thread, ...responseStamps({ thread, message: m }) };
  }
  return thread;
}

function thread(id, platform, name, messages, extra = {}) {
  const spoken = messages.filter((m) => m.direction === "in" || m.direction === "out");
  const last = [...spoken].sort((a, b) => b.sentAt - a.sentAt)[0] || null;
  const inbound = messages.filter((m) => m.direction === "in").sort((a, b) => b.sentAt - a.sentAt);
  const scored = scoreConversation({ messages, now: new Date(now) });
  const stored = storableScore(scored, { at: new Date(now) });
  return {
    id,
    channelId: `ch_${platform}`,
    channelName: platform === "facebook" ? "Northside Painting" : platform === "instagram" ? "@northsidepainting" : "+1 514 555 0100",
    platform,
    participantName: name,
    participantExternalId: `psid_${id}`,
    threadNumber: extra.threadNumber ?? null,
    lastMessageAt: last?.sentAt || null,
    lastInboundAt: inbound[0]?.sentAt || null,
    unread: extra.unread ?? 0,
    status: extra.status || "open",
    statusChangedAt: null,
    snoozedUntil: extra.snoozedUntil || null,
    assignedToId: extra.assignedToId || null,
    outcome: extra.outcome || null,
    outcomeSetAt: extra.outcome ? at(60) : null,
    clientId: extra.clientId || null,
    leadId: extra.leadId || null,
    jobId: extra.jobId || null,
    quoteId: extra.quoteId || null,
    client: extra.clientId ? { id: extra.clientId, name } : null,
    createdAt: messages[0]?.sentAt || at(1000),
    temperature: stored.temperature,
    score: stored.score,
    canEditClients: true,
    companyLocation: platform === "whatsapp" ? { label: "Northside Painting, 412 Rue Saint-Denis, Montréal" } : null,
    serviceWindow: platform === "whatsapp" ? serviceWindowNotice({ platform, lastInboundAt: inbound[0]?.sentAt || null, now: new Date(now) }) : null,
    templates: platform === "whatsapp" ? [{ id: "tpl1", name: "quote_follow_up", language: "en", body: "Hi {{1}}, following up on the quote we sent for {{2}}. Still interested?", variableCount: 2 }] : [],
    messages: [...messages].sort((a, b) => a.sentAt - b.sentAt),
    ...stamps(messages),
  };
}

const threads = [
  thread("t_fb_sandra", "facebook", "Sandra Cole", [
    msg("in", "Hi — do you do kitchen cabinet refinishing? We're in Pointe-Claire.", 3 * 24 * 60 + 40),
    msg("out", "We do! Happy to come by and take a look. Are mornings or afternoons better this week?", 3 * 24 * 60 + 29),
    msg("in", "Mornings. Thursday?", 3 * 24 * 60 + 10),
    msg("out", "Thursday 9am works. I'll send a confirmation.", 3 * 24 * 60 + 5),
    msg("out", "Confirmed — see you Thursday.", 3 * 24 * 60 + 4),
    noteRow("She mentioned the neighbour's job — ask who did it, the finish looked like ours.", 2 * 24 * 60),
    activity({ type: "linked", kind: "quote", by: "Dave Morin" }, 24 * 60 + 30),
    msg("in", "Got the quote, thanks. Can you do the island in a different colour?", 24 * 60),
    msg("in", "Something like a navy?", 24 * 60 - 1),
    activity({ type: "assigned", to: "Dave Morin", by: "Dave Morin" }, 23 * 60),
    msg("out", "Absolutely — navy on the island, white on the perimeter is a classic. I'll revise it today.", 22 * 60),
    msg("in", "Perfect. Go ahead, we'd like to book it.", 55),
    msg("in", "When's the earliest you could start?", 54),
  ], { unread: 2, threadNumber: 41, quoteId: "q_1", clientId: "c_1" }),
  thread("t_ig_marco", "instagram", "Marco Bélanger", [
    msg("in", "Saw your reel of the two-tone kitchen 🔥 what does something like that run?", 26 * 60),
    msg("out", "Thanks! Depends on the doors and the finish — most kitchens that size land in the same range as the one in the reel. Want me to swing by?", 25 * 60),
    msg("in", "Yeah. I'm in Verdun.", 3 * 60 + 12),
    msg("in", "Also — are you able to do the bathroom vanity at the same time?", 3 * 60 + 10),
    msg("in", "Here's the vanity", 3 * 60 + 9, { attachments: [{ index: 0, type: "image", state: "ready", url: "https://picsum.photos/seed/vanity/640/480", filename: null, bytes: 240000 }] }),
  ], { unread: 3, threadNumber: 42, leadId: "lead_1" }),
  thread("t_wa_priya", "whatsapp", "Priya Nair", [
    msg("in", "Hello, I got your number from Sandra. Looking for cabinet painting in Beaconsfield.", 5 * 24 * 60),
    msg("out", "Hi Priya — glad Sandra passed us on. Could you send a couple of photos of the kitchen?", 5 * 24 * 60 - 20),
    msg("in", "", 5 * 24 * 60 - 60, { attachments: [{ index: 0, type: "image", state: "ready", url: "https://picsum.photos/seed/kitchen1/640/480", filename: "IMG_2231.jpg", bytes: 1800000 }, { index: 1, type: "audio", state: "ready", url: "https://www.w3schools.com/html/horse.mp3", filename: null, bytes: 34000, voice: true }] }),
    msg("out", "Thanks — that's a straightforward one. I'll put a quote together tonight.", 4 * 24 * 60),
    msg("out", "Quote sent to your email.", 3 * 24 * 60, { failedReason: "The 24-hour customer service window has closed. Send an approved template to reopen it." }),
  ], { threadNumber: 43 }),
  thread("t_fb_rob", "facebook", "Rob Tessier", [
    msg("in", "Do you sell cabinet doors on their own? Just the doors.", 8 * 24 * 60),
    msg("out", "We don't sell doors on their own, sorry — we're a refinishing shop. Try Cuisines Beaubien.", 8 * 24 * 60 - 30),
    activity({ type: "outcome_set", outcome: "not_a_job", by: "Dave Morin" }, 8 * 24 * 60 - 25),
  ], { outcome: "not_a_job", status: "resolved", threadNumber: 39 }),
  thread("t_ig_lea", "instagram", "Léa Fortin", [
    msg("in", "hi! are you taking new projects for october?", 2 * 24 * 60),
    msg("out", "We are — a couple of slots left. What's the project?", 2 * 24 * 60 - 40),
  ], { status: "pending", threadNumber: 44 }),
  thread("t_fb_jon", "facebook", "Jon Whitfield", [
    msg("in", "Following up on the estimate from last month. We're going with someone else — thanks anyway.", 12 * 24 * 60),
    msg("out", "Understood, thanks for letting us know. Good luck with it!", 12 * 24 * 60 - 60),
    activity({ type: "outcome_set", outcome: "lost", by: "Dave Morin" }, 12 * 24 * 60 - 55),
  ], { outcome: "lost", threadNumber: 37 }),
  thread("t_wa_ali", "whatsapp", "Ali Haddad", [
    msg("in", "Can you quote a bathroom vanity + linen closet? Photos attached", 40 * 60),
    msg("out", "Yes — I'll get you a number by tomorrow.", 40 * 60 - 15),
  ], { status: "snoozed", snoozedUntil: at(-2 * 24 * 60), threadNumber: 45 }),
];

const summary = (t) => {
  const spoken = t.messages.filter((m) => m.direction === "in" || m.direction === "out");
  const last = spoken[spoken.length - 1] || null;
  return {
    id: t.id, channelId: t.channelId, channelName: t.channelName, platform: t.platform,
    participantName: t.participantName, threadNumber: t.threadNumber, lastMessageAt: t.lastMessageAt,
    unread: t.unread, status: readStatus(t.status), snoozedUntil: t.snoozedUntil, assignedToId: t.assignedToId,
    waitingSince: t.waitingSince, outcome: t.outcome, temperature: t.temperature, score: t.score,
    preview: last?.body || (last?.attachments?.length ? "📷" : ""), lastDirection: last?.direction || null,
    lastFailed: Boolean(last?.failedReason), serviceWindow: t.serviceWindow,
  };
};

const connected = { connected: true, mock: false, reason: null, channels: [{ id: "ch_facebook", platform: "facebook", name: "Northside Painting", status: "connected" }, { id: "ch_instagram", platform: "instagram", name: "@northsidepainting", status: "connected" }, { id: "ch_whatsapp", platform: "whatsapp", name: "+1 514 555 0100", status: "connected" }], readiness: { app: true, crypto: true, approved: true, whatsapp: true } };
const demoConnection = { connected: true, mock: true, reason: null, channels: [], readiness: {} };

export const FIXTURES = {
  default: {
    connection: connected,
    note,
    list: () => threads.map(summary),
    thread: (id) => threads.find((t) => t.id === id) || null,
    temperature: (id) => {
      const t = threads.find((x) => x.id === id);
      if (!t) return null;
      return { connection: connected, score: scoreConversation({ messages: t.messages, now: new Date(now) }), available: false, reasonKey: "app.messages.temperature.aiUnavailable" };
    },
  },
  blocked: {
    connection: { connected: false, mock: false, reason: "not_connected", channels: [], readiness: { app: true, crypto: true, approved: true, whatsapp: true } },
    note, list: () => [], thread: () => null, temperature: () => null,
  },
  awaiting: {
    connection: { connected: false, mock: false, reason: "awaiting_meta_approval", channels: [], readiness: { app: true, crypto: true, approved: false, whatsapp: false } },
    note, list: () => [], thread: () => null, temperature: () => null,
  },
  demo: {
    connection: demoConnection,
    note,
    list: () => demoThreadSummaries(new Date(now), "Northside Painting"),
    thread: (id) => demoThreads(new Date(now), "Northside Painting").find((t) => t.id === id) || null,
    temperature: () => ({ connection: demoConnection, score: null, available: false, reasonKey: "app.messages.temperature.demoUnavailable" }),
  },
};

export const PEOPLE = [{ id: "u1", name: "Dave Morin" }, { id: "u2", name: "Nadia Roy" }];
