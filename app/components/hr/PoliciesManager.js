"use client";

// app/components/hr/PoliciesManager.js
//
// Settings → Policies. The list with signature counts; an editor that
// starts blank or from a starter (content/hr/policies, in the reader's
// language); a detail view with who has and hasn't signed, a Remind
// button, and the version history. A body edit after anybody has signed
// makes a new version — the screen says so before the save, so nobody is
// surprised that twenty people are asked again.

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Plus, Bell, Archive, Users } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import PolicyBody from "@/app/components/hr/PolicyBody";

const inputClass = "border border-border rounded-lg px-3 py-2 bg-card min-h-[44px] text-sm w-full";

export default function PoliciesManager() {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [detail, setDetail] = useState(null); // { policy, report, versions }
  const [editing, setEditing] = useState(null); // { id?, title, body, requiresAcknowledgement, audienceTitles, templateKey }
  const [templates, setTemplates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/policies");
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

  async function openDetail(policy) {
    setError("");
    setNotice("");
    try {
      const d = await fetchJson(`/api/hr/policies/${policy.id}`);
      setDetail(d);
      setEditing(null);
    } catch (err) {
      setError(errorText(t, err));
    }
  }

  async function loadTemplates() {
    if (templates) return templates;
    const res = await fetchJson(`/api/hr/policies/templates?lang=${encodeURIComponent(language || "en")}`);
    setTemplates(res.templates);
    return res.templates;
  }

  function startNew(fromTemplate = null) {
    setDetail(null);
    setError("");
    setEditing({
      title: fromTemplate?.title || "",
      body: fromTemplate?.body || "",
      requiresAcknowledgement: true,
      audienceTitles: [],
      templateKey: fromTemplate?.key || null,
    });
  }

  function startEdit(policy) {
    setError("");
    setEditing({ id: policy.id, title: policy.title, body: policy.body, requiresAcknowledgement: policy.requiresAcknowledgement, audienceTitles: policy.audienceTitles || [], version: policy.version, signed: detail?.report?.counts?.acknowledged || 0 });
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = { title: editing.title, body: editing.body, requiresAcknowledgement: editing.requiresAcknowledgement, audienceTitles: editing.audienceTitles, templateKey: editing.templateKey };
      let saved;
      if (editing.id) {
        const res = await fetchJson(`/api/hr/policies/${editing.id}`, { method: "PATCH", body });
        saved = res.policy;
        setNotice(res.newVersion ? t("app.hr.policies.newVersionSaved", { version: saved.version }) : t("app.hr.policies.saved"));
      } else {
        const res = await fetchJson("/api/hr/policies", { method: "POST", body });
        saved = res.policy;
        setNotice(t("app.hr.policies.published"));
      }
      setEditing(null);
      await load();
      await openDetail(saved);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function remind(policy) {
    setBusy(true);
    setError("");
    try {
      const res = await fetchJson(`/api/hr/policies/${policy.id}/remind`, { method: "POST", body: {} });
      setNotice(t("app.hr.policies.reminded", { count: res.told, noLogin: res.noLogin }));
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function archive(policy) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/hr/policies/${policy.id}`, { method: "PATCH", body: { archived: true } });
      setDetail(null);
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const policies = data?.policies || [];
  const jobTitles = data?.jobTitles || [];

  return (
    <div className="space-y-4" data-hr-policies-manager>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="text-sm rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-4 py-2">{notice}</p>}

      {!editing && !detail && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => startNew(null)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]">
            <Plus size={14} /> {t("app.hr.policies.new")}
          </button>
          <StarterMenu t={t} loadTemplates={loadTemplates} onPick={(tpl) => startNew(tpl)} />
        </div>
      )}

      {editing && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-hr-policy-form>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.policies.titleLabel")}</span>
            <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.policies.bodyLabel")}</span>
            <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={14} className="w-full border border-border rounded-lg px-3 py-2 bg-card text-sm font-mono" />
            <span className="block text-xs text-muted-foreground mt-1">{t("app.hr.policies.markdownHint")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.requiresAcknowledgement} onChange={(e) => setEditing({ ...editing, requiresAcknowledgement: e.target.checked })} />
            {t("app.hr.policies.requiresAck")}
          </label>
          <div className="text-sm">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.policies.audience")}</span>
            <label className="flex items-center gap-2 mb-1">
              <input type="radio" checked={editing.audienceTitles.length === 0} onChange={() => setEditing({ ...editing, audienceTitles: [] })} />
              {t("app.hr.policies.everyone")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={editing.audienceTitles.length > 0} disabled={jobTitles.length === 0} onChange={() => setEditing({ ...editing, audienceTitles: jobTitles.slice(0, 1) })} />
              {t("app.hr.policies.byTitle")}
            </label>
            {jobTitles.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">{t("app.hr.policies.noTitles")}</p>
            ) : (
              editing.audienceTitles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {jobTitles.map((title) => {
                    const on = editing.audienceTitles.includes(title);
                    return (
                      <button key={title} type="button" onClick={() => setEditing({ ...editing, audienceTitles: on ? editing.audienceTitles.filter((x) => x !== title) : [...editing.audienceTitles, title] })} className={`text-xs rounded-full border px-3 py-1.5 min-h-[36px] ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                        {title}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
          {editing.id && editing.signed > 0 && <p className="text-xs rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-3 py-2">{t("app.hr.policies.versionWarning", { count: editing.signed })}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || !editing.title.trim() || !editing.body.trim()} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
              {editing.id ? t("app.hr.policies.save") : t("app.hr.policies.publish")}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="border border-border rounded-full px-4 py-2 text-sm min-h-[44px]">
              {t("app.action.cancel")}
            </button>
          </div>
        </div>
      )}

      {detail && !editing && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-hr-policy-detail>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <ScrollText size={16} /> {detail.policy.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("app.hr.policies.version", { version: detail.policy.version })} · {t("app.hr.policies.effective", { date: formatDate(detail.policy.effectiveFrom) })} ·{" "}
                {detail.policy.audienceTitles?.length ? detail.policy.audienceTitles.join(", ") : t("app.hr.policies.everyone")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => startEdit(detail.policy)} className="border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]">
                {t("app.action.edit")}
              </button>
              {detail.policy.requiresAcknowledgement && detail.report.counts.pending > 0 && (
                <button type="button" onClick={() => remind(detail.policy)} disabled={busy} className="inline-flex items-center gap-1 border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]" data-hr-remind>
                  <Bell size={12} /> {t("app.hr.policies.remind")}
                </button>
              )}
              <button type="button" onClick={() => archive(detail.policy)} disabled={busy} className="inline-flex items-center gap-1 border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]">
                <Archive size={12} /> {t("app.hr.docs.archive")}
              </button>
              <button type="button" onClick={() => setDetail(null)} className="border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]">
                {t("app.hr.policies.backToList")}
              </button>
            </div>
          </div>
          <PolicyBody body={detail.policy.body} className="border border-border rounded-lg p-4" />
          {detail.policy.requiresAcknowledgement && (
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                <Users size={14} /> {t("app.hr.policies.whoSigned", { signed: detail.report.counts.acknowledged, total: detail.report.counts.inScope })}
              </h3>
              <ul className="divide-y divide-border text-sm">
                {detail.report.rows.map((r) => (
                  <li key={r.workerId} className="py-2 flex items-center justify-between gap-3">
                    <span>
                      {r.name}
                      {r.title ? <span className="text-xs text-muted-foreground"> · {r.title}</span> : null}
                    </span>
                    <span className={`text-xs ${r.acknowledged ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                      {r.acknowledged ? t("app.hr.policies.signedOn", { date: formatDate(r.acknowledgedAt) }) : r.olderVersion ? t("app.hr.policies.signedOlder", { version: r.olderVersion }) : r.hasLogin ? t("app.hr.policies.notSigned") : t("app.hr.policies.noLogin")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.versions.length > 1 && (
            <p className="text-xs text-muted-foreground">{t("app.hr.policies.versionHistory", { list: detail.versions.map((v) => `v${v.version} (${formatDate(v.createdAt)})`).join(", ") })}</p>
          )}
        </div>
      )}

      {!editing && !detail && (
        <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && policies.length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.policies.emptyManager")}</p>}>
          <ul className="space-y-2" data-hr-policy-list>
            {policies.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => openDetail(p)} className="w-full text-left bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-3 min-h-[56px]">
                  <ScrollText size={18} className="text-muted-foreground shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("app.hr.policies.version", { version: p.version })} · {p.audienceTitles?.length ? p.audienceTitles.join(", ") : t("app.hr.policies.everyone")}
                    </span>
                  </span>
                  {p.requiresAcknowledgement ? (
                    <span className={`text-xs rounded-full border px-2.5 py-1 ${p.counts.pending ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300" : "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"}`}>
                      {t("app.hr.policies.signedCount", { signed: p.counts.acknowledged, total: p.counts.inScope })}
                    </span>
                  ) : (
                    <span className="text-xs rounded-full border border-border bg-muted text-muted-foreground px-2.5 py-1">{t("app.hr.policies.noSignature")}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </ListState>
      )}
    </div>
  );
}

function StarterMenu({ t, loadTemplates, onPick }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  async function toggle() {
    if (!open) setList(await loadTemplates().catch(() => []));
    setOpen(!open);
  }
  return (
    <div className="relative">
      <button type="button" onClick={toggle} className="border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]" data-hr-starters>
        {t("app.hr.policies.fromTemplate")}
      </button>
      {open && list && (
        <ul className="absolute z-10 mt-1 bg-card border border-border rounded-xl shadow-lg min-w-[260px] p-1" role="menu">
          {list.map((tpl) => (
            <li key={tpl.key}>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onPick(tpl); }} className="w-full text-left text-sm px-3 py-2.5 rounded-lg hover:bg-muted min-h-[44px]">
                {tpl.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
