// app/components/marketing/CampaignStatus.js
//
// The status chip's colours and the Activate / Pause / Archive / Restore row,
// shared by the campaign list (app/app/marketing/page.js) and the detail page
// ([id]/page.js) so the two draw the same buttons for the same row. Which
// buttons exist is decided in lib/marketing/campaignStatus.js — the same table
// the PATCH route checks the request against.
"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { campaignActions } from "@/lib/marketing/campaignStatus";

// The chip reads what is WRITTEN. `active` and `paused` are set by the
// Activate / Pause buttons below (lib/marketing/campaignStatus.js);
// `completed` and `partial` only ever by an email send. Before the buttons
// existed nothing wrote `active`, so every pamphlet campaign said "draft"
// for its whole life.
export const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  paused: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  completed: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  // An email send that didn't reach every subscriber yet — see
  // app/api/marketing/campaigns/[id]/send/route.js. Amber rather than the
  // "completed" blue: this campaign is not done, and the card should read
  // that way at a glance, not just on the detail page.
  partial: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  archived: "bg-muted text-muted-foreground line-through decoration-muted-foreground/50",
};

/**
 * The Activate / Pause / Archive / Restore row under a campaign card, and on
 * the detail page. Sends only the status; the server re-checks the transition
 * against the same table that produced the buttons.
 */
export function CampaignStatusActions({ campaign, onChanged, onError, size = "xs" }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const actions = campaignActions(campaign);
  if (!actions.length) return null;

  async function apply(a) {
    setBusy(a.action);
    onError?.("");
    try {
      const updated = await fetchJson(`/api/marketing/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: a.to }),
      });
      setConfirmArchive(false);
      onChanged?.(updated);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy("");
    }
  }

  const pad = size === "sm" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) =>
        a.action === "archive" && confirmArchive ? (
          <span key={a.action} className={`inline-flex items-center gap-1.5 ${size === "sm" ? "text-sm" : "text-xs"} text-muted-foreground`}>
            {t("app.marketing.archiveConfirm", "Archive? It leaves the list; nothing is deleted.")}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => apply(a)}
              className="font-semibold text-foreground underline disabled:opacity-60"
            >
              {t("app.marketing.action.archiveYes", "Yes, archive")}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setConfirmArchive(false)}
              className="underline disabled:opacity-60"
            >
              {t("app.action.cancel", "Cancel")}
            </button>
          </span>
        ) : (
          <button
            key={a.action}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => (a.action === "archive" ? setConfirmArchive(true) : apply(a))}
            className={`rounded-full border border-border font-semibold disabled:opacity-60 ${pad} ${
              a.action === "archive" || a.action === "restore"
                ? "text-muted-foreground hover:text-foreground"
                : "text-foreground hover:bg-muted"
            }`}
          >
            {busy === a.action ? "…" : t(a.labelKey)}
          </button>
        ),
      )}
    </div>
  );
}

