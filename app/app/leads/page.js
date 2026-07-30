// app/app/leads/page.js
//
// Inbound enquiries from the public booking/contact forms, before they're
// anyone's client.
//
// Laid out as columns by status because that's what a lead pipeline is — a
// thing that moves left to right and where the question is always "what's
// sitting untouched in column one". A flat table hides exactly that.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Mail, Phone, ArrowRight, AlertCircle } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
// Mirrors the LeadStatus enum. Order is the pipeline order, not alphabetical.
const COLUMNS = [
  { key: "new", label: "New", tone: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900" },
  { key: "contacted", label: "Contacted", tone: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" },
  {
    key: "converted",
    label: "Converted",
    tone: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  },
  { key: "lost", label: "Lost", tone: "bg-muted border-border" },
];

const NEXT_STATUS = { new: "contacted", contacted: "converted" };

export default function LeadsPage() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Couldn't load leads.");
      setLeads(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const out = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const lead of leads) (out[lead.status] || out.new).push(lead);
    return out;
  }, [leads]);

  async function move(lead, status) {
    setBusyId(lead.id);
    setError("");
    // Optimistic — a card snapping back is a clearer failure signal than a
    // spinner that resolves into the same place it started.
    const before = leads;
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status } : l)),
    );
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't update that lead.");
      }
    } catch (err) {
      setLeads(before);
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.leads.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.leads.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Inbox size={30} className="text-muted-foreground mx-auto" />
          <p className="mt-3 font-medium text-foreground">{t("app.leads.empty")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {t("app.leads.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-semibold text-foreground">
                  {col.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {grouped[col.key].length}
                </span>
              </div>

              <div className="space-y-3">
                {grouped[col.key].length === 0 && (
                  <div className="border border-dashed border-border rounded-xl px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("app.leads.nothingHere")}
                  </div>
                )}

                {grouped[col.key].map((lead) => (
                  <div
                    key={lead.id}
                    className={`border rounded-xl p-4 ${col.tone} ${
                      busyId === lead.id ? "opacity-60" : ""
                    }`}
                  >
                    <div className="font-medium text-foreground">{lead.name}</div>

                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1.5 hover:text-foreground break-all"
                        >
                          <Mail size={11} className="shrink-0" />
                          {lead.email}
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex items-center gap-1.5 hover:text-foreground"
                        >
                          <Phone size={11} className="shrink-0" />
                          {lead.phone}
                        </a>
                      )}
                    </div>

                    {lead.category?.label && (
                      <div className="mt-2 inline-block text-[11px] px-2 py-0.5 rounded-full bg-card/70 text-muted-foreground">
                        {lead.category.label}
                      </div>
                    )}

                    {lead.message && (
                      <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                        {lead.message}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}
                        {lead.source && ` · ${lead.source}`}
                      </span>

                      <div className="flex gap-2">
                        {NEXT_STATUS[lead.status] && (
                          <button
                            onClick={() => move(lead, NEXT_STATUS[lead.status])}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-foreground disabled:opacity-50"
                          >
                            {NEXT_STATUS[lead.status] === "contacted"
                              ? "Contacted"
                              : "Won"}
                            <ArrowRight size={11} />
                          </button>
                        )}
                        {!["lost", "converted"].includes(lead.status) && (
                          <button
                            onClick={() => move(lead, "lost")}
                            disabled={Boolean(busyId)}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            {t("app.status.lost")}
                          </button>
                        )}
                      </div>
                    </div>

                    {lead.status === "converted" && (
                      <Link
                        href="/app/quotes/new"
                        className="mt-3 flex items-center justify-center gap-1.5 bg-card border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-semibold py-2 rounded-lg"
                      >
                        {t("app.leads.startQuote")}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
