/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API requests to backend in development
  // In production, nginx handles this routing
  async rewrites() {
    // Only apply rewrites in development
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  
  // Security headers
  async headers() {
    // Get allowed frame ancestors from env or use defaults
    const frameAncestors = process.env.FRAME_ANCESTORS || 
      "'self' https://dashboard.tools.datahub.navixy.com https://*.navixy.com";
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // Use Content-Security-Policy frame-ancestors instead of X-Frame-Options
          // This allows iframe embedding from Navixy dashboard
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Production optimizations
  output: 'standalone',  // Optimized for Docker
  
  // Disable image optimization if not using Vercel
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
