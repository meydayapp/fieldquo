// app/components/settings/TrackingLinkBuilder.js
//
// "The link Facebook needs", for any of the company's pages an ad can open:
//
//   · for a Meta ad — the page's plain link (Ads Manager's Website URL), the
//     URL-parameters string (lib/tracking/adParams.js META_URL_PARAMETERS:
//     campaign / ad set / ad names and ids, placement, site_source_name), and
//     the two joined into one link for a place that has no separate
//     parameters box; plus how to paste them, and what is and isn't sent;
//   · for anything else (a flyer, an email, a post) — the link with utm_*
//     filled in from what the contractor types, as before.
//
// Whatever the visitor arrives with is read by the page, cleaned by the
// server and shown on the lead and in Leads › Visits & unfinished — so every
// field here ends somewhere a person reads.
//
// Nothing is saved: a link is built in the browser from what is typed, and
// the contractor pastes it where the ad lives. There is no "Save" to press
// and nothing that could appear to save. A copy that the browser refuses
// (navigator.clipboard is missing on plain http and can be denied) says so
// and selects the text for a manual copy, rather than flashing "Copied".
//
// `landings` ([{ key, label, url }]) offers a choice of page; without it the
// builder is for the one `baseUrl` (the funnel builder's own funnel).
"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TRACKING_LINK_DEFAULTS, buildTrackingLink, metaUrlParameters, tagValue } from "@/lib/tracking/landing";
import { META_URL_PARAMETERS_DOC, withMetaParameters } from "@/lib/tracking/adParams";

const SOURCES = ["facebook", "instagram", "google", "tiktok", "email", "flyer"];

/** A value to copy, its button, and an honest result either way. */
function CopyField({ text, label = null, copyLabel }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [state, setState] = useState("idle"); // idle | copied | failed

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 1500);
    } catch {
      setState("failed");
      // Selected, so Ctrl/⌘+C works on the next keystroke.
      try {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch {
        /* the sentence below still says what to do */
      }
    }
  }

  return (
    <div>
      {label && <div className="text-xs font-medium text-foreground mb-1">{label}</div>}
      <div className="flex items-start gap-2">
        <code ref={ref} className="flex-1 min-w-0 break-all rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground select-all">
          {text}
        </code>
        <button
          type="button"
          disabled={!text}
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 shrink-0"
        >
          {state === "copied" ? <Check size={13} /> : <Copy size={13} />} {state === "copied" ? t("app.action.copied") : copyLabel}
        </button>
      </div>
      {state === "failed" && (
        <p role="alert" className="text-[11px] text-red-700 dark:text-red-400 mt-1">
          {t("app.adLinks.copyFailed")}
        </p>
      )}
    </div>
  );
}

export default function TrackingLinkBuilder({ baseUrl: fixedUrl = null, landings = null, className = "" }) {
  const { t } = useTranslation();
  const options = Array.isArray(landings) ? landings.filter((l) => l && l.url) : [];
  const [pick, setPick] = useState(null);
  const chosen = options.find((o) => o.key === pick) || options[0] || null;
  const baseUrl = chosen ? chosen.url : fixedUrl;

  const [tags, setTags] = useState({ ...TRACKING_LINK_DEFAULTS });
  const link = useMemo(() => (baseUrl ? buildTrackingLink(baseUrl, tags) : null), [baseUrl, tags]);
  const metaParams = metaUrlParameters();
  const fullMetaLink = useMemo(() => (baseUrl ? withMetaParameters(baseUrl) : null), [baseUrl]);
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

      {options.length > 0 && (
        <label className="block text-xs text-muted-foreground mt-3">
          {t("app.adLinks.pageLabel")}
          <select value={chosen?.key || ""} onChange={(e) => setPick(e.target.value)} className={`${input} mt-1`}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="block text-[11px] mt-1">{t("app.adLinks.pageHint")}</span>
        </label>
      )}

      {/* ── For a Meta ad ───────────────────────────────────────────────── */}
      <div className="mt-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-foreground">{t("app.tracking.metaParamsTitle")}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("app.tracking.metaParamsHint")}</p>
        </div>
        <CopyField text={baseUrl} label={t("app.adLinks.websiteUrlLabel")} copyLabel={t("app.funnels.copyLink")} />
        <CopyField text={metaParams} label={t("app.adLinks.paramsLabel")} copyLabel={t("app.tracking.copy")} />
        <div>
          <CopyField text={fullMetaLink} label={t("app.adLinks.fullLabel")} copyLabel={t("app.funnels.copyLink")} />
          <p className="text-[11px] text-muted-foreground mt-1">{t("app.adLinks.fullHint")}</p>
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <div className="text-xs font-semibold text-foreground">{t("app.adLinks.howTitle")}</div>
          <ol className="list-decimal pl-4 mt-1 space-y-1 text-[11px] text-muted-foreground">
            <li>{t("app.adLinks.how1")}</li>
            <li>{t("app.adLinks.how2")}</li>
            <li>{t("app.adLinks.how3")}</li>
            <li>{t("app.adLinks.how4")}</li>
          </ol>
          <a
            href={META_URL_PARAMETERS_DOC}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-foreground underline"
          >
            <ExternalLink size={11} /> {t("app.adLinks.docLink")}
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("app.adLinks.whatIsSent")}</p>
      </div>

      {/* ── For anything else ───────────────────────────────────────────── */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-semibold text-foreground">{t("app.adLinks.otherTitle")}</div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{t("app.adLinks.otherHint")}</p>
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
          <CopyField text={link} label={t("app.tracking.linkLabel")} copyLabel={t("app.funnels.copyLink")} />
        </div>
      </div>
    </div>
  );
}
