// app/app/settings/email-templates/page.js
//
// Manage every email template a company has, grouped by what it's used for.
// One template per (type) can be "Active" — that's the one an automated
// send (quote/instructions/receipt/follow-up) or a Follow-up rule uses.
// Editing a template's content happens on its own page — see [id]/page.js.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Star, Copy, Trash2, Pencil, Sparkles } from "lucide-react";
import { TEMPLATE_TYPE_META } from "@/app/data/emailTemplateBlocks";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const GROUPS = ["Automated", "Marketing", "Custom"];

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingType, setCreatingType] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  function load() {
    setLoading(true);
    return fetch("/api/settings/document-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const emailTypes = Object.entries(TEMPLATE_TYPE_META);

  async function handleSeedDefaults() {
    setSeeding(true);
    setSeedMsg("");
    const res = await fetch("/api/settings/document-templates/seed-defaults", {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      setSeedMsg(
        data.created > 0
          ? t("app.emailTemplates.seedAdded", "Added {count} default templates.", { count: data.created })
          : t("app.emailTemplates.seedAllPresent", "You already have a template for every automated type."),
      );
      load();
    } else {
      setSeedMsg(data.error || t("app.emailTemplates.seedError", "Could not seed defaults"));
    }
    setSeeding(false);
  }

  function openCreate(type) {
    setCreatingType(type);
    setNewName(`${TEMPLATE_TYPE_META[type].label} template`);
    setCreateError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/settings/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: creatingType, name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not create template. If you just changed the schema, run `npx prisma generate && npx prisma db push` and restart the dev server.",
        );
      }
      setCreatingType(null);
      // "Create & edit" should actually open the editor, not just refresh the list.
      router.push(`/app/settings/email-templates/${data.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(tpl) {
    setBusyId(tpl.id);
    const res = await fetch("/api/settings/document-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tpl.type, name: `${tpl.name} (copy)` }),
    });
    if (res.ok) {
      const created = await res.json();
      await fetch(`/api/settings/document-templates/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: tpl.sections }),
      });
      load();
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  async function handleDelete(id) {
    setBusyId(id);
    const res = await fetch(`/api/settings/document-templates/${id}`, {
      method: "DELETE",
    });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  async function handleActivate(id) {
    setBusyId(id);
    const res = await fetch(`/api/settings/document-templates/${id}/activate`, {
      method: "POST",
    });
    if (res.ok) load(); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.emailTemplates.title", "Email Templates")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.emailTemplates.descPart1", "Customize the emails your clients get. The template marked")}{" "}
            <strong>{t("app.status.active", "Active")}</strong>{" "}
            {t("app.emailTemplates.descPart2", "for each type is the one that's actually sent — build as many drafts and variations as you want.")}
          </p>
          {seedMsg && <p className="text-xs text-muted-foreground mt-2">{seedMsg}</p>}
        </div>
        <button
          onClick={handleSeedDefaults}
          disabled={seeding}
          className="flex items-center gap-2 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold hover:bg-muted disabled:opacity-60 shrink-0"
        >
          <Sparkles size={14} /> {seeding ? t("app.emailTemplates.adding", "Adding…") : t("app.emailTemplates.addDefaults", "Add default templates")}
        </button>
      </div>

      {GROUPS.map((group) => {
        const typesInGroup = emailTypes.filter(([, meta]) => meta.group === group);
        return (
          <div key={group}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t(`app.emailTemplates.group${group}`, group)}
            </h2>
            <div className="space-y-4">
              {typesInGroup.map(([type, meta]) => {
                const typeTemplates = templates.filter((tpl) => tpl.type === type);
                return (
                  <div
                    key={type}
                    className="bg-card border border-border rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{meta.label}</h3>
                      <button
                        onClick={() => openCreate(type)}
                        className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
                      >
                        <Plus size={14} /> {t("app.emailTemplates.newTemplate", "New Template")}
                      </button>
                    </div>

                    {typeTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("app.emailTemplates.noTemplates", "No templates yet — using the built-in default.")}
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {typeTemplates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="flex items-center justify-between py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground">{tpl.name}</span>
                              {tpl.isDefault && (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                  <Star size={11} className="fill-emerald-700" />
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {!tpl.isDefault && (
                                <button
                                  onClick={() => handleActivate(tpl.id)}
                                  disabled={busyId === tpl.id}
                                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                  Set Active
                                </button>
                              )}
                              <Link
                                href={`/app/settings/email-templates/${tpl.id}`}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Edit ${tpl.name}`}
                              >
                                <Pencil size={14} />
                              </Link>
                              <button
                                onClick={() => handleDuplicate(tpl)}
                                disabled={busyId === tpl.id}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Duplicate ${tpl.name}`}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(tpl.id)}
                                disabled={busyId === tpl.id}
                                className="text-muted-foreground hover:text-red-500"
                                aria-label={`Delete ${tpl.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {creatingType && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setCreatingType(null)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("app.emailTemplates.newModalTitle", "New {label} template", {
                label: TEMPLATE_TYPE_META[creatingType]?.label,
              })}
            </h2>
            {createError && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2 mb-3">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                autoFocus
                placeholder={t("app.emailTemplates.namePlaceholder", "Template name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {creating ? t("app.emailTemplates.creating", "Creating…") : t("app.emailTemplates.createAndEdit", "Create & edit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
