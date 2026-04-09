import type { Coordinates, SummaryData } from '../types/internal.js';
import { getNearbyBuses } from './busService.js';
import { getNearbyMobilitySupport } from './mobilityService.js';
import { getNearbySignals } from './signalService.js';
import type { StdgOverride, SummaryScope } from '../utils/stdg.js';

const SERVICE_LABELS = {
  signals: '신호',
  buses: '버스',
  mobility: '이동지원',
} as const;

function getSignalScore(summary: SummaryData['topSignal']) {
  if (!summary) {
    return 45;
  }

  if (summary.pedestrianSignalStatus === 'GREEN') {
    return 88;
  }

  if (summary.pedestrianSignalStatus === 'RED') {
    return 62;
  }

  return 50;
}

function getBusScore(summary: SummaryData['topBus']) {
  if (!summary) {
    return 45;
  }

  if (summary.etaCategory === '여유 있음') {
    return 82;
  }

  if (summary.etaCategory === '주의 필요') {
    return 66;
  }

  if (summary.etaCategory === '촉박') {
    return 44;
  }

  return 50;
}

function getMobilityScore(summary: SummaryData['topMobility']) {
  if (!summary) {
    return 45;
  }

  if (summary.serviceStatus === '이용 가능') {
    return 86;
  }

  if (summary.serviceStatus === '확인 필요') {
    return 60;
  }

  return 48;
}

function getScopeLabel(enabledServices: SummaryScope['enabledServices']) {
  if (enabledServices.length === 0) {
    return '선택한 데이터';
  }

  return enabledServices.map((service) => SERVICE_LABELS[service]).join('·');
}

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

function getFreshnessMinutes(timestamps: Array<string | null | undefined>) {
  const validTimes = timestamps
    .map((timestamp) => (timestamp ? new Date(timestamp).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (validTimes.length === 0) {
    return null;
  }

  const newestTimestamp = Math.max(...validTimes);
  return Math.max(0, Math.round((Date.now() - newestTimestamp) / 60_000));
}

function getFreshnessScore(freshnessMinutes: number | null) {
  if (freshnessMinutes == null) {
    return 52;
  }

  if (freshnessMinutes <= 1) {
    return 92;
  }

  if (freshnessMinutes <= 3) {
    return 82;
  }

  if (freshnessMinutes <= 10) {
    return 66;
  }

  return 50;
}

function getAccessDistanceScore(origin: Coordinates, summary: Pick<SummaryData, 'topSignal' | 'topBus' | 'topMobility'>) {
  const distanceParts = [
    summary.topSignal ? haversineMeters(origin, summary.topSignal) : null,
    summary.topBus?.stopDistanceMeters ?? null,
    summary.topMobility ? haversineMeters(origin, summary.topMobility) : null,
  ].filter((value): value is number => value !== null);

  if (distanceParts.length === 0) {
    return 50;
  }

  const averageDistance = distanceParts.reduce((sum, value) => sum + value, 0) / distanceParts.length;

  if (averageDistance <= 180) {
    return 88;
  }

  if (averageDistance <= 350) {
    return 74;
  }

  if (averageDistance <= 550) {
    return 60;
  }

  return 46;
}

function getConfidenceLabel(freshnessMinutes: number | null) {
  if (freshnessMinutes == null) {
    return '보통' as const;
  }

  if (freshnessMinutes <= 3) {
    return '높음' as const;
  }

  if (freshnessMinutes <= 10) {
    return '보통' as const;
  }

  return '낮음' as const;
}

function getMovementBurden(
  score: number,
  enabledServices: SummaryScope['enabledServices'],
  freshnessMinutes: number | null,
) {
  const scopeLabel = getScopeLabel(enabledServices);

  if (score >= 80) {
    return {
      label: '낮음' as const,
      reason: `${scopeLabel} 실데이터를 기준으로 현재 이동 부담이 비교적 낮게 보입니다.`,
    };
  }

  if (score >= 50) {
    return {
      label: '보통' as const,
      reason: `${scopeLabel} 실데이터 중 일부만 여유가 확인되어 현장 판단을 함께 권장합니다.`,
    };
  }

  return {
    label: '높음' as const,
    reason: `${scopeLabel} 실데이터만으로는 여유를 확인하기 어려워 보수적으로 판단했습니다.`,
  };
}

export async function getLocationSummary(
  origin: Coordinates,
  stdg: StdgOverride,
  scope: SummaryScope,
): Promise<SummaryData> {
  const [signals, buses, mobilityCenters] = await Promise.all([
    scope.includeSignals
      ? getNearbySignals(origin, { stdgCd: stdg.signalStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeBuses
      ? getNearbyBuses(origin, { stdgCd: stdg.busStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeMobility
      ? getNearbyMobilitySupport(origin, { stdgCd: stdg.mobilityStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
  ]);

  const topSignal = signals.items[0] ?? null;
  const topBus = buses.items[0] ?? null;
  const topMobility = mobilityCenters.items[0] ?? null;
  const freshnessMinutes = getFreshnessMinutes([
    topSignal?.collectedAt,
    topBus?.lastUpdatedAt,
    topMobility?.lastUpdatedAt,
  ]);
  const scoreParts = [
    scope.includeSignals ? getSignalScore(topSignal) : null,
    scope.includeBuses ? getBusScore(topBus) : null,
    scope.includeMobility ? getMobilityScore(topMobility) : null,
    getFreshnessScore(freshnessMinutes),
    getAccessDistanceScore(origin, { topSignal, topBus, topMobility }),
  ].filter((value): value is number => value !== null);
  const score =
    scoreParts.length > 0
      ? Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)
      : 50;
  const movementBurden = getMovementBurden(score, scope.enabledServices, freshnessMinutes);
  const factors = [
    freshnessMinutes == null
      ? '데이터 신선도 정보를 충분히 확인하지 못해 보수적으로 반영했습니다.'
      : freshnessMinutes <= 3
        ? `최근 ${freshnessMinutes}분 내 갱신 데이터가 포함되어 있습니다.`
        : `최근 갱신이 ${freshnessMinutes}분 전으로 확인되어 신뢰도를 낮춰 반영했습니다.`,
    topBus?.stopDistanceMeters != null
      ? `가장 가까운 버스 승하차 기준 거리는 약 ${Math.round(topBus.stopDistanceMeters)}m입니다.`
      : '가까운 버스 승하차 기준 거리가 부족해 다른 데이터 비중을 높였습니다.',
    topMobility?.availableVehicleCount != null
      ? `이동지원 가용 차량 ${topMobility.availableVehicleCount}대를 함께 고려했습니다.`
      : '이동지원 정보가 부족한 경우 신호와 버스 기준을 우선 반영합니다.',
  ];

  return {
    location: origin,
    dataContext: {
      signalStdgCd: stdg.signalStdgCd,
      busStdgCd: stdg.busStdgCd,
      mobilityStdgCd: stdg.mobilityStdgCd,
      enabledServices: scope.enabledServices,
      serviceSources: {
        signals: signals.source,
        buses: buses.source,
        mobility: mobilityCenters.source,
      },
    },
    lastUpdatedAt: new Date().toISOString(),
    movementBurden: {
      score,
      ...movementBurden,
      confidenceLabel: getConfidenceLabel(freshnessMinutes),
      freshnessMinutes,
      factors,
    },
    topSignal,
    topBus,
    topMobility,
    signals: signals.items,
    buses: buses.items,
    mobilityCenters: mobilityCenters.items,
    disclaimer: '신호와 도착 정보는 참고용입니다. 반드시 실제 현장 신호와 주변 상황을 우선 확인하세요.',
  };
}
