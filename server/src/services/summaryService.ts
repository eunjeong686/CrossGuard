import type { Coordinates, PaceProfile, Persona, SummaryData } from '../types/internal.js';
import { getNearbyBuses } from './busService.js';
import { getNearbyMobilitySupport } from './mobilityService.js';
import { getNearbySignals } from './signalService.js';
import { getWalkContext } from './walkContextService.js';
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

function getIntersectionScore(summary: SummaryData['topSignal']) {
  if (!summary) {
    return 50;
  }

  if (summary.intersectionComplexity === '단순') {
    return 82;
  }

  if (summary.intersectionComplexity === '주의') {
    return 66;
  }

  return 44;
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

function getWalkAccessScore(
  topBus: SummaryData['topBus'],
  walkContext: SummaryData['walkContext'],
  paceProfile: PaceProfile,
) {
  const stopAccessBase =
    !topBus
      ? 48
      : topBus.stopAccessStatus === '편함'
        ? 84
        : topBus.stopAccessStatus === '보통'
          ? 68
          : 44;
  const walkContextAdjustment =
    walkContext.accessibilityLabel === '편함'
      ? 6
      : walkContext.accessibilityLabel === '주의'
        ? -10
        : 0;
  const paceAdjustment = paceProfile === 'slow' ? -6 : 0;

  return Math.max(35, Math.min(92, stopAccessBase + walkContextAdjustment + paceAdjustment));
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

function getBusLabel(routeNo: string | null | undefined) {
  if (!routeNo) {
    return '가까운 버스';
  }

  return routeNo.endsWith('버스') ? routeNo : `${routeNo}번 버스`;
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
  serviceSources: SummaryData['dataContext']['serviceSources'],
) {
  const scopeLabel = getScopeLabel(enabledServices);
  const allLive = enabledServices.every((service) => serviceSources[service] === 'live');
  const sourceLabel = allLive ? `${scopeLabel} 실시간 정보` : `${scopeLabel} 참고 정보`;

  if (score >= 80) {
    return {
      label: '낮음' as const,
      reason: `${sourceLabel}를 함께 보고 현재 이동 부담이 비교적 낮게 보입니다.`,
    };
  }

  if (score >= 50) {
    return {
      label: '보통' as const,
      reason: `${sourceLabel} 중 일부만 여유가 확인되어 현장 판단을 함께 권장합니다.`,
    };
  }

  return {
    label: '높음' as const,
    reason: `${sourceLabel}만으로는 여유를 확인하기 어려워 보수적으로 판단했습니다.`,
  };
}

function getWhyNow({
  topSignal,
  topBus,
  intersectionContext,
  walkContext,
}: {
  topSignal: SummaryData['topSignal'];
  topBus: SummaryData['topBus'];
  intersectionContext: SummaryData['intersectionContext'];
  walkContext: SummaryData['walkContext'];
}) {
  if (topSignal?.remainingSeconds != null && topSignal.remainingSeconds <= 5) {
    return '가까운 신호 잔여시간이 짧아 출발 타이밍을 보수적으로 보고 있습니다.';
  }

  if (topBus?.etaCategory === '촉박') {
    return '버스 도착 여유가 크지 않아 정류장까지 이동 부담을 함께 보고 있습니다.';
  }

  if (intersectionContext?.complexity === '복잡') {
    return '교차로 복잡도가 높아 신호 상태만으로 단정하지 않고 접근 부담을 함께 반영했습니다.';
  }

  if (walkContext.accessibilityLabel === '주의') {
    return '정류장 주변 보행 접근 정보에 주의 요소가 있어 신호와 거리 판단을 보수적으로 반영했습니다.';
  }

  return '신호 상태, 버스 여유, 정류장 접근 부담을 함께 보고 출발 전 판단을 돕고 있습니다.';
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
      reason: `${getBusLabel(topBus.routeNo)} 상태가 촉박하게 분류되어 이동 여유를 낮게 반영했습니다.`,
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
  options?: {
    persona?: Persona;
    paceProfile?: PaceProfile;
  },
): Promise<SummaryData> {
  const persona = options?.persona ?? 'default';
  const paceProfile = options?.paceProfile ?? 'default';
  const [signals, buses, mobilityCenters, walkContext] = await Promise.all([
    scope.includeSignals
      ? getNearbySignals(origin, { stdgCd: stdg.signalStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeBuses
      ? getNearbyBuses(origin, { stdgCd: stdg.busStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    scope.includeMobility
      ? getNearbyMobilitySupport(origin, { stdgCd: stdg.mobilityStdgCd })
      : Promise.resolve({ items: [], source: 'disabled' as const }),
    getWalkContext(origin),
  ]);

  const topSignal = signals.items[0] ?? null;
  const topBus = buses.items[0] ?? null;
  const topMobility = mobilityCenters.items[0] ?? null;
  const intersectionContext = topSignal
    ? {
        complexity: topSignal.intersectionComplexity,
        speedLimit: topSignal.speedLimit,
        laneWidth: topSignal.laneWidth,
        note:
          topSignal.intersectionComplexity === '복잡'
            ? '교차로 규모나 제한속도를 볼 때 한 번에 건너기보다 신호 변화를 여유 있게 보는 편이 좋습니다.'
            : topSignal.intersectionComplexity === '주의'
              ? '교차로가 아주 단순하지 않아 신호와 차량 흐름을 함께 보는 편이 좋습니다.'
              : '교차로 기본 정보 기준으로는 비교적 단순한 편입니다.',
      }
    : null;
  const freshnessMinutes = getFreshnessMinutes([
    topSignal?.collectedAt,
    topBus?.lastUpdatedAt,
    topMobility?.lastUpdatedAt,
  ]);
  const signalScore = scope.includeSignals ? getSignalScore(topSignal) : null;
  const busScore = scope.includeBuses ? getBusScore(topBus) : null;
  const freshnessScore = getFreshnessScore(freshnessMinutes);
  const intersectionScore = scope.includeSignals ? getIntersectionScore(topSignal) : null;
  const walkAccessScore = getWalkAccessScore(topBus, walkContext, paceProfile);
  const weightedScores = [
    signalScore != null
      ? { value: signalScore, weight: persona === 'elder' ? 0.28 : 0.24 }
      : null,
    busScore != null
      ? { value: busScore, weight: persona === 'guardian' ? 0.22 : 0.26 }
      : null,
    intersectionScore != null
      ? { value: intersectionScore, weight: persona === 'elder' ? 0.24 : 0.18 }
      : null,
    { value: walkAccessScore, weight: paceProfile === 'slow' ? 0.22 : 0.18 },
    { value: freshnessScore, weight: persona === 'guardian' ? 0.18 : 0.14 },
  ].filter((value): value is { value: number; weight: number } => value !== null);
  const score =
    weightedScores.length > 0
      ? Math.round(
          weightedScores.reduce((sum, item) => sum + item.value * item.weight, 0) /
            weightedScores.reduce((sum, item) => sum + item.weight, 0),
        )
      : 50;
  const movementBurden = getMovementBurden(score, scope.enabledServices, freshnessMinutes, {
    signals: signals.source,
    buses: buses.source,
    mobility: mobilityCenters.source,
  });
  const assistiveInsight = getAssistiveInsight({
    movementLabel: movementBurden.label,
    topSignal,
    topBus,
    topMobility,
    freshnessMinutes,
    enabledServices: scope.enabledServices,
  });
  const whyNow = getWhyNow({ topSignal, topBus, intersectionContext, walkContext });
  const scoreBreakdown: SummaryData['movementBurden']['scoreBreakdown'] = [
    {
      id: 'signal',
      label: '신호 여유',
      score: signalScore ?? 50,
      reason: topSignal
        ? `보행 상태 ${topSignal.pedestrianSignalStatusLabel}와 잔여시간을 반영했습니다.`
        : '주변 신호 정보가 부족해 기본값으로 반영했습니다.',
    },
    {
      id: 'bus',
      label: '버스 여유',
      score: busScore ?? 50,
      reason: topBus
        ? `${getBusLabel(topBus.routeNo)}의 ${topBus.etaCategory} 상태를 반영했습니다.`
        : '주변 버스 정보가 부족해 기본값으로 반영했습니다.',
    },
    {
      id: 'intersection',
      label: '교차로 부담',
      score: intersectionScore ?? 50,
      reason: intersectionContext
        ? `${intersectionContext.complexity} 수준으로 분류했습니다.`
        : '교차로 맥락 정보가 부족해 기본값으로 반영했습니다.',
    },
    {
      id: 'walkAccess',
      label: '정류장 접근',
      score: walkAccessScore,
      reason: `${walkContext.accessibilityLabel} 수준의 보행 접근 상태를 반영했습니다.`,
    },
    {
      id: 'freshness',
      label: '데이터 최신성',
      score: freshnessScore,
      reason:
        freshnessMinutes == null
          ? '수집 시각이 충분하지 않아 보수적으로 반영했습니다.'
          : `${freshnessMinutes}분 전 기준 데이터를 반영했습니다.`,
    },
  ];
  const topConcerns = [
    topSignal?.remainingSeconds != null && topSignal.remainingSeconds <= 5
      ? '신호가 곧 바뀔 수 있어 서두르기보다 한 번 더 확인하는 편이 좋습니다.'
      : null,
    topBus?.etaCategory === '촉박'
      ? '이번 버스는 촉박할 수 있어 다음 차량까지 같이 보는 편이 좋습니다.'
      : null,
    walkContext.stepsNearby ? '정류장 접근 경로에 계단 가능성이 있어 이동 경로를 먼저 살펴보세요.' : null,
    intersectionContext?.complexity === '복잡'
      ? '교차로 규모가 큰 편이라 신호와 차량 흐름을 함께 확인해 주세요.'
      : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
  const factors = [
    freshnessMinutes == null
      ? '데이터 신선도 정보를 충분히 확인하지 못해 보수적으로 반영했습니다.'
      : freshnessMinutes <= 3
        ? `최근 ${freshnessMinutes}분 내 갱신 데이터가 포함되어 있습니다.`
        : `최근 갱신이 ${freshnessMinutes}분 전으로 확인되어 신뢰도를 낮춰 반영했습니다.`,
    topBus?.stopDistanceMeters != null
      ? `가장 가까운 버스 승하차 기준 거리는 약 ${Math.round(topBus.stopDistanceMeters)}m입니다.`
      : '가까운 버스 승하차 기준 거리가 부족해 다른 데이터 비중을 높였습니다.',
    walkContext.source === 'osm'
      ? `주변 보행 시설(OpenStreetMap) 정보도 함께 반영했습니다.`
      : '보행 시설 정보가 제한적이어서 신호와 버스 기준을 우선 반영합니다.',
  ];

  return {
    location: origin,
    persona,
    paceProfile,
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
      whyNow,
      confidenceLabel: getConfidenceLabel(freshnessMinutes),
      freshnessMinutes,
      factors,
      topConcerns,
      scoreBreakdown,
      assistiveInsight,
    },
    topSignal,
    topBus,
    topMobility,
    intersectionContext,
    walkContext,
    signals: signals.items,
    buses: buses.items,
    mobilityCenters: mobilityCenters.items,
    disclaimer: '신호와 도착 정보는 참고용입니다. 반드시 실제 현장 신호와 주변 상황을 우선 확인하세요.',
  };
}
