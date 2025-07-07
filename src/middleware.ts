import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow NextAuth specific paths to pass through without checks.
  // This is crucial for the login process to work.
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }
  
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthPage = pathname === '/login';

  // If user is not logged in and not on the login page, redirect them to login.
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is logged in and on the login page, redirect them to the home page.
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Continue with the request if none of the above conditions are met.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * 
     * This ensures the middleware runs on all our pages and API routes,
     * but we explicitly allow NextAuth routes to pass through inside the function.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
