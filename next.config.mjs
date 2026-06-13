/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@google/genai', '@line/bot-sdk'],
  },
};

export default nextConfig;
