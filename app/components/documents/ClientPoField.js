// app/components/documents/ClientPoField.js
//
// "Client PO #" — the box for the purchase-order number a commercial client
// issued (Quote / Job / Invoice.clientPoNumber; lib/documents/clientPo.js).
// One component for the quote builder (both layouts), the invoice builder and
// the job page, so the three cannot drift on what the field says, how
// Generate works, or when it is locked.
//
// Generate asks GET /api/client-po/next for the company's next PO-<year>-NNNN
// and puts it IN THE BOX — it saves nothing. The document's own Save writes
// it, exactly like a typed value; leaving the page without saving leaves no
// trace. A failed request says so under the box rather than doing nothing.
//
// Not the supplier PO. The purchasing screens' "PO-001" is the contractor's
// own order to a supplier and never appears here.
"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { CLIENT_PO_MAX } from "@/lib/documents/clientPo";

export default function ClientPoField({
  value,
  onChange,
  // Which document the box sits on — "quote" | "invoice" | "job". Decides the
  // permission GET /api/client-po/next checks.
  kind,
  // A decided quote: the PO lives on the job from then on.
  locked = false,
  lockedNote = "",
  // The selected client, for the "requires a PO" line.
  client = null,
  // The card frame the quote builder's classic layout draws its boxes in;
  // off for the document layout and the job page, which bring their own.
  framed = true,
  inputId = `client-po-${kind || "doc"}`,
}) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const current = value || "";
  const missingRequired = Boolean(client?.requiresPo) && !current.trim();

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/client-po/next?for=${encodeURIComponent(kind)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.value) throw new Error(data?.error || t("app.clientPo.generateError"));
      onChange(data.value);
    } catch (err) {
      setError(err?.message || t("app.clientPo.generateError"));
    } finally {
      setGenerating(false);
    }
  }

  const body = (
    <>
      <label htmlFor={inputId} className="block font-semibold text-foreground mb-1 text-sm">
        {t("app.clientPo.label")}
      </label>
      {locked ? (
        <p className="text-sm text-foreground" data-client-po-locked>
          {current || <span className="text-muted-foreground">{t("app.clientPo.none")}</span>}
          {lockedNote ? <span className="block text-xs text-muted-foreground mt-0.5">{lockedNote}</span> : null}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{t("app.clientPo.hint")}</p>
          <div className="flex items-center gap-2">
            <input
              id={inputId}
              type="text"
              value={current}
              maxLength={CLIENT_PO_MAX}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("app.clientPo.placeholder")}
              autoComplete="off"
              className="flex-1 min-w-0 border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
              data-client-po-input
            />
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              title={t("app.clientPo.generateTitle")}
              className="shrink-0 inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              data-client-po-generate
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              {t("app.clientPo.generate")}
            </button>
          </div>
          {error ? <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p> : null}
        </>
      )}
      {/* The client's own rule, said where the number is typed. Only while
          there is no number — once there is one there is nothing to warn. */}
      {missingRequired && (
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1" data-client-po-required>
          {t("app.clientPo.requiredHint", { client: client?.name || "" })}
        </p>
      )}
    </>
  );

  if (!framed) return <div data-client-po-field>{body}</div>;
  return (
    <div className="bg-card border border-border rounded-xl p-5" data-client-po-field>
      {body}
    </div>
  );
}
