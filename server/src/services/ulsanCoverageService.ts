import { getNearbyBuses } from './busService.js';
import { getNearbySignals } from './signalService.js';
import type { Coordinates, UlsanCoverageSnapshot, UlsanPresetPlace } from '../types/internal.js';

type SamplePoint = {
  id: string;
  label: string;
  description: string;
  lat: number;
  lng: number;
};

const ULSAN_STDG_CD = '3100000000';
const COVERAGE_THRESHOLD = 70;
const ROUND_COUNT = 2;
const CACHE_TTL_MS = 1000 * 60 * 15;

const SAMPLE_POINTS: SamplePoint[] = [
  { id: 'ulsan-cityhall', label: '울산 시청', description: '울산 중심 업무지구 기준', lat: 35.5384, lng: 129.3114 },
  { id: 'samsan', label: '삼산동', description: '상업 중심권', lat: 35.5389, lng: 129.3356 },
  { id: 'taehwa', label: '태화강역', description: '환승 거점', lat: 35.5397, lng: 129.3535 },
  { id: 'seongnam', label: '성남동', description: '중구 생활권', lat: 35.5547, lng: 129.3206 },
  { id: 'u-jeong', label: '우정혁신도시', description: '혁신도시 생활권', lat: 35.5751, lng: 129.3135 },
  { id: 'junha', label: '전하동', description: '동구 주거권', lat: 35.507, lng: 129.427 },
  { id: 'bangeo', label: '방어동', description: '동구 해안권', lat: 35.4815, lng: 129.4315 },
  { id: 'hogae', label: '호계동', description: '북구 생활권', lat: 35.626, lng: 129.3564 },
  { id: 'hwajeong', label: '화정동', description: '북구 동부권', lat: 35.6402, lng: 129.3656 },
  { id: 'onsan', label: '온산읍', description: '남구 남부권', lat: 35.4185, lng: 129.3167 },
  { id: 'eonyang', label: '언양읍', description: '울주군 서부권', lat: 35.5636, lng: 129.1265 },
  { id: 'beomseo', label: '범서읍', description: '울주군 중심권', lat: 35.5695, lng: 129.2274 },
  { id: 'yaksa', label: '약사동', description: '중구 북부권', lat: 35.5734, lng: 129.3386 },
  { id: 'munsu', label: '문수월드컵경기장', description: '남구 스포츠권역', lat: 35.5395, lng: 129.2563 },
  { id: 'myeongchon', label: '명촌동', description: '북구 서부권', lat: 35.5662, lng: 129.3551 },
  { id: 'sinjeong', label: '신정동', description: '남구 생활 중심권', lat: 35.5315, lng: 129.3086 },
  { id: 'dalcheon', label: '달천동', description: '북구 외곽권', lat: 35.6544, lng: 129.3592 },
  { id: 'dongcheon', label: '동천체육관', description: '중구 스포츠권역', lat: 35.5692, lng: 129.3485 },
  { id: 'jeonhadong-port', label: '일산해수욕장 인근', description: '동구 해안 생활권', lat: 35.4919, lng: 129.4335 },
  { id: 'samnam', label: '삼남읍', description: '울주군 교통권역', lat: 35.5434, lng: 129.1565 },
];

type ProbeResult = {
  id: string;
  label: string;
  description: string;
  lat: number;
  lng: number;
  liveSuccess: number;
  signalItems: number;
  busItems: number;
};

let cachedSnapshot: UlsanCoverageSnapshot | null = null;
let cacheExpiresAt = 0;
let refreshInFlight: Promise<void> | null = null;

function toCoordinates(point: SamplePoint): Coordinates {
  return { lat: point.lat, lng: point.lng };
}

function distanceMeters(a: Coordinates, b: Coordinates) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latDiff = toRad(b.lat - a.lat);
  const lngDiff = toRad(b.lng - a.lng);
  const aa =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(lngDiff / 2) * Math.sin(lngDiff / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function pickRecommendedPlaces(probes: ProbeResult[]): UlsanPresetPlace[] {
  const ranked = probes
    .slice()
    .sort((left, right) => {
      if (left.liveSuccess !== right.liveSuccess) {
        return right.liveSuccess - left.liveSuccess;
      }

      const leftCount = left.signalItems + left.busItems;
      const rightCount = right.signalItems + right.busItems;
      return rightCount - leftCount;
    });

  if (ranked.length === 0) {
    return [];
  }

  const selected: ProbeResult[] = [ranked[0]];
  while (selected.length < 3 && ranked.length > selected.length) {
    const candidate = ranked
      .filter((item) => !selected.some((picked) => picked.id === item.id))
      .map((item) => {
        const nearestDistance = Math.min(
          ...selected.map((picked) => distanceMeters(toCoordinates(item), toCoordinates(picked))),
        );
        return { item, nearestDistance };
      })
      .sort((left, right) => right.nearestDistance - left.nearestDistance)[0];

    if (!candidate) {
      break;
    }

    selected.push(candidate.item);
  }

  return selected.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    lat: item.lat,
    lng: item.lng,
  }));
}

async function probePoint(point: SamplePoint) {
  let liveSuccess = 0;
  let signalItems = 0;
  let busItems = 0;

  for (let round = 0; round < ROUND_COUNT; round += 1) {
    const [signals, buses] = await Promise.all([
      getNearbySignals(toCoordinates(point), { stdgCd: ULSAN_STDG_CD }),
      getNearbyBuses(toCoordinates(point), { stdgCd: ULSAN_STDG_CD }),
    ]);

    signalItems += signals.items.length;
    busItems += buses.items.length;

    if (signals.source === 'live' && buses.source === 'live') {
      liveSuccess += 1;
    }
  }

  return {
    id: point.id,
    label: point.label,
    description: point.description,
    lat: point.lat,
    lng: point.lng,
    liveSuccess,
    signalItems,
    busItems,
  };
}

async function computeSnapshot(): Promise<UlsanCoverageSnapshot> {
  const probeResults: ProbeResult[] = [];

  for (const point of SAMPLE_POINTS) {
    // Keep probing sequentially to avoid burst calls to the public API.
    // This is a policy check, not a latency-critical request path.
    // eslint-disable-next-line no-await-in-loop
    probeResults.push(await probePoint(point));
  }

  const totalChecks = SAMPLE_POINTS.length * ROUND_COUNT;
  const liveCount = probeResults.reduce((sum, result) => sum + result.liveSuccess, 0);
  const coverageScore = Number(((liveCount / Math.max(totalChecks, 1)) * 100).toFixed(1));
  const selectionPolicy: UlsanCoverageSnapshot['selectionPolicy'] =
    coverageScore >= COVERAGE_THRESHOLD ? 'free' : 'preset';
  const recommendedPlaces = pickRecommendedPlaces(probeResults);
  const unstablePoints = probeResults
    .filter((result) => result.liveSuccess < ROUND_COUNT)
    .map((result) => ({
      id: result.id,
      label: result.label,
      lat: result.lat,
      lng: result.lng,
      liveSuccess: result.liveSuccess,
      totalChecks: ROUND_COUNT,
    }));

  return {
    threshold: COVERAGE_THRESHOLD,
    rounds: ROUND_COUNT,
    sampleCount: SAMPLE_POINTS.length,
    liveCount,
    coverageScore,
    selectionPolicy,
    updatedAt: new Date().toISOString(),
    recommendedPlaces,
    unstablePoints,
  };
}

async function refreshSnapshot() {
  const next = await computeSnapshot();
  cachedSnapshot = next;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export async function getUlsanCoverageSnapshot(): Promise<UlsanCoverageSnapshot> {
  const now = Date.now();

  if (cachedSnapshot && now < cacheExpiresAt) {
    return cachedSnapshot;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshSnapshot()
      .catch(() => {
        if (!cachedSnapshot) {
          cachedSnapshot = {
            threshold: COVERAGE_THRESHOLD,
            rounds: ROUND_COUNT,
            sampleCount: SAMPLE_POINTS.length,
            liveCount: 0,
            coverageScore: 0,
            selectionPolicy: 'preset',
            updatedAt: new Date().toISOString(),
            recommendedPlaces: SAMPLE_POINTS.slice(0, 3).map((point) => ({
              id: point.id,
              label: point.label,
              description: point.description,
              lat: point.lat,
              lng: point.lng,
            })),
            unstablePoints: [],
          };
          cacheExpiresAt = now + CACHE_TTL_MS;
        }
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  await refreshInFlight;
  return cachedSnapshot as UlsanCoverageSnapshot;
}

