/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  reactStrictMode: true,
  // OpenNext already bundles the required server runtime. CurrentPulse does
  // not use next/font, so tracing Next's 4.2 MiB capsize metrics database into
  // the Worker only pushes the free-plan compressed bundle over 3 MiB.
  outputFileTracingExcludes: {
    "/*": ["./node_modules/next/dist/server/capsize-font-metrics.json"],
  },
}

export default nextConfig
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
