import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Do not ignore TypeScript errors during build
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
