// app/app/settings/business-number/page.js
//
// Settings → Business number: "Bring your number".
//
// The structure is the one shown to the owner (2026-10-03): the promise, the
// number with its DETECTED type, the path that type allows — move it (a cell,
// a VoIP line) or keep calls and move texts (a landline, toll-free) — with the
// warnings said before anyone starts, a checklist that tracks the request,
// "once it's moved" in three tiles, and the monthly cost computed from this
// company's own volumes and the real prices (GET /api/settings/business-number),
// never a placeholder.
//
// Nothing here decides anything: which path a line may take, whether it may
// start, what it costs and where it is are all the server's answers
// (lib/businessNumber/). A control whose precondition is missing is drawn
// disabled with the reason, never live and failing on press.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneForwarded,
  MessageSquare,
  PhoneOutgoing,
  Check,
  Circle,
  AlertTriangle,
  Loader2,
  Upload,
  Clock,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { loaText } from "@/lib/businessNumber/loa";

const API = "/api/settings/business-number";
const money = (cents) => formatAppMoney(Number(cents || 0) / 100, CREDIT_CURRENCY, "en");
const IN_FLIGHT = ["submitted", "awaiting_filing", "pending_verification", "awaiting_signature", "carrier_processing", "action_required"];

function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-border bg-card p-5 space-y-3 ${className}`}>{children}</section>;
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const primaryBtn = "inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50";
const quietBtn = "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50";

function kindLabel(t, kind) {
  switch (kind) {
    case "mobile":
      return t("app.bizNumber.kind.mobile", "Cell phone");
    case "landline":
      return t("app.bizNumber.kind.landline", "Landline");
    case "voip":
      return t("app.bizNumber.kind.voip", "Internet (VoIP) line");
    case "toll_free":
      return t("app.bizNumber.kind.tollFree", "Toll-free");
    default:
      return t("app.bizNumber.kind.unknown", "Line type not known");
  }
}

function Warning({ children }) {
  return (
    <div className="flex gap-2 rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-sm text-foreground">
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-brand-accent-text" />
      <div>{children}</div>
    </div>
  );
}

function Step({ done, current, label, detail }) {
  return (
    <li className="flex gap-2 text-sm">
      {done ? (
        <Check size={16} className="shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
      ) : current ? (
        <Clock size={16} className="shrink-0 mt-0.5 text-brand-accent-text" />
      ) : (
        <Circle size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
      <div>
        <div className={done || current ? "text-foreground" : "text-muted-foreground"}>{label}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
    </li>
  );
}

/** The three "once it's moved" tiles. Hosted numbers keep calls with their provider, and say so. */
function OnceMoved({ path, receptionist }) {
  const { t } = useTranslation();
  const hosted = path === "hosted_sms";
  const tiles = [
    {
      icon: PhoneForwarded,
      title: t("app.bizNumber.tile.callsTitle", "Calls ring"),
      body: hosted
        ? t("app.bizNumber.tile.callsHosted", "Calls keep ringing exactly where they ring today — your phone provider still handles them.")
        : receptionist
          ? t("app.bizNumber.tile.callsReceptionist", "Your cell (or your team's phones) rings first. No answer → your AI receptionist picks up.")
          : t("app.bizNumber.tile.callsVoicemail", "Your cell (or your team's phones) rings first. No answer → voicemail, saved on the conversation."),
    },
    {
      icon: MessageSquare,
      title: t("app.bizNumber.tile.textsTitle", "Texts"),
      body: t("app.bizNumber.tile.textsBody", "Arrive in your FieldQuo inbox with a phone alert, linked to the lead or job. Replies go out from this number."),
    },
    {
      icon: PhoneOutgoing,
      title: t("app.bizNumber.tile.outTitle", "Calling out"),
      body: hosted
        ? t("app.bizNumber.tile.outHosted", "Calls stay with your provider, so the Call button in FieldQuo can't use this number.")
        : t("app.bizNumber.tile.outBody", "Tap Call on a lead, client or job. FieldQuo rings you, then the client — they see your business number."),
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map(({ icon: Icon, title, body }) => (
        <div key={title} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Icon size={14} />
            </span>
            {title}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{body}</p>
        </div>
      ))}
    </div>
  );
}

function CostBox({ estimate, basedOn, portFee, country, callFloor }) {
  const { t } = useTranslation();
  if (!estimate) return null;
  const r = estimate.rates;
  return (
    <div className="rounded-lg bg-muted px-3 py-2 text-sm space-y-1">
      <div className="font-semibold text-foreground">
        {t("app.bizNumber.cost.total", "From {amount} a month", { amount: money(estimate.totalCents) })}
      </div>
      <div className="text-xs text-muted-foreground">
        {t("app.bizNumber.cost.breakdown", "{rent} number + {texts} texts", { rent: money(estimate.rentCents), texts: money(estimate.textCents) })}
        {estimate.callCents > 0 ? ` + ${t("app.bizNumber.cost.calls", "{calls} calls", { calls: money(estimate.callCents) })}` : ""}
        {" · "}
        {basedOn === "history"
          ? t("app.bizNumber.cost.fromHistory", "from your last 30 days of texts")
          : t("app.bizNumber.cost.fromExample", "for a typical month ({textsIn} texts in, {textsOut} out{minutes})", {
              textsIn: estimate.inputs.textsIn,
              textsOut: estimate.inputs.textsOut,
              minutes: estimate.inputs.callMinutes ? `, ${estimate.inputs.callMinutes} min` : "",
            })}
      </div>
      <div className="text-xs text-muted-foreground">
        {t("app.bizNumber.cost.rates", "From your phone balance: {rent}/month from the day it goes live, {text} per text, {photo} per photo", {
          rent: money(r.rentCents),
          text: `${r.textCents}¢`,
          photo: `${r.photoCents}¢`,
        })}
        {r.callCentsPerMinute ? `, ${t("app.bizNumber.cost.perMinute", "{rate} per call minute", { rate: `${r.callCentsPerMinute}¢` })}` : ""}.
      </div>
      <div className="text-xs text-muted-foreground">
        {t("app.bizNumber.cost.rule", "Texts and calls are billed at cost × 2, minimum {text} per text, {photo} per photo and {minute} per call minute — so the estimate above is the least a month like that costs.", {
          text: `${r.textCents}¢`,
          photo: `${r.photoCents}¢`,
          minute: `${callFloor}¢`,
        })}
      </div>
      {portFee && (
        <div className="text-xs text-muted-foreground">
          {country === "CA"
            ? t("app.bizNumber.cost.portFeeCa", "Moving it: FieldQuo charges nothing. Twilio doesn't publish a Canadian port fee — if there is one, we'll tell you before filing.")
            : t("app.bizNumber.cost.portFeeUs", "Moving it: no fee from FieldQuo or Twilio for a US number.")}
        </div>
      )}
    </div>
  );
}

function AddressFields({ value, onChange, country }) {
  const { t } = useTranslation();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("app.bizNumber.form.street", "Street address")}>
        <input className={inputCls} value={value.street || ""} onChange={set("street")} autoComplete="address-line1" />
      </Field>
      <Field label={t("app.bizNumber.form.street2", "Unit / suite (optional)")}>
        <input className={inputCls} value={value.street2 || ""} onChange={set("street2")} autoComplete="address-line2" />
      </Field>
      <Field label={t("app.bizNumber.form.city", "City")}>
        <input className={inputCls} value={value.city || ""} onChange={set("city")} autoComplete="address-level2" />
      </Field>
      <Field label={country === "CA" ? t("app.bizNumber.form.province", "Province") : t("app.bizNumber.form.state", "State")}>
        <input className={inputCls} value={value.region || ""} onChange={set("region")} autoComplete="address-level1" />
      </Field>
      <Field label={country === "CA" ? t("app.bizNumber.form.postal", "Postal code") : t("app.bizNumber.form.zip", "ZIP code")}>
        <input className={inputCls} value={value.postalCode || ""} onChange={set("postalCode")} autoComplete="postal-code" />
      </Field>
    </div>
  );
}

function ErrorLine({ error }) {
  if (!error) return null;
  return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
}

function PortForm({ number, data, onDone }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ customerType: "Business", address: {} });
  const [bill, setBill] = useState(null);
  const [acks, setAcks] = useState([]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const carrier = number.carrierName || t("app.bizNumber.yourCarrier", "your carrier");
  const toggle = (k) => setAcks((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const canPort = data.available.porting && data.available.twilio;
  const loa = loaText({ e164: number.e164, holderName: f.holderName, customerType: f.customerType, serviceAddress: { ...f.address, country: number.country }, carrierName: number.carrierName });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = new FormData();
    for (const k of ["holderName", "customerType", "email", "accountNumber", "pin"]) body.set(k, f[k] || "");
    for (const k of ["street", "street2", "city", "region", "postalCode"]) body.set(k, f.address[k] || "");
    body.set("acks", JSON.stringify(acks));
    body.set("signatureName", f.signatureName || "");
    body.set("signatureAgreed", agreed ? "true" : "false");
    if (bill) body.set("bill", bill);
    try {
      const res = await fetch("/api/settings/business-number/port", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || t("app.bizNumber.error.generic", "That didn't go through. Nothing has been filed — try again."));
      } else {
        onDone();
      }
    } catch {
      setError(t("app.bizNumber.error.network", "Couldn't reach FieldQuo. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("app.bizNumber.port.title", "Move this number to FieldQuo")}</h2>
      {number.lineType === "mobile" && (
        <Warning>
          {t("app.bizNumber.port.warn90", "{carrier} will text this phone to approve the move. Reply within 90 minutes or it's cancelled.", { carrier })}
        </Warning>
      )}
      <Warning>
        {t("app.bizNumber.port.warnTimeline", "It takes 5–7 working days once filed, and up to 4 weeks if the carrier pushes back. Your number keeps working with {carrier} until the moment it moves.", { carrier })}
      </Warning>
      <Warning>
        {t("app.bizNumber.port.warnSim", "After the move this number no longer belongs to your SIM. Get a new number from {carrier} for the phone, or cancel that line — and check your contract for cancellation fees first.", { carrier })}
      </Warning>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("app.bizNumber.form.holder", "Account holder, exactly as on the bill")}>
          <input className={inputCls} value={f.holderName || ""} onChange={set("holderName")} />
        </Field>
        <Field label={t("app.bizNumber.form.accountType", "Account type")}>
          <select className={inputCls} value={f.customerType} onChange={set("customerType")}>
            <option value="Business">{t("app.bizNumber.form.business", "Business")}</option>
            <option value="Individual">{t("app.bizNumber.form.individual", "Personal")}</option>
          </select>
        </Field>
        <Field label={t("app.bizNumber.form.email", "Email for the authorization")}>
          <input type="email" className={inputCls} value={f.email || ""} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field label={t("app.bizNumber.form.accountNumber", "{carrier} account number", { carrier })}>
          <input className={inputCls} value={f.accountNumber || ""} onChange={set("accountNumber")} autoComplete="off" />
        </Field>
        <Field
          label={t("app.bizNumber.form.pin", "Port-out PIN")}
          hint={t("app.bizNumber.form.pinHint", "Ask {carrier} for it (often in the app or by calling). Stored encrypted and deleted when the move is done.", { carrier })}
        >
          <input className={inputCls} value={f.pin || ""} onChange={set("pin")} autoComplete="off" inputMode="numeric" />
        </Field>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{t("app.bizNumber.form.serviceAddress", "Service address, exactly as {carrier} has it", { carrier })}</p>
      <AddressFields value={f.address} onChange={(address) => setF({ ...f, address })} country={number.country} />

      <Field label={t("app.bizNumber.form.bill", "A recent bill (PDF or photo, under 4 MB)")}>
        <span className="flex items-center gap-2">
          <Upload size={14} className="text-muted-foreground" />
          <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setBill(e.target.files?.[0] || null)} className="text-sm" />
        </span>
      </Field>

      <div className="space-y-2">
        {[
          ["approve_text_90_min", t("app.bizNumber.ack.text", "I'll watch for {carrier}'s text and approve it within 90 minutes.", { carrier })],
          ["timeline", t("app.bizNumber.ack.timeline", "I understand it takes 5–7 working days, up to 4 weeks.")],
          ["leaves_sim", t("app.bizNumber.ack.sim", "I understand this number will stop working on my SIM, and I've checked my contract.")],
        ].map(([k, label]) => (
          <label key={k} className="flex gap-2 text-sm text-foreground">
            <input type="checkbox" checked={acks.includes(k)} onChange={() => toggle(k)} className="mt-1" />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("app.bizNumber.loa.title", "Authorization")}</p>
        {number.country === "CA" ? (
          <pre className="whitespace-pre-wrap text-xs bg-muted rounded-lg p-3 text-foreground">{loa}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">{t("app.bizNumber.loa.us", "Twilio will email the address above an authorization to sign. The move starts once it's signed.")}</p>
        )}
        <Field label={t("app.bizNumber.loa.sign", "Type your full name to sign")}>
          <input className={inputCls} value={f.signatureName || ""} onChange={set("signatureName")} />
        </Field>
        <label className="flex gap-2 text-sm text-foreground">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
          {t("app.bizNumber.loa.agree", "I'm the account holder or allowed to act for them, and I authorize this move.")}
        </label>
      </div>

      <CostBox estimate={data.costs.port} basedOn={data.costs.basedOn} portFee country={number.country} callFloor={data.costs.callCentsPerMinute} />
      {!canPort && <p className="text-sm text-muted-foreground">{t("app.bizNumber.notReadyPort", "Moving a number isn't switched on for your account yet. There's nothing for you to do — it'll open here when it's ready.")}</p>}
      <ErrorLine error={error} />
      <button type="submit" disabled={busy || !canPort} className={primaryBtn}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        {t("app.bizNumber.port.submit", "Move my number")}
      </button>
    </form>
  );
}

function HostedForm({ number, data, onDone }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ address: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetchJson(API, { method: "POST", body: { action: "hosted", form: f } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("app.bizNumber.hosted.title", "Keep calls where they are, move texts to FieldQuo")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("app.bizNumber.hosted.body", "Your provider keeps your calls. Twilio takes over texting for the number: it calls the number once to prove it's yours, then emails an authorization to sign. Usually live within 1–3 working days.")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("app.bizNumber.form.owner", "Owner's name")}>
          <input className={inputCls} value={f.holderName || ""} onChange={set("holderName")} />
        </Field>
        <Field label={t("app.bizNumber.form.email", "Email for the authorization")}>
          <input type="email" className={inputCls} value={f.email || ""} onChange={set("email")} />
        </Field>
        <Field label={t("app.bizNumber.form.contactPhone", "A phone we can reach you on")}>
          <input className={inputCls} value={f.contactPhone || ""} onChange={set("contactPhone")} inputMode="tel" />
        </Field>
        <Field label={t("app.bizNumber.form.title", "Your title (optional)")}>
          <input className={inputCls} value={f.contactTitle || ""} onChange={set("contactTitle")} />
        </Field>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{t("app.bizNumber.form.ownerAddress", "The owner's address")}</p>
      <AddressFields value={f.address} onChange={(address) => setF({ ...f, address })} country={number.country} />
      <CostBox estimate={data.costs.hosted} basedOn={data.costs.basedOn} callFloor={data.costs.callCentsPerMinute} />
      <ErrorLine error={error} />
      <button type="submit" disabled={busy || !data.available.twilio} className={primaryBtn}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        {t("app.bizNumber.hosted.submit", "Start moving texts")}
      </button>
    </form>
  );
}

/** Where an in-flight request is, as a checklist. */
function Tracker({ number, onChanged }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const carrier = number.carrierName || t("app.bizNumber.yourCarrier", "your carrier");
  const s = number.status;
  const days = number.submittedAt ? Math.max(1, Math.ceil((Date.now() - new Date(number.submittedAt).getTime()) / 86400000)) : null;

  async function act(action) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetchJson(API, { method: "POST", body: { action } });
      if (action === "verify_call") setCode(r.code || null);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const port = number.path === "port";
  const order = ["submitted", "awaiting_filing", "pending_verification", "awaiting_signature", "carrier_processing", "active"];
  const at = order.indexOf(s);
  const past = (status) => at > order.indexOf(status);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          {port ? t("app.bizNumber.track.portTitle", "Moving {number}", { number: number.e164 }) : t("app.bizNumber.track.hostedTitle", "Moving texts for {number}", { number: number.e164 })}
        </h2>
        {number.simulated && <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{t("app.bizNumber.demo", "Demo — nothing sent to a carrier")}</span>}
      </div>
      <ul className="space-y-2">
        {port ? (
          <>
            <Step done label={t("app.bizNumber.track.signed", "Authorization signed")} />
            <Step done label={t("app.bizNumber.track.bill", "Bill uploaded")} detail={number.billName} />
            <Step done label={t("app.bizNumber.track.account", "Account number and PIN")} detail={number.accountNumberHint || (number.secretsPurgedAt ? t("app.bizNumber.track.purged", "Sent, and deleted from FieldQuo") : null)} />
            {number.submitChannel === "twilio_form" && (
              <Step done={past("awaiting_filing")} current={s === "awaiting_filing"} label={t("app.bizNumber.track.filing", "FieldQuo files it with Twilio (within one working day)")} />
            )}
            {number.submitChannel === "twilio_api" && (
              <Step done={past("awaiting_signature")} current={s === "awaiting_signature" || s === "submitted"} label={t("app.bizNumber.track.emailSign", "Sign the authorization Twilio emailed to {email}", { email: number.holderEmail })} />
            )}
            <Step
              done={s === "active"}
              current={s === "carrier_processing"}
              label={t("app.bizNumber.track.waiting", "Waiting for {carrier}", { carrier })}
              detail={
                s === "carrier_processing" && days
                  ? t("app.bizNumber.track.day", "Day {day} of 5–7{date}", { day: days, date: number.expectedAt ? ` · ${new Date(number.expectedAt).toLocaleDateString()}` : "" })
                  : null
              }
            />
          </>
        ) : (
          <>
            <Step done={past("submitted")} current={s === "submitted"} label={t("app.bizNumber.track.eligible", "Twilio checks the number can be hosted")} />
            <Step done={past("pending_verification")} current={s === "pending_verification"} label={t("app.bizNumber.track.call", "Ownership call to the number")} />
            <Step done={past("awaiting_signature")} current={s === "awaiting_signature"} label={t("app.bizNumber.track.emailSign", "Sign the authorization Twilio emailed to {email}", { email: number.holderEmail })} />
            <Step done={s === "active"} current={s === "carrier_processing"} label={t("app.bizNumber.track.carrier", "The carrier switches texting over (1–3 working days)")} />
          </>
        )}
      </ul>

      {number.lineType === "mobile" && s === "carrier_processing" && (
        <Warning>{t("app.bizNumber.port.warn90", "{carrier} will text this phone to approve the move. Reply within 90 minutes or it's cancelled.", { carrier })}</Warning>
      )}

      {!port && s === "pending_verification" && (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            {t("app.bizNumber.verify.body", "Stand by the phone on {number}. Twilio will call it and ask for a code — the one shown here once you press the button.", { number: number.e164 })}
          </p>
          <button type="button" onClick={() => act("verify_call")} disabled={busy} className={primaryBtn}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            <Phone size={14} /> {t("app.bizNumber.verify.button", "Call the number now")}
          </button>
          {code && (
            <p className="text-sm text-foreground">
              {t("app.bizNumber.verify.code", "Your code:")} <span className="font-mono text-lg font-bold tracking-widest">{code}</span>
            </p>
          )}
        </div>
      )}

      {s === "action_required" && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {number.alreadyTextEnabled
            ? t(
                "app.bizNumber.alreadyEnabled",
                "This number can already send and receive texts through another company — a texting app, your phone provider's business-texting add-on, or an old software tool. Twilio can only host texting for a number that isn't text-enabled anywhere else. Ask whoever provides that texting to remove it from the number, wait for them to confirm, then start again here. Your calls are not affected.",
              )
            : number.failureReason}
        </div>
      )}
      {number.failureReason && s !== "action_required" && <p className="text-sm text-muted-foreground">{number.failureReason}</p>}
      <ErrorLine error={error} />
      <button type="button" onClick={() => act("cancel")} disabled={busy} className={quietBtn}>
        {t("app.bizNumber.cancel", "Cancel this request")}
      </button>
    </Card>
  );
}

function Forwarding({ number, data, onSaved }) {
  const { t } = useTranslation();
  const [list, setList] = useState(number.forwardTo || []);
  const [custom, setCustom] = useState("");
  const [ring, setRing] = useState(number.ringSeconds || 20);
  const [fallback, setFallback] = useState(number.fallback || "receptionist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const toggle = (p) => setList((l) => (l.includes(p) ? l.filter((x) => x !== p) : l.length >= 3 ? l : [...l, p]));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const forwardTo = custom.trim() ? [...list, custom.trim()] : list;
      await fetchJson(API, { method: "POST", body: { action: "forwarding", forwardTo, ringSeconds: ring, fallback } });
      setSaved(true);
      setCustom("");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-foreground">{t("app.bizNumber.fwd.title", "Where calls ring")}</h2>
      <p className="text-sm text-muted-foreground">{t("app.bizNumber.fwd.body", "Up to three phones ring together; the first to answer gets the call. The caller's own number shows on your screen.")}</p>
      <div className="space-y-1">
        {data.memberPhones.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={list.includes(m.phone)} onChange={() => toggle(m.phone)} />
            {m.name || m.phone} <span className="text-muted-foreground">{m.phone}</span>
          </label>
        ))}
        {list.filter((p) => !data.memberPhones.some((m) => m.phone === p)).map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked onChange={() => toggle(p)} />
            {p}
          </label>
        ))}
      </div>
      <Field label={t("app.bizNumber.fwd.other", "Another phone (e.g. your cell's new number)")}>
        <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="tel" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("app.bizNumber.fwd.ring", "Ring for (seconds)")}>
          <input type="number" min={5} max={60} className={inputCls} value={ring} onChange={(e) => setRing(e.target.value)} />
        </Field>
        <Field label={t("app.bizNumber.fwd.noAnswer", "No answer")}>
          <select className={inputCls} value={fallback} onChange={(e) => setFallback(e.target.value)}>
            <option value="receptionist" disabled={!data.receptionist.available}>
              {data.receptionist.available
                ? t("app.bizNumber.fwd.receptionist", "AI receptionist answers")
                : t("app.bizNumber.fwd.receptionistOff", "AI receptionist (set it up under Settings → Phone first)")}
            </option>
            <option value="voicemail">{t("app.bizNumber.fwd.voicemail", "Voicemail")}</option>
          </select>
        </Field>
      </div>
      <ErrorLine error={error} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          {t("app.action.save", "Save")}
        </button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">{t("app.bizNumber.saved", "Saved")}</span>}
      </div>
    </Card>
  );
}

export default function BusinessNumberSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [choice, setChoice] = useState(null);

  const load = useCallback(() => {
    return fetchJson(API)
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const number = data?.number || null;
  const status = number?.status || null;

  async function check(e) {
    e.preventDefault();
    setChecking(true);
    setCheckError(null);
    setVerdict(null);
    setChoice(null);
    try {
      const r = await fetchJson(API, { method: "POST", body: { action: "check", number: input } });
      setVerdict(r.verdict || null);
      await load();
    } catch (err) {
      setCheckError(err.message);
      if (err.data?.verdict) setVerdict(err.data.verdict);
    } finally {
      setChecking(false);
    }
  }

  const paths = useMemo(() => {
    if (!number || status !== "draft") return [];
    if (number.lineType === "mobile" || number.lineType === "voip") return ["port"];
    if (number.lineType === "landline" || number.lineType === "toll_free") return ["hosted_sms"];
    return ["hosted_sms", "port"];
  }, [number, status]);
  const path = paths.length === 1 ? paths[0] : choice;

  if (!data && !loadError) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone size={22} /> {t("app.bizNumber.title", "Your business number")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.bizNumber.promise", "Keep the number clients know. Every call and text is saved on the lead or job.")}
        </p>
      </div>

      {loadError && <ErrorLine error={loadError} />}

      {data && !data.available.twilio && (
        <Card>
          <p className="text-sm text-muted-foreground">
            {t("app.bizNumber.notReady", "Bringing a number isn't switched on for your account yet. There's nothing for you to do — it'll open here when it's ready.")}
          </p>
        </Card>
      )}

      {data && (!number || ["draft", "failed", "cancelled"].includes(status)) && (
        <Card>
          <form onSubmit={check} className="space-y-3">
            <Field label={t("app.bizNumber.check.label", "The number your clients call")}>
              <div className="flex gap-2">
                <input className={inputCls} value={input} onChange={(e) => setInput(e.target.value)} placeholder="(613) 555-0142" inputMode="tel" />
                <button type="submit" disabled={checking || !input.trim() || !data.available.twilio} className={primaryBtn}>
                  {checking && <Loader2 size={14} className="animate-spin" />}
                  {t("app.bizNumber.check.button", "Check")}
                </button>
              </div>
            </Field>
            {number && status === "draft" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-foreground">{number.e164}</span>
                <span className="rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-medium">
                  {kindLabel(t, number.lineType)}
                  {number.carrierName ? ` · ${number.carrierName}` : ""}
                </span>
                {number.simulated && <span className="text-xs text-muted-foreground">{t("app.bizNumber.demo", "Demo — nothing sent to a carrier")}</span>}
              </div>
            )}
            {verdict && !verdict.ok && <p className="text-sm text-muted-foreground">{verdict.reason}</p>}
            {verdict?.ok && verdict.reasonKey === "voip_ports" && (
              <p className="text-sm text-muted-foreground">{t("app.bizNumber.voipPorts", "Twilio won't host texting on a VoIP line, so this number has to move to FieldQuo instead.")}</p>
            )}
            {(status === "failed" || status === "cancelled") && number?.failureReason && (
              <p className="text-sm text-muted-foreground">{t("app.bizNumber.lastAttempt", "Last attempt:")} {number.failureReason}</p>
            )}
            <ErrorLine error={checkError} />
          </form>
        </Card>
      )}

      {data && number && status === "draft" && paths.length > 1 && !choice && (
        <Card>
          <p className="text-sm text-foreground">{t("app.bizNumber.unknownKind", "We couldn't tell what kind of line this is. Which is it?")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietBtn} onClick={() => setChoice("port")}>{t("app.bizNumber.choose.cell", "It's a cell phone")}</button>
            <button type="button" className={quietBtn} onClick={() => setChoice("hosted_sms")}>{t("app.bizNumber.choose.landline", "It's a landline or toll-free")}</button>
          </div>
        </Card>
      )}

      {data && number && status === "draft" && path === "port" && (
        <Card>
          <PortForm number={number} data={data} onDone={load} />
        </Card>
      )}
      {data && number && status === "draft" && path === "hosted_sms" && (
        <Card>
          <HostedForm number={number} data={data} onDone={load} />
        </Card>
      )}

      {data && number && IN_FLIGHT.includes(status) && <Tracker number={number} onChanged={load} />}

      {data && number && status === "active" && (
        <Card>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Check size={16} className="text-emerald-700 dark:text-emerald-400" />
            {t("app.bizNumber.live", "{number} is live in FieldQuo since {date}.", { number: number.e164, date: number.activatedAt ? new Date(number.activatedAt).toLocaleDateString() : "" })}
          </div>
          {number.failureReason && <p className="text-sm text-muted-foreground">{number.failureReason}</p>}
          {data.usTexting && data.usTexting.registered === false && (
            <Warning>
              {t(
                "app.bizNumber.a2pWarning",
                "Texts from this number to US phones won't be delivered until it's registered with US carriers (A2P 10DLC). FieldQuo has to do that registration; this note goes away when it's done. Texts to Canadian phones are not affected.",
              )}
            </Warning>
          )}
          <Link href="/app/messages" className="text-sm underline text-foreground">{t("app.bizNumber.openInbox", "Open the inbox")}</Link>
        </Card>
      )}
      {data && number && status === "active" && number.path === "port" && <Forwarding number={number} data={data} onSaved={load} />}

      {data && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">{t("app.bizNumber.onceMoved", "Once it's moved")}</h2>
          <OnceMoved path={number?.path === "hosted_sms" && status !== "draft" ? "hosted_sms" : path || number?.path || "port"} receptionist={data.receptionist.available} />
        </Card>
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          {t("app.bizNumber.footnote", "Landline or toll-free? Texts move to FieldQuo and calls stay with your provider — from {amount} a month from your phone balance ({balance} now).", {
            amount: money(data.costs.hosted.totalCents),
            balance: money(data.balanceCents),
          })}{" "}
          <Link href="/app/settings/voice" className="underline">{t("app.bizNumber.topUp", "Top up")}</Link>
        </p>
      )}
    </div>
  );
}
