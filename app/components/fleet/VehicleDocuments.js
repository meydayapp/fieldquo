"use client";

// app/components/fleet/VehicleDocuments.js
//
// The paperwork on one van: registration, insurance policy, bill of sale, a
// photo.
//
// ══ Upload goes through the existing route, twice on purpose ═══════════════
//
// The file goes to /api/upload (signed, authenticated, size- and type-capped),
// which answers with a Cloudinary URL; that URL is then POSTed to the fleet
// documents route to become a row. Two round trips rather than one, because
// AGENTS.md is explicit that a second upload path is not to be added, and
// because the server refuses a URL that did not come from its own cloud.
//
// ══ Filing a policy can move the renewal date above ════════════════════════
//
// An insurance or registration document with an expiry date updates the
// van's own expiry column (lib/fleet/documents.js says which wins). That
// changes the badge on the card and the due list at the top of the screen,
// so the response carries the whole fleet and this component hands it up —
// and says out loud that the date moved, because it moved on a different part
// of the screen from where the person was looking.

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { CLIENT_MEDIA_ACCEPT } from "@/lib/media/validate";
import { formatBytes } from "@/lib/jobs/documents";
import {
  EXPIRY_COLUMN_BY_KIND,
  VEHICLE_DOCUMENT_KINDS,
  VEHICLE_MONEY_KINDS,
} from "@/lib/fleet/documents";
import ListState from "@/app/components/ListState";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10";

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function VehicleDocuments({
  vehicleId,
  data,
  loading,
  errorKey,
  onRetry,
  onChanged,
}) {
  const { t, language } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("registration");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The bill of sale is the price, and the picker must not offer a kind whose
  // POST would answer 403 — see VEHICLE_MONEY_KINDS in lib/fleet/documents.js.
  const kinds = data?.canSeeCost
    ? VEHICLE_DOCUMENT_KINDS
    : VEHICLE_DOCUMENT_KINDS.filter((k) => !VEHICLE_MONEY_KINDS.has(k));
  const datedKind = !!EXPIRY_COLUMN_BY_KIND[kind];

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!file || !file.size) return;

    setBusy(true);
    try {
      // 1 — the existing uploader.
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/upload", { method: "POST", body: upload });
      if (!uploaded.ok) {
        const message = await reportResponseError(
          uploaded,
          t("app.fleet.docUploadFailed", "Couldn't upload that file."),
        );
        setError(message || t("app.fleet.docUploadFailed", "Couldn't upload that file."));
        return;
      }
      const { url, filename } = await uploaded.json();

      // 2 — file it.
      const res = await fetch(`/api/fleet/${vehicleId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim() || filename || file.name,
          kind,
          url,
          sizeBytes: file.size,
          mimeType: file.type || null,
          // Blank stays blank: a policy filed without a date says nothing
          // about the renewal column.
          expiresAt: datedKind && expiresAt ? expiresAt : null,
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.fleet.docFileFailed", "Couldn't file that document."),
        );
        setError(message || t("app.fleet.docFileFailed", "Couldn't file that document."));
        return;
      }
      const payload = await res.json();
      setAdding(false);
      setExpiresAt("");
      if (payload?.expiryUpdated) {
        setNotice(
          t(
            "app.fleet.docExpiryMoved",
            "The renewal date above was updated to match this document.",
          ),
        );
      }
      await onChanged?.(payload);
    } finally {
      setBusy(false);
    }
  }

  const documents = data?.documents || [];

  return (
    <div className="mt-2 space-y-3">
      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!data && documents.length === 0}
        onRetry={onRetry}
        skeleton={<div className="h-10 bg-accent rounded-lg animate-pulse" />}
        empty={
          <p className="text-xs text-muted-foreground">
            {t(
              "app.fleet.noDocuments",
              "Nothing filed yet — registration, insurance, bill of sale.",
            )}
          </p>
        }
      >
        <ul className="space-y-1.5">
          {documents.map((doc) => {
            const size = formatBytes(doc.sizeBytes);
            return (
              <li key={doc.id} className="text-xs">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline break-words"
                >
                  {doc.name}
                </a>
                <span className="text-muted-foreground">
                  {" · "}
                  {t(`app.fleet.docKind.${doc.kind}`, doc.kind)}
                  {" · "}
                  {formatDate(doc.uploadedAt, language)}
                  {/* Null sizeBytes prints nothing — "0 bytes" reads as a
                      failed upload (lib/jobs/documents.js formatBytes). */}
                  {size ? ` · ${size}` : ""}
                  {doc.expiresAt
                    ? ` · ${t("app.fleet.docExpires", "Expires {date}", {
                        date: formatDate(doc.expiresAt, language),
                      })}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </ListState>

      {/* "Nothing here" and "something here you may not see" are different
          statements. */}
      {data?.hiddenCount > 0 && (
        <p className="text-xs italic text-muted-foreground">
          {t("app.fleet.docHidden", "{count} more hidden by your access level", {
            count: data.hiddenCount,
          })}
        </p>
      )}

      {notice && <p className="text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {/* Drawn only when the POST would succeed — the server decided
          (canUpload), so the button and the gate cannot disagree. */}
      {data?.canUpload &&
        (adding ? (
          <form onSubmit={submit} className="space-y-2.5 border border-border rounded-lg p-3">
            <input
              type="file"
              name="file"
              required
              accept={CLIENT_MEDIA_ACCEPT}
              className="block w-full text-sm text-foreground file:mr-3 file:min-h-[44px] file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:text-sm file:font-semibold"
            />
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label={t("app.fleet.docKindLabel", "Document type")}
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`app.fleet.docKind.${k}`, k)}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="name"
              className={inputClass}
              placeholder={t("app.fleet.docNamePlaceholder", "What is it? (optional)")}
            />
            {datedKind && (
              <label className="block text-xs text-muted-foreground">
                {t("app.fleet.docExpiresLabel", "Expires on — leave blank if the paper doesn't say")}
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 min-h-[44px]"
              >
                {busy
                  ? t("app.fleet.docUploading", "Uploading…")
                  : t("app.fleet.docUpload", "Upload")}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="px-4 rounded-lg border border-border text-sm font-semibold min-h-[44px]"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
          >
            <Plus size={13} /> {t("app.fleet.addDocument", "Add a document")}
          </button>
        ))}
    </div>
  );
}
