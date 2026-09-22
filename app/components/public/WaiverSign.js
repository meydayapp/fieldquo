// app/components/public/WaiverSign.js
//
// A waiver as the client reads and signs it: the text in plain numbered
// sections, one acknowledgement box under each (the lines are paired with
// the sections in order; extra lines follow the last section), and a Sign
// panel that stays locked until every box is ticked.
//
// Rendered in two places with the SAME component: on its own at /w/[token]
// (a waiver sent off a job or an invoice) and inside the quote's proposal
// page (a waiver attached to the quote). The lock here is a courtesy for
// the reader; the rule is server-side — lib/waivers/signing.js refuses a
// signature that does not cover every line — and this component treats a
// 400 with `needsAll` as exactly that refusal.
//
// Colour comes from lib/documents/theme.js, measured, the same way the
// quote page does it. Copy from lib/i18n/clientDocCopy.js in the language
// the server resolved; the waiver's own text is shown as written.
"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { documentTheme, fillPair, ruleColor, washPair } from "@/lib/documents/theme";
import SignaturePad from "@/app/components/SignaturePad";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { jsonBody } from "@/lib/jsonBody";

/**
 * @param waiver  { token, title, sections, acknowledgements, status, signedAt, signedName, attachedTo? }
 * @param company { name, brandColor, ... } — for the theme
 * @param language
 * @param embedded  true inside the proposal (no letterhead of its own)
 * @param onSigned  called with the server's answer after a successful sign
 */
export default function WaiverSign({ waiver, company = {}, language = "en", embedded = false, onSigned }) {
  const copy = clientDocCopy(language);
  const fmt = documentFormatters(language, company?.currency);
  const theme = useMemo(() => documentTheme(company), [company]);
  const fill = fillPair(theme);
  const rule = ruleColor(theme);
  const wash = washPair(theme);

  const lines = Array.isArray(waiver?.acknowledgements) ? waiver.acknowledgements : [];
  const sections = Array.isArray(waiver?.sections) ? waiver.sections : [];
  const [ticked, setTicked] = useState(() => new Set());
  const [name, setName] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(waiver?.status === "signed");
  const [signedAt, setSignedAt] = useState(waiver?.signedAt || null);

  const remaining = lines.length - ticked.size;
  const allTicked = lines.length > 0 && remaining === 0;
  const canSign = allTicked && name.trim().length > 1 && Boolean(dataUrl) && consent;

  const toggle = (i) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  async function sign() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/waivers/${waiver.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(
          {
            acknowledgements: [...ticked].sort((a, b) => a - b),
            signature: { name: name.trim(), dataUrl, consent },
          },
          "waiver",
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409 && data?.status === "signed") {
          setSigned(true);
          return;
        }
        throw new Error(data?.error || copy.genericError);
      }
      setSigned(true);
      setSignedAt(data?.signedAt || new Date().toISOString());
      onSigned?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Which line sits under which section: line i under section i; the rest
  // after the last section. A waiver with more sections than lines simply
  // has sections without a box, which is the honest rendering of what the
  // company wrote.
  const lineUnder = (i) => (i < lines.length && i < sections.length ? i : null);
  const trailing = lines.map((_, i) => i).filter((i) => i >= sections.length);

  const box = (i) => {
    const on = ticked.has(i);
    return (
      <label
        key={i}
        className={`mt-2 flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm ${signed ? "" : "cursor-pointer"}`}
        style={{
          borderColor: on || signed ? rule : theme.warning,
          backgroundColor: theme.paper,
          color: theme.ink,
        }}
      >
        <input
          type="checkbox"
          checked={signed ? true : on}
          disabled={signed}
          onChange={() => toggle(i)}
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ accentColor: fill.bg }}
          aria-label={lines[i]}
        />
        <span>{lines[i]}</span>
      </label>
    );
  };

  return (
    <div className={embedded ? "" : "rounded-2xl overflow-hidden border border-black/10 bg-white shadow-sm"} style={{ color: theme.ink }}>
      {!embedded && (
        <>
          <div className="flex h-1.5">
            <div className="flex-[2]" style={{ backgroundColor: rule }} />
            <div className="flex-1" style={{ backgroundColor: theme.accentSoft }} />
          </div>
          <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-black/5">
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name || ""} className="h-9 w-auto max-w-[150px] object-contain" />
            ) : (
              <div className="h-9 w-9 rounded-lg" style={{ backgroundColor: fill.bg }} />
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate">{company?.name}</div>
              {company?.phone && (
                <a href={`tel:${company.phone}`} className="text-xs" style={{ color: theme.inkMuted }}>
                  {company.phone}
                </a>
              )}
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: theme.accentText }}>
                {copy.waiverKicker}
              </div>
              {waiver?.attachedTo && (
                <div className="text-xs" style={{ color: theme.inkMuted }}>
                  {copy.waiverAttachedTo(waiver.attachedTo)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className={embedded ? "" : "px-5 sm:px-6 py-5"}>
        <h3 className="text-lg font-semibold">{waiver?.title}</h3>
        {!signed && (
          <p className="text-sm mt-1" style={{ color: theme.inkMuted }}>
            {copy.waiverIntro}
          </p>
        )}

        {sections.map((s, i) => (
          <div key={i} className="mt-4">
            <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: theme.accentText }}>
              {i + 1} · {s.heading}
            </p>
            <p className="text-sm leading-relaxed mt-1 whitespace-pre-line">{s.text}</p>
            {lineUnder(i) !== null && box(lineUnder(i))}
          </div>
        ))}
        {trailing.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: theme.accentText }}>
              {copy.waiverAcknowledgements}
            </p>
            {trailing.map(box)}
          </div>
        )}

        {signed ? (
          <div className="mt-5 rounded-xl px-4 py-4 text-center border" style={{ backgroundColor: theme.positiveWash, borderColor: "#bbf7d0" }}>
            <p className="font-semibold" style={{ color: theme.positive }}>
              {copy.waiverSignedTitle}
            </p>
            <p className="text-sm mt-1" style={{ color: theme.positive }}>
              {waiver?.signedName && signedAt
                ? copy.waiverSignedBy(waiver.signedName, fmt.date(signedAt))
                : copy.waiverSignedBody(company?.name || "")}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border px-4 py-4" style={{ backgroundColor: wash.bg, borderColor: theme.accentRule }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold" style={{ color: wash.ink }}>
                {copy.waiverSign}
              </span>
              <span className="text-xs" style={{ color: wash.muted }}>
                {copy.waiverAcknowledged(ticked.size, lines.length)}
              </span>
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 mt-3 ${allTicked ? "" : "opacity-60"}`}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: wash.ink }}>
                  {copy.yourFullName}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={copy.typeYourName}
                  disabled={!allTicked}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm min-h-11"
                  style={{ color: theme.ink }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: wash.ink }}>
                  {copy.signature}
                </label>
                {allTicked ? (
                  <SignaturePad onChange={setDataUrl} height={96} />
                ) : (
                  <div className="h-24 rounded-md border border-black/15 bg-white flex items-center justify-center text-xs" style={{ color: theme.inkMuted }}>
                    {copy.signature}
                  </div>
                )}
              </div>
            </div>
            <label className={`flex items-start gap-2 mt-3 text-xs ${allTicked ? "" : "opacity-60"}`} style={{ color: wash.ink }}>
              <input
                type="checkbox"
                checked={consent}
                disabled={!allTicked}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: fill.bg }}
              />
              <span>{copy.waiverConsent}</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={sign}
                disabled={!canSign || busy}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold min-h-11 disabled:cursor-not-allowed"
                // The locked state is the neutral chip, not a faded brand
                // colour: a faded button at 60% is exactly how a mid-tone
                // brand falls under 4.5:1 on the one control this page
                // exists to unlock.
                style={canSign ? { backgroundColor: fill.bg, color: fill.fg } : { backgroundColor: "#4b5563", color: "#ffffff" }}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : canSign ? <Check size={15} /> : <Lock size={14} />}
                {copy.signWaiver}
              </button>
              {!allTicked && (
                <span className="text-xs" style={{ color: theme.warning }}>
                  {copy.waiverTickRemaining(remaining)}
                </span>
              )}
            </div>
            {error && (
              <p className="text-sm mt-3" style={{ color: theme.negative }}>
                {error}
              </p>
            )}
          </div>
        )}
        {!signed && (
          <p className="text-xs mt-3" style={{ color: theme.inkMuted }}>
            {copy.waiverAfterNote}
          </p>
        )}
      </div>
    </div>
  );
}
