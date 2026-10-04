"use client";

// app/app/timesheets/page.js
//
// /app/timesheets is an alias: Timesheets lives at /app/settings/team/
// timesheets. lib/nav/timesheetsAlias.js says why it is an alias rather than
// a move, and where somebody who cannot approve hours is sent instead.
//
// A client redirect because the rule reads the caller's role from
// PermissionProvider, the same source the rail and the timesheets screen use;
// `replace`, so Back does not land on this bounce again.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { timesheetsAliasTarget } from "@/lib/nav/timesheetsAlias";

export default function TimesheetsAliasPage() {
  const router = useRouter();
  const caller = usePermissions();
  const { t } = useTranslation();
  const target = timesheetsAliasTarget(caller);

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <div className="grid min-h-[30vh] place-items-center text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}
      </span>
    </div>
  );
}
