// app/sales/leads/[id]/page.js
//
// One prospect: where they are in the pipeline, what has been said to them, and
// the box that says the next thing.
//
// ══ The phone is on this screen, not only in the queue ════════════════════
//
// It was not, until the owner opened his own leads and found four businesses
// with numbers on them and nothing to press. The queue had the whole console —
// dial, timer, mute, hang up, disposition, notes — and the queue is fed by
// discovery, so a rep whose pool is empty had a portal that could not make a
// phone call at all. The server had always accepted a lead as a call target
// (app/api/sales/calls's targetFor, SalesCallAttempt.leadId); only the screen
// was missing. It renders the SAME component the queue does — see
// app/components/sales/DialRegion.js on why this is not a second copy.
//
// ══ Three states the compose box can be in, and only one of them types ═════
//
//   1. Outreach isn't configured. No box at all — OutreachNotice stands in its
//      place and names the setting that is missing. A box that posts into a
//      409 is the dead control AGENTS.md opens with.
//   2. The prospect asked to stop. No box, and the reason said plainly. The
//      server refuses this too; the UI agreeing with it is courtesy, not
//      security.
//   3. Ready. The box renders, and any warning (replies not being filed yet)
//      renders above it rather than being swallowed.
//
// `params` is a Promise in Next 16, so this reads it with `use()` rather than
// destructuring it.
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Send,
  LifeBuoy,} from "lucide-react";
import { errorText, fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import { LEAD_LINK_REASON_KEYS } from "@/lib/sales/leadLinkReasons";
import { dialHref, salesCallReadiness } from "@/lib/sales/callingRules";
import { dialSpace } from "@/lib/sales/dialSpace";
import { SALES_SMS_TIME_ZONES } from "@/lib/sales/smsWindow";
import { useTranslation } from "@/app/hooks/useTranslation";
import DialRegion from "@/app/components/sales/DialRegion";
import ContactNumbers from "@/app/components/sales/ContactNumbers";
import OutreachNotice from "../OutreachNotice";
import SignupLinkSms from "../SignupLinkSms";

// Matches the console's fields — 44px tall and 16px text, so a phone does not
// zoom the page when a rep taps one.
const FIELD =
  "mt-1 w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SalesLeadPage({ params }) {
  const { id } = use(params);
  const { t, language } = useTranslation();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // The email the rep says the client registered with, and what the server
  // said about it. `verdict` is cleared on every keystroke: a verdict is about
  // ONE address, and a Link button left lit while the field changes underneath
  // it would link whatever the server last agreed to, not what is typed.
  const [linkEmail, setLinkEmail] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkReason, setUnlinkReason] = useState("");
  // Where the phone rings. Held separately from `lead` because these three are
  // an unsaved edit until Save is pressed, and writing them straight onto the
  // loaded lead would make the dial region flip to "allowed" before anything
  // had been stored.
  const [place, setPlace] = useState({ country: "", province: "", timeZone: "" });
  const [placeOpen, setPlaceOpen] = useState(false);
  // The server's clock against ours, so the calling window is judged on the
  // server's time. Same reason the queue carries one: a laptop set to the
  // wrong zone would silently move a legal call an hour.
  const [clock, setClock] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`);
      setData(next);
      setNotes(next.lead.notes || "");
      setPlace({
        country: next.lead.country || "",
        province: next.lead.province || "",
        timeZone: next.lead.timeZone || "",
      });
      const serverMs = next?.serverNow ? Date.parse(next.serverNow) : NaN;
      setClock(Number.isFinite(serverMs) ? { serverMs, localMs: Date.now() } : null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-evaluate the calling window while the screen sits open. A rep who
  // opened a lead at 20:58 must not still be looking at a live Call button at
  // 21:01 — the queue re-asks on the same cadence and for the same reason.
  const [tick, setTick] = useState(0);
  // The rep's pick of WHICH number rings. Held on the screen that owns the
  // dial — see the same note in app/sales/queue/page.js — and empty meaning
  // "whichever the server puts first", so the default is decided once.
  const [numberId, setNumberId] = useState("");
  useEffect(() => {
    const id2 = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id2);
  }, []);

  const lead = data?.lead;
  const outreach = data?.outreach;
  const optedOut = data?.optedOut;
  // The reason the SERVER reached, not one this screen assumes. contactOptedOut
  // answers from two sources and describeSuppression() writes the sentence:
  // which address or domain is listed, and how it got there — replied, asked on
  // the phone, texted STOP, a regulator's list. Until 2026-09-03 the route sent
  // this and nothing read it, and the screen printed "they replied with an
  // unsubscribe request" over all seven mechanisms.
  // Resolved against the rep's catalogue when the route sent the key that
  // composed it — see app/sales/threads/[id]/page.js for the whole argument.
  // The server's English is the fallback, never a sentence invented here.
  const optedOutReason = data?.optedOutReasonKey
    ? t(data.optedOutReasonKey, {
        ...(data.optedOutReasonParams || {}),
        // A suppression row with no requestedAt cannot be written by
        // suppress(), but the column is nullable — so the slot gets a
        // translated "not recorded" rather than the word "null" or an
        // invented day on a compliance notice.
        date:
          data.optedOutReasonParams?.date || t("app.salesSuppression.dateNotRecorded"),
      })
    : data?.optedOutReason;

  async function patch(body) {
    setBusy(true);
    setError("");
    try {
      const next = await fetchJson(`/api/sales/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(body, "lead"),
      });
      // Merged wholesale, not just the lead: the PATCH answer carries the
      // recomputed dial view and the server clock, and keeping the old `call`
      // beside a new location is how the screen would keep saying "we cannot
      // confirm" about a state the rep just typed in.
      setData((d) => ({ ...d, ...next }));
      setPlace({
        country: next.lead.country || "",
        province: next.lead.province || "",
        timeZone: next.lead.timeZone || "",
      });
      const serverMs = next?.serverNow ? Date.parse(next.serverNow) : NaN;
      if (Number.isFinite(serverMs)) setClock({ serverMs, localMs: Date.now() });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // The sentence for a verdict or a link refusal, in the rep's language. The
  // server's English travels in `text`/`error` and is the fallback for a
  // language with no entry — never a sentence invented here.
  const reasonText = (reason, fallback) =>
    reason && LEAD_LINK_REASON_KEYS[reason] ? t(LEAD_LINK_REASON_KEYS[reason], fallback) : fallback;

  async function checkLink(event) {
    event?.preventDefault?.();
    setBusy(true);
    setError("");
    try {
      const next = await fetchJson(
        `/api/sales/leads/${id}/link?email=${encodeURIComponent(linkEmail.trim())}`,
      );
      setVerdict(next);
    } catch (err) {
      setError(errorText(t, err, LEAD_LINK_REASON_KEYS));
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/sales/leads/${id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ email: linkEmail.trim() }, "link"),
      });
      setVerdict(null);
      setLinkEmail("");
      await load();
    } catch (err) {
      setError(errorText(t, err, LEAD_LINK_REASON_KEYS));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/sales/leads/${id}/link`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ reason: unlinkReason.trim() }, "unlink"),
      });
      setUnlinkOpen(false);
      setUnlinkReason("");
      await load();
    } catch (err) {
      setError(errorText(t, err, LEAD_LINK_REASON_KEYS));
    } finally {
      setBusy(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/sales/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ leadId: id, subject, body: message }, "email"),
      });
      setSubject("");
      setMessage("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <Link href="/sales/leads" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> {t("app.salesLeads.title")}
        </Link>
        {error ? (
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> {t("app.salesLeads.loading")}
          </div>
        )}
      </div>
    );
  }

  const canCompose = Boolean(outreach?.canSend) && !optedOut && Boolean(lead.email);

  // The WORD, never the value. `patch({ status: s })` still posts the enum;
  // only the chip's caption is translated. Same keys the list screen uses —
  // app.salesLeads.status.{new,contacted,demoed,signed,lost} — with the
  // English in outreachPipeline.js as the fallback.
  const statusLabel = (value) =>
    t(`app.salesLeads.status.${value}`, LEAD_STATUS_LABELS[value] || value);

  // ── The call, decided exactly the way the queue decides it ───────────────
  //
  // Same three functions, same order: salesCallReadiness reads the rules,
  // dialHref is the only thing allowed to produce a tel: target, and dialSpace
  // re-gates that href against the decision. Nothing here shortcuts any of
  // them, which is what keeps a lead and a prospect from getting two different
  // answers about the same statute.
  const call = data?.call || null;
  const compliance = call
    ? salesCallReadiness({
        prospect: {
          country: call.callingContext.country,
          province: call.callingContext.province,
        },
        timeZone: call.callingContext.timeZone,
        now: new Date(clock ? clock.serverMs + (Date.now() - clock.localMs) : Date.now()),
        // The reader's language, for the ONE string this produces that is a
        // formatted instant rather than a sentence — "It opens at 08:00 on Tue
        // 8 Sep". Everything else travels as a catalogue key; a date cannot,
        // so it is formatted through CLDR here where the language is known.
        language,
      })
    : null;
  // `tick` is read so the window above is re-judged every thirty seconds.
  void tick;
  const numbers = data?.numbers || null;
  const chosenNumber =
    (numbers?.voice?.choices || []).find((c) => (c.id || "") === numberId) ||
    (numbers?.voice?.choices || [])[0] ||
    null;
  const space = dialSpace({
    // dialSpace reads `contact` and nothing else off this object, and the
    // server built that in the shape it expects — see lib/sales/leadDial.js.
    prospect: call ? { contact: call.contact } : null,
    compliance,
    // The chosen number. dialHref still refuses anything but an `allowed`
    // decision and is still the only producer of a tel: target; what changed
    // is which of the record's numbers it is handed.
    href: dialHref(compliance, chosenNumber?.e164 || call?.phoneE164),
    claimedCount: 0,
  });

  return (
    <div className="space-y-6">
      <Link href="/sales/leads" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> {t("app.salesLeads.title")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{lead.businessName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {[lead.contactName, lead.email, lead.phone].filter(Boolean).join(" · ") ||
            t("app.salesLeads.noContactDetails")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── The phone ────────────────────────────────────────────────────────
          First, above the pipeline chips and the compose box, because ringing
          them is the thing a rep opened this screen to do. Never blank: every
          state DialRegion can be in says what is missing and what would fix
          it. */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{t("app.salesLeads.callThem")}</h2>
          {call?.phoneE164 ? (
            <span className="text-xs text-muted-foreground tabular-nums">{call.phoneE164}</span>
          ) : null}
        </div>

        <DialRegion
          space={space}
          compliance={compliance}
          target={
            call
              ? {
                  leadId: lead.id,
                  phoneE164: chosenNumber?.e164 || call.phoneE164,
                  // An id of a stored row, never a number — the server re-reads
                  // it against this lead in the request that dials.
                  contactNumberId: chosenNumber?.id || null,
                  businessName: lead.businessName,
                }
              : null
          }
          onWorked={load}
        />

        {/* The numbers somebody actually gave us, and the one about to ring.
            Same component the queue renders, for the reason DialRegion is
            shared: two copies of a reach rule is one too many. */}
        <ContactNumbers
          leadId={lead.id}
          numbers={numbers}
          selectedId={chosenNumber?.id || ""}
          onSelect={(pick) => setNumberId(pick?.id || "")}
          onChanged={load}
          disabled={call?.contact?.callable === false}
        />

        {/* ── Where the phone rings ──────────────────────────────────────────
            The one thing a rep can do about "we cannot confirm this call is
            allowed", and therefore rendered right under the sentence that says
            it. Calling hours are the jurisdiction's, and 16 CFR 310.6(b)(7)
            exempts business calls from the federal rule entirely — so without
            a state there is nothing to evaluate and no federal floor to fall
            back on. Open by default when it is missing, folded once it is
            answered: a rep working a lead they have already located should not
            scroll past a form they filled in last week. */}
        <details
          open={placeOpen || !(lead.country && lead.province)}
          onToggle={(e) => setPlaceOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin size={13} />
            {lead.country && lead.province
              ? t("app.salesLeads.whereTheyAre", {
                  province: lead.province,
                  country: lead.country,
                })
              : t("app.salesLeads.sayWhereTheyAre")}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("app.salesLeads.noAreaCodeGuess")}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-muted-foreground">
                {t("app.salesLeads.country")}
                {/* The option VALUES are the ISO codes the statute lookup reads;
                    only the names a rep sees are translated. */}
                <select
                  className={FIELD}
                  value={place.country}
                  onChange={(e) => setPlace((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="">{t("app.salesLeads.notStated")}</option>
                  <option value="CA">{t("app.salesLeads.countryCanada")}</option>
                  <option value="US">{t("app.salesLeads.countryUnitedStates")}</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                {t("app.salesLeads.stateOrProvince")}
                <input
                  className={FIELD}
                  value={place.province}
                  placeholder={t("app.salesLeads.provincePlaceholder")}
                  onChange={(e) => setPlace((p) => ({ ...p, province: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                {t("app.salesLeads.theirTimeZone")}
                <select
                  className={FIELD}
                  value={place.timeZone}
                  onChange={(e) => setPlace((p) => ({ ...p, timeZone: e.target.value }))}
                >
                  <option value="">{t("app.salesLeads.notStated")}</option>
                  {SALES_SMS_TIME_ZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch({
                  country: place.country,
                  province: place.province,
                  timeZone: place.timeZone,
                })
              }
              className="inline-flex items-center min-h-[44px] text-sm font-semibold px-4 rounded-lg border border-border disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin mr-2" /> : null}
              {t("app.salesLeads.saveWhereTheyAre")}
            </button>
          </div>
        </details>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => patch({ status: s })}
            // 44px: these five chips are how a rep moves a lead through the
            // pipeline one-handed, and they were 26px tall.
            className={`inline-flex items-center min-h-[44px] text-xs font-semibold px-3 rounded-full border disabled:opacity-60 ${
              lead.status === s
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground"
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {/* ── Did they sign up? ───────────────────────────────────────────────
          The rep types the email the client registered with; the server says
          whether that names a linkable company and why. No list to pick from
          — a list is how the owner's cabinet lead got linked to a roofer. The
          Link button exists only on an eligible verdict, and the server
          re-decides at write time. See lib/sales/leadLink.js. */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 size={15} className="text-muted-foreground" />
          {t("app.salesLeads.signedUpAs")}
        </div>
        {lead.convertedCompanyId ? (
          <>
            {/* The company by name when it is in the rep's book, the bare fact
                of a link when it is not — linkedCompanyFor() says why the name
                can be absent. */}
            <p className="text-sm font-medium text-foreground">
              {data?.linkedCompany?.name || t("app.salesLeads.linkedCompanyNotInBook")}
            </p>
            <p className="text-sm text-muted-foreground">
              {/* Two whole sentences rather than a date glued into one: the
                  date sits mid-sentence and lands in a different place in
                  half of these languages. */}
              {lead.convertedAt
                ? t("app.salesLeads.linkedOn", { when: when(lead.convertedAt) })
                : t("app.salesLeads.linked")}
            </p>
            {/* ── Escalating from the lead, which is where the rep is ──────
                A rep hears a technical problem on a call about THIS lead. The
                ticket exists — /sales/support and raiseSupportTicket() — but it
                is keyed on a COMPANY, and nothing connected the two, so a rep
                had to remember the company's name and go and find it on
                another screen while the contractor was still talking.

                Rendered ONLY once the lead has a linked company. A ticket
                cannot be raised about a prospect who has not signed up —
                decideEscalation() re-reads the attribution and refuses — and
                offering the control before then would be a button that can
                only fail. */}
            <Link
              href={`/sales/support?companyId=${encodeURIComponent(lead.convertedCompanyId)}&leadId=${encodeURIComponent(lead.id)}`}
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border text-foreground"
            >
              <LifeBuoy size={15} className="text-muted-foreground" aria-hidden="true" />
              {t("app.salesLeads.raiseSupportTicket")}
            </Link>
            <p className="text-xs text-muted-foreground">
              {t("app.salesLeads.raiseSupportTicketHint")}
            </p>
            {/* ── Undo, inside the window ──────────────────────────────────
                Rendered only while the server says the link can still be
                undone by the rep (decideUnlink, 30 days). Past that, the
                sentence says whom to ask instead of offering a button that
                can only 409. */}
            {data?.linkedCompany?.canUnlink ? (
              unlinkOpen ? (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm text-foreground">{t("app.salesLeads.unlinkConfirm")}</p>
                  <label className="block text-xs text-muted-foreground">
                    {t("app.salesLeads.unlinkReason")}
                    <input
                      type="text"
                      value={unlinkReason}
                      onChange={(e) => setUnlinkReason(e.target.value)}
                      maxLength={500}
                      className={FIELD}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={unlink}
                      className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border text-destructive disabled:opacity-50"
                    >
                      {t("app.salesLeads.unlinkDo")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setUnlinkOpen(false)}
                      className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border disabled:opacity-50"
                    >
                      {t("app.salesLeads.unlinkCancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUnlinkOpen(true)}
                  className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border disabled:opacity-50"
                >
                  {t("app.salesLeads.unlink")}
                </button>
              )
            ) : data?.linkedCompany?.unlinkRefusal ? (
              <p className="text-xs text-muted-foreground">
                {reasonText(data.linkedCompany.unlinkRefusal, "")}
              </p>
            ) : null}
          </>
        ) : (
          <form onSubmit={checkLink} className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("app.salesLeads.linkByEmailHint")}</p>
            <label className="block text-sm text-foreground">
              {t("app.salesLeads.linkEmailLabel")}
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={linkEmail}
                onChange={(e) => {
                  setLinkEmail(e.target.value);
                  setVerdict(null);
                }}
                className={FIELD}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy || !linkEmail.trim()}
                className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border disabled:opacity-50"
              >
                {t("app.salesLeads.linkCheck")}
              </button>
              {/* The Link button ONLY on an eligible verdict. Not disabled-
                  but-present: a greyed Link beside "attributed to another
                  rep" reads as "try again later", and there is no later. */}
              {verdict?.eligible ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={link}
                  className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {t("app.salesLeads.linkDo")}
                </button>
              ) : null}
            </div>
            {verdict ? (
              <p className={`text-sm ${verdict.eligible ? "text-foreground" : "text-muted-foreground"}`}>
                {verdict.company?.name ? (
                  <span className="font-medium">{verdict.company.name}{" — "}</span>
                ) : null}
                {reasonText(verdict.reason, verdict.text)}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <label className="text-sm font-semibold text-foreground">{t("app.salesLeads.notes")}</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy || notes === (lead.notes || "")}
          onClick={() => patch({ notes })}
          className="inline-flex items-center min-h-[44px] text-sm font-semibold px-3 rounded-lg border border-border disabled:opacity-50"
        >
          {t("app.salesLeads.saveNotes")}
        </button>
      </div>

      {/* ── The signup link, by text ────────────────────────────────────────
          Its own component with its own fetch, because it asks a different
          question than the rest of this screen: whether FieldQuo holds a sales
          number, whether the mailing address is set, and what time it is where
          the prospect is. It decides for itself whether to render a button —
          see its header. */}
      <SignupLinkSms leadId={id} />

      {/* ── Conversations ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail size={15} className="text-muted-foreground" />
          {t("app.salesLeads.conversations")}
        </h2>
        {lead.threads.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("app.salesLeads.nothingSentYet")}</p>
        )}
        {/* `thread`, not `t` — `t` is the translator in this file now, and a
            parameter of that name would shadow it inside the row. */}
        {lead.threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/sales/threads/${thread.id}`}
            className="block rounded-lg border border-border px-4 py-3 hover:bg-muted/50"
          >
            <p className="text-sm font-medium text-foreground truncate">{thread.subject}</p>
            <p className="text-xs text-muted-foreground">
              {/* The count is a counted noun, not "message" + an s: four of
                  these nine languages do not form the plural that way. */}
              {t("app.salesLeads.threadSummary", {
                count: t("app.salesLeads.messageCount", { value: thread.messages.length }),
                when: when(thread.lastMessageAt),
              })}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Compose ────────────────────────────────────────────────────────── */}
      <OutreachNotice outreach={outreach} />

      {optedOut && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-2 text-sm">
          <Ban size={16} className="mt-0.5 text-red-700 dark:text-red-300 shrink-0" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">
              {t("app.salesLeads.optedOutTitle")}
            </p>
            {/* The computed sentence, not an invented one. A domain-wide entry
                and a regulator's list are both reachable here, and neither is
                "this person unsubscribed" — telling a rep it was is how they
                ring back to argue about an email nobody sent. Which of the
                eight sources closed the channel is still the route's decision
                and not this screen's; the route now sends the catalogue key it
                composed the sentence from, so the sentence arrives in the
                rep's own language without this screen re-deciding anything. */}
            {optedOutReason ? (
              <p className="text-red-800 dark:text-red-300/90">{optedOutReason}</p>
            ) : null}
            <p className="text-red-800 dark:text-red-300/90">
              {t("app.salesLeads.optedOutBody")}
            </p>
          </div>
        </div>
      )}

      {!lead.email && !optedOut && (
        <p className="text-sm text-muted-foreground">
          {t("app.salesLeads.addEmailToWrite")}
        </p>
      )}

      {canCompose && (
        <form onSubmit={send} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">
            {t("app.salesLeads.newEmailTo", { email: lead.email })}
          </div>
          <p className="text-xs text-muted-foreground">
            {/* `outreach.from` is the WORK mailbox now, not the sign-in
                address — see lib/sales/outreachSender.js's repSendingAddress.
                Saying "your own address" over a mailbox a superadmin assigned
                would be the sentence a rep reads before wondering where a
                reply went. */}
            {t("app.salesLeads.composeFooterNote", { from: outreach.from })}
          </p>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("app.salesLeads.subjectPlaceholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            required
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("app.salesLeads.bodyPlaceholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("app.salesLeads.send")}
          </button>
        </form>
      )}
    </div>
  );
}
