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

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              {campaign.template?.name || "No template selected"}
            </span>
          </div>
          {campaign.template && (
            <Link
              href={`/app/settings/email-templates/${campaign.template.id}`}
              className="text-xs text-gray-500 hover:text-gray-900 underline"
            >
              Edit template
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users size={14} className="text-gray-400" />
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
                className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {sending ? "Sending…" : "Yes, send now"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="text-sm text-gray-600 px-3 py-2"
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
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
          >
            <Send size={14} /> Send Campaign
          </button>
        )}
      </div>
    </div>
  );
}
