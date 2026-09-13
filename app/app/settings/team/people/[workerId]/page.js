"use client";

// app/app/settings/team/people/[workerId]/page.js
//
// One person's HR file: their onboarding checklist and their documents (the
// performance notes follow in the next commit). The roster (Manage Team) links here; the compliance
// screen's counts link here. Managers only — `user:manage`, the same gate
// every /api/hr route enforces again server-side.
//
// `params` is a Promise in Next 16 — unwrapped with React.use().
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import OnboardingChecklist from "@/app/components/hr/OnboardingChecklist";
import WorkerDocumentsPanel from "@/app/components/hr/WorkerDocumentsPanel";

export default function PersonFilePage({ params }) {
  const { workerId } = use(params);
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return <PersonFile workerId={workerId} />;
}

function PersonFile({ workerId }) {
  const { t } = useTranslation();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/workers/${workerId}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setWorker(result.data);
    setLoading(false);
  }, [workerId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4" data-hr-person-file>
      <Link href="/app/settings/team" className="inline-flex items-center gap-1 text-sm text-muted-foreground min-h-[44px]">
        <ArrowLeft size={14} /> {t("app.setTeam.title")}
      </Link>
      <ListState loading={loading} errorKey={errorKey} isEmpty={false} onRetry={load}>
        {worker && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <User size={22} /> {worker.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {[worker.title, worker.email, worker.active === false ? t("app.hr.person.inactive") : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <OnboardingChecklist mode="manager" workerId={workerId} />
            <WorkerDocumentsPanel mode="manager" workerId={workerId} />
          </>
        )}
      </ListState>
    </div>
  );
}
