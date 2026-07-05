// app/(marketing)/layout.js
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import MarketingFooter from "@/app/components/marketing/MarketingFooter";

export default function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
