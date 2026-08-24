"use client";

// app/components/settings/EmbedCode.js
//
// The copy-paste embed code, offered on the screen where the thing itself is
// set up.
//
// ── Why it belongs on every one of those screens ───────────────────────────
//
// Settings → Lead Capture Form lists what a company can share, which answers
// "what can I put on my website?". It does not answer the other question, and
// the other question is the common one: somebody has just finished configuring
// their booking calendar, and the next thought is "right — how do I use this?"
// Sending them to a different settings screen to find the code for the thing
// they are looking at is how the code never gets pasted.
//
// This started as the reviews-only version of the same idea, written because
// the reviews snippet lived solely inside the website builder — behind a
// feature flag, on a screen that only exists once a FieldQuo site does. The
// one contractor the embed was built for, who already has a website and is
// never building a second one, was the only person who could not reach it.
// That reasoning is not specific to reviews, so neither is this component now.
//
// ── One string, five screens ───────────────────────────────────────────────
//
// The snippet comes from lib/embed/snippet.js and is never rebuilt here. A
// second copy would be the copy nobody looks at, because it renders inside a
// stranger's website where no one at FieldQuo will ever see it break.

import { useEffect, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { embedSnippet } from "@/lib/embed/snippet";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function EmbedCode({
  slug,
  widget,
  // The iframe's accessible name, already translated by the caller.
  title,
  // Funnels only — a company has many, so the widget name alone cannot
  // address one. See lib/embed/snippet.js.
  funnelSlug,
  heading,
  note,
  className = "",
}) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // window.location.origin, so the snippet a company copies points at whatever
  // host they are actually signed in to rather than a hardcoded production URL.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = embedSnippet({ origin, slug, widget, title, funnelSlug });

  // Empty until the origin arrives on mount, and empty for a company with no
  // slug. Rendering the heading over an empty box would be a control that
  // offers something it has not got.
  if (!snippet) return null;

  return (
    <div className={`rounded-lg border border-border p-4 ${className}`}>
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Code2 size={15} /> {heading}
      </p>
      {note && (
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {note}
        </p>
      )}
      <pre className="mt-3 bg-muted border border-border rounded-lg p-3 text-[11px] leading-relaxed overflow-x-auto">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? t("app.action.copied") : t("app.action.copyCode")}
      </button>
    </div>
  );
}
