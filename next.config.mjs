/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows two local dev servers (public :3333, admin :3111) without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    if (process.env.UI_COMPARE_EMBED !== "1") return [];
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' http://127.0.0.1:3140 http://localhost:3140 http://127.0.0.1:3141 http://localhost:3141",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
