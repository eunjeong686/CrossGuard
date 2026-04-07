import { env } from '../config/env.js';
import type { RawApiResponse } from '../types/external.js';
import { HttpError } from '../utils/errors.js';
import { ensurePublicApiSuccess, getPublicApiItems, getPublicApiTotalCount } from '../utils/publicData.js';

type QueryValue = string | number | boolean | null | undefined;

type PublicApiRequest = {
  label: string;
  url: string;
  query?: Record<string, QueryValue>;
};

type PagedPublicApiRequest = PublicApiRequest & {
  pageSize?: number;
  maxPages?: number;
};

function buildUrl(url: string, query?: Record<string, QueryValue>) {
  const target = new URL(url);

  if (env.publicData.serviceKey) {
    target.searchParams.set('serviceKey', env.publicData.serviceKey);
  }

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    target.searchParams.set(key, String(value));
  }

  return target;
}

export async function fetchPublicApiJson<T>({ label, url, query }: PublicApiRequest): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.publicData.timeoutMs);

  try {
    const response = await fetch(buildUrl(url, query), {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpError(502, `${label} API 호출이 실패했습니다. status=${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, `${label} API 호출 시간이 초과되었습니다.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAllPublicApiItems<T>({
  label,
  url,
  query,
  pageSize = 1000,
  maxPages = 10,
}: PagedPublicApiRequest): Promise<T[]> {
  const items: T[] = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const response = await fetchPublicApiJson<RawApiResponse>({
      label,
      url,
      query: {
        ...query,
        pageNo,
        numOfRows: pageSize,
      },
    });

    ensurePublicApiSuccess(response, label);

    const pageItems = getPublicApiItems<T>(response);
    const totalCount = getPublicApiTotalCount(response);
    items.push(...pageItems);

    if (pageItems.length === 0 || pageItems.length < pageSize) {
      break;
    }

    if (totalCount !== null && items.length >= totalCount) {
      break;
    }
  }

  return items;
}
