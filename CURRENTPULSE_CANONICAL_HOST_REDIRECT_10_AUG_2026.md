# CurrentPulse canonical-host redirect

## What changed

- `vercel.json` now issues a permanent host-specific redirect from
  `currentpulse-ai-kl7x.vercel.app` to `currentpulse-ai.vercel.app`.
- The captured path and the original query string are preserved.
- `proxy.ts` contains the same 308 redirect as a runtime fallback.
- Requests already using `currentpulse-ai.vercel.app` are not redirected.
- Existing admin authentication and cron schedules are unchanged.

## Install and deploy

Run these commands from the project root after placing the ZIP there:

```cmd
powershell -NoProfile -Command "Expand-Archive -LiteralPath '.\CurrentPulse-canonical-host-redirect-676c137.zip' -DestinationPath '.' -Force"
git add vercel.json proxy.ts CURRENTPULSE_CANONICAL_HOST_REDIRECT_10_AUG_2026.md
git commit -m "Redirect legacy Vercel hostname to canonical domain"
git push origin main
```

Wait for the production deployment to finish, then verify both a page path and
its query string:

```cmd
curl -sS -I "https://currentpulse-ai-kl7x.vercel.app/current-affairs?test=canonical"
curl -sS -I "https://currentpulse-ai.vercel.app/current-affairs?test=canonical"
```

Expected result:

- The first command returns `308` and a `Location` beginning with
  `https://currentpulse-ai.vercel.app/current-affairs`.
- The second command returns `200` and never redirects back to the old host.

## Important Vercel ownership check

Redirect code only runs on deployments of the project that owns the hostname.
If the old hostname still returns `200` after the new production deployment,
`currentpulse-ai-kl7x.vercel.app` belongs to a different Vercel project or an
immutable older deployment. Open that project's Vercel dashboard and either:

1. configure a permanent project-level redirect to
   `https://currentpulse-ai.vercel.app`, preserving the path; or
2. deploy this same redirect patch to that project.

Removing a domain without installing a redirect can turn old indexed links into
404 responses, so use a redirect rather than merely detaching it.
