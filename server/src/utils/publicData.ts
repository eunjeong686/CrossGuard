import type { RawApiResponse } from '../types/external.js';
import { HttpError } from './errors.js';

type PublicApiEnvelope = {
  header?: {
    resultCode?: string;
    resultMsg?: string;
  };
  body?: {
    totalCount?: number | string;
    items?: {
      item?: unknown[] | unknown;
    };
    item?: unknown[] | unknown;
  };
};

export function ensurePublicApiSuccess(response: RawApiResponse, label: string) {
  const envelope = response as PublicApiEnvelope;
  const resultCode = envelope.header?.resultCode;

  if (!resultCode || resultCode === 'K0') {
    return;
  }

  throw new HttpError(
    502,
    `${label} API 오류: ${resultCode}${envelope.header?.resultMsg ? ` ${envelope.header.resultMsg}` : ''}`,
  );
}

export function getPublicApiItems<T>(response: RawApiResponse): T[] {
  const envelope = response as PublicApiEnvelope;
  const rawItems = envelope.body?.items?.item ?? envelope.body?.item;

  if (!rawItems) {
    return [];
  }

  return Array.isArray(rawItems) ? (rawItems as T[]) : ([rawItems] as T[]);
}

export function getPublicApiTotalCount(response: RawApiResponse): number | null {
  const envelope = response as PublicApiEnvelope;
  return parseNumberValue(envelope.body?.totalCount);
}

export function parseNumberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

export function parseTimestamp(value: unknown): string {
  const normalized = parseStringValue(value);

  if (!normalized) {
    return new Date().toISOString();
  }

  if (/^\d{14}$/.test(normalized)) {
    const iso = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T${normalized.slice(8, 10)}:${normalized.slice(10, 12)}:${normalized.slice(12, 14)}+09:00`;
    return new Date(iso).toISOString();
  }

  if (/^\d{8}$/.test(normalized)) {
    const iso = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00+09:00`;
    return new Date(iso).toISOString();
  }

  const candidate = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const parsed = new Date(candidate);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}
