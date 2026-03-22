import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/logical-boost-hub',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
