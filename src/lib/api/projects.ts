import type { ProjectData } from '@/lib/editor/types';

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

export async function createProject(
  name?: string,
  template?: string,
): Promise<ProjectSummary> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, template }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchProject(
  id: string,
  patch: { name?: string; data?: ProjectData },
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

export async function duplicateProject(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
