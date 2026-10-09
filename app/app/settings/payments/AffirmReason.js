// app/app/settings/payments/AffirmReason.js
//
// Why Stripe has not activated Affirm, said to the owner in their language,
// with the next step — and, when the next step is Stripe support, the
// message to send them, ready to copy, with the account id in it.
//
// 2026-10-09: the card printed "Rejected unsupported business" — a tidied
// Stripe key — under "not enabled by Stripe on your account". The owner could
// not tell it meant "Stripe declined Affirm for your type of business" or that
// an appeal exists. The sentences live in lib/stripe/affirm.js
// (AFFIRM_REASON_TEXT, the English fallback) and app/i18n/appMessages.js
// (app.setPayments.affirmReason.<slug>, nine languages).
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { affirmReasonSlug, affirmSupportMessage } from "@/lib/stripe/affirm";

export default function AffirmReason({ affirm, accountId, businessName, t }) {
  const [copied, setCopied] = useState(false);
  // navigator.clipboard is missing on plain HTTP and refused when the
  // document isn't focused: on failure the button says so, and the text is
  // in a selectable box anyway — never a Copy that silently does nothing.
  const [copyFailed, setCopyFailed] = useState(false);
  const code = affirm?.disabledReasonCode || null;
  if (!code && !affirm?.disabledReason) return null;
  const sentence = code
    ? t(`app.setPayments.affirmReason.${affirmReasonSlug(code)}`, affirm.disabledReason || code)
    : affirm.disabledReason;
  const message = affirm?.contactStripe ? affirmSupportMessage({ accountId, code, businessName }) : null;

  async function copy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div className="mt-2 space-y-2" data-affirm-reason={code || "unknown"}>
      <p className="text-sm text-foreground">{sentence}</p>
      {message && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2" data-affirm-support-message>
          <p className="text-xs font-semibold text-foreground">
            {t("app.setPayments.affirmSupportTitle", "Message for Stripe support — review it, then paste it into Stripe's support chat or email:")}
          </p>
          <textarea
            readOnly
            value={message}
            rows={5}
            onFocus={(e) => e.target.select()}
            className="w-full text-xs rounded border border-border bg-background text-foreground p-2 font-mono"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied
              ? t("app.setPayments.affirmSupportCopied", "Copied")
              : t("app.setPayments.affirmSupportCopy", "Copy message")}
          </button>
          {copyFailed && (
            <p className="text-xs text-muted-foreground">
              {t("app.setPayments.affirmSupportCopyFailed", "Couldn't copy automatically — select the text above and copy it.")}
            </p>
          )}
          {!accountId && (
            <p className="text-xs text-muted-foreground">
              {t("app.setPayments.affirmSupportNoId", "The account owner can see the Stripe account ID on this page; add it before sending.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
