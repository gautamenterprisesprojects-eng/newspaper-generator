import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone -- a self-contained server bundle (its own
  // minimal node_modules) that the production Dockerfile copies instead of
  // shipping the full node_modules tree into the image.
  output: "standalone",
};

export default nextConfig;
