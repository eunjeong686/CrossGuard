import { useQuery } from '@tanstack/react-query';
import { fetchRouteCompare } from '../api/routesCompare';

type RouteCompareOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
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
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
