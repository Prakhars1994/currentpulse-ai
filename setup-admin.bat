@echo off
title Admin Files Setup
color 0A

echo ============================================================
echo      ADMIN FILES SETUP - UPSC CURRENT AFFAIRS PLATFORM
echo ============================================================
echo.

echo [1] Checking if we're in the right folder...
echo.
if not exist package.json (
    echo ❌ ERROR: package.json not found!
    echo.
    echo You are NOT in your Next.js project folder.
    echo Please navigate to: C:\Users\prana\my-app
    echo.
    echo To fix, run this command first:
    echo     cd C:\Users\prana\my-app
    echo.
    pause
    exit /b
) else (
    echo ✅ Found package.json - You are in the right folder!
)
echo.

echo [2] Checking if folders exist or creating them...
echo.
if not exist components\admin (
    echo 📁 Creating: components\admin
    mkdir components\admin
    echo ✅ Created: components\admin
) else (
    echo ✅ Already exists: components\admin
)

if not exist app\admin\articles\create (
    echo 📁 Creating: app\admin\articles\create
    mkdir app\admin\articles\create
    echo ✅ Created: app\admin\articles\create
) else (
    echo ✅ Already exists: app\admin\articles\create
)

if not exist app\admin\articles\edit\[id] (
    echo 📁 Creating: app\admin\articles\edit\[id]
    mkdir app\admin\articles\edit\[id]
    echo ✅ Created: app\admin\articles\edit\[id]
) else (
    echo ✅ Already exists: app\admin\articles\edit\[id]
)
echo.

echo [3] Checking if files exist or creating them...
echo.

:: Check ArticleForm.jsx
if not exist components\admin\ArticleForm.jsx (
    echo 📄 Creating: components/admin/ArticleForm.jsx
    (
        echo 'use client'
        echo.
        echo import { useState, useEffect } from 'react'
        echo import { useRouter } from 'next/navigation'
        echo import { supabase } from '@/lib/supabase'
        echo import { useForm } from 'react-hook-form'
        echo import { zodResolver } from '@hookform/resolvers/zod'
        echo import { z } from 'zod'
        echo import RichTextEditor from './RichTextEditor'
        echo import ImageUpload from './ImageUpload'
        echo import toast from 'react-hot-toast'
        echo import slugify from 'slugify'
        echo.
        echo const articleSchema = z.object({
        echo   title: z.string().min(5, 'Title must be at least 5 characters'),
        echo   slug: z.string().min(5, 'Slug must be at least 5 characters'),
        echo   category: z.string().min(1, 'Category is required'),
        echo   paper: z.string().optional(),
        echo   why_news: z.string().optional(),
        echo   prelims: z.string().optional(),
        echo   mains: z.string().optional(),
        echo   question: z.string().optional(),
        echo   seo_title: z.string().optional(),
        echo   seo_description: z.string().max(160, 'Meta description must be less than 160 characters').optional(),
        echo   tags: z.string().optional(),
        echo   status: z.enum(['draft', 'published']),
        echo })
        echo.
        echo export default function ArticleForm({ article = null }) {
        echo   const [loading, setLoading] = useState(false)
        echo   const [imageUrl, setImageUrl] = useState(article?.image_url || '')
        echo   const [content, setContent] = useState(article?.content || '')
        echo   const [whyNews, setWhyNews] = useState(article?.why_news || '')
        echo   const [prelims, setPrelims] = useState(article?.prelims || '')
        echo   const [mains, setMains] = useState(article?.mains || '')
        echo   const [question, setQuestion] = useState(article?.question || '')
        echo   const [tags, setTags] = useState(article?.tags?.join(', ') || '')
        echo   const router = useRouter()
        echo   const isEditing = !!article
        echo.
        echo   const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
        echo     resolver: zodResolver(articleSchema),
        echo     defaultValues: {
        echo       title: article?.title || '',
        echo       slug: article?.slug || '',
        echo       category: article?.category || '',
        echo       paper: article?.paper || '',
        echo       why_news: article?.why_news || '',
        echo       prelims: article?.prelims || '',
        echo       mains: article?.mains || '',
        echo       question: article?.question || '',
        echo       seo_title: article?.seo_title || '',
        echo       seo_description: article?.seo_description || '',
        echo       tags: article?.tags?.join(', ') || '',
        echo       status: article?.status || 'draft',
        echo     },
        echo   })
        echo.
        echo   const title = watch('title')
        echo.
        echo   useEffect(() => {
        echo     if (title && !isEditing) {
        echo       const generatedSlug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g })
        echo       setValue('slug', generatedSlug)
        echo     }
        echo   }, [title, setValue, isEditing])
        echo.
        echo   const onSubmit = async (data) => {
        echo     setLoading(true)
        echo     try {
        echo       const { data: { session } } = await supabase.auth.getSession()
        echo       if (!session) { toast.error('You must be logged in'); return }
        echo.
        echo       const articleData = { 
        echo         ...data, 
        echo         image_url: imageUrl, 
        echo         content, 
        echo         why_news: whyNews, 
        echo         prelims, 
        echo         mains, 
        echo         question, 
        echo         tags: tags.split(',').map(tag => tag.trim()).filter(Boolean), 
        echo         author_id: session.user.id, 
        echo         updated_at: new Date().toISOString() 
        echo       }
        echo.
        echo       let result
        echo       if (isEditing) {
        echo         result = await supabase.from('articles').update(articleData).eq('id', article.id)
        echo       } else {
        echo         articleData.created_at = new Date().toISOString()
        echo         result = await supabase.from('articles').insert([articleData])
        echo       }
        echo.
        echo       if (result.error) throw result.error
        echo       toast.success(isEditing ? 'Article updated!' : 'Article created!')
        echo       router.push('/admin/articles')
        echo     } catch (error) { 
        echo       console.error(error); 
        echo       toast.error(error.message) 
        echo     } finally { 
        echo       setLoading(false) 
        echo     }
        echo   }
        echo.
        echo   return (
        echo     ^<form onSubmit={handleSubmit(onSubmit)} className="space-y-6"^>
        echo       ^<div className="bg-white shadow rounded-lg p-6"^>
        echo         ^<div className="grid grid-cols-1 gap-6"^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Article Title *^</label^>
        echo             ^<input {...register('title')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Enter article title" /^>
        echo             {errors.title ^&^& ^<p className="mt-1 text-sm text-red-600"^>{errors.title.message}^</p^>}
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>URL Slug *^</label^>
        echo             ^<div className="mt-1 flex rounded-md shadow-sm"^>
        echo               ^<span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"^>/current-affairs/^</span^>
        echo               ^<input {...register('slug')} className="flex-1 block w-full border border-gray-300 rounded-r-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="article-slug" /^>
        echo             ^</div^>
        echo             {errors.slug ^&^& ^<p className="mt-1 text-sm text-red-600"^>{errors.slug.message}^</p^>}
        echo           ^</div^>
        echo           ^<div className="grid grid-cols-1 md:grid-cols-2 gap-4"^>
        echo             ^<div^>
        echo               ^<label className="block text-sm font-medium text-gray-700"^>Category *^</label^>
        echo               ^<select {...register('category')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"^>
        echo                 ^<option value=""^>Select Category^</option^>
        echo                 ^<option value="Polity"^>Polity^</option^>
        echo                 ^<option value="Economy"^>Economy^</option^>
        echo                 ^<option value="Science ^& Technology"^>Science ^& Technology^</option^>
        echo                 ^<option value="Environment"^>Environment^</option^>
        echo                 ^<option value="International Relations"^>International Relations^</option^>
        echo                 ^<option value="History"^>History^</option^>
        echo                 ^<option value="Geography"^>Geography^</option^>
        echo                 ^<option value="Social Justice"^>Social Justice^</option^>
        echo                 ^<option value="Governance"^>Governance^</option^>
        echo                 ^<option value="Internal Security"^>Internal Security^</option^>
        echo                 ^<option value="Ethics"^>Ethics^</option^>
        echo                 ^<option value="Miscellaneous"^>Miscellaneous^</option^>
        echo               ^</select^>
        echo               {errors.category ^&^& ^<p className="mt-1 text-sm text-red-600"^>{errors.category.message}^</p^>}
        echo             ^</div^>
        echo             ^<div^>
        echo               ^<label className="block text-sm font-medium text-gray-700"^>GS Paper^</label^>
        echo               ^<select {...register('paper')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"^>
        echo                 ^<option value=""^>Select GS Paper^</option^>
        echo                 ^<option value="GS-1"^>GS Paper 1^</option^>
        echo                 ^<option value="GS-2"^>GS Paper 2^</option^>
        echo                 ^<option value="GS-3"^>GS Paper 3^</option^>
        echo                 ^<option value="GS-4"^>GS Paper 4^</option^>
        echo                 ^<option value="ESSAY"^>Essay^</option^>
        echo                 ^<option value="PRELIMS"^>Prelims^</option^>
        echo               ^</select^>
        echo             ^</div^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Featured Image^</label^>
        echo             ^<ImageUpload imageUrl={imageUrl} onImageUpload={(url) =^> setImageUrl(url)} onImageRemove={() =^> setImageUrl('')} /^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Article Content^</label^>
        echo             ^<RichTextEditor content={content} onChange={setContent} /^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Why in News^</label^>
        echo             ^<RichTextEditor content={whyNews} onChange={setWhyNews} placeholder="Why is this in the news?" /^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Prelims Facts^</label^>
        echo             ^<RichTextEditor content={prelims} onChange={setPrelims} placeholder="Key facts for Prelims" /^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>Mains Perspective^</label^>
        echo             ^<RichTextEditor content={mains} onChange={setMains} placeholder="Mains perspective and analysis" /^>
        echo           ^</div^>
        echo           ^<div^>
        echo             ^<label className="block text-sm font-medium text-gray-700"^>UPSC Mains Question^</label^>
        echo             ^<RichTextEditor content={question} onChange={setQuestion} placeholder="Sample UPSC Mains question" /^>
        echo           ^</div^>
        echo           ^<div className="border-t pt-6"^>
        echo             ^<h3 className="text-lg font-medium text-gray-900 mb-4"^>SEO Settings^</h3^>
        echo             ^<div className="space-y-4"^>
        echo               ^<div^>
        echo                 ^<label className="block text-sm font-medium text-gray-700"^>SEO Title^</label^>
        echo                 ^<input {...register('seo_title')} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="SEO title (leave blank to auto-generate)" /^>
        echo               ^</div^>
        echo               ^<div^>
        echo                 ^<label className="block text-sm font-medium text-gray-700"^>Meta Description^</label^>
        echo                 ^<textarea {...register('seo_description')} rows="2" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Meta description (max 160 characters)" /^>
        echo                 {errors.seo_description ^&^& ^<p className="mt-1 text-sm text-red-600"^>{errors.seo_description.message}^</p^>}
        echo               ^</div^>
        echo               ^<div^>
        echo                 ^<label className="block text-sm font-medium text-gray-700"^>Tags^</label^>
        echo                 ^<input value={tags} onChange={(e) =^> setTags(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Comma separated tags (e.g., Economy, Budget, Inflation)" /^>
        echo                 ^<p className="mt-1 text-xs text-gray-500"^>Separate tags with commas^</p^>
        echo               ^</div^>
        echo             ^</div^>
        echo           ^</div^>
        echo           ^<div className="border-t pt-6"^>
        echo             ^<div className="flex items-center space-x-4"^>
        echo               ^<label className="text-sm font-medium text-gray-700"^>Status^</label^>
        echo               ^<div className="flex space-x-4"^>
        echo                 ^<label className="inline-flex items-center"^>
        echo                   ^<input type="radio" {...register('status')} value="draft" className="form-radio h-4 w-4 text-blue-600" /^>
        echo                   ^<span className="ml-2 text-sm text-gray-700"^>Draft^</span^>
        echo                 ^</label^>
        echo                 ^<label className="inline-flex items-center"^>
        echo                   ^<input type="radio" {...register('status')} value="published" className="form-radio h-4 w-4 text-blue-600" /^>
        echo                   ^<span className="ml-2 text-sm text-gray-700"^>Published^</span^>
        echo                 ^</label^>
        echo               ^</div^>
        echo             ^</div^>
        echo           ^</div^>
        echo         ^</div^>
        echo       ^</div^>
        echo       ^<div className="flex justify-end space-x-3"^>
        echo         ^<button type="button" onClick={() =^> router.push('/admin/articles')} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"^>Cancel^</button^>
        echo         ^<button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"^>{loading ? 'Saving...' : isEditing ? 'Update Article' : 'Create Article'}^</button^>
        echo       ^</div^>
        echo     ^</form^>
        echo   )
        echo }
    ) > components\admin\ArticleForm.jsx
    echo ✅ Created: components/admin/ArticleForm.jsx
) else (
    echo ✅ Already exists: components/admin/ArticleForm.jsx
)

:: Check create/page.jsx
if not exist app\admin\articles\create\page.jsx (
    echo 📄 Creating: app/admin/articles/create/page.jsx
    (
        echo import ArticleForm from '@/components/admin/ArticleForm'
        echo.
        echo export default function CreateArticlePage() {
        echo   return (
        echo     ^<div^>
        echo       ^<h1 className="text-2xl font-semibold text-gray-900 mb-6"^>Create New Article^</h1^>
        echo       ^<ArticleForm /^>
        echo     ^</div^>
        echo   )
        echo }
    ) > app\admin\articles\create\page.jsx
    echo ✅ Created: app/admin/articles/create/page.jsx
) else (
    echo ✅ Already exists: app/admin/articles/create/page.jsx
)

:: Check edit/[id]/page.jsx
if not exist app\admin\articles\edit\[id]\page.jsx (
    echo 📄 Creating: app/admin/articles/edit/[id]/page.jsx
    (
        echo 'use client'
        echo.
        echo import { useEffect, useState } from 'react'
        echo import { useParams } from 'next/navigation'
        echo import { supabase } from '@/lib/supabase'
        echo import ArticleForm from '@/components/admin/ArticleForm'
        echo import toast from 'react-hot-toast'
        echo.
        echo export default function EditArticlePage() {
        echo   const params = useParams()
        echo   const id = params.id
        echo   const [article, setArticle] = useState(null)
        echo   const [loading, setLoading] = useState(true)
        echo.
        echo   useEffect(() => {
        echo     const fetchArticle = async () => {
        echo       try {
        echo         const { data, error } = await supabase
        echo           .from('articles')
        echo           .select('*')
        echo           .eq('id', id)
        echo           .single()
        echo.
        echo         if (error) throw error
        echo         setArticle(data)
        echo       } catch (error) {
        echo         console.error('Error fetching article:', error)
        echo         toast.error('Failed to load article')
        echo       } finally {
        echo         setLoading(false)
        echo       }
        echo     }
        echo.
        echo     if (id) {
        echo       fetchArticle()
        echo     }
        echo   }, [id])
        echo.
        echo   if (loading) {
        echo     return (
        echo       ^<div className="flex items-center justify-center h-64"^>
        echo         ^<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"^>^</div^>
        echo       ^</div^>
        echo     )
        echo   }
        echo.
        echo   if (!article) {
        echo     return (
        echo       ^<div className="text-center py-12"^>
        echo         ^<p className="text-gray-500"^>Article not found^</p^>
        echo       ^</div^>
        echo     )
        echo   }
        echo.
        echo   return (
        echo     ^<div^>
        echo       ^<h1 className="text-2xl font-semibold text-gray-900 mb-6"^>Edit Article^</h1^>
        echo       ^<ArticleForm article={article} /^>
        echo     ^</div^>
        echo   )
        echo }
    ) > app\admin\articles\edit\[id]\page.jsx
    echo ✅ Created: app/admin/articles/edit/[id]/page.jsx
) else (
    echo ✅ Already exists: app/admin/articles/edit/[id]/page.jsx
)
echo.

echo ============================================================
echo                     SETUP COMPLETE!
echo ============================================================
echo.
echo 📁 Folders created/verified:
echo    - components/admin
echo    - app/admin/articles/create
echo    - app/admin/articles/edit/[id]
echo.
echo 📄 Files created/verified:
echo    - components/admin/ArticleForm.jsx
echo    - app/admin/articles/create/page.jsx
echo    - app/admin/articles/edit/[id]/page.jsx
echo.
echo ============================================================
echo                     NEXT STEPS
echo ============================================================
echo.
echo 1. Install packages if not already:
echo    npm install @supabase/ssr @supabase/auth-helpers-nextjs
echo    npm install @tiptap/react @tiptap/starter-kit
echo    npm install react-hook-form @hookform/resolvers zod
echo    npm install lucide-react react-hot-toast date-fns react-dropzone uuid slugify
echo.
echo 2. Create .env.local with your Supabase credentials
echo.
echo 3. Run: npm run dev
echo.
pause