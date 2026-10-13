"use client";

// app/app/tenders/TenderForm.js
//
// Create or edit a tender. Every date is typed as the solicitation prints it
// — a date, a time, and the zone the buyer wrote it in (the company's by
// default; most federal closings are Eastern) — and the server computes the
// instants from those (lib/tenders/time.js). A blank box is "not stated",
// never a default.
//
// ══ The buyer is an organisation ═══════════════════════════════════════════
//
// A government department is a client of type "company". When the picked
// client is set up as a person, the form says so and offers the two fixes —
// mark this client as an organisation (PATCH /api/clients/[id] { type }),
// or add a new organisation client (POST /api/clients) — and does NOT block
// the save: the owner's rule is to offer, not to refuse. Both offers are
// drawn only for someone who may edit clients (clientsProperties full_edit,
// what those two routes require); anyone else is told who can.
//
// Contact and money fields are drawn only for a member who may see them; the
// server refuses them from anyone else (lib/tenders/payload.js).

import { useEffect, useMemo, useState } from "react";
import { X, Building2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import { TENDER_SOURCES } from "@/lib/tenders/constants";
import { sourceLabel } from "./words";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10 min-h-[44px]";

/** The zones offered first. Any other IANA zone already on a tender stays selectable. */
const COMMON_ZONES = [
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/Whitehorse",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
];

const TEXT_FIELDS = [
  "title",
  "solicitationNumber",
  "buyerBranch",
  "source",
  "sourceUrl",
  "questionsChannel",
  "timeZone",
  "publishedDate",
  "questionsDeadlineDate",
  "questionsDeadlineTime",
  "siteVisitDate",
  "siteVisitTime",
  "siteVisitLocation",
  "closingDate",
  "closingTime",
  "bidValidityDays",
  "expectedAwardDate",
  "securityClearance",
  "notes",
];
const CONTACT_KEYS = [
  "contractingAuthorityName",
  "contractingAuthorityEmail",
  "contractingAuthorityPhone",
  "technicalAuthorityName",
  "technicalAuthorityEmail",
  "technicalAuthorityPhone",
];
const MONEY_KEYS = ["estimatedValue", "bidSecurityAmount"];

export function formValuesFrom(tender, companyTimeZone) {
  const v = {};
  for (const k of [...TEXT_FIELDS, ...CONTACT_KEYS, ...MONEY_KEYS]) v[k] = tender?.[k] == null ? "" : String(tender[k]);
  v.source = tender?.source || "other";
  v.timeZone = tender?.timeZone || companyTimeZone || "America/Toronto";
  v.siteVisitMandatory = !!tender?.siteVisitMandatory;
  v.bidSecurityRequired = !!tender?.bidSecurityRequired;
  v.clientId = tender?.clientId || "";
  return v;
}

/** What the form sends: blanks as null, contacts and money only when allowed. */
export function bodyFrom(values, capabilities) {
  const body = { clientId: values.clientId };
  for (const k of TEXT_FIELDS) body[k] = values[k] === "" ? null : values[k];
  body.siteVisitMandatory = !!values.siteVisitMandatory;
  body.bidSecurityRequired = !!values.bidSecurityRequired;
  if (capabilities?.canSeeContacts) for (const k of CONTACT_KEYS) body[k] = values[k] === "" ? null : values[k];
  if (capabilities?.canSeeMoney) for (const k of MONEY_KEYS) body[k] = values[k] === "" ? null : values[k];
  return body;
}

function OrganisationNotice({ client, canEditClients, onClientChanged, t }) {
  const [busy, setBusy] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  if (!client || client.type === "company" || client.missing) return null;

  async function markCompany() {
    setBusy("mark");
    setError("");
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "company" }),
      });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.tenders.org.markFailed", "Couldn't change the client.")));
        return;
      }
      onClientChanged({ ...client, type: "company" });
    } finally {
      setBusy("");
    }
  }

  async function createCompany() {
    if (!newName.trim()) {
      setError(t("app.tenders.org.nameRequired", "Type the organisation's name."));
      return;
    }
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: "company" }),
      });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.tenders.org.createFailed", "Couldn't add the organisation.")));
        return;
      }
      const created = await res.json();
      onClientChanged({ id: created.id, name: created.name, type: "company" }, { added: true });
      setNewName("");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2" data-tender-org-notice>
      <p className="text-sm text-amber-950 dark:text-amber-100 flex items-start gap-2">
        <Building2 size={16} className="mt-0.5 shrink-0" />
        <span>
          {t(
            "app.tenders.org.notice",
            "{name} is set up as a person. A tender's buyer is an organisation — a department, a city, a school board — so its contacts belong on an organisation client. You can still save as it is.",
            { name: client.name },
          )}
        </span>
      </p>
      {canEditClients ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={markCompany}
            disabled={!!busy}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {busy === "mark" ? t("app.tenders.saving", "Saving…") : t("app.tenders.org.mark", "Mark {name} as an organisation", { name: client.name })}
          </button>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("app.tenders.org.newPlaceholder", "Or add a new organisation, e.g. Public Services and Procurement Canada")}
              aria-label={t("app.tenders.org.newLabel", "New organisation's name")}
            />
            <button
              type="button"
              onClick={createCompany}
              disabled={!!busy}
              className="min-h-[44px] shrink-0 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              {busy === "create" ? t("app.tenders.saving", "Saving…") : t("app.tenders.org.create", "Add and use it")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-950 dark:text-amber-100">
          {t("app.tenders.org.askSomeone", "Someone who can edit clients can mark it as an organisation.")}
        </p>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/**
 * @param mode           "create" | "edit"
 * @param tender         the hydrated tender (edit)
 * @param capabilities   from the API — what this member may see and edit
 * @param companyTimeZone the default zone for a new tender
 * @param onSaved        handed the response body
 */
export default function TenderForm({ mode, tender, capabilities, companyTimeZone, onSaved, onCancel }) {
  const { t } = useTranslation();
  const creating = mode === "create";
  const [values, setValues] = useState(() => formValuesFrom(tender, companyTimeZone));
  const [clients, setClients] = useState(null);
  const [clientsErrorKey, setClientsErrorKey] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(tender?.client || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchList("/api/clients");
      if (cancelled || result.aborted) return;
      if (!result.ok) {
        setClientsErrorKey(result.errorKey);
        return;
      }
      const list = Array.isArray(result.data) ? result.data : [];
      setClients(list.map((c) => ({ id: c.id, name: c.name, type: c.type })));
      // Opened from a client (?clientId=): pre-pick it, from the company's
      // own list — an unknown id simply picks nothing.
      if (creating && typeof window !== "undefined") {
        const preset = new URLSearchParams(window.location.search).get("clientId");
        const found = preset && list.find((c) => c.id === preset);
        if (found) {
          setSelectedClient({ id: found.id, name: found.name, type: found.type });
          setValues((v) => ({ ...v, clientId: found.id }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creating]);

  const matches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const list = clients || [];
    return (q ? list.filter((c) => String(c.name || "").toLowerCase().includes(q)) : list)
      // Organisations first: they are what a buyer usually is.
      .slice()
      .sort((a, b) => (a.type === "company" ? 0 : 1) - (b.type === "company" ? 0 : 1))
      .slice(0, 8);
  }, [clients, clientSearch]);

  const zones = useMemo(() => {
    const set = new Set(COMMON_ZONES);
    if (companyTimeZone) set.add(companyTimeZone);
    if (values.timeZone) set.add(values.timeZone);
    return [...set];
  }, [companyTimeZone, values.timeZone]);

  const set = (key) => (e) => setValues({ ...values, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  function pickClient(c) {
    setSelectedClient(c);
    setValues({ ...values, clientId: c.id });
    setClientSearch("");
  }

  function clientChanged(c, { added = false } = {}) {
    setSelectedClient(c);
    setValues((v) => ({ ...v, clientId: c.id }));
    setClients((list) => {
      const rest = (list || []).filter((x) => x.id !== c.id);
      return added ? [c, ...rest] : (list || []).map((x) => (x.id === c.id ? c : x));
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!values.clientId) return setError(t("app.tenders.form.clientRequired", "Choose the buyer — the client this tender is from."));
    if (!values.title.trim()) return setError(t("app.tenders.form.titleRequired", "Give the tender a title."));
    if (!values.closingDate || !values.closingTime)
      return setError(t("app.tenders.form.closingRequired", "The closing date and time are required — bids are refused one minute late."));
    setSaving(true);
    try {
      const res = await fetch(creating ? "/api/tenders" : `/api/tenders/${tender.id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyFrom(values, capabilities)),
      });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.tenders.saveFailed", "Couldn't save the tender.")));
        return;
      }
      onSaved?.(await res.json());
    } finally {
      setSaving(false);
    }
  }

  const text = (key, label, extra = {}) => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input className={`${inputClass} mt-1`} value={values[key]} onChange={set(key)} {...extra} />
    </label>
  );

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 space-y-4" data-tender-form>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {creating ? t("app.tenders.form.newTitle", "New tender") : t("app.tenders.form.editTitle", "Edit tender")}
        </h2>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={t("app.tenders.cancel", "Cancel")} className="p-2 -m-2 text-muted-foreground min-h-[44px] min-w-[44px]">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── The buyer ───────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.tenders.form.buyer", "Buyer")}</legend>
        {selectedClient ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground break-words min-w-0">
              {selectedClient.missing ? t("app.tenders.clientRemoved", "Client removed") : selectedClient.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedClient(null);
                setValues({ ...values, clientId: "" });
              }}
              className="min-h-[44px] shrink-0 text-sm font-semibold underline text-foreground"
            >
              {t("app.tenders.form.changeClient", "Change")}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <input
              className={inputClass}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder={t("app.tenders.form.searchClient", "Search your clients — e.g. PSPC, City of Ottawa")}
              aria-label={t("app.tenders.form.searchClientLabel", "Search clients")}
            />
            {clientsErrorKey && <p className="text-sm text-red-700 dark:text-red-300">{t(clientsErrorKey, "Couldn't load your clients.")}</p>}
            {clients && matches.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("app.tenders.form.noClientMatch", "No client matches. Add the buyer under Clients, as an organisation.")}</p>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {matches.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pickClient(c)} className="w-full text-left px-3 py-2 min-h-[44px] text-sm text-foreground">
                    {c.name}
                    {c.type === "company" && (
                      <span className="ml-2 text-xs text-muted-foreground">{t("app.tenders.form.organisation", "Organisation")}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <OrganisationNotice client={selectedClient} canEditClients={!!capabilities?.canEditClients} onClientChanged={clientChanged} t={t} />
      </fieldset>

      {/* ── The solicitation ────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.tenders.form.solicitation", "Solicitation")}</legend>
        {text("title", t("app.tenders.form.title", "Title"), { required: true, maxLength: 200 })}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {text("solicitationNumber", t("app.tenders.form.number", "Solicitation number"), { maxLength: 80 })}
          {text("buyerBranch", t("app.tenders.form.branch", "Branch or department"), { maxLength: 200 })}
          <label className="block text-xs text-muted-foreground">
            {t("app.tenders.form.source", "Published on")}
            <select className={`${inputClass} mt-1`} value={values.source} onChange={set("source")}>
              {TENDER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(t, s)}
                </option>
              ))}
            </select>
          </label>
          {text("sourceUrl", t("app.tenders.form.sourceUrl", "Link to the tender"), { type: "url", inputMode: "url", placeholder: "https://" })}
        </div>
        {text("questionsChannel", t("app.tenders.form.questionsChannel", "How questions must be asked"), {
          maxLength: 300,
          placeholder: t("app.tenders.form.questionsChannelPlaceholder", "e.g. Only through SAP Ariba Event Messages — not by email"),
        })}
      </fieldset>

      {/* ── The people (client contact data) ───────────────────────── */}
      {capabilities?.canSeeContacts && (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.tenders.form.people", "People")}</legend>
          <p className="text-xs text-muted-foreground">{t("app.tenders.form.contracting", "Contracting Authority")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {text("contractingAuthorityName", t("app.tenders.form.name", "Name"))}
            {text("contractingAuthorityEmail", t("app.tenders.form.email", "Email"), { type: "email", inputMode: "email" })}
            {text("contractingAuthorityPhone", t("app.tenders.form.phone", "Phone"), { type: "tel", inputMode: "tel" })}
          </div>
          <p className="text-xs text-muted-foreground">{t("app.tenders.form.technical", "Technical / Project Authority")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {text("technicalAuthorityName", t("app.tenders.form.name", "Name"))}
            {text("technicalAuthorityEmail", t("app.tenders.form.email", "Email"), { type: "email", inputMode: "email" })}
            {text("technicalAuthorityPhone", t("app.tenders.form.phone", "Phone"), { type: "tel", inputMode: "tel" })}
          </div>
        </fieldset>
      )}

      {/* ── Dates, in the buyer's zone ──────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.tenders.form.dates", "Dates")}</legend>
        <label className="block text-xs text-muted-foreground">
          {t("app.tenders.form.timeZone", "Time zone the tender's times are in")}
          <select className={`${inputClass} mt-1`} value={values.timeZone} onChange={set("timeZone")}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {text("closingDate", t("app.tenders.form.closingDate", "Closing date"), { type: "date", required: true })}
          {text("closingTime", t("app.tenders.form.closingTime", "Closing time"), { type: "time", required: true })}
          {text("questionsDeadlineDate", t("app.tenders.form.questionsDate", "Questions deadline"), { type: "date" })}
          {text("questionsDeadlineTime", t("app.tenders.form.questionsTime", "Questions deadline time"), { type: "time" })}
          {text("siteVisitDate", t("app.tenders.form.siteVisitDate", "Site visit"), { type: "date" })}
          {text("siteVisitTime", t("app.tenders.form.siteVisitTime", "Site visit time"), { type: "time" })}
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground min-h-[44px]">
          <input type="checkbox" checked={values.siteVisitMandatory} onChange={set("siteVisitMandatory")} />
          {t("app.tenders.form.siteVisitMandatory", "The site visit is mandatory")}
        </label>
        {text("siteVisitLocation", t("app.tenders.form.siteVisitLocation", "Site visit location"), { maxLength: 300 })}
        <div className="grid grid-cols-2 gap-3">
          {text("publishedDate", t("app.tenders.form.publishedDate", "Published"), { type: "date" })}
          {text("expectedAwardDate", t("app.tenders.form.expectedAward", "Expected award"), { type: "date" })}
          {text("bidValidityDays", t("app.tenders.form.validity", "Bid valid for (days)"), { type: "number", inputMode: "numeric", min: 1, max: 730 })}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("app.tenders.form.datesHint", "Leave a box blank when the tender doesn't say. A date with no time stays a date — reminders for it come at 9:00 that morning.")}
        </p>
      </fieldset>

      {/* ── Requirements ────────────────────────────────────────────── */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.tenders.form.requirements", "Requirements")}</legend>
        {capabilities?.canSeeMoney &&
          text("estimatedValue", t("app.tenders.form.estimatedValue", "Buyer's estimated value"), { inputMode: "decimal", placeholder: "250000" })}
        <label className="flex items-center gap-2 text-sm text-foreground min-h-[44px]">
          <input type="checkbox" checked={values.bidSecurityRequired} onChange={set("bidSecurityRequired")} />
          {t("app.tenders.form.bidSecurity", "Bid security or bond required")}
        </label>
        {values.bidSecurityRequired &&
          capabilities?.canSeeMoney &&
          text("bidSecurityAmount", t("app.tenders.form.bidSecurityAmount", "Bid security amount"), { inputMode: "decimal" })}
        {text("securityClearance", t("app.tenders.form.clearance", "Security clearance required"), {
          maxLength: 300,
          placeholder: t("app.tenders.form.clearancePlaceholder", "e.g. Reliability status for everyone on site"),
        })}
        <label className="block text-xs text-muted-foreground">
          {t("app.tenders.form.notes", "Notes")}
          <textarea className={`${inputClass} mt-1 min-h-[96px]`} value={values.notes} onChange={set("notes")} maxLength={5000} />
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={saving} className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
          {saving ? t("app.tenders.saving", "Saving…") : creating ? t("app.tenders.form.create", "Add tender") : t("app.tenders.form.save", "Save changes")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground">
            {t("app.tenders.cancel", "Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
