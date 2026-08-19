"use client";

// app/app/settings/reviews/Testimonials.js
//
// The reviews that go on the contractor's own website.
//
// ── Why this lives on the reviews screen ───────────────────────────────────
//
// The other half of this page asks customers for a review. This half is what
// happens to the reviews once they exist. Splitting them across two screens
// means the contractor who has just set up the ask has nowhere obvious to put
// the fifty reviews they already have on Google.
//
// ── The count is the published count, not the total ────────────────────────
//
// /api/settings/website takes the first six APPROVED rows. A header reading
// "12 reviews" over a list where only two are approved is the same lie as a
// toggle that says On while nothing sends. The server computes the number the
// public site will actually show, using the same filter and the same cap, and
// the screen prints that.
//
// ── And where they go once approved ────────────────────────────────────────
//
// The iframe snippet below the list is the other half of the same sentence:
// this is the list, that is how it reaches a website FieldQuo didn't build.
// It was previously only inside the website builder's "Fine-tune" panel, which
// a company without the `website_builder` feature — or without a FieldQuo site
// — cannot open at all.
//
// ── Nothing here starts at [] ──────────────────────────────────────────────
//
// `list` starts at null. A list that starts empty claims "you have none of
// these" before the server has said anything, so a failed load renders the
// empty state and the contractor concludes their reviews are gone. The error
// branch returns before the empty state can be reached.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, ChevronDown, ChevronUp, Loader2, MessageSquareQuote,
  Pencil, Plus, Trash2, Upload,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import EmbedSnippet from "./EmbedSnippet";

export default function Testimonials() {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [published, setPublished] = useState(0);
  const [embedSlug, setEmbedSlug] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const [name, setName] = useState("");
  const [quote, setQuote] = useState("");

  const [paste, setPaste] = useState("");
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/testimonials");
    if (!res.ok) {
      setFailed(true);
      await reportResponseError(res, t("app.testimonials.loadError"));
      return;
    }
    const json = await res.json();
    setList(json.testimonials || []);
    setPublished(json.publishedCount || 0);
    setEmbedSlug(json.embedSlug || "");
    setFailed(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // One helper for every mutation: send it, report the refusal if there is
  // one, and reload so the screen shows what is stored rather than what was
  // attempted. Optimistic local updates were rejected deliberately — a row
  // that stays approved on screen after the server refused is the dead-control
  // shape this codebase keeps finding.
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
      "/api/settings/testimonials",
      { method: "POST", body: JSON.stringify({ authorName: name, quote }) },
      "app.testimonials.saveError",
    );
    if (done) {
      setName("");
      setQuote("");
    }
  }

  function patch(id, body) {
    return mutate(
      `/api/settings/testimonials/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      "app.testimonials.saveError",
    );
  }

  async function remove(row) {
    if (!window.confirm(t("app.testimonials.removeConfirm"))) return;
    await mutate(
      `/api/settings/testimonials/${row.id}`,
      { method: "DELETE" },
      "app.testimonials.saveError",
    );
  }

  // Reordering writes explicit positions for the whole list rather than
  // swapping two rows. Every pre-existing row has sortOrder 0, so a swap of
  // two zeroes changes nothing visible and the arrow looks broken.
  async function move(index, delta) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i].sortOrder !== i) {
          const res = await fetch(`/api/settings/testimonials/${next[i].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: i }),
          });
          if (!res.ok) {
            await reportResponseError(res, t("app.testimonials.saveError"));
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
    const done = await patch(editing.id, {
      authorName: editing.authorName,
      quote: editing.quote,
    });
    if (done) setEditing(null);
  }

  async function importPaste(text) {
    setResult(null);
    const done = await mutate(
      "/api/settings/testimonials/import",
      { method: "POST", body: JSON.stringify({ text }) },
      "app.testimonials.importError",
    );
    if (done) {
      setResult(done);
      setPaste("");
    }
  }

  // A CSV file is read in the browser and posted as text, so there is exactly
  // one import payload and one parser. Parsing here as well would be a second
  // implementation of the format question, and the two would drift.
  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    setPaste(text);
    await importPaste(text);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquareQuote size={16} /> {t("app.testimonials.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.testimonials.subtitle")}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.testimonials.googleNote")}
        </p>
      </div>

      {/* ── The list ───────────────────────────────────────────────────── */}
      {failed ? (
        <p className="text-sm text-muted-foreground">{t("app.testimonials.loadError")}</p>
      ) : list === null ? (
        <div className="h-16 bg-accent rounded-lg animate-pulse" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.testimonials.empty")}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {published === 0
              ? t("app.testimonials.publishedNone")
              : t("app.testimonials.publishedCount", { count: published })}
          </p>
          <ul className="divide-y divide-border border border-border rounded-lg">
            {list.map((row, i) => (
              <li key={row.id} className="p-3">
                {editing?.id === row.id ? (
                  <form onSubmit={saveEdit} className="space-y-2">
                    <input
                      value={editing.authorName}
                      onChange={(e) => setEditing({ ...editing, authorName: e.target.value })}
                      aria-label={t("app.testimonials.nameLabel")}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
                    />
                    <textarea
                      value={editing.quote}
                      onChange={(e) => setEditing({ ...editing, quote: e.target.value })}
                      rows={3}
                      aria-label={t("app.testimonials.quoteLabel")}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground"
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
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{row.quote}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[row.authorName, row.companyLabel].filter(Boolean).join(", ")}
                        {" · "}
                        <span className={row.approved ? "text-emerald-600 dark:text-emerald-400" : ""}>
                          {row.approved
                            ? t("app.testimonials.approved")
                            : t("app.testimonials.notApproved")}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={t("app.testimonials.moveUp")}
                        title={t("app.testimonials.moveUp")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={busy || i === list.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={t("app.testimonials.moveDown")}
                        title={t("app.testimonials.moveDown")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditing({ id: row.id, authorName: row.authorName, quote: row.quote })}
                        aria-label={t("app.testimonials.edit")}
                        title={t("app.testimonials.edit")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.approved}
                        aria-label={t("app.testimonials.approve")}
                        title={t("app.testimonials.approve")}
                        disabled={busy}
                        onClick={() => patch(row.id, { approved: !row.approved })}
                        className={`w-9 h-5 rounded-full transition-colors disabled:opacity-40 ${
                          row.approved ? "bg-emerald-600" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            row.approved ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(row)}
                        aria-label={t("app.testimonials.remove")}
                        title={t("app.testimonials.remove")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-muted disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ── Onto a website FieldQuo didn't build ───────────────────────── */}
      <EmbedSnippet slug={embedSlug} />

      {/* ── Add one ────────────────────────────────────────────────────── */}
      <form onSubmit={add} className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-foreground">{t("app.testimonials.addTitle")}</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("app.testimonials.namePlaceholder")}
          aria-label={t("app.testimonials.nameLabel")}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
        />
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={2}
          placeholder={t("app.testimonials.quotePlaceholder")}
          aria-label={t("app.testimonials.quoteLabel")}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={busy || !name.trim() || !quote.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-40"
        >
          <Plus size={14} /> {t("app.testimonials.add")}
        </button>
      </form>

      {/* ── Paste a list ───────────────────────────────────────────────── */}
      <div className="space-y-2 pt-4 border-t border-border">
        <p className="text-xs font-semibold text-foreground">{t("app.testimonials.importTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("app.testimonials.importHelp")}</p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          placeholder={t("app.testimonials.importPlaceholder")}
          aria-label={t("app.testimonials.importTitle")}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => importPaste(paste)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-40"
          >
            <Upload size={14} /> {t("app.testimonials.importButton")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground disabled:opacity-40"
          >
            {t("app.testimonials.chooseFile")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={pickFile}
            className="hidden"
          />
          {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        </div>
        {result && (
          <div className="text-xs text-foreground space-y-1">
            <p className="flex items-center gap-1.5">
              <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
              {t("app.testimonials.importResult", {
                added: result.imported,
                updated: result.updated,
                skipped: result.skipped,
              })}
            </p>
            {result.imported > 0 && (
              <p className="text-muted-foreground">{t("app.testimonials.importedNeedApproval")}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
