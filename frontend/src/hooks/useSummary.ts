import { useQuery } from '@tanstack/react-query';
import { fetchSummary } from '../api/summary';

type SummaryOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  includeSignals?: boolean;
  includeBuses?: boolean;
  includeMobility?: boolean;
  enabled?: boolean;
};

export function useSummary(lat: number, lng: number, options?: SummaryOptions) {
  return useQuery({
    queryKey: [
      'summary',
      lat,
      lng,
      options?.signalStdgCd,
      options?.busStdgCd,
      options?.mobilityStdgCd,
      options?.includeSignals,
      options?.includeBuses,
      options?.includeMobility,
    ],
    queryFn: () => fetchSummary(lat, lng, options),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
    refetchInterval: options?.enabled === false ? false : 20_000,
  });
}
