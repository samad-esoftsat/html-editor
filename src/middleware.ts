import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const WORKSPACE_PATH = /^\/w\/([^/]+)(?:\/|$)/;

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/')) return NextResponse.next({ request: req });

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDevRoute = process.env.NODE_ENV !== 'production' && path.startsWith('/dev/');
  const isPublic = path.startsWith('/login')
                || path.startsWith('/signup')
                || path.startsWith('/reset')
                || path.startsWith('/auth')
                || path.startsWith('/invite')
                || isDevRoute;

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  const wsMatch = user ? WORKSPACE_PATH.exec(path) : null;
  if (user && wsMatch) {
    const slug = decodeURIComponent(wsMatch[1]);
    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id, organizations!inner(slug)')
      .eq('user_id', user.id)
      .eq('organizations.slug', slug)
      .maybeSingle();

    if (!membership) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('error', 'no_workspace');
      return NextResponse.redirect(url);
    }

    if (req.cookies.get('last_ws')?.value !== slug) {
      res.cookies.set('last_ws', slug, {
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
