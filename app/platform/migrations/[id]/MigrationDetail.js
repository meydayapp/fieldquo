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
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";
// The state machine, imported rather than re-typed. This file used to carry
// four hand-copied Sets — WRITABLE, QUOTABLE, CANCELLABLE, COMPLETABLE — of
// exactly the states lib/migrations/state.js already decides. They happened to
// agree today. They are the copy nobody looks at, on the one screen in the
// product that writes inside a company's tenant, where "the screen and the
// route disagree about whether writing is legal" is the entire failure mode
// canWrite() exists to prevent (AGENTS.md failure class 4, non-negotiable #3).
import {
  canCancel,
  canComplete,
  canQuote,
  canWrite,
  describeStatus,
} from "@/lib/migrations/state";

const bad = async (res) => {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error || `Request failed (${res.status}).`);
};

/**
 * The quoted price, in the currency FieldQuo actually quoted it in.
 *
 * An absent currency is NAMED rather than assumed to be CAD. The old default
 * printed "CA$4,000.00" over a figure that may have been agreed in USD — the
 * same fabrication the chargeback panel was fixed for last pass, on a number
 * a company is about to be charged.
 */
function money(cents, currency) {
  if (!Number.isFinite(cents)) return "—";
  if (!currency) return `${(cents / 100).toFixed(2)} (currency not recorded)`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function MigrationDetail({ migrationId: id }) {
  // The shared gate, not `me?.role === "superadmin"` after a fetch. Same reason
  // the six /platform/sales editors were moved onto it: a failed identity call
  // left `me` null, and this screen then drew nothing at all — no quote form,
  // no cancel, no write panel and no sentence — for a real superadmin whose
  // /api/platform/me happened to fail. Never-loaded rendered as restricted.
  //
  // Each gate names the permission ITS OWN route enforces, not one blanket
  // "superadmin?" — the three actions on this page go through three different
  // entries in lib/platform/permissions.js (migration:quote, migration:write,
  // migration:cancel), all three superadmin-only today, and a screen that
  // collapsed them would stop matching the routes the day one is delegated.
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const detailRes = await fetch(`/api/platform/migrations/${id}`);
      if (!detailRes.ok) await bad(detailRes);
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

  const personLabel = (kind, personId) => {
    if (!personId) return null;
    const row = kind === "user" ? people.users[personId] : people.admins[personId];
    return row?.name || row?.email || personId;
  };

  // Every gate on this page asks lib/migrations/state.js, so the screen and
  // the route are answering the same question from the same module.
  const writable = canWrite(request.status);
  const quotable = canQuote(request.status);
  const cancellable = canCancel(request.status);
  const completable = canComplete(request.status);
  const anyAction = quotable || cancellable || completable || writable;

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
          Data migration request &middot; {describeStatus(request.status)} &middot; opened{" "}
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

      {quotable && (
        <PlatformWriteGate
          status={roleStatus}
          allowed={can("migration:quote")}
          action="Pricing a migration"
          who="superadmins"
          error={roleError}
        >
          <QuoteForm
            id={id}
            currentCurrency={request.currency || company?.currency}
            onSaved={(r) => { setData((d) => ({ ...d, request: r })); }}
          />
        </PlatformWriteGate>
      )}

      {!quotable && request.priceCents != null && (
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

      {writable && (
        <PlatformWriteGate
          status={roleStatus}
          allowed={can("migration:write")}
          action="Writing into a company's account"
          who="superadmins"
          error={roleError}
        >
          <WritePanel
            id={id}
            writes={request.writes || []}
            people={people}
            companyCurrency={company?.currency}
            setError={setError}
            setNote={setNote}
            reload={load}
          />
        </PlatformWriteGate>
      )}

      {!writable && request.writes?.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-foreground">What was written</h2>
          <WritesList writes={request.writes} people={people} />
        </section>
      )}

      {(cancellable || completable) && (
        <PlatformWriteGate
          status={roleStatus}
          allowed={can("migration:write") && can("migration:cancel")}
          action="Closing out or cancelling a migration"
          who="superadmins"
          error={roleError}
        >
          <TerminalActions
            id={id}
            status={request.status}
            cancellable={cancellable}
            completable={completable}
            writable={writable}
            setError={setError}
            setNote={setNote}
            reload={load}
          />
        </PlatformWriteGate>
      )}

      {/* A migration in a state with nothing left to do says so, rather than
          ending in whitespace that reads as a screen still loading. */}
      {!anyAction && (
        <p className="text-sm text-muted-foreground">
          This migration is {describeStatus(request.status)}. Nothing can be
          priced, written or changed from here — the record stays as it is.
        </p>
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

/**
 * Mark completed, and cancel — the two irreversible ends of the state machine.
 *
 * ── The bug this replaced ──────────────────────────────────────────────────
 *
 * Cancel read `window.prompt("Reason for cancelling (optional):") || ""` and
 * then posted regardless. window.prompt returns null when the person presses
 * Escape or the dialog's own Cancel button — so backing out of the prompt
 * CANCELLED THE MIGRATION, with an empty reason, on the one action in this
 * product that revokes a company's paid-for write window. The `|| ""` that
 * caused it is the same shape as `Number(value || 0)`: a falsy value with a
 * meaning, coalesced into one without.
 *
 * ── And what the button did not say ────────────────────────────────────────
 *
 * It said "Cancel", next to a save button, on a screen full of forms. From
 * `paid` or `in_progress` it closes canWrite() immediately and FieldQuo issues
 * no refund on its own (docs/MIGRATION-SERVICE.md, "what was not built") — so
 * the consequence is named before the click rather than discovered after it,
 * and a reason is asked for in the page rather than in a browser dialog that
 * cannot explain itself.
 */
function TerminalActions({
  id,
  status,
  cancellable,
  completable,
  writable,
  setError,
  setNote,
  reload,
}) {
  const [confirming, setConfirming] = useState(null); // "cancel" | "complete"
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(kind) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/platform/migrations/${id}/${kind === "cancel" ? "cancel" : "complete"}`,
        kind === "cancel"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            }
          : { method: "POST" },
      );
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error || "That didn't work.");
        return;
      }
      setNote(
        kind === "cancel"
          ? "Cancelled. The write path is closed; no refund has been issued by FieldQuo."
          : "Marked completed. The write path is closed.",
      );
      setConfirming(null);
      setReason("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    const isCancel = confirming === "cancel";
    return (
      <section
        className={`rounded-xl border p-5 space-y-3 ${
          isCancel
            ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
            : "border-border bg-card"
        }`}
      >
        <h2 className={`font-semibold ${isCancel ? "text-red-900 dark:text-red-200" : "text-foreground"}`}>
          {isCancel ? "Cancel this migration?" : "Mark this migration completed?"}
        </h2>
        <p className={`text-sm ${isCancel ? "text-red-800 dark:text-red-300" : "text-muted-foreground"}`}>
          {isCancel ? (
            <>
              This is terminal — a cancelled migration cannot be reopened.
              {writable ? (
                <>
                  {" "}
                  It has been paid for and the write path is open right now:
                  cancelling closes it immediately, and{" "}
                  <strong>FieldQuo does not issue a refund automatically</strong>{" "}
                  — that is a Stripe Billing action taken outside this product.
                </>
              ) : (
                <> Nothing already written into the company&apos;s account is removed.</>
              )}
            </>
          ) : (
            <>
              This is terminal. Writing into this company&apos;s account stops
              here, for you as well as for everyone else — bringing in more
              records later means a new migration request. Anything already
              written stays.
            </>
          )}
        </p>
        {isCancel && (
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-medium text-muted-foreground mb-1">
              Why (recorded against you in the audit log, and shown to nobody else)
            </label>
            <input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(confirming)}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 ${
              isCancel ? "bg-red-700 text-white" : "bg-inverted text-inverted-foreground"
            }`}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
            {isCancel ? "Cancel the migration" : "Mark it completed"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirming(null);
              setReason("");
            }}
            className="text-sm px-3 py-1.5 rounded-lg border border-border text-foreground disabled:opacity-60"
          >
            Leave it alone
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex items-center gap-2">
      {completable && (
        <ActionButton
          label="Mark completed"
          icon={CheckCircle2}
          onClick={() => setConfirming("complete")}
        />
      )}
      {cancellable && (
        <ActionButton
          label={writable ? "Cancel — closes the write path" : "Cancel this migration"}
          icon={Ban}
          destructive
          onClick={() => setConfirming("cancel")}
        />
      )}
      <span className="text-xs text-muted-foreground">
        Both are terminal from {describeStatus(status)}.
      </span>
    </section>
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

function WritePanel({ id, writes, people, companyCurrency, setError, setNote, reload }) {
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
        companyCurrency={companyCurrency}
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

/**
 * A historical quote, recorded inside the company's own tenant.
 *
 * The total box said "Total ($)". A Quote row carries no currency of its own —
 * every screen and PDF renders it in the COMPANY's currency (lib/currency.js) —
 * so on a euro contractor's migration that "$" named the wrong money on the one
 * form that writes a figure into their books. The company's currency is on the
 * detail payload; it is printed here instead of a dollar sign. When it is
 * genuinely absent the label says so rather than picking one.
 */
function AddQuoteForm({
  id,
  clients,
  clientsError,
  onRetryClients,
  companyCurrency,
  setError,
  setNote,
  reload,
}) {
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const totalLabel = companyCurrency
    ? `Total (${companyCurrency})`
    : "Total (this company's currency)";

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
          placeholder={totalLabel}
          aria-label={totalLabel}
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
          {clientsError}{" "}
          This company may well have clients — the list just
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
