// app/(marketing)/product/[slug]/page.js
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PRODUCT_FEATURES } from "@/app/data/productFeatures";

export function generateStaticParams() {
  return Object.keys(PRODUCT_FEATURES).map((slug) => ({ slug }));
}

export default async function ProductFeaturePage({ params }) {
  // Next 16: params is a Promise. Read synchronously it's undefined, so every
  // /product/* page hit notFound() and returned a 404 — the content was there
  // the whole time. Same bug class as the API routes, but pages weren't in
  // that sweep.
  const { slug } = await params;

  const feature = PRODUCT_FEATURES[slug];
  if (!feature) return notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {feature.label}
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">
        {feature.headline}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        {feature.description}
      </p>

      <ul className="mt-8 space-y-3 max-w-xl">
        {feature.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-green-600 shrink-0 mt-0.5"
            />
            <span className="text-foreground">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex gap-3">
        <Link
          href="/signup"
          className="bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold"
        >
          Start Free Trial
        </Link>
        <Link
          href="/pricing"
          className="border border-border px-6 py-3 rounded-full text-sm font-semibold"
        >
          See Pricing
        </Link>
      </div>
    </div>
  );
}
