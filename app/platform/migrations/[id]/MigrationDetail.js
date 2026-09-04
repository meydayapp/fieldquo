// app/platform/migrations/[id]/MigrationDetail.js
//
// One migration request from the platform side — the screen that quotes it,
// and the ONLY screen in the whole product where a superadmin can create rows
// inside a company's own tenant data. Everything below the "Write into
// [company]'s account" heading is gated on canWrite(request.status) — see
// lib/migrations/state.js — and every submit there calls a route that
// re-checks the same gate against a freshly-read row before writing anything.
//
// Reached from /platform/migrations (the list) — a DRILL_IN in
// scripts/check-nav-audit.mjs, same convention as every other [id] detail
// page off a platform list. Split into a server shell (page.js) + this client
// component the same way app/platform/companies/[id] already does — see that
// file's own comment for why.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  FileText,
  Ban,
  CheckCircle2,
} from "lucide-react";

const bad = async (res) => {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error || `Request failed (${res.status}).`);
};

function money(cents, currency) {
  if (!Number.isFinite(cents)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "CAD" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || ""}`;
  }
}

const WRITABLE = new Set(["paid", "in_progress"]);
const QUOTABLE = new Set(["requested", "scheduled"]);
const CANCELLABLE = new Set(["requested", "scheduled", "quoted", "accepted", "paid", "in_progress"]);
const COMPLETABLE = new Set(["paid", "in_progress"]);

export default function MigrationDetail({ migrationId: id }) {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [meRes, detailRes] = await Promise.all([
        fetch("/api/platform/me"),
        fetch(`/api/platform/migrations/${id}`),
      ]);
      if (!meRes.ok) await bad(meRes);
      if (!detailRes.ok) await bad(detailRes);
      setMe(await meRes.json());
      setData(await detailRes.json());
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { request, company, people } = data;
  const isSuperadmin = me?.role === "superadmin";

  const personLabel = (kind, personId) => {
    if (!personId) return null;
    const row = kind === "user" ? people.users[personId] : people.admins[personId];
    return row?.name || row?.email || personId;
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <Link href="/platform/migrations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All migrations
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {company ? (
            <Link href={`/platform/companies/${company.id}`} className="hover:underline">
              {company.name}
            </Link>
          ) : (
            "(unknown company)"
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Data migration request &middot; {request.status.replace("_", " ")} &middot; opened{" "}
          {new Date(request.createdAt).toLocaleDateString()}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {note && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {note}
        </div>
      )}

      <section className="bg-card border border-border rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-foreground">What they described</h2>
        {request.sourceSystems && <p className="text-sm text-foreground">{request.sourceSystems}</p>}
        {request.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>}
        {!request.sourceSystems && !request.description && (
          <p className="text-sm text-muted-foreground">Nothing entered yet.</p>
        )}
        {request.requestedById && (
          <p className="text-xs text-muted-foreground">Requested by {personLabel("user", request.requestedById)}</p>
        )}
      </section>

      {request.scheduledAt && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-1">
          <h2 className="font-semibold text-foreground">Consultation</h2>
          <p className="text-sm text-foreground">{new Date(request.scheduledAt).toLocaleString()}</p>
          {request.hostAdminId && (
            <p className="text-xs text-muted-foreground">Host: {personLabel("admin", request.hostAdminId)}</p>
          )}
        </section>
      )}

      {QUOTABLE.has(request.status) && isSuperadmin && (
        <QuoteForm id={id} currentCurrency={request.currency} onSaved={(r) => { setData((d) => ({ ...d, request: r })); }} />
      )}

      {!QUOTABLE.has(request.status) && request.priceCents != null && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-1">
          <h2 className="font-semibold text-foreground">Quote</h2>
          <p className="text-2xl font-bold text-foreground">{money(request.priceCents, request.currency)}</p>
          {request.quoteNote && <p className="text-sm text-muted-foreground">{request.quoteNote}</p>}
          {request.consultationNotes && (
            <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
              Internal notes: {request.consultationNotes}
            </p>
          )}
        </section>
      )}

      <section className="bg-card border border-border rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-foreground">Documents from the company</h2>
        {request.documents?.length === 0 && <p className="text-sm text-muted-foreground">None uploaded yet.</p>}
        <ul className="divide-y divide-border">
          {request.documents?.map((d) => (
            <li key={d.id} className="py-2 flex items-center gap-2 text-sm">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline truncate">
                {d.filename || "(unnamed file)"}
              </a>
              <span className="text-xs text-muted-foreground shrink-0 ml-auto">
                {new Date(d.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {WRITABLE.has(request.status) && isSuperadmin && (
        <WritePanel
          id={id}
          writes={request.writes || []}
          people={people}
          setError={setError}
          setNote={setNote}
          reload={load}
        />
      )}

      {!WRITABLE.has(request.status) && request.writes?.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-foreground">What was written</h2>
          <WritesList writes={request.writes} people={people} />
        </section>
      )}

      {isSuperadmin && (CANCELLABLE.has(request.status) || COMPLETABLE.has(request.status)) && (
        <section className="flex items-center gap-2">
          {COMPLETABLE.has(request.status) && (
            <ActionButton
              label="Mark completed"
              icon={CheckCircle2}
              onClick={async () => {
                const res = await fetch(`/api/platform/migrations/${id}/complete`, { method: "POST" });
                if (!res.ok) return setError((await res.json().catch(() => ({})))?.error || "Failed");
                setNote("Marked completed.");
                await load();
              }}
            />
          )}
          {CANCELLABLE.has(request.status) && (
            <ActionButton
              label="Cancel"
              icon={Ban}
              destructive
              onClick={async () => {
                const reason = window.prompt("Reason for cancelling (optional):") || "";
                const res = await fetch(`/api/platform/migrations/${id}/cancel`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason }),
                });
                if (!res.ok) return setError((await res.json().catch(() => ({})))?.error || "Failed");
                setNote("Cancelled.");
                await load();
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, destructive }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-60 ${
        destructive ? "border-red-200 dark:border-red-900 text-red-700 dark:text-red-300" : "border-border text-foreground"
      }`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      {label}
    </button>
  );
}

function QuoteForm({ id, currentCurrency, onSaved }) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currentCurrency || "CAD");
  const [quoteNote, setQuoteNote] = useState("");
  const [consultationNotes, setConsultationNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/platform/migrations/${id}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents: Math.round(Number(amount) * 100),
          currency,
          quoteNote,
          consultationNotes,
        }),
      });
      if (!res.ok) return await bad(res);
      const { request } = await res.json();
      onSaved(request);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold text-foreground">Set the price</h2>
      {err && <p className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-32 border border-border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="border border-border rounded-lg px-2 py-2 text-sm"
        >
          {["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "CHF"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <textarea
        value={quoteNote}
        onChange={(e) => setQuoteNote(e.target.value)}
        rows={2}
        placeholder="What the surcharge covers — shown to the company"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
      />
      <textarea
        value={consultationNotes}
        onChange={(e) => setConsultationNotes(e.target.value)}
        rows={2}
        placeholder="Internal notes from the call — never shown to the company"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={saving || !amount}
        className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        Send quote
      </button>
    </form>
  );
}

function WritesList({ writes, people }) {
  return (
    <ul className="divide-y divide-border">
      {writes.map((w) => (
        <li key={w.id} className="py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-foreground">
              {w.entityType}: {w.entityType === "Client" ? w.snapshot?.name : w.snapshot?.quoteNumber}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{new Date(w.createdAt).toLocaleString()}</span>
          </div>
          {w.platformAdminId && (
            <p className="text-xs text-muted-foreground">
              by {people.admins[w.platformAdminId]?.email || w.platformAdminId}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function WritePanel({ id, writes, people, setError, setNote, reload }) {
  const [clients, setClients] = useState(null);
  const [clientsError, setClientsError] = useState("");

  // Was `if (res.ok) setClients(...)` with no else, on the one panel in the
  // product that writes into a company's own tenant. A failed load left
  // `clients` null forever, and null is the LOADING state below — so the
  // client picker sat on "Loading clients…" permanently, with no error, no
  // retry, and no way to tell that from a slow request. Three states now.
  const loadClients = useCallback(async () => {
    setClientsError("");
    try {
      const res = await fetch(`/api/platform/migrations/${id}/clients`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setClients(body?.clients || []);
    } catch (err) {
      setClients(null);
      setClientsError(err.message || "Couldn't load this company's clients.");
    }
  }, [id]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">Write into this company's account</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Every save here is logged and attributed — see "What was written" below. Only new records
          are created; nothing the company already had can be changed from this screen.
        </p>
      </div>

      <AddClientForm
        id={id}
        setError={setError}
        setNote={setNote}
        onCreated={async () => {
          await loadClients();
          await reload();
        }}
      />

      <AddQuoteForm
        id={id}
        clients={clients}
        clientsError={clientsError}
        onRetryClients={loadClients}
        setError={setError}
        setNote={setNote}
        reload={reload}
      />

      {writes.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2">What was written</h3>
          <WritesList writes={writes} people={people} />
        </div>
      )}
    </section>
  );
}

function AddClientForm({ id, setError, setNote, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/migrations/${id}/writes/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, address }),
      });
      if (!res.ok) return await bad(res);
      setName(""); setEmail(""); setPhone(""); setAddress("");
      setNote("Client added.");
      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-border rounded-lg p-3">
      <p className="text-sm font-medium text-foreground">Add a client</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="border border-border rounded-lg px-3 py-1.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border border-border rounded-lg px-3 py-1.5 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="border border-border rounded-lg px-3 py-1.5 text-sm" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="border border-border rounded-lg px-3 py-1.5 text-sm" />
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Add client
      </button>
    </form>
  );
}

function AddQuoteForm({ id, clients, clientsError, onRetryClients, setError, setNote, reload }) {
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/migrations/${id}/writes/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, totalCents: Math.round(Number(amount) * 100), description }),
      });
      if (!res.ok) return await bad(res);
      setAmount(""); setDescription("");
      setNote("Quote recorded.");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-border rounded-lg p-3">
      <p className="text-sm font-medium text-foreground">Record a historical quote</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">
            {clientsError
              ? "Clients didn't load"
              : clients === null
                ? "Loading clients…"
                : "Select a client"}
          </option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Total ($)"
          className="border border-border rounded-lg px-3 py-1.5 text-sm"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="What this quote was for"
        className="w-full border border-border rounded-lg px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={saving || !clientId || amount === ""}
        className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Add quote
      </button>
      {clientsError && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {clientsError} This company may well have clients — the list just
          didn&apos;t arrive, and nothing has been changed.{" "}
          <button
            type="button"
            onClick={onRetryClients}
            className="underline font-medium"
          >
            Try again
          </button>
          .
        </p>
      )}
      {!clientsError && clients?.length === 0 && (
        <p className="text-xs text-muted-foreground">Add a client above first.</p>
      )}
    </form>
  );
}
