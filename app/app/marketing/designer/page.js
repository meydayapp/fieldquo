"use client";

// app/app/marketing/designer/page.js
//
// The Marketing Designer index: ad campaigns down the left, each campaign's
// saved designs alongside it. A design belongs to exactly one campaign
// (MarketingDesign.campaignId — see prisma/schema.prisma), so this page's job
// is picking or creating the campaign before picking or creating the design,
// same order the data model enforces.
//
// Reuses GET/POST /api/marketing/campaigns — the same list the pamphlet/email
// hub at /app/marketing renders — rather than inventing a parallel "ad
// campaign" concept. A campaign created here shows up there too, and vice
// versa; they are the same row.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Plus, Trash2, ImageOff } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { reportResponseError, showError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { AD_RATIOS } from "@/lib/marketing/ratios";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function MarketingDesignerPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // null = not known yet (lib/loadState.js's convention) — see this file's
  // own load() for why both requests share one error state instead of
  // treating a failed designs fetch as "this campaign has no designs".
  const [campaigns, setCampaigns] = useState(null);
  const [designsByCampaign, setDesignsByCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [newDesignName, setNewDesignName] = useState({});
  const [creatingDesignFor, setCreatingDesignFor] = useState(null);

  const load = useCallback(async () => {
    setErrorKey("");
    // Both requests go through fetchList — network failure, a non-JSON body
    // and a non-2xx status all become one honest errorKey instead of three
    // different failure shapes to handle by hand. Either one failing blanks
    // BOTH lists: a design without its campaign's name, or a campaign whose
    // design count is silently wrong, is worse than one clear error banner.
    const [campaignsResult, designsResult] = await Promise.all([
      fetchList("/api/marketing/campaigns"),
      fetchList("/api/marketing/designer/designs"),
    ]);

    if (!campaignsResult.ok) {
      if (campaignsResult.aborted) return;
      setErrorKey(campaignsResult.errorKey);
      setCampaigns(null);
      setDesignsByCampaign(null);
      return;
    }
    if (!designsResult.ok) {
      if (designsResult.aborted) return;
      setErrorKey(designsResult.errorKey);
      setCampaigns(null);
      setDesignsByCampaign(null);
      return;
    }

    const campaignList = Array.isArray(campaignsResult.data) ? campaignsResult.data : [];
    const designs = Array.isArray(designsResult.data?.designs) ? designsResult.data.designs : [];

    const grouped = {};
    for (const d of designs) {
      (grouped[d.campaignId] ||= []).push(d);
    }
    setCampaigns(campaignList);
    setDesignsByCampaign(grouped);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleCreateCampaign(e) {
    e.preventDefault();
    const name = newCampaignName.trim();
    if (!name) {
      showError(t("app.marketingDesigner.nameRequired"));
      return;
    }
    setCreatingCampaign(true);
    try {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // meta_ads: the closest existing campaign type to "a paid-social ad
        // campaign", and the type the campaigns hub already treats as a
        // plain record card (no pamphlet route, no email send) — exactly
        // right for a container that exists to hold designs.
        body: JSON.stringify({ name, type: "meta_ads" }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.marketingDesigner.createError"));
        return;
      }
      setNewCampaignName("");
      await load();
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handleCreateDesign(campaignId) {
    const name = (newDesignName[campaignId] || "").trim();
    if (!name) {
      showError(t("app.marketingDesigner.nameRequired"));
      return;
    }
    setCreatingDesignFor(campaignId);
    try {
      const res = await fetch("/api/marketing/designer/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, campaignId }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.marketingDesigner.createError"));
        return;
      }
      const design = await res.json();
      router.push(`/app/marketing/designer/${design.id}`);
    } finally {
      setCreatingDesignFor(null);
    }
  }

  async function handleDeleteDesign(designId) {
    if (!window.confirm(t("app.marketingDesigner.deleteConfirm"))) return;
    const res = await fetch(`/api/marketing/designer/designs/${designId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await reportResponseError(res);
      return;
    }
    await load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Palette size={22} /> {t("app.marketingDesigner.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("app.marketingDesigner.subtitle")}
        </p>
      </div>

      <form
        onSubmit={handleCreateCampaign}
        data-tour="designer-new-campaign"
        className="flex items-center gap-2 bg-card border border-border rounded-xl p-3"
      >
        <input
          className={inputClass}
          value={newCampaignName}
          onChange={(e) => setNewCampaignName(e.target.value)}
          placeholder={t("app.marketingDesigner.campaignNamePlaceholder")}
        />
        <button
          type="submit"
          disabled={creatingCampaign}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-60"
        >
          <Plus size={14} /> {t("app.marketingDesigner.newCampaign")}
        </button>
      </form>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={(campaigns ?? []).length === 0}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Palette size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("app.marketingDesigner.empty")}
            </p>
          </div>
        }
      >
        <div className="space-y-4">
          {(campaigns ?? []).map((c) => {
            const designs = designsByCampaign?.[c.id] || [];
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="font-semibold text-foreground">{c.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {designs.length}
                  </span>
                </div>

                {designs.length === 0 ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("app.marketingDesigner.noDesigns")}
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    {designs.map((d) => {
                      const done = (d.layouts || []).length;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => router.push(`/app/marketing/designer/${d.id}`)}
                            className="text-left flex-1 min-w-0"
                          >
                            <p className="text-sm font-medium text-foreground truncate">
                              {d.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {done === 0 ? (
                                <span className="flex items-center gap-1">
                                  <ImageOff size={11} />{" "}
                                  {t("app.marketingDesigner.ratiosSaved", {
                                    done,
                                    total: AD_RATIOS.length,
                                  })}
                                </span>
                              ) : (
                                t("app.marketingDesigner.ratiosSaved", {
                                  done,
                                  total: AD_RATIOS.length,
                                })
                              )}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDesign(d.id)}
                            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 p-1"
                            aria-label="Delete design"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={newDesignName[c.id] || ""}
                    onChange={(e) =>
                      setNewDesignName((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    placeholder={t("app.marketingDesigner.designNamePlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateDesign(c.id)}
                    disabled={creatingDesignFor === c.id}
                    className="flex items-center gap-2 border border-border text-foreground px-3 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap disabled:opacity-60"
                  >
                    <Plus size={14} /> {t("app.marketingDesigner.newDesign")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </ListState>
    </div>
  );
}
