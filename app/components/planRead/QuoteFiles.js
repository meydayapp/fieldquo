"use client";

// app/components/planRead/QuoteFiles.js
//
// The quote page's Files card: loads GET /api/quotes/[id]/documents and
// draws QuoteFilesCard. A failed load says so instead of drawing an empty
// card — "no files" and "couldn't load the files" are different statements.

import { useCallback, useEffect, useState } from "react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import QuoteFilesCard from "./QuoteFilesCard";

export default function QuoteFiles({ quoteId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotes/${quoteId}/documents`);
    if (!res.ok) {
      await reportResponseError(res, t("app.planRead.files.loadError", "Couldn't load this quote's files."));
      setData({ chains: [], canUpload: false, failed: true });
      return;
    }
    setData(await res.json());
  }, [quoteId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;
  if (data.failed) {
    return (
      <section className="bg-card border border-border rounded-xl p-4 sm:p-5 text-sm text-muted-foreground">
        {t("app.planRead.files.loadError", "Couldn't load this quote's files.")}
      </section>
    );
  }
  return (
    <QuoteFilesCard
      endpoint={`/api/quotes/${quoteId}/documents`}
      chains={data.chains || []}
      canUpload={Boolean(data.canUpload)}
      onChanged={load}
      note={
        data.jobId
          ? t("app.planRead.files.noteJob", "Drawings, scope sheets, permits and site photos. This quote has a job — new files go straight to its Documents.")
          : undefined
      }
    />
  );
}
