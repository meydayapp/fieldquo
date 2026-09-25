"use client";

// app/app/tickets/[id]/page.js
//
// One client ticket: what the client wrote (with their photos), the thread,
// and the office's controls — reply (emailed to the client from the company,
// in their language, with their portal link), status, priority, assignee,
// and "Turn into a job" for a repair or warranty ticket.
//
// Every control is drawn only for a member the route will answer
// (requests: view_create_edit to work it, jobs: view_create_edit to convert),
// and a reply that could not be emailed says so instead of looking sent.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Send, Briefcase, AlertCircle, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { TYPE_KEYS, STATUS_KEYS, STATUS_CLASSES, PRIORITY_KEYS, label } from "@/app/components/tickets/ticketLabels";

const STATUSES = ["open", "in_progress", "waiting_on_client", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const CONVERTIBLE = ["repair", "warranty"];

export default function ClientTicketPage() {
  const { t, language } = useTranslation();
  const { id } = useParams();
  const canWork = useHasLevel("requests", "view_create_edit");
  const canConvert = useHasLevel("jobs", "view_create_edit") && canWork;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/client-tickets/${id}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body) {
    setBusy("patch");
    try {
      await fetchJson(`/api/client-tickets/${id}`, { method: "PATCH", body });
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy("reply");
    try {
      const r = await fetchJson(`/api/client-tickets/${id}/messages`, { method: "POST", body: { body: reply } });
      setReply("");
      if (r?.emailed?.sent) {
        showToast({ message: t("app.clientTickets.replyEmailed", "Reply sent and emailed to {email}", { email: r.emailed.to }), tone: "success" });
      } else {
        showToast({ message: t("app.clientTickets.replyNotEmailed", "Reply saved — the client can read it in their portal, but it was not emailed to them."), tone: "error" });
      }
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function convert() {
    setBusy("convert");
    try {
      await fetchJson(`/api/client-tickets/${id}/convert`, { method: "POST" });
      await load();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
        <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-24">
        <Loader2 size={16} className="animate-spin" /> {t("app.clientTickets.loading", "Loading…")}
      </div>
    );
  }

  const tk = data.ticket;
  const when = (d) => {
    try {
      return new Date(d).toLocaleString(language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };
  const photos = (list) =>
    Array.isArray(list) && list.length > 0 ? (
      <div className="flex gap-2 flex-wrap mt-2">
        {list.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-24 h-20 object-cover rounded-lg border border-border" />
          </a>
        ))}
      </div>
    ) : null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5" data-ticket-detail>
      <Link href="/app/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {t("app.clientTickets.back", "Back to client tickets")}
      </Link>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[tk.status] || STATUS_CLASSES.closed}`}>{label(t, STATUS_KEYS[tk.status])}</span>
          <span className="text-xs text-muted-foreground">{label(t, TYPE_KEYS[tk.type])}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-1">{tk.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <Link href={`/app/clients/${tk.client.id}`} className="underline">{tk.client.name}</Link>
          {data.job && (
            <>
              {" · "}
              <Link href={`/app/jobs/${data.job.id}`} className="underline">{data.job.title}</Link>
            </>
          )}
          {" · "}
          {when(tk.createdAt)}
        </p>
      </div>

      {canWork && (
        <div className="bg-card border border-border rounded-xl p-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted-foreground">
            {t("app.clientTickets.statusLabel", "Status")}
            <select value={tk.status} disabled={Boolean(busy)} onChange={(e) => patch({ status: e.target.value })} className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground">
              {STATUSES.map((s) => (
                <option key={s} value={s}>{label(t, STATUS_KEYS[s])}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            {t("app.clientTickets.priorityLabel", "Priority")}
            <select value={tk.priority} disabled={Boolean(busy)} onChange={(e) => patch({ priority: e.target.value })} className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{label(t, PRIORITY_KEYS[p])}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            {t("app.clientTickets.assigneeLabel", "Assigned to")}
            <select value={tk.assignedToId || ""} disabled={Boolean(busy)} onChange={(e) => patch({ assignedToId: e.target.value || null })} className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground">
              <option value="">{t("app.clientTickets.unassigned", "Unassigned")}</option>
              {data.assignees.map((a) => (
                <option key={a.userId} value={a.userId}>{a.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {CONVERTIBLE.includes(tk.type) && (data.convertedJob || canConvert) && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
          {data.convertedJob ? (
            <p className="text-sm text-foreground flex items-center gap-2">
              <Check size={15} className="text-green-700 dark:text-green-300" />
              {t("app.clientTickets.converted", "Turned into a job:")}{" "}
              <Link href={`/app/jobs/${data.convertedJob.id}`} className="underline font-semibold">{data.convertedJob.title}</Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground max-w-md">
                {t("app.clientTickets.convertHint", "Needs a crew? Create an unscheduled job for this client, linked to the original job as a callback when there is one.")}
              </p>
              <button type="button" onClick={convert} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 border border-border px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60" data-ticket-convert>
                {busy === "convert" ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
                {t("app.clientTickets.convert", "Turn into a job")}
              </button>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground">{tk.client.name} · {when(tk.createdAt)}</p>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{tk.body}</p>
          {photos(tk.photos)}
        </div>
        {tk.messages.map((m) => (
          <div key={m.id} className={`rounded-xl p-4 border ${m.author === "member" ? "bg-muted/60 border-border ml-6" : "bg-card border-border mr-6"}`}>
            <p className="text-xs font-semibold text-muted-foreground">
              {m.author === "member" ? m.authorName || t("app.clientTickets.you", "Your team") : tk.client.name} · {when(m.createdAt)}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{m.body}</p>
            {photos(m.photos)}
          </div>
        ))}
      </div>

      {canWork && (
        <div className="bg-card border border-border rounded-xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={t("app.clientTickets.replyPlaceholder", "Write to the client — they get it by email and in their portal.")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={sendReply} disabled={!reply.trim() || Boolean(busy)} className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60" data-ticket-reply>
              {busy === "reply" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t("app.clientTickets.sendReply", "Send reply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
