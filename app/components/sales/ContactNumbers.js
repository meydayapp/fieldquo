// app/components/sales/ContactNumbers.js
//
// "Call him on his cell" — written down while the rep is still on the phone,
// and then ringable.
//
// ══ Why this is one component on two screens ══════════════════════════════
//
// The queue works a discovered Prospect and the lead screen works a rep's own
// SalesLead, and both need the identical thing: the list of numbers, which one
// is about to be used, why a number is not on offer, and a short form for the
// one somebody just read out. DialRegion's header already argues the case
// against pasting a region onto a second screen — the copy is the one that
// rots — and it applies here unchanged.
//
// ══ Why the form is four fields and not a wizard ══════════════════════════
//
// The rep is on the phone WHILE typing this. Anything that takes a second
// screen gets written on a Post-it instead. So: the number, what kind of line
// it is, what to call it, and what they said about calling or texting it.
//
// ══ "They didn't say" is an answer, and it is the default ═════════════════
//
// canCall / canText are three-valued in the database and three-valued here.
// Defaulting the pair to "yes" would invent a statement nobody made — AGENTS.md
// failure class #5 — and defaulting them to "no" would make every number
// unusable until somebody re-edited it. Blank means blank, and the kind
// decides: a landline is callable and not textable, a mobile is both, an
// unknown line is offered for both with the doubt printed beside it.
//
// ══ A refused number is SHOWN, with the reason ════════════════════════════
//
// lib/sales/contact/numbers.js says why: a rep who was handed a number and
// cannot find it on the screen will phone it from their own handset, which is
// a call nothing records, no calling window governs, and no do-not-contact
// list can stop. Better to show it beside the sentence explaining why FieldQuo
// will not place that call.
"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, Phone, PhoneOff, Plus, Star } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

// The two lookups below were plain objects keyed by the stored value. They are
// spelled out as branches now that the text is translated, because a key built
// by pasting the stored value onto a prefix is invisible to the translation
// scan — a label that renders as its own key is the failure that scan exists
// for. Both still return null for a value nobody has taught them, so the caller
// keeps its own fallback.
function kindLabel(t, kind) {
  if (kind === "mobile") return t("app.salesDial.kindMobile");
  if (kind === "landline") return t("app.salesDial.kindLandline");
  if (kind === "unknown") return t("app.salesDial.kindUnknown");
  return null;
}

/** The refusal codes, in the rep's own words. Mirrors sayRefusal() server-side. */
function refusalReason(t, why) {
  if (why === "landline_cannot_receive_text") return t("app.salesDial.whyLandlineNoText");
  if (why === "one_of_ours") return t("app.salesDial.whyOneOfOurs");
  if (why === "not_a_number") return t("app.salesDial.whyNotANumber");
  if (why === "not_callable") return t("app.salesDial.whyNotCallable");
  return null;
}

/**
 * The number picker and the "they gave us another one" form.
 *
 * @param prospectId  set when this is the queue's claimed prospect.
 * @param leadId      set when this is the rep's own lead. The server works out
 *                    which record a number hangs on — see the numbers route.
 * @param numbers     the payload block: { stored, voice, text }. Computed
 *                    server-side, because reach is a rule and a screen that
 *                    worked it out for itself would be a second opinion.
 * @param selectedId  the stored number the rep has picked, or "" for the one
 *                    at the top of the list.
 * @param onSelect    ({ id, e164, label }) — the parent owns which number is
 *                    about to be rung, because the parent owns the dial.
 * @param onChanged   called after a write, so the parent re-reads the record.
 * @param disabled    true while the whole record cannot be contacted, so the
 *                    form is not offered against a do-not-contact.
 */
export default function ContactNumbers({
  prospectId = null,
  leadId = null,
  numbers = null,
  selectedId = "",
  onSelect,
  onChanged,
  disabled = false,
  // ── Which parts to draw ──────────────────────────────────────────────
  //
  // "choose" is the heading, the radio list and the refused numbers;
  // "add" is the "they gave us another one" control and its form. Both by
  // default — the lead screen draws the whole thing in one place. The queue
  // console draws "choose" in the Dialer card (where the Call button is) and
  // "add" in the Contact card (where the person is), as two instances of
  // THIS component: same route, same refusal sentences, same saved notice,
  // no second copy of either.
  // "refused" — the numbers the server would not offer, with the reason —
  // is part of "choose" unless named alone: the console's Dialer card draws
  // its own list of choices (DialerPad) and asks only for the refusals.
  parts = ["choose", "add"],
}) {
  const { t } = useTranslation();
  const show = (part) => parts.includes(part);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [e164, setE164] = useState("");
  const [kind, setKind] = useState("unknown");
  const [label, setLabel] = useState("");
  const [said, setSaid] = useState("");

  const voice = numbers?.voice || { choices: [], refused: [] };
  const text = numbers?.text || { choices: [], refused: [] };
  const choices = voice.choices || [];

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const body = await fetchJson("/api/sales/calls/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(prospectId ? { prospectId } : { leadId }),
          e164,
          kind,
          label,
          // "What did they say about it?" maps onto the two three-valued
          // columns. The empty option writes neither, which is the honest
          // record of a rep who was given a number and nothing else.
          ...(said === "call" ? { canCall: true } : {}),
          ...(said === "text" ? { canText: true } : {}),
          ...(said === "both" ? { canCall: true, canText: true } : {}),
        }),
      });
      setSaved(
        body?.updated
          ? t("app.salesDial.numberAlreadyKnown")
          : t("app.salesDial.numberRecorded"),
      );
      setE164("");
      setLabel("");
      setKind("unknown");
      setSaid("");
      setOpen(false);
      onChanged?.();
    } catch (err) {
      // Never silent. fetchJson throws with the server's own sentence, which
      // for this route names the reason — a number that will not normalise, a
      // business that asked us to stop, a table that is not there yet.
      setError(err?.message || t("app.salesDial.numberNotRecorded"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {show("choose") ? (
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t("app.salesDial.whichNumber")}
        </h3>
        {choices.length > 1 ? (
          <span className="text-xs text-muted-foreground">
            {t("app.salesDial.numbersToChooseFrom", { count: choices.length })}
          </span>
        ) : null}
      </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-300 break-words">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0" />
          <span className="break-words">{saved}</span>
        </div>
      ) : null}

      {/* ── The choices ───────────────────────────────────────────────────
          Radio rather than a <select>: a rep glancing at this while somebody
          talks needs to see that there are two numbers and what each one is
          for, and a closed dropdown shows neither. */}
      {!show("choose") ? null : choices.length ? (
        <ul className="space-y-1.5">
          {choices.map((c) => {
            const id = c.id || "";
            const on = (selectedId || "") === id;
            return (
              <li key={id || c.e164}>
                <label
                  className={`flex items-start gap-3 rounded-lg border p-3 min-h-[44px] cursor-pointer ${
                    on ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="contact-number"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={on}
                    onChange={() => onSelect?.({ id, e164: c.e164, label: c.label })}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground break-words">
                      {c.preferred ? <Star size={13} className="shrink-0" /> : null}
                      <span className="tabular-nums">{c.e164}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground break-words">
                      {[c.label, kindLabel(t, c.kind) || c.kind].filter(Boolean).join(" · ")}
                    </span>
                    {c.doubt ? (
                      <span className="block text-xs text-amber-800 dark:text-amber-300 break-words">
                        {c.doubt}
                      </span>
                    ) : null}
                    {/* Whether this one can also be texted, said here rather
                        than discovered on the texting screen. */}
                    <span className="block text-xs text-muted-foreground">
                      {(text.choices || []).some((textable) => textable.e164 === c.e164)
                        ? t("app.salesDial.canBeTextedToo")
                        : t("app.salesDial.callsOnlyNoText")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground break-words">
          {t("app.salesDial.noRingableNumber")}
        </p>
      )}

      {/* ── What was refused, and why ─────────────────────────────────────── */}
      {(show("choose") || show("refused")) && (voice.refused || []).length ? (
        <ul className="space-y-1.5">
          {voice.refused.map((r, i) => (
            <li
              key={`${r.e164 || "none"}-${i}`}
              className="rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <span className="flex items-start gap-2">
                <PhoneOff size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  <span className="font-semibold tabular-nums">
                    {r.e164 || r.label || t("app.salesDial.thatEntry")}
                  </span>
                  {r.label && r.e164 ? ` — ${r.label}` : ""}
                  <span className="block">
                    {refusalReason(t, r.why) || t("app.salesDial.whyNotOffered")}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── They gave us another one ──────────────────────────────────────── */}
      {!show("add") ? null : disabled ? (
        <p className="text-xs text-muted-foreground break-words">
          {t("app.salesDial.doNotContactNoNumbers")}
        </p>
      ) : open ? (
        <form onSubmit={add} className="space-y-2 rounded-lg border border-border bg-card p-3">
          <label className="block text-sm">
            <span className="text-foreground">{t("app.salesDial.fieldNumber")}</span>
            <input
              type="tel"
              inputMode="tel"
              required
              className={FIELD}
              value={e164}
              onChange={(ev) => setE164(ev.target.value)}
              placeholder="613 555 0142"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">{t("app.salesDial.fieldKind")}</span>
            <select className={FIELD} value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="unknown">{t("app.salesDial.optionTheyDidntSay")}</option>
              <option value="mobile">{t("app.salesDial.optionAMobile")}</option>
              <option value="landline">{t("app.salesDial.optionALandline")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-foreground">{t("app.salesDial.fieldLabel")}</span>
            <input
              type="text"
              className={FIELD}
              value={label}
              onChange={(ev) => setLabel(ev.target.value)}
              placeholder={t("app.salesDial.fieldLabelPlaceholder")}
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">{t("app.salesDial.fieldSaid")}</span>
            <select className={FIELD} value={said} onChange={(ev) => setSaid(ev.target.value)}>
              <option value="">{t("app.salesDial.optionTheyDidntSay")}</option>
              <option value="call">{t("app.salesDial.optionCallThisOne")}</option>
              <option value="text">{t("app.salesDial.optionTextThisOne")}</option>
              <option value="both">{t("app.salesDial.optionCallOrText")}</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground break-words">
            {t("app.salesDial.saidHint")}
          </p>
          <div className="flex gap-2">
            <button type="submit" className={`${BTN} bg-primary text-primary-foreground flex-1`} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {t("app.salesDial.saveTheNumber")}
            </button>
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {t("app.salesDial.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className={`${BTN} border border-border text-foreground w-full`}
          onClick={() => {
            setOpen(true);
            setSaved("");
          }}
        >
          <Plus size={16} /> {t("app.salesDial.theyGaveAnotherNumber")}
        </button>
      )}

      {/* The listing number is never edited from here, and saying so stops a
          rep hunting for a control that deliberately does not exist. */}
      {show("add") ? (
      <p className="text-xs text-muted-foreground break-words">
        <Phone size={12} className="inline mr-1" />
        {t("app.salesDial.listingNumberNotice")}
      </p>
      ) : null}

      {show("choose") && (voice.refused || []).some((r) => r.why === "landline_cannot_receive_text") ? (
        <p className="text-xs text-amber-800 dark:text-amber-300 break-words">
          <AlertTriangle size={12} className="inline mr-1" />
          {t("app.salesDial.landlineTextNotice")}
        </p>
      ) : null}
    </div>
  );
}
