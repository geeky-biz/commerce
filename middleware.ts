import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { detectColdStart } from './lib/cold-start';

/**
 * Middleware to add cold start detection header to all responses
 * This runs on every request (API routes, pages, server components, etc.)
 * 
 * Note: On Vercel, headers set via NextResponse.next() should work, but if they don't appear,
 * API routes need to add headers themselves using addColdStartHeader()
 */
export function middleware(request: NextRequest) {
  const coldStartInfo = detectColdStart();
  
  // Create response and add cold start headers directly
  // Using direct header setting instead of helper to ensure Vercel compatibility
  const response = NextResponse.next();
  
  // Set headers directly - this should work on Vercel
  response.headers.set('x-cold-start', coldStartInfo.isColdStart ? 'true' : 'false');
  response.headers.set('x-cold-start-runtime-age', coldStartInfo.runtimeAge.toString());
  response.headers.set('x-cold-start-request-count', coldStartInfo.requestCount.toString());
  response.headers.set('x-cold-start-runtime-initialized-at', new Date(coldStartInfo.runtimeInitializedAt).toISOString());
  
  return response;
}

// Configure which routes the middleware should run on
// Empty matcher means it runs on all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
