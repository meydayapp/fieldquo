// app/(marketing)/privacy/page.js
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/privacy",
  title: "Privacy Policy — FieldQuo",
  description:
    "How FieldQuo handles the data contractors and their clients put into it.",
});

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-gray">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      <p>
        This is placeholder text. A real privacy policy — covering what data
        FieldQuo collects from companies and their clients, how it's stored, and
        how it's used — needs to be drafted before this goes live with real
        customers. This is not a substitute for legal review.
      </p>
    </div>
  );
}
