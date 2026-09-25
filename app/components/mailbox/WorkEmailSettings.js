"use client";

// app/components/mailbox/WorkEmailSettings.js
//
// Settings › Work email — "Connect your work email": Google, Microsoft 365,
// or any other host by address and password; then, per connected mailbox,
// its status (connected as, last sync, filed this week, last error), Sync
// now, Reconnect, Disconnect, and — for the company mailbox — the opt-in
// "Send client emails from this mailbox".
//
// Honest states, none of them a dead button:
//   · a route the deployment has not configured says "Not set up yet" and
//     draws no link (the routes refuse too);
//   · a failed login shows the server's precise reason;
//   · before connecting, the card says in words that what is exchanged with
//     clients is filed to the COMPANY's records and that nothing else is kept.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, Mail, RefreshCw, Server, Unplug } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";

// The ?mailbox=<code> an OAuth callback lands with → the banner.
const RESULT_TONE = { connected: "success", sending_on: "success" };
const RESULT_CODES = new Set([
  "connected",
  "sending_on",
  "denied",
  "bad_state",
  "session",
  "read_only",
  "not_configured",
  "exchange_failed",
  "no_refresh_token",
  "scope_missing",
  "send_scope_missing",
  "no_address",
  "company_scope_forbidden",
  "send_company_only",
  "held_by_other",
  "admin_consent_required",
]);

const IMAP_ERROR_CODES = new Set(["auth_failed", "host_not_found", "refused", "timeout", "tls", "plain_refused", "bad_host", "bad_port", "bad_address", "no_password", "unsupported_provider", "held_by_other", "not_configured"]);

function camel(code) {
  return String(code).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function Switch({ checked, onChange, disabled, label, hint }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 mt-0.5 disabled:opacity-50 ${checked ? "bg-inverted" : "bg-accent"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function ProviderIcon({ provider }) {
  if (provider === "imap") return <Server size={16} className="text-foreground" />;
  return <Mail size={16} className="text-foreground" />;
}

function when(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language || undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(value).toISOString();
  }
}

export default function WorkEmailSettings() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [banner, setBanner] = useState(null);
  const [scope, setScope] = useState("member");
  const [imapOpen, setImapOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // mailbox row to disconnect

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const next = await fetchJson("/api/mailbox");
      setData(next);
      if (next.canConnectCompany && !next.mailboxes.some((m) => m.scope === "company" && m.status !== "disconnected")) setScope("company");
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const result = searchParams.get("mailbox");
    if (!result) return;
    const code = RESULT_CODES.has(result) ? result : "unknown";
    setBanner({ tone: RESULT_TONE[code] || "error", text: t(`app.workEmail.result.${camel(code)}`) });
    const next = new URLSearchParams(searchParams.toString());
    next.delete("mailbox");
    router.replace(`${window.location.pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }, [searchParams, router, t]);

  const live = useMemo(() => (data?.mailboxes || []).filter((m) => m.status !== "disconnected"), [data]);
  const past = useMemo(() => (data?.mailboxes || []).filter((m) => m.status === "disconnected"), [data]);

  async function syncNow(m) {
    setBusy(`sync:${m.id}`);
    try {
      const r = await fetchJson(`/api/mailbox/${encodeURIComponent(m.id)}/sync`, { method: "POST" });
      showToast({ message: r.busy ? t("app.workEmail.syncBusy") : t("app.workEmail.syncDone", { filed: r.filed || 0, skipped: r.skipped || 0 }), tone: "success" });
    } catch (err) {
      showError(err.message || t("app.workEmail.syncFailed"));
    } finally {
      setBusy(null);
      load();
    }
  }

  async function disconnect(m) {
    setBusy(`disconnect:${m.id}`);
    try {
      await fetchJson(`/api/mailbox/${encodeURIComponent(m.id)}/disconnect`, { method: "POST" });
      setConfirm(null);
      setBanner({ tone: "success", text: t("app.workEmail.disconnected", { address: m.address }) });
    } catch (err) {
      showError(err.message || t("app.workEmail.disconnectFailed"));
    } finally {
      setBusy(null);
      load();
    }
  }

  async function setSending(m, enabled) {
    setBusy(`send:${m.id}`);
    try {
      const r = await fetchJson(`/api/mailbox/${encodeURIComponent(m.id)}/sending`, { method: "PATCH", body: { enabled } });
      if (r.consentUrl) {
        // Sending needs the provider's own consent to one more permission.
        window.location.href = r.consentUrl;
        return;
      }
      showToast({ message: enabled ? t("app.workEmail.send.on", { address: m.address }) : t("app.workEmail.send.off"), tone: "success" });
    } catch (err) {
      showError(err.code && IMAP_ERROR_CODES.has(err.code) ? `${t(`app.workEmail.error.${camel(err.code)}`)} ${err.message}` : err.message || t("app.workEmail.send.failed"));
    } finally {
      setBusy(null);
      load();
    }
  }

  function reconnectHref(m) {
    if (m.provider === "google") return `/api/mailbox/google/connect?scope=${m.scope}`;
    if (m.provider === "microsoft") return `/api/mailbox/microsoft/connect?scope=${m.scope}&hint=${encodeURIComponent(m.address)}`;
    return null;
  }

  const readOnly = Boolean(data?.readOnly);

  return (
    <div className="space-y-6">
      {banner && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            banner.tone === "success" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          }`}
        >
          {banner.tone === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{banner.text}</span>
        </div>
      )}

      {loadFailed ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t("app.workEmail.loadFailed")}</span>
          <button type="button" onClick={load} className="min-h-[44px] px-3 rounded-lg border border-border text-foreground">
            {t("app.action.retry")}
          </button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> {t("app.common.loading")}
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <section className="glass-effect rounded-xl p-5 space-y-4" aria-labelledby="work-email-connected">
              <h2 id="work-email-connected" className="text-base font-semibold text-foreground">
                {t("app.workEmail.connectedTitle")}
              </h2>
              {data.sendingFrom && <p className="text-sm text-muted-foreground">{t("app.workEmail.send.sendingFrom", { address: data.sendingFrom })}</p>}
              <ul className="space-y-4">
                {live.map((m) => (
                  <li key={m.id} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <ProviderIcon provider={m.provider} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground break-all">{t("app.workEmail.connectedAs", { address: m.address })}</div>
                          <div className="text-xs text-muted-foreground">
                            {t(`app.workEmail.provider.${m.provider}`)} ·{" "}
                            {m.scope === "company" ? t("app.workEmail.scope.company") : m.isMine ? t("app.workEmail.scope.mine") : t("app.workEmail.scope.memberOf", { name: m.memberName || "—" })}
                          </div>
                        </div>
                      </div>
                      {(m.isMine || data.canConnectCompany) && !readOnly && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => syncNow(m)}
                            disabled={Boolean(busy)}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border text-sm text-foreground disabled:opacity-50"
                          >
                            {busy === `sync:${m.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("app.workEmail.syncNow")}
                          </button>
                          {reconnectHref(m) ? (
                            <a href={reconnectHref(m)} className="inline-flex items-center min-h-[40px] px-3 rounded-lg border border-border text-sm text-foreground">
                              {t("app.workEmail.reconnect")}
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setScope(m.scope);
                                setImapOpen({ address: m.address, preset: m.preset, imapHost: m.imapHost, imapPort: m.imapPort, smtpHost: m.smtpHost });
                              }}
                              className="inline-flex items-center min-h-[40px] px-3 rounded-lg border border-border text-sm text-foreground"
                            >
                              {t("app.workEmail.reconnect")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirm(m)}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-border text-sm text-red-700 dark:text-red-400"
                          >
                            <Unplug size={14} /> {t("app.workEmail.disconnect")}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>
                        {m.syncing
                          ? t("app.workEmail.syncing")
                          : m.lastSyncAt
                            ? t("app.workEmail.lastSync", { when: when(m.lastSyncAt, language) })
                            : t("app.workEmail.neverSynced")}
                      </div>
                      <div>{t("app.workEmail.filedThisWeek", { n: m.filedThisWeek ?? 0 })}</div>
                      <div>{t("app.workEmail.totals", { filed: m.filedCount, skipped: m.skippedCount })}</div>
                    </div>

                    {m.lastError && (
                      <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>
                          {t("app.workEmail.lastError", { when: when(m.lastErrorAt, language) })} {m.lastError}
                        </span>
                      </div>
                    )}

                    {m.scope === "company" && data.canConnectCompany && (
                      <div className="border-t border-border pt-2">
                        <Switch
                          checked={m.sendEnabled}
                          disabled={Boolean(busy) || readOnly}
                          onChange={(v) => setSending(m, v)}
                          label={t("app.workEmail.send.label")}
                          hint={
                            m.provider === "google"
                              ? t("app.workEmail.send.hintGoogle")
                              : m.provider === "microsoft"
                                ? t("app.workEmail.send.hintMicrosoft")
                                : t("app.workEmail.send.hintImap")
                          }
                        />
                        {m.sendEnabled && m.lastSendFallbackAt && (!m.lastSentAt || new Date(m.lastSendFallbackAt) > new Date(m.lastSentAt)) && (
                          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <span>{t("app.workEmail.send.fallback", { reason: m.lastSendFallbackReason || "", when: when(m.lastSendFallbackAt, language) })}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="glass-effect rounded-xl p-5 space-y-4" aria-labelledby="work-email-connect">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Inbox size={18} className="text-foreground" />
              </span>
              <div className="min-w-0">
                <h2 id="work-email-connect" className="text-base font-semibold text-foreground">
                  {t("app.workEmail.connectTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("app.workEmail.connectPromise")}</p>
              </div>
            </div>

            {/* Said BEFORE anybody connects — the owner's rule. */}
            <p className="text-sm text-foreground rounded-lg border border-border px-3 py-2">{t("app.workEmail.companyRecordsNotice")}</p>

            {readOnly ? (
              <p className="text-sm text-muted-foreground">{t("app.workEmail.readOnly")}</p>
            ) : !data.providers.keyConfigured ? (
              <p className="text-sm text-muted-foreground">{t("app.workEmail.keyMissing")}</p>
            ) : (
              <>
                {data.canConnectCompany && (
                  <fieldset className="space-y-1">
                    <legend className="text-sm font-medium text-foreground">{t("app.workEmail.whichMailbox")}</legend>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input type="radio" name="mailbox-scope" checked={scope === "company"} onChange={() => setScope("company")} className="mt-1" />
                      <span>
                        {t("app.workEmail.scope.companyOption")}
                        <span className="block text-xs text-muted-foreground">{t("app.workEmail.scope.companyHint")}</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input type="radio" name="mailbox-scope" checked={scope === "member"} onChange={() => setScope("member")} className="mt-1" />
                      <span>
                        {t("app.workEmail.scope.mineOption")}
                        <span className="block text-xs text-muted-foreground">{t("app.workEmail.scope.mineHint")}</span>
                      </span>
                    </label>
                  </fieldset>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ProviderOption
                    title={t("app.workEmail.provider.google")}
                    hint={t("app.workEmail.googleHint")}
                    available={data.providers.google.available}
                    missing={data.providers.google.missing}
                    href={`/api/mailbox/google/connect?scope=${scope}`}
                    t={t}
                  />
                  <ProviderOption
                    title={t("app.workEmail.provider.microsoft")}
                    hint={t("app.workEmail.microsoftHint")}
                    available={data.providers.microsoft.available}
                    missing={data.providers.microsoft.missing}
                    href={`/api/mailbox/microsoft/connect?scope=${scope}`}
                    t={t}
                  />
                  <div className="border border-border rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium text-foreground">{t("app.workEmail.provider.imap")}</div>
                    <p className="text-xs text-muted-foreground">{t("app.workEmail.imapHint")}</p>
                    <button
                      type="button"
                      onClick={() => setImapOpen(imapOpen ? false : {})}
                      className="inline-flex items-center min-h-[40px] px-3 rounded-lg bg-inverted text-inverted-foreground text-sm font-medium"
                    >
                      {t("app.workEmail.imapOpen")}
                    </button>
                  </div>
                </div>

                {imapOpen && (
                  <ImapForm
                    initial={imapOpen}
                    presets={data.presets}
                    scope={scope}
                    providers={data.providers}
                    t={t}
                    onDone={(address) => {
                      setImapOpen(false);
                      setBanner({ tone: "success", text: t("app.workEmail.result.connectedImap", { address }) });
                      load();
                    }}
                  />
                )}
              </>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">{t("app.workEmail.pastTitle")}</h3>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {past.map((m) => (
                  <li key={m.id}>{t("app.workEmail.pastRow", { address: m.address, when: when(m.disconnectedAt, language), filed: m.filedCount })}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && disconnect(confirm)}
        busy={Boolean(busy)}
        title={t("app.workEmail.disconnectTitle")}
        message={t("app.workEmail.disconnectMessage")}
        itemName={confirm?.address || ""}
      />
    </div>
  );
}

function ProviderOption({ title, hint, available, missing, href, t }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {available ? (
        <a href={href} className="inline-flex items-center min-h-[40px] px-3 rounded-lg bg-inverted text-inverted-foreground text-sm font-medium">
          {t("app.workEmail.connect")}
        </a>
      ) : (
        // No link: the connect route refuses too. Which variable is missing
        // is named, so the owner knows what to set.
        <p className="text-xs text-amber-900 dark:text-amber-200">{t("app.workEmail.notSetUp", { missing: (missing || []).join(", ") })}</p>
      )}
    </div>
  );
}

function ImapForm({ initial, presets, scope, providers, t, onDone }) {
  const [address, setAddress] = useState(initial?.address || "");
  const [password, setPassword] = useState("");
  const [preset, setPreset] = useState(initial?.preset || "");
  const [imapHost, setImapHost] = useState(initial?.imapHost || "");
  const [imapPort, setImapPort] = useState(initial?.imapPort ? String(initial.imapPort) : "993");
  const [imapSecurity, setImapSecurity] = useState("tls");
  const [smtpHost, setSmtpHost] = useState(initial?.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpSecurity, setSmtpSecurity] = useState("tls");
  const [loginName, setLoginName] = useState("");
  const [detected, setDetected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const current = presets.find((p) => p.key === preset) || null;
  const editableHost = !current || current.key === "custom" || current.hostPattern;

  function applyPreset(key, addr = address) {
    setPreset(key);
    const p = presets.find((x) => x.key === key);
    if (!p || p.route !== "imap") return;
    const domain = String(addr || "").split("@")[1] || "";
    const fill = (h) => (h ? h.replace("{domain}", domain || "yourdomain.com") : "");
    setImapHost(fill(p.imapHost));
    setImapPort(String(p.imapPort || 993));
    setImapSecurity(p.imapSecurity || "tls");
    setSmtpHost(fill(p.smtpHost));
    setSmtpPort(String(p.smtpPort || 465));
    setSmtpSecurity(p.smtpSecurity || "tls");
  }

  async function detect() {
    const addr = address.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return;
    try {
      const r = await fetchJson("/api/mailbox/detect", { method: "POST", body: { address: addr } });
      setDetected(r);
      if (r.preset) applyPreset(r.preset, addr);
    } catch {
      setDetected(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await fetchJson("/api/mailbox/imap", {
        method: "POST",
        body: {
          address: address.trim(),
          password,
          preset: preset || "custom",
          imapHost,
          imapPort: Number(imapPort),
          imapSecurity,
          smtpHost,
          smtpPort: smtpHost ? Number(smtpPort) : null,
          smtpSecurity,
          loginName: loginName.trim() || null,
          scope,
        },
      });
      setPassword("");
      onDone(address.trim());
    } catch (err) {
      const headline = err.code && IMAP_ERROR_CODES.has(err.code) ? t(`app.workEmail.error.${camel(err.code)}`) : t("app.workEmail.error.other");
      setError({ headline, detail: err.message || "" });
    } finally {
      setSaving(false);
    }
  }

  const route = detected?.route;
  const routeProvider = route === "google" || route === "microsoft" ? route : null;
  const inputCls = "w-full min-h-[40px] px-3 rounded-lg border border-border bg-card text-sm text-foreground";

  return (
    <form onSubmit={submit} className="border border-border rounded-lg p-4 space-y-3" autoComplete="off">
      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="imap-address">
          {t("app.workEmail.form.address")}
        </label>
        <input id="imap-address" type="email" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} onBlur={detect} required />
        {detected?.label && <p className="text-xs text-muted-foreground mt-1">{t("app.workEmail.form.detected", { provider: detected.label })}</p>}
        {routeProvider && (
          <p className="text-xs text-amber-900 dark:text-amber-200 mt-1">
            {providers?.[routeProvider]?.available ? (
              <>
                {t(`app.workEmail.form.useOAuth.${routeProvider}`)}{" "}
                <a className="underline" href={`/api/mailbox/${routeProvider}/connect?scope=${scope}${routeProvider === "microsoft" ? `&hint=${encodeURIComponent(address.trim())}` : ""}`}>
                  {t("app.workEmail.connect")}
                </a>
              </>
            ) : (
              t(`app.workEmail.form.useOAuthNotSetUp.${routeProvider}`)
            )}
          </p>
        )}
        {route === "unsupported" && <p className="text-xs text-amber-900 dark:text-amber-200 mt-1">{t(detected.noteKey || "app.workEmail.form.unsupported")}</p>}
        {/* A provider known by the address but not its server (@rr.com → Spectrum, one of two): the note asks which. */}
        {route === "imap" && !detected?.preset && detected?.noteKey && <p className="text-xs text-muted-foreground mt-1">{t(detected.noteKey)}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="imap-preset">
          {t("app.workEmail.form.provider")}
        </label>
        <select id="imap-preset" className={inputCls} value={preset} onChange={(e) => applyPreset(e.target.value)}>
          <option value="">{t("app.workEmail.form.choose")}</option>
          {presets
            .filter((p) => p.route === "imap")
            .map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          <option value="custom">{t("app.workEmail.form.custom")}</option>
        </select>
        {current?.noteKey && <p className="text-xs text-muted-foreground mt-1">{t(current.noteKey)}</p>}
        {preset === "custom" && <p className="text-xs text-muted-foreground mt-1">{t("app.workEmail.note.otherHosts")}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground" htmlFor="imap-host">{t("app.workEmail.form.imapHost")}</label>
          <input id="imap-host" className={inputCls} value={imapHost} onChange={(e) => setImapHost(e.target.value)} readOnly={!editableHost} required />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground" htmlFor="imap-port">{t("app.workEmail.form.port")}</label>
          <input id="imap-port" inputMode="numeric" className={inputCls} value={imapPort} onChange={(e) => setImapPort(e.target.value.replace(/\D/g, ""))} readOnly={!editableHost} required />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-muted-foreground" htmlFor="imap-sec">{t("app.workEmail.form.security")}</label>
          <select id="imap-sec" className={inputCls} value={imapSecurity} onChange={(e) => setImapSecurity(e.target.value)} disabled={!editableHost}>
            <option value="tls">{t("app.workEmail.form.tls")}</option>
            <option value="starttls">{t("app.workEmail.form.starttls")}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground" htmlFor="smtp-host">{t("app.workEmail.form.smtpHost")}</label>
          <input id="smtp-host" className={inputCls} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} readOnly={!editableHost} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground" htmlFor="smtp-port">{t("app.workEmail.form.port")}</label>
          <input id="smtp-port" inputMode="numeric" className={inputCls} value={smtpPort} onChange={(e) => setSmtpPort(e.target.value.replace(/\D/g, ""))} readOnly={!editableHost} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-muted-foreground" htmlFor="smtp-sec">{t("app.workEmail.form.security")}</label>
          <select id="smtp-sec" className={inputCls} value={smtpSecurity} onChange={(e) => setSmtpSecurity(e.target.value)} disabled={!editableHost}>
            <option value="tls">{t("app.workEmail.form.tls")}</option>
            <option value="starttls">{t("app.workEmail.form.starttls")}</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">{t("app.workEmail.form.smtpWhy")}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground" htmlFor="imap-password">
          {t("app.workEmail.form.password")}
        </label>
        <input id="imap-password" type="password" autoComplete="new-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="text-xs text-muted-foreground mt-1">{t("app.workEmail.form.passwordSafety")}</p>
      </div>

      <details>
        <summary className="text-xs text-muted-foreground cursor-pointer">{t("app.workEmail.form.advanced")}</summary>
        <label className="block text-xs text-muted-foreground mt-2" htmlFor="imap-login">{t("app.workEmail.form.loginName")}</label>
        <input id="imap-login" className={inputCls} value={loginName} onChange={(e) => setLoginName(e.target.value)} />
      </details>

      {error && (
        <div role="alert" className="rounded-lg px-3 py-2 text-sm bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">{error.headline}</div>
          {error.detail && <div className="text-xs mt-0.5">{error.detail}</div>}
        </div>
      )}

      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-inverted text-inverted-foreground text-sm font-medium disabled:opacity-50">
        {saving && <Loader2 size={14} className="animate-spin" />} {t("app.workEmail.form.submit")}
      </button>
    </form>
  );
}
