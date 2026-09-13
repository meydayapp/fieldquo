"use client";

// app/components/hr/TemplateEditor.js
//
// /app/settings/team/onboarding: the company's checklists. Opening this
// screen is what creates the default (the GET seeds it, lazily — see
// lib/onboarding/service.js). A run already in progress keeps the items it
// started with; edits here describe the next hire, and the screen says so.

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { ITEM_KINDS } from "@/lib/onboarding/template";
import { WORKER_DOCUMENT_KINDS } from "@/lib/hr/documents";
import { TAX_FORM_KINDS } from "@/lib/hr/taxForms";
import { documentKindLabel } from "@/app/components/hr/WorkerDocumentsPanel";

const inputClass = "border border-border rounded-lg px-3 py-2 bg-card min-h-[44px] text-sm";

export default function TemplateEditor() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [editing, setEditing] = useState(null); // { id?, name, items }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/onboarding/templates");
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

  const templates = data?.templates || [];
  const policies = data?.policies || [];

  function startEdit(tpl) {
    setError("");
    setEditing(tpl ? { id: tpl.id, name: tpl.name, items: tpl.items.map((it) => ({ ...it })), isDefault: tpl.isDefault } : { name: "", items: [{ key: "", label: "", kind: "task", required: true, dueDays: 1 }], isDefault: false });
  }

  const setItem = (i, patch) => setEditing((e) => ({ ...e, items: e.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i, d) =>
    setEditing((e) => {
      const items = e.items.slice();
      const j = i + d;
      if (j < 0 || j >= items.length) return e;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...e, items };
    });

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = { name: editing.name, items: editing.items, isDefault: editing.isDefault };
      if (editing.id) await fetchJson(`/api/hr/onboarding/templates/${editing.id}`, { method: "PATCH", body });
      else await fetchJson("/api/hr/onboarding/templates", { method: "POST", body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function archive(tpl) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/hr/onboarding/templates/${tpl.id}`, { method: "PATCH", body: { archived: true } });
      await load();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-hr-templates>
      <p className="text-sm text-muted-foreground">{t("app.hr.templates.intro")}</p>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {editing ? (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" data-hr-template-form>
          <label className="block text-sm max-w-md">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{t("app.hr.templates.name")}</span>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${inputClass} w-full`} />
          </label>
          <ol className="space-y-3">
            {editing.items.map((it, i) => (
              <li key={i} className="border border-border rounded-lg p-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-start">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder={t("app.hr.templates.itemLabel")} className={`${inputClass} sm:col-span-2`} />
                  <select value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value })} className={inputClass}>
                    {ITEM_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`app.hr.onboarding.kind.${k}`)}
                      </option>
                    ))}
                  </select>
                  {it.kind === "document" && (
                    <select value={it.documentKind || ""} onChange={(e) => setItem(i, { documentKind: e.target.value })} className={inputClass}>
                      <option value="">{t("app.hr.templates.pickDocumentKind")}</option>
                      {WORKER_DOCUMENT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {documentKindLabel(t, k)}
                        </option>
                      ))}
                    </select>
                  )}
                  {it.kind === "policy" && (
                    <select value={it.policyId || ""} onChange={(e) => setItem(i, { policyId: e.target.value })} className={inputClass}>
                      <option value="">{policies.length ? t("app.hr.templates.pickPolicy") : t("app.hr.templates.noPolicies")}</option>
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {it.kind === "form" && (
                    <select value={it.formKind || ""} onChange={(e) => setItem(i, { formKind: e.target.value })} className={inputClass}>
                      <option value="">{t("app.hr.templates.pickForm")}</option>
                      {TAX_FORM_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`app.hr.tax.form.${k}`)}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-sm min-h-[44px]">
                    <input type="checkbox" checked={it.required !== false} onChange={(e) => setItem(i, { required: e.target.checked })} />
                    {t("app.hr.templates.required")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-muted-foreground">{t("app.hr.templates.dueDays")}</span>
                    <input type="number" min="0" max="365" value={it.dueDays ?? ""} onChange={(e) => setItem(i, { dueDays: e.target.value === "" ? null : Number(e.target.value) })} className={`${inputClass} w-24`} />
                  </label>
                </div>
                <button type="button" onClick={() => move(i, -1)} className="border border-border rounded-full p-2 min-h-[44px] min-w-[44px]" aria-label={t("app.hr.templates.moveUp")}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} className="border border-border rounded-full p-2 min-h-[44px] min-w-[44px]" aria-label={t("app.hr.templates.moveDown")}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })} className="border border-border rounded-full p-2 min-h-[44px] min-w-[44px]" aria-label={t("app.hr.templates.removeItem")}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setEditing({ ...editing, items: [...editing.items, { key: "", label: "", kind: "task", required: true, dueDays: null }] })} className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm min-h-[44px]">
            <Plus size={14} /> {t("app.hr.templates.addItem")}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} />
            {t("app.hr.templates.makeDefault")}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60">
              {t("app.hr.templates.save")}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="border border-border rounded-full px-4 py-2 text-sm min-h-[44px]">
              {t("app.action.cancel")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("app.hr.templates.editHint")}</p>
        </div>
      ) : (
        <button type="button" onClick={() => startEdit(null)} className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px]">
          <Plus size={14} /> {t("app.hr.templates.new")}
        </button>
      )}

      <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && templates.length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.templates.empty")}</p>}>
        <ul className="space-y-3">
          {templates.map((tpl) => (
            <li key={tpl.id} className="bg-card border border-border rounded-xl p-5" data-hr-template>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <ClipboardList size={16} /> {tpl.name}
                    {tpl.isDefault ? <span className="text-xs rounded-full border border-border bg-muted text-muted-foreground px-2 py-0.5">{t("app.hr.templates.default")}</span> : null}
                  </h3>
                  <p className="text-xs text-muted-foreground">{t("app.hr.templates.itemCount", { count: tpl.items.length })}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(tpl)} className="border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]">
                    {t("app.action.edit")}
                  </button>
                  {!tpl.isDefault && (
                    <button type="button" onClick={() => archive(tpl)} disabled={busy} className="border border-border rounded-full px-3 py-1.5 text-xs min-h-[36px]">
                      {t("app.hr.docs.archive")}
                    </button>
                  )}
                </div>
              </div>
              <ol className="mt-3 space-y-1 text-sm">
                {tpl.items.map((it) => (
                  <li key={it.key} className="flex items-baseline gap-2">
                    <span className="text-foreground">{it.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`app.hr.onboarding.kind.${it.kind}`)}
                      {it.required === false ? ` · ${t("app.hr.onboarding.optional")}` : ""}
                      {it.dueDays != null ? ` · ${t("app.hr.templates.dueInDays", { count: it.dueDays })}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </ListState>
    </div>
  );
}
