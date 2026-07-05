// app/(marketing)/product/[slug]/page.js
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PRODUCT_FEATURES } from "@/app/data/productFeatures";

export function generateStaticParams() {
  return Object.keys(PRODUCT_FEATURES).map((slug) => ({ slug }));
}

export default function ProductFeaturePage({ params }) {
  const feature = PRODUCT_FEATURES[params.slug];
  if (!feature) return notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {feature.label}
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">
        {feature.headline}
      </h1>
      <p className="mt-4 text-lg text-gray-600 max-w-2xl">
        {feature.description}
      </p>

      <ul className="mt-8 space-y-3 max-w-xl">
        {feature.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-green-600 shrink-0 mt-0.5"
            />
            <span className="text-gray-700">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex gap-3">
        <Link
          href="/signup"
          className="bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold"
        >
          Start Free Trial
        </Link>
        <Link
          href="/pricing"
          className="border border-gray-300 px-6 py-3 rounded-full text-sm font-semibold"
        >
          See Pricing
        </Link>
      </div>
    </div>
  );
}
