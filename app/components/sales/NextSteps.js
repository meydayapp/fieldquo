// app/components/sales/NextSteps.js
//
// What happens after the call went well: three distinct next steps, and the
// call-back that was already there.
//
// ══ Why three buttons and not one "schedule" ══════════════════════════════
//
// The owner, on the disposition form: a call that lands ends in one of three
// places and the form offered one. lib/sales/nextSteps.js says what they are;
// this file is the screen for them, on the call panel where the rep is when
// the contractor says yes:
//
//   Book a 30-minute demo      → the rep's own calendar (EventModal, type
//                                "demo"), then the invite email from the
//                                rep's mailbox with the .ics attached.
//   Sent to sign up            → the lead moves to the pipeline's waiting-
//                                to-sign state, and from here the rep chases
//                                the company's setup — the lead card shows
//                                "3 of 8 setup steps done" once linked.
//   Book a 1-hour walkthrough  → a specialist's calendar. Rendered ONLY when
//                                the server says the linked company has
//                                finished onboarding; before that the space
//                                says why, with the count, rather than
//                                offering a button that can only 409.
//
// ══ No lead yet? Make one, from the prospect, the way the queue does ══════
//
// A rep calling a claimed prospect has no SalesLead until they press "Work
// as a lead". Two of the three steps need one (the status, the invite), so
// the first press carries the prospect across through the same POST the
// queue's button uses — the server copies the name, the number and now the
// published email — and the lead id is kept here for the rest of the call.
"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, Check, GraduationCap, Loader2, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { NEXT_STEP_MINUTES, SIGNUP_SENT_STATUS } from "@/lib/sales/nextSteps";
import EventModal from "@/app/sales/calendar/EventModal";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

function tomorrowAt(hour) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export default function NextSteps({ prospectId = null, leadId: leadIdProp = null, businessName = "", phoneE164 = "" }) {
  const { t } = useTranslation();
  const [leadId, setLeadId] = useState(leadIdProp);
  const [lead, setLead] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null); // { tone: "ok" | "warn", text }
  const [modal, setModal] = useState(null); // "callback" | "demo"
  const [slots, setSlots] = useState(null); // { days, noHosts }
  const [slot, setSlot] = useState("");
  const [pickingWalkthrough, setPickingWalkthrough] = useState(false);

  useEffect(() => setLeadId(leadIdProp), [leadIdProp]);

  // The lead's link and its company's setup, for the walkthrough gate and the
  // "sent to sign up" state. Read from the lead route — the one place that
  // answers "how far has this company got" for a rep.
  const loadLead = useCallback(async () => {
    if (!leadId) {
      setLead(null);
      return;
    }
    try {
      setLead(await fetchJson(`/api/sales/leads/${encodeURIComponent(leadId)}`));
    } catch {
      setLead(null);
    }
  }, [leadId]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  /** The lead this call is about, made from the prospect if there is none yet. */
  async function ensureLead() {
    if (leadId) return leadId;
    if (!prospectId) throw new Error(t("app.salesCall.nextStepNeedsLead"));
    const body = await fetchJson("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId }),
    });
    if (!body?.lead?.id) throw new Error(t("app.salesCall.nextStepNeedsLead"));
    setLeadId(body.lead.id);
    return body.lead.id;
  }

  async function sendInvite(event) {
    if (!event?.id) return;
    try {
      const sent = await fetchJson(`/api/sales/events/${encodeURIComponent(event.id)}/invite`, { method: "POST" });
      setNotice({ tone: "ok", text: t("app.salesCall.inviteSent", { email: sent.sentTo }) });
    } catch (err) {
      // Booked, not invited — and said so. The event is on the calendar
      // either way; the rep texts the time if the mail could not go.
      setNotice({ tone: "warn", text: t("app.salesCall.inviteNotSent", { reason: err?.message || "" }) });
    }
  }

  async function openDemo() {
    setBusy("demo");
    setNotice(null);
    try {
      await ensureLead();
      setModal("demo");
    } catch (err) {
      setNotice({ tone: "warn", text: err?.message || "" });
    } finally {
      setBusy("");
    }
  }

  async function sentToSignup() {
    setBusy("signup");
    setNotice(null);
    try {
      const id = await ensureLead();
      await fetchJson(`/api/sales/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: SIGNUP_SENT_STATUS }),
      });
      await loadLead();
      setNotice({ tone: "ok", text: t("app.salesCall.signupSentDone") });
    } catch (err) {
      setNotice({ tone: "warn", text: err?.message || "" });
    } finally {
      setBusy("");
    }
  }

  async function openWalkthrough() {
    setBusy("walkthrough");
    setNotice(null);
    try {
      const got = await fetchJson("/api/sales/events?walkthroughSlots=1");
      setSlots(got);
      setSlot(got?.days?.[0]?.slots?.[0]?.iso || "");
      setPickingWalkthrough(true);
    } catch (err) {
      setNotice({ tone: "warn", text: err?.message || "" });
    } finally {
      setBusy("");
    }
  }

  async function bookWalkthrough() {
    if (!slot || !leadId) return;
    setBusy("walkthrough");
    setNotice(null);
    try {
      const saved = await fetchJson("/api/sales/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "walkthrough", startAt: slot, leadId, businessName: businessName || null, phone: phoneE164 || null }),
      });
      setPickingWalkthrough(false);
      setNotice({ tone: "ok", text: t("app.salesCall.walkthroughBooked", { specialist: saved?.specialist || "" }) });
      await sendInvite(saved?.event);
    } catch (err) {
      setNotice({ tone: "warn", text: err?.message || "" });
    } finally {
      setBusy("");
    }
  }

  const linked = lead?.linkedCompany || null;
  const gate = linked?.walkthrough || null;
  const progress = linked?.onboarding || null;
  const signupSent = lead?.lead?.status === SIGNUP_SENT_STATUS || lead?.lead?.status === "signed";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="next-steps">
      <p className="text-sm font-semibold text-foreground">{t("app.salesCall.nextStepHeading")}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy)} onClick={openDemo} data-testid="next-step-demo">
          {busy === "demo" ? <Loader2 className="animate-spin" size={16} /> : <CalendarClock size={16} />}
          {t("app.salesCall.bookDemo", { minutes: NEXT_STEP_MINUTES.demo })}
        </button>

        <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy) || signupSent} onClick={sentToSignup} data-testid="next-step-signup">
          {busy === "signup" ? <Loader2 className="animate-spin" size={16} /> : signupSent ? <Check size={16} /> : <Send size={16} />}
          {signupSent ? t("app.salesCall.signupSentAlready") : t("app.salesCall.sentToSignup")}
        </button>

        {/* The walkthrough, only when the server says the company is set up.
            Anything else prints the reason and the count — the honest panel
            AGENTS.md prefers to a dead button. */}
        {gate?.allowed ? (
          <button type="button" className={`${BTN} border border-border text-foreground sm:col-span-2`} disabled={Boolean(busy)} onClick={openWalkthrough} data-testid="next-step-walkthrough">
            {busy === "walkthrough" ? <Loader2 className="animate-spin" size={16} /> : <GraduationCap size={16} />}
            {t("app.salesCall.bookWalkthrough", { minutes: NEXT_STEP_MINUTES.walkthrough })}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground break-words sm:col-span-2">
            {progress
              ? t("app.salesCall.walkthroughAfterSetup", { done: progress.done, total: progress.total })
              : leadId
                ? t(gate?.reasonKey || "app.salesCall.walkthroughRefusal.not_linked")
                : t("app.salesCall.walkthroughRefusal.no_lead")}
          </p>
        )}

        <button type="button" className={`${BTN} border border-border text-foreground sm:col-span-2`} disabled={Boolean(busy)} onClick={() => setModal("callback")}>
          <CalendarPlus size={16} /> {t("app.salesCall.scheduleCallback")}
        </button>
      </div>

      {progress ? (
        <p className="text-xs text-muted-foreground break-words" data-testid="onboarding-progress">
          {progress.complete
            ? t("app.salesCall.onboardingComplete", { total: progress.total })
            : t("app.salesCall.onboardingProgress", { done: progress.done, total: progress.total })}
        </p>
      ) : null}

      {pickingWalkthrough ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">{t("app.salesCall.walkthroughPick")}</p>
          {slots?.noHosts || !slots?.days?.length ? (
            <p className="text-xs text-muted-foreground">{t("app.salesCall.walkthroughNoSlots")}</p>
          ) : (
            <select className={FIELD} value={slot} onChange={(e) => setSlot(e.target.value)} aria-label={t("app.salesCall.walkthroughPick")}>
              {slots.days.map((d) => (
                <optgroup key={d.day} label={d.day}>
                  {d.slots.map((s) => (
                    <option key={s.iso} value={s.iso}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button type="button" className={`${BTN} bg-primary text-primary-foreground flex-1`} disabled={Boolean(busy) || !slot} onClick={bookWalkthrough}>
              {busy === "walkthrough" ? <Loader2 className="animate-spin" size={16} /> : null}
              {t("app.salesCall.walkthroughConfirm")}
            </button>
            <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy)} onClick={() => setPickingWalkthrough(false)}>
              {t("app.salesCall.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className={`text-xs break-words ${notice.tone === "ok" ? "text-emerald-800 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"}`} data-testid="next-step-notice">
          {notice.text}
        </p>
      ) : null}

      {modal ? (
        <EventModal
          initial={{
            type: modal,
            leadId: leadId || "",
            businessName: businessName || null,
            phone: phoneE164 || null,
            // Tomorrow at ten, local — a default the rep will usually change.
            // A demo carries its own end, thirty minutes on; the server
            // fills it from the kind when the browser sends none.
            startAt: tomorrowAt(10),
          }}
          leads={[]}
          onClose={() => setModal(null)}
          onSaved={async (event) => {
            const kind = modal;
            setModal(null);
            if (kind === "demo") {
              setNotice({ tone: "ok", text: t("app.salesCall.demoBooked") });
              await sendInvite(event);
            }
          }}
        />
      ) : null}
    </div>
  );
}
