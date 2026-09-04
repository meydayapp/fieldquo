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
import {
  Copy,
  Check,
  ExternalLink,
  FileText,
  CalendarDays,
  Zap,
  Megaphone,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { embedSnippet } from "@/lib/embed/snippet";
import { reportResponseError } from "@/lib/clientErrors";
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
          {copied === "link"
            ? t("app.action.copied")
            : t("app.action.copyLink")}
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

      {/* Shown, not folded away.
          This used to sit inside a collapsed <details> labelled "Embed it on
          your website instead". That made sense when the page led with an
          iframe and most contractors had no website. It does not when the
          question someone arrives with is "how do I put this on my site" —
          a grey summary line is not an answer they will find. */}
      {embed && (
        <div className="mt-3">
          <div className="text-xs text-muted-foreground">
            {t("app.setLeadForm.embedToggle")}
          </div>
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
              {copied === "embed"
                ? t("app.action.copied")
                : t("app.setLeadForm.copy")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadFormPage() {
  const { t } = useTranslation();
  const [slug, setSlug] = useState("");
  const [origin, setOrigin] = useState("");
  // Funnels belong on this page too: it is the one screen that answers "what
  // can I share?", and a funnel is the most shareable thing the app makes. It
  // is a list rather than a card because a company has many, and each carries
  // its own link and its own embed.
  const [funnels, setFunnels] = useState([]);
  // Three ways this list can be absent, and they are not the same sentence:
  // the company has none, this member may not see them, or the read failed.
  const [funnelsError, setFunnelsError] = useState("");
  const [funnelsRestricted, setFunnelsRestricted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Published only. An unpublished funnel's link 404s for a visitor, and
    // handing someone a link to paste that does not work yet is worse than
    // showing nothing.
    //
    // `r.ok ? r.json() : []` swallowed a 403, and GET /api/funnels 403s
    // everyone below admin (requirePermission "user:manage"). So every
    // supervisor and crew member opening this page was silently shown a page
    // with no funnels on it and no reason why.
    //
    // 403 is the routine answer for those roles, not a fault, so it gets its
    // own quiet branch — the section simply says the list isn't theirs to see
    // rather than erroring. Anything else is a real failure and is named.
    (async () => {
      try {
        const res = await fetch("/api/funnels");
        if (res.status === 403) {
          setFunnelsRestricted(true);
          return;
        }
        if (!res.ok) {
          setFunnelsError(await reportResponseError(res));
          return;
        }
        const list = await res.json();
        setFunnels(
          (Array.isArray(list) ? list : []).filter(
            (f) => f.status === "published" && f.slug,
          ),
        );
      } catch {
        setFunnelsError(t("app.load.network"));
      }
    })();
  }, [t]);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      try {
        const data = await fetchJson("/api/settings/business-info");
        setSlug(data.bookingSlug || data.slug || "");
      } catch (err) {
        setError(err.message);
      }
    })();
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
   * Built by lib/embed/snippet.js, which is also what Settings → Reviews and
   * the website builder hand out for the reviews widget. This page used to
   * carry its own copy of the string; the reasoning that used to live here —
   * why the listener matters, why the origin and source checks are both
   * load-bearing — moved there with it.
   */
  const embed = (widget) =>
    embedSnippet({
      origin,
      slug,
      widget,
      title:
        widget === "book"
          ? t("app.setLeadForm.bookTitle")
          : widget === "instant-quote"
            ? t("app.setLeadForm.instantTitle")
            : t("app.setLeadForm.quoteTitle"),
    });

  if (!slug) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {error ? (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        ) : (
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-48 bg-accent rounded" />
            <div className="h-32 bg-accent rounded-xl" />
          </div>
        )}
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
        embed={embed("instant-quote")}
      />

      {funnelsError && (
        <p className="text-sm text-red-600 dark:text-red-400">{funnelsError}</p>
      )}
      {funnelsRestricted && (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.setLeadForm.funnelsRestricted",
            "Lead funnels are managed by an owner or admin — ask one of them for the link.",
          )}
        </p>
      )}

      {funnels.map((f) => (
        <ShareBlock
          key={f.id}
          icon={Megaphone}
          title={f.name}
          description={t(
            "app.setLeadForm.funnelDesc",
            "A tap-through lead funnel — share the link on an ad, or put it on your site.",
          )}
          url={`${origin}/f/${slug}/${f.slug}`}
          embed={embedSnippet({
            origin,
            slug,
            widget: "funnel",
            funnelSlug: f.slug,
            title: f.name,
          })}
        />
      ))}

      <p className="text-xs text-muted-foreground">
        {t("app.setLeadForm.footer")}
      </p>
    </div>
  );
}
