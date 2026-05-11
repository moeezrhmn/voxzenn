import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Canonical NextAuth v5 middleware pattern: re-export `auth` directly as middleware.
// The `authorized` callback in authConfig decides allow vs. redirect-to-signIn.
// Using a custom function wrapper here can interfere with NextAuth's internal
// redirect handling (it was returning unexpected redirects on refresh).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
