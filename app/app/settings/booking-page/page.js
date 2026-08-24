// app/app/settings/booking-page/page.js
"use client";

import { useState, useEffect } from "react";
import EmbedCode from "@/app/components/settings/EmbedCode";
import { Plus, X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const MODES = [
  { key: "visit", label: "Visit their place", hint: "You go to them" },
  { key: "call", label: "Phone call", hint: "You ring them" },
  { key: "video", label: "Video call", hint: "You send a link" },
];

// ── Mirrors of lib/booking/changePolicy.js ───────────────────────────────────
//
// The sentence under these inputs has to be the behaviour, not a second opinion
// about it, so the two fallbacks are reproduced here exactly: an unreadable
// change window reads as 24 hours (never 0, which would mean "cancellable until
// the van pulls up"), and an unset refund cutoff falls back to the change
// window (never 0, which would refund a cancellation made minutes before).
//
// Duplicated rather than imported because changePolicy is a server-side module
// this page must not pull into the client bundle; if either fallback changes
// there, it changes here. That is the one thing to check when editing it.
function previewChangeHours(raw) {
  if (raw === "" || raw === null || raw === undefined) return 24;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 24;
}

function previewRefundHours(raw, changeHours) {
  if (raw === "" || raw === null || raw === undefined) return changeHours;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : changeHours;
}

// Server shape → the three fields this page edits.
function policyFrom(info) {
  return {
    changeHours: String(info?.bookingChangeNoticeHours ?? 24),
    refund: Boolean(info?.refundVisitFeeOnCancel),
    // "" is not 0: blank means "same notice as the change window", which is
    // what a null column means to changePolicy.
    refundHours:
      info?.refundCutoffHours == null ? "" : String(info.refundCutoffHours),
  };
}

// ── Hidden, not read-only ──────────────────────────────────────────────────
//
// Every field on this page configures the company's PUBLIC booking page: which
// visit types a homeowner can pick, how long they run, how much notice a
// cancellation needs, and — the one the owner caught — what a homeowner is
// charged to hold a slot. That visit-fee input accepted typing, sent a PATCH on
// blur, and collected "Only owners, admins and supervisors can change booking
// types" from the server. Sitting next to a note saying only owners can change
// it, which is the worst of both: an input that looks live, a sentence saying
// it isn't, and no way to tell which to believe.
//
// Read-only was considered and rejected. Nothing here is information a crew
// member needs to do a job — their own bookable hours are on Availability,
// which correctly says "your hours" and stays visible to everyone. Showing them
// the company's cancellation policy as text would be honest but pointless.
//
// "user:manage" matches what /api/event-types and /api/settings/business-info
// already enforce on every write, so supervisors keep the page unchanged.
export default function BookingPageSettings() {
  const access = useSettingsAccess();
  if (!access.canSee("user:manage"))
    return <NoAccessPanel capability="user:manage" />;
  return <BookingPageScreen />;
}

function BookingPageScreen() {
  const { t } = useTranslation();
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  // The company's answer to "how long is a visit". Used as the default for any
  // consultation FieldQuo creates automatically when someone sets availability —
  // which was hardcoded to an hour, whatever the trade.
  const [visitMinutes, setVisitMinutes] = useState(60);
  const [savingVisit, setSavingVisit] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  // Which ways a client may meet them. Drives the choice on the public booking
  // page — with one mode selected the visitor isn't asked, because a control with
  // one option is a label.
  const [modes, setModes] = useState(["visit"]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    location: "",
  });
  const [travel, setTravel] = useState({ enabled: true, buffer: 0 });
  const [arrival, setArrival] = useState(0);
  // How much notice the crew needs, whether a paid visit fee comes back, and
  // how much notice the money needs. Read on the public side by
  // lib/booking/changePolicy.js.
  const [policy, setPolicy] = useState({
    changeHours: "24",
    refund: false,
    refundHours: "",
  });
  // The same pair findBookingCompany resolves at the other end of the embed —
  // bookingSlug wins because a company that set one chose that URL.
  const [slug, setSlug] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/event-types").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/settings/business-info").then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([types, info]) => {
        setEventTypes(Array.isArray(types) ? types : []);
        // Whether the company can actually collect a booking fee (Connect done).
        setStripeReady(Boolean(info?.stripeChargesEnabled));
        if (info?.defaultVisitMinutes)
          setVisitMinutes(info.defaultVisitMinutes);
        if (Array.isArray(info?.bookingModes) && info.bookingModes.length)
          setModes(info.bookingModes);
        setTravel({
          enabled: info?.travelCheckEnabled !== false,
          buffer: info?.travelBufferMinutes ?? 0,
        });
        setArrival(info?.arrivalWindowMinutes ?? 0);
        if (info) setPolicy(policyFrom(info));
        setSlug(info?.bookingSlug || info?.slug || "");
        setForm((f) => ({
          ...f,
          durationMinutes: info?.defaultVisitMinutes || 60,
        }));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveTravel(patch) {
    // Optimistic, then reconciled from the server's answer — the buffer is
    // clamped server-side, so echoing back what was typed would show 600 when
    // 120 was stored.
    setTravel((prev) => ({ ...prev, ...patch }));
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.setBooking.travelSaveError"));
      return;
    }
    const info = await res.json().catch(() => null);
    if (info) {
      setTravel({
        enabled: info.travelCheckEnabled !== false,
        buffer: info.travelBufferMinutes ?? 0,
      });
    }
  }

  async function saveArrival(minutes) {
    setArrival(minutes);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrivalWindowMinutes: minutes }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.setBooking.arrivalSaveError"));
      return;
    }
    const info = await res.json().catch(() => null);
    if (info) setArrival(info.arrivalWindowMinutes ?? 0);
  }

  /**
   * Save the cancellation policy.
   *
   * All three fields go together on every save because they are read together —
   * a refund cutoff is meaningless without the change window it falls back to.
   *
   * On rejection the fields go BACK to what is stored rather than sitting there
   * showing a number the server refused; the browser's own `min`/`step` are
   * only a convenience, and the API is what decides (see parseNoticeHours in
   * app/api/settings/business-info/route.js).
   */
  async function savePolicy(next) {
    const before = policy;
    setPolicy(next);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingChangeNoticeHours: next.changeHours,
        refundVisitFeeOnCancel: next.refund,
        // Blank clears the column, which is how "same as the change window" is
        // stored — not 0, which would be "refund right up to the start time".
        refundCutoffHours: next.refundHours === "" ? null : next.refundHours,
      }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.setBooking.policySaveError"));
      setPolicy(before);
      return;
    }
    const info = await res.json().catch(() => null);
    if (info) setPolicy(policyFrom(info));
  }

  async function toggleMode(key) {
    // Never allowed to reach zero — that would leave a booking page nobody can
    // complete. The last remaining mode simply can't be switched off.
    const next = modes.includes(key)
      ? modes.filter((m) => m !== key)
      : [...modes, key];
    if (!next.length) return;
    setModes(next);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingModes: next }),
    });
    if (!res.ok)
      await reportResponseError(res, t("app.setBooking.modesSaveError"));
  }

  async function saveVisitMinutes(minutes) {
    setVisitMinutes(minutes);
    setSavingVisit(true);
    const res = await fetch("/api/settings/business-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultVisitMinutes: minutes }),
    });
    setSavingVisit(false);
    if (!res.ok) {
      await reportResponseError(res, t("app.setBooking.visitSaveError"));
    }
  }

  /**
   * Change one event type's length.
   *
   * The API has always accepted durationMinutes on PATCH; nothing in the UI ever
   * sent it, so a booking length was fixed the moment it was created — a
   * classic field that could be written and never was.
   */
  async function setDuration(eventType, minutes) {
    const res = await fetch(`/api/event-types/${eventType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationMinutes: minutes }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEventTypes((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      await reportResponseError(res, t("app.setBooking.durationSaveError"));
    }
  }

  // Save any patch (fee, promo, …) to one event type and reconcile it in place.
  async function patchEventType(et, patch) {
    const res = await fetch(`/api/event-types/${et.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setEventTypes((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      await reportResponseError(res);
    }
  }

  // Dollars in the UI, cents in the DB. Blank/0 → null ("free").
  const toCents = (dollars) => {
    const n = Math.round(Number(dollars) * 100);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetch("/api/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setEventTypes((prev) => [...prev, created]);
      setShowForm(false);
      setForm({
        name: "",
        durationMinutes: 60,
        bufferBefore: 0,
        bufferAfter: 0,
        location: "",
      });
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function toggleActive(eventType) {
    const res = await fetch(`/api/event-types/${eventType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !eventType.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEventTypes((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  // What the two numbers currently in the boxes actually mean, resolved the
  // same way the policy resolves them.
  const changeH = previewChangeHours(policy.changeHours);
  const refundH = previewRefundHours(policy.refundHours, changeH);
  // refundOnCancel() returns "nothing_paid" before it looks at any of this, so
  // a company whose booking types are all free has a refund setting that can
  // never fire. Worth saying, rather than letting them think it's doing work.
  const anyFee = eventTypes.some((et) => et.feeCents > 0);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.settings.bookingPage")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setBooking.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold"
        >
          <Plus size={14} /> {t("app.setBooking.newEventType")}
        </button>
      </div>

      {/* The export, on the screen where the calendar is set up.
          Somebody who has just finished configuring their availability, their
          event types and their booking policy asks "right — how do I use
          this?" next. Sending them to Settings → Lead Capture Form to find the
          code for the thing they are looking at is how it never gets pasted. */}
      <EmbedCode
        slug={slug}
        widget="book"
        title={t("app.setLeadForm.bookTitle")}
        heading={t(
          "app.setBooking.embedHeading",
          "Put your booking calendar on your website",
        )}
        note={t(
          "app.setBooking.embedNote",
          "Paste this where you want the calendar to appear. It works on Wix, Squarespace, WordPress and hand-written HTML — it is an ordinary HTML element. The small script only resizes the box as the visitor moves through the steps; if your site strips scripts the calendar still works at a fixed height.",
        )}
      />

      {/* One answer to "how long is a visit", used for anything FieldQuo creates
          automatically. Separate from the per-event lengths below because those
          are exceptions and this is the rule. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 mb-4">
        <h2 className="font-semibold text-foreground">
          {t("app.setBooking.visitLengthTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-3">
          {t("app.setBooking.visitLengthHint")}
        </p>
        <div className="mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("app.setBooking.meetTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2.5">
            {t("app.setBooking.meetHint")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMode(m.key)}
                title={t(`app.setBooking.modeHint.${m.key}`, m.hint)}
                className={`text-sm px-3 py-2 rounded-full border transition-colors ${
                  modes.includes(m.key)
                    ? "border-foreground bg-inverted text-inverted-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`app.setBooking.mode.${m.key}`, m.label)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Travel between jobs ─────────────────────────────────────────
            Only relevant when someone is actually driving to a client, so it's
            hidden entirely for a phone-only company rather than shown greyed
            out — a control that can't apply is noise. */}
        {modes.includes("visit") && (
          <div className="mb-5 pt-5 border-t border-border">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("app.setBooking.travelTitle")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.setBooking.travelHint")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={travel.enabled}
                onClick={() =>
                  saveTravel({ travelCheckEnabled: !travel.enabled })
                }
                className={`shrink-0 w-11 h-6 rounded-full transition-colors ${
                  travel.enabled ? "bg-emerald-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    travel.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {travel.enabled && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground mb-1">
                  {t("app.setBooking.bufferTitle")}
                </p>
                <p className="text-xs text-muted-foreground mb-2.5">
                  {t("app.setBooking.bufferHint")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 10, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => saveTravel({ travelBufferMinutes: m })}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        travel.buffer === m
                          ? "border-foreground bg-inverted text-inverted-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === 0
                        ? t("app.setBooking.none")
                        : t("app.setBooking.minutesShort", { m })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Arrival window ──────────────────────────────────────────── */}
        {modes.includes("visit") && (
          <div className="mb-5 pt-5 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-1">
              {t("app.setBooking.promiseTitle")}
            </p>
            <p className="text-xs text-muted-foreground mb-2.5">
              {t("app.setBooking.promiseHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => saveArrival(m)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    arrival === m
                      ? "border-foreground bg-inverted text-inverted-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === 0
                    ? t("app.setBooking.exactTime")
                    : t("app.setBooking.plusMinusMin", { m })}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {arrival === 0
                ? t("app.setBooking.previewExact")
                : t("app.setBooking.previewWindow", {
                    lo:
                      arrival >= 60 ? "1:00" : arrival === 30 ? "1:30" : "1:45",
                    hi:
                      arrival >= 60 ? "3:00" : arrival === 30 ? "2:30" : "2:15",
                  })}
            </p>
          </div>
        )}

        <p className="text-sm font-semibold text-foreground mb-1">
          {t("app.setBooking.visitLengthTitle")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => saveVisitMinutes(m)}
              disabled={savingVisit}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
                visitMinutes === m
                  ? "border-foreground bg-inverted text-inverted-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("app.setBooking.minutesShort", { m })}
            </button>
          ))}
        </div>
      </div>

      {/* ── Changes & cancellations ────────────────────────────────────────
          Two windows, because they answer two different questions: how much
          warning the CREW needs, and how much warning the MONEY needs. The
          second is allowed to be longer than the first — that combination is
          the interesting one, not a mistake. See lib/booking/changePolicy.js,
          which is what actually enforces all of this. */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
        <h2 className="font-semibold text-foreground">
          {t("app.setBooking.changesTitle", "Changes & cancellations")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          {t("app.setBooking.changesHint")}
        </p>

        <div className="mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("app.setBooking.noticeTitle")}
          </p>
          <p className="text-xs text-muted-foreground mb-2.5">
            {t("app.setBooking.noticeHint")}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              min="0"
              step="1"
              value={policy.changeHours}
              onChange={(e) =>
                setPolicy((p) => ({ ...p, changeHours: e.target.value }))
              }
              onBlur={(e) =>
                savePolicy({ ...policy, changeHours: e.target.value })
              }
              className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
            />
            <span className="text-muted-foreground">
              {t("app.setBooking.hoursUnit", "hours")}
            </span>
          </label>
        </div>

        {/* ── Does the fee come back? ──────────────────────────────────────
            Off by default and deliberately so: a visit fee is the contractor's
            money the moment it is taken. */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("app.setBooking.refundTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.setBooking.refundHint")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={policy.refund}
              onClick={() => savePolicy({ ...policy, refund: !policy.refund })}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors ${
                policy.refund ? "bg-emerald-600" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  policy.refund ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* The cutoff decides nothing while refunds are off — refundOnCancel
              returns "policy_off" before it ever reads it. So it isn't shown
              greyed out, it isn't shown at all: a control that can't apply is
              a control that appears to work and doesn't. */}
          {policy.refund && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground mb-1">
                {t("app.setBooking.refundNoticeTitle")}
              </p>
              <p className="text-xs text-muted-foreground mb-2.5">
                {t("app.setBooking.refundNoticeHint")}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={String(changeH)}
                  value={policy.refundHours}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, refundHours: e.target.value }))
                  }
                  onBlur={(e) =>
                    savePolicy({ ...policy, refundHours: e.target.value })
                  }
                  className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                />
                <span className="text-muted-foreground">
                  {t("app.setBooking.hoursUnit", "hours")}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ── What these numbers mean, in words ────────────────────────────
            A number with no consequence stated is how this gets misconfigured:
            "24" and "48" look like a pair of harmless defaults right up until a
            homeowner is told their deposit isn't coming back. */}
        <div className="mt-5 pt-4 border-t border-border space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {changeH === 0
              ? t("app.setBooking.previewChangeAny")
              : changeH === 1
                ? t("app.setBooking.previewChangeOne")
                : t("app.setBooking.previewChange", { h: changeH })}
          </p>
          <p className="text-xs text-muted-foreground">
            {!policy.refund
              ? t("app.setBooking.previewRefundOff")
              : refundH === 0
                ? t("app.setBooking.previewRefundAny")
                : refundH === 1
                  ? t("app.setBooking.previewRefundOne")
                  : t("app.setBooking.previewRefund", { h: refundH })}
          </p>
          {/* Legal, and occasionally what someone means — but far likelier to
              be the two numbers entered the wrong way round, so it's a note
              rather than an error. */}
          {policy.refund && refundH < changeH && (
            <p className="text-xs text-amber-600">
              {t("app.setBooking.refundWiderNote", { h: changeH })}
            </p>
          )}
          {policy.refund && !anyFee && (
            <p className="text-xs text-muted-foreground">
              {t("app.setBooking.refundNoFeeNote")}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {eventTypes.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            {t("app.setBooking.noEventTypes")}
          </div>
        )}
        {eventTypes.map((et) => (
          <div
            key={et.id}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{et.name}</div>
                <div className="text-xs text-muted-foreground">
                  {et.location || t("app.setBooking.noLocation")}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground text-xs">
                    {t("app.setBooking.length")}
                  </span>
                  <select
                    value={et.durationMinutes}
                    onChange={(e) => setDuration(et, Number(e.target.value))}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                  >
                    {/* The saved value is included even if it isn't one of the
                      presets, so an existing 75-minute visit isn't silently
                      rounded to 60 the moment someone opens this page. */}
                    {[...new Set([...DURATIONS, et.durationMinutes])]
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {t("app.setBooking.minutesShort", { m })}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={et.active}
                    onChange={() => toggleActive(et)}
                  />
                  {t("app.status.active")}
                </label>
              </div>
            </div>

            {/* Fee for this booking type — a paid on-site / estimate visit. Free
              when blank. Collected via Stripe Connect at booking; the contractor
              can later credit it onto the client's invoice by hand. */}
            <div
              className="mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-3"
              data-tour="booking-fee"
            >
              <label className="text-sm">
                <span className="block text-xs text-muted-foreground mb-1">
                  {t("app.setBooking.visitFee", "Visit fee")}
                </span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={
                      et.feeCents ? (et.feeCents / 100).toString() : ""
                    }
                    onBlur={(e) =>
                      patchEventType(et, { feeCents: toCents(e.target.value) })
                    }
                    placeholder={t("app.setBooking.free", "Free")}
                    className="w-28 border border-border rounded-lg pl-6 pr-2 py-1.5 text-sm bg-background"
                  />
                </div>
              </label>

              {et.feeCents > 0 && (
                <>
                  <label className="text-sm">
                    <span className="block text-xs text-muted-foreground mb-1">
                      {t("app.setBooking.promoPrice", "Promo price")}
                    </span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={
                          et.promoFeeCents
                            ? (et.promoFeeCents / 100).toString()
                            : ""
                        }
                        onBlur={(e) =>
                          patchEventType(et, {
                            promoFeeCents: toCents(e.target.value),
                          })
                        }
                        className="w-28 border border-border rounded-lg pl-6 pr-2 py-1.5 text-sm bg-background"
                      />
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-sm pb-1.5">
                    <input
                      type="checkbox"
                      checked={!!et.promoActive}
                      disabled={!et.promoFeeCents}
                      onChange={(e) =>
                        patchEventType(et, { promoActive: e.target.checked })
                      }
                    />
                    {t("app.setBooking.promoOn", "Promo on")}
                  </label>
                </>
              )}
            </div>

            {/* Can't collect a fee without a connected payout account. Prompt it
              rather than silently taking a fee that goes nowhere. */}
            {et.feeCents > 0 && !stripeReady && (
              <div className="mt-2 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-2">
                {t(
                  "app.setBooking.connectToCharge",
                  "Connect Stripe to collect this fee —",
                )}{" "}
                <a
                  href="/app/settings/payments"
                  className="underline font-medium"
                >
                  {t("app.setBooking.goToPayments", "set it up in Payments")}
                </a>
                .
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">
                {t("app.setBooking.newEventType")}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                placeholder={t("app.setBooking.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  placeholder={t("app.setBooking.minutesPlaceholder")}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder={t("app.setBooking.bufferBefore")}
                  value={form.bufferBefore}
                  onChange={(e) =>
                    setForm({ ...form, bufferBefore: Number(e.target.value) })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder={t("app.setBooking.bufferAfter")}
                  value={form.bufferAfter}
                  onChange={(e) =>
                    setForm({ ...form, bufferAfter: Number(e.target.value) })
                  }
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder={t("app.setBooking.locationPlaceholder")}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
              >
                {t("app.action.create")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
