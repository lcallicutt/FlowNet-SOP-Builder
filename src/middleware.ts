import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Everything is protected except the marketing site, auth screens, public
 * share links, and webhook/queue endpoints (which verify their own
 * signatures).
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/share/(.*)",
  "/api/webhooks/(.*)",
  "/api/inngest(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
