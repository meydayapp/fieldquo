"use client";

// app/components/designer/PublishModal.js
//
// The "publish this design to Instagram/Facebook" confirmation dialog,
// opened from CampaignEditor.js's Publish button.
//
// ══ Why this exists as its own file, and its own honest state ═════════════
//
// Publishing is outward-facing and irreversible — a real post, to a real
// audience, under the contractor's own brand, with no unsend. That is a
// bigger commitment than the "delete this design?" window.confirm() this
// screen already had before this file, and app/components/SendConfirmModal.js
// already established the pattern for exactly this kind of screen (see its
// own header) — a rendered modal that names the specific thing being
// committed to, rather than a browser-native confirm() an automated click
// sails through unnoticed. This dialog goes further than that one because
// there is more to confirm: which account, which image, and a caption with
// real length limits, not just a recipient string.
//
// ══ Nothing here composes; it confirms ════════════════════════════════════
//
// The caption is READ-ONLY on this screen and comes off the design, which is
// the same string the server publishes — see the publish route, which refuses
// a body carrying a different one rather than silently preferring either. The
// place to write the words is ApprovalModal.js, because editing them withdraws
// the approval, and a screen that can silently un-approve the thing it is
// about to post is a gate with a hole in it. "Edit the words" below opens that
// dialog instead of turning this textarea back on.
//
// ══ When the company has no Page connected ════════════════════════════════
//
// The Publish button that opens this is only rendered once FieldQuo's Meta
// app is configured (CampaignEditor.js, socialVisible). What is still per
// company is the Page: lib/social/metaConnection.js reads the connection
// Settings › Meta Ads stores (app/components/settings/SocialPublishingPanel.js),
// and a company that has not made one gets `connected: false`. This dialog
// then says where the connection is made and, for someone allowed to make
// it, links there — that screen's own states say whether Meta has approved
// the connect flow yet, so the link is honest either way. It used to say
// "not available yet, check back soon", written when no connect flow existed
// at all; once it did, that sentence sent an owner away from the one screen
// that fixes it.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  FlaskConical,
  Link2,
  Loader2,
  PencilLine,
  RotateCcw,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";
// lucide-react 1.x dropped brand/trademark icons (Facebook, Instagram, …) —
// there is no icon here to stand in for either platform, so the checkbox
// labels below carry the platform by name/handle alone rather than reaching
// for a lookalike icon that isn't actually either brand's mark.
import { useTranslation } from "@/app/hooks/useTranslation";
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { reportResponseError } from "@/lib/clientErrors";
import {
  validateCaption,
  validateImageForInstagram,
  checkImageForFacebookFeed,
  INSTAGRAM_CAPTION_SPEC,
  isValidFacebookScheduleTime,
  isValidScheduleTime,
  FACEBOOK_SCHEDULE_MIN_MINUTES,
  FACEBOOK_SCHEDULE_MAX_DAYS,
} from "@/lib/social/metaSpecs";
import { destinationRatio, planMetaRequests } from "@/lib/marketing/destinations";
import { ratio as ratioByKey } from "@/lib/marketing/ratios";
import { metaPublishBody } from "@/lib/social/publishBody";

// The datetime-local picker's own min/max — the INTERSECTION of Facebook's
// Meta-enforced window and FieldQuo's own Instagram window, so a single
// control stays honest whichever platform(s) end up checked. Facebook's is
// the tighter window on both ends (10min/75days vs FieldQuo's own 5min/
// 180days for Instagram — see metaSpecs.js) so it's the one the widget's
// browser-native min/max attributes use; the real per-platform check still
// happens server-side either way, this is only the picker's guardrail.
function scheduleBounds(now) {
  return {
    min: new Date(now.getTime() + FACEBOOK_SCHEDULE_MIN_MINUTES * 60 * 1000),
    max: new Date(now.getTime() + FACEBOOK_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000),
  };
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time with no offset — the
// browser interprets a bare value that way on both read and write, which is
// exactly what keeps this DST-safe: no manual offset math happens anywhere
// in this file, only Date's own local-time getters and its own parsing of
// what the input hands back.
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ══ No shape picker: each destination gets its own format ═══════════════════
//
// Owner, 2026-09-29 (lib/marketing/destinations.js): Instagram feed 4:5,
// Facebook feed 4:5 — or 1.91:1 only when the person asks for a link-style
// post — TikTok 9:16. The Portrait / Square / Landscape picker that used to
// sit here could only ever make a platform crop or refuse the post, so it is
// gone; each checked destination shows its own preview, in the one format it
// gets, and that is the image sent to it. A design laid out square before 4:5
// existed keeps posting that square to both — destinations.js explains why —
// in the exact request this dialog always sent for it.
//
// Facebook and Instagram in the same format are ONE request, as before; a
// link-style Facebook post is a second request with its own image
// (planMetaRequests()).

// What a format is called next to its preview. The label keys are the ones
// the old picker used, so every language already has them.
const FORMAT_LABEL_KEYS = {
  instagram_portrait: "app.marketingDesigner.publishModal.shapePortrait",
  instagram_post: "app.marketingDesigner.publishModal.shapeSquare",
  facebook_feed: "app.marketingDesigner.publishModal.shapeLandscape",
};

const CAPTION_ERROR_KEYS = {
  empty: "app.marketingDesigner.publishModal.captionEmpty",
  too_long: "app.marketingDesigner.publishModal.captionTooLong",
  too_many_hashtags: "app.marketingDesigner.publishModal.tooManyHashtags",
  too_many_mentions: "app.marketingDesigner.publishModal.tooManyMentions",
};

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{id:string,name:string,campaign?:{name?:string}}} props.design
 * @param {(ratioKey: string, slide?: number) => Promise<{dataUrl:string,width:number,height:number}|null>} props.preparePublishAsset
 * @param {() => void} [props.onOpenApproval]  hands the person over to the
 *   screen where the words are actually edited and the sign-off happens.
 * @param {string[]} [props.savedKeys]  the formats the design's first slide
 *   has saved — what decides whether it is a pre-4:5 square design.
 * @param {number} [props.slideCount]  1 for a single image; 2–10 a carousel.
 */
export default function PublishModal({
  isOpen,
  onClose,
  design,
  preparePublishAsset,
  onOpenApproval,
  savedKeys = [],
  slideCount = 1,
  tiktokConnected = false,
  onChooseTikTok,
}) {
  const { t } = useTranslation();
  // Settings › Meta Ads is owner/admin only (SETTINGS_ROW_CAPABILITY
  // "billing"; app/api/settings/social/* refuse anyone else). A supervisor
  // can open this dialog, so the link is theirs only when that screen would
  // be — otherwise the sentence alone says who to ask. Falls open while the
  // provider has not resolved, PermissionProvider's rule.
  const caller = usePermissions();
  const canConnect = !caller?.role || isBillingAdmin(caller.role);

  const [connection, setConnection] = useState(null); // null = loading
  // "feed" (4:5) unless the person asks for Facebook's link-style 1.91:1.
  const [facebookStyle, setFacebookStyle] = useState("feed");
  // ratioKey -> { status: "loading"|"ready"|"failed", items: [{dataUrl,width,height}] }
  // — every slide, rendered in each format a checked destination gets.
  const [assets, setAssets] = useState({});
  // Formats already asked for this open — a ref, because the loop below must
  // know synchronously, and a state updater is not guaranteed to run in time.
  const requestedRef = useRef(new Set());
  // Read-only here — set from the design when this opens, never typed into.
  // See this file's header.
  const [caption, setCaption] = useState("");
  // "approved" | "stale" | "not_approved" | null. Null while the connection
  // request is still out; the submit button stays off until it lands, which
  // is the safe direction for a control that posts publicly.
  const [approval, setApproval] = useState(null);
  const [platforms, setPlatforms] = useState({ facebook: false, instagram: false });
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { facebook?: {...}, instagram?: {...} }
  const [submitError, setSubmitError] = useState("");
  // Off by default — publishing now is the common case, and the picker only
  // adds a control for the contractor to see when they actually want it.
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(""); // datetime-local string, local time
  // Demo-only — see this file's mock badge below. "none" is the default and
  // the only value a real connection's request ever effectively carries,
  // since the API refuses this field outright unless connection.mock.
  const [mockFailure, setMockFailure] = useState("none");

  // Reset per-open, not per-unmount — the modal is kept mounted (isOpen
  // just returns null) so CampaignEditor doesn't remount PublishModal, and
  // therefore doesn't lose editorInstance wiring, every time it's toggled.
  useEffect(() => {
    if (!isOpen) return;
    setResults(null);
    setSubmitError("");
    setConnection(null);
    setScheduleOn(false);
    setScheduleValue("");
    setMockFailure("none");
    setFacebookStyle("feed");
    setAssets({});
    requestedRef.current = new Set();
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/publish`);
      if (cancelled) return;
      if (!res.ok) {
        await reportResponseError(res);
        setConnection({ connected: false });
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setConnection(data);
      // Both come from the SAME response the server will act on, rather than
      // from a second request that could disagree with it.
      setApproval(data.approval?.state ?? null);
      setCaption(data.caption || "");
      setPlatforms({
        facebook: Boolean(data.connected),
        instagram: Boolean(data.connected && data.instagramUsername),
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, design?.id]);

  // The format each destination gets — decided, not chosen.
  const igRatio = destinationRatio("instagram", { savedKeys });
  const fbRatio = destinationRatio("facebook", { savedKeys, facebookStyle });
  const neededRatios = useMemo(() => {
    const out = [];
    if (platforms.instagram) out.push(igRatio);
    if (platforms.facebook && !out.includes(fbRatio)) out.push(fbRatio);
    return out;
  }, [platforms.instagram, platforms.facebook, igRatio, fbRatio]);

  // Every slide rendered in every needed format, once per open. These are the
  // exact pixels sent — the preview is not a stand-in for them.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      for (const key of neededRatios) {
        if (cancelled) return;
        if (requestedRef.current.has(key)) continue;
        requestedRef.current.add(key);
        setAssets((prev) => ({ ...prev, [key]: { status: "loading", items: [] } }));
        const items = [];
        let failed = false;
        for (let i = 0; i < Math.max(1, slideCount); i++) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const generated = await preparePublishAsset(key, i);
            if (!generated) failed = true;
            else items.push(generated);
          } catch {
            failed = true;
          }
          if (cancelled) {
            // Asked again on the next run rather than left "loading" forever.
            requestedRef.current.delete(key);
            return;
          }
        }
        setAssets((prev) => ({ ...prev, [key]: { status: failed ? "failed" : "ready", items } }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, neededRatios, preparePublishAsset, slideCount]);

  const captionCheck = useMemo(() => validateCaption(caption), [caption]);
  const igItems = assets[igRatio]?.status === "ready" ? assets[igRatio].items : null;
  const fbItems = assets[fbRatio]?.status === "ready" ? assets[fbRatio].items : null;
  const imageCheck = useMemo(() => {
    if (!igItems) return null;
    const bad = igItems.map((a) => validateImageForInstagram({ width: a.width, height: a.height })).find((c) => !c.ok);
    return bad || { ok: true, errors: [] };
  }, [igItems]);

  // Facebook's pre-post check. A WARNING only — it is deliberately not part of
  // canSubmit below. With each destination on its own format it can no longer
  // fire from this dialog (4:5 and 1.91:1 both show in full); kept because the
  // server's result can still carry it for a post scheduled before.
  const facebookFeedCheck = useMemo(
    () => (fbItems?.[0] ? checkImageForFacebookFeed({ width: fbItems[0].width, height: fbItems[0].height }) : null),
    [fbItems],
  );
  // What is still a template placeholder on the design, from the server's own
  // count — the publish route refuses on the same thing.
  const placeholderCount = Number(connection?.placeholders?.count) || 0;

  const wantsInstagram = platforms.instagram;
  const anyPlatform = platforms.facebook || platforms.instagram;
  // Instagram's caption limit is the tighter of the two — enforced whenever
  // Instagram is a target, same rule the API route re-checks server-side.
  // A Facebook-only post only needs a non-empty caption.
  const captionOk = wantsInstagram ? captionCheck.ok : caption.trim().length > 0;
  const imageOk = !wantsInstagram || Boolean(imageCheck?.ok);

  const scheduledForDate = scheduleOn && scheduleValue ? new Date(scheduleValue) : null;
  // Client-side guardrail only — a UX nicety, not the real gate. The API
  // re-checks the exact same windows itself (isValidFacebookScheduleTime,
  // isValidScheduleTime) before ever touching Meta, per platform, because a
  // browser's clock and validation are never trusted for anything that
  // costs money or posts publicly (AGENTS.md non-negotiable #5's discipline
  // applied here to "is this a legal time" instead of "is this a legal
  // price"). Facebook and Instagram get their OWN real windows checked
  // rather than the picker's intersected one, so a request that happens to
  // squeak past the tighter UI guardrail because only Instagram is checked
  // still gets Instagram's real (wider) window applied server-side.
  const scheduleOk =
    !scheduleOn ||
    (Boolean(scheduledForDate) &&
      !Number.isNaN(scheduledForDate?.getTime()) &&
      (!platforms.facebook || isValidFacebookScheduleTime(scheduledForDate)) &&
      (!platforms.instagram || isValidScheduleTime(scheduledForDate)));

  // The client half of the approval gate. The SERVER half — recomputing the
  // fingerprint from the current rows and refusing on a mismatch — is the one
  // that enforces it (AGENTS.md: hiding a button is not access control). This
  // exists so the reason is visible before the click rather than as a 409
  // afterwards.
  const approved = approval === "approved";
  const assetsReady = neededRatios.length > 0 && neededRatios.every((k) => assets[k]?.status === "ready");

  const canSubmit =
    connection?.connected &&
    approved &&
    anyPlatform &&
    captionOk &&
    imageOk &&
    scheduleOk &&
    assetsReady &&
    placeholderCount === 0 &&
    !submitting;

  // A carousel's slides are uploaded one request each (…/assets) and the
  // publish request carries their signed receipts — ten images in one body
  // would pass the size a server function accepts. See lib/marketing/
  // slideAssets.js. Returns the receipts, or null after reporting a failure.
  async function stageSlides(key) {
    const tokens = [];
    for (const item of assets[key]?.items || []) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratioKey: key, imageBase64: item.dataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.message || body?.error || t("app.marketingDesigner.publishModal.genericError"));
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      tokens.push((await res.json()).token);
    }
    return tokens;
  }

  // `onlyPlatform` is the "Try Instagram again" path: the SAME request, the
  // same function, narrowed to the one platform that failed — never a second
  // way to publish. The server re-runs every gate for it (approval, caption,
  // connection), and its result replaces only that platform's row, so a
  // Facebook post that already went out is neither re-sent nor forgotten.
  async function handlePublish(onlyPlatform) {
    const retrying = typeof onlyPlatform === "string";
    if (retrying ? submitting || !connection?.connected || !approved : !canSubmit) return;
    const chosen = retrying
      ? [onlyPlatform]
      : Object.entries(platforms)
          .filter(([, on]) => on)
          .map(([key]) => key);
    // One request per distinct format — Facebook and Instagram together when
    // they share one, exactly as before.
    const plan = planMetaRequests({ platforms: chosen, savedKeys, facebookStyle });
    if (!plan.every((p) => assets[p.ratioKey]?.status === "ready")) return;
    setSubmitting(true);
    setSubmitError("");
    const merged = {};
    try {
      for (const request of plan) {
        const items = assets[request.ratioKey].items;
        let slideTokens;
        if (items.length > 1) {
          // eslint-disable-next-line no-await-in-loop
          slideTokens = await stageSlides(request.ratioKey);
          if (!slideTokens) return;
        }
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`/api/marketing/designer/designs/${design.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            metaPublishBody({
              ratioKey: request.ratioKey,
              platforms: request.platforms,
              caption,
              imageBase64: items[0].dataUrl,
              slideTokens,
              scheduledFor: scheduledForDate ? scheduledForDate.toISOString() : undefined,
              // Only ever acted on server-side when connection.mock is true —
              // sending it for a real connection is simply ignored there.
              // A retry does not re-simulate: the demo's point is showing that
              // the second attempt is a real, separate attempt.
              simulateFailure:
                !retrying && connection?.mock && mockFailure !== "none" ? mockFailure : undefined,
            }),
          ),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSubmitError(body?.message || t("app.marketingDesigner.publishModal.genericError"));
          await reportResponseError(res);
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        const data = await res.json();
        Object.assign(merged, data.results || {});
      }
      if (Object.keys(merged).length) {
        setResults((prev) => (retrying ? { ...(prev || {}), ...merged } : merged));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const done = Boolean(results);
  const loadingConnection = connection === null;
  const notConnected = !loadingConnection && !connection.connected;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={submitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t("app.marketingDesigner.publishModal.title")}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Required whenever connection.mock is true, per
            docs/SOCIAL-SCHEDULING.md: convincing in shape, but never allowed
            to look identical to the real thing — this is FieldQuo's own
            back office, so naming FieldQuo here is the honest choice rather
            than a vague "demo mode." Nothing downstream (the caption, the
            image, the schedule picker) looks any different — only this
            badge and the failure-simulation control below it exist because
            of `mock`. */}
        {connection?.mock && !done && (
          <div className="flex items-center gap-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-3">
            <FlaskConical size={12} />
            {t("app.marketingDesigner.publishModal.mockBadge", "FieldQuo demo mock — no real post is made")}
          </div>
        )}

        {loadingConnection && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 size={16} className="animate-spin" />
            {t("app.marketingDesigner.publishModal.checkingConnection")}
          </div>
        )}

        {/* TikTok as a destination — only when this company has a TikTok
            account connected (CampaignEditor passes tiktokConnected from the
            same check that decides the Publish button). TikTok's own rules
            (a 9:16 shape, privacy with no default, disclosure, its consent
            line) are a different form from this one, so choosing it hands
            over to TikTok's composer (TikTokPublishModal.js) rather than
            adding a fourth checkbox whose rules this dialog would have to
            mix into Facebook's and Instagram's. Shown whether or not a
            Facebook Page is connected: the two connections are independent. */}
        {!loadingConnection && !done && tiktokConnected && onChooseTikTok && (
          <button
            type="button"
            onClick={onChooseTikTok}
            className="mb-4 w-full flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground hover:bg-muted"
            data-publish-tiktok
          >
            <span className="flex items-center gap-2 font-semibold">
              <SocialGlyph platform="tiktok" size={15} />
              {t("app.tiktokPublish.destination")}
            </span>
            <span className="text-xs text-muted-foreground">{t("app.tiktokPublish.destinationHint")}</span>
          </button>
        )}

        {notConnected && (
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              {t("app.marketingDesigner.publishModal.notConnectedTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("app.marketingDesigner.publishModal.notConnectedBody")}
            </p>
            {canConnect && (
              <Link
                href={SOCIAL_SETTINGS_PATH}
                data-publish-connect-link
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground"
              >
                <Link2 size={15} aria-hidden="true" />
                {t("app.messages.connect.openSettings")}
              </Link>
            )}
          </div>
        )}

        {connection?.connected && !done && (
          <div className="space-y-4">
            {/* The approval, stated before anything else on the screen. Not a
                disabled button with a tooltip: the reason sits above the
                controls it explains and carries the way out of it, the same
                shape scripts/check-paid-refusals.mjs holds the AI refusals
                to. Only the SERVER decides whether this posts — see canSubmit
                above. */}
            {approval !== "approved" && (
              <div className="rounded-lg border border-border bg-muted p-3 space-y-2">
                <p className="flex items-start gap-2 text-sm text-foreground">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {approval === "stale"
                      ? t(
                          "app.marketingDesigner.publishModal.approvalStale",
                          "This design changed after it was approved. Review it again before it goes out.",
                        )
                      : t(
                          "app.marketingDesigner.publishModal.approvalNeeded",
                          "This post hasn't been approved yet. Nothing can be scheduled or posted until somebody has looked at it.",
                        )}
                  </span>
                </p>
                {onOpenApproval && (
                  <button
                    type="button"
                    onClick={onOpenApproval}
                    className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    {t("app.marketingDesigner.approval.badgeReview", "Review & approve")}
                  </button>
                )}
              </div>
            )}

            {/* Platform choice */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {t("app.marketingDesigner.publishModal.platformsLabel")}
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={platforms.facebook}
                    onChange={(e) => setPlatforms((p) => ({ ...p, facebook: e.target.checked }))}
                  />
                  {t("app.marketingDesigner.publishModal.facebook")}
                  {connection.pageName ? ` — ${connection.pageName}` : ""}
                </label>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    connection.instagramUsername ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={platforms.instagram}
                    disabled={!connection.instagramUsername}
                    onChange={(e) => setPlatforms((p) => ({ ...p, instagram: e.target.checked }))}
                  />
                  {t("app.marketingDesigner.publishModal.instagram")}
                  {connection.instagramUsername ? ` — @${connection.instagramUsername}` : ""}
                </label>
                {!connection.instagramUsername && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {t("app.marketingDesigner.publishModal.instagramUnavailable")}
                  </p>
                )}
              </div>
            </div>

            {/* Facebook's post style. Feed (4:5) unless the person asks for
                the link-style 1.91:1 — the one case Facebook gets a different
                format from Instagram, and so a second request. */}
            {platforms.facebook && (
              <label className="flex items-center gap-2 text-xs text-foreground" data-facebook-link-style>
                <input
                  type="checkbox"
                  checked={facebookStyle === "link"}
                  onChange={(e) => setFacebookStyle(e.target.checked ? "link" : "feed")}
                />
                {t("app.marketingDesigner.publishModal.facebookLinkStyle", "Post to Facebook as a link-style image (1.91:1)")}
              </label>
            )}

            {/* One preview per destination, in the format it gets — the
                actual pixels that will be sent, every slide of a carousel. */}
            {(platforms.instagram || platforms.facebook) && (
              <div className="space-y-3" data-destination-previews>
                {[
                  platforms.instagram ? { platform: "instagram", key: igRatio } : null,
                  platforms.facebook ? { platform: "facebook", key: fbRatio } : null,
                ]
                  .filter(Boolean)
                  .map(({ platform, key }) => {
                    const entry = assets[key];
                    const r = ratioByKey(key);
                    return (
                      <div key={platform}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          {t(
                            "app.marketingDesigner.publishModal.destinationFormat",
                            "{platform} gets {format}",
                            {
                              platform: t(`app.marketingDesigner.publishModal.${platform}`),
                              format: `${t(FORMAT_LABEL_KEYS[key] || "", r ? `${r.width}×${r.height}` : key)}${
                                slideCount > 1
                                  ? ` · ${t("app.marketingDesigner.publishModal.slideCount", { value: slideCount })}`
                                  : ""
                              }`,
                            },
                          )}
                        </p>
                        <div className="rounded-lg border border-border bg-muted flex items-center gap-2 overflow-x-auto p-2 min-h-[120px]">
                          {(!entry || entry.status === "loading") && (
                            <Loader2 size={20} className="animate-spin text-muted-foreground mx-auto" />
                          )}
                          {entry?.status === "failed" && (
                            <p className="text-xs text-muted-foreground p-4 text-center w-full">
                              {t("app.marketingDesigner.publishModal.previewError")}
                            </p>
                          )}
                          {entry?.status === "ready" &&
                            entry.items.map((item, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={item.dataUrl}
                                alt={t("app.marketingDesigner.publishModal.previewAlt")}
                                className={`${slideCount > 1 ? "max-h-40" : "max-h-64 mx-auto"} w-auto object-contain shrink-0`}
                              />
                            ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            {placeholderCount > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1" data-publish-placeholders>
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                {t(
                  "app.marketingDesigner.publishModal.placeholdersBlock",
                  "This design still has {count} template placeholders (a review, a number, a photo…). Replace or delete them in the editor before it can be posted.",
                  { count: placeholderCount },
                )}
              </p>
            )}
            {wantsInstagram && imageCheck && !imageCheck.ok && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <TriangleAlert size={12} />
                {t("app.marketingDesigner.publishModal.imageNotCompliant")}
              </p>
            )}
            {platforms.facebook && facebookFeedCheck?.warnings.includes("feed_crop") && (
              <p
                data-facebook-feed-crop
                className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
              >
                <TriangleAlert size={12} />
                {t("app.marketingDesigner.publishModal.facebookFeedCrop")}
              </p>
            )}

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("app.marketingDesigner.publishModal.captionLabel")}
                </label>
                <span
                  className={`text-xs ${
                    captionCheck.counts.length > INSTAGRAM_CAPTION_SPEC.maxLength
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("app.marketingDesigner.publishModal.captionCount", {
                    length: captionCheck.counts.length,
                  })}
                </span>
              </div>

              {/* Read-only. What ships is what was approved — the server
                  refuses a request whose caption differs from the design's,
                  so an editable box here would be a control that appears to
                  work and doesn't. */}
              <p className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm whitespace-pre-wrap break-words text-foreground">
                {caption || t("app.marketingDesigner.publishModal.captionPlaceholder")}
              </p>
              {onOpenApproval && (
                <button
                  type="button"
                  onClick={onOpenApproval}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <PencilLine size={12} />
                  {t("app.marketingDesigner.publishModal.editWords", "Edit the words")}
                </button>
              )}
              {wantsInstagram && !captionCheck.ok && caption.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {captionCheck.errors
                    .filter((e) => e !== "empty")
                    .map((e) => (
                      <li key={e} className="text-xs text-amber-600 dark:text-amber-400">
                        {t(CAPTION_ERROR_KEYS[e] || e)}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {/* Scheduling — see docs/SOCIAL-SCHEDULING.md. Facebook holds a
                scheduled post itself (Meta's own native scheduler);
                Instagram never touches Meta until the moment this fires —
                FieldQuo's own queue and cron do the holding. Neither
                distinction is worth surfacing here: the contractor picked a
                date and time, and what happens behind it is this feature's
                job to get right, not theirs to reason about. */}
            <div className="border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={scheduleOn}
                  onChange={(e) => {
                    setScheduleOn(e.target.checked);
                    if (e.target.checked && !scheduleValue) {
                      // A sane default one hour out, so the picker never
                      // opens on a value that's already invalid (the
                      // "now" it would otherwise default to fails every
                      // window's minimum).
                      setScheduleValue(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
                    }
                  }}
                />
                <Clock size={13} />
                {t("app.marketingDesigner.publishModal.scheduleToggle", "Schedule for later")}
              </label>
              {scheduleOn && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    min={toLocalInputValue(scheduleBounds(new Date()).min)}
                    max={toLocalInputValue(scheduleBounds(new Date()).max)}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(
                      "app.marketingDesigner.publishModal.scheduleHint",
                      "Facebook: 10 minutes to 75 days out. Instagram: at least 5 minutes out — FieldQuo holds it and posts it for you at the right moment.",
                    )}
                  </p>
                  {!scheduleOk && scheduleValue && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <TriangleAlert size={12} />
                      {t("app.marketingDesigner.publishModal.scheduleInvalid", "Choose a time inside the windows above.")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Demo-only — see the mock badge above. Lets an operator show
                the two failure states a real account can hit without
                waiting for either to happen naturally. */}
            {connection?.mock && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("app.marketingDesigner.publishModal.simulateFailureLabel", "Simulate a failure (demo)")}
                </label>
                <select
                  value={mockFailure}
                  onChange={(e) => setMockFailure(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                >
                  <option value="none">
                    {t("app.marketingDesigner.publishModal.simulateFailureNone", "None — succeed normally")}
                  </option>
                  <option value="rate_limited">
                    {t("app.marketingDesigner.publishModal.simulateFailureRateLimited", "Meta's posting limit reached")}
                  </option>
                  <option value="container_error">
                    {t("app.marketingDesigner.publishModal.simulateFailureContainerError", "Meta rejects the image")}
                  </option>
                </select>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {t("app.marketingDesigner.publishModal.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handlePublish()}
                disabled={!canSubmit}
                className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {submitting
                  ? t("app.marketingDesigner.publishModal.publishing")
                  : scheduleOn
                    ? t("app.marketingDesigner.publishModal.confirmSchedule", "Schedule")
                    : t("app.marketingDesigner.publishModal.confirm")}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            {Object.entries(results).map(([platform, r]) => (
              <ResultRow
                key={platform}
                platform={platform}
                result={r}
                t={t}
                submitting={submitting}
                onRetry={() => handlePublish(platform)}
                canConnect={canConnect}
              />
            ))}
            {submitError && (
              <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-border rounded-full px-4 py-2.5 text-sm font-semibold mt-2"
            >
              {t("app.marketingDesigner.publishModal.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// A failure code the modal has its own words for — Meta's refusals, sorted by
// what the contractor has to DO (lib/social/metaSpecs.js's
// classifyMetaPublishError). Any other code keeps showing the server's own
// sentence, as it always has — and so does a known code in a language that
// somehow lacks the key: the server's English sentence is the fallback, not a
// third copy of it kept here.
const FAILURE_KEYS = {
  meta_auth: "app.marketingDesigner.publishModal.failureMetaAuth",
  meta_permission: "app.marketingDesigner.publishModal.failureMetaPermission",
  meta_account: "app.marketingDesigner.publishModal.failureMetaAccount",
  meta_media_unreachable: "app.marketingDesigner.publishModal.failureMediaUnreachable",
  meta_media_shape: "app.marketingDesigner.publishModal.failureMediaShape",
  meta_media_rejected: "app.marketingDesigner.publishModal.failureMediaRejected",
  meta_transient: "app.marketingDesigner.publishModal.failureMetaTransient",
  meta_error: "app.marketingDesigner.publishModal.failureMetaError",
};

// The codes whose fix is on the connection, not the post — they get a way to
// the settings screen instead of a retry that would fail identically.
const SETTINGS_FIX_CODES = new Set(["meta_auth", "meta_permission", "meta_account"]);

// Meta's own reply, verbatim and in Meta's language, plus the numbers support
// needs (code/subcode and the fbtrace_id Meta asks for when you report a
// problem). Shown small, under the plain-language line — not instead of it.
function metaReplyLine(meta) {
  if (!meta) return "";
  const text = meta.userMsg || meta.message || "";
  const numbers = [meta.code != null ? `${meta.code}${meta.subcode != null ? `/${meta.subcode}` : ""}` : "", meta.fbtraceId || ""]
    .filter(Boolean)
    .join(" · ");
  return [text, numbers ? `(${numbers})` : ""].filter(Boolean).join(" ");
}

function ResultRow({ platform, result, t, submitting, onRetry, canConnect }) {
  // The settings link follows the not-connected panel's rule: only for someone
  // that screen would let in (canConnect, above). Everyone else still reads the
  // sentence, which says what has to be fixed.
  const settingsLink = canConnect && SETTINGS_FIX_CODES.has(result.code);
  const platformLabel = platform === "instagram" ? "Instagram" : "Facebook";

  // The server's own feed-crop warning on a post that DID go out (or is
  // queued) — the same sentence the pre-post check showed, so a contractor who
  // posted anyway still has it on the result.
  const feedCrop = Array.isArray(result.warnings) && result.warnings.includes("feed_crop") ? (
    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
      <TriangleAlert size={12} />
      {t("app.marketingDesigner.publishModal.facebookFeedCrop")}
    </p>
  ) : null;

  if (result.status === "published") {
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground">
        <Check size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <span>{t("app.marketingDesigner.publishModal.resultPublished", { platform: platformLabel })}</span>
          {feedCrop}
        </div>
      </div>
    );
  }

  if (result.status === "scheduled") {
    const when = result.scheduledFor ? new Date(result.scheduledFor) : null;
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <span>
            {when && !Number.isNaN(when.getTime())
              ? t("app.marketingDesigner.publishModal.resultScheduled", {
                  platform: platformLabel,
                  when: when.toLocaleString(),
                })
              : t("app.marketingDesigner.publishModal.resultScheduledNoTime", { platform: platformLabel })}
          </span>
          {feedCrop}
        </div>
      </div>
    );
  }

  const metaReply = metaReplyLine(result.meta);

  if (result.status === "rate_limited") {
    return (
      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <span>{t("app.marketingDesigner.publishModal.resultRateLimited", { platform: platformLabel })}</span>
          {metaReply && (
            <p className="text-xs opacity-90">
              {t("app.marketingDesigner.publishModal.metaReply", "Meta's reply: {reply}", { reply: metaReply })}
            </p>
          )}
        </div>
      </div>
    );
  }

  const known = FAILURE_KEYS[result.code];
  const message = known ? t(known, result.message || "") : result.message || "";

  return (
    <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 space-y-2">
      <div className="flex items-start gap-2">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <span>
            {t("app.marketingDesigner.publishModal.resultFailed", {
              platform: platformLabel,
              message,
            })}
          </span>
          {metaReply && (
            <p className="text-xs opacity-90 break-words">
              {t("app.marketingDesigner.publishModal.metaReply", "Meta's reply: {reply}", { reply: metaReply })}
            </p>
          )}
        </div>
      </div>
      {(result.retryable || settingsLink) && (
        <div className="flex flex-wrap gap-2 pl-6">
          {result.retryable && (
            <button
              type="button"
              onClick={onRetry}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-full border border-current px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              {t("app.marketingDesigner.publishModal.retryPlatform", "Try {platform} again", { platform: platformLabel })}
            </button>
          )}
          {settingsLink && (
            <Link
              href={SOCIAL_SETTINGS_PATH}
              className="inline-flex items-center rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
            >
              {t("app.marketingDesigner.publishModal.openConnectionSettings", "Open connection settings")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
