/** @type {import('next').NextConfig} */

const path = require('path');

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
];

const nextConfig = {
  webpack: function (config) {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });

    // ✅ Add alias for "@" to support clean imports
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
    };

    return config;
  },
  env: {
    siteTitle: 'Whisper API Sample App',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      }
    ];
  },
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },
  trailingSlash: true,
  experimental: {
    appDir: true,
    serverActions: true, // Optional but common with `appDir`
  },
  reactStrictMode: true, // Optional but recommended
};

module.exports = nextConfig;
