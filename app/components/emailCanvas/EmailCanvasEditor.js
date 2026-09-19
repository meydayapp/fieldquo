"use client";

// app/components/emailCanvas/EmailCanvasEditor.js
//
// The designer's canvas, opened on an email-shaped artboard, for a template's
// canvas mode. The one canvas in the product (app/components/designer, fabric
// behind DesignerLoader's ssr:false boundary) rather than a third editor —
// the owner asked for "the 2 modes Sunset Space has", and Sunset Space's two
// modes share one canvas engine too.
//
// ── What this adds to the designer ─────────────────────────────────────────
//
//   1. An artboard of EMAIL_CANVAS size (600 wide), so the compiler's scale is
//      1 and what is drawn is what is sent (lib/email/canvasEmail.js).
//   2. A LINK panel. The ad designer has no links — a picture cannot be
//      clicked — and an email with no link to the quote is an email that
//      cannot do its job. The selected layer can be linked to the quote, the
//      invoice, or an address of the company's; it is stored as `linkData`
//      on the fabric object, which JSON_KEYS already persists, and the
//      compiler turns a linked shape with text in it into a button.
//   3. A merge-field row: the same tokens the block editor offers, inserted
//      into the selected text layer.
//
// The document is handed back through onChange on every save the designer
// makes (debounced inside Editor.js). This component never talks to an API:
// the page that owns the template decides when and where to store it.

import { useCallback, useEffect, useRef, useState } from "react";
import DesignerLoader from "@/app/components/designer/DesignerLoader";
import { EMAIL_CANVAS } from "@/lib/email/canvasEmail";
import { useTranslation } from "@/app/hooks/useTranslation";

const LINK_CHOICES = [
  { value: "", labelKey: "app.emailCanvas.linkNone" },
  { value: "{{quoteUrl}}", labelKey: "app.emailCanvas.linkQuote" },
  { value: "{{invoiceUrl}}", labelKey: "app.emailCanvas.linkInvoice" },
  { value: "custom", labelKey: "app.emailCanvas.linkCustom" },
];

/**
 * @param {object|string|null} value   the fabric document, or null for a blank artboard
 * @param {(doc: object) => void} onChange  every save the designer makes
 * @param {Array<{token,label}>} mergeFields  the tokens to offer
 */
export default function EmailCanvasEditor({ value, onChange, mergeFields = [] }) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const [selected, setSelected] = useState(null); // { type, link }
  const [customUrl, setCustomUrl] = useState("");

  // The designer re-creates `editor` on many events; only the canvas matters
  // here, and only once it exists.
  const onEditorReady = useCallback((editor) => {
    editorRef.current = editor || null;
    const canvas = editor?.canvas;
    if (!canvas || canvas.__emailCanvasWired) return;
    canvas.__emailCanvasWired = true;
    const sync = () => {
      const obj = canvas.getActiveObject();
      if (!obj) {
        setSelected(null);
        return;
      }
      setSelected({ type: obj.type, link: obj.linkData?.url || "" });
      setCustomUrl(obj.linkData?.url && !obj.linkData.url.startsWith("{{") ? obj.linkData.url : "");
    };
    canvas.on("selection:created", sync);
    canvas.on("selection:updated", sync);
    canvas.on("selection:cleared", sync);
  }, []);

  const initialJson =
    typeof value === "string" ? value : value && typeof value === "object" ? JSON.stringify(value) : undefined;

  const saveCallback = useCallback(
    ({ json }) => {
      try {
        onChange?.(JSON.parse(json));
      } catch {
        // A document the designer could not serialise is not one to store.
      }
    },
    [onChange],
  );

  function setLink(url) {
    const canvas = editorRef.current?.canvas;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set("linkData", url ? { url } : null);
    canvas.renderAll();
    // The designer saves on object:modified; a property set does not fire
    // it, so the history/save hook is nudged the same way its own tools do.
    canvas.fire("object:modified", { target: obj });
    setSelected({ type: obj.type, link: url });
  }

  function insertToken(token) {
    const canvas = editorRef.current?.canvas;
    const obj = canvas?.getActiveObject();
    if (!obj || !["textbox", "i-text", "text"].includes(obj.type)) return;
    obj.set("text", `${obj.text || ""}{{${token}}}`);
    canvas.renderAll();
    canvas.fire("object:modified", { target: obj });
  }

  const linkMode =
    !selected?.link ? "" : selected.link.startsWith("{{") ? selected.link : "custom";
  const isText = selected && ["textbox", "i-text", "text"].includes(selected.type);

  // The Editor positions its chrome absolutely against the nearest positioned
  // ancestor and needs a real height to lay the canvas out in.
  return (
    <div className="space-y-2">
      <div className="relative h-[640px] rounded-xl border border-border overflow-hidden bg-muted">
        <DesignerLoader
          initialData={{ json: initialJson, width: EMAIL_CANVAS.width, height: EMAIL_CANVAS.height }}
          saveCallback={saveCallback}
          onEditorReady={onEditorReady}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("app.emailCanvas.selectedLayer")}
        </div>
        {!selected ? (
          <span className="text-xs text-muted-foreground">{t("app.emailCanvas.selectALayer")}</span>
        ) : (
          <>
            <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              {t("app.emailCanvas.linkTo")}
              <select
                value={linkMode}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") setSelected((s) => ({ ...s, link: customUrl || "https://" }));
                  else setLink(v);
                }}
                className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
              >
                {LINK_CHOICES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            {linkMode === "custom" && (
              <input
                type="url"
                value={customUrl}
                placeholder="https://"
                onChange={(e) => setCustomUrl(e.target.value)}
                onBlur={() => setLink(customUrl.trim())}
                className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card w-56"
              />
            )}
            {isText && mergeFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {mergeFields.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    onClick={() => insertToken(f.token)}
                    className="text-xs bg-muted hover:bg-accent text-foreground px-2 py-1 rounded-full"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("app.emailCanvas.howItSends")}</p>
    </div>
  );
}
