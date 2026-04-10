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
  const busPrioritySummary = await getLocationSummary(destination, stdg, {
    includeSignals: true,
    includeBuses: true,
    includeMobility: false,
    enabledServices: ['signals', 'buses'],
  });

  const destinationDistanceMeters = Math.round(haversineMeters(origin, destination));
  const distancePenalty = getDistancePenalty(destinationDistanceMeters);
  const busPriorityScore = Math.max(30, busPrioritySummary.movementBurden.score - distancePenalty);
  const signalPriorityScore = Math.max(
    30,
    busPrioritySummary.movementBurden.score - Math.max(0, distancePenalty - 4),
  );
  const recommendedOptionId = signalPriorityScore > busPriorityScore ? 'signal-priority' : 'bus-priority';

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
  const signalOption = buildOption({
    id: 'signal-priority',
    label: '신호 먼저 확인',
    score: signalPriorityScore,
    note:
      busPrioritySummary.topSignal?.remainingSeconds != null
        ? '가까운 신호 잔여시간을 먼저 확인하고 버스 쪽 이동 여유를 함께 보는 선택입니다.'
        : '신호 잔여시간이 부족할 수 있어 현장 신호를 먼저 확인하는 선택입니다.',
    services: ['signals', 'buses'],
    confidenceLabel: busPrioritySummary.movementBurden.confidenceLabel,
    sourceLabels: toSourceLabels(['signals', 'buses'], busPrioritySummary.dataContext.serviceSources),
    recommended: recommendedOptionId === 'signal-priority',
  });

  return {
    origin,
    destination,
    destinationDistanceMeters,
    recommendedOptionId,
    options: [busOption, signalOption],
  };
}
