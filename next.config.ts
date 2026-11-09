/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/news/indias-first-telecom-manufacturing-zone-to-be-established-in-gwalior-msfqqve9', destination: '/news/indias-first-telecom-manufacturing-zone-to-be-established-in-gwalior', permanent: true },
      { source: '/current-affairs/indias-first-telecom-manufacturing-zone-to-be-established-in-gwalior-msfqqve9', destination: '/current-affairs/indias-first-telecom-manufacturing-zone-to-be-established-in-gwalior', permanent: true },
      { source: '/news/national-building-construction-standards-2026-msuf37i6', destination: '/news/national-building-construction-standards-2026', permanent: true },
      { source: '/current-affairs/national-building-construction-standards-2026-msuf37i6', destination: '/current-affairs/national-building-construction-standards-2026', permanent: true },
      { source: '/news/the-closing-auction-session-cas-msnoy1w0', destination: '/news/the-closing-auction-session-cas', permanent: true },
      { source: '/current-affairs/the-closing-auction-session-cas-msnoy1w0', destination: '/current-affairs/the-closing-auction-session-cas', permanent: true },
      { source: '/news/the-payment-and-settlement-systems-act-2007-msugzrdv', destination: '/news/the-payment-and-settlement-systems-act-2007', permanent: true },
      { source: '/current-affairs/the-payment-and-settlement-systems-act-2007-msugzrdv', destination: '/current-affairs/the-payment-and-settlement-systems-act-2007', permanent: true }
    ];
  },

  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/notes',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, follow',
          },
        ],
      },
    ];
  },
}

export default nextConfig
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
