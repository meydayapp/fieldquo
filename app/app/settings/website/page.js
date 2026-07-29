// app/app/settings/website/page.js
//
// Settings → Website. Interview, generate, edit, publish.
//
// ── Three states, not a wizard ──────────────────────────────────────────────
//
//   setup     no site yet — four questions and a Generate button
//   editing   blocks exist — edit text and images, preview, publish
//   live      published — same editor plus the address and an unpublish
//
// Deliberately not a multi-step wizard with progress dots. The company comes
// back to this screen months later to change a phone number, and a wizard
// makes that a five-step journey through questions they already answered.
//
// ── The preview is the real renderer ────────────────────────────────────────
//
// SiteBlocks is a server component, so it can't be dropped into this client
// page. Rather than reimplement it — which guarantees the preview and the live
// page drift — the preview is an iframe pointing at the real route. What they
// see is literally what a visitor gets.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Globe,
  Sparkles,
  Loader2,
  Save,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  ImagePlus,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { BLOCK_TYPES } from "@/app/data/siteBlocks";
// STYLE_PRESETS deliberately arrives from the API rather than being imported.
// lib/site/generateSite imports lib/ai/provider, which imports the `openai`
// package — importing it here would drag the whole SDK and its Node built-ins
// into the browser bundle for the sake of four strings.

export default function WebsiteSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [subdomain, setSubdomain] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [interview, setInterview] = useState({});
  const [seo, setSeo] = useState({ title: "", description: "" });

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/website");
      setData(d);
      setSubdomain(d.site?.subdomain || d.suggestedSubdomain || "");
      setBlocks(Array.isArray(d.site?.blocks) ? d.site.blocks : []);
      setInterview(d.site?.interview || {});
      setSeo({
        title: d.site?.seoTitle || "",
        description: d.site?.seoDescription || "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError("");
    setNote("");
    try {
      const result = await fetchJson("/api/settings/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interview }),
      });
      setBlocks(result.blocks || []);
      if (result.seoTitle) setSeo((s) => ({ ...s, title: result.seoTitle }));
      if (result.seoDescription)
        setSeo((s) => ({ ...s, description: result.seoDescription }));
      // Said plainly when the factual fallback was used. Passing a
      // non-generated draft off as AI output is how trust in the button dies.
      setNote(
        result.note ||
          (result.generated
            ? ""
            : "This draft is built from your saved details — the writing assistant wasn't available."),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function save({ published } = {}) {
    setSaving(true);
    setError("");
    try {
      const saved = await fetchJson("/api/settings/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain,
          blocks,
          interview,
          seoTitle: seo.title,
          seoDescription: seo.description,
          ...(typeof published === "boolean" ? { published } : {}),
        }),
      });
      setData((d) => ({ ...d, site: saved }));
      // Force the preview iframe to re-fetch; it renders the saved row, not
      // this page's state.
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function patchBlock(id, patch) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, content: { ...b.content, ...patch } } : b,
      ),
    );
  }

  function toggleBlock(id) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: b.visible === false } : b)),
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-6 w-48 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const site = data?.site;
  const hasBlocks = blocks.length > 0;
  const isLive = Boolean(site?.published);
  const url = `https://${subdomain}.fieldquo.com`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your website</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A one-page site at your own address, using your logo and brand colour.
          Free, and it links straight to your quote form.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {isLive && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300 min-w-0">
            <Globe size={16} className="shrink-0" />
            <span className="font-medium truncate">{url}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 border border-green-300 dark:border-green-800 rounded-full px-3 py-1.5 text-xs font-semibold text-green-800 dark:text-green-300"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-green-300 dark:border-green-800 rounded-full px-3 py-1.5 text-xs font-semibold text-green-800 dark:text-green-300"
            >
              <ExternalLink size={12} /> Open
            </a>
          </div>
        </div>
      )}

      {/* ── Interview ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-1">
          Tell us about the business
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Skip any of these — we&apos;ll still build the site from your
          services, hours and contact details, it&apos;ll just read plainer.
        </p>

        <div className="space-y-4">
          {(data?.questions || []).map((q) => (
            <div key={q.key}>
              <label className="text-sm font-medium text-foreground block mb-1">
                {q.label}
              </label>

              {/* Presets write text into the field rather than setting a hidden
                  parameter, so the company can see exactly what's being asked
                  for and edit it. A preset with an invisible effect is a
                  control nobody can reason about. */}
              {q.key === "style" && (data?.stylePresets || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {data.stylePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setInterview((p) => ({ ...p, style: preset.text }))
                      }
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        interview.style === preset.text
                          ? "border-foreground bg-inverted text-inverted-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={interview[q.key] || ""}
                onChange={(e) =>
                  setInterview((p) => ({ ...p, [q.key]: e.target.value }))
                }
                rows={q.long ? 3 : 2}
                placeholder={q.placeholder}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />

              {q.key === "style" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Changes the wording and the layout. Colours and your logo
                  always come from Settings → Branding.
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="mt-4 inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {generating ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {hasBlocks ? "Rewrite the page" : "Build my site"}
        </button>

        {hasBlocks && (
          <p className="text-xs text-muted-foreground mt-2">
            Rewriting replaces the text below. Your photos and any services you
            added stay.
          </p>
        )}

        {note && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{note}</p>
        )}
      </div>

      {/* ── Blocks ────────────────────────────────────────────────────── */}
      {hasBlocks && (
        <>
          {blocks.map((block) => (
            <BlockEditor
              key={block.id}
              block={block}
              onChange={(patch) => patchBlock(block.id, patch)}
              onToggle={() => toggleBlock(block.id)}
              onError={setError}
            />
          ))}

          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-foreground">Your web address</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={subdomain}
                onChange={(e) =>
                  setSubdomain(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
                className="flex-1 min-w-[10rem] border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
              <span className="text-sm text-muted-foreground">.fieldquo.com</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers and dashes. Choose carefully — once
              it&apos;s printed on a van, changing it breaks every link.
            </p>

            <div className="pt-2 space-y-2">
              <input
                value={seo.title}
                onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))}
                placeholder="Title shown in Google results"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
              <textarea
                value={seo.description}
                onChange={(e) =>
                  setSeo((s) => ({ ...s, description: e.target.value }))
                }
                rows={2}
                placeholder="The sentence under the title in Google results"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
            </div>
          </div>

          {/* The real route in an iframe — see the note at the top of this
              file. Only meaningful once something is saved. */}
          {site && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Preview</h2>
                <span className="text-xs text-muted-foreground">
                  {isLive ? "Live" : "Saved but not published"}
                </span>
              </div>
              {/* `?preview=1` renders an unpublished page for a signed-in
                  member of this company — see app/site/[subdomain]/page.js.
                  Without it the only way to see your own site was to publish
                  it, which is the opposite of what a preview is for.

                  Still the real route in an iframe, so this is literally what
                  a visitor gets. */}
              <iframe
                key={previewKey}
                src={`/site/${site.subdomain}${isLive ? "" : "?preview=1"}`}
                title="Website preview"
                className="w-full h-[520px] bg-white"
              />
              <p className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border">
                {isLive
                  ? "This is your live site."
                  : "Nobody else can see this until you publish. Save to refresh the preview."}
              </p>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border px-4 sm:px-6 py-3 flex items-center justify-end gap-2 z-40">
            {isLive && (
              <button
                type="button"
                onClick={async () => {
                  await fetchJson("/api/settings/website", { method: "DELETE" });
                  load();
                }}
                className="inline-flex items-center gap-1.5 border border-border px-4 py-2.5 rounded-full text-sm font-semibold"
              >
                <EyeOff size={14} /> Unpublish
              </button>
            )}
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 border border-border px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => save({ published: true })}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <Eye size={14} /> {isLive ? "Update site" : "Publish"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** One block. Text fields, an optional image, and a show/hide toggle. */
function BlockEditor({ block, onChange, onToggle, onError }) {
  const def = BLOCK_TYPES[block.type];
  if (!def) return null;

  const hidden = block.visible === false;

  return (
    <div
      className={`bg-card border border-border rounded-xl p-5 ${hidden ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground">{def.label}</h2>
        {/* Required blocks can't be hidden: a page with no header or no way to
            contact anyone isn't a shorter site, it's a broken one. */}
        {!def.required && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
            {hidden ? "Show" : "Hide"}
          </button>
        )}
      </div>

      {!hidden && (
        <div className="space-y-3">
          {/* Layout choice. A closed set — every option here was designed and
              checked on a phone, so there is no combination that produces a
              broken page. */}
          {def.variants && (
            <div className="flex flex-wrap gap-1.5">
              {def.variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ variant: v })}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                    (block.content.variant || def.defaults.variant) === v
                      ? "border-foreground bg-inverted text-inverted-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {VARIANT_LABELS[v] || v}
                </button>
              ))}
            </div>
          )}

          {/* Says where the content actually comes from. The alternative — a
              block with a heading field and nothing else — reads as an editor
              that lost the rest of the form. */}
          {def.derived && (
            <p className="text-xs text-muted-foreground">
              {DERIVED_NOTES[block.type]}
            </p>
          )}

          {(def.editable || []).map((field) => {
            const long = field === "body" || field === "intro";
            return long ? (
              <textarea
                key={field}
                value={block.content[field] || ""}
                onChange={(e) => onChange({ [field]: e.target.value })}
                rows={field === "body" ? 6 : 2}
                placeholder={labelFor(field)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
            ) : (
              <input
                key={field}
                value={block.content[field] || ""}
                onChange={(e) => onChange({ [field]: e.target.value })}
                placeholder={labelFor(field)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
              />
            );
          })}

          {def.image && (
            <ImageField
              value={block.content[def.image]}
              onChange={(url) => onChange({ [def.image]: url })}
              onError={onError}
            />
          )}

          {def.repeats === "images" && (
            <ImageList
              images={block.content.images || []}
              onChange={(images) => onChange({ images })}
              onError={onError}
            />
          )}

          {def.repeats === "items" && (
            <div className="space-y-2">
              {(block.content.items || []).map((item, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                  {(def.itemEditable || []).map((k) => (
                    <input
                      key={k}
                      value={item[k] || ""}
                      onChange={(e) => {
                        const items = [...block.content.items];
                        items[i] = { ...items[i], [k]: e.target.value };
                        onChange({ items });
                      }}
                      placeholder={labelFor(k)}
                      className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card"
                    />
                  ))}
                </div>
              ))}
              {(block.content.items || []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {block.type === "testimonials"
                    ? "Approved testimonials appear here automatically."
                    : "Your enabled services appear here automatically."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageField({ value, onChange, onError }) {
  const [busy, setBusy] = useState(false);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await fetchJson("/api/upload", { method: "POST", body: form });
      onChange(data.url);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-20 w-32 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 text-muted-foreground"
            aria-label="Remove image"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="h-20 w-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer text-muted-foreground">
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <ImagePlus size={18} />
              <span className="text-[11px] mt-1">Add photo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}

function ImageList({ images, onChange, onError }) {
  const [busy, setBusy] = useState(false);

  async function upload(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files).slice(0, 12)) {
        const form = new FormData();
        form.append("file", file);
        const data = await fetchJson("/api/upload", {
          method: "POST",
          body: form,
        });
        uploaded.push(data.url);
      }
      onChange([...images, ...uploaded].slice(0, 24));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-20 w-20 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 text-muted-foreground"
            aria-label="Remove photo"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <label className="h-20 w-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer text-muted-foreground">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </label>
    </div>
  );
}

const VARIANT_LABELS = {
  centered: "Centred",
  split: "Photo beside",
  banner: "Full-width photo",
  cards: "Cards",
  list: "List",
  numbered: "Numbered",
};

const DERIVED_NOTES = {
  quoteform:
    "The form itself is built from your enabled services — the same ones the quote builder uses. Nothing to set up here.",
  booking:
    "Shows real available times from your booking availability. Change them in Settings → Company.",
  hours:
    "Pulled from your opening hours in Settings → Company, so changing them there updates the site and your Google listing at once.",
};

function labelFor(field) {
  return (
    {
      headline: "Headline",
      subhead: "One line under the headline",
      ctaLabel: "Button text",
      heading: "Section heading",
      intro: "Short intro",
      note: "Anything else — e.g. 24/7 for emergencies",
      body: "Write a few sentences about the business",
      name: "Service name",
      description: "What this involves",
      quote: "What they said",
      author: "Who said it",
    }[field] || field
  );
}
