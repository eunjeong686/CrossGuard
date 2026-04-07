import { env } from '../config/env.js';
import type { RawApiRecord } from '../types/external.js';
import type { Coordinates, MobilityData, ServiceResult } from '../types/internal.js';
import { createTtlCache } from '../utils/cache.js';
import { HttpError } from '../utils/errors.js';
import { getDistanceMeters, offsetCoordinates } from '../utils/distance.js';
import { parseNumberValue, parseStringValue, parseTimestamp } from '../utils/publicData.js';
import { fetchAllPublicApiItems } from './publicApiClient.js';

const mobilityCache = createTtlCache<MobilityData[]>();

function getMockMobilitySupport(origin: Coordinates): MobilityData[] {
  const now = new Date().toISOString();

  return [
    {
      centerId: 'mob-1',
      centerName: '서울 중구 교통약자 이동지원센터',
      ...offsetCoordinates(origin, 0.0018, 0.001),
      availableVehicleCount: 3,
      operatingVehicleCount: 11,
      serviceStatus: '이용 가능',
      lastUpdatedAt: now,
    },
    {
      centerId: 'mob-2',
      centerName: '서울 서대문권 이동지원 거점',
      ...offsetCoordinates(origin, -0.0014, -0.001),
      availableVehicleCount: 1,
      operatingVehicleCount: 7,
      serviceStatus: '확인 필요',
      lastUpdatedAt: now,
    },
  ];
}

async function getLiveMobilitySupport(
  _origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<MobilityData[]> {
  if (!env.publicData.mobilityApiUrl || !env.publicData.serviceKey) {
    throw new HttpError(
      503,
      '이동지원 실데이터 연동 설정이 비어 있습니다. MOBILITY_API_URL과 PUBLIC_DATA_SERVICE_KEY를 확인해 주세요.',
    );
  }

  const baseUrl = env.publicData.mobilityApiUrl.replace(/\/$/, '');
  const query = {
    type: 'JSON',
    stdgCd: options?.stdgCd ?? env.publicData.mobilityStdgCd,
  };

  const [centerItems, useItems] = await Promise.all([
    fetchAllPublicApiItems<RawApiRecord>({
      label: '교통약자이동지원센터 현황정보',
      url: `${baseUrl}/center_info_v2`,
      query,
    }),
    fetchAllPublicApiItems<RawApiRecord>({
      label: '교통약자 택시 차량 이용가능 정보',
      url: `${baseUrl}/info_vehicle_use_v2`,
      query,
    }),
  ]);

  const useInfoByCenterId = new Map(
    useItems.map((item) => [parseStringValue(item.cntrId) ?? '', item]),
  );

  return centerItems
    .map((item) => {
      const centerId = parseStringValue(item.cntrId);
      const lat = parseNumberValue(item.lat);
      const lng = parseNumberValue(item.lot);

      if (!centerId || lat === null || lng === null) {
        return null;
      }

      const useInfo = useInfoByCenterId.get(centerId);
      const availableVehicleCount = parseNumberValue(useInfo?.avlVhclCntom);
      const operatingVehicleCount = parseNumberValue(useInfo?.oprVhclCntom);

      return {
        centerId,
        centerName: parseStringValue(item.cntrNm) ?? '이름 없는 센터',
        lat,
        lng,
        availableVehicleCount,
        operatingVehicleCount,
        serviceStatus:
          availableVehicleCount !== null
            ? availableVehicleCount > 0
              ? '이용 가능'
              : '확인 필요'
            : '정보 없음',
        lastUpdatedAt: parseTimestamp(useInfo?.totDt ?? item.totCrtrYmd),
      };
    })
    .filter((item): item is MobilityData => item !== null);
}

export async function getNearbyMobilitySupport(
  origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<ServiceResult<MobilityData>> {
  const resolvedStdgCd = options?.stdgCd ?? env.publicData.mobilityStdgCd;
  const cacheKey = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}:${resolvedStdgCd}`;
  const cached = mobilityCache.get(cacheKey);

  if (cached) {
    return {
      items: cached,
      source: env.publicData.mode === 'mock' ? 'mock' : 'live',
    };
  }

  if (env.publicData.mode === 'mock') {
    const mockData = getMockMobilitySupport(origin);
    mobilityCache.set(cacheKey, mockData, env.publicData.mobilityCacheTtlMs);
    return {
      items: mockData,
      source: 'mock',
    };
  }

  try {
    const liveData = await getLiveMobilitySupport(origin, options);
    const nearby = liveData
      .map((item) => ({
        item,
        distance: getDistanceMeters(origin, item),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 3)
      .map((entry) => entry.item);

    if (nearby.length === 0) {
      throw new HttpError(502, '이동지원 실데이터에서 주변 센터를 찾지 못했습니다.');
    }

    mobilityCache.set(cacheKey, nearby, env.publicData.mobilityCacheTtlMs);
    return {
      items: nearby,
      source: 'live',
    };
  } catch (error) {
    if (env.publicData.mode === 'hybrid') {
      const fallback = getMockMobilitySupport(origin);
      mobilityCache.set(cacheKey, fallback, env.publicData.mobilityCacheTtlMs);
      return {
        items: fallback,
        source: 'mock',
      };
    }

    throw error;
  }
}
