/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Required for production Docker image (see frontend/Dockerfile)
  output: 'standalone',
  allowedDevOrigins: ['tinhthue.info.vn']
}

module.exports = nextConfig
