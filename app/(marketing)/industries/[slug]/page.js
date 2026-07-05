// app/(marketing)/industries/[slug]/page.js
import { notFound } from "next/navigation";
import Link from "next/link";
import { X as XIcon, ArrowRight } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";
import { INDUSTRY_CONTENT } from "@/app/data/industryContent";

export function generateStaticParams() {
  return INDUSTRIES.map((ind) => ({ slug: ind.slug }));
}

export default function IndustryPage({ params }) {
  const industry = INDUSTRY_CONTENT[params.slug];
  if (!industry) return notFound();

  return (
    <div>
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {industry.headline}
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            {industry.description}
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold"
          >
            Start Free Trial <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Sound familiar?
        </h2>
        <ul className="space-y-3">
          {industry.painPoints.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <XIcon size={18} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-gray-700">{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-gray-50 border-t border-gray-100 py-12 text-center">
        <p className="text-sm text-gray-500 mb-3">Also serving nearby trades</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {INDUSTRIES.filter((i) => i.slug !== params.slug)
            .slice(0, 6)
            .map((i) => (
              <Link
                key={i.slug}
                href={`/industries/${i.slug}`}
                className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-full hover:border-gray-300"
              >
                {i.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
