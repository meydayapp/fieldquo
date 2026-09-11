"use client";

// app/app/subcontractors/new/page.js
//
// Add a subcontractor — a COMPANY hired per job, not a person on the roster.
// Gated in the browser on the same `user:manage` the POST requires, so a
// bookmark cannot open a form whose save answers 403.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { canWriteSubcontractors, SUBCONTRACTOR_PERMISSION } from "@/lib/subcontractors/access";
import SubcontractorForm from "@/app/components/subcontractors/SubcontractorForm";

export default function NewSubcontractorPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const caller = usePermissions();

  // A missing provider shows the form (the API is the gate); a present one
  // that says no shows the panel. Same posture as lib/permissions/nav.js.
  if (caller?.role && !canWriteSubcontractors(caller)) return <NoAccessPanel capability={SUBCONTRACTOR_PERMISSION} />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/app/subcontractors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground min-h-[44px]">
        <ArrowLeft size={14} /> {t("app.subcontractors.backToList", "All subcontractors")}
      </Link>
      <SubcontractorForm
        mode="create"
        onSaved={(body) => router.push(`/app/subcontractors/${body.subcontractor.id}`)}
        onCancel={() => router.push("/app/subcontractors")}
      />
    </div>
  );
}
