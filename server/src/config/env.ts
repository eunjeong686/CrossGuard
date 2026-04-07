import 'dotenv/config';

export type DataMode = 'mock' | 'hybrid' | 'live';

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMode(value: string | undefined): DataMode {
  if (value === 'mock' || value === 'hybrid' || value === 'live') {
    return value;
  }

  return 'mock';
}

export const env = {
  port: parseNumber(process.env.PORT, 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  publicData: {
    mode: parseMode(process.env.PUBLIC_DATA_MODE),
    serviceKey: process.env.PUBLIC_DATA_SERVICE_KEY ?? '',
    timeoutMs: parseNumber(process.env.PUBLIC_DATA_TIMEOUT_MS, 5000),
    signalApiUrl: process.env.SIGNAL_API_URL ?? '',
    busApiUrl: process.env.BUS_API_URL ?? '',
    mobilityApiUrl: process.env.MOBILITY_API_URL ?? '',
    signalStdgCd: process.env.SIGNAL_STDG_CD ?? '1100000000',
    busStdgCd: process.env.BUS_STDG_CD ?? '1100000000',
    mobilityStdgCd: process.env.MOBILITY_STDG_CD ?? '1100000000',
    signalCacheTtlMs: parseNumber(process.env.SIGNAL_CACHE_TTL_MS, 15_000),
    busCacheTtlMs: parseNumber(process.env.BUS_CACHE_TTL_MS, 15_000),
    mobilityCacheTtlMs: parseNumber(process.env.MOBILITY_CACHE_TTL_MS, 30_000),
    docs: {
      signal: 'https://www.data.go.kr/data/15157604/openapi.do',
      bus: 'https://www.data.go.kr/data/15157601/openapi.do',
      mobility: 'https://www.data.go.kr/data/15140825/openapi.do',
    },
  },
};
