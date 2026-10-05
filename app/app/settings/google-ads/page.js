// app/app/settings/google-ads/page.js
//
// Connect / status / account pick / sync / disconnect for a company's OWN
// Google Ads account, plus the report upload that works with no connection
// at all — the Google twin of app/app/settings/meta-ads/page.js, laid out the
// same way on purpose (the owner asked for "the same layout"). A back-office
// screen only: nothing here renders on a client-facing surface.
//
// Honest states, never a button that reaches a route it can't work against:
//   1. not set up            — env vars missing, named (never their values)
//   2. waiting on Google     — everything set, FieldQuo's developer token not
//                              yet granted Basic access (GOOGLE_ADS_API_APPROVED)
//   3. not connected         — a real "Connect Google Ads" link
//   4. pick an account       — consent given, the ad account not chosen yet
//   5. connected             — status, last sync, Sync now, Disconnect
// and, in every state, "Import a Google Ads report" — the CSV/XLSX upload,
// which needs no approval from anyone (docs/GOOGLE-ADS-INTEGRATION.md).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, ShieldAlert, Clock, Upload } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchJson } from "@/lib/fetchJson";
import GoogleAdsImportDialog from "@/app/components/marketing/GoogleAdsImportDialog";

const PATH = "/app/settings/google-ads";

// The Google Ads account-level tracking template that puts the campaign id
// on every click: lib/tracking/adParams.js reads an all-digit utm_campaign as
// the campaign's id, which is what lets a lead that arrived with a gclid be
// credited to ITS campaign (lib/analytics/googleAdsRollup.js). Auto-tagging's
// gclid alone says "Google Ads", not which campaign. Google's own ValueTrack
// syntax; nothing here is substituted by FieldQuo.
const TRACKING_TEMPLATE = "{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}";

// The `googleAds` query param the connect and callback routes redirect with
// (app/api/google-ads/{connect,callback}/route.js) → a translation key.
const ERROR_KEYS = {
  denied: "app.setGoogleAds.errorDenied",
  bad_state: "app.setGoogleAds.errorBadState",
  session: "app.setGoogleAds.errorSession",
  forbidden: "app.setGoogleAds.errorSession",
  not_configured: "app.setGoogleAds.errorNotConfigured",
  not_approved: "app.setGoogleAds.errorNotApproved",
  exchange_failed: "app.setGoogleAds.errorExchange",
  no_refresh_token: "app.setGoogleAds.errorExchange",
  scope_missing: "app.setGoogleAds.errorScope",
};

// A sync/account failure kind (lib/googleAds/client.js classifyGoogleAdsError)
// → a sentence that says whose move it is.
const KIND_KEYS = {
  developer_token: "app.setGoogleAds.kindDeveloperToken",
  permission: "app.setGoogleAds.kindPermission",
  customer_not_enabled: "app.setGoogleAds.kindCustomerNotEnabled",
  rate_limited: "app.setGoogleAds.kindRateLimited",
  api_version: "app.setGoogleAds.kindApiVersion",
  auth_error: "app.setGoogleAds.needsReauthBody",
};

function GoogleAdsPageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency: companyCurrency } = useCompanyPreferences();

  const [status, setStatus] = useState(null); // /api/google-ads/status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null); // { tone, text }
  const [accounts, setAccounts] = useState(null); // picker options
  const [accountsError, setAccountsError] = useState("");
  const [pickingId, setPickingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchJson("/api/google-ads/status"));
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

  // The OAuth round trip lands back here once — read the word, then strip
  // the query so a refresh does not replay the banner.
  useEffect(() => {
    const word = searchParams.get("googleAds");
    if (!word) return;
    if (word === "connected") {
      setBanner({ tone: "success", text: t("app.setGoogleAds.connectedBanner") });
      loadStatus();
    } else {
      setBanner({ tone: "error", text: t(ERROR_KEYS[word] || "app.setGoogleAds.errorUnknown") });
    }
    router.replace(PATH);
    // Deliberately once, like the Meta Ads page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connection = status?.connection || null;
  const needsPick = Boolean(connection && !connection.customerId);

  const loadAccounts = useCallback(async () => {
    setAccountsError("");
    setAccounts(null);
    try {
      const data = await fetchJson("/api/google-ads/accounts");
      setAccounts(data.options || []);
    } catch (err) {
      setAccountsError(KIND_KEYS[err?.data?.kind] ? t(KIND_KEYS[err.data.kind]) : err.message);
    }
  }, [t]);

  useEffect(() => {
    if (needsPick) loadAccounts();
  }, [needsPick, loadAccounts]);

  async function handlePick() {
    if (!pickingId) return;
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/google-ads/accounts", { method: "POST", body: { customerId: pickingId } });
      setBanner({ tone: "success", text: t("app.setGoogleAds.accountChosenBanner") });
      setPickingId("");
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      setSyncResult(await fetchJson("/api/google-ads/sync", { method: "POST", body: {} }));
    } catch (err) {
      setError(KIND_KEYS[err?.data?.kind] ? `${t(KIND_KEYS[err.data.kind])} (${err.message})` : err.message);
    } finally {
      await loadStatus();
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError("");
    try {
      await fetchJson("/api/google-ads/disconnect", { method: "POST" });
      setShowDisconnectConfirm(false);
      setSyncResult(null);
      setAccounts(null);
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

  const lastError = connection?.lastSyncError || "";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 size={20} /> {t("app.settings.googleAds")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setGoogleAds.subtitle")}</p>
        <p className="text-xs text-muted-foreground mt-2">
          <Link href="/app/marketing/spend#google-campaigns" className="underline text-foreground">
            {t("app.setGoogleAds.spendLink")}
          </Link>
        </p>
      </div>

      {/* How FieldQuo counts YOUR leads from Google — never from Google's
          conversions. Shown in every state: it is true of the report upload
          too, and it is the one thing the contractor sets in Google Ads. */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{t("app.setGoogleAds.leadsTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("app.setGoogleAds.leadsBody")}</p>
        <code className="block text-[11px] bg-muted rounded-lg px-3 py-2 break-all text-foreground">{TRACKING_TEMPLATE}</code>
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

      {/* State 1 — something this deployment needs is missing. Only once the
          status has actually loaded: a failed read is the error above, never
          a confident "not set up". */}
      {status && status.missing?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <ShieldAlert size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setGoogleAds.notConfiguredTitle")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t("app.setGoogleAds.notConfiguredBody", { names: status.missing.join(", ") })}
          </p>
        </div>
      )}

      {/* State 2 — everything set; Google has not granted the developer token Basic access. */}
      {status?.waitingOnApproval && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <Clock size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setGoogleAds.waitingTitle")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("app.setGoogleAds.waitingBody")}</p>
        </div>
      )}

      {/* State 3 — ready, not connected. A link: the connect route redirects to Google. */}
      {status?.available && !connection && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
          <Link2 size={32} className="mx-auto text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t("app.setGoogleAds.notConnectedTitle")}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("app.setGoogleAds.notConnectedBody")}</p>
          <a
            href="/api/google-ads/connect"
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Link2 size={14} /> {t("app.setGoogleAds.connect")}
          </a>
        </div>
      )}

      {/* State 4 — consent given, account not chosen. */}
      {needsPick && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-foreground">{t("app.setGoogleAds.pickAccountTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("app.setGoogleAds.pickAccountBody", { email: connection.email || "—" })}
          </p>
          {accountsError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {accountsError}{" "}
              <button type="button" onClick={loadAccounts} className="underline font-medium">
                {t("app.load.retry")}
              </button>
            </p>
          )}
          {!accountsError && accounts === null && <div className="animate-pulse h-16 bg-muted rounded-lg" />}
          {accounts && accounts.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("app.setGoogleAds.noAccounts")}</p>
          )}
          {accounts && accounts.length > 0 && (
            <div className="space-y-1.5">
              {accounts.map((a) => (
                <label
                  key={a.customerId}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                    pickingId === a.customerId ? "border-inverted bg-muted" : "border-border"
                  }`}
                >
                  <input type="radio" name="googleAdsAccount" value={a.customerId} checked={pickingId === a.customerId} onChange={() => setPickingId(a.customerId)} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{a.name || a.customerId}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {`${a.customerId.slice(0, 3)}-${a.customerId.slice(3, 6)}-${a.customerId.slice(6)}`}
                      {a.viaManager ? ` · ${t("app.setGoogleAds.viaManager", { name: a.viaManager })}` : ""}
                      {a.testAccount ? ` · ${t("app.setGoogleAds.testAccount")}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{a.currency || ""}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePick}
              disabled={!pickingId || saving}
              className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {saving ? t("app.action.saving", "Saving…") : t("app.setGoogleAds.pickAccountConfirm")}
            </button>
            <button onClick={() => setShowDisconnectConfirm(true)} className="text-sm font-semibold text-red-600 dark:text-red-400 hover:opacity-80">
              {t("app.setGoogleAds.disconnect")}
            </button>
          </div>
        </div>
      )}

      {/* State 5 — connected to an account. */}
      {connection?.customerId && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {connection.status === "connected" ? (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                )}
                <h2 className="font-semibold text-foreground">{connection.customerName || connection.customerIdFormatted}</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {connection.customerIdFormatted}
                {connection.currencyCode ? ` · ${connection.currencyCode}` : ""}
                {connection.viaManager ? ` · ${t("app.setGoogleAds.viaManager", { name: connection.viaManager })}` : ""}
                {connection.email ? ` · ${connection.email}` : ""}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                connection.status === "connected"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {t(
                connection.status === "connected"
                  ? "app.setGoogleAds.statusConnected"
                  : connection.status === "needs_reauth"
                    ? "app.setGoogleAds.statusNeedsReauth"
                    : "app.setGoogleAds.statusError",
              )}
            </span>
          </div>

          {connection.status === "needs_reauth" && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{t("app.setGoogleAds.needsReauthBody")}</span>
            </div>
          )}
          {connection.status === "error" && lastError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {connection.lastSyncedAt
              ? t("app.setGoogleAds.lastSynced", { date: new Date(connection.lastSyncedAt).toLocaleString() })
              : t("app.setGoogleAds.neverSynced")}{" "}
            {t("app.setGoogleAds.dailyNote")}
            {connection.lastSyncedAt && (
              <>
                {" "}
                <Link href="/app/marketing/spend#google-campaigns" className="underline text-foreground">
                  {t("app.setGoogleAds.seeCampaigns")}
                </Link>
              </>
            )}
          </p>

          {syncResult && (
            <div className="text-xs bg-muted rounded-lg px-3 py-2 text-muted-foreground space-y-0.5">
              <div>
                {t("app.setGoogleAds.syncSummary", {
                  created: syncResult.summary.created,
                  updated: syncResult.summary.updated,
                })}
              </div>
              {syncResult.summary.skipped > 0 && <div>{t("app.setGoogleAds.syncSkipped", { count: syncResult.summary.skipped })}</div>}
              {syncResult.summary.errored > 0 && <div>{t("app.setGoogleAds.syncErrors", { count: syncResult.summary.errored })}</div>}
              {syncResult.currencyMismatch && <div>{t("app.setGoogleAds.syncCurrencyMismatch")}</div>}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing || connection.status === "needs_reauth" || !status?.available}
              className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {t("app.setGoogleAds.syncNow")}
            </button>
            {connection.status === "needs_reauth" && status?.available && (
              <a
                href="/api/google-ads/connect"
                className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-3.5 py-2 rounded-full text-sm font-semibold"
              >
                <Link2 size={14} /> {t("app.setGoogleAds.reconnect")}
              </a>
            )}
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:opacity-80"
            >
              {t("app.setGoogleAds.disconnect")}
            </button>
          </div>
        </div>
      )}

      {/* The report upload — works in every state above, with no approval
          from anyone. Same dialog as Marketing › Spend's button. */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Upload size={16} /> {t("app.setGoogleAds.importTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("app.setGoogleAds.importBody")}</p>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold"
        >
          <Upload size={14} /> {t("app.googleAds.import.open")}
        </button>
      </div>

      {showImport && (
        <GoogleAdsImportDialog companyCurrency={companyCurrency} onClose={() => setShowImport(false)} onImported={() => {}} />
      )}

      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDisconnectConfirm(false)}>
          <div className="fq-dialog-card bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground">{t("app.setGoogleAds.disconnectConfirmTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("app.setGoogleAds.disconnectConfirmBody")}</p>
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
                {t("app.setGoogleAds.disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoogleAdsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <GoogleAdsPageScreen />;
}
