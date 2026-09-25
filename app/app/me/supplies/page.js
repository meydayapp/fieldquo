"use client";

// app/app/me/supplies/page.js
//
// Request a supply — the crew's phone form, and their own requests below it.
//
// A crew member at a house with two rolls of tape left had no button that
// told the office. This is the button. It goes to whoever holds purchasing
// (the "supply requested" notification), and the requester is told when it
// is ordered and when it is in the van — the two answers the row below the
// form shows as well.
//
// Item from the company's stock list (with what is on the shelf and the
// reorder level, so "we're low" is a number) or free text; how many; which
// job (the same chooser the time clock offers); needed by; a photo; a note.
// One column, big targets, inputs at 16px so iOS does not zoom.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { formatShortDate } from "@/lib/format/localeDate";
import MediaUploader from "@/app/components/MediaUploader";
import MeShell from "@/app/components/me/MeShell";
import { Action, Card, CardTitle, EmptyNote, MeLoad, useMeData } from "@/app/components/me/bits";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base";

const STATUS_TONE = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  ordered: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  restocked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function MeSuppliesPage() {
  return (
    <Suspense fallback={null}>
      <MeSupplies />
    </Suspense>
  );
}

function MeSupplies() {
  const { t, language } = useTranslation();
  const params = useSearchParams();
  const presetJobId = params?.get("jobId") || "";
  const options = useMeData("/api/supply-requests/options");
  const mine = useMeData("/api/supply-requests");
  const [draft, setDraft] = useState({
    materialId: "",
    itemName: "",
    quantity: "",
    unit: "",
    jobId: "",
    neededBy: "",
    photoUrl: "",
    note: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  const setJobFromPreset = useCallback(() => {
    if (presetJobId) setDraft((d) => (d.jobId ? d : { ...d, jobId: presetJobId }));
  }, [presetJobId]);
  useEffect(() => {
    setJobFromPreset();
  }, [setJobFromPreset]);

  const materials = options.data?.materials || [];
  const jobs = options.data?.jobs || [];
  const picked = materials.find((m) => m.id === draft.materialId) || null;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSent("");
    setSending(true);
    try {
      await fetchJson("/api/supply-requests", {
        method: "POST",
        body: {
          materialId: draft.materialId || null,
          itemName: draft.itemName,
          quantity: draft.quantity,
          unit: draft.unit || picked?.unit || null,
          jobId: draft.jobId || null,
          neededBy: draft.neededBy || null,
          photoUrl: draft.photoUrl || null,
          note: draft.note,
        },
      });
      setSent(t("app.supplies.sent", "Sent to the office. You'll hear when it's ordered and when it's in the van."));
      setDraft((d) => ({ ...d, materialId: "", itemName: "", quantity: "", unit: "", neededBy: "", photoUrl: "", note: "" }));
      mine.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const canSend = String(draft.quantity).trim() && (draft.materialId || draft.itemName.trim());

  return (
    <MeShell title={t("app.supplies.title", "Request a supply")}>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {t("app.supplies.subtitle", "Goes to the office. You'll get a notification when it's ordered and when it's in the van.")}
      </p>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t("app.supplies.item", "Item")}
          <select
            value={draft.materialId}
            onChange={(e) => {
              const m = materials.find((x) => x.id === e.target.value);
              setDraft((d) => ({ ...d, materialId: e.target.value, unit: m?.unit || "" }));
            }}
            className={inputClass}
          >
            <option value="">{t("app.supplies.itemFreeText", "Something else — type it below")}</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {picked ? (
          <p className="text-xs text-muted-foreground">
            {picked.level === null
              ? t("app.supplies.fromStockNoLevel", "From your stock list")
              : picked.threshold === null
                ? t("app.supplies.fromStockLevel", "From your stock list · {level} on the shelf", { level: String(picked.level) })
                : t("app.supplies.fromStockLevelThreshold", "From your stock list · {level} on the shelf · reorder at {threshold}", {
                    level: String(picked.level),
                    threshold: String(picked.threshold),
                  })}
          </p>
        ) : (
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("app.supplies.itemName", "What do you need?")}
            <input
              value={draft.itemName}
              onChange={(e) => setDraft((d) => ({ ...d, itemName: e.target.value }))}
              placeholder={t("app.supplies.itemPlaceholder", "Painter's tape 1½\"")}
              className={inputClass}
            />
          </label>
        )}

        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("app.supplies.howMany", "How many")}
            <input
              inputMode="decimal"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t("app.supplies.unit", "Unit")}
            <input
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              placeholder={picked?.unit || t("app.supplies.unitPlaceholder", "rolls")}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-muted-foreground">
          {t("app.supplies.forJob", "For which job")}
          <select value={draft.jobId} onChange={(e) => setDraft((d) => ({ ...d, jobId: e.target.value }))} className={inputClass}>
            <option value="">{t("app.supplies.forStock", "Stock — no particular job")}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {[j.title, j.client].filter(Boolean).join(" — ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-muted-foreground">
          {t("app.supplies.neededBy", "Needed by")}
          <input
            type="date"
            value={draft.neededBy}
            onChange={(e) => setDraft((d) => ({ ...d, neededBy: e.target.value }))}
            className={inputClass}
          />
        </label>

        <div>
          <span className="block text-xs font-semibold text-muted-foreground">{t("app.supplies.photo", "Photo (optional)")}</span>
          <div className="mt-1 flex items-center gap-2">
            {draft.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.photoUrl} alt="" className="h-14 w-16 rounded border border-border object-cover" />
            )}
            <MediaUploader
              uploadUrl="/api/upload" purpose="jobs"
              value={[]}
              max={1}
              label={t("app.supplies.addPhoto", "+ add")}
              hint=""
              onChange={(added) => {
                const photo = (added || []).find((m) => m?.url && m.kind === "photo");
                if (photo) setDraft((d) => ({ ...d, photoUrl: photo.url }));
              }}
            />
          </div>
        </div>

        <label className="block text-xs font-semibold text-muted-foreground">
          {t("app.supplies.note", "Note")}
          <textarea
            rows={2}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder={t("app.supplies.notePlaceholder", "Down to the last roll and a half — trim taping is tomorrow.")}
            className={inputClass}
          />
        </label>

        <Action type="submit" disabled={sending || !canSend} className="w-full justify-center py-3">
          {sending ? t("app.supplies.sending", "Sending…") : t("app.supplies.send", "Send request")}
        </Action>
        {sent && <p className="text-sm text-emerald-700 dark:text-emerald-400">{sent}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>

      <div className="mt-6">
        <Card>
          <CardTitle>{t("app.supplies.mine", "Your requests")}</CardTitle>
          <MeLoad loading={mine.loading} errorKey={mine.errorKey} reload={mine.reload}>
            {mine.data?.requests?.length ? (
              <ul className="divide-y divide-border">
                {mine.data.requests.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {r.itemName} <span className="text-muted-foreground">· {r.quantity} {r.unit || ""}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[r.jobTitle, r.createdAt ? formatShortDate(r.createdAt, language) : null].filter(Boolean).join(" · ")}
                      </p>
                      {r.status === "restocked" && r.restockNote && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{r.restockNote}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status] || ""}`}>
                      {t(`app.supplies.status.${r.status}`, r.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>{t("app.supplies.none", "Nothing asked for yet.")}</EmptyNote>
            )}
          </MeLoad>
        </Card>
      </div>
    </MeShell>
  );
}
