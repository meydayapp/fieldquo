// app/sales/calendar/EventModal.js
//
// Create or edit one calendar event. The lead picker is the point of the whole
// feature: choosing a lead fills the business name, contact, phone and website
// from the rep's own pipeline, so a callback booked mid-call is two clicks, not
// a retype. The fields stay editable afterwards — a rep can book a meeting with
// somebody who is not a lead yet — and website is filled by the server from the
// linked prospect on save even when the picker couldn't show it.
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Trash2, Check } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";

// A Date → the value a <input type="date"> / <input type="time"> wants, in the
// viewer's own zone (a rep books in the time they are looking at).
function toDateInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toTimeInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const LABEL = "block text-xs font-medium text-muted-foreground mb-1";

export default function EventModal({ initial, leads, onClose, onSaved }) {
  const { t } = useTranslation();
  const editing = Boolean(initial?.id);

  const start = initial?.startAt ? new Date(initial.startAt) : new Date();
  const end = initial?.endAt ? new Date(initial.endAt) : null;

  const [type, setType] = useState(initial?.type || "callback");
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(toDateInput(start));
  const [startTime, setStartTime] = useState(toTimeInput(start));
  const [endTime, setEndTime] = useState(end ? toTimeInput(end) : "");
  const [leadId, setLeadId] = useState(initial?.leadId || "");
  const [businessName, setBusinessName] = useState(initial?.businessName || "");
  const [contactName, setContactName] = useState(initial?.contactName || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [website, setWebsite] = useState(initial?.website || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const leadById = useMemo(() => {
    const m = new Map();
    for (const l of leads || []) m.set(l.id, l);
    return m;
  }, [leads]);

  // Picking a lead fills the contact from the rep's pipeline. Only overwrites
  // fields the lead actually carries, so a website the rep typed by hand isn't
  // wiped by a lead that has none — the server will still add one from the
  // prospect on save if it can.
  function pickLead(id) {
    setLeadId(id);
    const l = leadById.get(id);
    if (!l) return;
    if (l.businessName) setBusinessName(l.businessName);
    setContactName(l.contactName || "");
    setPhone(l.phone || "");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (!date || !startTime) {
      setError(t("app.salesCal.needDateAndTime"));
      setSaving(false);
      return;
    }
    const startAt = new Date(`${date}T${startTime}`);
    const endAt = endTime ? new Date(`${date}T${endTime}`) : null;
    const payload = {
      type,
      title: title || null,
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : null,
      leadId: leadId || null,
      businessName: businessName || null,
      contactName: contactName || null,
      phone: phone || null,
      website: website || null,
      location: location || null,
      notes: notes || null,
    };
    try {
      if (editing) {
        await fetchJson(`/api/sales/events/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: jsonBody(payload, "event"),
        });
      } else {
        await fetchJson("/api/sales/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonBody(payload, "event"),
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  // Cancel and Done are status writes, not deletes — the row stays.
  async function setStatus(status) {
    setSaving(true);
    setError("");
    try {
      await fetchJson(`/api/sales/events/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ status }, "event"),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground">
            {editing ? t("app.salesCal.editEvent") : t("app.salesCal.newEvent")}
          </h2>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label={t("app.salesCal.close")}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div className="flex gap-2">
            {/* `kind`, not `t`: the loop variable used to shadow the
                translator in a file that now calls t() inside the loop body. */}
            {["callback", "appointment"].map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setType(kind)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                  type === kind
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t(kind === "callback" ? "app.salesCal.callBack" : "app.salesCal.appointment")}
              </button>
            ))}
          </div>

          <div>
            <label className={LABEL}>{t("app.salesCal.leadField")}</label>
            <select className={FIELD} value={leadId} onChange={(e) => pickLead(e.target.value)}>
              <option value="">{t("app.salesCal.noLead")}</option>
              {(leads || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.businessName}
                  {l.contactName ? ` · ${l.contactName}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className={LABEL}>{t("app.salesCal.dateField")}</label>
              <input type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL}>{t("app.salesCal.startField")}</label>
              <input type="time" className={FIELD} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL}>{t("app.salesCal.endField")}</label>
              <input type="time" className={FIELD} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={LABEL}>{t("app.salesCal.titleField")}</label>
            <input
              className={FIELD}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                type === "callback"
                  ? "app.salesCal.titlePlaceholderCallback"
                  : "app.salesCal.titlePlaceholderAppointment",
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>{t("app.salesCal.businessField")}</label>
              <input className={FIELD} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{t("app.salesCal.contactField")}</label>
              <input className={FIELD} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{t("app.salesCal.phoneField")}</label>
              <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{t("app.salesCal.websiteField")}</label>
              <input className={FIELD} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t("app.salesCal.websitePlaceholder")} />
            </div>
          </div>

          {type === "appointment" && (
            <div>
              <label className={LABEL}>{t("app.salesCal.locationField")}</label>
              <input className={FIELD} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("app.salesCal.locationPlaceholder")} />
            </div>
          )}

          <div>
            <label className={LABEL}>{t("app.salesCal.notesField")}</label>
            <textarea className={`${FIELD} min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {editing ? t("app.salesCal.saveChanges") : t("app.salesCal.addToCalendar")}
            </button>
            {editing && (
              <>
                <button
                  type="button"
                  onClick={() => setStatus("done")}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border text-sm font-medium px-3 py-2 text-green-700 dark:text-green-400"
                >
                  <Check size={15} /> {t("app.salesCal.markDone")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("cancelled")}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border text-sm font-medium px-3 py-2 text-muted-foreground"
                >
                  <Trash2 size={15} /> {t("app.salesCal.cancelEvent")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
