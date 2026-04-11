import { useQuery } from '@tanstack/react-query';
import { fetchSummary } from '../api/summary';
import type { PaceProfile, Persona } from '../types/api';

type SummaryOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  includeSignals?: boolean;
  includeBuses?: boolean;
  includeMobility?: boolean;
  persona?: Persona;
  paceProfile?: PaceProfile;
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
      options?.persona,
      options?.paceProfile,
    ],
    queryFn: () => fetchSummary(lat, lng, options),
    enabled: options?.enabled ?? true,
    staleTime: 8_000,
    refetchInterval: options?.enabled === false ? false : 8_000,
  });
}
