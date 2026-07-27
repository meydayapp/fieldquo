// app/app/refer/page.js
"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Gift } from "lucide-react";

const STATUS_LABELS = {
  pending: "Trialing",
  active: "Active — reward earned",
  suspended: "Suspended",
  churned: "Churned",
};

export default function ReferPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/settings/referral")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const referralUrl =
    data?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${data.referralCode}`
      : "";

  function handleCopy() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refer & Earn</h1>
        <p className="text-sm text-gray-500 mt-1">
          Share your link with other business owners — when they become a paying
          customer, you both get rewarded.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Your referral link
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralUrl}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={16} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {data.rewardedCount} reward{data.rewardedCount === 1 ? "" : "s"}{" "}
            earned
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          Rewards are earned once a referred business becomes an active, paying
          customer.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Businesses you've referred
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.referred.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">
              No referrals yet — share your link above to get started.
            </p>
          )}
          {data.referred.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-5 py-3"
            >
              <span className="text-sm font-medium text-gray-900">
                {c.name}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  c.onboardingStatus === "active"
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {STATUS_LABELS[c.onboardingStatus] || c.onboardingStatus}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
