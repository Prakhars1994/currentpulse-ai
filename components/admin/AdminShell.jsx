"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { AuthProvider } from "@/components/admin/AuthProvider";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

export default function AdminShell({ children }) {
  const pathname = usePathname();

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return children;
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-100">
        <AdminSidebar />

        <div className="lg:pl-64">
          <AdminHeader />
          <main className="p-4 text-slate-900 sm:p-6">{children}</main>
        </div>

        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}
