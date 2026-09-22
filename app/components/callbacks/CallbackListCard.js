// app/components/callbacks/CallbackListCard.js
//
// "This week's list": the clients a CallbackRule picked, with one outcome
// per row. Shared by Settings → Follow-ups → Past clients (owner/admin,
// every list) and /app/callbacks (the assignee, their lists), so the two
// screens cannot drift on what an outcome means.
//
// Outcomes: Booked · Call back (date) · Not now · Not interested (reason) ·
// Wrong number · Do not call. Each is one POST to
// /api/callbacks/entries/[id]; "Booked" also opens a new quote for the
// client — the same door a lead goes through.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Phone, Printer } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

const PILL = {
  booked: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  call_back: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  not_now: "bg-muted text-muted-foreground",
  not_interested: "bg-muted text-muted-foreground",
  wrong_number: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  do_not_contact: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  todo: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
};

export default function CallbackListCard() {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [weekOf, setWeekOf] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/callbacks${weekOf ? `?weekOf=${weekOf}` : ""}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [weekOf]);
  useEffect(() => {
    load();
  }, [load]);

  const fmtMonth = (v) => (v ? new Date(v).toLocaleDateString(language, { month: "short", year: "numeric" }) : "—");
  const fmtDay = (key) => (key ? new Date(`${key}T12:00:00Z`).toLocaleDateString(language, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "");

  if (error) return <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> {t("app.state.loading")}</div>;

  return (
    <div className="space-y-4">
      {data.weeks.length > 1 && (
        <select value={data.weekOf || ""} onChange={(e) => setWeekOf(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background">
          {data.weeks.map((w) => (
            <option key={w} value={w}>{t("app.callbacks.weekOf", { date: fmtDay(w) })}</option>
          ))}
        </select>
      )}
      {data.lists.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">{t("app.callbacks.noList")}</div>
      )}
      {data.lists.map((list) => {
        const done = list.entries.filter((e) => e.outcome).length;
        return (
          <div key={list.id} className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3 print:border-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-foreground">
                {t("app.callbacks.listTitle")}{" "}
                <span className="font-normal text-muted-foreground text-sm">
                  {t("app.callbacks.listMeta", { date: fmtDay(list.weekOf), count: list.entries.length, done })}
                  {list.rule.assigneeName ? ` · ${list.rule.assigneeName}` : ""}
                </span>
              </h2>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 border border-border px-3 py-1.5 rounded-lg text-sm font-semibold print:hidden">
                <Printer size={13} /> {t("app.callbacks.print")}
              </button>
            </div>
            {list.entries.length === 0 && <p className="text-sm text-muted-foreground">{t("app.callbacks.emptyList")}</p>}
            <div className="divide-y divide-border">
              {list.entries.map((e) => (
                <EntryRow key={e.id} entry={e} outcomes={data.outcomes} money={money} fmtMonth={fmtMonth} onChanged={load} />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("app.callbacks.outcomesNote")}</p>
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ entry, outcomes, money, fmtMonth, onChanged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(entry.outcome || "");
  const [note, setNote] = useState(entry.outcomeNote || "");
  const [callBackOn, setCallBackOn] = useState(entry.callBackOn || "");
  const [busy, setBusy] = useState(false);

  async function log() {
    if (!outcome) return;
    if (outcome === "do_not_contact" && !confirm(t("app.callbacks.dncConfirm", { name: entry.client.name }))) return;
    setBusy(true);
    try {
      const out = await fetchJson(`/api/callbacks/entries/${entry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, note, callBackOn: callBackOn || null }),
      });
      setOpen(false);
      showToast({ message: t("app.callbacks.logged"), tone: "success", href: out.bookHref || null });
      onChanged();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center">
      <div className="sm:col-span-3 min-w-0">
        <Link href={`/app/clients/${entry.client.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">{entry.client.name}</Link>
        <span className="text-xs text-muted-foreground ml-2">{entry.client.city || entry.client.postalCode || ""}</span>
        {entry.client.phone && (
          <a href={`tel:${entry.client.phone}`} className="ml-2 inline-flex items-center gap-1 text-xs text-foreground print:hidden">
            <Phone size={11} /> {entry.client.phone}
          </a>
        )}
      </div>
      <div className="sm:col-span-3 text-sm text-muted-foreground">
        {fmtMonth(entry.lastJobAt)}{entry.lastJobTitle ? ` · ${entry.lastJobTitle}` : ""}
      </div>
      <div className="sm:col-span-2 text-sm text-right tabular-nums whitespace-nowrap">{entry.lastTicket != null ? money(entry.lastTicket) : "—"}</div>
      <div className="sm:col-span-4 min-w-0 flex items-center gap-2 flex-wrap">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[entry.outcome || "todo"]}`}>
          {entry.outcome ? t(`app.callbacks.outcome.${entry.outcome}`) : t("app.callbacks.outcome.todo")}
        </span>
        {entry.outcomeNote && <span className="text-xs text-muted-foreground">{entry.outcomeNote}</span>}
        {entry.callBackOn && <span className="text-xs text-muted-foreground">{entry.callBackOn}</span>}
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs underline print:hidden">
          {entry.outcome ? t("app.callbacks.change") : t("app.callbacks.logOutcome")}
        </button>
      </div>
      {open && (
        <div className="sm:col-span-12 flex items-center gap-2 flex-wrap print:hidden">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background">
            <option value="">{t("app.callbacks.pickOutcome")}</option>
            {outcomes.map((o) => (
              <option key={o} value={o}>{t(`app.callbacks.outcome.${o}`)}</option>
            ))}
          </select>
          {outcome === "call_back" && (
            <input type="date" value={callBackOn} onChange={(e) => setCallBackOn(e.target.value)} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("app.callbacks.notePlaceholder")} className="flex-1 min-w-[10rem] border border-border rounded-lg px-2 py-1.5 text-sm bg-background" />
          <button type="button" onClick={log} disabled={busy || !outcome || (outcome === "call_back" && !callBackOn)} className="bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full text-sm font-semibold disabled:opacity-60">
            {busy ? t("app.action.saving") : t("app.action.save")}
          </button>
        </div>
      )}
    </div>
  );
}
