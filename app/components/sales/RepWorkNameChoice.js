"use client";

// app/components/sales/RepWorkNameChoice.js
//
// "The name prospects see" — the rep's own work name (SalesRep.workName).
//
// The owner, 2026-09-22: "Jesus… go as Daniel." Whatever is saved here signs
// the rep's outreach emails and texts, the intro email, calendar invites, the
// call script and voicemail lines, and their public demo page — every surface
// that reads lib/sales/repIdentity.js repPublicName. The rep's real name stays
// on FieldQuo's own screens and on pay records, and the explainer says so, so
// nobody sets a work name thinking their payout will be made out to it.
//
// An empty box is a real answer: it clears the work name and prospects see
// the rep's first name. The line under the field shows what they will see
// either way, from the server's answer — never computed here, so the screen
// cannot disagree with the signature that actually goes out.
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { validateWorkName } from "@/lib/sales/repIdentity";

export default function RepWorkNameChoice() {
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadFailedMessage = t("app.salesWorkName.loadFailed");

  // The read, with a `cancelled` flag so a card unmounted mid-request never
  // sets state — the shape app/sales/settings/page.js uses for /api/sales/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchJson("/api/sales/work-name");
        if (cancelled) return;
        setData(json);
        setValue(json.workName || "");
        setError("");
      } catch (err) {
        if (!cancelled) setError(err?.message || loadFailedMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFailedMessage]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    // The same validator the server runs, so the refusal is immediate and in
    // the rep's language; the server still judges it again.
    const check = validateWorkName(value);
    if (!check.ok) {
      setError(t("app.salesWorkName.invalid"));
      return;
    }
    setBusy(true);
    try {
      const json = await fetchJson("/api/sales/work-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workName: check.value }),
      });
      setData(json);
      setValue(json.workName || "");
      setSaved(true);
    } catch (err) {
      setError(
        String(err?.data?.code || "").startsWith("work_name_")
          ? t("app.salesWorkName.invalid")
          : err?.message || t("app.salesWorkName.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("app.salesWorkName.loading")}</p>;
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm text-foreground">{error || loadFailedMessage}</p>
      </div>
    );
  }

  const stored = data.workName || "";
  const dirty = value.replace(/\s+/g, " ").trim() !== stored;

  return (
    <form onSubmit={save} className="space-y-4" data-rep-work-name>
      <div className="flex gap-2">
        <UserRound size={16} className="shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{t("app.salesWorkName.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.salesWorkName.explainer")}</p>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{t("app.salesWorkName.label")}</span>
        <input
          type="text"
          name="workName"
          value={value}
          maxLength={60}
          autoComplete="off"
          placeholder={t("app.salesWorkName.placeholder")}
          onChange={(e) => {
            setSaved(false);
            setValue(e.target.value);
          }}
          className="w-full sm:max-w-xs min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        />
      </label>

      <p className="text-sm text-foreground break-words">
        {t("app.salesWorkName.shownAs", { name: data.publicName || "—" })}
        {!data.workName ? <span className="text-muted-foreground"> {t("app.salesWorkName.fallbackNote")}</span> : null}
      </p>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 break-words" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="inline-flex items-center min-h-[44px] rounded-full bg-primary text-primary-foreground px-5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? t("app.salesWorkName.saving") : t("app.salesWorkName.save")}
        </button>
        {saved && !dirty ? <span className="text-sm text-muted-foreground">{t("app.salesWorkName.saved")}</span> : null}
      </div>
    </form>
  );
}
