"use client";

// app/components/hr/PolicyReader.js
//
// /app/me/policies: the policies that apply to me. Each opens to its full
// text; the ones that need a signature take a typed name and send the
// version and hash of what was on screen (lib/hr/policies.js
// parseAcknowledgement) so a stale tab cannot sign a superseded text.

import { useCallback, useEffect, useState } from "react";
import { ScrollText, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import PolicyBody from "@/app/components/hr/PolicyBody";

export default function PolicyReader({ onChanged, initialOpenId = null }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [openId, setOpenId] = useState(initialOpenId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/me/policies");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(policy) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/hr/me/policies/${policy.id}/acknowledge`, {
        method: "POST",
        body: { signatureName: name, version: policy.version, bodyHash: policy.bodyHash },
      });
      setName("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const policies = data?.policies || [];
  const pending = policies.filter((p) => p.requiresAcknowledgement && !p.acknowledged);

  return (
    <section className="space-y-3" data-hr-policies>
      {pending.length > 0 && (
        <p className="text-sm rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-4 py-3" data-hr-policies-pending>
          {t("app.hr.policies.pendingBanner", { count: pending.length })}
        </p>
      )}
      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={data !== null && policies.length === 0}
        onRetry={load}
        empty={<p className="text-sm text-muted-foreground">{t("app.hr.policies.noneSelf")}</p>}
      >
        <ul className="space-y-3">
          {policies.map((p) => {
            const open = openId === p.id;
            return (
              <li key={p.id} className="bg-card border border-border rounded-xl" data-hr-policy data-hr-policy-open={open ? "1" : "0"}>
                <button type="button" onClick={() => setOpenId(open ? null : p.id)} className="w-full text-left px-5 py-4 flex items-center gap-3 min-h-[56px]">
                  <ScrollText size={18} className="text-muted-foreground shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("app.hr.policies.version", { version: p.version })} · {t("app.hr.policies.effective", { date: formatDate(p.effectiveFrom) })}
                      {p.acknowledged ? ` · ${t("app.hr.policies.signedOn", { date: formatDate(p.acknowledgedAt) })}` : p.requiresAcknowledgement ? ` · ${p.reacknowledge ? t("app.hr.policies.changedResign") : t("app.hr.policies.needsSignature")}` : ""}
                    </span>
                  </span>
                  {p.acknowledged ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : null}
                  {open ? <ChevronUp size={18} className="text-muted-foreground shrink-0" /> : <ChevronDown size={18} className="text-muted-foreground shrink-0" />}
                </button>
                {open && (
                  <div className="px-5 pb-5 border-t border-border pt-4">
                    <PolicyBody body={p.body} />
                    {p.requiresAcknowledgement && !p.acknowledged && (
                      <form
                        className="mt-5 border-t border-border pt-4 space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          acknowledge(p);
                        }}
                        data-hr-ack-form
                      >
                        <p className="text-sm text-foreground">{t("app.hr.policies.ackStatement")}</p>
                        <label className="block text-sm">
                          <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.policies.typeName")}</span>
                          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px]" autoComplete="name" />
                        </label>
                        {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                        <button type="submit" disabled={busy || !name.trim()} className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold min-h-[44px] disabled:opacity-60" data-hr-ack-submit>
                          {busy ? t("app.hr.policies.signing") : t("app.hr.policies.acknowledge")}
                        </button>
                        <p className="text-xs text-muted-foreground">{t("app.hr.policies.ackAudit")}</p>
                      </form>
                    )}
                    {p.acknowledged && (
                      <p className="mt-4 text-xs text-muted-foreground">{t("app.hr.policies.signedBy", { name: p.signatureName, date: formatDate(p.acknowledgedAt) })}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </ListState>
    </section>
  );
}
