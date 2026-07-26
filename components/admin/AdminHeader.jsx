'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminHeader() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  return (
    <header className="bg-white shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Welcome back, {user?.email?.split('@')[0] || 'Admin'}
          </h2>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
              {user?.email?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}