// app/sales/leads/page.js
//
// The rep's pipeline. Every prospect they are working, and nobody else's.
//
// The list is scoped server-side by salesRepId — this screen has no notion of
// "whose" leads these are and cannot ask for another rep's, which is the right
// shape: a UI that could request them and merely doesn't is one query-string
// edit away from a leak.
//
// A lead that converted shows the company it became. That link is what stops
// the pipeline and the commission ledger being two lists that disagree, so it
// is on the row rather than buried on the detail screen.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users, Mail, CheckCircle2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import OutreachNotice from "./OutreachNotice";

const STATUS_CLASS = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  demoed: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  signed: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  lost: "bg-muted text-muted-foreground",
};

const EMPTY_FORM = { businessName: "", contactName: "", email: "", phone: "" };

export default function SalesLeadsPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      setData(await fetchJson(`/api/sales/leads?${params}`));
    } catch (err) {
      // Never `if (res.ok)` with no else — the failure class AGENTS.md names.
      setError(err.message);
      setData(null);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLead(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/sales/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(form, "lead"),
      });
      setForm(EMPTY_FORM);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const counts = data?.counts || {};
  const leads = data?.leads;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={20} className="text-muted-foreground" />
            My leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prospects you&apos;re working. Email them from here and the whole
            conversation is kept against the lead — as well as in your own
            mailbox.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="shrink-0 text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5"
        >
          <Plus size={15} />
          Add lead
        </button>
      </div>

      <OutreachNotice outreach={data?.outreach} />

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {adding && (
        <form
          onSubmit={addLead}
          className="rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Business name</span>
              <input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Contact name</span>
              <input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save lead"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5">
        {[{ value: "", label: "All" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))].map(
          (s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              // min-h-[44px] on the chip itself, not on a wrapper: the mobile
              // rule reads one tag, and so does a thumb.
              className={`inline-flex items-center min-h-[44px] text-xs font-semibold px-3 rounded-full border ${
                status === s.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s.label}
              {s.value && counts[s.value] ? ` (${counts[s.value]})` : ""}
            </button>
          ),
        )}
      </div>

      {leads === undefined && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          Loading…
        </div>
      )}

      {leads && leads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {status
            ? `No leads at "${LEAD_STATUS_LABELS[status]}".`
            : "No leads yet. Add the first one above."}
        </p>
      )}

      {leads && leads.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/sales/leads/${lead.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{lead.businessName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[lead.contactName, lead.email, lead.phone].filter(Boolean).join(" · ") ||
                    "No contact details yet"}
                </p>
              </div>
              {lead._count?.threads > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail size={13} />
                  {lead._count.threads}
                </span>
              )}
              {lead.convertedCompanyId && (
                <span className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Signed up
                </span>
              )}
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[lead.status] || STATUS_CLASS.new}`}
              >
                {LEAD_STATUS_LABELS[lead.status] || lead.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
