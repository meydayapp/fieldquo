// app/components/documents/ClientPoRequiredModal.js
//
// The question POST /api/invoices/[id]/send asks when the client requires a
// PO number on invoices and this one has none (409, code "po_required" —
// lib/documents/clientPo.js clientPoSendPrompt). Both ways out, as the route
// promises:
//
//   • type the PO and send — posted back to the same send as
//     `clientPoNumber`, written onto the DRAFT in place first;
//   • send without one — `sendWithoutPo: true`.
//
// A sent invoice cannot take a PO in place (an edit there is a new version),
// so for one of those the box is replaced by a link to Edit, and "send
// without" is still offered — re-sending a copy is the office's call.
"use client";

import { useState } from "react";
import Link from "next/link";
import { FileWarning, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { CLIENT_PO_MAX } from "@/lib/documents/clientPo";

export default function ClientPoRequiredModal({ prompt, invoiceId, busy = false, onClose, onSend }) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  if (!prompt) return null;
  const editable = prompt.editable !== false;
  const typed = value.trim();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-po-required-title"
    >
      <div className="fq-dialog-card bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto mb-4">
          <FileWarning size={24} className="text-amber-800 dark:text-amber-300" />
        </div>
        <h2 id="client-po-required-title" className="text-lg font-semibold text-foreground text-center">
          {t("app.clientPo.promptTitle")}
        </h2>
        <p className="text-sm text-muted-foreground text-center mt-2">
          {t("app.clientPo.promptBody", { client: prompt.clientName || "" })}
        </p>

        {editable ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed) onSend({ clientPoNumber: typed });
            }}
          >
            <label htmlFor="client-po-required-input" className="block text-xs font-semibold text-foreground">
              {t("app.clientPo.label")}
            </label>
            <input
              id="client-po-required-input"
              type="text"
              value={value}
              maxLength={CLIENT_PO_MAX}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("app.clientPo.placeholder")}
              autoComplete="off"
              autoFocus
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
            />
            <button
              type="submit"
              disabled={busy || !typed}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("app.clientPo.promptEnter")}
            </button>
          </form>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">{t("app.clientPo.promptSentBody")}</p>
            <Link
              href={`/app/invoices/${invoiceId}/edit`}
              className="block w-full text-center bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold"
            >
              {t("app.clientPo.promptEdit")}
            </Link>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => onSend({ sendWithoutPo: true })}
          className="w-full mt-2 border border-border text-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {t("app.clientPo.promptAnyway")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="w-full mt-2 text-sm text-muted-foreground py-2"
        >
          {t("app.action.cancel")}
        </button>
      </div>
    </div>
  );
}
