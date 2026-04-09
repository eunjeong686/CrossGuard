import type { Coordinates, RouteCompareData, RouteCompareOption, ServiceName } from '../types/internal.js';
import { getLocationSummary } from './summaryService.js';
import type { StdgOverride } from '../utils/stdg.js';

const ROUTE_DISTANCE_WINDOW_METERS = 700;

function haversineMeters(origin: Coordinates, target: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latDiff = toRadians(target.lat - origin.lat);
  const lngDiff = toRadians(target.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const targetLat = toRadians(target.lat);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(lngDiff / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistancePenalty(distanceMeters: number) {
  if (distanceMeters <= 200) {
    return 0;
  }

  if (distanceMeters <= 400) {
    return 4;
  }

  if (distanceMeters <= ROUTE_DISTANCE_WINDOW_METERS) {
    return 8;
  }

  return 12;
}

function toSourceLabels(services: ServiceName[], sources: Record<ServiceName, 'live' | 'mock' | 'disabled'>) {
  return services
    .map((service) => {
      const label = service === 'signals' ? '신호' : service === 'buses' ? '버스' : '이동지원';
      const source = sources[service];
      return `${label} ${source === 'live' ? 'LIVE' : source === 'mock' ? 'MOCK' : 'OFF'}`;
    })
    .filter((item) => !item.endsWith('OFF'));
}

function buildOption(input: {
  id: RouteCompareOption['id'];
  label: string;
  score: number;
  note: string;
  services: ServiceName[];
  confidenceLabel: RouteCompareOption['confidenceLabel'];
  sourceLabels: string[];
  recommended: boolean;
}): RouteCompareOption {
  const burden = input.score >= 80 ? '낮음' : input.score >= 55 ? '보통' : '높음';

  return {
    id: input.id,
    label: input.label,
    burden,
    score: input.score,
    note: input.note,
    recommended: input.recommended,
    includedServices: input.services,
    confidenceLabel: input.confidenceLabel,
    sourceLabels: input.sourceLabels,
  };
}

export async function getRouteComparison(
  origin: Coordinates,
  destination: Coordinates,
  stdg: StdgOverride,
): Promise<RouteCompareData> {
  const [busPrioritySummary, mobilityPrioritySummary] = await Promise.all([
    getLocationSummary(destination, stdg, {
      includeSignals: true,
      includeBuses: true,
      includeMobility: false,
      enabledServices: ['signals', 'buses'],
    }),
    getLocationSummary(destination, stdg, {
      includeSignals: true,
      includeBuses: false,
      includeMobility: true,
      enabledServices: ['signals', 'mobility'],
    }),
  ]);

  const destinationDistanceMeters = Math.round(haversineMeters(origin, destination));
  const distancePenalty = getDistancePenalty(destinationDistanceMeters);
  const busPriorityScore = Math.max(30, busPrioritySummary.movementBurden.score - distancePenalty);
  const mobilityPriorityScore = Math.max(
    30,
    mobilityPrioritySummary.movementBurden.score - Math.max(0, distancePenalty - 2),
  );
  const recommendedOptionId = mobilityPriorityScore > busPriorityScore ? 'mobility-priority' : 'bus-priority';

  const busOption = buildOption({
    id: 'bus-priority',
    label: '버스 우선 이동',
    score: busPriorityScore,
    note:
      destinationDistanceMeters <= 350
        ? '정류장 접근 부담이 크지 않아 버스와 신호를 함께 보며 이동하기 좋은 편입니다.'
        : '목적지까지 접근 거리가 길어 버스 탑승 전 이동 부담을 보수적으로 반영했습니다.',
    services: ['signals', 'buses'],
    confidenceLabel: busPrioritySummary.movementBurden.confidenceLabel,
    sourceLabels: toSourceLabels(['signals', 'buses'], busPrioritySummary.dataContext.serviceSources),
    recommended: recommendedOptionId === 'bus-priority',
  });
  const mobilityOption = buildOption({
    id: 'mobility-priority',
    label: '이동지원 우선 검토',
    score: mobilityPriorityScore,
    note:
      mobilityPrioritySummary.topMobility?.serviceStatus === '이용 가능'
        ? '이동지원 가용 상태가 확인되어 걷는 부담을 줄이는 대안으로 유리합니다.'
        : '이동지원 정보가 충분하지 않으면 버스보다 확실한 대안으로 보기 어려워 확인이 필요합니다.',
    services: ['signals', 'mobility'],
    confidenceLabel: mobilityPrioritySummary.movementBurden.confidenceLabel,
    sourceLabels: toSourceLabels(['signals', 'mobility'], mobilityPrioritySummary.dataContext.serviceSources),
    recommended: recommendedOptionId === 'mobility-priority',
  });

  return {
    origin,
    destination,
    destinationDistanceMeters,
    recommendedOptionId,
    options: [busOption, mobilityOption],
  };
}
