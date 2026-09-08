"use client";

// app/app/settings/ai-employee/page.js
//
// Hiring the AI employee: which job it does, what it may say, what it reads,
// and whether it sends on its own or writes a draft for you.
//
// ── Three things on this screen are honesty mechanisms, not features ───────
//
// 1. THE TEST BOX. It calls /api/ai-employee/test, which calls the same
//    respondToMessage() an inbound Facebook message calls. What a contractor
//    reads here is what would have been sent, produced by the code that would
//    have sent it, with the documents it used named underneath. A prettier
//    "preview" built from a second code path would be worthless.
//
// 2. THE MODE SWITCH says the consequence. "Send automatically" is not a
//    label — the sentence beside it says a reply goes to the customer with
//    nobody reading it first, and the switch defaults off.
//
// 3. THE FILE LIST prints WHY a file was not read. FieldQuo cannot read a PDF
//    or a Word file (no reader in package.json — lib/aiEmployee/sources.js),
//    so the upload control says which formats work BEFORE the click, and a
//    refused file still appears in the list with the reason on it rather than
//    vanishing.
//
// ── What this screen cannot do yet, and says so ────────────────────────────
//
// Send. The channel it answers on is the Facebook/Instagram inbox, and Meta
// has not approved messaging for this app. So on a real company today the
// employee drafts and the drafts wait here. That sentence is printed at the
// top rather than left for somebody to discover, and the auto-send switch
// carries it too.

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

function Card({ id, title, icon: Icon, hint, children }) {
  return (
    <section id={id} className="bg-card border border-border rounded-xl p-5 scroll-mt-4">
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

export default function AiEmployeePage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [sources, setSources] = useState([]);
  const [queue, setQueue] = useState({ suggestions: [], stopped: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testText, setTestText] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: "", kind: "policy", text: "" });
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ai-employee");
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.loadError", "Couldn't load the AI employee."));
      return;
    }
    const d = await res.json();
    setData(d);
    setForm(d.employee);
  }, [t]);

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/ai-employee/sources");
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.sourcesLoadError", "Couldn't load your material."));
      return;
    }
    setSources((await res.json()).sources || []);
  }, [t]);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/ai-employee/suggestions");
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.queueLoadError", "Couldn't load the waiting drafts."));
      return;
    }
    setQueue(await res.json());
  }, [t]);

  useEffect(() => {
    (async () => {
      await Promise.all([load(), loadSources(), loadQueue()]);
      setLoading(false);
    })();
  }, [load, loadSources, loadQueue]);

  const role = useMemo(
    () => (data?.roles || []).find((r) => r.key === form?.role) || null,
    [data, form],
  );

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
    setForm((await res.json()).employee);
    setSaved(true);
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
      body: JSON.stringify({ text: testText }),
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
  // here: that route holds the permission check, the rate limit, the Meta
  // call, the failure record and the honest 409 for a channel Meta has not
  // approved. Only after it returns 200 is the draft stamped sent — and if
  // that second call fails the draft stays listed, because a duplicate
  // suggestion is recoverable and a message sent twice is not.
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
      showError(
        t(
          "app.aiEmployee.sentNotStamped",
          "It went out, but we couldn't tick it off here. Refresh — don't send it twice.",
        ),
      );
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

  if (loading || !form || !data) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-muted-foreground">{t("app.common.loading", "Loading…")}</p>
      </div>
    );
  }

  const channelBlocked = !data.channel?.connected;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <BackToHome />

      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Bot size={20} /> {t("app.aiEmployee.title", "AI employee")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.aiEmployee.subtitle",
            "An assistant that answers a customer's message for you — using your price book and the material you give it.",
          )}
        </p>
      </div>

      {/* The blocker, first, in one sentence. Nobody should configure a switch
          for a channel nothing can leave through and find out afterwards. */}
      {channelBlocked && (
        <Notice tone="warn">
          {t(
            "app.aiEmployee.channelBlocked",
            "Replies can't leave the building yet. The AI employee answers your Facebook and Instagram messages, and Meta hasn't approved messaging for FieldQuo. Everything here works — it drafts, and the drafts wait below for you to send.",
          )}
        </Notice>
      )}

      {!data.ai?.configured && (
        <Notice tone="warn">
          {t(
            "app.aiEmployee.aiUnavailable",
            "AI isn't switched on for this deployment, so the employee can't write anything at all.",
          )}
        </Notice>
      )}

      {data.ai?.configured && !data.ai?.allowed && (
        <Notice tone="warn">
          {data.ai.reason}{" "}
          <Link href="/app/settings/ai-credit" className="underline">
            {t("app.aiEmployee.topUp", "Top up AI credit")}
          </Link>
        </Notice>
      )}

      {/* ── The job ──────────────────────────────────────────────────────── */}
      <Card
        title={t("app.aiEmployee.roleTitle", "What job does it do?")}
        icon={Bot}
        hint={t(
          "app.aiEmployee.roleHint",
          "The job decides what it's allowed to do, not just how it sounds. A receptionist has no way to look up a price — that's the point of picking one.",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {data.roles.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => set({ role: r.key })}
              className={`text-left rounded-lg border p-3 min-h-[44px] ${
                form.role === r.key ? "border-primary bg-muted" : "border-border"
              }`}
            >
              <span className="font-medium text-foreground text-sm">{t(r.labelKey, r.key)}</span>
              <p className="text-xs text-muted-foreground mt-1">{t(r.blurbKey, "")}</p>
            </button>
          ))}
        </div>

        {role && (
          <div className="mt-4 space-y-2 text-xs">
            <p className="text-muted-foreground">
              {t("app.aiEmployee.roleCan", "It can:")}{" "}
              <span className="text-foreground">
                {role.allowed.map((k) => t(`app.aiEmployee.tool.${k}`, k)).join(", ")}
              </span>
            </p>
            {role.forbidden.length > 0 && (
              <p className="text-muted-foreground">
                {t("app.aiEmployee.roleCannot", "It cannot:")}{" "}
                <span className="text-foreground">
                  {role.forbidden.map((k) => t(`app.aiEmployee.tool.${k}`, k)).join(", ")}
                </span>
              </p>
            )}
            <p className="text-muted-foreground">
              {t(
                "app.aiEmployee.neverRule",
                "No matter what you write below, it can never invent a price, a date or a policy. If it isn't in your own data or your own material, it hands the conversation to a person.",
              )}
            </p>
          </div>
        )}
      </Card>

      {/* ── Voice ────────────────────────────────────────────────────────── */}
      <Card title={t("app.aiEmployee.voiceTitle", "How it writes")} icon={FileText}>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.nameLabel", "What you call it")}
            </span>
            <input
              className={FIELD}
              value={form.name || ""}
              maxLength={60}
              onChange={(e) => set({ name: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              {t(
                "app.aiEmployee.nameHint",
                "For you, not for customers. Nothing it writes ever mentions a name or says it's software unless somebody asks outright.",
              )}
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-foreground">{t("app.aiEmployee.toneLabel", "Tone")}</span>
            <select className={FIELD} value={form.tone} onChange={(e) => set({ tone: e.target.value })}>
              {data.tones.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`app.aiEmployee.tone.${tone}`, tone)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.greetingLabel", "Opening line (optional)")}
            </span>
            <input
              className={FIELD}
              value={form.greeting || ""}
              maxLength={300}
              onChange={(e) => set({ greeting: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.instructionsLabel", "Your instructions")}
            </span>
            <textarea
              className={`${FIELD} min-h-[140px]`}
              value={form.instructions || ""}
              maxLength={4000}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder={t(
                "app.aiEmployee.instructionsPlaceholder",
                "Facts about your business it should know. Areas you cover, what you don't do, how you like things worded.",
              )}
            />
          </label>

          <label className="block">
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.escalationLabel", "When it should fetch a person")}
            </span>
            <textarea
              className={`${FIELD} min-h-[100px]`}
              value={form.escalationRules || ""}
              maxLength={4000}
              onChange={(e) => set({ escalationRules: e.target.value })}
              placeholder={t(
                "app.aiEmployee.escalationPlaceholder",
                "Anything about a leak. Anyone asking for the owner. Anything over a certain size.",
              )}
            />
          </label>
        </div>
      </Card>

      {/* ── Mode ─────────────────────────────────────────────────────────── */}
      <Card title={t("app.aiEmployee.modeTitle", "Draft, or send?")} icon={Send}>
        <div className="space-y-3">
          <label className="flex gap-3 items-start rounded-lg border border-border p-3">
            <input
              type="radio"
              name="mode"
              className="mt-1"
              checked={form.autoReplyEnabled !== true}
              onChange={() => set({ autoReplyEnabled: false })}
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                {t("app.aiEmployee.modeSuggest", "Write me a draft (recommended)")}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {t(
                  "app.aiEmployee.modeSuggestHint",
                  "It writes the reply and waits. Nothing reaches the customer until you press send. Drafts appear at the bottom of this page.",
                )}
              </span>
            </span>
          </label>

          <label className="flex gap-3 items-start rounded-lg border border-border p-3">
            <input
              type="radio"
              name="mode"
              className="mt-1"
              checked={form.autoReplyEnabled === true}
              onChange={() => set({ autoReplyEnabled: true })}
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                {t("app.aiEmployee.modeAuto", "Send it automatically")}
              </span>
              {/* The consequence, not a label. */}
              <span className="block text-xs text-muted-foreground mt-1">
                {t(
                  "app.aiEmployee.modeAutoHint",
                  "The reply goes straight to the customer with nobody reading it first. It still refuses to quote a price it didn't get from your own rates, still stops when it's unsure, and still stops when your AI credit runs out.",
                )}
              </span>
            </span>
          </label>
        </div>
      </Card>

      {/* ── Limits ───────────────────────────────────────────────────────── */}
      <Card title={t("app.aiEmployee.limitsTitle", "Limits")} icon={AlertTriangle}>
        <div className="space-y-4">
          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.businessHoursOnly === true}
              onChange={(e) => set({ businessHoursOnly: e.target.checked })}
            />
            <span>
              <span className="text-sm text-foreground">
                {t("app.aiEmployee.hoursOnly", "Only answer during business hours")}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {data.hasBusinessHours
                  ? t(
                      "app.aiEmployee.hoursOnlyHint",
                      "Your opening hours, from Company Settings. Outside them the message waits for you.",
                    )
                  : t(
                      "app.aiEmployee.hoursOnlyNoHours",
                      "You haven't saved any opening hours, so this does nothing yet — it won't guess a Monday-to-Friday for you. Set them under Company Settings.",
                    )}
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.capLabel", "Most replies in one conversation")}
            </span>
            <input
              type="number"
              min={0}
              max={10}
              className={FIELD}
              value={form.maxRepliesPerThread}
              onChange={(e) => set({ maxRepliesPerThread: Number(e.target.value) })}
            />
            <span className="text-xs text-muted-foreground">
              {t(
                "app.aiEmployee.capHint",
                "After this it stops and leaves the conversation to you. Zero pauses it without losing anything you've set up.",
              )}
            </span>
          </label>

          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.enabled === true}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            <span className="text-sm text-foreground">
              {t("app.aiEmployee.enabled", "Switch the AI employee on")}
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

      {/* ── Material ─────────────────────────────────────────────────────── */}
      <Card
        id="material"
        title={t("app.aiEmployee.materialTitle", "What it reads")}
        icon={FileText}
        hint={t(
          "app.aiEmployee.materialHint",
          "Your policy, your troubleshooting notes, a tool manual. It answers from these and says which one an answer came from.",
        )}
      >
        <Notice>
          {t(
            "app.aiEmployee.formatsHonest",
            "We can read plain text: .txt, .md and .csv, or text you paste in. We cannot read a PDF or a Word file yet — if you upload one it'll show up below marked unread, and the fix is to paste the text or export it as .txt.",
          )}
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
            <input
              className={FIELD}
              placeholder={t("app.aiEmployee.pasteTitle", "What is this? e.g. Warranty policy")}
              value={paste.title}
              onChange={(e) => setPaste((p) => ({ ...p, title: e.target.value }))}
            />
            <select
              className={FIELD}
              value={paste.kind}
              onChange={(e) => setPaste((p) => ({ ...p, kind: e.target.value }))}
            >
              {data.sourceKinds.map((k) => (
                <option key={k} value={k}>
                  {t(`app.aiEmployee.kind.${k}`, k)}
                </option>
              ))}
            </select>
            <textarea
              className={`${FIELD} min-h-[160px]`}
              value={paste.text}
              onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value }))}
            />
            <button type="button" className={BTN_PRIMARY} onClick={addPaste}>
              {t("app.aiEmployee.pasteAdd", "Add it")}
            </button>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {sources.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t(
                "app.aiEmployee.noMaterial",
                "Nothing yet. Without material it answers from your instructions and your price book only — which is fine for a receptionist and not enough for a troubleshooter.",
              )}
            </li>
          )}
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground break-words">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`app.aiEmployee.kind.${s.kind}`, s.kind)}
                  {s.status === "ready"
                    ? ` · ${t("app.aiEmployee.sourceReady", "read, about {n} tokens", { n: s.tokenCount })}`
                    : ""}
                </p>
                {s.status === "failed" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {t(s.failureReason || "app.aiEmployee.source.failed.other", "We couldn't read this one.")}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={`${BTN_QUIET} shrink-0`}
                onClick={() => removeSource(s.id)}
                aria-label={t("app.aiEmployee.removeSource", "Remove")}
              >
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
        hint={t(
          "app.aiEmployee.testHint",
          "Type what a customer would write. This runs the real thing — the same code that would answer them — so it uses a little AI credit and nothing is sent or created.",
        )}
      >
        <textarea
          className={`${FIELD} min-h-[90px]`}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder={t(
            "app.aiEmployee.testPlaceholder",
            "Hi, how much would you charge to paint a 12x14 bedroom?",
          )}
        />
        <button
          type="button"
          className={`${BTN_PRIMARY} mt-3`}
          onClick={runTest}
          disabled={testing || !testText.trim()}
        >
          {testing ? t("app.aiEmployee.testing", "Asking…") : t("app.aiEmployee.testRun", "See the answer")}
        </button>

        {testResult && (
          <div className="mt-4 space-y-3">
            {testResult.reason ? (
              <Notice tone="warn">
                {t(`app.aiEmployee.skip.${testResult.reason}`, testResult.reason)}
              </Notice>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{testResult.text}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {testResult.sources?.length
                    ? t("app.aiEmployee.testSources", "From your material: {list}", {
                        list: testResult.sources.map((s) => s.title).join(", "),
                      })
                    : t(
                        "app.aiEmployee.testNoSources",
                        "It used none of your uploaded material for this one.",
                      )}
                </p>
                {testResult.tools?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.aiEmployee.testTools", "It used: {list}", {
                      list: testResult.tools
                        .map((x) => t(`app.aiEmployee.tool.${x.name}`, x.name))
                        .join(", "),
                    })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("app.aiEmployee.testCost", "This test cost {amount}.", {
                    amount: money(testResult.costCents),
                  })}
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── The queue ────────────────────────────────────────────────────── */}
      <Card
        id="drafts"
        title={t("app.aiEmployee.draftsTitle", "Waiting for you")}
        icon={Send}
        hint={t(
          "app.aiEmployee.draftsHint",
          "Replies it has written. Sending one sends it in the conversation, exactly as if you'd typed it.",
        )}
      >
        {queue.suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("app.aiEmployee.noDrafts", "Nothing waiting.")}
          </p>
        )}
        <ul className="space-y-3">
          {queue.suggestions.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {row.thread?.participantName ||
                  t("app.aiEmployee.unknownPerson", "Someone")}
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
            <h3 className="text-sm font-medium text-foreground">
              {t("app.aiEmployee.stoppedTitle", "It stopped on these")}
            </h3>
            <ul className="space-y-2 mt-2">
              {queue.stopped.map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm text-foreground">
                    {row.thread?.participantName || t("app.aiEmployee.unknownPerson", "Someone")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(
                      `app.aiEmployee.skip.${row.handoffReason}`,
                      row.handoffReason ||
                        t("app.aiEmployee.handedOffGeneric", "It wasn't sure, so it left this to you."),
                    )}
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
