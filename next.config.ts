import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  typedRoutes: true,
  output: "export",
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
