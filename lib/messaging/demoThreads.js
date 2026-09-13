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
  // WhatsApp, so the third platform the inbox lists is not empty in a demo —
  // and so the one honest roadblock a WhatsApp inbox has (a free-text reply
  // refused outside the 24-hour service window, lib/messaging/serviceWindow.js)
  // is on screen for a rep to explain rather than met for the first time on
  // a customer's account.
  const waChannel = {
    id: "demo_channel_whatsapp",
    platform: "whatsapp",
    name: `${companyName} (Demo)`,
  };

  // The stamps the real ingest and reply paths write (lib/messaging/waiting.js)
  // computed here from the sample messages, rather than hand-typed. A demo
  // whose stored columns disagreed with its own messages would teach the wrong
  // thing about the one number this feature exists to produce — and the check
  // asserts the two agree on real fixtures for exactly that reason.
  const stampsFor = (messages) => {
    const inbound = messages.filter((m) => m.direction === "in").map((m) => m.sentAt.getTime());
    const firstIn = inbound.length ? Math.min(...inbound) : null;
    const replies = messages
      .filter((m) => m.direction === "out" && !m.private && !m.failedReason)
      .map((m) => m.sentAt.getTime())
      .filter((ts) => firstIn !== null && ts >= firstIn);
    const firstReply = replies.length ? Math.min(...replies) : null;
    return {
      firstInboundAt: firstIn === null ? null : new Date(firstIn),
      firstReplyAt: firstReply === null ? null : new Date(firstReply),
      // Waiting only when the last thing said was theirs. Null is "nobody is
      // waiting", never a zero — the inbox draws nothing for it.
      waitingSince:
        firstIn !== null && firstReply === null && messages.at(-1)?.direction === "in"
          ? new Date(firstIn)
          : null,
    };
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
    // The number a person says out loud. Sequential per company, exactly as
    // lib/messaging/threadNumber.js allocates for a real one.
    threadNumber: extra.threadNumber ?? null,
    createdAt: at(createdOffset),
    lastMessageAt: messages.length ? messages[messages.length - 1].sentAt : at(createdOffset),
    unread: extra.unread ?? 0,
    status: extra.status || "open",
    statusChangedAt: at(createdOffset),
    snoozedUntil: extra.snoozedUntil ?? null,
    assignedToId: null,
    outcome,
    outcomeSetAt: outcome ? at(createdOffset - HOUR) : null,
    clientId: null,
    leadId: null,
    jobId: null,
    quoteId: null,
    mock: true,
    ...stampsFor(messages),
    messages,
  });

  const msg = (id, direction, body, offset, extra = {}) => ({
    id: `demo_msg_${id}`,
    direction,
    // Set on every row rather than only on the notes, so the demo carries the
    // same two-column invariant every real row does.
    private: direction === "note",
    activity: null,
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

  /** An internal note — never sent, and unmistakable on screen. */
  const note = (id, body, offset) =>
    msg(id, "note", body, offset, { externalId: `demo_local_note_${id}`, deliveredAt: null });

  /** A system line: assigned, snoozed, quote linked. */
  const activity = (id, activityData, offset) =>
    msg(id, "activity", "", offset, {
      externalId: `demo_local_activity_${id}`,
      activity: activityData,
      deliveredAt: null,
    });

  return [
    // Answered in eleven minutes, and it became a job. Carries a private note
    // and the two activity lines that turn a list of messages into the story
    // the month-end read is for: the reply, then the quote, then the job.
    thread(
      "a",
      channel,
      "Marie Tremblay",
      6 * DAY,
      "won",
      [
        msg("a1", "in", "Hi! Do you do kitchen cabinet refinishing? Ours are oak from the 90s.", 6 * DAY),
        msg("a2", "out", "We do — that's most of what we do. Would you like to send a photo?", 6 * DAY - 11 * MINUTE),
        msg("a3", "in", "Here you go. How much roughly?", 6 * DAY - 40 * MINUTE),
        note("a4n", "Doors are solid oak, not veneer — price the strip, not a respray.", 6 * DAY - 50 * MINUTE),
        msg("a5", "out", "Looks straightforward. I'll put a proper quote together today.", 6 * DAY - 55 * MINUTE),
        msg("a6", "in", "Perfect, thank you!", 6 * DAY - HOUR),
        activity("a7a", { type: "linked", kind: "quote", by: "Dave" }, 5 * DAY),
        activity("a8a", { type: "outcome_set", outcome: "won", by: "Dave" }, 4 * DAY),
      ],
      { status: "resolved", threadNumber: 38 },
    ),

    // Answered the next morning. Still won, but slowly — the comparison the
    // review is for.
    thread(
      "b",
      igChannel,
      "devon.builds",
      12 * DAY,
      "won",
      [
        msg("b1", "in", "saw your reel — do you take on full kitchen installs?", 12 * DAY),
        msg("b2", "out", "We do. Whereabouts are you?", 12 * DAY - 14 * HOUR),
        msg("b3", "in", "Rosemont. Can you come look next week?", 12 * DAY - 13 * HOUR),
      ],
      { threadNumber: 39 },
    ),

    // Answered two days later. Lost. Parked until next week while the price
    // was reconsidered — the one demo row that shows the snooze, and the cron
    // that brings it back, actually existing.
    thread(
      "c",
      channel,
      "Alan Whitfield",
      20 * DAY,
      "lost",
      [
        msg("c1", "in", "Looking for a quote on painting a 3 bedroom semi. How soon could you start?", 20 * DAY),
        msg("c2", "out", "Sorry for the slow reply — we could look at the week of the 14th.", 18 * DAY),
        msg("c3", "in", "We've gone with someone else, thanks.", 17 * DAY),
        activity("c4a", { type: "snoozed", by: "Dave" }, 17 * DAY - HOUR),
      ],
      { status: "snoozed", snoozedUntil: new Date(t + 3 * DAY), threadNumber: 40 },
    ),

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
      // The only row with a live `waitingSince` (computed above from the
      // messages): nine days, on the list, before anybody opens anything.
      { unread: 2, threadNumber: 41 },
    ),

    // Not a sales conversation at all — kept out of the won-rate denominator.
    thread(
      "e",
      channel,
      "Tile & Stone Supply",
      4 * DAY,
      "not_a_job",
      [
        msg("e1", "in", "Your account statement for August is attached.", 4 * DAY),
        msg("e2", "out", "Thanks — passed to accounts.", 4 * DAY - 3 * HOUR),
      ],
      { status: "resolved", threadNumber: 42 },
    ),

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
      // Answered, so the ball is theirs: the state that did not exist before
      // the four, and the one most of a working week sits in.
      { unread: 0, status: "pending", threadNumber: 43 },
    ),

    // WhatsApp. Answered inside the window, then the client went quiet for
    // two days and the next reply was REFUSED — `service_window_closed`, the
    // reason whatsappSend.js writes — so the row carries a failed outbound
    // exactly as a real one would, and the review must not count that
    // attempt as an answer. Still open: the fix is a template message, which
    // is the button the screen shows next to the failure.
    thread(
      "g",
      waChannel,
      "Sophie Dubois",
      5 * DAY,
      null,
      [
        msg("g1", "in", "Bonjour! Est-ce que vous faites des soumissions pour une cuisine complète?", 5 * DAY),
        msg("g2", "out", "Oui, bien sûr. Vous pouvez m'envoyer quelques photos?", 5 * DAY - 9 * MINUTE),
        msg("g3", "in", "Voici. On aimerait commencer en octobre.", 5 * DAY - 30 * MINUTE),
        msg("g4", "out", "Parfait — je vous prépare une soumission d'ici jeudi.", 5 * DAY - 45 * MINUTE),
        msg("g5", "out", "La soumission est prête — je vous l'envoie par courriel maintenant.", 2 * DAY, {
          failedReason: "service_window_closed",
          deliveredAt: null,
        }),
      ],
      { unread: 0, status: "open", threadNumber: 44 },
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
    threadNumber: t.threadNumber,
    lastMessageAt: t.lastMessageAt,
    unread: t.unread,
    status: t.status,
    snoozedUntil: t.snoozedUntil,
    assignedToId: t.assignedToId,
    waitingSince: t.waitingSince,
    outcome: t.outcome,
    // "in" and "out" only, exactly as the real list query filters — a preview
    // showing a colleague's private note about the customer, or the empty body
    // of a system line, is not what the last thing said was.
    preview:
      [...t.messages].reverse().find((m) => m.direction === "in" || m.direction === "out")?.body ||
      "",
    lastDirection:
      [...t.messages].reverse().find((m) => m.direction === "in" || m.direction === "out")?.direction ||
      null,
    mock: true,
  }));
}
