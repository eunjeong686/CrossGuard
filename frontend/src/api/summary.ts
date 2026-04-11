import { getJson } from './client';
import type { PaceProfile, Persona, SummaryPayload } from '../types/api';

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

  if (options?.persona) {
    params.set('persona', options.persona);
  }

  if (options?.paceProfile) {
    params.set('paceProfile', options.paceProfile);
  }

  return getJson<SummaryPayload>(`/api/location/summary?${params.toString()}`);
}
