'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createProject } from '@/lib/api/projects';

export function NewProjectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const project = await createProject();
      router.push(`/p/${project.id}`);
    } catch (e) {
      alert(`Couldn't create project: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <Button onClick={go} disabled={busy}>
      {busy ? <Spinner /> : '+ New Project'}
    </Button>
  );
}
