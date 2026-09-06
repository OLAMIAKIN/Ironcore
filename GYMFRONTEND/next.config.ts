import type { NextConfig } from "next";

/**
 * Where the API actually lives. Server-side only — the browser never sees this
 * value, and never talks to that origin directly.
 */
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  /**
   * The API is proxied under this app's own origin rather than called across
   * domains. The session is a pair of `SameSite=Lax` cookies, and a browser
   * will not send those on a cross-site request — so an API on its own domain
   * would sign people in and then 401 every request after it. Behind this
   * rewrite the cookies are first-party and the whole class of problem is gone,
   * along with any need for CORS in the browser.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
