// app/components/clients/OrganizationCard.js
//
// The Organization card on a client's page (owner, 2026-10-13: "wouldn't it
// be better then to have an organization card? because most of the companies
// probably do not go with government contracts").
//
// Drawn ONLY for a client of type "company". A homeowner's page has no such
// card and looks exactly as it did — this component returns null for anything
// else, and GET /api/clients/[id] does not even send an individual the
// organisation fields (lib/clients/contacts.js organizationShape). Switching a
// client to "company" reveals it; switching back hides it and deletes
// nothing.
//
// What it holds:
//   * the department / branch the work is for (Client.organizationUnit)
//   * the people, with their roles — the primary contact first (the client's
//     own contactName / email / phone, which every document uses), then the
//     others (model ClientContact). Add, edit, reorder, make primary, remove.
//   * procurement notes (Client.procurementNotes) — "Questions only through
//     SAP Ariba Event Messages".
//   * "Requires a PO number on invoices" (Client.requiresPo), shown here for
//     an organisation rather than in the contact block, and still edited on
//     the client's Edit form beside the other invoice settings.
//
// The contacts list is contact data: a member below clientsProperties
// "full_view" receives no `contacts` key at all (redactClient), and the card
// says they are hidden rather than drawing an empty list.
"use client";

import { useState } from "react";
import { Building, Users, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Star, Mail, Phone, Hash, ClipboardList, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { formatPhoneInput } from "@/lib/validation";
import { CONTACT_ROLE_SUGGESTIONS } from "@/lib/clients/contacts";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/10";
const EMPTY = { name: "", role: "", email: "", phone: "", notes: "" };

export default function OrganizationCard({ client, canEdit, onChanged }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null); // contact id | "primary" | "new" | null
  const [form, setForm] = useState(EMPTY);
  const [orgEditing, setOrgEditing] = useState(false);
  const [org, setOrg] = useState({ organizationUnit: "", procurementNotes: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);

  if (!client || client.type !== "company") return null;

  const contactsHidden = !Array.isArray(client.contacts);
  const contacts = contactsHidden ? [] : client.contacts;
  const others = contacts.filter((c) => !c.isPrimary);
  const base = `/api/clients/${client.id}/contacts`;

  // Each caller hands over the request itself (`send`), written out inside
  // its own fetch so the view-only guard's scan can place every write.
  async function call(send, key) {
    setBusy(key);
    setError("");
    try {
      const res = await send();
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.orgCard.saveError"));
        return false;
      }
      await onChanged?.();
      return true;
    } finally {
      setBusy("");
    }
  }

  function startEdit(c) {
    setError("");
    setEditing(c ? (c.id || "primary") : "new");
    setForm(c ? { name: c.name || "", role: c.role || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" } : EMPTY);
  }

  async function saveContact(e) {
    e.preventDefault();
    const send =
      editing === "new"
        ? () => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : () => fetch(`${base}/${encodeURIComponent(editing)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (await call(send, "save")) setEditing(null);
  }

  async function move(id, dir) {
    const ids = others.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await call(() => fetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }), `move:${id}`);
  }

  async function makePrimary(id) {
    await call(() => fetch(`${base}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "make_primary" }) }), `primary:${id}`);
  }

  async function remove(id) {
    if (await call(() => fetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }), `remove:${id}`)) setConfirmRemove(null);
  }

  function startOrgEdit() {
    setError("");
    setOrg({ organizationUnit: client.organizationUnit || "", procurementNotes: client.procurementNotes || "" });
    setOrgEditing(true);
  }

  async function saveOrg(e) {
    e.preventDefault();
    const ok = await call(
      () => fetch(`/api/clients/${client.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(org) }),
      "org",
    );
    if (ok) setOrgEditing(false);
  }

  const contactForm = (
    <form onSubmit={saveContact} className="space-y-2 border border-border rounded-lg p-3 bg-muted/40" data-contact-form>
      <input required placeholder={t("app.orgCard.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      <input
        list={`org-roles-${client.id}`}
        placeholder={t("app.orgCard.rolePlaceholder")}
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        className={inputClass}
      />
      <datalist id={`org-roles-${client.id}`}>
        {CONTACT_ROLE_SUGGESTIONS.map((key) => (
          <option key={key} value={t(key)} />
        ))}
      </datalist>
      <input type="email" placeholder={t("app.field.email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
      <input placeholder="555-123-4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })} className={inputClass} />
      <textarea rows={2} placeholder={t("app.orgCard.contactNotes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
      {editing === "primary" && <p className="text-xs text-muted-foreground">{t("app.orgCard.primaryEditHint")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy === "save"} className="min-h-[44px] px-4 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
          {busy === "save" && <Loader2 size={14} className="animate-spin" />}
          {t("app.orgCard.saveContact")}
        </button>
        <button type="button" onClick={() => setEditing(null)} className="min-h-[44px] px-4 rounded-full border border-border text-sm font-semibold">
          {t("app.action.cancel")}
        </button>
      </div>
    </form>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" data-organization-card>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Building size={15} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground text-sm">{t("app.orgCard.title")}</h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Department / branch and the procurement notes. */}
        {orgEditing ? (
          <form onSubmit={saveOrg} className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              {t("app.orgCard.department")}
              <input value={org.organizationUnit} onChange={(e) => setOrg({ ...org, organizationUnit: e.target.value })} placeholder={t("app.orgCard.departmentPlaceholder")} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              {t("app.orgCard.procurementNotes")}
              <textarea rows={3} value={org.procurementNotes} onChange={(e) => setOrg({ ...org, procurementNotes: e.target.value })} placeholder={t("app.orgCard.procurementPlaceholder")} className={`${inputClass} mt-1`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy === "org"} className="min-h-[44px] px-4 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-60">
                {t("app.orgCard.save")}
              </button>
              <button type="button" onClick={() => setOrgEditing(false)} className="min-h-[44px] px-4 rounded-full border border-border text-sm font-semibold">
                {t("app.action.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-foreground">
              <Building size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">
                <span className="text-muted-foreground">{t("app.orgCard.department")}: </span>
                {client.organizationUnit || <span className="text-muted-foreground italic">{t("app.orgCard.notSet")}</span>}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              <ClipboardList size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <span className="min-w-0 break-words whitespace-pre-line">
                <span className="text-muted-foreground">{t("app.orgCard.procurementNotes")}: </span>
                {client.procurementNotes || <span className="text-muted-foreground italic">{t("app.orgCard.notSet")}</span>}
              </span>
            </div>
            {/* Client.requiresPo — read by the invoice send; edited on the
                client's Edit form with the other invoice settings. */}
            {client.requiresPo && (
              <div className="flex items-center gap-2 text-sm text-foreground" data-client-requires-po>
                <Hash size={14} className="text-muted-foreground shrink-0" />
                {t("app.clientDetail.requiresPo")}
              </div>
            )}
            {canEdit && (
              <button type="button" onClick={startOrgEdit} className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline">
                <Pencil size={13} /> {t("app.orgCard.editDetails")}
              </button>
            )}
          </div>
        )}

        {/* The people. */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users size={14} className="text-muted-foreground" /> {t("app.orgCard.contacts")}
            </h3>
            {canEdit && !contactsHidden && editing !== "new" && (
              <button type="button" onClick={() => startEdit(null)} className="min-h-[44px] inline-flex items-center gap-1 text-sm font-semibold text-foreground" data-add-contact>
                <Plus size={14} /> {t("app.orgCard.addContact")}
              </button>
            )}
          </div>

          {contactsHidden ? (
            <p className="text-xs text-muted-foreground italic">{t("app.access.restricted", "Hidden by your access level")}</p>
          ) : (
            <ul className="space-y-2">
              {contacts.length === 0 && editing !== "new" && (
                <li className="text-sm text-muted-foreground">{t("app.orgCard.noContacts")}</li>
              )}
              {contacts.map((c, idx) => {
                const key = c.id || "primary";
                if (editing === key) return <li key={key}>{contactForm}</li>;
                const position = c.isPrimary ? -1 : others.findIndex((o) => o.id === c.id);
                return (
                  <li key={key} className="border border-border rounded-lg px-3 py-2.5" data-contact-row={key}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-foreground break-words">{c.name || t("app.orgCard.unnamed")}</span>
                      {c.role && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.role}</span>}
                      {c.isPrimary && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">
                          <Star size={11} /> {t("app.orgCard.primary")}
                        </span>
                      )}
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-sm text-foreground mt-1 min-w-0">
                        <Mail size={13} className="text-muted-foreground shrink-0" />
                        <span className="break-all">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-foreground mt-0.5">
                        <Phone size={13} className="text-muted-foreground shrink-0" />
                        {c.phone}
                      </div>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line break-words">{c.notes}</p>}
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <button type="button" onClick={() => startEdit(c)} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 text-xs font-semibold text-foreground px-2" aria-label={t("app.action.edit")}>
                          <Pencil size={13} /> {t("app.action.edit")}
                        </button>
                        {!c.isPrimary && (
                          <>
                            <button type="button" disabled={Boolean(busy)} onClick={() => makePrimary(c.id)} className="min-h-[44px] inline-flex items-center gap-1 text-xs font-semibold text-foreground px-2 disabled:opacity-50">
                              <Star size={13} /> {t("app.orgCard.makePrimary")}
                            </button>
                            <button type="button" disabled={Boolean(busy) || position <= 0} onClick={() => move(c.id, -1)} aria-label={t("app.orgCard.moveUp")} title={t("app.orgCard.moveUp")} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground disabled:opacity-30">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" disabled={Boolean(busy) || position >= others.length - 1} onClick={() => move(c.id, 1)} aria-label={t("app.orgCard.moveDown")} title={t("app.orgCard.moveDown")} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground disabled:opacity-30">
                              <ArrowDown size={14} />
                            </button>
                            {confirmRemove === c.id ? (
                              <span className="inline-flex flex-wrap items-center gap-1 text-xs text-foreground">
                                {t("app.orgCard.removeConfirm", { name: c.name })}
                                <button type="button" disabled={Boolean(busy)} onClick={() => remove(c.id)} className="min-h-[44px] px-2 font-semibold text-red-700 dark:text-red-300 underline">
                                  {t("app.orgCard.remove")}
                                </button>
                                <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-[44px] px-2 underline text-muted-foreground">
                                  {t("app.action.cancel")}
                                </button>
                              </span>
                            ) : (
                              <button type="button" onClick={() => setConfirmRemove(c.id)} aria-label={t("app.orgCard.remove")} title={t("app.orgCard.remove")} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-red-700 dark:text-red-300">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {idx === 0 && c.isPrimary && <p className="text-xs text-muted-foreground mt-1">{t("app.orgCard.primaryHint")}</p>}
                  </li>
                );
              })}
              {editing === "new" && <li>{contactForm}</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
