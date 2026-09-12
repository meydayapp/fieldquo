// app/help/[lang]/[category]/page.js — one category: its written articles
// in tree order. A virtual category (Only in FieldQuo, Videos) lists
// articles that live elsewhere; their links go to the home category.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
import { categoryLabels } from "@/app/components/help-centre/HelpShell";
import CategoryIcon from "@/app/components/help-centre/CategoryIcon";
import { helpT, HELP_CHROME_LANGS } from "@/lib/help/chrome";
import { CATEGORY_KEYS, HELP_CATEGORIES } from "@/lib/help/tree";
import { categoryList } from "@/lib/help/content";
import { helpCanonical, helpPath } from "@/lib/help/urls";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_CHROME_LANGS.flatMap((lang) => CATEGORY_KEYS.map((category) => ({ lang, category })));
}

export async function generateMetadata({ params }) {
  const { lang, category } = await params;
  if (!CATEGORY_KEYS.includes(category)) return {};
  const t = helpT(lang);
  return {
    title: `${t(`category.${category}`)} — ${t("title")} — FieldQuo`,
    description: t(`blurb.${category}`),
    alternates: {
      canonical: helpCanonical(lang, category),
      languages: Object.fromEntries(HELP_CHROME_LANGS.map((l) => [l, helpCanonical(l, category)])),
    },
  };
}

export default async function HelpCategoryPage({ params }) {
  const { lang, category } = await params;
  if (!CATEGORY_KEYS.includes(category)) notFound();
  const t = helpT(lang);
  const labels = categoryLabels(t);
  const cat = HELP_CATEGORIES.find((c) => c.key === category);
  const list = (await categoryList(lang, category)) || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={helpPath(lang)} className="hover:text-foreground">{t("breadcrumb.home")}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">{labels[category]}</li>
        </ol>
      </nav>

      <div className="mt-4 flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-white/10 dark:text-white">
          <CategoryIcon name={cat.icon} size={22} />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{labels[category]}</h1>
          <p className="mt-1 text-muted-foreground">{t(`blurb.${category}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("home.count", { n: list.length })}</p>
        </div>
      </div>

      <ol className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
        {list.map((a) => (
          <li key={a.slug}>
            <Link href={helpPath(lang, a.category, a.slug)} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-medium text-foreground">{a.title}</span>
                  {a.only && cat.virtual !== "only" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[11px] font-semibold text-brand-accent-text">
                      <Sparkles size={11} aria-hidden="true" /> {t("article.onlyBadge")}
                    </span>
                  )}
                  {a.video && <PlayCircle size={14} className="text-brand-accent" aria-label={t("article.video")} />}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{a.summary}</span>
                {cat.virtual && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{labels[a.category]}</span>
                )}
              </span>
              <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
