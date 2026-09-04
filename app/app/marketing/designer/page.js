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
import { BadgeCheck, Camera, ImageOff, Loader2, Palette, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { reportResponseError, showError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { AD_RATIOS } from "@/lib/marketing/ratios";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function MarketingDesignerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  // The company's own ordering, not a locale's — these are internal dates on a
  // back-office list, and lib/format/companyDate.js explains why client
  // documents deliberately do NOT share this formatter. The provider's own
  // helper rather than the raw one plus a preference at every call site: one
  // of those is a place to forget the second argument.
  const { formatDate } = useCompanyPreferences();

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

  // ── "Make a post from a job" ────────────────────────────────────────────
  //
  // The jobs are fetched ONCE, on first open, and shared by every campaign
  // card — the list is the same whichever campaign the post lands in, and
  // re-fetching it per card would be the same request three times on one
  // screen. `null` is "not asked yet", `[]` is "asked, and this company has
  // no job with a publishable photo" — two different things, and the second
  // one gets a sentence rather than a spinner that never stops.
  const [jobs, setJobs] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [composing, setComposing] = useState(null);

  const openPicker = useCallback(async (campaignId) => {
    setPickerFor((prev) => (prev === campaignId ? null : campaignId));
    if (jobs !== null || jobsLoading) return;
    setJobsLoading(true);
    try {
      const res = await fetch("/api/marketing/designer/job-post");
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } finally {
      setJobsLoading(false);
    }
  }, [jobs, jobsLoading]);

  async function composeFromJob(campaignId, jobId) {
    setComposing(jobId);
    try {
      const res = await fetch("/api/marketing/designer/job-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, jobId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // The route's own message when it has one — "that job has no photos
        // we can publish yet" says what to do; a generic failure does not.
        showError(data?.message || t("app.marketingDesigner.createError"));
        return;
      }
      const design = await res.json();
      router.push(`/app/marketing/designer/${design.id}`);
    } finally {
      setComposing(null);
    }
  }

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
                  {/* "2 designs", not a bare "2" floating to the right of a
                      campaign name. countedNoun renders the number and the
                      declined word together, so nothing here prints the count
                      separately — French says "0 visuel", Ukrainian has three
                      forms, and neither survives a hand-built "{n} designs". */}
                  <span className="text-xs text-muted-foreground">
                    {t("app.marketingDesigner.designsCount", { value: designs.length })}
                  </span>
                </div>

                {designs.length === 0 ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("app.marketingDesigner.noDesigns")}
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2 mb-3">
                    {designs.map((d) => {
                      // The list route already sends every saved layout's
                      // ratioKey (DESIGN_LIST_SELECT), so the page knows
                      // exactly WHICH formats are done. It used to reduce that
                      // to `.length` and print "3/5" — the server did the
                      // expensive part and the screen threw the answer away,
                      // leaving "which two are missing?" answerable only by
                      // opening the design.
                      const saved = new Set(
                        (d.layouts || []).map((l) => l.ratioKey),
                      );
                      const done = saved.size;
                      return (
                        <div
                          key={d.id}
                          className="flex items-start justify-between gap-2 border border-border rounded-lg px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => router.push(`/app/marketing/designer/${d.id}`)}
                            className="text-left flex-1 min-w-0"
                          >
                            <p className="text-sm font-medium text-foreground truncate">
                              {d.name}
                            </p>
                            {/* Three states, because "changed since it was
                                approved" is not "never approved" — telling
                                somebody the second when the first is true
                                sends them looking for a button they already
                                pressed. See
                                lib/marketing/approvalFingerprint.js. */}
                            <span className="mt-1 flex items-center gap-1 text-xs">
                              {d.approval === "approved" && (
                                <>
                                  <BadgeCheck size={12} className="text-emerald-700 dark:text-emerald-400" />
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    {t("app.marketingDesigner.approval.badgeApproved", "Approved")}
                                  </span>
                                </>
                              )}
                              {d.approval === "stale" && (
                                <>
                                  <TriangleAlert size={12} className="text-amber-700 dark:text-amber-400" />
                                  <span className="text-amber-700 dark:text-amber-400">
                                    {t("app.marketingDesigner.approval.badgeStale", "Re-approve")}
                                  </span>
                                </>
                              )}
                              {d.approval === "not_approved" && (
                                <span className="text-muted-foreground">
                                  {t("app.marketingDesigner.approval.badgeNotApproved", "Not approved")}
                                </span>
                              )}
                            </span>
                            {/* Format names come from AD_RATIOS untranslated,
                                the same way the editor's own ratio switcher
                                and SettingsSidebar render them: "Instagram
                                post" and "TikTok" are the networks' names,
                                not interface copy. */}
                            <span className="mt-1 flex flex-wrap gap-1">
                              {AD_RATIOS.map((r) => (
                                <span
                                  key={r.key}
                                  className={`text-[10px] leading-none px-1.5 py-1 rounded-full border border-border ${
                                    saved.has(r.key)
                                      ? "bg-muted text-foreground"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {r.label}
                                </span>
                              ))}
                            </span>
                            {/* The list is ordered by updatedAt and never
                                showed a date. Which date depends on whether
                                anything has been saved: a design with no
                                layouts has never been edited, so its updatedAt
                                is its createdAt and calling it "edited" would
                                be a small lie on the emptiest row. */}
                            <p className="text-xs text-muted-foreground mt-1">
                              {done === 0 ? (
                                <span className="flex items-center gap-1">
                                  <ImageOff size={11} />{" "}
                                  {t("app.marketingDesigner.ratiosSaved", {
                                    done,
                                    total: AD_RATIOS.length,
                                  })}
                                  {d.createdAt && (
                                    <>
                                      {" · "}
                                      {t("app.marketingDesigner.createdOn", {
                                        date: formatDate(d.createdAt),
                                      })}
                                    </>
                                  )}
                                </span>
                              ) : (
                                <>
                                  {t("app.marketingDesigner.ratiosSaved", {
                                    done,
                                    total: AD_RATIOS.length,
                                  })}
                                  {d.updatedAt && (
                                    <>
                                      {" · "}
                                      {t("app.marketingDesigner.lastEdited", {
                                        date: formatDate(d.updatedAt),
                                      })}
                                    </>
                                  )}
                                </>
                              )}
                            </p>
                          </button>
                          {/* The label was hardcoded English on a page where
                              every other string goes through t(). It now names
                              the design too, so a screen reader working down a
                              grid of five identical bin icons says which one it
                              is on. */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDesign(d.id)}
                            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 p-1 shrink-0"
                            aria-label={`${t("app.action.delete")} — ${d.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Make a post out of work already done ─────────────
                    The photos the crew already took, with the job's own
                    scope of work behind the words. The other button below
                    opens an empty canvas; this one opens a finished post. */}
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => openPicker(c.id)}
                    className="flex items-center gap-2 border border-border text-foreground px-3 py-2.5 rounded-full text-sm font-semibold min-h-[44px]"
                  >
                    <Camera size={14} />
                    {t("app.marketingDesigner.jobPost.open", "Make a post from a job")}
                  </button>

                  {pickerFor === c.id && (
                    <div className="mt-2 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        {t(
                          "app.marketingDesigner.jobPost.hint",
                          "Pick a job. FieldQuo puts its before and after photos side by side, writes the words from that job\u2019s scope of work, and puts your trade and town along the bottom. Nothing is invented \u2014 photos flagged as an issue are never used.",
                        )}
                      </p>

                      {jobsLoading && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 size={12} className="animate-spin" />
                          {t("app.marketingDesigner.jobPost.loading", "Looking through your jobs\u2026")}
                        </p>
                      )}

                      {!jobsLoading && jobs?.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "app.marketingDesigner.jobPost.none",
                            "No job has a photo we can publish yet. Tag a start and a finish shot on a job and it will show up here.",
                          )}
                        </p>
                      )}

                      {!jobsLoading && jobs && jobs.length > 0 && (
                        <ul className="space-y-2">
                          {jobs.map((j) => (
                            <li
                              key={j.id}
                              className="flex items-center gap-3 border border-border rounded-lg p-2"
                            >
                              <span className="flex gap-1 shrink-0">
                                {j.preview.map((url) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={url}
                                    src={url}
                                    alt=""
                                    className="h-12 w-12 rounded object-cover"
                                  />
                                ))}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-foreground truncate">
                                  {j.title}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {j.beforeAfter
                                    ? t("app.marketingDesigner.jobPost.hasPair", "Before and after")
                                    : t("app.marketingDesigner.jobPost.singleOnly", "One photo \u2014 no before/after on this job")}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => composeFromJob(c.id, j.id)}
                                disabled={composing !== null}
                                className="border border-border rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-60 min-h-[44px] shrink-0"
                              >
                                {composing === j.id
                                  ? t("app.marketingDesigner.jobPost.making", "Making\u2026")
                                  : t("app.marketingDesigner.jobPost.make", "Make it")}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

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
