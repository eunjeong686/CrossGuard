import { useQuery } from '@tanstack/react-query';
import { fetchMetaStatus } from '../api/meta';

export function useMetaStatus() {
  return useQuery({
    queryKey: ['meta-status'],
    queryFn: fetchMetaStatus,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}

