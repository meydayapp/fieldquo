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

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

const KIND_LABEL = {
  mobile: "Mobile",
  landline: "Landline",
  unknown: "Nobody has said",
};

/** The refusal codes, in the rep's own words. Mirrors sayRefusal() server-side. */
const WHY = {
  landline_cannot_receive_text:
    "Recorded as a landline. A text to a landline is accepted by the carrier and delivered to nobody — there is no bounce, so nothing would tell you it failed.",
  one_of_ours: "That is one of FieldQuo's own numbers, so there is nothing to reach.",
  not_a_number: "Not a number we can use. Add it again in full, with the country code.",
  not_callable: "Somebody recorded that this one must not be called.",
};

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
}) {
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
          ? "We already had that number — what you said about it is now on the record."
          : "Recorded. It is on the list below.",
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
      setError(err?.message || "That number could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Which number?</h3>
        {choices.length > 1 ? (
          <span className="text-xs text-muted-foreground">{choices.length} to choose from</span>
        ) : null}
      </div>

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
      {choices.length ? (
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
                      {[c.label, KIND_LABEL[c.kind] || c.kind].filter(Boolean).join(" · ")}
                    </span>
                    {c.doubt ? (
                      <span className="block text-xs text-amber-800 dark:text-amber-300 break-words">
                        {c.doubt}
                      </span>
                    ) : null}
                    {/* Whether this one can also be texted, said here rather
                        than discovered on the texting screen. */}
                    <span className="block text-xs text-muted-foreground">
                      {(text.choices || []).some((t) => t.e164 === c.e164)
                        ? "Can be texted too."
                        : "Calls only — a text to this one would not arrive."}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground break-words">
          No number on this record can be rung. Add the one they gave you and the call button
          appears.
        </p>
      )}

      {/* ── What was refused, and why ─────────────────────────────────────── */}
      {(voice.refused || []).length ? (
        <ul className="space-y-1.5">
          {voice.refused.map((r, i) => (
            <li
              key={`${r.e164 || "none"}-${i}`}
              className="rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <span className="flex items-start gap-2">
                <PhoneOff size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">
                  <span className="font-semibold tabular-nums">{r.e164 || r.label || "That entry"}</span>
                  {r.label && r.e164 ? ` — ${r.label}` : ""}
                  <span className="block">{WHY[r.why] || "Not offered for calls."}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── They gave us another one ──────────────────────────────────────── */}
      {disabled ? (
        <p className="text-xs text-muted-foreground break-words">
          This business asked us to stop, so no further numbers are recorded for them.
        </p>
      ) : open ? (
        <form onSubmit={add} className="space-y-2 rounded-lg border border-border bg-card p-3">
          <label className="block text-sm">
            <span className="text-foreground">The number they gave you</span>
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
            <span className="text-foreground">What kind of line is it?</span>
            <select className={FIELD} value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="unknown">They didn&rsquo;t say</option>
              <option value="mobile">A mobile</option>
              <option value="landline">A landline</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-foreground">What would you call it?</span>
            <input
              type="text"
              className={FIELD}
              value={label}
              onChange={(ev) => setLabel(ev.target.value)}
              placeholder="Owner&rsquo;s cell"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Did they say what to use it for?</span>
            <select className={FIELD} value={said} onChange={(ev) => setSaid(ev.target.value)}>
              <option value="">They didn&rsquo;t say</option>
              <option value="call">Call this one</option>
              <option value="text">Text this one</option>
              <option value="both">Call or text it</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground break-words">
            What they told you beats what the line looks like. If they say a landline forwards to
            their phone and to text it, say so here — no lookup knows that.
          </p>
          <div className="flex gap-2">
            <button type="submit" className={`${BTN} bg-primary text-primary-foreground flex-1`} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Save the number
            </button>
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
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
          <Plus size={16} /> They gave us another number
        </button>
      )}

      {/* The listing number is never edited from here, and saying so stops a
          rep hunting for a control that deliberately does not exist. */}
      <p className="text-xs text-muted-foreground break-words">
        <Phone size={12} className="inline mr-1" />
        Adding a number never replaces the one on their listing — that is what every past call,
        text and opt-out is filed against. It goes on the list, and you pick which one rings.
      </p>

      {(voice.refused || []).some((r) => r.why === "landline_cannot_receive_text") ? (
        <p className="text-xs text-amber-800 dark:text-amber-300 break-words">
          <AlertTriangle size={12} className="inline mr-1" />
          One of these is a landline. It can be rung and it cannot be texted, and FieldQuo refuses
          the text rather than reporting one that was never delivered.
        </p>
      ) : null}
    </div>
  );
}
