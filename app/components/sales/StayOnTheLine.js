// app/components/sales/StayOnTheLine.js
//
// The "after a yes" step on the call screen: text the link, stay on the
// line until they are in (signup has taken no card since 2026-09-24). The three sentences come from
// lib/sales/playbook/stayOnTheLine.js in the script's language (EN / FR /
// ES) — the same language the AI script on the same card is in — and the
// heading is the rep's own language (nine keys). Drawn under the close in
// both layouts of CallPlaybook; nothing here is generated, so it is on the
// screen whether or not an AI script exists for the row.
"use client";

import { PhoneCall } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { referralPlantFor, stayOnTheLineFor } from "@/lib/sales/playbook/stayOnTheLine";

/**
 * @param plant  true only when the Reverse Selling playbook is on screen: the
 *               early referral plant is part of that script and of no other,
 *               so every other call draws exactly the three sentences it did.
 */
export default function StayOnTheLine({ language = "en", compact = false, plant = false }) {
  const { t } = useTranslation();
  const step = stayOnTheLineFor(language);
  const seed = plant ? referralPlantFor(language) : null;
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
      {seed ? (
        <div className="border-t border-border pt-1.5 mt-1 space-y-0.5" data-testid="referral-plant" data-language={seed.language}>
          <p className="text-xs font-semibold text-foreground">{t("app.salesCall.referralPlant")}</p>
          <p className="text-sm text-foreground break-words">“{seed.say}”</p>
          {!compact ? <p className="text-xs text-muted-foreground break-words">{seed.why}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
