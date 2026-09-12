// app/help/[lang]/[category]/[article]/page.js — one article.
//
// Anatomy, top to bottom (the pattern docs/help/JOBBER-HELP-TREE.md names):
// breadcrumbs · title · summary · updated date · language notice when the
// body is English for a reader in another language · video · intro
// paragraphs · "In this article" outline · sections · FAQ · was-this-helpful
// · previous / next · related articles.
//
// Static: every (language × category × article) pair with an English body
// is rendered at build time. A slug the tree knows but no module has written
// is not a page — generateStaticParams omits it and dynamicParams is off,
// so the URL 404s instead of showing a shell with nothing in it.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Info, Sparkles } from "lucide-react";
import ArticleBody from "@/app/components/help-centre/ArticleBody";
import HelpFeedback from "@/app/components/help-centre/HelpFeedback";
import Inline from "@/app/components/help-centre/Inline";
import { categoryLabels } from "@/app/components/help-centre/HelpShell";
import { helpT, HELP_CHROME_LANGS } from "@/lib/help/chrome";
import { figureSources, loadArticle, videoEmbed, writtenArticles } from "@/lib/help/content";
import { helpCanonical, helpPath } from "@/lib/help/urls";

export const dynamicParams = false;

export async function generateStaticParams() {
  const written = await writtenArticles();
  return HELP_CHROME_LANGS.flatMap((lang) => written.map((w) => ({ lang, category: w.category, article: w.slug })));
}

function formatDate(iso, lang) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(d);
  } catch {
    return iso;
  }
}

export async function generateMetadata({ params }) {
  const { lang, category, article: slug } = await params;
  const data = await loadArticle(lang, category, slug);
  if (!data) return {};
  const t = helpT(lang);
  return {
    title: `${data.article.title} — ${t("title")} — FieldQuo`,
    description: data.article.summary,
    alternates: {
      canonical: helpCanonical(lang, category, slug),
      languages: Object.fromEntries(HELP_CHROME_LANGS.map((l) => [l, helpCanonical(l, category, slug)])),
    },
  };
}

function Video({ video, lang, t }) {
  const embed = videoEmbed(video.url);
  if (!embed) return null;
  const foreign = video.lang && video.lang !== lang;
  return (
    <div className="my-6" data-help-video={video.lang}>
      <div className="overflow-hidden rounded-2xl border border-border bg-black aspect-video">
        {embed.kind === "youtube" ? (
          <iframe
            src={embed.src}
            title={video.title || t("article.video")}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <video src={embed.src} controls preload="metadata" className="h-full w-full" title={video.title || t("article.video")} />
        )}
      </div>
      {foreign && (
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground" data-help-video-notice>
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t("article.videoNotice")}
        </p>
      )}
    </div>
  );
}

export default async function HelpArticlePage({ params }) {
  const { lang, category, article: slug } = await params;
  const data = await loadArticle(lang, category, slug);
  if (!data) notFound();
  const t = helpT(lang);
  const labels = categoryLabels(t);
  const { article, meta, langUsed, fallback, prev, next, related, video } = data;
  const outline = [
    ...(article.sections || []).map((s) => ({ id: s.id, heading: s.heading })),
    ...(Array.isArray(article.faq) && article.faq.length ? [{ id: "faq", heading: t("article.faq") }] : []),
  ];

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={helpPath(lang)} className="hover:text-foreground">{t("breadcrumb.home")}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={helpPath(lang, category)} className="hover:text-foreground">{labels[category]}</Link></li>
          </ol>
        </nav>

        <header className="mt-4">
          {meta.only && (
            <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2.5 py-0.5 text-xs font-semibold text-brand-accent-text">
              <Sparkles size={12} aria-hidden="true" /> {t("article.onlyBadge")}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{article.title}</h1>
          {article.summary && <p className="mt-2 text-base text-muted-foreground">{article.summary}</p>}
          {article.updated && (
            <p className="mt-2 text-xs text-muted-foreground">
              <time dateTime={article.updated}>{t("article.updated", { date: formatDate(article.updated, lang) })}</time>
            </p>
          )}
        </header>

        {fallback && (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground" data-help-lang-notice={langUsed}>
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {t("article.englishOnly")}{" "}
              <Link href={helpPath("fr", category, slug)} className="underline">Français</Link>
              {" · "}
              <Link href={helpPath("es", category, slug)} className="underline">Español</Link>
            </span>
          </p>
        )}

        {video && <Video video={video} lang={lang} t={t} />}

        {Array.isArray(article.intro) && article.intro.length > 0 && (
          <div className="mt-5">
            {article.intro.map((p, i) => (
              <p key={i} className="my-3 text-[15px] leading-7 text-foreground/90"><Inline text={p} lang={lang} /></p>
            ))}
          </div>
        )}

        {outline.length > 1 && (
          <nav aria-label={t("article.onThisPage")} className="mt-6 rounded-2xl border border-border bg-card px-5 py-4 lg:hidden" data-help-outline>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("article.onThisPage")}</p>
            <ol className="mt-2 space-y-1.5 text-sm">
              {outline.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-foreground hover:underline">{s.heading}</a></li>
              ))}
            </ol>
          </nav>
        )}

        <ArticleBody
          article={article}
          lang={lang}
          bodyLang={langUsed}
          figureSources={figureSources(langUsed)}
          fallbackLabel={t("article.figureLangFallback")}
          faqHeading={t("article.faq")}
        />

        <HelpFeedback
          lang={lang}
          slug={slug}
          labels={{ helpful: t("article.helpful"), yes: t("article.yes"), no: t("article.no"), thanks: t("article.thanks"), failed: t("article.feedbackFailed") }}
        />

        <nav aria-label={`${t("article.prev")} / ${t("article.next")}`} className="mt-8 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={helpPath(lang, prev.category, prev.slug)} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:bg-muted/40">
              <ArrowLeft size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t("article.prev")}</span>
                <span className="block truncate text-sm font-medium text-foreground">{prev.title}</span>
              </span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={helpPath(lang, next.category, next.slug)} className="flex min-h-[56px] items-center justify-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-right hover:bg-muted/40">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t("article.next")}</span>
                <span className="block truncate text-sm font-medium text-foreground">{next.title}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mt-10" data-help-related>
            <h2 id="related" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("article.related")}</h2>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={helpPath(lang, r.category, r.slug)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{r.title}</span>
                      <span className="block text-xs text-muted-foreground">{labels[r.category]}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Desktop outline: sticky beside the body. The mobile copy above the
          body is the same list; only one is visible at a time. */}
      {outline.length > 1 && (
        <aside className="hidden lg:block">
          <nav aria-label={t("article.onThisPage")} className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("article.onThisPage")}</p>
            <ol className="mt-2 space-y-1.5 border-l border-border text-sm">
              {outline.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent pl-3 text-muted-foreground hover:border-foreground hover:text-foreground">{s.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      )}
    </article>
  );
}
