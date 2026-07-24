import { AuthProvider } from '@/components/admin/AuthProvider'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminHeader from '@/components/admin/AdminHeader'
import { Toaster } from 'react-hot-toast'

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebar />
        <div className="lg:pl-64">
          <AdminHeader />
          <main className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  )
}