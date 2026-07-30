// app/app/settings/website/Builder.js
//
// The website builder, as a Lovable-style interface.
//
// ── What was wrong with the old screen ─────────────────────────────────────
//
// It was a form. An accordion of interview questions, a style picker, a layout
// picker, a section list, a subdomain field and an SEO panel — all visible at
// once, all asking the company to type or choose things. Several of those things
// FieldQuo already knows: the name, trades, phone, email, address, logo, brand
// colour, hours, services and availability are all on the company record and the
// site reads them live. Asking again is work for no gain, and it buried the one
// control that matters.
//
// ── The shape this is instead ─────────────────────────────────────────────
//
// First run: one large prompt, centred, with example chips. Nothing else.
// After that: a conversation on the left, the live site on the right.
//
// The thread is the interface. What you asked for, what got built, and what it
// still needs are all one column you scroll — so iterating is typing again rather
// than hunting for the field that controls the thing you want to change.
//
// ── It only asks for what's missing ──────────────────────────────────────
//
// Gaps come from the server (lib/site/gaps.js) and arrive as assistant messages
// with one-tap actions. Photos, before/after pairing, a logo, a review, hours.
// Never the name or the phone number, because those are already there.
//
// The advanced controls still exist — sections, subdomain, SEO — behind one
// "Fine-tune" disclosure, because a company that wants to hand-edit a heading
// should be able to, and a company that doesn't should never see it.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Loader2, ArrowUp, Monitor, Smartphone, ExternalLink,
  Eye, Save, RefreshCw, ImagePlus, Check, AlertCircle, Globe, ChevronDown,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PairPhotos from "./PairPhotos";
import { BlockEditor } from "./SectionEditor";

const EXAMPLES = [
  "Bold and industrial. Lead with our before-and-after photos — we want to look like the biggest crew in town.",
  "Quiet and high-end. Lots of white space, serif headings, one strong client quote near the top.",
  "Friendly and local for families. People should be able to book online.",
  "Keep it short — one page, just the basics and a way to reach us.",
];

export default function Builder({ data, onReload }) {
  const site = data?.site || null;
  const [blocks, setBlocks] = useState(site?.blocks || []);
  const [styleKey, setStyleKey] = useState(site?.styleKey || "modern");
  const [subdomain, setSubdomain] = useState(site?.subdomain || data?.suggestedSubdomain || "");
  const [thread, setThread] = useState(data?.chat || []);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [pairing, setPairing] = useState(false);
  // Preview | Sections, the way open-lovable toggles Preview | Code. Not code:
  // a contractor cannot debug React, and the thing they actually want to reach is
  // the wording of a heading. Same idea, appropriate artefact.
  const [pane, setPane] = useState("preview");
  const [advanced, setAdvanced] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Hand-edited copy that a regeneration would overwrite.
  //
  // Two sources: `handEdited` for edits made in this session, and the persisted
  // handEditedAt for edits made on a previous day — the twenty minutes of
  // rewording and the regeneration are usually not the same sitting.
  const [handEdited, setHandEdited] = useState(Boolean(site?.handEditedAt));
  const [confirmRegen, setConfirmRegen] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const threadRef = useRef(null);
  const hasSite = blocks.length > 0;

  // ── Follow the saved site when it changes identity ────────────────────────
  //
  // useState only seeds at mount. A harness that swapped `data` from "no site"
  // to "site" left this component showing the first-run prompt forever, and the
  // same would happen for any parent that loads the site AFTER first paint.
  //
  // Deliberately narrow: it syncs when a DIFFERENT site arrives, or when we have
  // nothing and something turns up. It does not re-sync on every prop change,
  // because that would throw away edits made in the Sections pane the moment
  // anything triggered a reload.
  const seededFor = useRef(site?.id || null);
  useEffect(() => {
    const incoming = site?.id || null;
    const isNewSite = incoming && incoming !== seededFor.current;
    const fillingEmpty = blocks.length === 0 && (site?.blocks?.length || 0) > 0;
    if (!isNewSite && !fillingEmpty) return;

    seededFor.current = incoming;
    setBlocks(site?.blocks || []);
    if (site?.styleKey) setStyleKey(site.styleKey);
    if (site?.subdomain) setSubdomain(site.subdomain);
    // Only adopt the stored thread when we don't have one in hand — a live
    // conversation must not be replaced by the persisted copy mid-session.
    setThread((t) => (t.length ? t : data?.chat || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, site?.blocks?.length]);

  // Keep the newest message in view — a thread that doesn't follow itself makes
  // you scroll after every turn.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [thread, busy]);

  const previewUrl = site?.subdomain
    ? `/site/${site.subdomain}?preview=1&v=${previewKey}`
    : null;

  const say = useCallback((role, text, meta) => {
    setThread((t) => [...t, { role, text, at: new Date().toISOString(), ...(meta ? { meta } : {}) }]);
  }, []);

  // ── Generate / iterate ───────────────────────────────────────────────────
  async function send(text, { confirmed = false } = {}) {
    const message = (text ?? prompt).trim();
    if (!message || busy) return;

    // Regenerating rewrites every text field. Photos and before/after pairs
    // survive; hand-written words do not. Asking once beats silently discarding
    // work someone chose to do — and this is the difference between a destructive
    // action and a destructive action labelled as a cosmetic one.
    if (handEdited && !confirmed) {
      setConfirmRegen(message);
      return;
    }
    setConfirmRegen(null);
    setPrompt("");
    setError("");
    say("user", message);
    setBusy(true);

    try {
      const result = await fetchJson("/api/settings/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The whole prompt is the interview now. The old five-field form is gone;
        // `style` is the field generateSite reads, and one box is less to explain
        // than five.
        body: JSON.stringify({ interview: { ...(site?.interview || {}), style: message } }),
      });

      const nextBlocks = result.blocks || [];
      setBlocks(nextBlocks);
      if (result.styleKey) setStyleKey(result.styleKey);

      // Say what actually changed, in the company's terms. "Done" tells them
      // nothing and makes the next prompt a guess.
      const sections = nextBlocks.filter((b) => b.visible !== false).length;
      const bits = [];
      if (Array.isArray(result.promptIntent) && result.promptIntent.length) {
        bits.push(`I read that as ${result.promptIntent.join(", ")}`);
      }
      bits.push(`${sections} sections`);
      if (!result.generated) {
        bits.push("written from your saved details — the writing assistant wasn't reachable, so the words are plainer than usual");
      }
      say("assistant", `Rebuilt your site: ${bits.join(" · ")}.`);

      if (Array.isArray(result.droppedSections) && result.droppedSections.length) {
        say(
          "assistant",
          `Left out ${result.droppedSections.map((d) => d.key).join(", ")} — ${result.droppedSections[0].reason}.`,
        );
      }

      // Persist immediately. The preview renders the SAVED row, so without this
      // the company generates, sees no change, and concludes nothing happened.
      await persist(nextBlocks, result.styleKey || styleKey, {
        seoTitle: result.seoTitle,
        seoDescription: result.seoDescription,
        interviewStyle: message,
        // Nothing of theirs is left in the copy now, so there is nothing to warn
        // about next time.
        handEdited: false,
      });
      setHandEdited(false);
      await onReload?.();
    } catch (err) {
      setError(err.message);
      say("assistant", `That didn't work: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function persist(nextBlocks, nextStyle, extra = {}) {
    const payload = {
      subdomain,
      blocks: nextBlocks ?? blocks,
      styleKey: nextStyle ?? styleKey,
      ...(extra.seoTitle ? { seoTitle: extra.seoTitle } : {}),
      ...(extra.seoDescription ? { seoDescription: extra.seoDescription } : {}),
      interview: { ...(site?.interview || {}), ...(extra.interviewStyle ? { style: extra.interviewStyle } : {}) },
      chat: [...thread].slice(-40),
      ...(extra.handEdited !== undefined ? { handEdited: extra.handEdited } : {}),
    };
    await fetchJson("/api/settings/website", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPreviewKey((k) => k + 1);
  }

  async function save({ published, confirmed = false } = {}) {
    // Publishing with stock photos still on the page is allowed — a company with
    // no photos yet shouldn't be blocked from launching — but it is never silent.
    // A placeholder that quietly goes live and stays for a year is worse than a
    // page that took one more click.
    if (published && !confirmed && (data?.placeholderCount || 0) > 0) {
      setConfirmPublish(true);
      return;
    }
    setConfirmPublish(false);
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/settings/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain,
          blocks,
          styleKey,
          ...(published !== undefined ? { published } : {}),
          chat: [...thread].slice(-40),
          ...(handEdited ? { handEdited: true } : {}),
        }),
      });
      setPreviewKey((k) => k + 1);
      await onReload?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function patchBlock(id, patch) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content: { ...b.content, ...patch } } : b)),
    );
    // Only a TEXT change counts. Switching a layout variant is not something a
    // regeneration destroys — it re-picks one — so warning about it would train
    // people to click through the warning that matters.
    if (Object.keys(patch).some((k) => k !== "variant")) setHandEdited(true);
  }

  function toggleBlock(id) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: b.visible === false } : b)),
    );
  }

  async function uploadPhotos(files) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const urls = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const d = await fetchJson("/api/upload", { method: "POST", body: form });
        if (d?.url) urls.push(d.url);
      }
      if (urls.length) {
        await fetchJson("/api/settings/website/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        say("assistant", `Added ${urls.length} photo${urls.length === 1 ? "" : "s"}. Want to pair any as before-and-after?`, { action: "pair" });
        await onReload?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // ── First run: one prompt, nothing else ─────────────────────────────────
  if (!hasSite) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-2xl text-center">
          <span
            className="inline-grid w-12 h-12 place-items-center rounded-2xl mb-6"
            style={{ background: "var(--brand,#111827)" }}
          >
            <Sparkles size={22} className="text-white" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] text-foreground">
            What should your website say?
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">
            Describe how it should look and feel. I already have your logo,
            colours, services, hours and contact details — you don&apos;t need to
            type any of that.
          </p>

          <div className="mt-8 relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              // Enter sends, Shift+Enter makes a newline — the same as the
              // iteration box below. They used to differ (this one wanted
              // Cmd+Enter), which meant the key that worked depended on which
              // stage of the same feature you were in.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={4}
              autoFocus
              placeholder="Bold and industrial. Big headlines, and lead with our before-and-after photos…"
              className="w-full rounded-2xl border border-border bg-card px-4 py-4 pr-14 text-[15px] leading-relaxed resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
            />
            <button
              onClick={() => send()}
              disabled={!prompt.trim() || busy}
              aria-label="Build my site"
              className="absolute right-3 bottom-3 grid w-10 h-10 place-items-center rounded-xl text-white disabled:opacity-40 transition-opacity"
              style={{ background: "var(--brand,#111827)" }}
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} />}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-left text-[12px] leading-snug px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 max-w-[15rem]"
              >
                {ex.length > 68 ? `${ex.slice(0, 68)}…` : ex}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-5 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Nothing is public until you publish it.
          </p>
        </div>
      </div>
    );
  }

  // ── After: conversation left, live site right ───────────────────────────
  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
      {/* One slim bar. Everything that isn't the conversation or the site lives
          here or behind Fine-tune. */}
      <div className="shrink-0 flex items-center gap-2 px-4 sm:px-5 h-14 border-b border-border bg-card">
        <Globe size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate">
          {site?.subdomain ? `${site.subdomain}.fieldquo.com` : "Your website"}
        </span>
        {site?.published && (
          <span className="hidden sm:inline text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
            Live
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ExternalLink size={13} /> Open
            </a>
          )}
          <button
            onClick={() => save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <button
            onClick={() => save({ published: true })}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-3.5 py-1.5 text-xs font-bold disabled:opacity-60"
          >
            <Eye size={12} /> {site?.published ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ── Conversation ── */}
        <div className="min-h-0 flex flex-col border-r border-border bg-background">
          <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
            {thread.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tell me what to change and I&apos;ll rebuild the page.
              </p>
            )}

            {thread.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-inverted text-inverted-foreground px-3.5 py-2.5 text-sm leading-relaxed"
                      : "max-w-[92%] text-sm leading-relaxed text-foreground"
                  }
                >
                  {m.text}
                  {m.meta?.action === "pair" && (
                    <button
                      onClick={() => setPairing(true)}
                      className="mt-2 block text-xs font-bold underline"
                    >
                      Pair them up
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* ── What's missing, as messages rather than a form ── */}
            {(data?.gaps || []).map((gap) => (
              <div key={gap.key} className="rounded-2xl border border-border bg-card p-3.5">
                <p className="text-sm font-semibold text-foreground">{gap.question}</p>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  {gap.detail}
                </p>
                <div className="mt-2.5">
                  {gap.action?.kind === "pair" && (
                    <button
                      onClick={() => setPairing(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-3.5 py-1.5 text-xs font-bold"
                    >
                      {gap.action.label}
                    </button>
                  )}
                  {gap.action?.kind === "photos" && (
                    <label className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-bold cursor-pointer">
                      {uploading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ImagePlus size={12} />
                      )}
                      {gap.action.label}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadPhotos(Array.from(e.target.files || []))}
                      />
                    </label>
                  )}
                  {gap.action?.kind === "link" && (
                    <a
                      href={gap.action.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-bold"
                    >
                      {gap.action.label}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Rebuilding…
              </p>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          {/* ── The prompt, always at the bottom, always the main control ── */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Make it bolder · lead with reviews · shorter page…"
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 pr-11 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10"
              />
              <button
                onClick={() => send()}
                disabled={!prompt.trim() || busy}
                aria-label="Send"
                className="absolute right-2 bottom-2 grid w-8 h-8 place-items-center rounded-lg text-white disabled:opacity-40"
                style={{ background: "var(--brand,#111827)" }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
              </button>
            </div>

            <button
              onClick={() => setAdvanced((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <ChevronDown size={12} className={advanced ? "rotate-180" : ""} />
              Fine-tune
            </button>
            {advanced && (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Web address
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      .fieldquo.com
                    </span>
                  </div>
                </label>
                <button
                  onClick={() => setPairing(true)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-left"
                >
                  Before &amp; after pairs
                  {data?.confirmedPairs?.length
                    ? ` · ${data.confirmedPairs.length} set`
                    : " · none yet"}
                </button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your logo, colours, services, hours, phone, email and address all
                  come from your company settings and update the site automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Live site ── */}
        <div className="min-h-0 hidden lg:flex flex-col bg-muted/30">
          <div className="shrink-0 flex items-center gap-2 h-11 px-3 border-b border-border">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {[["preview", "Preview"], ["sections", "Sections"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPane(key)}
                  className={`px-3 py-1.5 font-semibold ${
                    pane === key ? "bg-inverted text-inverted-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {pane === "preview" && (
                <>
                  {[["desktop", Monitor], ["mobile", Smartphone]].map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setDevice(key)}
                      aria-label={key}
                      className={`grid w-8 h-8 place-items-center rounded-lg ${
                        device === key ? "bg-inverted text-inverted-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                  <button
                    onClick={() => setPreviewKey((k) => k + 1)}
                    aria-label="Refresh preview"
                    className="grid w-8 h-8 place-items-center rounded-lg text-muted-foreground"
                  >
                    <RefreshCw size={13} />
                  </button>
                </>
              )}
              {pane === "sections" && (
                <button
                  onClick={() => save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-inverted text-inverted-foreground px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Apply
                </button>
              )}
            </div>
          </div>

          {pane === "preview" ? (
            // Desktop fills the pane; mobile is a fixed 390px frame centred in
            // it. `grid place-items-center` with a 100%-width child collapsed to
            // the content width, which made the desktop preview render as a
            // narrow column — the one thing a device preview must not do.
            <div
              className={`flex-1 min-h-0 overflow-auto p-4 ${
                device === "mobile" ? "flex justify-center items-start" : ""
              }`}
            >
              {previewUrl ? (
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  title="Your website"
                  className="bg-white rounded-xl shadow-lg border border-border"
                  style={
                    device === "mobile"
                      ? { width: 390, height: 780, flexShrink: 0 }
                      : { width: "100%", height: "100%" }
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground mt-10">
                  Save once and your site appears here.
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Reword anything by hand. Your logo, colours, services, hours and
                contact details come from your company settings and aren&apos;t
                editable here — changing them there updates the site.
              </p>
              {blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(patch) => patchBlock(block.id, patch)}
                  onToggle={() => toggleBlock(block.id)}
                  onError={setError}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: the preview is a link, not a pane — a 390px frame inside a
          375px screen is not a preview. */}
      {previewUrl && (
        <div className="lg:hidden shrink-0 border-t border-border bg-card px-4 py-2.5">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <ExternalLink size={14} /> Open preview
          </a>
        </div>
      )}

      {/* ── The confirmation ─────────────────────────────────────────────────
          Says exactly what survives and what doesn't, because "are you sure?"
          with no detail is a dialog people learn to dismiss. */}
      {confirmRegen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmRegen(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <h2 className="font-bold text-foreground">
              This will rewrite the words you edited
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              You&apos;ve changed some text by hand. Rebuilding writes new copy for
              every section, so those edits will be replaced.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex items-start gap-2 text-foreground">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Your photos, before-and-after pairs, logo and colours are kept
              </li>
              <li className="flex items-start gap-2 text-muted-foreground">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                Headings and paragraphs you typed will be rewritten
              </li>
            </ul>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setConfirmRegen(null)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
              >
                Keep what I wrote
              </button>
              <button
                onClick={() => send(confirmRegen, { confirmed: true })}
                className="rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-bold"
              >
                Rebuild anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmPublish(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <h2 className="font-bold text-foreground">
              {data.placeholderCount} stock photo
              {data.placeholderCount === 1 ? "" : "s"} still on your site
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              I used stock photography so your page isn&apos;t empty. It&apos;s only
              in the background of the header and similar spots — never in
              &ldquo;Our work&rdquo;, because that section says the photos are jobs
              you did.
            </p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              You can publish now and swap them later, or add your own photos
              first — your own work always sells better than a stock house.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <label className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold cursor-pointer">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                Add my photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    setConfirmPublish(false);
                    uploadPhotos(Array.from(e.target.files || []));
                  }}
                />
              </label>
              <button
                onClick={() => save({ published: true, confirmed: true })}
                className="rounded-full bg-inverted text-inverted-foreground px-4 py-2 text-sm font-bold"
              >
                Publish anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {pairing && (
        <PairPhotos
          pool={data?.photoPool || []}
          pairs={data?.confirmedPairs || []}
          onClose={() => setPairing(false)}
          onSaved={async (r) => {
            setPairing(false);
            if (r?.blocks) setBlocks(r.blocks);
            setPreviewKey((k) => k + 1);
            say("assistant", `Saved ${r?.pairs?.length || 0} before-and-after pair${r?.pairs?.length === 1 ? "" : "s"}.`);
            await onReload?.();
          }}
        />
      )}
    </div>
  );
}
