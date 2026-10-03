// app/platform/business-numbers/page.js
//
// Companies bringing their own business number into FieldQuo — and the one
// part of it a person at FieldQuo has to do: filing a CANADIAN port on
// Twilio's international porting form (Twilio has no Canadian port API).
//
// The list is readable by anyone on the console. Opening a package (it holds
// the carrier account number, the PIN and the bill) and recording a filing
// are superadmin-only, and every open is audit-logged by the API. Recording a
// filing writes FieldQuo's own PortFiling log — never the company's request.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

function Package({ id, onClose, onRecorded }) {
  const [pkg, setPkg] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [portDate, setPortDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJson(`/api/platform/business-numbers?package=${encodeURIComponent(id)}`)
      .then(setPkg)
      .catch((e) => setError(e.message));
  }, [id]);

  async function record(action) {
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/platform/business-numbers", { method: "POST", body: { id, action, note: note || undefined, portDate: portDate || undefined } });
      onRecorded();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Port package {pkg ? `— ${pkg.e164} · ${pkg.company?.name}` : ""}</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!pkg && !error && <Loader2 className="animate-spin text-muted-foreground" size={18} />}
      {pkg && (
        <>
          {pkg.unreadable && <p className="text-sm text-red-700 dark:text-red-400">{pkg.unreadable}</p>}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Twilio account SID</dt><dd className="font-mono">{pkg.accountSid || "—"}</dd>
            <dt className="text-muted-foreground">Number</dt><dd className="font-mono">{pkg.e164} ({pkg.lineType}{pkg.carrierName ? ` · ${pkg.carrierName}` : ""})</dd>
            <dt className="text-muted-foreground">Account holder</dt><dd>{pkg.holderName} ({pkg.customerType})</dd>
            <dt className="text-muted-foreground">Signer email</dt><dd>{pkg.holderEmail}</dd>
            <dt className="text-muted-foreground">Service address</dt>
            <dd>{[pkg.serviceAddress?.street, pkg.serviceAddress?.street2, pkg.serviceAddress?.city, pkg.serviceAddress?.region, pkg.serviceAddress?.postalCode, pkg.serviceAddress?.country].filter(Boolean).join(", ")}</dd>
            <dt className="text-muted-foreground">Carrier account number</dt><dd className="font-mono">{pkg.accountNumber || (pkg.secretsPurgedAt ? "purged" : "—")}</dd>
            <dt className="text-muted-foreground">Port-out PIN</dt><dd className="font-mono">{pkg.pin || (pkg.secretsPurgedAt ? "purged" : "none given")}</dd>
            <dt className="text-muted-foreground">Bill</dt>
            <dd>
              {pkg.bill ? (
                <a download={pkg.bill.name || "bill"} href={`data:${pkg.bill.type};base64,${pkg.bill.base64}`} className="inline-flex items-center gap-1 underline">
                  <FileText size={14} /> {pkg.bill.name || "bill"}
                </a>
              ) : "—"}
            </dd>
          </dl>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Letter of authorization (as the company signed it)</p>
            <pre className="whitespace-pre-wrap text-xs bg-muted rounded-lg p-3">{pkg.loa}</pre>
          </div>
          <a href={pkg.formUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
            Open Twilio&apos;s international porting form <ExternalLink size={13} />
          </a>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Record what happened</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ticket reference, or the carrier's rejection reason (the company sees this)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy} onClick={() => record("filed")} className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50">Filed with Twilio</button>
              <input type="date" value={portDate} onChange={(e) => setPortDate(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
              <button type="button" disabled={busy || !portDate} onClick={() => record("confirmed")} className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50">Carrier confirmed this date</button>
              <button type="button" disabled={busy || !note} onClick={() => record("rejected")} className="rounded-lg border border-red-300 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm disabled:opacity-50">Carrier rejected it</button>
            </div>
            <p className="text-xs text-muted-foreground">
              &ldquo;Complete&rdquo; is not recorded here — the request goes live by itself when the number appears in FieldQuo&apos;s Twilio account (checked hourly).
            </p>
          </div>
          {pkg.filings?.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {pkg.filings.map((f) => (
                <li key={f.id}>{fmt(f.createdAt)} — {f.action}{f.portDate ? ` (${new Date(f.portDate).toLocaleDateString()})` : ""}{f.note ? `: ${f.note}` : ""}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function PlatformBusinessNumbersPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    fetchJson("/api/platform/business-numbers")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Business numbers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Companies bringing their own number in: hosted texting for landlines and toll-free, ports for cells. US ports and every hosted order run through Twilio&apos;s API and update themselves; a <strong>Canadian port</strong> waits here for someone to file it on Twilio&apos;s form.
        </p>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!data && !error && <Loader2 className="animate-spin text-muted-foreground" size={18} />}
      {open && <Package id={open} onClose={() => setOpen(null)} onRecorded={() => { setOpen(null); load(); }} />}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Last filing</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No company has started bringing a number in yet.</td></tr>
              )}
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.company?.name}{r.simulated ? " (demo)" : ""}</td>
                  <td className="px-3 py-2 font-mono">{r.e164} <span className="text-muted-foreground">{r.country} · {r.lineType}</span></td>
                  <td className="px-3 py-2">{r.path === "port" ? `Port (${r.submitChannel === "twilio_form" ? "Twilio form — manual" : "Twilio API"})` : "Hosted SMS"}</td>
                  <td className="px-3 py-2">
                    {r.status}
                    {r.providerStatus ? <span className="text-muted-foreground"> · {r.providerStatus}</span> : null}
                    {r.failureReason ? <div className="text-xs text-red-700 dark:text-red-400">{r.failureReason}</div> : null}
                  </td>
                  <td className="px-3 py-2">{fmt(r.submittedAt)}</td>
                  <td className="px-3 py-2 text-xs">{r.filings?.[0] ? `${r.filings[0].action} · ${fmt(r.filings[0].createdAt)}` : "—"}</td>
                  <td className="px-3 py-2">
                    {data.canHandle && r.submitChannel === "twilio_form" && !["active", "failed", "cancelled"].includes(r.status) && (
                      <button type="button" onClick={() => setOpen(r.id)} className="text-sm underline">Open package</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
