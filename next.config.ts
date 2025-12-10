import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages deployment
  ...(isStaticExport && {
    output: 'export',
    // GitHub Pages serves from a subdirectory by default
    basePath: '/CursorDocsGemini',
    images: {
      unoptimized: true,
    },
  }),
};

export default nextConfig;
