// app/components/sales/QueueLeadEditor.js
//
// Correcting what we know about a business, from the screen the rep is on.
//
// ══ The gap this closes ═══════════════════════════════════════════════════
//
// The owner: "in the queue there's no ability to update and make changes to
// the lead." He was right. The queue showed a researched prospect and offered
// a Call button, a note box and nothing else — so a rep who learned the
// owner's name, or that the email on the listing bounces, had nowhere to put
// it except a free-text note nothing reads.
//
// ══ What is edited, and why it is the LEAD and not the prospect ═══════════
//
// This writes the rep's own SalesLead through the route that already writes
// it. It does NOT write the Prospect, and that is the decision worth stating:
//
//   * Prospect.phoneE164, .domain and .googlePlaceId are IDENTITY. They are
//     the deduplication keys discovery matches on, and every suppression row,
//     call attempt and text is filed against that phone number. A rep
//     correcting one after a phone call would silently re-point the dedupe of
//     an org-wide row and orphan its history.
//   * Prospect.country / .province decide WHICH STATUTE governs the call.
//     They are shared by every rep who will ever hold this row, and a
//     jurisdiction is not something one conversation should move for
//     everybody. The lead's own pair exists for exactly this, is read ahead of
//     the prospect's by lib/sales/leadDial.js and by the calls route, and is
//     edited on the lead screen where the calling window is computed from it.
//   * businessName, contactName, email, phone and status are what a CALL
//     produces. They are the rep's account of a conversation with somebody who
//     is not a customer — outreachGate.js's exact definition of what a rep may
//     write — and they belong on their lead.
//
// The one Prospect column a rep may still set is doNotContactAt, from the
// queue's own control, because the rep is the person who hears it.
//
// ══ Nothing here invents a lead ═══════════════════════════════════════════
//
// A claimed prospect often has no lead yet. Rather than creating one silently
// on the first keystroke, the button says so: carrying a prospect across is a
// real act with a real consequence (it puts the business in the rep's
// pipeline), and POST /api/sales/leads already does it, already refuses a
// prospect this rep does not hold, and already hands back the existing lead
// instead of making a second one.
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, UserPen } from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

const STATUSES = [
  ["new", "Not spoken to yet"],
  ["contacted", "Spoken to"],
  ["demoed", "Demoed"],
  ["signed", "Signed up"],
  ["lost", "Lost"],
];

export default function QueueLeadEditor({ prospectId, businessName, lead = null, onChanged }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    contactName: "",
    email: "",
    phone: "",
    status: "new",
  });

  // Re-seeded whenever the server hands back a different lead — including
  // after a save, so the fields show what was actually stored rather than what
  // was typed. A form that keeps the typed value after a server sanitised it
  // is a form that lies about what is on the record.
  useEffect(() => {
    setForm({
      contactName: lead?.contactName || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      status: lead?.status || "new",
    });
    setSaved(false);
  }, [lead?.id, lead?.contactName, lead?.email, lead?.phone, lead?.status]);

  async function carryAcross() {
    setBusy("create");
    setError("");
    try {
      await fetchJson("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      onChanged?.();
    } catch (err) {
      setError(err?.message || "That prospect could not be carried across.");
    } finally {
      setBusy("");
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!lead?.id) return;
    setBusy("save");
    setError("");
    setSaved(false);
    try {
      await fetchJson(`/api/sales/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Every field is sent, including the empty ones: the PATCH route reads
        // `undefined` as "leave it alone" and an empty string as "clear it",
        // so a rep deleting a bounced email address has to be able to send one.
        body: JSON.stringify(form),
      });
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err?.message || "That could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        <UserPen size={15} className="inline mr-1" />
        What you learned on the call
      </h3>

      {error ? (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-300 break-words">
          {error}
        </div>
      ) : null}

      {!lead ? (
        <>
          <p className="text-sm text-muted-foreground break-words">
            {businessName} is not in your pipeline yet, so there is nowhere to put a contact name
            or an address. Carrying them across makes the lead — it does not email anybody.
          </p>
          <button
            type="button"
            className={`${BTN} border border-border text-foreground w-full`}
            disabled={Boolean(busy)}
            onClick={carryAcross}
          >
            {busy === "create" ? <Loader2 className="animate-spin" size={16} /> : null}
            Start a lead for {businessName}
          </button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <label className="block text-sm">
            <span className="text-foreground">Who did you speak to?</span>
            <input
              type="text"
              className={FIELD}
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              placeholder="Dave, the owner"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Their email</span>
            <input
              type="email"
              className={FIELD}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">The number on their lead</span>
            <input
              type="tel"
              inputMode="tel"
              className={FIELD}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            {/* Said plainly, because the two boxes look alike and do different
                things. This one replaces the number on the LEAD; the picker
                above adds a second number without touching the first. */}
            <span className="mt-1 block text-xs text-muted-foreground break-words">
              This is the main number on your lead. A number somebody gave you as well as this one
              goes in “They gave us another number” above, where it can be picked for a call.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Where are they now?</span>
            <select
              className={FIELD}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className={`${BTN} bg-primary text-primary-foreground flex-1`}
              disabled={Boolean(busy)}
            >
              {busy === "save" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Save what you learned
            </button>
            {saved ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-300">Saved.</span>
            ) : null}
          </div>

          {/* Where the rest of it lives, rather than a second half-copy of the
              lead screen. State and time zone decide which calling statute
              applies, and they are edited beside the window that reports it. */}
          <p className="text-xs text-muted-foreground break-words">
            Which state or province they are in, and their time zone, are edited on{" "}
            <Link href={`/sales/leads/${lead.id}`} className="underline">
              their lead
            </Link>
            , next to the calling window those two answers decide.
          </p>
        </form>
      )}
    </div>
  );
}
