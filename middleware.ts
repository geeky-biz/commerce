import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { addColdStartHeader } from './lib/cold-start';

/**
 * Middleware to add cold start detection header to all responses
 * This runs on every request (API routes, pages, server components, etc.)
 */
export function middleware(request: NextRequest) {
  // Create response and add cold start headers
  const response = NextResponse.next();
  addColdStartHeader(response);
  
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
