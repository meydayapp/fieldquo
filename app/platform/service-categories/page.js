// app/platform/service-categories/page.js
//
// The global service catalogue every company's onboarding pulls from. Editing
// this changes what appears in every tenant, which is why the page says so
// rather than presenting itself as ordinary CRUD.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, AlertCircle, Tags } from "lucide-react";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

import {
  CATEGORY_KEY_RULE,
  categoryKeyFromLabel,
  isValidCategoryKey,
} from "@/lib/platform/serviceCategoryKey";

export default function ServiceCategoriesPage() {
  // null until the server answers. `[]` is the page asserting "the global
  // catalogue is empty", which is the one sentence on this screen that should
  // never be guessed.
  const [categories, setCategories] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // POST here needs "service_category:manage" — admin and superadmin hold it,
  // support does not. This edits a table every tenant reads, so support seeing
  // a create form it can never submit was the worst version of the wrong
  // answer: a control that appears to work, over a global write.
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canManage = can("service_category:manage");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/service-categories");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${res.status}).`);
      }
      setCategories(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derive the key from the label as they type, but let them override it.
  // Keys are referenced in code, so they need to be deliberate — but making
  // someone hand-type "cabinet_refinishing" invites typos.
  function onLabelChange(label) {
    setDraft((d) => ({
      ...d,
      label,
      key: d.keyTouched ? d.key : categoryKeyFromLabel(label),
    }));
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/platform/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: draft.key,
          label: draft.label,
          description: draft.description || null,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't create.");
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Service categories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The global list every company picks from during onboarding.
          </p>
        </div>
        {/* Disabled until the list is in, because the default sort order is
            derived from how many categories there are — offering the button
            over an unknown list would seed the new row at the top of a
            catalogue it knows nothing about. */}
        {canManage && (
          <button
            onClick={() =>
              setDraft({
                key: "",
                label: "",
                description: "",
                sortOrder: categories.length * 10,
                keyTouched: false,
              })
            }
            disabled={!categories}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus size={14} /> New category
          </button>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200">
        Adding a category makes it available to <strong>every</strong> company.
        Keys are referenced in code (add-on seeding, quote types), so they
        can&apos;t be renamed afterwards without a migration.
      </div>

      {/* Renders nothing for an admin or superadmin; one block for support. */}
      <PlatformWriteGate
        status={roleStatus}
        allowed={canManage}
        error={roleError}
        action="Adding a service category"
        who="admins and superadmins"
      >
        {null}
      </PlatformWriteGate>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">New category</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Label
              </label>
              <input
                value={draft.label}
                onChange={(e) => onLabelChange(e.target.value)}
                placeholder="Cabinet Refinishing"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">
                What companies see.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Key
              </label>
              <input
                value={draft.key}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    key: e.target.value,
                    keyTouched: true,
                  })
                }
                placeholder="cabinet_refinishing"
                className={`${inputClass} font-mono text-xs`}
              />
              {/* The rule comes from the same module the route validates
                  with, so the sentence here cannot outlive the regex there. */}
              <p
                className={`text-xs mt-1 ${
                  draft.key && !isValidCategoryKey(draft.key)
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                Permanent. {CATEGORY_KEY_RULE}
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Description
              </label>
              <input
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Sort order
              </label>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={
                busy || !draft.label.trim() || !isValidCategoryKey(draft.key)
              }
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !categories ? (
        // "Companies will have nothing to pick" is an alarming claim about
        // every tenant's onboarding, and it used to fire on any failed
        // request. The failure gets its own sentence.
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <AlertCircle size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The catalogue couldn&apos;t be loaded. This says nothing about what
            companies can pick during onboarding — it says this page
            couldn&apos;t read the list.
          </p>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Tags size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            No categories yet. Companies will have nothing to pick during
            onboarding.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground">{c.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{c.key}</span>
                  {c.description && ` · ${c.description}`}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                #{c.sortOrder}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
