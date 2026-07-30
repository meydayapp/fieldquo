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
  Monitor,
  Smartphone,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { BLOCK_TYPES, BLOCK_ORDER, makeBlock } from "@/app/data/siteBlocks";
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
  const [device, setDevice] = useState("desktop"); // desktop | mobile
  const [aiOpen, setAiOpen] = useState(true);
  const [styleKey, setStyleKey] = useState("modern");
  // What SHAPE the last generation produced, and what it had to leave out.
  // Surfaced rather than swallowed: a company that asked for a photo-led page
  // and has no photos should be told that, not handed a shorter page.
  const [composition, setComposition] = useState(null);
  const [dropped, setDropped] = useState([]);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/website");
      setData(d);
      setSubdomain(d.site?.subdomain || d.suggestedSubdomain || "");
      setBlocks(Array.isArray(d.site?.blocks) ? d.site.blocks : []);
      setInterview(d.site?.interview || {});
      setStyleKey(d.site?.styleKey || "modern");
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

  /**
   * Apply a page shape without spending a token.
   *
   * Reorders the sections the page already has to match the preset and creates
   * any it's missing, keeping every block's CONTENT. Changing the layout should
   * not cost a generation and should not throw away the words — those are two
   * different decisions and the button only makes one of them.
   */
  function reshape(preset) {
    const wanted = preset.sections || [];
    const byType = new Map();
    for (const b of blocks) {
      if (!byType.has(b.type)) byType.set(b.type, b);
    }
    const next = [];
    for (const type of wanted) {
      if (!BLOCK_TYPES[type]) continue;
      const existing = byType.get(type);
      if (existing) {
        byType.delete(type);
        next.push(existing);
      } else {
        next.push(makeBlock(type));
      }
    }
    // Anything the preset doesn't mention is kept, hidden, at the end rather
    // than deleted — the company may have written copy into it, and a layout
    // change that silently destroys text is a destructive op labelled cosmetic.
    for (const leftover of byType.values()) {
      next.push({ ...leftover, visible: false });
    }
    setBlocks(next);
    setComposition(preset.key);
    setNote("Layout changed. Press Save to update the preview.");
  }

  function addSection(type) {
    if (!BLOCK_TYPES[type]) return;
    // Before the contact block, which is always last.
    setBlocks((prev) => {
      const next = [...prev];
      const contactAt = next.findIndex((b) => b.type === "contact");
      const block = makeBlock(type);
      if (contactAt === -1) next.push(block);
      else next.splice(contactAt, 0, block);
      return next;
    });
    setNote("Section added. Press Save to update the preview.");
  }

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
      const newBlocks = result.blocks || [];
      // The AI picked a design style from the description — adopt it so the
      // LOOK changes, not just the words.
      const newStyle = result.styleKey || styleKey;
      setStyleKey(newStyle);
      setComposition(result.composition || null);
      setDropped(Array.isArray(result.droppedSections) ? result.droppedSections : []);
      const newSeo = {
        title: result.seoTitle || seo.title,
        description: result.seoDescription || seo.description,
      };
      setBlocks(newBlocks);
      setSeo(newSeo);
      // Said plainly when the factual fallback was used. Passing a
      // non-generated draft off as AI output is how trust in the button dies.
      setNote(
        result.note ||
          (result.generated
            ? ""
            : "This draft is built from your saved details — the writing assistant wasn't available."),
      );

      // Persist the draft immediately. The preview iframe renders the SAVED
      // row, not this page's state — so without this, a company generates,
      // sees the preview unchanged, and concludes nothing happened. Saving
      // also keeps any newly-added block types (FAQ, booking). Best-effort:
      // if the subdomain is taken the manual Save still works.
      try {
        const saved = await fetchJson("/api/settings/website", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subdomain,
            blocks: newBlocks,
            interview,
            styleKey: newStyle,
            seoTitle: newSeo.title,
            seoDescription: newSeo.description,
          }),
        });
        setData((d) => ({ ...d, site: saved }));
        setPreviewKey((k) => k + 1);
      } catch {
        setNote((n) => n || "Generated — pick an available address and press Save to see it in the preview.");
      }
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
          styleKey,
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
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-6 w-48 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const site = data?.site;
  const hasBlocks = blocks.length > 0;
  const isLive = Boolean(site?.published);
  const url = `https://${subdomain}.fieldquo.com`;
  const previewUrl = site ? `/site/${site.subdomain}${isLive ? "" : "?preview=1"}` : null;

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
      {/* ── Top toolbar: identity, status, actions ─────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Globe size={18} className="text-foreground shrink-0" />
          <h1 className="text-base font-bold text-foreground">Website builder</h1>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isLive
                ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isLive ? "Live" : hasBlocks ? "Draft" : "Not built"}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {hasBlocks && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
              <span className="hidden sm:inline">{subdomain}.fieldquo.com</span>
            </div>
          )}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ExternalLink size={13} /> <span className="hidden sm:inline">Open</span>
            </a>
          )}
          {hasBlocks && (
            <>
              <button
                type="button"
                onClick={() => save()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 border border-border rounded-full px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
              <button
                type="button"
                onClick={() => save({ published: true })}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-60"
              >
                <Eye size={13} /> {isLive ? "Update site" : "Publish"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {/* ── Two panes: editor (left) + live preview (right) ────────────── */}
      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="min-h-0 overflow-y-auto border-r border-border bg-background">
          <div className="p-4 sm:p-5 space-y-4">
            {/* AI panel */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left"
              >
                <span className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Sparkles size={16} style={{ color: "var(--brand,#7c3aed)" }} />
                  {hasBlocks ? "Rewrite with AI" : "Build my site with AI"}
                </span>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${aiOpen ? "rotate-180" : ""}`} />
              </button>

              {aiOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {/* THE PROMPT. Plain language in, a different-looking site
                      out — the AI picks the design style from these words. */}
                  <div>
                    <label className="text-sm font-bold text-foreground block mb-1.5">
                      Describe the website you want
                    </label>
                    <textarea
                      value={interview.style || ""}
                      onChange={(e) => setInterview((p) => ({ ...p, style: e.target.value }))}
                      rows={5}
                      placeholder={`e.g. Bold and industrial. Big headlines, hard edges. Lead with our before-and-after photos — we want to look like the biggest roofing crew in town.\n\nOr: quiet and high-end. Lots of white space, serif headings, one strong client quote near the top.`}
                      className="w-full border border-border rounded-xl px-3.5 py-3 text-sm bg-background leading-relaxed"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      This changes the <strong className="text-foreground">layout</strong> — which
                      sections the page has, what order they come in, and how it&apos;s
                      typeset — not just the words. Your logo and colours always come
                      from Branding.
                    </p>
                    {(data?.stylePresets || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {data.stylePresets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setInterview((p) => ({ ...p, style: preset.text }))}
                            className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Design style — the AI sets this from the prompt; the
                      company can override and see it change immediately. */}
                  {(data?.siteStyles || []).length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1.5">
                        Design style
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {data.siteStyles.map((st) => (
                          <button
                            key={st.key}
                            type="button"
                            title={st.hint}
                            onClick={() => setStyleKey(st.key)}
                            className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                              styleKey === st.key
                                ? "border-foreground bg-inverted text-inverted-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Changes the layout, type and spacing. Save to see it in the preview.
                      </p>
                    </div>
                  )}

                  {/* What the last generation actually built, and what it left
                      out. Without this a company presses Generate, gets a page
                      with no gallery, and has no way to know it's because they
                      have no photos yet. */}
                  {composition && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 space-y-1">
                      <p className="text-[11px] text-foreground">
                        Page shape:{" "}
                        <strong>
                          {composition === "custom"
                            ? "custom (chosen from your description)"
                            : data?.compositions?.find((c) => c.key === composition)?.label || composition}
                        </strong>
                      </p>
                      {dropped.length > 0 && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Left out: {dropped.map((d) => `${d.key} (${d.reason})`).join(", ")}.
                          Add the missing content and regenerate to include them.
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                    A few more details make the copy better (all optional):
                  </p>
                  {(data?.questions || []).filter((q) => q.key !== "style").map((q) => (
                    <div key={q.key}>
                      <label className="text-xs font-semibold text-foreground block mb-1">{q.label}</label>
                      <textarea
                        value={interview[q.key] || ""}
                        onChange={(e) => setInterview((p) => ({ ...p, [q.key]: e.target.value }))}
                        rows={q.long ? 3 : 2}
                        placeholder={q.placeholder}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="w-full inline-flex items-center justify-center gap-2 text-white rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
                  >
                    {generating ? <Loader2 size={15} className="animate-spin" /> : hasBlocks ? <RefreshCw size={15} /> : <Sparkles size={15} />}
                    {generating ? "Writing your site…" : hasBlocks ? "Regenerate site" : "Generate my site"}
                  </button>
                  {hasBlocks && (
                    <p className="text-[11px] text-muted-foreground">
                      Regenerating rewrites the copy. Your photos and services stay. ~3¢ per generation.
                    </p>
                  )}
                  {note && <p className="text-[11px] text-amber-700 dark:text-amber-400">{note}</p>}
                </div>
              )}
            </div>

            {/* Blocks */}
            {hasBlocks ? (
              <>
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sections</h2>
                  <span className="text-[11px] text-muted-foreground">Click a section to edit</span>
                </div>

                {/* Layout shapes. Free — reordering what's already there costs
                    nothing, so changing the look shouldn't require a
                    regeneration and shouldn't rewrite anyone's copy. */}
                {(data?.compositions || []).length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <p className="text-xs font-bold text-foreground mb-1">Page layout</p>
                    <p className="text-[11px] text-muted-foreground mb-2.5">
                      Reorders your sections. Keeps all your text and photos.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.compositions.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => reshape(c)}
                          className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                            composition === c.key
                              ? "border-foreground bg-inverted text-inverted-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {blocks.map((block) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={(patch) => patchBlock(block.id, patch)}
                    onToggle={() => toggleBlock(block.id)}
                    onError={setError}
                  />
                ))}

                {/* Add a section. Only offers types not already on the page —
                    two "About us" sections is never what anyone meant. */}
                <div className="bg-card border border-border rounded-2xl p-4">
                  <label className="text-xs font-bold text-foreground block mb-2">
                    Add a section
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addSection(e.target.value);
                      e.target.value = "";
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Choose a section…</option>
                    {BLOCK_ORDER.filter(
                      (type) =>
                        BLOCK_TYPES[type] &&
                        // `cta` is the one repeatable section, so it stays on
                        // offer however many are already there.
                        (type === "cta" || !blocks.some((b) => b.type === type)),
                    ).map((type) => (
                      <option key={type} value={type}>
                        {BLOCK_TYPES[type].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address + SEO */}
                <details className="bg-card border border-border rounded-2xl">
                  <summary className="px-4 py-3.5 font-semibold text-foreground text-sm cursor-pointer list-none flex items-center justify-between">
                    Web address &amp; SEO
                    <ChevronDown size={16} className="text-muted-foreground" />
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                        className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">.fieldquo.com</span>
                    </div>
                    {isLive && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy live URL"}
                      </button>
                    )}
                    <input
                      value={seo.title}
                      onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))}
                      placeholder="Title shown in Google results"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    />
                    <textarea
                      value={seo.description}
                      onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))}
                      rows={2}
                      placeholder="The sentence under the title in Google results"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    />
                    {isLive && (
                      <button
                        type="button"
                        onClick={async () => { await fetchJson("/api/settings/website", { method: "DELETE" }); load(); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <EyeOff size={13} /> Unpublish site
                      </button>
                    )}
                  </div>
                </details>
              </>
            ) : (
              <p className="text-sm text-muted-foreground px-1">
                Answer a few questions above and hit <strong>Generate my site</strong> — we&apos;ll build a full
                page from your brand, services, hours and photos in seconds.
              </p>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="min-h-0 hidden lg:flex flex-col bg-muted/40">
          <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 bg-card">
            <span className="text-xs font-semibold text-muted-foreground">
              {isLive ? "Live preview" : hasBlocks ? "Draft preview" : "Preview"}
            </span>
            <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`p-1.5 rounded-full ${device === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                aria-label="Desktop preview"
              >
                <Monitor size={15} />
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`p-1.5 rounded-full ${device === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                aria-label="Mobile preview"
              >
                <Smartphone size={15} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto grid place-items-center p-4">
            {previewUrl ? (
              <div
                className={`bg-white shadow-2xl overflow-hidden transition-all ${device === "mobile" ? "rounded-[2rem] border-[6px] border-neutral-800" : "rounded-xl border border-border w-full h-full"}`}
                style={device === "mobile" ? { width: 390, height: 780, maxHeight: "100%" } : undefined}
              >
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  title="Website preview"
                  className="w-full h-full bg-white"
                  style={device === "mobile" ? { width: 390, height: 780 } : { minHeight: "100%" }}
                />
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                <Sparkles size={28} className="mx-auto mb-3 opacity-40" />
                Your site preview appears here once you generate it.
              </div>
            )}
          </div>
          <p className="shrink-0 px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-card">
            {isLive ? "This is your live site." : "Only you can see this until you publish. Save to refresh."}
          </p>
        </div>
      </div>

      {/* Mobile: preview lives in a new tab (the pane is desktop-only) */}
      {previewUrl && (
        <div className="lg:hidden shrink-0 border-t border-border bg-card px-4 py-2.5">
          <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ExternalLink size={14} /> Open preview
          </a>
        </div>
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

          {/* Repeated items. Driven by `def.repeats` rather than hardcoded to
              "items", so `steps` and `pairs` get an editor from the schema alone
              — the alternative was a third and fourth copy of this block, and
              the copy is the one that rots. Keys listed in `imagePair` get an
              uploader instead of a text input, because a before/after pair holds
              image URLs. */}
          {def.repeats && def.repeats !== "images" && (
            <RepeatEditor def={def} block={block} onChange={onChange} onError={onError} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Editor for a block's repeated list — items, steps, or before/after pairs.
 *
 * One component for all three because they differ only in which keys are text
 * and which are images, and that is already in the schema.
 */
function RepeatEditor({ def, block, onChange, onError }) {
  const key = def.repeats;
  const list = block.content[key] || [];
  const imageKeys = def.imagePair || [];
  const textKeys = (def.itemEditable || []).filter((k) => !imageKeys.includes(k));

  const write = (next) => onChange({ [key]: next });
  const patch = (i, k, v) => {
    const next = [...list];
    next[i] = { ...next[i], [k]: v };
    write(next);
  };

  const noun =
    block.type === "faq" ? "question" : block.type === "process" ? "step" : block.type === "beforeafter" ? "pair" : "item";

  return (
    <div className="space-y-2">
      {list.map((item, i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2 relative">
          {imageKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {imageKeys.map((k) => (
                <div key={k}>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block mb-1">
                    {k}
                  </span>
                  <ImageField
                    value={item[k]}
                    onChange={(url) => patch(i, k, url)}
                    onError={onError}
                  />
                </div>
              ))}
            </div>
          )}
          {textKeys.map((k) => (
            <input
              key={k}
              value={item[k] || ""}
              onChange={(e) => patch(i, k, e.target.value)}
              placeholder={labelFor(k)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            />
          ))}
          <button
            type="button"
            onClick={() => write(list.filter((_, j) => j !== i))}
            className="absolute top-2 right-2 text-muted-foreground hover:text-red-600"
            aria-label="Remove"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {list.length === 0 && EMPTY_HINTS[block.type] && (
        <p className="text-xs text-muted-foreground">{EMPTY_HINTS[block.type]}</p>
      )}

      <button
        type="button"
        onClick={() =>
          write([...list, Object.fromEntries((def.itemEditable || []).map((k) => [k, ""]))])
        }
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ImagePlus size={13} className="rotate-45" /> Add {noun}
      </button>
    </div>
  );
}

// What an empty list means, said out loud. An empty editor with no explanation
// reads as a form that failed to load.
const EMPTY_HINTS = {
  testimonials: "Approved testimonials appear here automatically — or add one below.",
  beforeafter:
    "Fills itself from job visits that have exactly two photos — a before and an after. Add a pair here to override it.",
  process: "Generated from your description. Add your own steps to override it.",
  faq: "Generated from your description. Add your own questions to override it.",
};

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
  // hero
  centered: "Centred",
  split: "Photo right",
  sidebyside: "Photo left",
  banner: "Photo + card",
  overlay: "Words on photo",
  minimal: "Type only",
  // services
  cards: "Cards",
  list: "List",
  numbered: "Numbered",
  tiles: "Filled tiles",
  alternating: "Alternating rows",
  // about
  simple: "Text only",
  withphoto: "With photo",
  quote: "Pull quote",
  // gallery
  grid: "Grid",
  masonry: "Masonry",
  strip: "Scrolling row",
  // testimonials
  single: "One, large",
};

const DERIVED_NOTES = {
  areas:
    "Built from your Work Areas in Settings → Work Areas, so adding a town updates the site with no regeneration.",
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
      question: "Question",
      answer: "Answer",
      title: "Step name",
      caption: "What this job was",
      sub: "One line under the heading",
      buttonLabel: "Button text",
    }[field] || field
  );
}
