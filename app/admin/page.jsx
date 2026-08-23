'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, TrendingUp, Clock, CheckCircle } from 'lucide-react'

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ totalArticles: 0, published: 0, drafts: 0 })
  const [recentArticles, setRecentArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/articles?mode=dashboard', { cache: 'no-store' })
        const result = await response.json()

        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login')
          return
        }

        if (!response.ok) {
          throw new Error(result.message || 'Unable to load dashboard data')
        }

        setStats(result.stats || { totalArticles: 0, published: 0, drafts: 0 })
        setRecentArticles(result.recentArticles || [])
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const statItems = [
    { label: 'Total Articles', value: stats.totalArticles, icon: FileText, color: 'bg-blue-500' },
    { label: 'Published', value: stats.published, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Drafts', value: stats.drafts, icon: Clock, color: 'bg-yellow-500' },
    { label: 'Total Views', value: 0, icon: TrendingUp, color: 'bg-purple-500' },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item) => (
          <div key={item.label} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${item.color}`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{item.label}</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{item.value}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Articles</h3>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {recentArticles.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">No articles yet. Create your first article!</li>
            ) : (
              recentArticles.map((article) => (
                <li key={article.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-600 truncate">{article.title}</p>
                        <p className="text-sm text-gray-500">{article.category} • {new Date(article.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          article.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.status || 'draft'}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
