"use client";

// app/app/settings/voice/page.js
//
// The AI receptionist, set up by the contractor.
//
// ── Order of the page is the order of the decisions ────────────────────────
//
// Credit, then a number, then the words, then the switch.
//
// Credit moved to the front when the number's first month started being charged
// up front (lib/voice/spendGate.js). A number costs FieldQuo real money from the
// moment it exists, so it cannot be handed out before the company has paid — and
// a screen whose step 1 is permanently blocked by something in step 2 is a maze.
//
// The switch stays last and refuses to turn on without the first two: a toggle
// that flips to "on" and then doesn't answer is the worst kind of broken,
// because the company believes their calls are covered and finds out from a
// customer who rang and got nothing.
//
// ── Every price on this page is priced by the SERVER ───────────────────────
//
// `pricing.numberTypes[].afford` is computed in /api/settings/voice from the
// company's own balance. The browser posts a number TYPE and never an amount,
// and it never decides affordability for itself — so the button it disables and
// the gate the route enforces cannot drift apart.
//
// ── Forwarding leads ───────────────────────────────────────────────────────
//
// It's the right answer for almost every established contractor, and it's the
// one they won't pick unless it's first and explained. See lib/voice/numbers.js.

import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
// The SAME builder that writes the snapshot into the database when the box is
// ticked. Importable here only because it has no server imports at all —
// lib/voice/credits.js, where the thresholds live, reaches Prisma, so the
// threshold list and the daily cap travel on the settings GET instead. Same
// trap creditCurrency.js carries a warning about.
import { buildAutoTopupTerms } from "@/lib/voice/autoTopupConsent";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare, Sparkles, Mail, ArrowRight, Wrench,
  Headset, Phone, Loader2, Check, Plus, AlertTriangle, Copy, Info,
} from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { supportMailto } from "@/lib/supportContact";
import { usableNotes } from "@/lib/voice/knowledge";
// Pure data — no React, no database. lib/voice/readiness.js is NOT importable
// here: it pulls in Prisma and the provider client, which is the same trap that
// keeps greetingNamesAnotherBusiness on the server (lib/voice/prompt.js imports
// lib/voice/numbers.js, which imports the database). The answer to that one
// travels as a boolean on the settings GET instead.
import { DIAGNOSIS_TONE, DIAGNOSIS_TEXT, SIDE_TEXT, diagnosisKey, sideKey } from "@/lib/voice/diagnosisCopy";
// Same split, same reason: lib/voice/triggers.js reaches Prisma, so the gate's
// refusal codes and the scope table live in a file with no imports at all.
import {
  scopeLabelKey,
  scopeHintKey,
  SCOPE_LABEL_TEXT,
  SCOPE_HINT_TEXT,
  callbackReasonKey,
  CALLBACK_REASON_TEXT,
} from "@/lib/voice/quoteCallScope";
// Third file with the same split and the same reason. lib/voice/agentTuning.js
// imports NOTHING at all, so the four option lists and their English copy can be
// read here without dragging Prisma — then pg, then node's `dns` — into the
// browser bundle. The provider values these codes map to never come here: the
// browser posts "patient", never `interruption_sensitivity: 0.3`.
import {
  TUNING_FIELDS,
  tuningTitleKey,
  tuningLabelKey,
  tuningHintKey,
  TUNING_TITLE_TEXT,
  TUNING_LABEL_TEXT,
  TUNING_HINT_TEXT,
} from "@/lib/voice/agentTuning";
import {
  READINESS_LINKS,
  LINK_LABEL,
  REASON_TEXT,
  OWNER_TEXT,
  OVERALL_TEXT,
  linkLabelKey,
  ownerKey,
  overallKey,
} from "@/lib/voice/readinessCopy";

// ── Which dollars ─────────────────────────────────────────────────────────
//
// A bare `$` on a page whose every figure is collected in USD, shown to a
// company whose every other invoice is CAD. A contractor read "$30.00",
// pressed buy, and Stripe charged thirty US dollars — around forty Canadian
// ones. formatAppMoney exists for exactly this: it was written when
// "$2100.00" reached a client document having silently defaulted to CAD, and
// this page was not using it.
const money = (c) =>
  formatAppMoney(Number(c || 0) / 100, CREDIT_CURRENCY, "en");

// `id` is an anchor target, not decoration: /app/crew-inbox links to
// #credit so "where did my credit go" lands on the statement rather than at
// the top of a long settings page.
function Card({ title, hint, children, step, dataTour, id }) {
  return (
    <section id={id} data-tour={dataTour} className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-baseline gap-2">
        {step && (
          <span className="text-xs font-bold text-muted-foreground tabular-nums">{step}</span>
        )}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function VoiceSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // The four sound choices live in the SAME form object as the greeting and the
  // note, so one Save pushes all of them and one provisionAgent call carries
  // them to Retell. Splitting them into their own saving control would mean two
  // pushes for one visit to this screen, and two chances for half of it to land.
  const [form, setForm] = useState({
    greeting: "",
    instructions: "",
    transferTo: "",
    interruptions: "",
    background: "",
    pace: "",
    manner: "",
  });
  const [copied, setCopied] = useState(null);
  const [liveWarning, setLiveWarning] = useState(false);
  // What just happened, in a sentence. Sticky rather than a 2-second toast: the
  // thing it usually says is "now go and dial this on your phone".
  const [notice, setNotice] = useState(null);
  // The drafted knowledge gaps. Held here and NEVER written to the agent — the
  // owner edits it and presses Save, same as anything else they typed.
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftText, setDraftText] = useState("");
  // What the PROVIDER says about this number, not what our column says. See
  // lib/voice/diagnose.js — the old banner asserted both "it never activated"
  // and "you're being charged for it" without ever asking.
  const [diag, setDiag] = useState(null);
  const [diagBusy, setDiagBusy] = useState(false);

  // ── The end-to-end check ────────────────────────────────────────────────
  //
  // Never run on load, unlike the number diagnosis above. It is four provider
  // round-trips and it exists to answer a question the contractor asked by
  // pressing a button — running it on every page view would make an already
  // slow screen slower to tell most people something they did not ask about.
  const [chain, setChain] = useState(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainFixed, setChainFixed] = useState(false);

  // ── Automatic top-up ────────────────────────────────────────────────────
  //
  // The two choices are held here UNCOMMITTED until the box is ticked, because
  // changing either one changes the sentence the person is being asked to agree
  // to. A control that saved on change would let somebody read one set of terms
  // and have another set recorded.
  //
  // Both are null until chosen. Not $10 and not $30 — absence of a choice is
  // not a choice, and pre-selecting an amount on a form that authorises a card
  // charge is how "I never picked that" happens.
  const [autoThreshold, setAutoThreshold] = useState(null);
  const [autoAmount, setAutoAmount] = useState(null);
  const [autoAccepted, setAutoAccepted] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  // Whether the failure was the ATTACH rather than the wording push. Different
  // problems: one leaves an old greeting live, the other leaves the phone
  // answering after somebody switched it off, and only the second costs money.
  const [attachWarning, setAttachWarning] = useState(false);

  /**
   * A failed request whose message the API sent as a KEY.
   *
   * The voice routes build their refusals server-side, where there is no t(),
   * so the useful ones travel as `errorKey` + `errorParams` with the English
   * attached. Anything without a key falls through to the normal reporter.
   */
  const reportVoiceError = useCallback(
    async (res, fallback) => {
      const data = await res.clone().json().catch(() => ({}));
      if (data?.errorKey) {
        showError(t(data.errorKey, data.error || fallback, data.errorParams || {}));
        return;
      }
      await reportResponseError(res, fallback);
    },
    [t],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/voice");
    if (!res.ok) {
      await reportResponseError(res, t("app.setVoice.loadError", "Couldn't load the receptionist settings."));
      return null;
    }
    const d = await res.json();
    setData(d);
    setForm({
      greeting: d.agent?.greeting || "",
      instructions: d.agent?.instructions || "",
      transferTo: d.agent?.transferTo || "",
      // `d.tuning.values` is never null and never partial — the server
      // normalises it, so a company with no VoiceAgent row at all still gets
      // the four defaults rather than four unselected pickers. `|| ""` is not
      // enough here: an empty string would render a card with nothing chosen,
      // which is a lie about what the phone is doing.
      ...(d.tuning?.values || {}),
    });
    return d;
  }, []);

  /**
   * Ask the provider what is actually true about this number.
   *
   * A read, and it costs one provider round-trip on a screen a contractor opens
   * rarely — cheap against the alternative, which was a page asserting a state
   * nobody had checked. Never run for a port in flight: "still moving" is not a
   * fault and the card above already says when it is expected.
   */
  const runDiagnosis = useCallback(async () => {
    setDiagBusy(true);
    try {
      const res = await fetch("/api/settings/voice/number/repair");
      if (!res.ok) {
        // Deliberately silent. This is a background read the contractor did not
        // ask for; a toast about a diagnosis failing would be noise on top of
        // whatever they came here to do. The banner simply doesn't appear.
        setDiag(null);
        return;
      }
      setDiag(await res.json());
    } catch {
      setDiag(null);
    } finally {
      setDiagBusy(false);
    }
  }, []);

  /** Apply the one repair the diagnosis licenses, then re-render from its answer. */
  async function repairNumber() {
    setDiagBusy(true);
    try {
      const res = await fetch("/api/settings/voice/number/repair", { method: "POST" });
      // Both the 200 and the 409/502 bodies are a diagnosis, so both are worth
      // rendering. A Fix button that failed and said nothing would be the dead
      // control this whole banner exists to remove.
      const result = await res.json().catch(() => null);
      if (result?.verdict) setDiag(result);
      else await reportVoiceError(res, t("app.setVoice.diag.error", "Couldn't check that number just now."));
      // The row may have changed status or been released, so the rest of the
      // page has to be reloaded rather than left showing the old state.
      await load();
    } catch (err) {
      showError(t("app.setVoice.diag.error", "Couldn't check that number just now.") + (err?.message ? ` (${err.message})` : ""));
    } finally {
      setDiagBusy(false);
    }
  }

  /** Ask the provider about every link in the chain. */
  const runReadiness = useCallback(async () => {
    setChainBusy(true);
    setChainFixed(false);
    try {
      const res = await fetch("/api/settings/voice/readiness");
      if (!res.ok) {
        // Said out loud, unlike the background diagnosis: the contractor
        // pressed a button, so a button that does nothing is the dead control
        // this whole panel exists to remove.
        await reportVoiceError(res, t("app.setVoice.chain.error", "Couldn't run the check just now."));
        return;
      }
      setChain(await res.json());
    } catch (err) {
      showError(
        t("app.setVoice.chain.error", "Couldn't run the check just now.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setChainBusy(false);
    }
  }, [reportVoiceError, t]);

  /**
   * Push our settings to the provider again, then re-read the chain from it.
   *
   * The repair for a webhook URL, a drifted prompt and a failed binding all at
   * once — it is the same provisioning run a save does, and it honours the
   * on/off switch, so it can never turn a contractor's phone on. The route
   * refuses outright from a preview address, because "fixing" from there would
   * repoint a live phone at a deployment that gets deleted.
   */
  async function resyncAgent() {
    setChainBusy(true);
    try {
      const res = await fetch("/api/settings/voice/number/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fix: "resync" }),
      });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.readiness) {
        setChain(result.readiness);
        setChainFixed(true);
      } else {
        await reportVoiceError(res, t("app.setVoice.chain.error", "Couldn't run the check just now."));
        // Re-read anyway. A failed push still changes what the provider holds
        // often enough that showing the OLD chain would be a second lie on top
        // of the first.
        await runReadiness();
      }
      await load();
    } catch (err) {
      showError(
        t("app.setVoice.chain.error", "Couldn't run the check just now.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setChainBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topup = params.get("topup");

    (async () => {
      // Confirm a top-up against STRIPE before showing a balance — the success
      // URL is just a URL, and anyone can visit it.
      //
      // ── And SAY what happened ─────────────────────────────────────────────
      //
      // This used to be a bare `.catch(() => {})`. The balance shown was always
      // the server's, so the screen never claimed credit that wasn't there — but
      // a confirm that failed said nothing at all, and somebody who had just
      // been charged came back to a balance that hadn't moved and no
      // explanation. Silence after taking money reads as "it didn't work", and
      // the next thing that happens is a second top-up or a support email.
      //
      // Now that checkout.session.completed settles the same payment, an
      // unconfirmed top-up genuinely does land on its own, so the honest message
      // is "give it a moment" rather than an error.
      if (topup) {
        let confirmed = null;
        try {
          const res = await fetch(
            `/api/settings/voice/topup?session_id=${encodeURIComponent(topup)}`,
          );
          confirmed = res.ok ? await res.json().catch(() => null) : null;
        } catch {
          confirmed = null;
        }
        window.history.replaceState({}, "", window.location.pathname);
        setNotice(
          confirmed?.credited
            ? {
                tone: "ok",
                text: t(
                  "app.setVoice.topupCredited",
                  "Payment received — {amount} of phone credit added.",
                  { amount: money(confirmed.cents) },
                ),
              }
            : {
                tone: "info",
                text: t(
                  "app.setVoice.topupPending",
                  "We couldn't confirm that payment just yet. Nothing is lost — if it went through, the credit lands on its own within a minute or two. Refresh to check.",
                ),
              },
        );
      }

      // ── Back from saving a card for automatic top-ups ────────────────────
      //
      // Same shape as the top-up confirm above and for the same reason: the
      // success URL is just a URL, so the card is only recorded after the
      // server has asked Stripe whether that setup session really completed and
      // whether it belongs to this company.
      //
      // A failure here is genuinely recoverable without anybody doing anything
      // — checkout.session.completed settles the identical session — so the
      // message says "give it a moment" rather than presenting it as an error.
      // What it must never do is claim the card is saved when it isn't: the
      // whole value of this feature is a contractor trusting their phone cannot
      // run out.
      const autoSetup = params.get("autotopup");
      if (autoSetup) {
        let armed = null;
        try {
          const res = await fetch(
            `/api/settings/voice/auto-topup?session_id=${encodeURIComponent(autoSetup)}`,
          );
          armed = res.ok ? await res.json().catch(() => null) : null;
        } catch {
          armed = null;
        }
        window.history.replaceState({}, "", window.location.pathname);
        setNotice(
          armed?.ok
            ? {
                tone: "ok",
                text: t(
                  "app.setVoice.auto.armed",
                  "Automatic top-up is on. We'll charge the card on file when your balance runs low.",
                ),
              }
            : {
                tone: "info",
                text: t(
                  "app.setVoice.auto.pending",
                  "We couldn't confirm that card just yet. Nothing has been charged. If it saved, automatic top-up switches itself on within a minute or two — refresh to check.",
                ),
              },
        );
      }

      const d = await load();
      setLoading(false);
      // After the page has something to show, not before — the diagnosis is a
      // provider round-trip and must never hold up the first paint.
      if (d?.number && d.number.status !== "porting") runDiagnosis();
    })();
  }, [load, runDiagnosis, t]);

  async function save(patch) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.saveError", "Couldn't save."));
        return false;
      }
      const d = await res.json().catch(() => ({}));
      // Saved locally but not pushed to the phone is its own state, and it has
      // to be visible. "Saved" over a greeting the caller will never hear is
      // the kind of quiet lie that costs a company a week of wrong calls.
      setLiveWarning(d.live === false && d.liveError !== "not_configured");
      // A failed ATTACH is not a failed greeting push, and it must not be
      // reported as one. "The wording didn't reach the phone" is a cosmetic
      // problem; "we couldn't stop it answering" is a phone that is still
      // taking calls and still spending credit after somebody switched it off.
      setAttachWarning(Boolean(d.attachmentFailed));
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } finally {
      setBusy(false);
    }
  }

  // ── Setting up a number has to SAY something ────────────────────────────
  //
  // This used to be `await load()` and nothing else. On success the page simply
  // re-rendered, and while the number was invisible to the API (it was written
  // with a status nothing read — see the route) the re-render was identical to
  // what was already on screen. A contractor typed his number, pressed Set it
  // up, watched nothing happen, and pressed it again — buying a second live
  // number, which is what the duplicate activity entries were.
  //
  // The underlying bug is fixed, but silence on success was a defect on its own
  // merits: it is indistinguishable from a broken button. So the outcome is now
  // stated, in the words of what actually happened, and it does not time out —
  // the forwarding codes below it are something to act on, not a flash message.
  async function getNumber(source, numberType, extra = {}) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/voice/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, numberType, ...extra }),
      });
      if (!res.ok) {
        await reportVoiceError(res, t("app.setVoice.numberError", "Couldn't set up a number."));
        return;
      }
      const result = await res.json().catch(() => ({}));
      await load();
      setNotice(
        result.source === "ported"
          ? {
              tone: "info",
              text: `We've recorded your request to move ${result.e164}. This one is not automatic — somebody here has to action it with your current provider, and we'll be in touch. Your existing number keeps working the whole time, and you can cancel below.`,
            }
          : result.source === "forwarded"
            ? {
                tone: "ok",
                text: `Done — your number is ${result.publicNumber || result.e164} and it now forwards to ${result.e164}. The last step is on your own phone: dial one of the codes below from it, or nothing will reach the receptionist.`,
              }
            : // ── What they GOT, and whether it is what they picked ────────
              //
              // The number is read off the provider's response, never off the
              // request — a contractor who asked for 819 and silently received
              // 437 prints the wrong one on a van, which is the whole reason
              // this flow exists.
              //
              // `requestedE164` is set by the route only when the two genuinely
              // differ, and it should never be set: naming a number asks for
              // exactly that number. If it ever is, the swap is stated in the
              // same breath as the success rather than buried in a log, because
              // this is the one moment the contractor is looking at the number
              // and could still act on it.
              result.requestedE164
                ? {
                    tone: "warn",
                    text: t("app.setVoice.pick.substituted", "You picked {asked}, but the phone company gave us {got} instead. {got} is your number — use that one, not the one you picked.", { asked: result.requestedE164, got: result.e164 }),
                  }
                : {
                    tone: "ok",
                    text: t("app.setVoice.pick.bought", "Done — your new number is {number}.", { number: result.e164 }),
                  },
      );
    } catch (err) {
      // A thrown fetch (offline, DNS, a killed request) never reached the
      // res.ok branch above, so without this the button was silent on exactly
      // the failure a contractor in a driveway is most likely to hit.
      showError(
        t("app.setVoice.numberNetworkError", "Couldn't reach FieldQuo — check your signal and try again.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Give a bought number back — the one irreversible thing on this page.
   *
   * The provider DELETEs it, the number returns to the carrier's pool, and
   * anything printed on a van stops ringing. So the route wants the E.164 typed
   * back, and a second acknowledgement when it is the company's last working
   * line. Nothing here decides any of that: the refusals come from the route, so
   * a UI that lost track of which row it was showing gets a refusal rather than
   * destroying the wrong number.
   */
  async function releaseNumberNow({ confirm, acknowledgeSoleNumber }) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/voice/number/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, acknowledgeSoleNumber }),
      });
      if (!res.ok) {
        const refusal = await res.clone().json().catch(() => ({}));
        // ── The sole-number refusal is a STEP, not an error ─────────────────
        //
        // The page cannot know whether this is their last working line — the
        // settings GET returns one row, so from here every number looks like
        // the only one. The route counts them and refuses; the component then
        // shows the second acknowledgement. Ticking a box that says "this may
        // be my only line" before anyone has checked would be the page
        // asserting something it has not been told.
        if (refusal?.reason === "sole_number") {
          return { ok: false, soleNumber: true };
        }
        await reportVoiceError(res, t("app.setVoice.release.failed", "We couldn't release that number just now. Nothing has changed."));
        // Reloaded even on a refusal: the row may have moved for some other
        // reason, and leaving the screen on a stale number is how somebody
        // types the wrong one into the next confirmation.
        await load();
        return { ok: false };
      }
      const result = await res.json().catch(() => ({}));
      await load();
      setNotice({
        tone: "ok",
        text: result.alreadyGone
          ? t("app.setVoice.release.doneGhost", "That number never existed at the phone provider, so there was nothing to give back — we've cleared it off your account and you can set one up again.")
          : t("app.setVoice.release.done", "{number} has been released. It's gone for good and the monthly rental has stopped.", { number: confirm }),
      });
      return { ok: true };
    } catch (err) {
      showError(
        t("app.setVoice.release.failed", "We couldn't release that number just now. Nothing has changed.") +
          (err?.message ? ` (${err.message})` : ""),
      );
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  /** Withdraw a port request nobody has actioned yet. Costs nothing, undoes cleanly. */
  async function cancelPort() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/voice/number", { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.cancelPortError", "Couldn't cancel that."));
        return;
      }
      await load();
      setNotice({ tone: "ok", text: "That port request is cancelled. You can pick a different option now." });
    } catch (err) {
      showError(err?.message || "Couldn't cancel that.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Work out what the receptionist still doesn't know.
   *
   * Writes nothing. The answer comes back as questions, the owner answers the
   * ones worth answering, and the existing Save is still the only thing that
   * reaches the phone.
   */
  async function draftKnowledgeGaps() {
    setDrafting(true);
    try {
      const res = await fetch("/api/settings/voice/knowledge", { method: "POST" });
      if (!res.ok) {
        await reportVoiceError(
          res,
          t("app.setVoice.kb.error", "Couldn't work out what's missing just now."),
        );
        return;
      }
      const d = await res.json();
      setDraft(d);
      setDraftText(d.note || "");
    } catch (err) {
      showError(
        t("app.setVoice.kb.error", "Couldn't work out what's missing just now.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setDrafting(false);
    }
  }

  /** Move the draft into the box the owner edits. Still unsaved. */
  function acceptDraft() {
    const addition = draftText.trim();
    if (addition) {
      setForm((f) => ({
        ...f,
        instructions: [f.instructions.trim(), addition].filter(Boolean).join("\n\n"),
      }));
    }
    setDraft(null);
    setDraftText("");
  }

  async function topUp(cents) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/voice/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cents }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.paymentError", "Couldn't start the payment."));
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Agree to automatic top-ups, then go and save a card.
   *
   * The amounts are NOT posted as money. The two ids the server accepts come
   * from closed lists it holds itself, and it rejects anything else outright —
   * so the figure in the terms and the figure that gets charged are the same
   * figure, decided in one place.
   */
  async function startAutoTopup() {
    setAutoBusy(true);
    try {
      const res = await fetch("/api/settings/voice/auto-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholdCents: autoThreshold,
          amountCents: autoAmount,
          acceptTerms: autoAccepted,
        }),
      });
      if (!res.ok) {
        await reportVoiceError(
          res,
          t("app.setVoice.auto.error", "Couldn't set up automatic top-ups."),
        );
        return;
      }
      const result = await res.json().catch(() => ({}));
      // A card already on file needs no second trip through Stripe — the server
      // says so, and the honest thing is to say what happened rather than
      // bouncing them somewhere and back.
      if (result.setupUrl) {
        window.location.href = result.setupUrl;
        return;
      }
      setAutoOpen(false);
      setAutoAccepted(false);
      setNotice({
        tone: "ok",
        text: t(
          "app.setVoice.auto.armed",
          "Automatic top-up is on. We'll charge the card on file when your balance runs low.",
        ),
      });
      await load();
    } finally {
      setAutoBusy(false);
    }
  }

  /** The plain on/off, for a company that already has a card saved. */
  async function setAutoTopupEnabled(enabled) {
    setAutoBusy(true);
    try {
      const res = await fetch("/api/settings/voice/auto-topup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        await reportVoiceError(
          res,
          t("app.setVoice.auto.error", "Couldn't set up automatic top-ups."),
        );
        return;
      }
      await load();
    } finally {
      setAutoBusy(false);
    }
  }

  /** Forget the card entirely — the row AND the payment method at Stripe. */
  async function removeAutoTopupCard() {
    setAutoBusy(true);
    try {
      const res = await fetch("/api/settings/voice/auto-topup", { method: "DELETE" });
      if (!res.ok) {
        await reportVoiceError(
          res,
          t("app.setVoice.auto.error", "Couldn't set up automatic top-ups."),
        );
        return;
      }
      setAutoOpen(false);
      setAutoAccepted(false);
      await load();
    } finally {
      setAutoBusy(false);
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (loading) {
    return (
      <div className="max-w-3xl p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 text-sm text-muted-foreground">
        {t("app.setVoice.loadFailed", "This page couldn't be loaded.")}
      </div>
    );
  }

  const { agent, number, credit, pricing, sources, configured, readiness, numberChoice } = data;
  // The route builds this sentence where there is no t(), so it travels as a
  // key plus its values with the English attached as the fallback.
  // Bracketed lines the phone will skip. Computed with the SAME function
  // buildAgentPrompt uses, so the count shown here and the lines actually
  // withheld cannot drift apart.
  const unanswered = usableNotes(form.instructions).withheld;
  const readyMessage = readiness?.messageKey
    ? t(readiness.messageKey, readiness.message || "", readiness.params || {})
    : readiness?.message || null;
  // The server's verdict, not a second opinion. It is computed from the same
  // checkSpend() the PUT gate enforces, so the button this page disables and the
  // request the route would refuse cannot disagree — and `readiness.message` is
  // the reason, which is the half that was missing entirely.
  const canEnable = Boolean(readiness?.ready);

  // The 30 free trial minutes are a real balance granted with the first number
  // (see lib/voice/credits.js — grantFreeTrial). When that grant is still
  // visibly present and nothing has been bought, say so: it's a live balance the
  // receptionist works on, not a prompt to pay.
  //
  // The note regex is the fallback for grants written before the entry had its
  // own kind. New rows are kind "trial" and don't depend on wording that a
  // translation or an edit could change underneath this check.
  const freeOnly =
    credit.cents > 0 &&
    credit.entries.some(
      (e) => e.kind === "trial" || (e.kind === "adjustment" && /free/i.test(e.note || "")),
    ) &&
    !credit.entries.some((e) => e.kind === "topup");

  // Priced and decided server-side; the page only renders the verdict.
  const affordFor = (key) =>
    pricing.numberTypes.find((t) => t.key === key)?.afford || { allowed: false, shortfallCents: 0 };
  // Forwarding still BUYS a number to forward to, so it costs the same as a
  // local one. Showing it as free would be the dead control in reverse: a button
  // that looks free and returns a payment error.
  const forwardAfford = affordFor("local");
  const rent = number?.rent || null;
  const showDate = (d) => (d ? new Date(d).toLocaleDateString() : "");
  // Decided by the server (greetingNamesAnotherBusiness), because the function
  // lives in lib/voice/prompt.js and that file reaches the database through
  // lib/voice/numbers.js. Shown only while the field still holds what was
  // saved — once they start editing it, the answer on screen would be stale and
  // a warning about text you have already changed is worse than none.
  const greetingWrongName =
    Boolean(agent?.greetingNamesOther) && form.greeting === (agent?.greeting || "");

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Headset size={20} className="text-muted-foreground" />
          {t("app.setVoice.title", "Phone receptionist")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setVoice.subtitle", "Answers the calls you can't, takes the details, and books visits against your real availability. It never quotes a price.")}
        </p>
      </div>

      {/* Honest about the deployment rather than failing mysteriously when
          someone presses a button. */}
      {!configured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
          <Info size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {t("app.setVoice.notConfigured", "The phone service isn't connected on this deployment yet, so numbers can't be set up. Everything else on this page works.")}
          </p>
        </div>
      )}

      {/* What the last action actually did. Stays until the next one — the
          forwarding instruction it usually carries is a task, not a flash. */}
      {/* Three tones, not two. `warn` was added for the one outcome that is
          neither a success nor a note: the purchase went through and the
          provider handed over a DIFFERENT number than the one that was picked.
          Falling through to the neutral "info" styling would have dressed "your
          number is not the one you chose" as a pleasantry, on the one screen
          where the contractor is looking straight at the number and could still
          act on it. */}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 flex gap-3 ${
            notice.tone === "ok"
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
              : notice.tone === "warn"
                ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
                : "border-border bg-muted"
          }`}
        >
          {notice.tone === "ok" ? (
            <Check size={17} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : notice.tone === "warn" ? (
            <AlertTriangle size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info size={17} className="text-muted-foreground shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              notice.tone === "ok"
                ? "text-emerald-900 dark:text-emerald-200"
                : notice.tone === "warn"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-foreground"
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}

      {/* ── 1. Credit ───────────────────────────────────────────────────────
          First, because a number's first month comes out of this balance
          before the number is bought. */}
      <Card
        id="credit"
        dataTour="voice-credit"
        step="1."
        title={t("app.setVoice.creditTitle", "Credit")}
        hint={t("app.setVoice.creditHint", "{cents}¢ a minute, rounded up, one minute minimum. Your number's monthly rental comes out of this same credit.", { cents: credit.centsPerMinute })}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* "Balance" and not just a bare number: it sits right above the
              purchase buttons, and a lone "$10.50" there reads as a price. */}
          <span className="text-sm font-medium text-muted-foreground">Balance:</span>
          <span className="text-2xl font-bold text-foreground">{money(credit.cents)}</span>
          <span className="text-sm text-muted-foreground">
            ({t("app.setVoice.about", "about")} {credit.minutes} {t("app.setVoice.minute", "minute")}{credit.minutes === 1 ? "" : "s"})
          </span>
          {credit.low && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} /> {t("app.setVoice.runningLow", "running low")}
            </span>
          )}
        </div>

        {/* ── The cut-off, said out loud ──────────────────────────────────
            The agent now hangs up when a call reaches what the balance covers
            (lib/voice/callCeiling.js — enforced at Retell, not here). That is
            the right behaviour and it is invisible until it happens to a real
            homeowner mid-sentence, at which point the contractor has no idea
            why. A limit nobody was told about is the same as a hidden fee. */}
        {credit.minutes > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {t(
              "app.setVoice.callCap",
              "A call can only run as long as your credit covers — right now about {minutes} minutes. It ends there rather than running up a balance you didn't agree to. Top up and the limit lifts straight away.",
              { minutes: credit.minutes },
            )}
          </p>
        )}

        {freeOnly && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Free trial minutes included — the receptionist can start answering on this now, no top-up needed.
          </p>
        )}

        {/* Retitled so the buttons below read as "buy more", not the balance
            above. They are Stripe purchases; the two were easy to conflate. */}
        <p className="text-sm font-medium text-foreground mt-4">Add credit</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pricing.topups.map((topup) => (
            <button
              key={topup.cents}
              type="button"
              disabled={busy}
              onClick={() => topUp(topup.cents)}
              className={`px-4 py-2 rounded-full border text-sm disabled:opacity-50 ${
                topup.popular
                  ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {topup.label}
              <span className="opacity-70">
                {" "}
                · {Math.floor(topup.cents / credit.centsPerMinute)} min
              </span>
            </button>
          ))}
        </div>

        {/* ── The other thing this balance pays for ────────────────────────
            Crew texts draw on the same pooled credit and land in the same
            ledger, and the card's own hint only ever mentioned minutes and the
            number's rental. So a contractor looking at "where did my credit go"
            met a column of "Crew photo received" lines against a price stated
            nowhere on this page — he had to be told to open a panel on another
            screen to find the rate he was already being charged. It belongs
            where the money is, and it is read from the same constants the
            webhook debits with. */}
        {credit.crew && (
          <p className="text-sm text-muted-foreground mt-3">
            {t(
              "app.setVoice.crewRate",
              "Crew texting comes out of this same credit: {sms}¢ per text (each {chars} characters) and {mms}¢ per photo.",
              {
                sms: credit.crew.smsCents,
                mms: credit.crew.mmsCents,
                chars: credit.crew.smsSegmentChars,
              },
            )}
          </p>
        )}

        {/* ── Automatic top-up ─────────────────────────────────────────────
            Directly under the buy buttons, because it is the same decision
            made once instead of every time. Rendered only when the deployment
            actually has a payment provider — a card form that cannot save a
            card is the dead control this file's header is about. */}
        {configured && data.autoTopup && (
          <AutoTopupPanel
            t={t}
            money={money}
            currency={CREDIT_CURRENCY}
            info={data.autoTopup}
            centsPerMinute={credit.centsPerMinute}
            topups={pricing.topups}
            companyName={data.companyName}
            open={autoOpen}
            setOpen={setAutoOpen}
            threshold={autoThreshold}
            setThreshold={setAutoThreshold}
            amount={autoAmount}
            setAmount={setAutoAmount}
            accepted={autoAccepted}
            setAccepted={setAutoAccepted}
            busy={autoBusy}
            onStart={startAutoTopup}
            onToggle={setAutoTopupEnabled}
            onRemoveCard={removeAutoTopupCard}
          />
        )}

        {credit.entries.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              {t("app.setVoice.creditLog", "Where the credit went")}
            </summary>
            <ul className="mt-2 space-y-1">
              {credit.entries.map((e, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {e.note || e.kind}
                    <span className="opacity-60">
                      {" "}
                      {new Date(e.at).toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={
                      e.cents >= 0
                        ? "text-emerald-600 dark:text-emerald-400 tabular-nums"
                        : "text-foreground tabular-nums"
                    }
                  >
                    {e.cents >= 0 ? "+" : "−"}
                    {money(Math.abs(e.cents))}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* ── 2. A number ─────────────────────────────────────────────────── */}
      <Card
        dataTour="voice-number"
        step="2."
        title={t("app.setVoice.numberTitle", "Your number")}
        hint={t("app.setVoice.numberHint", "What the receptionist answers on.")}
      >
        {number ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Phone size={17} className="text-muted-foreground" />
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {number.display}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {number.source === "forwarded"
                  ? t("app.setVoice.badgeForwarded", "your number, forwarded")
                  : number.numberType === "toll_free"
                    ? t("app.setVoice.badgeTollFree", "toll-free")
                    : t("app.setVoice.badgeLocal", "local")}
              </span>
              {number.monthlyCents > 0 && (
                <span className="text-xs text-muted-foreground">
                  {money(number.monthlyCents)}{t("app.setVoice.perMonth", "/month")}
                </span>
              )}
            </div>

            {/* ── The number they are actually paying for ──────────────────
                A forwarded setup has TWO numbers: the one on the van, which
                they keep and which is printed above, and a receptionist line
                we buy for their calls to land on. Only the first was ever
                shown, with "$4.00/month" beside it — so the card read as a
                monthly charge for a number they already owned, and the owner
                reasonably asked why forwarding needed to cost anything.

                It also made the setup impossible to finish. Forwarding is a
                code dialled on their own handset that names a DESTINATION,
                and the destination was on screen exactly once, in a toast
                that disappeared. Printed here it is answerable at any time,
                including from a phone in a driveway. */}
            {number.source === "forwarded" && (number.forwardsToDisplay || number.e164) && (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("app.setVoice.forwardsToLabel", "Forwards to")}
                </p>
                <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">
                  {number.forwardsToDisplay || number.e164}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    "app.setVoice.forwardsToNote",
                    "The receptionist's own line — this is what the monthly rental pays for, and what your forwarding code has to point at. Your clients never dial it; keep giving out the number above.",
                  )}
                </p>
              </div>
            )}

            {/* ── A number that isn't answering yet, and why ─────────────────
                Porting especially. The row exists, so the card renders, and
                without this it looked identical to a working number — a
                contractor would advertise it and wonder why nothing rang.
                Nothing here is automatic and it says so, because it isn't:
                a port is actioned by a person, and it has no queue yet. */}
            {number.status === "porting" && (
              <div className="rounded-lg border border-border bg-muted px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Requested — not moved yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Moving a number is not something a button can finish. Your old provider needs
                  paperwork and account details from you, and it takes two to four weeks on their
                  schedule. Somebody here has to action it with them, and we&apos;ll contact you
                  about what they need.
                  {number.portExpectedAt
                    ? ` Best estimate: ${showDate(number.portExpectedAt)}.`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Until it lands, this number is still with your old provider and works exactly as
                  it always did. The receptionist cannot answer on it.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelPort}
                  className="mt-1 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel this request
                </button>
                <p className="text-xs text-muted-foreground">
                  Cancelling costs nothing and frees you to forward or buy instead — which is what
                  most people should do anyway.
                </p>
              </div>
            )}

            {/* ── What is actually wrong, asked of the provider ──────────────
                This used to be one fixed sentence — "set up but never finished
                activating... already yours and already being charged for" —
                and both halves were asserted without ever asking Retell. They
                are not always true together: a `ghost` number does not exist at
                the provider and nobody is renting it, so that copy left a
                contractor with no phone and an imaginary bill.

                Now it branches on the verdict from lib/voice/diagnose.js, says
                whose end the fault is on, and offers a Fix only where the
                diagnosis licenses one. */}
            <NumberDiagnosis
              diag={diag}
              busy={diagBusy}
              t={t}
              display={number.display}
              onRepair={repairNumber}
              onRecheck={runDiagnosis}
            />

            {/* ── The rental, said out loud ───────────────────────────────────
                It comes out of the same balance the calls do, on a date, and it
                can take the number away. A charge that only appears in a
                statement after the fact is the kind of surprise this whole
                prepaid model exists to avoid. */}
            {rent && (
              rent.pastDue ? (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
                  <AlertTriangle size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">
                      {t("app.setVoice.rentPastDueTitle", "This number's rental hasn't been paid")}
                    </p>
                    <p className="mt-0.5">
                      {rent.graceUntil
                        ? t("app.setVoice.rentPastDueDated", "It keeps working until {date}. After that the number is released and you lose it — add credit to keep it.", { date: showDate(rent.graceUntil) })
                        : t("app.setVoice.rentPastDueNow", "The {amount} rental is due now and your balance won't cover it. Add credit to keep the number — we'll email you before anything is released.", { amount: money(rent.monthlyCents) })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {rent.dueAt
                    ? t("app.setVoice.rentNext", "Next rental {amount} on {date}, taken from the credit above.", { amount: money(rent.monthlyCents), date: showDate(rent.dueAt) })
                    : t("app.setVoice.rentSoon", "The {amount} monthly rental starts coming out of the credit above once this number is live.", { amount: money(rent.monthlyCents) })}
                  {!rent.coversNext && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {" "}
                      {t("app.setVoice.rentWontCover", "Your balance won't cover it — top up before then.")}
                    </span>
                  )}
                </p>
              )
            )}

            {/* Only for a forwarded setup, and only the codes for THEIR
                number — see the API. */}
            {/* ── Shown for any held number, not only an `active` one ────────
                This was gated on `status === "active"`, and the owner's row sat
                on `provisioning` for weeks — so the one screen that tells a
                forwarded contractor which code to dial showed him nothing at
                all, on a setup whose entire remaining step was dialling a code.
                A stale column of ours is not a reason to withhold an
                instruction that is correct either way. The codes are harmless
                before the receptionist is live; the line underneath says so. */}
            {number.forwarding && number.status !== "porting" && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-foreground font-medium">
                  {t("app.setVoice.dialTitle", "Dial one of these from the phone you want forwarded")}
                </p>
                {number.status !== "active" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {t("app.setVoice.dialNotLiveYet", "You can set these now, but nothing will be answered until the receptionist is switched on below.")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  {t("app.setVoice.dialHint", "Most people want the first one. Your phone rings as usual, and only the calls you miss reach the receptionist.")}
                </p>
                <div className="space-y-2">
                  {number.forwarding.map((f) => (
                    <div key={f.code} className="flex flex-wrap items-center gap-2">
                      <code className="px-2 py-1 rounded bg-background border border-border text-sm tabular-nums">
                        {f.code}
                      </code>
                      <span className="text-xs text-muted-foreground flex-1 min-w-[10rem]">
                        {f.when}
                        {f.note ? ` — ${f.note}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(f.code, f.code)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t("app.setVoice.copyCode", "Copy {code}", { code: f.code })}
                      >
                        {copied === f.code ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("app.setVoice.carriersNote", "These work on most carriers. If yours doesn't take them, their support can set it up in a minute.")}
                </p>
                {/* The common failure: an ignored call lands in the carrier's
                    OWN voicemail instead of the receptionist. The carrier's
                    no-answer voicemail can fire before the conditional forward,
                    and tapping Decline usually triggers the busy path, not "no
                    answer". Both are on the carrier's side, so name the fix
                    rather than let it read as our bug. */}
                <p className="text-xs text-muted-foreground mt-2">
                  If ignored calls still reach your voicemail, your carrier&apos;s voicemail is
                  answering first. Turn off carrier voicemail with your provider, or let the call
                  ring out rather than tapping Decline — declining can send it straight to voicemail.
                  Advanced: some carriers let you set the ring time before forwarding with{" "}
                  <code className="px-1 py-0.5 rounded bg-background border border-border tabular-nums">
                    *61*&lt;number&gt;*11*&lt;seconds&gt;#
                  </code>
                  .
                </p>
              </div>
            )}

            {/* ── "How do I undo this?" — asked before it's needed ───────────
                Two different answers, and they are genuinely different actions.
                A forwarded setup is reversible from their own handset in a few
                seconds, which is most of why it's the recommended option — but
                that only stops calls arriving; the rented line underneath is
                still ours and still billed. Giving the LINE back is the release
                below, and it is permanent.

                This used to say releasing "isn't a button on this page" and
                point at an email address. It was honest at the time, and it left
                a contractor renting a number they didn't want for ever — Retell
                bills FieldQuo every month a number exists, and only
                delete-phone-number stops it. */}
            {number.status !== "porting" && (
              <ReleaseNumber
                e164={number.e164}
                // ── The number being GIVEN UP, not the one they give out ─────
                //
                // For a forwarded setup `display` is THEIR own number, which is
                // not the one this releases and is not going anywhere.
                // `forwardsToDisplay` is the line we rent them. Naming the wrong
                // one in a destructive confirmation is the whole failure class.
                display={
                  number.source === "forwarded"
                    ? number.forwardsToDisplay || number.e164
                    : number.display
                }
                ownNumber={number.source === "forwarded" ? number.display : null}
                forwarded={number.source === "forwarded"}
                monthlyCents={rent?.monthlyCents ?? number.monthlyCents}
                money={money}
                busy={busy}
                t={t}
                onRelease={releaseNumberNow}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div
                key={s.key}
                className={`rounded-xl border p-4 ${
                  s.recommended ? "border-inverted bg-muted" : "border-border"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-foreground">{s.label}</p>
                  {s.recommended && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      {t("app.setVoice.recommended", "Recommended")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.blurb}</p>
                {/* The downside, stated before they choose rather than after.
                    Porting especially — two to four weeks on someone else's
                    schedule is not a detail to discover afterwards. */}
                <p className="text-xs text-muted-foreground mt-1.5">{s.caveat}</p>

                {/* Each path gets the control that path actually needs.
                    An earlier version showed the same "Local / Toll-free"
                    buttons under "Move my number over" — pressing one would
                    have BOUGHT A NEW NUMBER while the company believed they
                    were porting theirs. A control that appears to work and
                    does something else is worse than one that isn't there. */}
                {/* Forwarding still buys a number to forward TO, so it costs
                    the same as a local one and is gated the same way. */}
                {s.key === "forwarded" && (
                  <>
                    <NumberInput
                      placeholder={t("app.setVoice.forwardedPlaceholder", "Your current business number")}
                      cta={t("app.setVoice.forwardedCta", "Set it up")}
                      disabled={busy || !configured || !forwardAfford.allowed}
                      onSubmit={(n) => getNumber("forwarded", "local", { publicNumber: n })}
                    />
                    <PriceNote
                      afford={forwardAfford}
                      money={money}
                      t={t}
                      configured={configured}
                    />
                  </>
                )}

                {s.key === "purchased" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {pricing.numberTypes.map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          // Disabled with a reason underneath, not a button that
                          // takes the click and comes back with "insufficient
                          // balance". The verdict is the server's.
                          disabled={busy || !configured || !type.afford.allowed}
                          onClick={() => getNumber(s.key, type.key)}
                          className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {type.label} — {money(type.monthlyCents)}/mo, {type.perMinuteCents}¢/min
                        </button>
                      ))}
                    </div>

                    {/* ── Choosing the actual number ───────────────────────
                        Local only, and only where the inventory can really be
                        searched. A toll-free number comes from the 800/833
                        pools and has no area to be in, so the button above
                        stays the whole of that path.

                        When `canChoose` is false the picker does not render at
                        all and the line below says so. That is the point: the
                        only lever without Twilio is Retell's `area_code`, which
                        is documented "Currently only supports US area code" —
                        inert for the Quebec companies this product serves. An
                        area-code box the provider throws away is a dead
                        control, and this codebase has been swept for those. */}
                    {configured && affordFor("local").allowed && (
                      <NumberPicker
                        choice={numberChoice}
                        busy={busy}
                        money={money}
                        monthlyCents={affordFor("local").needCents}
                        t={t}
                        onPick={(e164) => getNumber(s.key, "local", { phoneNumber: e164 })}
                      />
                    )}
                    {/* One line per type they CAN'T have, naming the gap. The
                        affordable case gets a single line rather than one per
                        button — the same sentence twice reads as a warning. */}
                    {pricing.numberTypes.some((type) => type.afford.allowed) && configured && (
                      <p className="text-xs text-muted-foreground">
                        {t("app.setVoice.firstMonthUpFront", "The first month's rental comes out of your credit as soon as you pick one.")}
                      </p>
                    )}
                    {pricing.numberTypes
                      .filter((type) => !type.afford.allowed)
                      .map((type) => (
                        <PriceNote
                          key={type.key}
                          label={type.label}
                          afford={type.afford}
                          money={money}
                          t={t}
                          configured={configured}
                        />
                      ))}
                    {pricing.freeTrialAvailable && (
                      <p className="text-xs text-muted-foreground">
                        {t("app.setVoice.trialWithNumber", "{minutes} free minutes are added to your credit with your first number.", { minutes: pricing.freeTrialMinutes })}
                      </p>
                    )}
                  </div>
                )}

                {s.key === "ported" && (
                  <>
                    <NumberInput
                      placeholder={t("app.setVoice.portedPlaceholder", "The number you want to move")}
                      cta={t("app.setVoice.portedCta", "Start the port")}
                      disabled={busy || !configured}
                      onSubmit={(n) => getNumber("ported", "local", { publicNumber: n })}
                    />
                    {/* Not gated on credit, because a port request costs
                        nothing — the rental starts when the number actually
                        moves, which is weeks away and may never happen. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("app.setVoice.portNoCharge", "Nothing is charged to start. The monthly rental begins only once the number has actually moved over.")}
                    </p>
                    {/* Said before they start, not after. A port needs details
                        from their losing carrier that no button here can
                        obtain, so this is a REQUEST someone picks up — and
                        pretending it's instant is how a business line goes
                        dark on a Tuesday.

                        The previous wording here promised "we'll email you what
                        your current provider needs", and nothing in the codebase
                        sends that email — the request writes one row and one
                        activity entry, both of which live inside the company's
                        own account. Promising a message that never arrives is
                        the same failure as a button that does nothing; it just
                        takes a week to notice. So it now says what actually
                        happens, and it says that a person is involved. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("app.setVoice.portedNote", "This records a request — it isn't automatic. Someone here has to arrange it with your current provider, who will need account details from you, so expect to hear from us rather than a confirmation on this screen. Your existing number keeps working the whole time, nothing switches over until the transfer completes, and you can cancel the request at any point before then.")}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. What it says ─────────────────────────────────────────────── */}
      <Card
        step="3."
        title={t("app.setVoice.saysTitle", "What it says")}
        hint={t("app.setVoice.saysHint", "It will never give a price, promise a time it hasn't checked, or claim to be a person.")}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{t("app.setVoice.greeting", "Greeting")}</span>
            <input
              value={form.greeting}
              onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              placeholder={t("app.setVoice.greetingPlaceholder", "Thanks for calling, how can I help?")}
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
            {/* ── A greeting that names a company that no longer exists ──────
                Big painter Inc's receptionist answered "Thank you for calling
                Federal Test" to every caller — a greeting typed under a former
                name, stored verbatim, and never looked at again. On a
                white-label product that is not a typo: this is the first and
                often only thing a homeowner hears.

                Asked, never corrected. We cannot know what they meant by it,
                and a trading name or a shorter form is perfectly legitimate —
                greetingNamesAnotherBusiness is deliberately weak for that
                reason. A question is honest; silently rewriting somebody's
                greeting would not be. */}
            {greetingWrongName && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>
                  {t(
                    "app.setVoice.greetingMismatch",
                    "This greeting doesn't mention {company}. It's the first thing every caller hears — is it still the right one?",
                    { company: data.companyName },
                  )}
                </span>
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {t("app.setVoice.instructions", "Anything it should know")}
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 mb-1.5">
              {t("app.setVoice.instructionsHint", "Tone, what to emphasise, what you don't do. It can't override the rules above — it still won't quote.")}
            </span>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              rows={4}
              placeholder={t("app.setVoice.instructionsPlaceholder", "We don't do commercial work. If they mention a leak, treat it as urgent.")}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </label>

          {/* ── What it will ask a caller for ──────────────────────────────
              Not editable, and deliberately so: the questions come from the
              trades this company prices instantly (Settings › Instant Quote),
              so they stay in step with what a quote actually needs instead of
              being a second list somebody has to maintain. Printed here because
              both halves can be silently empty — no instant trades means no
              measuring questions, and no company email means the photo request
              is dropped from the prompt entirely rather than sent somewhere
              invented. */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {t("app.setVoice.intake.title", "What it asks callers for")}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.intake?.trades?.length
                ? t(
                    "app.setVoice.intake.trades",
                    "For {trades}, it asks the measurements a quote needs — and never gives a price. Change what it asks by changing your instant-quote trades.",
                    { trades: data.intake.trades.join(", ") },
                  )
                : t(
                    "app.setVoice.intake.none",
                    "You have no instant-quote trades switched on, so it takes a message and asks nothing about measurements. Set some up in Settings › Instant Quote.",
                  )}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.intake?.photosTo
                ? t(
                    "app.setVoice.intake.photos",
                    "A call can't carry a photo, so it asks callers to email pictures to {email}.",
                    { email: data.intake.photosTo },
                  )
                : t(
                    "app.setVoice.intake.noPhotos",
                    "It won't ask for photos: there's no company email address for them to go to. Add one in Settings › Company.",
                  )}
            </p>
          </div>

          {/* ── Lines nobody answered ──────────────────────────────────────
              A drafted question left in [brackets] is withheld from the live
              agent by buildAgentPrompt — see lib/voice/knowledge.js. Withheld
              silently would be its own dead control, so the count is stated
              here, next to the box the brackets are sitting in. */}
          {unanswered.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {t(
                "app.setVoice.kb.unanswered",
                "Lines still in brackets: {count}. The receptionist skips a line until you replace the brackets with your own answer.",
                { count: unanswered.length },
              )}
            </p>
          )}

          {/* ── Draft from what FieldQuo already knows ─────────────────────
              It asks QUESTIONS. It never writes your hours, your services or
              your work areas into this box — the receptionist already receives
              those as facts, and a sentence saying the same thing is a second
              copy that goes stale the day you edit the first one. */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <button
              type="button"
              disabled={drafting || busy}
              onClick={draftKnowledgeGaps}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {drafting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {t("app.setVoice.kb.button", "Draft this from my company profile")}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              {t(
                "app.setVoice.kb.buttonHint",
                "Reads your profile and asks you the things it can't work out on its own. It won't repeat your opening hours, your services or your areas — the receptionist already gets those automatically.",
              )}
            </p>

            {draft && (
              <div className="mt-4 space-y-4">
                {/* Facts with a proper home. Never drafted into the note. */}
                {draft.structured.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("app.setVoice.kb.fixTitle", "These belong in your settings, not in the note")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("app.setVoice.kb.fixIntro", "The receptionist reads each of these from your settings on every call. Typed in here instead, it would still be saying the old answer a year from now.")}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {draft.structured.map((s) => (
                        <li key={s.id} className="text-sm text-foreground">
                          {s.question}{" "}
                          <Link
                            href={s.href}
                            className="inline-flex items-center gap-1 underline underline-offset-2 text-muted-foreground hover:text-foreground"
                          >
                            {t("app.setVoice.kb.fixLink", "Open settings")}
                            <ArrowRight size={12} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {draft.questions.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("app.setVoice.kb.title", "Answer these in your own words")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("app.setVoice.kb.intro", "Type over each bracket. Anything you leave in brackets is skipped, so there's no harm in ignoring one.")}
                    </p>
                    {/* The trade a question came from is shown HERE and never
                        written into the note — a service name in the note is a
                        copy of a row the owner can switch off tomorrow. */}
                    {draft.questions.some((q) => q.forService) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("app.setVoice.kb.fromTrades", "Some of these come from what your quotes already say about")}{" "}
                        {[...new Set(draft.questions.filter((q) => q.forService).map((q) => q.forService))].join(", ")}.
                      </p>
                    )}
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={Math.min(12, draft.questions.length + 2)}
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {draft.generated
                        ? t("app.setVoice.kb.written", "Worded by FieldQuo AI from your profile. Nothing here is saved until you add it and press Save.")
                        : draft.aiUnavailable === "quota"
                          ? t("app.setVoice.kb.quota", "You've used this month's AI allowance, so these are the standard questions rather than ones written for your trade. They're the same questions either way.")
                          : t("app.setVoice.kb.plain", "AI isn't switched on for this deployment, so these are the standard questions rather than ones written for your trade.")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={acceptDraft}
                        className="px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold"
                      >
                        {t("app.setVoice.kb.use", "Add these to my note")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDraft(null); setDraftText(""); }}
                        className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted"
                      >
                        {t("app.setVoice.kb.discard", "Discard")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">
                    {t("app.setVoice.kb.none", "Nothing obvious left to ask — your note already covers the things your settings can't say.")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Held in `form` and committed by the Save button below, exactly
              like the greeting. Not saved on click: one visit to this card
              should be one push to the provider, and a control that saved
              itself would leave a half-applied agent every time somebody
              changed their mind twice. */}
          <SoundPicker
            settings={data?.tuning?.settings}
            fields={data?.tuning?.fields}
            values={form}
            busy={busy}
            onPick={(field, value) => setForm({ ...form, [field]: value })}
            t={t}
          />

          {liveWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {t("app.setVoice.liveWarning", "Saved here, but we couldn't update the live phone agent. It's still using the previous wording — try saving again in a moment.")}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => save(form)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
            {saved ? t("app.action.saved", "Saved") : t("app.action.save", "Save")}
          </button>
        </div>
      </Card>

      {/* ── 4. The switch ───────────────────────────────────────────────── */}
      <Card
        dataTour="voice-answer"
        step="4."
        title={t("app.setVoice.answerTitle", "Answer my calls")}
        hint={
          canEnable
            ? freeOnly
              ? "Your free trial minutes are ready to use — turn it on whenever you like, no top-up needed."
              : t("app.setVoice.answerHintReady", "Turn it on when you're ready. You can turn it off just as fast.")
            // The server's sentence, naming the ONE thing that's missing.
            // The old text said "set up a number and add some credit" to
            // everybody, including people looking at their own number two cards
            // further up the same screen.
            : readyMessage
        }
      >
        <button
          type="button"
          disabled={busy || (!agent?.enabled && !canEnable)}
          onClick={() => save({ enabled: !agent?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            agent?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Headset size={16} />}
          {agent?.enabled ? t("app.setVoice.answerOn", "It's answering — turn off") : t("app.setVoice.answerOff", "Start answering calls")}
        </button>
        <BlockedReason show={!agent?.enabled && !canEnable} message={readyMessage} />

        {/* ── What a caller gets when this is off ─────────────────────────
            Turning it off detaches the agent at the provider, and Retell does
            not document what a caller then hears. Its own vocabulary for a
            call it will not take is "disconnect", never "ring", and its SIP
            edge is known to answer with 486 — a busy tone — in at least some
            cases. Busy means "they're on another call, try again in a minute".
            It does not mean "we're closed".

            Three comments in this repository asserted "the number rings out"
            and none of them had been checked. So this says what is actually
            known: it stops answering, and we cannot promise which of the two a
            caller gets. Somebody with this number on a van needs that before
            they switch it off, not after. See attachAgent in
            lib/voice/retell.js for the sources and for the one measurement
            that would settle it. */}
        {agent?.enabled && (
          <p className="text-xs text-muted-foreground mt-3">
            {t(
              "app.setVoice.answerOffWarning",
              "When you turn this off the number stops answering — and we can't promise a caller hears ringing rather than a busy tone. If this number is on your van, forward it somewhere before you switch it off.",
            )}
          </p>
        )}

        {/* Not the generic "we couldn't update the wording" warning. This one
            means the phone did not do what the button said, and the difference
            matters: an old greeting is cosmetic, a receptionist still answering
            after you switched it off is still spending your credit. */}
        {attachWarning && (
          <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {t(
              "app.setVoice.attachWarning",
              "Saved here, but the provider didn't accept the change — the number may still be doing what it was doing before. Try again in a moment, and use the end-to-end check below if it keeps happening.",
            )}
          </p>
        )}
      </Card>

      {/* ── 5. Outbound ─────────────────────────────────────────────────────
          A separate switch on purpose — answering a call someone placed is a
          different consent story from placing one they didn't. Off by default;
          the same number-and-credit floor as answering. */}
      <Card
        step="5."
        title={t("app.setVoice.outboundTitle", "Call clients back automatically")}
        hint={t("app.setVoice.outboundHint", "The assistant rings clients who asked to be contacted — after you send them a quote, to confirm a booked visit the day before, and to follow up on a new enquiry. Always within calling hours, and anyone who says stop is taken off for good.")}
      >
        <button
          type="button"
          disabled={busy || (!data?.outbound?.enabled && !canEnable)}
          onClick={() => save({ outboundCallsEnabled: !data?.outbound?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            data?.outbound?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
          {data?.outbound?.enabled ? t("app.setVoice.outboundOn", "It's calling clients — turn off") : t("app.setVoice.outboundOff", "Turn on quote callbacks")}
        </button>

        {/* This card had no explanation at all when its button was dead — the
            precondition (a live number and enough credit for one minute) was
            enforced in the PUT route and stated nowhere. */}
        <BlockedReason show={!data?.outbound?.enabled && !canEnable} message={readyMessage} />

        {data?.outbound?.enabled && (
          <>
            <QuoteCallScope
              scope={data.outbound.scope}
              options={data.outbound.options}
              busy={busy}
              onPick={(scope) => save({ outboundQuoteCallScope: scope })}
              t={t}
            />

            <p className="text-xs text-muted-foreground mt-4">
              {data.outbound.queued > 0
                ? t("app.setVoice.outboundQueued", "{count} call{plural} waiting to go out.", { count: data.outbound.queued, plural: data.outbound.queued === 1 ? "" : "s" })
                : t("app.setVoice.outboundNone", "No calls waiting.")}{" "}
              {t("app.setVoice.outboundStopNote", "A client who asks to stop being called is taken off immediately and for good.")}
            </p>

            <CallbackReport
              report={data.outbound.report}
              windowDays={data.outbound.windowDays}
              t={t}
            />
          </>
        )}
      </Card>

      {/* ── 6. Crew texting ─────────────────────────────────────────────────
          Not a switch any more, and not on this screen any more.

          This card used to carry a toggle for the crew inbox, gated on the
          voice number being active. It could never work: the crew inbox is
          inbound SMS to a TWILIO number, and the number this screen provisions
          is bought from Retell, lives in Retell's telephony account, and cannot
          receive a text at all. Two different lines from two different
          providers, shown as one, with a switch across the gap — so it saved a
          column and connected nothing, and the contractor who turned it on
          texted his number all evening for silence.

          On a `forwarded` setup it was worse still: the number on the van is
          the contractor's own, and carrier forwarding forwards CALLS, never
          texts, so nothing reaches us whatever we do at this end.

          Setup now lives on the page that shows the result — /app/crew-inbox —
          where the number, whether it is really wired at the provider, and a
          test text are all one surface. A link is honest; the switch was not. */}
      <Card
        step="6."
        title={t("app.setVoice.crewTitle", "Let the crew text in photos and updates")}
        hint={t("app.setVoice.crewHint", "Your crew send photos or a quick note to your number, and it files them to the right job automatically — asking which one when the day has more than one.")}
      >
        <p className="text-sm text-muted-foreground">
          {t("app.setVoice.crewMoved", "Crew texting uses its own number — a texting line, separate from the one that answers your calls. Set it up on the crew inbox page.")}
        </p>
        <Link
          href="/app/crew-inbox"
          className="inline-flex items-center gap-2 px-6 py-3 mt-3 rounded-full bg-inverted text-inverted-foreground text-sm font-bold"
        >
          <MessageSquare size={16} />
          {t("app.setVoice.crewSetUp", "Set up crew texting")}
        </Link>
        <p className="text-xs text-muted-foreground mt-3">
          {t("app.setVoice.crewNote", "Crew are matched by the phone number on their profile (Settings → Team). A text from an unknown number is logged but not filed.")}
        </p>
      </Card>

      {/* ── 7. Does any of it actually work ─────────────────────────────────
          The card this whole screen was missing.

          Every other panel above reports what OUR OWN COLUMNS say, and the
          owner spent months being told the receptionist worked on exactly that
          evidence. It answered a real call and recorded nothing, because the
          address Retell posts results to is written once at provisioning time
          and never looked at again — invisible from here, and fatal to the
          call log, the transcript, the lead and the billing all at once.

          So this one goes and ASKS, link by link, and says "we couldn't check"
          rather than inventing a pass. See lib/voice/readiness.js. */}
      {number && (
        <Card
          step="7."
          title={t("app.setVoice.chain.title", "Check it end to end")}
          hint={t("app.setVoice.chain.hint", "This asks the phone service itself about every step between somebody dialling and a lead landing here. Nothing below is taken from our own records.")}
        >
          <ReadinessPanel
            chain={chain}
            busy={chainBusy}
            fixed={chainFixed}
            t={t}
            number={number}
            onRun={runReadiness}
            onFix={resyncAgent}
          />
        </Card>
      )}
    </div>
  );
}

// ══ The end-to-end check ═══════════════════════════════════════════════════
//
// Renders whatever the resolver returned, in the resolver's own order, and
// draws nothing it wasn't given — a link that only exists in this component is
// a link the check script cannot assert over, and the tables in
// lib/voice/readinessCopy.js exist so it can.
//
// Three states and three colours, and the middle one matters most: "not
// checked" is grey and says so. A tick that means "we couldn't look" is the
// exact lie this screen is here to stop telling.
function ReadinessPanel({ chain, busy, fixed, t, number, onRun, onFix }) {
  if (!chain) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-inverted text-inverted-foreground text-sm font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
          {busy
            ? t("app.setVoice.chain.running", "Asking the phone service…")
            : t("app.setVoice.chain.run", "Run the check")}
        </button>
        {/* Said before the check is ever pressed, because it is the one thing a
            forwarded contractor can do without touching their carrier: ring the
            receptionist's own line and hear it. That instruction existed
            nowhere, so the only way to test was to test forwarding at the same
            time — two variables, one phone call. */}
        {number.source === "forwarded" && number.forwardsToDisplay && (
          <p className="text-xs text-muted-foreground">
            {t("app.setVoice.chain.testDial", "Ring {number} yourself to hear the receptionist without forwarding in the way.", { number: number.forwardsToDisplay })}{" "}
            {t("app.setVoice.chain.testDialThen", "Then run this again — a call that was recorded is the only proof the whole thing works.")}
          </p>
        )}
      </div>
    );
  }

  const tone = {
    ok: "text-emerald-600 dark:text-emerald-400",
    fail: "text-amber-700 dark:text-amber-400",
    unknown: "text-muted-foreground",
  };
  const stateLabel = {
    ok: t("app.setVoice.chain.state.ok", "Working"),
    fail: t("app.setVoice.chain.state.fail", "Broken"),
    unknown: t("app.setVoice.chain.state.unknown", "Not checked"),
  };

  // The resolver's order, filtered to what it actually returned. Sorting here
  // instead of trusting array order keeps the page and the check script reading
  // the same list even if one of them grows a link the other hasn't.
  const links = READINESS_LINKS.map((id) => chain.links.find((l) => l.id === id)).filter(Boolean);

  return (
    <div className="space-y-4">
      {fixed && (
        <p className="text-sm font-semibold text-foreground">
          {t("app.setVoice.chain.fixed", "Your settings were sent to the phone service again. Here's what it says now.")}
        </p>
      )}

      <p className="text-sm text-foreground">
        {t(overallKey(chain.overall), OVERALL_TEXT[chain.overall] || "")}
      </p>

      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.id} className="flex gap-2.5">
            <span className={`shrink-0 mt-0.5 ${tone[l.state]}`} aria-hidden="true">
              {l.state === "ok" ? (
                <Check size={15} />
              ) : l.state === "fail" ? (
                <AlertTriangle size={15} />
              ) : (
                <Info size={15} />
              )}
            </span>
            <div className="text-sm min-w-0">
              <p className="font-medium text-foreground">
                {t(linkLabelKey(l.id), LINK_LABEL[l.id] || l.id)}{" "}
                <span className={`text-xs font-normal ${tone[l.state]}`}>
                  — {stateLabel[l.state]}
                </span>
              </p>
              <p className="text-muted-foreground">
                {t(l.reasonKey, REASON_TEXT[l.reasonKey] || l.reason)}
              </p>
              {/* Whose end it is, and only where the resolver named one.
                  Asserting a side we did not observe is the guess this whole
                  module was built to stop. */}
              {l.state === "fail" && l.fixer && OWNER_TEXT[l.fixer] && (
                <p className="text-xs opacity-80 text-muted-foreground">
                  {t(ownerKey(l.fixer), OWNER_TEXT[l.fixer])}
                </p>
              )}
              {/* The two addresses, printed. A webhook pointing somewhere else
                  is the failure nobody can picture until they see both. */}
              {l.detail?.holds && l.detail?.ours && (
                <p className="text-xs text-muted-foreground mt-0.5 break-all">
                  <code className="px-1 py-0.5 rounded bg-muted">{l.detail.holds}</code>
                  {" → "}
                  <code className="px-1 py-0.5 rounded bg-muted">{l.detail.ours}</code>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy
            ? t("app.setVoice.chain.running", "Asking the phone service…")
            : t("app.setVoice.chain.rerun", "Check again")}
        </button>
        {/* Only where the resolver said a fieldquo-side link is fixable. It
            pushes our settings to the provider again and honours the on/off
            switch, so it can never turn a contractor's phone on for them. */}
        {chain.repairable && (
          <button
            type="button"
            disabled={busy}
            onClick={onFix}
            className="px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {busy
              ? t("app.setVoice.chain.fixing", "Fixing…")
              : t("app.setVoice.chain.fix", "Fix what's ours to fix")}
          </button>
        )}
      </div>

      {number.source === "forwarded" && number.forwardsToDisplay && (
        <p className="text-xs text-muted-foreground">
          {t("app.setVoice.chain.testDial", "Ring {number} yourself to hear the receptionist without forwarding in the way.", { number: number.forwardsToDisplay })}{" "}
          {t("app.setVoice.chain.testDialThen", "Then run this again — a call that was recorded is the only proof the whole thing works.")}
        </p>
      )}
    </div>
  );
}

// ══ The stuck-number banner ════════════════════════════════════════════════
//
// The verdict tables live in lib/voice/diagnosisCopy.js rather than here: they
// are the half that can be wrong silently — a verdict with no sentence renders
// an empty banner — and a check script cannot import a client component full of
// JSX to assert them. See the note at the top of that file.

/**
 * Giving the rented line back. The only irreversible control on this screen.
 *
 * ── Why it is three steps and not a button ─────────────────────────────────
 *
 * Releasing calls delete-phone-number at Retell. The number goes back to the
 * carrier's pool, someone else can buy it, and it cannot be recovered — so a
 * van, a lawn sign, a Google listing and three years of invoices stop working.
 * That is not a thing to put one click away, and it is not a thing to describe
 * as "remove" either.
 *
 * So: collapsed by default, the consequence stated in those words, the number
 * NAMED and typed back, and — when it is the last working line — a second
 * acknowledgement. The route decides all of that again server-side; this is the
 * same decision rendered, not a substitute for it.
 *
 * The typed confirmation is compared loosely here (digits only) so a contractor
 * who types the pretty form on a phone keyboard is not defeated by punctuation.
 * The E.164 is what gets POSTed, and the route compares that exactly.
 */
function ReleaseNumber({ e164, display, ownNumber, forwarded, monthlyCents, money, busy, t, onRelease }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  // Set only after the ROUTE has told us this is their last working line. The
  // page has no way to know — the settings GET returns one row, so from here
  // every number looks like the only one.
  const [soleWarning, setSoleWarning] = useState(false);

  const digits = (s) => String(s || "").replace(/[^\d]/g, "");
  const matches = Boolean(e164) && digits(typed) === digits(e164);

  function reset() {
    setOpen(false);
    setTyped("");
    setAck(false);
    setSoleWarning(false);
  }

  if (!e164) return null;

  if (!open) {
    return (
      <div className="pt-1">
        <p className="text-xs text-muted-foreground">
          {forwarded
            ? t("app.setVoice.release.introForwarded", "To stop calls reaching the receptionist right now, dial ##002# from your own phone — your number is unchanged and nothing is lost. To stop paying for the line we rent you as well, you have to give that line back:")
            : t("app.setVoice.release.intro", "Done with this number? You can give it back — but it is permanent, so read what it says first.")}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-400 underline underline-offset-2"
        >
          {t("app.setVoice.release.open", "Release {number}", { number: display })}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
      <div className="flex gap-2">
        <AlertTriangle size={17} className="text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-900 dark:text-red-200 space-y-1.5">
          <p className="font-semibold">
            {t("app.setVoice.release.title", "Release {number} for good?", { number: display })}
          </p>
          {/* The consequence in the terms it actually happens in. "Remove" and
              "disconnect" both suggest something reversible; this is neither. */}
          <p>
            {t("app.setVoice.release.warning", "{number} is deleted at the phone company and goes back into the pool for anyone to buy. It cannot be recovered, not by us and not by you. Anything printed on a van, a sign, a business card or a Google listing with that number on it stops working the moment you press this.", { number: display })}
          </p>
          {forwarded && ownNumber && (
            <p>
              {t("app.setVoice.release.forwardedNote", "Your own number, {number}, is not touched — but the forwarding you set points at the line being released, so dial ##002# from your phone afterwards or your missed calls will go nowhere.", { number: ownNumber })}
            </p>
          )}
          {/* Said rather than left to be discovered on a statement. Rent is
              taken 30 days in advance and nothing here refunds the remainder;
              pretending otherwise, or staying quiet, would both be worse. */}
          <p>
            {t("app.setVoice.release.money", "The {amount} monthly rental stops. Whatever is left of the month you have already paid for is not refunded.", { amount: money(monthlyCents) })}
          </p>
          {soleWarning && (
            <p className="font-semibold">
              {t("app.setVoice.release.soleNumber", "This is the only working number on your account. Releasing it takes your receptionist line away for good — confirm again if that's really what you want.")}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="release-confirm" className="block text-xs font-medium text-red-900 dark:text-red-200">
          {t("app.setVoice.release.typeIt", "Type {number} to confirm you mean this number.", { number: display })}
        </label>
        <input
          id="release-confirm"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={display}
          className="mt-1 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground"
        />
      </div>

      {/* ── The last working line ────────────────────────────────────────────
          Shown only once the ROUTE has refused with `sole_number`. It counts
          the company's active rows; this screen sees one row and could not tell
          the difference. A box ticked before anyone checked would be the page
          asserting a fact it had not been told — and it would neuter the guard,
          since the route would then always receive a yes. */}
      {soleWarning && (
        <label className="flex items-start gap-2 text-xs text-red-900 dark:text-red-200">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {t("app.setVoice.release.ack", "I understand this may be my only working line, and that my receptionist will have no number to answer on until I set up a new one.")}
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !matches || (soleWarning && !ack)}
          onClick={async () => {
            const res = await onRelease({ confirm: e164, acknowledgeSoleNumber: ack });
            if (res?.ok) reset();
            // Refused because it is their last line. Not an error: the second
            // confirmation appears and the same button becomes the second yes.
            else if (res?.soleNumber) setSoleWarning(true);
          }}
          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy
            ? t("app.setVoice.release.releasing", "Releasing…")
            : soleWarning
              ? t("app.setVoice.release.confirmSoleCta", "Yes — release my only line")
              : t("app.setVoice.release.confirmCta", "Release it permanently")}
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground"
        >
          {t("app.setVoice.release.keep", "Keep my number")}
        </button>
      </div>
    </div>
  );
}

function NumberDiagnosis({ diag, busy, t, display, onRepair, onRecheck }) {
  if (!diag?.verdict) return null;
  const tone = DIAGNOSIS_TONE[diag.verdict];
  if (!tone) return null;

  const warn = tone === "warn";
  const box = warn
    ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
    : "border-border bg-muted";
  const ink = warn ? "text-amber-900 dark:text-amber-200" : "text-foreground";
  const icon = warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";

  return (
    <div className={`rounded-lg border px-4 py-3 flex gap-3 ${box}`}>
      {warn ? (
        <AlertTriangle size={17} className={`${icon} shrink-0 mt-0.5`} />
      ) : (
        <Info size={17} className={`${icon} shrink-0 mt-0.5`} />
      )}
      <div className={`text-sm ${ink} space-y-2`}>
        {/* Just repaired, or just failed to. Said before the current state, so
            the reader knows whether they are looking at an outcome or at a
            problem they haven't touched yet. */}
        {diag.repaired === true && (
          <p className="font-semibold">
            {t("app.setVoice.diag.repaired", "Fixed — this number is answering again.")}
          </p>
        )}
        {/* Keyed on `repaired`, NOT on `was`. The repair route omits `was` on
            its 409 and 502 bodies, so an early version of this only spoke up
            when the fix half-worked — press Fix, watch a failed repair change
            nothing on screen, which is the dead control this banner replaced.
            The "Before" line is the extra detail, not the message. */}
        {diag.repaired === false && (
          <>
            <p className="font-semibold">
              {t("app.setVoice.diag.notRepaired", "That didn't fix it. We've been told about it and someone here will pick it up.")}
            </p>
            {diag.was && diag.was !== diag.verdict && (
              <p className="text-xs opacity-80">
                {t("app.setVoice.diag.before", "Before:")}{" "}
                {t(diagnosisKey(diag.was), DIAGNOSIS_TEXT[diag.was] || diag.was)}
              </p>
            )}
          </>
        )}

        <p>{t(diagnosisKey(diag.verdict), DIAGNOSIS_TEXT[diag.verdict])}</p>

        {/* Whose fault, because the owner asked to be told. Omitted where the
            verdict has no side — asserting one would be the same guess this
            module was built to stop. */}
        {diag.side && SIDE_TEXT[diag.side] && (
          <p className="text-xs opacity-90">
            {t(sideKey(diag.side), SIDE_TEXT[diag.side])}
          </p>
        )}

        {/* The money sentence, and ONLY when the diagnosis licenses it. This is
            the half that used to be printed unconditionally: telling someone
            they're paying rent on a number that does not exist, in the same
            breath as telling them not to buy a working one, is how they end up
            with no phone. */}
        <p className="text-xs opacity-90">
          {diag.billing
            ? t("app.setVoice.diag.billingYes", "You are paying the monthly rental on it, so don't buy another one.")
            : t("app.setVoice.diag.billingNo", "Nothing is being charged for it.")}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {diag.repairable && (
            <button
              type="button"
              disabled={busy}
              onClick={onRepair}
              className="px-4 py-1.5 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
              {t("app.setVoice.diag.fix", "Fix this now")}
            </button>
          )}
          {diag.verdict === "provider_unreachable" && (
            <button
              type="button"
              disabled={busy}
              onClick={onRecheck}
              className="px-4 py-1.5 rounded-full border border-border text-sm text-foreground hover:bg-background disabled:opacity-50"
            >
              {busy ? t("app.setVoice.diag.checking", "Checking…") : t("app.setVoice.diag.recheck", "Try again")}
            </button>
          )}
          {/* Left as a way out on anything we can't repair from here, and on a
              repair that reported failure. Not offered on the company-side
              verdicts: emailing us about a switch they can flip themselves
              wastes their afternoon. */}
          {diag.side === "fieldquo" && (!diag.repairable || diag.repaired === false) && (
            <a
              href={supportMailto({
                subject: `Phone number problem — ${display}`,
                body: `My receptionist number ${display} isn't working. FieldQuo's own check reports: ${diag.verdict}.`,
              })}
              className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
            >
              <Mail size={14} />
              {t("app.setVoice.emailUs", "Email us about this number")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What this number costs, and — when they can't have it — why not.
 *
 * The reason has to be next to the control, before it's pressed. A disabled
 * button with no explanation is the same dead end as one that fails on click;
 * the only difference is which of the two the contractor phones about.
 *
 * `afford` is the server's verdict (`spendVerdict` in lib/voice/spendGate.js),
 * shortfall included, so the number quoted here is the number the route would
 * have enforced.
 */
function PriceNote({ afford, label, money, t, configured }) {
  // Nothing to say about affording a number on a deployment that can't sell
  // one — the banner at the top of the page already explains that.
  if (!configured || !afford) return null;

  if (afford.allowed) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        {t("app.setVoice.firstMonthNow", "{amount} — the first month — comes out of your credit now.", { amount: money(afford.needCents) })}
      </p>
    );
  }

  return (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
      {label ? `${label}: ` : ""}
      {t("app.setVoice.cantAfford", "Add {amount} more credit first — the first month's {rental} rental is charged up front.", {
        amount: money(afford.shortfallCents),
        rental: money(afford.needCents),
      })}
    </p>
  );
}

/**
 * Why a switch is off, printed under the switch.
 *
 * Both call switches were disabled with nothing beside them but a hint that
 * assumed the reason ("set up a number and add some credit"), which was wrong
 * for anyone whose number existed but wasn't answering yet — the exact case a
 * porting request produces, and the one that got reported.
 *
 * `readiness` is the server's, computed by the same checkSpend() the PUT gate
 * runs, so this can't tell someone to top up when the real blocker was the
 * number, or tell them the number is fine when the route would refuse.
 */
function BlockedReason({ show, message }) {
  if (!show || !message) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 flex items-start gap-1.5">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      {message}
    </p>
  );
}

/**
 * How the receptionist SOUNDS — four choices, in the owner's words.
 *
 * ── Why four, and not the twenty Retell offers ────────────────────────────
 *
 * Retell exposes interruption sensitivity, responsiveness, denoising, ASR
 * vendor, transcription mode, backchannel frequency, voice temperature, model,
 * model temperature, priority tier, and a dozen more. Every one of them is a
 * number or a vendor name, and a one-van painter cannot evaluate any of them.
 * A screen of that is a screen nobody touches, or one somebody breaks their own
 * phone with — the same defect as a feature flag for a feature that doesn't
 * exist, wearing a number instead of a name.
 *
 * So the four here are the four a contractor has a genuine opinion about,
 * because they are four facts about THEIR callers and THEIR trade, not four
 * facts about a speech pipeline. Everything else is set in
 * lib/voice/agentTuning.js with the reasoning written down beside it.
 *
 * ── And the trade is in the words ─────────────────────────────────────────
 *
 * Three of the four buy quality with latency or the reverse. The hint under
 * each option says which, in the sentence, because "0.6" tells the person
 * paying for it nothing at all.
 *
 * `fields` and the option lists come from the SERVER, not from a list typed
 * here: an option the PUT route would refuse with a 400 must not be renderable
 * as a button.
 */
function SoundPicker({ settings, fields, values, busy, onPick, t }) {
  if (!settings || !Array.isArray(fields) || !fields.length) return null;
  // Belt and braces on the import: a field the server sent that this bundle
  // has no copy for would render a heading with no fallback text.
  const known = fields.filter((f) => TUNING_FIELDS.includes(f) && settings[f]?.values?.length);
  if (!known.length) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">
        {t("app.setVoice.tune.title", "How it sounds")}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {t(
          "app.setVoice.tune.hint",
          "The defaults suit most people. Change these if your callers keep getting cut off, or if it keeps talking over them.",
        )}
      </p>

      <div className="mt-4 space-y-4">
        {known.map((field) => (
          <div key={field}>
            <p className="text-xs font-semibold text-foreground">
              {t(tuningTitleKey(field), TUNING_TITLE_TEXT[tuningTitleKey(field)] || field)}
            </p>
            <div
              className={`mt-2 grid gap-2 ${
                settings[field].values.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"
              }`}
            >
              {settings[field].values.map((value) => {
                const active = value === values?.[field];
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={busy || active}
                    aria-pressed={active}
                    onClick={() => onPick(field, value)}
                    // One opacity utility per state — see QuoteCallScope below
                    // for why `disabled:opacity-50` and `disabled:opacity-100`
                    // together do not resolve by class order.
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : busy
                          ? "border-border bg-card opacity-50"
                          : "border-border bg-card hover:border-foreground/30"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {active && (
                        <Check size={14} className="shrink-0 text-emerald-700 dark:text-emerald-400" />
                      )}
                      {t(
                        tuningLabelKey(field, value),
                        TUNING_LABEL_TEXT[tuningLabelKey(field, value)] || value,
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      {t(
                        tuningHintKey(field, value),
                        TUNING_HINT_TEXT[tuningHintKey(field, value)] || "",
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* The one thing none of these can touch, said where somebody is about to
          change how the receptionist behaves. SYSTEM_RULES sits above anything
          a company types AND above anything set here — agentTuning.js sends no
          prompt text at all — and the refusal held under direct pressure on two
          real calls. Worth stating on the screen that looks most like it might
          loosen it. */}
      <p className="text-xs text-muted-foreground mt-4">
        {t(
          "app.setVoice.tune.unchanged",
          "None of these change what it's allowed to say. It still never gives a price, never promises a time it hasn't checked, and never claims to be a person.",
        )}
      </p>
    </div>
  );
}

/**
 * Which quotes the assistant is allowed to ring about.
 *
 * A choice rather than a constant because the old hard rule — instant estimates
 * only — was right for the company it was written for and wrong for an owner
 * who writes every quote himself and wants a closer. The DEFAULT is still that
 * old rule: see lib/voice/quoteCallScope.js on why widening it underneath
 * somebody who never asked is the thing to avoid.
 *
 * `options` comes from the server rather than being listed here, so a scope the
 * route would refuse to save can't be rendered as a button.
 */
function QuoteCallScope({ scope, options, busy, onPick, t }) {
  if (!Array.isArray(options) || !options.length) return null;
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-foreground">
        {t("app.setVoice.scopeTitle", "Which quotes get a call")}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((value) => {
          const active = value === scope;
          return (
            <button
              key={value}
              type="button"
              disabled={busy || active}
              aria-pressed={active}
              onClick={() => onPick(value)}
              // One opacity utility per state, never two. `disabled:opacity-50`
              // alongside `disabled:opacity-100` looks like it resolves by class
              // order and does not — Tailwind emits both and the later RULE
              // wins, so the chosen option would have dimmed itself and the
              // busy ones would not.
              className={`text-left rounded-lg border p-3 transition-colors ${
                active
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                  : busy
                    ? "border-border bg-card opacity-50"
                    : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {active && <Check size={14} className="shrink-0 text-emerald-700 dark:text-emerald-400" />}
                {t(scopeLabelKey(value), SCOPE_LABEL_TEXT[scopeLabelKey(value)] || value)}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {t(scopeHintKey(value), SCOPE_HINT_TEXT[scopeHintKey(value)] || "")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The quotes that were NOT called, and why.
 *
 * ── Why this card exists at all ───────────────────────────────────────────
 *
 * "No calls waiting" under a switch that reads "It's calling clients" is a true
 * sentence nobody can act on. An owner turned the feature on, sent a quote, got
 * no call, and had no way to find out that the gate only ever covered instant
 * estimates. The button worked and the screen was still lying by omission.
 *
 * Every reason here is a code the server's own gate returned — not a second
 * description of the rule written for the screen, which would be the copy that
 * rots. See lib/voice/quoteCallbackReport.js.
 */
function CallbackReport({ report, windowDays, t }) {
  if (!report || !report.considered) return null;

  const reason = (code) =>
    t(callbackReasonKey(code), CALLBACK_REASON_TEXT[callbackReasonKey(code)] || code);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
      {report.called > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("app.setVoice.outboundCalled", "{count} quote{plural} already called in the last {days} days.", {
            count: report.called,
            plural: report.called === 1 ? "" : "s",
            days: windowDays,
          })}
        </p>
      )}

      {report.headline && (
        <p className="text-xs text-foreground flex items-start gap-1.5">
          <Info size={13} className="shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            {t(
              "app.setVoice.outboundWhyNone",
              "{count} quote{plural} sent in the last {days} days weren't called. Most common reason: {reason}",
              {
                count: report.headline.count,
                plural: report.headline.count === 1 ? "" : "s",
                days: windowDays,
                reason: reason(report.headline.reason),
              },
            )}
          </span>
        </p>
      )}

      {report.refusals?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {report.refusals.map((r, i) => (
            <li key={`${r.quoteNumber || i}`} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {[r.quoteNumber, r.clientName].filter(Boolean).join(" · ")}
              </span>
              {" — "}
              {reason(r.reason)}
            </li>
          ))}
          {report.moreRefusals > 0 && (
            <li className="text-xs text-muted-foreground">
              {t("app.setVoice.outboundMore", "…and {count} more.", { count: report.moreRefusals })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Pick the actual number, in the contractor's own area code.
 *
 * ── What this replaces ────────────────────────────────────────────────────
 *
 * "Local number — $4/mo" and a shrug. NUMBER_TYPES.local has advertised "A
 * number in your own area code" since it was written, and nothing delivered it:
 * the only lever was Retell's `area_code`, which the reference documents as
 * "Currently only supports US area code". Every Canadian company got whatever
 * the pool held, which is how a Drummondville business ends up with a Toronto
 * number on its van.
 *
 * ── Three states, and none of them is a spinner that lies ─────────────────
 *
 * `null` results — nothing searched yet.
 * `[]` results — we looked and that area code has nothing free. This is a
 *   ROUTINE answer, not a failure: checked live, both 416 and 514 return zero
 *   from Twilio because Toronto and Montreal local inventory is exhausted. It
 *   gets its own sentence, suggesting a neighbouring code, and it must never
 *   render as an error (see scripts/check-empty-vs-error.mjs).
 * a thrown search — we could not look at all. Reported through the normal error
 *   path, which is a different sentence again.
 *
 * ── The box can legitimately open empty ───────────────────────────────────
 *
 * `choice.areaCode` is null when the company has no phone number on file, and
 * nothing invents one. A guessed area code here is not a cosmetic default: it
 * is three digits somebody buys a number in and prints on a vehicle. The search
 * still works — it falls back to the company's city, and the area codes come
 * back from real inventory rather than from a table of ours.
 */
function NumberPicker({ choice, busy, money, monthlyCents, t, onPick }) {
  const [areaCode, setAreaCode] = useState(choice?.areaCode || "");
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Nothing to search with, so nothing to offer. The sentence is the honest
  // fallback the owner asked for rather than a picker that ignores the choice.
  if (!choice?.canChoose) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("app.setVoice.pick.unavailable", "We can't show you a list of free numbers on this setup, so we'll get you the closest one we can to where you are. We'll tell you the number you actually got.")}
      </p>
    );
  }

  async function search() {
    setSearching(true);
    setResults(null);
    try {
      const qs = areaCode.trim() ? `?areaCode=${encodeURIComponent(areaCode.trim())}` : "";
      const res = await fetch(`/api/settings/voice/numbers/search${qs}`);
      if (!res.ok) {
        // A failed LOOK, which is not an empty result. Handled by the same
        // key-aware reporter the rest of this screen uses so the refusal
        // arrives in the contractor's language.
        const payload = await res.clone().json().catch(() => ({}));
        if (payload?.errorKey) {
          showError(t(payload.errorKey, payload.error || "", payload.errorParams || {}));
        } else {
          await reportResponseError(res, t("app.setVoice.pick.searchFailed", "We couldn't check which numbers are free just now. Nothing has been charged."));
        }
        return;
      }
      const payload = await res.json();
      setResults(payload.numbers || []);
      setSearched(payload.searched || null);
      // The server may have fallen back to the company's city. Reflecting the
      // area code it actually used keeps the box honest about what was asked.
      if (!areaCode.trim() && payload.numbers?.[0]?.areaCode) {
        setAreaCode(payload.numbers[0].areaCode);
      }
    } catch (err) {
      showError(
        t("app.setVoice.pick.searchFailed", "We couldn't check which numbers are free just now. Nothing has been charged.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setSearching(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          search();
        }}
        disabled={busy}
        className="text-xs font-semibold text-foreground underline underline-offset-2 disabled:opacity-50"
      >
        {t("app.setVoice.pick.open", "Choose the number yourself")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t("app.setVoice.pick.title", "Pick your number")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("app.setVoice.pick.hint", "These are real numbers that are free right now. The one you pick is the one you get — if somebody else takes it first we'll tell you, and nothing is charged.")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-muted-foreground" htmlFor="voice-area-code">
          {t("app.setVoice.pick.areaCodeLabel", "Area code")}
        </label>
        <input
          id="voice-area-code"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          inputMode="numeric"
          maxLength={3}
          // No placeholder digits. A greyed-out "819" in an empty box reads as a
          // value, and this is a box where a misread default gets bought.
          placeholder=""
          className="w-20 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy || searching}
          className="px-3 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {searching ? (
            <Loader2 size={14} className="inline animate-spin" />
          ) : (
            t("app.setVoice.pick.search", "Show me numbers")
          )}
        </button>
      </div>

      {/* Where the three digits came from, said out loud. The contractor can
          tell a derived default from a typed one, and change it. */}
      {choice.from === "phone" && choice.areaCode && (
        <p className="text-xs text-muted-foreground">
          {t("app.setVoice.pick.fromPhone", "{code} is the area code of the number on your company profile. Change it if you'd rather have a different one.", { code: choice.areaCode })}
        </p>
      )}
      {!choice.areaCode && (
        <p className="text-xs text-muted-foreground">
          {/* Absence of a statement is not a statement — AGENTS.md. There is no
              phone on the company profile, so there is nothing to derive from
              and no default is invented. */}
          {t("app.setVoice.pick.noDefault", "There's no phone number on your company profile, so we can't tell which area code you want. Type one, or leave it blank and we'll look near your city.")}
        </p>
      )}

      {searching && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          {t("app.setVoice.pick.searching", "Checking what's free…")}
        </p>
      )}

      {/* An empty result is an ANSWER, and gets said as one. Busy area codes
          run dry all the time — 514 and 416 are both empty against real Twilio
          inventory today — and rendering that as a failure would send a
          contractor chasing a problem that isn't theirs. */}
      {!searching && results?.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {searched?.areaCode
            ? t("app.setVoice.pick.noneInAreaCode", "Nothing free in {code} right now — it's a busy area code. Try one next to it, or take the button above and we'll get the closest we can.", { code: searched.areaCode })
            : t("app.setVoice.pick.noneNearby", "We couldn't find a free number near you. Try typing an area code, or take the button above and we'll get the closest we can.")}
        </p>
      )}

      {!searching && results?.length > 0 && (
        <div className="space-y-2">
          {searched?.locality && (
            <p className="text-xs text-muted-foreground">
              {t("app.setVoice.pick.nearCity", "Free numbers near {city}.", { city: searched.locality })}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {results.map((n) => (
              <button
                key={n.e164}
                type="button"
                disabled={busy}
                onClick={() => onPick(n.e164)}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border text-left hover:bg-muted disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {n.display}
                </span>
                <span className="text-xs text-muted-foreground">
                  {/* The city only when Twilio gave us one. Part of the
                      inventory comes back with no locality at all, and printing
                      the area code's "usual" city there would be an invented
                      place on a screen about buying a number. */}
                  {n.locality ? `${n.locality} · ` : ""}
                  {money(monthlyCents)}
                  {t("app.setVoice.perMonth", "/month")}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("app.setVoice.pick.buysNow", "Picking one buys it straight away, and the first month comes out of your credit.")}
          </p>
        </div>
      )}
    </div>
  );
}

/** One number field. Shared by forwarding and porting — both need theirs. */
function NumberInput({ onSubmit, disabled, placeholder, cta }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
      />
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={() => onSubmit(value)}
        className="px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
      >
        <Plus size={14} className="inline mr-1" />
        {cta}
      </button>
    </div>
  );
}

/**
 * Automatic top-up: the choices, the terms, and the switch.
 *
 * ── Three states, and they are not the same state ──────────────────────────
 *
 *   never set up  — no row. Offer it.
 *   set up, on    — say what will happen and offer the off switch.
 *   set up, off   — say WHY it is off. A contractor who switched it off
 *                   themselves and a contractor whose card was declined both
 *                   see `enabled: false`, and showing them the same sentence
 *                   would hide the one thing the second one urgently needs to
 *                   know.
 *
 * ── Why the terms are rendered from the shared builder ─────────────────────
 *
 * buildAutoTopupTerms is the same function that writes the snapshot into the
 * database when the box is ticked. Retyping the wording here would let the
 * screen and the record drift, and the record is the entire point of keeping
 * one — a signed statement that does not match what was on the screen is worse
 * than no statement at all.
 */
function AutoTopupPanel({
  t, money, currency, info, centsPerMinute, topups, companyName,
  open, setOpen, threshold, setThreshold, amount, setAmount,
  accepted, setAccepted, busy, onStart, onToggle, onRemoveCard,
}) {
  const config = info.config;
  const armed = Boolean(config?.enabled);
  const hasCard = Boolean(config?.hasCard);

  // Only shown once BOTH have been chosen. A half-filled authorisation is not
  // something to display terms for — the sentence would name an amount nobody
  // has picked yet.
  const terms =
    threshold && amount
      ? buildAutoTopupTerms({
          thresholdCents: threshold,
          amountCents: amount,
          maxPerDay: info.maxPerDay,
          dailyCents: amount * info.maxPerDay,
          currency,
          companyName: companyName || "",
          language: info.language,
        })
      : null;

  // The wording is only held in English and French. Anyone else is shown it in
  // English and told so, rather than being handed a machine translation of a
  // payment authorisation that nobody fluent has read.
  const termsInEnglishOnly =
    terms && info.language && info.language !== terms.language;

  if (armed) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-3">
        <p className="text-sm font-medium text-foreground">
          {t("app.setVoice.auto.onTitle", "Automatic top-up is on")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setVoice.auto.onBody",
            "When your balance drops below {threshold}, we charge the {brand} ending {last4} {amount} and add the credit straight away. At most {max} times a day.",
            {
              threshold: money(config.thresholdCents),
              amount: money(config.amountCents),
              brand: config.cardBrand || t("app.setVoice.auto.card", "card"),
              last4: config.cardLast4 || "····",
              max: config.maxPerDay,
            },
          )}
        </p>
        {config.acceptedAt && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {t("app.setVoice.auto.agreedOn", "Agreed {date}", {
              date: new Date(config.acceptedAt).toLocaleDateString(),
            })}
            {config.acceptedByName ? ` · ${config.acceptedByName}` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(false)}
            className="px-4 py-2 rounded-full border border-border text-foreground text-sm hover:bg-muted disabled:opacity-50"
          >
            {t("app.setVoice.auto.turnOff", "Turn off automatic top-up")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRemoveCard}
            className="px-4 py-2 rounded-full border border-border text-muted-foreground text-sm hover:bg-muted disabled:opacity-50"
          >
            {t("app.setVoice.auto.removeCard", "Remove the saved card")}
          </button>
        </div>
      </div>
    );
  }

  // ── Off, and it matters which kind of off ────────────────────────────────
  const stopped = config && !config.enabled && config.disabledReason;
  const declined = stopped === "declined";
  const unreachable = stopped === "stripe_unreachable";

  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      {declined || unreachable ? (
        <>
          <p className="inline-flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {declined
              ? t("app.setVoice.auto.declinedTitle", "We switched automatic top-up off — your card was declined")
              : t("app.setVoice.auto.unreachableTitle", "We switched automatic top-up off — we couldn't reach the payment provider")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {declined
              ? t(
                  "app.setVoice.auto.declinedBody",
                  "Nothing was charged, and we have not tried again — retrying a declined card is how a card gets blocked. Sort the card out with your bank, then switch this back on.",
                )
              : t(
                  "app.setVoice.auto.unreachableBody",
                  "Nothing was charged. We stopped rather than keep firing at a fault we can't see. Switch it back on and we'll try again next time your balance runs low.",
                )}
          </p>
          {config.lastFailureMessage && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {t("app.setVoice.auto.reasonGiven", "Reason given:")} {config.lastFailureMessage}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm font-medium text-foreground">
          {t("app.setVoice.auto.offTitle", "Top up automatically")}
        </p>
      )}

      <p className="text-sm text-muted-foreground mt-1">
        {t(
          "app.setVoice.auto.offBody",
          "Save a card and we'll buy more credit on our own when the balance runs low, so the receptionist never stops answering mid-week. Off unless you turn it on.",
        )}
      </p>

      {/* A card is already saved, so switching back on needs no trip to
          Stripe — unless the amounts were changed since the terms were agreed,
          in which case the server refuses and the sentence below says why
          rather than leaving a button that fails. */}
      {hasCard && (
        <>
          <button
            type="button"
            disabled={busy || !config.consentCurrent}
            onClick={() => onToggle(true)}
            className="mt-3 px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {t("app.setVoice.auto.turnBackOn", "Turn it back on")}
          </button>
          {!config.consentCurrent && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {t(
                "app.setVoice.auto.reAgree",
                "The amounts have changed since you agreed. Read the terms and tick the box again to switch it back on.",
              )}
            </p>
          )}
        </>
      )}

      {!open ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(true)}
          className={`mt-3 ${hasCard ? "ml-2 " : ""}px-4 py-2 rounded-full border border-border text-foreground text-sm hover:bg-muted disabled:opacity-50`}
        >
          {hasCard
            ? t("app.setVoice.auto.change", "Change the amounts")
            : t("app.setVoice.auto.setUp", "Set up automatic top-up")}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("app.setVoice.auto.whenLabel", "Top up when the balance drops below")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {info.thresholds.map((option) => (
                <button
                  key={option.cents}
                  type="button"
                  onClick={() => { setThreshold(option.cents); setAccepted(false); }}
                  className={`px-4 py-2 rounded-full border text-sm ${
                    threshold === option.cents
                      ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                  <span className="opacity-70">
                    {" "}· {Math.floor(option.cents / centsPerMinute)} min
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">
              {t("app.setVoice.auto.buyLabel", "and buy this much each time")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topups.map((option) => (
                <button
                  key={option.cents}
                  type="button"
                  onClick={() => { setAmount(option.cents); setAccepted(false); }}
                  className={`px-4 py-2 rounded-full border text-sm ${
                    amount === option.cents
                      ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {option.label}
                  <span className="opacity-70">
                    {" "}· {Math.floor(option.cents / centsPerMinute)} min
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* The terms. Not a link, not a modal, not collapsed — somebody is
              about to authorise a charge to their card without being present,
              and the four things Stripe requires us to state are the four
              things below. A person who has to click to see them is a person
              who did not read them. */}
          {terms && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold text-foreground">{terms.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{terms.intro}</p>
              <ul className="mt-2 space-y-1.5 list-disc pl-4">
                {terms.bullets.map((line, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{line}</li>
                ))}
              </ul>
              {termsInEnglishOnly && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {t(
                    "app.setVoice.auto.englishOnly",
                    "These payment terms are only held in English and French, so they are shown in English. Nothing here is machine-translated.",
                  )}
                </p>
              )}
              <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1"
                />
                <span>{terms.consentLabel}</span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !threshold || !amount || !accepted}
              onClick={onStart}
              className="px-5 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="inline mr-1.5 animate-spin" /> : null}
              {hasCard
                ? t("app.setVoice.auto.confirm", "Save these settings")
                : t("app.setVoice.auto.continue", "Continue to save a card")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setOpen(false); setAccepted(false); }}
              className="px-4 py-2 rounded-full border border-border text-muted-foreground text-sm hover:bg-muted disabled:opacity-50"
            >
              {t("app.action.cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
