// app/app/layout.js
import AdminSidebar from "@/app/components/layout/AdminSidebar";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
