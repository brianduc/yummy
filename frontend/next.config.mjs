/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Required for the standalone deploy path (e.g. AWS Node.js container)
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['staging.yummycode.cloud'],
};

export default nextConfig;
