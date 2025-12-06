/**
 * Cold Start Detection Utility for Vercel Serverless Functions
 * 
 * On Vercel, serverless function instances persist across multiple requests.
 * When a new instance is created (cold start), module-level variables are reset.
 * We can detect this by tracking when the runtime was initialized.
 */

// Module-level variables that persist across requests in the same instance
// but are reset when a new instance is created (cold start)
let runtimeInitializedAt: number | null = null;
let requestCount = 0;

/**
 * Detects if the current request is being served by a cold-started runtime
 * @returns Object containing cold start status and metadata
 */
export function detectColdStart(): {
  isColdStart: boolean;
  runtimeAge: number; // milliseconds since runtime was initialized
  requestCount: number; // number of requests served by this instance
  runtimeInitializedAt: number; // timestamp when runtime was initialized
} {
  const now = Date.now();
  
  // If runtimeInitializedAt is null, this is the first request in a new instance (cold start)
  if (runtimeInitializedAt === null) {
    runtimeInitializedAt = now;
    requestCount = 1;
    return {
      isColdStart: true,
      runtimeAge: 0,
      requestCount: 1,
      runtimeInitializedAt: now,
    };
  }
  
  // Increment request count for subsequent requests
  requestCount++;
  const runtimeAge = now - runtimeInitializedAt;
  
  // Consider it a cold start if the runtime was initialized very recently (< 1 second)
  // This handles edge cases where the module might be reloaded
  const isColdStart = runtimeAge < 1000;
  
  return {
    isColdStart,
    runtimeAge,
    requestCount,
    runtimeInitializedAt,
  };
}

/**
 * Get cold start information without incrementing request count
 * Useful for logging or monitoring without affecting the state
 */
export function getColdStartInfo(): {
  isColdStart: boolean;
  runtimeAge: number;
  requestCount: number;
  runtimeInitializedAt: number | null;
} {
  const now = Date.now();
  
  if (runtimeInitializedAt === null) {
    return {
      isColdStart: true,
      runtimeAge: 0,
      requestCount: 0,
      runtimeInitializedAt: null,
    };
  }
  
  const runtimeAge = now - runtimeInitializedAt;
  const isColdStart = runtimeAge < 1000;
  
  return {
    isColdStart,
    runtimeAge,
    requestCount,
    runtimeInitializedAt,
  };
}

/**
 * Helper to add cold start header to a NextResponse
 * Use this in API routes that create new NextResponse objects to ensure the header is always present
 * 
 * @example
 * ```ts
 * import { addColdStartHeader } from 'lib/cold-start';
 * import { NextRequest, NextResponse } from 'next/server';
 * 
 * export async function GET(request: NextRequest) {
 *   const response = NextResponse.json({ data: 'example' });
 *   return addColdStartHeader(response);
 * }
 * ```
 */
export function addColdStartHeader(response: Response): Response {
  const coldStartInfo = detectColdStart();
  response.headers.set('x-cold-start', coldStartInfo.isColdStart ? 'true' : 'false');
  response.headers.set('x-cold-start-runtime-age', coldStartInfo.runtimeAge.toString());
  response.headers.set('x-cold-start-request-count', coldStartInfo.requestCount.toString());
  response.headers.set('x-cold-start-runtime-initialized-at', new Date(coldStartInfo.runtimeInitializedAt).toISOString());
  return response;
}

