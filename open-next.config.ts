import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// CurrentPulse publishes its reader as static assets through the release workflows.
// Use the read-only static-assets cache so public reader traffic cannot exhaust the
// Workers KV free-tier write quota. Dynamic API/admin routes continue to execute in
// the Worker; reader freshness is handled by the existing materialize + deploy flow.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
