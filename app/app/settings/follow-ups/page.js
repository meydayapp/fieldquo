// app/app/settings/follow-ups/page.js
//
// Automation rules: "N days/hours after <trigger>, if still unresolved,
// send <template>." Checked by the app/api/cron/follow-ups cron route.
// Multiple rules can share a trigger (e.g. a 3-day soft follow-up and a
// 7-day final one), each pointing at a different template.
//
// ── FieldQuo's defaults ────────────────────────────────────────────────────
//
// Three rules arrive switched on for every company — 1, 7 and 14 days after
// a quote is sent, in the client's language (lib/followUps/defaults.js).
// They are listed first, labelled "FieldQuo default", and every one of them
// is a real row the company may pause, re-time, re-point at its own template,
// reset, or delete. A deleted default is listed at the bottom with "Restore"
// rather than hidden, because a company that deleted the day-7 one should be
// able to see that it did.
//
// Every control on a row writes to the API on change. There is no "Save"
// button for the list: a switch that waits for a save elsewhere is the kind
// of control this codebase keeps being swept for.
"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { TRIGGER_META } from "@/lib/followUps/triggers";
import { TEMPLATE_TYPE_META } from "@/app/data/emailTemplateBlocks";
import { BUILT_IN_COPY, BUILT_IN_LANGUAGES } from "@/lib/followUps/defaultCopy";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { stopKeysFor, TRIGGER_LABEL_KEYS, TRIGGER_DESCRIPTION_KEYS } from "@/lib/followUps/flow";
import { formatDuration } from "@/lib/i18n/duration";
import FlowDiagram from "./FlowDiagram";

// Rules should point at a template meant for this kind of automated send —
// not a one-off quote/instructions/receipt template.
const ELIGIBLE_TEMPLATE_TYPES = ["follow_up_email", "marketing_email", "custom_email"];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
const smallInput =
  "border border-border rounded-lg px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10";

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-green-600" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// What a built-in says, in the three languages it is written in. Read from
// the same table the cron renders from, so this cannot describe an email
// other than the one that goes out.
function BuiltInWording({ ruleKey, language }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const langs = [language, ...BUILT_IN_LANGUAGES.filter((l) => l !== language)].filter((l) =>
    BUILT_IN_LANGUAGES.includes(l),
  );
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {t("app.setFollowUps.whatItSays")}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {langs.map((lang) => {
            const w = BUILT_IN_COPY[lang]?.[ruleKey];
            if (!w) return null;
            return (
              <div key={lang} className="text-xs bg-muted/60 rounded-lg px-3 py-2">
                <div className="font-semibold text-foreground uppercase tracking-wide">{lang}</div>
                <div className="text-foreground mt-1">{w.subject(t("app.setFollowUps.sampleCompany"), "Q-1042")}</div>
                {w.body().map((p, i) => (
                  <p key={i} className="text-muted-foreground mt-1">
                    {p}
                  </p>
                ))}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">{t("app.setFollowUps.otherLanguages")}</p>
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  const { t, language } = useTranslation();
  const [rules, setRules] = useState([]);
  const [deletedBuiltIns, setDeletedBuiltIns] = useState([]);
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
  // Delay edits are typed, then written on blur/Enter — one PATCH per edit,
  // not one per keystroke. Keyed by rule id.
  const [delayDraft, setDelayDraft] = useState({});
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
      setRules(Array.isArray(rulesData?.rules) ? rulesData.rules : []);
      setDeletedBuiltIns(Array.isArray(rulesData?.deletedBuiltIns) ? rulesData.deletedBuiltIns : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setDelayDraft({});
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

  // One PATCH, then reload — the row the server answers with is the truth,
  // not the optimistic one.
  async function patchRule(rule, body) {
    setBusyId(rule.id);
    const res = await fetch(`/api/settings/follow-up-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
    else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  function commitDelay(rule) {
    const draft = delayDraft[rule.id];
    if (draft === undefined) return;
    const value = Number(draft);
    if (!(value >= 1) || value === rule.delayValue) {
      setDelayDraft((d) => ({ ...d, [rule.id]: undefined }));
      return;
    }
    patchRule(rule, { delayValue: value });
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.settings.followUps")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setFollowUps.subtitle")}
          </p>
          {/* The rotation over the company's OWN past clients — a rule that
              looks back through the client book rather than at an open quote.
              Its own screen: app/app/settings/follow-ups/past-clients. */}
          <p className="text-sm mt-2">
            <Link href="/app/settings/follow-ups/past-clients" className="underline font-semibold text-foreground">
              {t("app.callbacks.settingsTitle")}
            </Link>{" "}
            <span className="text-muted-foreground">— {t("app.callbacks.followUpsLinkHint")}</span>
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
          <Plus size={14} /> {t("app.setFollowUps.addAnother")}
        </button>
      </div>

      {loadError && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
          {loadError}
        </p>
      )}

      {/* The defaults need no template, so this note only matters for a
          company that wants a rule of its own on top of them. */}
      {!loadError && eligibleTemplates.length === 0 && (
        <p className="text-sm text-muted-foreground bg-muted/60 border border-border rounded-lg px-4 py-3">
          {t("app.setFollowUps.needTemplatePre")}{" "}
          <a href="/app/settings/email-templates" className="underline">
            {t("app.settings.emailTemplates")}
          </a>{" "}
          {t("app.setFollowUps.needTemplatePost")}
        </p>
      )}

      {/* The stop conditions, once, in words — the same list the cron
          enforces (lib/followUps/stopConditions.js). */}
      {!loadError && (
        <p className="text-sm text-muted-foreground bg-card border border-border rounded-lg px-4 py-3">
          {t("app.setFollowUps.stopExplainer")}
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
            // The same two sentences the diagram draws as a "Stops" node. The
            // diagram is aria-hidden, so this is where a screen reader — and
            // anyone who just prefers reading — gets the exit conditions.
            const { stopKey, onceKey } = stopKeysFor(rule.triggerEvent);
            const builtIn = Boolean(rule.builtInKey);
            const busy = busyId === rule.id;
            const delayValue = delayDraft[rule.id] ?? rule.delayValue;

            return (
              <div key={rule.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{rule.name}</span>
                      {builtIn && (
                        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {t("app.setFollowUps.fieldquoDefault")}
                        </span>
                      )}
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
                      {TRIGGER_LABEL_KEYS[rule.triggerEvent]
                        ? t(TRIGGER_LABEL_KEYS[rule.triggerEvent])
                        : rule.triggerEvent}
                    </p>
                    {(stopKey || onceKey) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[stopKey && t(stopKey), onceKey && t(onceKey)]
                          .filter(Boolean)
                          .join(" ")}
                        {builtIn ? ` ${t("app.setFollowUps.fromToday")}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={rule.active}
                      disabled={busy}
                      label={t("app.setFollowUps.switchAria", { name: rule.name })}
                      onChange={() => patchRule(rule, { active: !rule.active })}
                    />
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={busy}
                      className="text-muted-foreground hover:text-red-500"
                      aria-label={t("app.setFollowUps.deleteAria", { name: rule.name })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Editable delay + template, written on change. */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    {t("app.setFollowUps.delay")}
                    <input
                      type="number"
                      min="1"
                      value={delayValue}
                      disabled={busy}
                      onChange={(e) => setDelayDraft((d) => ({ ...d, [rule.id]: e.target.value }))}
                      onBlur={() => commitDelay(rule)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className={`${smallInput} w-20`}
                    />
                  </label>
                  <select
                    value={rule.delayUnit}
                    disabled={busy}
                    onChange={(e) => patchRule(rule, { delayUnit: e.target.value })}
                    className={smallInput}
                    aria-label={t("app.setFollowUps.unit")}
                  >
                    <option value="hours">{t("app.time.hours")}</option>
                    <option value="days">{t("app.time.days")}</option>
                  </select>
                  <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5 min-w-0">
                    {t("app.setFollowUps.templateToSend")}
                    <select
                      value={rule.templateId || ""}
                      disabled={busy}
                      onChange={(e) =>
                        patchRule(rule, { templateId: e.target.value === "" ? null : e.target.value })
                      }
                      className={`${smallInput} max-w-[240px]`}
                    >
                      {builtIn ? (
                        <option value="">{t("app.setFollowUps.builtInWording")}</option>
                      ) : (
                        <option value="" disabled>
                          {rule.template ? t("app.setFollowUps.chooseTemplate") : t("app.setFollowUps.templateDeleted")}
                        </option>
                      )}
                      {eligibleTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({TEMPLATE_TYPE_META[tpl.type]?.label})
                        </option>
                      ))}
                    </select>
                  </label>
                  {builtIn && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patchRule(rule, { reset: true })}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
                    >
                      <RotateCcw size={12} /> {t("app.setFollowUps.resetToDefault")}
                    </button>
                  )}
                </div>

                {builtIn && !rule.templateId && (
                  <BuiltInWording ruleKey={rule.builtInKey} language={language} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loadError && deletedBuiltIns.length > 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t("app.setFollowUps.deletedDefaults")}
          </p>
          <div className="space-y-2">
            {deletedBuiltIns.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{r.name}</span>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => patchRule(r, { reset: true })}
                  className="text-xs font-medium text-foreground hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} /> {t("app.setFollowUps.restore")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="fq-dialog-card bg-card rounded-2xl w-full max-w-sm p-6"
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
                  {Object.keys(TRIGGER_META).map((key) => (
                    <option key={key} value={key}>
                      {t(TRIGGER_LABEL_KEYS[key])}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(TRIGGER_DESCRIPTION_KEYS[form.triggerEvent])}
                </p>
                {/* An enquiry has no quote yet, so the quote chips in a
                    template ({{quoteUrl}}, {{quoteTotal}}) render as nothing.
                    Said here, where the template is chosen, rather than
                    discovered in a homeowner's inbox. */}
                {TRIGGER_META[form.triggerEvent]?.entityType === "lead" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("app.followFlow.leadFields")}
                  </p>
                )}
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
