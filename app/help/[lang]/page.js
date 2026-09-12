// app/help/[lang]/page.js — the help centre's home: search, the categories,
// the articles most people need first, and the videos when there are any.
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import HelpSearch from "@/app/components/help-centre/HelpSearch";
import { categoryLabels } from "@/app/components/help-centre/HelpShell";
import CategoryIcon from "@/app/components/help-centre/CategoryIcon";
import { helpT, HELP_CHROME_LANGS } from "@/lib/help/chrome";
import { HELP_CATEGORIES, articleMeta } from "@/lib/help/tree";
import { categoryList, loadCategory } from "@/lib/help/content";
import { helpCanonical, helpPath } from "@/lib/help/urls";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_CHROME_LANGS.map((lang) => ({ lang }));
}

// The articles a new contractor opens first — a fixed list, not a click
// count, because there is no click count (nothing here tracks readers) and a
// list somebody chose is at least honest about what it is.
const POPULAR = [
  "your-first-day-setup-checklist",
  "build-a-quote",
  "send-a-quote",
  "connect-stripe-and-get-verified",
  "payment-processing-fees-and-payouts",
  "invite-a-team-member",
  "the-website-builder",
  "the-phone-receptionist",
  "instant-quotes-on-your-website",
  "using-fieldquo-on-your-phone",
];

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = helpT(lang);
  return {
    title: `${t("title")} — FieldQuo`,
    description: t("tagline"),
    alternates: {
      canonical: helpCanonical(lang),
      languages: Object.fromEntries(HELP_CHROME_LANGS.map((l) => [l, helpCanonical(l)])),
    },
    robots: { index: true, follow: true },
  };
}

export default async function HelpHome({ params }) {
  const { lang } = await params;
  const t = helpT(lang);
  const labels = categoryLabels(t);

  // Counts are of WRITTEN articles, per language body, so the number on a
  // card never promises pages that do not open.
  const counts = {};
  for (const c of HELP_CATEGORIES) {
    const list = await categoryList(lang, c.key);
    counts[c.key] = list ? list.length : 0;
  }

  const popular = [];
  const cache = new Map();
  for (const slug of POPULAR) {
    const meta = articleMeta(slug);
    if (!meta) continue;
    if (!cache.has(meta.category)) cache.set(meta.category, await loadCategory(lang, meta.category));
    const a = cache.get(meta.category)[slug];
    if (a) popular.push({ slug, category: meta.category, title: a.title, summary: a.summary });
  }

  const videoList = (await categoryList(lang, "videos")) || [];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-12 sm:py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">{t("tagline")}</p>
        <div className="mx-auto mt-6 max-w-2xl">
          <HelpSearch
            lang={lang}
            placeholder={t("search.placeholder")}
            label={t("search.label")}
            noneLabel={t("search.none")}
            countLabel={t("search.count")}
            categoryLabels={labels}
          />
        </div>
      </section>

      <section aria-labelledby="browse">
        <h2 id="browse" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("home.browse")}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_CATEGORIES.filter((c) => counts[c.key] > 0 || !c.virtual).map((c) => (
            <li key={c.key}>
              <Link
                href={helpPath(lang, c.key)}
                className="flex h-full gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-white/10 dark:text-white">
                  <CategoryIcon name={c.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{labels[c.key]}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{t(`blurb.${c.key}`)}</span>
                  <span className="mt-1.5 block text-xs text-muted-foreground">{t("home.count", { n: counts[c.key] })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {popular.length > 0 && (
        <section aria-labelledby="popular" className="mt-12">
          <h2 id="popular" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("home.popular")}</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {popular.map((a) => (
              <li key={a.slug}>
                <Link href={helpPath(lang, a.category, a.slug)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.summary}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videoList.length > 0 && (
        <section aria-labelledby="videos" className="mt-12">
          <h2 id="videos" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("home.videos")}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videoList.map((a) => (
              <li key={a.slug}>
                <Link href={helpPath(lang, a.category, a.slug)} className="flex gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40">
                  <PlayCircle size={20} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{a.video?.title || a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
