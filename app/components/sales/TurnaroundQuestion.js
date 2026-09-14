// app/components/sales/TurnaroundQuestion.js
//
// The turnaround question on the call screen: how long a homeowner waits for
// a quote today, how often somebody else's got there first, and the one
// contrast the owner wants said against the number. The three sentences come
// from lib/sales/playbook/turnaround.js in the script's language (EN / FR /
// ES) — the same language the AI script on the same card is in — and the
// headings are the rep's own language (nine keys). Drawn beside the script
// in both layouts of CallPlaybook, and when there is no AI script at all:
// the AI script's own three questions are about what the crawler could not
// see, so this one has to stand on its own or it is not asked.
//
// Nothing here records the answer. The number is the prospect's and it goes
// in the rep's notes like everything else they hear; a field that looked like
// it stored it and did not would be the dead control AGENTS.md names first.
"use client";

import { Timer } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { turnaroundFor } from "@/lib/sales/playbook/turnaround";

export default function TurnaroundQuestion({ language = "en", compact = false }) {
  const { t } = useTranslation();
  const beats = turnaroundFor(language);
  return (
    <div
      className={compact ? "rounded-lg border border-border bg-muted p-3 space-y-1" : "rounded-lg border border-border bg-muted p-3 space-y-1.5"}
      data-testid="turnaround-question"
      data-language={beats.language}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground flex items-center gap-1.5">
        <Timer size={13} aria-hidden="true" /> {t("app.salesCall.turnaroundQuestion")}
      </p>
      <p className="text-sm text-foreground break-words">“{beats.discovery}”</p>
      <p className="text-sm text-foreground break-words">“{beats.pain}”</p>
      <p className="text-xs text-muted-foreground break-words pt-1">{t("app.salesCall.turnaroundAnswer")}</p>
      <p className="text-sm text-foreground break-words">“{beats.fit}”</p>
    </div>
  );
}
