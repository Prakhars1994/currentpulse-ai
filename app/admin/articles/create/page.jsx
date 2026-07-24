import ArticleForm from '@/components/admin/ArticleForm'

export default function CreateArticlePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Create New Article</h1>
      <ArticleForm />
    </div>
  )
}