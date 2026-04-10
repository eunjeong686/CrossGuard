import { useQuery } from '@tanstack/react-query';
import { fetchRouteCompare } from '../api/routesCompare';

type RouteCompareOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  enabled?: boolean;
};

export function useRouteCompare(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  options?: RouteCompareOptions,
) {
  return useQuery({
    queryKey: [
      'route-compare',
      originLat,
      originLng,
      destLat,
      destLng,
      options?.signalStdgCd,
      options?.busStdgCd,
      options?.mobilityStdgCd,
    ],
    queryFn: () => fetchRouteCompare(originLat, originLng, destLat, destLng, options),
    enabled: options?.enabled ?? true,
    staleTime: 20_000,
    refetchInterval: options?.enabled === false ? false : 30_000,
  });
}
