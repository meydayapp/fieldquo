// app/app/messages/threadRooms.js
//
// The inbox list's rows: the thread summaries GET /api/messaging/threads
// answers, bucketed and turned into the RoomList kit's `groups`. Moved out
// of app/app/messages/page.js (2026-09-25), unchanged, so the /signup side
// panel's "Win more jobs" sample renders the inbox list with the same rows
// the inbox renders — a second mapping written for the sample would be the
// copy that drifts.
"use client";

import { AlertTriangle } from "lucide-react";
import { initialsOf } from "@/app/components/chat";
import { platformLabelKey } from "@/lib/messaging/platforms";
import { GROUP_ORDER, groupThreads, groupTitleKey } from "@/lib/messaging/rooms";
// lucide ships no brand marks; the bio-link page already draws these three.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { TemperatureChip } from "@/app/components/messaging/ConversationTemperature";
import { WaitingBadge } from "./ConversationBits";

/** RoomList's `groups` for a list of thread summaries. */
export function threadRoomGroups(threads, { t, now }) {
  const buckets = groupThreads(threads || []);
  return GROUP_ORDER.map((key) => ({
    key,
    title: t(groupTitleKey(key)),
    rooms: buckets[key].map((row) => ({
      id: row.id,
      title: row.participantName || t("app.messages.unknownPerson"),
      subtitle:
        row.lastDirection === "out"
          ? t("app.messages.lastFromYou", { message: row.preview || "" })
          : row.preview || "",
      time: row.lastMessageAt,
      unread: row.unread ?? 0,
      // A brand mark in the avatar's corner, not one of the kit's three
      // glyphs. The accessible name is the platform's own word.
      channelLabel: row.platform ? t(platformLabelKey(row.platform)) : "",
      channelBadge: row.platform ? <SocialGlyph platform={row.platform} size={10} /> : null,
      initials: initialsOf(row.participantName || "?"),
      badges: <RowBadges row={row} now={now} t={t} />,
    })),
  }));
}

export function RowBadges({ row, now, t }) {
  return (
    <>
      {/* The whole reason waitingSince is a column: this sentence, here, on
          a list of two hundred — rather than in a report once a month. */}
      <WaitingBadge thread={row} t={t} now={now} />
      {/* An annotation, never a filter. A conversation that scored cold sits
          in this list exactly where it would have without a score. */}
      <TemperatureChip temperature={row.temperature} score={row.score} t={t} />
      {row.lastFailed && (
        // Surfaced on the list, not only inside the thread: a reply that
        // never reached the homeowner is the thing a contractor most needs
        // to see without opening anything. An icon with the word for a
        // screen reader — the row is 280px wide and the preview has to
        // survive.
        <span className="shrink-0 text-destructive" title={t("app.messages.failed")}>
          <AlertTriangle size={12} aria-hidden="true" />
          <span className="sr-only">{t("app.messages.failed")}</span>
        </span>
      )}
    </>
  );
}
