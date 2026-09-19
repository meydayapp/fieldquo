// app/app/settings/services/PrepGuideCompanyCard.js
//
// The company-wide half of the preparation guide: WHEN it goes out, and the
// documents that ride every guide. The lead-day setting saves on change
// through its own route (app/api/settings/prep-guide) rather than with the
// page's Save — it is one integer with an immediate effect on tomorrow's
// cron, and a person who changes it and forgets to scroll down to Save
// would believe it had taken.
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import ServiceDocuments from "./ServiceDocuments";

export default function PrepGuideCompanyCard({ documents, onDocumentsChange, canEdit }) {
  const { t } = useTranslation();
  const [leadDays, setLeadDays] = useState(null);
  const [max, setMax] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchJson("/api/settings/prep-guide")
      .then((d) => {
        if (!alive) return;
        setLeadDays(d.leadDays);
        setMax(d.maxLeadDays || 30);
      })
      .catch((err) => showError(errorText(t, err)));
    return () => {
      alive = false;
    };
  }, [t]);

  async function save(next) {
    setSaving(true);
    try {
      const d = await fetchJson("/api/settings/prep-guide", { method: "PATCH", body: { leadDays: next } });
      setLeadDays(d.leadDays);
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{t("app.prepGuide.companyTitle", "Client preparation guides")}</p>
        <p className="text-xs text-muted-foreground">
          {t(
            "app.prepGuide.companyIntro",
            "Every job with a start date and a client email gets a preparation guide by email: what to clear, move and protect before the crew arrives, in the client's language, with the process steps from your quote wording. Customise it per service below.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{t("app.prepGuide.leadBefore", "Sent")}</span>
        <input
          type="number"
          min={0}
          max={max}
          value={leadDays ?? ""}
          disabled={!canEdit || leadDays === null || saving}
          onChange={(e) => setLeadDays(e.target.value === "" ? "" : Number(e.target.value))}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) save(n);
          }}
          className="w-16 border border-border rounded px-2 py-1 text-sm bg-background"
          aria-label={t("app.prepGuide.leadDaysLabel", "Days before the start date")}
        />
        <span>{t("app.prepGuide.leadAfter", "days before the start date; 0 = the morning of.")}</span>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.docs.companyHeading", "Technical documents on every guide")}</p>
        <ServiceDocuments categoryId={null} documents={documents} onChange={onDocumentsChange} canEdit={canEdit} />
      </div>
    </div>
  );
}
