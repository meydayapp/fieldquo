"use client";

// "Email clients their portal link" — owners and admins, from the Clients
// page. The route (app/api/clients/portal-links) is the gate and the rule
// (lib/portal/bulkLinks.js); this screen shows the dry run FIRST and sends
// only on an explicit confirm.
//
//   1. Opening it asks GET — the dry run. Nothing is minted or sent.
//   2. It shows how many clients get the email, who (and why each is
//      eligible), why the rest are skipped, and the email the first one gets.
//   3. "Send to N clients" POSTs { confirm: true, expected: N }. If the list
//      moved since step 1 the route sends nothing and says so; the dialog
//      reloads the preview rather than sending to a list nobody looked at.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Check, X } from "lucide-react";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const SKIP_KEYS = [
  ["no_email", "app.portalLinks.skip.noEmail"],
  ["opted_out", "app.portalLinks.skip.optedOut"],
  ["inactive", "app.portalLinks.skip.inactive"],
  ["recent", "app.portalLinks.skip.recent"],
];

export default function PortalLinksDialog({ onClose }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | sending | done
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showEmail, setShowEmail] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      setPreview(await fetchJson("/api/clients/portal-links"));
      setState("ready");
    } catch (err) {
      setError(errorText(t, err));
      setState("ready");
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!preview?.batch || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const out = await fetchJson("/api/clients/portal-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, expected: preview.batch }),
      });
      setResult(out);
      setState("done");
    } catch (err) {
      if (err?.status === 409) {
        // The list changed: show the new one; nothing went.
        await load();
        setError(t("app.portalLinks.listChanged"));
        return;
      }
      setError(errorText(t, err));
      setState("ready");
    }
  }

  const days = preview?.windowDays ?? 30;
  const count = preview?.count ?? 0;
  const batch = preview?.batch ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        className="fq-dialog-card bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-links-title"
        data-portal-links-dialog
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="portal-links-title" className="font-semibold text-foreground">
            {t("app.portalLinks.title")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t("app.portalLinks.intro")}</p>
        <p className="text-xs text-muted-foreground mt-2">{t("app.portalLinks.rule", { days })}</p>

        {state === "loading" && (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> {t("app.portalLinks.loading")}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {state === "done" && result && (
          <div className="mt-5 rounded-lg border border-border p-4 text-sm" data-portal-links-result>
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Check size={16} /> {t("app.portalLinks.done", { sent: result.sent, total: result.attempted })}
            </p>
            {result.failed > 0 && <p className="mt-1 text-muted-foreground">{t("app.portalLinks.failedSome", { failed: result.failed })}</p>}
            {result.remaining > 0 && <p className="mt-1 text-muted-foreground">{t("app.portalLinks.remaining", { count: result.remaining })}</p>}
          </div>
        )}

        {state !== "loading" && state !== "done" && preview && (
          <>
            <p className="mt-5 text-base font-semibold text-foreground" data-portal-links-count>
              {count === 0
                ? t("app.portalLinks.none", { days })
                : count === 1
                  ? t("app.portalLinks.countOne")
                  : t("app.portalLinks.count", { count })}
            </p>
            {count > batch && <p className="text-xs text-muted-foreground mt-1">{t("app.portalLinks.batchNote", { batch })}</p>}

            {preview.recipients?.length > 0 && (
              <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-border rounded-lg border border-border text-sm">
                {preview.recipients.map((r) => (
                  <li key={r.id} className="px-3 py-2">
                    <span className="font-medium text-foreground">{r.name}</span>{" "}
                    <span className="text-muted-foreground">&lt;{r.email}&gt;</span>
                    <div className="text-xs text-muted-foreground">
                      {r.why
                        .map((w) =>
                          w.kind === "job"
                            ? t("app.portalLinks.why.job", { title: w.label })
                            : w.status === "accepted"
                              ? t("app.portalLinks.why.quoteAccepted", { number: w.label })
                              : t("app.portalLinks.why.quoteSent", { number: w.label }),
                        )
                        .join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {preview.recipients?.length < count && (
              <p className="text-xs text-muted-foreground mt-1">{t("app.portalLinks.more", { count: count - preview.recipients.length })}</p>
            )}

            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold">{t("app.portalLinks.skipped")}:</span>{" "}
              {SKIP_KEYS.map(([k, key]) => `${t(key, { days })} ${preview.skipped?.[k] ?? 0}`).join(" · ")}
            </div>

            {preview.sample && (
              <div className="mt-4">
                <button type="button" onClick={() => setShowEmail((v) => !v)} className="text-sm font-semibold text-foreground underline">
                  {t("app.portalLinks.previewFor", { name: preview.sample.name })}
                </button>
                {showEmail && (
                  <div className="mt-2 rounded-lg border border-border">
                    <div className="px-3 py-2 text-xs border-b border-border">
                      <span className="text-muted-foreground">{t("app.portalLinks.subject")}: </span>
                      <span className="text-foreground">{preview.sample.subject}</span>
                    </div>
                    {/* The rendered email, sandboxed: no scripts, no same-origin. */}
                    <iframe title={preview.sample.subject} sandbox="" srcDoc={preview.sample.html} className="w-full h-96 bg-white rounded-b-lg" />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="border border-border rounded-full px-4 py-2 text-sm font-semibold text-foreground">
                {t("app.action.cancel")}
              </button>
              {batch > 0 && (
                <button
                  type="button"
                  onClick={send}
                  disabled={state === "sending"}
                  className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  data-portal-links-confirm
                >
                  {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {state === "sending"
                    ? t("app.portalLinks.sending")
                    : batch === 1
                      ? t("app.portalLinks.confirmOne")
                      : t("app.portalLinks.confirm", { count: batch })}
                </button>
              )}
            </div>
          </>
        )}

        {state === "done" && (
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onClose} className="border border-border rounded-full px-4 py-2 text-sm font-semibold text-foreground">
              {t("app.action.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
