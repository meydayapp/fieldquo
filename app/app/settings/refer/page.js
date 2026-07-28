// app/app/settings/refer/page.js
//
// Refer & Earn — send an invite, watch it convert, see what you've earned.
//
// The previous version showed a /signup?ref=CODE link and a list of referred
// companies. Both were fiction: nothing anywhere read the `ref` parameter, so
// referredByCode was never written and the list was permanently empty.
//
// The distinction this page now makes carefully: signing up earns the NEW
// company their three months, but earns the referrer nothing until that
// company actually pays. Blurring that produces exactly one support
// conversation — "I referred three people, where are my nine months?"
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Check,
  Gift,
  Mail,
  MessageSquare,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function ReferPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [channel, setChannel] = useState("email");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/referral"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSent("");
    try {
      const res = await fetchJson("/api/settings/referral/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, contact, name }),
      });
      setSent(`Invite sent to ${res.to}.`);
      setContact("");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(data.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading)
    return (
      <div className="max-w-2xl animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );

  if (!data)
    return (
      <div className="max-w-lg bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        {error || "Couldn't load your referral details."}
      </div>
    );

  const months = data.rewardMonths || 3;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refer &amp; Earn</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send another business owner your link. They get {months} months free
          when they sign up — and you get {months} months free once they become
          a paying customer.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Your link
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={data.referralUrl || ""}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
          />
          <button
            onClick={copy}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {/* The link is your company name on purpose — it survives being read
            down a phone or printed on a van. */}
        <p className="text-xs text-gray-400 mt-2">
          Short enough to say out loud. Put it on a business card, an invoice
          footer, or a van.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Send an invite</h2>

        <form onSubmit={invite} className="space-y-3">
          <div className="flex gap-2">
            {[
              { key: "email", label: "Email", icon: Mail },
              { key: "sms", label: "Text", icon: MessageSquare },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setChannel(c.key);
                    setContact("");
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                    channel === c.key
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  <Icon size={13} /> {c.label}
                </button>
              );
            })}
          </div>

          {/* Required field first and explicitly labelled. These were two
              identical unlabelled boxes with the OPTIONAL one on top, so it
              was easy to type an email into the name field and then find the
              send button inexplicably greyed out. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {channel === "email" ? "Their email" : "Their mobile number"}
              </label>
              <input
                // Remounts when the channel changes. Swapping `type` on a live
                // input can leave the browser's value and React's state out of
                // step, which shows up as a field that looks filled but reads
                // as empty.
                key={channel}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                type={channel === "email" ? "email" : "tel"}
                placeholder={
                  channel === "email"
                    ? "them@theircompany.com"
                    : "(416) 555-0142"
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Their name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dave"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={sending || !contact.trim()}
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              Send invite
            </button>
            {/* Say why it's greyed out rather than leaving someone to guess. */}
            {!contact.trim() && !sending && (
              <span className="text-xs text-gray-400">
                Enter their {channel === "email" ? "email" : "number"} to send.
              </span>
            )}
          </div>

          {sent && <p className="text-sm text-green-700">{sent}</p>}
        </form>

        {/* Stated plainly rather than discovered at the limit. The cap exists
            so this can't be used as a bulk channel. */}
        <p className="text-xs text-gray-400 mt-3">
          We send one message and don&apos;t follow up. Up to 20 invites a day.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={16} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {data.monthsEarned || 0} free month
            {data.monthsEarned === 1 ? "" : "s"} earned
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          Added to your account automatically when a business you referred makes
          their first payment.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Businesses you&apos;ve referred
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {data.referred?.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">
              None yet — send an invite above, or share your link.
            </p>
          )}
          {data.referred?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-5 py-3 gap-3"
            >
              <span className="text-sm font-medium text-gray-900 truncate">
                {c.name}
              </span>
              {c.rewarded ? (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 text-green-700 shrink-0">
                  <Check size={11} /> {months} months earned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600 shrink-0">
                  <Clock size={11} /> Signed up — not yet paying
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.invites?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Invites sent
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between px-5 py-2.5 gap-3 text-sm"
              >
                <span className="text-gray-700 truncate">
                  {i.email || i.phone}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {i.channel === "sms" ? "Text" : "Email"} ·{" "}
                  {i.status === "redeemed"
                    ? "Signed up"
                    : i.status === "failed"
                      ? "Failed"
                      : new Date(i.createdAt).toLocaleDateString("en-CA")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
