'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ArticleForm from '@/components/admin/ArticleForm'
import toast from 'react-hot-toast'

export default function EditArticlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/articles?id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        })
        const result = await response.json()

        if (response.status === 401 || response.status === 403) {
          router.replace('/admin/login')
          return
        }

        if (!response.ok) throw new Error(result.message || 'Unable to load article')
        setArticle(result.article)
      } catch (error) {
        console.error('Error fetching article:', error)
        toast.error('Failed to load article')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchArticle()
    }
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Article not found</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit Article</h1>
      <ArticleForm article={article} />
    </div>
  )
}
