// app/components/settings/TrackingLinkBuilder.js
//
// "The link Facebook needs": the public link to a funnel or the instant
// estimate with utm_* filled in, plus the URL-parameters string Meta Ads
// Manager wants (lib/tracking/landing.js explains both). Whatever the visitor
// arrives with is read by the page, cleaned by the server and shown on the
// lead and in Leads › Visits & unfinished — so every field here ends
// somewhere a person reads.
//
// Nothing is saved: a link is built in the browser from what is typed, and
// the contractor pastes it where the ad lives. There is no "Save" to press
// and nothing that could appear to save.
"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TRACKING_LINK_DEFAULTS, buildTrackingLink, metaUrlParameters, tagValue } from "@/lib/tracking/landing";

const SOURCES = ["facebook", "instagram", "google", "tiktok", "email", "flyer"];

function CopyButton({ text, label }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        );
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 shrink-0"
    >
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? t("app.action.copied") : label}
    </button>
  );
}

export default function TrackingLinkBuilder({ baseUrl, className = "" }) {
  const { t } = useTranslation();
  const [tags, setTags] = useState({ ...TRACKING_LINK_DEFAULTS });
  const link = useMemo(() => (baseUrl ? buildTrackingLink(baseUrl, tags) : null), [baseUrl, tags]);
  const metaParams = useMemo(() => metaUrlParameters(tags), [tags]);
  const set = (k) => (e) => setTags((p) => ({ ...p, [k]: e.target.value }));

  if (!baseUrl) return null;

  const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t("app.tracking.linkTitle")}</h3>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{t("app.tracking.linkHint")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <label className="text-xs text-muted-foreground">
          {t("app.tracking.source")}
          <select value={tags.source} onChange={set("source")} className={`${input} mt-1`}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.tracking.medium")}
          <input value={tags.medium} onChange={set("medium")} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.tracking.campaign")}
          <input
            value={tags.campaign}
            onChange={set("campaign")}
            placeholder={t("app.tracking.campaignPlaceholder")}
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.tracking.content")}
          <input value={tags.content} onChange={set("content")} className={`${input} mt-1`} />
        </label>
      </div>
      {/* Said, because the link changes what they typed: "Spring Roofs!"
          goes out as spring_roofs, and a person comparing the report with
          what they typed should not have to guess why. */}
      {tags.campaign && tagValue(tags.campaign) !== tags.campaign && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {t("app.tracking.campaignAs", { value: tagValue(tags.campaign) || "—" })}
        </p>
      )}

      <div className="mt-3">
        <div className="text-xs font-medium text-foreground mb-1">{t("app.tracking.linkLabel")}</div>
        <div className="flex items-start gap-2">
          <code className="flex-1 min-w-0 break-all rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">{link}</code>
          <CopyButton text={link} label={t("app.funnels.copyLink")} />
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="text-xs font-medium text-foreground">{t("app.tracking.metaParamsTitle")}</div>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">{t("app.tracking.metaParamsHint")}</p>
        <div className="flex items-start gap-2 mb-2">
          <code className="flex-1 min-w-0 break-all rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">{baseUrl}</code>
          <CopyButton text={baseUrl} label={t("app.funnels.copyLink")} />
        </div>
        <div className="flex items-start gap-2">
          <code className="flex-1 min-w-0 break-all rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">{metaParams}</code>
          <CopyButton text={metaParams} label={t("app.tracking.copy")} />
        </div>
      </div>
    </div>
  );
}
