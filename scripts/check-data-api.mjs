// Fail before a build can materialize empty pages during a data-service outage.
const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!origin || !key) throw new Error('Missing data-service configuration');
for (const table of ['articles', 'exam_updates', 'reader_release_requests']) {
  const response = await fetch(`${origin}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.text();
    const quota = response.status === 402 ? ' Restore the project quota/service in Supabase before releasing.' : '';
    throw new Error(`Data API unavailable for ${table}: HTTP ${response.status}.${quota} ${body.slice(0, 600)}`);
  }
  console.log(`Data API ${table}: OK`);
}
