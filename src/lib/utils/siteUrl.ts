export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(next?: string) {
  const url = new URL('/auth/callback', getSiteUrl());
  if (next) url.searchParams.set('next', next);
  return url.toString();
}
