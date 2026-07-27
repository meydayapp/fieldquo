// app/components/marketing/ResourcesTeaser.js
"use client";

import Link from "next/link";
import { BookOpen, HelpCircle, MessageCircleQuestion } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// Labels reuse footer.links.* — Help Center, FAQ and Contact us appear in
// both the footer and here, and keeping one key per string means a wording
// change lands in both places at once.
const RESOURCES = [
  {
    icon: BookOpen,
    labelKey: "footer.links.help",
    descKey: "resources.help.description",
    href: "/resources/help",
  },
  {
    icon: HelpCircle,
    labelKey: "footer.links.faq",
    descKey: "resources.faq.description",
    href: "/resources/faq",
  },
  {
    icon: MessageCircleQuestion,
    labelKey: "footer.links.contact",
    descKey: "resources.contact.description",
    href: "/contact",
  },
];

export default function ResourcesTeaser() {
  const { t } = useTranslation();

  return (
    <section className="bg-gray-50 border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
          {t("resources.title")}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {RESOURCES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <r.icon size={22} className="text-gray-700 mb-3" />
              <div className="font-medium text-gray-900">{t(r.labelKey)}</div>
              <div className="text-sm text-gray-500 mt-1">{t(r.descKey)}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
