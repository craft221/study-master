/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Production: standalone output pour Docker optimise
  output: 'standalone',

  images: {
    domains: ['localhost', 'studera.app', 'api.studera.app'],
    unoptimized: process.env.NODE_ENV === 'development'
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.studera.app' : 'http://localhost:8000'),
    NEXT_PUBLIC_APP_NAME: 'Studera',
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

module.exports = nextConfig
