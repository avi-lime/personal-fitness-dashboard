import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Workout-history imports send the whole CSV; years of Strong or Hevy export can pass
      // the 1 MB default. Kept under Vercel's 4.5 MB function payload cap.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
