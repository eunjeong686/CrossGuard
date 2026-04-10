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

function getAssistiveInsight({
  movementLabel,
  topSignal,
  topBus,
  topMobility,
  freshnessMinutes,
  enabledServices,
}: {
  movementLabel: SummaryData['movementBurden']['label'];
  topSignal: SummaryData['topSignal'];
  topBus: SummaryData['topBus'];
  topMobility: SummaryData['topMobility'];
  freshnessMinutes: number | null;
  enabledServices: SummaryScope['enabledServices'];
}): SummaryData['movementBurden']['assistiveInsight'] {
  const hasSignal = enabledServices.includes('signals') && topSignal;
  const hasBus = enabledServices.includes('buses') && topBus;
  const hasMobility = enabledServices.includes('mobility') && topMobility;
  const staleData = freshnessMinutes != null && freshnessMinutes > 10;

  if (movementLabel === '높음') {
    return {
      message: '지금은 대체 이동수단을 먼저 살펴보세요.',
      reason: hasMobility
        ? '이동지원 상태와 주변 정보를 함께 보니 조금 더 보수적으로 보는 편이 좋습니다.'
        : '확인된 주변 정보만으로는 여유를 충분히 판단하기 어려운 상태입니다.',
      safetyReminder: '앱 안내는 참고용이며, 실제 현장 신호와 주변 상황을 우선 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  if (hasSignal && topSignal.remainingSeconds != null && topSignal.remainingSeconds <= 5) {
    return {
      message: '신호가 곧 바뀔 수 있어 조금 더 기다려 보세요.',
      reason: `가까운 신호의 남은 시간이 ${topSignal.remainingSeconds}초로 짧게 확인됐습니다.`,
      safetyReminder: '신호 잔여시간은 참고용이며, 눈앞의 신호와 차량 흐름을 먼저 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  if (hasBus && topBus.etaCategory === '촉박') {
    return {
      message: '버스보다 다음 선택지를 같이 보는 편이 좋아요.',
      reason: `${topBus.routeNo}번 버스 상태가 촉박하게 분류되어 이동 여유를 낮게 반영했습니다.`,
      safetyReminder: '버스를 서두르기보다 현장 이동 여건을 먼저 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  if (hasMobility && topMobility.serviceStatus === '확인 필요') {
    return {
      message: '이동지원은 한 번 더 확인하고 움직이세요.',
      reason: `${topMobility.centerName} 상태가 확인 필요로 분류되어 센터 확인을 권장합니다.`,
      safetyReminder: '센터 운영 상황은 변동될 수 있으니 실제 예약 가능 여부를 함께 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  if (staleData) {
    return {
      message: '정보가 조금 오래되어 현장 확인을 먼저 해주세요.',
      reason: `가장 최근에 확인한 주변 정보가 약 ${freshnessMinutes}분 전 기준입니다.`,
      safetyReminder: '앱 안내는 참고용이며, 실제 현장 신호와 주변 상황을 우선 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  if (movementLabel === '낮음') {
    return {
      message: '현재 정보로는 이동 부담이 크지 않아 보여요.',
      reason: '가까운 주변 정보와 갱신 상태를 함께 보니 비교적 여유가 있는 편으로 분류됐습니다.',
      safetyReminder: '그래도 실제 현장 신호와 주변 상황을 우선 확인해 주세요.',
      engine: 'local-rules',
    };
  }

  return {
    message: '신호와 이동수단을 함께 확인해 주세요.',
    reason: '확인된 정보 중 일부는 여유가 있지만, 현장 판단을 함께 보는 편이 좋습니다.',
    safetyReminder: '앱 안내는 참고용이며, 실제 현장 신호와 주변 상황을 우선 확인해 주세요.',
    engine: 'local-rules',
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
  const assistiveInsight = getAssistiveInsight({
    movementLabel: movementBurden.label,
    topSignal,
    topBus,
    topMobility,
    freshnessMinutes,
    enabledServices: scope.enabledServices,
  });
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
      assistiveInsight,
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
