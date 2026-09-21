// app/components/quotes/builder/RichTextEditor.js
//
// The editor for a text block's body: a textarea, a five-button toolbar
// (bold, italic, bullet list, numbered list, link) and a preview drawn by
// the same renderer the client's page uses.
//
// ── Why a textarea and not contentEditable ──────────────────────────────────
//
// The stored format is the five-rule subset lib/quotes/richText.js parses,
// never HTML — see that file's header for why. A contentEditable surface
// produces HTML that would then have to be turned back into the subset,
// losing whatever the browser invented on the way; a textarea holds the
// subset directly, the buttons wrap the selection with its markers, and the
// preview shows what the markers mean. What the estimator sees in the
// preview is what the PDF prints, because RichTextBody and RichTextPdf read
// the same tree.
"use client";

import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Link2, Eye, Pencil } from "lucide-react";
import RichTextBody from "@/app/components/quotes/RichTextBody";
import { useTranslation } from "@/app/hooks/useTranslation";

/** Wrap the selection (or insert markers at the caret) and keep focus. */
function wrapSelection(el, before, after, { linePrefix = null } = {}) {
  const value = el.value;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? start;
  let next;
  let caret;
  if (linePrefix !== null) {
    // Prefix every selected line (or the current one) — a list is a
    // line-level thing, not an inline marker.
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end === start ? value.indexOf("\n", end) : end;
    const sliceEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, sliceEnd);
    const lines = block.split("\n");
    const prefixed = lines
      .map((l, i) => {
        const p = typeof linePrefix === "function" ? linePrefix(i) : linePrefix;
        return l.startsWith(p) ? l : `${p}${l}`;
      })
      .join("\n");
    next = value.slice(0, lineStart) + prefixed + value.slice(sliceEnd);
    caret = lineStart + prefixed.length;
  } else {
    const selected = value.slice(start, end);
    next = value.slice(0, start) + before + selected + after + value.slice(end);
    caret = selected ? start + before.length + selected.length + after.length : start + before.length;
  }
  return { next, caret };
}

export default function RichTextEditor({
  value,
  onChange,
  rows = 6,
  placeholder = "",
  className = "",
  id,
}) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [preview, setPreview] = useState(false);

  const apply = (before, after, opts) => {
    const el = ref.current;
    if (!el) return;
    const { next, caret } = wrapSelection(el, before, after, opts);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const link = () => {
    const el = ref.current;
    if (!el) return;
    // The URL is asked for, not invented: a link with no destination is a
    // word underlined for no reason. window.prompt is the one native dialog
    // that fits a five-button toolbar; a custom one would be a second
    // modal over the library's.
    const url = typeof window !== "undefined" ? window.prompt(t("app.textBlocks.linkPrompt", "Link address (https://…)"), "https://") : "";
    if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
    apply("[", `](${url.trim()})`, undefined);
    if (!selected) {
      // No selection: put the caret inside the brackets so the label can
      // be typed straight away.
      requestAnimationFrame(() => {
        const at = el.value.indexOf(`](${url.trim()})`);
        if (at >= 0) el.setSelectionRange(at, at);
      });
    }
  };

  const tool = (Icon, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      <Icon size={14} />
    </button>
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-0.5 border border-border border-b-0 rounded-t-lg bg-muted/40 px-1 py-0.5">
        {tool(Bold, t("app.textBlocks.bold", "Bold"), () => apply("**", "**"))}
        {tool(Italic, t("app.textBlocks.italic", "Italic"), () => apply("_", "_"))}
        {tool(List, t("app.textBlocks.bulletList", "Bullet list"), () => apply("", "", { linePrefix: "- " }))}
        {tool(ListOrdered, t("app.textBlocks.numberedList", "Numbered list"), () =>
          apply("", "", { linePrefix: (i) => `${i + 1}. ` }),
        )}
        {tool(Link2, t("app.textBlocks.link", "Link"), link)}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {preview ? <Pencil size={12} /> : <Eye size={12} />}
          {preview ? t("app.textBlocks.edit", "Edit") : t("app.textBlocks.preview", "Preview")}
        </button>
      </div>
      {preview ? (
        <div className="border border-border rounded-b-lg px-3 py-2 text-sm min-h-[6rem] bg-background">
          {value?.trim() ? (
            <RichTextBody body={value} />
          ) : (
            <p className="text-muted-foreground text-xs">{t("app.textBlocks.previewEmpty", "Nothing to preview yet.")}</p>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full border border-border rounded-b-lg px-3 py-2 text-sm bg-background text-foreground resize-y"
        />
      )}
    </div>
  );
}
