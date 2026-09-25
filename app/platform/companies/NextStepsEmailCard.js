// app/platform/companies/NextStepsEmailCard.js
//
// The "next steps" letter's switch and delay, on the Companies screen —
// the one console screen about real customers rather than signups that
// stopped. lib/signup/nextSteps.js says what the letter is; the route
// (/api/platform/onboarding-email) reads for every admin and writes for a
// superadmin, and this card draws the editor only for the role the route
// will accept (scripts/check-platform-truth.mjs's rule: never a control the
// API refuses after the click).
//
// The whole post-signup sequence is stated here in words, with this
// letter's place in it, so the delay is read where somebody can change it
// rather than only in a source comment. docs/ONBOARDING-EMAILS.md is the
// long form.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import { LANGUAGES } from "@/app/i18n/languages";

export default function NextStepsEmailCard() {
  const { isSuperadmin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | failed
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState("2");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  // The sample: one copy of the real letter, built from a company's checklist
  // as it stands, sent by the real path (Resend live, the discovered sender)
  // to the calling superadmin's OWN address and nobody else's.
  const [sampleCompanyId, setSampleCompanyId] = useState("");
  const [sampleLanguage, setSampleLanguage] = useState("");
  const [sampling, setSampling] = useState(false);
  const [sample, setSample] = useState(null);
  const [sampleError, setSampleError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetchJson("/api/platform/onboarding-email");
      setData(res);
      setEnabled(Boolean(res.settings?.enabled));
      setDelay(String(res.settings?.delayHours ?? 2));
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Could not load the next-steps email settings.");
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved("");
    setError("");
    try {
      const res = await fetchJson("/api/platform/onboarding-email", {
        method: "PUT",
        body: { enabled, delayHours: Number(delay) },
      });
      setData(res);
      setEnabled(Boolean(res.settings?.enabled));
      setDelay(String(res.settings?.delayHours ?? 2));
      setSaved(`Saved — ${res.settings.enabled ? `on, ${res.settings.delayHours} h after signup` : "off"}.`);
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function sendSample(e) {
    e.preventDefault();
    setSampling(true);
    setSample(null);
    setSampleError("");
    try {
      const res = await fetchJson("/api/platform/onboarding-email", {
        method: "POST",
        body: { companyId: sampleCompanyId.trim() || undefined, language: sampleLanguage || undefined },
      });
      setSample(res);
    } catch (err) {
      setSampleError(err.message || "Could not send the sample.");
    } finally {
      setSampling(false);
    }
  }

  const s = data?.settings;
  const bounds = data?.bounds;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <Mail size={18} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">Next-steps email</h2>
          <p className="text-xs text-muted-foreground mt-1">
            What a new company hears from FieldQuo after it signs up — no card needed since 2026-09-24: if the
            onboarding checklist is still open, one &ldquo;finish setting up&rdquo; letter listing the steps left and
            the additional set-up steps still on their home page, in the company&apos;s language, each a link to that
            step, with the date their free month ends. Card-free trials and card-backed signups alike. Sent once per
            company, never to a demo or an address on the do-not-contact list, and never once the delay is more than{" "}
            {bounds?.windowHours ?? 72} h behind.
          </p>

          {status === "loading" && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </p>
          )}
          {status === "failed" && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-3">
              {error}{" "}
              <button type="button" onClick={load} className="underline underline-offset-2">
                Retry
              </button>
            </p>
          )}

          {status === "ready" && s && (
            <>
              <p className="text-sm text-foreground mt-3">
                Currently <strong>{s.enabled ? "on" : "off"}</strong>
                {s.enabled ? `, ${s.delayHours} h after signup` : ""}.
                {typeof data.sentCount === "number" ? ` ${data.sentCount} sent so far.` : ""}
              </p>

              {isSuperadmin ? (
                <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-foreground min-h-11">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Send the next-steps email
                  </label>
                  <label className="text-sm text-foreground">
                    <span className="block text-xs text-muted-foreground mb-1">Hours after signup</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={bounds?.min ?? 1}
                      max={bounds?.max ?? 72}
                      step="0.25"
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                      disabled={!enabled}
                      className="w-28 border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-60"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold min-h-11 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {saved && <span className="text-sm text-green-700 dark:text-green-300">{saved}</span>}
                  {error && <span className="text-sm text-red-700 dark:text-red-300">{error}</span>}
                </form>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">Only a superadmin can change this.</p>
              )}

              {isSuperadmin && (
                <form onSubmit={sendSample} className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Email yourself a sample — the real letter, built from a company&apos;s checklist as it stands and
                    sent by the real path, to your own address only. Marks nothing on the company. Leave the id blank
                    for the first demo company.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm text-foreground">
                      <span className="block text-xs text-muted-foreground mb-1">Company id (optional)</span>
                      <input
                        type="text"
                        value={sampleCompanyId}
                        onChange={(e) => setSampleCompanyId(e.target.value)}
                        placeholder="first demo company"
                        className="w-64 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                      />
                    </label>
                    <label className="text-sm text-foreground">
                      <span className="block text-xs text-muted-foreground mb-1">Language</span>
                      <select
                        value={sampleLanguage}
                        onChange={(e) => setSampleLanguage(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 bg-background text-foreground min-h-11"
                      >
                        <option value="">The company&apos;s own</option>
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.nativeName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={sampling}
                      className="border border-border px-4 py-2 rounded-lg text-sm font-semibold text-foreground hover:bg-muted min-h-11 disabled:opacity-60"
                    >
                      {sampling ? "Sending…" : "Email me a sample"}
                    </button>
                  </div>
                  {sample?.sent && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                      Sent to {sample.to} from {sample.from} — built from {sample.company?.name}
                      {sample.company?.isDemo ? " (demo)" : ""}, {sample.language.toUpperCase()}, subject &ldquo;{sample.subject}&rdquo;,
                      {" "}{sample.open?.length} open step{sample.open?.length === 1 ? "" : "s"}
                      {`, ${sample.more?.length ?? 0} additional set-up step${sample.more?.length === 1 ? "" : "s"} listed`}
                      {sample.trialLine ? ", with the trial line" : ", no trial line (not on a card-free trial)"}
                      {sample.proof ? `, social proof from ${sample.proof.companies} companies` : ", no social-proof sentence (sample too small)"}.
                    </p>
                  )}
                  {sampleError && <p className="text-sm text-red-700 dark:text-red-300 mt-2">{sampleError}</p>}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
