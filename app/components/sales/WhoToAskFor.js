"use client";

// app/components/sales/WhoToAskFor.js
//
// The "Who to ask for" row on the rep card: the best name with its source,
// the other names listed, a BBB link the rep opens by hand, and a field to
// type the name they heard.
//
// The typed name goes to POST /api/sales/queue/people, which creates a
// ProspectPerson (source "typed", the rep's id) and never edits anything —
// what a register or BBB said stays beside it. The row re-renders from the
// server's answer (`who`), so the card leads with the typed name only when
// the server says it does.
import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

export default function WhoToAskFor({ t, fact, prospectId, onSaved = null }) {
  const [who, setWho] = useState(fact?.who || null);
  const [others, setOthers] = useState(fact?.others || []);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(!fact?.known);

  async function save(e) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await fetchJson("/api/sales/queue/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospectId, name: name.trim(), role: role.trim() || null }),
      });
      setWho(data.who || null);
      setOthers(data.who?.others || []);
      setName("");
      setRole("");
      setSaved(true);
      setOpen(false);
      if (typeof onSaved === "function") onSaved(data);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const label = t(fact?.labelKey, fact?.label || "Who to ask for");
  return (
    <li className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {who ? (
        <span className="text-sm text-foreground break-words">
          <strong>{who.name}</strong>
          {who.role ? ` — ${who.role}` : ""}
          <span className="text-muted-foreground"> · {who.sourceLabel}{who.seenAt ? `, ${who.seenAt}` : ""}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground italic">{t(fact?.textKey, fact?.text, fact?.params || {})}</span>
      )}
      {others.length ? (
        <span className="text-xs text-muted-foreground break-words">
          {t("app.salesIntel.people.others", "Also listed")}: {others.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""} · ${p.sourceLabel}`).join("; ")}
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {fact?.bbbSearchUrl ? (
          <a href={fact.bbbSearchUrl} target="_blank" rel="noreferrer noopener" className="underline text-foreground">
            {t("app.salesIntel.people.openBbb", "Open BBB")}
          </a>
        ) : null}
        <button type="button" className="underline text-muted-foreground" onClick={() => setOpen((v) => !v)}>
          {t("app.salesIntel.people.typedLabel", "Name heard on the phone")}
        </button>
        {saved ? <span className="text-muted-foreground">{t("app.salesIntel.people.saved", "Saved — the card leads with it now")}</span> : null}
      </div>
      {open ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("app.salesIntel.people.typedPlaceholder", "e.g. Maria — owner")}
            aria-label={t("app.salesIntel.people.typedLabel", "Name heard on the phone")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            maxLength={120}
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Owner"
            aria-label="Role"
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
            maxLength={80}
          />
          <button type="submit" disabled={saving || !name.trim()} className="h-8 rounded-md border border-input px-3 text-sm disabled:opacity-50">
            {t("app.salesIntel.people.save", "Save name")}
          </button>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </form>
      ) : null}
    </li>
  );
}
