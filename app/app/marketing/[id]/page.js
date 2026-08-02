// app/app/marketing/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Check,
  UserX,
  MessageSquare,
  Trash2,
  X,
  CalendarPlus,
  FileText,
} from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import EmailCampaignDetail from "@/app/components/marketing/EmailCampaignDetail";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const STATUS_META = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  delivered: { label: "Delivered", cls: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300" },
  spoke: { label: "Spoke to owner", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" },
  not_home: { label: "Not home", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
};

// Static Maps route preview — numbered markers in route order plus a path
// line through them. No JS SDK (avoids the multi-load Google Maps conflict
// MiniMap.js documents); just an <img>.
function RouteMap({ stops }) {
  const { t } = useTranslation();
  const pts = stops.filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  if (pts.length === 0) {
    return (
      <div className="w-full h-48 rounded-xl bg-muted border border-border flex items-center justify-center text-xs text-muted-foreground">
        {t("app.mkDetail.addAddressesHint")}
      </div>
    );
  }

  const params = new URLSearchParams({
    size: "640x300",
    scale: "2",
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });
  // Numbered markers (Google supports label A–Z / 0–9; for >9 stops the label
  // wraps but the path still conveys order).
  pts.forEach((s, i) => {
    const label = i < 9 ? String(i + 1) : "";
    params.append(
      "markers",
      `color:0x111827|label:${label}|${Number(s.latitude)},${Number(s.longitude)}`,
    );
  });
  const path = pts
    .map((s) => `${Number(s.latitude)},${Number(s.longitude)}`)
    .join("|");
  params.append("path", `color:0x111827aa|weight:3|${path}`);

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`}
        alt={t("app.mkDetail.routeAlt")}
        className="w-full h-[200px] object-cover"
      />
    </div>
  );
}

export default function CampaignDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newStop, setNewStop] = useState({ address: "", latitude: null, longitude: null });
  const [addingStop, setAddingStop] = useState(false);

  // Convert-to-lead modal state
  const [convertStop, setConvertStop] = useState(null);
  const [convertForm, setConvertForm] = useState({
    clientName: "",
    clientPhone: "",
    scheduledAt: "",
  });
  const [converting, setConverting] = useState(false);

  async function load() {
    // A non-ok response used to be mapped to null, which the UI renders as a
    // bland "not found" even when the request actually failed (500, network).
    // Surface the real error instead of masking it, and never feed an error
    // body into setCampaign.
    try {
      const res = await fetch(`/api/marketing/campaigns/${id}`);
      if (!res.ok) {
        await reportResponseError(res);
        setCampaign(null);
        return;
      }
      setCampaign(await res.json());
    } catch (err) {
      setError(err.message || t("app.mkDetail.addAddressError"));
      setCampaign(null);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function handleAddStop(e) {
    e.preventDefault();
    if (!newStop.address.trim()) return;
    setAddingStop(true);
    try {
      const res = await fetch(`/api/marketing/campaigns/${id}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStop),
      });
      if (res.ok) {
        setNewStop({ address: "", latitude: null, longitude: null });
        await load();
      } else {
        const d = await res.json();
        setError(d.error || t("app.mkDetail.addAddressError"));
      }
    } finally {
      setAddingStop(false);
    }
  }

  async function updateStop(stopId, patch) {
    const res = await fetch(`/api/marketing/stops/${stopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    // Without this a failed status change reloaded the old state silently — the
    // button looked like it did nothing rather than telling you why.
    if (!res.ok) return reportResponseError(res);
    await load();
  }

  async function deleteStop(stopId) {
    const res = await fetch(`/api/marketing/stops/${stopId}`, { method: "DELETE" });
    if (!res.ok) return reportResponseError(res);
    await load();
  }

  function openConvert(stop) {
    setConvertStop(stop);
    setConvertForm({
      clientName: stop.client?.name || "",
      clientPhone: "",
      scheduledAt: "",
    });
  }

  async function handleConvert(e) {
    e.preventDefault();
    setConverting(true);
    setError("");
    try {
      const res = await fetch(`/api/marketing/stops/${convertStop.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("app.mkDetail.convertError"));
      setConvertStop(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          {t("app.mkDetail.notFound")}
        </p>
        <Link href="/app/marketing" className="text-sm text-foreground underline">
          {t("app.mkDetail.backToMarketing")}
        </Link>
      </div>
    );
  }

  // Email campaigns are an entirely different workflow (template + send,
  // no route/stops) — branch out early rather than threading pamphlet-only
  // state through this whole component.
  if (campaign.type === "email") {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <Link
            href="/app/marketing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft size={14} /> {t("app.mkDetail.backToMarketing")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
        </div>
        <EmailCampaignDetail
          campaign={campaign}
          onSent={(updated) => setCampaign((prev) => ({ ...prev, ...updated }))}
        />
      </div>
    );
  }

  const stops = campaign.stops || [];
  const visited = stops.filter(
    (s) => s.status !== "pending" && s.status !== "skipped",
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/marketing"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> {t("app.mkDetail.backToMarketing")}
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
          <span className="text-sm text-muted-foreground">
            {t("app.mkDetail.visitedCount", {
              visited,
              total: stops.length,
            })}
          </span>
        </div>
        {campaign.assignedTo && (
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.mkDetail.assignedTo", { name: campaign.assignedTo.name })}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <RouteMap stops={stops} />

      {/* Add address */}
      <form
        onSubmit={handleAddStop}
        className="bg-card border border-border rounded-xl p-4 flex items-end gap-3"
      >
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">
            {t("app.mkDetail.addAddressLabel")}
          </label>
          <AddressAutocomplete
            value={newStop.address}
            onChange={(v) => setNewStop({ ...newStop, address: v })}
            onPlaceSelected={({ address, lat, lng }) =>
              setNewStop({ address, latitude: lat, longitude: lng })
            }
            placeholder={t("app.mkDetail.addressPlaceholder")}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={addingStop}
          className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 shrink-0"
        >
          <Plus size={14} />{" "}
          {addingStop ? t("app.mkDetail.adding") : t("app.action.add")}
        </button>
      </form>

      {/* Ordered stop list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {stops.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            {t("app.mkDetail.noAddresses")}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {stops.map((stop, i) => {
              const meta = STATUS_META[stop.status] || STATUS_META.pending;
              return (
                <div key={stop.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-inverted text-inverted-foreground text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {stop.address}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${meta.cls}`}
                        >
                          {t("app.mkStop." + stop.status, meta.label)}
                        </span>
                        {stop.client && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            → {stop.client.name}
                          </span>
                        )}
                      </div>
                      {stop.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stop.notes}
                        </p>
                      )}

                      {/* Field actions */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <button
                          onClick={() =>
                            updateStop(stop.id, { status: "delivered" })
                          }
                          className="flex items-center gap-1 text-xs border border-border rounded-full px-2.5 py-1 hover:bg-muted"
                        >
                          <Check size={12} /> {t("app.mkStop.delivered")}
                        </button>
                        <button
                          onClick={() =>
                            updateStop(stop.id, { status: "not_home" })
                          }
                          className="flex items-center gap-1 text-xs border border-border rounded-full px-2.5 py-1 hover:bg-muted"
                        >
                          <UserX size={12} /> {t("app.mkStop.not_home")}
                        </button>
                        <button
                          onClick={() => openConvert(stop)}
                          className="flex items-center gap-1 text-xs border border-border rounded-full px-2.5 py-1 hover:bg-muted"
                        >
                          <MessageSquare size={12} /> {t("app.mkStop.spoke")}
                        </button>
                        <button
                          onClick={() => deleteStop(stop.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 px-1.5 py-1"
                          aria-label={t("app.mkDetail.removeStop")}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Once we have a client on this stop, offer the RBAC-
                          gated next steps: schedule (handled in convert modal)
                          or jump to the quote builder pre-scoped to them. */}
                      {stop.client && (
                        <div className="flex items-center gap-3 mt-2">
                          <Link
                            href={`/app/quotes/new?clientId=${stop.client.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-foreground"
                          >
                            <FileText size={12} /> {t("app.mkDetail.createQuote")}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Convert / spoke-to-owner modal */}
      {convertStop && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setConvertStop(null)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                {t("app.mkStop.spoke")}
              </h2>
              <button onClick={() => setConvertStop(null)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("app.mkDetail.convertBody", { address: convertStop.address })}
            </p>

            <form onSubmit={handleConvert} className="space-y-3">
              <input
                autoFocus
                placeholder={t("app.mkDetail.homeownerName")}
                value={convertForm.clientName}
                onChange={(e) =>
                  setConvertForm({ ...convertForm, clientName: e.target.value })
                }
                className={inputClass}
              />
              <input
                placeholder={t("app.mkDetail.phoneOptional")}
                value={convertForm.clientPhone}
                onChange={(e) =>
                  setConvertForm({
                    ...convertForm,
                    clientPhone: e.target.value,
                  })
                }
                className={inputClass}
              />
              <div>
                <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                  <CalendarPlus size={12} /> {t("app.mkDetail.scheduleVisit")}
                </label>
                <input
                  type="datetime-local"
                  value={convertForm.scheduledAt}
                  onChange={(e) =>
                    setConvertForm({
                      ...convertForm,
                      scheduledAt: e.target.value,
                    })
                  }
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.mkDetail.bookingHint")}
                </p>
              </div>

              <button
                type="submit"
                disabled={converting}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {converting ? t("app.action.saving") : t("app.action.save")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
