// app/app/settings/follow-ups/past-clients/page.js
//
// Settings → Follow-ups → Past clients: the callback rotation.
//
// One sentence per rule, edited in place: "Every Monday, list clients with
// no job in 10+ months, last ticket over $1,500, area Kanata → hand the list
// to Sam, up to 8 a week." Below it, this week's list with outcomes
// (app/components/callbacks/CallbackListCard.js).
//
// There is no "AI front desk" option in the assignee picker, and the page
// says why: the voice agent may only call a client for three months after
// a job (lib/voice/outbound.js CONSENT_SOURCES), and every client this
// rule lists is past that window. Offering it would be a control that
// refuses every call. It comes back when the owner decides the consent
// rule for past clients.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, PhoneOutgoing } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import CallbackListCard from "@/app/components/callbacks/CallbackListCard";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export default function PastClientsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return <PastClientsScreen readOnly={!access.canChange("user:manage")} />;
}

function PastClientsScreen({ readOnly }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/callback-rules"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 pb-16">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/settings/follow-ups" className="underline">{t("app.settings.followUps")}</Link> › {t("app.callbacks.settingsTitle")}
        </p>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <PhoneOutgoing size={20} /> {t("app.callbacks.settingsTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.callbacks.settingsSubtitle")}</p>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}</div>
      )}

      {data && data.rules.map((rule) => <RuleCard key={rule.id} rule={rule} data={data} readOnly={readOnly} onSaved={load} />)}
      {data && data.rules.length === 0 && <RuleCard rule={null} data={data} readOnly={readOnly} onSaved={load} />}
      {data && data.rules.length > 0 && !readOnly && <NewRuleButton data={data} onSaved={load} />}

      <div className="text-xs text-muted-foreground rounded-lg bg-muted px-3 py-2">{t("app.callbacks.noAiNote")}</div>

      <CallbackListCard />
    </div>
  );
}

function NewRuleButton({ data, onSaved }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (open) return <RuleCard rule={null} data={data} readOnly={false} onSaved={() => { setOpen(false); onSaved(); }} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-sm font-semibold border border-border rounded-lg px-3 py-2">
      <Plus size={14} /> {t("app.callbacks.addRule")}
    </button>
  );
}

function RuleCard({ rule, data, readOnly, onSaved }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [draft, setDraft] = useState(() => ({
    enabled: rule?.enabled ?? true,
    weekday: rule?.weekday ?? 1,
    monthsSinceJob: rule?.monthsSinceJob ?? 10,
    minTicket: rule?.minTicket ?? 1500,
    areaKind: rule?.areaKind || "",
    areaValue: rule?.areaValue || "",
    assigneeMemberId: rule?.assigneeMemberId || "",
    weeklyCap: rule?.weeklyCap ?? 8,
  }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const weekdayName = (n) => new Date(Date.UTC(2024, 0, 7 + n, 12)).toLocaleDateString(language, { weekday: "long", timeZone: "UTC" });

  async function save(extra = {}) {
    setBusy(true);
    try {
      await fetchJson("/api/settings/callback-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(rule?.id ? { id: rule.id } : {}), ...draft, ...extra, areaKind: draft.areaKind || null, assigneeMemberId: draft.assigneeMemberId || null }),
      });
      showToast({ message: t("app.callbacks.ruleSaved"), tone: "success" });
      onSaved();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const sel = "border-b border-dashed border-muted-foreground bg-transparent font-semibold text-foreground px-0.5 py-0 text-sm";

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-foreground">{t("app.callbacks.ruleTitle")}</h2>
        <label className="inline-flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" disabled={readOnly || busy} checked={draft.enabled} onChange={(e) => { set("enabled", e.target.checked); if (rule?.id) save({ enabled: e.target.checked }); }} />
          {draft.enabled ? t("app.callbacks.on") : t("app.callbacks.off")}
        </label>
      </div>

      <p className="text-sm leading-7 text-foreground">
        {t("app.callbacks.sentence.every")}{" "}
        <select disabled={readOnly} value={draft.weekday} onChange={(e) => set("weekday", Number(e.target.value))} className={sel}>
          {WEEKDAYS.map((n) => (
            <option key={n} value={n}>{weekdayName(n)}</option>
          ))}
        </select>
        {", "}
        {t("app.callbacks.sentence.listClientsWithNoJobIn")}{" "}
        <input type="number" min="1" max="120" disabled={readOnly} value={draft.monthsSinceJob} onChange={(e) => set("monthsSinceJob", Number(e.target.value))} className={`${sel} w-12 text-center`} />
        {t("app.callbacks.sentence.plusMonths")}{", "}
        {t("app.callbacks.sentence.lastTicketOver")}{" "}
        <input type="number" min="0" step="50" disabled={readOnly} value={draft.minTicket} onChange={(e) => set("minTicket", Number(e.target.value))} className={`${sel} w-20 text-center`} />
        {", "}
        {t("app.callbacks.sentence.area")}{" "}
        <select disabled={readOnly} value={draft.areaKind} onChange={(e) => { set("areaKind", e.target.value); set("areaValue", ""); }} className={sel}>
          <option value="">{t("app.callbacks.area.anywhere")}</option>
          <option value="postcode">{t("app.callbacks.area.postcode")}</option>
          <option value="city">{t("app.callbacks.area.city")}</option>
          {data.workAreas.length > 0 && <option value="work_area">{t("app.callbacks.area.workArea")}</option>}
        </select>{" "}
        {draft.areaKind === "work_area" ? (
          <select disabled={readOnly} value={draft.areaValue} onChange={(e) => set("areaValue", e.target.value)} className={sel}>
            <option value="">—</option>
            {data.workAreas.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.hasPolygon}>{a.name}{a.hasPolygon ? "" : ` (${t("app.callbacks.area.noPolygon")})`}</option>
            ))}
          </select>
        ) : draft.areaKind ? (
          <input disabled={readOnly} value={draft.areaValue} onChange={(e) => set("areaValue", e.target.value)} placeholder={draft.areaKind === "postcode" ? "K2K" : "Kanata"} className={`${sel} w-24`} />
        ) : null}
        {" → "}
        {t("app.callbacks.sentence.handTo")}{" "}
        <select disabled={readOnly} value={draft.assigneeMemberId} onChange={(e) => set("assigneeMemberId", e.target.value)} className={sel}>
          <option value="">{t("app.callbacks.assignee.nobody")}</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {", "}
        {t("app.callbacks.sentence.upTo")}{" "}
        <input type="number" min="1" max="100" disabled={readOnly} value={draft.weeklyCap} onChange={(e) => set("weeklyCap", Number(e.target.value))} className={`${sel} w-12 text-center`} />{" "}
        {t("app.callbacks.sentence.aWeek")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("app.callbacks.ruleNote", { min: money(draft.minTicket || 0) })}
      </p>
      {!readOnly && (
        <button type="button" onClick={() => save()} disabled={busy} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60">
          {busy ? t("app.action.saving") : rule?.id ? t("app.callbacks.saveRule") : t("app.callbacks.createRule")}
        </button>
      )}
    </div>
  );
}
