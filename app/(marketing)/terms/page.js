// app/(marketing)/terms/page.js
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/terms",
  title: "Terms of Service — FieldQuo",
  description: "The terms that apply to using FieldQuo.",
});

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-gray">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      <p>
        This is placeholder text. Real terms of service — covering subscription
        billing, acceptable use, liability, and data ownership between FieldQuo
        and subscribing companies — need to be drafted before this goes live.
        This is not a substitute for legal review.
      </p>
    </div>
  );
}
