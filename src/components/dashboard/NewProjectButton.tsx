'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { NewProjectDialog } from './NewProjectDialog';

export function NewProjectButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New Project</Button>
      <NewProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
