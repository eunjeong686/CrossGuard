import { getJson } from './client';
import type { RouteComparePayload } from '../types/api';

type RouteCompareOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  enabled?: boolean;
};

export function fetchRouteCompare(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  options?: RouteCompareOptions,
) {
  const params = new URLSearchParams({
    originLat: String(originLat),
    originLng: String(originLng),
    destLat: String(destLat),
    destLng: String(destLng),
  });

  if (options?.signalStdgCd) {
    params.set('signalStdgCd', options.signalStdgCd);
  }

  if (options?.busStdgCd) {
    params.set('busStdgCd', options.busStdgCd);
  }

  if (options?.mobilityStdgCd) {
    params.set('mobilityStdgCd', options.mobilityStdgCd);
  }

  return getJson<RouteComparePayload>(`/api/routes/compare?${params.toString()}`);
}
