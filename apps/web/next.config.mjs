/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  
  // Ensure environment variables are properly loaded
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API,
  },
  
  // Enable standalone output for better deployment
  output: 'standalone',
};

export default nextConfig;
