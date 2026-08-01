// app/app/settings/lead-form/page.js
//
// The two links a company shares to get work in.
//
// ── What was wrong here ─────────────────────────────────────────────────────
//
// This page said "Lead Capture Form … so visitors can request a quote", and
// handed out an embed pointing at /book/<slug> — the BOOKING flow, which asks
// a stranger to choose a time slot before they've said what the job is. The
// actual quote-request endpoints existed and had no page at all, so the link
// that matched the heading was the one link this page didn't give you.
//
// ── Why both, rather than picking one ───────────────────────────────────────
//
// They serve different visitors, and a company usually wants both:
//
//   Request a quote  — someone comparing three contractors. They want a number
//                      first; being asked to commit to Tuesday loses them.
//   Book a visit     — someone who has already decided. Making them fill in a
//                      form and wait for a callback wastes the decision.
//
// ── Links first, embed second ───────────────────────────────────────────────
//
// The old page led with an iframe snippet. Most contractors don't have a
// website to paste it into — they have a Facebook page, a Google listing and
// a phone. A plain URL works in all three; the embed is for the minority who
// can use it.
"use client";

import { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, FileText, CalendarDays, Zap } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

function ShareBlock({ icon: Icon, title, description, url, embed }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState("");

  function copy(what, value) {
    navigator.clipboard.writeText(value);
    setCopied(what);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="mt-0.5 text-muted-foreground shrink-0">
          <Icon size={17} />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-0 truncate bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground">
          {url}
        </code>
        <button
          type="button"
          onClick={() => copy("link", url)}
          className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold text-foreground shrink-0"
        >
          {copied === "link" ? <Check size={13} /> : <Copy size={13} />}
          {copied === "link" ? t("app.action.copied") : t("app.action.copyLink")}
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

      {embed && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer">
            {t("app.setLeadForm.embedToggle")}
          </summary>
          <div className="mt-2 flex items-start gap-2">
            <pre className="flex-1 min-w-0 bg-muted border border-border rounded-lg p-3 text-[11px] overflow-x-auto">
              {embed}
            </pre>
            <button
              type="button"
              onClick={() => copy("embed", embed)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0 mt-1"
            >
              {copied === "embed" ? <Check size={13} /> : <Copy size={13} />}
              {copied === "embed" ? t("app.action.copied") : t("app.setLeadForm.copy")}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

export default function LeadFormPage() {
  const { t } = useTranslation();
  const [slug, setSlug] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => setSlug(data.bookingSlug || data.slug || ""));
  }, []);

  const quoteUrl = `${origin}/quote/${slug}`;
  const bookUrl = `${origin}/book/${slug}`;
  const instantUrl = `${origin}/instant-quote/${slug}`;

  /**
   * The embed snippet.
   *
   * Points at /embed/... rather than the shareable page — same flow, no
   * FieldQuo chrome, and it reports its own height.
   *
   * The listener is what makes an embedded form usable. Without it the iframe
   * keeps whatever height was hardcoded, and a visitor who completes the
   * booking sees the confirmation render below the fold of a box that doesn't
   * scroll with the page. From where they're sitting nothing happened.
   *
   * The origin check on the message is the important line: without it, any
   * framed page on the host's site could resize this iframe by posting the
   * same message shape.
   */
  const embed = (widget) => {
    const src = `${origin}/embed/${slug}/${widget}`;
    return `<iframe id="fieldquo-${widget}" src="${src}" width="100%" height="640" style="border:none;" title="${
      widget === "book" ? t("app.setLeadForm.bookTitle") : t("app.setLeadForm.quoteTitle")
    }"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (e.origin !== "${origin}") return;
  if (!e.data || e.data.type !== "fieldquo:embed-height") return;
  var f = document.getElementById("fieldquo-${widget}");
  if (f) f.style.height = e.data.height + "px";
});
</script>`;
  };

  if (!slug) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-accent rounded" />
          <div className="h-32 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.leadForm")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setLeadForm.subtitle")}
        </p>
      </div>

      <ShareBlock
        icon={FileText}
        title={t("app.setLeadForm.quoteTitle")}
        description={t("app.setLeadForm.quoteDesc")}
        url={quoteUrl}
        embed={embed("quote")}
      />

      <ShareBlock
        icon={CalendarDays}
        title={t("app.setLeadForm.bookTitle")}
        description={t("app.setLeadForm.bookDesc")}
        url={bookUrl}
        embed={embed("book")}
      />

      <ShareBlock
        icon={Zap}
        title={t("app.setLeadForm.instantTitle")}
        description={t("app.setLeadForm.instantDesc")}
        url={instantUrl}
      />

      <p className="text-xs text-muted-foreground">
        {t("app.setLeadForm.footer")}
      </p>
    </div>
  );
}
