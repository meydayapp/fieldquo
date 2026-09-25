"use client";

// app/components/platform/sales/UnownedTexts.js
//
// The texts the ladder could file to nobody (lib/sales/smsAttribution.js
// rung (d)), each with the one control that exists for them: "nobody's —
// assign", a rep picker, and a button that files it through
// attributeSmsMessage with the admin's id on the audit row.
//
// Its own component, on the conversations page, rather than lines in that
// page: the page is a read-only audit surface with a check that greps it
// for any send — and this is not a send. It files; the rep is then pushed
// the text as if the webhook had found them.
//
// Empty is drawn as one sentence, not as nothing: "no unfiled texts" is the
// good state and the owner should see it said.
import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

function prettyE164(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return e164 || "";
}

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function UnownedTexts({ onAssigned = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState({}); // messageId -> repId
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/conversations/unowned"));
    } catch (err) {
      setError(err.message || "Couldn't load the unfiled texts.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(messageId) {
    const repId = choice[messageId];
    if (!repId) return;
    setBusy(messageId);
    setNotice("");
    try {
      const res = await fetchJson("/api/platform/sales/conversations/unowned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, repId }),
      });
      const rep = (data?.reps || []).find((r) => r.id === repId);
      setNotice(`Filed to ${rep?.name || rep?.email || "the rep"} — they have been notified.${res?.after?.matchedBy ? ` (${res.after.matchedBy})` : ""}`);
      await load();
      if (typeof onAssigned === "function") onAssigned({ messageId, repId });
    } catch (err) {
      setError(err.message || "Couldn't file that text.");
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.unowned || [];

  return (
    <section className="rounded-lg border border-border bg-card p-3 sm:p-4 text-sm space-y-3" data-unowned-texts>
      <div className="flex items-start gap-2">
        <Inbox size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            Nobody&rsquo;s texts{data ? ` — ${rows.length}` : ""}
          </p>
          <p className="mt-1 text-muted-foreground">
            Replies to a sales line that no rule could file to a rep: nobody had texted the sender, no lead or prospect
            carries their number, nobody had used the line in the last day, and the line has no assigned rep. They appear
            in no rep&rsquo;s list. Assigning one files it and notifies the rep; the filing is audited under your name.
          </p>
        </div>
      </div>

      {error ? <p className="text-amber-700 dark:text-amber-300">{error}</p> : null}
      {notice ? (
        <p className="text-emerald-700 dark:text-emerald-300" role="status">
          {notice}
        </p>
      ) : null}

      {!data && !error ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
        </p>
      ) : null}

      {data && rows.length === 0 ? <p className="text-muted-foreground">No unfiled texts. Every reply has a rep.</p> : null}

      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((m) => (
            <li key={m.id} className="py-3 space-y-2" data-unowned-row={m.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-medium text-foreground tabular-nums">
                  From {prettyE164(m.fromE164)}{" "}
                  <span className="font-normal text-muted-foreground">
                    on {prettyE164(m.toE164)}
                    {m.lineHolder?.name ? ` (${m.lineHolder.name}'s line)` : " (unassigned line)"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{when(m.sentAt)}</p>
              </div>
              <p className="whitespace-pre-wrap break-words text-foreground">{m.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">nobody&rsquo;s — assign</span>
                <label className="min-w-0">
                  <span className="sr-only">Rep</span>
                  <select
                    value={choice[m.id] || ""}
                    onChange={(e) => setChoice((c) => ({ ...c, [m.id]: e.target.value }))}
                    className="min-h-[44px] lg:min-h-[36px] rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                    data-unowned-rep-picker
                  >
                    <option value="">Choose a rep…</option>
                    {(data?.reps || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || r.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!choice[m.id] || busy === m.id}
                  onClick={() => assign(m.id)}
                  className="min-h-[44px] lg:min-h-[36px] rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === m.id ? "Filing…" : "Assign"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
