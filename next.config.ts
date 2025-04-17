// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disables ESLint during build
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true, // Or whatever your existing setting is
  // Add the images configuration block
  images: {
    remotePatterns: [
      {
        protocol: 'https', // Allow only HTTPS
        hostname: 'upload.wikimedia.org', // Allow this specific hostname
        port: '', // Keep empty for default ports (80/443)
        pathname: '/**', // Allow any path under this hostname
      },
      // Add other hostnames here if needed in the future
      // {
      //   protocol: 'https',
      //   hostname: 'example.com',
      // },
    ],
  },
  // Add any other existing configurations you might have here
};

export default nextConfig;