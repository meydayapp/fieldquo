// app/app/settings/agency-access/page.js
//
// Settings › Marketing agency access (owner, 2026-10-05): give the marketing
// agency the company works with its marketing results — leads, appointments,
// closes, revenue against ad spend — so it can optimise the ads against what
// actually closed. The agency connects through FieldQuo's Zapier app or the
// API (/developers/marketing-api) with a key created here.
//
// What the page has to say out loud, because a reader would otherwise assume
// the opposite of each:
//
//   * a key is shown ONCE — FieldQuo keeps only a fingerprint of it;
//   * clients' contact details are NOT shared unless the switch says so
//     (default off); job values ARE shared unless it says not (default on);
//   * a key is read-only unless "may add and update leads" was ticked, and no
//     key can ever message a client;
//   * revoking stops the key at once and ends its Zaps' subscriptions.
//
// Owner/admin manage it (lib/agency/settings.js). A support session sees it
// read-only — the console views everything and edits nothing.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Copy, Check, ShieldCheck, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel, ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";

export default function AgencyAccessPage() {
  const access = useSettingsAccess();
  if (!access.canSee("owner-admin")) return <NoAccessPanel capability="billing" />;
  return <AgencyAccess />;
}

function Toggle({ checked, disabled, onChange, label, hint, busy }) {
  return (
    <label className={`flex items-start gap-3 py-3 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-current"
        checked={checked}
        disabled={disabled || busy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
      </span>
    </label>
  );
}

function AgencyAccess() {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [writeLeads, setWriteLeads] = useState(false);
  const [secret, setSecret] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/agency-access"));
      setLoadError("");
    } catch (err) {
      setLoadError(errorText(t, err));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = Boolean(data?.canManage);

  async function setSharing(patch) {
    setBusy("sharing");
    setError("");
    try {
      const res = await fetchJson("/api/settings/agency-access", { method: "PATCH", body: patch });
      setData((d) => ({ ...d, sharing: res.sharing }));
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function createKey(e) {
    e.preventDefault();
    setBusy("create");
    setError("");
    try {
      const res = await fetchJson("/api/settings/agency-access/keys", { method: "POST", body: { name, writeLeads } });
      setSecret({ value: res.secret, name: res.key.name });
      setCopied(false);
      setName("");
      setWriteLeads(false);
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function revoke(key) {
    if (!window.confirm(t("app.agencyAccess.revokeConfirm", { name: key.name }))) return;
    setBusy(`revoke:${key.id}`);
    setError("");
    try {
      await fetchJson(`/api/settings/agency-access/keys/${key.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const live = (data?.keys || []).filter((k) => !k.revokedAt);
  const revoked = (data?.keys || []).filter((k) => k.revokedAt);

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <KeyRound size={20} className="shrink-0" /> {t("app.agencyAccess.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.agencyAccess.intro")}</p>
        <Link href="/developers/marketing-api" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline mt-2">
          {t("app.agencyAccess.docsLink")} <ExternalLink size={13} />
        </Link>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {loadError}{" "}
          <button type="button" onClick={load} className="underline font-medium">
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      )}
      {!data && !loadError && <div className="h-40 rounded-xl bg-muted animate-pulse" />}

      {data && (
        <>
          {!canManage && <ReadOnlyNotice capability="billing" />}
          {error && (
            <div role="alert" className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
              {error}
            </div>
          )}

          {/* ── What the agency sees ───────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck size={16} /> {t("app.agencyAccess.sharingTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{t("app.agencyAccess.sharingAlways")}</p>
            <div className="divide-y divide-border mt-1">
              <Toggle
                checked={data.sharing.contactDetails}
                disabled={!canManage}
                busy={busy === "sharing"}
                onChange={(v) => setSharing({ contactDetails: v })}
                label={t("app.agencyAccess.shareContacts")}
                hint={t("app.agencyAccess.shareContactsHint")}
              />
              <Toggle
                checked={data.sharing.jobValues}
                disabled={!canManage}
                busy={busy === "sharing"}
                onChange={(v) => setSharing({ jobValues: v })}
                label={t("app.agencyAccess.shareMoney")}
                hint={t("app.agencyAccess.shareMoneyHint")}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t("app.agencyAccess.sharingLogged")}</p>
          </section>

          {/* ── A new key, shown once ──────────────────────────────────── */}
          {secret && (
            <section className="rounded-xl border-2 border-foreground px-5 py-4 space-y-2" aria-live="polite">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TriangleAlert size={16} /> {t("app.agencyAccess.secretTitle", { name: secret.name })}
              </div>
              <p className="text-xs text-muted-foreground">{t("app.agencyAccess.secretOnce")}</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <code className="flex-1 min-w-0 break-all rounded-lg bg-muted px-3 py-2 text-xs text-foreground select-all">{secret.value}</code>
                <button type="button" onClick={copySecret} className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium text-foreground">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("app.agencyAccess.copied") : t("app.agencyAccess.copy")}
                </button>
              </div>
              <button type="button" onClick={() => setSecret(null)} className="text-xs underline text-muted-foreground">
                {t("app.agencyAccess.secretDone")}
              </button>
            </section>
          )}

          {canManage && (
            <form onSubmit={createKey} className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t("app.agencyAccess.createTitle")}</h2>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.agencyAccess.nameLabel")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder={t("app.agencyAccess.namePlaceholder")}
                  className="w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </label>
              <Toggle
                checked={writeLeads}
                onChange={setWriteLeads}
                label={t("app.agencyAccess.writeLeads")}
                hint={t("app.agencyAccess.writeLeadsHint")}
              />
              <p className="text-xs text-muted-foreground">{t("app.agencyAccess.noMessaging")}</p>
              <button
                type="submit"
                disabled={busy === "create" || !name.trim()}
                className="inline-flex items-center gap-2 min-h-[44px] rounded-lg bg-inverted text-inverted-foreground px-4 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "create" && <Loader2 size={14} className="animate-spin" />} {t("app.agencyAccess.create")}
              </button>
            </form>
          )}

          {/* ── The keys ───────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border text-sm font-semibold text-foreground">{t("app.agencyAccess.keysTitle")}</div>
            {live.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">{t("app.agencyAccess.noKeys")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {live.map((k) => (
                  <li key={k.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground break-words">
                        {k.name} <span className="text-xs text-muted-foreground font-normal">…{k.hint}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {k.scopes.includes("marketing:write_leads") ? t("app.agencyAccess.scopeWrite") : t("app.agencyAccess.scopeRead")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("app.agencyAccess.createdBy", { who: k.createdByName || "—", when: formatDateTime(k.createdAt) })}
                        {" · "}
                        {k.lastUsedAt ? t("app.agencyAccess.lastUsed", { when: formatDateTime(k.lastUsedAt) }) : t("app.agencyAccess.neverUsed")}
                        {" · "}
                        {t("app.agencyAccess.calls7d", { count: k.callsLast7Days })}
                      </div>
                      {k.liveSubscriptions.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5 break-words">
                          {t("app.agencyAccess.liveHooks", { events: k.liveSubscriptions.join(", ") })}
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => revoke(k)}
                        disabled={busy === `revoke:${k.id}`}
                        className="self-start min-h-[44px] rounded-lg border border-border px-3 text-sm font-medium text-foreground disabled:opacity-60"
                      >
                        {t("app.agencyAccess.revoke")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {revoked.length > 0 && (
              <details className="border-t border-border px-5 py-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">{t("app.agencyAccess.revokedTitle", { count: revoked.length })}</summary>
                <ul className="mt-2 space-y-1">
                  {revoked.map((k) => (
                    <li key={k.id} className="text-xs text-muted-foreground break-words">
                      {k.name} …{k.hint} — {t("app.agencyAccess.revokedBy", { who: k.revokedByName || "—", when: formatDateTime(k.revokedAt) })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* ── Every call, per key ────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-sm font-semibold text-foreground">{t("app.agencyAccess.callsTitle")}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{t("app.agencyAccess.callsHint")}</p>
            </div>
            {data.recentCalls.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">{t("app.agencyAccess.noCalls")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border">
                    {data.recentCalls.map((c, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(c.at)}</td>
                        <td className="px-2 py-2 text-foreground whitespace-nowrap">{c.keyName}</td>
                        <td className="px-2 py-2 text-foreground font-mono break-all">
                          {c.method} {c.path}
                        </td>
                        <td className={`px-5 py-2 whitespace-nowrap font-medium ${c.status >= 400 ? "text-foreground underline" : "text-muted-foreground"}`}>{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
