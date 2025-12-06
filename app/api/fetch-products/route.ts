import axios from 'axios';
import { addColdStartHeader } from 'lib/cold-start';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await axios.get('https://dummyjson.com/products');
    // Add cold start headers - required for API routes on Vercel
    // because NextResponse.json() creates a new response that doesn't inherit middleware headers
    const nextResponse = NextResponse.json(response.data);
    return addColdStartHeader(nextResponse);
  } catch (error) {
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
    return addColdStartHeader(errorResponse);
  }
}

