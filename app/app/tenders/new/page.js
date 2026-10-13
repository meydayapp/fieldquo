"use client";

// app/app/tenders/new/page.js
//
// Adding a tender. The form needs to know what this member may see (contact
// and money boxes are drawn only for those allowed) and the company's zone,
// so it waits for GET /api/tenders — the same answer the list uses — rather
// than drawing boxes the server would then refuse.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import TenderForm from "../TenderForm";

export default function NewTenderPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/tenders");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/app/tenders" className="inline-flex items-center gap-1 text-sm text-muted-foreground min-h-[44px]">
        <ArrowLeft size={14} /> {t("app.tenders.back", "Tenders")}
      </Link>
      <ListState loading={loading} errorKey={errorKey} isEmpty={false} onRetry={load}>
        {data && !data.capabilities?.canEdit ? (
          <p className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
            {t("app.tenders.noEditAccess", "Your access level for Quotes doesn't allow you to add tenders.")}
          </p>
        ) : data ? (
          <TenderForm
            mode="create"
            capabilities={data.capabilities}
            companyTimeZone={data.companyTimeZone}
            onSaved={(body) => router.push(`/app/tenders/${body.tender.id}`)}
            onCancel={() => router.push("/app/tenders")}
          />
        ) : null}
      </ListState>
    </div>
  );
}
