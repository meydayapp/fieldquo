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
import { formatMoney } from "@/lib/currency";
import {
  Copy,
  Check,
  Gift,
  Mail,
  MessageSquare,
  MessageCircle,
  Smartphone,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ReferPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // Default desktop during SSR; the platform's Twilio can't text from trial
  // accounts, so on a real phone we hand the invite to the user's OWN
  // messaging app instead of routing it through us.
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    // A touch device with no hover — a phone, not a laptop with a touchscreen
    // and a mouse. That's where the deep links belong and desktop email doesn't.
    setIsMobile(
      typeof window !== "undefined" &&
        window.matchMedia?.("(hover: none) and (pointer: coarse)").matches,
    );
  }, []);

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
      setSent(t("app.refer.inviteSent", { to: res.to }));
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
        <div className="h-8 w-48 bg-accent rounded" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );

  if (!data)
    return (
      <div className="max-w-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
        {error || t("app.refer.loadError")}
      </div>
    );

  const currency = data.currency || "CAD";
  const creditEarned = formatMoney((data.creditEarnedCents || 0) / 100, currency);

  // The invite the user sends from their OWN phone. Mirrors the spirit of the
  // server SMS copy (identify the product, name the free months, end on the
  // link) but carries no recipient — they pick the contact in their own app,
  // which is the most cross-platform-safe way to prefill a message.
  const bonusMonths = data.refereeBonusMonths;
  const shareMessage = `Try FieldQuo — I use it for my quotes and invoices${
    bonusMonths ? `, and you get ${bonusMonths} month${bonusMonths === 1 ? "" : "s"} free` : ""
  }: ${data.referralUrl || ""}`;
  const smsHref = `sms:?&body=${encodeURIComponent(shareMessage)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.nav.refer")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.refer.creditIntro")}
        </p>
        {/* The whale line the owner asked for: bigger teams earn more. */}
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.refer.creditBigger")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <label className="text-sm font-medium text-foreground block mb-2">
          {t("app.refer.yourLink")}
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={data.referralUrl || ""}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-muted text-foreground"
          />
          <button
            onClick={copy}
            className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t("app.action.copied") : t("app.refer.copy")}
          </button>
        </div>
        {/* The link is your company name on purpose — it survives being read
            down a phone or printed on a van. */}
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.refer.linkHint")}
        </p>
      </div>

      {/* On a phone, send from the user's own messaging app. The platform's
          Twilio rejects sends from trial accounts, so routing referral texts
          through us fails for exactly the newest companies — a deep link into
          their own SMS/WhatsApp always works and comes from their number. */}
      {isMobile && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Share from your phone</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Opens your own messaging app with the invite ready to send. You pick who it goes to.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={smsHref}
              className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <Smartphone size={14} /> Text from my phone
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">
          {t("app.refer.sendInvite")}
        </h2>

        <form onSubmit={invite} className="space-y-3">
          <div className="flex gap-2">
            {[
              { key: "email", label: t("app.field.email"), icon: Mail },
              { key: "sms", label: t("app.refer.channelText"), icon: MessageSquare },
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
                      ? "bg-inverted text-inverted-foreground border-inverted"
                      : "border-border text-muted-foreground"
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {channel === "email"
                  ? t("app.refer.theirEmail")
                  : t("app.refer.theirMobile")}
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
                    ? t("app.refer.emailPlaceholder")
                    : t("app.refer.phonePlaceholder")
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("app.refer.theirName")}{" "}
                <span className="text-muted-foreground font-normal">
                  {t("app.refer.optionalParen")}
                </span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("app.refer.namePlaceholder")}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={sending || !contact.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {t("app.refer.sendInviteBtn")}
            </button>
            {/* Say why it's greyed out rather than leaving someone to guess. */}
            {!contact.trim() && !sending && (
              <span className="text-xs text-muted-foreground">
                {channel === "email"
                  ? t("app.refer.enterEmail")
                  : t("app.refer.enterNumber")}
              </span>
            )}
          </div>

          {sent && <p className="text-sm text-green-700 dark:text-green-300">{sent}</p>}
        </form>

        {/* Stated plainly rather than discovered at the limit. The cap exists
            so this can't be used as a bulk channel. */}
        <p className="text-xs text-muted-foreground mt-3">
          {t("app.refer.rateNote")}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.refer.creditEarned", { amount: creditEarned })}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("app.refer.creditEarnedNote")}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {t("app.refer.referredTitle")}
          </h2>
        </div>
        <div className="divide-y divide-border">
          {data.referred?.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              {t("app.refer.referredEmpty")}
            </p>
          )}
          {data.referred?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-5 py-3 gap-3"
            >
              <span className="text-sm font-medium text-foreground truncate">
                {c.name}
              </span>
              {c.rewarded ? (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 shrink-0">
                  <Check size={11} /> {t("app.refer.creditedBadge")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground shrink-0">
                  <Clock size={11} /> {t("app.refer.notYetPaying")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.invites?.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {t("app.refer.invitesSentTitle")}
            </h2>
          </div>
          <div className="divide-y divide-border">
            {data.invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between px-5 py-2.5 gap-3 text-sm"
              >
                <span className="text-foreground truncate">
                  {i.email || i.phone}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {i.channel === "sms"
                    ? t("app.refer.channelText")
                    : t("app.field.email")}{" "}
                  ·{" "}
                  {i.status === "redeemed"
                    ? t("app.refer.signedUp")
                    : i.status === "failed"
                      ? t("app.refer.failed")
                      : formatDate(i.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
