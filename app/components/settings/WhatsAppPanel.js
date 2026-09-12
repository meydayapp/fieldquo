"use client";

// app/components/settings/WhatsAppPanel.js
//
// The contractor's own WhatsApp Business number, connected here and answered
// in /app/messages beside their Facebook and Instagram conversations.
//
// ── The one thing this panel must not do ──────────────────────────────────
//
// Render a Connect button while `whatsapp_business_messaging` is unapproved.
// Wherever `connectEnabled` is false (lib/meta/client.js's metaWhatsAppEnabled:
// off until the approval lands or FieldQuo's own switch is set) this panel
// says exactly that — a sentence a contractor can act on ("nothing for you to
// do yet"), not a button that would take them to a signup flow Meta refuses. The server half of the same rule is
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
//
// ── The second door: pasted Cloud API credentials ─────────────────────────
//
// Embedded Signup is shut until Meta's Access Verification of FieldQuo's app
// lands, and Meta's own guide says what an app admin can do meanwhile:
// WhatsApp → API Setup, a system user, a permanent token. The collapsed
// "advanced" section below the sign-up button takes those three values and
// posts them to app/api/settings/whatsapp/manual, which proves the token
// against Meta before storing anything. Collapsed, because for every company
// that is NOT the one running the Meta app it is the wrong door — the
// sign-up button is the one Meta wants them through — and an open form with
// three cryptic fields would be the thing the eye lands on first.
//
// The token field is a password input with autocomplete off, is never
// echoed back (the route returns publicChannelShape, which has no token
// field), and is cleared from state the moment the request returns.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
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
  // The pasted-credential door's own refusals (app/api/settings/whatsapp/
  // manual). Same table, because the two doors share most of a vocabulary
  // and a code both can return must read the same whichever door sent it.
  bad_waba_id: "app.setWhatsApp.errorBadWabaId",
  bad_phone_number_id: "app.setWhatsApp.errorBadPhoneNumberId",
  same_ids: "app.setWhatsApp.errorSameIds",
  bad_token: "app.setWhatsApp.errorBadToken",
  wrong_app: "app.setWhatsApp.errorWrongApp",
  missing_scope: "app.setWhatsApp.errorMissingScope",
  number_not_on_waba: "app.setWhatsApp.errorNumberNotOnWaba",
  network: "app.setWhatsApp.errorNetwork",
};

/** Meta's own walk-through of exactly the steps the advanced section lists. */
const META_GET_STARTED_URL = "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started";

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
  // The advanced section. `manualError` is its own line rather than the
  // panel-wide `error`, so a refusal sits under the field it is about.
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ wabaId: "", phoneNumberId: "", accessToken: "" });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");

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

  async function connectManually(e) {
    e.preventDefault();
    setManualBusy(true);
    setManualError("");
    setBanner(null);
    try {
      await fetchJson("/api/settings/whatsapp/manual", {
        method: "POST",
        body: {
          wabaId: manual.wabaId,
          phoneNumberId: manual.phoneNumberId,
          accessToken: manual.accessToken,
        },
      });
      setManual({ wabaId: "", phoneNumberId: "", accessToken: "" });
      setManualOpen(false);
      setBanner({ tone: "success", text: t("app.setWhatsApp.connectedBanner") });
      await loadStatus();
    } catch (err) {
      // The route's own code first — it knows WHY — and its English sentence
      // only for a code this table has no line for. The token is dropped
      // either way: a refused paste is not kept around for a retry that
      // would send the same wrong thing.
      setManualError(ERROR_KEYS[err.code] ? t(ERROR_KEYS[err.code]) : err.message);
      setManual((m) => ({ ...m, accessToken: "" }));
    } finally {
      setManualBusy(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse h-40 bg-muted rounded-xl" />;
  }

  const channels = status?.channels || [];
  const canConnect = Boolean(
    status?.connectEnabled && status?.fullyConfigured && status?.signupConfigured,
  );
  // The pasted-credential door needs the flag and the credentials, but NOT
  // the Embedded Signup configuration — that is the one thing it exists to
  // do without. Withheld under a support session: the route would refuse the
  // POST (non-negotiable #3), and a form that would be refused is not drawn.
  const canManual = Boolean(
    status?.connectEnabled && status?.fullyConfigured && !status?.readOnly,
  );

  // A function rather than a component so it closes over this panel's state
  // without a second round of props, and so it can be placed in two of the
  // cards above without being mounted twice.
  const manualSection = () => (
    <div className="rounded-lg border border-border bg-muted/30" data-whatsapp-manual>
      <button
        type="button"
        onClick={() => setManualOpen((o) => !o)}
        aria-expanded={manualOpen}
        className="flex w-full min-h-[44px] items-center gap-2 px-3 py-2.5 text-left"
      >
        {manualOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <KeyRound size={15} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">
          {t("app.setWhatsApp.manual.toggle")}
        </span>
      </button>

      {manualOpen && (
        <form onSubmit={connectManually} className="space-y-3 px-4 pb-4 pt-1">
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.manual.intro")}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("app.setWhatsApp.manual.step1")}</li>
            <li>{t("app.setWhatsApp.manual.step2")}</li>
            <li>{t("app.setWhatsApp.manual.step3")}</li>
          </ol>
          <a
            href={META_GET_STARTED_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2"
          >
            {t("app.setWhatsApp.manual.guideLink")}
            <ExternalLink size={13} aria-hidden="true" />
          </a>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {t("app.setWhatsApp.manual.wabaId")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={manual.wabaId}
              onChange={(e) => setManual((m) => ({ ...m, wabaId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {t("app.setWhatsApp.manual.phoneNumberId")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={manual.phoneNumberId}
              onChange={(e) => setManual((m) => ({ ...m, phoneNumberId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {t("app.setWhatsApp.manual.token")}
            </span>
            {/* A password field: the token is a credential, and a credential
                is not shown on a screen someone is sharing. Autocomplete
                off, because a browser offering to save it into its password
                store is a second copy nobody asked for. */}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={manual.accessToken}
              onChange={(e) => setManual((m) => ({ ...m, accessToken: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              required
              data-whatsapp-token
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {t("app.setWhatsApp.manual.tokenHint")}
            </span>
          </label>

          {manualError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{manualError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={manualBusy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground disabled:opacity-50"
          >
            {manualBusy ? t("app.setWhatsApp.manual.submitting") : t("app.setWhatsApp.manual.submit")}
          </button>
        </form>
      )}
    </div>
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
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-muted-foreground shrink-0" />
            <h3 className="font-semibold text-foreground">
              {t("app.setWhatsApp.noSignupConfigTitle")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("app.setWhatsApp.noSignupConfigBody")}</p>
          {/* No sign-up configuration is exactly the case the second door
              covers, so it is offered here too and not only under the
              sign-up button. */}
          {canManual && channels.length === 0 && manualSection()}
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
          {canManual && manualSection()}
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
              {/* Which door, then the number: "Connected via API credentials
                  · +1 555 …". The door is printed only when the row recorded
                  one — a row written before the column existed says nothing
                  rather than guessing. */}
              {(c.connectedVia || c.displayPhoneNumber) && (
                <p className="text-sm text-muted-foreground">
                  {[
                    c.connectedVia === "manual"
                      ? t("app.setWhatsApp.viaManual")
                      : c.connectedVia === "embedded_signup"
                        ? t("app.setWhatsApp.viaSignup")
                        : null,
                    c.displayPhoneNumber,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
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
