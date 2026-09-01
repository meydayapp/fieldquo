"use client";

// app/app/settings/migration/page.js
//
// Bring your old data into FieldQuo — quotes, invoices, jobs from QuickBooks,
// Jobber, a spreadsheet, a shoebox. Request it, talk it through with FieldQuo,
// see the price, decide, pay, and watch what gets brought in.
//
// State machine lives in lib/migrations/state.js; this page only renders
// whichever step the request's `status` says it's in. See
// docs/MIGRATION-SERVICE.md for the full lifecycle.
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Upload,
  FileText,
  Ban,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

// Same "hidden, not read-only" reasoning as Refer & Earn — the price and the
// payment button belong to whoever holds the company's card, and every
// control on this page is refused server-side to anyone else.
export default function MigrationSettingsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return <MigrationScreen />;
}

const OPEN_STATUSES = ["requested", "scheduled", "quoted", "accepted", "paid", "in_progress"];

function MigrationScreen() {
  const { t } = useTranslation();
  const { formatDateTime, formatDate } = useCompanyPreferences();

  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(null); // full detail of the open one, if any
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson("/api/migrations");
      const list = Array.isArray(data?.requests) ? data.requests : [];
      setRows(list);
      const open = list.find((r) => OPEN_STATUSES.includes(r.status));
      if (open) {
        const detail = await fetchJson(`/api/migrations/${open.id}`);
        setActive(detail.request);
      } else {
        setActive(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Confirming a payment on return from Stripe — see
  // app/api/migrations/[id]/checkout's GET, and the header comment there
  // about why this is a second door rather than the only one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("paid");
    if (!sessionId || !active?.id) return;
    (async () => {
      try {
        const result = await fetchJson(
          `/api/migrations/${active.id}/checkout?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (result.settled) setNote(t("app.migration.paidNote"));
        await load();
      } catch {
        // The webhook will settle it even if this call failed — see the
        // header comment on lib/migrations/payment.js.
      } finally {
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowUpDown size={22} className="text-muted-foreground" />
          {t("app.migration.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.migration.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {note && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {note}
        </div>
      )}

      {active ? (
        <ActiveRequest
          request={active}
          t={t}
          formatDateTime={formatDateTime}
          formatDate={formatDate}
          setError={setError}
          setNote={setNote}
          reload={load}
        />
      ) : (
        <NewRequestForm t={t} setError={setError} reload={load} />
      )}

      {rows?.length > 0 && (
        <History rows={rows} active={active} t={t} formatDate={formatDate} />
      )}
    </div>
  );
}

function NewRequestForm({ t, setError, reload }) {
  const [sourceSystems, setSourceSystems] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await fetchJson("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSystems, description }),
      });
      setSourceSystems("");
      setDescription("");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold text-foreground">{t("app.migration.requestTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("app.migration.requestBody")}</p>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t("app.migration.sourceLabel")}
        </label>
        <input
          value={sourceSystems}
          onChange={(e) => setSourceSystems(e.target.value)}
          placeholder={t("app.migration.sourcePlaceholder")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t("app.migration.descriptionLabel")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={t("app.migration.descriptionPlaceholder")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={sending || (!sourceSystems.trim() && !description.trim())}
        className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
      >
        {sending && <Loader2 size={14} className="animate-spin" />}
        {t("app.migration.requestSubmit")}
      </button>
    </form>
  );
}

function statusBadge(status, t) {
  const map = {
    requested: { cls: "bg-muted text-muted-foreground", key: "app.migration.status.requested" },
    scheduled: { cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300", key: "app.migration.status.scheduled" },
    quoted: { cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300", key: "app.migration.status.quoted" },
    accepted: { cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300", key: "app.migration.status.accepted" },
    paid: { cls: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300", key: "app.migration.status.paid" },
    in_progress: { cls: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300", key: "app.migration.status.inProgress" },
    completed: { cls: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300", key: "app.migration.status.completed" },
    declined: { cls: "bg-muted text-muted-foreground", key: "app.migration.status.declined" },
    cancelled: { cls: "bg-muted text-muted-foreground", key: "app.migration.status.cancelled" },
  }[status] || { cls: "bg-muted text-muted-foreground", key: status };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${map.cls}`}>
      {t(map.key)}
    </span>
  );
}

function ActiveRequest({ request, t, formatDateTime, formatDate, setError, setNote, reload }) {
  const currency = request.currency || "CAD";

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">{t("app.migration.requestTitle")}</h2>
          {statusBadge(request.status, t)}
        </div>

        {request.sourceSystems && (
          <p className="text-sm text-foreground">{request.sourceSystems}</p>
        )}
        {request.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>
        )}

        {request.status === "requested" && (
          <ScheduleCard requestId={request.id} t={t} setError={setError} reload={reload} />
        )}

        {request.status === "scheduled" && request.scheduledAt && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarClock size={15} className="mt-0.5 shrink-0" />
            <span>{t("app.migration.scheduledFor", { when: formatDateTime(new Date(request.scheduledAt)) })}</span>
          </div>
        )}

        {request.status === "quoted" && (
          <QuoteCard request={request} t={t} currency={currency} setError={setError} setNote={setNote} reload={reload} />
        )}

        {request.status === "accepted" && (
          <PayCard request={request} t={t} currency={currency} setError={setError} reload={reload} />
        )}

        {(request.status === "paid" || request.status === "in_progress") && (
          <p className="text-sm text-muted-foreground">{t("app.migration.workingNote")}</p>
        )}

        {request.status === "completed" && (
          <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1.5">
            <CheckCircle2 size={15} /> {t("app.migration.completedNote")}
          </p>
        )}

        {["requested", "scheduled", "quoted", "accepted"].includes(request.status) && (
          <CancelButton requestId={request.id} t={t} setError={setError} reload={reload} />
        )}
      </div>

      {request.writes?.length > 0 && (
        <BroughtIn writes={request.writes} t={t} formatDate={formatDate} />
      )}

      <DocumentsCard request={request} t={t} formatDate={formatDate} setError={setError} reload={reload} />
    </div>
  );
}

function ScheduleCard({ requestId, t, setError, reload }) {
  const [days, setDays] = useState(null);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    fetchJson("/api/migrations/slots")
      .then((d) => setDays(Array.isArray(d?.days) ? d.days : []))
      .catch(() => setDays([]));
  }, []);

  async function book(iso) {
    setBooking(iso);
    setError("");
    try {
      await fetchJson(`/api/migrations/${requestId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: iso }),
      });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(null);
    }
  }

  return (
    <div className="border-t border-border pt-3">
      <p className="text-sm text-foreground font-medium mb-2">{t("app.migration.bookTitle")}</p>
      {days === null && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      {days?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("app.migration.noSlots")}</p>
      )}
      <div className="space-y-2">
        {days?.map((d) => (
          <div key={d.day}>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{d.day}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.slots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  disabled={booking === s.iso}
                  onClick={() => book(s.iso)}
                  className="text-xs font-medium border border-border rounded-full px-2.5 py-1 hover:bg-muted disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteCard({ request, t, currency, setError, setNote, reload }) {
  const [responding, setResponding] = useState(null);

  async function respond(action) {
    setResponding(action);
    setError("");
    setNote("");
    try {
      await fetchJson(`/api/migrations/${request.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setNote(action === "accept" ? t("app.migration.acceptedNote") : t("app.migration.declinedNote"));
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-2xl font-bold text-foreground">
        {formatMoney((request.priceCents || 0) / 100, currency)}
      </p>
      {request.quoteNote && <p className="text-sm text-muted-foreground">{request.quoteNote}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!!responding}
          onClick={() => respond("accept")}
          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {responding === "accept" && <Loader2 size={14} className="animate-spin" />}
          <CheckCircle2 size={14} /> {t("app.migration.accept")}
        </button>
        <button
          type="button"
          disabled={!!responding}
          onClick={() => respond("decline")}
          className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {responding === "decline" && <Loader2 size={14} className="animate-spin" />}
          <XCircle size={14} /> {t("app.migration.decline")}
        </button>
      </div>
    </div>
  );
}

function PayCard({ request, t, currency, setError }) {
  const [paying, setPaying] = useState(false);

  async function pay() {
    setPaying(true);
    setError("");
    try {
      const { checkoutUrl } = await fetchJson(`/api/migrations/${request.id}/checkout`, {
        method: "POST",
      });
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-2xl font-bold text-foreground">
        {formatMoney((request.priceCents || 0) / 100, currency)}
      </p>
      <button
        type="button"
        disabled={paying}
        onClick={pay}
        className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
      >
        {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
        {t("app.migration.payNow")}
      </button>
      <p className="text-xs text-muted-foreground">{t("app.migration.payHint")}</p>
    </div>
  );
}

function CancelButton({ requestId, t, setError, reload }) {
  const [cancelling, setCancelling] = useState(false);
  async function cancel() {
    if (!window.confirm(t("app.migration.cancelConfirm"))) return;
    setCancelling(true);
    setError("");
    try {
      await fetchJson(`/api/migrations/${requestId}/cancel`, { method: "POST" });
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }
  return (
    <button
      type="button"
      disabled={cancelling}
      onClick={cancel}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
    >
      {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
      {t("app.migration.cancelRequest")}
    </button>
  );
}

function DocumentsCard({ request, t, formatDate, setError, reload }) {
  const [uploading, setUploading] = useState(false);
  const canUpload = request.status !== "declined" && request.status !== "cancelled";

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/migrations/${request.id}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold text-foreground">{t("app.migration.documentsTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("app.migration.documentsBody")}</p>

      {canUpload && (
        <label className="inline-flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer w-fit">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {t("app.migration.uploadFile")}
          <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
      )}

      {request.documents?.length > 0 && (
        <ul className="divide-y divide-border">
          {request.documents.map((d) => (
            <li key={d.id} className="py-2 flex items-center gap-2 text-sm">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <span className="text-foreground truncate">{d.filename || t("app.migration.unnamedFile")}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-auto">{formatDate(d.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BroughtIn({ writes, t, formatDate }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-2">
      <h2 className="font-semibold text-foreground">{t("app.migration.broughtInTitle")}</h2>
      <ul className="divide-y divide-border">
        {writes.map((w) => (
          <li key={w.id} className="py-2 text-sm flex items-center justify-between gap-3">
            <span className="text-foreground truncate">
              {w.entityType === "Client" ? w.snapshot?.name : w.snapshot?.quoteNumber || w.entityType}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{formatDate(w.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function History({ rows, active, t, formatDate }) {
  const past = rows.filter((r) => r.id !== active?.id);
  if (past.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">{t("app.migration.historyTitle")}</h2>
      </div>
      <div className="divide-y divide-border">
        {past.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-5 py-3 gap-3">
            <span className="text-sm text-foreground truncate">{r.sourceSystems || t("app.migration.unnamedRequest")}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
              {statusBadge(r.status, t)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
