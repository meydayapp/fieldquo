// app/components/marketing/EmailCampaignDetail.js
//
// The detail view for an "email" type MarketingCampaign — template + Send,
// as opposed to the pamphlet route/stops workflow in [id]/page.js. Kept as
// its own component so that file doesn't have to interleave two unrelated
// campaign workflows.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Send, Users } from "lucide-react";
import { planRequiredFrom } from "@/lib/signup/planRequired";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function EmailCampaignDetail({ campaign, onSent }) {
  const { t, language } = useTranslation();
  const [subscribedCount, setSubscribedCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/marketing/subscribers")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setSubscribedCount(
          Array.isArray(data) ? data.filter((s) => s.subscribed).length : 0,
        ),
      )
      .catch(() => setSubscribedCount(0));
  }, []);

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      // No plan yet: the shell's prompt says so and links to checkout, so this
      // stops rather than putting the same sentence in a red banner.
      if (planRequiredFrom(res.status, data)) {
        setConfirming(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || t("app.mkEmail.sendError", "Could not send campaign"));
      setConfirming(false);
      onSent?.(data.campaign);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {campaign.template?.name || t("app.mkEmail.noTemplate", "No template selected")}
            </span>
          </div>
          {campaign.template && (
            <Link
              href={`/app/settings/email-templates/${campaign.template.id}`}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {t("app.mkEmail.editTemplate", "Edit template")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users size={14} className="text-muted-foreground" />
          {subscribedCount == null ? (
            t("app.mkEmail.loadingSubscribers", "Loading subscribers…")
          ) : (
            <>
              {t("app.mkEmail.subscribedCount", "{count} subscribed recipients", { count: subscribedCount })} —{" "}
              <Link href="/app/marketing/subscribers" className="underline">
                {t("app.mkEmail.manageList", "manage list")}
              </Link>
            </>
          )}
        </div>

        {campaign.sentAt ? (
          <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-4 py-3">
            {t("app.mkEmail.sentOn", "Sent to {count} subscribers on {when}.", {
              count: campaign.recipientCount ?? 0,
              when: new Date(campaign.sentAt).toLocaleString(language),
            })}
          </div>
        ) : campaign.status === "partial" ? (
          // A previous send didn't reach everyone — a crash, a cold-start DB
          // error, whatever. `campaign.recipientCount` is how many already
          // have the campaign (never re-emailed); "Resume send" only mails
          // whoever's left, via the same MarketingCampaignDelivery-guarded
          // route. sentAt stays unset until this actually finishes, so this
          // state — not "Sent" — is what shows until it does.
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-800">
              {t("app.mkEmail.partial", "Partially sent — {sent} of {total} subscribed recipients have this campaign. The rest haven't been emailed yet.", {
                sent: campaign.recipientCount ?? 0,
                total: subscribedCount ?? campaign.recipientCount ?? 0,
              })}
            </p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {sending ? t("app.mkEmail.sending", "Sending…") : t("app.mkEmail.resumeSend", "Resume send")}
            </button>
          </div>
        ) : confirming ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-800">
              {t("app.mkEmail.confirm", "Send “{name}” to all {count} subscribed recipients right now? This can't be undone.", {
                name: campaign.name,
                count: subscribedCount ?? 0,
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={sending || !subscribedCount}
                className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {sending ? t("app.mkEmail.sending", "Sending…") : t("app.mkEmail.sendNow", "Yes, send now")}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="text-sm text-muted-foreground px-3 py-2"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={!campaign.template || !subscribedCount}
            title={
              !campaign.template
                ? t("app.mkEmail.pickTemplateFirst", "Pick a template first")
                : !subscribedCount
                  ? t("app.mkEmail.noRecipients", "No subscribed recipients yet")
                  : ""
            }
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
          >
            <Send size={14} /> {t("app.mkEmail.sendCampaign", "Send campaign")}
          </button>
        )}
      </div>
    </div>
  );
}
