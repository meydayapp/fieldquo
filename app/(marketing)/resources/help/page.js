// app/(marketing)/resources/help/page.js
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/resources/help",
  title: "Help Center — FieldQuo",
  description:
    "Setup guides and how-tos for getting your company running on FieldQuo.",
});

export default function HelpCenterPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">Help Center</h1>
      <p className="text-muted-foreground">
        Setup guides and detailed how-tos are coming soon. In the meantime,{" "}
        <a href="/contact" className="underline">
          reach out
        </a>{" "}
        and we'll help directly.
      </p>
    </div>
  );
}
