"use client";

// app/app/settings/ai-employee/page.js
//
// Hiring the AI employees: which jobs they do, what face and name a customer
// sees, what they may do ON THEIR OWN, which channels they answer, and the
// inbox of things they wanted to do and are waiting for a yes on.
//
// ── Honesty mechanisms on this screen ──────────────────────────────────────
//
// 1. THE MODE SAYS ITS CONSEQUENCE. Three modes, each with the sentence
//    lib/aiEmployee/permission.js pins (the check asserts the English here
//    equals the file's), and the floor — what NO mode may do alone — printed
//    in words underneath. Moving to a more permissive mode shows a warning
//    and waits for a second click — the screen auto-saves everything else,
//    but not that — and the save writes an audit row with the mover's name.
//
// 1b. EVERY FIELD SAVES ITSELF, FOR ONE EMPLOYEE. The selected employee's
//    settings sit inside that employee's own card under the team tabs; each
//    field saves on its own (text after a pause in typing) with the
//    employee's id, and says Saving… / Saved / Couldn't save — Retry beside
//    itself. The server refuses a save with no id, and one naming another
//    company's employee (lib/aiEmployee/settings.js).
//
// 2. THE ON/OFF SWITCH SAYS ITS CONSEQUENCE. Off means no channel routes to
//    this employee, nothing is proposed, nothing is metered; the widget and
//    the text line say "someone will reply shortly" and the message lands in
//    Conversations for a person.
//
// 3. THE TEST BOX runs the real thing — respondToMessage, dry run — on the
//    channel you pick, and prints "would send" or "would wait for you" from
//    the mode, plus every tool call that would have become a proposal.
//
// 4. THE SMS CHANNEL IS GREYED OUT, in one sentence, until FieldQuo holds a
//    system number. Never a switch that fails.
//
// 5. THE PROPOSALS INBOX approves through the SAME tool the employee would
//    have run, bound to the exact arguments you read (a hash travels with
//    each row), and a booking whose slot has passed is marked stale rather
//    than executed.
//
// 6. THE FLOW VIEW (app/components/aiEmployee/TeamFlow.js) draws the routing
//    process — channels, the front desk, one card per employee with its tool
//    chips, the proposals gate, and the person every card can reach — from
//    the server's own role table and routing log. Its two controls (which
//    employee an intent goes to; a tool switch inside the role) save through
//    PATCH /api/ai-employee, and what is drawn afterwards is the server's
//    answer, never a local guess.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import Link from "next/link";
import {
  Bot,
  Upload,
  Trash2,
  FlaskConical,
  AlertTriangle,
  Info,
  Send,
  X,
  FileText,
  Check,
  Shield,
  MessageSquare,
  Globe,
  Smartphone,
  ClipboardCheck,
  UserPlus,
  Pencil,
  Coins,
  Workflow,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { uploadFile } from "@/lib/media/uploadClient";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { formatCalendarDay } from "@/lib/format/localeDate";
import BackToHome from "@/app/components/BackToHome";
import TeamFlow from "@/app/components/aiEmployee/TeamFlow";

const money = (cents) => formatAppMoney(Number(cents || 0) / 100, CREDIT_CURRENCY, "en");

// The house control sizes. Kept as constants so the touch floor is stated once
// — scripts/check-mobile-surfaces.mjs resolves a `const` into the class text,
// so this is checkable rather than decorative.
const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground";
const BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px]";
const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground disabled:opacity-50`;
const BTN_QUIET = `${BTN} border border-border text-foreground disabled:opacity-50`;

/** The three modes, in the order the permission file lists them. Rank is
 *  used only to decide whether a change is towards MORE autonomy, which is
 *  the direction that gets a warning. */
const MODE_RANK = { ask: 0, accept_edits: 1, auto: 2 };

function Card({ id, title, icon: Icon, hint, children, tour }) {
  return (
    <section id={id} data-tour={tour} className="bg-card border border-border rounded-xl p-5 scroll-mt-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={17} className="text-muted-foreground" />}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Notice({ tone = "info", children }) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      : "border-border bg-muted text-foreground";
  return (
    <div className={`rounded-lg border p-3 text-sm flex gap-2 items-start ${cls}`}>
      {tone === "warn" ? (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <Info size={16} className="mt-0.5 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function Face({ url, name, size = 48 }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full bg-muted text-foreground inline-flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * One field's save state, beside the field. Nothing before the first edit —
 * "Saved" on a field nobody touched would be a claim about nothing.
 */
function SaveState({ s, onRetry, t }) {
  if (!s) return null;
  if (s.state === "saving") {
    return (
      <span role="status" className="text-xs text-muted-foreground">
        {t("app.common.saving", "Saving…")}
      </span>
    );
  }
  if (s.state === "saved") {
    return (
      <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
        <Check size={12} /> {t("app.common.saved", "Saved")}
      </span>
    );
  }
  return (
    <span role="alert" className="text-xs text-red-700 dark:text-red-300 inline-flex flex-wrap items-center gap-1">
      {s.message || t("app.aiEmployee.autosave.failed", "Couldn't save")}
      {s.job && (
        <button type="button" onClick={onRetry} className="underline font-medium min-h-[44px] px-1">
          {t("app.aiEmployee.autosave.retry", "Retry")}
        </button>
      )}
    </span>
  );
}

/** A labelled field with its save state on the label line. */
function FieldHead({ label, note }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="text-sm text-foreground">{label}</span>
      {note}
    </span>
  );
}

/** A section INSIDE the selected employee's card. */
function Part({ id, title, icon: Icon, hint, children }) {
  return (
    <section id={id} className="border-t border-border pt-5 mt-5 scroll-mt-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-muted-foreground" />}
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A chat bubble, per channel, for the test box and the proposals. */
function ChannelFrame({ channel, children, t }) {
  const label =
    channel === "web"
      ? t("app.aiEmployee.channel.web", "Website chat")
      : channel === "sms"
        ? t("app.aiEmployee.channel.sms", "Text message")
        : t("app.aiEmployee.channel.meta", "Facebook / Instagram / WhatsApp");
  const Icon = channel === "web" ? Globe : channel === "sms" ? Smartphone : MessageSquare;
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <Icon size={12} /> {label}
      </p>
      <div
        className={
          channel === "sms"
            ? "max-w-[320px] rounded-2xl bg-emerald-600 text-white px-3 py-2 text-sm whitespace-pre-wrap"
            : "max-w-[420px] rounded-2xl bg-background border border-border px-3 py-2 text-sm text-foreground whitespace-pre-wrap"
        }
      >
        {children}
      </div>
    </div>
  );
}

export default function AiEmployeePage() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [sources, setSources] = useState([]);
  const [queue, setQueue] = useState({ suggestions: [], stopped: [] });
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [confirmFire, setConfirmFire] = useState(false);
  const [firing, setFiring] = useState(false);
  // `${employeeId}:${field}` → { state: "saving" | "saved" | "error", message?, job? }.
  // Keyed by EMPLOYEE as well as field, so switching to another employee
  // never shows the first one's "Saved" — or hides its "Couldn't save".
  const [fieldState, setFieldState] = useState({});
  // A move to MORE autonomy waits here for a second click. Auto-save must
  // not turn one stray tap on a radio into "it books on its own now".
  const [modeAsk, setModeAsk] = useState(null);
  const [disclosureBusy, setDisclosureBusy] = useState(false);
  const [testText, setTestText] = useState("");
  const [testChannel, setTestChannel] = useState("meta");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: "", kind: "policy", text: "" });
  const [hiring, setHiring] = useState(false);
  const [editing, setEditing] = useState({}); // proposalId → edited args JSON text
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);
  const faceInput = useRef(null);

  // ── Why the main load reports a REASON and the other loads do not ─────────
  //
  // This screen sat on "Loading…" forever on a real account: a refused load
  // and a load still in flight drew the identical frame. So `load()` records
  // why it failed in state the render reads, the loads run under allSettled
  // so one failure cannot strand the rest, and `setLoading(false)` sits in a
  // `finally`. The secondary lists only toast.
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-employee");
      if (!res.ok) {
        const msg = t("app.aiEmployee.loadError", "Couldn't load the AI employee.");
        await reportResponseError(res, setLoadError, msg);
        return;
      }
      const d = await res.json();
      setData(d);
      setSelectedId((cur) => (cur && d.employees.some((e) => e.id === cur) ? cur : d.employees[0]?.id || null));
      setLoadError(null);
    } catch (err) {
      setLoadError(err?.message || t("app.aiEmployee.loadError", "Couldn't load the AI employee."));
    }
  }, [t]);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-employee/sources");
      if (!res.ok) {
        await reportResponseError(res, t("app.aiEmployee.sourcesLoadError", "Couldn't load your material."));
        return;
      }
      setSources((await res.json()).sources || []);
    } catch {
      showError(t("app.aiEmployee.sourcesLoadError", "Couldn't load your material."));
    }
  }, [t]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-employee/suggestions");
      if (!res.ok) {
        await reportResponseError(res, t("app.aiEmployee.queueLoadError", "Couldn't load the waiting drafts."));
        return;
      }
      setQueue(await res.json());
    } catch {
      showError(t("app.aiEmployee.queueLoadError", "Couldn't load the waiting drafts."));
    }
  }, [t]);

  const loadProposals = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-employee/proposals");
      if (!res.ok) {
        await reportResponseError(res, t("app.aiEmployee.proposalsLoadError", "Couldn't load what it's waiting to do."));
        return;
      }
      setProposals((await res.json()).proposals || []);
    } catch {
      showError(t("app.aiEmployee.proposalsLoadError", "Couldn't load what it's waiting to do."));
    }
  }, [t]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([load(), loadSources(), loadQueue(), loadProposals()]);
    } finally {
      setLoading(false);
    }
  }, [load, loadSources, loadQueue, loadProposals]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saved_ = useMemo(() => data?.employees.find((e) => e.id === selectedId) || null, [data, selectedId]);

  // ── The form follows the selected employee — and ONLY the selection ──────
  //
  // It used to be re-seeded whenever the selected row's updatedAt moved. The
  // flow view's tool switch is a PATCH that moves updatedAt, so a name typed
  // and not yet saved was silently replaced by the server's old one — one of
  // the reasons the owner saw "it doesn't save the name and voice". Now the
  // form is seeded when a different employee is selected and never again
  // under the person typing; every edit is saved on its own (below), so
  // there is nothing unsaved for a re-seed to protect. Derived during render
  // (React's "adjusting state when a prop changes" shape) so the first frame
  // after a switch already shows the right employee.
  const [formFor, setFormFor] = useState(null);
  const formKey = saved_ ? saved_.id || "unsaved" : null;
  if (formKey !== formFor) {
    setFormFor(formKey);
    setForm(saved_ ? { ...saved_ } : null);
    setModeAsk(null);
  }
  const role = useMemo(() => (data?.roles || []).find((r) => r.key === form?.role) || null, [data, form]);

  // ── Auto-save, one field at a time ──────────────────────────────────────
  //
  // The owner, 2026-09-22: "it should have auto save". One Save button at the
  // foot of six cards was the other half of "it doesn't save": the name is
  // typed in the first card and the button is a long scroll away, past
  // anything that might re-seed the form. Now each field saves itself —
  // text after a short pause in typing, switches and pickers at once — with
  // its OWN state beside it: Saving… / Saved / Couldn't save — Retry. The
  // request carries the employee's id and that field only, so two fields in
  // flight cannot overwrite each other and an edit can only ever land on the
  // employee it was typed into, even if the selection has moved since.
  const timers = useRef({});
  const queued = useRef({});
  const latest = useRef({});

  const markField = useCallback((key, next) => {
    setFieldState((s) => ({ ...s, [key]: next }));
  }, []);

  const sendField = useCallback(
    async (key, { keepalive = false } = {}) => {
      const job = queued.current[key];
      if (!job) return;
      delete queued.current[key];
      clearTimeout(timers.current[key]);
      delete timers.current[key];
      const seq = (latest.current[key] || 0) + 1;
      latest.current[key] = seq;
      markField(key, { state: "saving" });

      const fail = (message) => {
        // A later edit of the same field supersedes this failure.
        if (latest.current[key] !== seq) return;
        markField(key, { state: "error", message, job });
        job.revert?.();
      };

      let res;
      try {
        res = await fetch("/api/ai-employee", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: job.id, [job.field]: job.value }),
          keepalive,
        });
      } catch {
        const message = t("app.aiEmployee.autosave.offline", "Couldn't reach the server — check your connection, then retry.");
        showError(message);
        fail(message);
        return;
      }
      if (!res.ok) {
        const refusal = await res.clone().json().catch(() => ({}));
        const known = refusal?.reason ? t(`app.aiEmployee.saveRefused.${refusal.reason}`, "") : "";
        let message;
        if (known) {
          message = known;
          showError(known);
        } else {
          message = await reportResponseError(res, t("app.aiEmployee.saveError", "Couldn't save."));
        }
        fail(message || t("app.aiEmployee.saveError", "Couldn't save."));
        return;
      }
      const { employee } = await res.json().catch(() => ({}));
      if (latest.current[key] !== seq) return;
      if (employee?.id) {
        // Merge the field this request saved — not the whole row, which may
        // predate a neighbouring field's save that finished first.
        setData((d) => ({
          ...d,
          employees: d.employees.map((e) =>
            e.id === employee.id ? { ...e, [job.field]: employee[job.field], updatedAt: employee.updatedAt } : e,
          ),
        }));
      }
      markField(key, { state: "saved" });
    },
    [markField, t],
  );

  /** Queue one field of the selected employee. `delay` is the typing pause. */
  const saveField = useCallback(
    (id, field, value, { delay = 0, revert = null } = {}) => {
      // The support session's unsaved preview row has no id: nothing to save.
      if (!id) return;
      const key = `${id}:${field}`;
      queued.current[key] = { id, field, value, revert };
      markField(key, { state: "saving" });
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => sendField(key), delay);
    },
    [markField, sendField],
  );

  /** Write to the form AND save. Text waits for a pause; switches don't. */
  const edit = (patch, { typing = false } = {}) => {
    if (!form?.id) return;
    const id = form.id;
    setForm((f) => ({ ...f, ...patch }));
    for (const [field, value] of Object.entries(patch)) {
      const before = form[field];
      saveField(id, field, value, {
        delay: typing ? 800 : 0,
        // A refused switch goes back to what the server holds, so the screen
        // never shows a channel "on" that is off. Typed text is kept — losing
        // what somebody wrote is worse than an error beside it.
        revert: typing ? null : () => setForm((f) => (f && f.id === id ? { ...f, [field]: before } : f)),
      });
    }
  };

  const retryField = (key) => {
    const job = fieldState[key]?.job;
    if (!job) return;
    saveField(job.id, job.field, job.value);
  };

  /** Send everything still waiting for its typing pause — now. */
  const flushAll = useCallback(
    (opts) => {
      for (const key of Object.keys(queued.current)) sendField(key, opts);
    },
    [sendField],
  );

  // Leaving the page mid-pause must not lose the last few letters.
  useEffect(() => {
    const onLeave = () => flushAll({ keepalive: true });
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, [flushAll]);

  function selectEmployee(id) {
    flushAll();
    setSelectedId(id);
  }

  const stateOf = (field) => (form?.id ? fieldState[`${form.id}:${field}`] : null);
  const savedNote = (field) => <SaveState s={stateOf(field)} onRetry={() => retryField(`${form.id}:${field}`)} t={t} />;

  // ── Telling clients it's an AI (company-wide) ────────────────────────────
  async function setDisclosure(value) {
    setDisclosureBusy(true);
    try {
      const res = await fetch("/api/ai-employee/disclosure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiDisclosure: value }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.aiEmployee.saveError", "Couldn't save."));
        return;
      }
      const { disclosure } = await res.json();
      setData((d) => ({ ...d, disclosure }));
    } catch {
      showError(t("app.aiEmployee.autosave.offline", "Couldn't reach the server — check your connection, then retry."));
    } finally {
      setDisclosureBusy(false);
    }
  }

  async function hire(roleKey) {
    setHiring(true);
    const res = await fetch("/api/ai-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleKey }),
    });
    setHiring(false);
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.hireError", "Couldn't hire that one."));
      return;
    }
    const { employee } = await res.json();
    setData((d) => ({ ...d, employees: [...d.employees, employee] }));
    selectEmployee(employee.id);
  }

  async function fire() {
    if (!saved_?.id) return;
    setFiring(true);
    const res = await fetch("/api/ai-employee", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: saved_.id }),
    });
    setFiring(false);
    setConfirmFire(false);
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.fireError", "Couldn't fire that one."));
      return;
    }
    // The list shrinks; if it was the last, the server hands back a fresh
    // switched-off receptionist on the next read, so reload rather than
    // guess at that row here.
    const rest = data.employees.filter((e) => e.id !== saved_.id);
    if (rest.length === 0) {
      window.location.reload();
      return;
    }
    setData((d) => ({ ...d, employees: rest }));
    setSelectedId(rest[0].id);
  }

  async function uploadFace(file) {
    if (!file) return;
    let d;
    try {
      d = await uploadFile(file, { purpose: "ai-employee" });
    } catch (err) {
      // The helper's sentence names the reason (size, type, session); the
      // translated line is the fallback when it has none.
      showError(err?.message || t("app.aiEmployee.faceUploadError", "Couldn't upload that picture."));
      return;
    }
    if (d.url) edit({ avatarUrl: d.url });
  }

  async function upload(file) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("kind", "manual");
    body.append("title", file.name);
    const res = await fetch("/api/ai-employee/sources", { method: "POST", body });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.uploadError", "Couldn't add that file."));
      return;
    }
    await loadSources();
  }

  async function addPaste() {
    if (!paste.text.trim()) return;
    const res = await fetch("/api/ai-employee/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paste),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.uploadError", "Couldn't add that file."));
      return;
    }
    setPaste({ title: "", kind: "policy", text: "" });
    setPasteOpen(false);
    await loadSources();
  }

  async function removeSource(id) {
    const res = await fetch(`/api/ai-employee/sources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.deleteError", "Couldn't remove that."));
      return;
    }
    await loadSources();
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/ai-employee/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: testText, channel: testChannel, employeeId: selectedId }),
    });
    setTesting(false);
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.testError", "The test didn't run."));
      return;
    }
    setTestResult(await res.json());
  }

  // ── Sending a waiting draft ──────────────────────────────────────────────
  //
  // Through the MESSAGING feature's own reply route, not a second send path
  // here: that route holds the permission check, the rate limit, the send
  // (Meta, web chat or the text line — lib/messaging/send.js decides), the
  // failure record and the honest 409 for a channel Meta has not approved.
  async function sendSuggestion(row) {
    const res = await fetch(`/api/messaging/threads/${row.threadId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: row.text }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.sendError", "That reply didn't go out."));
      return;
    }
    const stamp = await fetch(`/api/ai-employee/suggestions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sent" }),
    });
    if (!stamp.ok) {
      showError(t("app.aiEmployee.sentNotStamped", "It went out, but we couldn't tick it off here. Refresh — don't send it twice."));
    }
    await loadQueue();
  }

  async function actOn(row, action) {
    const res = await fetch(`/api/ai-employee/suggestions/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.actionError", "That didn't work."));
      return;
    }
    await loadQueue();
  }

  // ── Proposals ────────────────────────────────────────────────────────────
  //
  // Approve sends the hash of the arguments on screen. Edit-then-approve
  // sends the edited arguments AND their hash, computed by the server from
  // what it receives — so what runs is what was sent, never what was stored
  // before the edit. The server refuses a mismatch.
  async function decide(row, action, editedArgs) {
    let body = { action };
    if (action === "approve") {
      if (editedArgs !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(editedArgs);
        } catch {
          showError(t("app.aiEmployee.proposalBadEdit", "That isn't valid — check the brackets and quotes."));
          return;
        }
        const hashRes = await fetch("/api/ai-employee/proposals/hash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ args: parsed }),
        });
        if (!hashRes.ok) {
          await reportResponseError(hashRes, t("app.aiEmployee.actionError", "That didn't work."));
          return;
        }
        const { argsHash } = await hashRes.json();
        body = { action, args: parsed, argsHash };
      } else {
        body = { action, argsHash: row.argsHash };
      }
    }
    const res = await fetch(`/api/ai-employee/proposals/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      const reasonKey = d?.error ? `app.aiEmployee.proposal.refused.${d.error}` : null;
      showError(reasonKey ? t(reasonKey, t("app.aiEmployee.actionError", "That didn't work.")) : t("app.aiEmployee.actionError", "That didn't work."));
      await loadProposals();
      return;
    }
    setEditing((e) => {
      const next = { ...e };
      delete next[row.id];
      return next;
    });
    await loadProposals();
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">{t("app.common.loading", "Loading…")}</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-3xl">
        <BackToHome />
        <Notice tone="warn">
          <p className="font-medium">{t("app.aiEmployee.loadError", "Couldn't load the AI employee.")}</p>
          {loadError && typeof loadError === "string" && <p className="mt-1 opacity-90">{loadError}</p>}
          <p className="mt-1 opacity-90">
            {t("app.aiEmployee.loadErrorHelp", "Nothing has been changed or lost — this screen only failed to read your setup.")}
          </p>
        </Notice>
        <button type="button" className={BTN_PRIMARY} onClick={loadAll}>
          {t("app.common.retry", "Try again")}
        </button>
      </div>
    );
  }

  const channelBlocked = !data.channel?.connected;
  const rolesLeft = (data.roles || []).filter((r) => !data.employees.some((e) => e.role === r.key));
  // A move towards MORE autonomy is held in `modeAsk` until confirmed; this
  // is the warning's condition.
  const modeMovesUp = Boolean(form && modeAsk && MODE_RANK[modeAsk] > MODE_RANK[form.mode]);
  const shownName = form ? form.displayName || form.name || t("app.aiEmployee.unnamed", "the assistant") : "";
  const disclosureOn = data.disclosure?.on === true;
  const disclosure = form
    ? t("app.aiEmployee.disclosurePreview", "Hi, I'm {name}, {company}'s AI assistant.", {
        name: shownName,
        company: t("app.aiEmployee.yourCompany", "your company"),
      })
    : "";
  const toolLabel = (k) => t(`app.aiEmployee.tool.${k}`, k);
  const riskLabel = (k) => t(`app.aiEmployee.risk.${k}`, k);

  // The employee card's one-line summary of every field's state.
  const mine = form?.id ? Object.entries(fieldState).filter(([k]) => k.startsWith(`${form.id}:`)).map(([, v]) => v) : [];
  const panelState = mine.some((s) => s.state === "error")
    ? "error"
    : mine.some((s) => s.state === "saving")
      ? "saving"
      : mine.some((s) => s.state === "saved")
        ? "saved"
        : "idle";

  // "QC, Canada" / "CA, United States" — the country named in the reader's
  // own language by the browser (Intl.DisplayNames), the region as its code.
  const place = data.disclosure?.place || null;
  let countryName = place?.country || "";
  try {
    if (place?.country) countryName = new Intl.DisplayNames([language || "en"], { type: "region" }).of(place.country) || place.country;
  } catch {
    /* an old browser: the code itself is still true */
  }
  const placeLabel = place ? [place.region, countryName].filter(Boolean).join(", ") : "";

  // ── Paid from the AI credit (owner, 2026-09-25) ────────────────────────
  //
  // Every state is the verdict the server's meter gave — the same one a
  // customer's next message would get (lib/ai/walletMeter.js). One notice at
  // most; the states are exclusive. The button goes to the AI credit page,
  // where the top-ups and the monthly bundles live: both fill the wallet these
  // replies draw on. The wallet is the COMPANY's, so the same notice shows in
  // whichever employee's card is open.
  const topUpButton = (
    <Link href="/app/settings/ai-credit" className={`${BTN_PRIMARY} mt-2`}>
      {t("app.aiEmployee.topUpOrBundle", "Top up or add a monthly bundle")}
    </Link>
  );
  const billingNotice = !data.ai?.configured ? null : data.ai.billing === "paused" ? (
    <Notice tone="warn">
      <p className="font-semibold">
        {t("app.aiEmployee.pausedTitle", "Your AI employee is paused — AI credit is empty")}
      </p>
      <p className="mt-1 opacity-90">
        {t("app.aiEmployee.pausedBody", "Every employee now tells customers someone will reply shortly and leaves each conversation to you. Add credit and it starts answering again — a reply costs about {amount}.", { amount: money(data.ai.typicalConversationCents) })}
      </p>
      {topUpButton}
    </Notice>
  ) : data.ai.billing === "grace" ? (
    <Notice tone="warn">
      <p>
        {t("app.aiEmployee.graceBanner", "What's changing: from {date}, your AI employee's replies are paid from your AI credit, not your monthly AI allowance. Until then it keeps running on the allowance as it does today. A reply costs about {amount}; your AI credit is {balance}.", {
          date: formatCalendarDay(data.ai.graceEndsOn, language),
          amount: money(data.ai.typicalConversationCents),
          balance: money(data.ai.walletCents),
        })}
      </p>
      {!data.ai.allowed && data.ai.reason && <p className="mt-1">{data.ai.reason}</p>}
      {topUpButton}
    </Notice>
  ) : !data.ai.allowed ? (
    <Notice tone="warn">
      {data.ai.reason}
      <p className="mt-1 opacity-90">
        {t("app.aiEmployee.overQuotaBehaviour", "Until then, every employee tells customers someone will reply shortly and leaves each conversation to you — it never answers with a cheaper model and never goes quiet without telling you.")}
      </p>
    </Notice>
  ) : data.ai.billing === "wallet" && data.ai.inGrace ? (
    <Notice>
      {t("app.aiEmployee.walletBanner", "Your AI employee's replies are now paid from your AI credit instead of your monthly AI allowance — about {amount} a reply, taken as each one is written. Your balance is {balance}.", {
        amount: money(data.ai.typicalConversationCents),
        balance: money(data.ai.walletCents),
      })}
    </Notice>
  ) : null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <BackToHome />

      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Bot size={20} /> {t("app.aiEmployee.title", "AI employee")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.aiEmployee.subtitle", "An assistant that answers a customer's message for you — using your price book and the material you give it.")}
        </p>
      </div>

      {!data.ai?.configured && (
        <Notice tone="warn">
          {t("app.aiEmployee.aiUnavailable", "AI isn't switched on for this deployment, so the employee can't write anything at all.")}
        </Notice>
      )}

      {/* The AI-credit notice sits inside the selected employee's card; with
          no employee selected it stands here, so an empty wallet is never
          out of sight. */}
      {!form && billingNotice}

      {/* ── The team, and the selected employee's own card ───────────────── */}
      {/* The roster is a tab list and the card under it belongs to the tab
          that is selected: its face, its name and every setting below are
          THAT employee's, and the card says so in its header. The owner read
          the old free-standing "Face and name" card as a company-wide
          setting — it never was, but nothing on the screen said otherwise. */}
      <Card
        tour="ai-team-roster"
        title={t("app.aiEmployee.teamTitle", "Your AI team")}
        icon={Bot}
        hint={t("app.aiEmployee.teamHintPerEmployee", "One employee per job. Pick one to set it up — its face, name, voice and everything else below belong to that employee alone, and every change saves as you make it.")}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("app.aiEmployee.teamTitle", "Your AI team")}>
          {data.employees.map((e) => (
            <button
              key={e.id || "unsaved"}
              type="button"
              role="tab"
              aria-selected={selectedId === e.id}
              onClick={() => selectEmployee(e.id)}
              className={`flex items-center gap-3 rounded-lg border-2 p-2 pr-3 min-h-[44px] text-left ${
                selectedId === e.id ? "border-primary bg-muted" : "border-border"
              }`}
            >
              <Face url={e.avatarUrl} name={e.displayName || e.name} size={36} />
              <span>
                <span className="block text-sm font-medium text-foreground">{e.displayName || e.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`app.aiEmployee.role.${e.role}`, e.role)}
                  {" · "}
                  {e.enabled ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off")}
                </span>
              </span>
            </button>
          ))}
          {rolesLeft.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className={`${FIELD} w-auto`}
                aria-label={t("app.aiEmployee.hire", "Hire another")}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) hire(e.target.value);
                  e.target.value = "";
                }}
                disabled={hiring}
              >
                <option value="">{t("app.aiEmployee.hire", "Hire another")}…</option>
                {rolesLeft.map((r) => (
                  <option key={r.key} value={r.key}>
                    {t(r.labelKey, r.key)}
                  </option>
                ))}
              </select>
              <UserPlus size={16} className="text-muted-foreground" />
            </div>
          )}
        </div>

        {form && (
          <div role="tabpanel" className="mt-4 rounded-xl border-2 border-primary p-4 sm:p-5" data-tour="ai-employee-card">
            {/* ── Whose card this is ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              <Face url={form.avatarUrl} name={shownName} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground break-words">{shownName}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`app.aiEmployee.role.${form.role}`, form.role)}
                  {" · "}
                  {form.enabled ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off")}
                </p>
              </div>
              <p
                role="status"
                className={`text-xs ${panelState === "error" ? "text-red-700 dark:text-red-300" : panelState === "saved" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
              >
                {panelState === "error"
                  ? t("app.aiEmployee.autosave.someFailed", "Some changes didn't save — see the note in red.")
                  : panelState === "saving"
                    ? t("app.common.saving", "Saving…")
                    : panelState === "saved"
                      ? t("app.aiEmployee.autosave.allSaved", "All changes saved")
                      : t("app.aiEmployee.autosave.idle", "Changes save as you make them")}
              </p>
            </div>

            {/* ── Who pays for this employee's replies ─────────────────── */}
            {billingNotice && <div className="mt-4">{billingNotice}</div>}

            {/* ── Face and name ────────────────────────────────────────── */}
            <Part
              title={t("app.aiEmployee.faceTitleFor", "{name}'s face and name", { name: shownName })}
              icon={Pencil}
              hint={t("app.aiEmployee.faceHintPerEmployee", "This employee only. What a customer sees at the top of the chat, and the name it goes by in your team list and when it hands a conversation on.")}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {data.faces.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => edit({ avatarUrl: f.url })}
                      className={`rounded-full border-2 ${form.avatarUrl === f.url ? "border-primary" : "border-transparent"}`}
                      aria-label={t("app.aiEmployee.chooseFace", "Choose this face")}
                      aria-pressed={form.avatarUrl === f.url}
                    >
                      <Face url={f.url} name="" size={44} />
                    </button>
                  ))}
                  <input
                    ref={faceInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      uploadFace(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button type="button" className={BTN_QUIET} onClick={() => faceInput.current?.click()}>
                    <Upload size={15} /> {t("app.aiEmployee.uploadFace", "Upload your own")}
                  </button>
                  {form.avatarUrl && (
                    <button type="button" className={BTN_QUIET} onClick={() => edit({ avatarUrl: null })}>
                      {t("app.aiEmployee.noFace", "Initials only")}
                    </button>
                  )}
                  {savedNote("avatarUrl")}
                </div>
                <label className="block">
                  <FieldHead label={t("app.aiEmployee.nameLabelPerEmployee", "Name")} note={savedNote("name")} />
                  <input
                    className={FIELD}
                    value={form.name || ""}
                    maxLength={60}
                    onChange={(e) => edit({ name: e.target.value }, { typing: true })}
                    onBlur={() => flushAll()}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.nameHintPerEmployee", "It starts with a name of its own for this job. Change it to anything — customers see it unless you fill in the box below.")}
                  </span>
                </label>
                <label className="block">
                  <FieldHead label={t("app.aiEmployee.displayNameOptional", "A different name for customers (optional)")} note={savedNote("displayName")} />
                  <input
                    className={FIELD}
                    value={form.displayName || ""}
                    maxLength={60}
                    placeholder={form.name || ""}
                    onChange={(e) => edit({ displayName: e.target.value }, { typing: true })}
                    onBlur={() => flushAll()}
                  />
                </label>
                <label className="block">
                  <FieldHead label={t("app.aiEmployee.voiceLabel", "Voice")} note={savedNote("voice")} />
                  <select className={FIELD} value={form.voice || ""} onChange={(e) => edit({ voice: e.target.value || null })}>
                    <option value="">{t("app.aiEmployee.voice.none", "Default")}</option>
                    {data.voices.map((v) => (
                      <option key={v} value={v}>
                        {t(`app.aiEmployee.voice.${v}`, v)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.voiceHint", "How it sounds. Never what it may do — a friendly receptionist still has no pricing tool.")}
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {disclosureOn ? (
                    <>
                      {t("app.aiEmployee.disclosureHint", "The first message of every conversation always opens with:")}{" "}
                      <span className="text-foreground">“{disclosure}”</span>
                    </>
                  ) : (
                    t("app.aiEmployee.disclosureOffHint", "It introduces itself by name without announcing that it's an AI. If a customer asks whether they're talking to a person, it says truthfully that it's the AI assistant.")
                  )}{" "}
                  <a href="#disclosure" className="underline">
                    {t("app.aiEmployee.disclosure.change", "Change this")}
                  </a>
                </p>
              </div>
            </Part>

            {/* ── The job ──────────────────────────────────────────────── */}
            <Part
              title={t("app.aiEmployee.roleTitle", "What job does it do?")}
              icon={Bot}
              hint={t("app.aiEmployee.roleHint", "The job decides what it's allowed to do, not just how it sounds. A receptionist has no way to look up a price — that's the point of picking one.")}
            >
              <div className="flex justify-end">{savedNote("role")}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.roles.map((r) => {
                  const taken = data.employees.some((e) => e.role === r.key && e.id !== form.id);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      disabled={taken}
                      onClick={() => r.key !== form.role && edit({ role: r.key })}
                      aria-pressed={form.role === r.key}
                      className={`text-left rounded-lg border p-3 min-h-[44px] disabled:opacity-50 ${form.role === r.key ? "border-primary bg-muted" : "border-border"}`}
                    >
                      <span className="font-medium text-foreground text-sm">{t(r.labelKey, r.key)}</span>
                      <p className="text-xs text-muted-foreground mt-1">{t(r.blurbKey, "")}</p>
                      {taken && <p className="text-xs text-muted-foreground mt-1">{t("app.aiEmployee.roleTaken", "Already hired")}</p>}
                    </button>
                  );
                })}
              </div>

              {role && (
                <div className="mt-4 space-y-2 text-xs">
                  <p className="text-muted-foreground">
                    {t("app.aiEmployee.roleCan", "It can:")}{" "}
                    <span className="text-foreground">
                      {role.allowed.map((k) => `${toolLabel(k)} (${riskLabel(data.toolRisk?.[k])})`).join(", ")}
                    </span>
                  </p>
                  {role.forbidden.length > 0 && (
                    <p className="text-muted-foreground">
                      {t("app.aiEmployee.roleCannot", "It cannot:")}{" "}
                      <span className="text-foreground">{role.forbidden.map(toolLabel).join(", ")}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {t("app.aiEmployee.neverRule", "No matter what you write below, it can never invent a price, a date or a policy. If it isn't in your own data or your own material, it hands the conversation to a person.")}
                  </p>
                </div>
              )}
            </Part>

            {/* ── How it writes ────────────────────────────────────────── */}
            <Part title={t("app.aiEmployee.voiceTitle", "How it writes")} icon={FileText}>
              <div className="space-y-4">
                <label className="block">
                  <FieldHead label={t("app.aiEmployee.toneLabel", "Tone")} note={savedNote("tone")} />
                  <select className={FIELD} value={form.tone || ""} onChange={(e) => edit({ tone: e.target.value })}>
                    {data.tones.map((tone) => (
                      <option key={tone} value={tone}>
                        {t(`app.aiEmployee.tone.${tone}`, tone)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <FieldHead label={t("app.aiEmployee.greetingLabel", "Opening line (optional)")} note={savedNote("greeting")} />
                  <input
                    className={FIELD}
                    value={form.greeting || ""}
                    maxLength={300}
                    onChange={(e) => edit({ greeting: e.target.value }, { typing: true })}
                    onBlur={() => flushAll()}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.greetingHint", "Word for word, at the start of its first reply in a conversation. Leave it empty and it simply answers.")}
                  </span>
                </label>

                <label className="block">
                  <FieldHead label={t("app.aiEmployee.instructionsLabel", "Your instructions")} note={savedNote("instructions")} />
                  <textarea
                    className={`${FIELD} min-h-[140px]`}
                    value={form.instructions || ""}
                    maxLength={4000}
                    onChange={(e) => edit({ instructions: e.target.value }, { typing: true })}
                    onBlur={() => flushAll()}
                    placeholder={t("app.aiEmployee.instructionsPlaceholder", "Facts about your business it should know. Areas you cover, what you don't do, how you like things worded.")}
                  />
                </label>

                <label className="block">
                  <FieldHead label={t("app.aiEmployee.escalationLabel", "When it should fetch a person")} note={savedNote("escalationRules")} />
                  <textarea
                    className={`${FIELD} min-h-[100px]`}
                    value={form.escalationRules || ""}
                    maxLength={4000}
                    onChange={(e) => edit({ escalationRules: e.target.value }, { typing: true })}
                    onBlur={() => flushAll()}
                    placeholder={t("app.aiEmployee.escalationPlaceholder", "Anything about a leak. Anyone asking for the owner. Anything over a certain size.")}
                  />
                </label>
              </div>
            </Part>

            {/* ── Permission mode ──────────────────────────────────────── */}
            <Part
              id="mode"
              title={t("app.aiEmployee.modesTitle", "What may it do on its own?")}
              icon={Shield}
              hint={t("app.aiEmployee.modesHint", "Three settings. Each sentence is exactly what happens. Whatever you pick, the list at the bottom never happens without you.")}
            >
              <div className="flex justify-end">{savedNote("mode")}</div>
              <div className="space-y-3">
                {data.modes.map((m) => (
                  <label key={m.key} className="flex gap-3 items-start rounded-lg border border-border p-3">
                    <input
                      type="radio"
                      name={`mode-${form.id || "unsaved"}`}
                      className="mt-1"
                      checked={(modeAsk || form.mode) === m.key}
                      onChange={() => {
                        if (MODE_RANK[m.key] > MODE_RANK[form.mode]) {
                          setModeAsk(m.key);
                        } else {
                          setModeAsk(null);
                          if (m.key !== form.mode) edit({ mode: m.key });
                        }
                      }}
                    />
                    <span>
                      <span className="text-sm font-medium text-foreground">{t(`app.aiEmployee.mode.${m.key}`, m.key)}</span>
                      <span className="block text-xs text-muted-foreground mt-1">{t(m.sentenceKey, m.key)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {modeMovesUp && (
                <div className="mt-3 space-y-2">
                  <Notice tone="warn">
                    {t("app.aiEmployee.modeWarnConfirm", "You're giving it more room to act without you. Nothing changes until you confirm, and the change is recorded with your name.")}
                  </Notice>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BTN_PRIMARY}
                      onClick={() => {
                        const next = modeAsk;
                        setModeAsk(null);
                        edit({ mode: next });
                      }}
                    >
                      {t("app.aiEmployee.modeConfirm", "Yes, give it this room")}
                    </button>
                    <button type="button" className={BTN_QUIET} onClick={() => setModeAsk(null)}>
                      {t("app.common.cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-4 text-xs">
                <p className="text-muted-foreground">{t("app.aiEmployee.floorTitle", "Never without you, in any setting:")}</p>
                <ul className="list-disc pl-5 text-foreground mt-1 space-y-0.5">
                  {data.floorKeys.map((k) => (
                    <li key={k}>{t(k, k)}</li>
                  ))}
                </ul>
              </div>
            </Part>

            {/* ── Channels ─────────────────────────────────────────────────── */}
            <Part
              id="channels"
              title={t("app.aiEmployee.channelsTitle", "Where it answers")}
              icon={MessageSquare}
              hint={t("app.aiEmployee.channelsHint", "One employee per channel. Switch a channel off here before giving it to another employee.")}
            >
              <div className="space-y-4">
                <label className="flex gap-3 items-start">
                  <input type="checkbox" className="mt-1" checked={form.metaEnabled === true} onChange={(e) => edit({ metaEnabled: e.target.checked })} />
                  <span>
                    <span className="text-sm text-foreground flex items-center gap-1">
                      <MessageSquare size={14} /> {t("app.aiEmployee.channel.meta", "Facebook / Instagram / WhatsApp")} {savedNote("metaEnabled")}
                    </span>
                    {channelBlocked && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        {t("app.aiEmployee.channelBlocked", "Replies can't leave the building yet. The AI employee answers your Facebook and Instagram messages, and Meta hasn't approved messaging for FieldQuo. Everything here works — it drafts, and the drafts wait below for you to send.")}
                      </span>
                    )}
                  </span>
                </label>

                {/* A div, not a <label>: the snippet, its notes and the Copy
                    button live in here, and inside a label a click on any of
                    their text toggled the channel off. Only the title labels
                    the checkbox. */}
                <div className="flex gap-3 items-start">
                  <input id="ai-web-chat" type="checkbox" className="mt-1" checked={form.webChatEnabled === true} onChange={(e) => edit({ webChatEnabled: e.target.checked })} />
                  <span className="min-w-0 flex-1">
                    <label htmlFor="ai-web-chat" className="text-sm text-foreground flex items-center gap-1 cursor-pointer">
                      <Globe size={14} /> {t("app.aiEmployee.channel.web", "Website chat")} {savedNote("webChatEnabled")}
                    </label>
                    <span className="block text-xs text-muted-foreground mt-1">
                      {t("app.aiEmployee.webHint", "A chat button on your FieldQuo website, and on any other site with the snippet below. Visitors get an instant-quote link or a booked slot in the chat; “Talk to a person” lands in Conversations.")}
                    </span>
                    {data.webChat?.snippet && (
                      <span className="block mt-2">
                        <span className="text-xs text-muted-foreground">{t("app.aiEmployee.snippetLabel", "Paste this before </body> on any other website:")}</span>
                        <textarea readOnly className={`${FIELD} text-xs font-mono mt-1 min-h-[56px]`} value={data.webChat.snippet} onFocus={(e) => e.target.select()} />
                        <button
                          type="button"
                          className={`${BTN_QUIET} mt-2`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(data.webChat.snippet);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            } catch {
                              showError(t("app.aiEmployee.copyFailed", "Couldn't copy — select the text and copy it by hand."));
                            }
                          }}
                        >
                          <ClipboardCheck size={14} /> {copied ? t("app.aiEmployee.copied", "Copied") : t("app.aiEmployee.copySnippet", "Copy snippet")}
                        </button>
                        <span className="block text-xs text-muted-foreground mt-1">
                          {t("app.aiEmployee.snippetRecommended", "Recommended: one line on every page. Closed, the chat covers only its button, so the rest of your page stays clickable. If you pasted the older <iframe> code, it still works — swap it for this line to free up that corner.")}
                        </span>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-foreground min-h-[44px] flex items-center">{t("app.aiEmployee.where.title", "Where to paste it")}</summary>
                          <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                            <li>{t("app.aiEmployee.where.wordpress", "WordPress: install the free WPCode plugin, then Code Snippets → Header & Footer, paste into Footer and Save Changes. WordPress.com needs a plan that allows plugins.")}</li>
                            <li>{t("app.aiEmployee.where.wix", "Wix: Settings → Custom Code → + Add Custom Code, choose All pages and Body – end, then Apply. Wix only runs it on a site with a connected domain.")}</li>
                            <li>{t("app.aiEmployee.where.squarespace", "Squarespace: open Code Injection (under Website Tools), paste into Footer and Save. Needs the Core plan or above.")}</li>
                            <li>{t("app.aiEmployee.where.shopify", "Shopify: Online Store → ⋯ → Edit code, open layout/theme.liquid, paste just above </body> and Save.")}</li>
                            <li>{t("app.aiEmployee.where.godaddy", "GoDaddy Website Builder: it can't add code to every page — its HTML section runs code inside its own box, so the button can't float over your site there. Link to your booking page instead.")}</li>
                            <li>{t("app.aiEmployee.where.html", "Any other site or plain HTML: paste it just above </body> on every page, or once in a shared footer.")}</li>
                            <li>{t("app.aiEmployee.where.options", "Options: add data-position=\"left\" to the tag for the bottom-left corner, or data-z=\"1000\" if something on your site covers the button.")}</li>
                          </ul>
                        </details>
                      </span>
                    )}
                  </span>
                </div>

                <label className={`flex gap-3 items-start ${data.sms?.available ? "" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={!data.sms?.available}
                    checked={form.smsEnabled === true && data.sms?.available}
                    onChange={(e) => edit({ smsEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="text-sm text-foreground flex items-center gap-1">
                      <Smartphone size={14} /> {t("app.aiEmployee.channel.sms", "Text message")} {savedNote("smsEnabled")}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      {data.sms?.available
                        ? t("app.aiEmployee.smsHint", "A text from a customer already on your client list, sent to {number}, comes to this employee; replies go out from the same number. STOP always stops it.", { number: data.sms.number })
                        : t("app.aiEmployee.smsUnavailable", "FieldQuo doesn't have a text-message number yet, so this channel can't be switched on.")}
                    </span>
                  </span>
                </label>
              </div>
            </Part>

            {/* ── Limits and the switch ────────────────────────────────────── */}
            <Part title={t("app.aiEmployee.limitsTitle", "Limits")} icon={AlertTriangle}>
              <div className="space-y-4">
                <label className="flex gap-3 items-start">
                  <input type="checkbox" className="mt-1" checked={form.businessHoursOnly === true} onChange={(e) => edit({ businessHoursOnly: e.target.checked })} />
                  <span>
                    <FieldHead label={t("app.aiEmployee.hoursOnly", "Only answer during business hours")} note={savedNote("businessHoursOnly")} />
                    <span className="block text-xs text-muted-foreground mt-1">
                      {data.hasBusinessHours
                        ? t("app.aiEmployee.hoursOnlyHint", "Your opening hours, from Company Settings. Outside them the message waits for you.")
                        : t("app.aiEmployee.hoursOnlyNoHours", "You haven't saved any opening hours, so this does nothing yet — it won't guess a Monday-to-Friday for you. Set them under Company Settings.")}
                    </span>
                  </span>
                </label>

                <label className="block">
                  <FieldHead label={t("app.aiEmployee.capLabel", "Most replies in one conversation")} note={savedNote("maxRepliesPerThread")} />
                  <input type="number" min={0} max={10} className={FIELD} value={form.maxRepliesPerThread} onChange={(e) => edit({ maxRepliesPerThread: e.target.value }, { typing: true })} onBlur={() => flushAll()} />
                  <span className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.capHint", "After this it stops and leaves the conversation to you. Zero pauses it without losing anything you've set up.")}
                  </span>
                </label>

                <label className="flex gap-3 items-start rounded-lg border border-border p-3">
                  <input type="checkbox" className="mt-1" checked={form.enabled === true} onChange={(e) => edit({ enabled: e.target.checked })} />
                  <span>
                    <FieldHead label={<span className="font-medium">{t("app.aiEmployee.enabledOne", "Switch this employee on")}</span>} note={savedNote("enabled")} />
                    <span className="block text-xs text-muted-foreground mt-1">
                      {form.enabled
                        ? t("app.aiEmployee.enabledOnSentence", "On: it answers the channels ticked above, under the setting you chose. Switching it off is recorded with your name.")
                        : t("app.aiEmployee.enabledOffSentence", "Off: nothing routes to it, nothing is proposed, nothing is charged. The website chat and the text line tell customers someone will reply shortly, and the message lands in Conversations for you. Switching it on is recorded with your name.")}
                    </span>
                  </span>
                </label>
              </div>
            </Part>

            <div className="flex items-center gap-3 border-t border-border pt-5 mt-5">
              <p className="text-xs text-muted-foreground">
                {t("app.aiEmployee.autosave.note", "Every change on this card saves on its own, for this employee only.")}
              </p>
              <button
                type="button"
                onClick={() => setConfirmFire(true)}
                className="ml-auto inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-border text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={14} /> {t("app.aiEmployee.fire", "Fire")}
              </button>
            </div>
            <DeleteConfirmModal
              isOpen={confirmFire}
              onClose={() => setConfirmFire(false)}
              onConfirm={fire}
              title={t("app.aiEmployee.fire", "Fire")}
              message={t("app.aiEmployee.fireConfirm", "Fire {name}? Its proposals and replies are removed and its channels go back to your inbox. This cannot be undone.", { name: saved_?.displayName || saved_?.name || "" })}
              itemName={saved_?.displayName || saved_?.name || ""}
              busy={firing}
            />
          </div>
        )}
      </Card>

      {/* ── How the team works ───────────────────────────────────────────── */}
      <Card
        id="team-flow"
        tour="ai-team-flow"
        title={t("app.aiEmployee.flow.title", "How your AI team works")}
        icon={Workflow}
        hint={t("app.aiEmployee.flow.hint", "A message comes in on a channel, the front desk reads it once and hands it to one employee, and only that employee answers. Counts are this week's.")}
      >
        <TeamFlow
          data={data}
          proposals={proposals}
          onEmployees={(employees) => setData((d) => ({ ...d, employees }))}
          t={t}
        />
      </Card>

      {/* ── Telling clients it's an AI — company-wide ────────────────────── */}
      {data.disclosure && (
        <Card
          id="disclosure"
          title={t("app.aiEmployee.disclosure.title", "Telling clients it's an AI")}
          icon={Info}
          hint={t("app.aiEmployee.disclosure.hint", "One setting for your whole AI team.")}
        >
          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="mt-1"
              checked={disclosureOn}
              disabled={disclosureBusy}
              onChange={(e) => setDisclosure(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                {t("app.aiEmployee.disclosure.label", "Tell clients it's an AI assistant")}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {disclosureOn
                  ? t("app.aiEmployee.disclosure.onSentence", "On: the first reply in every conversation opens with “Hi, I'm {name}, {company}'s AI assistant.”", { name: shownName || "…", company: t("app.aiEmployee.yourCompany", "your company") })
                  : t("app.aiEmployee.disclosure.offSentence", "Off: it doesn't volunteer that it's an AI. It never claims to be a person, and if a client asks whether it's a bot or an AI it always says so truthfully.")}
              </span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground mt-3">
            {data.disclosure.setting === null
              ? t(`app.aiEmployee.disclosure.why.${data.disclosure.reason}`, "", { place: placeLabel, law: data.disclosure.law || "" })
              : t("app.aiEmployee.disclosure.why.chosen", "You set this yourself. For where your business is, the default would be {state}.", {
                  state: data.disclosure.required ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off"),
                })}
          </p>
          {data.disclosure.setting !== null && (
            <button type="button" className={`${BTN_QUIET} mt-2`} disabled={disclosureBusy} onClick={() => setDisclosure(null)}>
              {t("app.aiEmployee.disclosure.reset", "Use the default for my location")}
            </button>
          )}
          {data.disclosure.required && !disclosureOn && (
            <div className="mt-3">
              <Notice tone="warn">
                {t("app.aiEmployee.disclosure.requiredOffWarn", "Where your business is, the law expects clients to be told they're talking to an AI ({law}). Switching it off is your decision, and it's recorded with your name.", { law: data.disclosure.law || "" })}
              </Notice>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {t("app.aiEmployee.disclosure.location", "Your location comes from Company Settings.")}{" "}
            <Link href="/app/settings/company" className="underline">
              {t("app.aiEmployee.disclosure.fixLocation", "Change it there")}
            </Link>
          </p>
        </Card>
      )}

      {/* ── The model and what it costs ──────────────────────────────────── */}
      <Card
        id="cost"
        title={t("app.aiEmployee.costTitle", "The model, and what it costs")}
        icon={Coins}
      >
        <p className="text-sm text-foreground">
          {t("app.aiEmployee.runsOn", "Runs on {model} — the best model, because it speaks and books in your name.", { model: data.ai?.model || "—" })}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {data.ai?.typicalConversationCents !== null && data.ai?.typicalConversationCents !== undefined
            ? t("app.aiEmployee.typicalCost", "A typical conversation costs about {amount} of your AI credit. That's an estimate from a stated average — the real figure is on every reply below.", { amount: money(data.ai.typicalConversationCents) })
            : t("app.aiEmployee.typicalCostUnknown", "We don't have a rate for this model yet, so we can't estimate a conversation's cost.")}
        </p>
        {/* Which meter pays is the server's answer (data.ai.billing). The
            token line is shown only while the ALLOWANCE pays — the grace, or
            the /platform switch moving the feature back onto it; on the
            wallet, tokens are not what the company is charged for. */}
        {(data.ai?.billing === "wallet" || data.ai?.billing === "paused") && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.aiEmployee.walletBalance", "Paid from your AI credit — balance {balance}.", { balance: money(data.ai.walletCents) })}{" "}
            <Link href="/app/settings/ai-credit" className="underline">{t("app.aiEmployee.topUpOrBundle", "Top up or add a monthly bundle")}</Link>
          </p>
        )}
        {(data.ai?.billing === "grace" || data.ai?.billing === "allowance") && data.ai?.cap !== null && data.ai?.cap !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.aiEmployee.balance", "This month: {used} of {cap} tokens used.", {
              used: Number(data.ai.usedTokens || 0).toLocaleString(),
              cap: Number(data.ai.cap).toLocaleString(),
            })}{" "}
            <Link href="/app/settings/ai-credit" className="underline">{t("app.aiEmployee.topUp", "Top up AI credit")}</Link>
          </p>
        )}
        {data.ai?.billing === "fieldquo" && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.aiEmployee.fieldquoPays", "FieldQuo is covering your AI employee's replies at the moment — nothing is taken from your AI credit.")}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {data.ai?.billing === "grace" || data.ai?.billing === "allowance"
            ? t("app.aiEmployee.lowBalance", "When the allowance runs out, every employee stops, tells the customer someone will reply shortly, and leaves the conversation to you with the reason on it. It never answers with a cheaper model.")
            : t("app.aiEmployee.walletRunsOut", "When your AI credit can't cover the next reply, every employee stops, tells the customer someone will reply shortly, and leaves the conversation to you with the reason on it. It never answers with a cheaper model.")}
        </p>
      </Card>

      {/* ── Material ─────────────────────────────────────────────────────── */}
      <Card
        id="material"
        title={t("app.aiEmployee.materialTitle", "What it reads")}
        icon={FileText}
        hint={t("app.aiEmployee.materialHintShared", "Your policy, your troubleshooting notes, a tool manual. Every employee reads the same material and says which document an answer came from.")}
      >
        <Notice>
          {t("app.aiEmployee.formatsHonest", "We can read plain text: .txt, .md and .csv, or text you paste in. We cannot read a PDF or a Word file yet — if you upload one it'll show up below marked unread, and the fix is to paste the text or export it as .txt.")}
        </Notice>

        <div className="flex flex-wrap gap-3 mt-4">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv"
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className={BTN_QUIET} onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> {t("app.aiEmployee.uploadFile", "Upload a file")}
          </button>
          <button type="button" className={BTN_QUIET} onClick={() => setPasteOpen((v) => !v)}>
            <FileText size={15} /> {t("app.aiEmployee.pasteText", "Paste text instead")}
          </button>
        </div>

        {pasteOpen && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
            <input className={FIELD} placeholder={t("app.aiEmployee.pasteTitle", "What is this? e.g. Warranty policy")} value={paste.title} onChange={(e) => setPaste((p) => ({ ...p, title: e.target.value }))} />
            <select className={FIELD} value={paste.kind} onChange={(e) => setPaste((p) => ({ ...p, kind: e.target.value }))}>
              {data.sourceKinds.map((k) => (
                <option key={k} value={k}>
                  {t(`app.aiEmployee.kind.${k}`, k)}
                </option>
              ))}
            </select>
            <textarea className={`${FIELD} min-h-[160px]`} value={paste.text} onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value }))} />
            <button type="button" className={BTN_PRIMARY} onClick={addPaste}>
              {t("app.aiEmployee.pasteAdd", "Add it")}
            </button>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {sources.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t("app.aiEmployee.noMaterial", "Nothing yet. Without material it answers from your instructions and your price book only — which is fine for a receptionist and not enough for a troubleshooter.")}
            </li>
          )}
          {sources.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground break-words">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`app.aiEmployee.kind.${s.kind}`, s.kind)}
                  {s.status === "ready" ? ` · ${t("app.aiEmployee.sourceReady", "read, about {n} tokens", { n: s.tokenCount })}` : ""}
                </p>
                {s.status === "failed" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {t(s.failureReason || "app.aiEmployee.source.failed.other", "We couldn't read this one.")}
                  </p>
                )}
              </div>
              <button type="button" className={`${BTN_QUIET} shrink-0`} onClick={() => removeSource(s.id)} aria-label={t("app.aiEmployee.removeSource", "Remove")}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── The test box ─────────────────────────────────────────────────── */}
      <Card
        id="test"
        title={t("app.aiEmployee.testTitle", "Try it")}
        icon={FlaskConical}
        hint={t("app.aiEmployee.testHintChannels", "Type what a customer would write and pick where they wrote it. This runs the real thing — the same code that would answer them — with the setting above applied, so it uses a little AI credit and nothing is sent, booked or created.")}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            ["meta", MessageSquare, t("app.aiEmployee.channel.meta", "Facebook / Instagram / WhatsApp")],
            ["web", Globe, t("app.aiEmployee.channel.web", "Website chat")],
            ["sms", Smartphone, t("app.aiEmployee.channel.sms", "Text message")],
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTestChannel(key)}
              className={`${BTN} border ${testChannel === key ? "border-primary bg-muted" : "border-border"} text-foreground`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <textarea
          className={`${FIELD} min-h-[90px]`}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder={t("app.aiEmployee.testPlaceholder", "Hi, how much would you charge to paint a 12x14 bedroom?")}
        />
        <button type="button" className={`${BTN_PRIMARY} mt-3`} onClick={runTest} disabled={testing || !testText.trim() || !selectedId}>
          {testing ? t("app.aiEmployee.testing", "Asking…") : t("app.aiEmployee.testRun", "See the answer")}
        </button>

        {testResult && (
          <div className="mt-4 space-y-3">
            {testResult.reason ? (
              <Notice tone="warn">{t(`app.aiEmployee.skip.${testResult.reason}`, testResult.reason)}</Notice>
            ) : (
              <>
                <ChannelFrame channel={testResult.channel || testChannel} t={t}>
                  {testResult.text}
                </ChannelFrame>
                <p className="text-xs">
                  <span className={`inline-block rounded-full px-2 py-0.5 ${testResult.wouldSend ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}>
                    {testResult.wouldSend
                      ? t("app.aiEmployee.wouldSend", "Would send — the customer reads this with nobody checking first.")
                      : t("app.aiEmployee.wouldWait", "Would wait for you — the customer is told someone will reply shortly.")}
                  </span>
                </p>
                {testResult.wouldPropose?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.wouldPropose", "Would ask you first before: {list}", { list: testResult.wouldPropose.map(toolLabel).join(", ") })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {testResult.sources?.length
                    ? t("app.aiEmployee.testSources", "From your material: {list}", { list: testResult.sources.map((s) => s.title).join(", ") })
                    : t("app.aiEmployee.testNoSources", "It used none of your uploaded material for this one.")}
                </p>
                {testResult.tools?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.testTools", "It used: {list}", { list: testResult.tools.map((x) => toolLabel(x.name)).join(", ") })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {/* What the AI credit was actually debited when it was; the
                      model's cost otherwise (the allowance paid, or FieldQuo). */}
                  {testResult.chargedCents
                    ? t("app.aiEmployee.testCharged", "This test took {amount} from your AI credit ({model}).", { amount: money(testResult.chargedCents), model: testResult.model || data.ai?.model || "—" })
                    : t("app.aiEmployee.testCostModel", "This test cost {amount} on {model}.", { amount: money(testResult.costCents), model: testResult.model || data.ai?.model || "—" })}
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Proposals ────────────────────────────────────────────────────── */}
      <Card
        id="proposals"
        title={t("app.aiEmployee.proposalsTitle", "Waiting for your yes")}
        icon={ClipboardCheck}
        hint={t("app.aiEmployee.proposalsHint", "Things it wanted to do and the setting above didn't let it do alone. Approving runs exactly what you see here — the same action it would have taken.")}
      >
        {proposals.length === 0 && <p className="text-sm text-muted-foreground">{t("app.aiEmployee.noProposals", "Nothing waiting.")}</p>}
        <ul className="space-y-3">
          {proposals.map((p) => {
            const edit = editing[p.id];
            return (
              <li key={p.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {toolLabel(p.tool)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {riskLabel(p.risk)} · {t(`app.aiEmployee.channel.${p.channel}`, p.channel)}
                    {p.stale ? ` · ${t("app.aiEmployee.proposalStale", "the time it wanted has passed")}` : ""}
                  </span>
                </p>
                {p.excerpt && <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap font-sans">{p.excerpt}</pre>}
                {edit === undefined ? (
                  <dl className="text-xs mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    {Object.entries(p.args || {}).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{t(`app.aiEmployee.arg.${k}`, k)}</dt>
                        <dd className="text-foreground break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <textarea className={`${FIELD} text-xs font-mono mt-2 min-h-[120px]`} value={edit} onChange={(e) => setEditing((x) => ({ ...x, [p.id]: e.target.value }))} />
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {edit === undefined ? (
                    <>
                      <button type="button" className={BTN_PRIMARY} disabled={p.stale} onClick={() => decide(p, "approve")}>
                        <Check size={14} /> {t("app.aiEmployee.approve", "Approve")}
                      </button>
                      <button type="button" className={BTN_QUIET} disabled={p.stale} onClick={() => setEditing((x) => ({ ...x, [p.id]: JSON.stringify(p.args || {}, null, 2) }))}>
                        <Pencil size={14} /> {t("app.aiEmployee.editThenApprove", "Edit, then approve")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={BTN_PRIMARY} onClick={() => decide(p, "approve", edit)}>
                        <Check size={14} /> {t("app.aiEmployee.approveEdited", "Approve as edited")}
                      </button>
                      <button
                        type="button"
                        className={BTN_QUIET}
                        onClick={() =>
                          setEditing((x) => {
                            const n = { ...x };
                            delete n[p.id];
                            return n;
                          })
                        }
                      >
                        {t("app.common.cancel", "Cancel")}
                      </button>
                    </>
                  )}
                  {p.threadId && (
                    <Link href={`/app/messages?thread=${p.threadId}`} className={BTN_QUIET}>
                      {t("app.aiEmployee.openThread", "Open the conversation")}
                    </Link>
                  )}
                  <button type="button" className={BTN_QUIET} onClick={() => decide(p, "decline")}>
                    <X size={14} /> {t("app.aiEmployee.decline", "Decline")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ── The queue ────────────────────────────────────────────────────── */}
      <Card
        id="drafts"
        title={t("app.aiEmployee.draftsTitle", "Waiting for you")}
        icon={Send}
        hint={t("app.aiEmployee.draftsHint", "Replies it has written. Sending one sends it in the conversation, exactly as if you'd typed it.")}
      >
        {queue.suggestions.length === 0 && <p className="text-sm text-muted-foreground">{t("app.aiEmployee.noDrafts", "Nothing waiting.")}</p>}
        <ul className="space-y-3">
          {queue.suggestions.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {row.thread?.participantName || t("app.aiEmployee.unknownPerson", "Someone")}
                {row.thread?.platform ? ` · ${t(`app.messages.platform.${row.thread.platform}`, row.thread.platform)}` : ""}
                {row.stale ? ` · ${t("app.aiEmployee.stale", "written before your last change")}` : ""}
              </p>
              <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{row.text}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className={BTN_PRIMARY} onClick={() => sendSuggestion(row)}>
                  <Send size={14} /> {t("app.aiEmployee.sendDraft", "Send it")}
                </button>
                <Link href={`/app/messages?thread=${row.threadId}`} className={BTN_QUIET}>
                  {t("app.aiEmployee.openThread", "Open the conversation")}
                </Link>
                <button type="button" className={BTN_QUIET} onClick={() => actOn(row, "dismissed")}>
                  <X size={14} /> {t("app.aiEmployee.dismissDraft", "Not this one")}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {queue.stopped.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-foreground">{t("app.aiEmployee.stoppedTitle", "It stopped on these")}</h3>
            <ul className="space-y-2 mt-2">
              {queue.stopped.map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm text-foreground">{row.thread?.participantName || t("app.aiEmployee.unknownPerson", "Someone")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(`app.aiEmployee.skip.${row.handoffReason}`, row.handoffReason || t("app.aiEmployee.handedOffGeneric", "It wasn't sure, so it left this to you."))}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link href={`/app/messages?thread=${row.threadId}`} className={BTN_QUIET}>
                      {t("app.aiEmployee.openThread", "Open the conversation")}
                    </Link>
                    <button type="button" className={BTN_QUIET} onClick={() => actOn(row, "resume")}>
                      {t("app.aiEmployee.resume", "Let it answer again")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
