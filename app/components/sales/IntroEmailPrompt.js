// app/components/sales/IntroEmailPrompt.js
//
// "Send {business} the intro email?" — the pop-up after a call rang out or
// went to voicemail.
//
// ══ When it opens, and when it does not ═══════════════════════════════════
//
// CallPanel opens it in exactly two places: when the line auto-logs an
// outbound call as no_answer, and when the rep saves a voicemail outcome.
// The table is lib/sales/outreach/introLink.js INTRO_EMAIL_ASK_CODES, and
// scripts/check-sales-intro-email.mjs holds CallPanel to it. text_instead
// never opens it (the composer opens instead); a reached outcome never does.
//
// ══ It asks the server what it may offer ══════════════════════════════════
//
// On open it GETs /api/sales/intro-email, which returns the addresses on the
// record — each judged: on the do-not-contact list, sent one in the last
// fourteen days — the default language, and the reason nothing can go when
// that is the case (no address, mailbox not connected). The dialog prints
// the reason in place of the Send button; it never renders a Send that the
// server would refuse for a reason it already knew. The POST decides all of
// it again.
//
// ══ The address is editable ═══════════════════════════════════════════════
//
// The lead's address is pre-selected; a second address on the record is a
// second radio; "another address" is a field. A typed address is saved on
// the lead by the server before the send (lib/sales/contact/record.js) —
// except for a test account, where the dialog says it will not be.
//
// AlertDialog: Escape and the scrim are "Not now", because a stray tap
// here costs one email the rep can send from the lead page a minute later.
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import AlertDialog from "@/app/components/AlertDialog";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { INTRO_EMAIL_LANGUAGES } from "@/lib/sales/outreach/introLanguages";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD = "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const TYPED = "__typed__";

/** The catalogue key for a server refusal code — every code the offer can send. */
export const INTRO_REFUSAL_KEYS = Object.freeze({
  no_email: "app.salesIntro.refusal.no_email",
  suppressed: "app.salesIntro.refusal.suppressed",
  mailbox: "app.salesIntro.refusal.mailbox",
  links: "app.salesIntro.refusal.links",
  recent: "app.salesIntro.refusal.recent",
  not_yours: "app.salesIntro.refusal.not_yours",
  unreadable: "app.salesIntro.refusal.unreadable",
  test_account: "app.salesIntro.refusal.test_account",
  do_not_contact: "app.salesIntro.refusal.suppressed",
});

/**
 * @param target  `{ leadId, prospectId, attemptId, businessName }` or null (closed).
 * @param onClose called on Not now, Escape, the scrim, and after a send.
 * @param onSent  called with the POST's result after a send.
 */
export default function IntroEmailPrompt({ target, onClose, onSent = null }) {
  const { t } = useTranslation();
  const open = Boolean(target);
  const [offer, setOffer] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sendRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setOffer(null);
    setLoadError("");
    setError("");
    setTyped("");
    const q = new URLSearchParams();
    if (target.leadId) q.set("leadId", target.leadId);
    else if (target.prospectId) q.set("prospectId", target.prospectId);
    fetchJson(`/api/sales/intro-email?${q}`)
      .then((body) => {
        if (cancelled) return;
        setOffer(body);
        setChoice(body?.defaultAddress || TYPED);
        setLanguage(INTRO_EMAIL_LANGUAGES.includes(body?.defaultLanguage) ? body.defaultLanguage : "en");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || t("app.salesIntro.loadFailed"));
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the target's ids: the same business re-opened is a fresh offer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.leadId, target?.prospectId, target?.attemptId]);

  if (!open) return null;

  const business = target.businessName || offer?.businessName || "";
  const address = choice === TYPED ? typed.trim() : choice;
  const candidates = Array.isArray(offer?.candidates) ? offer.candidates : [];
  const chosen = candidates.find((c) => c.address === choice) || null;
  const refusalText = (r) => (r?.code && INTRO_REFUSAL_KEYS[r.code] ? t(INTRO_REFUSAL_KEYS[r.code]) : r?.error || "");
  const canSend = Boolean(offer) && !offer.refusal && Boolean(address) && !chosen?.refusal && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson("/api/sales/intro-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: target.leadId || undefined,
          prospectId: target.leadId ? undefined : target.prospectId || undefined,
          attemptId: target.attemptId || undefined,
          toAddress: address,
          language,
        }),
      });
      onSent?.(result);
      onClose?.();
    } catch (err) {
      const code = err?.code;
      setError(code && INTRO_REFUSAL_KEYS[code] ? t(INTRO_REFUSAL_KEYS[code]) : err?.message || t("app.salesIntro.sendFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      role="dialog"
      labelledBy="intro-email-title"
      describedBy="intro-email-body"
      initialFocusRef={sendRef}
      onEscape={onClose}
      onScrim={onClose}
      scrimLabel={t("app.salesIntro.notNow")}
      wrapperProps={{ "data-intro-email-prompt": "" }}
    >
      <div className="flex items-start gap-3">
        <Mail size={20} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <h2 id="intro-email-title" className="text-base font-semibold text-foreground break-words">
            {t("app.salesIntro.title", { business })}
          </h2>
          <p id="intro-email-body" className="text-sm text-muted-foreground break-words">
            {t("app.salesIntro.body")}
          </p>
        </div>
      </div>

      {!offer && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t("app.salesIntro.checking")}
        </p>
      ) : null}

      {loadError ? (
        <div className="flex gap-2 rounded-lg border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/50 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-50 break-words" role="alert">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {offer?.refusal ? (
        <div className="flex gap-2 rounded-lg border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/50 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-50 break-words" role="alert" data-intro-email-refusal={offer.refusal.code}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{refusalText(offer.refusal)}</span>
        </div>
      ) : null}

      {offer && !offer.refusal ? (
        <div className="space-y-3">
          {offer.notice ? (
            <p className="text-sm text-amber-900 dark:text-amber-200 break-words" data-intro-email-notice={offer.notice.code}>
              {refusalText(offer.notice)}
            </p>
          ) : null}
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">{t("app.salesIntro.toLabel")}</legend>
            {candidates.map((c) => (
              <label key={c.address} className="flex items-start gap-2 text-sm">
                <input type="radio" name="intro-email-to" className="mt-1" checked={choice === c.address} onChange={() => setChoice(c.address)} />
                <span className="min-w-0">
                  <span className="block break-all text-foreground">{c.address}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`app.salesIntro.source.${c.source}`)}
                    {c.refusal ? ` · ${refusalText(c.refusal)}` : ""}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="intro-email-to" className="mt-1" checked={choice === TYPED} onChange={() => setChoice(TYPED)} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-foreground">{t("app.salesIntro.anotherAddress")}</span>
                {choice === TYPED ? (
                  <input
                    type="email"
                    className={FIELD}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoFocus
                    data-intro-email-typed
                  />
                ) : null}
                {choice === TYPED ? (
                  <span className="block text-xs text-muted-foreground">
                    {offer.typedIsSaved ? t("app.salesIntro.typedSaved") : t("app.salesIntro.typedNotSaved")}
                  </span>
                ) : null}
              </span>
            </label>
          </fieldset>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("app.salesIntro.languageLabel")}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("app.salesIntro.languageLabel")}>
              {INTRO_EMAIL_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={language === code}
                  className={`${BTN} min-h-[40px] ${language === code ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}
                  onClick={() => setLanguage(code)}
                  data-intro-email-language={code}
                >
                  {t(`app.salesIntro.language.${code}`)}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-lg border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/50 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-50 break-words" role="alert" data-intro-email-error>
              <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        {offer && !offer.refusal ? (
          <button ref={sendRef} type="button" className={`${BTN} bg-primary text-primary-foreground flex-1`} disabled={!canSend} onClick={send} data-intro-email-send>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {t("app.salesIntro.send")}
          </button>
        ) : null}
        <button type="button" className={`${BTN} border border-border bg-card text-foreground ${offer && !offer.refusal ? "" : "flex-1"}`} onClick={onClose} data-intro-email-not-now>
          {t("app.salesIntro.notNow")}
        </button>
      </div>
    </AlertDialog>
  );
}
