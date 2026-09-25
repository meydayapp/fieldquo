// app/components/quotes/SaveAsTemplateModal.js
//
// "Save as template": a name, then POST /api/quotes/[id]/template. What a
// template carries — and what it deliberately does not — is
// lib/quotes/quoteTemplates.js's decision, not this dialog's.
"use client";

import { useState } from "react";
import { LayoutTemplate, X, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function SaveAsTemplateModal({ isOpen, onClose, quoteId, suggestedName = "", onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function save() {
    if (!name.trim()) {
      setError(t("app.quoteTemplates.nameRequired", "Give the template a name."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const row = await fetchJson(`/api/quotes/${quoteId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      onSaved?.(row);
      onClose();
    } catch (err) {
      setError(err.message || t("app.quoteTemplates.saveError", "Couldn't save the template."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
      <div className="fq-dialog-card bg-card text-foreground w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border shadow-xl" onClick={(e) => e.stopPropagation()} data-save-template-modal>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><LayoutTemplate size={16} /> {t("app.quoteTemplates.saveTitle", "Save as template")}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close", "Close")} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("app.quoteTemplates.saveHint", "Keeps this quote's services, line items, notes and what-happens-next as a starting point for new quotes. The client, the address and the dates are not kept.")}</p>
          <div>
            <label htmlFor="template-name" className="block text-xs font-medium text-muted-foreground mb-1">{t("app.quoteTemplates.name", "Template name")}</label>
            <input id="template-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-border rounded px-2 py-2 text-sm bg-background" placeholder={t("app.quoteTemplates.namePlaceholder", "Interior repaint — 3 rooms")} />
          </div>
          {error ? <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-foreground">{t("app.action.cancel", "Cancel")}</button>
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60" data-save-template-confirm>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LayoutTemplate size={14} />}
            {t("app.quoteTemplates.save", "Save template")}
          </button>
        </div>
      </div>
    </div>
  );
}
