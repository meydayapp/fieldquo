"use client";

// app/components/aiEmployee/TeamFlow.js
//
// "How your AI team works" — the routing process drawn as a picture, in the
// app's own look (Tailwind tokens, no chart library, no SVG library).
//
// ══ What it shows, and where each fact comes from ══════════════════════════
//
//   channels        the three channels, on/off from the employees' own
//                   switches plus the connection facts the settings route
//                   already returns (Meta connected? SMS number held?)
//   front desk      lib/aiEmployee/routing.js's four intents, each with the
//                   employee it goes to (the drop-down writes
//                   AiEmployee.intents through PATCH /api/ai-employee) and
//                   this week's count from the routing log
//   employee cards  one per hired employee: face, name, role, the channels
//                   it holds, and a chip per tool in roles.js's closed list —
//                   solid when the role allows it and it is on, outlined with
//                   a switch when the company turned it off, greyed with "not
//                   in this role" when the role forbids it. The chips are
//                   drawn from the server's `roles` payload (allowed /
//                   forbidden / switchable), never from a list kept here, so
//                   a tool added to roles.js appears without a second edit
//                   (scripts/check-ai-employee.mjs asserts the two agree).
//   hand-offs       an arrow per pair that handed a thread over this week
//   proposals gate  each employee's mode, and how many proposals are waiting
//   a person        the bottom box every card reaches — a hand-off, a
//                   take-over from Conversations, or a ping-pong escalation,
//                   with this week's count per employee
//
// ══ Read-only, except two things ═══════════════════════════════════════════
//
// The intent drop-downs and the tool switches are the only controls, and
// both save on change through the one PATCH — there is no local "pretend it
// changed" state: the payload the server returns is what is drawn. Everything
// else is a picture of facts the server sent.
//
// ══ Phone width ════════════════════════════════════════════════════════════
//
// One column: channels, then the front desk, then the cards, the gate and
// the person, with the arrows turned downward. The grid switches at `md`.

import { useState } from "react";
import { ArrowDown, ArrowRight, Bot, Check, Globe, MessageSquare, Smartphone, UserRound, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

/** Same visual vocabulary as the settings page. */
const BOX = "rounded-xl border border-border bg-card p-3";
const CHIP = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5";

const CHANNEL_ICON = { web: Globe, sms: Smartphone, meta: MessageSquare };
const CHANNEL_FLAG = { meta: "metaEnabled", web: "webChatEnabled", sms: "smsEnabled" };

function initialsOf(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "AI";
}

function Face({ url, name }) {
  return url ? (
    <img src={url} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
      {initialsOf(name)}
    </span>
  );
}

/** A count pill on an arrow. Zero is printed as zero: an arrow with no
 *  number would read as "unknown", and the log knows. */
function Count({ n, t }) {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return (
    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-foreground" title={t("app.aiEmployee.flow.thisWeek", "This week")}>
      {v}
    </span>
  );
}

/** The arrow between two columns — right on a desk, down on a phone. */
function Arrow({ label, count, t }) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-foreground md:flex-col md:justify-center">
      <ArrowDown size={16} className="md:hidden" aria-hidden="true" />
      <ArrowRight size={16} className="hidden md:block" aria-hidden="true" />
      {label ? <span className="text-[11px]">{label}</span> : null}
      {count !== undefined ? <Count n={count} t={t} /> : null}
    </div>
  );
}

function Chip({ state, label, onToggle, t }) {
  // solid = allowed and on; off = allowed, switched off by the company;
  // forbidden = not in this role.
  if (state === "forbidden") {
    return (
      <span className={`${CHIP} border-dashed border-border text-muted-foreground opacity-60`} title={t("app.aiEmployee.flow.notInRole", "Not in this role")}>
        {label}
        <span className="sr-only"> — {t("app.aiEmployee.flow.notInRole", "Not in this role")}</span>
      </span>
    );
  }
  if (state === "fixed") {
    return (
      <span className={`${CHIP} border-foreground bg-foreground text-background`}>
        <Check size={11} aria-hidden="true" /> {label}
      </span>
    );
  }
  const on = state === "on";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`${CHIP} min-h-[28px] ${on ? "border-foreground bg-foreground text-background" : "border-foreground bg-card text-foreground"}`}
      title={on ? t("app.aiEmployee.flow.switchOff", "Switch off for this employee") : t("app.aiEmployee.flow.switchOn", "Switch on")}
    >
      {on ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />} {label}
    </button>
  );
}

/**
 * @param data        GET /api/ai-employee's payload (employees, roles, flow,
 *                    channel, sms, modes)
 * @param proposals   the waiting proposals (the page already loads them)
 * @param onEmployees called with the server's refreshed employee list after
 *                    a PATCH, so the page's own state follows
 */
export default function TeamFlow({ data, proposals = [], onEmployees, t }) {
  const [busy, setBusy] = useState(null); // "intent:book" | "tool:<id>:<tool>"
  const employees = data?.employees || [];
  const roles = data?.roles || [];
  const flow = data?.flow || { intents: [], roleForIntent: {}, counts: null };
  const counts = flow.counts || { byIntent: {}, byChannel: {}, assignedTo: {}, handOffs: {}, toHuman: {}, escalated: 0 };
  const live = employees.filter((e) => e.enabled);
  const roleOf = (key) => roles.find((r) => r.key === key) || null;
  const nameOf = (e) => e?.displayName || e?.name || "";
  const toolLabel = (k) => t(`app.aiEmployee.tool.${k}`, k);

  /** The employee an intent goes to, by the same order routing.js uses:
   *  explicit mapping, then the role default, then the channel holder /
   *  receptionist / oldest — printed so the drop-down shows the truth even
   *  when nobody has chosen. */
  function destinationFor(intent) {
    if (live.length === 1) return live[0];
    const explicit = live.find((e) => (e.intents || []).includes(intent));
    if (explicit) return explicit;
    const role = flow.roleForIntent?.[intent];
    const byRole = role ? live.find((e) => e.role === role) : null;
    if (byRole) return byRole;
    return live.find((e) => e.role === "receptionist") || live[0] || null;
  }

  async function patch(body, key) {
    setBusy(key);
    try {
      const res = await fetch("/api/ai-employee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.aiEmployee.saveError", "Couldn't save."));
        return;
      }
      const out = await res.json();
      if (Array.isArray(out.employees)) onEmployees?.(out.employees);
    } finally {
      setBusy(null);
    }
  }

  function setIntent(intent, employeeId) {
    const target = employees.find((e) => e.id === employeeId);
    if (!target) return;
    const next = Array.from(new Set([...(target.intents || []), intent]));
    patch({ id: target.id, intents: next }, `intent:${intent}`);
  }

  function toggleTool(employee, tool) {
    const off = new Set(employee.disabledTools || []);
    if (off.has(tool)) off.delete(tool);
    else off.add(tool);
    patch({ id: employee.id, disabledTools: Array.from(off) }, `tool:${employee.id}:${tool}`);
  }

  const channelOn = (c) => {
    const held = live.some((e) => e[CHANNEL_FLAG[c]] === true);
    if (c === "meta") return held && data?.channel?.connected === true;
    if (c === "sms") return held && data?.sms?.available === true;
    return held;
  };
  const holdersOf = (c) => live.filter((e) => e[CHANNEL_FLAG[c]] === true);

  const waiting = (proposals || []).filter((p) => p.status === "pending" || !p.status);
  const waitingFor = (id) => waiting.filter((p) => p.employeeId === id).length;

  const handOffPairs = Object.entries(counts.handOffs || {})
    .map(([key, n]) => {
      const [from, to] = key.split(">");
      return { from: employees.find((e) => e.id === from), to: employees.find((e) => e.id === to), n };
    })
    .filter((p) => p.from && p.to);

  return (
    <div className="space-y-3" data-team-flow>
      {/* ── Row 1: channels → front desk → cards ───────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_minmax(0,2fr)] md:items-stretch">
        {/* Channels */}
        <div className="space-y-2">
          {(data?.channels || ["web", "sms", "meta"]).map((c) => {
            const Icon = CHANNEL_ICON[c] || MessageSquare;
            const on = channelOn(c);
            return (
              <div key={c} className={`${BOX} flex items-center gap-2 ${on ? "" : "opacity-70"}`} data-flow-channel={c} data-on={on ? "1" : "0"}>
                <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t(`app.aiEmployee.channel.${c}`, c)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {on
                      ? holdersOf(c).map(nameOf).join(", ")
                      : t("app.aiEmployee.flow.channelOff", "Off — messages land in Conversations for a person")}
                  </p>
                </div>
                <span className={`${CHIP} ${on ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>
                  {on ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off")}
                </span>
                <Count n={counts.byChannel?.[c]} t={t} />
              </div>
            );
          })}
        </div>

        <Arrow label={t("app.aiEmployee.flow.firstMessage", "first message")} t={t} />

        {/* Front desk */}
        <div className={`${BOX} space-y-2`} data-flow-front-desk>
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">{t("app.aiEmployee.flow.frontDesk", "Front desk")}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {live.length > 1
              ? t("app.aiEmployee.flow.frontDeskHint", "Reads the first message once, on the standard model, and hands the conversation to exactly one employee. No tools, no reply of its own.")
              : t("app.aiEmployee.flow.frontDeskSolo", "With one employee there is nothing to decide: every conversation goes to them, and no triage call is spent.")}
          </p>
          <ul className="space-y-1.5">
            {(flow.intents || []).map((intent) => {
              const dest = destinationFor(intent);
              return (
                <li key={intent} className="flex items-center gap-2" data-flow-intent={intent}>
                  <span className="w-[4.5rem] shrink-0 text-xs font-medium text-foreground">{t(`app.aiEmployee.intent.${intent}`, intent)}</span>
                  <ArrowRight size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <select
                    className="min-h-[36px] min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                    aria-label={t("app.aiEmployee.flow.intentGoesTo", "{intent} goes to", { intent: t(`app.aiEmployee.intent.${intent}`, intent) })}
                    value={dest?.id || ""}
                    disabled={busy === `intent:${intent}` || live.length < 2}
                    onChange={(e) => setIntent(intent, e.target.value)}
                  >
                    {live.map((e) => (
                      <option key={e.id} value={e.id}>
                        {nameOf(e)} · {t(`app.aiEmployee.role.${e.role}`, e.role)}
                      </option>
                    ))}
                    {!live.length ? <option value="">{t("app.aiEmployee.flow.nobody", "nobody is on")}</option> : null}
                  </select>
                  <Count n={counts.byIntent?.[intent]} t={t} />
                </li>
              );
            })}
          </ul>
        </div>

        <Arrow label={t("app.aiEmployee.flow.assigned", "assigned")} t={t} />

        {/* Employee cards */}
        <div className="space-y-2">
          {employees.map((e) => {
            const role = roleOf(e.role);
            const off = new Set(e.disabledTools || []);
            const switchable = new Set(role?.switchable || []);
            const tools = [...(role?.allowed || []), ...(role?.forbidden || [])];
            const channels = (data?.channels || []).filter((c) => e[CHANNEL_FLAG[c]] === true);
            return (
              <div key={e.id} className={`${BOX} ${e.enabled ? "" : "opacity-60"}`} data-flow-employee={e.id} data-role={e.role}>
                <div className="flex items-center gap-2">
                  <Face url={e.avatarUrl} name={nameOf(e)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{nameOf(e)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t(`app.aiEmployee.role.${e.role}`, e.role)} · {e.enabled ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off")}
                      {channels.length ? ` · ${channels.map((c) => t(`app.aiEmployee.channel.${c}`, c)).join(", ")}` : ""}
                    </p>
                  </div>
                  <Count n={counts.assignedTo?.[e.id]} t={t} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1" data-flow-tools>
                  {tools.map((tool) => {
                    const forbidden = (role?.forbidden || []).includes(tool);
                    const state = forbidden ? "forbidden" : !switchable.has(tool) ? "fixed" : off.has(tool) ? "off" : "on";
                    return (
                      <span key={tool} data-tool={tool} data-state={state} className={busy === `tool:${e.id}:${tool}` ? "opacity-50" : ""}>
                        <Chip state={state} label={toolLabel(tool)} onToggle={() => toggleTool(e, tool)} t={t} />
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!employees.length ? <p className="text-sm text-muted-foreground">{t("app.aiEmployee.flow.noEmployees", "Nobody hired yet.")}</p> : null}
        </div>
      </div>

      {/* ── Hand-offs between employees ────────────────────────────────── */}
      {live.length > 1 ? (
        <div className={`${BOX} text-xs text-muted-foreground`} data-flow-handoffs>
          <p className="font-medium text-foreground">{t("app.aiEmployee.flow.handOffs", "Hand-offs between employees")}</p>
          <p className="mt-0.5">
            {t("app.aiEmployee.flow.handOffsHint", "Any employee can pass a conversation to a colleague whose job it is. One hand-off per message; a conversation passed twice within ten minutes goes to a person instead.")}
          </p>
          {handOffPairs.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {handOffPairs.map((p) => (
                <li key={`${p.from.id}>${p.to.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-foreground">
                  {nameOf(p.from)} <ArrowRight size={12} aria-hidden="true" /> {nameOf(p.to)} <Count n={p.n} t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 italic">{t("app.aiEmployee.flow.noHandOffs", "None this week.")}</p>
          )}
        </div>
      ) : null}

      {/* ── The proposals gate ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className={`${BOX}`} data-flow-gate>
          <p className="text-sm font-semibold text-foreground">{t("app.aiEmployee.flow.gate", "Proposals gate")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("app.aiEmployee.flow.gateHint", "What each employee may do on its own. Anything the mode does not allow becomes a proposal that waits for your yes.")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {employees.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs" data-flow-gate-row={e.id}>
                <span className="min-w-0 flex-1 truncate text-foreground">{nameOf(e)}</span>
                <span className={`${CHIP} border-border text-foreground`}>{t(`app.aiEmployee.mode.${e.mode}`, e.mode)}</span>
                <span className="text-muted-foreground">
                  {t("app.aiEmployee.flow.waiting", "{n} waiting", { n: waitingFor(e.id) })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Arrow label={t("app.aiEmployee.flow.handedToPerson", "handed to a person")} count={Object.values(counts.toHuman || {}).reduce((a, b) => a + b, 0)} t={t} />

        {/* A person */}
        <div className={`${BOX} flex items-start gap-2`} data-flow-person>
          <UserRound size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("app.aiEmployee.flow.person", "A person")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("app.aiEmployee.flow.personHint", "Every employee can reach you: when it is unsure, when a customer asks, when two colleagues would bounce a conversation, or the moment you reply yourself in Conversations. It stays quiet until you press \"Let {name} continue\".", { name: nameOf(live[0]) || "…" })}
            </p>
            {employees.length ? (
              <ul className="mt-1 flex flex-wrap gap-1">
                {employees.map((e) => (
                  <li key={e.id} className={`${CHIP} border-border text-foreground`}>
                    {nameOf(e)} <Count n={counts.toHuman?.[e.id]} t={t} />
                  </li>
                ))}
                {counts.escalated ? (
                  <li className={`${CHIP} border-border text-foreground`}>
                    {t("app.aiEmployee.flow.pingPong", "bounced twice")} <Count n={counts.escalated} t={t} />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
