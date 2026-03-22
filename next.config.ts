import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/logical-boost-hub',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
