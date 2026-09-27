'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import type { ApiRequester } from '@/features/auth/types';

export function usePortalQuery<T>(
  key: readonly unknown[],
  loader: (request: ApiRequester, signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  const { status, identityKey, request } = useAuth();
  return useQuery({
    queryKey: ['portal', identityKey, ...key],
    queryFn: ({ signal }) => loader(request, signal),
    enabled: status === 'authenticated' && options.enabled !== false,
    refetchInterval: options.refetchInterval ?? false,
    retry: false,
  });
}
