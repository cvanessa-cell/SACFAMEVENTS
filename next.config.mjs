/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows two local dev servers (public :3333, admin :3111) without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
