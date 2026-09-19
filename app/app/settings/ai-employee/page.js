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
//    before Save, and the save writes an audit row with the mover's name.
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import BackToHome from "@/app/components/BackToHome";

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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [sources, setSources] = useState([]);
  const [queue, setQueue] = useState({ suggestions: [], stopped: [] });
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

  // The form follows the selected employee. Switching employees discards an
  // unsaved edit — deliberately: two half-edited employees is how a mode
  // change ends up on the wrong one. Derived during render (React's
  // "adjusting state when a prop changes" shape) rather than in an effect,
  // so the first frame after a switch already shows the right employee.
  const [formFor, setFormFor] = useState(null);
  const formKey = saved_ ? `${saved_.id}:${saved_.updatedAt || ""}` : null;
  if (formKey !== formFor) {
    setFormFor(formKey);
    setForm(saved_ ? { ...saved_ } : null);
    setSaved(false);
  }
  const role = useMemo(() => (data?.roles || []).find((r) => r.key === form?.role) || null, [data, form]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    const res = await fetch("/api/ai-employee", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.saveError", "Couldn't save."));
      return;
    }
    const { employee } = await res.json();
    setData((d) => ({ ...d, employees: d.employees.map((e) => (e.id === employee.id ? employee : e)) }));
    setSaved(true);
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
    setSelectedId(employee.id);
  }

  async function uploadFace(file) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.faceUploadError", "Couldn't upload that picture."));
      return;
    }
    const d = await res.json();
    if (d.url) set({ avatarUrl: d.url });
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
  const modeMovesUp = form && saved_ && MODE_RANK[form.mode] > MODE_RANK[saved_.mode];
  const disclosure = form
    ? t("app.aiEmployee.disclosurePreview", "Hi, I'm {name}, {company}'s AI assistant.", {
        name: form.displayName || form.name || t("app.aiEmployee.unnamed", "the assistant"),
        company: t("app.aiEmployee.yourCompany", "your company"),
      })
    : "";
  const toolLabel = (k) => t(`app.aiEmployee.tool.${k}`, k);
  const riskLabel = (k) => t(`app.aiEmployee.risk.${k}`, k);

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

      {data.ai?.configured && !data.ai?.allowed && (
        <Notice tone="warn">
          {data.ai.reason}{" "}
          <Link href="/app/settings/ai-credit" className="underline">
            {t("app.aiEmployee.topUp", "Top up AI credit")}
          </Link>
          <p className="mt-1 opacity-90">
            {t("app.aiEmployee.overQuotaBehaviour", "Until then, every employee tells customers someone will reply shortly and leaves each conversation to you — it never answers with a cheaper model and never goes quiet without telling you.")}
          </p>
        </Notice>
      )}

      {/* ── The team ─────────────────────────────────────────────────────── */}
      <Card
        title={t("app.aiEmployee.teamTitle", "Your AI team")}
        icon={Bot}
        hint={t("app.aiEmployee.teamHint", "One employee per job. Each is switched on or off on its own, and each answers only the channels you give it.")}
      >
        <div className="flex flex-wrap gap-2">
          {data.employees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`flex items-center gap-3 rounded-lg border p-2 pr-3 min-h-[44px] text-left ${
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
      </Card>

      {form && (
        <>
          {/* ── Face and name ────────────────────────────────────────────── */}
          <Card
            title={t("app.aiEmployee.faceTitle", "Face and name")}
            icon={Pencil}
            hint={t("app.aiEmployee.faceHint", "What a customer sees at the top of the chat and on the first line of every conversation.")}
          >
            <div className="flex items-start gap-4">
              <Face url={form.avatarUrl} name={form.displayName || form.name} size={72} />
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.faces.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => set({ avatarUrl: f.url })}
                      className={`rounded-full border-2 ${form.avatarUrl === f.url ? "border-primary" : "border-transparent"}`}
                      aria-label={t("app.aiEmployee.chooseFace", "Choose this face")}
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
                    <button type="button" className={BTN_QUIET} onClick={() => set({ avatarUrl: null })}>
                      {t("app.aiEmployee.noFace", "Initials only")}
                    </button>
                  )}
                </div>
                <label className="block">
                  <span className="text-sm text-foreground">{t("app.aiEmployee.displayNameLabel", "Name customers see")}</span>
                  <input className={FIELD} value={form.displayName || ""} maxLength={60} onChange={(e) => set({ displayName: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-sm text-foreground">{t("app.aiEmployee.voiceLabel", "Voice")}</span>
                  <select className={FIELD} value={form.voice || ""} onChange={(e) => set({ voice: e.target.value || null })}>
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
                  {t("app.aiEmployee.disclosureHint", "The first message of every conversation always opens with:")}{" "}
                  <span className="text-foreground">“{disclosure}”</span>
                </p>
              </div>
            </div>
          </Card>

          {/* ── The job ──────────────────────────────────────────────────── */}
          <Card
            title={t("app.aiEmployee.roleTitle", "What job does it do?")}
            icon={Bot}
            hint={t("app.aiEmployee.roleHint", "The job decides what it's allowed to do, not just how it sounds. A receptionist has no way to look up a price — that's the point of picking one.")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {data.roles.map((r) => {
                const taken = data.employees.some((e) => e.role === r.key && e.id !== form.id);
                return (
                  <button
                    key={r.key}
                    type="button"
                    disabled={taken}
                    onClick={() => set({ role: r.key })}
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
          </Card>

          {/* ── Voice ────────────────────────────────────────────────────── */}
          <Card title={t("app.aiEmployee.voiceTitle", "How it writes")} icon={FileText}>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.nameLabel", "What you call it")}</span>
                <input className={FIELD} value={form.name || ""} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
                <span className="text-xs text-muted-foreground">
                  {t("app.aiEmployee.nameHintPrivate", "For you, on this screen. Customers see the name above.")}
                </span>
              </label>

              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.toneLabel", "Tone")}</span>
                <select className={FIELD} value={form.tone || ""} onChange={(e) => set({ tone: e.target.value })}>
                  {data.tones.map((tone) => (
                    <option key={tone} value={tone}>
                      {t(`app.aiEmployee.tone.${tone}`, tone)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.greetingLabel", "Opening line (optional)")}</span>
                <input className={FIELD} value={form.greeting || ""} maxLength={300} onChange={(e) => set({ greeting: e.target.value })} />
              </label>

              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.instructionsLabel", "Your instructions")}</span>
                <textarea
                  className={`${FIELD} min-h-[140px]`}
                  value={form.instructions || ""}
                  maxLength={4000}
                  onChange={(e) => set({ instructions: e.target.value })}
                  placeholder={t("app.aiEmployee.instructionsPlaceholder", "Facts about your business it should know. Areas you cover, what you don't do, how you like things worded.")}
                />
              </label>

              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.escalationLabel", "When it should fetch a person")}</span>
                <textarea
                  className={`${FIELD} min-h-[100px]`}
                  value={form.escalationRules || ""}
                  maxLength={4000}
                  onChange={(e) => set({ escalationRules: e.target.value })}
                  placeholder={t("app.aiEmployee.escalationPlaceholder", "Anything about a leak. Anyone asking for the owner. Anything over a certain size.")}
                />
              </label>
            </div>
          </Card>

          {/* ── Permission mode ──────────────────────────────────────────── */}
          <Card
            id="mode"
            title={t("app.aiEmployee.modesTitle", "What may it do on its own?")}
            icon={Shield}
            hint={t("app.aiEmployee.modesHint", "Three settings. Each sentence is exactly what happens. Whatever you pick, the list at the bottom never happens without you.")}
          >
            <div className="space-y-3">
              {data.modes.map((m) => (
                <label key={m.key} className="flex gap-3 items-start rounded-lg border border-border p-3">
                  <input type="radio" name="mode" className="mt-1" checked={form.mode === m.key} onChange={() => set({ mode: m.key })} />
                  <span>
                    <span className="text-sm font-medium text-foreground">{t(`app.aiEmployee.mode.${m.key}`, m.key)}</span>
                    <span className="block text-xs text-muted-foreground mt-1">{t(m.sentenceKey, m.key)}</span>
                  </span>
                </label>
              ))}
            </div>
            {modeMovesUp && (
              <div className="mt-3">
                <Notice tone="warn">
                  {t("app.aiEmployee.modeWarn", "You're giving it more room to act without you. It takes effect when you press Save, and the change is recorded with your name.")}
                </Notice>
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
          </Card>

          {/* ── Channels ─────────────────────────────────────────────────── */}
          <Card
            id="channels"
            title={t("app.aiEmployee.channelsTitle", "Where it answers")}
            icon={MessageSquare}
            hint={t("app.aiEmployee.channelsHint", "One employee per channel. Switch a channel off here before giving it to another employee.")}
          >
            <div className="space-y-4">
              <label className="flex gap-3 items-start">
                <input type="checkbox" className="mt-1" checked={form.metaEnabled === true} onChange={(e) => set({ metaEnabled: e.target.checked })} />
                <span>
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <MessageSquare size={14} /> {t("app.aiEmployee.channel.meta", "Facebook / Instagram / WhatsApp")}
                  </span>
                  {channelBlocked && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {t("app.aiEmployee.channelBlocked", "Replies can't leave the building yet. The AI employee answers your Facebook and Instagram messages, and Meta hasn't approved messaging for FieldQuo. Everything here works — it drafts, and the drafts wait below for you to send.")}
                    </span>
                  )}
                </span>
              </label>

              <label className="flex gap-3 items-start">
                <input type="checkbox" className="mt-1" checked={form.webChatEnabled === true} onChange={(e) => set({ webChatEnabled: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <Globe size={14} /> {t("app.aiEmployee.channel.web", "Website chat")}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {t("app.aiEmployee.webHint", "A chat button on your FieldQuo website, and on any other site with the snippet below. Visitors get an instant-quote link or a booked slot in the chat; “Talk to a person” lands in Conversations.")}
                  </span>
                  {data.webChat?.snippet && (
                    <span className="block mt-2">
                      <span className="text-xs text-muted-foreground">{t("app.aiEmployee.snippetLabel", "Paste this before </body> on any other website:")}</span>
                      <textarea readOnly className={`${FIELD} text-xs font-mono mt-1 min-h-[72px]`} value={data.webChat.snippet} onFocus={(e) => e.target.select()} />
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
                    </span>
                  )}
                </span>
              </label>

              <label className={`flex gap-3 items-start ${data.sms?.available ? "" : "opacity-60"}`}>
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={!data.sms?.available}
                  checked={form.smsEnabled === true && data.sms?.available}
                  onChange={(e) => set({ smsEnabled: e.target.checked })}
                />
                <span>
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <Smartphone size={14} /> {t("app.aiEmployee.channel.sms", "Text message")}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {data.sms?.available
                      ? t("app.aiEmployee.smsHint", "A text from a customer already on your client list, sent to {number}, comes to this employee; replies go out from the same number. STOP always stops it.", { number: data.sms.number })
                      : t("app.aiEmployee.smsUnavailable", "FieldQuo doesn't have a text-message number yet, so this channel can't be switched on.")}
                  </span>
                </span>
              </label>
            </div>
          </Card>

          {/* ── Limits and the switch ────────────────────────────────────── */}
          <Card title={t("app.aiEmployee.limitsTitle", "Limits")} icon={AlertTriangle}>
            <div className="space-y-4">
              <label className="flex gap-3 items-start">
                <input type="checkbox" className="mt-1" checked={form.businessHoursOnly === true} onChange={(e) => set({ businessHoursOnly: e.target.checked })} />
                <span>
                  <span className="text-sm text-foreground">{t("app.aiEmployee.hoursOnly", "Only answer during business hours")}</span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {data.hasBusinessHours
                      ? t("app.aiEmployee.hoursOnlyHint", "Your opening hours, from Company Settings. Outside them the message waits for you.")
                      : t("app.aiEmployee.hoursOnlyNoHours", "You haven't saved any opening hours, so this does nothing yet — it won't guess a Monday-to-Friday for you. Set them under Company Settings.")}
                  </span>
                </span>
              </label>

              <label className="block">
                <span className="text-sm text-foreground">{t("app.aiEmployee.capLabel", "Most replies in one conversation")}</span>
                <input type="number" min={0} max={10} className={FIELD} value={form.maxRepliesPerThread} onChange={(e) => set({ maxRepliesPerThread: Number(e.target.value) })} />
                <span className="text-xs text-muted-foreground">
                  {t("app.aiEmployee.capHint", "After this it stops and leaves the conversation to you. Zero pauses it without losing anything you've set up.")}
                </span>
              </label>

              <label className="flex gap-3 items-start rounded-lg border border-border p-3">
                <input type="checkbox" className="mt-1" checked={form.enabled === true} onChange={(e) => set({ enabled: e.target.checked })} />
                <span>
                  <span className="text-sm font-medium text-foreground">{t("app.aiEmployee.enabledOne", "Switch this employee on")}</span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {form.enabled
                      ? t("app.aiEmployee.enabledOnSentence", "On: it answers the channels ticked above, under the setting you chose. Switching it off is recorded with your name.")
                      : t("app.aiEmployee.enabledOffSentence", "Off: nothing routes to it, nothing is proposed, nothing is charged. The website chat and the text line tell customers someone will reply shortly, and the message lands in Conversations for you. Switching it on is recorded with your name.")}
                  </span>
                </span>
              </label>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <button type="button" className={BTN_PRIMARY} onClick={save} disabled={saving}>
              {saving ? t("app.common.saving", "Saving…") : t("app.common.save", "Save")}
            </button>
            {saved && (
              <span className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Check size={14} /> {t("app.common.saved", "Saved")}
              </span>
            )}
          </div>
        </>
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
        {data.ai?.cap !== null && data.ai?.cap !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.aiEmployee.balance", "This month: {used} of {cap} tokens used.", {
              used: Number(data.ai.usedTokens || 0).toLocaleString(),
              cap: Number(data.ai.cap).toLocaleString(),
            })}{" "}
            <Link href="/app/settings/ai-credit" className="underline">{t("app.aiEmployee.topUp", "Top up AI credit")}</Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.aiEmployee.lowBalance", "When the allowance runs out, every employee stops, tells the customer someone will reply shortly, and leaves the conversation to you with the reason on it. It never answers with a cheaper model.")}
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
                  {t("app.aiEmployee.testCostModel", "This test cost {amount} on {model}.", { amount: money(testResult.costCents), model: testResult.model || data.ai?.model || "—" })}
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
