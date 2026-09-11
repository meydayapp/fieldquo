"use client";
// app/components/chat/Composer.js
//
// The bottom pane: a hint line, the box, a toolbar, Send.
//
// ══ The anatomy is a message box, not a form ══════════════════════════════
//
// Rocket.Chat's MessageBoxBase: a line above the textarea for whatever the
// room wants to say about itself (editing, read-only, a draft waiting), the
// textarea, and a toolbar underneath with actions on the left and the
// primary send on the right. Enter sends, Shift+Enter breaks a line. Drawn
// here in the portal's own tokens — no markup or file was copied from that
// project, which is separately licensed.
//
// ══ `!` opens canned responses ════════════════════════════════════════════
//
// Omnichannel agents type `!` and a word and get a filtered list of stock
// replies; Tab or Enter drops one into the box. The catalogue is the
// CALLER's — a sales screen passes check-in wordings, a support screen would
// pass something else — and the filtering is lib/chat/threadLayout.js's
// filterCanned, pure, so the ranking is executed by a check rather than
// eyeballed on three entries. Nothing is inserted without a key press, and
// nothing is SENT by inserting: the text lands in the box and the rep reads
// it before Send.
//
// ══ Nothing here sends on its own ═════════════════════════════════════════
//
// `onSend` is called from exactly two places — the Send button's click and
// the Enter key — and from no effect and no timer. Whether the words may go
// is not this component's decision either: the caller's server refuses what
// it refuses, and the caller draws that refusal.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Send, Zap } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { bangTokenAt, filterCanned, replaceBangToken } from "@/lib/chat/threadLayout";

const MAX_LISTED = 8;

/**
 * @param value / onChange(text)   controlled text
 * @param onSend()                 the one way words leave the box
 * @param hint                     node for the line above the box (a draft
 *                                 waiting, a window closing) — or null
 * @param onHintAccept()           Tab in an EMPTY box calls this — the
 *                                 "Tab to load" affordance the hint names
 * @param canned                   `[{ id, title, text, group? }]` for `!`
 * @param actions                  node(s) for the toolbar's left side
 * @param footer                   node under the toolbar (a legal note)
 * @param disabled / busy
 * @param maxLength                optional character ceiling, shown as a count
 */
export default function Composer({
  value,
  onChange,
  onSend,
  hint = null,
  onHintAccept = null,
  canned = [],
  actions = null,
  footer = null,
  disabled = false,
  busy = false,
  placeholder = "",
  sendLabel = "",
  maxLength = null,
  textareaId = null,
  autoFocus = false,
}) {
  const { t } = useTranslation();
  const generatedId = useId();
  const id = textareaId || `composer-${generatedId}`;
  const box = useRef(null);
  const [caret, setCaret] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [dismissedToken, setDismissedToken] = useState(null);

  const token = useMemo(() => bangTokenAt(value, caret), [value, caret]);
  const popupOpen = Boolean(token) && canned.length > 0 && dismissedToken !== token?.start;
  const matches = useMemo(() => (popupOpen ? filterCanned(canned, token.query).slice(0, MAX_LISTED) : []), [
    popupOpen,
    canned,
    token,
  ]);

  useEffect(() => {
    setCursor(0);
  }, [token?.query]);

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  // Grow with the text, up to a ceiling, so a three-line reply is not
  // scrolled inside a two-line box and a pasted essay does not eat the
  // thread.
  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);
  useEffect(fit, [value, fit]);

  const insert = useCallback(
    (entry) => {
      if (!entry || !token) return;
      const next = replaceBangToken(value, token, entry.text);
      onChange(next);
      setDismissedToken(null);
      // Put the caret after the inserted text once React has painted it.
      const at = token.start + String(entry.text).length + 1;
      requestAnimationFrame(() => {
        const el = box.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(Math.min(at, next.length), Math.min(at, next.length));
        setCaret(Math.min(at, next.length));
      });
    },
    [token, value, onChange],
  );

  const canSend = !disabled && !busy && String(value || "").trim().length > 0;

  const onKeyDown = (e) => {
    if (popupOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => (matches.length ? (c + 1) % matches.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => (matches.length ? (c - 1 + matches.length) % matches.length : 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && matches.length) {
        e.preventDefault();
        insert(matches[cursor] || matches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedToken(token.start);
        return;
      }
    }
    if (e.key === "Tab" && !e.shiftKey && onHintAccept && !String(value || "").trim()) {
      e.preventDefault();
      onHintAccept();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const listId = `${id}-canned`;
  const count = String(value || "").length;

  return (
    <div className="border-t border-border bg-card" data-chat-composer>
      {hint ? (
        <div className="flex items-center gap-2 px-3 pt-2 text-xs text-muted-foreground break-words" data-composer-hint>
          {hint}
        </div>
      ) : null}

      <div className="relative px-3 pt-2">
        {popupOpen ? (
          <div
            id={listId}
            role="listbox"
            aria-label={t("app.chat.cannedTitle")}
            data-canned-popup
            className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Zap size={12} aria-hidden="true" /> {t("app.chat.cannedTitle")}
              </span>
              <span className="normal-case tracking-normal font-normal">{t("app.chat.cannedKeys")}</span>
            </div>
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.chat.cannedEmpty")}</p>
            ) : (
              matches.map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(entry)}
                  className={`block w-full px-3 py-2 text-left ${i === cursor ? "bg-muted" : "hover:bg-muted/60"}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{entry.title}</span>
                    {entry.group ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{entry.group}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.text}</span>
                </button>
              ))
            )}
          </div>
        ) : null}

        <label className="sr-only" htmlFor={id}>
          {t("app.chat.messageLabel")}
        </label>
        <textarea
          id={id}
          ref={box}
          rows={2}
          value={value}
          disabled={disabled}
          placeholder={placeholder || t("app.chat.placeholder")}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-controls={popupOpen ? listId : undefined}
          aria-expanded={popupOpen}
          // text-base: anything smaller makes iOS zoom the page on focus.
          className="block w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-1 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1" data-composer-actions>
          {actions}
        </div>
        <span className="hidden sm:inline text-[11px] text-muted-foreground">{t("app.chat.enterToSend")}</span>
        {maxLength ? (
          <span
            className={`text-[11px] tabular-nums ${count > maxLength ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}
            aria-live="polite"
          >
            {count}/{maxLength}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!canSend}
          onClick={onSend}
          data-composer-send
          className="ml-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Send size={15} aria-hidden="true" />
          )}
          {sendLabel || t("app.chat.send")}
        </button>
      </div>

      {footer ? <div className="px-3 pb-2 text-[11px] text-muted-foreground break-words">{footer}</div> : null}
    </div>
  );
}
