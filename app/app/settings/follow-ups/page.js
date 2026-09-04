// app/app/settings/follow-ups/page.js
//
// Automation rules: "N days/hours after <trigger>, if still unresolved,
// send <template>." Checked by the app/api/cron/follow-ups cron route.
// Multiple rules can share a trigger (e.g. a 3-day soft follow-up and a
// 7-day final one), each pointing at a different template.
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { TRIGGER_META } from "@/lib/followUps/triggers";
import { TEMPLATE_TYPE_META } from "@/app/data/emailTemplateBlocks";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { stopKeysFor } from "@/lib/followUps/flow";
import { formatDuration } from "@/lib/i18n/duration";
import FlowDiagram from "./FlowDiagram";

// Rules should point at a template meant for this kind of automated send —
// not a one-off quote/instructions/receipt template.
const ELIGIBLE_TEMPLATE_TYPES = ["follow_up_email", "marketing_email", "custom_email"];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function FollowUpsPage() {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  // A refused load used to leave both lists at [] and then render three
  // statements at once: "you need an email template first", "no follow-up
  // rules yet", and a disabled New-rule button. All three are claims about the
  // company, and the app had simply been told no. Every one of them is now
  // gated on this.
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    triggerEvent: "quote_no_response",
    delayValue: 3,
    delayUnit: "days",
    templateId: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [rulesRes, templatesRes] = await Promise.all([
        fetch("/api/settings/follow-up-rules"),
        fetch("/api/settings/document-templates"),
      ]);
      // Was silent: a failed load cleared loading only on success and never
      // parsed an error, so any non-ok/rejection hung the skeleton forever.
      if (!rulesRes.ok) {
        setLoadError(await reportResponseError(rulesRes));
        return;
      }
      if (!templatesRes.ok) {
        setLoadError(await reportResponseError(templatesRes));
        return;
      }
      const rulesData = await rulesRes.json();
      const templatesData = await templatesRes.json();
      setRules(Array.isArray(rulesData) ? rulesData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setLoadError("");
    } catch {
      // Network-level rejection (offline, DNS, aborted): no Response to read.
      const msg = t("app.load.network");
      setLoadError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const eligibleTemplates = templates.filter((tpl) =>
    ELIGIBLE_TEMPLATE_TYPES.includes(tpl.type),
  );

  function openNew() {
    const meta = TRIGGER_META.quote_no_response;
    setForm({
      name: "",
      triggerEvent: "quote_no_response",
      delayValue: meta.defaultDelay.value,
      delayUnit: meta.defaultDelay.unit,
      templateId: eligibleTemplates[0]?.id || "",
    });
    setShowNew(true);
  }

  function handleTriggerChange(triggerEvent) {
    const meta = TRIGGER_META[triggerEvent];
    setForm((f) => ({
      ...f,
      triggerEvent,
      delayValue: meta.defaultDelay.value,
      delayUnit: meta.defaultDelay.unit,
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings/follow-up-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        name: form.name.trim() || TRIGGER_META[form.triggerEvent].label,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowNew(false);
      load();
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function toggleActive(rule) {
    setBusyId(rule.id);
    const res = await fetch(`/api/settings/follow-up-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  async function handleDelete(id) {
    setBusyId(id);
    const res = await fetch(`/api/settings/follow-up-rules/${id}`, {
      method: "DELETE",
    });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.settings.followUps")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setFollowUps.subtitle")}
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={loadError ? true : eligibleTemplates.length === 0}
          title={
            eligibleTemplates.length === 0
              ? t("app.setFollowUps.needTemplateTooltip")
              : ""
          }
          className="flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
        >
          <Plus size={14} /> {t("app.setFollowUps.newRule")}
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
          {loadError}
        </p>
      )}

      {!loadError && eligibleTemplates.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-3">
          {t("app.setFollowUps.needTemplatePre")}{" "}
          <a href="/app/settings/email-templates" className="underline">
            {t("app.settings.emailTemplates")}
          </a>{" "}
          {t("app.setFollowUps.needTemplatePost")}
        </p>
      )}

      {/* Read-only, derived from the rules below — see FlowDiagram.js for why
          it is a view and not an editor. Renders nothing when there are no
          rules, so the plain empty sentence below is what a new company sees. */}
      <FlowDiagram rules={rules} />

      {loadError ? null : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.setFollowUps.empty")}</p>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {rules.map((rule) => {
            const meta = TRIGGER_META[rule.triggerEvent];
            // The same two sentences the diagram draws as a "Stops" node. The
            // diagram is aria-hidden, so this is where a screen reader — and
            // anyone who just prefers reading — gets the exit conditions.
            const { stopKey, onceKey } = stopKeysFor(rule.triggerEvent);

            return (
            <div key={rule.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{rule.name}</span>
                  {!rule.active && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {t("app.setFollowUps.paused")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {/* This used to interpolate delayValue next to the raw
                      delayUnit column, so a French user read "1 days" — the
                      count undeclined and the unit untranslated. formatDuration
                      does both, and is the same call FlowDiagram makes, so the
                      list and the picture can't drift apart. */}
                  {formatDuration(t, rule.delayValue, rule.delayUnit)}{" "}
                  {t("app.setFollowUps.after")}{" "}
                  {meta?.label || rule.triggerEvent} →{" "}
                  {rule.template?.name || t("app.setFollowUps.templateDeleted")}
                </p>
                {(stopKey || onceKey) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[stopKey && t(stopKey), onceKey && t(onceKey)]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => toggleActive(rule)}
                  disabled={busyId === rule.id}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {rule.active ? t("app.setFollowUps.pause") : t("app.setFollowUps.activate")}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={busyId === rule.id}
                  className="text-muted-foreground hover:text-red-500"
                  aria-label={t("app.setFollowUps.deleteAria", { name: rule.name })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("app.setFollowUps.newRuleTitle")}</h2>
              <button onClick={() => setShowNew(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("app.setFollowUps.ruleName")}
                </label>
                <input
                  placeholder={TRIGGER_META[form.triggerEvent].label}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("app.setFollowUps.trigger")}
                </label>
                <select
                  value={form.triggerEvent}
                  onChange={(e) => handleTriggerChange(e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(TRIGGER_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {TRIGGER_META[form.triggerEvent].description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {t("app.setFollowUps.delay")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.delayValue}
                    onChange={(e) => setForm({ ...form, delayValue: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {t("app.setFollowUps.unit")}
                  </label>
                  <select
                    value={form.delayUnit}
                    onChange={(e) => setForm({ ...form, delayUnit: e.target.value })}
                    className={inputClass}
                  >
                    <option value="hours">{t("app.time.hours")}</option>
                    <option value="days">{t("app.time.days")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("app.setFollowUps.templateToSend")}
                </label>
                <select
                  required
                  value={form.templateId}
                  onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {t("app.setFollowUps.chooseTemplate")}
                  </option>
                  {eligibleTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({TEMPLATE_TYPE_META[tpl.type]?.label})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving || !form.templateId}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t("app.setFollowUps.creating") : t("app.setFollowUps.createRule")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
