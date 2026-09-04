// app/app/settings/meta-ads/page.js
//
// Connect / status / disconnect for a company's OWN Meta (Facebook/
// Instagram) ad account — the /app-only half of docs/META-ADS-BUILD.md.
// Entirely a back-office screen: the person who clicks "Connect Meta Ads" is
// the same person who already sees "FieldQuo" throughout /app every day,
// and nothing here ever renders on a client-facing surface — see
// docs/META-ADS-INTEGRATION.md Part 3 on why that's the one clean fact
// about this integration and the white-label rule (AGENTS.md non-negotiable
// #1) never comes into play.
//
// Four honest states, never a button that reaches a route it can't work
// against (AGENTS.md's "never ship a control that appears to work and
// doesn't"):
//   1. not configured        — no META_APP_ID/META_APP_SECRET on this
//                               deployment at all
//   2. encryption not ready  — app credentials exist but
//                               META_TOKEN_ENCRYPTION_KEY doesn't, so a
//                               token could never be stored safely
//   3. configured, no connection — a real "Connect" button
//   4. connected             — status card, Sync now, Disconnect
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchJson } from "@/lib/fetchJson";

// Maps the `metaError` query param the OAuth callback redirects with to a
// translation key — see app/api/meta-ads/callback/route.js for every value
// this can be.
const ERROR_KEYS = {
  denied: "app.setMetaAds.errorDenied",
  bad_state: "app.setMetaAds.errorBadState",
  session: "app.setMetaAds.errorSession",
  not_configured: "app.setMetaAds.errorNotConfigured",
  auth_error: "app.setMetaAds.errorAuth",
  rate_limited: "app.setMetaAds.errorRateLimited",
  not_found: "app.setMetaAds.errorNotFound",
  unknown_error: "app.setMetaAds.errorUnknown",
  no_ad_accounts: "app.setMetaAds.errorNoAdAccounts",
};

function MetaAdsPageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(null); // /api/meta-ads/status response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null); // { tone: "success"|"error", text }
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [pickAccounts, setPickAccounts] = useState(null); // parsed from ?metaPickAccount
  const [pickingId, setPickingId] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchJson("/api/meta-ads/status"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // The three ways the OAuth round trip can land back here — read once, then
  // strip the query string so a refresh doesn't replay a stale banner or
  // re-open the account picker.
  useEffect(() => {
    const connected = searchParams.get("metaConnected");
    const errKind = searchParams.get("metaError");
    const pick = searchParams.get("metaPickAccount");

    if (connected) {
      setBanner({ tone: "success", text: t("app.setMetaAds.connectedBanner", "Meta Ads connected.") });
      loadStatus();
      router.replace("/app/settings/meta-ads");
    } else if (errKind) {
      const key = ERROR_KEYS[errKind] || ERROR_KEYS.unknown_error;
      setBanner({ tone: "error", text: t(key) });
      router.replace("/app/settings/meta-ads");
    } else if (pick) {
      try {
        const parsed = JSON.parse(pick);
        if (Array.isArray(parsed) && parsed.length) setPickAccounts(parsed);
      } catch {
        setBanner({ tone: "error", text: t(ERROR_KEYS.unknown_error) });
      }
      router.replace("/app/settings/meta-ads");
    }
    // Deliberately once — reading searchParams again after router.replace()
    // would just re-run this against the now-empty query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      const data = await fetchJson("/api/meta-ads/connect", { method: "POST" });
      if (!data?.authorizeUrl) throw new Error(t("app.setMetaAds.noAuthorizeUrl", "Couldn't start the connection."));
      window.location.href = data.authorizeUrl;
    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  }

  async function handleFinalizePick() {
    if (!pickingId) return;
    setFinalizing(true);
    setError("");
    try {
      await fetchJson("/api/meta-ads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: pickingId }),
      });
      setPickAccounts(null);
      setPickingId("");
      setBanner({ tone: "success", text: t("app.setMetaAds.connectedBanner", "Meta Ads connected.") });
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const result = await fetchJson("/api/meta-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setSyncResult(result);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError("");
    try {
      await fetchJson("/api/meta-ads/disconnect", { method: "POST" });
      setShowDisconnectConfirm(false);
      setSyncResult(null);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-48 bg-muted rounded-xl" />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 size={20} /> {t("app.settings.metaAds", "Meta Ads")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setMetaAds.subtitle",
            "Connect your own Meta (Facebook/Instagram) ad account to bring spend and campaign performance into your marketing numbers.",
          )}
        </p>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${
            banner.tone === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.tone === "success" ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
          <span className="flex-1">{banner.text}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* State 1 — no app credentials at all.
          `status` is null both before the read and after a failed one, and
          `!null?.appConfigured` is true — so a 403 or a cold-start 500 printed
          a confident, categorically false statement about whether Meta has
          approved this deployment. The page's own header comment enumerates
          four honest states; this is the fifth it did not model. */}
      {status && !status.appConfigured && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <ShieldAlert size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setMetaAds.notConfiguredTitle", "Not set up yet")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "app.setMetaAds.notConfiguredBody",
              "FieldQuo hasn't been approved by Meta as an advertiser-facing app on this deployment, so there's nothing to connect to yet. See docs/META-ADS-BUILD.md for what that takes.",
            )}
          </p>
        </div>
      )}

      {/* State 2 — app credentials exist, encryption key doesn't */}
      {status?.appConfigured && !status?.encryptionConfigured && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <ShieldAlert size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setMetaAds.noEncryptionTitle", "Can't store a token safely yet")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "app.setMetaAds.noEncryptionBody",
              "META_TOKEN_ENCRYPTION_KEY isn't set on this deployment, so a Meta access token couldn't be stored safely. This is a deploy-environment setting, not something you can fix from here.",
            )}
          </p>
        </div>
      )}

      {/* State 3 — ready, not connected */}
      {status?.fullyConfigured && !status?.connection && !pickAccounts && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
          <Link2 size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setMetaAds.notConnectedTitle", "Not connected")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t(
              "app.setMetaAds.notConnectedBody",
              "Connect your own Meta ad account. FieldQuo only reads spend and performance — it never creates or changes an ad.",
            )}
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            {connecting ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
            {t("app.setMetaAds.connect", "Connect Meta Ads")}
          </button>
        </div>
      )}

      {/* Account picker — more than one ad account came back from Meta */}
      {pickAccounts && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground">{t("app.setMetaAds.pickAccountTitle", "Which ad account?")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("app.setMetaAds.pickAccountBody", "Meta returned more than one ad account for your login.")}
          </p>
          <div className="space-y-1.5">
            {pickAccounts.map((a) => (
              <label
                key={a.id}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  pickingId === a.id ? "border-inverted bg-muted" : "border-border"
                }`}
              >
                <input type="radio" name="metaAccount" value={a.id} checked={pickingId === a.id} onChange={() => setPickingId(a.id)} />
                <span className="flex-1">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.currency || ""}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleFinalizePick}
            disabled={!pickingId || finalizing}
            className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            {finalizing ? t("app.action.saving", "Saving…") : t("app.setMetaAds.pickAccountConfirm", "Connect this account")}
          </button>
        </div>
      )}

      {/* State 4 — connected */}
      {status?.connection && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {status.connection.status === "connected" ? (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                )}
                <h2 className="font-semibold text-foreground">
                  {status.connection.adAccountName || status.connection.adAccountId}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.connection.adAccountId}
                {status.connection.adAccountCurrency ? ` · ${status.connection.adAccountCurrency}` : ""}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                status.connection.status === "connected"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {t(
                status.connection.status === "connected"
                  ? "app.setMetaAds.statusConnected"
                  : status.connection.status === "needs_reauth"
                    ? "app.setMetaAds.statusNeedsReauth"
                    : "app.setMetaAds.statusError",
                status.connection.status,
              )}
            </span>
          </div>

          {status.connection.status === "needs_reauth" && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{t("app.setMetaAds.needsReauthBody", "Meta says this connection's token is no longer valid — reconnect to keep syncing.")}</span>
            </div>
          )}
          {status.connection.status === "error" && status.connection.lastSyncError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{status.connection.lastSyncError}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {status.connection.lastSyncedAt
              ? t("app.setMetaAds.lastSynced", { date: new Date(status.connection.lastSyncedAt).toLocaleString() })
              : t("app.setMetaAds.neverSynced", "Never synced yet.")}
          </p>

          {syncResult && (
            <div className="text-xs bg-muted rounded-lg px-3 py-2 text-muted-foreground space-y-0.5">
              <div>
                {t("app.setMetaAds.syncSummary", {
                  created: syncResult.summary.created,
                  updated: syncResult.summary.updated,
                })}
              </div>
              {syncResult.summary.errored > 0 && <div>{t("app.setMetaAds.syncErrors", { count: syncResult.summary.errored })}</div>}
              {syncResult.summary.possibleDuplicates > 0 && (
                <div>{t("app.setMetaAds.syncDuplicates", { count: syncResult.summary.possibleDuplicates })}</div>
              )}
              {syncResult.currencyMismatch && <div>{t("app.setMetaAds.syncCurrencyMismatch", "Some rows are in a different currency than your company's — shown separately, not blended into totals.")}</div>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing || status.connection.status === "needs_reauth"}
              className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t("app.setMetaAds.syncNow", "Sync now")}
            </button>
            {status.connection.status === "needs_reauth" && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-3.5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                <Link2 size={14} /> {t("app.setMetaAds.reconnect", "Reconnect")}
              </button>
            )}
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:opacity-80"
            >
              {t("app.setMetaAds.disconnect", "Disconnect")}
            </button>
          </div>
        </div>
      )}

      {showDisconnectConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground">{t("app.setMetaAds.disconnectConfirmTitle", "Disconnect Meta Ads?")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("app.setMetaAds.disconnectConfirmBody", "FieldQuo will stop syncing spend from this ad account. Rows already imported stay in your marketing spend history.")}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white disabled:opacity-50"
              >
                {t("app.setMetaAds.disconnect", "Disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MetaAdsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <MetaAdsPageScreen />;
}
