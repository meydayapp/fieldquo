// app/app/leads/new/NewLeadForm.js
//
// The hand-entered lead: name, phone, email, address, service and a note —
// exactly those six, the owner's list. Anything more (budget, timeline, how
// they heard of us) waits for the owner to ask for it; a field added here is a
// field somebody on the phone feels obliged to fill.
//
// Rules are the intake path's own, checked here first only so the person is
// told in their language before a round trip — POST /api/leads re-checks every
// one and is the one that decides:
//   - a name;
//   - a phone number or an email, at least one (the self-quote and embed
//     forms' rule — a lead nobody can reach is not a lead);
//   - an email, when given, that could be delivered to (lib/validation.js).
//
// ── On a phone ──────────────────────────────────────────────────────────────
//
// The Save button is in the page flow at the foot of the form, NOT a fixed
// bar. A bar pinned to the bottom of the viewport is exactly what the iOS
// keyboard sits on top of (or drags up the page with it), and this form is
// short enough to never need one: six fields, and the note is last, directly
// above the button. Every control is at least 44px tall, the grid collapses to
// one column below `sm`, and nothing has a fixed width.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput, emailProblem } from "@/lib/validation";
import { fetchJson, errorText, FETCH_ERROR_KEYS } from "@/lib/fetchJson";
import { showToast } from "@/lib/toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

const inputClass =
  "w-full min-h-11 border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// The route's refusal codes, in the reader's language. Anything else falls
// back to the route's own sentence (lib/fetchJson.js errorText).
const REFUSAL_KEYS = {
  name_required: "app.leadNew.nameRequired",
  contact_required: "app.leadNew.contactRequired",
  invalid_email: "app.leadNew.badEmail",
  bad_categoryId: "app.leadNew.badService",
};

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  address: "",
  // The structured halves of the address, set only by a Places pick and
  // cleared the moment the address is typed over — a hand-edited street with
  // the previous pick's province still attached is an invented jurisdiction.
  city: "",
  province: "",
  country: "",
  categoryId: "",
  note: "",
};

export default function NewLeadForm({ services = [] }) {
  const router = useRouter();
  const { t } = useTranslation();
  // Same pair as the Create row (lib/permissions/nav.js "app.quickAdd.request")
  // and POST /api/leads. The server shell (page.js) has already refused on the
  // enforceable member; this is the client half, kept for the same shape as
  // /app/clients/new.
  const canCreate = useHasLevel("requests", "view_create_edit");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!name) return setError(t("app.leadNew.nameRequired"));
    if (!email && !phone) return setError(t("app.leadNew.contactRequired"));
    if (email && emailProblem(email) !== null) return setError(t("app.leadNew.badEmail"));

    setSaving(true);
    try {
      const data = await fetchJson("/api/leads", {
        method: "POST",
        body: {
          name,
          phone,
          email,
          address: form.address.trim(),
          city: form.city,
          province: form.province,
          country: form.country,
          categoryId: form.categoryId || null,
          note: form.note.trim(),
        },
      });
      // The toast layer is mounted by the /app shell, not this page, so it
      // survives the navigation below and is read on the board.
      showToast({ message: t("app.leadNew.created", { name }), tone: "success" });
      // ?lead=<id> opens the board's drawer on the lead just made — the
      // board's own deep link, the one a conversation's "Open lead" uses.
      router.push(`/app/leads?lead=${encodeURIComponent(data.id)}`);
    } catch (err) {
      // A 401 carries the route's bare "Unauthorized", which errorText would
      // print verbatim; the session-expired sentence says what to do about it.
      setError(
        err.status === 401
          ? t(FETCH_ERROR_KEYS.unauthorised, err.message)
          : errorText(t, err, REFUSAL_KEYS),
      );
      setSaving(false);
    }
  }

  if (!canCreate) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <Link
          href="/app/leads"
          className="inline-flex items-center gap-1.5 min-h-11 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t("app.leadNew.back")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("app.leadNew.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.leadNew.subtitle")}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4"
      >
        <div>
          <label htmlFor="lead-name" className="text-sm font-medium text-foreground block mb-1">
            {t("app.field.name")} <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-name"
            autoFocus
            required
            // Staff type SOMEONE ELSE's details here; the browser offering the
            // staff member's own name and number is the wrong person's data.
            autoComplete="off"
            enterKeyHint="next"
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lead-phone" className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.phone")}
            </label>
            <input
              id="lead-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="next"
              className={inputClass}
              placeholder="555-123-4567"
              value={form.phone}
              onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.email")}
            </label>
            <input
              id="lead-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="next"
              className={inputClass}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{t("app.leadNew.contactHint")}</p>

        <div>
          {/* A wrapping label rather than htmlFor: AddressAutocomplete owns its
              <input> and takes no id. Typing works with or without Google —
              the box is a plain input the suggestions attach to, so a key
              that fails to load leaves manual entry, not a dead field. */}
          <label className="block">
            <span className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.address")}
            </span>
            <AddressAutocomplete
              value={form.address}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, address: v, city: "", province: "", country: "" }))
              }
              onPlaceSelected={({ address, city, province, country }) =>
                setForm((prev) => ({
                  ...prev,
                  address,
                  city: city || "",
                  province: province || "",
                  country: country || "",
                }))
              }
              placeholder={t("app.clientNew.addressPlaceholder")}
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <label htmlFor="lead-service" className="text-sm font-medium text-foreground block mb-1">
            {t("app.leadNew.service")}
          </label>
          {services.length > 0 ? (
            <select
              id="lead-service"
              className={inputClass}
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">{t("app.leadNew.serviceNone")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            // No select at all rather than one with a single "not sure"
            // option: a picker with nothing to pick is a control that does
            // nothing. Services are switched on in Settings › Services.
            <p id="lead-service" className="text-sm text-muted-foreground">
              {t("app.leadNew.noServices")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lead-note" className="text-sm font-medium text-foreground block mb-1">
            {t("app.leadNew.note")}
          </label>
          <textarea
            id="lead-note"
            rows={3}
            className={inputClass}
            placeholder={t("app.leadNew.notePlaceholder")}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        {/* Beside the button, not above the form as /app/clients/new has it:
            on a phone the Save button is a screen below the page's top, and a
            refusal printed up there was measured off-screen (scrollY 100, the
            banner above it) — the tap looked like it did nothing. */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2">
          <Link
            href="/app/leads"
            className="inline-flex items-center justify-center min-h-11 text-sm font-medium text-muted-foreground px-4"
          >
            {t("app.action.cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 w-full sm:w-auto bg-inverted text-inverted-foreground px-6 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.leadNew.creating") : t("app.leadNew.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
