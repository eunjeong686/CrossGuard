import { getJson } from './client';
import type { MetaStatusPayload } from '../types/api';

export function fetchMetaStatus() {
  return getJson<MetaStatusPayload>('/api/meta/status');
}

