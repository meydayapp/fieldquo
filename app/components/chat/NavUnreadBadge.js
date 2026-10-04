"use client";
// app/components/chat/NavUnreadBadge.js
//
// The unread digit on a Chat entry in the /app chrome — the phone tab bars,
// the rail row, the crew's big Chat button. Counts come from
// app/hooks/useChatUnread.js; nothing is drawn for zero or for unknown.
//
// Red with white, not the brand pair: the rail and the tab bar are the
// sidebar's colour, which is navy by default and can be the brand's, and a
// primary-on-primary pill vanishes there. White on red-600 (#dc2626) is
// 4.83:1 — the pair the room list's mention badge already uses — and the
// pill carries its own fill, so it reads the same on every bar.
import { useTranslation } from "@/app/hooks/useTranslation";

const PLACEMENT = {
  // Pinned to the top-right of a tab icon; the wrapper must be `relative`.
  corner: "absolute -top-1.5 -right-2.5 min-w-[1.125rem] px-1 text-[10px] leading-[1.125rem]",
  // Pushed to the end of a rail row.
  end: "ml-auto shrink-0 min-w-[1.25rem] px-1.5 text-xs leading-5",
  // Right after the words — the crew's big centred buttons.
  inline: "shrink-0 min-w-[1.5rem] px-2 text-sm leading-6",
};

/**
 * @param counts     { unread, mentions } or null
 * @param placement  "corner" | "end" | "inline" — see PLACEMENT
 */
export default function NavUnreadBadge({ counts, placement = "corner" }) {
  const { t } = useTranslation();
  const n = Math.max(0, Number(counts?.unread) || 0);
  if (!n) return null;
  return (
    <span
      data-chat-unread={n}
      className={`${PLACEMENT[placement] || PLACEMENT.corner} inline-flex items-center justify-center rounded-full bg-red-600 font-bold text-white tabular-nums`}
    >
      <span aria-hidden="true">{n > 99 ? "99+" : n}</span>
      <span className="sr-only">{t("app.chat.unreadCountSr", { count: n })}</span>
    </span>
  );
}
