import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep disposable browser QA builds separate from the user's running dev server.
  distDir: process.env.JPAEVENTS_QA === 'true' ? '.verification/next-qa' : '.next',
};

export default nextConfig;
