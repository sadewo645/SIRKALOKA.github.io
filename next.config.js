/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/oauth2callback',
        destination: '/api/oauth2callback',
      },
      {
        source: '/auth/google/callback',
        destination: '/api/oauth2callback',
      },
    ];
  },
};

module.exports = nextConfig;