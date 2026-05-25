'use client';

import { createContext, useContext } from 'react';
import type { GlobalStyles } from '@/lib/editor/types';

export type RenderTarget = 'editor' | 'email' | 'print';

interface RenderContextValue {
  global?: GlobalStyles;
  target: RenderTarget;
}

const RenderContext = createContext<RenderContextValue>({ target: 'editor' });

export const RenderContextProvider = RenderContext.Provider;

export function useRenderContext(): RenderContextValue {
  return useContext(RenderContext);
}
