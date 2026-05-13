'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Role } from '@/lib/auth/workspace';

const RoleCtx = createContext<Role>('viewer');

export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <RoleCtx.Provider value={role}>{children}</RoleCtx.Provider>;
}

export function useRole(): Role {
  return useContext(RoleCtx);
}

export function useCanEdit(): boolean {
  const role = useContext(RoleCtx);
  return role === 'owner' || role === 'editor';
}
