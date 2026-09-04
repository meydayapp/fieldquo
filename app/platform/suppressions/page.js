// app/platform/suppressions/page.js
//
// FieldQuo's own do-not-contact list.
//
// ══ What this screen is for ════════════════════════════════════════════════
//
// Not a tenant's opt-out list — those are CallConsent and MarketingSubscriber,
// scoped to a company, and neither is visible here. This is FieldQuo's own:
// the people who told US to stop, across every channel we could reach them on.
// The compliance audit found there was no such list anywhere in the product,
// which is what this screen exists to make operable.
//
// ══ Every control here does the thing ══════════════════════════════════════
//
// Search, add, bulk import and remove all reach the same functions the send
// paths read. There is no "coming soon" panel on this page because there was
// no half of it worth shipping dead — a do-not-contact screen whose Add button
// did not actually suppress would be the worst possible instance of the rule
// AGENTS.md opens with.
//
// ══ Remove is deliberately awkward ═════════════════════════════════════════
//
// A reason is required by the API, not just by this form, and the button says
// what it does rather than "Delete" — nothing is deleted. It is the one action
// in the product that can put FieldQuo back in touch with someone who asked it
// to stop, and it should feel like it.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Ban, Loader2, Plus, Search, Undo2, Upload } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const KINDS = [
  { value: "email", label: "Email address" },
  { value: "phone", label: "Phone number" },
  { value: "domain", label: "Domain (everyone at a company)" },
];

const SOURCE_LABELS = {
  reply: "Replied asking us to stop",
  call: "Said so on the phone",
  sms: "Texted STOP",
  form: "Asked through a form",
  manual: "Recorded by hand",
  import: "Loaded from an existing list",
  regulator: "From a do-not-call list",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function PlatformSuppressionsPage() {
  // null, not []. A failed search used to leave the initial empty array in
  // place, so the panel below printed "Nobody is on the list yet. Anyone who
  // replies to a sales email asking to stop is added automatically." — which
  // on THIS screen is the sentence "FieldQuo may contact everybody", written
  // out of a request that never arrived. The one empty state in the product
  // where being wrong is a compliance problem rather than a cosmetic one.
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(null);
  const [bulk, setBulk] = useState(null);
  const [unreadable, setUnreadable] = useState([]);

  const load = useCallback(async (q) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const data = await fetchJson(`/api/platform/suppressions?${params}`);
      setRows(data.rows || []);
      setTotal(Number.isFinite(data.total) ? data.total : null);
    } catch (err) {
      setRows(null);
      setTotal(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function addOne() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await fetchJson("/api/platform/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      // The NORMALISED value is echoed back rather than what was typed. That is
      // the key a send path will actually look up, and showing the raw string
      // would hide the one thing worth checking.
      setNotice(`${created.value} won't be contacted by FieldQuo on any channel.`);
      setDraft(null);
      await load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importList() {
    setBusy(true);
    setError("");
    setNotice("");
    setUnreadable([]);
    try {
      const result = await fetchJson("/api/platform/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulk }),
      });
      setNotice(
        `${result.added} added, ${result.updated} already on the list.` +
          (result.unreadable?.length || result.failed?.length
            ? ` ${(result.unreadable?.length || 0) + (result.failed?.length || 0)} line(s) could not be imported — listed below.`
            : ""),
      );
      // Reported, never counted away. An operator who is told "412 imported"
      // over a file with 90 junk lines believes 90 people are suppressed.
      setUnreadable([...(result.unreadable || []), ...(result.failed || [])]);
      setBulk(null);
      await load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    const reason = prompt(
      `Remove ${row.value} from FieldQuo's do-not-contact list?\n\n` +
        `They asked us to stop on ${formatDate(row.requestedAt)}. The record stays either way — ` +
        `this lifts the block, and it is recorded against you.\n\nWhy?`,
    );
    // A cancelled prompt and an empty reason are the same answer, and the API
    // refuses both. Stopping here saves a round trip, it does not enforce the
    // rule — see unsuppress() in lib/sales/suppression.js for where it lives.
    if (!reason || !reason.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson("/api/platform/suppressions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: row.kind, value: row.value, reason }),
      });
      setNotice(`${row.value} was removed from the list. The record of their request is kept.`);
      await load(query);
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
          <h1 className="text-2xl font-bold text-foreground">Do-not-contact</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            People who asked <strong>FieldQuo</strong> to stop contacting them. Every sales
            email, invite and (when it exists) call checks this list at the moment it sends —
            not when the screen was opened. It is not a tenant&apos;s opt-out list, and it is
            not scoped to a rep: an opt-out binds FieldQuo, not one rep&apos;s copy of a row.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulk("")}
            className="inline-flex items-center gap-2 border border-border text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Upload size={14} /> Import a list
          </button>
          <button
            onClick={() => setDraft({ kind: "email", value: "", source: "manual", reason: "" })}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {unreadable.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">These lines were not imported — nobody on them is suppressed:</p>
          {unreadable.map((u, i) => (
            <p key={i} className="font-mono text-xs">
              line {u.line}: {u.raw || u.value} — {u.error}
            </p>
          ))}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Add to the do-not-contact list</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="s-kind" className="block text-xs font-medium text-muted-foreground mb-1">
                What kind
              </label>
              <select
                id="s-kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-value" className="block text-xs font-medium text-muted-foreground mb-1">
                Value
              </label>
              <input
                id="s-value"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                placeholder="bob@acme.com"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label htmlFor="s-source" className="block text-xs font-medium text-muted-foreground mb-1">
                How they asked
              </label>
              <select
                id="s-source"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="s-reason" className="block text-xs font-medium text-muted-foreground mb-1">
              What they said (optional, but it is the evidence)
            </label>
            <input
              id="s-reason"
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This closes every channel — email, phone and SMS. Somebody who says &ldquo;stop&rdquo;
            on the phone has said it about the email too.
          </p>
          <div className="flex gap-2">
            <button
              onClick={addOne}
              disabled={busy || !draft.value.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Suppress
            </button>
            <button onClick={() => setDraft(null)} className="text-sm px-4 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {bulk !== null && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Import a list</h2>
          <p className="text-xs text-muted-foreground">
            One per line. An address is recognised on its own; for anything else, prefix the line
            with <code className="font-mono">email,</code>, <code className="font-mono">phone,</code>{" "}
            or <code className="font-mono">domain,</code>. Lines starting with{" "}
            <code className="font-mono">#</code> are ignored. Anything that cannot be read is listed
            back rather than skipped quietly.
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={8}
            placeholder={"bob@acme.com\nphone,+1 613 555 0142\ndomain,acme.com"}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono bg-background"
          />
          <div className="flex gap-2">
            <button
              onClick={importList}
              disabled={busy || !bulk.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import
            </button>
            <button onClick={() => setBulk(null)} className="text-sm px-4 py-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address, number or domain"
            aria-label="Search the do-not-contact list"
            className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-background"
          />
        </div>
        <button type="submit" className="border border-border text-sm px-4 py-2 rounded-lg">
          Search
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : rows === null ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm space-y-2">
          <p className="text-foreground font-medium">
            The do-not-contact list could not be read.
          </p>
          <p className="text-muted-foreground max-w-xl mx-auto">
            This is not an empty list and it is not a clearance to contact
            anybody. The list is still enforced at the moment of every send —
            the send paths read the database, not this screen — so nothing here
            failing has changed who FieldQuo may write to.
          </p>
          <button
            onClick={() => load(query)}
            className="text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {query
            ? `Nothing on the list matches “${query}”. That means FieldQuo may contact them.`
            : "Nobody is on the list yet. Anyone who replies to a sales email asking to stop is added automatically."}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Who</th>
                  <th className="text-left font-medium px-4 py-2">Channels</th>
                  <th className="text-left font-medium px-4 py-2">How they asked</th>
                  <th className="text-left font-medium px-4 py-2">Asked</th>
                  <th className="text-left font-medium px-4 py-2">Keep until</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{row.value}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{row.kind}</span>
                      {row.removedAt && (
                        <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                          removed {formatDate(row.removedAt)} — {row.removedReason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.removedAt ? "—" : (row.channels || []).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {SOURCE_LABELS[row.source] || row.source}
                      {row.reason ? ` — ${row.reason}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(row.requestedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(row.retainUntil)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!row.removedAt && (
                        <button
                          onClick={() => remove(row)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          <Undo2 size={12} /> Remove, with a reason
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-2xl">
        <strong>Keep until</strong> is the date before which a row must not be deleted:
        three years and fourteen days from the request, which is Canada&apos;s internal
        do-not-call retention rule. Nothing prunes these rows, and removing somebody is a
        soft removal — the record of what they asked for stays.
        {rows && total !== null && total > rows.length
          ? ` Showing ${rows.length} of ${total}.`
          : ""}
      </p>
    </div>
  );
}
