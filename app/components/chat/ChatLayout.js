"use client";
// app/components/chat/ChatLayout.js
//
// Three panes: the room list, the thread, the context bar.
//
// ══ The anatomy is Rocket.Chat's; nothing else is ═════════════════════════
//
// Rooms down the left at a fixed width, the conversation filling the middle,
// a contextual bar on the right that opens and closes — RoomBody.tsx renders
// exactly that, with the contextual bar as a sibling of the message list.
// The widths here are ours (280 / flex / 340), the tokens are the portal's,
// and no markup, class or file was taken from that project, which is
// separately licensed.
//
// ══ One pane at a time on a phone ═════════════════════════════════════════
//
// Below `md` there is no room for two columns, let alone three. The caller
// says which pane is current (`pane`) and this component shows that one and
// hides the others — hides, not unmounts, so a half-typed reply survives a
// trip to the contact sheet and back. The context bar on a phone is a sheet
// over the thread rather than a third column, because a 340px column on a
// 375px screen is not a column.
//
// The list wants 280px and gives up to 40 of them when the thread is short
// of room: a room list at 180px shows a title and nothing else, and the
// subtitle is what tells a rep which conversation needs them, so 240 is the
// floor — flex-basis and min-width rather than a fixed width, because a
// fixed list beside a fixed bar left the thread whatever was left, and on a
// 1280px window that was ~390px (the owner: "flexible, not fixed").
import { useEffect } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const PANE_LIST = "list";
export const PANE_THREAD = "thread";
export const PANE_CONTEXT = "context";

/**
 * @param list      the room list node
 * @param thread    the thread node (header + messages + composer)
 * @param context   the context bar node, or null to show none
 * @param pane      which pane a phone shows: "list" | "thread" | "context"
 * @param onCloseContext  called when Esc dismisses the phone sheet. The bar
 *                  itself carries the close button (ContextBar's onClose);
 *                  the caller wires both to the same setter.
 * @param height    a Tailwind height class for the whole frame. The caller
 *                  knows what chrome sits above it; this component does not.
 * @param contextColumnFrom  "lg" (default) or "wide": the viewport width
 *                  from which the context bar is a third COLUMN rather than
 *                  a sheet over the thread. The sales texts screen passes
 *                  "wide" (1400px): with a 220px sidebar, a 280px list and
 *                  a 340px bar, a 1280px window left the thread ~390px —
 *                  the owner's rep saw a composer squeezed into a column
 *                  with its own scrollbar and no Send in sight. The caller's
 *                  own "is it wide" media query must use the same width
 *                  (CONTEXT_COLUMN_MIN_WIDTH), or the header's Contact
 *                  toggle and the layout disagree about what a press does.
 */
export const CONTEXT_COLUMN_MIN_WIDTH = { lg: 1024, wide: 1400 };

export default function ChatLayout({
  list,
  thread,
  context = null,
  pane = PANE_LIST,
  onCloseContext = null,
  height = "h-[70vh]",
  className = "",
  contextColumnFrom = "lg",
  ...rest
}) {
  const { t } = useTranslation();
  const showContext = Boolean(context);
  // Static class strings — Tailwind sees only what is written out.
  const columnClass = contextColumnFrom === "wide" ? "hidden min-[1400px]:flex" : "hidden lg:flex";
  const sheetClass = contextColumnFrom === "wide" ? "min-[1400px]:hidden" : "lg:hidden";

  // Esc closes the sheet on a phone — the one gesture every overlay honours.
  useEffect(() => {
    if (pane !== PANE_CONTEXT || !onCloseContext) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCloseContext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pane, onCloseContext]);

  // overflow-hidden is the rounded corners' clip and nothing more: every
  // pane inside is min-h-0 and scrolls itself, so no control can end up
  // beyond this edge — which is what the floor is for too: below 360px the
  // page scrolls instead of the panes losing their composer.
  return (
    <div
      className={`relative flex ${height} min-h-[360px] overflow-hidden rounded-xl border border-border bg-card ${className}`}
      data-chat-layout
      data-pane={pane}
      {...rest}
    >
      {/* ── Room list ─────────────────────────────────────────────────────── */}
      <aside
        data-chat-pane="list"
        className={`${pane === PANE_LIST ? "flex" : "hidden"} md:flex w-full md:w-auto md:basis-[280px] md:min-w-[240px] md:shrink md:grow-0 flex-col border-r border-border bg-card min-h-0`}
      >
        {list}
      </aside>

      {/* ── Thread ────────────────────────────────────────────────────────── */}
      {/* The thread takes every pixel the list and the bar leave — and
          never less than a phone's width from md up, which is what makes
          the bar give way (see contextColumnFrom) rather than the thread. */}
      <section
        data-chat-pane="thread"
        className={`${pane === PANE_THREAD ? "flex" : "hidden"} md:flex min-w-0 md:min-w-[360px] flex-1 flex-col min-h-0`}
      >
        {thread}
      </section>

      {/* ── Context bar: a column from lg up, a sheet below md ────────────── */}
      {showContext ? (
        <>
          <aside
            data-chat-pane="context"
            className={`${columnClass} w-[340px] shrink-0 flex-col border-l border-border bg-card min-h-0`}
          >
            {context}
          </aside>
          {pane === PANE_CONTEXT ? (
            <div
              className={`absolute inset-0 z-20 flex flex-col bg-card ${sheetClass}`}
              role="dialog"
              aria-modal="true"
              aria-label={t("app.chat.contextSheet")}
              data-chat-pane="context-sheet"
            >
              {context}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
