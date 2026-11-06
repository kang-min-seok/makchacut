'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

const STALE_TIME_MS = 5 * 60 * 1000;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, refetchOnWindowFocus: false, retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
