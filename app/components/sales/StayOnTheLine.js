// app/components/sales/StayOnTheLine.js
//
// The "after a yes" step on the call screen: text the link, stay on the
// line through the card step. The three sentences come from
// lib/sales/playbook/stayOnTheLine.js in the script's language (EN / FR /
// ES) — the same language the AI script on the same card is in — and the
// heading is the rep's own language (nine keys). Drawn under the close in
// both layouts of CallPlaybook; nothing here is generated, so it is on the
// screen whether or not an AI script exists for the row.
"use client";

import { PhoneCall } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { stayOnTheLineFor } from "@/lib/sales/playbook/stayOnTheLine";

export default function StayOnTheLine({ language = "en", compact = false }) {
  const { t } = useTranslation();
  const step = stayOnTheLineFor(language);
  return (
    <div
      className={compact ? "rounded-lg border border-border bg-muted p-3 space-y-1" : "rounded-lg border border-border bg-muted p-3 space-y-1.5"}
      data-testid="stay-on-the-line"
      data-language={step.language}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground flex items-center gap-1.5">
        <PhoneCall size={13} aria-hidden="true" /> {t("app.salesCall.stayOnTheLine")}
      </p>
      <p className="text-sm text-foreground break-words">“{step.say}”</p>
      <p className="text-xs text-muted-foreground break-words">{step.then}</p>
      {!compact ? <p className="text-xs text-muted-foreground break-words">{step.watch}</p> : null}
    </div>
  );
}
