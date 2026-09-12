"use client";
// app/components/chat/Avatar.js
//
// Two letters in a circle, with the channel pinned to its corner.
//
// Initials rather than a photograph because there is no photograph of a
// contractor to have, and a generic silhouette in every row is a column of
// grey circles carrying no information. The channel badge is Rocket.Chat's
// sidebar detail that makes an omnichannel list readable: at a glance, this
// one is SMS and that one is email, before a word is read.
import { Mail, MessageSquareText, Users } from "lucide-react";

/** The channels the kit knows how to badge. Anything else draws no badge. */
export const CHANNEL_ICONS = Object.freeze({
  sms: MessageSquareText,
  email: Mail,
  team: Users,
});

/**
 * Two letters for a name — "Northside Painting" gives NP. A single word gives
 * its first two letters. Exported so a list and its thread cannot disagree.
 */
export function initialsOf(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

const TONES = {
  them: "bg-muted text-foreground",
  us: "bg-primary text-primary-foreground",
  muted: "bg-muted text-muted-foreground",
};

/**
 * @param initials   what to draw. Use initialsOf() or the digits of a number.
 * @param tone       "them" | "us" | "muted"
 * @param channel    "sms" | "email" | "team" | null — the tiny badge
 * @param channelLabel  the badge's accessible name (the caller translates it)
 * @param badge      optional: a node to draw in the corner INSTEAD of the
 *                   lookup above — for a channel the kit has no glyph for
 *                   (Facebook, Instagram, WhatsApp are brand marks lucide
 *                   does not ship; the caller draws them). Same corner, same
 *                   ring, same accessible name via `channelLabel`.
 */
export default function Avatar({
  initials,
  tone = "them",
  channel = null,
  channelLabel = "",
  badge = null,
  size = "md",
  className = "",
}) {
  const Badge = !badge && channel ? CHANNEL_ICONS[channel] : null;
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-full font-semibold tabular-nums ${SIZES[size] || SIZES.md} ${TONES[tone] || TONES.them}`}
      >
        {initials}
      </span>
      {badge || Badge ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border border-card bg-card text-muted-foreground"
          title={channelLabel || undefined}
        >
          {badge || <Badge size={10} aria-hidden="true" />}
          {channelLabel ? <span className="sr-only">{channelLabel}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
