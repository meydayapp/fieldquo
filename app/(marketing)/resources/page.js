// app/(marketing)/resources/page.js
import Link from "next/link";
import { FAQS } from "@/app/data/faqs";

export default function ResourcesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-8">Resources</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-16">
        <Link
          href="/resources/help"
          className="border border-border rounded-xl p-6 hover:border-border"
        >
          <div className="font-medium text-foreground">Help Center</div>
          <div className="text-sm text-muted-foreground mt-1">
            Setup guides and how-tos
          </div>
        </Link>
        <Link
          href="/contact"
          className="border border-border rounded-xl p-6 hover:border-border"
        >
          <div className="font-medium text-foreground">Contact Us</div>
          <div className="text-sm text-muted-foreground mt-1">
            Talk to a real person
          </div>
        </Link>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-6">
        Frequently asked questions
      </h2>
      <div className="space-y-6">
        {FAQS.map((f) => (
          <div key={f.q}>
            <h3 className="font-medium text-foreground">{f.q}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
