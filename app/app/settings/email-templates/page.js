// app/app/settings/email-templates/page.js
//
// Manage every email template a company has, grouped by what it's used for.
// Editing a template's content happens on its own page — see [id]/page.js.
//
// ── There is no "Active" template here any more ────────────────────────────
//
// This screen used to star one template per type and say the starred one
// "is the one that's actually sent". Nothing read the star: a follow-up rule
// and a campaign each pick a template BY NAME, and the quote, receipt and
// instructions emails are built from the document itself — lib/email/
// quoteEmail.js never opens a DocumentTemplate. A star nothing consults is
// the control-that-appears-to-work AGENTS.md is about, so it is gone, the
// subtitle says what really decides, and the three types nothing sends are
// listed only when a company already wrote one — flagged as unsent, with no
// button to write another. See `sentBy` in app/data/emailTemplateBlocks.js.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, Pencil, Sparkles } from "lucide-react";
import { TEMPLATE_TYPE_META, templateTypeIsSent } from "@/app/data/emailTemplateBlocks";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";

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
  // Deletion is a hard db.documentTemplate.delete with no undo, and the trash
  // icon was one tap. Deleting the Active one silently returns that email to
  // the built-in default — a change to what clients receive, from a row that
  // looks like list housekeeping.
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/document-templates");
      if (!res.ok) {
        reportResponseError(res);
        return;
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      showError(t("app.emailTemplates.loadError", "Could not load templates"));
    } finally {
      setLoading(false);
    }
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
        // Was a raw developer instruction — "run `npx prisma generate && npx
        // prisma db push` and restart the dev server" — shown to contractors.
        throw new Error(
          data.error ||
            t("app.error.network"),
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

  // One request, because a copy assembled from two could half-fail. This used
  // to create a blank template and then PATCH `sections` onto it with no
  // res.ok check at all: a refused PATCH left a row named "… (copy)" holding
  // the STOCK starter blocks, and the list refreshed as if the copy had
  // worked. It also never carried `subject` or `theme`, both of which the send
  // path reads — so even the successful case produced a copy that wasn't one.
  // The route copies all three now; see app/api/settings/document-templates.
  async function handleDuplicate(tpl) {
    setBusyId(tpl.id);
    const res = await fetch("/api/settings/document-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: tpl.type,
        name: `${tpl.name} (copy)`,
        duplicateFromId: tpl.id,
      }),
    });
    if (res.ok) {
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
            {t(
              "app.emailTemplates.whatSends",
              "A follow-up rule or a campaign picks one of these by name — that is what decides which template goes out. The quote, receipt and instructions emails are built from the document itself, in the client's language, and don't use a template.",
            )}
          </p>
          {seedMsg && <p className="text-xs text-muted-foreground mt-2">{seedMsg}</p>}
          <BackToHome />
        </div>
        <button
          onClick={handleSeedDefaults}
          disabled={seeding}
          className="flex items-center gap-2 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold hover:bg-muted disabled:opacity-60 shrink-0"
        >
          <Sparkles size={14} /> {seeding ? t("app.emailTemplates.adding", "Adding…") : t("app.emailTemplates.addDefaults", "Add default templates")}
        </button>
      </div>

      {GROUPS.map((group, i) => {
        const typesInGroup = emailTypes.filter(([, meta]) => meta.group === group);
        return (
          // id on the first group: the dashboard's "Review your emails" set-up
          // step lands at `#templates` (lib/setupSteps.js).
          <div key={group} id={i === 0 ? "templates" : undefined} className="scroll-mt-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t(`app.emailTemplates.group${group}`, group)}
            </h2>
            <div className="space-y-4">
              {typesInGroup.map(([type, meta]) => {
                const typeTemplates = templates.filter((tpl) => tpl.type === type);
                const sent = templateTypeIsSent(type);
                // A type nothing sends is shown only when there is already
                // something to show. Offering "New Template" for it would
                // be inviting somebody to write an email that cannot leave.
                if (!sent && typeTemplates.length === 0) return null;
                return (
                  <div
                    key={type}
                    className="bg-card border border-border rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{meta.label}</h3>
                      {sent && (
                        <button
                          onClick={() => openCreate(type)}
                          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
                        >
                          <Plus size={14} /> {t("app.emailTemplates.newTemplate", "New Template")}
                        </button>
                      )}
                    </div>
                    {!sent && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {t(
                          "app.emailTemplates.notSent",
                          "Nothing sends this type — this email is built from the document itself. Kept because you wrote it; delete it or copy its wording into a follow-up template.",
                        )}
                      </p>
                    )}

                    {typeTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("app.emailTemplates.noneYet", "No templates yet.")}
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
                            </div>
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/app/settings/email-templates/${tpl.id}`}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={t("app.action.edit")}
                              >
                                <Pencil size={14} />
                              </Link>
                              <button
                                onClick={() => handleDuplicate(tpl)}
                                disabled={busyId === tpl.id}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={t("app.action.duplicate")}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(tpl)}
                                disabled={busyId === tpl.id}
                                className="text-muted-foreground hover:text-red-500"
                                aria-label={t("app.action.delete")}
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

      {/* Deleting a template a follow-up rule or campaign points at leaves
          that rule with no template — the cron skips it and the rule shows
          "template deleted". The modal names the template; the rule's own
          list shows the consequence. */}
      <DeleteConfirmModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await handleDelete(confirmDelete.id);
          setConfirmDelete(null);
        }}
        busy={busyId === confirmDelete?.id}
        title={t("app.action.delete")}
        itemName={confirmDelete?.name || ""}
      />
    </div>
  );
}
