// lib/messaging/demoThreads.js
//
// Sample conversations — for a DEMO COMPANY ONLY.
//
// ══ The rule, and where it is enforced ═════════════════════════════════════
//
// Nothing in here reaches a real company. Every route that serves these first
// asks lib/messaging/channels.js's messagingConnection(), which decides `mock`
// by reading Company.isDemo out of the database itself — never from a flag a
// caller passed. That is the same single-gate discipline
// lib/social/metaConnection.js uses for the demo Page, and the same fixed
// `demo_` prefix on every id, so a log line or a support screenshot says on
// sight that none of this is a real homeowner.
//
// A real company with no Page connected sees an EMPTY inbox and a sentence
// explaining what is missing. Seeding it with plausible messages instead would
// be the worst version of the failure this codebase keeps finding: a screen
// that looks like it is working.
//
// ══ Why these six ══════════════════════════════════════════════════════════
//
// They are chosen so the month-end review has something to say, and so every
// arithmetic branch in lib/messaging/monthlyReview.js is visible on screen in
// a demo: one won fast, one won slowly, one lost after a long delay, one
// nobody ever answered (the line the review puts first), one that is not a job
// at all, and one still unjudged. A demo that only shows the happy row teaches
// the wrong thing about the feature.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * @param {Date} now  passed in rather than read, so a check can pin it.
 * @param {string} companyName  used only for the channel label.
 */
export function demoThreads(now = new Date(), companyName = "Demo") {
  const t = now.getTime();
  const at = (offsetMs) => new Date(t - offsetMs);

  const channel = {
    id: "demo_channel_facebook",
    platform: "facebook",
    name: `${companyName} (Demo)`,
  };
  const igChannel = {
    id: "demo_channel_instagram",
    platform: "instagram",
    name: `${companyName} (Demo)`,
  };

  const thread = (id, ch, name, createdOffset, outcome, messages, extra = {}) => ({
    id: `demo_thread_${id}`,
    companyId: null,
    channelId: ch.id,
    channelName: ch.name,
    platform: ch.platform,
    externalThreadId: `demo_psid_${id}`,
    participantExternalId: `demo_psid_${id}`,
    participantName: name,
    createdAt: at(createdOffset),
    lastMessageAt: messages.length ? messages[messages.length - 1].sentAt : at(createdOffset),
    unread: extra.unread ?? 0,
    status: extra.status || "open",
    outcome,
    outcomeSetAt: outcome ? at(createdOffset - HOUR) : null,
    clientId: null,
    leadId: null,
    jobId: null,
    quoteId: null,
    mock: true,
    messages,
  });

  const msg = (id, direction, body, offset, extra = {}) => ({
    id: `demo_msg_${id}`,
    direction,
    externalId: `demo_mid_${id}`,
    body,
    attachments: null,
    sentAt: at(offset),
    deliveredAt: direction === "out" ? at(offset - MINUTE) : null,
    readAt: null,
    sentByUserId: null,
    failedReason: null,
    ...extra,
  });

  return [
    // Answered in eleven minutes, and it became a job.
    thread("a", channel, "Marie Tremblay", 6 * DAY, "won", [
      msg("a1", "in", "Hi! Do you do kitchen cabinet refinishing? Ours are oak from the 90s.", 6 * DAY),
      msg("a2", "out", "We do — that's most of what we do. Would you like to send a photo?", 6 * DAY - 11 * MINUTE),
      msg("a3", "in", "Here you go. How much roughly?", 6 * DAY - 40 * MINUTE),
      msg("a4", "out", "Looks straightforward. I'll put a proper quote together today.", 6 * DAY - 55 * MINUTE),
      msg("a5", "in", "Perfect, thank you!", 6 * DAY - HOUR),
    ]),

    // Answered the next morning. Still won, but slowly — the comparison the
    // review is for.
    thread("b", igChannel, "devon.builds", 12 * DAY, "won", [
      msg("b1", "in", "saw your reel — do you take on full kitchen installs?", 12 * DAY),
      msg("b2", "out", "We do. Whereabouts are you?", 12 * DAY - 14 * HOUR),
      msg("b3", "in", "Rosemont. Can you come look next week?", 12 * DAY - 13 * HOUR),
    ]),

    // Answered two days later. Lost.
    thread("c", channel, "Alan Whitfield", 20 * DAY, "lost", [
      msg("c1", "in", "Looking for a quote on painting a 3 bedroom semi. How soon could you start?", 20 * DAY),
      msg("c2", "out", "Sorry for the slow reply — we could look at the week of the 14th.", 18 * DAY),
      msg("c3", "in", "We've gone with someone else, thanks.", 17 * DAY),
    ]),

    // Nobody ever replied. The line the review reports first, and the only
    // one on it that is still fixable.
    thread(
      "d",
      channel,
      "Priya Raghavan",
      9 * DAY,
      null,
      [
        msg("d1", "in", "Hello, are you available for a bathroom tile job in the next two weeks?", 9 * DAY),
        msg("d2", "in", "Still looking if you're free?", 7 * DAY),
      ],
      { unread: 2 },
    ),

    // Not a sales conversation at all — kept out of the won-rate denominator.
    thread("e", channel, "Tile & Stone Supply", 4 * DAY, "not_a_job", [
      msg("e1", "in", "Your account statement for August is attached.", 4 * DAY),
      msg("e2", "out", "Thanks — passed to accounts.", 4 * DAY - 3 * HOUR),
    ]),

    // Answered, and nobody has judged it yet. Counted as `unset`, never as
    // lost.
    thread(
      "f",
      igChannel,
      "hannah.j",
      2 * DAY,
      null,
      [
        msg("f1", "in", "do you do exterior staining on decks?", 2 * DAY),
        msg("f2", "out", "We do — how big is the deck?", 2 * DAY - 25 * MINUTE),
      ],
      { unread: 0 },
    ),
  ];
}

/** The thread list shape the inbox renders, without the message bodies. */
export function demoThreadSummaries(now, companyName) {
  return demoThreads(now, companyName).map((t) => ({
    id: t.id,
    channelId: t.channelId,
    channelName: t.channelName,
    platform: t.platform,
    participantName: t.participantName,
    lastMessageAt: t.lastMessageAt,
    unread: t.unread,
    status: t.status,
    outcome: t.outcome,
    preview: t.messages.length ? t.messages[t.messages.length - 1].body : "",
    mock: true,
  }));
}
