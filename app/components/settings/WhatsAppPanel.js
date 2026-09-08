"use client";

// app/components/settings/WhatsAppPanel.js
//
// The contractor's own WhatsApp Business number, connected here and answered
// in /app/messages beside their Facebook and Instagram conversations.
//
// ── The one thing this panel must not do ──────────────────────────────────
//
// Render a Connect button while `whatsapp_business_messaging` is unapproved.
// It is not approved for FieldQuo's Meta app, so on every deployment today
// `connectEnabled` is false and this panel says exactly that — a sentence a
// contractor can act on ("nothing for you to do yet"), not a button that would
// take them to a signup flow Meta refuses. The server half of the same rule is
// in app/api/settings/whatsapp/connect (AGENTS.md: hiding a control is not
// access control; both halves ship together).
//
// ── Why the 24-hour window is explained HERE ──────────────────────────────
//
// Because it is the single thing about WhatsApp that will surprise a
// contractor, and the composer is a bad place to learn a rule for the first
// time. A painter who has used WhatsApp personally for ten years has never met
// it: on a business number, a typed message more than 24 hours after the
// customer last wrote is refused by WhatsApp itself. Saying so once, on the
// screen where they connect, is the difference between "that's how it works"
// and "your software is broken".
//
// Its own component rather than more JSX inside the Meta Ads page: five
// independent Meta connections with their own states and their own failure
// modes, and interleaving them in one file is how the fifth stops being read.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldAlert } from "lucide-react";
// lucide ships NO brand marks — the bio-link page drew these as inline SVG and
// this reuses that one set rather than a second that drifts from it.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { WHATSAPP_SETTINGS_PATH } from "@/lib/messaging/whatsappSettingsPath";

// Every `whatsappError` value app/api/settings/whatsapp/{connect,callback} can
// redirect with. Anything unrecognised falls to the unknown line rather than
// rendering a raw code at a contractor.
const ERROR_KEYS = {
  denied: "app.setWhatsApp.errorDenied",
  bad_state: "app.setWhatsApp.errorBadState",
  session: "app.setWhatsApp.errorSession",
  not_configured: "app.setWhatsApp.errorNotConfigured",
  no_signup_config: "app.setWhatsApp.errorNoSignupConfig",
  awaiting_review: "app.setWhatsApp.errorAwaitingReview",
  no_waba: "app.setWhatsApp.errorNoWaba",
  no_number: "app.setWhatsApp.errorNoNumber",
  no_webhook: "app.setWhatsApp.errorNoWebhook",
  auth_error: "app.setWhatsApp.errorAuth",
  rate_limited: "app.setWhatsApp.errorRateLimited",
  not_found: "app.setWhatsApp.errorNotFound",
  unknown_error: "app.setWhatsApp.errorUnknown",
};

export default function WhatsAppPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null); // { tone, text }
  const [refreshing, setRefreshing] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchJson("/api/settings/whatsapp/status"));
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

  // The two ways the signup round trip lands back here. Read once, then the
  // query string is stripped so a refresh cannot replay a stale banner.
  useEffect(() => {
    const connected = searchParams.get("whatsappConnected");
    const errKind = searchParams.get("whatsappError");
    if (!connected && !errKind) return;
    if (connected) {
      setBanner({ tone: "success", text: t("app.setWhatsApp.connectedBanner") });
      loadStatus();
    } else {
      setBanner({ tone: "error", text: t(ERROR_KEYS[errKind] || ERROR_KEYS.unknown_error) });
    }
    router.replace(WHATSAPP_SETTINGS_PATH);
    // Deliberately once — the Meta Ads screen's identical note: reading
    // searchParams again after router.replace() re-runs this against an empty
    // query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshTemplates() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetchJson("/api/settings/whatsapp/templates", { method: "POST" });
      setBanner({
        tone: "success",
        text: t("app.setWhatsApp.templatesSynced", { count: res?.synced ?? 0 }),
      });
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function disconnect(channelId) {
    setDisconnectingId(channelId);
    setError("");
    try {
      await fetchJson("/api/settings/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      setBanner(null);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDisconnectingId("");
    }
  }

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-xl" />;
  }

  const channels = status?.channels || [];
  const canConnect = Boolean(
    status?.connectEnabled && status?.fullyConfigured && status?.signupConfigured,
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <SocialGlyph platform="whatsapp" size={18} /> {t("app.setWhatsApp.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setWhatsApp.subtitle")}</p>
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
          control: whatsapp_business_messaging has not been approved, so there
          is nothing a contractor can do here today and pretending otherwise
          would be the dead button AGENTS.md is built around. */}
      {status && !status.connectEnabled && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="font-semibold text-foreground">{t("app.setWhatsApp.awaitingTitle")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.awaitingBody")}</p>
        </div>
      )}

      {/* State 2 — the flag is on but this deployment cannot do it anyway.
          Two different missing things, named separately: app credentials are a
          shared Meta setting, and the Embedded Signup configuration id is one
          specific thing created once in the App Dashboard. */}
      {status?.connectEnabled && !status?.fullyConfigured && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-foreground">
              {t("app.setWhatsApp.notConfiguredTitle")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.notConfiguredBody")}</p>
        </div>
      )}
      {status?.connectEnabled && status?.fullyConfigured && !status?.signupConfigured && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-foreground">
              {t("app.setWhatsApp.noSignupConfigTitle")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.noSignupConfigBody")}</p>
        </div>
      )}

      {/* State 3 — ready, nothing connected. */}
      {canConnect && channels.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground">
            {t("app.setWhatsApp.notConnectedTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.notConnectedBody")}</p>
          {/* A link, not a fetch: this navigates to Meta, and a navigation is
              the shape a browser handles best. */}
          <a
            href="/api/settings/whatsapp/connect"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground"
          >
            <SocialGlyph platform="whatsapp" size={16} />
            {t("app.setWhatsApp.connect")}
          </a>
        </div>
      )}

      {/* State 4 — connected. */}
      {channels.map((c) => (
        <div key={c.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">
                {c.verifiedName || c.name || t("app.setWhatsApp.numberFallback")}
              </h3>
              {/* The number as Meta prints it, and null when Meta did not tell
                  us — never the phone number id dressed up as a number. */}
              {c.displayPhoneNumber && (
                <p className="text-sm text-muted-foreground">{c.displayPhoneNumber}</p>
              )}
              {c.status !== "connected" && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {t("app.setWhatsApp.needsReauth")}
                </p>
              )}
            </div>
          </div>

          {/* The 24-hour rule, stated where a contractor connects rather than
              discovered in the composer. See this file's header. */}
          <div className="rounded-lg border border-border bg-muted px-3 py-2">
            <p className="text-sm font-semibold text-foreground">
              {t("app.setWhatsApp.windowTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.setWhatsApp.windowBody")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshTemplates}
              disabled={refreshing}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              {t("app.setWhatsApp.refreshTemplates")}
            </button>
            <button
              type="button"
              onClick={() => disconnect(c.id)}
              disabled={disconnectingId === c.id}
              className="min-h-[44px] rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {t("app.setWhatsApp.disconnect")}
            </button>
          </div>

          {/* The templates, with their real status. A REJECTED one is shown
              rather than hidden: "your template was rejected" is the fact the
              contractor needs, and a list that dropped it would look like it
              had never been submitted. */}
          {status?.templates?.length ? (
            <ul className="space-y-1">
              {status.templates.map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-medium text-foreground">{x.name}</span>
                  <span className="text-xs text-muted-foreground">{x.language}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (x.status === "APPROVED"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {x.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.noTemplates")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
