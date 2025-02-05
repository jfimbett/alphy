//import type { NextConfig } from "next";

const nextConfig = {
  devIndicators: {
    buildActivity: false,
  },
  experimental: {
    https: {
      key: './localhost+2-key.pem',
      cert: './localhost+2.pem',
    },
    turbo: {
      enabled: false, // Explicitly disable Turbopack
    },
  },
  webpack: (config: import('webpack').Configuration) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = { 
      fs: false,
      path: false,
      stream: false,
      zlib: false
    };
    return config;
  }
};

export default nextConfig;
