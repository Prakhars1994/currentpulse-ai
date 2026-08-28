# CurrentPulse AI

Production-ready MVP for a UPSC current-affairs platform built with Next.js 16, Supabase, Tailwind CSS and Gemini.

## Included

- Public homepage, current-affairs listing, category pages and article pages
- Search, SEO metadata, sitemap and robots.txt
- Article reading time, related articles, previous/next navigation and view counter
- Admin login guard, dashboard, article creation, editing, deletion, draft/publish workflow
- Supabase Storage image upload with 5 MB/type validation
- Category summary and admin settings pages
- AI assistant endpoint and UI
- Responsive navigation and footer

## 1. Install

```bash
npm install
```

## 2. Environment

Copy `.env.example` to `.env.local` and enter your own values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
GEMINI_API_KEY=...
```

Never commit `.env.local`.

## 3. Supabase setup

Open **Supabase → SQL Editor**, paste all of `supabase/setup.sql`, and run it once. It creates/updates:

- article status, views, image, SEO and tag columns
- article indexes and RLS policies
- the article view-increment function
- the public `article-images` bucket
- authenticated upload/update/delete policies

Then create an admin user in **Supabase → Authentication → Users**.

## 4. Run

```bash
npm run dev
```

Open:

- Website: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin/login`

## 5. Production validation

```bash
npm run lint
npm run build
npm start
```

Configure production secrets on Cloudflare Worker `cp`; both `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_SITE_URL` use `https://cp.vliab.workers.dev`.

## Security

The included policies are designed for a single-admin CMS: public users can read only published articles; authenticated users can manage articles and article images. For a multi-author system, tighten policies by matching `author_id` to `auth.uid()`.
