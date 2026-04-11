import { env } from '../config/env.js';
import type { Coordinates, SummaryData } from '../types/internal.js';
import { createTtlCache } from '../utils/cache.js';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
};

const walkContextCache = createTtlCache<SummaryData['walkContext']>();

function getDerivedWalkContext(): SummaryData['walkContext'] {
  return {
    source: 'derived',
    accessibilityLabel: '보통',
    note: '주변 보행 시설 정보는 제한적이어서 실시간 신호와 정류장 거리 기준으로 판단합니다.',
    stepsNearby: false,
    shelterNearby: false,
    crossingCount: 0,
    busStopCount: 0,
    signalCount: 0,
  };
}

function buildQuery(origin: Coordinates) {
  return `
[out:json][timeout:10];
(
  node(around:220,${origin.lat},${origin.lng})["highway"="crossing"];
  node(around:220,${origin.lat},${origin.lng})["highway"="traffic_signals"];
  node(around:220,${origin.lat},${origin.lng})["highway"="bus_stop"];
  node(around:220,${origin.lat},${origin.lng})["amenity"="shelter"];
  way(around:220,${origin.lat},${origin.lng})["highway"="steps"];
  way(around:220,${origin.lat},${origin.lng})["footway"="sidewalk"];
  way(around:220,${origin.lat},${origin.lng})["highway"="footway"];
);
out tags;
`;
}

async function fetchOverpass(origin: Coordinates): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.osm.timeoutMs);

  try {
    const response = await fetch(env.osm.overpassUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: buildQuery(origin),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWalkContext(origin: Coordinates): Promise<SummaryData['walkContext']> {
  const cacheKey = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}`;
  const cached = walkContextCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const elements = await fetchOverpass(origin);
    const crossingCount = elements.filter((element) => element.tags?.highway === 'crossing').length;
    const signalCount = elements.filter((element) => element.tags?.highway === 'traffic_signals').length;
    const busStopCount = elements.filter((element) => element.tags?.highway === 'bus_stop').length;
    const stepsNearby = elements.some((element) => element.tags?.highway === 'steps');
    const shelterNearby = elements.some(
      (element) => element.tags?.amenity === 'shelter' || element.tags?.shelter === 'yes',
    );
    const sidewalkCount = elements.filter(
      (element) => element.tags?.footway === 'sidewalk' || element.tags?.highway === 'footway',
    ).length;

    const accessibilityLabel =
      stepsNearby || sidewalkCount === 0 ? '주의' : shelterNearby || crossingCount >= 2 ? '편함' : '보통';
    const note =
      accessibilityLabel === '편함'
        ? '정류장 주변 횡단보도와 보행 시설이 비교적 확인되는 편입니다.'
        : accessibilityLabel === '주의'
          ? '계단이나 보행 시설 부족 가능성이 있어 정류장 접근을 한 번 더 확인해 주세요.'
          : '보행 시설 정보는 일부 확인되지만 현장 보행 여건을 함께 살펴보는 편이 좋습니다.';

    const result: SummaryData['walkContext'] = {
      source: 'osm',
      accessibilityLabel,
      note,
      stepsNearby,
      shelterNearby,
      crossingCount,
      busStopCount,
      signalCount,
    };

    walkContextCache.set(cacheKey, result, env.osm.cacheTtlMs);
    return result;
  } catch {
    const fallback = getDerivedWalkContext();
    walkContextCache.set(cacheKey, fallback, env.osm.cacheTtlMs);
    return fallback;
  }
}
