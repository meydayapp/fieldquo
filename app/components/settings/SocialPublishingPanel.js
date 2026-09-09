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
  // classifyMetaError's kinds overlap these exactly, minus `network`, which
  // has no separate sentence because "Meta didn't answer" and "Meta answered
  // with something we don't recognise" lead a contractor to the same action.
  // Reused for the webhook-subscription failure rather than a second set of
  // near-identical strings in nine languages.
  network: "app.setSocial.errorUnknown",
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
  const [retryingWebhook, setRetryingWebhook] = useState(false);

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
      const res = await fetchJson("/api/settings/social/disconnect", { method: "POST" });
      setShowDisconnectConfirm(false);
      // The token is gone either way — that is what Disconnect promised and it
      // happened. What may NOT have happened is Meta agreeing to stop sending
      // this Page's messages, and a contractor who is told nothing would
      // reasonably assume it did. `false` only; `null` means there was no
      // subscription to remove, which is not a warning.
      setBanner(
        res?.webhookUnsubscribed === false
          ? {
              tone: "error",
              text: t(
                "app.setSocial.disconnectStillSubscribed",
                "The Page is disconnected and its access token is deleted, but Meta didn't confirm it stopped sending this Page's messages to FieldQuo. Remove FieldQuo under the Page's Business Integrations in Meta's own settings to be certain.",
              ),
            }
          : null,
      );
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  // The retry behind the "Messages aren't being delivered" state. It re-runs
  // the one call that failed rather than tearing down a connection that is
  // otherwise fine — and it reloads the status afterwards either way, so the
  // screen shows what the database now says instead of what this handler
  // hoped.
  // Also the "Connect the inbox" press, on purpose: the route subscribes the
  // Page AND writes the MessagingChannel rows the inbox resolves against, so
  // the two presses are one action with two names. `inbox` only changes which
  // sentence is reported back, because that is the only thing that differs —
  // a second handler posting to the same endpoint would be the copy that rots.
  async function handleRetryWebhook({ inbox = false } = {}) {
    setRetryingWebhook(true);
    setError("");
    try {
      await fetchJson("/api/settings/social/subscribe", { method: "POST" });
      setBanner({
        tone: "success",
        text: inbox
          ? t(
              "app.setSocial.inboxConnectedOk",
              "Your Facebook and Instagram messages now arrive in FieldQuo's inbox.",
            )
          : t(
              "app.setSocial.webhookRetryOk",
              "Meta is now sending this Page's messages to FieldQuo.",
            ),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryingWebhook(false);
      await loadStatus();
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

          {/* ── Whether this Page's messages can reach FieldQuo at all ──────
              Three states, told apart, because a connected Page that is not
              subscribed to our webhook delivers nothing and looks perfect
              doing it. That was the actual bug: the connect flow stored a
              token and never called POST /<page-id>/subscribed_apps, so the
              inbox, the AI employee and the monthly review all waited on
              messages Meta was never asked to send. */}
          {connection.webhookSubscribedAt ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {t("app.setSocial.webhookOn", {
                  date: new Date(connection.webhookSubscribedAt).toLocaleDateString(),
                })}
              </span>
            </p>
          ) : connection.webhookSubscribeErrorKind ? (
            <div className="space-y-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">
                    {t("app.setSocial.webhookOffTitle", "Messages from this Page aren't reaching FieldQuo")}
                  </p>
                  <p>
                    {t(
                      "app.setSocial.webhookFailedBody",
                      "Meta refused to send this Page's messages here, so nothing a customer writes will land in your inbox. Posting to the Page still works.",
                    )}
                  </p>
                  <p className="opacity-90">
                    {t(ERROR_KEYS[connection.webhookSubscribeErrorKind] || ERROR_KEYS.unknown_error)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRetryWebhook()}
                disabled={retryingWebhook}
                className="border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
              >
                {retryingWebhook
                  ? t("app.action.saving", "Saving…")
                  : t("app.setSocial.webhookRetry", "Try subscribing again")}
              </button>
            </div>
          ) : (
            /* Never attempted. The state every Page is in today, and it is
               FieldQuo's App Review that blocks it — so this says so and draws
               no retry, because there is nothing here a contractor can fix. */
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Clock size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                {t("app.setSocial.webhookPendingBody", {
                  scopes: (connection.webhookMissingPermissions || []).join(", "),
                })}
              </span>
            </p>
          )}

          {/* ── The inbox, for a Page connected before it was created ───────
              Meta grants messaging, the subscription is live, and there is no
              MessagingChannel row — so every message Meta delivers is answered
              `unknown_page` and dropped. This is the one press that fixes it,
              and it runs the same route as the retry above.

              Drawn ONLY when the server says a channel is missing, which it
              says only when the grant is actually there. A company that
              connected for publishing alone sees nothing here rather than a
              button that would refuse them. */}
          {Array.isArray(connection.missingInboxChannels) &&
            connection.missingInboxChannels.length > 0 && (
              <div className="space-y-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      {t("app.setSocial.inboxOffTitle", "Your inbox isn't switched on for this Page yet")}
                    </p>
                    <p>
                      {t(
                        "app.setSocial.inboxOffBody",
                        "Meta is allowed to send this Page's messages to FieldQuo, but the inbox hasn't been set up to receive them, so they aren't appearing under Messages. One press fixes it.",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRetryWebhook({ inbox: true })}
                  disabled={retryingWebhook}
                  className="border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
                >
                  {retryingWebhook
                    ? t("app.action.saving", "Saving…")
                    : t("app.setSocial.inboxConnect", "Connect the inbox")}
                </button>
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
