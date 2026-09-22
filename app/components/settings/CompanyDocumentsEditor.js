// app/components/settings/CompanyDocumentsEditor.js
//
// The company document library: insurance, licence, WSIB/CNESST clearance,
// warranty, data sheets — and waivers, which have text instead of a file.
// Rendered by Settings › Presentation and by the home page's "Upload your
// insurance, licence and documents" set-up dialog — the same component.
//
// ── What the client sees, said on every row ─────────────────────────────────
//
// A row's chip is MEASURED: "Expired" comes from expiresAt against now,
// server-side (lib/company/documents.js), and an expired document is out of
// every proposal whatever the "Show on quotes" switch says. The switch is
// still shown on an expired row so the company can see it was on; the row
// says, in words, that the client cannot open it until it is replaced.
//
// A list with no single Save: each add, toggle, edit and removal is its
// own request (onChanged).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Trash2, Upload, PenLine, AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";
import { DOCUMENT_TYPES, WAIVER_MAX_ACKNOWLEDGEMENTS } from "@/lib/company/documents";

const CAPABILITY = "user:manage";
const FILE_TYPES = DOCUMENT_TYPES.filter((x) => x !== "waiver");

function typeLabel(t, type) {
  return t(`app.companyDocuments.type.${type}`, type);
}

function dateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function CompanyDocumentsEditor({ compact = false, onChanged }) {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canEdit = access.canChange(CAPABILITY);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(null); // "file" | "waiver" | null
  const [editingWaiver, setEditingWaiver] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/company-documents");
      setDocs(d.documents || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id, body) {
    setBusy(id);
    setError("");
    try {
      const d = await fetchJson(`/api/settings/company-documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDocs((list) => list.map((x) => (x.id === id ? d.document : x)));
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(doc) {
    if (!window.confirm(t("app.companyDocuments.removeConfirm", "Remove “{title}” from the library? It stops appearing on quotes.", { title: doc.title }))) return;
    setBusy(doc.id);
    setError("");
    try {
      await fetchJson(`/api/settings/company-documents/${doc.id}`, { method: "DELETE" });
      setDocs((list) => list.filter((x) => x.id !== doc.id));
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (error && docs === null) return <p className="text-sm text-red-600">{error}</p>;
  if (docs === null) return <div className="h-40 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  return (
    <div className="space-y-3">
      {!compact && !canEdit && <ReadOnlyNotice capability={CAPABILITY} />}
      <p className="text-xs text-muted-foreground">
        {t("app.companyDocuments.hint", "These appear under “Important documents” on every quote, and a homeowner can open each one. Expiry dates are shown to you, never to the client. A waiver is text the client reads, ticks and signs.")}
      </p>

      {docs.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t("app.companyDocuments.empty", "Nothing in the library yet.")}</p>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="border border-border rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-10 rounded border border-border bg-muted flex items-center justify-center shrink-0 text-primary">
                {doc.type === "waiver" ? <PenLine size={14} /> : <FileText size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground underline-offset-2 hover:underline truncate">
                      {doc.title}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-foreground truncate">{doc.title}</span>
                  )}
                  {doc.expired && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle size={11} /> {t("app.companyDocuments.expired", "Expired — hidden from clients")}
                    </span>
                  )}
                  {!doc.expired && doc.expiresSoon && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {t("app.companyDocuments.expiresSoon", "Expires soon")}
                    </span>
                  )}
                  {doc.type === "waiver" && doc.signable === false && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {t("app.companyDocuments.waiverNoLines", "No acknowledgement lines yet")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(t, doc.type)}
                  {doc.expiresAt
                    ? ` · ${t("app.companyDocuments.expires", "expires {date}", { date: new Date(doc.expiresAt).toLocaleDateString() })}`
                    : doc.type !== "waiver"
                      ? ` · ${t("app.companyDocuments.noExpiry", "no expiry")}`
                      : ""}
                  {doc.summary ? ` · ${doc.summary}` : ""}
                </p>
              </div>
              {doc.type !== "waiver" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span className="hidden sm:inline">{t("app.companyDocuments.showOnQuotes", "Show on quotes")}</span>
                  <input
                    type="checkbox"
                    checked={doc.showOnQuotes}
                    disabled={!canEdit || busy === doc.id}
                    onChange={(e) => patch(doc.id, { showOnQuotes: e.target.checked })}
                    className="w-4 h-4 accent-current"
                    aria-label={t("app.companyDocuments.showOnQuotes", "Show on quotes")}
                  />
                </label>
              )}
              {doc.type === "waiver" && canEdit && (
                <button
                  type="button"
                  onClick={() => setEditingWaiver(editingWaiver === doc.id ? null : doc.id)}
                  className="text-xs font-semibold text-foreground underline underline-offset-2 min-h-9"
                >
                  {t("app.action.edit", "Edit")}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  disabled={busy === doc.id}
                  aria-label={t("app.action.remove", "Remove")}
                  className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50 min-h-9 min-w-9"
                >
                  {busy === doc.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              )}
            </div>
            {doc.type !== "waiver" && canEdit && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <label className="text-muted-foreground">
                  {t("app.companyDocuments.expiry", "Expires")}
                  <input
                    type="date"
                    defaultValue={dateInput(doc.expiresAt)}
                    disabled={busy === doc.id}
                    onBlur={(e) => {
                      if (e.target.value !== dateInput(doc.expiresAt)) patch(doc.id, { expiresAt: e.target.value || null });
                    }}
                    className="ml-2 px-2 py-1 rounded-md border border-border bg-card text-foreground"
                  />
                </label>
                <input
                  type="text"
                  defaultValue={doc.summary || ""}
                  disabled={busy === doc.id}
                  placeholder={t("app.companyDocuments.summaryPlaceholder", "One line for the client — “$2M liability · to Mar 31, 2027”")}
                  onBlur={(e) => {
                    if (e.target.value !== (doc.summary || "")) patch(doc.id, { summary: e.target.value });
                  }}
                  className="flex-1 min-w-[12rem] px-2 py-1 rounded-md border border-border bg-card text-foreground"
                />
              </div>
            )}
            {doc.type === "waiver" && editingWaiver === doc.id && (
              <WaiverForm
                t={t}
                initial={doc}
                busy={busy === doc.id}
                onCancel={() => setEditingWaiver(null)}
                onSubmit={async (body) => {
                  await patch(doc.id, body);
                  setEditingWaiver(null);
                }}
              />
            )}
          </div>
        ))}
      </div>

      {canEdit && !adding && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdding("file")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-inverted text-inverted-foreground font-medium min-h-10"
          >
            <Upload size={14} /> {t("app.companyDocuments.addFile", "Upload PDF or image")}
          </button>
          <button
            type="button"
            onClick={() => setAdding("waiver")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border text-foreground font-medium min-h-10"
          >
            <Plus size={14} /> {t("app.companyDocuments.addWaiver", "Add a waiver")}
          </button>
        </div>
      )}

      {adding === "file" && (
        <FileForm
          t={t}
          onCancel={() => setAdding(null)}
          onSaved={(doc) => {
            setDocs((list) => [...list, doc]);
            setAdding(null);
            onChanged?.();
          }}
        />
      )}
      {adding === "waiver" && (
        <WaiverForm
          t={t}
          onCancel={() => setAdding(null)}
          onSubmit={async (body) => {
            setError("");
            try {
              const d = await fetchJson("/api/settings/company-documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...body, type: "waiver" }),
              });
              setDocs((list) => [...list, d.document]);
              setAdding(null);
              onChanged?.();
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Upload first, then the details. Nothing is written until the file is on Cloudinary. */
function FileForm({ t, onCancel, onSaved }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "insurance", title: "", summary: "", expiresAt: "", showOnQuotes: true });

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const up = await fetchJson("/api/upload", { method: "POST", body: fd });
      setFile({ url: up.url, publicId: up.publicId || "", mimeType: f.type || "", name: up.filename || f.name });
      if (!form.title) setForm((x) => ({ ...x, title: (up.filename || f.name || "").replace(/\.[a-z0-9]+$/i, "") }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const d = await fetchJson("/api/settings/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expiresAt: form.expiresAt || null,
          fileUrl: file.url,
          filePublicId: file.publicId,
          mimeType: file.mimeType,
        }),
      });
      onSaved(d.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-border rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border text-foreground min-h-10 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {file ? file.name : t("app.companyDocuments.chooseFile", "Choose PDF or image")}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={pick} className="hidden" />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="px-2 py-1.5 text-sm rounded-md border border-border bg-card text-foreground min-h-10"
          aria-label={t("app.companyDocuments.typeLabel", "Type")}
        >
          {FILE_TYPES.map((k) => (
            <option key={k} value={k}>
              {typeLabel(t, k)}
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">
          {t("app.companyDocuments.expiryOptional", "Expires (optional)")}
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            className="ml-2 px-2 py-1 rounded-md border border-border bg-card text-foreground"
          />
        </label>
      </div>
      <input
        type="text"
        value={form.title}
        required
        maxLength={200}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder={t("app.companyDocuments.titlePlaceholder", "Title the client sees — “Certificate of insurance”")}
        className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
      />
      <input
        type="text"
        value={form.summary}
        maxLength={200}
        onChange={(e) => setForm({ ...form, summary: e.target.value })}
        placeholder={t("app.companyDocuments.summaryPlaceholder", "One line for the client — “$2M liability · to Mar 31, 2027”")}
        className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={form.showOnQuotes} onChange={(e) => setForm({ ...form, showOnQuotes: e.target.checked })} className="w-4 h-4 accent-current" />
        {t("app.companyDocuments.showOnQuotes", "Show on quotes")}
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!file || saving || !form.title.trim()} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-inverted text-inverted-foreground font-medium min-h-10 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.action.add", "Add")}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm rounded-md border border-border text-foreground min-h-10">
          {t("app.action.cancel", "Cancel")}
        </button>
      </div>
    </form>
  );
}

/** A waiver: title, sections of text, one to five acknowledgement lines, attach-by-default flags. */
function WaiverForm({ t, initial = null, busy = false, onCancel, onSubmit }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [sections, setSections] = useState(
    initial?.body?.sections?.length ? initial.body.sections : [{ heading: "", text: "" }],
  );
  const [lines, setLines] = useState(initial?.body?.acknowledgements?.length ? initial.body.acknowledgements : [""]);
  const [flags, setFlags] = useState({
    attachToQuotes: Boolean(initial?.attachToQuotes),
    attachToJobs: Boolean(initial?.attachToJobs),
    attachToInvoices: Boolean(initial?.attachToInvoices),
  });
  const [saving, setSaving] = useState(false);

  const ready = title.trim() && sections.some((s) => s.text.trim()) && lines.some((l) => l.trim());

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        body: { sections: sections.filter((s) => s.text.trim()), acknowledgements: lines.filter((l) => l.trim()) },
        ...flags,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-border rounded-lg p-3 mt-2 space-y-3">
      <input
        type="text"
        value={title}
        required
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("app.companyDocuments.waiverTitlePlaceholder", "Release of liability — interior painting")}
        className="w-full px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
      />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">{t("app.companyDocuments.waiverSections", "Sections (heading + text)")}</p>
        {sections.map((s, i) => (
          <div key={i} className="grid gap-1.5 sm:grid-cols-[1fr_2fr]">
            <input
              type="text"
              value={s.heading}
              maxLength={200}
              onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))}
              placeholder={t("app.companyDocuments.waiverHeading", "Heading — “Furniture and belongings”")}
              className="px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
            />
            <div className="flex gap-1.5">
              <textarea
                value={s.text}
                rows={2}
                maxLength={5000}
                onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                placeholder={t("app.companyDocuments.waiverText", "What the client should understand about this.")}
                className="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
              />
              {sections.length > 1 && (
                <button type="button" onClick={() => setSections(sections.filter((_, j) => j !== i))} aria-label={t("app.action.remove", "Remove")} className="p-1.5 text-muted-foreground hover:text-red-600 min-w-9">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setSections([...sections, { heading: "", text: "" }])} className="text-xs font-semibold text-foreground underline underline-offset-2 min-h-9">
          + {t("app.companyDocuments.addSection", "Add a section")}
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {t("app.companyDocuments.waiverLines", "Acknowledgement lines (1–{max}) — every one must be ticked before the client can sign", { max: WAIVER_MAX_ACKNOWLEDGEMENTS })}
        </p>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={l}
              maxLength={500}
              onChange={(e) => setLines(lines.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t("app.companyDocuments.waiverLinePlaceholder", "I understand that …")}
              className="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
            />
            {lines.length > 1 && (
              <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={t("app.action.remove", "Remove")} className="p-1.5 text-muted-foreground hover:text-red-600 min-w-9">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {lines.length < WAIVER_MAX_ACKNOWLEDGEMENTS && (
          <button type="button" onClick={() => setLines([...lines, ""])} className="text-xs font-semibold text-foreground underline underline-offset-2 min-h-9">
            + {t("app.companyDocuments.addLine", "Add a line")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-foreground">
        <span className="text-xs text-muted-foreground w-full">{t("app.companyDocuments.attachByDefault", "Attach by default to")}</span>
        {["attachToQuotes", "attachToJobs", "attachToInvoices"].map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} className="w-4 h-4 accent-current" />
            {t(`app.companyDocuments.${k}`, k === "attachToQuotes" ? "Quotes" : k === "attachToJobs" ? "Jobs" : "Invoices")}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!ready || saving || busy} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-inverted text-inverted-foreground font-medium min-h-10 disabled:opacity-50">
          {(saving || busy) && <Loader2 size={14} className="animate-spin" />}
          {initial ? t("app.action.save", "Save") : t("app.action.add", "Add")}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm rounded-md border border-border text-foreground min-h-10">
          {t("app.action.cancel", "Cancel")}
        </button>
      </div>
    </form>
  );
}
