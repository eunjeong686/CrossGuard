import type { ApiEnvelope } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export async function getJson<T>(url: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}${url}`);

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }

  return (await response.json()) as ApiEnvelope<T>;
}
