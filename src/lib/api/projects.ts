import type { ProjectData } from '@/lib/editor/types';

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

export async function createProject(
  slug: string,
  name?: string,
  template?: string,
  brandKitId?: string | null,
): Promise<ProjectSummary> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, name, template, brand_kit_id: brandKitId ?? null }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchProject(
  id: string,
  patch: { name?: string; data?: ProjectData; brand_kit_id?: string | null },
  ifUnmodifiedSince?: string,
): Promise<ProjectSummary> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ifUnmodifiedSince) headers['x-if-unmodified-since'] = ifUnmodifiedSince;
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  if (res.status === 409) throw Object.assign(new Error('conflict'), { code: 'conflict' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

export async function duplicateProject(id: string, name?: string): Promise<{ id: string }> {
  const init: RequestInit = { method: 'POST' };
  if (typeof name === 'string') {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify({ name });
  }
  const res = await fetch(`/api/projects/${id}/duplicate`, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
