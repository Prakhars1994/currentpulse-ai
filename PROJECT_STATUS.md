# Project status

The code package contains the complete CurrentPulse AI MVP workflow.

External services still require the project owner's credentials and one-time configuration:

1. `.env.local` values
2. running `supabase/setup.sql`
3. creating the Supabase admin user
4. adding production environment variables in Vercel

These cannot be embedded safely in a shared ZIP.
