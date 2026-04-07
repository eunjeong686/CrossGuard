import type { ApiEnvelope } from '../types/internal.js';

export function buildResponse<T>(data: T, message: string | null = null): ApiEnvelope<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    dataSource: 'public-data',
    message,
    data,
  };
}
