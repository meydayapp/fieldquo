// app/components/settings/StoryEditor.js
//
// "Add your company story" — the About us section of every client proposal:
// a headline, the story, an optional team photo and an optional video link.
// Rendered by Settings › Presentation and, unchanged, by the home page's
// set-up dialog (stepPanels.js) — the same form, never a copy.
//
// Saves as a whole (onSaved): PATCH /api/settings/presentation.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { uploadFile } from "@/lib/media/uploadClient";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { ReadOnlyNotice } from "@/app/components/settings/PermissionNotice";
import AutoTranslateBanner from "@/app/components/settings/AutoTranslateBanner";

const CAPABILITY = "user:manage";

export default function StoryEditor({ compact = false, onSaved }) {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canEdit = access.canChange(CAPABILITY);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchJson("/api/settings/presentation")
      .then((d) =>
        setData({
          storyHeadline: d.storyHeadline || "",
          story: d.story || "",
          storyVideoUrl: d.storyVideoUrl || "",
          teamPhotoUrl: d.teamPhotoUrl || "",
        }),
      )
      .catch((err) => setError(err.message));
  }, []);

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const up = await uploadFile(file, { purpose: "website" });
      setData((d) => ({ ...d, teamPhotoUrl: up.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e?.preventDefault();
    if (!data) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const answer = await fetchJson("/api/settings/presentation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setAutoTranslate(answer?.autoTranslate || null);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <div className="h-40 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  return (
    <form onSubmit={save} className="space-y-4">
      {!compact && !canEdit && <ReadOnlyNotice capability={CAPABILITY} />}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1" htmlFor="story-headline">
          {t("app.presentation.story.headline", "Headline")}
        </label>
        <input
          id="story-headline"
          value={data.storyHeadline}
          disabled={!canEdit}
          maxLength={160}
          onChange={(e) => setData({ ...data, storyHeadline: e.target.value })}
          placeholder={t("app.presentation.story.headlinePlaceholder", "Two brothers, one van, eleven years")}
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground disabled:opacity-60"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1" htmlFor="story-text">
          {t("app.presentation.story.text", "Your story")}
        </label>
        <textarea
          id="story-text"
          value={data.story}
          disabled={!canEdit}
          rows={5}
          maxLength={4000}
          onChange={(e) => setData({ ...data, story: e.target.value })}
          placeholder={t("app.presentation.story.textPlaceholder", "Who you are, how long you've been at it, and what a client can expect on the day.")}
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground disabled:opacity-60"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.presentation.story.hint", "Shown under “About us” on every quote, in the words you write here. Leave it empty and the section is left out.")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="block text-sm font-medium text-foreground mb-1">
            {t("app.presentation.story.teamPhoto", "Team photo (optional)")}
          </span>
          <div className="flex items-start gap-3">
            <button
              type="button"
              disabled={!canEdit || uploading}
              onClick={() => fileRef.current?.click()}
              className="w-36 aspect-[4/3] rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              ) : data.teamPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.teamPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Upload size={13} /> {t("app.presentation.story.upload", "Upload")}
                </span>
              )}
            </button>
            {data.teamPhotoUrl && canEdit && (
              <button
                type="button"
                onClick={() => setData({ ...data, teamPhotoUrl: "" })}
                className="p-1.5 text-muted-foreground hover:text-red-600 min-h-9 min-w-9"
                aria-label={t("app.action.remove", "Remove")}
              >
                <X size={15} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1" htmlFor="story-video">
            {t("app.presentation.story.video", "Intro video link (optional)")}
          </label>
          <input
            id="story-video"
            type="url"
            value={data.storyVideoUrl}
            disabled={!canEdit}
            onChange={(e) => setData({ ...data, storyVideoUrl: e.target.value })}
            placeholder="https://youtu.be/…"
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground disabled:opacity-60"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold min-h-11 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t("app.action.save", "Save")}
          </button>
          {saved && <span className="text-sm text-emerald-600">{t("app.action.saved", "Saved")}</span>}
        </div>
      )}
      <AutoTranslateBanner result={autoTranslate} />
    </form>
  );
}
