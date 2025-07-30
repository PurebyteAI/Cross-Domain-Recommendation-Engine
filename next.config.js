/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // ESLint configuration
  eslint: {
    // Disable ESLint during builds if ESLINT_NO_DEV_ERRORS is set
    ignoreDuringBuilds: process.env.ESLINT_NO_DEV_ERRORS === 'true',
  },
  
  // TypeScript configuration
  typescript: {
    // Disable type checking during builds for faster builds
    ignoreBuildErrors: process.env.ESLINT_NO_DEV_ERRORS === 'true',
  },
  
  // Webpack configuration to exclude Supabase functions
  webpack: (config, { isServer }) => {
    // Ignore Supabase functions directory during watch
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/functions/**', '**/node_modules/**'],
    };
    
    return config;
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Turbopack configuration (moved from experimental)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Experimental features (only stable ones)
  experimental: {
    // Optimize package imports for better performance
    optimizePackageImports: ['lucide-react'],
  },
  
  // Environment-specific configuration
  async headers() {
    const headers = [
      // Static assets caching
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes caching
      {
        source: '/api/docs/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
        ],
      },
      // Security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];

    // Add CORS headers for development
    if (process.env.NODE_ENV === 'development') {
      headers.push({
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      });
    }

    return headers;
  },
  
  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Development-specific optimizations
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // Production redirects and rewrites
  async redirects() {
    return [
      {
        source: '/docs',
        destination: '/api/docs',
        permanent: true,
      },
    ];
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Output optimization for containerization
    output: 'standalone',
  }),
  
  // Bundle analyzer configuration
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
      return config;
    },
  }),
}

module.exports = nextConfig