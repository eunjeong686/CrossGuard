import { env } from '../config/env.js';
import type { RawApiRecord } from '../types/external.js';
import type { BusData, Coordinates, ServiceResult } from '../types/internal.js';
import { createTtlCache } from '../utils/cache.js';
import { HttpError } from '../utils/errors.js';
import { getDistanceMeters, offsetCoordinates } from '../utils/distance.js';
import { parseNumberValue, parseStringValue, parseTimestamp } from '../utils/publicData.js';
import { fetchAllPublicApiItems } from './publicApiClient.js';

const busCache = createTtlCache<BusData[]>();

function getEtaCategory({
  walkingDistanceMeters,
  busDistanceMeters,
  speedKmh,
}: {
  walkingDistanceMeters: number | null;
  busDistanceMeters: number | null;
  speedKmh: number | null;
}): BusData['etaCategory'] {
  if (walkingDistanceMeters === null || busDistanceMeters === null || speedKmh === null || speedKmh <= 0) {
    return '정보 부족';
  }

  const walkingSeconds = walkingDistanceMeters / 0.6;
  const busSeconds = busDistanceMeters / ((speedKmh * 1000) / 3600);
  const diff = busSeconds - walkingSeconds;

  if (diff >= 180) {
    return '여유 있음';
  }

  if (diff >= 60) {
    return '주의 필요';
  }

  return '촉박';
}

function getStopAccessStatus(stopDistanceMeters: number | null): BusData['stopAccessStatus'] {
  if (stopDistanceMeters == null || stopDistanceMeters > 320) {
    return '주의';
  }

  if (stopDistanceMeters > 180) {
    return '보통';
  }

  return '편함';
}

function getMockBuses(origin: Coordinates): BusData[] {
  const stop = offsetCoordinates(origin, 0.0013, -0.0002);
  const now = new Date().toISOString();

  return [
    {
      routeId: 'bus-1',
      routeNo: '400',
      routeType: '간선',
      routeOrigin: '시청앞',
      routeTerminus: '종합운동장',
      vehicleNo: '74가1234',
      ...offsetCoordinates(origin, 0.0025, -0.0008),
      speed: 19,
      heading: 188,
      lastUpdatedAt: now,
      nearStopName: '시청앞',
      stopSequence: 4,
      etaCategory: '여유 있음',
      stopDistanceMeters: getDistanceMeters(origin, stop),
      stopAccessStatus: '편함',
    },
    {
      routeId: 'bus-2',
      routeNo: '702A',
      routeType: '지선',
      routeOrigin: '프레스센터',
      routeTerminus: '회차지',
      vehicleNo: '72나9831',
      ...offsetCoordinates(origin, -0.0008, 0.0015),
      speed: 10,
      heading: 42,
      lastUpdatedAt: now,
      nearStopName: '프레스센터',
      stopSequence: 7,
      etaCategory: '주의 필요',
      stopDistanceMeters: 210,
      stopAccessStatus: '보통',
    },
    {
      routeId: 'bus-3',
      routeNo: '01A',
      routeType: '순환',
      routeOrigin: '서울도서관',
      routeTerminus: '도심순환',
      vehicleNo: '미확인',
      ...offsetCoordinates(origin, -0.002, -0.0012),
      speed: null,
      heading: null,
      lastUpdatedAt: now,
      nearStopName: '서울도서관',
      stopSequence: 11,
      etaCategory: '정보 부족',
      stopDistanceMeters: 320,
      stopAccessStatus: '주의',
    },
  ];
}

async function getLiveBuses(
  _origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<BusData[]> {
  if (!env.publicData.busApiUrl || !env.publicData.serviceKey) {
    throw new HttpError(
      503,
      '버스 실데이터 연동 설정이 비어 있습니다. BUS_API_URL과 PUBLIC_DATA_SERVICE_KEY를 확인해 주세요.',
    );
  }

  const baseUrl = env.publicData.busApiUrl.replace(/\/$/, '');
  const query = {
    type: 'JSON',
    stdgCd: options?.stdgCd ?? env.publicData.busStdgCd,
  };

  const [routeItems, stopItems, locationItems] = await Promise.all([
    fetchAllPublicApiItems<RawApiRecord>({
      label: '노선 기본 정보',
      url: `${baseUrl}/mst_info`,
      query,
    }),
    fetchAllPublicApiItems<RawApiRecord>({
      label: '노선 경유지 정보',
      url: `${baseUrl}/ps_info`,
      query,
    }),
    fetchAllPublicApiItems<RawApiRecord>({
      label: '버스 실시간 위치정보',
      url: `${baseUrl}/rtm_loc_info`,
      query,
    }),
  ]);

  const routeById = new Map(
    routeItems.map((item) => [parseStringValue(item.rteId) ?? '', item]),
  );

  const stopsByRouteId = new Map<string, Array<RawApiRecord & Coordinates>>();
  for (const stop of stopItems) {
    const routeId = parseStringValue(stop.rteId);
    const lat = parseNumberValue(stop.bstaLat);
    const lng = parseNumberValue(stop.bstaLot);

    if (!routeId || lat === null || lng === null) {
      continue;
    }

    const current = stopsByRouteId.get(routeId) ?? [];
    current.push({ ...stop, lat, lng });
    stopsByRouteId.set(routeId, current);
  }

  return locationItems
    .map((item) => {
      const routeId = parseStringValue(item.rteId);
      const vehicleNo = parseStringValue(item.vhclNo);
      const lat = parseNumberValue(item.lat);
      const lng = parseNumberValue(item.lot);

      if (!routeId || !vehicleNo || lat === null || lng === null) {
        return null;
      }

      const routeInfo = routeById.get(routeId);
      const nearestStop = (stopsByRouteId.get(routeId) ?? [])
        .map((stop) => ({
          stop,
          distance: getDistanceMeters(_origin, stop),
        }))
        .sort((left, right) => left.distance - right.distance)[0];

      const busDistanceToStop = nearestStop ? getDistanceMeters({ lat, lng }, nearestStop.stop) : null;
      const speed = parseNumberValue(item.oprSpd);

      return {
        routeId,
        routeNo: parseStringValue(item.rteNo) ?? parseStringValue(routeInfo?.rteNo) ?? '정보 없음',
        routeType: parseStringValue(routeInfo?.rteType) ?? '정보 없음',
        routeOrigin: parseStringValue(routeInfo?.stpnt),
        routeTerminus: parseStringValue(routeInfo?.edpnt),
        vehicleNo,
        lat,
        lng,
        speed,
        heading: parseNumberValue(item.oprDrct),
        lastUpdatedAt: parseTimestamp(item.totDt ?? item.gthrDt),
        nearStopName: parseStringValue(nearestStop?.stop.bstaNm) ?? '가까운 정류장 정보 없음',
        stopSequence: parseNumberValue(nearestStop?.stop.sttnOrd) ?? parseNumberValue(nearestStop?.stop.stopSeq),
        etaCategory: getEtaCategory({
          walkingDistanceMeters: nearestStop?.distance ?? null,
          busDistanceMeters: busDistanceToStop,
          speedKmh: speed,
        }),
        stopDistanceMeters: nearestStop?.distance ?? 9999,
        stopAccessStatus: getStopAccessStatus(nearestStop?.distance ?? null),
      };
    })
    .filter((item): item is BusData => item !== null);
}

export async function getNearbyBuses(
  origin: Coordinates,
  options?: { stdgCd?: string },
): Promise<ServiceResult<BusData>> {
  const resolvedStdgCd = options?.stdgCd ?? env.publicData.busStdgCd;
  const cacheKey = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}:${resolvedStdgCd}`;
  const cached = busCache.get(cacheKey);

  if (cached) {
    return {
      items: cached,
      source: env.publicData.mode === 'mock' ? 'mock' : 'live',
    };
  }

  if (env.publicData.mode === 'mock') {
    const mockData = getMockBuses(origin);
    busCache.set(cacheKey, mockData, env.publicData.busCacheTtlMs);
    return {
      items: mockData,
      source: 'mock',
    };
  }

  try {
    const liveData = await getLiveBuses(origin, options);
    const nearby = liveData
      .map((item) => ({
        item,
        distance: getDistanceMeters(origin, item),
      }))
      .sort((left, right) => {
        if (left.item.stopDistanceMeters !== right.item.stopDistanceMeters) {
          return left.item.stopDistanceMeters - right.item.stopDistanceMeters;
        }

        return left.distance - right.distance;
      })
      .slice(0, 3)
      .map((entry) => entry.item);

    if (nearby.length === 0) {
      throw new HttpError(502, '버스 실데이터에서 주변 차량을 찾지 못했습니다.');
    }

    busCache.set(cacheKey, nearby, env.publicData.busCacheTtlMs);
    return {
      items: nearby,
      source: 'live',
    };
  } catch (error) {
    if (env.publicData.mode === 'hybrid') {
      const fallback = getMockBuses(origin);
      busCache.set(cacheKey, fallback, env.publicData.busCacheTtlMs);
      return {
        items: fallback,
        source: 'mock',
      };
    }

    throw error;
  }
}
