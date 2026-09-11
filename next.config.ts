/** @type {import('next').NextConfig} */
const nextConfig = {
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
