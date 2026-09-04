// app/book/[companySlug]/BookingFlow.js
//
// Pick a service → pick a time → leave your details. Three steps in one
// component rather than three routes, because this often runs inside a
// 600px iframe on the company's own site, where a full page navigation
// scrolls the *parent* page and loses the visitor's place.
//
// The single most important thing on this page is that a homeowner who is
// mildly annoyed and holding a phone can finish it. Everything else is
// secondary to that.
//
// Colours come from documentTheme — the same palette as the quote, the invoice
// and the emails — so a company's booking page looks like the rest of what
// they send, and so every text/background pair here is measured rather than
// hand-picked. The previous hardcoded #2d2520-at-35%-opacity greys were down
// at 2.1:1 on the weekday headers.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  documentTheme,
  fillPair,
  neutralPair,
  accentIsWashedOut,
} from "@/lib/documents/theme";
import { ensureContrast } from "@/lib/brand/colour";
import { formatPhoneInput } from "@/lib/validation";
import { fetchJson } from "@/lib/fetchJson";
import { navigateTop } from "@/lib/embed/handoff";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { useTranslation } from "@/app/hooks/useTranslation";
import SlotCalendar from "@/app/components/public/SlotCalendar";
import AddressField from "./AddressField";
import {
  Clock,
  MapPin,
  Phone,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  ChevronRight,
} from "lucide-react";

// The calendar's own wording. This page is English throughout, but the strings
// come from the shared catalogue rather than being retyped here, so the booking
// grid and the visit page's reschedule grid cannot say two different things —
// and whenever this page does learn the client's language, the calendar is
// already translated.
//
// Module scope, not per render: SlotCalendar refetches when `copy` changes
// identity, so a fresh object literal on every render would be an endless loop
// of availability requests.
const CALENDAR_COPY = clientDocCopy("en").visit;

// "Not sure yet" is a real answer, and it is not the same answer as an
// untouched field — so it needs a value of its own rather than being expressed
// as `null`. It is a LOCAL sentinel and never leaves this file: the confirm
// POST sends `serviceKey` only when a real key is selected, because the server
// stores null for anything that isn't one of the company's enabled categories
// and a sentinel round-tripped through it would be silently discarded anyway.
const SERVICE_UNSURE = "__unsure";

// The fee is already resolved server-side (feeCents = what they pay, with
// feeStandardCents set only when a promo is live). The browser just formats it.
function moneyFromCents(cents, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: Number.isInteger(cents / 100) ? 0 : 2,
    }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(0)}`;
  }
}

// Format as typed — but only while what they're typing is a plain ten-digit
// North American number.
//
// formatPhoneInput truncates to ten digits, which is right for the back office
// (staff type local numbers) and wrong here: a homeowner pasting
// "+1 514 555 1234" would watch it silently become 151-455-5123, a different
// number, on the field the crew rings when they're running late. Anything that
// isn't a bare NANP number is left exactly as typed rather than rewritten.
function formatPhoneAsTyped(raw) {
  const text = String(raw || "");
  const digits = text.replace(/\D/g, "");
  if (digits.length > 10 || /[^\d\s().-]/.test(text)) return text;
  return formatPhoneInput(text);
}

// `prefill` seeds the contact fields when this flow is opened from somewhere
// that already asked for them — today the self-quote confirmation, where the
// homeowner typed their name, email, phone and address about ten seconds ago.
// Retyping all four to book the visit is where people stop.
//
// Seeded as INITIAL STATE, never synced: once the flow is open the fields
// belong to the person typing in them, and an effect that pushed prefill back
// in on re-render would overwrite a correction mid-keystroke.
// `quoteId` links this visit to the estimate that prompted it, when the flow
// was opened from an instant-estimate result. Passed through untouched and
// VERIFIED server-side (company scope plus a matching client email) — this
// component has no way to prove it, so it does not pretend to.
export default function BookingFlow({ companySlug, initialEventSlug, prefill = null, quoteId = null }) {
  // The visitor's own language, not the company's. Everything else on this page
  // is still English literals — see CALENDAR_COPY above — so the two fields
  // added here are the first strings that follow the reader. That is the right
  // direction to start in: they are the only fields on the page a homeowner has
  // to WRITE rather than recognise, and a question you can't read is a question
  // you skip.
  const { t } = useTranslation();
  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState(null);
  // Bookable team members ("pick your estimator"). When present, Step 1 is a
  // people picker; each member's consultation event is what actually gets
  // booked, so selecting one just sets the matching eventType.
  const [members, setMembers] = useState([]);
  // Bumped to ask the calendar for fresh times without remounting it — see
  // loadSlots below. The month grid and the tapped day live inside SlotCalendar
  // now, and remounting would send someone who just lost a slot back to today's
  // month with nothing selected.
  const [slotEpoch, setSlotEpoch] = useState(0);
  // How the client wants to meet. Only asked when the company offers a choice —
  // a segmented control with one option is a label pretending to be a control.
  const [mode, setMode] = useState(null);
  const [chosen, setChosen] = useState(null);

  const [form, setForm] = useState({
    name: prefill?.name || "",
    email: prefill?.email || "",
    phone: prefill?.phone || "",
  });

  // ── What the appointment is actually about ────────────────────────────────
  //
  // The form asked for a name, an email, a phone and an address and nothing
  // about the WORK, so a contractor opened their calendar to a name and a time
  // and rang the person to find out what they had booked.
  //
  // Both OPTIONAL, and optional here means the submit button never looks at
  // them. Name and email are the only hard requirements this flow has ever had
  // and a third one would cost more bookings than an unanswered question does.
  //
  // `serviceKey` holds a key from `company.services` — the company's own
  // enabled categories, handed over by the booking GET. Nothing else is ever
  // offered: the confirm route re-checks the key against that same list and
  // stores null for anything it doesn't recognise, so a hardcoded guess here
  // would be a picker that silently records nothing.
  const [notes, setNotes] = useState("");
  const [serviceKey, setServiceKey] = useState(null);

  // ── The visit address ────────────────────────────────────────────────────
  //
  // Two pieces of state, not one. `address` is what they're typing; `geoAddress`
  // is what the slot query has been run against. Refetching on every keystroke
  // would be a geocode per character, so the query only moves when typing stops
  // — or immediately, when they pick a Google suggestion, since that address is
  // finished by definition and waiting another 700ms is just a slower page.
  //
  // `travelInfo` is what came back — whether the filter actually applied. Null
  // means we haven't asked; { applied: false } means we asked and couldn't
  // place the address, which must LOOK different to the visitor from a
  // successful filter, or an unrecognised address silently shows unreachable
  // times.
  const [address, setAddress] = useState(prefill?.address || "");
  // The structured halves of that address, present only when it was PICKED
  // from the suggestions. Empty when typed, and empty is the honest record —
  // half a parsed address is not a jurisdiction.
  const [jurisdiction, setJurisdiction] = useState({});
  // Seeded too, so a prefilled address filters the very first slot query rather
  // than showing times that ignore travel until they touch the field.
  const [geoAddress, setGeoAddress] = useState(prefill?.address || "");
  const [travelInfo, setTravelInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  // A paid visit that is waiting on Stripe: { url, feeCents, startTime }. Held
  // in state rather than being a pure redirect because the redirect can be
  // refused — see the hand-off screen below.
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/booking/${companySlug}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || "Booking page not found.");
        setCompany(data);

        // The estimator list. Best-effort — if it fails or is empty, Step 1
        // falls back to the plain service menu below.
        try {
          const mRes = await fetch(`/api/booking/${companySlug}/members`);
          const mData = await mRes.json().catch(() => null);
          if (!cancelled && mRes.ok && Array.isArray(mData?.members)) {
            setMembers(mData.members);
          }
        } catch {
          /* fall back to the service menu */
        }

        // Arrived via /book/<company>/<service> — skip straight to the
        // calendar. Falls through to the menu if the slug doesn't match
        // anything, which is what happens when a service is deactivated after
        // the link was shared.
        const direct =
          initialEventSlug &&
          data.eventTypes?.find((et) => et.slug === initialEventSlug);
        if (direct) {
          setEventType(direct);
        } else if (data.eventTypes?.length === 1) {
          // One service on offer is the common case for a small shop.
          // Skipping a menu with a single item saves everyone a tap.
          setEventType(data.eventTypes[0]);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug, initialEventSlug]);

  // Returned from the Stripe checkout for a paid visit fee.
  //
  // This used to read a bare `?booked=1` and print "Payment received — your
  // visit is confirmed" on the strength of it, having verified nothing. That
  // sentence was true only if the webhook had already run; when the webhook was
  // being delivered to an endpoint that dropped it, the homeowner was told their
  // visit was confirmed while the booking sat unpaid-looking and invisible on
  // every screen the contractor had.
  //
  // So ask. Stripe substitutes the real session id into the success URL, and
  // /settle checks it against Stripe and confirms the booking there and then.
  // The screen says what came back, and nothing more.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const sessionId = p.get("session_id");

    if (p.get("payment_cancelled") === "1") {
      setSubmitError("Payment was cancelled — your time wasn't booked. You can try again.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!sessionId) return;

    window.history.replaceState({}, "", window.location.pathname);
    // `settling` rather than a bare spinner: the client has just paid and is
    // owed an answer, so the screen says what is happening instead of looking
    // like the page forgot.
    setConfirmed({ settling: true });

    fetch(`/api/booking/${companySlug}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "We couldn't check that payment.");
        return data;
      })
      .then((data) =>
        setConfirmed({
          settling: false,
          paid: Boolean(data?.paid),
          confirmed: Boolean(data?.confirmed),
          startTime: data?.startTime || null,
        }),
      )
      .catch((err) => {
        // A failed CHECK is not a failed payment, and must not be reported as
        // one. Say what is actually known: the money may well be theirs and
        // gone, and telling them otherwise is the worse mistake.
        console.error("[booking] settle check failed:", err?.message);
        setConfirmed({ settling: false, paid: null, confirmed: false, startTime: null });
      });
  }, [companySlug]);

  useEffect(() => {
    const offered = company?.bookingModes?.length ? company.bookingModes : ["visit"];
    setMode((m) => m || offered[0]);
  }, [company]);

  useEffect(() => {
    // Not `t`: this component now takes `t` from useTranslation(), and a local
    // of that name shadows it into a render-time crash (scripts/check-t-shadow).
    const timer = setTimeout(() => setGeoAddress(address.trim()), 700);
    return () => clearTimeout(timer);
  }, [address]);

  // Answering SlotCalendar's question: what is free between these two dates?
  //
  // It asks a month at a time, and it decides the range — the grid has to know
  // which DAYS are open before anyone can pick one, so a week's worth of data
  // can't fill it, and it clamps the start to today because the past can only
  // return nothing.
  //
  // The travel note is a deliberate side effect. `travel` rides back on the
  // same response as the slots, and the line under the address field is the
  // only visible proof that the drive filter engaged — but it is a booking-page
  // concern, so it is set here rather than being pushed into a component the
  // visit page also renders.
  const loadSlots = useCallback(
    async (from, to) => {
      if (!eventType) return {};
      // The address is only relevant to an in-person visit. Sending it for a
      // phone consult would filter times by a drive nobody is making.
      const forVisit = mode === "visit" && geoAddress.length > 5;
      try {
        const data = await fetchJson(
          `/api/booking/${companySlug}/availability?eventTypeSlug=${encodeURIComponent(
            eventType.slug,
          )}&from=${from}&to=${to}` +
            (forVisit ? `&address=${encodeURIComponent(geoAddress)}` : ""),
        );
        setTravelInfo(data?.travel || null);
        return data?.slots || {};
      } catch (err) {
        // A load that failed says nothing about the drive. Leaving the previous
        // note standing would claim we'd checked the address against times we
        // never got.
        setTravelInfo(null);
        throw err;
      }
    },
    // slotEpoch is in here and nowhere in the body on purpose: bumping it gives
    // this callback a new identity, which is what makes SlotCalendar refetch
    // the month already on screen. See the 409 branch in submit().
    [companySlug, eventType, mode, geoAddress, slotEpoch],
  );

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/booking/${companySlug}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeSlug: eventType.slug,
          startTime: chosen,
          clientName: form.name.trim(),
          clientEmail: form.email.trim(),
          clientPhone: form.phone.trim() || null,
          mode,
          // Omitted entirely when they said nothing, rather than sent as "" —
          // an empty string is a value, and the server would have to guess what
          // it meant. Absence of a statement is not a statement.
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          // SERVICE_UNSURE never goes over the wire: "I don't know" is a thing
          // the visitor told this form, not a service the company sells.
          ...(serviceKey && serviceKey !== SERVICE_UNSURE ? { serviceKey } : {}),
          ...(quoteId ? { quoteId } : {}),
          address: mode === "visit" ? address.trim() || null : null,
          // Only when the address was picked AND this is a site visit — a
          // video call carries no site address, so it must carry no
          // jurisdiction either.
          ...(mode === "visit" && address.trim() ? jurisdiction : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 409 means someone took the slot between loading and submitting.
        // Send them back to the grid with fresh times rather than leaving
        // them staring at a form for a time that no longer exists.
        if (res.status === 409) {
          setChosen(null);
          setSlotEpoch((n) => n + 1);
        }
        throw new Error(data?.error || "Couldn't book that time.");
      }
      // Paid visit: the server held the slot and returned a Stripe checkout.
      // Hand off to it — the booking confirms on the webhook once paid, and the
      // client returns to ?booked=1.
      //
      // navigateTop, not window.location: this flow usually runs inside an
      // iframe on the company's own website, and Stripe Checkout inside an
      // iframe renders a loading skeleton forever. Navigating the frame is
      // therefore the one thing that must not happen — the whole tab moves.
      //
      // A framed page is only allowed to move the tab while the visitor's click
      // is still fresh, and the browser refuses silently when it isn't. So the
      // hand-off screen is rendered either way: unseen when the tab is already
      // leaving, and the way through when it wasn't allowed to.
      if (data?.requiresPayment && data.checkoutUrl) {
        setPayment({
          url: data.checkoutUrl,
          feeCents: Number(data.feeCents) || 0,
          startTime: chosen,
        });
        navigateTop(data.checkoutUrl);
        return;
      }
      setConfirmed({ startTime: chosen, ...data });
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  // One palette for the whole flow, derived from the company's brand hex.
  // Computed before the early returns below so the skeleton and the error card
  // sit on the same paper as everything else. documentTheme falls back to the
  // FieldQuo navy when a company hasn't set a colour, so `company` being null
  // during load is fine.
  const theme = documentTheme(company || {});
  // The two things that sit ON the accent: the confirm button, the logo bubble,
  // and the selected day. fillPair rather than readableForeground because a
  // mid-tone brand (#808080 tops out at 4.43:1) has no legible foreground at
  // all — fillPair moves the fill instead, and substitutes ink for a brand so
  // pale the shape itself would disappear.
  const solid = fillPair(theme);
  // The washed surface: a bookable day, the times panel, the fee card. Their
  // colour at 4% strength — except for washed-out brands (white, near white),
  // where a tint of the brand is indistinguishable from the card and the
  // affordance has to be visible even when the brand isn't. Both branches carry
  // their own measured text colours, because ink measured against paper is not
  // the same as ink measured against a wash (that gap is where the hero subhead
  // sat at 4.43:1 for a year).
  const wash = accentIsWashedOut(theme)
    ? { bg: neutralPair(theme).bg, ink: theme.ink, muted: neutralPair(theme).fg }
    : { bg: theme.accentWash, ink: theme.inkOnWash, muted: theme.inkMutedOnWash };
  // theme.accentText is measured against PAPER. The visit fee sits on the wash,
  // which costs about 0.2 — enough to put lime, mid grey and pale grey brands
  // under 4.5:1 on the one number that says what this visit costs. Re-measured
  // against the surface it's actually painted on.
  wash.accent = ensureContrast(theme.accentText, wash.bg, 4.5);

  if (loading) {
    return (
      <Shell theme={theme}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 rounded w-1/2" style={{ backgroundColor: theme.border }} />
          <div className="h-40 rounded-xl" style={{ backgroundColor: theme.border }} />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell theme={theme}>
        <div className="text-center py-10">
          <p className="font-semibold" style={{ color: theme.ink }}>{loadError}</p>
          <p className="text-sm mt-1" style={{ color: theme.inkMuted }}>
            Double-check the link, or get in touch with the company directly.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Paid visit: the hand-off to Stripe ───────────────────────────────────
  //
  // Reached in one of two ways. Either the tab is already on its way to
  // Stripe, and this renders for the fraction of a second before it leaves —
  // or the browser refused to let a framed page move the tab, and this screen
  // is the only thing between the visitor and the payment page. A spinner here
  // would be the second case rendered as a hang.
  //
  // target="_top" for the same reason the automatic hand-off exists: the
  // checkout page cannot be shown inside the embed. On the standalone booking
  // page _top is simply this tab.
  if (payment) {
    return (
      <Shell theme={theme}>
        <Header company={company} theme={theme} solid={solid} />
        <div className="text-center py-6">
          <h2 className="text-lg font-bold" style={{ color: theme.ink }}>
            One more step
          </h2>
          {payment.startTime && (
            <p className="text-sm mt-2" style={{ color: theme.ink }}>
              {new Date(payment.startTime).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="text-sm mt-1" style={{ color: theme.inkMuted }}>
            {payment.feeCents > 0
              ? `Pay the ${moneyFromCents(payment.feeCents, company.currency)} visit fee to confirm this time.`
              : "Complete the payment to confirm this time."}
          </p>
          <a
            href={payment.url}
            target="_top"
            rel="noopener"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-full text-sm font-bold"
            style={{ backgroundColor: solid.bg, color: solid.fg }}
          >
            Continue to secure payment
            <ChevronRight size={16} />
          </a>
          <p className="text-xs mt-3" style={{ color: theme.inkMuted }}>
            Payment is handled by Stripe. Your time is held for 30 minutes.
          </p>
        </div>
      </Shell>
    );
  }

  if (confirmed) {
    // Four outcomes, and the screen has to be able to say each of them. The old
    // version could only say one — "you're booked" — which is why it said it
    // even when the booking had not been confirmed.
    //
    //   settling         we are asking Stripe right now
    //   paid && confirmed  money taken, appointment made      ← the happy path
    //   paid && !confirmed money taken, we could not confirm  ← must not claim a visit
    //   paid === null      we could not even check            ← must not claim either
    //
    // The free path arrives here with none of these set and keeps its original
    // wording, because for a free booking the row IS the confirmation.
    const settling = confirmed.settling === true;
    const returnedFromPayment = settling || confirmed.paid !== undefined;
    const trouble = !settling && returnedFromPayment && !confirmed.confirmed;

    const heading = settling
      ? "Checking your payment…"
      : trouble
        ? "We're still confirming your visit"
        : "You're booked";

    let body;
    if (settling) {
      body = "One moment — we're confirming this with our payment provider.";
    } else if (confirmed.paid === null) {
      // The check itself failed. Do not guess in either direction.
      body = `We couldn't reach our payment provider to check. Don't pay again — ${company.name} will confirm your visit shortly, and you'll get an email either way.`;
    } else if (confirmed.paid && !confirmed.confirmed) {
      // Money taken, booking not confirmed. This is the state that used to be
      // reported as a confirmed visit.
      body = `Your payment went through, but we haven't been able to confirm the time yet. Don't pay again — ${company.name} can see this and will be in touch to finish booking you in.`;
    } else if (confirmed.paid) {
      body = `Payment received — your visit is confirmed. A confirmation email is on its way, and ${company.name} will be in touch if anything changes.`;
    } else {
      body = `A confirmation is on its way${form.email ? ` to ${form.email}` : ""}. ${company.name} will be in touch if anything changes.`;
    }

    return (
      <Shell theme={theme}>
        <Header company={company} theme={theme} solid={solid} />
        <div className="text-center py-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: wash.bg }}
          >
            {/* A tick means "done". It must not appear over a visit we have not
                managed to book, or over a check still in flight. */}
            {settling ? (
              <Loader2 size={26} className="animate-spin" style={{ color: theme.accentText }} />
            ) : trouble ? (
              <Clock size={26} style={{ color: theme.accentText }} />
            ) : (
              <Check size={26} style={{ color: theme.accentText }} />
            )}
          </div>
          <h2 className="text-lg font-bold" style={{ color: theme.ink }}>
            {heading}
          </h2>
          {confirmed.startTime && !settling && (
            <p className="text-sm mt-2" style={{ color: theme.ink }}>
              {new Date(confirmed.startTime).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="text-sm mt-3" style={{ color: theme.inkMuted }}>
            {body}
          </p>
        </div>
      </Shell>
    );
  }

  const showingCalendar = Boolean(eventType && !chosen);

  return (
    // The calendar step is the one that needs room: a 7-column grid and a list
    // of times side by side inside a 448px card left the day cells at 17px
    // wide on a desktop — unreadable and untappable, and the reason this page
    // got reported as "cramped". The card widens for that step only; a name
    // and email field stretched across 672px looks worse, not better.
    <Shell theme={theme} wide={showingCalendar}>
      <Header company={company} theme={theme} solid={solid} />

      {/* Step 1 — pick your estimator (member-first), or the service menu */}
      {!eventType && (
        <div>
          {members.length > 0 ? (
            <>
              <h2 className="font-semibold mb-3" style={{ color: theme.ink }}>
                Choose who you&apos;d like to meet
              </h2>
              <div className="space-y-2">
                {members.map((m) => {
                  const et = company.eventTypes?.find((e) => e.slug === m.eventSlug);
                  const initials = m.name
                    .replace(/[^a-zA-Z ]/g, "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("");
                  return (
                    <button
                      key={m.eventSlug}
                      onClick={() => setEventType(et || { slug: m.eventSlug, name: `Consultation with ${m.name}`, durationMinutes: m.durationMinutes })}
                      className="w-full text-left border rounded-xl px-4 py-3 transition-colors flex items-center gap-3 border-[var(--bd)] hover:border-[var(--bd-hover)]"
                      style={{
                        "--bd": theme.border,
                        "--bd-hover": theme.accentRule,
                        backgroundColor: theme.paper,
                      }}
                    >
                      <span
                        className="shrink-0 w-11 h-11 rounded-full grid place-items-center text-sm font-bold"
                        // The measured pair, not white — white initials on a
                        // pale or yellow brand are invisible.
                        style={{ backgroundColor: solid.bg, color: solid.fg }}
                      >
                        {initials || "★"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium" style={{ color: theme.ink }}>{m.name}</span>
                        <span className="block text-xs" style={{ color: theme.inkMuted }}>
                          {m.title}
                          {m.nextSlot
                            ? ` · next ${new Date(m.nextSlot).toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                            : " · limited availability"}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0" style={{ color: theme.inkFaint }} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : company.eventTypes?.length ? (
            <>
              <h2 className="font-semibold mb-3" style={{ color: theme.ink }}>
                What can we help with?
              </h2>
              <div className="space-y-2">
                {company.eventTypes.map((et) => (
                  <button
                    key={et.id}
                    onClick={() => setEventType(et)}
                    className="w-full text-left border rounded-xl px-4 py-3 transition-colors border-[var(--bd)] hover:border-[var(--bd-hover)]"
                    style={{
                      "--bd": theme.border,
                      "--bd-hover": theme.accentRule,
                      backgroundColor: theme.paper,
                    }}
                  >
                    <div className="font-medium" style={{ color: theme.ink }}>{et.name}</div>
                    <div className="text-xs mt-1 flex gap-3 flex-wrap" style={{ color: theme.inkMuted }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {et.durationMinutes} min
                      </span>
                      {et.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {et.location}
                        </span>
                      )}
                      {et.feeCents > 0 && (
                        <span
                          className="inline-flex items-center gap-1.5 font-semibold"
                          style={{ color: theme.accentText }}
                        >
                          {et.feeStandardCents ? (
                            <>
                              <span className="line-through font-normal" style={{ color: theme.inkMuted }}>
                                {moneyFromCents(et.feeStandardCents, company.currency)}
                              </span>
                              {moneyFromCents(et.feeCents, company.currency)}
                            </>
                          ) : (
                            moneyFromCents(et.feeCents, company.currency)
                          )}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: theme.inkMuted }}>
              {/* The explicit {" "} is load-bearing. Written as
                  `{company.name} hasn't…`, the space before "hasn't" belongs to
                  a JSX text run that continues onto the next line, and the
                  compiler trims it — this read "Cedar & Co. Flooringhasn't set
                  up online booking yet." to every visitor of a company that has
                  no event types. A literal space cannot be trimmed. */}
              {company.name}{" "}
              hasn&apos;t set up online booking yet.
              {company.phone && ` Give them a call on ${company.phone}.`}
            </p>
          )}
        </div>
      )}

      {/* Step 2 — which time */}
      {/* Hidden once a time is picked, not unmounted. Which month is on screen
          and which day was tapped belong to SlotCalendar now; unmounting throws
          both away, so "Pick another time" on step 3 would drop the visitor
          back on today's month with nothing selected instead of where they were
          a moment ago. `hidden` also takes it out of the tab order and the
          accessibility tree, so nothing behind step 3 is reachable. */}
      {eventType && (
        <div hidden={Boolean(chosen)}>
          <div className="mb-4">
            {company.eventTypes?.length > 1 && (
              <button
                onClick={() => setEventType(null)}
                // py-2, not zero: this was a text-xs label with no padding
                // at all, so its tap target was the line-height of the text —
                // well under 44px, and it's the only way back to step 1.
                className="inline-flex items-center gap-1 text-xs mb-0.5 py-2"
                style={{ color: theme.inkMuted }}
              >
                <ArrowLeft size={11} /> Change service
              </button>
            )}
            <h2 className="font-semibold" style={{ color: theme.ink }}>{eventType.name}</h2>
            {eventType.durationMinutes && (
              <p className="text-xs mt-0.5" style={{ color: theme.inkMuted }}>
                {eventType.durationMinutes} min
              </p>
            )}
          </div>

          {/* ── How would you like to meet? ──────────────────────────────────
              EventType.location was free text ("Phone or on-site visit"), which
              is a label, not a choice: the visitor couldn't say which they
              wanted and the crew found out on the day. A roofer doing a
              satellite estimate wants calls; a cabinet maker measuring a kitchen
              needs to be in the room. Both is common, so the company says which
              it offers and the client picks. */}
          {(company.bookingModes?.length || 0) > 1 && (
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: theme.inkMuted }}>
                How would you like to meet?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {company.bookingModes.map((m) => {
                  const label =
                    m === "call" ? "Phone call" : m === "video" ? "Video call" : "Visit my place";
                  const Icon = m === "visit" ? MapPin : Phone;
                  const on = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-10 rounded-lg border text-sm font-medium transition-colors border-[var(--bd)] hover:border-[var(--bd-hover)]"
                      style={{
                        "--bd": on ? solid.bg : theme.border,
                        "--bd-hover": on ? solid.bg : theme.accentRule,
                        backgroundColor: on ? solid.bg : theme.paper,
                        color: on ? solid.fg : theme.ink,
                      }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Where are we coming to? ────────────────────────────────────
              Asked BEFORE the times, not after, because it changes which times
              are real. An estimator finishing across town at 5:00 cannot be at
              a door at 5:30, and offering that slot is a promise the company
              breaks on the day.

              Optional on purpose. Someone who won't type an address still gets
              the full grid — the times are then merely unfiltered, which is
              exactly what every booking page did before this. Blocking the
              calendar behind a required field would cost more bookings than
              the occasional tight drive does. That is also why the Google
              suggestions in AddressField are an accelerator and never a gate:
              a typed address books exactly as well as a picked one. */}
          {mode === "visit" && (
            <div className="mb-4">
              <label
                htmlFor="visit-address"
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: theme.inkMuted }}
              >
                Where should we come?
              </label>
              <div className="relative">
                <MapPin
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
                  style={{ color: theme.inkMuted }}
                />
                <AddressField
                  id="visit-address"
                  value={address}
                  // Typing after picking invalidates the components that came
                  // with the pick — keeping them would attach the previous
                  // suggestion's province to a different address.
                  onChange={(v) => {
                    setAddress(v);
                    setJurisdiction({});
                  }}
                  // address-jurisdiction: keeps city, province, country.
                  // The confirm route creates a Client from this booking, and
                  // one with no country resolves to no tax rate at all on
                  // every quote that follows (lib/tax/documentTax.js).
                  onResolved={({ address: picked, city, province, country }) => {
                    if (!picked) return;
                    setAddress(picked);
                    setJurisdiction({
                      city: city || "",
                      province: province || "",
                      country: country || "",
                    });
                    // Picked from the list, so it's a finished address —
                    // re-query now instead of waiting out the typing debounce.
                    setGeoAddress(picked.trim());
                  }}
                  placeholder="123 Main St, Montreal"
                  className="w-full pl-9 pr-3 min-h-11 rounded-lg border text-sm focus:outline-none border-[var(--bd)] focus:border-[var(--bd-focus)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
                />
              </div>

              {/* Three states, and they must not look alike. */}
              <p className="text-xs mt-1.5" style={{ color: theme.inkMuted }}>
                {travelInfo?.applied
                  ? `Showing times we can reach ${travelInfo.address || "you"} on schedule.`
                  : travelInfo
                    ? "We couldn't place that address, so all times are shown. Double-check it before you book."
                    : "Optional — it lets us hide times we couldn't get to you on time."}
              </p>
            </div>
          )}

          {/* One grid, shared with the visit page's reschedule screen
              (app/components/public/SlotCalendar.js). It owns the month on
              screen, the tapped day and the fetch; this page owns only what a
              picked time means. No `locale` and no `timeZone` — both fall back
              to the visitor's own device, which is what this page has shown
              since it was written. */}
          <SlotCalendar
            theme={theme}
            solid={solid}
            wash={wash}
            copy={CALENDAR_COPY}
            loadSlots={loadSlots}
            onPick={setChosen}
            selected={chosen}
          />
        </div>
      )}

      {/* Step 3 — who are you */}
      {eventType && chosen && (
        <form onSubmit={submit}>
          <button
            type="button"
            onClick={() => setChosen(null)}
            className="inline-flex items-center gap-1 text-xs mb-2"
            style={{ color: theme.inkMuted }}
          >
            <ArrowLeft size={11} /> Pick another time
          </button>

          <h2 className="font-semibold" style={{ color: theme.ink }}>
            {new Date(chosen).toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </h2>
          <p className="text-xs mb-4" style={{ color: theme.inkMuted }}>
            {eventType.name} · {eventType.durationMinutes} min
          </p>

          {eventType.feeCents > 0 && (
            <div
              className="rounded-xl px-3.5 py-3 mb-4 text-sm"
              style={{ backgroundColor: wash.bg, color: wash.ink }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Visit fee</span>
                <span className="font-semibold" style={{ color: wash.accent }}>
                  {eventType.feeStandardCents ? (
                    <>
                      <span className="line-through font-normal mr-1.5" style={{ color: wash.muted }}>
                        {moneyFromCents(eventType.feeStandardCents, company.currency)}
                      </span>
                      {moneyFromCents(eventType.feeCents, company.currency)}
                    </>
                  ) : (
                    moneyFromCents(eventType.feeCents, company.currency)
                  )}
                </span>
              </div>
              <p className="text-xs mt-1.5" style={{ color: wash.muted }}>
                Paid now to hold your spot. If you go ahead with the work,{" "}
                {company.name} can credit it back on your invoice.
              </p>
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Your name"
              theme={theme}
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              autoFocus
            />
            <Input
              label="Email"
              theme={theme}
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
              hint="We'll send your confirmation here."
            />
            <Input
              label="Phone"
              theme={theme}
              type="tel"
              inputMode="tel"
              placeholder="555-123-4567"
              value={form.phone}
              // Formatted as typed, still optional. Nothing here rejects a
              // phone number — a validation gate on a field the flow doesn't
              // require would turn a polish pass into lost bookings.
              onChange={(v) => setForm({ ...form, phone: formatPhoneAsTyped(v) })}
              hint="Optional, but it helps if we're running late."
            />

            {/* ── Which of their services, in their own words ────────────────
                Only rendered when the company has enabled some. A shop that
                has enabled nothing gets no picker rather than an empty one —
                a control with no options is a control that appears to work and
                doesn't. The notes field below stands on its own either way.

                Chips rather than a <select>: a native picker on a phone is a
                modal wheel over the whole screen, and this is somebody
                one-handed in a driveway who can see six trades at once
                instead. Same shape as the "How would you like to meet?" row on
                step 2, deliberately — it is the same kind of question. */}
            {company.services?.length > 0 && (
              <div>
                <span className="block text-sm font-medium mb-1" style={{ color: theme.ink }}>
                  {t("booking.work.serviceLabel")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...company.services,
                    // Last, and a real choice rather than a prompt: somebody who
                    // doesn't know what their job is called must be able to SAY
                    // so. Without it the only way to answer is to leave every
                    // chip untapped, which reads as a question you failed.
                    { key: SERVICE_UNSURE, label: t("booking.work.serviceUnsure") },
                  ].map((svc) => {
                    const on = serviceKey === svc.key;
                    return (
                      <button
                        key={svc.key}
                        type="button"
                        // Tapping the chosen one again clears it. A mis-tap on a
                        // phone must be undoable, and there is no other way back
                        // to "didn't say".
                        onClick={() => setServiceKey(on ? null : svc.key)}
                        aria-pressed={on}
                        className="inline-flex items-center px-3.5 min-h-10 rounded-lg border text-sm font-medium transition-colors border-[var(--bd)] hover:border-[var(--bd-hover)]"
                        style={{
                          "--bd": on ? solid.bg : theme.border,
                          "--bd-hover": on ? solid.bg : theme.accentRule,
                          backgroundColor: on ? solid.bg : theme.paper,
                          color: on ? solid.fg : theme.ink,
                        }}
                      >
                        {svc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* The one field that tells the estimator what to bring. Capped at
                the same 2000 the server caps at, so the browser can't offer
                room the row won't keep — a note silently truncated after
                submission is worse than one that stopped where they could see
                it. */}
            <div>
              <label
                htmlFor="booking-notes"
                className="block text-sm font-medium mb-1"
                style={{ color: theme.ink }}
              >
                {t("booking.work.notesLabel")}
              </label>
              <textarea
                id="booking-notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("booking.work.notesPlaceholder")}
                className="w-full border rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none border-[var(--bd)] focus:border-[var(--bd-focus)] placeholder:text-[var(--ink-faint)]"
                style={{
                  "--bd": theme.border,
                  backgroundColor: theme.paper,
                  color: theme.ink,
                }}
              />
              <p className="text-xs mt-1" style={{ color: theme.inkMuted }}>
                {t("booking.work.notesHint")}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !form.name.trim() || !form.email.trim()}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-full text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: solid.bg, color: solid.fg }}
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {eventType.feeCents > 0
              ? `Pay ${moneyFromCents(eventType.feeCents, company.currency)} & book`
              : "Confirm booking"}
          </button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children, theme, wide = false }) {
  // No min-h-screen: inside a 600px iframe that would force a scrollbar on
  // content that fits.
  return (
    <div className="p-3 sm:p-6" style={{ backgroundColor: theme.page }}>
      <div
        className={`${wide ? "max-w-2xl" : "max-w-md"} mx-auto rounded-2xl p-4 sm:p-5 border`}
        style={{
          backgroundColor: theme.paper,
          borderColor: theme.borderSoft,
          // Declared once here, and inherited. The address input is rendered by
          // a shared back-office component that takes a className and no style
          // prop, so its colours have to arrive through the cascade; the chips
          // below override --bd locally where they need to. Hover and focus
          // can't be inline styles at all, which is the other half of the
          // reason these exist.
          "--paper": theme.paper,
          "--ink": theme.ink,
          "--ink-faint": theme.inkFaint,
          "--bd": theme.border,
          "--bd-hover": theme.accentRule,
          // Focus is the darkened accent, not the pale rule: a focus ring you
          // can't see is not a focus ring.
          "--bd-focus": theme.accentText,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ company, theme, solid }) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-4 border-b" style={{ borderColor: theme.borderSoft }}>
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt={company.name}
          className="h-9 w-auto object-contain"
        />
      ) : (
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: solid.bg }}
        >
          <Building2 size={16} style={{ color: solid.fg }} />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-bold truncate" style={{ color: theme.ink }}>{company.name}</div>
        <div className="text-xs" style={{ color: theme.inkMuted }}>Book an appointment</div>
      </div>
    </div>
  );
}

function Input({ label, hint, value, onChange, theme, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: theme.ink }}>
        {label}
      </label>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 min-h-11 text-sm focus:outline-none border-[var(--bd)] focus:border-[var(--bd-focus)] placeholder:text-[var(--ink-faint)]"
        style={{
          "--bd": theme.border,
          backgroundColor: theme.paper,
          color: theme.ink,
        }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: theme.inkMuted }}>{hint}</p>}
    </div>
  );
}
