// app/components/leads/BookVisitPanel.js
//
// Book the estimate visit from the lead, and type in what the phone call
// taught you while you are there.
//
// ── Why it converts first ──────────────────────────────────────────────────
//
// An appointment reaches a lead two ways (lib/leads/linkedDocuments.js):
// Appointment.quoteId, and Booking.leadRequestId for a visit the homeowner
// booked themselves. Neither exists for a visit a person enters by hand on a
// lead with no quote — so it would be created and then be invisible on the
// lead that created it, and absent from the agency's appointment.booked.
//
// So this does what the owner said it should: the same thing "Create quote
// from this lead" does, then hangs the visit on that quote. convertLeadToQuote
// is idempotent, so a lead that already has a quote keeps it — booking a
// second visit does not spawn a second quote. The draft lands at zero total
// and the homeowner never sees it; it is where the visit's findings go, which
// is what a draft quote is for.
//
// The alternative was a new Appointment.leadRequestId column. Rejected: a
// third link to the same fact, on a live schema, when the product already has
// one that every reader of a lead's appointments understands.
//
// ── The fields are the ones the lead is MISSING ────────────────────────────
//
// A Messenger lead arrives as a name and a thread because Meta sends nothing
// else, and the contractor gets the rest by ringing them. Only the empty
// columns are offered, so this is never a place to quietly rewrite a number
// the homeowner typed — lib/leads/leadGaps.js refuses that server-side too,
// and says in `kept` what it refused.
//
// ── The address is a Places pick, like everywhere else ─────────────────────
//
// It was a plain text box here and an autocomplete on all twenty other
// address fields in the app, which the owner reported as the inconsistency it
// is. It is also the money bug underneath: a typed address yields a converted
// client with no city, province or country, and the tax resolver then has
// nothing to resolve — an Ottawa company's Gatineau client silently gets
// Ontario's 13% instead of Quebec's 14.975%. So the structured components
// travel with the string, through lib/leads/intakeShape.js, all the way to
// the Client row (lib/leads/convertLead.js findOrCreateClient).
//
// AddressField rather than AddressAutocomplete directly: it is the one
// wrapper in the repo that keeps a TYPED address working in all three ways
// Google can be missing, including the key that exists with Places disabled,
// which throws inside an effect and would otherwise blank the lead page. It
// lives under /book because that is where it was written; importing it beats
// copying its error boundary into a ninth back-office caller.
"use client";

import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import AddressField from "@/app/book/[companySlug]/AddressField";
import { reportResponseError } from "@/lib/clientErrors";

const EMPTY_CONTACT = { phone: "", email: "", address: "", city: "", province: "", country: "" };

export default function BookVisitPanel({ leadId, lead, canBook, onBooked, t }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  // city/province/country are only ever what a Places pick returned. They
  // stay "" for a typed address, and the server writes a key only when it is
  // non-empty — an absent province must reach the client row as null, never
  // as the company's own (AGENTS.md: absence of a statement is not a
  // statement).
  const [contact, setContact] = useState(EMPTY_CONTACT);

  if (!canBook) return null;

  const leadAddress =
    lead?.intake && typeof lead.intake === "object" && typeof lead.intake.address === "string"
      ? lead.intake.address
      : "";
  // Only what the lead does not already hold. A field it has is not a gap,
  // and offering it would invite an edit this flow refuses to make.
  const gaps = [
    !lead?.phone && { key: "phone", label: t("app.field.phone", "Phone"), type: "tel" },
    !lead?.email && { key: "email", label: t("app.field.email", "Email"), type: "email" },
    !leadAddress && { key: "address", label: t("app.field.address", "Address"), type: "text" },
  ].filter(Boolean);

  async function book(e) {
    e.preventDefault();
    if (!when) {
      setError(t("app.visitNew.pickDateTime"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 1. The quote the visit will hang on, carrying anything typed above.
      //    Idempotent — an existing quote is returned, not replaced.
      const convertRes = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      if (!convertRes.ok) {
        await reportResponseError(convertRes, setError, t("app.leads.convertError"));
        return;
      }
      const converted = await convertRes.json();

      // 2. The visit itself, through the endpoint the quote page already
      //    uses, so there is one way an appointment gets made.
      const apptRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: converted.quoteId,
          scheduledAt: new Date(when).toISOString(),
          location: (contact.address || leadAddress || "").trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!apptRes.ok) {
        // The quote exists now. Say so rather than letting the next press
        // look like it made a second one.
        await reportResponseError(apptRes, setError, t("app.visitNew.scheduleError"));
        return;
      }

      setOpen(false);
      setWhen("");
      setNotes("");
      setContact(EMPTY_CONTACT);
      onBooked?.(converted);
    } catch {
      setError(t("app.visitNew.scheduleErrorNetwork"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <CalendarPlus size={14} aria-hidden="true" />
        {t("app.leads.book.open", "Book a visit")}
      </button>
    );
  }

  return (
    <form onSubmit={book} className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <p className="text-xs text-muted-foreground">{t("app.leads.book.intro")}</p>

      <label className="block">
        <span className="block text-xs font-medium text-foreground mb-1">{t("app.visitNew.when")}</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {gaps.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-foreground">{t("app.leads.book.missing")}</legend>
          {gaps.map((f) =>
            f.key === "address" ? (
              <div key={f.key}>
                <label
                  htmlFor="lead-book-address"
                  className="block text-[11px] text-muted-foreground mb-1"
                >
                  {f.label}
                </label>
                <AddressField
                  id="lead-book-address"
                  value={contact.address}
                  onChange={(v) =>
                    // A typed character makes it a different, unidentified
                    // address: the previous pick's city and province describe
                    // somewhere else, and keeping them would attach a tax
                    // jurisdiction nobody chose. Same rule, same reason, as
                    // app/app/leads/new/NewLeadForm.js.
                    setContact((c) => ({ ...c, address: v, city: "", province: "", country: "" }))
                  }
                  onResolved={({ address, city, province, country }) =>
                    setContact((c) => ({
                      ...c,
                      address: address || c.address,
                      city: city || "",
                      province: province || "",
                      country: country || "",
                    }))
                  }
                  placeholder={t("app.clientNew.addressPlaceholder")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <label key={f.key} className="block">
                <span className="block text-[11px] text-muted-foreground mb-1">{f.label}</span>
                <input
                  type={f.type}
                  value={contact[f.key]}
                  onChange={(e) => setContact((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            ),
          )}
        </fieldset>
      )}

      <label className="block">
        <span className="block text-xs font-medium text-foreground mb-1">{t("app.visitNew.notes")}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t("app.visitNew.notesPlaceholder")}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p role="alert" className="text-xs text-foreground bg-muted rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {t("app.visitNew.submit")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
        >
          {t("app.action.cancel")}
        </button>
      </div>
    </form>
  );
}
