// app/components/layout/FeaturePreviewBanner.js
//
// Says out loud that a screen is an early-access preview.
//
// `preview` exists because "available" and "unavailable" are not the only two
// honest answers: FieldQuo lets a chosen company into something that works but
// is not finished. Rendering it identically to a finished feature would be the
// dishonest half of that — the contractor has no way to know why it behaves
// oddly, and support has no way to know they are on it. So the state is stated,
// on every page the feature owns, rather than hidden in a settings screen.
//
// Client component only because the copy is translated; it holds no state and
// makes no request.
"use client";

import { FlaskConical } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FeaturePreviewBanner() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-start gap-2 px-4 py-2.5 text-sm bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
    >
      <FlaskConical size={15} className="shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold">{t("app.feature.previewTitle")}</span>{" "}
        {t("app.feature.previewBody")}
      </p>
    </div>
  );
}
