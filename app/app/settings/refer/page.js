// app/app/settings/refer/page.js
//
// Refer & Earn — send an invite, watch it convert, see what you've earned.
//
// The previous version showed a /signup?ref=CODE link and a list of referred
// companies. Both were fiction: nothing anywhere read the `ref` parameter, so
// referredByCode was never written and the list was permanently empty.
//
// The distinction this page now makes carefully: signing up earns the NEW
// company their free month, but earns the referrer nothing until that company
// actually pays. Blurring that produces exactly one support conversation —
// "I referred three people, where are my months?"
//
// "three months" above was correct until 2026-08-27, when the owner cut both
// sides of the reward to one (AGENTS.md non-negotiable #1, and
// REFEREE_BONUS_MONTHS / REFERRER_BONUS_MONTHS in lib/referrals/index.js). The
// comment was left saying three, which is how a reader would have "fixed" the
// code to match it.
"use client";

import { useCallback, useEffect, useState } from "react";
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
import { smsShareHref, whatsappShareHref } from "@/lib/share/messagingLinks";
import { useMessagingCapability } from "@/app/hooks/useMessagingCapability";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// An employee opening this page got the referral link and the full list of
// which companies had been referred, which of them had paid, and how much
// credit the company had earned — while the one action on the page, sending an
// invite, was owner/admin only (see /api/settings/referral/invite). So it was a
// page that showed other people's commercial data and refused the only thing
// you could do with it.
//
// Read-only would fix the second half and make the first half worse: the
// referral ledger isn't information a crew member needs, it's the owner's. So
// the whole screen is hidden, and GET /api/settings/referral now refuses the
// same member — the row and the endpoint moved together, because hiding one
// without the other is the fix that isn't one.
//
// A wrapper rather than an early return so the gate lands before the mount
// fetch. See the same note on Account & Billing.
export default function ReferPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <ReferScreen />;
}

function ReferScreen() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // The platform's Twilio can't text from trial accounts, so on a real phone we
  // hand the invite to the user's OWN messaging app instead of routing it
  // through us. `canText` gates the SMS button — a desktop that can't open
  // Messages must not be shown one — and `iosStyle` only picks the sms:
  // separator. Both come from lib/share/messagingLinks.js, which is where the
  // one UA sniff lives, and which defaults to desktop before hydration.
  const messaging = useMessagingCapability();

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
    // Null under a read-only support session, which never mints a code — see
    // the note in /api/settings/referral. Copying the string "null" is worse
    // than doing nothing.
    if (!data.referralUrl) return;
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

  // ── The reward is a month, and has been since 2026-08-27 ────────────────
  //
  // This card read `formatMoney(data.creditEarnedCents / 100)`. Nothing has
  // written ReferralCredit.creditCents on a referrer row since the reward
  // became a free month — grantReferrerCredit says so out loud: "creditCents/
  // currency stay null on new rows. The two historical rows that carry them
  // predate this and are left exactly as they are." So the sum is 0 for every
  // company on the current scheme, and a business with ten rewarded referrals
  // was shown "$0.00 credit earned" as a confident fact, off data the server
  // was holding correctly all along.
  //
  // `rewardedCount` is that data: how many referred companies have actually
  // paid. One free month each (REFERRER_BONUS_MONTHS), applied by
  // extendAccess as a trial_end deferral — not a credit on an invoice.
  const rewardedCount = Number(data.rewardedCount) || 0;

  // The invite the user sends from their OWN app. Mirrors the spirit of the
  // server SMS copy (identify the product, name the free months, end on the
  // link) but carries no recipient — they pick the contact in their own app,
  // which is the most cross-platform-safe way to prefill a message. Written in
  // the interface language: the person typing it is the one who has to read it
  // back, and they may well be sending to someone in the same trade and city.
  const bonusMonths = data.refereeBonusMonths;
  const shareUrl = data.referralUrl || "";
  const shareMessage = bonusMonths
    ? t(
        bonusMonths === 1
          ? "app.refer.shareMessageBonusOne"
          : "app.refer.shareMessageBonusOther",
        { months: bonusMonths, url: shareUrl },
      )
    : t("app.refer.shareMessage", { url: shareUrl });
  // Encoding matters more than it looks: the referral URL can carry `?` and
  // `&`, and unencoded those end the body — the message would send truncated.
  const smsHref = smsShareHref(shareMessage, { iosStyle: messaging.iosStyle });
  const whatsappHref = whatsappShareHref(shareMessage);

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

      <div data-tour="refer-link" className="bg-card border border-border rounded-xl p-5">
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

      {/* Send from the user's own messaging app. The platform's Twilio rejects
          sends from trial accounts, so routing referral texts through us fails
          for exactly the newest companies — a deep link into their own
          SMS/WhatsApp always works and comes from their number.

          The Text button appears only where an SMS app exists to receive it.
          WhatsApp stays on desktop because wa.me genuinely works there (it
          hands off to WhatsApp Web or the desktop app), so hiding the whole
          card off-phone would be hiding something that works. Copy-link is
          above and email is the form below; nothing is lost on a laptop except
          the one control a laptop can't honour. */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">
          {t("app.refer.shareTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          {messaging.canText
            ? t("app.refer.shareDescPhone")
            : t("app.refer.shareDescDesktop")}
        </p>
        <div className="flex flex-wrap gap-2">
          {messaging.canText && (
            <a
              href={smsHref}
              className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <Smartphone size={14} /> {t("app.refer.shareByText")}
            </a>
          )}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold ${
              messaging.canText
                ? "border border-border text-foreground"
                : "bg-inverted text-inverted-foreground"
            }`}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>
      </div>

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
            {/* The One/Other pair already exists in all nine catalogues and had
                no call site — written for this reward and left behind when the
                card was money. Selected the same way this page already selects
                shareMessageBonusOne/Other twenty lines up. */}
            {t(
              rewardedCount === 1
                ? "app.refer.monthEarnedOne"
                : "app.refer.monthsEarnedOther",
              { count: rewardedCount },
            )}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {/* Not creditEarnedNote, which says "Applied to your next invoice".
              A deferred trial_end is not a line on an invoice. earnedNote is
              the one that describes what actually happens, and it is likewise
              already translated everywhere and unused. */}
          {t("app.refer.earnedNote")}
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
