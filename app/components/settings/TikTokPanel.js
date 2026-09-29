// app/components/settings/TikTokPanel.js
//
// The body of Settings › TikTok (app/app/settings/tiktok/page.js) — TikTok's
// own screen and sidebar row, directly under Meta Ads. It began as a card on
// the Meta Ads screen; the owner moved it out (2026-09-29) because TikTok is
// not a Meta account and has to be findable by its own name.
//
// ── Three honest states, never a control that can't work ──────────────────
//
//   1. Not configured on this deployment → "TikTok posting — coming soon",
//      one sentence, NO button. /api/tiktok/connect refuses the same way.
//   2. Configured, nothing connected → a real Connect (a link: the route
//      answers with a redirect to tiktok.com), plus why a previous connection
//      ended when one did.
//   3. Connected → the account's nickname and picture, any permission TikTok
//      did not grant, and Disconnect.
//
// While FieldQuo's TikTok app is unaudited, states 2 and 3 say plainly that
// posts are private to the account owner and stay private.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Link2, Lock } from "lucide-react";
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { TIKTOK_SETTINGS_PATH } from "@/lib/tiktok/settingsPath";

// Every `tiktokError` app/api/tiktok/{connect,callback} can redirect with.
const ERROR_KEYS = {
  denied: "app.setTikTok.errorDenied",
  bad_state: "app.setTikTok.errorBadState",
  session: "app.setTikTok.errorSession",
  not_configured: "app.setTikTok.errorNotConfigured",
  network: "app.setTikTok.errorNetwork",
  exchange_failed: "app.setTikTok.errorExchange",
};

const REASON_KEYS = {
  authorization_removed: "app.setTikTok.endedRemoved",
  refresh_failed: "app.setTikTok.endedExpired",
};

export default function TikTokPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchJson("/api/tiktok/status"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Read once, then stripped, so a refresh can't replay a stale banner —
  // the same handling SocialPublishingPanel gives its own round trip.
  useEffect(() => {
    const connected = searchParams.get("tiktokConnected");
    const errKind = searchParams.get("tiktokError");
    if (!connected && !errKind) return;
    if (connected) {
      setBanner({ tone: "success", text: t("app.setTikTok.connectedBanner") });
    } else {
      setBanner({ tone: "error", text: t(ERROR_KEYS[errKind] || ERROR_KEYS.exchange_failed) });
    }
    router.replace(TIKTOK_SETTINGS_PATH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError("");
    try {
      const res = await fetchJson("/api/tiktok/disconnect", { method: "POST" });
      setConfirming(false);
      // The tokens are gone either way. What may not have happened is TikTok
      // confirming the revoke — said, not implied.
      setBanner(
        res?.revoked === false
          ? { tone: "error", text: t("app.setTikTok.revokeUnconfirmed") }
          : { tone: "success", text: t("app.setTikTok.disconnectedBanner") },
      );
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) return <div className="animate-pulse h-32 bg-muted rounded-xl" />;

  const connection = status?.connection || null;
  const ended = !connection ? status?.lastDisconnected : null;
  const endedKey = ended ? REASON_KEYS[ended.disconnectReason] : null;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SocialGlyph platform="tiktok" size={20} /> {t("app.setTikTok.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setTikTok.subtitle")}</p>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${
            banner.tone === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.tone === "success" ? (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{banner.text}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* State 1 — coming soon. No button: there is nothing to connect to. */}
      {status && !status.configured && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2" data-tiktok-coming-soon>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="font-semibold text-foreground">{t("app.setTikTok.comingSoonTitle")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("app.setTikTok.comingSoonBody")}</p>
        </div>
      )}

      {status?.configured && !status.audited && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <Lock size={15} className="shrink-0 mt-0.5" />
          <span>{t("app.setTikTok.unauditedNotice")}</span>
        </div>
      )}

      {/* State 2 — ready, nothing connected. */}
      {status?.configured && !connection && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground">{t("app.setTikTok.notConnectedTitle")}</h3>
          {endedKey && (
            <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{t(endedKey, { name: ended.displayName || "TikTok" })}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">{t("app.setTikTok.notConnectedBody")}</p>
          <a
            href="/api/tiktok/connect"
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Link2 size={14} /> {t("app.setTikTok.connect")}
          </a>
        </div>
      )}

      {/* State 3 — connected. */}
      {status?.configured && connection && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            {connection.avatarUrl && !avatarBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={connection.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover bg-muted shrink-0"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <SocialGlyph platform="tiktok" size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground break-words flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                {connection.displayName || t("app.setTikTok.unnamedAccount")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("app.setTikTok.connectedLine")}</p>
            </div>
          </div>

          {Array.isArray(connection.missingScopes) && connection.missingScopes.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{t("app.setTikTok.missingScopes", { scopes: connection.missingScopes.join(", ") })}</span>
            </div>
          )}

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-foreground"
            >
              {t("app.setTikTok.disconnect")}
            </button>
          ) : (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm text-foreground">{t("app.setTikTok.disconnectConfirm")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {t("app.action.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-50"
                >
                  {t("app.setTikTok.disconnect")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
