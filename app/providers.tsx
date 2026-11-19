'use client';

import type { ReactNode } from 'react';
import { WorkforceProvider } from '@/lib/workforce-data';

export function Providers({ children }: { children: ReactNode }) {
  return <WorkforceProvider>{children}</WorkforceProvider>;
}
