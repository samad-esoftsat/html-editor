import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const findWorkspaceMock = vi.fn();
const resolveMinRoleMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/auth/workspace', () => ({
  findWorkspace: findWorkspaceMock,
  resolveMinRole: resolveMinRoleMock,
}));

describe('image API route guards', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    findWorkspaceMock.mockReset();
    resolveMinRoleMock.mockReset();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
  });

  it('rejects invalid generate payloads before provider work starts', async () => {
    const { POST } = await import('@/app/api/images/generate/route');
    const res = await POST(new Request('http://localhost/api/images/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '', workspaceSlug: 'demo', requestKey: 'img_test_1234', aspectRatio: '16:9', count: 1 }),
    }) as never);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'invalid_prompt' });
    expect(findWorkspaceMock).not.toHaveBeenCalled();
  });

  it('returns forbidden when the user lacks editor rights', async () => {
    findWorkspaceMock.mockResolvedValue({
      org: { id: 'org-1', slug: 'demo', name: 'Demo' },
      role: 'viewer',
      userId: 'user-1',
    });
    resolveMinRoleMock.mockReturnValue(false);

    const { POST } = await import('@/app/api/images/generate/route');
    const res = await POST(new Request('http://localhost/api/images/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Create a banner', workspaceSlug: 'demo', requestKey: 'img_test_1234', aspectRatio: '16:9', count: 1 }),
    }) as never);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: 'forbidden' });
  });
});
