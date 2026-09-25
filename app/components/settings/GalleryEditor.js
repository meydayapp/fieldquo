// app/components/settings/GalleryEditor.js
//
// The company's ONE before/after gallery — the pairs the website block, the
// quote email and the client proposal all show (lib/company/gallery.js).
// Rendered by Settings › Presentation and by the home page's "Upload before
// & after photos" set-up dialog; the same component, not a copy.
//
// A list with no single Save: every completed pair, caption edit or removal
// PUTs the whole list (onChanged). A pair is only stored once BOTH photos
// exist; until then it is the company's one gallery DRAFT, stored apart from
// the pairs clients see, with its own Discard — see PairPhotoFields.js NewPair.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";
import { PhotoSlot, Field, NewPair } from "@/app/components/settings/PairPhotoFields";

const CAPABILITY = "user:manage";

export default function GalleryEditor({ compact = false, onChanged }) {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canEdit = access.canChange(CAPABILITY);
  const [pairs, setPairs] = useState(null);
  const [draft, setDraft] = useState(undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings/gallery")
      .then((d) => {
        setDraft(d.draft || null);
        setPairs(d.pairs || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const save = useCallback(
    // Resolves true when stored, false when not — NewPair keeps its draft on
    // false. `extra` rides in the same request ({ draft: null } when a pair is
    // completed, so the pair and the cleared draft land together).
    async (next, extra = {}) => {
      setSaving(true);
      setError("");
      try {
        const d = await fetchJson("/api/settings/gallery", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pairs: next, ...extra }),
        });
        setPairs(d.pairs || []);
        onChanged?.();
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onChanged],
  );

  if (error && pairs === null) return <p className="text-sm text-red-600">{error}</p>;
  if (pairs === null) return <div className="h-40 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  return (
    <div className="space-y-3">
      {!compact && !canEdit && <ReadOnlyNotice capability={CAPABILITY} />}
      <p className="text-xs text-muted-foreground">
        {t("app.presentation.gallery.hint", "One gallery for everything: these pairs appear on your website's Before & after section, in your quote emails (the first four), and under “Before & after” on every client proposal.")}
      </p>
      {pairs.map((p, i) => (
        <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex gap-3">
            <PhotoSlot
              url={p.beforeUrl}
              label={t("app.setQuoteEmail.before")}
              disabled={!canEdit || saving}
              onError={setError}
              onUploaded={({ url, publicId }) => save(pairs.map((x, j) => (j === i ? { ...x, beforeUrl: url, beforePublicId: publicId } : x)))}
            />
            <PhotoSlot
              url={p.afterUrl}
              label={t("app.setQuoteEmail.after")}
              disabled={!canEdit || saving}
              onError={setError}
              onUploaded={({ url, publicId }) => save(pairs.map((x, j) => (j === i ? { ...x, afterUrl: url, afterPublicId: publicId } : x)))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Field
              value={p.caption || ""}
              disabled={!canEdit || saving}
              placeholder={t("app.setQuoteEmail.caption")}
              onCommit={(caption) => save(pairs.map((x, j) => (j === i ? { ...x, caption } : x)))}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => save(pairs.filter((_, j) => j !== i))}
                disabled={saving}
                aria-label={t("app.setQuoteEmail.remove")}
                className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50 min-h-11 min-w-11 flex items-center justify-center shrink-0"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
      {canEdit && (
        <NewPair
          disabled={saving}
          onError={setError}
          initialDraft={draft}
          onComplete={async (pair) => ((await save([...pairs, pair], { draft: null })) ? "cleared" : false)}
          t={t}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {t("app.setQuoteEmail.saving")}
        </div>
      )}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {t("app.presentation.gallery.websiteNote", "Photos crews took on jobs can be paired from your website builder too:")}{" "}
          <Link href="/app/settings/website" className="underline underline-offset-2 text-foreground">
            {t("app.settings.website", "Your website")}
          </Link>
        </p>
      )}
    </div>
  );
}
