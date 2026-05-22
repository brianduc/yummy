import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Required for OpenNext Cloudflare builds and the existing standalone deploy path.
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['staging.yummycode.cloud'],
};

export default nextConfig;
