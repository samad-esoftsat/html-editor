export function resolveDuplicateName(requested: unknown, sourceName: string): string {
  if (typeof requested === 'string') {
    const trimmed = requested.trim();
    if (trimmed.length > 0) return trimmed.slice(0, 200);
  }
  return `${sourceName} (copy)`;
}
