// app/app/settings/website/PairPhotos.js
//
// Before/after pairing, one pair at a time.
//
// ── Why it's a sequence and not a grid of dropdowns ────────────────────────
//
// "Right now I can upload 3, 4, 6 — how will it know which is which?"
//
// It can't. So the company says, and the interaction is built so that saying it
// takes two taps: pick the before, pick the after. Then it asks again. Six photos
// become three known pairs through three short iterations, and at no point does
// the software guess which shot is the finished work.
//
// A grid with "before/after" dropdowns per photo was the obvious alternative and
// is worse: it makes you hold the grouping in your head, and it lets you produce
// four "befores" and no "afters" without noticing.
"use client";

import { useState } from "react";
import { Check, X, Loader2, ArrowRight, Images } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PairPhotos({ pool = [], pairs = [], onSaved, onClose }) {
  const { t } = useTranslation();
  // Which photo is being placed. "before" first, because that's the one only a
  // person knows.
  const [picking, setPicking] = useState("before");
  const [draft, setDraft] = useState({ before: null, after: null, caption: "" });
  const [made, setMade] = useState(pairs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A photo already used in a pair is out of the pool. Reusing one across two
  // pairs is almost always a misclick, and the resulting page shows the same
  // image as both a before and an after.
  const used = new Set(made.flatMap((p) => [p.before, p.after]));
  const available = pool.filter((url) => !used.has(url));

  function choose(url) {
    if (picking === "before") {
      setDraft((d) => ({ ...d, before: url }));
      setPicking("after");
    } else {
      setDraft((d) => ({ ...d, after: url }));
      setPicking("caption");
    }
  }

  function addPair() {
    if (!draft.before || !draft.after) return;
    setMade((m) => [...m, { ...draft }]);
    setDraft({ before: null, after: null, caption: "" });
    setPicking("before");
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetchJson("/api/settings/website/photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs: made }),
      });
      onSaved?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const step =
    picking === "before"
      ? t("app.pairPhotos.tapBefore", "Tap the BEFORE photo")
      : picking === "after"
        ? t("app.pairPhotos.tapAfter", "Now tap the AFTER photo")
        : t("app.pairPhotos.nameJob", "Name the job");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] bg-card rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-foreground">{t("app.pairPhotos.title", "Before & after")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("app.pairPhotos.summary", "{pairs} pair{ps} · {photos} photo{phs} left", {
                pairs: made.length,
                ps: made.length === 1 ? "" : "s",
                photos: available.length,
                phs: available.length === 1 ? "" : "s",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("app.action.close", "Close")}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 overscroll-contain">
          {/* Pairs already made — the running result, so progress is visible. */}
          {made.length > 0 && (
            <div className="space-y-2">
              {made.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border p-2"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.before} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    <ArrowRight size={14} className="text-muted-foreground" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.after} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  </div>
                  <input
                    value={p.caption || ""}
                    onChange={(e) =>
                      setMade((m) =>
                        m.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)),
                      )
                    }
                    placeholder={t("app.pairPhotos.captionPlaceholder", "What was this job?")}
                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    onClick={() => setMade((m) => m.filter((_, j) => j !== i))}
                    aria-label={t("app.pairPhotos.removePair", "Remove pair")}
                    className="p-1.5 text-muted-foreground hover:text-red-600 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* The current step. */}
          {available.length >= 2 || picking !== "before" ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-grid w-6 h-6 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "var(--brand,#111827)" }}
                >
                  {made.length + 1}
                </span>
                <p className="text-sm font-semibold text-foreground">{step}</p>
              </div>

              {picking === "caption" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.before} alt="" className="w-24 h-24 rounded-lg object-cover" />
                    <ArrowRight size={16} className="text-muted-foreground" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.after} alt="" className="w-24 h-24 rounded-lg object-cover" />
                  </div>
                  <input
                    autoFocus
                    value={draft.caption}
                    onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPair()}
                    placeholder={t("app.pairPhotos.jobPlaceholder", "e.g. Kitchen respray — Aylmer")}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addPair}
                      className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-bold"
                    >
                      <Check size={14} /> {t("app.pairPhotos.addThisPair", "Add this pair")}
                    </button>
                    <button
                      onClick={() => {
                        setDraft({ before: null, after: null, caption: "" });
                        setPicking("before");
                      }}
                      className="rounded-full border border-border px-4 py-2 text-sm"
                    >
                      {t("app.pairPhotos.startOver", "Start over")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {available.map((url) => {
                    const isDraftBefore = draft.before === url;
                    return (
                      <button
                        key={url}
                        onClick={() => choose(url)}
                        disabled={isDraftBefore}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          isDraftBefore
                            ? "border-foreground opacity-60"
                            : "border-transparent hover:border-foreground/40"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {isDraftBefore && (
                          <span className="absolute bottom-1 left-1 right-1 rounded bg-foreground/90 text-[10px] font-bold text-background py-0.5">
                            {t("app.pairPhotos.beforeBadge", "BEFORE")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <Images size={22} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {pool.length < 2
                  ? t("app.pairPhotos.needTwoPhotos", "Add at least two photos and you can pair them here.")
                  : t("app.pairPhotos.allPaired", "Every photo is paired up.")}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">
            {t("app.action.cancel", "Cancel")}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-inverted text-inverted-foreground px-5 py-2 text-sm font-bold disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {made.length ? t("app.pairPhotos.usePairs", "Use {count} pair{s}", { count: made.length, s: made.length === 1 ? "" : "s" }) : t("app.action.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
