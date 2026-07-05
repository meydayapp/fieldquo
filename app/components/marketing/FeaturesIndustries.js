// app/components/marketing/FeaturesIndustries.js
import Link from "next/link";
import { FileText, Calendar, Users, BarChart3 } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";

const FEATURES = [
  { icon: FileText, label: "Quotes & Invoicing", href: "/product/quoting" },
  {
    icon: Calendar,
    label: "Scheduling & Dispatch",
    href: "/product/scheduling",
  },
  { icon: Users, label: "Team & Payroll", href: "/product/team" },
  { icon: BarChart3, label: "Analytics & AI", href: "/product/analytics" },
];

export default function FeaturesIndustries() {
  return (
    <section className="bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
          Everything your business needs, in one place
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <f.icon size={24} className="text-gray-700 mb-3" />
              <div className="font-medium text-gray-900">{f.label}</div>
            </Link>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 text-center mb-6">
          Built for any trade
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="text-sm bg-gray-50 border border-gray-200 px-4 py-2 rounded-full hover:border-gray-300 hover:bg-gray-100"
            >
              {ind.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
