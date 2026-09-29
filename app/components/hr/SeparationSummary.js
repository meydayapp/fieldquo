"use client";

// app/components/hr/SeparationSummary.js
//
// The top of an ended worker's HR file: how their employment ended — the
// kind, the last day, the rehire answer, who recorded it, and the
// explanation in that person's words. The same facts are further down the
// timeline as a "separation" note; this is the answer to "what happened to
// this employee?" without scrolling for it.
//
// Rendered only for an inactive worker, and only says something when a
// separation is on file (GET /api/workers/[id]/separation returns null
// otherwise — somebody switched off with the bare checkbox has no reason to
// show, and nothing is invented in its place). Managers only: the route sits
// behind the same HR gate as every note in the file.

import { useCallback, useEffect, useState } from "react";
import { UserX } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { separationTypeKey } from "@/lib/team/separation";
import { formatCompanyDateOnly } from "@/lib/format/companyDate";

export default function SeparationSummary({ workerId }) {
  const { t } = useTranslation();
  const { formatDate, dateFormat } = useCompanyPreferences();
  const [separation, setSeparation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/workers/${workerId}/separation`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setSeparation(result.data?.separation || null);
    setLoading(false);
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  // Nothing on file is not an error and not an empty card — it is no card.
  if (!loading && !errorKey && !separation) return null;

  const rehire =
    separation?.rehireEligible === true
      ? t("app.separation.rehireYes")
      : separation?.rehireEligible === false
        ? t("app.separation.rehireNo")
        : t("app.separation.rehireUnset");

  return (
    <section
      className="bg-card border border-red-200 dark:border-red-900 rounded-xl p-5"
      data-hr-separation
    >
      <ListState loading={loading} errorKey={errorKey} isEmpty={false} onRetry={load}>
        {separation && (
          <>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <UserX size={16} /> {t("app.separation.summaryTitle")}
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("app.separation.typeLabel")}</dt>
                <dd className="text-foreground font-medium">{t(separationTypeKey(separation.type))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("app.separation.lastDay")}</dt>
                {/* A calendar day, read with the UTC getters like hiredOn. */}
                <dd className="text-foreground">{formatCompanyDateOnly(separation.lastDay, dateFormat)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("app.separation.rehire")}</dt>
                <dd className="text-foreground">{rehire}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("app.separation.summaryRecordedBy")}</dt>
                <dd className="text-foreground">
                  {[separation.recordedBy, separation.recordedAt ? formatDate(separation.recordedAt) : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
            </dl>
            {separation.explanation && (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground">{t("app.separation.summaryExplanation")}</div>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{separation.explanation}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">{t("app.separation.summaryPrivate")}</p>
          </>
        )}
      </ListState>
    </section>
  );
}
