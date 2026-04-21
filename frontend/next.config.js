/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Required for production Docker image (see frontend/Dockerfile)
  output: 'standalone',
}

module.exports = nextConfig
