import { env } from '../config/env.js';
import type { RawApiRecord } from '../types/external.js';
import type { Coordinates, ServiceResult, SignalData } from '../types/internal.js';
import { createTtlCache } from '../utils/cache.js';
import { HttpError } from '../utils/errors.js';
import { getDistanceMeters, offsetCoordinates } from '../utils/distance.js';
import { parseNumberValue, parseStringValue, parseTimestamp } from '../utils/publicData.js';
import { fetchAllPublicApiItems } from './publicApiClient.js';

const signalCache = createTtlCache<SignalData[]>();
const SIGNAL_DIRECTIONS = [
  { key: 'nt', label: 'N' },
  { key: 'et', label: 'E' },
  { key: 'st', label: 'S' },
  { key: 'wt', label: 'W' },
  { key: 'ne', label: 'NE' },
  { key: 'se', label: 'SE' },
  { key: 'sw', label: 'SW' },
  { key: 'nw', label: 'NW' },
] as const;

function getSignalStatusLabel(value: string | null) {
  if (value === 'protected-Movement-Allowed' || value === 'permissive-Movement-Allowed') {
    return {
      pedestrianSignalStatus: 'GREEN' as const,
      pedestrianSignalStatusLabel: '보행 가능',
    };
  }

  if (value === 'stop-And-Remain') {
    return {
      pedestrianSignalStatus: 'RED' as const,
      pedestrianSignalStatusLabel: '보행 불가',
    };
  }

  return {
    pedestrianSignalStatus: 'UNKNOWN' as const,
    pedestrianSignalStatusLabel: '정보 없음',
  };
}

function normalizeSignalDirection(item: RawApiRecord) {
  const candidates = SIGNAL_DIRECTIONS.map(({ key, label }) => {
    const remainingCentiseconds = parseNumberValue(item[`${key}PdsgRmndCs`]);
    const statusName = parseStringValue(item[`${key}PdsgSttsNm`]);

    return {
      direction: label,
      remainingSeconds:
        remainingCentiseconds !== null ? Math.max(0, Math.round(remainingCentiseconds / 100)) : null,
      statusName,
      ...getSignalStatusLabel(statusName),
    };
  });

  const best = candidates
    .slice()
    .sort((left, right) => {
      const leftScore =
        left.pedestrianSignalStatus === 'GREEN'
          ? 3
          : left.pedestrianSignalStatus === 'RED'
            ? 2
            : 1;
      const rightScore =
        right.pedestrianSignalStatus === 'GREEN'
          ? 3
          : right.pedestrianSignalStatus === 'RED'
            ? 2
            : 1;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return (right.remainingSeconds ?? -1) - (left.remainingSeconds ?? -1);
    })[0];

  return best ?? {
    direction: 'UNKNOWN',
    remainingSeconds: null,
    pedestrianSignalStatus: 'UNKNOWN' as const,
    pedestrianSignalStatusLabel: '정보 없음',
  };
}

function getMockSignals(origin: Coordinates): SignalData[] {
  const now = new Date().toISOString();

  return [
    {
      intersectionId: 'sig-1',
      intersectionName: '가까운 횡단보도',
      ...offsetCoordinates(origin, 0.0008, -0.0007),
      pedestrianSignalStatus: 'GREEN',
      pedestrianSignalStatusLabel: '보행 가능',
      remainingSeconds: 19,
      direction: 'NE',
      speedLimit: 30,
      laneWidth: 3.2,
      intersectionComplexity: '주의',
      collectedAt: now,
      advisoryOnly: true,
    },
    {
      intersectionId: 'sig-2',
      intersectionName: '주변 횡단보도',
      ...offsetCoordinates(origin, -0.0005, 0.001),
      pedestrianSignalStatus: 'RED',
      pedestrianSignalStatusLabel: '보행 불가',
      remainingSeconds: 46,
      direction: 'S',
      speedLimit: 40,
      laneWidth: 3.5,
      intersectionComplexity: '복잡',
      collectedAt: now,
      advisoryOnly: true,
    },
    {
      intersectionId: 'sig-3',
      intersectionName: '인근 횡단보도',
      ...offsetCoordinates(origin, 0.0011, 0.0004),
      pedestrianSignalStatus: 'UNKNOWN',
      pedestrianSignalStatusLabel: '정보 없음',
      remainingSeconds: null,
      direction: 'W',
      speedLimit: 30,
      laneWidth: 2.8,
      intersectionComplexity: '단순',
      collectedAt: now,
      advisoryOnly: true,
    },
  ];
}

function getIntersectionComplexity({
  speedLimit,
  laneWidth,
}: {
  speedLimit: number | null;
  laneWidth: number | null;
}): SignalData['intersectionComplexity'] {
  if ((speedLimit ?? 0) >= 50 || (laneWidth ?? 0) >= 4) {
    return '복잡';
  }

  if ((speedLimit ?? 0) >= 40 || (laneWidth ?? 0) >= 3) {
    return '주의';
  }

  return '단순';
}

async function getLiveSignals(
  _origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<SignalData[]> {
  if (!env.publicData.signalApiUrl || !env.publicData.serviceKey) {
    throw new HttpError(
      503,
      '신호등 실데이터 연동 설정이 비어 있습니다. SIGNAL_API_URL과 PUBLIC_DATA_SERVICE_KEY를 확인해 주세요.',
    );
  }

  const baseUrl = env.publicData.signalApiUrl.replace(/\/$/, '');
  const query = {
    type: 'JSON',
    stdgCd: options?.stdgCd ?? env.publicData.signalStdgCd,
  };

  const [mapItems, directionItems] = await Promise.all([
    fetchAllPublicApiItems<RawApiRecord>({
      label: '교차로 맵 정보',
      url: `${baseUrl}/crsrd_map_info`,
      query,
    }),
    fetchAllPublicApiItems<RawApiRecord>({
      label: '신호제어기 신호잔여시간 정보',
      url: `${baseUrl}/tl_drct_info`,
      query,
    }),
  ]);

  const directionByIntersectionId = new Map(
    directionItems.map((item) => [parseStringValue(item.crsrdId) ?? '', item]),
  );

  return mapItems
    .map((item) => {
      const intersectionId = parseStringValue(item.crsrdId);
      const lat = parseNumberValue(item.mapCtptIntLat);
      const lng = parseNumberValue(item.mapCtptIntLot);

      if (!intersectionId || lat === null || lng === null) {
        return null;
      }

      const directionItem = directionByIntersectionId.get(intersectionId);
      const speedLimit = parseNumberValue(item.lmttSpd);
      const laneWidth = parseNumberValue(item.laneWdth);
      const normalizedDirection = directionItem
        ? normalizeSignalDirection(directionItem)
        : {
            direction: 'UNKNOWN',
            remainingSeconds: null,
            pedestrianSignalStatus: 'UNKNOWN' as const,
            pedestrianSignalStatusLabel: '정보 없음',
          };

      return {
        intersectionId,
        intersectionName: parseStringValue(item.crsrdNm) ?? '이름 없는 교차로',
        lat,
        lng,
        pedestrianSignalStatus: normalizedDirection.pedestrianSignalStatus,
        pedestrianSignalStatusLabel: normalizedDirection.pedestrianSignalStatusLabel,
        remainingSeconds: normalizedDirection.remainingSeconds,
        direction: normalizedDirection.direction,
        speedLimit,
        laneWidth,
        intersectionComplexity: getIntersectionComplexity({ speedLimit, laneWidth }),
        collectedAt: parseTimestamp(directionItem?.totDt ?? item.totDt),
        advisoryOnly: true as const,
      };
    })
    .filter((item): item is SignalData => item !== null);
}

export async function getNearbySignals(
  origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<ServiceResult<SignalData>> {
  const resolvedStdgCd = options?.stdgCd ?? env.publicData.signalStdgCd;
  const cacheKey = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}:${resolvedStdgCd}`;
  const cached = signalCache.get(cacheKey);

  if (cached) {
    return {
      items: cached,
      source: env.publicData.mode === 'mock' ? 'mock' : 'live',
    };
  }

  if (env.publicData.mode === 'mock') {
    const mockData = getMockSignals(origin);
    signalCache.set(cacheKey, mockData, env.publicData.signalCacheTtlMs);
    return {
      items: mockData,
      source: 'mock',
    };
  }

  try {
    const liveData = await getLiveSignals(origin, options);
    const withDistance = liveData
      .map((item) => ({
        item,
        distance: getDistanceMeters(origin, item),
      }))
      .sort((left, right) => left.distance - right.distance);

    const withinPrimaryRadius = withDistance.filter((entry) => entry.distance <= 300);
    const withinFallbackRadius = withDistance.filter((entry) => entry.distance <= 500);
    const nearby = (withinPrimaryRadius.length > 0 ? withinPrimaryRadius : withinFallbackRadius.length > 0 ? withinFallbackRadius : withDistance)
      .slice(0, 3)
      .map((entry) => entry.item);

    if (nearby.length === 0) {
      throw new HttpError(502, '신호등 실데이터에서 위치 좌표가 유효한 교차로를 찾지 못했습니다.');
    }

    signalCache.set(cacheKey, nearby, env.publicData.signalCacheTtlMs);
    return {
      items: nearby,
      source: 'live',
    };
  } catch (error) {
    if (env.publicData.mode === 'hybrid') {
      const fallback = getMockSignals(origin);
      signalCache.set(cacheKey, fallback, env.publicData.signalCacheTtlMs);
      return {
        items: fallback,
        source: 'mock',
      };
    }

    throw error;
  }
}
