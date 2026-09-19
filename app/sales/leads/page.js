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

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users, Mail, CheckCircle2, Search, MailX, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import { useTranslation } from "@/app/hooks/useTranslation";
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
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  // ── Search and the "Emailed, no reply" chip ────────────────────────────
  //
  // `q` is what the box holds; `query` is what the list was last asked for,
  // 300ms behind it, so a rep typing "Alliance App" fires one request, not
  // twelve. Both filters live in the URL (?q=&noReply=1) — a rep who refreshes
  // mid-search, or comes back from a lead's page, lands on the same list.
  // Read once from window.location on mount, the same way the ?new=1 prefill
  // below is, and written back with replaceState so the back button is not
  // filled with keystrokes.
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [noReply, setNoReply] = useState(false);
  const hydrated = useRef(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let sp;
    try {
      sp = new URLSearchParams(window.location.search);
    } catch {
      hydrated.current = true;
      return;
    }
    const initialQ = (sp.get("q") || "").slice(0, 120);
    setQ(initialQ);
    setQuery(initialQ);
    setNoReply(sp.get("noReply") === "1");
    const initialStatus = sp.get("status") || "";
    if (LEAD_STATUSES.includes(initialStatus)) setStatus(initialStatus);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      if (noReply) url.searchParams.set("noReply", "1");
      else url.searchParams.delete("noReply");
      if (status) url.searchParams.set("status", status);
      else url.searchParams.delete("status");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* the list still works without the address bar */
    }
  }, [query, noReply, status]);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (query) params.set("q", query);
      if (noReply) params.set("noReply", "1");
      setData(await fetchJson(`/api/sales/leads?${params}`));
    } catch (err) {
      // Never `if (res.ok)` with no else — the failure class AGENTS.md names.
      setError(err.message);
      setData(null);
    }
  }, [status, query, noReply]);

  useEffect(() => {
    load();
  }, [load]);

  // ── "Save as a new lead", from the incoming-call dialog ──────────────
  //
  // A number that rang and matched nobody arrives here as ?new=1&phone=…
  // (lib/sales/calls/callerLinks.js newLeadHref): the form opens with the
  // number in it and nothing else, and the rep types the name they just
  // heard. Read from window.location on mount rather than useSearchParams,
  // which would need a Suspense boundary over a page that is otherwise
  // static; the params are read once and never written back.
  useEffect(() => {
    let sp;
    try {
      sp = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    if (sp.get("new") !== "1") return;
    const phone = (sp.get("phone") || "").trim().slice(0, 32);
    setForm((prev) => ({ ...prev, phone: phone || prev.phone }));
    setAdding(true);
  }, []);

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

  // The WORD, never the value. `status` stays the enum the API filters on;
  // only what the rep reads is translated. Keys are
  // app.salesLeads.status.{new,contacted,demoed,signed,lost}, and the English
  // in outreachPipeline.js is the fallback so a missing key still names a
  // stage rather than printing a dotted key at a rep.
  const statusLabel = (value) =>
    t(`app.salesLeads.status.${value}`, LEAD_STATUS_LABELS[value] || value);

  return (
    <div className="space-y-6" data-tour="sales-leads">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={20} className="text-muted-foreground" />
            {t("app.salesLeads.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.salesLeads.intro")}
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="shrink-0 min-h-[44px] text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5"
        >
          <Plus size={15} />
          {t("app.salesLeads.addLead")}
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
              <span className="text-muted-foreground">{t("app.salesLeads.businessName")}</span>
              <input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">{t("app.salesLeads.contactName")}</span>
              <input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">{t("app.salesLeads.email")}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">{t("app.salesLeads.phone")}</span>
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
            className="min-h-[44px] text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground disabled:opacity-60"
          >
            {saving ? t("app.salesLeads.saving") : t("app.salesLeads.saveLead")}
          </button>
        </form>
      )}

      <label className="relative block">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("app.salesLeads.searchPlaceholder")}
          aria-label={t("app.salesLeads.searchLabel")}
          maxLength={120}
          className="w-full min-h-[44px] rounded-lg border border-border bg-background pl-9 pr-9 py-2 text-sm"
          data-testid="sales-leads-search"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t("app.salesLeads.searchClear")}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground"
          >
            <X size={14} />
          </button>
        )}
      </label>

      <div className="flex flex-wrap gap-1.5">
        {/* "Emailed, no reply" — the rep's own follow-up list: every lead
            whose last word in the conversation is ours. Independent of the
            status chips beside it; decided server-side by leadEmailedNoReply. */}
        <button
          type="button"
          onClick={() => setNoReply((v) => !v)}
          aria-pressed={noReply}
          className={`inline-flex items-center justify-center gap-1 min-h-[44px] text-xs font-semibold px-3 rounded-full border ${
            noReply
              ? "bg-inverted text-inverted-foreground border-inverted"
              : "border-border text-muted-foreground"
          }`}
        >
          <MailX size={13} />
          {t("app.salesLeads.filterNoReply")}
        </button>
        {[
          { value: "", label: t("app.salesLeads.filterAll") },
          ...LEAD_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
        ].map(
          (s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              // min-h-[44px] on the chip itself, not on a wrapper: the mobile
              // rule reads one tag, and so does a thumb.
              className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-xs font-semibold px-3 rounded-full border ${
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
          {t("app.salesLeads.loading")}
        </div>
      )}

      {leads && leads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {query || noReply
            ? t("app.salesLeads.emptySearch")
            : status
              ? t("app.salesLeads.emptyFiltered", { status: statusLabel(status) })
              : t("app.salesLeads.emptyNone")}
        </p>
      )}

      {leads && leads.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/sales/leads/${lead.id}`}
              // flex-wrap, and the name is not truncated: on a 375px phone
              // the three badges beside it left the name 118px — "Easy
              // Roofers I…" — and a list you cannot read the names in is
              // not a list. The badges wrap under the name there and sit
              // beside it from sm up, where the row has the width.
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="font-medium text-foreground break-words">{lead.businessName}</p>
                <p className="text-xs text-muted-foreground break-words">
                  {[lead.contactName, lead.email, lead.phone, lead.city].filter(Boolean).join(" · ") ||
                    t("app.salesLeads.noContactDetails")}
                </p>
              </div>
              {lead.emailedNoReply && (
                <span className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <MailX size={13} />
                  {t("app.salesLeads.noReplyBadge")}
                </span>
              )}
              {lead._count?.threads > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail size={13} />
                  {lead._count.threads}
                </span>
              )}
              {lead.convertedCompanyId && (
                <span className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("app.salesLeads.signedUp")}
                </span>
              )}
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[lead.status] || STATUS_CLASS.new}`}
              >
                {statusLabel(lead.status)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
