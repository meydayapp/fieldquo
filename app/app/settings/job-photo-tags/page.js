"use client";

// app/app/settings/job-photo-tags/page.js
//
// The company's own words for what's happening in a job photo — sanding,
// priming, top coat, demo. This is deliberately NOT the same screen as a
// stage. `stage` (before/progress/finished/issue) is fixed product logic —
// before/finish drive the before/after slider on the website, and issue is a
// hard privacy boundary that keeps a shot of hidden water damage off the
// public gallery. None of that is editable here, and nothing on this screen
// can touch it: creating, renaming or retiring a tag only ever writes rows in
// JobPhotoTag / JobPhotoTagOnPhoto, a completely different table from the one
// `stage` lives in. See prisma/schema.prisma's JobPhotoTag comment and
// docs/PHOTO-TAGS.md.
//
// ── Retiring, not deleting ──────────────────────────────────────────────────
//
// The same rule Worker.active applies to a person who leaves: a tag already
// on 200 photos must not vanish from them just because the company stopped
// using it. Retiring hides it from the picker offered on NEW photos; every
// photo that already carries it keeps it, unchanged. There is no delete
// button on this screen on purpose.
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Sparkles, Tag } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const SWATCHES = ["#b91c1c", "#b45309", "#a16207", "#15803d", "#0369a1", "#1d4ed8", "#7c3aed", "#be185d"];

export default function JobPhotoTagsPage() {
  const { t } = useTranslation();
  const [tags, setTags] = useState(null);
  const [starter, setStarter] = useState([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/job-photo-tags");
    if (!res.ok) {
      setFailed(true);
      await reportResponseError(res, t("app.setJobPhotoTags.loadError"));
      return;
    }
    const json = await res.json();
    setTags(json.tags || []);
    setStarter(json.starterSuggestions || []);
    setFailed(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(url, options, fallbackKey) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        await reportResponseError(res, t(fallbackKey));
        await load();
        return null;
      }
      const json = await res.json().catch(() => ({}));
      await load();
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    const done = await mutate(
      "/api/settings/job-photo-tags",
      { method: "POST", body: JSON.stringify({ name, color }) },
      "app.setJobPhotoTags.saveError",
    );
    if (done) {
      setName("");
      setColor(null);
    }
  }

  async function addStarter() {
    await mutate(
      "/api/settings/job-photo-tags",
      { method: "POST", body: JSON.stringify({ action: "adoptStarter" }) },
      "app.setJobPhotoTags.saveError",
    );
  }

  function patch(id, body) {
    return mutate(
      `/api/settings/job-photo-tags/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      "app.setJobPhotoTags.saveError",
    );
  }

  function retire(row) {
    if (!window.confirm(t("app.setJobPhotoTags.retireConfirm"))) return;
    return patch(row.id, { active: false });
  }

  // Same "explicit positions for the whole list" reasoning as the testimonial
  // reorder — every pre-existing row shares sortOrder 0, so swapping two zeros
  // would change nothing visible.
  async function move(index, delta) {
    const next = [...tags];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i].sortOrder !== i) {
          const res = await fetch(`/api/settings/job-photo-tags/${next[i].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: i }),
          });
          if (!res.ok) {
            await reportResponseError(res, t("app.setJobPhotoTags.saveError"));
            break;
          }
        }
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const done = await patch(editing.id, { name: editing.name, color: editing.color });
    if (done) setEditing(null);
  }

  const active = (tags || []).filter((tg) => tg.active);
  const retired = (tags || []).filter((tg) => !tg.active);

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Tag size={22} /> {t("app.setJobPhotoTags.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.setJobPhotoTags.subtitle")}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-5">
        {failed ? (
          <p className="text-sm text-muted-foreground">{t("app.setJobPhotoTags.loadError")}</p>
        ) : tags === null ? (
          <div className="h-16 bg-accent rounded-lg animate-pulse" />
        ) : active.length === 0 && retired.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.setJobPhotoTags.empty")}</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg">
            {active.map((row, i) => (
              <TagRow
                key={row.id}
                row={row}
                index={i}
                count={active.length}
                busy={busy}
                editing={editing}
                setEditing={setEditing}
                onMove={move}
                onSaveEdit={saveEdit}
                onRetire={() => retire(row)}
                t={t}
              />
            ))}
            {retired.map((row) => (
              <li key={row.id} className="p-3 flex items-center gap-3 opacity-60">
                <Swatch color={row.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{t("app.setJobPhotoTags.retired")}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patch(row.id, { active: true })}
                  title={t("app.setJobPhotoTags.reactivate")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Add one ──────────────────────────────────────────────────── */}
        <form onSubmit={add} className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-foreground">{t("app.setJobPhotoTags.addTitle")}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("app.setJobPhotoTags.namePlaceholder")}
            aria-label={t("app.setJobPhotoTags.nameLabel")}
            maxLength={60}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
          />
          <ColorPicker value={color} onChange={setColor} label={t("app.setJobPhotoTags.color")} />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-40"
          >
            <Plus size={14} /> {t("app.setJobPhotoTags.add")}
          </button>
        </form>

        {/* ── Starter set — offered, never applied ────────────────────── */}
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles size={13} /> {t("app.setJobPhotoTags.starterTitle")}
          </p>
          <p className="text-xs text-muted-foreground">{t("app.setJobPhotoTags.starterHint")}</p>
          {starter.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {starter.map((s) => (
                  <span
                    key={s.name}
                    className="text-[11px] px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: s.color || "#52525b" }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={addStarter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {t("app.setJobPhotoTags.addStarter")}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t("app.setJobPhotoTags.starterNoneLeft")}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Swatch({ color }) {
  return (
    <span
      aria-hidden="true"
      className="w-3 h-3 rounded-full shrink-0 border border-border"
      style={{ backgroundColor: color || "transparent" }}
    />
  );
}

function ColorPicker({ value, onChange, label }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={label}
          className={`w-5 h-5 rounded-full border-2 ${value === null ? "border-foreground" : "border-border"}`}
        />
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`w-5 h-5 rounded-full border-2 ${value === c ? "border-foreground" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function TagRow({ row, index, count, busy, editing, setEditing, onMove, onSaveEdit, onRetire, t }) {
  if (editing?.id === row.id) {
    return (
      <li className="p-3">
        <form onSubmit={onSaveEdit} className="space-y-2">
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            aria-label={t("app.setJobPhotoTags.nameLabel")}
            maxLength={60}
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
          />
          <ColorPicker
            value={editing.color}
            onChange={(c) => setEditing({ ...editing, color: c })}
            label={t("app.setJobPhotoTags.color")}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-40"
            >
              {t("app.action.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="p-3 flex items-center gap-3">
      <Swatch color={row.color} />
      <button
        type="button"
        className="flex-1 min-w-0 text-left text-sm text-foreground truncate"
        onClick={() => setEditing({ id: row.id, name: row.name, color: row.color })}
      >
        {row.name}
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled={busy || index === 0}
          onClick={() => onMove(index, -1)}
          aria-label={t("app.setJobPhotoTags.moveUp")}
          title={t("app.setJobPhotoTags.moveUp")}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          disabled={busy || index === count - 1}
          onClick={() => onMove(index, 1)}
          aria-label={t("app.setJobPhotoTags.moveDown")}
          title={t("app.setJobPhotoTags.moveDown")}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRetire}
          aria-label={t("app.setJobPhotoTags.retire")}
          title={t("app.setJobPhotoTags.retire")}
          className="px-2 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
        >
          {t("app.setJobPhotoTags.retire")}
        </button>
      </div>
    </li>
  );
}
