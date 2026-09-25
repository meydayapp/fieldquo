// app/app/settings/work-email/page.js
//
// Settings → Work email: connect the mailbox where work email arrives, so
// every email exchanged with a client is filed into that client's history
// (lib/mailbox/). A shell over app/components/mailbox/WorkEmailSettings.js,
// the same split Settings → My calendar uses.
//
// Every member sees this row (lib/permissions/settingsAccess.js): anyone may
// connect their OWN work mailbox. The company mailbox and the "send client
// email from it" switch are owner/admin-only, enforced by the routes; the
// component draws them only for an owner or admin.
"use client";

import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";
import WorkEmailSettings from "@/app/components/mailbox/WorkEmailSettings";

export default function WorkEmailSettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Inbox size={20} className="text-muted-foreground" />
          {t("app.workEmail.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.workEmail.subtitle")}</p>
        <BackToHome />
      </div>
      {/* useSearchParams inside needs a boundary for the static shell. */}
      <Suspense fallback={null}>
        <WorkEmailSettings />
      </Suspense>
    </div>
  );
}
