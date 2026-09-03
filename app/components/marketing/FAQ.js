// app/components/marketing/FAQ.js
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/app/data/faqs";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FAQ() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="bg-muted border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
          {t("faq.title")}
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={faq.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  // The chevron rotates and nothing told a screen reader why.
                  // The answer below is mounted/unmounted rather than hidden,
                  // so aria-expanded is the only signal the row has a state.
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-3 min-h-[44px] px-5 py-4 text-left"
                >
                  <span className="font-medium text-foreground">
                    {t(`faq.items.${faq.id}.q`)}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed">
                    {t(`faq.items.${faq.id}.a`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
