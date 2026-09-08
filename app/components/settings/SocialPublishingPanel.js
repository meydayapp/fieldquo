// app/components/settings/SocialPublishingPanel.js
//
// The Facebook Page / Instagram PUBLISHING connection, on the same settings
// screen as the Meta Ads connection because both are "a Meta account this
// company connects" and splitting them across two sidebar rows would make a
// contractor learn which of two places holds which half of Meta.
//
// ── The one thing this panel must not do ──────────────────────────────────
//
// Render a Connect button while the permissions behind it are unapproved.
// None of META_PAGES_SCOPE is granted to FieldQuo's Meta app yet, so on every
// deployment today `connectEnabled` is false and this panel says exactly that
// — a sentence a contractor can act on ("nothing for you to do yet"), not a
// button that would take them to a consent screen Meta refuses. The server
// half of the same rule is in app/api/settings/social/connect (AGENTS.md:
// hiding a control is not access control; both halves ship together).
//
// Its own component rather than more JSX inside the Meta Ads page: two
// independent connections with their own states, their own OAuth round trips
// and their own failure modes, and interleaving them in one 800-line file is
// how the second one stops being read.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Link2, ShieldAlert } from "lucide-react";
// lucide has no brand marks; the bio-link page drew these as inline SVG and
// this reuses that one set rather than a second that drifts from it.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";

// Every `socialError` value app/api/settings/social/{connect,callback} can
// redirect with. Anything unrecognised falls to the unknown line rather than
// rendering a raw code at a contractor.
const ERROR_KEYS = {
  denied: "app.setSocial.errorDenied",
  bad_state: "app.setSocial.errorBadState",
  session: "app.setSocial.errorSession",
  not_configured: "app.setSocial.errorNotConfigured",
  awaiting_review: "app.setSocial.errorAwaitingReview",
  no_pages: "app.setSocial.errorNoPages",
  no_page_token: "app.setSocial.errorNoPageToken",
  auth_error: "app.setSocial.errorAuth",
  rate_limited: "app.setSocial.errorRateLimited",
  not_found: "app.setSocial.errorNotFound",
  unknown_error: "app.setSocial.errorUnknown",
};

export default function SocialPublishingPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null); // { tone, text }
  const [pickPages, setPickPages] = useState(null);
  const [pickingId, setPickingId] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchJson("/api/settings/social/status"));
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

  // The three ways the OAuth round trip lands back here. Read once, then the
  // query string is stripped so a refresh can't replay a stale banner or
  // re-open the Page picker against a cookie that has already been consumed.
  useEffect(() => {
    const connected = searchParams.get("socialConnected");
    const errKind = searchParams.get("socialError");
    const pick = searchParams.get("socialPickPage");
    if (!connected && !errKind && !pick) return;

    if (connected) {
      setBanner({ tone: "success", text: t("app.setSocial.connectedBanner", "Facebook and Instagram publishing connected.") });
      loadStatus();
    } else if (errKind) {
      setBanner({ tone: "error", text: t(ERROR_KEYS[errKind] || ERROR_KEYS.unknown_error) });
    } else if (pick) {
      try {
        const parsed = JSON.parse(pick);
        if (Array.isArray(parsed) && parsed.length) setPickPages(parsed);
      } catch {
        setBanner({ tone: "error", text: t(ERROR_KEYS.unknown_error) });
      }
    }
    router.replace(SOCIAL_SETTINGS_PATH);
    // Deliberately once — see the Meta Ads screen's identical note: reading
    // searchParams again after router.replace() re-runs this against an empty
    // query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFinalizePick() {
    if (!pickingId) return;
    setFinalizing(true);
    setError("");
    try {
      await fetchJson("/api/settings/social/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: pickingId }),
      });
      setPickPages(null);
      setPickingId("");
      setBanner({ tone: "success", text: t("app.setSocial.connectedBanner", "Facebook and Instagram publishing connected.") });
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError("");
    try {
      await fetchJson("/api/settings/social/disconnect", { method: "POST" });
      setShowDisconnectConfirm(false);
      setBanner(null);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-xl" />;
  }

  const connection = status?.connection || null;
  const canConnect = Boolean(status?.connectEnabled && status?.fullyConfigured);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <SocialGlyph platform="instagram" size={18} /> {t("app.setSocial.title", "Facebook & Instagram publishing")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setSocial.subtitle",
            "Post a design from the Marketing Designer straight to your own Facebook Page and Instagram account.",
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

      {/* State 1 — waiting on Meta. The honest sentence, and NO connect
          control: the permissions this needs have not been approved, so there
          is nothing a contractor can do here today and pretending otherwise
          would be the dead button AGENTS.md is built around. */}
      {status && !status.connectEnabled && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="font-semibold text-foreground">
              {t("app.setSocial.awaitingTitle", "Waiting on Meta's approval")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "app.setSocial.awaitingBody",
              "Publishing to Facebook and Instagram needs permissions Meta has to approve for FieldQuo before any account can be connected. That review is with Meta, not something you can set up here. Nothing is missing on your side.",
            )}
          </p>
        </div>
      )}

      {/* State 2 — the flag is on but this deployment can't do it anyway. */}
      {status?.connectEnabled && !status?.fullyConfigured && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-foreground">
              {t("app.setSocial.notConfiguredTitle", "Not set up on this deployment")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "app.setSocial.notConfiguredBody",
              "This deployment is missing the Meta app credentials or the token encryption key, so a connection couldn't be stored safely. That's a deploy setting, not something you can fix from here.",
            )}
          </p>
        </div>
      )}

      {/* State 3 — ready, nothing connected. */}
      {canConnect && !connection && !pickPages && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground">
            {t("app.setSocial.notConnectedTitle", "No Page connected")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(
              "app.setSocial.notConnectedBody",
              "Connect the Facebook Page your business posts from. If an Instagram professional account is linked to that Page, FieldQuo can post there too.",
            )}
          </p>
          {/* A link, not a fetch: /api/settings/social/connect answers with a
              redirect to Meta, and a navigation is what a browser does best
              with one. */}
          <a
            href="/api/settings/social/connect"
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Link2 size={14} /> {t("app.setSocial.connect", "Connect Facebook & Instagram")}
          </a>
        </div>
      )}

      {/* The Page picker — more than one Page came back from Meta. */}
      {pickPages && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground">{t("app.setSocial.pickPageTitle", "Which Page?")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("app.setSocial.pickPageBody", "Meta returned more than one Facebook Page for your login.")}
          </p>
          <div className="space-y-1.5">
            {pickPages.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${
                  pickingId === p.id ? "border-inverted bg-muted" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="metaPage"
                  value={p.id}
                  checked={pickingId === p.id}
                  onChange={() => setPickingId(p.id)}
                />
                <span className="flex-1">{p.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleFinalizePick}
            disabled={!pickingId || finalizing}
            className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            {finalizing ? t("app.action.saving", "Saving…") : t("app.setSocial.pickPageConfirm", "Connect this Page")}
          </button>
        </div>
      )}

      {/* State 4 — connected. */}
      {connection && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground break-words">
                {connection.pageName || connection.pageId}
              </h3>
              <p className="text-sm text-muted-foreground break-words">
                {connection.instagramUsername
                  ? `@${connection.instagramUsername}`
                  : connection.instagramUserId
                    ? t("app.setSocial.instagramLinked", "An Instagram account is linked to this Page.")
                    : t("app.setSocial.noInstagram", "No Instagram account linked to this Page — Facebook only.")}
              </p>
            </div>
          </div>

          {/* Meta let the contractor un-tick individual permissions on the
              consent screen. Saying which one is missing here is the difference
              between a fixable message and a mystery failure mid-campaign. */}
          {Array.isArray(connection.missingScopes) && connection.missingScopes.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                {t("app.setSocial.missingScopes", { scopes: connection.missingScopes.join(", ") })}
              </span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {connection.connectedByName
              ? t("app.setSocial.connectedByOn", {
                  name: connection.connectedByName,
                  date: new Date(connection.connectedAt).toLocaleDateString(),
                })
              : t("app.setSocial.connectedOn", {
                  date: new Date(connection.connectedAt).toLocaleDateString(),
                })}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* Guarded on the same flag as the first Connect button. A company
                that connected while the flag was on would otherwise still be
                offered Reconnect after it was turned off — the route refuses
                honestly rather than breaking, but a control that cannot do
                what it says should not be drawn. Disconnect stays available
                either way: taking a token away must never depend on whether
                a new one could be granted. */}
            {canConnect && (
              <a
                href="/api/settings/social/connect"
                className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold"
              >
                <Link2 size={14} /> {t("app.setSocial.reconnect", "Reconnect or switch Page")}
              </a>
            )}
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-sm font-semibold text-red-600 dark:text-red-400 hover:opacity-80"
            >
              {t("app.setSocial.disconnect", "Disconnect")}
            </button>
          </div>
        </div>
      )}

      {showDisconnectConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-foreground">
              {t("app.setSocial.disconnectConfirmTitle", "Disconnect Facebook & Instagram?")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.setSocial.disconnectConfirmBody",
                "FieldQuo will delete the stored access token straight away and can't publish or fire scheduled posts for this Page. Posts already published stay on Facebook and Instagram.",
              )}
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
                {t("app.setSocial.disconnect", "Disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
