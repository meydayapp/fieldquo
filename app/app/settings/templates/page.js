// app/app/settings/templates/page.js
//
// PDF document layouts — the quote and invoice a client actually receives as
// an attachment.
//
// Sibling to Settings → Email Templates, which owns the *_email types. The
// split is by output medium, not by feeling: a PDF is a page with a fixed
// section order and no CTA button, an email is a scrolling document with
// links. Trying to edit both with one builder produces something bad at both.
//
// The default set lives in app/admin/lib/pdf/defaultSections.js. A company
// with no template still gets a correct PDF — this page exists to change the
// order and drop sections, not to make PDFs work.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Star,
  Copy,
  Trash2,
  Pencil,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const PDF_TYPES = [
  {
    type: "quote_pdf",
    label: "Quote PDF",
    blurb: "Attached when you send a quote or download one.",
  },
  {
    type: "invoice_pdf",
    label: "Invoice PDF",
    blurb: "Attached to invoices and payment requests.",
  },
];

export default function PdfTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null); // type being created
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/settings/document-templates");
      if (!res.ok) throw new Error(t("app.pdfTemplates.loadError", "Couldn't load templates."));
      const data = await res.json();
      // The endpoint returns every type; this page owns the PDF ones only.
      setTemplates(
        (Array.isArray(data) ? data : []).filter((tpl) =>
          PDF_TYPES.some((p) => p.type === tpl.type),
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(type, duplicateFromId = null) {
    setBusyId("create");
    setError("");
    try {
      const res = await fetch("/api/settings/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim() || `${type === "quote_pdf" ? "Quote" : "Invoice"} layout`,
          duplicateFromId,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("app.pdfTemplates.createError", "Couldn't create that."));
      setCreating(null);
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function makeDefault(tpl) {
    setBusyId(tpl.id);
    setError("");
    try {
      const res = await fetch(
        `/api/settings/document-templates/${tpl.id}/activate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't set that as the default.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function remove(tpl) {
    setBusyId(tpl.id);
    setError("");
    try {
      const res = await fetch(`/api/settings/document-templates/${tpl.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't delete that.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading)
    return (
      <div className="animate-pulse h-80 bg-accent rounded-xl max-w-3xl" />
    );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.pdfTemplates.title", "PDF Templates")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.pdfTemplates.subtitle",
            "The layout of the quote and invoice PDFs your clients receive. Looking for the emails themselves?",
          )}{" "}
          <Link href="/app/settings/email-templates" className="underline">
            {t("app.emailTemplates.title", "Email Templates")}
          </Link>
          .
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {PDF_TYPES.map((meta) => {
        const mine = templates.filter((tpl) => tpl.type === meta.type);
        const hasDefault = mine.some((tpl) => tpl.isDefault);

        return (
          <div
            key={meta.type}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-semibold text-foreground">{t(`app.pdfTemplates.${meta.type}Label`, meta.label)}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t(`app.pdfTemplates.${meta.type}Blurb`, meta.blurb)}</p>
              </div>
              <button
                onClick={() => {
                  setCreating(meta.type);
                  setName("");
                }}
                className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0"
              >
                <Plus size={13} /> {t("app.pdfTemplates.newButton", "New")}
              </button>
            </div>

            {creating === meta.type && (
              <div className="mt-4 border border-inverted rounded-lg p-4 space-y-3">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("app.pdfTemplates.namePlaceholder", "What should this layout be called?")}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => create(meta.type)}
                    disabled={busyId === "create"}
                    className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {busyId === "create" && (
                      <Loader2 size={13} className="animate-spin" />
                    )}
                    {t("app.pdfTemplates.startStandard", "Start from the standard layout")}
                  </button>
                  {mine.length > 0 && (
                    <button
                      onClick={() =>
                        create(
                          meta.type,
                          (mine.find((tpl) => tpl.isDefault) || mine[0]).id,
                        )
                      }
                      disabled={busyId === "create"}
                      className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                    >
                      <Copy size={13} /> {t("app.pdfTemplates.copyCurrent", "Copy the current one")}
                    </button>
                  )}
                  <button
                    onClick={() => setCreating(null)}
                    className="text-sm font-semibold text-muted-foreground px-2"
                  >
                    {t("app.action.cancel", "Cancel")}
                  </button>
                </div>
              </div>
            )}

            {mine.length === 0 ? (
              <div className="mt-4 border border-dashed border-border rounded-lg px-4 py-6 text-center">
                <FileText size={22} className="text-muted-foreground mx-auto" />
                {/* Reassurance, not a warning. Nothing is broken here. */}
                <p className="text-sm text-muted-foreground mt-2">
                  {t(
                    "app.pdfTemplates.emptyState",
                    "Using the standard layout. Your PDFs already work — make one only if you want to change the order or drop a section.",
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-border border border-border rounded-lg">
                {mine.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      busyId === tpl.id ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {tpl.name}
                        </span>
                        {tpl.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-inverted text-inverted-foreground shrink-0">
                            <Star size={9} /> In use
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(Array.isArray(tpl.sections) ? tpl.sections : []).length}{" "}
                        sections
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {!tpl.isDefault && (
                        <button
                          onClick={() => makeDefault(tpl)}
                          disabled={Boolean(busyId)}
                          className="text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          Use this
                        </button>
                      )}
                      <Link
                        href={`/app/settings/templates/${tpl.id}/edit`}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Edit template"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => remove(tpl)}
                        disabled={Boolean(busyId)}
                        className="text-muted-foreground hover:text-red-600 dark:text-red-400 disabled:opacity-50"
                        aria-label="Delete template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mine.length > 0 && !hasDefault && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                {t(
                  "app.pdfTemplates.noDefaultWarning",
                  "None of these is marked as in use, so PDFs are still coming out on the standard layout. Pick one with “Use this”.",
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
