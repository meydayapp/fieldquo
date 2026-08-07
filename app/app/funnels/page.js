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
import { FUNNEL_TEMPLATES } from "@/lib/funnels/templates";

const CHANNEL_LABEL = {
  web: "Web",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/funnels");
      if (!res.ok) return reportResponseError(res, setError, "Couldn't load funnels.");
      setFunnels(await res.json());
    } finally {
      setLoading(false);
    }
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

  async function remove(id) {
    if (!confirm("Delete this funnel? Leads it already produced are kept.")) return;
    const res = await fetch(`/api/funnels/${id}`, { method: "DELETE" });
    if (!res.ok) return reportResponseError(res, setError, "Couldn't delete that funnel.");
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading)
    return <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />;

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
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold shrink-0"
        >
          <Plus size={15} /> New funnel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {showNew && (
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

      {funnels.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Filter size={30} className="text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium text-foreground">No funnels yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Build one from a template or describe it to AI — then share the link on your ads.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {funnels.map((f) => (
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
                    {f.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {f.channel ? `${CHANNEL_LABEL[f.channel] || f.channel} · ` : ""}
                  {f._count?.responses || 0} lead{(f._count?.responses || 0) === 1 ? "" : "s"} ·{" "}
                  updated {new Date(f.updatedAt).toLocaleDateString()}
                </div>
              </button>
              <button
                onClick={() => remove(f.id)}
                className="text-muted-foreground hover:text-red-600"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
