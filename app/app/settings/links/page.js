"use client";

// app/app/settings/links/page.js
//
// The bio link — the one link Instagram and TikTok allow in a profile, and
// everything the contractor can point it at.
//
// ── The URL is the product, so it is the first thing on the screen ──────────
//
// Everything else here is tuning. The reason anyone opens this page is to get
// a string into a phone's clipboard, so that string sits at the top, big,
// with a copy button — not at the bottom under the settings that produced it.
//
// (No QR code beside it, deliberately: there is no QR library in package.json
// and this screen is not the reason to add one. When one arrives for another
// feature, the square goes next to the copy button.)
//
// ── Why the list shows what ISN'T available too ─────────────────────────────
//
// A contractor with no event types will look for "Book a visit", not find it,
// and conclude the feature is broken. The greyed rows say which screen would
// create it. Silence about an absence reads as a bug; a sentence reads as a
// next step.
//
// ── Nothing here is saved until Save is pressed ─────────────────────────────
//
// Deliberately not autosave, unlike most settings screens in this app. Reorder
// plus rename plus switch-off is a multi-step edit of one published page, and
// autosaving each keystroke would put half-finished states in front of whoever
// taps the link in between.
//
// ── Reorder: drag with a mouse, arrows with a keyboard ──────────────────────
//
// The HTML drag-and-drop API, not a library — the leads board uses dnd-kit
// because its cards cross columns; a single column of ten rows does not need
// it. HTML DnD has two known limits, and both are handled rather than hoped
// past: it does not fire on touch in most mobile browsers, so the Up/Down
// buttons stay and are the keyboard path too; and a `draggable` ancestor
// steals text selection from the inputs inside it in Firefox, so a row is
// only draggable while its grip is held.

import { useCallback, useEffect, useState } from "react";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  Info,
  GripVertical,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { linkPageUrl } from "@/lib/links/href";
import { SOCIAL_PLATFORMS, SOCIAL_NAMES, socialHref } from "@/lib/links/social";
import { CUSTOM_ICON_NAMES } from "@/lib/links/icons";
import { iconForLink, SocialGlyph } from "@/app/components/links/linkIcons";

const GROUP_KEYS = {
  price: ["app.setBioLink.group.price", "Get a price"],
  book: ["app.setBioLink.group.book", "Book"],
  contact: ["app.setBioLink.group.contact", "Contact"],
  more: ["app.setBioLink.group.more", "More"],
};

function emptySocials() {
  return Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, ""]));
}

export default function BioLinkSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [data, setData] = useState(null);

  // The editable copy. Kept separate from `data` so Cancel-by-reload is always
  // possible and so the screen can tell "what is stored" from "what is typed".
  const [published, setPublished] = useState(true);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  // Labelled rows only; the icon row is `socials`, one field per platform.
  const [links, setLinks] = useState([]);
  const [socials, setSocials] = useState(emptySocials);

  // Drag state. `armed` is the row whose grip is currently held (the only row
  // that is `draggable`); `dragging`/`over` are the indices of the row in
  // flight and the row under it.
  const [armed, setArmed] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);

  const apply = useCallback((json) => {
    setData(json);
    setPublished(json.published !== false);
    setHeadline(json.headline || "");
    setBio(json.bio || "");
    const all = json.links || [];
    setLinks(all.filter((l) => l.kind !== "social"));
    const next = emptySocials();
    for (const l of all) {
      if (l.kind === "social" && l.platform in next) next[l.platform] = l.url || "";
    }
    setSocials(next);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/links");
    if (!res.ok) {
      await reportResponseError(res, t("app.setBioLink.loadError", "Couldn't load your bio link page."));
      return;
    }
    apply(await res.json());
  }, [apply, t]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load().finally(() => setLoading(false));
  }, [load]);

  const url = data?.slug ? linkPageUrl(origin, data.slug) : "";

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          published,
          headline,
          bio,
          items: [
            // Social first, by convention only — the server keys them by
            // platform and the page paints them in a fixed order regardless.
            ...SOCIAL_PLATFORMS.filter((p) => socials[p].trim()).map((p) => ({
              key: `social:${p}`,
              enabled: true,
              url: socials[p].trim(),
            })),
            ...links.map((l) => ({
              key: l.key,
              enabled: l.enabled,
              label: l.label,
              // Only a custom row owns its URL and icon; for everything else
              // the server derives them and would ignore this anyway.
              ...(l.key.startsWith("custom:") ? { url: l.url, icon: l.icon || null } : {}),
            })),
          ],
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setBioLink.saveError", "Couldn't save."));
        // Show what IS stored rather than the edit that was refused.
        await load();
        return;
      }
      apply(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function move(index, by) {
    setLinks((prev) => {
      const next = [...prev];
      const to = index + by;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  // Insert, not swap: dragging row 0 onto row 4 means "put it after the
  // fourth", and every row in between shifts up by one.
  function moveTo(from, to) {
    if (from === to || from == null || to == null) return;
    setLinks((prev) => {
      const next = [...prev];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  function endDrag() {
    setArmed(null);
    setDragging(null);
    setOver(null);
  }

  function patchLink(index, patch) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addCustom() {
    setLinks((prev) => [
      ...prev,
      // The key is provisional. The server re-assigns custom keys from their
      // position on save, so this only has to be unique in the browser.
      { key: `custom:new-${prev.length}`, kind: "custom", label: "", url: "", icon: null, enabled: true, group: "more" },
    ]);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-7 w-40 bg-accent rounded" />
        <div className="h-24 bg-accent rounded-xl" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto text-sm text-muted-foreground">
        {t("app.setBioLink.loadError", "Couldn't load your bio link page.")}
      </div>
    );
  }

  const customCount = links.filter((l) => l.key.startsWith("custom:")).length;
  // A custom row with no words or no destination can't be saved — the server
  // drops it. Say so here rather than letting it vanish on save.
  const incomplete = links.some(
    (l) => l.key.startsWith("custom:") && (!l.label.trim() || !l.url.trim()),
  );
  // Same honesty for a social field: the server refuses what socialHref
  // refuses, and a field that silently empties itself on save is a control
  // that appears to work and doesn't.
  const socialProblems = SOCIAL_PLATFORMS.filter(
    (p) => socials[p].trim() && !socialHref(p, socials[p]),
  );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.bioLink", "Bio link")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setBioLink.subtitle",
            "One page for the single link Instagram and TikTok allow in your profile. It carries your logo and your colour, with a small “Made by FieldQuo” line at the very bottom.",
          )}
        </p>
      </div>

      {/* ── The URL ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="mt-0.5 text-muted-foreground shrink-0">
            <Link2 size={17} />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">
              {t("app.setBioLink.yourLink", "Your link")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {published
                ? t("app.setBioLink.live", "Paste this into your Instagram or TikTok bio.")
                : t("app.setBioLink.down", "The page is switched off — this link shows a not-found page.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-0 truncate bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground">
            {url}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground shrink-0"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t("app.action.copied") : t("app.action.copyLink")}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground shrink-0"
          >
            <ExternalLink size={13} /> {t("app.setLeadForm.open")}
          </a>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4"
          />
          {t("app.setBioLink.publishedLabel", "Page is live")}
        </label>
      </div>

      {/* ── Header copy ── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            {t("app.setBioLink.headline", "Heading")}
          </label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={80}
            placeholder={data.companyName}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.setBioLink.headlineHint", "Leave it empty to use your company name.")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">
            {t("app.setBioLink.bio", "One line under it")}
          </label>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            placeholder={t("app.setBioLink.bioPlaceholder", "Kitchen refinishing across Ottawa–Gatineau")}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("app.setBioLink.bioHint", "Optional. Empty means nothing is shown — we don't write one for you.")}
          </p>
        </div>
      </div>

      {/* ── The icon row ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">
          {t("app.setBioLink.followTitle", "Follow us")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          {t(
            "app.setBioLink.followHint",
            "A row of icons under your name. Type a handle or paste the profile link; leave one empty to hide it.",
          )}
        </p>
        <ul className="space-y-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const value = socials[platform];
            const bad = socialProblems.includes(platform);
            return (
              <li key={platform} className="flex items-center gap-3">
                <span className="w-7 shrink-0 text-muted-foreground" aria-hidden="true">
                  <SocialGlyph platform={platform} size={18} />
                </span>
                <label className="sr-only" htmlFor={`social-${platform}`}>
                  {SOCIAL_NAMES[platform]}
                </label>
                <div className="min-w-0 flex-1">
                  <input
                    id={`social-${platform}`}
                    value={value}
                    onChange={(e) =>
                      setSocials((prev) => ({ ...prev, [platform]: e.target.value }))
                    }
                    maxLength={300}
                    placeholder={`${SOCIAL_NAMES[platform]} — ${t("app.setBioLink.socialPlaceholder", "@handle or link")}`}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={bad || undefined}
                    className={`w-full bg-background border rounded-lg px-2.5 py-1.5 text-sm text-foreground ${bad ? "border-red-500" : "border-border"}`}
                  />
                  {bad && (
                    <p className="text-xs text-red-600 mt-1">
                      {t(
                        "app.setBioLink.socialInvalid",
                        "Doesn't look like a handle or a profile link — it won't be saved.",
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── The links ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground">
          {t("app.setBioLink.linksTitle", "What's on the page")}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          {t(
            "app.setBioLink.linksHint",
            "The first one is the big button. Only things you actually have show up here.",
          )}
        </p>

        <ul className="space-y-2">
          {links.map((link, index) => {
            const Icon = iconForLink(link);
            const custom = link.key.startsWith("custom:");
            const [groupKey, groupFallback] = GROUP_KEYS[link.group] || GROUP_KEYS.more;
            const isOver = over === index && dragging !== null && dragging !== index;
            return (
              <li
                key={link.key}
                draggable={armed === index}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox refuses to start a drag with no data on it.
                  e.dataTransfer.setData("text/plain", link.key);
                  setDragging(index);
                }}
                onDragOver={(e) => {
                  if (dragging === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== index) setOver(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  moveTo(dragging, index);
                  endDrag();
                }}
                onDragEnd={endDrag}
                className={`border rounded-lg p-3 flex items-start gap-3 ${
                  isOver ? "border-foreground" : "border-border"
                } ${dragging === index ? "opacity-50" : ""}`}
              >
                {/* Held, not clicked: `draggable` is set on the row only
                    while this is pressed, so the inputs beside it keep
                    their text selection. Hidden from assistive tech — the
                    arrows below are the accessible way to do the same thing. */}
                <span
                  onMouseDown={() => setArmed(index)}
                  onMouseUp={() => setArmed(null)}
                  onMouseLeave={() => dragging === null && setArmed(null)}
                  title={t("app.setBioLink.dragHandle", "Drag to reorder")}
                  aria-hidden="true"
                  className="hidden sm:flex mt-2 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
                >
                  <GripVertical size={16} />
                </span>
                <input
                  type="checkbox"
                  checked={link.enabled}
                  onChange={(e) => patchLink(index, { enabled: e.target.checked })}
                  aria-label={t("app.setBioLink.showOnPage", "Show on the page")}
                  className="h-4 w-4 mt-2.5 shrink-0"
                />
                <Icon size={16} className="mt-2.5 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={link.label}
                    onChange={(e) => patchLink(index, { label: e.target.value })}
                    maxLength={60}
                    placeholder={t("app.setBioLink.buttonText", "Button text")}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground"
                  />
                  {custom ? (
                    <>
                      <input
                        value={link.url}
                        onChange={(e) => patchLink(index, { url: e.target.value })}
                        placeholder="https://instagram.com/…"
                        inputMode="url"
                        className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                      />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{t("app.setBioLink.icon", "Icon")}</span>
                        <select
                          value={link.icon || ""}
                          onChange={(e) => patchLink(index, { icon: e.target.value || null })}
                          className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">—</option>
                          {CUSTOM_ICON_NAMES.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  )}
                  {/* Which heading the row sits under on the page. Derived
                      server-side from what the row is — not editable, so it
                      is a tag rather than a picker. */}
                  <span className="inline-block text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t(groupKey, groupFallback)}
                  </span>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={t("app.setBioLink.moveUp", "Move up")}
                    className="p-1.5 rounded-md border border-border text-muted-foreground disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === links.length - 1}
                    aria-label={t("app.setBioLink.moveDown", "Move down")}
                    className="p-1.5 rounded-md border border-border text-muted-foreground disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>
                  {custom && (
                    <button
                      type="button"
                      onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={t("app.action.delete", "Delete")}
                      className="p-1.5 rounded-md border border-border text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={addCustom}
          disabled={customCount >= 10}
          className="mt-3 inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-40"
        >
          <Plus size={13} /> {t("app.setBioLink.addCustom", "Add your own link")}
        </button>

        {data.unavailable?.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("app.setBioLink.notYet", "Not available yet")}
            </p>
            <ul className="space-y-1.5">
              {data.unavailable.map((u) => (
                <li key={u.key} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>{u.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sticky, because the list above is long on a phone and a Save button
          you have to scroll to find is one people don't press.
          bottom-0 alone used to land this directly on top of MobileTabBar
          below `lg` (both fixed to the viewport bottom) — the save button
          rendered under the tab bar's Jobs/Invoices row. The calc clears
          the tab bar's exact height (its own h-16 + safe-area inset, see
          app/components/layout/MobileTabBar.js); lg:bottom-0 restores the
          true bottom once the tab bar stops rendering. */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0 inset-x-0 lg:left-64 border-t border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3 justify-end">
        {(incomplete || socialProblems.length > 0) && (
          <span className="text-xs text-muted-foreground mr-auto">
            {incomplete
              ? t("app.setBioLink.incomplete", "Your own links need both text and a URL.")
              : t("app.setBioLink.socialIncomplete", "A social field won't be saved as typed.")}
          </span>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <Check size={13} /> {t("app.action.saved", "Saved")}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.action.save", "Save")}
        </button>
      </div>
    </div>
  );
}
