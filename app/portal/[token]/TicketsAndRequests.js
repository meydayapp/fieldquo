// app/portal/[token]/TicketsAndRequests.js
//
// The client's two ways to ask the company for something, and the record of
// what they asked:
//
//   Report an issue  → a client ticket (repair / warranty / question /
//                      billing), from here or from a past visit's row, with
//                      photos. The office answers in its Tickets queue; the
//                      answer comes back by email and appears here.
//   Request work     → a new job or quote request (the company's enabled
//                      services, names only — never a price), or a
//                      maintenance visit: "book my next included visit" on a
//                      plan the client has, "set up recurring maintenance"
//                      when they have none.
//   Your requests    → every ticket with its status and conversation, and a
//                      reply box while it is not closed.
//
// Everything lands for the company to confirm; the sentences under the send
// buttons say so. Fed by GET /api/portal/[token]/tickets; every id it sends
// back was proved server-side to be this client's.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LifeBuoy, Plus, Wrench, Loader2, Check, Camera, X, ChevronDown, MessageSquare } from "lucide-react";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { jsonBody } from "@/lib/jsonBody";

const INK = "#2d2520";
const MUTED = "text-[#2d2520]/[0.72]";
const ISSUE_TYPES = ["repair", "warranty", "question", "billing"];
// Neutral, measured chips — a status is a fact about the request, not the
// company's brand (the same reasoning as the quote pill in ClientPortal.js).
const STATUS_TONE = {
  open: "bg-amber-50 border-amber-200 text-amber-800",
  in_progress: "bg-blue-50 border-blue-200 text-blue-800",
  waiting_on_client: "bg-violet-50 border-violet-200 text-violet-800",
  resolved: "bg-green-50 border-green-200 text-green-800",
  closed: "bg-black/5 border-black/10 text-[#2d2520]/[0.72]",
};

function usePhotoUpload(token, c) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function add(files) {
    setError("");
    setBusy(true);
    try {
      for (const file of Array.from(files || []).slice(0, 6 - photos.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/portal/${token}/upload`, { method: "POST", body: fd });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.url) {
          setError(c.uploadFailed);
          continue;
        }
        setPhotos((prev) => [...prev, { url: d.url, kind: d.kind, filename: d.filename }]);
      }
    } finally {
      setBusy(false);
    }
  }
  return { photos, setPhotos, busy, error, add, reset: () => setPhotos([]) };
}

function PhotoPicker({ up, c }) {
  const input = useRef(null);
  return (
    <div>
      <div className={`text-xs font-semibold ${MUTED}`}>{c.photosLabel}</div>
      <div className="flex gap-2 flex-wrap mt-1.5">
        {up.photos.map((p) => (
          <span key={p.url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-black/10" />
            <button
              type="button"
              aria-label={c.cancel}
              onClick={() => up.setPhotos((prev) => prev.filter((x) => x.url !== p.url))}
              className="absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-white border border-black/15"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {up.photos.length < 6 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={up.busy}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-dashed border-black/25 text-sm font-semibold disabled:opacity-60"
            style={{ color: INK }}
          >
            {up.busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {up.busy ? c.uploading : c.addPhoto}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => up.add(e.target.files)} />
      </div>
      {up.error && <p className="text-xs text-red-700 mt-1">{up.error}</p>}
    </div>
  );
}

export default function TicketsAndRequests({ token, copy, locale, brandColor, companyName, issueDraft, onIssueDraftUsed }) {
  const c = copy.portal.tickets;
  const theme = useMemo(() => documentTheme({ brandColor }), [brandColor]);
  const fill = useMemo(() => fillPair(theme), [theme]);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // null | "issue" | "work"
  const [done, setDone] = useState("");
  const anchor = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}/tickets`);
      if (res.ok) setData(await res.json());
    } catch {
      /* the section simply stays hidden; the rest of the portal is unaffected */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // "Report an issue" pressed on a past visit: open the form here, about it.
  useEffect(() => {
    if (!issueDraft) return;
    setMode("issue");
    setDone("");
    anchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [issueDraft]);

  if (!data) return null;
  const date = (d) => {
    try {
      return new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div ref={anchor} className="bg-white border border-black/10 rounded-2xl px-5 sm:px-6 py-4 mb-6 scroll-mt-4" data-portal-requests>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 font-semibold" style={{ color: INK }}>
          <LifeBuoy size={16} className="text-[#2d2520]/60" /> {c.heading}
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            data-portal-report-issue
            onClick={() => { setMode(mode === "issue" ? null : "issue"); setDone(""); }}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border text-sm font-semibold"
            style={{ borderColor: theme.accentText, color: theme.accentText }}
          >
            <Wrench size={14} /> {c.reportIssue}
          </button>
          <button
            type="button"
            data-portal-request-work
            onClick={() => { setMode(mode === "work" ? null : "work"); setDone(""); }}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-semibold"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            <Plus size={14} /> {c.requestWork}
          </button>
        </div>
      </div>

      {done && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800" data-portal-request-sent>
          <Check size={15} className="shrink-0 mt-0.5" /> {done}
        </div>
      )}

      {mode === "issue" && (
        <IssueForm
          token={token}
          c={c}
          fill={fill}
          draft={issueDraft}
          onCancel={() => { setMode(null); onIssueDraftUsed?.(); }}
          onSent={async () => {
            setMode(null);
            onIssueDraftUsed?.();
            setDone(c.sent(companyName));
            await load();
          }}
        />
      )}
      {mode === "work" && (
        <WorkForm
          token={token}
          c={c}
          fill={fill}
          data={data}
          companyName={companyName}
          onCancel={() => setMode(null)}
          onSent={async (msg) => {
            setMode(null);
            setDone(msg);
            await load();
          }}
        />
      )}

      {data.tickets.length > 0 && (
        <div className="divide-y divide-black/5 mt-3">
          {data.tickets.map((tk) => (
            <TicketRow key={tk.id} tk={tk} token={token} c={c} fill={fill} date={date} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueForm({ token, c, fill, draft, onCancel, onSent }) {
  const [type, setType] = useState("repair");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const up = usePhotoUpload(token, c);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ type, subject, body, photos: up.photos, jobVisitId: draft?.jobVisitId || null }, "ticket"),
      });
      if (!res.ok) {
        setError(c.failed);
        return;
      }
      await onSent();
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-black/10 bg-[#faf8f5] p-4 space-y-3" data-portal-issue-form>
      <div className="font-semibold text-sm" style={{ color: INK }}>{c.reportTitle}</div>
      {draft?.label && <p className={`text-xs ${MUTED}`}>{c.aboutVisit(draft.label)}</p>}
      <fieldset>
        <legend className={`text-xs font-semibold ${MUTED}`}>{c.typeLabel}</legend>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {ISSUE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`min-h-11 px-3 rounded-full border text-sm font-semibold ${type === t ? "" : "bg-white border-black/15"}`}
              style={type === t ? { backgroundColor: fill.bg, color: fill.fg, borderColor: fill.bg } : { color: INK }}
            >
              {c.types[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs font-semibold" style={{ color: INK }}>
        {c.subjectLabel}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} required className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm font-normal" />
      </label>
      <label className="block text-xs font-semibold" style={{ color: INK }}>
        {c.bodyLabel}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} required className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-normal" />
      </label>
      <PhotoPicker up={up} c={c} />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || up.busy || !subject.trim() || !body.trim()} className="inline-flex items-center gap-2 min-h-11 px-5 rounded-full text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: fill.bg, color: fill.fg }}>
          {busy && <Loader2 size={14} className="animate-spin" />} {c.send}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold underline min-h-11" style={{ color: INK }}>{c.cancel}</button>
      </div>
    </form>
  );
}

function WorkForm({ token, c, fill, data, companyName, onCancel, onSent }) {
  const plans = data.maintenancePlans || [];
  const [kind, setKind] = useState("new_work"); // new_work | maintenance
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState("");
  const [dates, setDates] = useState("");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const up = usePhotoUpload(token, c);
  const plan = plans.find((p) => p.id === planId);

  async function post(url, payload) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonBody(payload, "request") });
    return res.ok;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let ok;
      if (kind === "maintenance" && plan) {
        ok = await post(`/api/portal/${token}/tickets`, { type: "maintenance", servicePlanId: plan.id, preferredWindow: dates, body: message, photos: up.photos });
      } else {
        ok = await post(`/api/portal/${token}/request`, {
          kind: kind === "maintenance" ? "maintenance_setup" : "new_work",
          categoryId: kind === "new_work" && categoryId ? categoryId : null,
          message,
          preferredDates: dates,
          photos: up.photos,
        });
      }
      if (!ok) {
        setError(c.failed);
        return;
      }
      await onSent(c.workSent(companyName));
    } catch {
      setError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  const needsMessage = !(kind === "maintenance" && plan);
  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-black/10 bg-[#faf8f5] p-4 space-y-3" data-portal-work-form>
      <div className="font-semibold text-sm" style={{ color: INK }}>{c.workTitle}</div>
      <div className="flex flex-wrap gap-2">
        {[["new_work", c.workNewJob], ["maintenance", c.workMaintenance]].map(([k, text]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-11 px-3 rounded-full border text-sm font-semibold ${kind === k ? "" : "bg-white border-black/15"}`}
            style={kind === k ? { backgroundColor: fill.bg, color: fill.fg, borderColor: fill.bg } : { color: INK }}
          >
            {text}
          </button>
        ))}
      </div>

      {kind === "new_work" && data.services.length > 0 && (
        <label className="block text-xs font-semibold" style={{ color: INK }}>
          {c.workService}
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm font-normal">
            <option value="">{c.workServiceOther}</option>
            {data.services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}

      {kind === "maintenance" && plans.length > 0 && (
        <div>
          <label className="block text-xs font-semibold" style={{ color: INK }}>
            {c.workPlan}
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm font-normal">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {plan && (
            <p className={`text-xs mt-1 ${MUTED}`} data-portal-plan-remaining>
              {plan.remaining == null ? c.workUntilCancelled : c.workRemaining(plan.remaining)}
            </p>
          )}
        </div>
      )}
      {kind === "maintenance" && plans.length === 0 && <p className={`text-sm ${MUTED}`}>{c.workSetupIntro(companyName)}</p>}

      <label className="block text-xs font-semibold" style={{ color: INK }}>
        {kind === "maintenance" && plan ? c.workNote : kind === "maintenance" ? c.workSetupDescribe : c.workDescribe}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={4000} required={needsMessage} className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-normal" />
      </label>
      <label className="block text-xs font-semibold" style={{ color: INK }}>
        {kind === "maintenance" && plan ? c.workWindow : c.workDates}
        <input value={dates} onChange={(e) => setDates(e.target.value)} maxLength={300} placeholder={kind === "maintenance" && plan ? c.workWindowPlaceholder : c.workDatesPlaceholder} className="mt-1 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm font-normal" />
      </label>
      <PhotoPicker up={up} c={c} />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || up.busy || (needsMessage && !message.trim())} className="inline-flex items-center gap-2 min-h-11 px-5 rounded-full text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: fill.bg, color: fill.fg }}>
          {busy && <Loader2 size={14} className="animate-spin" />} {c.send}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold underline min-h-11" style={{ color: INK }}>{c.cancel}</button>
      </div>
      <p className={`text-xs ${MUTED}`}>{c.workConfirmNote(companyName)}</p>
    </form>
  );
}

function TicketRow({ tk, token, c, fill, date, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const photos = (list) =>
    list?.length ? (
      <div className="flex gap-1.5 flex-wrap mt-1.5">
        {list.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="w-16 h-14 object-cover rounded-lg border border-black/10" />
          </a>
        ))}
      </div>
    ) : null;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/tickets/${tk.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ body: reply }, "reply"),
      });
      if (!res.ok) {
        setError(c.failed);
        return;
      }
      setReply("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-3" data-portal-ticket={tk.id}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-start justify-between gap-3 text-left min-h-11">
        <span className="min-w-0">
          <span className="block font-medium text-sm" style={{ color: INK }}>{tk.subject}</span>
          <span className={`block text-xs mt-0.5 ${MUTED}`}>
            {c.types[tk.type] || ""} · {date(tk.updatedAt)}
            {tk.messages.length > 0 && (
              <span className="inline-flex items-center gap-1 ml-1.5"><MessageSquare size={11} /> {tk.messages.length}</span>
            )}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_TONE[tk.status] || STATUS_TONE.closed}`}>{c.status[tk.status] || ""}</span>
          <ChevronDown size={14} className={open ? "rotate-180" : ""} />
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="rounded-xl border border-black/10 p-3">
            <div className={`text-xs font-semibold ${MUTED}`}>{c.you} · {date(tk.createdAt)}</div>
            <p className="text-sm whitespace-pre-wrap mt-1" style={{ color: INK }}>{tk.body}</p>
            {photos(tk.photos)}
          </div>
          {tk.messages.map((m) => (
            <div key={m.id} className={`rounded-xl p-3 border ${m.author === "member" ? "bg-[#faf8f5] border-black/10 ml-4" : "border-black/10 mr-4"}`}>
              <div className={`text-xs font-semibold ${MUTED}`}>{m.author === "member" ? m.name || "" : c.you} · {date(m.createdAt)}</div>
              <p className="text-sm whitespace-pre-wrap mt-1" style={{ color: INK }}>{m.body}</p>
              {photos(m.photos)}
            </div>
          ))}
          {tk.status === "closed" ? (
            <p className={`text-xs ${MUTED}`}>{c.closedNote}</p>
          ) : (
            <div>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={5000} placeholder={c.replyPlaceholder} className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" />
              {error && <p className="text-xs text-red-700">{error}</p>}
              <button type="button" onClick={send} disabled={busy || !reply.trim()} className="mt-1.5 inline-flex items-center gap-2 min-h-11 px-4 rounded-full text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: fill.bg, color: fill.fg }}>
                {busy && <Loader2 size={13} className="animate-spin" />} {c.sendReply}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
