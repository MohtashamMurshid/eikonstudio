/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eikonstudio/core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
}

export default nextConfig
