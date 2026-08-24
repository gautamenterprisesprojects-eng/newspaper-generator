import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone -- a self-contained server bundle (its own
  // minimal node_modules) that the production Dockerfile copies instead of
  // shipping the full node_modules tree into the image.
  output: "standalone",
  compiler: {
    // Strips every console.* call from the production client bundle at
    // build time -- the many diagnostic logs scattered through the
    // composition engines are useful in dev but would otherwise print
    // internal measurements/text straight into any visitor's devtools.
    // Source maps are already off by default (productionBrowserSourceMaps
    // is unset), so this closes the other half of "no code/internals
    // visible via inspect".
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
