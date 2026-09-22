// app/components/waivers/WaiversCard.js
//
// The waivers attached to one quote, job or invoice — and the way to attach
// another from the library, send the signing link, or detach one that was
// never signed. One component for the three attach points (the quote's
// Presentation panel, the job page, the invoice page), differing only in
// which id it is handed; the API behind it is /api/waivers.
//
// A signed row is a record: it shows who signed and when, and cannot be
// detached (the server refuses too). Its PDF is on the job's Documents card
// as kind "waiver" once a job exists.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine, Send, Trash2, Plus } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param target  { quoteId } | { jobId } | { invoiceId }
 * @param editable false once the thing it is attached to is closed
 * @param compact  no card chrome (inside another panel)
 */
export default function WaiversCard({ target, editable = true, compact = false, onChanged }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState("");
  const [notice, setNotice] = useState("");

  const query = Object.entries(target || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const load = useCallback(async () => {
    if (!query) return;
    try {
      setData(await fetchJson(`/api/waivers?${query}`));
    } catch (err) {
      setError(err.message);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function attach() {
    if (!pick) return;
    setBusy("attach");
    setError("");
    setNotice("");
    try {
      await fetchJson("/api/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, documentId: pick }),
      });
      setPick("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function send(id) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const r = await fetchJson(`/api/waivers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      setNotice(t("app.waivers.sentTo", "Sent to {email}.", { email: r.to }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function detach(id) {
    setBusy(id);
    setError("");
    try {
      await fetchJson(`/api/waivers/${id}`, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const body = (
    <div className="space-y-2">
      {error && !data && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <div className="h-10 bg-accent rounded-md animate-pulse" aria-busy="true" />}
      {data?.waivers?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("app.waivers.none", "No waiver attached.")}</p>
      )}
      {data?.waivers?.map((w) => (
        <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <PenLine size={14} className="text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground truncate">{w.title}</div>
            <div className="text-xs text-muted-foreground">
              {w.status === "signed" ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {t("app.waivers.signedBy", "Signed by {name} · {date}", {
                    name: w.signedName || "—",
                    date: w.signedAt ? new Date(w.signedAt).toLocaleString() : "",
                  })}
                  {w.acknowledged ? ` · ${t("app.waivers.acknowledged", "{n} acknowledged", { n: w.acknowledged })}` : ""}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  {t("app.waivers.waiting", "Waiting on client")}
                  {w.sentAt ? ` · ${t("app.waivers.sentAt", "sent {date}", { date: new Date(w.sentAt).toLocaleDateString() })}` : ""}
                </span>
              )}
            </div>
          </div>
          {editable && w.status !== "signed" && (
            <>
              <button
                type="button"
                onClick={() => send(w.id)}
                disabled={busy === w.id}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md border border-border text-foreground min-h-9"
              >
                {busy === w.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {w.sentAt ? t("app.waivers.sendAgain", "Send again") : t("app.waivers.send", "Send to client")}
              </button>
              <button
                type="button"
                onClick={() => detach(w.id)}
                disabled={busy === w.id}
                aria-label={t("app.waivers.detach", "Detach")}
                className="p-1.5 text-muted-foreground hover:text-red-600 min-h-9 min-w-9"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ))}
      {editable && data && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {data.library.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("app.waivers.libraryEmpty", "No waiver in your library yet.")}{" "}
              <Link href="/app/settings/presentation#documents" className="underline underline-offset-2 text-foreground">
                {t("app.waivers.writeOne", "Write one")}
              </Link>
            </p>
          ) : (
            <>
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="px-2 py-1.5 text-sm rounded-md border border-border bg-card text-foreground min-h-9"
                aria-label={t("app.waivers.pick", "Waiver to attach")}
              >
                <option value="">{t("app.waivers.pick", "Waiver to attach")}…</option>
                {data.library
                  .filter((d) => !data.waivers.some((w) => w.documentId === d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id} disabled={d.signable === false}>
                      {d.title}
                      {d.signable === false ? ` (${t("app.companyDocuments.waiverNoLines", "No acknowledgement lines yet")})` : ""}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={attach}
                disabled={!pick || busy === "attach"}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-inverted text-inverted-foreground min-h-9 disabled:opacity-50"
              >
                {busy === "attach" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {t("app.waivers.attach", "Attach")}
              </button>
            </>
          )}
        </div>
      )}
      {notice && <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {error && data && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );

  if (compact) return body;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-foreground text-sm">{t("app.waivers.title", "Waivers")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("app.waivers.hint", "A release the client reads, ticks line by line and signs. The signed copy is filed on the job and shown in their portal.")}
        </p>
      </div>
      {body}
    </div>
  );
}
