// app/platform/manuals/page.js
//
// FieldQuo's shared manual library (lib/aiEmployee/sharedLibrary.js) — the
// manufacturers' manuals every company's AI team reads AFTER its own
// uploads, as read-only defaults.
//
//   Upload a manual   a PDF, brand-tagged, read page by page; live at once.
//                     The same file twice (by SHA-256) is refused as a
//                     duplicate rather than stored again.
//   Approve           a company's share ("pending") becomes readable by every
//                     company only when somebody here says so.
//   Retire / Restore  out of every reply, or back — nothing is deleted.
//
// Every control is behind manual_library:manage (admin and superadmin); a
// support login sees the list and no buttons (PlatformWriteGate).
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Library, Upload } from "lucide-react";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import { uploadFile } from "@/lib/media/uploadClient";

const STATUS_LABEL = {
  live: "Live — every company's assistant can read it",
  pending: "Waiting for review — no other company can read it yet",
  retired: "Retired — read by nobody",
  withdrawn: "Withdrawn by the company that shared it",
  failed: "Couldn't be read",
};

const BTN = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] border border-border disabled:opacity-50";
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground";

export default function ManualLibraryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [form, setForm] = useState({ title: "", brand: "", modelPattern: "", category: "", trade: "" });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState("");
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canManage = can("manual_library:manage");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/platform/manuals");
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function move(id, status) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/platform/manuals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function upload() {
    if (!file) return;
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      const stored = await uploadFile(file, { endpoint: "/api/platform/manuals/upload", purpose: "reference", shrink: false });
      const res = await fetch("/api/platform/manuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: { url: stored.url, filename: file.name, mimeType: file.type || "application/pdf", bytes: stored.bytes || file.size },
          title: form.title,
          tags: { brand: form.brand, modelPattern: form.modelPattern, category: form.category, trade: form.trade },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setNotice(body?.duplicate ? "That exact file is already in the library — nothing was stored twice." : `Added: ${body?.manual?.title || "manual"} (${STATUS_LABEL[body?.manual?.status] || body?.manual?.status}).`);
      setFile(null);
      setForm({ title: "", brand: "", modelPattern: "", category: "", trade: "" });
      await load();
    } catch (err) {
      setError(err.message || "The upload didn't go through.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Library size={20} /> Manual library
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manufacturers&apos; manuals every company&apos;s AI team reads after its own uploads — read-only, cited by page,
          never shown to a homeowner. A company&apos;s own upload only arrives here if the company ticked &quot;share this
          manufacturer&apos;s manual&quot;, and then only as &quot;waiting for review&quot;.
        </p>
        {data ? (
          <p className="text-xs text-muted-foreground mt-1">
            {data.companiesOptedOut} {data.companiesOptedOut === 1 ? "company has" : "companies have"} switched the library off.
          </p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200 flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      ) : null}
      {notice ? <p className="text-sm text-foreground" role="status">{notice}</p> : null}

      <PlatformWriteGate status={roleStatus} allowed={canManage} action="Adding a manual to the library" who="an admin" error={roleError}>
        <section className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Upload size={16} /> Add a manual</h2>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["title", "Title (e.g. Carrier 59SC5 troubleshooting guide)"],
              ["brand", "Brand — required"],
              ["modelPattern", "Model, or how it starts (e.g. 59SC)"],
              ["category", "Equipment (e.g. furnace)"],
              ["trade", "Trade (e.g. hvac)"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs text-muted-foreground">
                {label}
                <input className={FIELD} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <button type="button" className={BTN} disabled={!file || !form.brand.trim() || busy === "upload"} onClick={upload}>
            {busy === "upload" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload and read it
          </button>
          <p className="text-xs text-muted-foreground">
            Manufacturers&apos; documents are their copyright: stored privately for the assistants&apos; retrieval, paraphrased and cited, never served to a client.
          </p>
        </section>
      </PlatformWriteGate>

      {!data && !error ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</p>
      ) : null}
      {data && !data.manuals.length ? <p className="text-sm text-muted-foreground">The library is empty.</p> : null}
      {data?.manuals?.length ? (
        <ul className="space-y-2">
          {data.manuals.map((m) => (
            <li key={m.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground break-words">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.tags.brand, m.tags.modelPattern, m.tags.category, m.tags.trade].filter(Boolean).join(" · ") || "untagged"}
                    {m.pageCount ? ` · ${m.pagesRead ?? 0} of ${m.pageCount} pages read` : ""}
                    {" · "}
                    {m.origin === "platform" ? "uploaded by FieldQuo" : `shared by ${m.sharedByCompanyName || "a company"}`}
                  </p>
                  <p className="text-xs mt-1 text-foreground">{STATUS_LABEL[m.status] || m.status}</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    {m.status === "pending" ? (
                      <button type="button" className={BTN} disabled={busy === m.id} onClick={() => move(m.id, "live")}>Approve</button>
                    ) : null}
                    {m.status === "pending" || m.status === "live" ? (
                      <button type="button" className={BTN} disabled={busy === m.id} onClick={() => move(m.id, "retired")}>Retire</button>
                    ) : null}
                    {m.status === "retired" ? (
                      <button type="button" className={BTN} disabled={busy === m.id} onClick={() => move(m.id, "live")}>Restore</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
