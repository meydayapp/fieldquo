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
import { reportResponseError } from "@/lib/clientErrors";

// Rules should point at a template meant for this kind of automated send —
// not a one-off quote/instructions/receipt template.
const ELIGIBLE_TEMPLATE_TYPES = ["follow_up_email", "marketing_email", "custom_email"];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function FollowUpsPage() {
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
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

  function load() {
    setLoading(true);
    return Promise.all([
      fetch("/api/settings/follow-up-rules").then((r) => r.json()),
      fetch("/api/settings/document-templates").then((r) => r.json()),
    ]).then(([rulesData, templatesData]) => {
      setRules(Array.isArray(rulesData) ? rulesData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  const eligibleTemplates = templates.filter((t) =>
    ELIGIBLE_TEMPLATE_TYPES.includes(t.type),
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
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatically send a template a set time after a quote, invoice,
            or job hits a certain state — no manual reminders.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={eligibleTemplates.length === 0}
          title={
            eligibleTemplates.length === 0
              ? "Create a Follow-up, Marketing, or Custom email template first"
              : ""
          }
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
        >
          <Plus size={14} /> New Rule
        </button>
      </div>

      {eligibleTemplates.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          You need at least one Follow-up, Marketing, or Custom email template
          before you can create a rule — head to{" "}
          <a href="/app/settings/email-templates" className="underline">
            Email Templates
          </a>{" "}
          first.
        </p>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-gray-400">No follow-up rules yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                  {!rule.active && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Paused
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {rule.delayValue} {rule.delayUnit} after{" "}
                  {TRIGGER_META[rule.triggerEvent]?.label || rule.triggerEvent} →{" "}
                  {rule.template?.name || "(template deleted)"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(rule)}
                  disabled={busyId === rule.id}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  {rule.active ? "Pause" : "Activate"}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={busyId === rule.id}
                  className="text-gray-400 hover:text-red-500"
                  aria-label={`Delete ${rule.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Follow-up Rule</h2>
              <button onClick={() => setShowNew(false)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Rule name (optional)
                </label>
                <input
                  placeholder={TRIGGER_META[form.triggerEvent].label}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Trigger
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
                <p className="text-xs text-gray-400 mt-1">
                  {TRIGGER_META[form.triggerEvent].description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Delay
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
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Unit
                  </label>
                  <select
                    value={form.delayUnit}
                    onChange={(e) => setForm({ ...form, delayUnit: e.target.value })}
                    className={inputClass}
                  >
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Template to send
                </label>
                <select
                  required
                  value={form.templateId}
                  onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Choose a template…
                  </option>
                  {eligibleTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({TEMPLATE_TYPE_META[t.type]?.label})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving || !form.templateId}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Rule"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
