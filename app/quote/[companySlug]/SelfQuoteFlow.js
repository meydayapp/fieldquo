// app/quote/[companySlug]/SelfQuoteFlow.js
//
// The form itself. Three steps, in the order a stranger will tolerate.
//
// ── Why the service comes first and contact details come last ───────────────
//
// The instinct is to ask for name and email up front, because that's the thing
// the company actually wants. It's also the fastest way to lose someone: a
// form that opens with "email address" from a company you were only curious
// about gets closed.
//
// Picking a service is a low-commitment tap that answers a question the
// visitor already knows the answer to. By the time they've told you it's a
// kitchen with forty doors, they've invested enough to finish. This is the
// same reason the internal builder starts with the client and this one ends
// with them — different audiences, opposite order.
//
// ── No prices ───────────────────────────────────────────────────────────────
//
// This produces a LEAD, not a quote. The endpoint returns no rates and this
// page shows none. A self-serve figure a contractor hasn't seen is one they
// may have to honour, and publishing a rate card openly hands it to every
// competitor in the city. What it does instead is arrive at the callback with
// the size of the job already known.
//
// ── The confirmation is a document, not a receipt ───────────────────────────
//
// It used to be four lines of centred text. The next thing that homeowner sees
// from this company is their actual quote — brand rule across the top, logo
// left, document word and reference right, a "prepared for" panel, then the
// substance — and the two bore no family resemblance at all. So the
// confirmation is composed from lib/selfQuote/confirmation.js, the same
// description the confirmation EMAIL renders, and laid out in the same order
// as /q/[token] and the PDF.
//
// Colours come from lib/documents/theme.js rather than the raw brand hex.
// That is a deliberate difference from the approval page next door, which
// still paints headings with `color: brandColor` unmeasured — a company whose
// brand is pale yellow gets an invisible heading there. accentText, fillPair
// and inkMutedOnWash are all measured at 4.5:1, including against the
// near-white and mid-grey brands real companies in this database have picked.
//
// ── Renders inside an iframe ────────────────────────────────────────────────
//
// Same constraint as the booking flow: no fixed positioning, no viewport-
// height units, no assumption about surrounding width.
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, ArrowLeft, Building2, AlertCircle } from "lucide-react";
import { documentTheme, fillPair, ruleColor } from "@/lib/documents/theme";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { LANGUAGES } from "@/app/i18n/languages";
import { formatPhoneInput } from "@/lib/validation";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import MediaUploader from "@/app/components/MediaUploader";
import BookVisitPanel from "@/app/components/public/BookVisitPanel";
import {
  buildConfirmation,
  budgetOptions,
  currencySymbol,
  timelineOptions,
} from "@/lib/selfQuote/confirmation";

export default function SelfQuoteFlow({ companySlug }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [details, setDetails] = useState({});
  // The two universal qualifiers — the whole point of the leads triage. Kept out
  // of `details` (which is per-service intake) so they're always asked.
  const [budgetBand, setBudgetBand] = useState("");
  const [timeline, setTimeline] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState([]); // photos/videos of the job
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    // Filled by the address autocomplete, never by a field the homeowner sees
    // — this form asks a stranger for as little as possible. They ride along
    // to the lead and become the client's jurisdiction when the office
    // converts it, which is the difference between a quote that charges tax
    // and one that silently doesn't (lib/tax/documentTax.js).
    city: "",
    province: "",
    country: "",
  });

  // The language the resulting LEAD — and the quote it becomes — is created in.
  // Null until the company's list arrives, then its primary. Never inferred
  // from the browser: the document is the contractor's, and the list of
  // languages they send in is theirs to state.
  const [language, setLanguage] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // the server's reply, once sent

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/self-quote/${companySlug}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(d?.error || "");
        setData(d);
        setLanguage(d.languages?.[0] || "en");
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const lang = language || data?.languages?.[0] || "en";
  const copy = clientDocCopy(lang).selfQuote;
  const c = useMemo(() => data?.company || {}, [data]);
  const theme = useMemo(() => documentTheme(c), [c]);
  const fill = useMemo(() => fillPair(theme), [theme]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    // Checked here as well as server-side, because being told "provide an
    // email or phone" after a page reload is how people give up.
    if (!contact.name.trim()) return setError(copy.errName);
    if (!contact.email.trim() && !contact.phone.trim()) {
      return setError(copy.errContact);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/self-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          ...contact,
          categoryId: service?.id || null,
          description,
          details,
          budgetBand: budgetBand || null,
          timeline: timeline || null,
          // The server re-validates this against the company's own send
          // languages; it is not trusted here.
          language: lang,
          media,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || copy.errSend);
      setDone(d || {});
    } catch (err) {
      setError(err.message || copy.errSend);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell theme={theme}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-black/10 rounded w-1/3" />
          <div className="h-40 bg-black/10 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    // English only, deliberately: the company never resolved, so there is no
    // send-language list to pick from and guessing would be inventing one.
    return (
      <Shell theme={theme}>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold" style={{ color: theme.ink }}>
            {clientDocCopy("en").selfQuote.linkInvalid}
          </p>
          <p className="text-sm mt-2" style={{ color: theme.inkMuted }}>
            {clientDocCopy("en").selfQuote.linkInvalidHint}
          </p>
        </div>
      </Shell>
    );
  }

  const services = data.services || [];
  const languages = data.languages || [lang];

  if (done) {
    return (
      <Shell theme={theme}>
        <Confirmation
          doc={buildConfirmation({
            company: c,
            contact,
            service,
            details,
            description,
            budgetBand,
            timeline,
            language: lang,
            submittedAt: done.submittedAt || new Date(),
          })}
          company={c}
          theme={theme}
          fill={fill}
          emailed={Boolean(done.emailed && contact.email)}
          contactEmail={contact.email}
        />

        {/* ── Book the visit, while they're still here ──────────────────────
            The lead is already saved by this point, so nothing below can lose
            it — that's why this sits AFTER the submit rather than inside the
            form. A calendar in the middle of a lead form is a second thing to
            fail before the company gets a name.

            Rendered in place rather than linked, for two reasons. A navigation
            away from a confirmation is where people leave; and the details
            they just typed can be carried into it as props, which a link
            cannot do without putting a name, email and phone number in a URL.

            Only shown when the company can actually take a booking. If they
            have no active event types, or have switched the visit mode off,
            this is silently absent rather than a button onto an empty
            calendar. */}
        {data.booking?.canBookVisit && (
          <BookVisitPanel
            slug={data.booking.slug}
            contact={contact}
            theme={{ wash: theme.accentWash, ink: theme.inkOnWash, inkMuted: theme.inkMutedOnWash }}
            fill={fill}
            copy={{ title: copy.bookVisitTitle, body: copy.bookVisitBody, cta: copy.bookVisitCta }}
          />
        )}
      </Shell>
    );
  }

  return (
    <Shell theme={theme}>
      <Card theme={theme}>
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5 flex items-center gap-3">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logoUrl}
              alt={c.name}
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: fill.bg, color: fill.fg }}
            >
              <Building2 size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold truncate"
              style={{ color: theme.ink }}
            >
              {c.name}
            </div>
            <div className="text-xs" style={{ color: theme.inkMuted }}>
              {copy.eyebrow}
            </div>
          </div>

          {/* Only when there is a choice. A picker with one option is a
              control that appears to do something and doesn't — and at the
              time of writing every company reads as one language, because
              nothing in the product writes Company.sendLanguages yet. */}
          {languages.length > 1 && (
            <LanguagePicker
              value={lang}
              options={languages}
              label={copy.languageLabel}
              theme={theme}
              onChange={setLanguage}
            />
          )}
        </div>

        {/* Progress. Three dots rather than a bar: a bar implies a percentage
            and invites the question "how much is left", which the answer
            "two more taps" answers better. */}
        <div className="px-6 sm:px-8 pt-4 flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: n <= step ? ruleColor(theme) : theme.accentWashStrong,
              }}
            />
          ))}
        </div>

        <div className="px-6 sm:px-8 py-5">
          {/* ── 1. What do you need? ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="font-semibold mb-1" style={{ color: theme.ink }}>
                {copy.step1Title}
              </h2>
              <p className="text-sm mb-4" style={{ color: theme.inkMuted }}>
                {copy.step1Hint}
              </p>

              {services.length === 0 ? (
                <p className="text-sm" style={{ color: theme.inkMuted }}>
                  {copy.noServices(c.phone)}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setService(s);
                        setDetails({});
                        setStep(2);
                      }}
                      className="text-left rounded-xl border border-black/10 px-4 py-3 text-sm font-medium hover:border-black/25 transition-colors"
                      style={
                        service?.id === s.id
                          ? {
                              borderColor: ruleColor(theme),
                              backgroundColor: theme.accentWash,
                              color: theme.ink,
                            }
                          : { color: theme.ink }
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 2. How big is it? ────────────────────────────────────── */}
          {step === 2 && service && (
            <>
              <BackLink onClick={() => setStep(1)} theme={theme} label={copy.back} />
              <h2 className="font-semibold mb-1" style={{ color: theme.ink }}>
                {service.label}
              </h2>
              <p className="text-sm mb-4" style={{ color: theme.inkMuted }}>
                {copy.step2Hint}
              </p>

              {service.fields?.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {service.fields.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs" style={{ color: theme.inkMuted }}>
                        {f.label}
                      </label>
                      {f.type === "select" ? (
                        <select
                          value={details[f.key] || ""}
                          onChange={(e) =>
                            setDetails((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm bg-white"
                          style={{ color: theme.ink }}
                        >
                          <option value="">—</option>
                          {(f.options || []).map((o) => (
                            <option key={o} value={o}>
                              {String(o).replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={details[f.key] || ""}
                          onChange={(e) =>
                            setDetails((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm"
                          style={{ color: theme.ink }}
                          placeholder="0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* The two qualifiers. Chip rows rather than selects: on a phone a
                  tap beats a native picker, and seeing all the options at once
                  is what makes people actually answer. */}
              <div className="mb-4">
                <label className="text-xs" style={{ color: theme.inkMuted }}>
                  {copy.timelineLabel}
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {timelineOptions(copy).map((o) => (
                    <ChipButton
                      key={o.key}
                      active={timeline === o.key}
                      theme={theme}
                      onClick={() =>
                        setTimeline((v) => (v === o.key ? "" : o.key))
                      }
                    >
                      {o.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs" style={{ color: theme.inkMuted }}>
                  {copy.budgetLabel}{" "}
                  <span style={{ color: theme.inkFaint }}>{copy.optional}</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {budgetOptions(copy, currencySymbol(c.currency)).map((o) => (
                    <ChipButton
                      key={o.key}
                      active={budgetBand === o.key}
                      theme={theme}
                      onClick={() =>
                        setBudgetBand((v) => (v === o.key ? "" : o.key))
                      }
                    >
                      {o.label}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <label className="text-xs" style={{ color: theme.inkMuted }}>
                {copy.notesLabel}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={copy.notesPlaceholder}
                className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm"
                style={{ color: theme.ink }}
              />

              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full mt-4 py-3 rounded-full text-sm font-bold"
                style={{ backgroundColor: fill.bg, color: fill.fg }}
              >
                {copy.continueCta}
              </button>
            </>
          )}

          {/* ── 3. Where do we send it? ──────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={submit}>
              <BackLink onClick={() => setStep(2)} theme={theme} label={copy.back} />
              <h2 className="font-semibold mb-1" style={{ color: theme.ink }}>
                {copy.step3Title}
              </h2>
              <p className="text-sm mb-4" style={{ color: theme.inkMuted }}>
                {copy.step3Hint}
              </p>

              <div className="space-y-3">
                <input
                  required
                  value={contact.name}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder={copy.namePlaceholder}
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                  style={{ color: theme.ink }}
                />
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder={copy.emailPlaceholder}
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                  style={{ color: theme.ink }}
                />
                {/* Formatted as they type, with the same helper five back-office
                    pages use — so a number typed here and a number typed by
                    staff are stored the same way and neither looks like the
                    odd one out on the lead. */}
                <input
                  type="tel"
                  inputMode="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    setContact((p) => ({
                      ...p,
                      phone: formatPhoneInput(e.target.value),
                    }))
                  }
                  placeholder={copy.phonePlaceholder}
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                  style={{ color: theme.ink }}
                />
                {/* Google autocomplete, and it DEGRADES: with no Maps key, or
                    with Google blocked, this is a plain text input that still
                    accepts a typed address and still submits. Gating the form
                    on a third-party script would strand a stranger in a
                    driveway on a bad connection. */}
                <AddressAutocomplete
                  value={contact.address}
                  onChange={(v) => setContact((p) => ({ ...p, address: v }))}
                  // address-jurisdiction: keeps city, province and country.
                  // This kept `place.address` alone and threw the structured
                  // components away — the shape that produced production rows
                  // like "755 Rue Saint-Louis, Gatineau, QC J8T 2S9, Canada"
                  // with city, province and country all null.
                  onPlaceSelected={(place) =>
                    setContact((p) => ({
                      ...p,
                      address: place.address,
                      city: place.city || p.city,
                      province: place.province || p.province,
                      country: place.country || p.country,
                    }))
                  }
                  placeholder={copy.addressPlaceholder}
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                />
                <MediaUploader
                  uploadUrl={`/api/self-quote/${companySlug}/upload`}
                  value={media}
                  onChange={setMedia}
                  // This form runs in the client's own language, so the uploader's
                  // strings come from clientDocCopy rather than the app catalogue —
                  // the homeowner filling it in is not a member of the company and
                  // never sees /app's language setting.
                  label={copy.uploadLabel}
                  hint={copy.uploadHint}
                  documentLabel={copy.uploadDocumentFallback}
                />
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-3 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: fill.bg, color: fill.fg }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {copy.sendCta}
              </button>

              {/* Says what happens next. "Submit" with no follow-through is
                  the reason people fill a form and then ring anyway. */}
              <p
                className="text-xs mt-3 text-center"
                style={{ color: theme.inkMuted }}
              >
                {copy.noObligation(c.name)}
              </p>
            </form>
          )}
        </div>
      </Card>
    </Shell>
  );
}

/**
 * The confirmation, laid out in the order every other document in the product
 * uses: masthead, prepared-for, substance, then what happens next.
 *
 * Everything it says comes from buildConfirmation — the same object the
 * confirmation email renders — so the two cannot drift into saying different
 * things about the same submission.
 */
function Confirmation({ doc, company, theme, fill, emailed, contactEmail }) {
  const copy = doc.copy;

  return (
    <Card theme={theme}>
      {/* Masthead. Identity left, document facts right — the same shape as
          HeaderSection's, and the word is "Request" because nothing here has
          been priced.

          It WRAPS rather than shrinking. The right-hand block is a translated
          date, and "12 de agosto de 2026" is half again the width of
          "August 12, 2026"; with both sides fixed, the Spanish rendering
          squeezed the company's own name down to "Teac…" inside a 320px
          iframe. Dropping the facts onto their own line costs a few pixels of
          height and keeps the one thing the homeowner must recognise legible. */}
      <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 min-w-0 basis-[58%] grow">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: fill.bg, color: fill.fg }}
            >
              <Building2 size={18} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ color: theme.ink }}>
              {company.name}
            </div>
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="text-xs hover:underline block truncate"
                style={{ color: theme.inkMuted }}
              >
                {company.phone}
              </a>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 ml-auto">
          <div
            className="text-sm font-bold tracking-[0.15em] leading-none uppercase"
            style={{ color: theme.accentText }}
          >
            {doc.masthead.word}
          </div>
          <div className="text-[11px] mt-1.5" style={{ color: theme.inkMuted }}>
            {doc.masthead.referenceLabel}
          </div>
          <div className="text-xs font-semibold" style={{ color: theme.ink }}>
            {doc.masthead.reference}
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            <Check size={18} />
          </div>
          <h1 className="text-lg font-bold" style={{ color: theme.ink }}>
            {doc.title}
          </h1>
        </div>
        <p className="text-sm mt-2" style={{ color: theme.inkMuted }}>
          {doc.intro}
        </p>
        {emailed && contactEmail && (
          <p className="text-sm mt-1" style={{ color: theme.inkMuted }}>
            {copy.copySentTo(contactEmail)}
          </p>
        )}
      </div>

      <div className="px-6 sm:px-8 pb-6 space-y-5">
        {/* Prepared for — the shared panel's shape, in their colour. */}
        {(doc.client.name || doc.client.address) && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: theme.accentWash }}
          >
            <p
              className="text-[10px] font-bold tracking-wider uppercase"
              style={{ color: theme.inkFaint }}
            >
              {doc.preparedForLabel}
            </p>
            {doc.client.name && (
              <p
                className="text-base font-semibold mt-0.5"
                style={{ color: theme.inkOnWash }}
              >
                {doc.client.name}
              </p>
            )}
            {doc.client.address && (
              <p className="text-xs" style={{ color: theme.inkMutedOnWash }}>
                {doc.client.address}
              </p>
            )}
            {[doc.client.email, doc.client.phone].filter(Boolean).length > 0 && (
              // break-words: this is the email the visitor just typed into
              // step 3, with no length limit and no spaces to wrap at. This
              // card is also the narrowest place it's echoed back — inside a
              // 600px iframe, half-width on the confirmation screen — so a
              // long one is the most likely to overflow here first.
              <p className="text-xs break-words" style={{ color: theme.inkMutedOnWash }}>
                {[doc.client.email, doc.client.phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        )}

        {/* What they asked for — the scope card's shape, without a price
            column, because there is no price. */}
        {(doc.requested.title ||
          doc.requested.lines.length > 0 ||
          doc.requested.note) && (
          <div
            className="rounded-xl overflow-hidden border border-black/10"
            style={{ borderLeft: `3px solid ${ruleColor(theme)}` }}
          >
            <div
              className="px-4 py-3"
              style={{ backgroundColor: theme.accentWash }}
            >
              <p
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ color: theme.inkFaint }}
              >
                {doc.requested.heading}
              </p>
              {doc.requested.title && (
                <h2
                  className="font-semibold mt-0.5"
                  style={{ color: theme.inkOnWash }}
                >
                  {doc.requested.title}
                </h2>
              )}
            </div>

            {(doc.requested.lines.length > 0 || doc.requested.note) && (
              <div className="px-4 py-3 space-y-1.5">
                {doc.requested.lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex justify-between gap-4 text-sm"
                    style={{ color: theme.ink }}
                  >
                    <span style={{ color: theme.inkMuted }}>{l.label}</span>
                    <span className="font-medium text-right">{l.value}</span>
                  </div>
                ))}
                {doc.requested.note && (
                  <p
                    className="text-sm whitespace-pre-wrap leading-relaxed pt-2"
                    style={{ color: theme.ink }}
                  >
                    {doc.requested.note}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* The figure, or the deliberate absence of one. `show` is false on
            every self-quote — the endpoint has no rates — so this reads as a
            decision rather than as a total that failed to load. */}
        {doc.amount.show ? (
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            <span className="text-sm font-bold tracking-wide uppercase">
              {doc.amount.label}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {doc.amount.value}
            </span>
          </div>
        ) : (
          <p className="text-xs leading-relaxed" style={{ color: theme.inkMuted }}>
            {doc.amount.note}
          </p>
        )}

        {/* What happens next — ProcessStepsSection's shape: numbered bubbles
            in their colour, joined by a rule. */}
        <div className="pt-1">
          <h3
            className="text-xs font-bold tracking-wider mb-3 uppercase"
            style={{ color: theme.accentText }}
          >
            {doc.nextSteps.heading}
          </h3>
          <ol className="space-y-0">
            {doc.nextSteps.steps.map((s, i) => {
              const last = i === doc.nextSteps.steps.length - 1;
              return (
                <li key={s.num} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={{ backgroundColor: fill.bg, color: fill.fg }}
                    >
                      {s.num}
                    </span>
                    {!last && (
                      <span
                        className="w-px flex-1 my-1"
                        style={{ backgroundColor: theme.accentRule }}
                      />
                    )}
                  </div>
                  <div className={last ? "pb-0" : "pb-4"}>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: theme.ink }}
                    >
                      {s.title}
                    </p>
                    <p
                      className="text-xs leading-relaxed mt-0.5"
                      style={{ color: theme.inkMuted }}
                    >
                      {s.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {company.phone && (
        <div
          className="px-6 sm:px-8 py-5 border-t border-black/5"
          style={{ backgroundColor: theme.accentWash }}
        >
          <p className="text-sm" style={{ color: theme.inkMutedOnWash }}>
            {copy.callInstead}{" "}
            <a
              href={`tel:${company.phone}`}
              className="underline font-semibold"
              style={{ color: theme.inkOnWash }}
            >
              {company.phone}
            </a>
          </p>
        </div>
      )}
    </Card>
  );
}

function LanguagePicker({ value, options, label, theme, onChange }) {
  return (
    <label className="shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="border border-black/15 rounded-lg pl-2 pr-6 py-1.5 text-xs bg-white"
        style={{ color: theme.ink }}
      >
        {options.map((code) => {
          const meta = LANGUAGES.find((l) => l.code === code);
          return (
            <option key={code} value={code}>
              {meta?.nativeName || code.toUpperCase()}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Shell({ theme, children }) {
  // Padding rather than min-h-screen: this renders inside a 600px iframe as
  // often as it does standalone.
  return (
    <div className="py-8 px-4" style={{ backgroundColor: theme.page }}>
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}

function Card({ theme, children }) {
  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm border"
      style={{ borderColor: theme.border }}
    >
      {/* The brand rule, first mark on the card — the same device as the top
          of the PDF. ruleColor, not the raw hex: a near-white brand would
          otherwise draw an invisible line and read as a rendering fault. */}
      <div className="flex h-1.5">
        <div className="flex-[2]" style={{ backgroundColor: ruleColor(theme) }} />
        <div className="flex-1" style={{ backgroundColor: theme.accentSoft }} />
      </div>
      {children}
    </div>
  );
}

function ChipButton({ active, theme, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
      style={
        active
          ? {
              borderColor: ruleColor(theme),
              backgroundColor: theme.accentWash,
              color: theme.inkOnWash,
            }
          : { borderColor: "rgba(0,0,0,0.15)", color: theme.ink }
      }
    >
      {children}
    </button>
  );
}

function BackLink({ onClick, theme, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // py-2, not zero: a text-xs label with no padding is a tap target the
      // height of one line, well under 44px, on the one control that steps
      // back through this three-step form on a phone. (Not combined with a
      // negative margin on the same edge as mb-3 — two utilities writing the
      // same CSS property have their winner decided by Tailwind's
      // stylesheet order, not by position in this className string, which
      // is a fragile thing to rely on for a few pixels of spacing.)
      className="inline-flex items-center gap-1 text-xs mb-3 py-2"
      style={{ color: theme.inkMuted }}
    >
      <ArrowLeft size={13} /> {label}
    </button>
  );
}
