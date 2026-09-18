// app/components/sales/RecordingDisclosure.js
//
// "This call may be recorded." at the top of every call screen, in the
// script's language — the sentence the rep says first. The call IS recorded
// (lib/sales/calls/recording.js) and the rep is the disclosure; a machine
// announcing it would delay the ring and get hung up on. Drawn once, above
// the script, whichever layout and whether or not an AI script exists —
// lib/sales/playbook/recordingDisclosure.js has the reasoning and the
// three languages, with English as the fallback that says so.
"use client";

import { Disc } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { recordingDisclosureFor } from "@/lib/sales/playbook/recordingDisclosure";

export default function RecordingDisclosure({ language = "en" }) {
  const { t } = useTranslation();
  const line = recordingDisclosureFor(language);
  return (
    <div
      className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 space-y-1"
      data-testid="recording-disclosure"
      data-language={line.language}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-900 dark:text-red-100 flex items-center gap-1.5">
        <Disc size={13} aria-hidden="true" /> {t("app.salesCall.recordingDisclosureHeading")}
      </p>
      <p className="text-base text-foreground break-words">“{line.text}”</p>
      <p className="text-xs text-red-900/80 dark:text-red-100/80 break-words">{t("app.salesCall.recordingDisclosureWhy")}</p>
    </div>
  );
}
