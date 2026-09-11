// app/components/sales/PublishedEmail.js
//
// The email address a business publishes on its own site, with a copy
// control, beside the call.
//
// The playbook told the rep "Publishes an email address" and nothing on the
// screen said WHICH — the mailto: had been in the evidence row since the
// crawl (lib/sales/intel/prospectEmail.js). The address now rides on
// Prospect.email; this prints it and copies it to the clipboard, so a rep
// who hears "just email me" has it in front of them without leaving the
// call. Nothing is rendered when there is none: an empty copy button is a
// control that appears to work and does not.
//
// `navigator.clipboard` is absent on plain http and in some webviews; the
// fallback is a selectable <code> the rep can long-press, and the button
// says "copied" only after the promise resolved.
"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PublishedEmail({ email, source = null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (!email) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2" data-testid="published-email">
      <Mail size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {source === "mailto" ? t("app.salesCall.emailFromSiteLink") : t("app.salesCall.emailFromSiteText")}
        </p>
        <code className="block text-sm text-foreground break-all select-all">{email}</code>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-border text-xs font-semibold text-foreground"
        aria-label={t("app.salesCall.copyEmail")}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t("app.salesCall.copied") : t("app.salesCall.copy")}
      </button>
    </div>
  );
}
