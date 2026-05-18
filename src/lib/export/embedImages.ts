export function isFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost') return false;
  if (host.startsWith('127.')) return false;
  if (host.startsWith('10.')) return false;
  if (host.startsWith('192.168.')) return false;
  if (host.startsWith('169.254.')) return false;
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}
