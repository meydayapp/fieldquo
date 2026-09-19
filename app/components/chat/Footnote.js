"use client";
// app/components/chat/Footnote.js
//
// One line under (or over) a composer, with the rest behind a disclosure.
//
// ══ Why one line ══════════════════════════════════════════════════════════
//
// The thread pane is what is left of a fixed-height frame after the chrome
// around it, and the chrome does not shrink. On the owner's rep's laptop
// (2026-09-19, 1280×680 CSS px) a three-line time-zone warning, a
// two-line CASL footnote and a four-line header left the conversation
// itself 100px tall: one line of a text and a scrollbar. The words in
// those notes are right and stay — a rep must be told what the send
// appends and why the window cannot be checked — but they are told in one
// line each, with the full sentence one press away (and in `title`, for a
// pointer that hovers). Nothing here is hidden that was not visible
// before; it is folded.
import { useId, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const TONES = {
  muted: "text-muted-foreground",
  warning: "text-amber-900 dark:text-amber-200",
};

/**
 * @param short   the one line
 * @param full    the rest, shown when opened (and as the line's title)
 * @param tone    "muted" | "warning"
 * @param icon    a lucide icon component (Info by default)
 * @param rest    data-* attributes for a check to find it by
 */
export default function Footnote({ short, full = null, tone = "muted", icon: Icon = Info, className = "", ...rest }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const color = TONES[tone] || TONES.muted;
  const hasMore = Boolean(full);
  return (
    <div className={`flex items-start gap-1.5 ${color} ${className}`} data-footnote={open ? "open" : "closed"} {...rest}>
      <Icon size={13} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={open ? "break-words" : "truncate"} title={!open && hasMore ? `${short} ${full}` : undefined}>
          {short}
        </p>
        {open && hasMore ? (
          <p id={id} className="mt-1 break-words">
            {full}
          </p>
        ) : null}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label={open ? t("app.chat.showLess") : t("app.chat.showMore")}
          title={open ? t("app.chat.showLess") : t("app.chat.showMore")}
          className="-my-1 grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-muted"
          data-footnote-toggle
        >
          <ChevronDown size={13} className={open ? "rotate-180" : ""} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
