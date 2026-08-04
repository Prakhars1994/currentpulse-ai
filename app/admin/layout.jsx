import AdminShell from "@/components/admin/AdminShell";

export const metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
