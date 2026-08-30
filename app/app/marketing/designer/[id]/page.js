"use client";

// app/app/marketing/designer/[id]/page.js
//
// Loads one MarketingDesign and hands it to CampaignEditor.js — the tab bar,
// the save wiring, and "download all" all live there, behind
// CampaignEditorLoader's ssr:false boundary, because that component imports
// "fabric" directly and this ordinary page is server-rendered. See
// CampaignEditor.js's own module doc for the full reasoning (a dynamic
// `import("fabric")` tried from here failed the real build with
// "Can't resolve 'jsdom'" — fabric's UMD wrapper has a Node branch this repo
// deliberately doesn't install jsdom for).
//
// This file's only job is the network round trip and the three states that
// come with one: loading, failed, loaded — see lib/loadState.js's header for
// why those three are kept mutually exclusive rather than layered.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import CampaignEditorLoader from "@/app/components/designer/CampaignEditorLoader";

export default function CampaignDesignEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams();

  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/marketing/designer/designs/${id}`);
      if (cancelled) return;
      if (!res.ok) {
        await reportResponseError(res);
        setLoadError(res.status === 404 ? "app.load.notFound" : "app.load.generic");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setDesign(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-full grid place-items-center text-sm text-muted-foreground">…</div>
    );
  }

  if (loadError || !design) {
    return (
      <div className="h-screen w-full grid place-items-center text-center p-6">
        <div>
          <p className="text-sm text-muted-foreground">{t(loadError || "app.load.generic")}</p>
          <Link href="/app/marketing/designer" className="text-sm underline mt-2 inline-block">
            {t("app.marketingDesigner.backToDesigns")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CampaignEditorLoader
      design={design}
      onBack={() => router.push("/app/marketing/designer")}
    />
  );
}
