// app/app/callbacks/page.js
//
// The assignee's view of the past-client callback list: the clients this
// week's rotation handed them, and the outcome of each call. Owners and
// admins see every list here too; the rule itself is edited under
// Settings → Follow-ups → Past clients.
"use client";

import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import CallbackListCard from "@/app/components/callbacks/CallbackListCard";

export default function CallbacksPage() {
  const { t } = useTranslation();
  const perms = usePermissions();
  const admin = perms?.role === "owner" || perms?.role === "admin";
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.callbacks.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.callbacks.subtitle")}
          {admin && (
            <>
              {" "}
              <Link href="/app/settings/follow-ups/past-clients" className="underline">{t("app.callbacks.editRule")}</Link>
            </>
          )}
        </p>
      </div>
      <CallbackListCard />
    </div>
  );
}
