// app/components/marketing/ResourcesTeaser.js
"use client";

import Link from "next/link";
import {
  BookOpen,
  HelpCircle,
  MessageCircleQuestion,
  ArrowRight,
} from "lucide-react";
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
    // /resources#faq, not /resources/faq. The latter has never existed — the
    // footer dropped its copy of this link for that reason and this one was
    // left pointing at a 404. The FAQ now renders in full on /resources under
    // that anchor.
    href: "/resources#faq",
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
    <section className="bg-muted border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">
          {t("resources.title")}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {RESOURCES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              // hover:border-border on an element already border-border: a
              // hover state that changed nothing. See FeaturesIndustries.
              //
              // h-full + flex-col so the three cards match height whatever the
              // description does in a given language — Help Centre's is two
              // lines in German and one in English, and three cards of three
              // different heights read as a rendering fault.
              className="group flex h-full flex-col bg-card border border-border rounded-xl p-6 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <r.icon size={22} className="text-foreground mb-3" />
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {t(r.labelKey)}
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <div className="text-sm text-muted-foreground mt-1">{t(r.descKey)}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
