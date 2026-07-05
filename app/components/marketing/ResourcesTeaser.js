// app/components/marketing/ResourcesTeaser.js
import Link from "next/link";
import { BookOpen, HelpCircle, MessageCircleQuestion } from "lucide-react";

const RESOURCES = [
  {
    icon: BookOpen,
    label: "Help Center",
    description: "Guides for getting set up and using FieldQuo",
    href: "/resources/help",
  },
  {
    icon: HelpCircle,
    label: "FAQ",
    description: "Quick answers to common questions",
    href: "/resources/faq",
  },
  {
    icon: MessageCircleQuestion,
    label: "Contact Us",
    description: "Talk to a real person",
    href: "/contact",
  },
];

export default function ResourcesTeaser() {
  return (
    <section className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
          Free resources
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {RESOURCES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <r.icon size={22} className="text-gray-700 mb-3" />
              <div className="font-medium text-gray-900">{r.label}</div>
              <div className="text-sm text-gray-500 mt-1">{r.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
