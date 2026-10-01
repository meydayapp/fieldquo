"use client";

// app/app/marketing/designer/video/[id]/page.js
//
// One video post: its shape, cover and caption, its approval, and posting it
// as an Instagram Reel, a Facebook Page Reel and a TikTok video — one tick box
// each, each only when that account is connected. Upload + caption + approve
// + publish; no in-video editing (owner-approved scope, 2026-09-29). Every
// rule it shows comes from lib/marketing/videoPost.js, the same function the
// server runs again before anything is sent.
//
// ── While the clip is on its way in ───────────────────────────────────────
//
// The clip is converted by Cloudinary as it arrives (1080p, 9:16 when chosen,
// trimmed at 2:30). Until Cloudinary says it's done the screen shows only
// that, and asks again every few seconds (the server looks at Cloudinary
// itself when the upload notification hasn't come).
//
// ── The shape is chosen, never assumed ────────────────────────────────────
//
// Reels and TikTok are 9:16. A clip that was made 9:16 on upload says how. A
// clip whose shape the browser couldn't read, and turns out not to be 9:16,
// cannot be posted until the person picks "Fit to 9:16 (adds bars)" or "Crop
// to 9:16" and has seen the prepared MP4.
//
// ── Approval, then the tick boxes ─────────────────────────────────────────
//
// The same approval as a design (owner, 2026-09-29): nothing posts until it
// is approved, and changing the caption, cover or shape withdraws it. Each
// destination is its own tick box; one the clip itself cannot go to (a clip
// over 90 s for a Facebook Reel) is greyed out with the reason while the
// others stay available.
//
// ── Read-only under a support session ─────────────────────────────────────
//
// Middleware already refuses every write; the controls are disabled as well
// so nothing looks pressable that cannot work.
//
// ── Archived ──────────────────────────────────────────────────────────────
//
// 30 days after a video finished posting, its file moves from Cloudinary to
// the archive (lib/marketing/videoArchive.js). The post stays here with what
// it was sent to; nothing that needs the file (the player, the cover, the
// tick boxes) is shown. "Restore to post again" appears only when restoring
// can actually run, and says before it is pressed that it counts as one of
// this month's videos.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, ArrowLeft, BadgeCheck, Check, Clock, Film, ImagePlus, Loader2, Lock, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { formatArchiveBytes } from "@/lib/marketing/videoArchive";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useImpersonation } from "@/app/hooks/useImpersonation";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { uploadFile } from "@/lib/media/uploadClient";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";
import { TIKTOK_SETTINGS_PATH } from "@/lib/tiktok/settingsPath";
import { VIDEO_CAPTION_MAX, checkForPlatform, destinationState, isNineBySixteen } from "@/lib/marketing/videoPost";
import TikTokPublishModal from "@/app/components/designer/TikTokPublishModal";
import { VideoAllowanceLine } from "@/app/components/designer/VideoAllowance";

const RENDITION_POLL_MS = 5000;
const RENDITION_POLL_MAX = 60; // five minutes
const ARRIVAL_POLL_MS = 5000;
const ARRIVAL_POLL_MAX = 720; // an hour — a large 4K clip converts for a while
const PUBLISH_POLL_MS = 6000;
const PUBLISH_POLL_MAX = 50; // five minutes; Meta keeps going after that and the next read records it

// Every code the server or checkForPlatform can answer with has a sentence
// under app.videoPost.error.*; anything else is quoted, never hidden.
const KNOWN = new Set([
  "not_vertical", "too_short", "too_long", "too_wide", "too_small", "no_dimensions", "no_duration",
  "caption_empty", "caption_too_long", "too_many_hashtags", "too_many_mentions", "cover_image_missing",
  "cover_offset_out_of_range", "bad_fit", "video_size_check_failed", "rendition_not_ready",
  "not_connected", "no_instagram_account", "no_page", "rate_limited", "reel_daily_limit",
  "container_error", "container_expired", "container_failed", "publish_failed", "meta_video_format",
  "meta_auth", "meta_permission", "meta_account", "meta_media_unreachable", "meta_media_shape",
  "meta_media_rejected", "meta_transient", "meta_error", "facebook_reel_failed", "timed_out",
  "unexpected", "not_available", "forbidden", "cloudinary_unavailable", "cover_image_not_ours",
  "not_a_video", "file_too_large", "name_required", "no_platforms", "not_ours", "campaign_required",
  "not_approved", "approval_stale", "changed_since_review", "upload_not_ready", "shape_fixed_on_upload",
  "upload_failed", "upload_never_arrived", "cloudinary_failed", "allowance_used", "choose_fit",
  "archived", "archiving", "not_archived", "already_restoring", "archive_unavailable", "archive_copy_missing",
]);

function errorText(t, code, vars) {
  if (code && KNOWN.has(code)) return t(`app.videoPost.error.${code}`, vars);
  return t("app.videoPost.error.unknown", { code: code || "?" });
}

const RECONNECT = new Set(["not_connected", "meta_auth", "meta_permission", "no_instagram_account", "no_page"]);
const DESTINATIONS = ["instagram", "facebook", "tiktok"];

export default function VideoPostPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const imp = useImpersonation();
  const readOnly = Boolean(imp) && imp.mode !== "demo_sandbox";

  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [caption, setCaption] = useState("");
  const [name, setName] = useState("");
  const [coverMs, setCoverMs] = useState(0);
  const [meta, setMeta] = useState(null); // GET …/publish
  const [tiktok, setTiktok] = useState(null); // GET …/tiktok
  const [allowance, setAllowance] = useState(null);
  const [chosen, setChosen] = useState({ instagram: false, facebook: false, tiktok: false });
  const [posting, setPosting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [results, setResults] = useState({}); // platform → row-ish
  const [tiktokOpen, setTiktokOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const renditionTimer = useRef(null);
  const arrivalTimer = useRef(null);
  const pollTimers = useRef({});
  const approvalRef = useRef(null);

  const adopt = useCallback((data) => {
    setPost(data);
    setCaption(data.caption || "");
    setName(data.name || "");
    setCoverMs(data.coverOffsetMs || 0);
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await fetchJson(`/api/marketing/video-posts/${id}`));
      setLoadError("");
    } catch (err) {
      setLoadError(err.status === 404 ? t("app.load.notFound") : err.message);
    }
  }, [id, t, adopt]);

  const loadSides = useCallback(() => {
    fetchJson(`/api/marketing/video-posts/${id}/publish`).then(setMeta).catch(() => setMeta({ loadError: true }));
    fetchJson(`/api/marketing/video-posts/${id}/tiktok`).then(setTiktok).catch(() => setTiktok({ loadError: true }));
  }, [id]);

  useEffect(() => {
    load();
    loadSides();
    fetchJson("/api/marketing/video-pack").then((d) => setAllowance(d.allowance)).catch(() => setAllowance(null));
  }, [id, load, loadSides]);

  // ── Wait for the clip to arrive ────────────────────────────────────────
  const uploadState = post?.uploadState;
  useEffect(() => {
    if (!uploadState || uploadState === "ready" || uploadState === "failed") return undefined;
    let attempt = 0;
    const tick = async () => {
      attempt += 1;
      try {
        const data = await fetchJson(`/api/marketing/video-posts/${id}`);
        if (data.uploadState !== uploadState) {
          adopt(data);
          if (data.uploadState === "ready") loadSides();
          return;
        }
      } catch {
        // A blip — keep waiting.
      }
      if (attempt < ARRIVAL_POLL_MAX) arrivalTimer.current = setTimeout(tick, ARRIVAL_POLL_MS);
    };
    arrivalTimer.current = setTimeout(tick, ARRIVAL_POLL_MS);
    return () => clearTimeout(arrivalTimer.current);
  }, [uploadState, id, adopt, loadSides]);

  // Poll until a derived rendition exists (a Fit/Crop chosen after upload),
  // so "Post" never sends a URL that would fail to download. Never for an
  // archived clip — there is no rendition until it is restored.
  useEffect(() => {
    if (!post || post.uploadState !== "ready" || post.archive || post.rendition?.state === "ready" || !isNineBySixteenOrFitted(post)) return undefined;
    let attempt = 0;
    const tick = async () => {
      attempt += 1;
      try {
        const data = await fetchJson(`/api/marketing/video-posts/${id}`);
        setPost((prev) => ({ ...prev, rendition: data.rendition, checks: data.checks, destinations: data.destinations }));
        if (data.rendition?.state === "ready" || attempt >= RENDITION_POLL_MAX) return;
      } catch {
        return;
      }
      renditionTimer.current = setTimeout(tick, RENDITION_POLL_MS);
    };
    renditionTimer.current = setTimeout(tick, RENDITION_POLL_MS);
    return () => clearTimeout(renditionTimer.current);
  }, [post?.fit, post?.rendition?.state, post?.uploadState, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => Object.values(pollTimers.current).forEach(clearTimeout), []);

  async function patch(body) {
    setSaving(true);
    try {
      const data = await fetchJson(`/api/marketing/video-posts/${id}`, { method: "PATCH", body });
      setPost(data);
      // An edit can have withdrawn the approval — the composer reads it too.
      fetchJson(`/api/marketing/video-posts/${id}/tiktok`).then(setTiktok).catch(() => {});
      return data;
    } catch (err) {
      showError(err.code ? errorText(t, err.code) : err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function approve(withdraw = false) {
    setApproving(true);
    try {
      const data = await fetchJson(`/api/marketing/video-posts/${id}/approval`, {
        method: withdraw ? "DELETE" : "POST",
        body: withdraw ? undefined : { fingerprint: post.approval?.fingerprint },
      });
      setPost((prev) => ({ ...prev, approval: { ...prev.approval, ...data } }));
      fetchJson(`/api/marketing/video-posts/${id}/tiktok`).then(setTiktok).catch(() => {});
    } catch (err) {
      showError(err.code ? errorText(t, err.code) : err.message);
      if (err.code === "changed_since_review") load();
    } finally {
      setApproving(false);
    }
  }

  /** Copies the archived clip back into Cloudinary; the arrival poll above takes it from there. */
  async function restore() {
    setRestoring(true);
    try {
      adopt(await fetchJson(`/api/marketing/video-posts/${id}/restore`, { method: "POST", body: {} }));
      fetchJson("/api/marketing/video-pack").then((d) => setAllowance(d.allowance)).catch(() => {});
    } catch (err) {
      if (err.code === "allowance_used" && err.data?.allowance) setAllowance(err.data.allowance);
      showError(err.code ? errorText(t, err.code) : err.message);
    } finally {
      setRestoring(false);
    }
  }

  async function uploadCover(file) {
    if (!file) return;
    setSaving(true);
    try {
      const entry = await uploadFile(file, { purpose: "video" });
      if (entry.kind !== "photo") {
        showError(t("app.videoPost.coverMustBePicture"));
        return;
      }
      // Delivered as JPEG: Instagram's cover_url wants a picture it can read.
      const url = entry.url.replace(/\.(png|webp|gif|heic|heif|jpeg)$/i, ".jpg");
      await patch({ coverImageUrl: url, coverMode: "image" });
    } catch (err) {
      showError(err.serverMessage || err.message);
    } finally {
      setSaving(false);
    }
  }

  const pollPublish = useCallback((platform, publishId, attempt = 0) => {
    pollTimers.current[platform] = setTimeout(async () => {
      try {
        const row = await fetchJson(`/api/marketing/video-posts/publishes/${publishId}`);
        const open = ["pending", "container_created", "publishing"].includes(row.status);
        setResults((r) => ({ ...r, [platform]: { ...row, stillProcessing: open && attempt + 1 >= PUBLISH_POLL_MAX } }));
        if (open && attempt + 1 < PUBLISH_POLL_MAX) pollPublish(platform, publishId, attempt + 1);
      } catch {
        setResults((r) => ({ ...r, [platform]: { ...(r[platform] || {}), statusUnavailable: "network", stillProcessing: true } }));
      }
    }, PUBLISH_POLL_MS);
  }, []);

  /** Instagram and Facebook together; TikTok then opens TikTok's own composer. */
  async function postTicked() {
    const metaPlatforms = ["instagram", "facebook"].filter((p) => chosen[p]);
    const wantsTiktok = chosen.tiktok;
    if (!metaPlatforms.length && !wantsTiktok) return;
    setPosting(true);
    try {
      if (metaPlatforms.length) {
        const data = await fetchJson(`/api/marketing/video-posts/${id}/publish`, { method: "POST", body: { platforms: metaPlatforms } });
        const next = {};
        for (const [platform, r] of Object.entries(data.results || {})) {
          next[platform] = r;
          if (r.id && ["container_created", "publishing"].includes(r.status)) pollPublish(platform, r.id);
        }
        setResults((prev) => ({ ...prev, ...next }));
      }
      setChosen({ instagram: false, facebook: false, tiktok: false });
      if (wantsTiktok) setTiktokOpen(true);
    } catch (err) {
      showError(err.code ? errorText(t, err.code) : err.message);
    } finally {
      setPosting(false);
    }
  }

  const ready = post?.rendition?.state === "ready";
  const vertical = post?.width ? isNineBySixteen(post.width, post.height) : false;
  const shapeChosen = post ? vertical || post.fit !== "original" : false;
  const preparedShape = post?.preparedAs && post.preparedAs !== "limit" ? post.preparedAs : null;
  const captionDirty = post ? caption !== (post.caption || "") : false;
  const approved = post?.approval?.state === "approved";
  const localChecks = useMemo(() => {
    if (!post || post.uploadState !== "ready") return null;
    const draft = { ...post, caption };
    return {
      instagram: checkForPlatform("instagram", draft),
      facebook: checkForPlatform("facebook", draft),
      tiktok: checkForPlatform("tiktok", draft),
    };
  }, [post, caption]);
  // One object per saved post, not per render — the composer re-reads its
  // asset whenever this changes.
  const tiktokVideo = useMemo(() => (post ? { ...post, caption: post.caption || "" } : null), [post]);

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        <Link href="/app/marketing/designer" className="text-sm underline mt-2 inline-block">{t("app.videoPost.back")}</Link>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> {t("app.videoPost.loading")}
      </div>
    );
  }

  const header = (
    <div>
      <Link href="/app/marketing/designer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> {t("app.videoPost.back")}
      </Link>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mt-2">
        <Film size={22} /> {post.name}
      </h1>
      {post.uploadState === "ready" && (
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.videoPost.facts", { width: post.width, height: post.height, seconds: Math.round(post.durationSec) })}
        </p>
      )}
      <VideoAllowanceLine allowance={allowance} className="mt-1" />
      {readOnly && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock size={12} /> {t("app.videoPost.readOnly")}
        </p>
      )}
    </div>
  );

  // ── The clip hasn't arrived (or never will) ────────────────────────────
  if (post.uploadState !== "ready") {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {header}
        <section className="bg-card border border-border rounded-xl p-5 space-y-2" data-video-upload-state={post.uploadState}>
          {post.uploadState === "failed" ? (
            <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {errorText(t, post.uploadError)}
            </p>
          ) : (
            <p className="text-sm text-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t(post.archive?.restoring ? "app.videoPost.archive.restoring" : post.uploadState === "uploading" ? "app.videoPost.stillUploading" : "app.videoPost.converting")}
            </p>
          )}
        </section>
      </div>
    );
  }

  // ── Archived: listed, with what it was sent to; nothing that needs the file ──
  if (post.archive) {
    const history = [
      ...(Array.isArray(meta?.history) ? meta.history.map((h) => ({ ...h, where: h.platform === "instagram" ? "app.videoPost.instagram" : "app.videoPost.facebook" })) : []),
      ...(Array.isArray(tiktok?.history) ? tiktok.history.map((h) => ({ ...h, where: "app.videoPost.tiktok" })) : []),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const restoreFailed = typeof post.archive.lastError === "string" && post.archive.lastError.startsWith("restore_failed");
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {header}
        <section className="bg-card border border-border rounded-xl p-5 space-y-3" data-video-archived>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Archive size={16} /> {t("app.videoPost.archive.title")}
          </h2>
          <p className="text-sm text-foreground">{t("app.videoPost.archive.body")}</p>
          {post.archive.bytes && post.archive.sha256 ? (
            <p className="text-xs text-muted-foreground break-all">
              {t("app.videoPost.archive.copy", { size: formatArchiveBytes(post.archive.bytes), checksum: post.archive.sha256.slice(0, 16) })}
            </p>
          ) : null}
          {restoreFailed && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {t("app.videoPost.archive.lastRestoreFailed")}
            </p>
          )}
          {post.archive.restorable ? (
            <>
              <p className="text-sm text-muted-foreground">{t("app.videoPost.archive.restoreNote")}</p>
              <button
                type="button"
                onClick={restore}
                disabled={readOnly || restoring}
                className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60"
                data-video-restore
              >
                {restoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {t("app.videoPost.archive.restore")}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("app.videoPost.archive.unavailable")}</p>
          )}
        </section>
        {history.length > 0 && (
          <section className="bg-card border border-border rounded-xl p-5 space-y-2">
            <h2 className="font-semibold text-foreground">{t("app.videoPost.historyTitle")}</h2>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {history.map((h) => (
                <li key={h.id}>
                  {new Date(h.createdAt).toLocaleString()} · {t(h.where)} · {t(`app.videoPost.status.${h.status}`)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const metaVisible = meta && !meta.loadError && meta.visible;
  const tiktokVisible = tiktok && !tiktok.loadError && tiktok.available;
  const disabled = readOnly || saving;

  function destinationRow(platform) {
    const check = localChecks?.[platform];
    const dest = destinationState(check);
    let account = null;
    let blocked = null; // a reason the tick box is greyed out
    if (platform === "tiktok") {
      if (!tiktokVisible) blocked = t("app.videoPost.tiktokUnavailable");
      else if (!tiktok.connected) blocked = "tiktok_not_connected";
      account = tiktok?.account?.displayName || "";
    } else {
      if (!metaVisible) blocked = t("app.videoPost.metaUnavailable");
      else if (!meta.connected) blocked = "meta_not_connected";
      else if (platform === "instagram" && !meta.hasInstagram) blocked = errorText(t, "no_instagram_account");
      account = platform === "instagram" ? meta?.instagramUsername || "" : meta?.pageName || "";
    }
    if (!blocked && !dest.available) {
      blocked = t(`app.videoPost.limit.${platform}.${dest.reason}`, {
        max: String(dest.limits?.maxSeconds ?? ""),
        min: String(dest.limits?.minSeconds ?? ""),
      });
    }
    const fixable = check && !check.ok ? check.errors.filter((c) => !["too_long", "too_short", "too_small", "too_wide", "video_size_check_failed", "no_duration", "no_dimensions"].includes(c)) : [];
    const canTick = !blocked && fixable.length === 0 && approved && ready && shapeChosen && !captionDirty && !readOnly;
    const label = {
      instagram: t("app.videoPost.instagramReel", { account }),
      facebook: t("app.videoPost.facebookReel", { account }),
      tiktok: t("app.videoPost.tiktokVideoAccount", { account }),
    }[platform];
    return (
      <div key={platform} className={`border border-border rounded-lg p-3 space-y-1 ${blocked ? "opacity-70" : ""}`} data-video-platform={platform}>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={chosen[platform]}
            disabled={!canTick || posting}
            onChange={(e) => setChosen((c) => ({ ...c, [platform]: e.target.checked }))}
            data-video-tick={platform}
          />
          {label}
        </label>
        <p className="text-xs text-muted-foreground pl-6">{t(`app.videoPost.${platform}Limits`)}</p>
        {blocked === "meta_not_connected" ? (
          <p className="text-xs text-muted-foreground pl-6">
            {t("app.videoPost.metaNotConnected")} <Link href={SOCIAL_SETTINGS_PATH} className="underline">{t("app.videoPost.openSettings")}</Link>
          </p>
        ) : blocked === "tiktok_not_connected" ? (
          <p className="text-xs text-muted-foreground pl-6">
            {t("app.videoPost.tiktokNotConnected")} <Link href={TIKTOK_SETTINGS_PATH} className="underline">{t("app.videoPost.openSettings")}</Link>
          </p>
        ) : blocked ? (
          <p className="text-xs text-amber-700 dark:text-amber-400 pl-6" data-video-blocked={platform}>{blocked}</p>
        ) : null}
        {!blocked && fixable.length > 0 && (
          <ul className="pl-6 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
            {fixable.map((code) => (
              <li key={code}>{errorText(t, code, { max: String(check.limits?.maxSeconds ?? ""), min: String(check.limits?.minSeconds ?? ""), seconds: String(Math.round(post.durationSec)) })}</li>
            ))}
          </ul>
        )}
        {platform === "tiktok" && <p className="text-xs text-muted-foreground pl-6">{t("app.videoPost.tiktokComposerNote")}</p>}
        {platform !== "tiktok" && <PublishResult t={t} result={results[platform]} platform={platform} />}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {header}

      {/* ── Shape ─────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground">{t("app.videoPost.shapeTitle")}</h2>
        {preparedShape ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2" data-video-prepared={preparedShape}>
            <Check size={14} /> {t(`app.videoPost.prepared.${preparedShape}`)}
          </p>
        ) : vertical ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Check size={14} /> {t("app.videoPost.alreadyVertical")}
          </p>
        ) : (
          <>
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2" data-video-not-vertical>
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {t("app.videoPost.notVertical", { width: post.width, height: post.height })}
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("app.videoPost.shapeTitle")}>
              {["pad", "crop"].map((fit) => (
                <button
                  key={fit}
                  type="button"
                  role="radio"
                  aria-checked={post.fit === fit}
                  disabled={disabled || post.fit === fit}
                  onClick={() => patch({ fit })}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold min-h-[44px] ${post.fit === fit ? "border-foreground bg-muted text-foreground" : "border-border text-foreground"} disabled:opacity-60`}
                >
                  {t(fit === "pad" ? "app.videoPost.fitPad" : "app.videoPost.fitCrop")}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("app.videoPost.fitHelp")}</p>
          </>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <figure>
            <figcaption className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {t(preparedShape ? "app.videoPost.previewPrepared" : shapeChosen ? "app.videoPost.previewFramed" : "app.videoPost.previewOriginal")}
            </figcaption>
            <div className={`${shapeChosen ? "aspect-[9/16]" : ""} w-full max-w-[240px] bg-black rounded-lg overflow-hidden flex items-center justify-center`}>
              <video
                src={post.videoUrl}
                controls
                playsInline
                muted
                preload="metadata"
                className={`w-full ${shapeChosen ? "h-full" : ""} ${post.fit === "crop" ? "object-cover" : "object-contain"}`}
              />
            </div>
          </figure>
          {shapeChosen && !preparedShape && (
            <figure>
              <figcaption className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {t("app.videoPost.previewPrepared")}
              </figcaption>
              <div className="aspect-[9/16] w-full max-w-[240px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {ready ? (
                  <video src={post.rendition.url} controls playsInline muted preload="metadata" className="w-full h-full object-contain bg-black" data-video-rendition />
                ) : (
                  <p className="text-xs text-muted-foreground p-4 text-center flex flex-col items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {t("app.videoPost.preparing")}
                  </p>
                )}
              </div>
            </figure>
          )}
        </div>
      </section>

      {/* ── Cover ─────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground">{t("app.videoPost.coverTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {["frame", "image"].map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="cover-mode"
                checked={post.coverMode === mode}
                disabled={disabled || (mode === "image" && !post.coverImageUrl)}
                onChange={() => patch({ coverMode: mode })}
              />
              {t(mode === "frame" ? "app.videoPost.coverFrame" : "app.videoPost.coverImage")}
            </label>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-2 flex-1">
            <label htmlFor="cover-ms" className="text-xs text-muted-foreground">
              {t("app.videoPost.coverAt", { seconds: (coverMs / 1000).toFixed(1) })}
            </label>
            <input
              id="cover-ms"
              type="range"
              min={0}
              max={Math.max(0, Math.floor(post.durationSec * 1000) - 1)}
              step={100}
              value={coverMs}
              disabled={disabled}
              onChange={(e) => setCoverMs(Number(e.target.value))}
              className="w-full"
            />
            <button
              type="button"
              disabled={disabled || coverMs === post.coverOffsetMs}
              onClick={() => patch({ coverOffsetMs: coverMs, coverMode: "frame" })}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {t("app.videoPost.useFrame")}
            </button>
            <label className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold w-fit cursor-pointer">
              <ImagePlus size={12} />
              {t("app.videoPost.uploadCover")}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" disabled={disabled} onChange={(e) => uploadCover(e.target.files?.[0])} />
            </label>
            <p className="text-xs text-muted-foreground">{t("app.videoPost.coverNote")}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverMode === "image" && post.coverImageUrl ? post.coverImageUrl : post.coverFrameUrl}
            alt={t("app.videoPost.coverAlt")}
            className="w-28 aspect-[9/16] object-cover rounded-lg bg-muted"
          />
        </div>
      </section>

      {/* ── Words ─────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-foreground">{t("app.videoPost.captionTitle")}</h2>
        <label htmlFor="video-name" className="text-xs text-muted-foreground">{t("app.videoPost.nameLabel")}</label>
        <input
          id="video-name"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== post.name && patch({ name })}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <textarea
          value={caption}
          disabled={disabled}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          maxLength={VIDEO_CAPTION_MAX * 2}
          placeholder={t("app.videoPost.captionPlaceholder")}
          aria-label={t("app.videoPost.captionTitle")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${[...caption].length > VIDEO_CAPTION_MAX ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            {t("app.videoPost.captionCount", { count: [...caption].length, max: VIDEO_CAPTION_MAX })}
          </span>
          <button
            type="button"
            disabled={disabled || !captionDirty || [...caption].length > VIDEO_CAPTION_MAX}
            onClick={() => patch({ caption })}
            className="rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {t("app.videoPost.saveCaption")}
          </button>
        </div>
        {post.approval?.approvedAt && <p className="text-xs text-muted-foreground">{t("app.videoPost.editWithdraws")}</p>}
      </section>

      {/* ── Approval ─────────────────────────────────────────────── */}
      <section ref={approvalRef} className="bg-card border border-border rounded-xl p-5 space-y-3" data-video-approval={post.approval?.state}>
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <BadgeCheck size={16} /> {t("app.videoPost.approvalTitle")}
        </h2>
        {approved ? (
          <p className="text-sm text-foreground">
            {t("app.videoPost.approvedBy", {
              name: post.approval.approvedByName || t("app.videoPost.someone"),
              date: post.approval.approvedAt ? new Date(post.approval.approvedAt).toLocaleString() : "",
            })}
          </p>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {errorText(t, post.approval?.state === "stale" ? "approval_stale" : "not_approved")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t("app.videoPost.approvalHelp")}</p>
        {captionDirty && <p className="text-xs text-amber-700 dark:text-amber-400">{t("app.videoPost.saveFirst")}</p>}
        <div className="flex flex-wrap gap-2">
          {!approved ? (
            <button
              type="button"
              onClick={() => approve(false)}
              disabled={readOnly || approving || captionDirty || !shapeChosen}
              className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60"
              data-video-approve
            >
              {approving ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
              {t("app.videoPost.approve")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => approve(true)}
              disabled={readOnly || approving}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold min-h-[44px] disabled:opacity-60"
            >
              {t("app.videoPost.withdrawApproval")}
            </button>
          )}
        </div>
      </section>

      {/* ── Post ──────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-foreground">{t("app.videoPost.postTitle")}</h2>
        {!approved && <p className="text-xs text-amber-700 dark:text-amber-400">{t("app.videoPost.approveFirst")}</p>}
        {!shapeChosen && <p className="text-xs text-amber-700 dark:text-amber-400">{errorText(t, "not_vertical")}</p>}
        {shapeChosen && !ready && <p className="text-xs text-muted-foreground">{t("app.videoPost.preparing")}</p>}
        {meta?.mock && <p className="text-xs text-muted-foreground">{t("app.videoPost.demoNotice")}</p>}

        {meta === null || tiktok === null ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            {DESTINATIONS.map(destinationRow)}
            <button
              type="button"
              onClick={postTicked}
              disabled={posting || readOnly || !Object.values(chosen).some(Boolean)}
              className="w-full sm:w-auto bg-inverted text-inverted-foreground rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {posting ? t("app.videoPost.posting") : t("app.videoPost.postSelected")}
            </button>
          </div>
        )}

        {/* What has already gone out — so a second press is a decision. */}
        {Array.isArray(meta?.history) && meta.history.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("app.videoPost.historyTitle")}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {meta.history.map((h) => (
                <li key={h.id}>
                  {new Date(h.createdAt).toLocaleString()} · {t(h.platform === "instagram" ? "app.videoPost.instagram" : "app.videoPost.facebook")} · {t(`app.videoPost.status.${h.status}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {tiktokOpen && (
        <TikTokPublishModal
          isOpen={tiktokOpen}
          onClose={() => setTiktokOpen(false)}
          video={tiktokVideo}
          onOpenApproval={() => {
            setTiktokOpen(false);
            approvalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
    </div>
  );
}

function isNineBySixteenOrFitted(post) {
  return isNineBySixteen(post.width, post.height) || post.fit !== "original";
}

function PublishResult({ t, result, platform }) {
  if (!result) return null;
  const where = t(platform === "instagram" ? "app.videoPost.instagram" : "app.videoPost.facebook");
  if (result.status === "published") {
    return (
      <p className="pl-6 text-xs text-foreground flex items-center gap-1" data-video-result="published">
        <Check size={12} /> {t("app.videoPost.posted", { where })}
      </p>
    );
  }
  if (result.status === "failed" || result.status === "rate_limited") {
    return (
      <div className="pl-6 text-xs text-red-700 dark:text-red-300 space-y-1" data-video-result="failed">
        <p className="flex items-start gap-1">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          {errorText(t, result.code, {
            max: String(result.limits?.maxSeconds ?? ""),
            min: String(result.limits?.minSeconds ?? ""),
            seconds: "",
          })}
        </p>
        {/* Meta's own words, for support — never instead of the sentence. */}
        {(result.metaDetail || result.errorMessage) && (
          <p className="text-[11px] text-muted-foreground break-words">{t("app.videoPost.platformSaid", { detail: result.metaDetail || result.errorMessage })}</p>
        )}
        {RECONNECT.has(result.code) && (
          <Link href={SOCIAL_SETTINGS_PATH} className="underline">{t("app.videoPost.openSettings")}</Link>
        )}
      </div>
    );
  }
  return (
    <p className="pl-6 text-xs text-foreground flex items-center gap-1" data-video-result="processing">
      {result.stillProcessing ? <Clock size={12} /> : <Loader2 size={12} className="animate-spin" />}
      {result.statusUnavailable
        ? t("app.videoPost.statusUnavailable")
        : result.stillProcessing
          ? t("app.videoPost.stillProcessing", { where })
          : t("app.videoPost.processingOn", { where })}
    </p>
  );
}
