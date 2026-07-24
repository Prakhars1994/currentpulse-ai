'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Pencil, Trash2, PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ArticlesPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchArticles()
  }, [])

  async function fetchArticles() {
    setLoading(true)

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      toast.error('Failed to load articles')
    } else {
      setArticles(data || [])
    }

    setLoading(false)
  }

  async function deleteArticle(id) {
    if (!confirm('Delete this article?')) return

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Article deleted')
    fetchArticles()
  }

  return (
    <div className="p-6">

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Articles</h1>
          <p className="text-gray-500">
            Manage your UPSC Current Affairs articles
          </p>
        </div>

        <Link
          href="/admin/articles/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <PlusCircle size={18} />
          New Article
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : articles.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <h2 className="text-xl font-semibold">No Articles Found</h2>
          <p className="text-gray-500 mt-2">
            Create your first UPSC Current Affairs article.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">

          <table className="min-w-full">

            <thead className="bg-gray-100">

              <tr>

                <th className="text-left px-6 py-3">Title</th>

                <th className="text-left px-6 py-3">Category</th>

                <th className="text-left px-6 py-3">Paper</th>

                <th className="text-left px-6 py-3">Status</th>

                <th className="text-left px-6 py-3">Created</th>

                <th className="text-right px-6 py-3">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {articles.map((article) => (

                <tr
                  key={article.id}
                  className="border-t"
                >

                  <td className="px-6 py-4 font-medium">
                    {article.title}
                  </td>

                  <td className="px-6 py-4">
                    {article.category}
                  </td>

                  <td className="px-6 py-4">
                    {article.paper}
                  </td>

                  <td className="px-6 py-4">

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        article.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {article.status}
                    </span>

                  </td>

                  <td className="px-6 py-4">
                    {new Date(article.created_at).toLocaleDateString()}
                  </td>

                  <td className="px-6 py-4 text-right">

                    <Link
                      href={`/admin/articles/edit/${article.id}`}
                      className="inline-flex mr-3 text-blue-600 hover:text-blue-800"
                    >
                      <Pencil size={18} />
                    </Link>

                    <button
                      onClick={() => deleteArticle(article.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>
      )}

    </div>
  )
}