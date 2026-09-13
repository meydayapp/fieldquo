"use client";

// app/components/hr/TaxFormScreen.js
//
// /app/me/tax-forms?kind=td1_federal — the TD1 / W-4 questions on a phone.
// The field list is lib/hr/taxForms.js's, so the screen and the PDF agree
// by construction. The two sentences a new hire needs to read are on the
// screen, not in a tooltip: nothing is filed with any government, and the
// SIN / SSN is written on the printed sheet by hand, never typed here.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileSpreadsheet, Download } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import ListState from "@/app/components/ListState";
import { td1TotalClaim } from "@/lib/hr/taxForms";

const inputClass = "w-full border border-border rounded-lg px-3 py-2 bg-card min-h-[44px] text-sm";

export default function TaxFormScreen() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const search = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [kind, setKind] = useState(search?.get("kind") || "");
  const [values, setValues] = useState({});
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState(null);
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/me/tax-forms");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data && !kind && data.kinds?.length) setKind(data.kinds[0]);
  }, [data, kind]);

  const fields = data?.fields?.[kind] || [];
  const groups = [];
  for (const f of fields) {
    let g = groups.find((x) => x.key === f.group);
    if (!g) groups.push((g = { key: f.group, fields: [] }));
    g.fields.push(f);
  }
  const total = kind.startsWith("td1") ? td1TotalClaim(values) : null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrorField(null);
    try {
      const res = await fetchJson("/api/hr/me/tax-forms", { method: "POST", body: { formKind: kind, fields: values, signatureName: signature } });
      setDone(res.submission);
      setValues({});
      setSignature("");
      await load();
    } catch (err) {
      setError(errorText(t, err));
      setErrorField(err?.data?.field || null);
    } finally {
      setBusy(false);
    }
  }

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4" data-hr-tax-form>
      <p className="text-sm rounded-lg border border-border bg-muted px-4 py-3 text-foreground" data-hr-tax-notice>
        {t("app.hr.tax.notice")}
      </p>

      <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && (data.kinds || []).length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.tax.noneForCountry")}</p>}>
        {data && (
          <>
            {data.kinds.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {data.kinds.map((k) => (
                  <button key={k} type="button" onClick={() => { setKind(k); setDone(null); router.replace(`/app/me/tax-forms?kind=${k}`); }} className={`text-sm rounded-full border px-4 py-2 min-h-[44px] ${kind === k ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {t(`app.hr.tax.form.${k}`)}
                  </button>
                ))}
              </div>
            )}

            {done ? (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-hr-tax-done>
                <p className="text-sm font-semibold text-foreground">{t("app.hr.tax.submitted", { date: formatDate(done.submittedAt) })}</p>
                <p className="text-sm text-muted-foreground">{t("app.hr.tax.submittedHint")}</p>
                <a href={`/api/hr/tax-forms/${done.id}/pdf`} className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]">
                  <Download size={14} /> {t("app.hr.tax.download")}
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-5">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <FileSpreadsheet size={16} /> {t(`app.hr.tax.form.${kind}`)}
                </h2>
                {groups.map((g) => (
                  <fieldset key={g.key} className="space-y-3">
                    <legend className="text-sm font-semibold text-foreground mb-1">{t(`app.hr.tax.group.${g.key}`)}</legend>
                    {g.key === "identity" && <p className="text-xs text-muted-foreground">{kind === "w4" ? t("app.hr.tax.noSsn") : t("app.hr.tax.noSin")}</p>}
                    {g.key === "claims" && kind.startsWith("td1") && <p className="text-xs text-muted-foreground">{t("app.hr.tax.claimsHint")}</p>}
                    {g.fields.map((f) => {
                      const label = t(`app.hr.tax.field.${f.key}`);
                      const bad = errorField === f.key;
                      if (f.type === "bool") {
                        return (
                          <label key={f.key} className="flex items-start gap-3 text-sm min-h-[44px]">
                            <input type="checkbox" className="mt-1" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                            <span>{label}</span>
                          </label>
                        );
                      }
                      if (f.type === "select") {
                        return (
                          <label key={f.key} className="block text-sm">
                            <span className="block text-xs font-medium text-muted-foreground mb-1">{label}{f.required ? " *" : ""}</span>
                            <select value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} required={f.required} className={inputClass}>
                              <option value="">—</option>
                              {f.options.map((o) => (
                                <option key={o} value={o}>
                                  {f.key === "filingStatus" ? t(`app.hr.tax.filing.${o}`) : o}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }
                      return (
                        <label key={f.key} className="block text-sm">
                          <span className={`block text-xs font-medium mb-1 ${bad ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>{label}{f.required ? " *" : ""}</span>
                          <input
                            type={f.type === "date" ? "date" : f.type === "money" ? "number" : "text"}
                            inputMode={f.type === "money" ? "decimal" : undefined}
                            step={f.type === "money" ? "0.01" : undefined}
                            min={f.type === "money" ? "0" : undefined}
                            value={values[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            required={f.required}
                            className={inputClass}
                          />
                        </label>
                      );
                    })}
                    {g.key === "claims" && kind.startsWith("td1") && (
                      <p className="text-sm font-semibold text-foreground">{t("app.hr.tax.totalClaim")}: {total == null ? "—" : total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    )}
                  </fieldset>
                ))}
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-sm">{t("app.hr.tax.signStatement")}</p>
                  <input value={signature} onChange={(e) => setSignature(e.target.value)} required placeholder={t("app.hr.policies.typeName")} className={`${inputClass} max-w-sm`} autoComplete="name" />
                </div>
                {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                <button type="submit" disabled={busy} className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold min-h-[44px] disabled:opacity-60" data-hr-tax-submit>
                  {busy ? t("app.hr.tax.submitting") : t("app.hr.tax.submit")}
                </button>
              </form>
            )}

            {data.submissions.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-2">{t("app.hr.tax.previous")}</h3>
                <ul className="divide-y divide-border">
                  {data.submissions.map((s) => (
                    <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <span>
                        {t(`app.hr.tax.form.${s.formKind}`)} · {s.taxYear} · {formatDate(s.submittedAt)}
                      </span>
                      <a href={`/api/hr/tax-forms/${s.id}/pdf`} className="inline-flex items-center gap-1 text-xs border border-border rounded-full px-3 py-1.5 min-h-[36px]">
                        <Download size={12} /> PDF
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </ListState>
    </div>
  );
}
