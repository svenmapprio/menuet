const securityHeaders = [
  {
    key: 'no-referrer-when-downgrade',
    value: 'on'
  }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  compress: false,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  output: "standalone",
  reactStrictMode: true,
  webpack(config) {
    config.optimization.minimize = false;
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'menuet.ams3.cdn.digitaloceanspaces.com',
        port: '',
        pathname: '/content/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
