// app/app/funnels/page.js
//
// The funnels dashboard — create a lead funnel from a channel template (or with
// AI), see how each is doing, open the builder. English-first like the public
// funnel and self-quote flow; a full i18n pass is a follow-up.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Filter,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { FUNNEL_TEMPLATES } from "@/lib/funnels/templates";
import { can } from "@/lib/permissions";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { funnelStatusLabel } from "@/lib/funnels/status";
import { usePermissions } from "@/app/providers/PermissionProvider";
// This page is otherwise still English — a keying pass of its own, not this
// one. The delete dialog is keyed here anyway because it was carrying the
// `${n === 1 ? "" : "s"}` defect on a destructive control, and because
// DeleteConfirmModal's own buttons are translated now: leaving the sentence
// above them in English made the dialog read as half-finished in every
// language.
import { useTranslation } from "@/app/hooks/useTranslation";

const CHANNEL_LABEL = {
  web: "Web",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export default function FunnelsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // ── Every control on this page is a manager's control ────────────────────
  //
  // POST /api/funnels, POST /api/funnels/generate and DELETE
  // /api/funnels/[id] all require `user:manage` (see requireAdmin in
  // app/api/funnels/route.js), and the list GET does now too. So "New funnel",
  // the AI generator and the per-row bin were three refusals dressed as
  // buttons — and the AI one is the worst of them, because a crew member could
  // describe a whole funnel, wait through the spinner, and get a 403.
  //
  // The coarse role, because that is the axis this feature area gates on. The
  // grid has no funnels category, so asking a level here would be asking a
  // different question than the endpoint.
  //
  // Falls OPEN when the provider has not resolved — PermissionProvider's rule.
  const caller = usePermissions();
  const canManageFunnels = !caller?.role || can(caller.role, "user:manage");
  // null until the server answers — see lib/loadState.js.
  const [funnels, setFunnels] = useState(null);
  const [loading, setLoading] = useState(true);
  // `error` is for failed MUTATIONS (create/generate/delete) and keeps its own
  // banner. A failed LOAD is a different thing and goes through ListState, so
  // the two can never stack up into "here is an error, and also you have
  // nothing".
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  // The funnel awaiting a delete confirmation — the whole row, not just its
  // id, so the dialog can name it and say how many runs go with it.
  const [confirmFunnel, setConfirmFunnel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/funnels");
    if (result.aborted) return;
    if (result.ok) setFunnels(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(payload) {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return reportResponseError(res, setError, "Couldn't create the funnel.");
      const f = await res.json();
      router.push(`/app/funnels/${f.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/funnels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      if (!res.ok) return reportResponseError(res, setError, "Couldn't generate the funnel.");
      const f = await res.json();
      router.push(`/app/funnels/${f.id}`);
    } finally {
      setCreating(false);
    }
  }

  // ── What "delete this funnel" actually deletes ───────────────────────────
  //
  // The old confirm said "Leads it already produced are kept" and stopped
  // there, which is true and is the smaller half of the truth. `FunnelResponse`
  // and `FunnelEvent` both hang off Funnel with `onDelete: Cascade` (see
  // prisma/schema.prisma), so the row that goes takes with it:
  //
  //   * every run through the funnel — the actual answers a homeowner tapped,
  //     including the runs that never reached the contact step and so never
  //     became a lead at all;
  //   * every step-level beacon, which IS the drop-off report on the builder
  //     page. "60% quit at the budget question" is the whole reason those rows
  //     exist, and after this there is nothing left to compute it from.
  //
  // Naming only the part that survives is how a destructive operation gets
  // read as a tidy-up. So the dialog names both halves, and it is a real modal
  // rather than window.confirm — a native confirm cannot show the sentence
  // that matters at more than one line, and it is the only "are you sure" in
  // this product that wasn't one.
  async function remove(id) {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/funnels/${id}`, { method: "DELETE" });
      if (!res.ok)
        return reportResponseError(res, setError, "Couldn't delete that funnel.");
      setFunnels((prev) => prev.filter((f) => f.id !== id));
      setConfirmFunnel(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Filter size={22} /> Funnels
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Mobile-first, tap-through lead funnels for your ads and link-in-bio. Each
            one qualifies visitors and drops a scored lead straight into your pipeline.
          </p>
        </div>
        {canManageFunnels && (
          <button
            onClick={() => setShowNew((v) => !v)}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold shrink-0"
            data-tour="funnels-new"
          >
            <Plus size={15} /> New funnel
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* The panel asks the question itself rather than trusting that the one
          button which opens it stays hidden — it is the half that costs
          somebody a typed-out AI prompt. */}
      {canManageFunnels && showNew && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* AI */}
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Sparkles size={15} /> Describe it and let AI build it
            </div>
            <div className="flex gap-2">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. A TikTok funnel for exterior house painting that qualifies budget and books an estimate"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-card"
                onKeyDown={(e) => e.key === "Enter" && generateWithAI()}
              />
              <button
                onClick={generateWithAI}
                disabled={creating || !aiPrompt.trim()}
                className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Generate
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or start from a template <div className="h-px flex-1 bg-border" />
          </div>

          {/* Templates */}
          <div className="grid gap-2 sm:grid-cols-2">
            {FUNNEL_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => create({ template: t.key })}
                disabled={creating}
                className="text-left border border-border rounded-lg px-4 py-3 hover:border-foreground/30 transition-colors disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {CHANNEL_LABEL[t.channel]} · quiz → qualify → capture
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => create({})}
            disabled={creating}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            or start from a blank funnel
          </button>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={(funnels ?? []).length === 0}
        skeleton={<div className="animate-pulse h-96 bg-accent rounded-xl" />}
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Filter size={30} className="text-muted-foreground mx-auto" />
            <p className="mt-3 font-medium text-foreground">No funnels yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Build one from a template or describe it to AI — then share the link on your ads.
            </p>
          </div>
        }
      >
        <div className="space-y-2">
          {(funnels ?? []).map((f) => (
            <div
              key={f.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
            >
              <button
                onClick={() => router.push(`/app/funnels/${f.id}`)}
                className="flex-1 text-left min-w-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{f.name}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      f.status === "published"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {funnelStatusLabel(f.status)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {f.channel ? `${CHANNEL_LABEL[f.channel] || f.channel} · ` : ""}
                  {f._count?.responses || 0} lead{(f._count?.responses || 0) === 1 ? "" : "s"} ·{" "}
                  updated {new Date(f.updatedAt).toLocaleDateString()}
                </div>
              </button>
              {canManageFunnels && (
                <button
                  onClick={() => setConfirmFunnel(f)}
                  className="text-muted-foreground hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </ListState>

      <DeleteConfirmModal
        isOpen={!!confirmFunnel}
        onClose={() => setConfirmFunnel(null)}
        onConfirm={() => remove(confirmFunnel.id)}
        title={t("app.funnels.deleteTitle", "Delete this funnel?")}
        message={
          // The count is stated only when it is KNOWN. `_count` is absent on a
          // payload the list didn't ask for it in, and `?? 0` there would tell
          // somebody "no runs are affected" about a funnel that has had
          // hundreds — a confident zero standing in for "we didn't check".
          //
          // The count is a countedNoun, not `${n} run${n === 1 ? "" : "s"}`.
          // That was the English plural rule wearing a template literal: it
          // printed a bare Latin "s" on a Mandarin screen and "1 дзвінків" —
          // genitive plural, for one — on a Ukrainian one. See
          // lib/i18n/plurals.js.
          typeof confirmFunnel?._count?.responses === "number"
            ? t(
                "app.funnels.deleteMessage",
                "The funnel goes, and so does the whole drop-off report behind it — {runs} in all. Leads already in your pipeline stay where they are.",
                {
                  runs: t("app.funnels.runCount", {
                    value: confirmFunnel._count.responses,
                  }),
                },
              )
            : t(
                "app.funnels.deleteMessageUnknown",
                "The funnel goes, and so does every run through it and the whole drop-off report behind them. Leads already in your pipeline stay where they are.",
              )
        }
        itemName={confirmFunnel?.name}
        busy={deleting}
      />
    </div>
  );
}
