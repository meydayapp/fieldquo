// app/components/documents/ClientPoChip.js
//
// "PO 4471" beside a quote, job or invoice number in the lists — the
// reference a property manager quotes when they call about a job. Nothing at
// all when the row has no PO: an empty chip is not information. The lists'
// search boxes match the same value (lib/documents/clientPo.js
// matchesClientPo).
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { normaliseClientPo } from "@/lib/documents/clientPo";

export default function ClientPoChip({ value }) {
  const { t } = useTranslation();
  const po = normaliseClientPo(value);
  if (!po) return null;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full shrink-0 border border-border text-muted-foreground tabular-nums max-w-[12rem] truncate"
      title={po}
      data-client-po-chip
    >
      {t("app.clientPo.chip", { po })}
    </span>
  );
}
