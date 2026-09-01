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
  Zap,
  FileText,
  CalendarDays,
  Megaphone,
  Globe,
  Phone,
  MessageCircle,
  Mail,
  Star,
  Info,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { linkPageUrl } from "@/lib/links/href";

const ICONS = {
  instant: Zap,
  quote: FileText,
  book: CalendarDays,
  site: Globe,
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  review: Star,
};

function iconFor(key) {
  if (key.startsWith("funnel:")) return Megaphone;
  if (key.startsWith("custom:")) return Link2;
  return ICONS[key] || Link2;
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
  const [links, setLinks] = useState([]);

  const apply = useCallback((json) => {
    setData(json);
    setPublished(json.published !== false);
    setHeadline(json.headline || "");
    setBio(json.bio || "");
    setLinks(json.links || []);
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
          items: links.map((l) => ({
            key: l.key,
            enabled: l.enabled,
            label: l.label,
            // Only a custom row owns its URL; for everything else the server
            // derives it and would ignore this anyway.
            ...(l.key.startsWith("custom:") ? { url: l.url } : {}),
          })),
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

  function patchLink(index, patch) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addCustom() {
    setLinks((prev) => [
      ...prev,
      // The key is provisional. The server re-assigns custom keys from their
      // position on save, so this only has to be unique in the browser.
      { key: `custom:new-${prev.length}`, kind: "custom", label: "", url: "", enabled: true },
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

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.bioLink", "Bio link")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setBioLink.subtitle",
            "One page for the single link Instagram and TikTok allow in your profile. It carries your logo and your colour — nothing on it says FieldQuo.",
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
            const Icon = iconFor(link.key);
            const custom = link.key.startsWith("custom:");
            return (
              <li
                key={link.key}
                className="border border-border rounded-lg p-3 flex items-start gap-3"
              >
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
                    <input
                      value={link.url}
                      onChange={(e) => patchLink(index, { url: e.target.value })}
                      placeholder="https://instagram.com/…"
                      inputMode="url"
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  )}
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
        {incomplete && (
          <span className="text-xs text-muted-foreground mr-auto">
            {t("app.setBioLink.incomplete", "Your own links need both text and a URL.")}
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
