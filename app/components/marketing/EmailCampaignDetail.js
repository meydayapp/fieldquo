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

export default function EmailCampaignDetail({ campaign, onSent }) {
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
      if (!res.ok) throw new Error(data.error || "Could not send campaign");
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
              {campaign.template?.name || "No template selected"}
            </span>
          </div>
          {campaign.template && (
            <Link
              href={`/app/settings/email-templates/${campaign.template.id}`}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Edit template
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users size={14} className="text-muted-foreground" />
          {subscribedCount == null ? (
            "Loading subscribers…"
          ) : (
            <>
              {subscribedCount} subscribed recipient{subscribedCount === 1 ? "" : "s"} —{" "}
              <Link href="/app/marketing/subscribers" className="underline">
                manage list
              </Link>
            </>
          )}
        </div>

        {campaign.sentAt ? (
          <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-4 py-3">
            Sent to {campaign.recipientCount ?? 0} subscriber
            {campaign.recipientCount === 1 ? "" : "s"} on{" "}
            {new Date(campaign.sentAt).toLocaleString()}.
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
              Partially sent — {campaign.recipientCount ?? 0} of{" "}
              {subscribedCount ?? campaign.recipientCount ?? 0} subscribed recipients have
              this campaign. The rest haven&apos;t been emailed yet.
            </p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {sending ? "Sending…" : "Resume send"}
            </button>
          </div>
        ) : confirming ? (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-800">
              Send &quot;{campaign.name}&quot; to all {subscribedCount ?? 0} subscribed
              recipients right now? This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={sending || !subscribedCount}
                className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {sending ? "Sending…" : "Yes, send now"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="text-sm text-muted-foreground px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={!campaign.template || !subscribedCount}
            title={
              !campaign.template
                ? "Pick a template first"
                : !subscribedCount
                  ? "No subscribed recipients yet"
                  : ""
            }
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
          >
            <Send size={14} /> Send Campaign
          </button>
        )}
      </div>
    </div>
  );
}
