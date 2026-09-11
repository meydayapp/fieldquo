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
// The list keeps its width and never squeezes: a room list at 180px shows a
// title and nothing else, and the subtitle is what tells a rep which
// conversation needs them.
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
 */
export default function ChatLayout({
  list,
  thread,
  context = null,
  pane = PANE_LIST,
  onCloseContext = null,
  height = "h-[70vh]",
  className = "",
  ...rest
}) {
  const { t } = useTranslation();
  const showContext = Boolean(context);

  // Esc closes the sheet on a phone — the one gesture every overlay honours.
  useEffect(() => {
    if (pane !== PANE_CONTEXT || !onCloseContext) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCloseContext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pane, onCloseContext]);

  return (
    <div
      className={`relative flex ${height} min-h-[420px] overflow-hidden rounded-xl border border-border bg-card ${className}`}
      data-chat-layout
      data-pane={pane}
      {...rest}
    >
      {/* ── Room list ─────────────────────────────────────────────────────── */}
      <aside
        data-chat-pane="list"
        className={`${pane === PANE_LIST ? "flex" : "hidden"} md:flex w-full md:w-[280px] md:shrink-0 flex-col border-r border-border bg-card min-h-0`}
      >
        {list}
      </aside>

      {/* ── Thread ────────────────────────────────────────────────────────── */}
      <section
        data-chat-pane="thread"
        className={`${pane === PANE_THREAD ? "flex" : "hidden"} md:flex min-w-0 flex-1 flex-col min-h-0`}
      >
        {thread}
      </section>

      {/* ── Context bar: a column from lg up, a sheet below md ────────────── */}
      {showContext ? (
        <>
          <aside
            data-chat-pane="context"
            className="hidden lg:flex w-[340px] shrink-0 flex-col border-l border-border bg-card min-h-0"
          >
            {context}
          </aside>
          {pane === PANE_CONTEXT ? (
            <div
              className="absolute inset-0 z-20 flex flex-col bg-card lg:hidden"
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
