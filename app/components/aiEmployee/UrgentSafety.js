"use client";

// app/components/aiEmployee/UrgentSafety.js
//
// Settings › AI employee › Urgent problems & safety — the company's own
// switches (owner, 2026-10-04: "this can be manually selected by the
// company"), one card for the whole AI team.
//
// ── Every control does the thing it says ────────────────────────────────────
//
//   What counts as urgent   AiEmployeeCompanySettings.urgentCategories — read
//                           by lib/aiEmployee/triage.js on every reply.
//   Ask before deciding     triageProbeFirst — the prompt's probing line.
//   Text the on-call person urgentAlertsEnabled + the ordered list + hours +
//                           the wait before the next person — read by
//                           lib/aiEmployee/urgentAlerts.js and the cron.
//   Safe first steps        safeStepsEnabled — the prompt's SAFE FIRST STEPS.
//   Match website visitors  matchWebChatClients — webChatMatch.js.
//   FieldQuo's manuals      useSharedManuals — respond.js reads the library.
//   Real appointment times  bookTechSlots — the troubleshooter's calendar.
//
// The status line under the on-call list is the server's (GET
// /api/ai-employee/safety → problems), computed by the same functions the
// escalation runs — so "texts are going to Sam first" is never a promise the
// send would break, and every reason a text would NOT go is named.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Siren, ArrowUp, ArrowDown, X, AlertTriangle, Check } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_FALLBACK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hhmm = (m) => (Number.isInteger(m) ? `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` : "");

function Toggle({ checked, disabled, onChange, label, sentence }) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] py-1">
      <input type="checkbox" className="mt-1 h-5 w-5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {sentence ? <span className="block text-sm text-muted-foreground">{sentence}</span> : null}
      </span>
    </label>
  );
}

export default function UrgentSafety({ t, language = "en", ui, readOnly = false }) {
  const { FIELD, BTN_QUIET } = ui;
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [adding, setAdding] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/ai-employee/safety");
    if (!res.ok) {
      await reportResponseError(res, setLoadError, t("app.aiEmployee.safety.loadError", "Couldn't load the urgent & safety settings."));
      return;
    }
    setData(await res.json());
  }, [t]);

  useEffect(() => {
    load().catch(() => setLoadError(t("app.aiEmployee.safety.loadError", "Couldn't load the urgent & safety settings.")));
  }, [load, t]);

  async function save(patch) {
    const field = Object.keys(patch)[0];
    setSaving(field);
    setFieldError(null);
    try {
      const res = await fetch("/api/ai-employee/safety", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.aiEmployee.saveError", "Couldn't save."));
        setFieldError({ field, message: typeof message === "string" ? message : t("app.aiEmployee.saveError", "Couldn't save.") });
        return;
      }
      setData(await res.json());
    } catch {
      showError(t("app.aiEmployee.saveError", "Couldn't save."));
    } finally {
      setSaving(null);
    }
  }

  if (loadError) {
    return (
      <div className="text-sm text-red-700 dark:text-red-300">
        {loadError}{" "}
        <button type="button" className="underline" onClick={() => load()}>
          {t("app.common.retry", "Try again")}
        </button>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">{t("app.common.loading", "Loading…")}</p>;

  const s = data.settings;
  const disabled = readOnly || Boolean(saving);
  const nameOf = (id) => data.members.find((m) => m.id === id)?.name || t("app.aiEmployee.safety.someone", "A team member");
  const catLabel = (c) => t(`app.aiEmployee.safety.cat.${c}`, c);
  const errorFor = (f) => (fieldError?.field === f ? <p className="text-sm text-red-700 dark:text-red-300 mt-1">{fieldError.message}</p> : null);
  const list = s.onCallMemberIds;
  const move = (i, d) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save({ onCallMemberIds: next });
  };
  const problems = data.problems || [];
  const blocking = problems.filter((p) => !p.warning);

  return (
    <div className="space-y-6">
      {/* ── What counts as urgent ─────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("app.aiEmployee.safety.urgentTitle", "What counts as urgent")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.aiEmployee.safety.emergencyFixed", "Gas or a carbon-monoxide alarm, fire, someone hurt and water on the electrics are always emergencies: the assistant tells them to get out or call 911 first. That can't be switched off.")}
        </p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {data.categories.map((c) => (
            <Toggle
              key={c}
              checked={s.urgentCategories.includes(c)}
              disabled={disabled}
              label={catLabel(c)}
              onChange={(on) => save({ urgentCategories: on ? [...s.urgentCategories, c] : s.urgentCategories.filter((x) => x !== c) })}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.aiEmployee.safety.urgentOffNote", "One you switch off is handled as an ordinary callback — never as a 911 call.")}
        </p>
        {errorFor("urgentCategories")}
        <Toggle
          checked={s.triageProbeFirst}
          disabled={disabled}
          label={t("app.aiEmployee.safety.probe", "Ask a quick question before deciding it's urgent")}
          sentence={t("app.aiEmployee.safety.probeSentence", "\"Is water actively coming in, or is it a drip?\" — so a dripping tap isn't treated as an emergency. A gas smell is never questioned: leaving comes first.")}
          onChange={(v) => save({ triageProbeFirst: v })}
        />
      </div>

      {/* ── Who gets texted ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("app.aiEmployee.safety.onCallTitle", "Text the on-call person")}</h3>
        <Toggle
          checked={s.urgentAlertsEnabled}
          disabled={disabled}
          label={t("app.aiEmployee.safety.alerts", "Text someone when it's urgent")}
          sentence={t("app.aiEmployee.safety.alertsSentence", "They also get the bell and a push. The customer is always given your company's phone number to call right away.")}
          onChange={(v) => save({ urgentAlertsEnabled: v })}
        />

        <ol className="mt-2 space-y-1">
          {list.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-muted-foreground">{i + 1}.</span>
              <span className="flex-1 text-foreground">
                {nameOf(id)}
                {!data.members.find((m) => m.id === id)?.hasPhone ? (
                  <span className="ml-2 text-amber-700 dark:text-amber-300">{t("app.aiEmployee.safety.noPhone", "no mobile number on their profile")}</span>
                ) : null}
              </span>
              <button type="button" className={BTN_QUIET} disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={t("app.aiEmployee.safety.moveUp", "Move up")}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className={BTN_QUIET} disabled={disabled || i === list.length - 1} onClick={() => move(i, 1)} aria-label={t("app.aiEmployee.safety.moveDown", "Move down")}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className={BTN_QUIET} disabled={disabled} onClick={() => save({ onCallMemberIds: list.filter((x) => x !== id) })} aria-label={t("app.aiEmployee.safety.remove", "Remove")}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
        {!list.length ? <p className="text-sm text-muted-foreground mt-1">{t("app.aiEmployee.safety.nobody", "Nobody is on call yet.")}</p> : null}
        {!readOnly ? (
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <select className={`${FIELD} sm:w-auto`} value={adding} disabled={disabled} onChange={(e) => setAdding(e.target.value)} aria-label={t("app.aiEmployee.safety.addPerson", "Add a person")}>
              <option value="">{t("app.aiEmployee.safety.pickPerson", "Pick a team member…")}</option>
              {data.members
                .filter((m) => !list.includes(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || t("app.aiEmployee.safety.someone", "A team member")}
                    {m.hasPhone ? "" : ` — ${t("app.aiEmployee.safety.noPhone", "no mobile number on their profile")}`}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={BTN_QUIET}
              disabled={disabled || !adding}
              onClick={() => {
                const id = adding;
                setAdding("");
                save({ onCallMemberIds: [...list, id] });
              }}
            >
              {t("app.aiEmployee.safety.add", "Add to the list")}
            </button>
          </div>
        ) : null}
        {errorFor("onCallMemberIds")}
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.aiEmployee.safety.ladderNote", "The first person is texted. If nobody presses \"I've got it\" in time, the next one is, and so on down the list; after the last, you get the bell.")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="ack-minutes" className="text-foreground">{t("app.aiEmployee.safety.ackLabel", "Wait before texting the next person (minutes)")}</label>
          <input
            id="ack-minutes"
            type="number"
            min={2}
            max={120}
            className={`${FIELD} w-24`}
            defaultValue={s.ackTimeoutMinutes}
            disabled={disabled}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== s.ackTimeoutMinutes) save({ ackTimeoutMinutes: v });
            }}
          />
        </div>
        {errorFor("ackTimeoutMinutes")}

        <fieldset className="mt-3">
          <legend className="text-sm text-foreground">{t("app.aiEmployee.safety.hoursLabel", "When they're on call")}</legend>
          {["always", "after_hours", "custom"].map((h) => (
            <label key={h} className="flex items-center gap-2 min-h-[44px] text-sm">
              <input type="radio" name="on-call-hours" className="h-5 w-5" checked={s.onCallHours === h} disabled={disabled} onChange={() => save({ onCallHours: h, ...(h === "custom" && !s.onCallDays.length ? { onCallDays: [0, 1, 2, 3, 4, 5, 6], onCallStartMinute: 18 * 60, onCallEndMinute: 8 * 60 } : {}) })} />
              {t(`app.aiEmployee.safety.hours.${h}`, h)}
            </label>
          ))}
          {s.onCallHours === "custom" ? (
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                {DAY_KEYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm min-h-[44px]">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={s.onCallDays.includes(i)}
                      disabled={disabled}
                      onChange={(e) => save({ onCallDays: e.target.checked ? [...s.onCallDays, i] : s.onCallDays.filter((x) => x !== i) })}
                    />
                    {t(`app.aiEmployee.safety.day.${d}`, DAY_FALLBACK[i])}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="on-call-start">{t("app.aiEmployee.safety.from", "From")}</label>
                <input id="on-call-start" type="time" className={`${FIELD} w-32`} defaultValue={hhmm(s.onCallStartMinute)} disabled={disabled} onBlur={(e) => e.target.value && save({ onCallStartMinute: e.target.value })} />
                <label htmlFor="on-call-end">{t("app.aiEmployee.safety.to", "to")}</label>
                <input id="on-call-end" type="time" className={`${FIELD} w-32`} defaultValue={hhmm(s.onCallEndMinute)} disabled={disabled} onBlur={(e) => e.target.value && save({ onCallEndMinute: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">{t("app.aiEmployee.safety.wrapNote", "An end time earlier than the start runs past midnight — 18:00 to 08:00 is the night shift.")}</p>
            </div>
          ) : null}
          {errorFor("onCallHours") || errorFor("onCallDays") || errorFor("onCallStartMinute") || errorFor("onCallEndMinute")}
        </fieldset>

        {/* The truth about right now — the server's own verdict. */}
        <div className={`mt-3 rounded-lg border p-3 text-sm ${blocking.length ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-border bg-muted text-foreground"}`}>
          {blocking.length ? (
            <>
              <p className="font-medium flex items-center gap-2"><AlertTriangle size={15} />{t("app.aiEmployee.safety.notGoing", "Urgent texts aren't going out right now:")}</p>
              <ul className="list-disc pl-5 mt-1">
                {blocking.map((p, i) => (
                  <li key={i}>{t(`app.aiEmployee.safety.problem.${p.reason}`, p.reason, { name: p.name || nameOf(p.memberId) })}</li>
                ))}
              </ul>
              <p className="mt-1">{t("app.aiEmployee.safety.fallback", "Until then, the customer is given your number and an urgent callback is booked, and you get the bell.")}</p>
            </>
          ) : (
            <p className="flex items-center gap-2"><Check size={15} />{t("app.aiEmployee.safety.going", "Urgent texts go to {name} first.", { name: data.ladder[0]?.name || nameOf(list[0]) })}</p>
          )}
          {problems.filter((p) => p.warning).map((p, i) => (
            <p key={`w${i}`} className="mt-1">{t(`app.aiEmployee.safety.problem.${p.reason}`, p.reason)}</p>
          ))}
          <p className="mt-1 text-muted-foreground">
            {t("app.aiEmployee.safety.price", "Each text is about {cents}¢ from your phone & text credit, at the same rate as your crew texts (never under {floor}¢). Balance: {balance}.", {
              cents: data.pricing.perTextCents,
              floor: data.pricing.floorCents,
              balance: formatAppMoney(Number(data.pricing.balanceCents || 0) / 100, CREDIT_CURRENCY, language),
            })}
          </p>
          <p className="mt-1">
            {data.companyPhone
              ? t("app.aiEmployee.safety.phoneGiven", "Customers are told to call {phone} if they need someone right now.", { phone: data.companyPhone })
              : t("app.aiEmployee.safety.noCompanyPhone", "Your company has no phone number saved, so customers can't be given one to call.")}{" "}
            {!data.companyPhone ? (
              <Link href="/app/settings/company" className="underline">{t("app.aiEmployee.safety.addPhone", "Add it in Company Settings")}</Link>
            ) : null}
          </p>
        </div>
      </div>

      {/* ── What the assistant may do and read ────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("app.aiEmployee.safety.helpTitle", "What it may do and read")}</h3>
        <Toggle
          checked={s.safeStepsEnabled}
          disabled={disabled}
          label={t("app.aiEmployee.safety.steps", "Give safe first steps")}
          sentence={t("app.aiEmployee.safety.stepsSentence", "Only vetted steps — like shutting the main water valve or switching one breaker off once — or steps from your own manuals. Never anything behind a panel, gas valve work, ladders or roofs, or live wiring.")}
          onChange={(v) => save({ safeStepsEnabled: v })}
        />
        <button type="button" className="text-sm underline ml-8" onClick={() => setShowSteps((v) => !v)}>
          {showSteps ? t("app.aiEmployee.safety.hideSteps", "Hide the steps") : t("app.aiEmployee.safety.showSteps", "See the steps it may give")}
        </button>
        {showSteps ? (
          <ul className="ml-8 mt-1 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {data.steps.map((st) => (
              <li key={st.id}>
                <span className="text-foreground">{st.text}</span> <span className="text-xs">({st.source})</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Toggle
          checked={s.matchWebChatClients}
          disabled={disabled}
          label={t("app.aiEmployee.safety.match", "Recognise clients on your website chat")}
          sentence={t("app.aiEmployee.safety.matchSentence", "When a visitor gives an email or phone you have on file, the chat is linked to that client so their equipment and history are used. You can undo a link from the conversation.")}
          onChange={(v) => save({ matchWebChatClients: v })}
        />
        <Toggle
          checked={s.useSharedManuals}
          disabled={disabled}
          label={t("app.aiEmployee.safety.shared", "Use FieldQuo's manual library")}
          sentence={t("app.aiEmployee.safety.sharedSentence", "Manufacturers' manuals FieldQuo keeps for every company, read after your own uploads. Your uploads always come first.")}
          onChange={(v) => save({ useSharedManuals: v })}
        />
        <Toggle
          checked={s.bookTechSlots}
          disabled={disabled}
          label={t("app.aiEmployee.safety.slots", "Offer real times with a tech")}
          sentence={t("app.aiEmployee.safety.slotsSentence", "When a problem isn't solved, the troubleshooter offers times from your booking calendar. Off: it books a callback instead.")}
          onChange={(v) => save({ bookTechSlots: v })}
        />
      </div>

      {/* ── Recent urgent conversations ───────────────────────────────── */}
      {data.recentAlerts?.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("app.aiEmployee.safety.recentTitle", "Recent urgent conversations")}</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {data.recentAlerts.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-2">
                <Siren size={14} className="mt-0.5 text-muted-foreground" />
                <Link href={`/app/urgent/${a.id}`} className="underline">{catLabel(a.category)}</Link>
                <span className="text-muted-foreground">
                  {t(`app.aiEmployee.safety.status.${a.status}`, a.status)}
                  {a.reason ? ` — ${t(`app.aiEmployee.safety.problem.${a.reason}`, a.reason, { name: "" })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
