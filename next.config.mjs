/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.epa.uz' },
    ],
  },
};

export default nextConfig;
