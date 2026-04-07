import { getJson } from './client';
import type { SummaryPayload } from '../types/api';

type SummaryOptions = {
  signalStdgCd?: string;
  busStdgCd?: string;
  mobilityStdgCd?: string;
  includeSignals?: boolean;
  includeBuses?: boolean;
  includeMobility?: boolean;
};

export function fetchSummary(lat: number, lng: number, options?: SummaryOptions) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
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

  if (options?.includeSignals !== undefined) {
    params.set('includeSignals', String(options.includeSignals));
  }

  if (options?.includeBuses !== undefined) {
    params.set('includeBuses', String(options.includeBuses));
  }

  if (options?.includeMobility !== undefined) {
    params.set('includeMobility', String(options.includeMobility));
  }

  return getJson<SummaryPayload>(`/api/location/summary?${params.toString()}`);
}
