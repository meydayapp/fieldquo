"use client";
// app/components/chat/RoomList.js
//
// The left pane: rooms in groups, the way an agent's sidebar lists them.
//
// ══ What a row is ═════════════════════════════════════════════════════════
//
// Rocket.Chat's sidebar/Item/Extended.tsx settles the anatomy: avatar on the
// left; a first row of title + timestamp; a second row of subtitle + badges;
// the title bold while the room is unread; a selected state. Reimplemented
// from that description in the portal's own tokens — no markup or class was
// copied from that project, which is separately licensed.
//
// ══ Groups with a header, and a total on the header ═══════════════════════
//
// useRoomList.ts groups rooms into named sections and sums each section's
// unread into `unreadInfo` for the header — so a collapsed "Done" still says
// "3" if three of its rooms need a look. The caller decides the groups and
// their order (they are the SCREEN's vocabulary — "Needs a reply" here,
// "Channels" in a team chat); this component draws whatever it is given.
//
// ══ Keyboard ══════════════════════════════════════════════════════════════
//
// ↑/↓ move through the VISIBLE rooms across group boundaries, Home/End jump,
// Enter/Space open. One tab stop for the whole list (roving tabindex): a rep
// tabbing through a page should not have to press Tab forty times to get
// past forty conversations.
import { useCallback, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import Avatar from "./Avatar";

/**
 * "2:14 PM" today, "Yesterday", "Tue" this week, "Sep 9" otherwise.
 *
 * The reader's own zone and locale: a list is scanned for "when did they
 * last write", and the answer is relative to the reader's now.
 */
export function roomTimeLabel(value, t, now = new Date()) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dayMs = 24 * 60 * 60 * 1000;
  const key = (x) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  if (key(d) === key(now)) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (key(d) === key(new Date(now.getTime() - dayMs))) return t("app.chat.yesterday");
  if (now.getTime() - d.getTime() < 6 * dayMs) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** The badge: a count, or nothing. Never "0". */
export function UnreadBadge({ count, className = "" }) {
  const { t } = useTranslation();
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground tabular-nums ${className}`}
    >
      <span aria-hidden="true">{n > 99 ? "99+" : n}</span>
      <span className="sr-only">{t("app.chat.unreadCountSr", { count: n })}</span>
    </span>
  );
}

/**
 * One room.
 *
 * @param room  `{ id, title, subtitle, time, unread, channel, initials, mono, tone, badges, channelBadge }`
 *   `mono` draws the title in tabular figures — a phone number, not a name.
 *   `badges` is an optional node drawn after the subtitle (a STOP tag, a
 *   draft clock). `channelBadge` is an optional node for the avatar's
 *   corner when `channel` is not one the kit has a glyph for.
 */
export function RoomListItem({ room, selected = false, focused = false, onSelect, onFocusItem }) {
  const { t } = useTranslation();
  const unread = (Number(room.unread) || 0) > 0;

  return (
    <li role="none">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={focused ? 0 : -1}
        data-room-id={room.id}
        data-unread={unread ? "true" : undefined}
        onClick={() => onSelect?.(room)}
        onFocus={() => onFocusItem?.(room.id)}
        className={`relative flex w-full items-start gap-3 px-3 py-2.5 text-left min-h-[56px] transition-colors motion-reduce:transition-none ${
          selected ? "bg-muted" : "hover:bg-muted/60"
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
      >
        {/* The accent bar: the selected room, and nothing else, gets a
            stripe down its left edge. A background tint alone is invisible
            on a van-dashboard screen in daylight. */}
        {selected ? (
          <span aria-hidden="true" className="absolute inset-y-1 left-0 w-1 rounded-r bg-primary" />
        ) : null}
        <Avatar
          initials={room.initials}
          tone={room.tone || "them"}
          channel={room.channel || null}
          channelLabel={room.channelLabel || ""}
          badge={room.channelBadge || null}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={`truncate text-sm ${unread ? "font-semibold text-foreground" : "font-medium text-foreground"} ${
                room.mono ? "tabular-nums" : ""
              }`}
            >
              {room.title}
            </span>
            {room.time ? (
              <time
                dateTime={new Date(room.time).toISOString()}
                className={`shrink-0 text-[11px] tabular-nums ${unread ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                {roomTimeLabel(room.time, t)}
              </time>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-xs ${unread ? "text-foreground" : "text-muted-foreground"}`}>
              {room.subtitle}
            </span>
            {room.badges || null}
            <UnreadBadge count={room.unread} />
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A titled section with an unread total and a collapse toggle.
 *
 * The total is drawn always — open or collapsed — because a rep scanning
 * headers is asking "how many need me in this bucket", and a header that
 * only answers when collapsed is a header that answers half the time.
 */
export function RoomListGroup({ group, collapsed = false, onToggle, children }) {
  const { t } = useTranslation();
  const count = group.rooms?.length || 0;
  const unread = (group.rooms || []).reduce((n, r) => n + (Number(r.unread) || 0), 0);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <li role="none" data-room-group={group.key} className="pt-2 first:pt-0">
      <button
        type="button"
        onClick={() => onToggle?.(group.key)}
        aria-expanded={!collapsed}
        aria-controls={`room-group-${group.key}`}
        // 44px below lg: a section toggle is the control that shows or hides
        // every room under it, and 32px is under the thumb floor. 32 from lg
        // up, where the list is a rail beside a thread and density matters.
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground min-h-[44px] lg:min-h-[32px]"
      >
        <Chevron size={13} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{group.title}</span>
        {unread > 0 ? (
          <UnreadBadge count={unread} />
        ) : (
          <span className="tabular-nums text-muted-foreground/80" aria-label={t("app.chat.roomCountSr", { count })}>
            {count}
          </span>
        )}
      </button>
      {!collapsed ? (
        <ul id={`room-group-${group.key}`} role="group" aria-label={group.title} className="divide-y divide-border/60">
          {children}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * @param groups   `[{ key, title, rooms: [room, …] }]` in the order to draw
 * @param selectedId
 * @param onSelect(room)
 * @param collapsed  a Set (or array) of group keys that are folded
 * @param onToggleGroup(key)
 * @param header   optional node above the groups (a search box, a title)
 * @param empty    node to draw when there are no rooms at all
 */
export default function RoomList({
  groups,
  selectedId = null,
  onSelect,
  collapsed = [],
  onToggleGroup,
  header = null,
  empty = null,
  ariaLabel = "",
  focusedId = null,
  onFocusItem = null,
}) {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const folded = useMemo(() => new Set(collapsed instanceof Set ? [...collapsed] : collapsed || []), [collapsed]);
  const visible = useMemo(
    () => (groups || []).filter((g) => !folded.has(g.key)).flatMap((g) => g.rooms || []),
    [groups, folded],
  );
  const total = (groups || []).reduce((n, g) => n + (g.rooms?.length || 0), 0);

  // Roving focus: the selected room is the tab stop unless the caller moved
  // it. With nothing selected, the first visible room is.
  const focusId = focusedId ?? selectedId ?? visible[0]?.id ?? null;

  const onKeyDown = useCallback(
    (e) => {
      if (!visible.length) return;
      const at = Math.max(0, visible.findIndex((r) => r.id === focusId));
      let next = null;
      if (e.key === "ArrowDown") next = visible[Math.min(visible.length - 1, at + 1)];
      else if (e.key === "ArrowUp") next = visible[Math.max(0, at - 1)];
      else if (e.key === "Home") next = visible[0];
      else if (e.key === "End") next = visible[visible.length - 1];
      else if (e.key === "Enter" || e.key === " ") {
        const room = visible[at];
        if (room) {
          e.preventDefault();
          onSelect?.(room);
        }
        return;
      } else return;
      e.preventDefault();
      if (!next) return;
      onFocusItem?.(next.id);
      // Focus moved HERE, from the key press, rather than by an effect on the
      // item: an effect that focuses whenever a row becomes "the focused one"
      // also fires on first paint and yanks the page to the list.
      listRef.current?.querySelector(`[data-room-id="${CSS.escape(String(next.id))}"]`)?.focus();
    },
    [visible, focusId, onSelect, onFocusItem],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <ul
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel || t("app.chat.roomListLabel")}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto py-1"
        data-room-list
      >
        {total === 0
          ? empty
          : (groups || [])
              .filter((g) => (g.rooms?.length || 0) > 0 || g.alwaysShow)
              .map((g) => (
                <RoomListGroup key={g.key} group={g} collapsed={folded.has(g.key)} onToggle={onToggleGroup}>
                  {(g.rooms || []).map((room) => (
                    <RoomListItem
                      key={room.id}
                      room={room}
                      selected={room.id === selectedId}
                      focused={room.id === focusId}
                      onSelect={onSelect}
                      onFocusItem={onFocusItem}
                    />
                  ))}
                </RoomListGroup>
              ))}
      </ul>
    </div>
  );
}
